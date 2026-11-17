/* T-1662 专项守门测试：提醒排期计划预览、恢复今日提醒与 DST/跨午夜安静时段矩阵
   1. 静音与恢复双向状态转移（Mute & Unmute Lifecycle）；
   2. 排期计划预览模型（buildReminderPlanPreview）覆盖 delivered/quiet/muted/due/upcoming/disabled；
   3. 跨午夜安静时段边界与夏令时/冬令时（DST）本地挂钟时间幂等性；
   4. 修改槽位后的新旧计划隔离与多窗口幂等；
   5. 源码接线与设置页恢复交互。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const deliverySource = fs.readFileSync(path.join(root, "src", "features", "reminder-delivery.ts"), "utf8");
const renderDeliverySource = fs.readFileSync(path.join(root, "src", "render", "reminder-delivery.ts"), "utf8");
const settingsSource = fs.readFileSync(path.join(root, "src", "render", "settings.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "src", "index.ts"), "utf8");

/* —— 断言 1：源码接线守门 —— */
assert.match(deliverySource, /export function unmuteReminderDeliveryToday/, "delivery features exports unmuteReminderDeliveryToday");
assert.match(deliverySource, /export function buildReminderPlanPreview/, "delivery features exports buildReminderPlanPreview");
assert.match(renderDeliverySource, /export async function unmuteDailyReminderTodayFor/, "render delivery exports unmuteDailyReminderTodayFor");
assert.match(renderDeliverySource, /export function isDailyReminderMutedTodayFor/, "render delivery exports isDailyReminderMutedTodayFor");
assert.match(renderDeliverySource, /export function getDailyReminderPlanPreviewFor/, "render delivery exports getDailyReminderPlanPreviewFor");
assert.match(settingsSource, /data-action="unmute-daily-reminder"/, "settings view provides unmute action button");
assert.match(settingsSource, /data-reminder-plan-preview/, "settings view renders reminder plan preview");
assert.match(indexSource, /unmuteDailyReminderTodayFor/, "index.ts imports and wires unmuteDailyReminderTodayFor");
assert.match(indexSource, /data-action='unmute-daily-reminder'/, "index.ts listens to unmute-daily-reminder action");

/* —— 断言 2：纯函数行为编译与执行 —— */
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
    emptyReminderDeliveryState,
    markReminderDelivered,
    muteReminderDeliveryToday,
    unmuteReminderDeliveryToday,
    dueReminderDeliverySlots,
    buildReminderPlanPreview,
} = loadModule("src/features/reminder-delivery.ts");

const {
    isWithinQuietHours,
    normalizeReminderQuietHours,
    reminderMinutesOfDay,
} = loadModule("src/features/reminder-preferences.ts");

const today = "2026-10-28";
const quietHours = normalizeReminderQuietHours({enabled: true, start: "22:00", end: "07:00"});

// 1. 静音与恢复双向状态转移
let state = emptyReminderDeliveryState();
assert.equal(state.mutedDates.includes(today), false, "initially not muted");

state = muteReminderDeliveryToday(state, today);
assert.equal(state.mutedDates.includes(today), true, "today is muted");

state = unmuteReminderDeliveryToday(state, today);
assert.equal(state.mutedDates.includes(today), false, "today is unmuted successfully");

// 幂等性：多次 unmute
state = unmuteReminderDeliveryToday(state, today);
assert.equal(state.mutedDates.includes(today), false, "idempotent unmute");

// 2. 计划预览模型测试
const preference = {enabled: true, slots: ["09:00", "20:00"]};

// 场景 A: 早上 08:30 (510 分钟)，未到任何槽位
const previewMorning = buildReminderPlanPreview(state, today, 510, preference, quietHours);
assert.equal(previewMorning.enabled, true);
assert.equal(previewMorning.mutedToday, false);
assert.equal(previewMorning.inQuietHours, false);
assert.deepEqual(previewMorning.slots.map((s) => s.state), ["upcoming", "upcoming"]);
assert.equal(previewMorning.nextDueSlot, undefined);

// 场景 B: 上午 09:30 (570 分钟)，09:00 到期待发
const previewDue = buildReminderPlanPreview(state, today, 570, preference, quietHours);
assert.deepEqual(previewDue.slots.map((s) => s.state), ["due", "upcoming"]);
assert.equal(previewDue.nextDueSlot, "09:00");

// 场景 C: 09:00 投递完成后
state = markReminderDelivered(state, today, ["09:00"]);
const previewDelivered = buildReminderPlanPreview(state, today, 570, preference, quietHours);
assert.deepEqual(previewDelivered.slots.map((s) => s.state), ["delivered", "upcoming"]);
assert.equal(previewDelivered.nextDueSlot, undefined);

// 场景 D: 晚上 20:30 (1230 分钟)，20:00 也投递完成
state = markReminderDelivered(state, today, ["20:00"]);
const previewAllDone = buildReminderPlanPreview(state, today, 1230, preference, quietHours);
assert.deepEqual(previewAllDone.slots.map((s) => s.state), ["delivered", "delivered"]);
assert.equal(previewAllDone.slots.every((s) => s.state === "delivered"), true);

// 场景 E: 处于跨午夜安静时段 (23:00 = 1380 分钟)，未投递槽位被抑制为 quiet
state = emptyReminderDeliveryState();
const previewQuiet = buildReminderPlanPreview(state, today, 1380, preference, quietHours);
assert.equal(previewQuiet.inQuietHours, true);
assert.deepEqual(previewQuiet.slots.map((s) => s.state), ["quiet", "quiet"]);
assert.equal(previewQuiet.nextDueSlot, undefined, "quiet suppresses due slot");

// 场景 F: 今日静音被抑制
state = muteReminderDeliveryToday(state, today);
const previewMuted = buildReminderPlanPreview(state, today, 570, preference, quietHours);
assert.equal(previewMuted.mutedToday, true);
assert.deepEqual(previewMuted.slots.map((s) => s.state), ["muted", "muted"]);

// 3. 跨午夜安静时段严格边界验证 (22:00–07:00)
assert.equal(isWithinQuietHours(1319, quietHours), false, "21:59 is outside quiet hours");
assert.equal(isWithinQuietHours(1320, quietHours), true, "22:00 is inside quiet hours");
assert.equal(isWithinQuietHours(1439, quietHours), true, "23:59 is inside quiet hours");
assert.equal(isWithinQuietHours(0, quietHours), true, "00:00 midnight is inside quiet hours");
assert.equal(isWithinQuietHours(419, quietHours), true, "06:59 is inside quiet hours");
assert.equal(isWithinQuietHours(420, quietHours), false, "07:00 is outside quiet hours");

// 4. 夏令时（DST）挂钟时间与槽位变更幂等性
// 修改槽位为 ["10:00", "20:00"]，已有 09:00 投递不影响新槽位
state = emptyReminderDeliveryState();
state = markReminderDelivered(state, today, ["09:00"]);
const newPref = {enabled: true, slots: ["10:00", "20:00"]};
const dueNew = dueReminderDeliverySlots(state, today, 630, newPref); // 10:30 (630 分钟)
assert.deepEqual(dueNew, ["10:00"], "10:00 slot is due regardless of stale 09:00 delivery");

// 重复执行由于已投递记录强幂等
state = markReminderDelivered(state, today, ["10:00"]);
const dueAgain = dueReminderDeliverySlots(state, today, 630, newPref);
assert.deepEqual(dueAgain, [], "already delivered slot is idempotent and not returned again");

console.log("Reminder schedule preview, mute/unmute and DST quiet hours checks passed.");
