/**
 * 习惯韧性指数与自律免死金牌 (Habit Resilience & Streak Freeze)
 * 
 * 核心哲学：破除“断卡1天全清零易挫败弃坑”机制，以总纲 v4 唯一半衰期 EMA 口径
 * m = 0.5^(sqrt(freq)/13) 稳固长期自律心流，并提供每月自律免死金牌抵扣缓冲。
 */

import {dateKey, getItemRevisionForDate, isComplete, type StreakFreezePeriod} from "../model";
import type {CheckinItem, CheckinStore} from "../types";
import {buildHabitScoreSeries, collectHabitScoreDays, scheduleFrequency, scoreMultiplier, type HabitScoreDayInput, type HabitScoreFrequency} from "./habit-score";

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

export interface HabitStrengthInputEntry {
    date?: string;
    completion?: number;
    value?: number;
    skipped?: boolean;
    frozen?: boolean;
    repair?: boolean;
}

/**
 * 总纲 v4 唯一习惯强度算法：
 * freq = numerator / denominator, m = 0.5^(sqrt(freq)/13)
 * 非计划日 / 跳过日 / 冻结期：S_t = S_{t-1}
 * 正常日：S_t = clamp(0, 100, S_{t-1}·m + done_eff·(1-m)·100)
 * D-1 救赎补卡：done_eff = min(1, completion) * 0.8
 */
export function calculateHabitStrength(
    history: readonly (boolean | number | HabitStrengthInputEntry)[],
    targetFrequency: number | HabitScoreFrequency = 1,
    initialScore = 0
): number {
    if (!history || history.length === 0) {
        return Math.min(100, Math.max(0, Math.round(initialScore)));
    }
    const frequency: HabitScoreFrequency = typeof targetFrequency === "number"
        ? {numerator: Math.max(0.01, Number.isFinite(targetFrequency) && targetFrequency > 0 ? targetFrequency : 1), denominator: 1}
        : {numerator: Math.max(0.01, targetFrequency.numerator), denominator: Math.max(1, targetFrequency.denominator)};
    const days: HabitScoreDayInput[] = history.map((entry, idx) => {
        const fallbackDate = `2026-01-${String((idx % 28) + 1).padStart(2, "0")}`;
        if (typeof entry === "boolean") {
            return {date: fallbackDate, scheduled: true, skipped: false, completion: entry ? 1 : 0};
        }
        if (typeof entry === "number") {
            const val = Number.isFinite(entry) ? Math.min(1, Math.max(0, entry)) : 0;
            return {date: fallbackDate, scheduled: true, skipped: false, completion: val};
        }
        const raw = entry?.completion !== undefined ? entry.completion : (entry?.value !== undefined ? entry.value : 0);
        const completion = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
        return {
            date: entry?.date || fallbackDate,
            scheduled: true,
            skipped: Boolean(entry?.skipped),
            frozen: Boolean(entry?.frozen),
            repair: Boolean(entry?.repair),
            completion,
        };
    });
    const series = buildHabitScoreSeries(days, frequency, {initial: initialScore});
    const last = series[series.length - 1];
    return Math.min(100, Math.max(0, Math.round(last ? last.score : initialScore)));
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
 * 与 Review/Insights 共用总纲 v4 唯一 EMA 模型 (collectHabitScoreDays + buildHabitScoreSeries)
 */
export function computeHabitResilience(
    store: CheckinStore,
    item: CheckinItem,
    asOf: Date = new Date(),
    freezePeriods?: readonly StreakFreezePeriod[]
): HabitResilienceResult {
    if (!store || !item) {
        const meta = getHabitResilienceMeta(0);
        return {score: 0, grade: meta.grade, trend: "stable", label: meta.label, hint: meta.hint, inResilienceBuffer: false};
    }

    const todayDate = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate(), 12);
    const startDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - 60, 12);
    const todayComplete = isComplete(store, item, todayDate);
    const endExclusiveDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + (todayComplete ? 1 : 0), 12);
    const scoreDays = collectHabitScoreDays(store, item, dateKey(startDate), dateKey(endExclusiveDate), freezePeriods);
    const freq = scheduleFrequency(getItemRevisionForDate(item, todayDate).schedule);
    const series = buildHabitScoreSeries(scoreDays, freq);
    const currentScore = series.length ? Math.round(series[series.length - 1].score) : 0;
    const prevScore = series.length >= 2 ? Math.round(series[series.length - 2].score) : currentScore;

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
