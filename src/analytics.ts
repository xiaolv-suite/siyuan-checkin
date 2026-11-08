import type {CheckinEvent, CheckinItem, CheckinQuota, CheckinSchedule, CheckinStore} from "./types";
import {evaluateQuotaSchedule, getQuotaPeriodBounds} from "./rules";
import {addDays as addDaysKey, daysBetweenHalfOpen} from "./date-keys";
import {dateKey, getEventDateKey, getEventsInDateRange, getSkipDatesForItem, getItemRevisionForDate, isComplete, isItemAvailableOnDate, isScheduledToday, isSkipEvent} from "./model";
const EVENT_RANGE_LIMITS = {maxDays: 366, maxPoints: 366, maxEvents: 5000} as const;

export type SummaryRange = "day" | "week" | "month";

export interface DateRange {
    start: Date;
    end: Date;
}

export interface CustomSummaryRange {
    startDate: string;
    endDate: string;
}

export interface ItemSummary {
    itemId: string;
    name: string;
    eventCount: number;
    totalsByUnit: Array<{unit: string; totalValue: number; eventCount: number}>;
    scheduledDays: number;
    completedDays: number;
    completionRate: number;
    quota?: QuotaSummary;
}

export interface QuotaSummary {
    period: "week" | "month";
    elapsedPeriods: number;
    completedPeriods: number;
    completionRate: number;
    current?: ReturnType<typeof evaluateQuotaSchedule>;
}

export interface EnergyFlowSummary {
    totalWithEnergy: number;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
    averageEnergy?: number;
}

export type SkipFrictionCategory = "time" | "health" | "environment" | "rest" | "reschedule" | "other";

export interface SkipFrictionSummary {
    totalSkips: number;
    withReasonCount: number;
    distribution: Record<SkipFrictionCategory, number>;
    topFriction?: SkipFrictionCategory;
}

export function detectFrictionCategory(note?: string): SkipFrictionCategory {
    if (!note || typeof note !== "string") return "other";
    const text = note.toLowerCase();
    if (text.includes("时间") || text.includes("太忙") || text.includes("加班") || text.includes("busy") || text.includes("time")) {
        return "time";
    }
    if (text.includes("身体") || text.includes("不适") || text.includes("生病") || text.includes("头痛") || text.includes("感冒") || text.includes("难受") || text.includes("health") || text.includes("sick")) {
        return "health";
    }
    if (text.includes("环境") || text.includes("天气") || text.includes("出差") || text.includes("下雨") || text.includes("场地") || text.includes("environment") || text.includes("weather")) {
        return "environment";
    }
    if (text.includes("休息") || text.includes("放空") || text.includes("恢复") || text.includes("放松") || text.includes("充电") || text.includes("rest")) {
        return "rest";
    }
    if (text.includes("顺延") || text.includes("调整") || text.includes("改期") || text.includes("改天") || text.includes("reschedule") || text.includes("postpone")) {
        return "reschedule";
    }
    return "other";
}

export function summarizeSkipFriction(events: readonly CheckinEvent[]): SkipFrictionSummary {
    const distribution: Record<SkipFrictionCategory, number> = {
        time: 0,
        health: 0,
        environment: 0,
        rest: 0,
        reschedule: 0,
        other: 0,
    };
    let totalSkips = 0;
    let withReasonCount = 0;
    for (const event of events) {
        if (!isSkipEvent(event)) continue;
        totalSkips += 1;
        const note = (event.note || "").trim();
        if (!note) continue;
        withReasonCount += 1;
        const category = detectFrictionCategory(note);
        distribution[category] += 1;
    }
    let topFriction: SkipFrictionCategory | undefined;
    let maxCount = 0;
    for (const [cat, count] of Object.entries(distribution) as [SkipFrictionCategory, number][]) {
        if (count > maxCount) {
            maxCount = count;
            topFriction = cat;
        }
    }
    return {
        totalSkips,
        withReasonCount,
        distribution,
        topFriction: maxCount > 0 ? topFriction : undefined,
    };
}

export function summarizeEnergyFlow(events: readonly CheckinEvent[]): EnergyFlowSummary {
    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    let totalWithEnergy = 0;
    let sumEnergy = 0;
    for (const event of events) {
        if (event.energy && Number.isInteger(event.energy) && event.energy >= 1 && event.energy <= 5) {
            distribution[event.energy] += 1;
            totalWithEnergy += 1;
            sumEnergy += event.energy;
        }
    }
    return {
        totalWithEnergy,
        distribution,
        averageEnergy: totalWithEnergy > 0 ? Math.round((sumEnergy / totalWithEnergy) * 10) / 10 : undefined,
    };
}

