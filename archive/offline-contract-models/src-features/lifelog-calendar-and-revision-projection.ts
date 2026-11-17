/* T-1542, T-1543 & T-1544：LifeLog 类型筛选聚合、日历徽标投影与段落修订检测模型（纯逻辑、无时钟、确定性）。
   1. 类型筛选与区间聚合（T-1542）：基于规范化类型别名进行区间时长与占比计算；
   2. 日历徽标与视觉冗余评估（T-1543）：纯函数投影每日 LifeLog 条数与时长；
      当习惯完成环密集时自动降级为微圆点（dot），消除与完成态着色的视觉竞争；
   3. 段落修订指纹检测与事实不可变性（T-1544）：当源文档段落被手改时，
      采用“旧事件墓碑注销 + 新指纹事件追加”的单向追加机制，严禁原地篡改历史事实。 */

import { computeParagraphFingerprint, resolveTypeAlias, type LifelogTypeAggregate } from "./lifelog-governance";
import type { LifelogTimelineEntry } from "./lifelog-timeline";

// === T-1542 类型筛选与区间聚合 ===

export interface LifelogTypeFilterCriteria {
    readonly selectedTypes?: readonly string[];
    readonly minMinutes?: number;
    readonly dateRange?: { start: string; end: string };
}

export function filterAndAggregateLifelogEntries(
    entries: readonly LifelogTimelineEntry[],
    criteria: LifelogTypeFilterCriteria,
    customAliases: Readonly<Record<string, string>> = {}
): {
    readonly filteredEntries: readonly LifelogTimelineEntry[];
    readonly totalMinutes: number;
    readonly typeBreakdown: readonly LifelogTypeAggregate[];
} {
    const selected = criteria.selectedTypes ? new Set(criteria.selectedTypes.map((t) => resolveTypeAlias(t, customAliases))) : null;

    const filtered = entries.filter((e) => {
        const canonical = resolveTypeAlias(e.type, customAliases) || "未分类";
        if (selected && !selected.has(canonical)) return false;
        if (typeof criteria.minMinutes === "number" && e.minutes < criteria.minMinutes) return false;
        if (criteria.dateRange) {
            const date = e.time.slice(0, 10);
            if (date < criteria.dateRange.start || date > criteria.dateRange.end) return false;
        }
        return true;
    });

    const totals = new Map<string, { totalMinutes: number; count: number }>();
    let overallMinutes = 0;

    for (const e of filtered) {
        const canonical = resolveTypeAlias(e.type, customAliases) || "未分类";
        const m = Number.isFinite(e.minutes) && e.minutes > 0 ? e.minutes : 0;
        overallMinutes += m;
        const cur = totals.get(canonical) ?? { totalMinutes: 0, count: 0 };
        cur.totalMinutes += m;
        cur.count += 1;
        totals.set(canonical, cur);
    }

    const typeBreakdown: LifelogTypeAggregate[] = [];
    for (const [type, stat] of totals.entries()) {
        const percentage = overallMinutes > 0 ? Math.round((stat.totalMinutes / overallMinutes) * 100) : 0;
        typeBreakdown.push({
            type,
            totalMinutes: stat.totalMinutes,
            count: stat.count,
            percentage,
        });
    }

    typeBreakdown.sort((a, b) => b.totalMinutes - a.totalMinutes);

    return {
        filteredEntries: Object.freeze(filtered),
        totalMinutes: overallMinutes,
        typeBreakdown: Object.freeze(typeBreakdown),
    };
}

// === T-1543 日历 LifeLog 徽标与视觉冗余评估 ===

export interface CalendarDayLifelogMetrics {
    readonly localDate: string;
    readonly totalMinutes: number;
    readonly entryCount: number;
    readonly recommendedBadgeMode: "badge_text" | "dot_indicator" | "none";
}

/** 评估日历每日 LifeLog 徽标呈现，防止与习惯完成态竞争（T-1543）。 */
export function projectCalendarLifelogMetrics(
    entries: readonly LifelogTimelineEntry[],
    dayCompletionRates: Readonly<Record<string, number>> = {}
): readonly CalendarDayLifelogMetrics[] {
    const dayMap = new Map<string, { minutes: number; count: number }>();

    for (const e of entries) {
        const date = e.time.slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const cur = dayMap.get(date) ?? { minutes: 0, count: 0 };
        cur.minutes += Math.max(0, e.minutes);
        cur.count += 1;
        dayMap.set(date, cur);
    }

    const results: CalendarDayLifelogMetrics[] = [];

    for (const [date, stat] of dayMap.entries()) {
        const completionRate = dayCompletionRates[date] ?? 0;
        let recommendedBadgeMode: CalendarDayLifelogMetrics["recommendedBadgeMode"] = "badge_text";

        // 当日习惯完成度很高或有完整进度环时，文字徽标会遮挡或喧宾夺主，推荐降级为紧凑微圆点
        if (completionRate > 0.8) {
            recommendedBadgeMode = "dot_indicator";
        } else if (stat.count === 0) {
            recommendedBadgeMode = "none";
        }

        results.push({
            localDate: date,
            totalMinutes: stat.minutes,
            entryCount: stat.count,
            recommendedBadgeMode,
        });
    }

    results.sort((a, b) => a.localDate.localeCompare(b.localDate));
    return Object.freeze(results);
}

// === T-1544 叶归段落修订检测与事实不可变决策 ===

export interface ParagraphRevisionDecision {
    readonly action: "retain_existing" | "tombstone_and_append";
    readonly previousFingerprint: string;
    readonly currentFingerprint: string;
    readonly hasContentChanged: boolean;
    readonly requiresTombstone: boolean;
}

/** 评估源文档段落修订后的结算决策（T-1544）。
 *  坚守单向追加原则：指纹变化生成墓碑注销旧事件并追加新事件，绝不反向改写已落盘历史。 */
export function evaluateParagraphRevisionSettlement(
    oldFingerprint: string,
    currentParagraphText: string
): ParagraphRevisionDecision {
    const currentFingerprint = computeParagraphFingerprint(currentParagraphText);
    const hasContentChanged = oldFingerprint !== currentFingerprint;

    if (!hasContentChanged) {
        return {
            action: "retain_existing",
            previousFingerprint: oldFingerprint,
            currentFingerprint,
            hasContentChanged: false,
            requiresTombstone: false,
        };
    }

    return {
        action: "tombstone_and_append",
        previousFingerprint: oldFingerprint,
        currentFingerprint,
        hasContentChanged: true,
        requiresTombstone: true, // 核心守门：必须通过墓碑注销旧事件
    };
}
