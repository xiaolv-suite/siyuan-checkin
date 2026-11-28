import type {CheckinKind} from "../../types";

export interface StreakFreezePeriod {
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    reason?: string;
}

export interface DayCompletionInput {
    direction?: "atMost";
    kind: CheckinKind;
    progress: number;
    target: number;
    skipped: boolean;
}

export interface HabitScoreFrequency {
    numerator: number;
    denominator: number;
}

export interface HabitScoreDayInput {
    date: string;
    scheduled: boolean;
    skipped: boolean;
    completion: number;
    frozen?: boolean;
    repair?: boolean;
}

export interface HabitScorePoint {
    date: string;
    score: number;
}

export type HabitMaturityStage = "seed" | "climb" | "root";

export interface HabitSaturationResult {
    saturationScore: number;
    effectiveDays: number;
    targetDays: number;
    stage: HabitMaturityStage;
    stageProgress: number;
    stageHintKey: string;
}

export interface HabitScoreOptions {
    initial?: number;
    asOf?: Date;
}

export function dateKey(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
