/* T-1659 外部来源统一调度、退避与省电策略矩阵模型
   纪律：纯函数、无副作用、零隐式时钟、完全由入参驱动。
   功能：
   1. 统一 6 大外部来源（微信读书/叶归/健康/笔记推导/思播/思阅）调度契约；
   2. 独立代际（generation）、在飞（inFlight）与最近成功时间（lastSuccessAt）；
   3. 失败指数退避（exponential backoff with cap），避免故障期死循环轰炸；
   4. 前后台省电策略：不可见期间跳过轮询，回前台防抖单次补拉；
   5. 状态矩阵可解释性评估。 */

export type ExternalSourceKey = "weread" | "yeguif" | "health" | "notequery" | "siplayer" | "sireader";

export type SourceTriggerReason = "startup" | "interval" | "foreground" | "manual";

export type SourceSchedulerStatus = "disabled" | "idle" | "running" | "backoff" | "paused-background";

export interface SourceScheduleConfig {
    intervalMs: number;
    startupDelayMs: number;
    minForegroundIntervalMs: number;
    baseBackoffMs: number;
    maxBackoffMs: number;
}

export const DEFAULT_SOURCE_SCHEDULE_CONFIGS: Readonly<Record<ExternalSourceKey, SourceScheduleConfig>> = {
    weread: {
        intervalMs: 1_800_000, // 30 分钟轮询
        startupDelayMs: 5_000,
        minForegroundIntervalMs: 60_000, // 60 秒内回焦不重复补拉
        baseBackoffMs: 30_000,
        maxBackoffMs: 1_800_000,
    },
    yeguif: {
        intervalMs: 300_000, // 5 分钟轮询
        startupDelayMs: 2_000,
        minForegroundIntervalMs: 30_000, // 30 秒内回焦不重复补拉
        baseBackoffMs: 15_000,
        maxBackoffMs: 300_000,
    },
    health: {
        intervalMs: 300_000, // 5 分钟轮询
        startupDelayMs: 2_000,
        minForegroundIntervalMs: 30_000,
        baseBackoffMs: 15_000,
        maxBackoffMs: 300_000,
    },
    notequery: {
        intervalMs: 600_000, // 10 分钟轮询
        startupDelayMs: 4_000,
        minForegroundIntervalMs: 30_000,
        baseBackoffMs: 20_000,
        maxBackoffMs: 600_000,
    },
    siplayer: {
        intervalMs: 15_000, // 15 秒采样
        startupDelayMs: 1_000,
        minForegroundIntervalMs: 15_000,
        baseBackoffMs: 5_000,
        maxBackoffMs: 60_000,
    },
    sireader: {
        intervalMs: 0, // 事件驱动
        startupDelayMs: 0,
        minForegroundIntervalMs: 0,
        baseBackoffMs: 5_000,
        maxBackoffMs: 60_000,
    },
};

export interface SourceRuntimeState {
    key: ExternalSourceKey;
    enabled: boolean;
    inFlight: boolean;
    generation: number;
    lastAttemptAt: number;
    lastSuccessAt: number;
    consecutiveFailures: number;
    nextRunAt: number;
}

export function createInitialSourceState(key: ExternalSourceKey, enabled = false): SourceRuntimeState {
    return {
        key,
        enabled,
        inFlight: false,
        generation: 0,
        lastAttemptAt: 0,
        lastSuccessAt: 0,
        consecutiveFailures: 0,
        nextRunAt: 0,
    };
}

/** 计算指数退避毫秒数：base * 2^(failures - 1)，不超过 maxBackoffMs。 */
export function calculateBackoffDelay(failures: number, config: SourceScheduleConfig): number {
    if (!Number.isFinite(failures) || failures <= 0) return 0;
    const exponent = Math.min(failures - 1, 10);
    const calculated = config.baseBackoffMs * Math.pow(2, exponent);
    return Math.min(calculated, config.maxBackoffMs);
}

export interface TriggerEvaluationResult {
    allowed: boolean;
    reasonCode: "ok" | "disabled" | "in-flight" | "paused-background" | "in-backoff" | "foreground-throttled";
    status: SourceSchedulerStatus;
    waitMs?: number;
}

