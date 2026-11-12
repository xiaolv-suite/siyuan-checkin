/* T-1668：每 root 增量失效与渲染预算决策器（纯模型面）。
   定义打卡、撤销、来源摄取、事项与偏好变更在各表面的最小失效域，
   保证活动输入与表单草稿不被后台重绘收起，无隐式时钟，受 CLOCK_FREE_MODULES 保护。 */

import type {PageId} from "../types";

export type InvalidationReason =
    | "event-recorded"
    | "event-undone"
    | "source-ingest"
    | "occasion-mutation"
    | "preference-update"
    | "diagnostics-update";

export type RootRenderAction =
    | "immediate-render"
    | "deferred-input"
    | "skip-editor-draft"
    | "no-op";

export interface RootStateContext {
    page: PageId;
    hasActiveInput?: boolean;
    hasEditorDraft?: boolean;
    hasOccasionDraft?: boolean;
    isFocusedItemChanged?: boolean;
}

export interface InvalidationDecision {
    rootAction: RootRenderAction;
    reason: string;
}

/** T-1668：计算单 surface 在特定变更事件下的最小失效决策。 */
export function evaluateRootInvalidation(
    reason: InvalidationReason,
    context: RootStateContext,
): InvalidationDecision {
    // 1. 编辑器草稿绝对保护不变量：任何后台变更绝不重绘正在编辑中的 editor 表面
    if (context.page === "editor") {
        return {
            rootAction: "skip-editor-draft",
            reason: "Editor surface is protected from background mutations to preserve form drafts",
        };
    }

    // 2. 事项页面在用户正在编辑事项草稿时免扰
    if (context.page === "occasions" && context.hasOccasionDraft && reason !== "occasion-mutation") {
        return {
            rootAction: "no-op",
            reason: "Occasion form draft in progress; non-occasion background update skipped",
        };
    }

    // 3. 用户正在输入中（搜索框、备注框、自定义输入），延迟到失焦后刷新
    if (context.hasActiveInput) {
        return {
            rootAction: "deferred-input",
            reason: "Active input element focused; render deferred until focusout",
        };
    }

    // 4. 来源心跳/只读诊断变更：仅对设置页面有效，其他工作表面免于无意义重绘
    if (reason === "diagnostics-update" || reason === "source-ingest") {
        if (context.page === "settings") {
            return {
                rootAction: "immediate-render",
                reason: "Settings page needs status refresh for background ingest/diagnostics",
            };
        }
        return {
            rootAction: "no-op",
            reason: "Non-settings surface does not require redraw on ingest/diagnostic heartbeat",
        };
    }

    // 5. 事项变异：对 Review/Archived 等历史分析页面无须全量重绘
    if (reason === "occasion-mutation") {
        if (context.page === "occasions" || context.page === "today") {
            return {
                rootAction: "immediate-render",
                reason: "Today and Occasions surfaces reflect occasion updates directly",
            };
        }
        return {
            rootAction: "no-op",
            reason: "Review/Archived/Settings do not display live occasions; skipping redraw",
        };
    }

    // 6. 核心事件记录或撤销 (event-recorded / event-undone)
    if (reason === "event-recorded" || reason === "event-undone") {
        if (context.page === "today" || context.page === "review") {
            return {
                rootAction: "immediate-render",
                reason: "Active check-in surfaces update immediately on event mutation",
            };
        }
        if (context.page === "insights") {
            // 只有当变更影响到当前洞察项目时才立即重绘
            if (context.isFocusedItemChanged !== false) {
                return {
                    rootAction: "immediate-render",
                    reason: "Insights surface reflects mutated item analytics",
                };
            }
            return {
                rootAction: "no-op",
                reason: "Insights item unaffected by this event mutation",
            };
        }
    }

    // 默认即时渲染
    return {
        rootAction: "immediate-render",
        reason: "Standard surface render",
    };
}

/** T-1668：单帧长任务预算监控（纯计算辅助）。
    渲染耗时大于 16.6ms 时标记需要增量切片，大于 50ms 标记为长任务。 */
export function evaluateRenderBudget(elapsedMs: number): {
    withinFrameBudget: boolean;
    isLongTask: boolean;
    rating: "optimal" | "acceptable" | "degraded";
} {
    const isLongTask = elapsedMs > 50;
    const withinFrameBudget = elapsedMs <= 16.6;
    const rating = withinFrameBudget ? "optimal" : isLongTask ? "degraded" : "acceptable";
    return {withinFrameBudget, isLongTask, rating};
}
