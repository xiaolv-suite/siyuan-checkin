/* T-1750 & T-1751：文档输出建议与编辑器模板联动规则收敛（纯逻辑、无时钟、确定性）。
   1. 文档输出四大安全维度（T-1750）：写什么、何时写、写到哪里、最近是否成功；
      空目标只给候选不自动创建文档，换绑保留历史，自动写入开关严禁由推荐私自开启；
   2. 编辑器模板联动与设置推荐单一事实源（T-1751）：统一候选过滤规则与冲突检测，
      避免编辑器建议与设置页建议出现两套真值。 */

export type DocumentOutputType = "diary_report" | "summary_resident" | "journal_questionnaire";

export interface DocumentOutputContext {
    readonly outputType: DocumentOutputType;
    readonly targetDocId?: string;
    readonly isTargetDocAccessible?: boolean;
    readonly lastWriteSuccess?: boolean;
    readonly lastWriteError?: string;
    readonly availableDocCandidates: readonly { id: string; title: string }[];
}

export interface DocumentOutputRecommendation {
    readonly outputType: DocumentOutputType;
    readonly canRecommendAutoEnable: boolean; // 恒为 false！推荐绝不私自开启开关
    readonly status: "ready" | "needs_target_selection" | "recent_failed";
    readonly targetDocId: string;
    readonly safeActionGuidance: string;
    readonly candidateDocs: readonly { id: string; title: string }[];
}

/** 评估文档输出建议安全性（T-1750）。 */
export function evaluateDocumentOutputRecommendation(
    context: DocumentOutputContext
): DocumentOutputRecommendation {
    const hasAccessibleDoc = Boolean(context.targetDocId && context.isTargetDocAccessible);

    if (!hasAccessibleDoc) {
        return {
            outputType: context.outputType,
            canRecommendAutoEnable: false, // 核心守门：空目标禁止开启
            status: "needs_target_selection",
            targetDocId: "",
            safeActionGuidance: "set.doc.selectExistingDocFirst",
            candidateDocs: context.availableDocCandidates,
        };
    }

    if (context.lastWriteSuccess === false) {
        return {
            outputType: context.outputType,
            canRecommendAutoEnable: false,
            status: "recent_failed",
            targetDocId: context.targetDocId!,
            safeActionGuidance: "set.doc.recentWriteFailedCheckPermissions",
            candidateDocs: context.availableDocCandidates,
        };
    }

    return {
        outputType: context.outputType,
        canRecommendAutoEnable: false, // 即使就绪，开启总开关仍需用户手动切换
        status: "ready",
        targetDocId: context.targetDocId!,
        safeActionGuidance: "set.doc.readyToConfigureOutput",
        candidateDocs: context.availableDocCandidates,
    };
}

// === T-1751 模板联动与设置推荐一致性校验 ===

export interface TemplateLinkageRecommendation {
    readonly templateSlug: string;
    readonly suggestedSource: "sireader" | "weread" | "health" | "docktomato";
    readonly targetUnit: string;
    readonly requiresMinutes: boolean;
}

/** 校验编辑器模板联动建议与设置侧推荐的一致性，防止两套真值（T-1751）。 */
export function validateTemplateAndSettingsLinkageParity(
    linkage: TemplateLinkageRecommendation,
    proposedUnit: string
): { isConsistent: boolean; reason?: string } {
    if (linkage.requiresMinutes) {
        const isMin = proposedUnit === "分钟" || proposedUnit.toLowerCase().includes("min");
        if (!isMin) {
            return {
                isConsistent: false,
                reason: "unit_conflict_template_requires_minutes",
            };
        }
    }
    return { isConsistent: true };
}
