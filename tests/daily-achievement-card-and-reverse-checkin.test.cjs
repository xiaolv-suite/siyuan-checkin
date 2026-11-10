/* 每日自律成就卡 (Bento Callout) 与 Protyle 原生复选框反向勾选联动专项单元测试 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lc-card-reverse-"));
const transpile = (relative) => {
    const source = fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
    const target = path.join(outputRoot, relative.replace(/\.ts$/, ".js"));
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText);
};

["src/features/lifelog-append.ts"].forEach(transpile);
const lifelog = require(path.join(outputRoot, "src/features/lifelog-append.js"));

console.log("Starting Daily Achievement Card & Reverse Checkin tests...");

/* 1. formatDailyAchievementCardMarkdown 生成规范的原生 Callout 成就卡 */
const cardInput = {
    date: "2026-11-08",
    currentStreak: 16,
    completionRate: 100,
    motto: "自律即自由，积跬步以致千里",
    items: [
        { itemId: "item-1", itemName: "晨跑", completed: true, tier: "target", value: 5, unit: "km", energy: 4 },
        { itemId: "item-2", itemName: "深度写作", completed: true, tier: "heroic", value: 1200, unit: "字", note: "完成深度架构方案" },
        { itemId: "item-3", itemName: "晚间复盘", completed: true, tier: "base" },
    ],
};

const md = lifelog.formatDailyAchievementCardMarkdown(cardInput);
assert.ok(md.includes("> 🌅 **今日自律成就卡 · 2026-11-08**"));
assert.ok(md.includes("达成率: **100%** (3/3) · 连续 16 天🔥"));
assert.ok(md.includes("> - [x] **晨跑** (5km) `🟢 达标` ⚡4"));
assert.ok(md.includes("> - [x] **深度写作** (1200字) `🔥 突破` —— 完成深度架构方案"));
assert.ok(md.includes("> - [x] **晚间复盘** `⚪ 保底`"));
assert.ok(md.includes("custom-type=\"daily-achievement\""));
assert.ok(md.includes("custom-checkin-id=\"item-1\""));

/* 2. parseProtyleCheckboxMutation 反向复选框勾选联动解析 */
// 场景 A：从 DOM customAttrs 解析勾选
const mutA = lifelog.parseProtyleCheckboxMutation({
    text: "- [x] 晨跑",
    checked: true,
    customAttrs: {
        "custom-checkin-id": "item-run-001",
        "custom-checkin-date": "2026-11-08",
    },
}, "2026-11-08");

assert.notEqual(mutA, null);
assert.equal(mutA.itemId, "item-run-001");
assert.equal(mutA.date, "2026-11-08");
assert.equal(mutA.checked, true);
assert.equal(mutA.action, "record");

// 场景 B：从行内 Markdown IAL 文本解析取消勾选 (revoke)
const mutB = lifelog.parseProtyleCheckboxMutation({
    text: "- [ ] 深度写作 {: custom-checkin-id=\"item-write-002\" }",
    checked: false,
}, "2026-11-08");

assert.notEqual(mutB, null);
assert.equal(mutB.itemId, "item-write-002");
assert.equal(mutB.checked, false);
assert.equal(mutB.action, "revoke");

// 场景 C：非打卡任务行（无 custom-checkin-id）安全返回 null
const mutC = lifelog.parseProtyleCheckboxMutation({
    text: "- [x] 普通买菜待办",
    checked: true,
}, "2026-11-08");
assert.equal(mutC, null);

console.log("All Daily Achievement Card & Reverse Checkin tests passed 100%!");