export interface SummaryContext {
    range: SummaryRange;
    startDate: string;
    endDate: string;
    items: ItemSummary[];
    totalEvents: number;
    completedItems: number;
    scheduledItems: number;
    energyFlow?: EnergyFlowSummary;
    skipFriction?: SkipFrictionSummary;
}

export function getDateRange(range: SummaryRange, date = new Date()): DateRange {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (range === "day") {
        return {start, end: addDays(start, 1)};
    }
    if (range === "week") {
        const mondayOffset = (start.getDay() + 6) % 7;
        const weekStart = addDays(start, -mondayOffset);
        return {start: weekStart, end: addDays(weekStart, 7)};
    }
    return {
        start: new Date(start.getFullYear(), start.getMonth(), 1),
        end: new Date(start.getFullYear(), start.getMonth() + 1, 1),
    };
}

export function getEventsInRange(store: CheckinStore, range: SummaryRange, date = new Date()): CheckinEvent[] {
    const bounds = getDateRange(range, date);
    const elapsedEnd = getElapsedEnd(bounds, date);
    const startKey = dateKey(bounds.start);
    const endKey = dateKey(elapsedEnd);
    return getEventsInDateRange(store, startKey, endKey);
}

/** A compact, local-only projection suitable for calendar integrations. */
export interface EventRangePoint {
    localDate: string;
    eventCount: number;
    totalValue: number;
    totalsByUnit: Array<{unit: string; totalValue: number; eventCount: number}>;
}

export interface EventRangeSummary {
    startDate: string;
    /** Exclusive upper bound (YYYY-MM-DD). */
    endDateExclusive: string;
    points: EventRangePoint[];
    totalEvents: number;
    /** True when maxEvents or maxPoints prevented a complete projection. */
    truncated: boolean;
}

export interface EventRangeSummaryOptions {
    maxEvents?: number;
    maxPoints?: number;
}

/**
 * Build a bounded event projection without exposing the store or event objects.
 * The range is half-open: [startDate, endDateExclusive), and dates are local
 * calendar dates (never derived from UTC timestamps).
 */
export function getEventRangeSummary(
    store: CheckinStore,
    range: {startDate: string; endDateExclusive: string},
    options: EventRangeSummaryOptions = {},
): EventRangeSummary {
    if (!range || !isLocalDateKey(range.startDate) || !isLocalDateKey(range.endDateExclusive) || range.startDate >= range.endDateExclusive) {
        throw new TypeError("事件日期范围无效，需使用半开区间 [startDate, endDateExclusive)");
    }
    const span = localDaySpan(range.startDate, range.endDateExclusive);
    if (span > EVENT_RANGE_LIMITS.maxDays) {
        throw new RangeError(`事件日期范围最多 ${EVENT_RANGE_LIMITS.maxDays} 天`);
    }
    const maxEvents = boundedLimit(options.maxEvents, EVENT_RANGE_LIMITS.maxEvents);
    const maxPoints = boundedLimit(options.maxPoints, EVENT_RANGE_LIMITS.maxPoints);
    const candidates = getEventsInDateRange(store, range.startDate, range.endDateExclusive);
    const selected = candidates.slice(0, maxEvents);
    const byDate = new Map<string, EventRangePoint>();
    for (const event of selected) {
        const date = event.localDate;
        let point = byDate.get(date);
        if (!point) {
            point = {localDate: date, eventCount: 0, totalValue: 0, totalsByUnit: []};
            byDate.set(date, point);
        }
        point.eventCount += 1;
        point.totalValue += event.value;
        const unit = point.totalsByUnit.find((entry) => entry.unit === event.unit);
        if (unit) {
            unit.totalValue += event.value;
            unit.eventCount += 1;
        } else {
            point.totalsByUnit.push({unit: event.unit, totalValue: event.value, eventCount: 1});
        }
    }
    const points = [...byDate.values()].slice(0, maxPoints).map((point) => ({
        localDate: point.localDate,
        eventCount: point.eventCount,
        totalValue: point.totalValue,
        totalsByUnit: point.totalsByUnit.map((entry) => ({...entry})),
    }));
    return {
        startDate: range.startDate,
        endDateExclusive: range.endDateExclusive,
        points,
        totalEvents: candidates.length,
        truncated: candidates.length > maxEvents || byDate.size > maxPoints,
    };
}

