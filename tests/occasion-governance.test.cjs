/* T-1727 ~ T-1731 专项守门测试：
   事项体系深度研究与治理
   1. 批量启停、删除确认与改期/跨日完成拦截；
   2. 阶梯提醒多阶段命中与逾期边界；
   3. 自然语言条目三分类分类器（打卡 vs 事项 vs 待办）。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const dateKeysTs = fs.readFileSync(path.join(projectRoot, "src", "date-keys.ts"), "utf8");
const featureTs = fs.readFileSync(path.join(projectRoot, "src", "features", "occasion-governance.ts"), "utf8");

const dateKeysCompiled = ts.transpileModule(dateKeysTs, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;
const featureCompiled = ts.transpileModule(featureTs, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;

const dateKeysModule = {exports: {}};
new Function("require", "module", "exports", dateKeysCompiled)(() => {}, dateKeysModule, dateKeysModule.exports);

const moduleUnderTest = {exports: {}};
const customRequire = (specifier) => {
    if (specifier.includes("date-keys")) return dateKeysModule.exports;
    return {};
};
new Function("require", "module", "exports", featureCompiled)(customRequire, moduleUnderTest, moduleUnderTest.exports);

const {
    evaluateBatchOccasionOperation,
    evaluateLadderRemindSchedule,
    classifyNaturalLanguageEntry,
} = moduleUnderTest.exports;

console.log("Starting occasion-governance tests...");

// 1. 批量操作边界断言
{
    const sampleOccasions = [
        {id: "occ-1", name: "事项1", date: "2026-10-15"},
        {id: "occ-2", name: "事项2", date: "2026-10-20"},
    ];

    // 批量启停：允许，无需二次确认
    const enableRes = evaluateBatchOccasionOperation("enable", sampleOccasions);
    assert.equal(enableRes.isAllowed, true);
    assert.equal(enableRes.requiresConfirm, false);
    assert.equal(enableRes.safeCount, 2);

    const disableRes = evaluateBatchOccasionOperation("disable", sampleOccasions);
    assert.equal(disableRes.isAllowed, true);
    assert.equal(disableRes.requiresConfirm, false);

    // 批量删除：允许，但必须强制二次确认
    const deleteRes = evaluateBatchOccasionOperation("delete", sampleOccasions);
    assert.equal(deleteRes.isAllowed, true);
    assert.equal(deleteRes.requiresConfirm, true);
    assert.equal(deleteRes.safeCount, 2);

    // 批量改期：严禁跨不同发生日盲目改期
    const rescheduleRes = evaluateBatchOccasionOperation("reschedule", sampleOccasions);
    assert.equal(rescheduleRes.isAllowed, false);
    assert.ok(rescheduleRes.rejectionReason.includes("forbidden"));

    // 跨日期批量完成：未指定明确同发生日直接拒绝
    const completeNoDate = evaluateBatchOccasionOperation("complete", sampleOccasions);
    assert.equal(completeNoDate.isAllowed, false);
    assert.ok(completeNoDate.rejectionReason.includes("explicit shared occurrence date"));

    // 针对明确同一发生日：允许批量完成
    const completeWithDate = evaluateBatchOccasionOperation("complete", sampleOccasions, {sharedDate: "2026-10-15"});
    assert.equal(completeWithDate.isAllowed, true);
    assert.equal(completeWithDate.safeCount, 2);

    // 空选中项：直接拒绝
    const emptyRes = evaluateBatchOccasionOperation("enable", []);
    assert.equal(emptyRes.isAllowed, false);
}

// 2. 阶梯提醒调度断言
{
    // 提前 7 天：触发
    const res7 = evaluateLadderRemindSchedule("2026-10-25", "2026-10-18");
    assert.equal(res7.shouldRemindToday, true);
    assert.equal(res7.matchedLadderDay, 7);
    assert.equal(res7.isOverdue, false);

    // 提前 3 天：触发
    const res3 = evaluateLadderRemindSchedule("2026-10-25", "2026-10-22");
    assert.equal(res3.shouldRemindToday, true);
    assert.equal(res3.matchedLadderDay, 3);

    // 提前 2 天（不在 [7, 3, 1, 0] 阶梯中）：不触发
    const res2 = evaluateLadderRemindSchedule("2026-10-25", "2026-10-23");
    assert.equal(res2.shouldRemindToday, false);
    assert.equal(res2.matchedLadderDay, null);

    // 当天（0天）：触发
    const res0 = evaluateLadderRemindSchedule("2026-10-25", "2026-10-25");
    assert.equal(res0.shouldRemindToday, true);
    assert.equal(res0.matchedLadderDay, 0);

    // 逾期：标记 overdue，不发提前提醒
    const resOverdue = evaluateLadderRemindSchedule("2026-10-25", "2026-10-26");
    assert.equal(resOverdue.shouldRemindToday, false);
    assert.equal(resOverdue.isOverdue, true);
}

// 3. 自然语言意图分类器断言
{
    // 习惯打卡分类
    const habitRes = classifyNaturalLanguageEntry("每天坚持背30个英语单词");
    assert.equal(habitRes.category, "checkin-item");
    assert.equal(habitRes.suggestedRecurrence, "daily");
    assert.ok(habitRes.confidence >= 0.85);

    const weeklyHabit = classifyNaturalLanguageEntry("每周打卡游泳两次");
    assert.equal(weeklyHabit.category, "checkin-item");
    assert.equal(weeklyHabit.suggestedRecurrence, "weekly");

    // 日期事项分类
    const occasionBirthday = classifyNaturalLanguageEntry("妈妈的生日快到了");
    assert.equal(occasionBirthday.category, "occasion");
    assert.equal(occasionBirthday.suggestedRecurrence, "annual");

    const occasionBill = classifyNaturalLanguageEntry("每月25号还房贷");
    assert.equal(occasionBill.category, "occasion");
    assert.equal(occasionBill.suggestedRecurrence, "monthly");

    const occasionAnniversary = classifyNaturalLanguageEntry("十周年结婚纪念日");
    assert.equal(occasionAnniversary.category, "occasion");

    // 一次性提醒待办
    const reminderRes = classifyNaturalLanguageEntry("明天下午3点去取快递");
    assert.equal(reminderRes.category, "one-shot-reminder");
    assert.equal(reminderRes.suggestedRecurrence, "once");
}

console.log("occasion-governance: all batch operation, ladder remind, and entry classification checks passed successfully.");
