/* T-1726 专项守门测试：
   事项与提醒动作的多桶备份迁移与 ICS 导出研究（D-634）。
   1. RFC 5545 文本转义与全天日期格式；
   2. 事项单次与各类周期规则（年/月第N周/月末/周/间隔）映射；
   3. 农历事项未来年份公历展开与无损元数据标记；
   4. 完整 VCALENDAR 日历容器构建与停用项过滤；
   5. 多桶备份 Envelope 分类决断与回滚快照防护。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const lunarTs = fs.readFileSync(path.join(projectRoot, "src", "lunar.ts"), "utf8");
const featureTs = fs.readFileSync(path.join(projectRoot, "src", "features", "occasion-ics.ts"), "utf8");

// 简易垫片编译
const lunarCompiled = ts.transpileModule(lunarTs, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;
const featureCompiled = ts.transpileModule(featureTs, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;

const lunarModule = {exports: {}};
new Function("require", "module", "exports", lunarCompiled)(() => {}, lunarModule, lunarModule.exports);

const moduleUnderTest = {exports: {}};
const customRequire = (specifier) => {
    if (specifier.includes("lunar")) return lunarModule.exports;
    return {};
};
new Function("require", "module", "exports", featureCompiled)(customRequire, moduleUnderTest, moduleUnderTest.exports);

const {
    escapeIcsText,
    formatIcsDate,
    generateOccasionIcsEvent,
    buildOccasionsIcsCalendar,
    evaluateOccasionEnvelopeResolution,
} = moduleUnderTest.exports;

console.log("Starting occasion-ics-migration tests...");

// 1. 转义与日期格式断言
{
    assert.equal(escapeIcsText("会议;备忘,重要\\通知\n第二行"), "会议\\;备忘\\,重要\\\\通知\\n第二行");
    assert.equal(formatIcsDate("2026-10-15"), "20261015");
    assert.equal(escapeIcsText(""), "");
}

// 2. 单次与公历周期事项映射断言
{
    const baseOccasion = {
        id: "occ-101",
        name: "还信用卡",
        kind: "scheduled",
        date: "2026-10-25",
        recurrence: "monthly",
        remindBeforeDays: 2,
        note: "招商银行,每月25号还款",
        enabled: true,
        completedDates: [],
        createdAt: "2026-09-01T08:00:00.000Z",
        updatedAt: "2026-09-01T08:00:00.000Z",
    };

    const monthlyIcs = generateOccasionIcsEvent(baseOccasion);
    assert.ok(monthlyIcs.includes("BEGIN:VEVENT"));
    assert.ok(monthlyIcs.includes("UID:occasion-occ-101@siyuan-checkin"));
    assert.ok(monthlyIcs.includes("DTSTART;VALUE=DATE:20261025"));
    assert.ok(monthlyIcs.includes("RRULE:FREQ=MONTHLY"));
    assert.ok(monthlyIcs.includes("SUMMARY:还信用卡"));
    assert.ok(monthlyIcs.includes("DESCRIPTION:招商银行\\,每月25号还款"));
    assert.ok(monthlyIcs.includes("END:VEVENT"));

    // 单次事项：无 RRULE
    const onceOccasion = {...baseOccasion, id: "occ-102", name: "体检", recurrence: "once"};
    const onceIcs = generateOccasionIcsEvent(onceOccasion);
    assert.ok(!onceIcs.includes("RRULE"));

    // 公历年度事项
    const annualOccasion = {...baseOccasion, id: "occ-103", name: "结婚纪念日", recurrence: "annual", calendar: "solar"};
    const annualIcs = generateOccasionIcsEvent(annualOccasion);
    assert.ok(annualIcs.includes("RRULE:FREQ=YEARLY"));

    // 月末事项
    const lastDayOccasion = {...baseOccasion, id: "occ-104", name: "月末盘点", recurrence: "monthly", monthlySubtype: "lastday"};
    const lastDayIcs = generateOccasionIcsEvent(lastDayOccasion);
    assert.ok(lastDayIcs.includes("RRULE:FREQ=MONTHLY;BYMONTHDAY=-1"));

    // 周事项
    const weeklyOccasion = {...baseOccasion, id: "occ-105", name: "周会", recurrence: "weekly", weekday: 1};
    const weeklyIcs = generateOccasionIcsEvent(weeklyOccasion);
    assert.ok(weeklyIcs.includes("RRULE:FREQ=WEEKLY;BYDAY=MO"));

    // 间隔事项（例如每 3 个月）
    const intervalOccasion = {...baseOccasion, id: "occ-106", name: "更换净水滤芯", recurrence: "interval", intervalUnit: "month", intervalCount: 3};
    const intervalIcs = generateOccasionIcsEvent(intervalOccasion);
    assert.ok(intervalIcs.includes("RRULE:FREQ=MONTHLY;INTERVAL=3"));
}

// 3. 农历事项未来年份公历展开断言
{
    const lunarOccasion = {
        id: "occ-lunar-1",
        name: "春节",
        kind: "scheduled",
        date: "2026-01-01", // 农历正月初一
        recurrence: "annual",
        calendar: "lunar",
        remindBeforeDays: 7,
        note: "阖家团聚",
        enabled: true,
        completedDates: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const lunarIcs = generateOccasionIcsEvent(lunarOccasion, {lunarUnrollYears: 3, baseYear: 2026});
    assert.ok(lunarIcs.includes("SUMMARY:春节 (农历)"));
    assert.ok(lunarIcs.includes("X-LUNAR-ORIGIN:2026-01-01"));
    // 展开了 3 个 VEVENT
    const matchCount = (lunarIcs.match(/BEGIN:VEVENT/g) || []).length;
    assert.equal(matchCount, 3, "unrolls into 3 individual annual VEVENTs for lunar occasions");
}

// 4. 完整 VCALENDAR 文档组装与停用项过滤断言
{
    const list = [
        {
            id: "occ-active",
            name: "有效事项",
            kind: "scheduled",
            date: "2026-10-20",
            recurrence: "once",
            remindBeforeDays: 0,
            note: "",
            enabled: true,
            completedDates: [],
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
        },
        {
            id: "occ-disabled",
            name: "已停用事项",
            kind: "scheduled",
            date: "2026-10-21",
            recurrence: "once",
            remindBeforeDays: 0,
            note: "",
            enabled: false,
            completedDates: [],
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
        },
    ];

    const calendarIcs = buildOccasionsIcsCalendar(list);
    assert.ok(calendarIcs.startsWith("BEGIN:VCALENDAR\r\n"));
    assert.ok(calendarIcs.endsWith("END:VCALENDAR\r\n"));
    assert.ok(calendarIcs.includes("SUMMARY:有效事项"));
    assert.ok(!calendarIcs.includes("已停用事项"), "disabled occasions must be excluded from ICS export");
}

// 5. 多桶备份 Envelope 决断模型断言
{
    const occasionRes = evaluateOccasionEnvelopeResolution("checkin-occasion-store");
    assert.equal(occasionRes.bucketKey, "checkin-occasion-store");
    assert.equal(occasionRes.category, "mutation");
    assert.equal(occasionRes.defaultResolution, "overwrite");
    assert.equal(occasionRes.sensitive, false);
    assert.equal(occasionRes.supportsRollbackSnapshot, true);

    const reminderRes = evaluateOccasionEnvelopeResolution("checkin-reminder-actions");
    assert.equal(reminderRes.bucketKey, "checkin-reminder-actions");
    assert.equal(reminderRes.category, "overwrite");
    assert.equal(reminderRes.defaultResolution, "merge");
    assert.equal(reminderRes.sensitive, true, "reminder actions are sensitive personal preference data");
    assert.equal(reminderRes.supportsRollbackSnapshot, true);
}

console.log("occasion-ics-migration: all ICS formatting, lunar unrolling and envelope resolution checks passed successfully.");
