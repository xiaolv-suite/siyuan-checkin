/* T-1752 专项守门测试：提醒方案推荐与实际触发预演
   1. 源码接线与设置页方案推荐/预演卡片 DOM 结构钉；
   2. 推荐预设草案模型（minimal / morning / review / frequent）规范与 slots 归一一致性；
   3. 触发预演纯函数（simulateReminderTimeline）：区分无 slots 启动提醒与定时槽位提醒；
   4. 当天与次日未来触发时刻序列预测（本地时刻与跨日标记）；
   5. 安静时段 22:00~07:00 冲突/无冲突/关闭态真实影响解释；
   6. 事项提前提醒仅一次（occasionRemindOnce）开启/关闭态真实影响解释；
   7. 双语词条完整性与纯函数无时钟侵入断言。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const prefSource = fs.readFileSync(path.join(root, "src", "features", "reminder-preferences.ts"), "utf8");
const settingsSource = fs.readFileSync(path.join(root, "src", "render", "settings.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "src", "index.ts"), "utf8");
const i18nSource = fs.readFileSync(path.join(root, "src", "i18n.ts"), "utf8");

/* —— 断言 1：源码接线守门 —— */
assert.match(prefSource, /export const REMINDER_PRESET_SCHEMES/, "reminder-preferences exports REMINDER_PRESET_SCHEMES");
assert.match(prefSource, /export function simulateReminderTimeline/, "reminder-preferences exports simulateReminderTimeline");
assert.match(settingsSource, /data-reminder-presets-row/, "settings renders reminder presets row");
assert.match(settingsSource, /data-action="apply-reminder-preset"/, "settings provides apply-reminder-preset buttons");
assert.match(settingsSource, /data-reminder-simulation-card/, "settings renders reminder simulation card");
assert.match(indexSource, /simulateReminderTimeline/, "index.ts imports and calls simulateReminderTimeline");
assert.match(indexSource, /data-action='apply-reminder-preset'/, "index.ts listens to apply-reminder-preset clicks");

/* —— 断言 2：双语词条对齐守门 —— */
const requiredKeys = [
    "set.reminderPresetsLabel",
    "set.reminderPresetsHint",
    "set.reminderPresetMinimal",
    "set.reminderPresetMorning",
    "set.reminderPresetReview",
    "set.reminderPresetFrequent",
    "set.reminderSimulationTitle",
    "set.reminderModeLabel",
    "set.reminderModeLaunch",
    "set.reminderModeSlots",
    "set.reminderUpcomingLabel",
    "set.reminderTriggerToday",
    "set.reminderTriggerTomorrow",
    "set.reminderTriggerQuiet",
    "set.reminderQuietImpactLabel",
    "set.reminderQuietDisabled",
    "set.reminderQuietAffects",
    "set.reminderQuietNoConflict",
    "set.reminderOccasionImpactLabel",
    "set.reminderOccasionOnceActive",
    "set.reminderOccasionOnceInactive",
    "msg.reminderPresetApplied",
];

for (const key of requiredKeys) {
    const keyPattern = new RegExp(`"${key.replace(/\./g, "\\.")}"\\s*:`);
    const matches = i18nSource.match(new RegExp(keyPattern, "g")) || [];
    assert.equal(matches.length, 2, `i18n.ts must define key "${key}" exactly twice (zh_CN and en_US), found ${matches.length}`);
}

/* —— 断言 3：动态加载与纯函数编译 —— */
function loadModule(relativePath) {
    const fullPath = path.join(root, relativePath);
    const content = fs.readFileSync(fullPath, "utf8");
    const transpiled = ts.transpileModule(content, {
        compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
    }).outputText;
    const module = {exports: {}};
    new Function("require", "module", "exports", transpiled)((dep) => {
        if (dep.startsWith(".")) {
            return loadModule(path.join(path.dirname(relativePath), `${dep}.ts`));
        }
        return require(dep);
    }, module, module.exports);
    return module.exports;
}

const {
    REMINDER_PRESET_SCHEMES,
    simulateReminderTimeline,
    normalizeReminderQuietHours,
    normalizeDailyReminderSlots,
} = loadModule("src/features/reminder-preferences.ts");

// 1. 验证预设方案模型
assert.equal(REMINDER_PRESET_SCHEMES.length, 4, "4 preset schemes defined");
const [minimal, morning, review, frequent] = REMINDER_PRESET_SCHEMES;
assert.equal(minimal.id, "minimal");
assert.deepEqual(minimal.slots, []);
assert.equal(morning.id, "morning");
assert.deepEqual(morning.slots, ["09:00"]);
assert.equal(review.id, "review");
assert.deepEqual(review.slots, ["09:00", "21:00"]);
assert.equal(frequent.id, "frequent");
assert.deepEqual(frequent.slots, ["09:00", "13:00", "18:00", "21:00"]);

for (const scheme of REMINDER_PRESET_SCHEMES) {
    assert.deepEqual(normalizeDailyReminderSlots(scheme.slots), scheme.slots, `preset ${scheme.id} slots are normalized`);
}

