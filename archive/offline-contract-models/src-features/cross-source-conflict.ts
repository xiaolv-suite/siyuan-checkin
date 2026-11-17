/* T-1748：跨来源同项目冲突与合并预览纯模型（纯逻辑、无时钟、确定性）。
   覆盖思阅、思播、微信读书、健康、叶归、笔记推导等全量外部来源，
   识别潜在的重复计量风险（如双分钟来源写同一项目），提供目标项目归集预览，
   坚决坚守“不静默停用、不回溯改写历史、不抹杀事实”三大不变量。 */

export type SourceId = "weread" | "sireader" | "siplayer" | "health" | "yeguif" | "notequery";

export interface SourceBinding {
    readonly source: SourceId;
    readonly itemId: string;
    readonly metric: "minutes" | "steps" | "weight" | "count" | "binary";
    readonly enabled: boolean;
}

export interface HabitItemStub {
    readonly id: string;
    readonly name: string;
    readonly unit: string;
    readonly archived?: boolean;
}

export type ConflictSeverity = "warning_duplicate_risk" | "info_multi_feed";

export interface CrossSourceConflict {
    readonly itemId: string;
    readonly itemName: string;
    readonly metric: string;
    readonly conflictingSources: readonly SourceId[];
    readonly severity: ConflictSeverity;
    readonly hintKey: string;
    readonly recommendationKey: string;
}

export interface ItemFeedMapping {
    readonly itemId: string;
    readonly itemName: string;
    readonly itemUnit: string;
    readonly feedingSources: readonly {
        readonly source: SourceId;
        readonly metric: string;
        readonly enabled: boolean;
    }[];
    readonly hasConflict: boolean;
}

/** 探测全来源同项目重复计量冲突（T-1748）。 */
export function detectCrossSourceConflicts(
    bindings: readonly SourceBinding[],
    items: readonly HabitItemStub[]
): readonly CrossSourceConflict[] {
    const itemMap = new Map<string, HabitItemStub>();
    for (const it of items) {
        itemMap.set(it.id, it);
    }

    // 仅针对启用的来源进行冲突评估
    const enabledBindings = bindings.filter((b) => b.enabled && Boolean(b.itemId));

    // 按 itemId + metric 分组聚合
    const groupKeyToBindings = new Map<string, SourceBinding[]>();
    for (const b of enabledBindings) {
        const key = `${b.itemId}::${b.metric}`;
        const list = groupKeyToBindings.get(key) ?? [];
        list.push(b);
        groupKeyToBindings.set(key, list);
    }

    const conflicts: CrossSourceConflict[] = [];

    for (const [key, group] of groupKeyToBindings.entries()) {
        if (group.length <= 1) continue;

        const [itemId, metric] = key.split("::");
        const item = itemMap.get(itemId);
        const itemName = item?.name ?? itemId;
        const conflictingSources = group.map((g) => g.source);

        // 如果是同为时长单位（minutes），双来源并发容易造成严重虚假时长累加
        const isTimeMetric = metric === "minutes";
        const severity: ConflictSeverity = isTimeMetric ? "warning_duplicate_risk" : "info_multi_feed";
        const hintKey = isTimeMetric ? "set.conflict.duplicateMinutesWarning" : "set.conflict.multiSourceInfo";
        const recommendationKey = isTimeMetric ? "set.conflict.recommendSplitItems" : "set.conflict.recommendConfirmShare";

        conflicts.push({
            itemId,
            itemName,
            metric,
            conflictingSources: Object.freeze(conflictingSources),
            severity,
            hintKey,
            recommendationKey,
        });
    }

    return Object.freeze(conflicts);
}

/** 生成全量目标项目写入归集预览矩阵（T-1748）。 */
export function generateTargetItemFeedMatrix(
    bindings: readonly SourceBinding[],
    items: readonly HabitItemStub[]
): readonly ItemFeedMapping[] {
    const itemMap = new Map<string, HabitItemStub>();
    for (const it of items) {
        itemMap.set(it.id, it);
    }

    const itemFeedMap = new Map<string, { source: SourceId; metric: string; enabled: boolean }[]>();

    for (const b of bindings) {
        if (!b.itemId) continue;
        const feeds = itemFeedMap.get(b.itemId) ?? [];
        feeds.push({ source: b.source, metric: b.metric, enabled: b.enabled });
        itemFeedMap.set(b.itemId, feeds);
    }

    const mappings: ItemFeedMapping[] = [];

    for (const [itemId, feedingSources] of itemFeedMap.entries()) {
        const item = itemMap.get(itemId);
        const activeMinuteFeeds = feedingSources.filter((f) => f.enabled && f.metric === "minutes");
        const hasConflict = activeMinuteFeeds.length > 1;

        mappings.push({
            itemId,
            itemName: item?.name ?? itemId,
            itemUnit: item?.unit ?? "",
            feedingSources: Object.freeze(feedingSources),
            hasConflict,
        });
    }

    return Object.freeze(mappings);
}
