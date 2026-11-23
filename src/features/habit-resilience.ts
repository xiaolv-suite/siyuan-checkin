/**
 * 习惯韧性指数与自律免死金牌 (Habit Resilience & Streak Freeze)
 * 
 * 核心哲学：破除“断卡1天全清零易挫败弃坑”机制，以指数加权移动平均 (EWMA)
 * 稳固长期自律心流，并提供每月自律免死金牌抵扣缓冲。
 */

import {dateKey, getItemDirectionForDate, getItemRevisionForDate, getProgress, getSkipDatesForItem, isComplete, isItemAvailableOnDate, isScheduledToday, isSkipEvent, getEventsForDay, type StreakFreezePeriod} from "../model";
import type {CheckinEvent, CheckinItem, CheckinStore} from "../types";

export type HabitResilienceGrade = "S" | "A" | "B" | "C" | "D";

export interface HabitResilienceResult {
    /** 韧性强度得分 0 ~ 100 */
    score: number;
    /** 稳固度等级：S (90-100) / A (75-89) / B (60-74) / C (40-59) / D (<40) */
    grade: HabitResilienceGrade;
    /** 趋势：up (上升) / down (轻微回撤) / stable (平稳) */
    trend: "up" | "down" | "stable";
    /** 阶段标签，如 "扎根期 (92%)" */
    label: string;
    /** 心理呵护指导语 */
    hint: string;
    /** 昨日断卡是否处于韧性保护缓冲期（score >= 60 即心流未散） */
    inResilienceBuffer: boolean;
}

export const MONTHLY_STREAK_FREEZE_LIMIT = 2;

/**
 * 科学习惯强度算法 (EWMA 时间加权衰减)：
 * 对标 Loop Habit Tracker 与 Atomic Habits 规约。
 * 
 * 衰减系数 m = 0.5^(1 / halfLifeDays)。
 * S_t = S_{t-1} * m + (completion * 100) * (1 - m)。
 * 即使某天漏打，强度仅微幅下挫（如 halfLifeDays=14 时从 95% 仅跌至 91%），补打 2 天即可重回巅峰。
 * 
 * @param history 依时间升序排列的历史完成情况数组（true: 达成, false: 漏打；数值则为 0~1 的归一化进度）
 * @param halfLifeDays 半衰期天数，默认 7（日常标准衰减）或 14（温和抗挫衰减）
 * @param initialScore 起始分值，默认 0
 * @returns 0 ~ 100 整数得分
 */
export function calculateHabitStrength(
    history: readonly (boolean | number)[],
    halfLifeDays = 7,
    initialScore = 0
): number {
    if (!history || history.length === 0) {
        return Math.min(100, Math.max(0, Math.round(initialScore)));
    }
    const validHalfLife = Number.isFinite(halfLifeDays) && halfLifeDays > 0 ? halfLifeDays : 7;
    const m = Math.pow(0.5, 1 / validHalfLife);
    let score = Math.min(100, Math.max(0, initialScore));

    for (const entry of history) {
        let completion = 0;
        if (typeof entry === "boolean") {
            completion = entry ? 1 : 0;
        } else if (typeof entry === "number" && Number.isFinite(entry)) {
            completion = Math.min(1, Math.max(0, entry));
        }
        score = score * m + (completion * 100) * (1 - m);
    }
    return Math.min(100, Math.max(0, Math.round(score)));
}

/** 获取韧性分级元数据 */
export function getHabitResilienceMeta(score: number): { grade: HabitResilienceGrade; label: string; hint: string } {
    const s = Math.min(100, Math.max(0, Math.round(score)));
    if (s >= 90) {
        return {
            grade: "S",
            label: "扎根期",
            hint: "习惯已融入潜意识，自动化心流形成，偶有漏打亦无伤大雅",
        };
    }
    if (s >= 75) {
        return {
            grade: "A",
            label: "稳固期",
            hint: "自律韧性强大，已跨越阻力期，保持当下节奏即可稳步精进",
        };
    }
    if (s >= 60) {
        return {
            grade: "B",
            label: "爬坡期",
            hint: "习惯正在加速巩固，心流保持良好，连续推进 3 天即可突破稳固期",
        };
    }
    if (s >= 40) {
        return {
            grade: "C",
            label: "萌芽期",
            hint: "处于行为初建阶段，注意微习惯启动法，两分钟即可轻松完成",
        };
    }
    return {
        grade: "D",
        label: "起步期",
        hint: "不要把目标定得过大，降低心理启动门槛，行动一次就是胜利",
    };
}

/**
 * 投影指定习惯在指定时间点的习惯韧性指数
 * 扫描近 60 天计划日的完成轨迹，采用 EWMA（默认半衰期 14 天平滑模型）推导
 */