function boundedLimit(value: number | undefined, maximum: number): number {
    if (value === undefined) return maximum;
    if (!Number.isFinite(value) || value <= 0) throw new RangeError("事件摘要限制必须为正数");
    return Math.min(Math.floor(value), maximum);
}

function isLocalDateKey(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return dateKey(date) === value;
}

function localDaySpan(startDate: string, endDateExclusive: string): number {
    return daysBetweenHalfOpen(startDate, endDateExclusive) ?? 0;
}

export function getEventsInCustomRange(store: CheckinStore, range: CustomSummaryRange): CheckinEvent[] {
    const start = dateFromKey(range.startDate);
    const end = dateFromKey(range.endDate);
    if (!start || !end || range.startDate > range.endDate) return [];
    const endExclusive = dateKey(addDays(end, 1));
    return getEventsInDateRange(store, range.startDate, endExclusive);
}

/** T-1343：报告来源筛选选项；source 缺省统计全部来源。 */
export interface SummarySourceOptions {
    source?: CheckinEvent["source"];
}

export function buildSummaryContext(store: CheckinStore, range: SummaryRange, date = new Date(), options?: SummarySourceOptions): SummaryContext {
    const bounds = getDateRange(range, date);
    return buildSummaryForBounds(store, range, bounds, date, options);
}

export function buildCustomSummaryContext(store: CheckinStore, range: CustomSummaryRange, asOf = new Date(), options?: SummarySourceOptions): SummaryContext {
    const start = dateFromKey(range.startDate);
    const end = dateFromKey(range.endDate);
    if (!start || !end || start > end) {
        return buildSummaryContext(store, "day", asOf, options);
    }
    return buildSummaryForBounds(store, "day", {start, end: addDays(end, 1)}, asOf, options);
}

function buildSummaryForBounds(store: CheckinStore, range: SummaryRange, bounds: DateRange, date: Date, options?: SummarySourceOptions): SummaryContext {
    const elapsedBounds = {...bounds, end: getElapsedEnd(bounds, date)};
    const itemIds = new Set(store.items.map((item) => item.id));
    const events = getEventsInDateRange(store, dateKey(elapsedBounds.start), dateKey(elapsedBounds.end))
        .filter((event) => itemIds.has(event.itemId))
        .filter((event) => !options?.source || event.source === options.source);
    const eventsByItem = new Map<string, CheckinEvent[]>();
    events.forEach((event) => {
        const bucket = eventsByItem.get(event.itemId);
        if (bucket) bucket.push(event);
        else eventsByItem.set(event.itemId, [event]);
    });
    const items = store.items.map((item) => summarizeItem(store, item, elapsedBounds, eventsByItem.get(item.id) || EMPTY_EVENTS))
        .filter((item) => item.scheduledDays > 0 || item.eventCount > 0 || Boolean(item.quota));
    return {
        range,
        startDate: dateKey(elapsedBounds.start),
        endDate: dateKey(addDays(elapsedBounds.end, -1)),
        items,
        totalEvents: events.length,
        completedItems: items.filter((item) => item.completedDays > 0 || Boolean(item.quota?.completedPeriods)).length,
        scheduledItems: items.filter((item) => item.scheduledDays > 0 || Boolean(item.quota?.elapsedPeriods)).length,
        energyFlow: summarizeEnergyFlow(events),
        skipFriction: summarizeSkipFriction(events),
    };
}

function dateFromKey(value: string): Date | undefined {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return dateKey(date) === value ? date : undefined;
}

function summarizeItem(store: CheckinStore, item: CheckinItem, bounds: DateRange, events: CheckinEvent[]): ItemSummary {
    const quota = summarizeQuota(store, item, bounds, events);
    const skipDates = getSkipDatesForItem(store, item.id);
    let scheduledDays = 0;
    let completedDays = 0;
    for (let day = new Date(bounds.start); day < bounds.end && !quota; day.setDate(day.getDate() + 1)) {
        if (!isItemAvailableOnDate(item, day) || !isScheduledToday(item, day)) {
            continue;
        }
        /* T-1221：跳过日不计入完成率分母（跳过 ≠ 缺席）；若同日也有真实完成则按完成计。 */
        if (skipDates.has(dateKey(day)) && !isComplete(store, item, day)) {
            continue;
        }
        scheduledDays += 1;
        if (isComplete(store, item, day)) {
            completedDays += 1;
        }
    }
    const totals = new Map<string, {unit: string; totalValue: number; eventCount: number}>();
    events.forEach((event) => {
        const current = totals.get(event.unit);
        totals.set(event.unit, {
            unit: event.unit,
            totalValue: (current?.totalValue || 0) + event.value,
            eventCount: (current?.eventCount || 0) + 1,
        });
    });
    return {
        itemId: item.id,
        name: item.name,
        eventCount: events.length,
        totalsByUnit: [...totals.values()],
        scheduledDays,
        completedDays,
        completionRate: scheduledDays ? Math.round((completedDays / scheduledDays) * 100) : 0,
        ...(quota ? {quota} : {}),
    };
}

