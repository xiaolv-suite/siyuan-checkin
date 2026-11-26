export type FocusProviderType = "builtin" | "docktomato";

export interface FocusOwner {
    provider: unknown;
    sessionId: string;
    itemId: string;
    startedAt?: string;
}

export interface FocusSessionState {
    active: boolean;
    running: boolean;
    paused: boolean;
    sessionId?: string;
    itemId?: string;
    providerId?: string;
    mode?: "countdown" | "countup" | "stopwatch";
    targetDurationMinutes?: number;
    elapsedSeconds?: number;
}

export interface FocusDurabilityPolicy {
    preserveOnReload: boolean;
    rebindWindowSeconds: number;
    maxDisconnectionGraceMs: number;
}

export const DEFAULT_FOCUS_DURABILITY_POLICY: FocusDurabilityPolicy = {
    preserveOnReload: true,
    rebindWindowSeconds: 300,
    maxDisconnectionGraceMs: 5000,
};
