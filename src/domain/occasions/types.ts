export type OccasionKind = "birthday" | "anniversary" | "scheduled";
export type OccasionRecurrence = "once" | "annual" | "monthly" | "weekly" | "quarterly" | "halfyearly" | "interval";
export type OccasionCalendar = "solar" | "lunar";
export type MonthlySubtype = "byday" | "nthweek" | "lastday";
export type AnnualSubtype = "byday" | "nthweek";
export type IntervalUnit = "day" | "month" | "year";
export type OccasionPriority = "high" | "medium" | "low";
export type OccasionTemplateCategory = "birthday" | "anniversary" | "expense" | "renewal" | "health" | "festival";
export type OccasionCategory = OccasionTemplateCategory | "scheduled";

export interface Occasion {
    id: string;
    name: string;
    kind: OccasionKind;
    /** 锚点日期：once/interval 为实际日期；annual/monthly 取其月-日部分；lunar 年度事项中该日期为对应农历月日的公历锚点。 */
    date: string;
    recurrence: OccasionRecurrence;
    /** annual 专用：农历 / 公历（默认公历）。 */
    calendar?: OccasionCalendar;
    /** annual + lunar：锚点的农历月为闰月。 */
    lunarLeap?: boolean;
    /** annual 子型：固定日 / 月内第 N 个星期 X。 */
    annualSubtype?: AnnualSubtype;
    /** annual nthweek 与 monthly nthweek：月 1..12（annual）/ 1..5（第 N 个）。 */
    month?: number;
    nthWeek?: number;
    /** 星期：0=周日 .. 6=周六。 */
    weekday?: number;
    /** monthly 子型：指定日 / 第 N 个星期 X / 月末。 */
    monthlySubtype?: MonthlySubtype;
    /** interval：间隔单位与数量。 */
    intervalUnit?: IntervalUnit;
    intervalCount?: number;
    remindBeforeDays: number;
    note: string;
    enabled: boolean;
    completedDates: string[];
    /** T-1494 单次实例覆盖（additive，v1 仅改期）：键=原发生日期，值.date=新日期。 */
    overrides?: Record<string, OccasionOverride>;
    /** T-2020 可选具体时刻 HH:mm（00:00~23:59），直通 Task Horizon custom-time。 */
    time?: string;
    /** T-2020 可选重要性等级，直通 Task Horizon custom-priority 与四象限。 */
    priority?: OccasionPriority;
    /** T-2021 镜像在思源文档（如《📅 小驴事项簿》）中的原生任务块 ID（type='i', subtype='t'）。 */
    blockId?: string;
    /** T-2023 关联的思源准备笔记/参考正文块 ID，支持跳转与浮动引文预览。 */
    contextBlockId?: string;
    /** T-2028 语义化细分分类（生日/纪念日/定期支出/会员续费/健康与车辆/节日/日程），供筛选及跨插件联动消费。 */
    category?: OccasionCategory;
    createdAt: string;
    updatedAt: string;
}

export interface OccasionOverride {
    /** 改期后的日期（有效日历日且不同于键）。 */
    date: string;
}

export interface OccasionTombstone {
    occasionId: string;
    deletedAt: string;
}

export interface OccasionStore {
    version: 1;
    occasions: Occasion[];
    /** T-1622：删除身份跨窗口保留，防止旧窗口写回复活事项。 */
    tombstones?: OccasionTombstone[];
}

export type OccasionStatus = "today" | "upcoming";
export interface VisibleOccasion extends Occasion {
    occurrenceDate: string;
    status: OccasionStatus;
    daysUntil: number;
    completionKey: string;
}

export const OCCASIONS_STORAGE_NAME = "checkin-occasions";
export const OCCASIONS_STORE_VERSION = 1;

export interface OccasionTemplate {
    name: string;
    nameKey: string;
    icon: string;
    category: OccasionTemplateCategory;
    kind: OccasionKind;
    recurrence: OccasionRecurrence;
    calendar?: OccasionCalendar;
    lunarLeap?: boolean;
    annualSubtype?: AnnualSubtype;
    month?: number;
    nthWeek?: number;
    weekday?: number;
    monthlySubtype?: MonthlySubtype;
    intervalUnit?: IntervalUnit;
    intervalCount?: number;
    remindBeforeDays: number;
    date?: string;
    note?: string;
    recommended?: true;
}

export type OccasionMilestoneKind = "days" | "monthly" | "yearly";

export const OCCASION_MILESTONE_LADDER: readonly number[] = [100, 200, 300, 365, 500, 1000, 2000, 3000, 4000, 5000, 10000];

export interface OccasionMilestone {
    kind: OccasionMilestoneKind;
    count: number;
    date: string;
    daysUntil: number;
}

export interface ElapsedSpan {
    years: number;
    months: number;
    days: number;
}

export interface QuickOccasionDraft {
    name: string;
    kind: OccasionKind;
    date: string;
    recurrence: OccasionRecurrence;
    calendar?: OccasionCalendar;
    lunarLeap?: boolean;
    monthlySubtype?: MonthlySubtype;
    weekday?: number;
    remindBeforeDays: number;
    time?: string;
    priority?: OccasionPriority;
    contextBlockId?: string;
    category?: OccasionCategory;
    note: string;
}
