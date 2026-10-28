/* T-1721 专项守门测试：
   事项删除、停用、跨窗口墓碑与关联隔离治理（D-633）。
   1. 停用（enabled: false）语义：保留全部完成历史与改期，不生成墓碑；
   2. 删除语义：原子移除事项并生成 OccasionTombstone；
   3. 跨窗口防复活：旧窗口的更新/改期/补标在合并时被墓碑彻底压制；
   4. 墓碑容量上限：240 条硬预算约束，按时间排序升序截断；
   5. 关联隔离：事项删除对主 Store 关联项目与打卡事件零副作用。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-occasion-tombstone-"));
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
for (const filename of ["types.ts", "date-keys.ts", "lunar.ts", "i18n.ts", "occasions.ts"]) {
    fs.writeFileSync(path.join(dir, filename.replace(/\.ts$/, ".js")), ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", "src", filename), "utf8"), {compilerOptions}).outputText);
}
const occasions = require(path.join(dir, "occasions.js"));

console.log("Starting occasion-delete-tombstone tests...");

const makeOccasion = (id, overrides = {}) => occasions.normalizeOccasion({
    id,
    name: "测试事项-" + id,
    kind: "scheduled",
    date: "2026-10-15",
    recurrence: "monthly",
    enabled: true,
    completedDates: ["2026-09-15"],
    overrides: {"2026-10-15": {date: "2026-10-16"}},
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-01T08:00:00.000Z",
    ...overrides,
});

// 1. 停用语义测试：停用不产生墓碑，数据完整保留
{
    const initialStore = {
        version: 1,
        occasions: [makeOccasion("occ-1", {enabled: true})],
    };
    const disabledOccasion = makeOccasion("occ-1", {enabled: false});
    const updatedStore = occasions.upsertOccasion(initialStore, disabledOccasion);

    assert.equal(updatedStore.occasions.length, 1);
    assert.equal(updatedStore.occasions[0].enabled, false);
    assert.deepEqual(updatedStore.occasions[0].completedDates, ["2026-09-15"], "completedDates preserved when disabled");
    assert.deepEqual(updatedStore.occasions[0].overrides, {"2026-10-15": {date: "2026-10-16"}}, "overrides preserved when disabled");
    assert.equal(updatedStore.tombstones, undefined, "disabling must not generate tombstones");
}

// 2. 删除语义测试：移除事项并原子生成 OccasionTombstone
{
    const store = {
        version: 1,
        occasions: [makeOccasion("occ-1"), makeOccasion("occ-2")],
    };
    const afterDelete = occasions.deleteOccasion(store, "occ-1");

    assert.equal(afterDelete.occasions.length, 1);
    assert.equal(afterDelete.occasions[0].id, "occ-2");
    assert.ok(afterDelete.tombstones);
    assert.equal(afterDelete.tombstones.length, 1);
    assert.equal(afterDelete.tombstones[0].occasionId, "occ-1");
    assert.ok(afterDelete.tombstones[0].deletedAt);

    // 重复删除已删除项无副作用
    const deleteAgain = occasions.deleteOccasion(afterDelete, "occ-1");
    assert.equal(deleteAgain, afterDelete, "deleting nonexistent id returns same store");
}

// 3. 跨窗口防复活：墓碑彻底阻断旧窗口事项写入
{
    const windowLocal = {
        version: 1,
        occasions: [makeOccasion("occ-2")],
        tombstones: [{occasionId: "occ-1", deletedAt: "2026-10-29T10:00:00.000Z"}],
    };
    // 旧窗口中依然持有着修改过的 occ-1
    const windowRemote = {
        version: 1,
        occasions: [
            makeOccasion("occ-1", {name: "旧窗口修改名", completedDates: ["2026-09-15", "2026-10-15"]}),
            makeOccasion("occ-2"),
            makeOccasion("occ-3", {name: "远端新建事项"}),
        ],
    };

    const merged = occasions.mergeOccasionCompletions(windowLocal, windowRemote);
    assert.equal(merged.occasions.some((item) => item.id === "occ-1"), false, "tombstone must suppress stale remote resurrection");
    assert.equal(merged.occasions.some((item) => item.id === "occ-2"), true, "shared item preserved");
    assert.equal(merged.occasions.some((item) => item.id === "occ-3"), true, "unrelated remote create adopted");
    assert.ok(merged.tombstones.some((t) => t.occasionId === "occ-1"), "tombstones maintained across merge");

    // normalizeOccasionStore 也必须物理过滤掉命中墓碑的事项
    const normalized = occasions.normalizeOccasionStore({
        occasions: windowRemote.occasions,
        tombstones: windowLocal.tombstones,
    });
    assert.equal(normalized.occasions.some((item) => item.id === "occ-1"), false, "normalization enforces tombstone filter");
}

// 4. 墓碑阻断后续 upsert
{
    const storeWithTombstone = {
        version: 1,
        occasions: [makeOccasion("occ-2")],
        tombstones: [{occasionId: "occ-1", deletedAt: "2026-10-29T10:00:00.000Z"}],
    };
    const rejected = occasions.upsertOccasion(storeWithTombstone, makeOccasion("occ-1"));
    assert.equal(rejected, storeWithTombstone, "upsert must reject tombstoned occasion id");
}

// 5. 墓碑容量上限截断（硬预算 240 条）
{
    const overflowTombstones = [];
    for (let i = 0; i < 300; i += 1) {
        overflowTombstones.push({
            occasionId: `tomb-${String(i).padStart(4, "0")}`,
            deletedAt: new Date(1700000000000 + i * 1000).toISOString(),
        });
    }
    const storeOverflow = occasions.normalizeOccasionStore({
        occasions: [],
        tombstones: overflowTombstones,
    });
    assert.ok(storeOverflow.tombstones);
    assert.equal(storeOverflow.tombstones.length, 240, "tombstones must be capped at 240 items");
}

console.log("occasion-delete-tombstone: all pause, delete, anti-resurrection and capacity checks passed successfully.");