const EMPTY_EVENTS: CheckinEvent[] = [];

/* T-1767（D-341）：配额摘要按每个周期的生效规则与真实可用日评估。
   旧实现用范围末日修订评估全部周期（周↔月/额度切换即整体用错规则与周期键），
   且只看周期首日的可用性（月中创建/归档恢复的整周期被丢弃）。
   现逐日按当日修订的 quota 规则与周期键分桶：桶代表日（周期内首个范围日）的
   生效规则评估该周期；事件归属其发生日当时生效的规则与周期键（每事件恰计一次，
   周期跨界不双计；非配额纪元的事件不进入配额结算）；周期只要在范围内存在任一
   可用日即计入（部分可用周期仍按一个周期计）；周期标签取最后一个配额桶的周期类型。 */
function summarizeQuota(store: CheckinStore, item: CheckinItem, bounds: DateRange, events: CheckinEvent[]): QuotaSummary | undefined {
    /* Use calendar-day arithmetic here. Subtracting 24 hours from a local
       midnight crosses the wrong civil day when DST changes (for example,
       2026-03-10 00:00 EDT minus 24h is 2026-03-08 23:00 EST). */
    const endKey = dateKey(bounds.end);
    const elapsedEndKey = addDaysKey(endKey, -1) ?? endKey;
    interface QuotaPeriodBucket {
        representative: Date;
        schedule: CheckinSchedule;
        quota: CheckinQuota;
        unit: string;
        anyAvailable: boolean;
    }
    const periods = new Map<string, QuotaPeriodBucket>();
    for (let day = new Date(bounds.start); day < bounds.end; day.setDate(day.getDate() + 1)) {
        const revision = getItemRevisionForDate(item, day);
        if (revision.schedule.type !== "quota" || !revision.schedule.quota) continue;
        const {periodKey} = getQuotaPeriodBounds(revision.schedule.quota.period, day);
        let bucket = periods.get(periodKey);
        if (!bucket) {
            bucket = {representative: new Date(day), schedule: revision.schedule, quota: revision.schedule.quota, unit: revision.unit, anyAvailable: false};
            periods.set(periodKey, bucket);
        }
        if (isItemAvailableOnDate(item, day)) bucket.anyAvailable = true;
    }
    const attributed = new Map<CheckinEvent, string>();
    for (const event of events) {
        if (isSkipEvent(event)) continue;
        const eventDate = dateFromKey(getEventDateKey(event));
        if (!eventDate || eventDate < bounds.start || eventDate >= bounds.end) continue;
        const revision = getItemRevisionForDate(item, eventDate);
        if (revision.schedule.type !== "quota" || !revision.schedule.quota) continue;
        const {periodKey} = getQuotaPeriodBounds(revision.schedule.quota.period, eventDate);
        if (!periods.has(periodKey)) continue;
        attributed.set(event, periodKey);
    }
    if (!periods.size) return undefined;
    let periodLabel: QuotaSummary["period"] | undefined;
    let elapsedPeriods = 0;
    let completedPeriods = 0;
    let current: ReturnType<typeof evaluateQuotaSchedule>;
    for (const [periodKey, bucket] of periods) {
        if (!bucket.anyAvailable) continue;
        periodLabel = bucket.quota.period;
        const eraEvents = events.filter((event) => attributed.get(event) === periodKey);
        const progress = evaluateQuotaSchedule(bucket.schedule, eraEvents, item.id, bucket.representative, bucket.quota.countMode === "value" ? bucket.unit : undefined);
        if (!progress) continue;
        if (progress.endDate < elapsedEndKey) {
            elapsedPeriods += 1;
            if (progress.complete) completedPeriods += 1;
        } else {
            current = progress;
        }
    }
    if (!periodLabel) return undefined;
    return {
        period: periodLabel,
        elapsedPeriods,
        completedPeriods,
        completionRate: elapsedPeriods ? Math.round((completedPeriods / elapsedPeriods) * 100) : 0,
        ...(current ? {current} : {}),
    };
}

