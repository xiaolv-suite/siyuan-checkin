export interface CardPatchData {
    itemId: string;
    complete: boolean;
    progress: number;
    target: number;
    unit: string;
    percent: number;
    currentStreak: number;
    remainingValue?: number;
    isSkip?: boolean;
}

export interface PatchResult {
    patched: boolean;
    cardFound: boolean;
    rootsUpdated: number;
}

export interface TodayPatchData {
    card: CardPatchData;
    overviewRingPercent?: number;
    completedCount?: number;
    scheduledCount?: number;
}
