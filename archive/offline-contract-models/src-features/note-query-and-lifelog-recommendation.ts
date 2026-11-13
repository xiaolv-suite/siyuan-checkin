/* T-1746 & T-1747：笔记推导与叶归 LifeLog 映射推荐治理（纯逻辑、无时钟、确定性）。
   1. 笔记推导样例验证原则（T-1746）：无真实可验证样例时坚决不给“推荐已就绪”；
      提供扫描数量、匹配数、忽略数预览，7 字段整体保存边界（D-313）；
   2. 叶归多项目映射建议（T-1747）：基于来源活动名与单位提出逐行建议，
      绝对禁止以唯一同名启发式替代用户显式确认；
      笔记本需用户手工指定；坚守 source + externalRef 幂等与断连保留纪律。 */

export interface NoteQueryPatternSample {
    readonly blockId: string;
    readonly matchedTagOrProperty: string;
    readonly extractedValue: number;
    readonly sampleDate: string;
}

export interface NoteQueryRecommendationDraft {
    readonly notebookId: string;
    readonly docId: string;
    readonly queryMode: "property" | "tag";
    readonly propertyOrTagName: string;
    readonly targetItemId: string;
    readonly targetItemUnit: string;
    readonly sampleMatches: readonly NoteQueryPatternSample[];
}

export interface NoteQueryRecommendationEvaluation {
    readonly isReadyForPreview: boolean;
    readonly estimatedMatchCount: number;
    readonly ignoredCount: number;
    readonly reasonKey: string;
    readonly canSave: boolean;
}

/** 评估笔记推导模式推荐就绪度（T-1746）。 */
export function evaluateNoteQueryRecommendation(
    draft: NoteQueryRecommendationDraft,
    totalScannedBlocks: number
): NoteQueryRecommendationEvaluation {
    if (!draft.notebookId || !draft.docId) {
        return {
            isReadyForPreview: false,
            estimatedMatchCount: 0,
            ignoredCount: 0,
            reasonKey: "set.notequery.missingScope",
            canSave: false,
        };
    }

    if (!draft.propertyOrTagName) {
        return {
            isReadyForPreview: false,
            estimatedMatchCount: 0,
            ignoredCount: 0,
            reasonKey: "set.notequery.missingPattern",
            canSave: false,
        };
    }

    // 关键红线：无真实匹配样例坚决不能判定为就绪
    if (!draft.sampleMatches || draft.sampleMatches.length === 0) {
        return {
            isReadyForPreview: false,
            estimatedMatchCount: 0,
            ignoredCount: totalScannedBlocks,
            reasonKey: "set.notequery.noVerifiableSamples",
            canSave: false,
        };
    }

    const estimatedMatchCount = draft.sampleMatches.length;
    const ignoredCount = Math.max(0, totalScannedBlocks - estimatedMatchCount);

    return {
        isReadyForPreview: true,
        estimatedMatchCount,
        ignoredCount,
        reasonKey: "set.notequery.readyWithPreview",
        canSave: Boolean(draft.targetItemId),
    };
}

// === T-1747 叶归 LifeLog 映射建议模型 ===

export interface LifeLogActivitySample {
    readonly activityName: string;
    readonly durationMinutes: number;
    readonly occurredAt: string;
}

export interface LifeLogMappingProposal {
    readonly activityName: string;
    readonly proposedItemId: string;
    readonly proposedItemName: string;
    readonly targetUnit: string;
    readonly requiresConfirmation: boolean;
    readonly confidence: "high" | "medium" | "low";
}

/** 基于活动样本生成叶归映射建议（T-1747）。
 *  红线：禁止同名启发式直接应用，所有映射均需 requiresConfirmation = true。 */
export function deriveLifeLogMappingProposals(
    samples: readonly LifeLogActivitySample[],
    availableItems: readonly { id: string; name: string; unit: string; archived?: boolean }[]
): readonly LifeLogMappingProposal[] {
    const activeMinuteItems = availableItems.filter(
        (it) => !it.archived && (it.unit === "分钟" || it.unit.toLowerCase().includes("min"))
    );

    const proposals: LifeLogMappingProposal[] = [];
    const seenActivities = new Set<string>();

    for (const sample of samples) {
        if (seenActivities.has(sample.activityName)) continue;
        seenActivities.add(sample.activityName);

        // 查找完全同名项
        const exactMatch = activeMinuteItems.find((it) => it.name === sample.activityName);
        if (exactMatch) {
            proposals.push({
                activityName: sample.activityName,
                proposedItemId: exactMatch.id,
                proposedItemName: exactMatch.name,
                targetUnit: exactMatch.unit,
                requiresConfirmation: true, // 核心守门：必须人工确认！
                confidence: "high",
            });
            continue;
        }

        // 查找包含关系的项
        const partialMatch = activeMinuteItems.find(
            (it) => it.name.includes(sample.activityName) || sample.activityName.includes(it.name)
        );
        if (partialMatch) {
            proposals.push({
                activityName: sample.activityName,
                proposedItemId: partialMatch.id,
                proposedItemName: partialMatch.name,
                targetUnit: partialMatch.unit,
                requiresConfirmation: true,
                confidence: "medium",
            });
            continue;
        }

        // 默认回落到第一个分钟习惯（如果存在），低置信度
        if (activeMinuteItems.length > 0) {
            proposals.push({
                activityName: sample.activityName,
                proposedItemId: activeMinuteItems[0].id,
                proposedItemName: activeMinuteItems[0].name,
                targetUnit: activeMinuteItems[0].unit,
                requiresConfirmation: true,
                confidence: "low",
            });
        }
    }

    return Object.freeze(proposals);
}