function addDays(date: Date, amount: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
}

function getElapsedEnd(bounds: DateRange, date: Date): Date {
    const tomorrow = addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), 1);
    return tomorrow < bounds.end ? tomorrow : bounds.end;
}

/* ============================================================
   对标 Loop Habit Tracker (uhabits) & Habitica：
   1. 科学「习惯强度指数 (Habit Strength EMA)」双轨制
   2. 「每周 N 次」弹性频率与 Skip 请假免断签搭桥连击
   3. 「薄弱星期几分布诊断」洞察
   ============================================================ */

export interface HabitStrengthHistoryEntry {
    date?: string;
    /** 归一化完成度 [0, 1] 或数量 */
    value?: number;
    completion?: number;
    /** 是否主动跳过（休息日/请假免断签，冻结强度不衰减） */
    skipped?: boolean;
}

export interface HabitStrengthResult {
    /** 0~100 强度百分比 */
    strength: number;
    /** 趋势：up / down / flat */
    trend: "up" | "down" | "flat";
    /** 趋势箭头：↑ / ↓ / → */
    trendArrow: "↑" | "↓" | "→";
    /** 与前一日相比的涨跌分值 */
    delta: number;
    /** 半衰期因子 m = 0.5^(sqrt(freq)/13) */
    multiplier: number;
}

/**
 * 依据 Loop Habit Tracker (Score.kt) 的半衰期 EMA 模型：
 * score_next = score * m + done * (1 - m) * 100
 * m = 0.5 ^ (sqrt(freq) / 13)
 * 支持主动标记 skip（休息/请假）冻结强度，单次漏做仅平缓衰减而非断签清零。
 */
export function calculateHabitStrength(
    history: readonly (HabitStrengthHistoryEntry | number | boolean)[],
    targetFrequency: number | {numerator: number; denominator: number} = 1,
): HabitStrengthResult {
    const num = typeof targetFrequency === "number" ? targetFrequency : targetFrequency.numerator;
    const den = typeof targetFrequency === "number" ? 1 : Math.max(1, targetFrequency.denominator);
    const freq = Math.max(0.01, num / den);
    const m = Math.pow(0.5, Math.sqrt(freq) / 13);
    let score = 0;
    let prevScore = 0;

    for (const item of history) {
        if (typeof item === "boolean") {
            prevScore = score;
            const done = item ? 1 : 0;
            score = score * m + done * (1 - m) * 100;
        } else if (typeof item === "number") {
            prevScore = score;
            const done = Math.min(1, Math.max(0, item));
            score = score * m + done * (1 - m) * 100;
        } else if (item && typeof item === "object") {
            if (item.skipped) {
                // 跳过日/请假免断签：冻结强度（不加成、不衰减）
                continue;
            }
            prevScore = score;
            const raw = item.completion !== undefined ? item.completion : (item.value !== undefined ? item.value : 0);
            const done = Math.min(1, Math.max(0, Number.isFinite(raw) ? raw : 0));
            score = score * m + done * (1 - m) * 100;
        }
        score = Math.min(100, Math.max(0, score));
    }

    const roundedScore = Math.round(score * 10) / 10;
    const delta = Math.round((score - prevScore) * 10) / 10;
    const trend: "up" | "down" | "flat" = delta > 0.3 ? "up" : delta < -0.3 ? "down" : "flat";
    const trendArrow: "↑" | "↓" | "→" = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";

    return {
        strength: roundedScore,
        trend,
        trendArrow,
        delta,
        multiplier: Math.round(m * 1000) / 1000,
    };
}

export type MilestoneTier = "none" | "base" | "target" | "heroic";

export interface TieredMilestoneSpec {
    /** 基础保底目标（最低有效习惯，保住连击不中断） */
    base: number;
    /** 常规达标目标（标准完成） */
    target: number;
    /** 突破挑战目标（高光突破，可选） */
    heroic?: number;
}

export interface TieredMilestoneEvaluation {
    tier: MilestoneTier;
    /** 是否达成至少基础目标（即保住打卡/连击有效） */
    isEffective: boolean;
    /** 达成基础目标的完成比例 (0~1.0) */
    baseRatio: number;
    /** 达成常规目标的完成比例 (0~1.0+) */
    targetRatio: number;
    /** 达成突破目标的完成比例 (0~1.0+) */
    heroicRatio?: number;
    /** 徽章展示文本（如 "保底" / "达标" / "突破"） */
    badge: string;
    /** 达成星级：0 = 未达成, 1 = Base保底, 2 = Target达标, 3 = Heroic突破 */
    stars: 0 | 1 | 2 | 3;
    /** 描述文案（如 "达成常规标准目标 (500/500)"） */
    description: string;
}

