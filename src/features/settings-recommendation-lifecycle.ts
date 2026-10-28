/* T-1739 & T-1740：推荐版本生命周期、过期判定与总览“建议/待确认/需修复”三态分类模型（纯逻辑、无时钟、确定性）。
   解决项目修订/文档移动/Key 清除后旧推荐标过期、用户手动草稿保留、
   升级不强加新值；以及设置总览三态严密分流，坚决禁止将“未启用”来源误判为错误。 */

export const RECOMMENDATION_LIFECYCLE_VERSION = 2;

export type RecommendationLifecycleStatus =
    | "active"        // 当前有效，待用户审阅
    | "stale"         // 已过期（因依赖项目变动、归档或配置重置）
    | "dismissed"     // 用户本次会话关闭
    | "opted_out"     // 用户标记“不再推荐”
    | "applied";      // 用户已显式采纳并保存

export interface RecommendationSnapshot {
    readonly recommendationId: string;
    readonly targetKey: string;
    readonly boundItemId?: string;
    readonly boundItemUnit?: string;
    readonly boundDocId?: string;
    readonly proposedValue: unknown;
    readonly generatedAtVersion: number;
    readonly isOptedOut?: boolean;
    readonly isDismissed?: boolean;
}

export interface EnvironmentSnapshot {
    readonly items: readonly { id: string; name: string; unit: string; archived?: boolean }[];
    readonly accessibleDocIds: readonly string[];
    readonly hasCredential?: boolean;
    readonly userDraftValue?: unknown;
}

export interface StalenessEvaluationResult {
    readonly status: RecommendationLifecycleStatus;
    readonly isStale: boolean;
    readonly reason?: string;
    readonly preserveUserDraft: boolean;
}

/** 评估推荐项的新鲜度与有效性（T-1739）。 */
export function evaluateRecommendationStaleness(
    snapshot: RecommendationSnapshot,
    currentEnv: EnvironmentSnapshot
): StalenessEvaluationResult {
    // 1. 用户显式 opt-out 或 dismissed 状态优先尊重
    if (snapshot.isOptedOut) {
        return { status: "opted_out", isStale: false, preserveUserDraft: true };
    }
    if (snapshot.isDismissed) {
        return { status: "dismissed", isStale: false, preserveUserDraft: true };
    }

    // 2. 用户如果已经进行了手动填写草稿，必须绝对保护用户草稿
    const hasManualDraft = currentEnv.userDraftValue !== undefined && currentEnv.userDraftValue !== null && currentEnv.userDraftValue !== "";
    const preserveUserDraft = hasManualDraft;

    // 3. 关联的打卡项状态检查
    if (snapshot.boundItemId) {
        const item = currentEnv.items.find((it) => it.id === snapshot.boundItemId);
        if (!item) {
            return {
                status: "stale",
                isStale: true,
                reason: "item_deleted",
                preserveUserDraft,
            };
        }
        if (item.archived) {
            return {
                status: "stale",
                isStale: true,
                reason: "item_archived",
                preserveUserDraft,
            };
        }
        if (snapshot.boundItemUnit && item.unit !== snapshot.boundItemUnit) {
            return {
                status: "stale",
                isStale: true,
                reason: "item_unit_revised",
                preserveUserDraft,
            };
        }
    }

    // 4. 关联的目标文档访问检查
    if (snapshot.boundDocId) {
        if (!currentEnv.accessibleDocIds.includes(snapshot.boundDocId)) {
            return {
                status: "stale",
                isStale: true,
                reason: "target_doc_unreachable",
                preserveUserDraft,
            };
        }
    }

    return {
        status: "active",
        isStale: false,
        preserveUserDraft,
    };
}

// === T-1740 设置总览“建议 / 待确认 / 需修复”三态模型 ===

export type OverviewTriState = "suggested" | "pending_confirmation" | "requires_fix";

