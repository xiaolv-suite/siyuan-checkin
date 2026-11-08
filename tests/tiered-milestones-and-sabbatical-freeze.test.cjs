/* Station 5: 多阶打卡里程碑目标与休假防断签冷冻模式专项单元测试
   涵盖 evaluateTieredMilestone 评价引擎、isDateInFreezePeriods 冷冻期匹配以及 calculateFlexibleStreak 连击守护 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lc-milestones-freeze-"));
const transpile = (relative) => {
    const source = fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
    const target = path.join(outputRoot, relative.replace(/\.ts$/, ".js"));
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText);
};

["src/types.ts", "src/rules.ts", "src/date-keys.ts", "src/model.ts", "src/shared.ts", "src/record-step.ts", "src/lunar.ts", "src/catalog.ts", "src/quota.ts", "src/analytics.ts"].forEach(transpile);
const analytics = require(path.join(outputRoot, "src/analytics.js"));

console.log("Starting Station 5 Tiered Milestones & Sabbatical Freeze tests...");

/* 1. 多阶里程碑评估引擎 (evaluateTieredMilestone) */
const spec = {
    base: 100,    // 保底：100字
    target: 500,  // 达标：500字
    heroic: 1000, // 突破：1000字
};

// 未达标
const ev0 = analytics.evaluateTieredMilestone(50, spec, "字");
assert.equal(ev0.tier, "none");
assert.equal(ev0.isEffective, false);
assert.equal(ev0.stars, 0);
assert.equal(ev0.badge, "未达标");

// 达成保底（消除破窗效应）
const ev1 = analytics.evaluateTieredMilestone(150, spec, "字");
assert.equal(ev1.tier, "base");
assert.equal(ev1.isEffective, true);
assert.equal(ev1.stars, 1);
assert.equal(ev1.badge, "保底");
assert.ok(ev1.description.includes("保底"));

// 达成常规目标
const ev2 = analytics.evaluateTieredMilestone(600, spec, "字");
assert.equal(ev2.tier, "target");
assert.equal(ev2.isEffective, true);
assert.equal(ev2.stars, 2);
assert.equal(ev2.badge, "达标");

// 达成高光突破目标
const ev3 = analytics.evaluateTieredMilestone(1200, spec, "字");
assert.equal(ev3.tier, "heroic");
assert.equal(ev3.isEffective, true);
assert.equal(ev3.stars, 3);
assert.equal(ev3.badge, "突破");

/* 2. 休假冷冻期校验 (isDateInFreezePeriods) */
const freezePeriods = [
    { startDate: "2026-10-01", endDate: "2026-10-07", reason: "国庆长假" },
    { startDate: "2026-11-15", endDate: "2026-11-16", reason: "生病休养" },
];

assert.equal(analytics.isDateInFreezePeriods("2026-10-03", freezePeriods), true, "假期内日期应命中冷冻期");
assert.equal(analytics.isDateInFreezePeriods("2026-10-01", freezePeriods), true, "起始日应命中");
assert.equal(analytics.isDateInFreezePeriods("2026-10-07", freezePeriods), true, "截止日应命中");
assert.equal(analytics.isDateInFreezePeriods("2026-10-08", freezePeriods), false, "假期后日期不应命中");
assert.equal(analytics.isDateInFreezePeriods("2026-10-03", []), false, "空冷冻期安全返回 false");

/* 3. 弹性连击结合休假冷冻期：连击守护不中断 (calculateFlexibleStreak with Sabbatical Freeze) */
// 场景：9-30 打卡，10-01 ~ 10-03 休假冷冻（无打卡事件），10-04 恢复打卡
const holidayHistory = [
    { date: "2026-09-29", completed: true },
    { date: "2026-09-30", completed: true },
    // 10-01 ~ 10-03 是国庆假期（中间有 3 天空白自然日，daysDiff = 4）
    { date: "2026-10-04", completed: true },
];

// 无冷冻期选项时：因为跨了 4 天，传统严格断链
const resWithoutFreeze = analytics.calculateFlexibleStreak(holidayHistory);
assert.equal(resWithoutFreeze.currentStreak, 1, "未开启冷冻期时，空白日导致连击被无情重置为 1");

// 开启冷冻期选项时：冷冻期内的空白日被自动保护搭桥，连击无缝接续（2 + 1 = 3 天）
const resWithFreeze = analytics.calculateFlexibleStreak(holidayHistory, {
    freezePeriods: [{ startDate: "2026-10-01", endDate: "2026-10-03", reason: "国庆假期" }],
});
assert.equal(resWithFreeze.currentStreak, 3, "冷冻期内自然日挂起保护，连击平滑接续至 3");
assert.equal(resWithFreeze.longestStreak, 3);

/* 4. 弹性连击结合多阶里程碑 (Tiered Milestones)：达成保底即防断签 */
const tieredHistory = [
    { date: "2026-11-01", value: 600, milestoneSpec: spec }, // 达标 (600 >= 500)
    { date: "2026-11-02", value: 120, milestoneSpec: spec }, // 仅保底 (120 >= 100, 但 < 500)
    { date: "2026-11-03", value: 1100, milestoneSpec: spec }, // 突破 (1100 >= 1000)
];

const resTiered = analytics.calculateFlexibleStreak(tieredHistory);
assert.equal(resTiered.currentStreak, 3, "第 2 天虽未达常规 500 字，但达成保底 100 字，连击成功守护不断");
assert.equal(resTiered.totalActiveUnits, 3);

console.log("All Station 5 Tiered Milestones & Sabbatical Freeze tests passed 100%!");