/**
 * 依据多阶里程碑规格评估当前数值达成情况（对标 Duolingo / Strava 弹性目标模型）
 */
export function evaluateTieredMilestone(
    value: number,
    spec: TieredMilestoneSpec,
    unit = ""
): TieredMilestoneEvaluation {
    const val = Number.isFinite(value) ? Math.max(0, value) : 0;
    const base = Math.max(0.001, spec.base);
    const target = Math.max(base, spec.target);
    const heroic = spec.heroic && spec.heroic > target ? spec.heroic : undefined;

    const baseRatio = Math.min(1, val / base);
    const targetRatio = Math.min(2, val / target);
    const heroicRatio = heroic ? Math.min(2, val / heroic) : undefined;
    const unitStr = unit ? ` ${unit}` : "";

    if (heroic && val >= heroic) {
        return {
            tier: "heroic",
            isEffective: true,
            baseRatio: 1,
            targetRatio: 1,
            heroicRatio: 1,
            badge: "突破",
            stars: 3,
            description: `达成高光突破目标 (${val}/${heroic}${unitStr})`,
        };
    }
    if (val >= target) {
        return {
            tier: "target",
            isEffective: true,
            baseRatio: 1,
            targetRatio: Math.min(1, val / target),
            heroicRatio,
            badge: "达标",
            stars: 2,
            description: `达成常规标准目标 (${val}/${target}${unitStr})`,
        };
    }
    if (val >= base) {
        return {
            tier: "base",
            isEffective: true,
            baseRatio: Math.min(1, val / base),
            targetRatio,
            heroicRatio,
            badge: "保底",
            stars: 1,
            description: `达成保底防断目标 (${val}/${base}${unitStr})`,
        };
    }
    return {
        tier: "none",
        isEffective: false,
        baseRatio,
        targetRatio,
        heroicRatio,
        badge: "未达标",
        stars: 0,
        description: `未达基础保底目标 (${val}/${base}${unitStr})`,
    };
}

export interface StreakFreezePeriod {
    /** 冷冻起始日期 YYYY-MM-DD */
    startDate: string;
    /** 冷冻截止日期 YYYY-MM-DD（包含） */
    endDate: string;
    /** 冷冻原因（休假/旅行/生病/不可抗力） */
    reason?: string;
}

/**
 * 校验某日期是否处于有效冷冻期内
 */
export function isDateInFreezePeriods(
    dateStr: string,
    freezePeriods?: readonly StreakFreezePeriod[],
    monthlyFreezeCap = 7
): boolean {
    if (!freezePeriods || freezePeriods.length === 0 || !dateStr) return false;
    const monthPrefix = dateStr.slice(0, 7);
    let matchedInMonth = 0;

    for (const period of freezePeriods) {
        if (!period.startDate || !period.endDate) continue;
        if (dateStr >= period.startDate && dateStr <= period.endDate) {
            return true;
        }
    }
    return false;
}

export interface FlexibleStreakEntry {
    date: string; // YYYY-MM-DD
    completed?: boolean;
    value?: number;
    target?: number;
    skipped?: boolean;
    /** 可选的多阶里程碑规格（提供时以 base 为保底达标门槛） */
    milestoneSpec?: TieredMilestoneSpec;
}

export interface FlexibleStreakOptions {
    /** 每周目标完成次数（如每周 3 次）；若未设置则按连续日计算 */
    weeklyTarget?: number;
    /** 是否允许 skip 免断签搭桥，默认为 true */
    allowSkipBridge?: boolean;
    /** 休假/旅行防断签冷冻期集合 */
    freezePeriods?: readonly StreakFreezePeriod[];
    /** 单月最大冷冻天数限制（默认 7 天） */
    monthlyFreezeCap?: number;
}

export interface FlexibleStreakResult {
    currentStreak: number;
    longestStreak: number;
    totalActiveUnits: number;
    mode: "daily" | "weekly";
}

/**
 * 弹性连击计算：
 * 1. 日级模式：支持主动标记 skip（休息日/请假）与休假冷冻期（Freeze Mode）免断签搭桥（Bridge Over）；
 * 2. 多阶里程碑：支持 Base 基础保底目标，达成保底即守护连击不中断，消除破窗效应；
 * 3. 周频次模式：每周达成 N 次（如每周健身 3 次），自然周内达标即可延续周连击。
 */
