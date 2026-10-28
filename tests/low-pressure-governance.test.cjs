const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/* T-1678 专项守门测试：
   习惯产品与低压力交互基线更新
   1. 提醒降噪判定（已打卡、已跳过、休眠期、安静时段、每日预算）；
   2. 断签容忍与双日规则（maxGap 容错、中性 SKIP 桥接、平静重置）；
   3. 项目休眠与假期状态（失速分析豁免、提醒静音）；
   4. 低压力成就与反暗模式合规（永久点亮、超额 1.5 倍封顶、杜绝扣分掉级）；
   5. Calm 文案禁则校验（拦截愧疚词，推荐平静替代）。 */

const projectRoot = path.resolve(__dirname, "..");
const featureTs = fs.readFileSync(path.join(projectRoot, "src", "features", "low-pressure-governance.ts"), "utf8");
const compiled = ts.transpileModule(featureTs, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;
const moduleUnderTest = {exports: {}};
new Function("require", "module", "exports", compiled)(() => {}, moduleUnderTest, moduleUnderTest.exports);

const {
    evaluateReminderDenoising,
    evaluateStreakTolerance,
    evaluateItemPauseState,
    evaluateLowPressureAchievement,
    validateCalmCopy,
    LOW_PRESSURE_MILESTONES,
    CALM_PROHIBITED_WORDS,
} = moduleUnderTest.exports;

console.log("Starting low-pressure-governance tests...");

// 1. 提醒降噪判定断言
{
    // 今日已打卡：100% 静音
    const completedRes = evaluateReminderDenoising({
        itemId: "habit-1",
        asOfDate: "2026-10-29",
        isItemCompleted: true,
    });
    assert.equal(completedRes.shouldRemind, false);
    assert.equal(completedRes.reason, "completed-today");

    // 今日显式跳过：100% 静音
    const skippedRes = evaluateReminderDenoising({
        itemId: "habit-1",
        asOfDate: "2026-10-29",
        isItemCompleted: false,
        isItemSkipped: true,
    });
    assert.equal(skippedRes.shouldRemind, false);
    assert.equal(skippedRes.reason, "skipped-today");

    // 休眠期项目：100% 静音
    const pausedRes = evaluateReminderDenoising({
        itemId: "habit-1",
        asOfDate: "2026-10-29",
        isItemCompleted: false,
        pausedUntil: "2026-11-05",
    });
    assert.equal(pausedRes.shouldRemind, false);
    assert.equal(pausedRes.reason, "item-paused");

    // 安静免打扰时段内（如跨午夜 22:00 ~ 08:00，当前 23:30 = 1410 分钟）
    const quietRes = evaluateReminderDenoising({
        itemId: "habit-1",
        asOfDate: "2026-10-29",
        isItemCompleted: false,
        quietRange: {startMinutes: 1320, endMinutes: 480},
        currentMinute: 1410,
    });
    assert.equal(quietRes.shouldRemind, false);
    assert.equal(quietRes.reason, "in-quiet-hours");

    // 每日提醒预算超额（默认预算 2 次，已投递 2 次）
    const budgetRes = evaluateReminderDenoising({
        itemId: "habit-1",
        asOfDate: "2026-10-29",
        isItemCompleted: false,
        remindersDeliveredToday: 2,
    });
    assert.equal(budgetRes.shouldRemind, false);
    assert.equal(budgetRes.reason, "daily-budget-reached");

    // 正常合规提醒
    const eligibleRes = evaluateReminderDenoising({
        itemId: "habit-1",
        asOfDate: "2026-10-29",
        isItemCompleted: false,
        remindersDeliveredToday: 0,
        currentMinute: 600, // 10:00
        quietRange: {startMinutes: 1320, endMinutes: 480},
    });
    assert.equal(eligibleRes.shouldRemind, true);
    assert.equal(eligibleRes.reason, "eligible");
}

// 2. 断签容忍与双日规则判定断言
{
    // 全勤连续
    const continuousRes = evaluateStreakTolerance({
        consecutiveMissedDays: 0,
        currentStreak: 15,
    });
    assert.equal(continuousRes.isTolerated, true);
    assert.equal(continuousRes.status, "continuous");
    assert.equal(continuousRes.effectiveStreak, 15);

    // 双日规则：单日遗漏（断一天是数据，连断两天才是信号）
    const singleGapRes = evaluateStreakTolerance({
        consecutiveMissedDays: 1,
        streakTolerance: 0,
        currentStreak: 15,
    });
    assert.equal(singleGapRes.isTolerated, true);
    assert.equal(singleGapRes.status, "tolerated-single-gap");
    assert.equal(singleGapRes.messageKey, "report.stalledNote");
    assert.equal(singleGapRes.effectiveStreak, 15);

    // 显式跳过（SKIP 桥接）
    const skipBridgeRes = evaluateStreakTolerance({
        consecutiveMissedDays: 1,
        hasExplicitSkip: true,
        currentStreak: 15,
    });
    assert.equal(skipBridgeRes.isTolerated, true);
    assert.equal(skipBridgeRes.status, "skip-neutral-bridge");
    assert.equal(skipBridgeRes.effectiveStreak, 15);

    // 连续中断 ≥2 天：平静重置，重置至 0，不使用羞耻措辞
    const breakRes = evaluateStreakTolerance({
        consecutiveMissedDays: 2,
        streakTolerance: 1,
        currentStreak: 15,
    });
    assert.equal(breakRes.isTolerated, false);
    assert.equal(breakRes.status, "needs-rhythm-recovery");
    assert.equal(breakRes.effectiveStreak, 0);
    assert.equal(breakRes.messageKey, "streak.needsRhythmRecovery");
}

// 3. 项目休眠与假期状态评估断言
{
    // 活跃假期
    const vacationRes = evaluateItemPauseState({
        asOfDate: "2026-10-29",
        pausedUntil: "2026-11-10",
    });
    assert.equal(vacationRes.isPaused, true);
    assert.equal(vacationRes.exemptFromStalled, true, "paused item must be exempt from stalled analysis");
    assert.equal(vacationRes.silenceReminders, true, "paused item must silence all reminders");

    // 显式暂停标记
    const explicitPauseRes = evaluateItemPauseState({
        asOfDate: "2026-10-29",
        isItemPaused: true,
    });
    assert.equal(explicitPauseRes.isPaused, true);
    assert.equal(explicitPauseRes.exemptFromStalled, true);

    // 假期过期自然恢复
    const expiredRes = evaluateItemPauseState({
        asOfDate: "2026-10-29",
        pausedUntil: "2026-10-20",
    });
    assert.equal(expiredRes.isPaused, false);
    assert.equal(expiredRes.exemptFromStalled, false);
    assert.equal(expiredRes.silenceReminders, false);
}

// 4. 低压力成就与反暗模式合规断言
{
    // 正常达成阶梯里程碑
    const achieveRes = evaluateLowPressureAchievement({
        achievementId: "habit-streak-30",
        targetMetric: 30,
        currentProgress: 45,
    });
    assert.equal(achieveRes.isQualified, true);
    assert.equal(achieveRes.isPermanent, true, "achievements must be permanently retained");
    assert.equal(achieveRes.milestoneLevelReached, 30);
    assert.equal(achieveRes.antiDarkPatternCompliant, true);

    // 超额奖励封顶 1.5 倍（target 30，1.5x = 45，输入 100 必须封顶在 45）
    const cappedRes = evaluateLowPressureAchievement({
        achievementId: "habit-streak-30",
        targetMetric: 30,
        currentProgress: 100,
    });
    assert.equal(cappedRes.cappedProgress, 45, "overachievement must be capped at 1.5x");

    // 坚决拒绝外部扣分（扣灵石/扣分至负）
    const deductionAttempt = evaluateLowPressureAchievement({
        achievementId: "habit-streak-30",
        targetMetric: 30,
        currentProgress: 35,
        isNegativeDeductionRequested: true,
    });
    assert.equal(deductionAttempt.antiDarkPatternCompliant, false);
    assert.equal(deductionAttempt.isQualified, false);
    assert.ok(deductionAttempt.rejectionReason.includes("Dark pattern rejected"));

    // 坚决拒绝掉级请求
    const demotionAttempt = evaluateLowPressureAchievement({
        achievementId: "habit-streak-30",
        targetMetric: 30,
        currentProgress: 35,
        isDemotionRequested: true,
    });
    assert.equal(demotionAttempt.antiDarkPatternCompliant, false);

    // 坚决拒绝社交排行施压
    const shamingAttempt = evaluateLowPressureAchievement({
        achievementId: "habit-streak-30",
        targetMetric: 30,
        currentProgress: 35,
        isLeaderboardShaming: true,
    });
    assert.equal(shamingAttempt.antiDarkPatternCompliant, false);

    // 阶梯常量验证
    assert.deepEqual(Array.from(LOW_PRESSURE_MILESTONES), [1, 3, 7, 14, 30, 60, 90, 180, 365]);
}

// 5. Calm 文案禁则校验断言
{
    // 和平合规文案
    const calmResult = validateCalmCopy("按自己的节奏进行调整，每一份记录都算数。");
    assert.equal(calmResult.isCalm, true);
    assert.equal(calmResult.prohibitedMatches.length, 0);

    // 拦截负罪感/恐吓文案（中文）
    const guiltyResult = validateCalmCopy("由于你落后了，导致连续打卡归零，前功尽弃，请接受惩罚。");
    assert.equal(guiltyResult.isCalm, false);
    assert.ok(guiltyResult.prohibitedMatches.includes("你落后了"));
    assert.ok(guiltyResult.prohibitedMatches.includes("归零"));
    assert.ok(guiltyResult.prohibitedMatches.includes("前功尽弃"));
    assert.ok(guiltyResult.prohibitedMatches.includes("惩罚"));
    assert.equal(guiltyResult.suggestedReplacements["你落后了"], "按自己的节奏调整");
    assert.equal(guiltyResult.suggestedReplacements["前功尽弃"], "每一份记录都算数");

    // 拦截负罪感文案（英文）
    const englishGuilty = validateCalmCopy("You've fallen behind and your progress went back to zero.");
    assert.equal(englishGuilty.isCalm, false);
    assert.ok(englishGuilty.prohibitedMatches.includes("you've fallen behind"));
    assert.ok(englishGuilty.prohibitedMatches.includes("back to zero"));
}

console.log("low-pressure-governance: all reminder, streak, vacation, achievement and calm copy checks passed successfully.");
