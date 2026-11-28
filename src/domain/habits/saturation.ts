import type {CheckinSchedule} from "../../types";
import type {
    HabitMaturityStage,
    HabitSaturationResult,
    HabitScoreDayInput,
    HabitScoreFrequency,
    HabitScoreOptions,
    HabitScorePoint,
} from "./types";

/**
 * T-1873 / S1: 基于逻辑斯蒂饱和函数 y = 1/(1+exp(-0.4*x)) 计算习惯稳固度与三阶段成熟度
 * 纯数学函数，零外部 IO，输入输出确定性保证。
 */
export function computeHabitSaturation(
    completedDays: number,
    targetDays = 66
): HabitSaturationResult {
    const safeCompleted = Number.isFinite(completedDays) ? Math.max(0, completedDays) : 0;
    const validTarget = Number.isFinite(targetDays) ? Math.max(7, targetDays) : 66;
    const cappedDays = Math.min(validTarget * 1.5, safeCompleted);
    const ratio = cappedDays / validTarget;

    const sigmoid = (t: number) => 1 / (1 + Math.exp(-t));
    const sigMin = sigmoid(-3);
    const sigMax = sigmoid(3);
    const t = 6 * Math.min(1.5, ratio) - 3;
    const rawScore = 100 * ((sigmoid(t) - sigMin) / (sigMax - sigMin));
    const saturationScore = Math.min(100, Math.max(0, Math.round(rawScore)));

    let stage: HabitMaturityStage = "seed";
    let stageProgress = 0;
    let stageHintKey = "habit.stageSeedHint";

    if (safeCompleted >= 46 || ratio >= 0.68) {
        stage = "root";
        const rootSpan = Math.max(1, validTarget - 46);
        stageProgress = Math.min(100, Math.round(((safeCompleted - 46) / rootSpan) * 100));
        stageHintKey = "habit.stageRootHint";
    } else if (safeCompleted >= 22 || ratio >= 0.33) {
        stage = "climb";
        stageProgress = Math.min(100, Math.round(((safeCompleted - 22) / 24) * 100));
        stageHintKey = "habit.stageClimbHint";
    } else {
        stage = "seed";
        stageProgress = Math.min(100, Math.round((safeCompleted / 21) * 100));
        stageHintKey = "habit.stageSeedHint";
    }

    return {
        effectiveDays: cappedDays,
        targetDays: validTarget,
        saturationScore,
        stage,
        stageProgress: Math.max(0, stageProgress),
        stageHintKey,
    };
}

/** 频率（次/天）：从排期推导 num/den；用于半衰期乘数。 */
export function scheduleFrequency(schedule: CheckinSchedule): HabitScoreFrequency {
    if (schedule.type === "quota" && schedule.quota) {
        return schedule.quota.period === "week"
            ? {numerator: Math.max(1, schedule.quota.amount), denominator: 7}
            : {numerator: Math.max(1, schedule.quota.amount), denominator: 30};
    }
    if (schedule.type === "interval" && schedule.intervalDays) {
        return {numerator: 1, denominator: Math.max(1, schedule.intervalDays)};
    }
    if (schedule.type === "weekly" && Array.isArray(schedule.weekdays) && schedule.weekdays.length) {
        return {numerator: schedule.weekdays.length, denominator: 7};
    }
    if (schedule.type === "workdays") return {numerator: 5, denominator: 7};
    return {numerator: 1, denominator: 1};
}

const HALF_LIFE_DIVISOR = 13;

/** 单日半衰期乘数：m = 0.5^(sqrt(freq)/13)。频率越高 m 越小（漏做日掉分越快）。 */
export function scoreMultiplier(frequency: HabitScoreFrequency): number {
    const num = Math.max(0, frequency.numerator);
    const den = Math.max(1, frequency.denominator);
    const freq = num / den;
    return Math.pow(0.5, Math.sqrt(freq) / HALF_LIFE_DIVISOR);
}

const clampCompletion = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

/**
 * 逐日滚动强度序列（0~100）。输入必须按日期升序；
 * 非计划日、atLeast 跳过日与冻结期保持 S_t = S_{t-1}（不加成、不衰减）。
 */
export function buildHabitScoreSeries(
    days: readonly HabitScoreDayInput[],
    frequency: HabitScoreFrequency,
    options: HabitScoreOptions = {},
): HabitScorePoint[] {
    const m = scoreMultiplier(frequency);
    let score = Math.min(100, Math.max(0, options?.initial ?? 0));
    const points: HabitScorePoint[] = [];
    for (const day of days) {
        if (day.scheduled && !day.skipped && !day.frozen) {
            const rawDone = clampCompletion(day.completion);
            const done = day.repair ? rawDone * 0.8 : rawDone;
            score = score * m + done * (1 - m) * 100;
            score = Math.min(100, Math.max(0, score));
        }
        points.push({date: day.date, score: Math.round(score * 10) / 10});
    }
    return points;
}

export function summarizeHabitScoreSeries(
    series: readonly HabitScorePoint[],
    frequency: HabitScoreFrequency,
): {
    strength: number;
    trend: "up" | "down" | "flat";
    trendArrow: "↑" | "↓" | "→";
    delta: number;
    multiplier: number;
} {
    const m = scoreMultiplier(frequency);
    const strength = series.length ? series[series.length - 1].score : 0;
    const prevScore = series.length >= 2 ? series[series.length - 2].score : strength;
    const delta = Math.round((strength - prevScore) * 10) / 10;
    const trend: "up" | "down" | "flat" = delta > 0.3 ? "up" : delta < -0.3 ? "down" : "flat";
    const trendArrow: "↑" | "↓" | "→" = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
    return {
        strength,
        trend,
        trendArrow,
        delta,
        multiplier: Math.round(m * 1000) / 1000,
    };
}
