const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const storageMap = new Map();
global.localStorage = {
    getItem: (k) => storageMap.get(k) ?? null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear(),
};
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

const noticeKit = loadTs(path.join(__dirname, "..", "src", "render", "lv-notice-kit.ts"));
const {lvLaunchpad} = noticeKit;

assert.ok(lvLaunchpad, "lvLaunchpad 模块必须存在");
assert.equal(typeof lvLaunchpad.register, "function", "lvLaunchpad.register 必须是函数");
assert.equal(typeof lvLaunchpad.getItems, "function", "lvLaunchpad.getItems 必须是函数");
assert.equal(typeof lvLaunchpad.setPluginState, "function", "lvLaunchpad.setPluginState 必须是函数");

let clickTriggered = false;
let actionReceived = "";

const unregister = lvLaunchpad.register({
    id: "siyuan-checkin",
    name: "打卡",
    fullName: "小驴打卡",
    svgIcon: "iconLvCheckin",
    color: "#f59e0b",
    desc: "习惯打卡 · 连击指数",
    digit: 1,
    badge: "3 待办",
    badgeType: "primary",
    actions: ["立即记录今日打卡", "追加写今日日记 (Daily Note)", "查看年度习惯热力图", "开启今日免打扰静音", "导出打卡数据明细"],
    onClick: () => { clickTriggered = true; },
    onAction: (action) => { actionReceived = action; },
});

const items = lvLaunchpad.getItems();
const checkinItem = items.find((i) => i.id === "siyuan-checkin");
assert.ok(checkinItem, "小驴罗盘中必须包含 siyuan-checkin 插件项");
assert.equal(checkinItem.name, "打卡");
assert.equal(checkinItem.fullName, "小驴打卡");
assert.equal(checkinItem.svgIcon, "iconLvCheckin");
assert.equal(checkinItem.color, "#f59e0b");
assert.equal(checkinItem.badge, "3 待办");
assert.equal(checkinItem.badgeType, "primary");
assert.equal(checkinItem.actions.length, 5);
assert.equal(checkinItem.state, "docked", "默认呈现状态必须为 docked");

// 测试点击主图标
checkinItem.onClick();
assert.equal(clickTriggered, true, "onClick 回调必须成功触发");

// 测试二级行动派发
checkinItem.onAction("查看年度习惯热力图");
assert.equal(actionReceived, "查看年度习惯热力图", "onAction 回调必须准确接收行动名称");

// 测试三态切换
lvLaunchpad.setPluginState("siyuan-checkin", "pinned");
assert.equal(lvLaunchpad.getItems().find((i) => i.id === "siyuan-checkin").state, "pinned", "状态必须切换为 pinned");

lvLaunchpad.setPluginState("siyuan-checkin", "hidden");
assert.equal(lvLaunchpad.getItems().find((i) => i.id === "siyuan-checkin").state, "hidden", "状态必须切换为 hidden");

// 测试注销
unregister();
const itemsAfter = lvLaunchpad.getItems();
assert.equal(itemsAfter.some((i) => i.id === "siyuan-checkin"), false, "注销后插件项必须从小驴罗盘中清除");

console.log("Launchpad integration unit tests passed: register, states, actions and teardown verified.");