export interface SettingsOverviewItem {
    readonly id: string;
    readonly category: OverviewTriState;
    readonly titleKey: string;
    readonly description: string;
    readonly targetSelector?: string;
    readonly actionLabelKey?: string;
    readonly isBlocking: boolean;
}

export interface RawOverviewDiagnosticInput {
    readonly unconfiguredSources?: readonly string[]; // 未启用的外部来源（中性！）
    readonly failedWriteSources?: readonly { source: string; error: string }[]; // 真实写入失败（需修复）
    readonly invalidKeys?: readonly string[]; // 凭据错误（需修复）
    readonly unreachableDocs?: readonly string[]; // 目标文档丢失（需修复）
    readonly pendingDraftCount?: number; // 未保存草稿（待确认）
    readonly importConflictsPending?: boolean; // 导入冲突待确认（待确认）
    readonly optionalSuggestions?: readonly { key: string; hintKey: string; selector: string }[]; // 可选改善（建议）
}

/** 将设置页问题与活动严格分流为三态（T-1740）。
 *  红线原则：未启用的外部来源是中性关闭状态，绝对禁止误归入 requires_fix！ */
export function categorizeSettingsOverviewItems(
    input: RawOverviewDiagnosticInput
): readonly SettingsOverviewItem[] {
    const items: SettingsOverviewItem[] = [];

    // 1. requires_fix (需修复：真实错误/阻塞)
    if (input.failedWriteSources) {
        for (const failure of input.failedWriteSources) {
            items.push({
                id: `fix-source-${failure.source}`,
                category: "requires_fix",
                titleKey: "set.overview.fix.writeFailed",
                description: `${failure.source}: ${failure.error}`,
                targetSelector: `[data-source-panel='${failure.source}']`,
                actionLabelKey: "common.retry",
                isBlocking: true,
            });
        }
    }
    if (input.invalidKeys) {
        for (const key of input.invalidKeys) {
            items.push({
                id: `fix-key-${key}`,
                category: "requires_fix",
                titleKey: "set.overview.fix.invalidKey",
                description: `Credential rejected for ${key}`,
                targetSelector: `[data-${key}-key]`,
                actionLabelKey: "bind.locate",
                isBlocking: true,
            });
        }
    }
    if (input.unreachableDocs) {
        for (const doc of input.unreachableDocs) {
            items.push({
                id: `fix-doc-${doc}`,
                category: "requires_fix",
                titleKey: "set.overview.fix.docUnreachable",
                description: `Target document ${doc} unreachable`,
                targetSelector: "[data-journal-target-doc]",
                actionLabelKey: "bind.locate",
                isBlocking: true,
            });
        }
    }

    // 2. pending_confirmation (待确认：草稿/冲突)
    if (input.pendingDraftCount && input.pendingDraftCount > 0) {
        items.push({
            id: "pending-drafts",
            category: "pending_confirmation",
            titleKey: "set.overview.pending.drafts",
            description: `${input.pendingDraftCount} unsaved configuration drafts`,
            targetSelector: "[data-settings-change-list]",
            actionLabelKey: "set.changeSaveAll",
            isBlocking: false,
        });
    }
    if (input.importConflictsPending) {
        items.push({
            id: "pending-conflicts",
            category: "pending_confirmation",
            titleKey: "set.overview.pending.conflicts",
            description: "Import name conflicts awaiting resolution",
            targetSelector: "[data-import-conflict-panel]",
            actionLabelKey: "set.importConflictConfirm",
            isBlocking: false,
        });
    }

    // 3. suggested (可选改善：中性优化方案)
    if (input.optionalSuggestions) {
        for (const sug of input.optionalSuggestions) {
            items.push({
                id: `sug-${sug.key}`,
                category: "suggested",
                titleKey: "set.overview.sug.title",
                description: sug.hintKey,
                targetSelector: sug.selector,
                actionLabelKey: "set.recApply",
                isBlocking: false,
            });
        }
    }

    // 注意：input.unconfiguredSources 纯粹记录，绝不生成 requires_fix！
    return Object.freeze(items);
}