export function computeHabitResilience(
    store: CheckinStore,
    item: CheckinItem,
    asOf: Date = new Date(),
    halfLifeDays = 14
): HabitResilienceResult {
    if (!store || !item) {
        const meta = getHabitResilienceMeta(0);
        return {score: 0, grade: meta.grade, trend: "stable", label: meta.label, hint: meta.hint, inResilienceBuffer: false};
    }

    const todayDate = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate(), 12);
    const skipDates = getSkipDatesForItem(store, item.id);
    const windowDays = 60;
    const history: number[] = [];

    // 从 60 天前回溯扫描到昨天（今日单独处理或看是否已完成）
    for (let offset = windowDays; offset >= 1; offset--) {
        const cursor = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - offset, 12);
        const key = dateKey(cursor);
        if (key < item.createdDate) continue;
        if (!isItemAvailableOnDate(item, cursor)) continue;
        if (!isScheduledToday(item, cursor)) continue;

        // 跳过日冻结，不计入衰减也不算断签
        if (skipDates.has(key)) continue;

        const complete = isComplete(store, item, cursor);
        const direction = getItemDirectionForDate(item, cursor);
        if (complete) {
            history.push(1);
        } else if (direction === "atMost") {
            const hasLapse = getEventsForDay(store, item.id, cursor).some((e: CheckinEvent) => !isSkipEvent(e));
            history.push(hasLapse ? 0 : 1);
        } else {
            const rev = getItemRevisionForDate(item, cursor);
            const target = rev.schedule.type === "quota" ? rev.schedule.quota?.amount || rev.target : rev.target;
            const progress = getProgress(store, item, cursor);
            const ratio = target > 0 ? Math.min(1, Math.max(0, progress / target)) : 0;
            history.push(ratio);
        }
    }

    // 若今日已完成，追加今日
    const todayComplete = isComplete(store, item, todayDate);
    if (todayComplete) {
        history.push(1);
    }

    const currentScore = calculateHabitStrength(history, halfLifeDays);
    // 计算前一天的分值评估趋势
    const prevHistory = history.slice(0, -1);
    const prevScore = prevHistory.length > 0 ? calculateHabitStrength(prevHistory, halfLifeDays) : currentScore;

    let trend: "up" | "down" | "stable" = "stable";
    if (currentScore > prevScore + 1) trend = "up";
    else if (currentScore < prevScore - 1) trend = "down";

    const meta = getHabitResilienceMeta(currentScore);
    const inResilienceBuffer = currentScore >= 60;

    return {
        score: currentScore,
        grade: meta.grade,
        trend,
        label: `${meta.label} (${currentScore}%)`,
        hint: meta.hint,
        inResilienceBuffer,
    };
}

/**
 * 统计某月份已使用的自律免死金牌数量
 * 检查 freezePeriods 中在 monthPrefix 内且注明为免死金牌的冷冻期天数
 */
export function getMonthlyStreakFreezeCount(
    freezePeriods: readonly StreakFreezePeriod[] | undefined,
    monthPrefix: string
): number {
    if (!freezePeriods || !Array.isArray(freezePeriods) || !monthPrefix) return 0;
    let count = 0;
    for (const p of freezePeriods) {
        if (!p.startDate || !p.endDate) continue;
        const isFreezeToken = /免死|金牌|token|shield/i.test(p.reason || "");
        if (!isFreezeToken) continue;
        if (p.startDate.startsWith(monthPrefix) || p.endDate.startsWith(monthPrefix) || (p.startDate < monthPrefix && p.endDate > monthPrefix)) {
            // 跨月精确切分：只计算落在当前目标月份内的实际天数，杜绝双重扣减额度
            let cur = new Date(`${p.startDate}T12:00:00`);
            const end = new Date(`${p.endDate}T12:00:00`);
            let daysInMonth = 0;
            while (cur <= end) {
                const y = cur.getFullYear();
                const m = String(cur.getMonth() + 1).padStart(2, "0");
                if (`${y}-${m}` === monthPrefix) {
                    daysInMonth += 1;
                }
                cur.setDate(cur.getDate() + 1);
            }
            count += daysInMonth;
        }
    }
    return count;
}

/**
 * 检查某日期是否可以应用免死金牌
 */
export function canApplyStreakFreeze(
    freezePeriods: readonly StreakFreezePeriod[] | undefined,
    targetDate: string,
    maxPerMonth = MONTHLY_STREAK_FREEZE_LIMIT
): boolean {
    if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return false;
    const monthPrefix = targetDate.slice(0, 7);
    const used = getMonthlyStreakFreezeCount(freezePeriods, monthPrefix);
    if (used >= maxPerMonth) return false;

    // 检查是否已经在冷冻期内
    if (freezePeriods && freezePeriods.length > 0) {
        for (const p of freezePeriods) {
            if (p.startDate && p.endDate && targetDate >= p.startDate && targetDate <= p.endDate) {
                return false; // 已受保护，无需重复使用
            }
        }
    }
    return true;
}

/**
 * 创建并追加 1 天免死金牌冷冻保护期
 */
export function applyStreakFreezePeriod(
    freezePeriods: readonly StreakFreezePeriod[] | undefined,
    targetDate: string,
    reason = "自律免死金牌保护"
): StreakFreezePeriod[] {
    const existing = Array.isArray(freezePeriods) ? [...freezePeriods] : [];
    if (!canApplyStreakFreeze(existing, targetDate)) return existing;
    const newPeriod: StreakFreezePeriod = {
        startDate: targetDate,
        endDate: targetDate,
        reason,
    };
    return [...existing, newPeriod];
}
