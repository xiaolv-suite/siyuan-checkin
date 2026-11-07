/* TASK-20261031-github-benchmark-fusion
   对标 Loop Habit Tracker (uhabits), Habitica, My-GitHub-Contributions:
   1. 基于 EMA 的 0~100% 习惯强度指数 (Habit Strength) 与韧性进度条
   2. 「每周 N 次」弹性频率连击计算与 Skip 休息日/请假免断签搭桥
   3. 定量打卡 4 档完成度热力图色阶与薄弱星期诊断
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const sourceRoot = path.join(__dirname, "..", "src");
const read = (...parts) => fs.readFileSync(path.join(sourceRoot, ...parts), "utf8");

const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lc-benchmark-fusion-"));
const files = [
    "types.ts",
    "i18n.ts",
    "lunar.ts",
    "record-step.ts",
    "quota.ts",
    "rules.ts",
    "date-keys.ts",
    "model.ts",
    "analytics.ts",
    "charts.ts",
    "catalog.ts",
];

for (const filename of files) {
    const target = path.join(outputRoot, filename.replace(/\.ts$/, ".js"));
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, ts.transpileModule(read(filename), {
        compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS},
    }).outputText);
}

const analytics = require(path.join(outputRoot, "analytics.js"));
const charts = require(path.join(outputRoot, "charts.js"));
const catalog = require(path.join(outputRoot, "catalog.js"));

const {calculateHabitStrength, calculateFlexibleStreak, diagnoseWeakestDayOfWeek} = analytics;
const {renderHabitStrengthBar, buildQuantitativeHeatmap, renderQuantitativeHeatmap} = charts;
const {createWeeklyQuotaSchedule} = catalog;

console.log("Starting GitHub benchmark fusion tests...");

// ==========================================
// 1. EMA 习惯强度指数测试 (借鉴 uhabits / Loop Habit Tracker)
// ==========================================
{
    // 1.1 空历史
    const emptyResult = calculateHabitStrength([]);
    assert.equal(emptyResult.strength, 0, "empty history yields 0 strength");
    assert.equal(emptyResult.trend, "flat", "empty history trend is flat");

    // 1.2 半衰期因子对齐 uhabits 公式: m = 0.5^(sqrt(freq)/13)
    const dailyM = Math.pow(0.5, Math.sqrt(1) / 13);
    assert.ok(Math.abs(emptyResult.multiplier - Math.round(dailyM * 1000) / 1000) < 1e-4, "multiplier aligns with half-life formula");

    // 1.3 连续完成 30 天：强度单调增长，收敛并反映持续坚持
    const history30 = Array.from({length: 30}, () => true);
    const result30 = calculateHabitStrength(history30, 1);
    assert.ok(result30.strength > 75 && result30.strength < 90, `30 days of completion yields ~80% strength, got ${result30.strength}`);
    assert.equal(result30.trend, "up", "ongoing completion trend is up");
    assert.equal(result30.trendArrow, "↑", "trend arrow is up");

    // 1.4 核心韧性验证：坚持 60 天后漏打 1 天，强度仅轻微回落，绝不清零！
    const history60 = Array.from({length: 60}, () => true);
    const result60 = calculateHabitStrength(history60, 1);
    assert.ok(result60.strength >= 90, `60 days yields >=90% strength, got ${result60.strength}`);

    const historyMiss1 = [...history60, false];
    const resultMiss1 = calculateHabitStrength(historyMiss1, 1);
    assert.ok(resultMiss1.strength > 85, `1 missed day only drops slightly to >85%, got ${resultMiss1.strength}`);
    assert.ok(resultMiss1.strength < result60.strength, "missed day causes decay");
    assert.equal(resultMiss1.trend, "down", "missed day trend is down");
    assert.equal(resultMiss1.trendArrow, "↓", "trend arrow is down");
    assert.ok(resultMiss1.delta < 0, "delta is negative on missed day");

    // 1.5 主动标记 skip（休息日/请假免断签）：强度完全冻结，不衰减也不加成
    const historySkip = [...history60, {skipped: true}];
    const resultSkip = calculateHabitStrength(historySkip, 1);
    assert.equal(resultSkip.strength, result60.strength, "skipped day freezes strength score completely");
    assert.equal(resultSkip.trend, "flat", "skipped day trend is flat");
    assert.equal(resultSkip.trendArrow, "→", "trend arrow is flat");

    // 1.6 部分完成（如定量完成 50%）：按比例平滑计分
    const halfHistory = Array.from({length: 10}, () => ({value: 0.5}));
    const halfResult = calculateHabitStrength(halfHistory, 1);
    assert.ok(halfResult.strength > 0 && halfResult.strength < 50, "fractional values contribute proportionally");
}
console.log("✓ EMA Habit Strength assertions passed.");

// ==========================================
// 2. 弹性连击与 Skip 免断签搭桥 (借鉴 uhabits + Habitica)
// ==========================================
{
    // 2.1 日级连续 + Skip 休息日搭桥
    const dailyWithSkip = [
        {date: "2026-10-01", completed: true},
        {date: "2026-10-02", completed: true},
        {date: "2026-10-03", skipped: true}, // 周六休息免断签
        {date: "2026-10-04", skipped: true}, // 周日休息免断签
        {date: "2026-10-05", completed: true},
        {date: "2026-10-06", completed: true},
    ];
    const streakResult = calculateFlexibleStreak(dailyWithSkip, {allowSkipBridge: true});
    assert.equal(streakResult.currentStreak, 4, "4 completed days bridged by 2 skip days yields 4-streak");
    assert.equal(streakResult.longestStreak, 4, "longest streak is 4");
    assert.equal(streakResult.totalActiveUnits, 4, "total completed days is 4");

    // 2.2 日级连续中断（无 skip 直接漏打）
    const dailyBroken = [
        {date: "2026-10-01", completed: true},
        {date: "2026-10-02", completed: true},
        {date: "2026-10-03", completed: false}, // 未打卡且未请假
        {date: "2026-10-04", completed: true},
    ];
    const brokenResult = calculateFlexibleStreak(dailyBroken, {allowSkipBridge: true});
    assert.equal(brokenResult.currentStreak, 1, "unexcused gap resets current streak to 1");
    assert.equal(brokenResult.longestStreak, 2, "longest streak retains earlier 2");

    // 2.2b 日级稀疏自然日缺失中断（日期跳跃，如中间漏打未记录）
    const dailySparseGap = [
        {date: "2026-10-01", completed: true},
        {date: "2026-10-02", completed: true},
        // 10-03 完全缺席（未产生任何记录）
        {date: "2026-10-04", completed: true},
    ];
    const sparseResult = calculateFlexibleStreak(dailySparseGap, {allowSkipBridge: true});
    assert.equal(sparseResult.currentStreak, 1, "calendar day gap without entry resets streak to 1");
    assert.equal(sparseResult.longestStreak, 2, "longest streak retains earlier 2 before gap");

    // 2.3 每周 N 次弹性频次连击 (weeklyTarget = 3)
    // 构造第 1 周 (10/05~10/11) 完成 3 次，第 2 周 (10/12~10/18) 完成 4 次，第 3 周 (10/19~10/25) 完成 1 次 (未达标)
    const weeklyHistory = [
        // Week 1: 3 completions
        {date: "2026-10-05", completed: true},
        {date: "2026-10-07", completed: true},
        {date: "2026-10-09", completed: true},
        // Week 2: 4 completions
        {date: "2026-10-12", completed: true},
        {date: "2026-10-14", completed: true},
        {date: "2026-10-16", completed: true},
        {date: "2026-10-17", completed: true},
        // Week 3: only 1 completion (fails weekly target of 3)
        {date: "2026-10-20", completed: true},
    ];
    const weeklyResult = calculateFlexibleStreak(weeklyHistory, {weeklyTarget: 3});
    assert.equal(weeklyResult.mode, "weekly", "mode is weekly");
    assert.equal(weeklyResult.longestStreak, 2, "longest weekly streak is 2 weeks");
    assert.equal(weeklyResult.currentStreak, 0, "failed week 3 breaks current streak to 0");
    assert.equal(weeklyResult.totalActiveUnits, 2, "2 met weeks in total");

    // 2.4 每周 N 次辅助构造函数
    const schedule = createWeeklyQuotaSchedule(3);
    assert.equal(schedule.type, "quota");
    assert.equal(schedule.quota?.period, "week");
    assert.equal(schedule.quota?.amount, 3);
}
console.log("✓ Flexible Streak & Skip Bridge assertions passed.");

// ==========================================
// 3. 薄弱星期诊断洞察 (借鉴 uhabits)
// ==========================================
{
    // 构造模拟 Store：周六周日常常漏做
    const store = {
        version: 3,
        items: [{
            id: "habit-1",
            name: "晨读",
            icon: "📖",
            kind: "duration",
            target: 30,
            unit: "分钟",
            schedule: {type: "daily"},
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
            createdDate: "2026-09-01",
            revisions: [{effectiveDate: "2026-09-01", kind: "duration", target: 30, unit: "分钟", schedule: {type: "daily"}}],
            archivePeriods: [],
        }],
        events: [],
        eventTombstones: [],
    };

    // 过去 28 天，周一到周五每天打卡，周六周日不打卡
    const anchor = new Date(2026, 9, 31); // 2026-10-31 is Saturday
    for (let index = 0; index < 28; index += 1) {
        const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - index);
        const dayOfWeek = d.getDay();
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            // 工作日完成
            store.events.push({
                id: `ev-${index}`,
                itemId: "habit-1",
                occurredAt: `${dateStr}T09:00:00.000Z`,
                localDate: dateStr,
                value: 30,
                unit: "分钟",
                source: "manual",
            });
        }
    }

    const diagnosis = diagnoseWeakestDayOfWeek(store, {days: 28, asOf: anchor});
    assert.ok(diagnosis, "diagnosis must be produced");
    assert.ok(diagnosis.hasWeakness, "has weakness must be true when gap >= 15%");
    assert.equal(diagnosis.weakestDay.rate, 0, "weekend completion rate is 0%");
    assert.ok(diagnosis.strongestDay.rate >= 90, "weekday completion rate is high");
    assert.match(diagnosis.diagnosisText, /完成率最低/, "diagnosisText describes lowest completion rate");
    assert.ok(diagnosis.adviceText.length > 10, "adviceText provides constructive suggestion");
}
console.log("✓ Weakest Day-of-Week Diagnosis assertions passed.");

// ==========================================
// 4. 定量 4 档热力图与韧性进度条渲染 (借鉴 My-GitHub-Contributions)
// ==========================================
{
    // 4.1 习惯韧性条渲染
    const strengthBarHtml = renderHabitStrengthBar({
        strength: 84.5,
        trend: "up",
        trendArrow: "↑",
        delta: 2.1,
    }, {title: "阅读习惯韧性"});

    assert.match(strengthBarHtml, /role="meter"/, "strength bar must declare role=meter");
    assert.match(strengthBarHtml, /aria-valuenow="84.5"/, "strength bar must declare aria-valuenow=84.5");
    assert.match(strengthBarHtml, /is-strong/, "strength bar score >= 80 must have is-strong class");
    assert.match(strengthBarHtml, /84\.5% ↑ \(\+2\.1\)/, "strength bar must display score, arrow and delta");
    assert.match(strengthBarHtml, /style="width:84\.5%"/, "fill bar width must match score");

    // 4.2 定量 4 阶热力图数据构造
    // target = 2000 ml. 500ml (<25% -> level 1), 800ml (40% -> level 2), 1500ml (75% -> level 3), 2200ml (110% -> level 4)
    const quantitativeEvents = [
        {id: "q1", itemId: "water", occurredAt: "2026-03-01T08:00:00Z", localDate: "2026-03-01", value: 400, unit: "毫升", source: "manual"},
        {id: "q2", itemId: "water", occurredAt: "2026-03-02T08:00:00Z", localDate: "2026-03-02", value: 800, unit: "毫升", source: "manual"},
        {id: "q3", itemId: "water", occurredAt: "2026-03-03T08:00:00Z", localDate: "2026-03-03", value: 1600, unit: "毫升", source: "manual"},
        {id: "q4", itemId: "water", occurredAt: "2026-03-04T08:00:00Z", localDate: "2026-03-04", value: 2400, unit: "毫升", source: "manual", note: "运动后多喝水"},
        {id: "q5", itemId: "water", occurredAt: "2026-03-05T08:00:00Z", localDate: "2026-03-05", value: 0, unit: "毫升", source: "manual", kind: "skip"},
    ];

    const qHeatmap = buildQuantitativeHeatmap(quantitativeEvents, 2000, 2026, {unit: "毫升", itemId: "water"});
    assert.equal(qHeatmap.completedDays, 1, "1 day reached 100%");
    assert.equal(qHeatmap.totalRecordedDays, 4, "4 days had positive intake");

    const day1 = qHeatmap.days.find(d => d.date === "2026-03-01");
    const day2 = qHeatmap.days.find(d => d.date === "2026-03-02");
    const day3 = qHeatmap.days.find(d => d.date === "2026-03-03");
    const day4 = qHeatmap.days.find(d => d.date === "2026-03-04");
    const day5 = qHeatmap.days.find(d => d.date === "2026-03-05");

    assert.equal(day1.level, 1, "400/2000 = 20% -> level 1 (<25%)");
    assert.equal(day2.level, 2, "800/2000 = 40% -> level 2 (25~49%)");
    assert.equal(day3.level, 3, "1600/2000 = 80% -> level 3 (50~99%)");
    assert.equal(day4.level, 4, "2400/2000 = 120% -> level 4 (>=100%)");
    assert.equal(day4.note, "运动后多喝水", "note must be captured");
    assert.equal(day5.skip, true, "skip day marked as skip");

    // 4.3 定量 4 阶热力图 SVG 渲染
    const qHeatmapSvg = renderQuantitativeHeatmap(qHeatmap);
    assert.match(qHeatmapSvg, /class="lc-yearheatmap lc-yearheatmap--quantitative"/, "svg has quantitative heatmap class");
    assert.match(qHeatmapSvg, /class="is-level-1"/, "contains level 1 cells");
    assert.match(qHeatmapSvg, /class="is-level-2"/, "contains level 2 cells");
    assert.match(qHeatmapSvg, /class="is-level-3"/, "contains level 3 cells");
    assert.match(qHeatmapSvg, /class="is-level-4"/, "contains level 4 cells");
    assert.match(qHeatmapSvg, /2400\/2000毫升 \(120%\) · 运动后多喝水/, "day 4 tooltip contains amount, ratio and note");
}
console.log("✓ Quantitative Heatmap & Strength Bar rendering assertions passed.");

console.log("\nAll GitHub benchmark fusion tests passed successfully!");
