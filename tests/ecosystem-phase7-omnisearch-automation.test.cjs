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

// 1. 测试 Protocol v1.6.0: lvOmnisearch & lvAutomation
const noticeKit = loadTs(path.join(__dirname, "..", "src", "render", "lv-notice-kit.ts"));
const {lvOmnisearch, lvAutomation} = noticeKit;

assert.ok(lvOmnisearch, "lvOmnisearch 必须存在");
assert.equal(typeof lvOmnisearch.registerProvider, "function", "registerProvider 必须是函数");
assert.equal(typeof lvOmnisearch.search, "function", "search 必须是函数");

assert.ok(lvAutomation, "lvAutomation 必须存在");
assert.equal(typeof lvAutomation.registerRule, "function", "registerRule 必须是函数");
assert.equal(typeof lvAutomation.trigger, "function", "trigger 必须是函数");
assert.equal(typeof lvAutomation.getRules, "function", "getRules 必须是函数");

// 2. 模拟打卡穿透搜索提供者注册与检索
const unregisterOmni = lvOmnisearch.registerProvider("siyuan-checkin", (keyword) => {
    const kw = keyword.toLowerCase();
    const items = [
        {
            id: "checkin-item-1",
            source: "打卡",
            category: "habit",
            title: "🏃 晨跑训练",
            snippet: "目标 5公里 · 晨间习惯",
            badge: "习惯",
            onClick: () => {}
        },
        {
            id: "checkin-log-1",
            source: "打卡",
            category: "log",
            title: "打卡日志: 晨跑训练 +5公里",
            snippet: "2026-11-03 · 感觉良好",
            badge: "打卡",
            onClick: () => {}
        }
    ];
    return items.filter(i => i.title.toLowerCase().includes(kw) || i.snippet.toLowerCase().includes(kw));
});

(async () => {
    const results = await lvOmnisearch.search("晨跑");
    assert.ok(results.length >= 2, "穿透检索必须能匹配到项目与日志记录");
    assert.equal(results[0].source, "打卡");
    assert.match(results[0].title, /晨跑/);

    unregisterOmni();

    // 3. 测试管家到期自动待办联动规则 (lvAutomation)
    let triggeredPayload = null;
    const unregisterRule = lvAutomation.registerRule({
        id: "rule-home-to-checkin",
        name: "管家到期事项 ➔ 自动在打卡生成今日待办",
        desc: "当证件/保单还剩 3 天到期，自动在今日打卡生成高优待办项",
        enabled: true,
        triggerSource: "siyuan-home",
        triggerType: "expiring-item",
        actionPlugin: "siyuan-checkin",
        actionName: "create-todo",
        execute: async (item) => {
            triggeredPayload = item;
            return true;
        }
    });

    const rules = lvAutomation.getRules();
    const targetRule = rules.find(r => r.id === "rule-home-to-checkin");
    assert.ok(targetRule, "联动规则列表中必须存在 rule-home-to-checkin");
    assert.equal(targetRule.enabled, true);

    // 模拟管家触发到期事件
    const triggerRes = await lvAutomation.trigger("siyuan-home", "expiring-item", {
        title: "护照还有 3 天到期",
        dueDate: "2026-11-06"
    });

    assert.equal(triggerRes.triggered, 1, "必须命中 1 条联动规则");
    assert.equal(triggerRes.success, 1, "执行成功计数必须为 1");
    assert.ok(triggeredPayload, "联动 payload 必须被传递至 execute");
    assert.equal(triggeredPayload.title, "护照还有 3 天到期");

    unregisterRule();
    console.log("Phase 7 Omnisearch & Automation unit tests passed: Search provider and IFTTT rule fully verified.");
})();
