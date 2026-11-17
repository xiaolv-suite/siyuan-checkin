/* T-1671：Task Horizon Canonical Source 与过期 Fallback 纯模型（研究与规则收敛）。
   定义单一事实源校验、缓存 TTL 与失效规则、连接状态与用户可解释性（waiting/ready/fallback），
   无隐式时钟，受 CLOCK_FREE_MODULES 保护。 */

export type TaskHorizonConnectionState =
    | "waiting"
    | "experimental-ready"
    | "disconnected-fallback"
    | "incompatible-version";

export interface TaskHorizonStatusInput {
    isApiPresent: boolean;
    protocol?: string;
    apiVersion?: number;
    isReady: boolean;
    hasCalendarCapability: boolean;
    hasEventsRecordCapability: boolean;
    isDisposed?: boolean;
}

export interface TaskHorizonStatusReport {
    state: TaskHorizonConnectionState;
    userExplanation: string;
    canRenderCalendarLayer: boolean;
    canRecordTaskCompletion: boolean;
}

/** T-1671：评估 Task Horizon 对接连接状态与用户可解释说明。 */
export function evaluateTaskHorizonConnection(input: TaskHorizonStatusInput): TaskHorizonStatusReport {
    if (!input.isApiPresent || input.isDisposed) {
        return {
            state: "disconnected-fallback",
            userExplanation: "打卡插件未运行或服务已断开，日历图层已安全隐藏，严禁展示过期脏缓存",
            canRenderCalendarLayer: false,
            canRecordTaskCompletion: false,
        };
    }

    if (input.protocol !== "siyuan-checkin" || (input.apiVersion !== undefined && input.apiVersion < 5)) {
        return {
            state: "incompatible-version",
            userExplanation: "打卡插件版本不兼容（要求 API v5 且支持 calendar.read）",
            canRenderCalendarLayer: false,
            canRecordTaskCompletion: false,
        };
    }

    if (!input.isReady) {
        return {
            state: "waiting",
            userExplanation: "等待小驴打卡服务初始化就绪...",
            canRenderCalendarLayer: false,
            canRecordTaskCompletion: false,
        };
    }

    return {
        state: "experimental-ready",
        userExplanation: "小驴打卡服务已连接（实验性只读日历图层就绪）",
        canRenderCalendarLayer: input.hasCalendarCapability,
        canRecordTaskCompletion: input.hasEventsRecordCapability,
    };
}

export type TaskHorizonBindingMode = "checkbox-task" | "checkin-history" | "none";

export interface CanonicalSourceValidation {
    valid: boolean;
    conflictReason?: string;
}

/** T-1671：单一 Canonical Source（真实数据事实源）约束校验。
    同一个打卡项在同一时刻只能绑定一种写入通道，严禁普通任务复选框与内部打卡循环并发双写。 */
export function validateTaskHorizonCanonicalSource(
    itemBindingMode: TaskHorizonBindingMode,
    requestedAction: "record-checkbox-task" | "sync-checkin-history",
): CanonicalSourceValidation {
    if (itemBindingMode === "none") {
        return {valid: true};
    }

    if (itemBindingMode === "checkbox-task" && requestedAction === "sync-checkin-history") {
        return {
            valid: false,
            conflictReason: "该打卡项目已绑定普通任务完成回写，严禁同时作为 Task Horizon 打卡循环同步源（防止双向循环冲突）",
        };
    }

    if (itemBindingMode === "checkin-history" && requestedAction === "record-checkbox-task") {
        return {
            valid: false,
            conflictReason: "该打卡项目已绑定 Task Horizon 内部打卡循环，严禁同时接收普通任务复选框回写（防止重复入账）",
        };
    }

    return {valid: true};
}

export const TASK_HORIZON_PROJECTION_TTL_MS = 5 * 60 * 1000; // 5 分钟安全 TTL

export interface ProjectionCacheMetadata {
    cachedAtMs: number;
    versionSequence: number;
    projectedRange: {startDate: string; endDateExclusive: string};
}

/** T-1671：基于 TTL 与版本序列号判定日历投影缓存是否已失效。 */
export function isProjectionCacheStale(
    cacheMeta: ProjectionCacheMetadata,
    currentTimestampMs: number,
    currentVersionSequence: number,
): boolean {
    // 1. 如果版本序列号已推进（发生过数据写入/删除/远端变更），缓存立即失效
    if (currentVersionSequence !== cacheMeta.versionSequence) {
        return true;
    }

    // 2. 如果超过 5 分钟安全 TTL，强制失效重取
    if (currentTimestampMs - cacheMeta.cachedAtMs > TASK_HORIZON_PROJECTION_TTL_MS) {
        return true;
    }

    // 3. 时间倒流防御
    if (currentTimestampMs < cacheMeta.cachedAtMs) {
        return true;
    }

    return false;
}
