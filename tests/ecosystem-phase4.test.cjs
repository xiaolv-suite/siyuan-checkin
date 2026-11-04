const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

global.window = global.window || {};

const compiledCache = new Map();
function loadTs(filename) {
    const fullPath = path.resolve(filename);
    if (compiledCache.has(fullPath)) return compiledCache.get(fullPath).exports;
    const loaded = {exports: {}};
    compiledCache.set(fullPath, loaded);
    const compiled = ts.transpileModule(fs.readFileSync(fullPath, "utf8"), {
        compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}
    }).outputText;
    const localRequire = (name) => {
        if (name.startsWith(".")) {
            const resolvedTs = path.resolve(path.dirname(fullPath), name.endsWith(".ts") ? name : `${name}.ts`);
            return loadTs(resolvedTs);
        }
        return require(name);
    };
    new Function("require", "module", "exports", compiled)(localRequire, loaded, loaded.exports);
    return loaded.exports;
}

// 1. 测试 lv-notice-kit.ts Protocol v1.3.0
const noticeKit = loadTs(path.join(__dirname, "..", "src", "render", "lv-notice-kit.ts"));
const {lvBackup, lvEcosystem, lvActivity, lvNotify} = noticeKit;

assert.ok(lvBackup, "lvBackup 必须存在");
assert.ok(lvEcosystem, "lvEcosystem 必须存在");
assert.equal(typeof lvBackup.register, "function", "lvBackup.register 必须是函数");
assert.equal(typeof lvBackup.exportFull, "function", "lvBackup.exportFull 必须是函数");
assert.equal(typeof lvBackup.restoreFull, "function", "lvBackup.restoreFull 必须是函数");

// 测试生态诊断与徽章
const badgeText = lvEcosystem.getStatusBadgeText();
assert.match(badgeText, /小驴全家桶协同正常/, "状态徽章必须包含协同正常提示");
assert.match(badgeText, /今日活动 \d+ 项/, "状态徽章必须包含今日活动计数");

// 2. 测试 dumpCheckinData 与 restoreCheckinData
const exportMod = loadTs(path.join(__dirname, "..", "src", "export.ts"));
const {dumpCheckinData, restoreCheckinData} = exportMod;

assert.equal(typeof dumpCheckinData, "function", "dumpCheckinData 必须导出");
assert.equal(typeof restoreCheckinData, "function", "restoreCheckinData 必须导出");

const fakeStore = {
    version: 3,
    items: [
        {id: "read", name: "阅读", icon: "📖", kind: "numeric", target: 30, unit: "分钟", schedule: {type: "daily"}}
    ],
    events: [
        {id: "e1", itemId: "read", value: 30, unit: "分钟", occurredAt: "2026-11-03T10:00:00.000Z"}
    ],
    eventTombstones: [],
    itemTombstones: [],
    templates: []
};

const dump = dumpCheckinData(fakeStore, {extraMeta: "test"});
assert.equal(dump.v, 1);
assert.deepEqual(dump.store.items, fakeStore.items);
assert.equal(dump.extraMeta, "test");

const targetStore = {
    version: 1,
    items: [],
    events: [],
    eventTombstones: [],
    itemTombstones: [],
    templates: []
};

const restoreOk = restoreCheckinData(targetStore, dump);
assert.equal(restoreOk, true, "restoreCheckinData 必须返回 true");
assert.equal(targetStore.items.length, 1);
assert.equal(targetStore.items[0].name, "阅读");
assert.equal(targetStore.events.length, 1);

// 3. 测试 lvBackup 注册与全生态联合备份导出
let restored = false;
const unregister = lvBackup.register(
    "siyuan-checkin",
    async () => dumpCheckinData(fakeStore),
    async (data) => {
        restored = restoreCheckinData(targetStore, data);
        return restored;
    }
);

(async () => {
    const fullBackup = await lvBackup.exportFull();
    assert.equal(fullBackup.v, 1);
    assert.equal(fullBackup.ecosystem, "xiaolv");
    assert.ok(fullBackup.plugins["siyuan-checkin"], "全生态总包中必须包含 siyuan-checkin 插件数据");
    assert.equal(fullBackup.plugins["siyuan-checkin"].data.v, 1);

    const restoreResult = await lvBackup.restoreFull(fullBackup);
    assert.deepEqual(restoreResult.success, ["siyuan-checkin"], "联合恢复结果必须包含 siyuan-checkin 恢复成功");
    assert.equal(restoreResult.failed.length, 0);

    unregister();
    console.log("Ecosystem phase 4 tests passed: lvBackup and lvEcosystem fully verified.");
})();
