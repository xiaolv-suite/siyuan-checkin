/* Station 5: 多阶里程碑目标、休假防断签冷冻模式与 Protyle 原生反向打卡全生命周期集成测试 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lc-station5-integration-"));
const transpile = (relative) => {
    const source = fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
    const target = path.join(outputRoot, relative.replace(/\.ts$/, ".js"));
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText);
};

[
    "src/types.ts",
    "src/record-step.ts",
    "src/quota.ts",
    "src/date-keys.ts",
    "src/rules.ts",
    "src/model.ts",
    "src/shared.ts",
    "src/analytics.ts",
    "src/features/lifelog-append.ts"
].forEach(transpile);

const model = require(path.join(outputRoot, "src/model.js"));
const analytics = require(path.join(outputRoot, "src/analytics.js"));
const lifelog = require(path.join(outputRoot, "src/features/lifelog-append.js"));

console.log("Starting Station 5 Full Lifecycle Integration tests...");

/* ========================================================================= */
/* 1. normalizeItem 与 normalizeRevisions 对 tieredSpec 的归一化往返 */
/* ========================================================================= */
const rawItemWithTiered = {
    id: "item-writing-001",
    name: "每日深度写作",
    kind: "quantity",
    target: 800,
    unit: "字",
    createdDate: "2026-10-01",
    tieredSpec: {
        base: 200,   // 保底 200 字
        heroic: 1600 // 突破 1600 字
    },
    revisions: [
        {
            effectiveDate: "2026-10-01",
            kind: "quantity",
            target: 800,
            unit: "字",
            tieredSpec: { base: 200, heroic: 1600 },
            schedule: { type: "daily" }
        }
    ]
};

const normItem = model.normalizeItem(rawItemWithTiered);
assert.notEqual(normItem, undefined);
assert.equal(normItem.name, "每日深度写作");
assert.equal(normItem.target, 800);
assert.deepEqual(normItem.tieredSpec, { base: 200, heroic: 1600 });
assert.equal(normItem.revisions.length, 1);
assert.deepEqual(normItem.revisions[0].tieredSpec, { base: 200, heroic: 1600 });

// 边界测试：非法负值或非数值 tieredSpec 安全过滤
const rawItemInvalidTiered = {
    id: "item-invalid-002",
    name: "无效数值项",
    kind: "count",
    target: 5,
    unit: "次",
    tieredSpec: {
        base: -10,
        heroic: "abc"
    }
};
const normInvalid = model.normalizeItem(rawItemInvalidTiered);
assert.equal(normInvalid.tieredSpec, undefined);

/* ========================================================================= */
/* 2. computeEventStreaks 结合休假冷冻期 (Streak Freeze) 连击守护 */
/* ========================================================================= */
const asOfDate = new Date("2026-10-05T12:00:00Z");
const store = {
    version: 3,
    items: [normItem],
    events: [
        // 10-01 打卡
        { id: "e1", itemId: "item-writing-001", localDate: "2026-10-01", occurredAt: "2026-10-01T08:00:00Z", value: 800, unit: "字", source: "manual" },
        // 10-02 ~ 10-04 为国庆长假休假冷冻期（无任何打卡事件）
        // 10-05 假期结束恢复打卡
        { id: "e2", itemId: "item-writing-001", localDate: "2026-10-05", occurredAt: "2026-10-05T09:00:00Z", value: 1000, unit: "字", source: "manual" }
    ],
    eventTombstones: []
};

// 场景 A：无冷冻期设置时，跨 4 天自然中断，连击重置为 1（仅 10-05 当天）
const streaksWithoutFreeze = model.computeEventStreaks(store, asOfDate);
assert.equal(streaksWithoutFreeze.get("item-writing-001"), 1, "无冷冻期时因断签连击应为 1");

// 场景 B：设置了 10-02 ~ 10-04 休假冷冻期，连击被守护，10-01 与 10-05 成功连击 = 2
const freezePeriods = [
    { startDate: "2026-10-02", endDate: "2026-10-04", reason: "国庆长假" }
];
const streaksWithFreeze = model.computeEventStreaks(store, asOfDate, freezePeriods);
assert.equal(streaksWithFreeze.get("item-writing-001"), 2, "命中休假冷冻期时连击不中断，应为 2");

/* ========================================================================= */
/* 3. Protyle 原生复选框反向打卡与成就卡生成往返一致性 */
/* ========================================================================= */
const cardMarkdown = lifelog.formatDailyAchievementCardMarkdown({
    date: "2026-10-05",
    currentStreak: 2,
    completionRate: 100,
    items: [
        { itemId: "item-writing-001", itemName: "每日深度写作", completed: true, tier: "heroic", value: 1000, unit: "字" }
    ]
});

assert.ok(cardMarkdown.includes("custom-checkin-id=\"item-writing-001\""));
assert.ok(cardMarkdown.includes("custom-type=\"daily-achievement\""));

// 模拟用户在正文将该待办项取消勾选（反向撤销打卡）
const reverseRevoke = lifelog.parseProtyleCheckboxMutation({
    text: "- [ ] 每日深度写作 (1000字) `🔥 突破` {: custom-checkin-id=\"item-writing-001\" custom-checkin-date=\"2026-10-05\" }",
    checked: false
}, "2026-10-05");

assert.notEqual(reverseRevoke, null);
assert.equal(reverseRevoke.itemId, "item-writing-001");
assert.equal(reverseRevoke.checked, false);
assert.equal(reverseRevoke.action, "revoke");

// 模拟用户在正文将该待办项重新打勾（反向完成打卡）
const reverseCheck = lifelog.parseProtyleCheckboxMutation({
    text: "- [x] 每日深度写作 (1000字) `🔥 突破` {: custom-checkin-id=\"item-writing-001\" custom-checkin-date=\"2026-10-05\" }",
    checked: true
}, "2026-10-05");

assert.notEqual(reverseCheck, null);
assert.equal(reverseCheck.itemId, "item-writing-001");
assert.equal(reverseCheck.checked, true);
assert.equal(reverseCheck.action, "record");

/* ========================================================================= */
/* 4. isDateInFreezePeriods 与推荐阶梯算法边界断言 */
/* ========================================================================= */
assert.equal(model.isDateInFreezePeriods("2026-10-02", freezePeriods), true);
assert.equal(model.isDateInFreezePeriods("2026-10-04", freezePeriods), true);
assert.equal(model.isDateInFreezePeriods("2026-10-05", freezePeriods), false);
assert.equal(model.isDateInFreezePeriods("2026-10-01", freezePeriods), false);
assert.equal(model.isDateInFreezePeriods("2026-10-03", []), false);

// 推荐阶梯 (30% / 150%) 纯函数推算
const targetVal = 1000;
const calcBase = Math.max(1, Math.round(targetVal * 0.3));
const calcHeroic = Math.max(targetVal + 1, Math.round(targetVal * 1.5));
assert.equal(calcBase, 300);
assert.equal(calcHeroic, 1500);

const evBase = analytics.evaluateTieredMilestone(calcBase, { base: calcBase, target: targetVal, heroic: calcHeroic }, "字");
assert.equal(evBase.tier, "base");
assert.equal(evBase.isEffective, true);

const evHeroic = analytics.evaluateTieredMilestone(calcHeroic, { base: calcBase, target: targetVal, heroic: calcHeroic }, "字");
assert.equal(evHeroic.tier, "heroic");
assert.equal(evHeroic.isEffective, true);

console.log("All Station 5 Full Lifecycle Integration tests passed 100%!");
