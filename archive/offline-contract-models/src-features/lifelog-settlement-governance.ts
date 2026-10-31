/* T-1614：LifeLog 多项目映射与项目级时长结算治理纯模型（纯逻辑、无时钟、确定性）。
   解决：
   1. 静默截断 50 条映射问题：提供透明容量（上限 200 条）与超限显式告警；
   2. 映射有效性状态机：重复来源、目标不存在、非分钟单位、已归档；
   3. 源段时间（sourceMoment）与摄取时刻（ingestedAt）双轨解耦，防止时间轴被轮询时刻污染；
   4. 多源映射归集与坚守“不回溯改写历史事件”红线。 */

export interface YeguifMappingRule {
    readonly sourceActivity: string;
    readonly targetItemId: string;
    readonly targetUnit?: string;
}

export type MappingRuleValidationCode =
    | "valid"
    | "duplicate_source"
    | "target_missing"
    | "target_archived"
    | "unit_incompatible";

export interface ValidatedMappingRule {
    readonly rule: YeguifMappingRule;
    readonly code: MappingRuleValidationCode;
    readonly isValid: boolean;
    readonly reasonKey: string;
}

export interface MappingCollectionAudit {
    readonly validatedRules: readonly ValidatedMappingRule[];
    readonly totalCount: number;
    readonly validCount: number;
    readonly hasDuplicates: boolean;
    readonly isOverCapacity: boolean;
    readonly capacityLimit: number;
}

export const YEGUIF_MAPPING_CAPACITY_LIMIT = 200;

/** 审核并规范化叶归多项目映射表，消除静默截断（T-1614）。 */
export function auditYeguifMappingCollection(
    rawRules: readonly YeguifMappingRule[],
    availableItems: readonly { id: string; name: string; unit: string; archived?: boolean }[]
): MappingCollectionAudit {
    const itemMap = new Map(availableItems.map((it) => [it.id, it]));
    const seenActivities = new Set<string>();
    const duplicateActivities = new Set<string>();

    for (const r of rawRules) {
        const act = r.sourceActivity.trim();
        if (seenActivities.has(act)) {
            duplicateActivities.add(act);
        }
        seenActivities.add(act);
    }

    const validated: ValidatedMappingRule[] = [];

    for (const r of rawRules) {
        const act = r.sourceActivity.trim();
        if (duplicateActivities.has(act)) {
            validated.push({
                rule: r,
                code: "duplicate_source",
                isValid: false,
                reasonKey: "set.yeguif.duplicateSourceActivity",
            });
            continue;
        }

        const item = itemMap.get(r.targetItemId);
        if (!item) {
            validated.push({
                rule: r,
                code: "target_missing",
                isValid: false,
                reasonKey: "set.yeguif.targetItemMissing",
            });
            continue;
        }

        if (item.archived) {
            validated.push({
                rule: r,
                code: "target_archived",
                isValid: false,
                reasonKey: "set.yeguif.targetItemArchived",
            });
            continue;
        }

        const unit = (item.unit || "").trim().toLowerCase();
        const isMinute = unit === "分钟" || unit.includes("min");
        if (!isMinute) {
            validated.push({
                rule: r,
                code: "unit_incompatible",
                isValid: false,
                reasonKey: "set.yeguif.targetUnitMustBeMinutes",
            });
            continue;
        }

        validated.push({
            rule: { ...r, targetUnit: item.unit },
            code: "valid",
            isValid: true,
            reasonKey: "set.yeguif.mappingValid",
        });
    }

    const totalCount = rawRules.length;
    const validCount = validated.filter((v) => v.isValid).length;
    const isOverCapacity = totalCount > YEGUIF_MAPPING_CAPACITY_LIMIT;

    return {
        validatedRules: Object.freeze(validated),
        totalCount,
        validCount,
        hasDuplicates: duplicateActivities.size > 0,
        isOverCapacity,
        capacityLimit: YEGUIF_MAPPING_CAPACITY_LIMIT,
    };
}

// === 源段时间 vs 轮询摄取时间双轨时间轴模型 ===

export interface LifelogSettledEntry {
    readonly externalRef: string;
    readonly targetItemId: string;
    readonly durationMinutes: number;
    readonly sourceStartMinute: string; // "08:30" 真实活动开始时间
    readonly ingestedAt: string;        // "2026-10-29T12:05:00.000Z" 轮询拉取时刻
}

/** 计算用于时间轴呈现的最佳排序时间戳，杜绝被轮询时刻污染（T-1614）。 */
export function resolveLifelogTimelineDisplayMoment(
    entry: LifelogSettledEntry,
    localDate: string
): { displayTime: string; isoMoment: string } {
    if (entry.sourceStartMinute && /^\d{2}:\d{2}$/.test(entry.sourceStartMinute)) {
        return {
            displayTime: entry.sourceStartMinute,
            isoMoment: `${localDate}T${entry.sourceStartMinute}:00.000Z`,
        };
    }
    // 回退到摄取时刻
    const fallbackTime = entry.ingestedAt.slice(11, 16);
    return {
        displayTime: fallbackTime,
        isoMoment: entry.ingestedAt,
    };
}
