/* T-1778 & T-1788：全页面视觉与操作语义复核及动态状态验收纯模型（D-639）。
   规范全页面主次动作、状态、空态、卡片密度、焦点与回链，
   以及 loading、error、slow-source、empty、长字段等五大动态状态的韧性边界。
   纯函数，无隐式时钟，受 CLOCK_FREE_MODULES 保护。 */

import type {PageId} from "../types";

export type SurfaceFormFactor = "tab" | "dock" | "dialog" | "block";

/** T-1778：页面级语义检查上下文。 */
export interface PageSemanticContext {
    page: PageId;
    formFactor: SurfaceFormFactor;
    width: number;
    hasPrimaryAction: boolean;
    hasEmptyFallback: boolean;
    hasReturnNavigation: boolean;
    hasSearchOrFilter: boolean;
    hasA11yLabel: boolean;
}

export interface PageSemanticAuditResult {
    page: PageId;
    isCompliant: boolean;
    primaryActionLabel: string;
    secondaryActions: string[];
    emptyStateAction: string;
    missingGuards: string[];
}

/** T-1778：全页面主动作与次动作白名单登记表。 */
export const PAGE_SEMANTIC_DEFINITIONS: Readonly<Record<PageId, {
    primaryAction: string;
    secondaryActions: string[];
    emptyAction: string;
    requiresReturnTo: boolean;
}>> = Object.freeze({
    today: {
        primaryAction: "item.checkin",
        secondaryActions: ["item.more", "today.search", "today.filter", "today.organize"],
        emptyAction: "today.newHabit",
        requiresReturnTo: false,
    },
    review: {
        primaryAction: "review.rangeSelect",
        secondaryActions: ["review.copyReport", "review.workspaceToggle", "review.filter"],
        emptyAction: "review.refresh",
        requiresReturnTo: false,
    },
    insights: {
        primaryAction: "insights.drilldown",
        secondaryActions: ["insights.share", "insights.rangeToggle", "insights.exportCsv"],
        emptyAction: "insights.back",
        requiresReturnTo: true,
    },
    editor: {
        primaryAction: "editor.save",
        secondaryActions: ["editor.cancel", "editor.applyTemplate", "editor.createAnchor"],
        emptyAction: "editor.reset",
        requiresReturnTo: true,
    },
    occasions: {
        primaryAction: "occ.markDone",
        secondaryActions: ["occ.add", "occ.filter", "occ.sort", "occ.reschedule", "occ.toggle"],
        emptyAction: "occ.add",
        requiresReturnTo: false,
    },
    archived: {
        primaryAction: "archived.restore",
        secondaryActions: ["archived.search", "archived.permanentDelete", "archived.back"],
        emptyAction: "archived.back",
        requiresReturnTo: true,
    },
    settings: {
        primaryAction: "settings.save",
        secondaryActions: ["settings.search", "settings.checkBindings", "settings.exportBackup"],
        emptyAction: "settings.locate",
        requiresReturnTo: false,
    },
    more: {
        primaryAction: "more.navigate",
        secondaryActions: ["more.settings", "more.archived", "more.about"],
        emptyAction: "more.back",
        requiresReturnTo: false,
    },
});

/** T-1778：评估单页面视觉与操作语义完整性。 */
export function auditPageSemanticIntegrity(context: PageSemanticContext): PageSemanticAuditResult {
    const definition = PAGE_SEMANTIC_DEFINITIONS[context.page];
    const missing: string[] = [];

    if (!context.hasPrimaryAction) {
        missing.push("primary-action-missing");
    }
    if (!context.hasEmptyFallback) {
        missing.push("empty-fallback-missing");
    }
    if (definition.requiresReturnTo && !context.hasReturnNavigation) {
        missing.push("return-navigation-missing");
    }
    if (!context.hasA11yLabel) {
        missing.push("a11y-label-missing");
    }

    return {
        page: context.page,
        isCompliant: missing.length === 0,
        primaryActionLabel: definition.primaryAction,
        secondaryActions: [...definition.secondaryActions],
        emptyStateAction: definition.emptyAction,
        missingGuards: missing,
    };
}

/** T-1788：动态异常态与慢响应韧性评估。 */
export type DynamicStateType = "loading" | "error" | "slow-source" | "empty" | "long-text";

export interface DynamicStateContext {
    state: DynamicStateType;
    hasBusyIndicator?: boolean;       // aria-busy
    hasErrorMessage?: boolean;        // localizable error
    hasRetryAction?: boolean;         // retry button
    hasUnbrokenWordWrap?: boolean;    // overflow-wrap: anywhere
    isContentPreserved?: boolean;     // draft preservation on failure
}

export interface DynamicStateResilienceResult {
    state: DynamicStateType;
    isResilient: boolean;
    requiredAttributessMet: boolean;
    remediationHints: string[];
}

/** T-1788：评估动态状态在极端条件下的健壮性与无障碍韧性。
    规约：
    1. loading 必须暴露 aria-busy="true"；
    2. error 必须同时包含可读错误信息与重试/回滚操作，且表单草稿不能丢失；
    3. slow-source 必须保留已入途凭据，超时受限，不吞操作；
    4. empty 必须包含引导动作或清除筛选动作；
    5. long-text 必须具备全词断行（overflow-wrap: anywhere），400% 缩放下无横向撕裂。 */
export function evaluateDynamicStateResilience(context: DynamicStateContext): DynamicStateResilienceResult {
    const hints: string[] = [];

    switch (context.state) {
        case "loading":
            if (!context.hasBusyIndicator) {
                hints.push("Missing aria-busy indicator for accessible screen-reader announcement.");
            }
            break;
        case "error":
            if (!context.hasErrorMessage) {
                hints.push("Error state missing user-facing diagnostic copy.");
            }
            if (!context.hasRetryAction) {
                hints.push("Error state missing actionable retry or rollback trigger.");
            }
            if (context.isContentPreserved === false) {
                hints.push("User draft must be preserved upon save or mutation failure.");
            }
            break;
        case "slow-source":
            if (!context.hasBusyIndicator) {
                hints.push("In-flight source request must indicate pending state to prevent duplicate submissions.");
            }
            break;
        case "empty":
            if (!context.hasRetryAction) {
                hints.push("Empty view must provide an actionable primary creation or filter-reset button.");
            }
            break;
        case "long-text":
            if (!context.hasUnbrokenWordWrap) {
                hints.push("Long text blocks require overflow-wrap: anywhere to prevent 400% zoom overflow.");
            }
            break;
    }

    return {
        state: context.state,
        isResilient: hints.length === 0,
        requiredAttributessMet: hints.length === 0,
        remediationHints: hints,
    };
}
