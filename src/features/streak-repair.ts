/* 连击救赎断点消除战役 (Streak Repair Flow)
   实现次日补卡救赎：识别昨日漏打卡习惯，EMA 折算 80% 增益，连击无缝接续，每月上限 2 次。 */

import {dateKey, getItemDirectionForDate, getEventsForDay, isComplete, isItemAvailableOnDate, isScheduledToday, isSkipEvent} from "../model";
import type {CheckinItem, CheckinStore} from "../types";

export interface StreakRepairOpportunity {
    item: CheckinItem;
    yesterdayKey: string;
    monthlyRepairsUsed: number;
    exhausted: boolean;
}

export const MONTHLY_STREAK_REPAIR_LIMIT = 2;

/**
 * 扫描昨日（D-1）断签习惯：
 * 存在「计划打卡但未记录且未请假 (skip)」的习惯即标记为可救赎。
 * 每习惯每月最多 2 次救赎，超限时 exhausted=true。
 */
export function scanStreakRepairOpportunities(
    store: CheckinStore,
    asOf: Date = new Date(),
): StreakRepairOpportunity[] {
    if (!store || !Array.isArray(store.items)) return [];
    const yesterdayDate = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate() - 1, 12);
    const yesterdayKey = dateKey(yesterdayDate);
    const monthPrefix = yesterdayKey.slice(0, 7);

    const opportunities: StreakRepairOpportunity[] = [];
    for (const item of store.items) {
        if (item.archived) continue;
        if (getItemDirectionForDate(item, yesterdayDate) === "atMost") continue;
        if (!isItemAvailableOnDate(item, yesterdayDate)) continue;
        if (!isScheduledToday(item, yesterdayDate)) continue;
        if (isComplete(store, item, yesterdayDate)) continue;
        const dayEvents = getEventsForDay(store, item.id, yesterdayDate);
        if (dayEvents.some(isSkipEvent)) continue;
        if (dayEvents.some((e) => !isSkipEvent(e))) continue;

        const monthlyRepairsUsed = getMonthlyStreakRepairCount(store, item.id, monthPrefix);

        opportunities.push({
            item,
            yesterdayKey,
            monthlyRepairsUsed,
            exhausted: monthlyRepairsUsed >= MONTHLY_STREAK_REPAIR_LIMIT,
        });
    }
    return opportunities;
}

/** 获取当月某习惯已使用的救赎补卡次数 */
export function getMonthlyStreakRepairCount(
    store: CheckinStore,
    itemId: string,
    monthPrefix: string,
): number {
    if (!store || !Array.isArray(store.events)) return 0;
    return store.events.filter(
        (e) => e.itemId === itemId && e.repair === true && e.localDate.startsWith(monthPrefix),
    ).length;
}
