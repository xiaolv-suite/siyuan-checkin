import type {CheckinEvent, CheckinItem, CheckinSchedule, CheckinStore} from "../../types";
import {deriveQuotaAutoDays, getItemDirectionForDate, getItemRevisionForDate, type RuleDirection} from "../../rules";
import type {StreakFreezePeriod} from "./types";
import {dateKey} from "./types";
import {
    getEventDatesForItem as filterEventDatesForItem,
    getEventsForDay as filterEventsForDay,
    getEventsForItem as filterEventsForItem,
    getSkipDatesForItem as filterSkipDatesForItem,
} from "./store-index";

export {StreakFreezePeriod};

export function isDateInFreezePeriods(dateStr: string, freezePeriods?: readonly StreakFreezePeriod[]): boolean {
    if (!freezePeriods || freezePeriods.length === 0 || !dateStr) return false;
    for (const period of freezePeriods) {
        if (!period.startDate || !period.endDate) continue;
        if (dateStr >= period.startDate && dateStr <= period.endDate) return true;
    }
    return false;
}

/** T-1409 容错连续：每项目 opt-in 的漏打容错天数（1~30）；at-most 与 quota 排期沿用
    各自现有口径（无破戒日/周期派生），不叠加容错。缺省/0 = 严格断链（历史行为）。 */
export function streakToleranceFor(item: CheckinItem, asOf: Date): number {
    /* T-1766：方向按当日修订取值。 */
    if (getItemDirectionForDate(item, asOf) === "atMost") return 0;
    if (getItemRevisionForDate(item, asOf).schedule.type === "quota") return 0;
    const tolerance = Math.floor(Number(item.streakTolerance));
    return Number.isFinite(tolerance) && tolerance >= 1 ? Math.min(30, tolerance) : 0;
}

function checkIsSkipEvent(event: Pick<CheckinEvent, "kind"> | undefined): boolean {
    return event?.kind === "skip";
}

function checkItemAvailableOnDate(item: CheckinItem, date: Date): boolean {
    const key = dateKey(date);
    if (key < item.createdDate) return false;
    return !(item.archivePeriods || []).some((period) => period.startDate <= key && (!period.endDate || key < period.endDate));
}

function checkScheduledToday(item: CheckinItem, date: Date): boolean {
    const revision = getItemRevisionForDate(item, date);
    const schedule = revision.schedule;
    if (schedule.type === "daily") return true;
    if (schedule.type === "workdays") {
        const day = date.getDay();
        return day >= 1 && day <= 5;
    }
    if (schedule.type === "weekly") {
        const day = date.getDay();
        return Array.isArray(schedule.weekdays) && schedule.weekdays.includes(day);
    }
    if (schedule.type === "interval") return true;
    if (schedule.type === "quota") return true;
    return true;
}

/** Current natural-day recording streaks; an absent today may continue from yesterday.
    T-1226：统一状态序列 manual(auto 含) − skip——真实完成日与 AUTO 日（弹性配额
    达成后的期内剩余日，D-217）各计 1 天，跳过日中性桥接，其余断链。AUTO 按需在
    断链日惰性推导（仅 quota 项、单周期窗口），无跳过/配额数据时行为与旧版一致。 */
export function computeEventStreaks(store: CheckinStore, asOf = new Date(), freezePeriods?: readonly StreakFreezePeriod[]): Map<string, number> {
    const streaks = new Map<string, number>();
    const todayDate = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate(), 12);
    const today = dateKey(todayDate);
    const yesterdayDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - 1, 12);
    const yesterday = dateKey(yesterdayDate);
    for (const item of store.items) {
        if (item.archived) {
            streaks.set(item.id, 0);
            continue;
        }
        const tolerance = streakToleranceFor(item, todayDate);
        const skipDays = filterSkipDatesForItem(store, item.id);
        /* T-1239（D-219）：at-most 被动戒除——连续 = 连续无破戒日；
           破戒日断链、跳过日桥接、回溯止于项目创建日；无事件不等于中断。
           T-1766：方向按当日修订取值；方向纪元切换（普通↔戒除）重置连击，
           不以另一纪元的规则解读对方的历史。锚点规则不变：至少型的今日未记录
           不算断链（今日尚在进行中），戒除型从今日直接回溯。 */
        const days = filterEventDatesForItem(store, item.id);
        const realDays = new Set([...days].filter((key) => !skipDays.has(key)));
        const autoCache = new Map<string, boolean>();
        const isAuto = (key: string): boolean => {
            if (autoCache.has(key)) return autoCache.get(key) as boolean;
            let result = false;
            const date = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)), 12);
            const schedule = getItemRevisionForDate(item, date).schedule;
            if (schedule.type === "quota") {
                result = deriveQuotaAutoDays(schedule, store.events, item.id, key, key, {asOf: today}).has(key);
            }
            autoCache.set(key, result);
            return result;
        };
        const todayAtMost = getItemDirectionForDate(item, todayDate) === "atMost";
        const startKey = todayAtMost || realDays.has(today) || skipDays.has(today) || isAuto(today) || isDateInFreezePeriods(today, freezePeriods) ? today : yesterday;
        const anchorDate = startKey === today ? todayDate : yesterdayDate;
        const anchorBridgable = tolerance > 0 && checkItemAvailableOnDate(item, anchorDate) && checkScheduledToday(item, anchorDate);
        if (!todayAtMost && !realDays.has(startKey) && !skipDays.has(startKey) && !isAuto(startKey) && !isDateInFreezePeriods(startKey, freezePeriods) && !anchorBridgable) {
            streaks.set(item.id, 0);
            continue;
        }
        let streak = 0;
        let gap = 0;
        let guard = 0;
        let eraDirection: RuleDirection | undefined;
        const check = new Date(Number(startKey.slice(0, 4)), Number(startKey.slice(5, 7)) - 1, Number(startKey.slice(8, 10)), 12);
        while (guard < 36500) {
            guard += 1;
            const key = dateKey(check);
            if (key < item.createdDate) break;
            const direction = getItemDirectionForDate(item, check);
            if (eraDirection !== undefined && direction !== eraDirection) break;
            eraDirection = direction;
            const dayEvents = filterEventsForDay(store, item.id, check);
            const hasReal = dayEvents.some((event) => !checkIsSkipEvent(event));
            const skipped = dayEvents.some((event) => checkIsSkipEvent(event));
            const inFreeze = isDateInFreezePeriods(key, freezePeriods);
            if (direction === "atMost") {
                if (hasReal) break;
                if (!skipped && !inFreeze) streak += 1;
            } else if (hasReal) {
                streak += 1;
                gap = 0;
            } else if (skipped) {
                /* 跳过日中性桥接：不加成、不断链，也不消耗容错缺口。 */
            } else if (inFreeze) {
                /* 休假冷冻期中性桥接：同上。 */
            } else if (isAuto(key)) {
                streak += 1;
                gap = 0;
            } else if (tolerance > 0 && gap < tolerance && checkItemAvailableOnDate(item, check) && checkScheduledToday(item, check)) {
                /* T-1409 容错缺口（maxGap）：漏打的排期日在容错范围内不断链、不计数；
                   真实完成日重置缺口；SKIP 与缺口相互独立。 */
                gap += 1;
            } else break;
            check.setDate(check.getDate() - 1);
        }
        streaks.set(item.id, streak);
    }
    return streaks;
}