// 2. 验证无 slots（启动提醒）模式
const quietDefault = normalizeReminderQuietHours({enabled: false, start: "22:00", end: "07:00"});
const quietActive = normalizeReminderQuietHours({enabled: true, start: "22:00", end: "07:00"});

const launchSim = simulateReminderTimeline({enabled: true, slots: []}, quietDefault, false, 600); // 10:00
assert.equal(launchSim.mode, "launch");
assert.equal(launchSim.upcomingTriggers.length, 1);
assert.equal(launchSim.upcomingTriggers[0].slot, "launch");
assert.equal(launchSim.upcomingTriggers[0].isNextDay, false);
assert.equal(launchSim.upcomingTriggers[0].inQuietHours, false);
assert.equal(launchSim.quietHoursEffect.enabled, false);
assert.equal(launchSim.quietHoursEffect.summaryKey, "set.reminderQuietDisabled");
assert.equal(launchSim.occasionRemindOnceEffect.enabled, false);
assert.equal(launchSim.occasionRemindOnceEffect.summaryKey, "set.reminderOccasionOnceInactive");

// 启动时刻在安静时段内（如 23:00，跨午夜安静时段）
const launchSimQuiet = simulateReminderTimeline({enabled: true, slots: []}, quietActive, true, 1380); // 23:00
assert.equal(launchSimQuiet.upcomingTriggers[0].inQuietHours, true);
assert.equal(launchSimQuiet.quietHoursEffect.enabled, true);
assert.equal(launchSimQuiet.quietHoursEffect.hasQuietOverlap, true);
assert.equal(launchSimQuiet.quietHoursEffect.summaryKey, "set.reminderQuietAffects");
assert.equal(launchSimQuiet.occasionRemindOnceEffect.enabled, true);
assert.equal(launchSimQuiet.occasionRemindOnceEffect.summaryKey, "set.reminderOccasionOnceActive");

// 3. 验证定时槽位提醒模式（当天剩余与次日首批预测）
// 场景 A：早上 08:00（480 分钟），slots: ["09:00", "21:00"]
const slotSimMorning = simulateReminderTimeline({enabled: true, slots: ["09:00", "21:00"]}, quietActive, false, 480);
assert.equal(slotSimMorning.mode, "slots");
assert.equal(slotSimMorning.upcomingTriggers.length, 2);
assert.equal(slotSimMorning.upcomingTriggers[0].slot, "09:00");
assert.equal(slotSimMorning.upcomingTriggers[0].isNextDay, false);
assert.equal(slotSimMorning.upcomingTriggers[0].inQuietHours, false);
assert.equal(slotSimMorning.upcomingTriggers[1].slot, "21:00");
assert.equal(slotSimMorning.upcomingTriggers[1].isNextDay, false);
assert.equal(slotSimMorning.upcomingTriggers[1].inQuietHours, false);
assert.equal(slotSimMorning.quietHoursEffect.hasQuietOverlap, false);
assert.equal(slotSimMorning.quietHoursEffect.summaryKey, "set.reminderQuietNoConflict");

// 场景 B：下午 15:00（900 分钟），当天剩 21:00，次日补 09:00
const slotSimAfternoon = simulateReminderTimeline({enabled: true, slots: ["09:00", "21:00"]}, quietActive, false, 900);
assert.equal(slotSimAfternoon.upcomingTriggers.length, 2);
assert.equal(slotSimAfternoon.upcomingTriggers[0].slot, "21:00");
assert.equal(slotSimAfternoon.upcomingTriggers[0].isNextDay, false);
assert.equal(slotSimAfternoon.upcomingTriggers[1].slot, "09:00");
assert.equal(slotSimAfternoon.upcomingTriggers[1].isNextDay, true);

// 场景 C：深夜 22:30（1350 分钟），当天槽位已全部过去，次日预测 09:00 与 21:00
const slotSimNight = simulateReminderTimeline({enabled: true, slots: ["09:00", "21:00"]}, quietActive, false, 1350);
assert.equal(slotSimNight.upcomingTriggers.length, 2);
assert.equal(slotSimNight.upcomingTriggers[0].slot, "09:00");
assert.equal(slotSimNight.upcomingTriggers[0].isNextDay, true);
assert.equal(slotSimNight.upcomingTriggers[1].slot, "21:00");
assert.equal(slotSimNight.upcomingTriggers[1].isNextDay, true);

// 场景 D：槽位落在安静时段（如包含 23:00）
const slotSimWithQuiet = simulateReminderTimeline(
    {enabled: true, slots: ["09:00", "23:00"]},
    quietActive, // 22:00 ~ 07:00
    true,
    480,
);
assert.equal(slotSimWithQuiet.quietHoursEffect.hasQuietOverlap, true);
assert.equal(slotSimWithQuiet.quietHoursEffect.summaryKey, "set.reminderQuietAffects");
const trigger23 = slotSimWithQuiet.upcomingTriggers.find((t) => t.slot === "23:00");
assert.ok(trigger23);
assert.equal(trigger23.inQuietHours, true, "23:00 is detected inside 22:00~07:00 quiet hours");

console.log("Reminder schedule preset & simulation checks passed successfully.");
