/* T-1677：QingTrail/LifeLog 时间轴与类型聚合纯模型（研究与规则收敛）。
   定义 Marker 类型解析、段落修订指纹、跨语言别名、类型聚合统计及不可变红线，
   无隐式时钟，受 CLOCK_FREE_MODULES 保护。 */

import type {LifelogTimelineEntry} from "./lifelog-timeline";

/** T-1677：段落修订指纹——简单哈希提取，用于对账段落备注是否已被用户在日记中修改。 */
export function computeParagraphFingerprint(content: string): string {
    if (!content || typeof content !== "string") return "0";
    let hash = 0;
    const str = content.trim();
    for (let i = 0; i < str.length; i += 1) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
}

/** T-1677：类型别名与跨语言映射解析。
    优先匹配用户自定义别名，其次匹配内置中英文对照。 */
const BUILTIN_TYPE_ALIASES: Readonly<Record<string, string>> = {
    "work": "工作",
    "working": "工作",
    "study": "学习",
    "reading": "阅读",
    "read": "阅读",
    "exercise": "运动",
    "workout": "运动",
    "rest": "休息",
    "meditation": "冥想",
    "sleep": "睡眠",
};

export function resolveTypeAlias(type: string, customAliases: Readonly<Record<string, string>> = {}): string {
    if (!type || typeof type !== "string") return "";
    const trimmed = type.trim();
    if (customAliases[trimmed]) return customAliases[trimmed];
    const lower = trimmed.toLowerCase();
    if (BUILTIN_TYPE_ALIASES[lower]) return BUILTIN_TYPE_ALIASES[lower];
    return trimmed;
}

export interface LifelogTypeAggregate {
    type: string;
    totalMinutes: number;
    count: number;
    percentage: number;
}

/** T-1677：按类型聚合统计——计算各活动类型的总时长与占比。 */
export function summarizeLifelogByType(
    entries: readonly LifelogTimelineEntry[],
    customAliases: Readonly<Record<string, string>> = {},
): LifelogTypeAggregate[] {
    const totals = new Map<string, {totalMinutes: number; count: number}>();
    let overallMinutes = 0;

    for (const entry of entries) {
        const canonicalType = resolveTypeAlias(entry.type, customAliases) || "未分类";
        const minutes = Number.isFinite(entry.minutes) && entry.minutes > 0 ? entry.minutes : 0;
        const current = totals.get(canonicalType) || {totalMinutes: 0, count: 0};
        current.totalMinutes += minutes;
        current.count += 1;
        totals.set(canonicalType, current);
        overallMinutes += minutes;
    }

    const result: LifelogTypeAggregate[] = [];
    for (const [type, data] of totals.entries()) {
        const percentage = overallMinutes > 0 ? Number(((data.totalMinutes / overallMinutes) * 100).toFixed(1)) : 0;
        result.push({
            type,
            totalMinutes: data.totalMinutes,
            count: data.count,
            percentage,
        });
    }

    result.sort((a, b) => b.totalMinutes - a.totalMinutes || b.count - a.count);
    return result;
}

/** T-1677：三种视图的价值与冗余评估指标。 */
export function evaluateLifelogPresentationAffordance(view: "timeline" | "type-summary" | "calendar-badges"): {
    valueLevel: "high" | "medium" | "low";
    cognitiveLoad: "low" | "medium" | "high";
    recommendation: "adopted" | "adopted" | "suppressed";
    justification: string;
} {
    if (view === "timeline") {
        return {
            valueLevel: "high",
            cognitiveLoad: "low",
            recommendation: "adopted",
            justification: "流水账心流呈现，严格按时间先后排序，支持日记文档直达与 #标签徽标，当日复盘高价值",
        };
    }
    if (view === "type-summary") {
        return {
            valueLevel: "high",
            cognitiveLoad: "medium",
            recommendation: "adopted",
            justification: "按活动类型求和与时长占比分析，为周复盘看板提供宏观时间分配事实依据",
        };
    }
    return {
        valueLevel: "low",
        cognitiveLoad: "high",
        recommendation: "suppressed",
        justification: "在日历方格内强行塞入多色 Marker 图标徽标会导致严重信息过载与窄屏换行错乱，保持纯数字/微胶囊更稳健",
    };
}
