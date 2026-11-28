/* T-1421 · R-A2 提醒安静时段——偏好纯函数面（零依赖、无时钟）。
   纪律：
   - 安静时段只影响「呈现强度」，不影响事实：窗口内的优先提醒仍页内可见
     （is-quiet 降级变体），不消失、不删除、不改变打卡/逾期语义；
   - 不新增后台常驻、不直接发送系统通知（既有边界）；
   - 窗口支持跨午夜（如 22:00–07:00）；全部函数显式接收分钟数/配置，
     不读取隐式时钟，非法输入 fail-closed 回落默认值；
   - 被 view-preferences（偏好归一化）与提醒条渲染消费；独立成模块是为了
     避免 view-preferences 引入 reminders 的重依赖集（测试固定模块集约束）。 */

export interface ReminderQuietHours {
    enabled: boolean;
    /** "HH:MM" 24 小时制窗口起点。 */
    start: string;
    /** "HH:MM" 24 小时制窗口终点；可早于 start 表示跨午夜。 */
    end: string;
}

export const DEFAULT_REMINDER_QUIET_HOURS: ReminderQuietHours = {enabled: false, start: "22:00", end: "07:00"};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 严格解析 "HH:MM" 为当日内分钟数（0–1439）；非法返回 undefined。 */
export function reminderMinutesOfDay(time: string): number | undefined {
    if (typeof time !== "string" || !TIME_PATTERN.test(time)) return undefined;
    const segments = time.split(":");
    const hours = Number(segments[0]);
    const minutes = Number(segments[1]);
    return hours * 60 + minutes;
}

/** 归一化安静时段偏好：非法/缺失字段安全回落默认值（默认关）。 */
export function normalizeReminderQuietHours(value: unknown): ReminderQuietHours {
    if (!value || typeof value !== "object") return {...DEFAULT_REMINDER_QUIET_HOURS};
    const source = value as Record<string, unknown>;
    const start = typeof source.start === "string" && reminderMinutesOfDay(source.start) !== undefined ? source.start : DEFAULT_REMINDER_QUIET_HOURS.start;
    const end = typeof source.end === "string" && reminderMinutesOfDay(source.end) !== undefined ? source.end : DEFAULT_REMINDER_QUIET_HOURS.end;
    return {enabled: source.enabled === true, start, end};
}

/** 判断当日分钟数是否落在安静窗口内。
    start === end 视为空窗口（永不安静）；start > end 为跨午夜窗口
    （如 22:00–07:00：minutes ≥ 22:00 或 < 07:00）。 */
export function isWithinQuietHours(minutesOfDay: number, quietWindow: ReminderQuietHours): boolean {
    if (!quietWindow.enabled) return false;
    if (!Number.isInteger(minutesOfDay) || minutesOfDay < 0 || minutesOfDay > 1439) return false;
    const start = reminderMinutesOfDay(quietWindow.start);
    const end = reminderMinutesOfDay(quietWindow.end);
    if (start === undefined || end === undefined) return false;
    if (start === end) return false;
    if (start < end) return minutesOfDay >= start && minutesOfDay < end;
    return minutesOfDay >= start || minutesOfDay < end;
}

/* —— T-1451 · R-A2 每日提醒调度——启用开关 + 每日多次时刻槽（用户需求 2026-09-24）。
   语义：slots 为空 = 保持「启动后一天一条」的原行为；配置槽位后按时刻触发，
   每槽每日至多一条（宿主按 localDate 幂等），安静时段闸门与零事项跳过不变。
   纪律：零依赖、无时钟、确定性；非法时刻丢弃、去重升序、封顶 4。 */

export const DAILY_REMINDER_MAX_SLOTS = 4;

export interface DailyReminderPreference {
    enabled: boolean;
    /** "HH:MM" 升序去重后的提醒时刻；空数组 = 启动后一条的原行为。 */
    slots: string[];
}

export const DEFAULT_DAILY_REMINDER: DailyReminderPreference = {enabled: true, slots: []};

/** 归一化每日提醒偏好：缺失整体回落默认（启用 + 启动一条）；非法时刻逐项丢弃。 */
export function normalizeDailyReminderPreference(value: unknown): DailyReminderPreference {
    if (!value || typeof value !== "object") return {...DEFAULT_DAILY_REMINDER, slots: []};
    const source = value as Record<string, unknown>;
    return {enabled: source.enabled !== false, slots: normalizeDailyReminderSlots(source.slots)};
}

/** 时刻数组归一：严格 HH:MM 校验、去重、升序、封顶 4；非数组/非法项全部丢弃。 */
export function normalizeDailyReminderSlots(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    for (const entry of value) {
        if (typeof entry !== "string") continue;
        if (reminderMinutesOfDay(entry.trim()) === undefined) continue;
        seen.add(entry.trim());
    }
    return [...seen].sort((left, right) => (reminderMinutesOfDay(left) ?? 0) - (reminderMinutesOfDay(right) ?? 0)).slice(0, DAILY_REMINDER_MAX_SLOTS);
}

