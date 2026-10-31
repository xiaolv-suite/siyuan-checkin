/* T-1749：来源目标候选选择器与大项目集纯模型（纯逻辑、无时钟、确定性）。
   解决前 200 项截断、无单位/可用性提示、第 201 项以后不可见问题；
   提供按单位、可用性、关键字过滤，保留当前已绑定项，
   并在保存前动态复核防跨窗口单位篡改或归档。 */

export interface CandidateItem {
    readonly id: string;
    readonly name: string;
    readonly unit: string;
    readonly archived?: boolean;
}

export type CandidateEligibility =
    | "eligible"             // 符合指标且活跃
    | "retained_binding"     // 当前已绑定（即使归档或指标不符也必须置顶保留）
    | "ineligible_unit"      // 单位不兼容
    | "ineligible_archived"; // 已归档

export interface TargetCandidateEntry {
    readonly item: CandidateItem;
    readonly eligibility: CandidateEligibility;
    readonly isSelectable: boolean;
    readonly reasonKey: string;
}

export interface CandidateQueryOptions {
    readonly requiredUnitKind?: "minutes" | "steps" | "weight" | "binary" | "numeric" | "any";
    readonly selectedId?: string;
    readonly searchQuery?: string;
    readonly limit?: number;
    readonly offset?: number;
}

const MINUTE_UNITS = new Set(["分钟", "min", "mins", "minute", "minutes"]);
const STEPS_UNITS = new Set(["步", "步数", "steps", "step"]);
const WEIGHT_UNITS = new Set(["公斤", "千克", "kg", "斤"]);

export function isUnitCompatibleWithMetric(
    unit: string,
    metric: CandidateQueryOptions["requiredUnitKind"]
): boolean {
    if (!metric || metric === "any") return true;
    const u = (unit || "").trim().toLowerCase();
    if (metric === "minutes") return MINUTE_UNITS.has(u);
    if (metric === "steps") return STEPS_UNITS.has(u);
    if (metric === "weight") return WEIGHT_UNITS.has(u);
    if (metric === "binary") return u === "次" || u === "" || u === "boolean";
    if (metric === "numeric") return !MINUTE_UNITS.has(u);
    return true;
}

/** 投影可选择的项目候选列表，突破 200 项截断限制，支持大项目集（T-1749）。 */
export function projectTargetCandidates(
    allItems: readonly CandidateItem[],
    options: CandidateQueryOptions
): readonly TargetCandidateEntry[] {
    const search = (options.searchQuery || "").trim().toLowerCase();
    const selectedId = options.selectedId;
    const metric = options.requiredUnitKind;

    const results: TargetCandidateEntry[] = [];
    let retainedEntry: TargetCandidateEntry | null = null;

    for (const item of allItems) {
        const isCurrent = Boolean(selectedId && item.id === selectedId);
        const nameMatch = !search || item.name.toLowerCase().includes(search);

        if (isCurrent) {
            retainedEntry = {
                item,
                eligibility: "retained_binding",
                isSelectable: true,
                reasonKey: "set.candidate.retainedBinding",
            };
            continue;
        }

        if (!nameMatch) continue;

        if (item.archived) {
            results.push({
                item,
                eligibility: "ineligible_archived",
                isSelectable: false,
                reasonKey: "set.candidate.archivedItem",
            });
            continue;
        }

        const unitOk = isUnitCompatibleWithMetric(item.unit, metric);
        if (!unitOk) {
            results.push({
                item,
                eligibility: "ineligible_unit",
                isSelectable: false,
                reasonKey: "set.candidate.unitMismatch",
            });
            continue;
        }

        results.push({
            item,
            eligibility: "eligible",
            isSelectable: true,
            reasonKey: "set.candidate.eligible",
        });
    }

    // 排序：符合条件的排前，不符合的排后
    results.sort((a, b) => {
        if (a.isSelectable !== b.isSelectable) {
            return a.isSelectable ? -1 : 1;
        }
        return a.item.name.localeCompare(b.item.name, "zh-CN");
    });

    // 如果有已绑定的项，强制置顶
    const finalList = retainedEntry ? [retainedEntry, ...results] : results;

    // 分页切片（如果传入了 limit）
    if (typeof options.limit === "number" && options.limit > 0) {
        const offset = options.offset ?? 0;
        return Object.freeze(finalList.slice(offset, offset + options.limit));
    }

    return Object.freeze(finalList);
}

export interface TargetPreSaveAudit {
    readonly isSafeToBind: boolean;
    readonly rejectionReason?: "item_missing" | "item_archived" | "unit_incompatible";
}

/** 保存前动态复核：核验目标项目未在其它窗口被改单位或归档（T-1749）。 */
export function auditTargetBeforeSave(
    targetItemId: string,
    requiredMetric: CandidateQueryOptions["requiredUnitKind"],
    currentLatestItems: readonly CandidateItem[]
): TargetPreSaveAudit {
    if (!targetItemId) {
        return { isSafeToBind: true };
    }
    const item = currentLatestItems.find((it) => it.id === targetItemId);
    if (!item) {
        return { isSafeToBind: false, rejectionReason: "item_missing" };
    }
    if (item.archived) {
        return { isSafeToBind: false, rejectionReason: "item_archived" };
    }
    if (!isUnitCompatibleWithMetric(item.unit, requiredMetric)) {
        return { isSafeToBind: false, rejectionReason: "unit_incompatible" };
    }
    return { isSafeToBind: true };
}