/** 评估特定来源在当前时刻是否允许触发摄取/采样。 */
export function evaluateSourceTrigger(
    state: SourceRuntimeState,
    config: SourceScheduleConfig,
    now: number,
    reason: SourceTriggerReason,
    isVisible: boolean,
): TriggerEvaluationResult {
    if (!state.enabled && reason !== "manual") {
        return {allowed: false, reasonCode: "disabled", status: "disabled"};
    }
    if (state.inFlight) {
        return {allowed: false, reasonCode: "in-flight", status: "running"};
    }
    // 非手动触发时，如果处于后台（文档不可见），暂停轮询以节省电量
    if (!isVisible && reason !== "manual") {
        return {allowed: false, reasonCode: "paused-background", status: "paused-background"};
    }
    // 失败退避判定（手动触发优先放行）
    if (reason !== "manual" && state.consecutiveFailures > 0 && now < state.nextRunAt) {
        return {
            allowed: false,
            reasonCode: "in-backoff",
            status: "backoff",
            waitMs: Math.max(0, state.nextRunAt - now),
        };
    }
    // 回焦补拉节流：如果距离上次尝试或成功过于接近，防抖跳过，避免连续 Alt+Tab 轰炸
    if (reason === "foreground") {
        const lastActionAt = Math.max(state.lastAttemptAt, state.lastSuccessAt);
        if (lastActionAt > 0 && now - lastActionAt < config.minForegroundIntervalMs) {
            return {
                allowed: false,
                reasonCode: "foreground-throttled",
                status: "idle",
                waitMs: config.minForegroundIntervalMs - (now - lastActionAt),
            };
        }
    }
    return {allowed: true, reasonCode: "ok", status: "idle"};
}

export function recordSourceAttempt(state: SourceRuntimeState, now: number): SourceRuntimeState {
    return {
        ...state,
        inFlight: true,
        lastAttemptAt: now,
    };
}

export function recordSourceSuccess(
    state: SourceRuntimeState,
    now: number,
    config: SourceScheduleConfig,
): SourceRuntimeState {
    return {
        ...state,
        inFlight: false,
        lastSuccessAt: now,
        consecutiveFailures: 0,
        nextRunAt: config.intervalMs > 0 ? now + config.intervalMs : 0,
    };
}

export function recordSourceFailure(
    state: SourceRuntimeState,
    now: number,
    config: SourceScheduleConfig,
): SourceRuntimeState {
    const nextFailures = state.consecutiveFailures + 1;
    const delay = calculateBackoffDelay(nextFailures, config);
    return {
        ...state,
        inFlight: false,
        consecutiveFailures: nextFailures,
        nextRunAt: now + delay,
    };
}

export function advanceSourceGeneration(state: SourceRuntimeState): SourceRuntimeState {
    return {
        ...state,
        generation: state.generation + 1,
        inFlight: false,
    };
}

export interface SourceSchedulerSummaryItem {
    key: ExternalSourceKey;
    status: SourceSchedulerStatus;
    generation: number;
    inFlight: boolean;
    consecutiveFailures: number;
    lastAttemptAt: number;
    lastSuccessAt: number;
    nextRunAt: number;
}

export function buildSourceSchedulerSummary(
    states: Readonly<Record<ExternalSourceKey, SourceRuntimeState>>,
    configs: Readonly<Record<ExternalSourceKey, SourceScheduleConfig>>,
    now: number,
    isVisible: boolean,
): SourceSchedulerSummaryItem[] {
    return (Object.keys(states) as ExternalSourceKey[]).map((key) => {
        const state = states[key];
        const config = configs[key];
        const evalResult = evaluateSourceTrigger(state, config, now, "interval", isVisible);
        let derivedStatus: SourceSchedulerStatus = evalResult.status;
        if (state.inFlight) derivedStatus = "running";
        else if (!state.enabled) derivedStatus = "disabled";
        else if (state.consecutiveFailures > 0 && now < state.nextRunAt) derivedStatus = "backoff";
        else if (!isVisible) derivedStatus = "paused-background";
        else derivedStatus = "idle";

        return {
            key,
            status: derivedStatus,
            generation: state.generation,
            inFlight: state.inFlight,
            consecutiveFailures: state.consecutiveFailures,
            lastAttemptAt: state.lastAttemptAt,
            lastSuccessAt: state.lastSuccessAt,
            nextRunAt: state.nextRunAt,
        };
    });
}