/* —— T-1752 提醒方案推荐与实际触发预演（P1，T-1662 后续）——
   区分“默认启用且无 slots＝启动后一条”和定时槽提醒，展示未来几次本地时刻、
   安静时段 22:00–07:00 当前默认关、事项仅一次选项的真实影响。
   纪律：纯函数、零时钟侵入、确定性、无副作用。 */

export interface ReminderPresetScheme {
    id: "minimal" | "morning" | "review" | "frequent";
    labelKey: string;
    hintKey: string;
    slots: string[];
}

export const REMINDER_PRESET_SCHEMES: readonly ReminderPresetScheme[] = [
    {
        id: "minimal",
        labelKey: "set.reminderPresetMinimal",
        hintKey: "set.reminderPresetMinimalHint",
        slots: [], // 留空 = 启动后一条（低打扰）
    },
    {
        id: "morning",
        labelKey: "set.reminderPresetMorning",
        hintKey: "set.reminderPresetMorningHint",
        slots: ["09:00"], // 晨间规划
    },
    {
        id: "review",
        labelKey: "set.reminderPresetReview",
        hintKey: "set.reminderPresetReviewHint",
        slots: ["09:00", "21:00"], // 早晚复盘（推荐）
    },
    {
        id: "frequent",
        labelKey: "set.reminderPresetFrequent",
        hintKey: "set.reminderPresetFrequentHint",
        slots: ["09:00", "13:00", "18:00", "21:00"], // 全天四段
    },
];

export interface ReminderTimelineForecast {
    mode: "launch" | "slots";
    /** 未来触发序列（至多 4 项），区分当天与次日，以及是否落在安静时段 */
    upcomingTriggers: Array<{
        slot: string;
        isNextDay: boolean;
        inQuietHours: boolean;
    }>;
    quietHoursEffect: {
        enabled: boolean;
        start: string;
        end: string;
        hasQuietOverlap: boolean;
        summaryKey: string;
    };
    occasionRemindOnceEffect: {
        enabled: boolean;
        summaryKey: string;
    };
}

/** T-1752：计算提醒计划未来触发时刻与安静时段/事项仅一次真实影响纯函数 */
export function simulateReminderTimeline(
    preference: DailyReminderPreference,
    quietHours: ReminderQuietHours,
    occasionRemindOnce: boolean,
    currentMinutesOfDay: number,
): ReminderTimelineForecast {
    const slots = normalizeDailyReminderSlots(preference.slots);
    const mode: "launch" | "slots" = slots.length > 0 ? "slots" : "launch";
    const upcomingTriggers: ReminderTimelineForecast["upcomingTriggers"] = [];

    if (mode === "launch") {
        upcomingTriggers.push({
            slot: "launch",
            isNextDay: false,
            inQuietHours: isWithinQuietHours(currentMinutesOfDay, quietHours),
        });
    } else {
        // 当天剩余槽位
        for (const slot of slots) {
            const minutes = reminderMinutesOfDay(slot);
            if (minutes !== undefined && minutes > currentMinutesOfDay) {
                upcomingTriggers.push({
                    slot,
                    isNextDay: false,
                    inQuietHours: isWithinQuietHours(minutes, quietHours),
                });
            }
        }
        // 当天如果少于 2 次或都已过去，补次日首批槽位（总数补至至少 2 次）
        const targetForecastCount = Math.min(2, slots.length);
        if (upcomingTriggers.length < targetForecastCount) {
            for (const slot of slots) {
                if (upcomingTriggers.length >= targetForecastCount) break;
                const minutes = reminderMinutesOfDay(slot);
                if (minutes !== undefined) {
                    upcomingTriggers.push({
                        slot,
                        isNextDay: true,
                        inQuietHours: isWithinQuietHours(minutes, quietHours),
                    });
                }
            }
        }
    }

    let hasQuietOverlap = false;
    if (quietHours.enabled) {
        if (mode === "launch") {
            hasQuietOverlap = isWithinQuietHours(currentMinutesOfDay, quietHours);
        } else {
            hasQuietOverlap = slots.some((slot) => {
                const minutes = reminderMinutesOfDay(slot);
                return minutes !== undefined && isWithinQuietHours(minutes, quietHours);
            });
        }
    }

    const quietSummaryKey = !quietHours.enabled
        ? "set.reminderQuietDisabled"
        : hasQuietOverlap
            ? "set.reminderQuietAffects"
            : "set.reminderQuietNoConflict";

    const occasionSummaryKey = occasionRemindOnce
        ? "set.reminderOccasionOnceActive"
        : "set.reminderOccasionOnceInactive";

    return {
        mode,
        upcomingTriggers,
        quietHoursEffect: {
            enabled: quietHours.enabled,
            start: quietHours.start,
            end: quietHours.end,
            hasQuietOverlap,
            summaryKey: quietSummaryKey,
        },
        occasionRemindOnceEffect: {
            enabled: occasionRemindOnce,
            summaryKey: occasionSummaryKey,
        },
    };
}