export function calculateFlexibleStreak(
    history: readonly FlexibleStreakEntry[],
    options: FlexibleStreakOptions = {},
): FlexibleStreakResult {
    const allowSkipBridge = options.allowSkipBridge !== false;
    const weeklyTarget = options.weeklyTarget && options.weeklyTarget > 0 ? Math.min(7, Math.floor(options.weeklyTarget)) : undefined;

    // 1. 周弹性模式 (weeklyTarget 模式)
    if (weeklyTarget !== undefined) {
        const weeks = new Map<string, {completed: number; total: number; skipped: number}>();
        for (const entry of history) {
            if (!entry.date) continue;
            const [y, m, d] = entry.date.split("-").map(Number);
            const dt = new Date(y, m - 1, d);
            const mondayOffset = (dt.getDay() + 6) % 7;
            const monday = new Date(y, m - 1, d - mondayOffset);
            const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
            let w = weeks.get(weekKey);
            if (!w) {
                w = {completed: 0, total: 0, skipped: 0};
                weeks.set(weekKey, w);
            }
            w.total += 1;
            const isEntryDone = Boolean(
                entry.completed ||
                (entry.milestoneSpec && typeof entry.value === "number" && entry.value >= entry.milestoneSpec.base) ||
                (entry.value !== undefined && entry.target !== undefined && entry.value >= entry.target)
            );
            if (entry.skipped || isDateInFreezePeriods(entry.date, options.freezePeriods, options.monthlyFreezeCap)) {
                w.skipped += 1;
            } else if (isEntryDone) {
                w.completed += 1;
            }
        }

        const sortedWeekKeys = [...weeks.keys()].sort();
        let longestStreak = 0;
        let tempStreak = 0;
        let totalMetWeeks = 0;
        let prevMonday: Date | null = null;

        for (const weekKey of sortedWeekKeys) {
            const [wy, wm, wd] = weekKey.split("-").map(Number);
            const currMonday = new Date(wy, wm - 1, wd);
            if (prevMonday !== null) {
                const weekMsDiff = new Date(wy, wm - 1, wd, 12).getTime() - new Date(prevMonday.getFullYear(), prevMonday.getMonth(), prevMonday.getDate(), 12).getTime();
                const weeksDiff = Math.round(weekMsDiff / (7 * 86400000));
                if (weeksDiff > 1) {
                    tempStreak = 0;
                }
            }
            prevMonday = currMonday;

            const w = weeks.get(weekKey)!;
            const isMet = w.completed >= weeklyTarget;
            const isSkippedWeek = allowSkipBridge && w.completed === 0 && w.skipped > 0 && (w.skipped + w.completed >= w.total);

            if (isMet) {
                tempStreak += 1;
                totalMetWeeks += 1;
                longestStreak = Math.max(longestStreak, tempStreak);
            } else if (isSkippedWeek) {
                // 整周请假/跳过/冷冻搭桥：保持连击不断
            } else {
                tempStreak = 0;
            }
        }

        return {
            currentStreak: tempStreak,
            longestStreak,
            totalActiveUnits: totalMetWeeks,
            mode: "weekly",
        };
    }

    // 2. 日级模式 + Skip 与休假冷冻期搭桥
    const sorted = [...history].filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date));
    let longestStreak = 0;
    let tempStreak = 0;
    let totalCompletedDays = 0;
    let prevDt: Date | null = null;

    for (const entry of sorted) {
        const [y, m, d] = entry.date.split("-").map(Number);
        const currDt = new Date(y, m - 1, d);

        if (prevDt !== null) {
            const msDiff = new Date(y, m - 1, d, 12).getTime() - new Date(prevDt.getFullYear(), prevDt.getMonth(), prevDt.getDate(), 12).getTime();
            const daysDiff = Math.round(msDiff / 86400000);
            if (daysDiff > 1) {
                // 检查缺失的中间自然日是否全处于休假冷冻期内
                let allGapDaysFrozen = true;
                for (let step = 1; step < daysDiff; step++) {
                    const gapDate = new Date(prevDt.getTime() + step * 86400000);
                    const gapKey = `${gapDate.getFullYear()}-${String(gapDate.getMonth() + 1).padStart(2, "0")}-${String(gapDate.getDate()).padStart(2, "0")}`;
                    if (!isDateInFreezePeriods(gapKey, options.freezePeriods, options.monthlyFreezeCap)) {
                        allGapDaysFrozen = false;
                        break;
                    }
                }
                if (!allGapDaysFrozen) {
                    tempStreak = 0;
                }
            }
        }
        prevDt = currDt;

        const isDone = Boolean(
            entry.completed ||
            (entry.milestoneSpec && typeof entry.value === "number" && entry.value >= entry.milestoneSpec.base) ||
            (entry.value !== undefined && entry.target !== undefined && entry.value >= entry.target)
        );

        if (isDone) {
            tempStreak += 1;
            totalCompletedDays += 1;
            longestStreak = Math.max(longestStreak, tempStreak);
        } else if (allowSkipBridge && (entry.skipped || isDateInFreezePeriods(entry.date, options.freezePeriods, options.monthlyFreezeCap))) {
            // 跳过日或休假冷冻日：中性搭桥，连击保持不归零
        } else {
            tempStreak = 0;
        }
    }

    return {
        currentStreak: tempStreak,
        longestStreak,
        totalActiveUnits: totalCompletedDays,
        mode: "daily",
    };
}

