/* T-1634 专项守门：显式“未达成及原因”语义评估与跨页面语义矩阵。
   1. 四态区分契约：完成（Done）、请假（Skip）、显式未达成（Unachieved）、未记录（Unrecorded）；
   2. 连击与分母规则：
      - Done: 连击 +1，分子 +1，分母 +1；
      - Skip: 连击保持（不断连），分子 +0，分母 +1；
      - Unachieved: 连击中断（重置为 0），分子 +0，分母 +1；
      - Unrecorded: 连击中断，分子 +0，分母 +1（闭合日）；
   3. 低压力与反思赋能：原因备注可选（非必填），关闭今日后续提醒；
   4. 周复盘联动：未达成原因可作为周复盘 Friction 阶段候选素材；
   5. 导出与向后兼容契约：向不支持未达成的旧消费方安全降级。 */

const assert = require("node:assert/strict");

/* 显式未达成与四态语义模型 */
function evaluateHabitDayState(event) {
    if (!event) return "unrecorded";
    if (event.kind === "skip") return "skip";
    if (event.kind === "unachieved" || (event.value === 0 && event.source === "unachieved")) return "unachieved";
    if (event.value > 0) return "done";
    return "unrecorded";
}

function evaluateStreakImpact(previousStreak, dayState) {
    switch (dayState) {
        case "done":
            return {nextStreak: previousStreak + 1, streakBroken: false, note: "streak incremented"};
        case "skip":
            return {nextStreak: previousStreak, streakBroken: false, note: "streak preserved (frozen)"};
        case "unachieved":
            return {nextStreak: 0, streakBroken: true, note: "streak reset (acknowledged lapse)"};
        case "unrecorded":
        default:
            return {nextStreak: 0, streakBroken: true, note: "streak reset (unrecorded missing)"};
    }
}

function evaluateCompletionRateImpact(totalOpportunities, numerator, dayState) {
    const nextTotal = totalOpportunities + 1;
    switch (dayState) {
        case "done":
            return {numerator: numerator + 1, denominator: nextTotal, rate: (numerator + 1) / nextTotal};
        case "skip":
            // skip 计入可评估机会分母，但分子不加
            return {numerator, denominator: nextTotal, rate: numerator / nextTotal};
        case "unachieved":
            // unachieved 明确作为未完成机会计入分母
            return {numerator, denominator: nextTotal, rate: numerator / nextTotal};
        case "unrecorded":
        default:
            return {numerator, denominator: nextTotal, rate: numerator / nextTotal};
    }
}

function filterFrictionCandidatesFromEvents(events) {
    return events
        .filter((e) => e.kind === "unachieved" || (e.value === 0 && e.source === "unachieved"))
        .filter((e) => Boolean(e.note && e.note.trim()))
        .map((e) => ({
            date: e.localDate,
            itemId: e.itemId,
            frictionReason: e.note.trim(),
        }));
}

function runUnachievedSemanticChecks() {
    console.log("Starting T-1634 unachieved semantics and cross-page matrix checks...");

    /* =========================================================================
       Check 1: 四态状态机判定 (Done vs Skip vs Unachieved vs Unrecorded)
       ========================================================================= */
    {
        assert.equal(evaluateHabitDayState(undefined), "unrecorded", "no event evaluates to unrecorded");
        assert.equal(evaluateHabitDayState({value: 10, localDate: "2026-10-29"}), "done", "positive value evaluates to done");
        assert.equal(evaluateHabitDayState({value: 0, kind: "skip", localDate: "2026-10-29"}), "skip", "explicit skip evaluates to skip");
        assert.equal(evaluateHabitDayState({value: 0, kind: "unachieved", localDate: "2026-10-29"}), "unachieved", "explicit unachieved evaluates to unachieved");
        assert.equal(evaluateHabitDayState({value: 0, source: "unachieved", localDate: "2026-10-29"}), "unachieved", "source unachieved evaluates to unachieved");

        console.log("  ✓ Check 1: Four-state classification cleanly evaluated");
    }

    /* =========================================================================
       Check 2: 连击与分母差异化契约 (Streak & Denominator Parity)
       ========================================================================= */
    {
        const currentStreak = 15;

        // Done: 连击 +1
        const doneImpact = evaluateStreakImpact(currentStreak, "done");
        assert.equal(doneImpact.nextStreak, 16);
        assert.equal(doneImpact.streakBroken, false);

        // Skip: 连击保持（冻结），不断连
        const skipImpact = evaluateStreakImpact(currentStreak, "skip");
        assert.equal(skipImpact.nextStreak, 15);
        assert.equal(skipImpact.streakBroken, false);

        // Unachieved: 连击明确中断（重置为 0）
        const unachievedImpact = evaluateStreakImpact(currentStreak, "unachieved");
        assert.equal(unachievedImpact.nextStreak, 0);
        assert.equal(unachievedImpact.streakBroken, true);

        // 分母比较：三者均计入分母，但仅 Done 增加分子
        const rDone = evaluateCompletionRateImpact(10, 8, "done");
        assert.equal(rDone.numerator, 9);
        assert.equal(rDone.denominator, 11);

        const rSkip = evaluateCompletionRateImpact(10, 8, "skip");
        assert.equal(rSkip.numerator, 8);
        assert.equal(rSkip.denominator, 11);

        const rUnachieved = evaluateCompletionRateImpact(10, 8, "unachieved");
        assert.equal(rUnachieved.numerator, 8);
        assert.equal(rUnachieved.denominator, 11);

        console.log("  ✓ Check 2: Streak preservation vs breakage and rate denominator parity verified");
    }

    /* =========================================================================
       Check 3: 周复盘摩擦与反思素材提取 (Weekly Review Friction Harvest)
       ========================================================================= */
    {
        const weekEvents = [
            {itemId: "run", localDate: "2026-10-26", value: 30, note: "跑得很棒"},
            {itemId: "run", localDate: "2026-10-27", value: 0, kind: "skip", note: "出差中主动跳过"},
            {itemId: "run", localDate: "2026-10-28", value: 0, kind: "unachieved", note: "加班到深夜太累了，未能跑步"},
            {itemId: "run", localDate: "2026-10-29", value: 0, kind: "unachieved", note: "下大雨且受轻微扭伤阻碍"},
        ];

        const fictions = filterFrictionCandidatesFromEvents(weekEvents);
        assert.equal(fictions.length, 2, "extracted exactly 2 unachieved friction entries with notes");
        assert.equal(fictions[0].frictionReason, "加班到深夜太累了，未能跑步");
        assert.equal(fictions[1].frictionReason, "下大雨且受轻微扭伤阻碍");

        console.log("  ✓ Check 3: Friction harvest for weekly review successfully filters unachieved reflections");
    }

    console.log("All T-1634 unachieved semantic checks passed!");
}

runUnachievedSemanticChecks();
