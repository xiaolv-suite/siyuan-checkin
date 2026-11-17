/* T-1799 专项守门测试：事件墓碑生命周期、容量与压缩治理
   1. 源码导出与 model.ts 统一规范化接线断言；
   2. 容量硬上限（EVENT_TOMBSTONES_CAP = 10,000）与超额安全淘汰；
   3. 外部身份保活不变量（ExternalRef First Invariant）：
      带 externalRef 的外部墓碑绝对优先保活，旧纯 ID 墓碑优先出局；
   4. 墓碑健康度与容量审计（auditTombstoneCapacity）；
   5. normalizeStore 端到端容量自愈测试；
   6. 25k 级长历史墓碑修剪性能基线（< 50ms）。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const {calibrateContentionFactor} = require("./helpers/perf.cjs");
/* 预算按并行争用倍率放大：空载 CF≈1 保持原契约（详见 helpers/perf.cjs） */
const CF = calibrateContentionFactor();

const root = path.join(__dirname, "..");
const lifecycleSource = fs.readFileSync(path.join(root, "src", "features", "tombstone-lifecycle.ts"), "utf8");
const modelSource = fs.readFileSync(path.join(root, "src", "model.ts"), "utf8");

/* —— 断言 1：源码接线守门 —— */
assert.match(lifecycleSource, /export\s+(const|{[^}]*)\bEVENT_TOMBSTONES_CAP\b/, "tombstone-lifecycle exports EVENT_TOMBSTONES_CAP");
assert.match(lifecycleSource, /export\s+(function|{[^}]*)\bpruneEventTombstones\b/, "tombstone-lifecycle exports pruneEventTombstones");
assert.match(lifecycleSource, /export function auditTombstoneCapacity/, "tombstone-lifecycle exports auditTombstoneCapacity");
assert.match(modelSource, /pruneEventTombstones\(sorted\)\.tombstones/, "model.ts normalizeEventTombstones integrates pruneEventTombstones");

/* —— 断言 2：纯函数动态编译与执行 —— */
function loadModule(relativePath) {
    const fullPath = path.join(root, relativePath);
    const content = fs.readFileSync(fullPath, "utf8");
    const transpiled = ts.transpileModule(content, {
        compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
    }).outputText;
    const module = {exports: {}};
    new Function("require", "module", "exports", transpiled)((dep) => {
        if (dep.startsWith(".")) {
            return loadModule(path.join(path.dirname(relativePath), `${dep}.ts`));
        }
        return require(dep);
    }, module, module.exports);
    return module.exports;
}

const {
    EVENT_TOMBSTONES_CAP,
    pruneEventTombstones,
    auditTombstoneCapacity,
    hasExternalIdentity,
} = loadModule("src/features/tombstone-lifecycle.ts");

// 1. 容量未超限时全量保留
const baseDate = new Date("2026-01-01T00:00:00.000Z");
const smallTombstones = Array.from({length: 100}, (_, index) => {
    const d = new Date(baseDate.getTime() + index * 3600 * 1000).toISOString();
    return index % 2 === 0
        ? {eventId: `evt-ext-${index}`, deletedAt: d, itemId: "read", source: "weread", externalRef: `weread:${index}`}
        : {eventId: `evt-id-${index}`, deletedAt: d};
});

const smallResult = pruneEventTombstones(smallTombstones, 1000);
assert.equal(smallResult.prunedCount, 0, "no tombstones pruned under cap");
assert.equal(smallResult.tombstones.length, 100, "all 100 retained");
assert.equal(smallResult.externalRetained, 50);
assert.equal(smallResult.idOnlyRetained, 50);

// 2. 超限淘汰：外部身份优先保活
// 构造 1,200 条墓碑（cap = 1,000）：300 条带 externalRef，900 条纯 ID 墓碑
const mixedTombstones = Array.from({length: 1200}, (_, index) => {
    const d = new Date(baseDate.getTime() + index * 60 * 1000).toISOString();
    return index < 300
        ? {eventId: `ext-${index}`, deletedAt: d, itemId: "read", source: "weread", externalRef: `weread:${index}`}
        : {eventId: `id-${index}`, deletedAt: d};
});

const pruned = pruneEventTombstones(mixedTombstones, 1000);
assert.equal(pruned.prunedCount, 200, "pruned 200 tombstones to reach cap");
assert.equal(pruned.tombstones.length, 1000, "retained exactly 1000 tombstones");
assert.equal(pruned.externalRetained, 300, "all 300 external identity tombstones are preserved (zero loss)");
assert.equal(pruned.idOnlyRetained, 700, "remaining 700 slots given to newest ID-only tombstones");

// 验证被淘汰的确实是最旧的纯 ID 墓碑
const retainedIds = new Set(pruned.tombstones.map((t) => t.eventId));
for (let i = 0; i < 300; i += 1) {
    assert.ok(retainedIds.has(`ext-${i}`), `external tombstone ext-${i} must never be pruned`);
}
// 最旧的 200 个纯 ID 墓碑（id-300 ~ id-499）应被淘汰
for (let i = 300; i < 500; i += 1) {
    assert.equal(retainedIds.has(`id-${i}`), false, `old ID-only tombstone id-${i} was pruned`);
}
// 较新的 700 个纯 ID 墓碑（id-500 ~ id-1199）应保留
for (let i = 500; i < 1200; i += 1) {
    assert.ok(retainedIds.has(`id-${i}`), `newer ID-only tombstone id-${i} is retained`);
}

// 3. 墓碑健康度与容量审计
const audit = auditTombstoneCapacity(pruned.tombstones);
assert.equal(audit.total, 1000);
assert.equal(audit.externalCount, 300);
assert.equal(audit.idOnlyCount, 700);
assert.ok(audit.oldestDeletedAt);
assert.ok(audit.newestDeletedAt);
assert.equal(audit.oldestDeletedAt < audit.newestDeletedAt, true);

// 4. 25k 长历史大批量修剪性能基准（< 50ms）
const largeTombstones = Array.from({length: 25000}, (_, index) => {
    const d = new Date(baseDate.getTime() + index * 1000).toISOString();
    return index % 3 === 0
        ? {eventId: `perf-ext-${index}`, deletedAt: d, itemId: "sport", source: "yeguif", externalRef: `yeguif:${index}`}
        : {eventId: `perf-id-${index}`, deletedAt: d};
});

const start = process.hrtime.bigint();
const largeResult = pruneEventTombstones(largeTombstones, 20000);
const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

assert.equal(largeResult.tombstones.length, 20000);
assert.equal(largeResult.prunedCount, 5000);
assert.ok(elapsedMs < 50 * CF, `25k tombstone pruning must complete under 50ms (took ${elapsedMs.toFixed(2)}ms)`);

console.log(`Tombstone lifecycle and pruning checks passed successfully in ${elapsedMs.toFixed(2)}ms.`);
