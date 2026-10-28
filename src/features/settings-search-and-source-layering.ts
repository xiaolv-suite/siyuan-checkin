/* T-1757 & T-1758：来源卡四轴状态去重、动作词消歧与设置元数据精准搜索（纯逻辑、无时钟、确定性）。
   1. 确立来源状态四轴正交解耦（配置态、运行态、今日活动、故障状态），消除首屏徽标堆叠（T-1757）；
   2. 确立 6 大来源专属动作动词消歧规范（拉取/读取/采样/探测/同步/推导）；
   3. 基于 T-1733 元数据构建设置精准搜索索引（字段/来源/动作/路径面包屑导航），支持 Enter 直接聚焦与回跳（T-1758）。 */

import { SETTINGS_RECOMMENDATION_REGISTRY, type SettingsFieldRecommendationDescriptor } from "./settings-recommendation-governance";

// === T-1757 来源卡四轴正交状态与动作消歧 ===

export interface SourceStatusAxes {
    readonly configState: "unconfigured" | "configured";
    readonly runtimeState: "disabled" | "running" | "idle";
    readonly activityOutcome: "has_records_today" | "no_records_today";
    readonly problemState: "healthy" | "read_failed" | "write_failed" | "credential_invalid";
}

export type SourceActionVerb =
    | "weread_pull"       // 微信读书：立即拉取
    | "sireader_read"     // 思阅：立即读取
    | "siplayer_sample"   // 思播：立即采样
    | "health_probe"      // 健康：立即探测
    | "yeguif_sync"       // 叶归：立即同步
    | "notequery_derive"; // 笔记推导：立即推导

export const SOURCE_ACTION_VERBS: Readonly<Record<string, { verb: SourceActionVerb; labelKey: string }>> = Object.freeze({
    weread: { verb: "weread_pull", labelKey: "set.wereadPull" },
    sireader: { verb: "sireader_read", labelKey: "set.sireaderRead" },
    siplayer: { verb: "siplayer_sample", labelKey: "set.siplayerSample" },
    health: { verb: "health_probe", labelKey: "set.healthProbe" },
    yeguif: { verb: "yeguif_sync", labelKey: "set.yeguifSync" },
    notequery: { verb: "notequery_derive", labelKey: "set.notequeryDerive" },
});

export function evaluateSourceStatusAxes(params: {
    hasKeyOrBinding: boolean;
    enabled: boolean;
    todayRecordCount: number;
    hasWriteFailed?: boolean;
    hasReadFailed?: boolean;
    isKeyInvalid?: boolean;
}): SourceStatusAxes {
    const configState = params.hasKeyOrBinding ? "configured" : "unconfigured";
    const runtimeState = !params.enabled ? "disabled" : (params.todayRecordCount > 0 ? "running" : "idle");
    const activityOutcome = params.todayRecordCount > 0 ? "has_records_today" : "no_records_today";

    let problemState: SourceStatusAxes["problemState"] = "healthy";
    if (params.isKeyInvalid) {
        problemState = "credential_invalid";
    } else if (params.hasWriteFailed) {
        problemState = "write_failed";
    } else if (params.hasReadFailed) {
        problemState = "read_failed";
    }

    return {
        configState,
        runtimeState,
        activityOutcome,
        problemState,
    };
}

// === T-1758 设置元数据精准搜索索引 ===

export interface SettingsSearchResult {
    readonly key: string;
    readonly attribute?: string;
    readonly section: string;
    readonly card: string;
    readonly breadcrumb: string;
    readonly impactScope: string;
    readonly rationale: string;
    readonly score: number;
}

export function searchSettingsRegistry(
    keyword: string,
    registry: readonly SettingsFieldRecommendationDescriptor[] = SETTINGS_RECOMMENDATION_REGISTRY
): readonly SettingsSearchResult[] {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return [];

    const results: SettingsSearchResult[] = [];

    for (const field of registry) {
        let score = 0;
        const keyLower = field.key.toLowerCase();
        const cardLower = field.card.toLowerCase();
        const scopeLower = field.impactScope.toLowerCase();
        const rationaleLower = field.rationale.toLowerCase();
        const attrLower = (field.attribute ?? "").toLowerCase();

        if (keyLower === trimmed) {
            score += 100;
        } else if (keyLower.includes(trimmed)) {
            score += 40;
        }

        if (attrLower.includes(trimmed)) score += 30;
        if (cardLower.includes(trimmed)) score += 20;
        if (scopeLower.includes(trimmed)) score += 15;
        if (rationaleLower.includes(trimmed)) score += 10;

        if (score > 0) {
            results.push({
                key: field.key,
                attribute: field.attribute,
                section: field.section,
                card: field.card,
                breadcrumb: `${field.section} > ${field.card} > ${field.key}`,
                impactScope: field.impactScope,
                rationale: field.rationale,
                score,
            });
        }
    }

    results.sort((a, b) => b.score - a.score);
    return Object.freeze(results);
}