/** v5-3（T-1280）：历史最长连续——与 computeEventStreaks 同一套状态语义
    （真实完成/派生完成 +1,跳过日中性桥接,其余断链;at-most 为连续无破戒日）,
    但做全历史正向扫描取最大值。仅 v5 getStreaks 使用,热路径不经过。 */
export function computeLongestStreaks(store: CheckinStore, asOf = new Date(), freezePeriods?: readonly StreakFreezePeriod[]): Map<string, number> {
    const longest = new Map<string, number>();
    const todayDate = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate(), 12);
    const today = dateKey(todayDate);
    for (const item of store.items) {
        if (item.archived) {
            longest.set(item.id, 0);
            continue;
        }
        const skipDays = filterSkipDatesForItem(store, item.id);
        const days = filterEventDatesForItem(store, item.id);
        const autoCache = new Map<string, boolean>();
        const isAuto = (key: string): boolean => {
            if (autoCache.has(key)) return autoCache.get(key) as boolean;
            let result = false;
            const date = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)), 12);
            const schedule = getItemRevisionForDate(item, date).schedule;
            if (schedule.type === "quota") {
                result = deriveQuotaAutoDays(schedule, store.events, item.id, key, key, {asOf: today}).has(key);
            }
            autoCache.set(key, result);
            return result;
        };
        const todayDirection = getItemDirectionForDate(item, todayDate);
        if (todayDirection !== "atMost" && !days.size && !skipDays.size) {
            longest.set(item.id, 0);
            continue;
        }
        let run = 0;
        let max = 0;
        let gap = 0;
        let guard = 0;
        let eraDirection: RuleDirection | undefined;
        const tolerance = streakToleranceFor(item, todayDate);
        const check = new Date(Number(item.createdDate.slice(0, 4)), Number(item.createdDate.slice(5, 7)) - 1, Number(item.createdDate.slice(8, 10)), 12);
        while (guard < 36500) {
            guard += 1;
            const key = dateKey(check);
            if (key > today) break;
            const direction = getItemDirectionForDate(item, check);
            if (eraDirection !== undefined && direction !== eraDirection) {
                run = 0;
                gap = 0;
            }
            eraDirection = direction;
            const dayEvents = filterEventsForDay(store, item.id, check);
            const hasReal = dayEvents.some((event) => !checkIsSkipEvent(event));
            const skipped = dayEvents.some((event) => checkIsSkipEvent(event));
            if (direction === "atMost") {
                if (hasReal) {
                    run = 0;
                    gap = 0;
                } else if (!skipped && !isDateInFreezePeriods(key, freezePeriods)) {
                    run += 1;
                    max = Math.max(max, run);
                }
            } else if (hasReal) {
                run += 1;
                gap = 0;
                max = Math.max(max, run);
            } else if (skipped) {
                /* 跳过日中性桥接:不加成、不断链。 */
            } else if (isDateInFreezePeriods(key, freezePeriods)) {
                /* 休假冷冻期中性桥接:同上。 */
            } else if (isAuto(key)) {
                run += 1;
                gap = 0;
                max = Math.max(max, run);
            } else if (tolerance > 0 && gap < tolerance && checkItemAvailableOnDate(item, check) && checkScheduledToday(item, check)) {
                gap += 1;
            } else {
                run = 0;
                gap = 0;
            }
            check.setDate(check.getDate() + 1);
        }
        longest.set(item.id, max);
    }
    return longest;
}