export interface DayOfWeekStat {
    dayOfWeek: number; // 0=周日, 1=周一, ... 6=周六
    name: string; // "周一" ... "周日"
    scheduled: number;
    completed: number;
    rate: number; // 0~100
}

export interface WeakestDayDiagnosis {
    weakestDay: DayOfWeekStat;
    strongestDay: DayOfWeekStat;
    stats: DayOfWeekStat[];
    hasWeakness: boolean;
    diagnosisText: string;
    adviceText: string;
}

/**
 * 诊断过去 N 天各星期的完成率分布，精准识别打卡「薄弱日」并输出调优建议
 */
export function diagnoseWeakestDayOfWeek(
    store: CheckinStore,
    options: {days?: number; itemId?: string; itemIds?: ReadonlySet<string>; asOf?: Date} = {},
): WeakestDayDiagnosis | undefined {
    const asOf = options.asOf || new Date();
    const days = Math.min(365, Math.max(7, options.days || 30));
    const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const stats: DayOfWeekStat[] = Array.from({length: 7}, (_, index) => ({
        dayOfWeek: index,
        name: dayNames[index],
        scheduled: 0,
        completed: 0,
        rate: 0,
    }));

    const targetItems = options.itemId
        ? store.items.filter(item => item.id === options.itemId)
        : options.itemIds
            ? store.items.filter(item => !item.archived && options.itemIds!.has(item.id))
            : store.items.filter(item => !item.archived);

    if (!targetItems.length) return undefined;

    const todayDate = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
    const skipsByItem = new Map(targetItems.map(item => [item.id, getSkipDatesForItem(store, item.id)]));

    for (let index = 0; index < days; index += 1) {
        const date = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - index);
        const dayOfWeek = date.getDay();
        const key = dateKey(date);

        for (const item of targetItems) {
            if (!isItemAvailableOnDate(item, date) || !isScheduledToday(item, date)) continue;
            const complete = isComplete(store, item, date);
            if (!complete && skipsByItem.get(item.id)?.has(key)) continue;

            stats[dayOfWeek].scheduled += 1;
            if (complete) stats[dayOfWeek].completed += 1;
        }
    }

    for (const stat of stats) {
        stat.rate = stat.scheduled > 0 ? Math.round((stat.completed / stat.scheduled) * 100) : 0;
    }

    const validStats = stats.filter(stat => stat.scheduled >= 2);
    if (validStats.length < 2) return undefined;

    const sorted = [...validStats].sort((a, b) => a.rate - b.rate);
    const weakest = sorted[0];
    const strongest = sorted[sorted.length - 1];
    const hasWeakness = strongest.rate - weakest.rate >= 15;
    const isWeekend = weakest.dayOfWeek === 0 || weakest.dayOfWeek === 6;

    const diagnosisText = `过去 ${days} 天你在${weakest.name}的完成率最低（${weakest.rate}%，${weakest.completed}/${weakest.scheduled} 次），明显低于其他时段。`;
    const adviceText = isWeekend
        ? `周末日程相对自由且节奏变化大，建议在${weakest.name}开启早间专属提醒，或将习惯切换为每周 N 次弹性频率以消解断签压力。`
        : `工作日中${weakest.name}较易产生疲劳或临时会议积压，建议将该习惯拆解为两分钟微习惯或设置浮动打卡时段。`;

    return {
        weakestDay: weakest,
        strongestDay: strongest,
        stats,
        hasWeakness,
        diagnosisText,
        adviceText,
    };
}
