import {lunarToSolar, solarToLunar} from "./lunar";
import {t} from "./i18n";
import {addDays, daysBetweenHalfOpen} from "./date-keys";

export type OccasionKind = "birthday" | "anniversary" | "scheduled";
export type OccasionRecurrence = "once" | "annual" | "monthly" | "weekly" | "quarterly" | "halfyearly" | "interval";
export type OccasionCalendar = "solar" | "lunar";
export type MonthlySubtype = "byday" | "nthweek" | "lastday";
export type AnnualSubtype = "byday" | "nthweek";
export type IntervalUnit = "day" | "month" | "year";
export type OccasionPriority = "high" | "medium" | "low";
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
    /** 显示名（zh 兜底）；渲染与套用时优先用 nameKey 查字典。 */
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
    /** 模板自带的锚点日期（如节日）；其余模板留空由用户选择。 */
    date?: string;
    note?: string;
    /** 精选模板：在「推荐」分组中优先展示（D-161）。 */
    recommended?: true;
}

export type OccasionTemplateCategory = "birthday" | "anniversary" | "expense" | "renewal" | "health" | "festival";

export const OCCASION_TEMPLATES: OccasionTemplate[] = [
    {name: "生日（公历）", nameKey: "occ.tpl.birthdaySolar", icon: "🎂", category: "birthday", kind: "birthday", recurrence: "annual", calendar: "solar", remindBeforeDays: 3},
    {name: "生日（农历）", nameKey: "occ.tpl.birthdayLunar", icon: "🥮", category: "birthday", kind: "birthday", recurrence: "annual", calendar: "lunar", remindBeforeDays: 3},
    {name: "家人生日", nameKey: "occ.tpl.familyBirthday", icon: "👪", category: "birthday", kind: "birthday", recurrence: "annual", calendar: "solar", remindBeforeDays: 7, recommended: true},
    {name: "朋友生日", nameKey: "occ.tpl.friendBirthday", icon: "🎁", category: "birthday", kind: "birthday", recurrence: "annual", calendar: "solar", remindBeforeDays: 3},
    {name: "长辈生日", nameKey: "occ.tpl.elderBirthday", icon: "👴", category: "birthday", kind: "birthday", recurrence: "annual", calendar: "solar", remindBeforeDays: 7},
    {name: "恋人生日", nameKey: "occ.tpl.loverBirthday", icon: "💕", category: "birthday", kind: "birthday", recurrence: "annual", calendar: "solar", remindBeforeDays: 7},
    {name: "同学生日", nameKey: "occ.tpl.classmateBirthday", icon: "🌻", category: "birthday", kind: "birthday", recurrence: "annual", calendar: "solar", remindBeforeDays: 3},
    {name: "宠物生日", nameKey: "occ.tpl.petBirthday", icon: "🐶", category: "birthday", kind: "birthday", recurrence: "annual", calendar: "solar", remindBeforeDays: 3},
    {name: "结婚纪念日", nameKey: "occ.tpl.wedding", icon: "💍", category: "anniversary", kind: "anniversary", recurrence: "annual", calendar: "solar", remindBeforeDays: 7},
    {name: "恋爱纪念日", nameKey: "occ.tpl.relationship", icon: "💞", category: "anniversary", kind: "anniversary", recurrence: "annual", calendar: "solar", remindBeforeDays: 7},
    {name: "入职纪念日", nameKey: "occ.tpl.workAnniversary", icon: "💼", category: "anniversary", kind: "anniversary", recurrence: "annual", calendar: "solar", remindBeforeDays: 3},
    {name: "领证纪念日", nameKey: "occ.tpl.marriageLicense", icon: "💒", category: "anniversary", kind: "anniversary", recurrence: "annual", calendar: "solar", remindBeforeDays: 7},
    {name: "相识纪念日", nameKey: "occ.tpl.firstMeet", icon: "🤝", category: "anniversary", kind: "anniversary", recurrence: "annual", calendar: "solar", remindBeforeDays: 7},
    {name: "毕业纪念日", nameKey: "occ.tpl.graduation", icon: "🎓", category: "anniversary", kind: "anniversary", recurrence: "annual", calendar: "solar", remindBeforeDays: 14},
    {name: "戒烟纪念日", nameKey: "occ.tpl.quitSmoking", icon: "🚭", category: "anniversary", kind: "anniversary", recurrence: "annual", calendar: "solar", remindBeforeDays: 7},
    {name: "宠物到家纪念日", nameKey: "occ.tpl.petAdoption", icon: "🏡", category: "anniversary", kind: "anniversary", recurrence: "annual", calendar: "solar", remindBeforeDays: 7},
    {name: "退伍纪念日", nameKey: "occ.tpl.veteranDischarge", icon: "🎖️", category: "anniversary", kind: "anniversary", recurrence: "annual", calendar: "solar", remindBeforeDays: 14},
    {name: "房贷还款", nameKey: "occ.tpl.mortgage", icon: "🏠", category: "expense", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 1, recommended: true},
    {name: "车贷还款", nameKey: "occ.tpl.carLoan", icon: "🚗", category: "expense", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 1},
    {name: "房租", nameKey: "occ.tpl.rent", icon: "🔑", category: "expense", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 1, recommended: true},
    {name: "物业费", nameKey: "occ.tpl.propertyFee", icon: "🏢", category: "expense", kind: "scheduled", recurrence: "quarterly", remindBeforeDays: 7},
    {name: "水电燃气费", nameKey: "occ.tpl.utilities", icon: "💡", category: "expense", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 2, recommended: true},
    {name: "供暖费", nameKey: "occ.tpl.heating", icon: "❄️", category: "expense", kind: "scheduled", recurrence: "annual", calendar: "solar", remindBeforeDays: 14},
    {name: "车位费", nameKey: "occ.tpl.parking", icon: "🅿️", category: "expense", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 1},
    {name: "宽带费", nameKey: "occ.tpl.broadband", icon: "📶", category: "expense", kind: "scheduled", recurrence: "annual", calendar: "solar", remindBeforeDays: 7},
    {name: "水费", nameKey: "occ.tpl.waterFee", icon: "🚰", category: "expense", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 2},
    {name: "电费", nameKey: "occ.tpl.electricityFee", icon: "⚡", category: "expense", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 2},
    {name: "燃气费", nameKey: "occ.tpl.gasFee", icon: "🔥", category: "expense", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 2},
    {name: "垃圾处理费", nameKey: "occ.tpl.garbageFee", icon: "🗑️", category: "expense", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 1},
    {name: "车船税", nameKey: "occ.tpl.vehicleTax", icon: "🧾", category: "expense", kind: "scheduled", recurrence: "annual", calendar: "solar", remindBeforeDays: 14},
    {name: "保险费（年缴）", nameKey: "occ.tpl.insuranceYear", icon: "🛡️", category: "expense", kind: "scheduled", recurrence: "annual", calendar: "solar", remindBeforeDays: 14},
    {name: "保险费（季缴）", nameKey: "occ.tpl.insuranceQuarter", icon: "📄", category: "expense", kind: "scheduled", recurrence: "quarterly", remindBeforeDays: 7},
    {name: "信用卡还款", nameKey: "occ.tpl.creditCard", icon: "💳", category: "expense", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 1, recommended: true},
    {name: "发工资", nameKey: "occ.tpl.payday", icon: "💰", category: "expense", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 0, recommended: true},
    {name: "视频会员续费", nameKey: "occ.tpl.videoRenewal", icon: "🎬", category: "renewal", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 3, recommended: true},
    {name: "音乐会员续费", nameKey: "occ.tpl.musicRenewal", icon: "🎵", category: "renewal", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 3},
    {name: "软件订阅续费", nameKey: "occ.tpl.subscription", icon: "🔄", category: "renewal", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 3},
    {name: "云服务续费", nameKey: "occ.tpl.cloudRenewal", icon: "☁️", category: "renewal", kind: "scheduled", recurrence: "annual", calendar: "solar", remindBeforeDays: 14},
    {name: "域名续费", nameKey: "occ.tpl.domain", icon: "🌐", category: "renewal", kind: "scheduled", recurrence: "annual", calendar: "solar", remindBeforeDays: 30},
    {name: "网盘会员续费", nameKey: "occ.tpl.cloudDrive", icon: "🗂️", category: "renewal", kind: "scheduled", recurrence: "annual", calendar: "solar", remindBeforeDays: 14},
    {name: "电商会员续费", nameKey: "occ.tpl.shoppingPlus", icon: "🛒", category: "renewal", kind: "scheduled", recurrence: "annual", calendar: "solar", remindBeforeDays: 14},
    {name: "游戏会员续费", nameKey: "occ.tpl.gameRenewal", icon: "🎮", category: "renewal", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 3},
    {name: "知识付费续费", nameKey: "occ.tpl.learningRenewal", icon: "📚", category: "renewal", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 3},
    {name: "电视会员续费", nameKey: "occ.tpl.tvRenewal", icon: "📺", category: "renewal", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 3},
    {name: "新闻会员续费", nameKey: "occ.tpl.newsRenewal", icon: "📰", category: "renewal", kind: "scheduled", recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 3},
    {name: "健身房会籍", nameKey: "occ.tpl.gymMembership", icon: "🏋️", category: "renewal", kind: "scheduled", recurrence: "annual", calendar: "solar", remindBeforeDays: 14},
    {name: "游泳卡续费", nameKey: "occ.tpl.swimCard", icon: "🏊", category: "renewal", kind: "scheduled", recurrence: "interval", intervalUnit: "month", intervalCount: 6, remindBeforeDays: 7},
    {name: "车辆年检", nameKey: "occ.tpl.vehicleInspection", icon: "🔧", category: "health", kind: "scheduled", recurrence: "annual", calendar: "solar", remindBeforeDays: 30, recommended: true},
    {name: "定期体检", nameKey: "occ.tpl.healthCheckup", icon: "🩺", category: "health", kind: "scheduled", recurrence: "interval", intervalUnit: "month", intervalCount: 12, remindBeforeDays: 14},
    {name: "牙齿检查", nameKey: "occ.tpl.dentalCheck", icon: "🦷", category: "health", kind: "scheduled", recurrence: "interval", intervalUnit: "month", intervalCount: 6, remindBeforeDays: 7},
    {name: "眼科检查", nameKey: "occ.tpl.eyeExam", icon: "👓", category: "health", kind: "scheduled", recurrence: "interval", intervalUnit: "month", intervalCount: 12, remindBeforeDays: 7},
    {name: "复诊提醒", nameKey: "occ.tpl.followUp", icon: "🏥", category: "health", kind: "scheduled", recurrence: "interval", intervalUnit: "month", intervalCount: 3, remindBeforeDays: 3},
    {name: "疫苗接种", nameKey: "occ.tpl.vaccination", icon: "💉", category: "health", kind: "scheduled", recurrence: "once", remindBeforeDays: 7},
    {name: "驾照换证", nameKey: "occ.tpl.licenseRenewal", icon: "🪪", category: "health", kind: "scheduled", recurrence: "interval", intervalUnit: "month", intervalCount: 72, remindBeforeDays: 30, recommended: true},
    {name: "车辆保养", nameKey: "occ.tpl.carMaintenance", icon: "🛠️", category: "health", kind: "scheduled", recurrence: "interval", intervalUnit: "month", intervalCount: 6, remindBeforeDays: 7},
    {name: "车辆保险续保", nameKey: "occ.tpl.carInsurance", icon: "🚙", category: "health", kind: "scheduled", recurrence: "annual", calendar: "solar", remindBeforeDays: 14},
    {name: "血糖检测", nameKey: "occ.tpl.bloodSugar", icon: "🩸", category: "health", kind: "scheduled", recurrence: "interval", intervalUnit: "month", intervalCount: 3, remindBeforeDays: 3},
    {name: "视力复查", nameKey: "occ.tpl.visionCheck", icon: "👁️", category: "health", kind: "scheduled", recurrence: "interval", intervalUnit: "month", intervalCount: 12, remindBeforeDays: 7},
    {name: "心理咨询", nameKey: "occ.tpl.therapy", icon: "🧠", category: "health", kind: "scheduled", recurrence: "interval", intervalUnit: "month", intervalCount: 1, remindBeforeDays: 3},
    {name: "疫苗加强针", nameKey: "occ.tpl.boosterShot", icon: "💪", category: "health", kind: "scheduled", recurrence: "once", remindBeforeDays: 7},
    {name: "充电卡充值", nameKey: "occ.tpl.evCharge", icon: "🔌", category: "health", kind: "scheduled", recurrence: "interval", intervalUnit: "month", intervalCount: 3, remindBeforeDays: 3},
    {name: "元旦", nameKey: "occ.tpl.newYear", icon: "🎉", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "solar", date: "2027-01-01", remindBeforeDays: 7},
    {name: "劳动节", nameKey: "occ.tpl.labourDay", icon: "🛠️", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "solar", date: "2026-05-01", remindBeforeDays: 7},
    {name: "国庆节", nameKey: "occ.tpl.nationalDay", icon: "🇨🇳", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "solar", date: "2026-10-01", remindBeforeDays: 14},
    {name: "感恩节", nameKey: "occ.tpl.thanksgiving", icon: "🦃", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "solar", annualSubtype: "nthweek", month: 11, nthWeek: 4, weekday: 4, remindBeforeDays: 7},
    {name: "冬至", nameKey: "occ.tpl.winterSolstice", icon: "🥟", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "solar", date: "2026-12-21", remindBeforeDays: 7},
    {name: "白色情人节", nameKey: "occ.tpl.whiteValentine", icon: "🤍", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "solar", date: "2026-03-14", remindBeforeDays: 7},
    {name: "腊八节", nameKey: "occ.tpl.laba", icon: "🥣", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "lunar", date: "2027-01-15", remindBeforeDays: 7},
    {name: "个税汇算", nameKey: "occ.tpl.taxReconciliation", icon: "🧮", category: "expense", kind: "scheduled", recurrence: "annual", calendar: "solar", date: "2026-03-01", remindBeforeDays: 14},
    {name: "医保缴费", nameKey: "occ.tpl.medicalInsurance", icon: "⛑️", category: "expense", kind: "scheduled", recurrence: "annual", calendar: "solar", date: "2026-09-01", remindBeforeDays: 14},
    {name: "社保缴费", nameKey: "occ.tpl.socialInsurance", icon: "🧾", category: "expense", kind: "scheduled", recurrence: "annual", calendar: "solar", date: "2026-07-01", remindBeforeDays: 14},
    {name: "公积金年冲", nameKey: "occ.tpl.fundOffset", icon: "🏦", category: "expense", kind: "scheduled", recurrence: "annual", calendar: "solar", date: "2026-07-01", remindBeforeDays: 14},
    {name: "学费缴纳", nameKey: "occ.tpl.tuition", icon: "🏫", category: "expense", kind: "scheduled", recurrence: "annual", calendar: "solar", date: "2026-08-20", remindBeforeDays: 14},
    {name: "证书继续教育", nameKey: "occ.tpl.certEducation", icon: "📜", category: "renewal", kind: "scheduled", recurrence: "annual", calendar: "solar", remindBeforeDays: 30},
    {name: "净水器滤芯", nameKey: "occ.tpl.filterChange", icon: "🚿", category: "health", kind: "scheduled", recurrence: "interval", intervalUnit: "month", intervalCount: 6, remindBeforeDays: 7},
    {name: "空调清洗", nameKey: "occ.tpl.acCleaning", icon: "❄️", category: "health", kind: "scheduled", recurrence: "interval", intervalUnit: "month", intervalCount: 6, remindBeforeDays: 7},
    {name: "灭虫消杀", nameKey: "occ.tpl.pestControl", icon: "🐜", category: "health", kind: "scheduled", recurrence: "interval", intervalUnit: "month", intervalCount: 3, remindBeforeDays: 3},
    {name: "春节", nameKey: "occ.tpl.springFestival", icon: "🧨", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "lunar", date: "2026-02-17", remindBeforeDays: 14, recommended: true},
    {name: "元宵节", nameKey: "occ.tpl.lanternFestival", icon: "🏮", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "lunar", date: "2026-03-03", remindBeforeDays: 7},
    {name: "情人节", nameKey: "occ.tpl.valentines", icon: "🌹", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "solar", date: "2026-02-14", remindBeforeDays: 7},
    {name: "七夕", nameKey: "occ.tpl.qixi", icon: "🪶", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "lunar", date: "2026-08-19", remindBeforeDays: 7},
    {name: "中秋节", nameKey: "occ.tpl.midAutumn", icon: "🌕", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "lunar", date: "2026-09-25", remindBeforeDays: 7, recommended: true},
    {name: "重阳节", nameKey: "occ.tpl.doubleNinth", icon: "🌾", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "lunar", date: "2026-10-18", remindBeforeDays: 7},
    {name: "儿童节", nameKey: "occ.tpl.childrenDay", icon: "🎈", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "solar", date: "2026-06-01", remindBeforeDays: 3},
    {name: "教师节", nameKey: "occ.tpl.teachersDay", icon: "📖", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "solar", date: "2026-09-10", remindBeforeDays: 3},
    {name: "母亲节", nameKey: "occ.tpl.mothersDay", icon: "🌷", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "solar", annualSubtype: "nthweek", month: 5, nthWeek: 2, weekday: 0, remindBeforeDays: 7},
    {name: "父亲节", nameKey: "occ.tpl.fathersDay", icon: "👔", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "solar", annualSubtype: "nthweek", month: 6, nthWeek: 3, weekday: 0, remindBeforeDays: 7},
    {name: "圣诞节", nameKey: "occ.tpl.christmas", icon: "🎄", category: "festival", kind: "scheduled", recurrence: "annual", calendar: "solar", date: "2026-12-25", remindBeforeDays: 7},
];

export function occasionTemplateName(template: OccasionTemplate): string {
    return t(template.nameKey) || template.name;
}

export function weekdayName(index: number): string {
    return t(`occ.wd${clampInteger(index, 0, 6, 0)}`);
}

export function applyOccasionTemplate(template: OccasionTemplate, anchorDate: string): Partial<Occasion> {
    return {
        name: occasionTemplateName(template),
        kind: template.kind,
        recurrence: template.recurrence,
        calendar: template.calendar,
        lunarLeap: template.lunarLeap,
        annualSubtype: template.annualSubtype,
        month: template.month,
        nthWeek: template.nthWeek,
        weekday: template.weekday,
        monthlySubtype: template.monthlySubtype,
        intervalUnit: template.intervalUnit,
        intervalCount: template.intervalCount,
        remindBeforeDays: template.remindBeforeDays,
        date: template.date || anchorDate,
        note: template.note || "",
    };
}

export function createDefaultOccasionStore(): OccasionStore {
    return {version: OCCASIONS_STORE_VERSION, occasions: []};
}

export function normalizeOccasionStore(value: unknown): OccasionStore {
    const source = value && typeof value === "object" ? value as Partial<OccasionStore> : {};
    const raw = Array.isArray(source.occasions) ? source.occasions : [];
    const tombstones = normalizeOccasionTombstones(source.tombstones);
    const deletedIds = new Set(tombstones.map((tombstone) => tombstone.occasionId));
    /* T-1706（D-352）：按 id 去重隔离——损坏数据/手工编辑可能引入同 id 多条，
       agenda 按 id 回取行与按 id 写操作会同时命中。胜者确定性：updatedAt 新者优先，
       其次 completedDates 更多，再同则保留先出现者；去重不报错（可恢复规范形）。 */
    const winners = new Map<string, Occasion>();
    for (const candidate of raw) {
        const occasion = normalizeOccasion(candidate);
        if (!occasion) continue;
        const existing = winners.get(occasion.id);
        if (!existing) { winners.set(occasion.id, occasion); continue; }
        const challengerBetter = occasion.updatedAt > existing.updatedAt
            || (occasion.updatedAt === existing.updatedAt && occasion.completedDates.length > existing.completedDates.length);
        if (challengerBetter) winners.set(occasion.id, occasion);
    }
    const occasions = [...winners.values()].filter((item) => !deletedIds.has(item.id));
    return {version: OCCASIONS_STORE_VERSION, occasions, ...(tombstones.length ? {tombstones} : {})};
}

const RECURRENCES = new Set<OccasionRecurrence>(["once", "annual", "monthly", "weekly", "quarterly", "halfyearly", "interval"]);

export function normalizeOccasion(value: unknown): Occasion | undefined {
    if (!value || typeof value !== "object") return undefined;
    const source = value as Partial<Occasion>;
    const name = typeof source.name === "string" ? source.name.trim().slice(0, 120) : "";
    const date = typeof source.date === "string" ? source.date.trim() : "";
    const kind = source.kind === "birthday" || source.kind === "anniversary" || source.kind === "scheduled" ? source.kind : "scheduled";
    // 旧数据只含 once/annual/monthly；未知值按锚点日期一次性处理。
    const recurrence = RECURRENCES.has(source.recurrence as OccasionRecurrence) ? source.recurrence as OccasionRecurrence
        : source.recurrence === "once" ? "once" : source.recurrence === "monthly" ? "monthly" : source.recurrence === "annual" ? "annual" : "once";
    if (!name || !isValidOccasionDate(date)) return undefined;
    const now = new Date().toISOString();
    /* T-1706：完成日期唯一且升序，保留最近 120 条——重复/乱序输入归一为确定性形。 */
    const completedDates = Array.isArray(source.completedDates)
        ? [...new Set(source.completedDates.filter((item): item is string => typeof item === "string" && isValidLocalDate(item)))]
            .sort((left, right) => left.localeCompare(right))
            .slice(-120)
        : [];
    /* T-1494 实例覆盖归一化（additive，有界 60 条）：键与改期值都必须是真实日历日且不同。 */
    const overrides: Record<string, OccasionOverride> = {};
    if (source.overrides && typeof source.overrides === "object" && !Array.isArray(source.overrides)) {
        for (const [key, value] of Object.entries(source.overrides as Record<string, unknown>).slice(0, 60)) {
            if (!isValidOccasionDate(key)) continue;
            if (!value || typeof value !== "object" || Array.isArray(value)) continue;
            const moved = (value as {date?: unknown}).date;
            if (typeof moved !== "string" || !isValidOccasionDate(moved) || moved === key) continue;
            overrides[key] = {date: moved};
        }
    }
    const calendar = source.calendar === "lunar" ? "lunar" : "solar";
    const monthlySubtype = source.monthlySubtype === "nthweek" || source.monthlySubtype === "lastday" ? source.monthlySubtype : "byday";
    const annualSubtype = source.annualSubtype === "nthweek" ? "nthweek" : "byday";
    const intervalUnit = source.intervalUnit === "day" || source.intervalUnit === "year" ? source.intervalUnit : "month";
    const time = normalizeOccasionTime(source.time);
    const priority = normalizeOccasionPriority(source.priority);
    const blockId = validateOccasionBlockRef(source.blockId);
    const contextBlockId = validateOccasionBlockRef(source.contextBlockId);
    const rawKindStr = typeof source.kind === "string" ? source.kind.trim().toLowerCase() : "";
    const categoryFromKind = rawKindStr === "expense" || rawKindStr === "renewal" || rawKindStr === "health" || rawKindStr === "festival"
        ? (rawKindStr as OccasionCategory)
        : undefined;
    const category = normalizeOccasionCategory(source.category) || categoryFromKind;
    return {
        id: typeof source.id === "string" && source.id.trim() ? source.id : makeOccasionId(),
        name, kind, date, recurrence,
        calendar,
        lunarLeap: source.lunarLeap === true,
        annualSubtype,
        month: clampInteger(source.month, 1, 12, clampInteger(date.slice(5, 7), 1, 12, 1)),
        nthWeek: clampInteger(source.nthWeek, 1, 5, 1),
        weekday: clampInteger(source.weekday, 0, 6, 0),
        monthlySubtype,
        intervalUnit,
        intervalCount: clampInteger(source.intervalCount, 1, 365, 1),
        remindBeforeDays: clampInteger(source.remindBeforeDays, 0, 365, 0),
        note: typeof source.note === "string" ? source.note.trim().slice(0, 500) : "",
        enabled: source.enabled !== false, completedDates,
        ...(Object.keys(overrides).length ? {overrides} : {}),
        ...(time ? {time} : {}),
        ...(priority ? {priority} : {}),
        ...(blockId ? {blockId} : {}),
        ...(contextBlockId ? {contextBlockId} : {}),
        ...(category ? {category} : {}),
        createdAt: typeof source.createdAt === "string" ? source.createdAt : now,
        updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : now,
    };
}

export function getVisibleOccasions(store: OccasionStore, date: Date): VisibleOccasion[] {
    const localDate = toLocalDateKey(date);
    return store.occasions.filter((item) => item.enabled)
        .map((item) => toVisibleOccasion(item, localDate))
        .filter((item): item is VisibleOccasion => Boolean(item))
        .sort((left, right) => left.daysUntil - right.daysUntil || left.name.localeCompare(right.name, "zh-CN"));
}

export function toVisibleOccasion(item: Occasion, localDate: string): VisibleOccasion | undefined {
    const occurrenceDate = getOccurrenceDate(item, localDate);
    if (!occurrenceDate) return undefined;
    const daysUntil = differenceInDays(localDate, occurrenceDate);
    if (daysUntil < 0 || daysUntil > item.remindBeforeDays) return undefined;
    return {...item, occurrenceDate, status: daysUntil === 0 ? "today" : "upcoming", daysUntil, completionKey: item.id + ":" + occurrenceDate};
}

/** 事项在 localDate 当天或之后的下一次发生日期；T-1494 起尊重单次实例覆盖：
    改期目标日本身进入时间线（在其新日期呈现），被覆盖的原基点跳过；
    改期日已过的覆盖视为已消费，不再影响。输出有界（至多消费 12 个被覆盖基点）。 */
export function getOccurrenceDate(item: Occasion, localDate: string): string | undefined {
    if (!isValidLocalDate(localDate)) return undefined;
    const overrides = item.overrides || {};
    /* 预扫：所有落在 localDate 之后的改期目标都是候选。 */
    let earliest: string | undefined;
    for (const override of Object.values(overrides)) {
        if (override.date >= localDate && (!earliest || override.date < earliest)) earliest = override.date;
    }
    let cursor = localDate;
    for (let guard = 0; guard < 12; guard += 1) {
        const base = getBaseOccurrenceDate(item, cursor);
        if (!base) break;
        const override = overrides[base];
        if (override) {
            /* 被覆盖的原基点不直接呈现（其目标已在预扫计入），继续看下一基点。 */
            const nextCursor = addDays(base, 1);
            if (!nextCursor) break;
            cursor = nextCursor;
            continue;
        }
        if (!earliest || base < earliest) earliest = base;
        break;
    }
    return earliest;
}

/** 基础发生引擎（不含实例覆盖）。 */
function getBaseOccurrenceDate(item: Occasion, localDate: string): string | undefined {
    if (!isValidLocalDate(localDate)) return undefined;
    switch (item.recurrence) {
        case "once":
            return isValidLocalDate(item.date) && item.date >= localDate ? item.date : undefined;
        case "annual":
            return item.calendar === "lunar" ? annualLunarOccurrence(item, localDate) : annualSolarOccurrence(item, localDate);
        case "monthly":
            return monthlyOccurrence(item, localDate);
        case "weekly":
            return weeklyOccurrence(item, localDate);
        case "quarterly":
        case "halfyearly":
            return stepMonthlyOccurrence(item, localDate, item.recurrence === "quarterly" ? 3 : 6);
        case "interval":
            return intervalOccurrence(item, localDate);
        default:
            return undefined;
    }
}

function annualSolarOccurrence(item: Occasion, localDate: string): string | undefined {
    if (item.annualSubtype === "nthweek") {
        const month = clampInteger(item.month, 1, 12, 1);
        const nth = clampInteger(item.nthWeek, 1, 5, 1);
        const weekday = clampInteger(item.weekday, 0, 6, 0);
        const year = Number(localDate.slice(0, 4));
        const current = nthWeekdayOfMonth(year, month, nth, weekday);
        if (current && current >= localDate) return current;
        return nthWeekdayOfMonth(year + 1, month, nth, weekday);
    }
    const monthDay = item.date.slice(5);
    const year = Number(localDate.slice(0, 4));
    /* T-1704（D-350）：闰日（02-29）在非闰年顺延至当年 02-28——与月度/interval 的
       月末 clamp 纪律一致。此前平年直接 undefined，闰日生日/年检会从今日与
       即将分组中消失两个年度；闰年仍优先真实 02-29。 */
    const resolveAnnualDay = (targetYear: number): string | undefined => {
        const exact = `${targetYear}-${monthDay}`;
        if (isValidLocalDate(exact)) return exact;
        if (monthDay === "02-29" && isValidLocalDate(`${targetYear}-02-28`)) return `${targetYear}-02-28`;
        return undefined;
    };
    const current = resolveAnnualDay(year);
    if (current && current >= localDate) return current;
    return resolveAnnualDay(year + 1);
}

function annualLunarOccurrence(item: Occasion, localDate: string): string | undefined {
    const lunar = solarToLunar(parseLocalDate(item.date));
    if (!lunar) return undefined;
    const year = Number(localDate.slice(0, 4));
    for (const candidateYear of [year, year + 1]) {
        const solar = lunarToSolar(candidateYear, lunar.month, lunar.day, item.lunarLeap === true);
        if (!solar) continue;
        const key = toLocalDateKey(solar);
        if (key >= localDate) return key;
    }
    return undefined;
}

function monthlyOccurrence(item: Occasion, localDate: string): string | undefined {
    const [year, month] = localDate.split("-").slice(0, 2).map(Number);
    const nextMonth = (y: number, m: number): [number, number] => m === 12 ? [y + 1, 1] : [y, m + 1];
    if (item.monthlySubtype === "lastday") {
        const last = (y: number, m: number): string => toLocalDateKey(new Date(y, m, 0));
        const current = last(year, month);
        if (current >= localDate) return current;
        const [ny, nm] = nextMonth(year, month);
        return last(ny, nm);
    }
    if (item.monthlySubtype === "nthweek") {
        const nth = clampInteger(item.nthWeek, 1, 5, 1);
        const weekday = clampInteger(item.weekday, 0, 6, 0);
        const current = nthWeekdayOfMonth(year, month, nth, weekday);
        if (current && current >= localDate) return current;
        const [ny, nm] = nextMonth(year, month);
        return nthWeekdayOfMonth(ny, nm, nth, weekday);
    }
    const seedDay = Number(item.date.slice(8));
    const current = monthDate(year, month, seedDay);
    if (current >= localDate) return current;
    const [ny, nm] = nextMonth(year, month);
    return monthDate(ny, nm, seedDay);
}

function weeklyOccurrence(item: Occasion, localDate: string): string | undefined {
    const weekday = clampInteger(item.weekday, 0, 6, parseLocalDate(item.date).getDay());
    const base = parseLocalDate(localDate);
    for (let step = 0; step < 7; step += 1) {
        const candidate = toLocalDateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + step));
        if (parseLocalDate(candidate).getDay() === weekday && candidate >= localDate) return candidate;
    }
    return undefined;
}

function stepMonthlyOccurrence(item: Occasion, localDate: string, step: number): string | undefined {
    const seed = parseLocalDate(item.date);
    const seedMonth = seed.getMonth() + 1;
    const seedDay = seed.getDate();
    let [year, month] = localDate.split("-").slice(0, 2).map(Number);
    // 从当前月起向后找第一个落在周期上的月份（周期按锚点月对齐）。
    for (let guard = 0; guard < 12 * 3; guard += 1) {
        const offset = ((month - seedMonth) % step + step) % step;
        if (offset !== 0) {
            month += step - offset;
            while (month > 12) { month -= 12; year += 1; }
        }
        const candidate = monthDate(year, month, seedDay);
        if (candidate >= localDate) return candidate;
        [year, month] = nextMonthPair(year, month, step);
    }
    return undefined;
}

function nextMonthPair(year: number, month: number, step: number): [number, number] {
    month += step;
    while (month > 12) { month -= 12; year += 1; }
    return [year, month];
}

function intervalOccurrence(item: Occasion, localDate: string): string | undefined {
    if (!isValidLocalDate(item.date) || item.date > localDate) return isValidLocalDate(item.date) && item.date >= localDate ? item.date : undefined;
    const count = clampInteger(item.intervalCount, 1, 365, 1);
    const unit = item.intervalUnit || "month";
    if (unit === "day") {
        const diff = differenceInDays(item.date, localDate);
        const steps = Math.ceil(diff / count);
        return toLocalDateKey(new Date(parseLocalDate(item.date).getFullYear(), parseLocalDate(item.date).getMonth(), parseLocalDate(item.date).getDate() + steps * count));
    }
    const anchor = parseLocalDate(item.date);
    const target = parseLocalDate(localDate);
    const months = (target.getFullYear() - anchor.getFullYear()) * 12 + (target.getMonth() - anchor.getMonth());
    const stepMonths = unit === "year" ? count * 12 : count;
    const candidateAt = (steps: number): string => {
        const total = steps * stepMonths;
        return monthDate(anchor.getFullYear() + Math.floor((anchor.getMonth() + total) / 12), ((anchor.getMonth() + total) % 12) + 1, anchor.getDate());
    };
    let steps = Math.max(0, Math.floor(months / stepMonths));
    let candidate = candidateAt(steps);
    while (candidate < localDate) {
        steps += 1;
        candidate = candidateAt(steps);
    }
    return candidate;
}

export function isOccasionCompleted(item: Occasion, occurrenceDate: string): boolean {
    return item.completedDates.includes(occurrenceDate);
}

/** T-1494 错过处理投影：localDate 之前最近一次发生（仅太阳历固定周期口径），
    若未标记完成则返回该日期；weekly/农历/第 N 个星期 X 等无法无歧义回推的口径返回 undefined。 */
export function getMissedOccurrence(item: Occasion, localDate: string): string | undefined {
    if (!item.enabled) return undefined;
    if (item.recurrence === "once" || item.calendar === "lunar") return undefined;
    if (item.recurrence === "annual" && item.annualSubtype === "nthweek") return undefined;
    if (item.recurrence === "monthly" && item.monthlySubtype && item.monthlySubtype !== "byday") return undefined;
    const end = getOccurrenceDate(item, localDate);
    if (!end) return undefined;
    const anchorDay = parseLocalDate(item.date).getDate();
    const shift = (months: number): string | undefined => {
        const [endYear, endMonth] = end.split("-").map(Number);
        const index = endYear * 12 + (endMonth - 1) + months;
        return monthDate(Math.floor(index / 12), (index % 12) + 1, anchorDay);
    };
    let previous: string | undefined;
    switch (item.recurrence) {
        case "weekly": previous = addDays(end, -7) ?? undefined; break;
        case "monthly": previous = shift(-1); break;
        case "quarterly": previous = shift(-3); break;
        case "halfyearly": previous = shift(-6); break;
        case "annual": previous = shift(-12); break;
        case "interval": {
            const count = clampInteger(item.intervalCount, 1, 365, 1);
            previous = item.intervalUnit === "day" ? addDays(end, -count) ?? undefined : shift(item.intervalUnit === "year" ? -count * 12 : -count);
            break;
        }
        default: return undefined;
    }
    if (!previous || previous >= localDate) return undefined;
    /* T-1705（D-351）：改期实例的错过判定——原日被单次改期时，完成/补标都落在
       实际发生日：原日未完成但改期日已完成则不提示（此前会误报原日漏记），
       改期日未完成则提示**实际发生日**（补标对象与完成记录一致，避免重复完成）。
       跟随覆盖链有界防环；无覆盖时行为与旧版逐值一致。 */
    return resolveOverrideTarget(item, previous) === previous
        ? (item.completedDates.includes(previous) ? undefined : previous)
        : (item.completedDates.includes(resolveOverrideTarget(item, previous)) ? undefined : resolveOverrideTarget(item, previous));
}

/** T-1705：跟随单次改期链解析实际发生日（有界 8 步防环；无覆盖返回原日）。 */
function resolveOverrideTarget(item: Occasion, date: string): string {
    let current = date;
    for (let guard = 0; guard < 8; guard += 1) {
        const override = item.overrides?.[current];
        if (!override || !isValidLocalDate(override.date) || override.date === current) break;
        current = override.date;
    }
    return current;
}

/** T-1494 写入单次实例覆盖（改期）；newDate 为空/等于原日期时移除该覆盖。
    有界：单事项覆盖至多 60 条（与归一化一致），未匹配 id 时原样返回 store。 */
export function setOccasionOverride(store: OccasionStore, id: string, originalDate: string, newDate: string | undefined): OccasionStore {
    if (!isValidLocalDate(originalDate)) return store;
    if (newDate !== undefined && (!isValidLocalDate(newDate) || newDate === originalDate)) return store;
    if (!store.occasions.some((item) => item.id === id)) return store;
    return {
        version: OCCASIONS_STORE_VERSION,
        occasions: store.occasions.map((item) => {
            if (item.id !== id) return item;
            const overrides: Record<string, OccasionOverride> = {...(item.overrides || {})};
            if (newDate) overrides[originalDate] = {date: newDate};
            else delete overrides[originalDate];
            const changed = JSON.stringify(overrides) !== JSON.stringify(item.overrides || {});
            if (!changed) return item;
            const next: Occasion = {...item, updatedAt: new Date().toISOString()};
            if (Object.keys(overrides).length) next.overrides = overrides;
            else delete next.overrides;
            return next;
        }),
        ...(store.tombstones?.length ? {tombstones: store.tombstones} : {}),
    };
}

/** T-1718（D-359）：当前发生日的改期来源——overrides 中值为 next 的键（撤销对象）；
    next 为周期规则日（无改期）返回 undefined。 */
export function findOverrideOriginFor(item: Occasion, next: string): string | undefined {
    for (const [origin, override] of Object.entries(item.overrides || {})) {
        if (override.date === next) return origin;
    }
    return undefined;
}

/** T-1717（D-360）：新建前的重复与相似提示（防误建）——exact=同名（trim 后精确相等）；
    similar=双向包含（大小写不敏感，如"张三生日"vs"生日"）。排除编辑目标自身与已归档；
    只提示不合并——合法重名（不同人的生日）由用户确认后保留。上限 5 条防弹窗过长。 */
export function findSimilarOccasions(occasions: readonly Occasion[], name: string, excludeId?: string, limit = 5): Occasion[] {
    const needle = name.trim().toLocaleLowerCase();
    if (!needle) return [];
    const exact: Occasion[] = [];
    const similar: Occasion[] = [];
    for (const item of occasions) {
        if (item.id === excludeId) continue;
        const candidate = item.name.trim().toLocaleLowerCase();
        if (candidate === needle) exact.push(item);
        else if ((candidate.includes(needle) || needle.includes(candidate)) && candidate.length > 0) similar.push(item);
    }
    return [...exact, ...similar].slice(0, limit);
}

export function markOccasionCompleted(store: OccasionStore, id: string, occurrenceDate: string, completed: boolean): OccasionStore {
    if (!isValidLocalDate(occurrenceDate)) return store;
    let changed = false;
    const occasions = store.occasions.map((item) => {
        if (item.id !== id) return item;
        const dates = new Set(item.completedDates);
        if (completed) dates.add(occurrenceDate); else dates.delete(occurrenceDate);
        const nextDates = [...dates].sort().slice(-120);
        changed = nextDates.join("|") !== item.completedDates.join("|");
        return changed ? {...item, completedDates: nextDates, updatedAt: new Date().toISOString()} : item;
    });
    return changed ? {version: OCCASIONS_STORE_VERSION, occasions, ...(store.tombstones?.length ? {tombstones: store.tombstones} : {})} : store;
}

export function upsertOccasion(store: OccasionStore, occasion: Occasion): OccasionStore {
    if (store.tombstones?.some((tombstone) => tombstone.occasionId === occasion.id)) return store;
    const exists = store.occasions.some((item) => item.id === occasion.id);
    const occasions = exists
        ? store.occasions.map((item) => item.id === occasion.id ? occasion : item)
        : [...store.occasions, occasion];
    return {version: OCCASIONS_STORE_VERSION, occasions, ...(store.tombstones?.length ? {tombstones: store.tombstones} : {})};
}

export function deleteOccasion(store: OccasionStore, id: string): OccasionStore {
    if (!store.occasions.some((item) => item.id === id)) return store;
    const tombstones = mergeOccasionTombstones(store.tombstones || [], [{occasionId: id, deletedAt: new Date().toISOString()}]);
    return {version: OCCASIONS_STORE_VERSION, occasions: store.occasions.filter((item) => item.id !== id), tombstones};
}

/* T-1622 跨窗口合并：按事项 id 取双方 completedDates 并集（排序去重，沿用 120 上限），
    并集删除墓碑；墓碑优先于任何旧窗口事项，防止删除后旧快照写回复活。
    远端独有事项在没有本地墓碑时可安全采用；旧窗口删除会随新格式写入墓碑。
    本地独有事项原样保留。确定性输出，无时钟。 */
export function mergeOccasionCompletions(local: OccasionStore, remote: OccasionStore): OccasionStore {
    const remoteById = new Map(remote.occasions.map((item) => [item.id, item]));
    const tombstones = mergeOccasionTombstones(local.tombstones || [], remote.tombstones || []);
    const deletedIds = new Set(tombstones.map((tombstone) => tombstone.occasionId));
    let changed = tombstones.length !== (local.tombstones || []).length
        || tombstones.some((tombstone, index) => tombstone.occasionId !== local.tombstones?.[index]?.occasionId || tombstone.deletedAt !== local.tombstones?.[index]?.deletedAt);
    const occasions = local.occasions.flatMap((item) => {
        if (deletedIds.has(item.id)) {
            changed = true;
            return [];
        }
        const counterpart = remoteById.get(item.id);
        if (!counterpart) return [item];
        const dates = new Set([...item.completedDates, ...counterpart.completedDates]);
        const nextDates = [...dates].sort().slice(-120);
        if (nextDates.join("|") === item.completedDates.join("|")) return [item];
        changed = true;
        return [{...item, completedDates: nextDates}];
    });
    for (const [id, item] of remoteById) {
        if (deletedIds.has(id) || local.occasions.some((candidate) => candidate.id === id)) continue;
        occasions.push(item);
        changed = true;
    }
    return changed ? {version: local.version, occasions, ...(tombstones.length ? {tombstones} : {})} : local;
}

function normalizeOccasionTombstones(value: unknown): OccasionTombstone[] {
    if (!Array.isArray(value)) return [];
    const byId = new Map<string, OccasionTombstone>();
    value.forEach((candidate) => {
        if (!candidate || typeof candidate !== "object") return;
        const entry = candidate as Partial<OccasionTombstone>;
        if (typeof entry.occasionId !== "string" || !entry.occasionId.trim() || typeof entry.deletedAt !== "string" || Number.isNaN(Date.parse(entry.deletedAt))) return;
        const tombstone = {occasionId: entry.occasionId.trim().slice(0, 200), deletedAt: new Date(entry.deletedAt).toISOString()};
        const existing = byId.get(tombstone.occasionId);
        if (!existing || tombstone.deletedAt > existing.deletedAt) byId.set(tombstone.occasionId, tombstone);
    });
    return [...byId.values()].sort((left, right) => left.occasionId.localeCompare(right.occasionId) || left.deletedAt.localeCompare(right.deletedAt)).slice(-240);
}

function mergeOccasionTombstones(local: readonly OccasionTombstone[], remote: readonly OccasionTombstone[]): OccasionTombstone[] {
    return normalizeOccasionTombstones([...local, ...remote]);
}

export function isValidOccasionDate(value: string): boolean {
    return isValidLocalDate(value);
}

export function describeRecurrence(item: Occasion): string {
    const nth = (n: number): string => t(`occ.nth${clampInteger(n, 1, 5, 1)}`);
    const wd = (index: number): string => weekdayName(index);
    const unit = (u: IntervalUnit): string => u === "day" ? t("occ.unitDay") : u === "year" ? t("occ.unitYear") : t("occ.unitMonth");
    switch (item.recurrence) {
        case "once": return t("occ.once");
        case "annual": {
            if (item.annualSubtype === "nthweek") {
                return t("occ.annualNthweek", {month: item.month ?? 1, week: nth(item.nthWeek ?? 1), weekday: wd(item.weekday ?? 0)});
            }
            return item.calendar === "lunar"
                ? t("occ.annualLunar", {leap: item.lunarLeap === true ? t("occ.lunarLeap") : "", month: item.date.slice(5, 7).replace(/^0/, ""), day: Number(item.date.slice(8))})
                : t("occ.annual");
        }
        case "monthly": {
            if (item.monthlySubtype === "lastday") return t("occ.monthlyLast");
            if (item.monthlySubtype === "nthweek") return t("occ.monthlyNth", {n: item.nthWeek ?? 1, weekday: wd(item.weekday ?? 0)});
            return t("occ.monthly");
        }
        case "weekly": return t("occ.weeklyWd", {weekday: wd(item.weekday ?? 0)});
        case "quarterly": return t("occ.quarterly");
        case "halfyearly": return t("occ.halfyearly");
        case "interval": return t("occ.intervalDesc", {n: item.intervalCount ?? 1, unit: unit(item.intervalUnit || "month")});
        default: return "";
    }
}

export function toLocalDateKey(date: Date): string {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

/* ===== T-1491 纪念日里程碑投影（只读，不改 Occasion schema；D-280 批次二） =====
   口径：满-N 约定——里程碑日期 = 锚点 + N（天/自然月/年），daysBetweenHalfOpen(锚点, 里程碑) = N，
   文案统一「满 N 天 / 满 N 个月 / 满 N 周年（生日为 N 岁）」。仅 anniversary/birthday 派生；
   农历年度事项只派生「满 N 天」（太阳日计数与农历月日回推不一致，不伪造月/年里程碑）；
   月推进有界 1200 步、年推进有界 200 步，输出确定性排序。 */

export type OccasionMilestoneKind = "days" | "monthly" | "yearly";

export interface OccasionMilestone {
    kind: OccasionMilestoneKind;
    count: number;
    /** 里程碑落点日期。 */
    date: string;
    /** 距 localDate 的天数（0 = 今天就是里程碑）。 */
    daysUntil: number;
}

export const OCCASION_MILESTONE_LADDER: readonly number[] = [100, 200, 300, 365, 500, 1000, 2000, 3000, 4000, 5000, 10000];

export function occasionMilestoneEligible(item: Occasion): boolean {
    return (item.kind === "anniversary" || item.kind === "birthday") && isValidLocalDate(item.date);
}

/** 下一个（含今天命中）里程碑投影，按落点日期升序，最多 limit 个（有界 24）。 */
export function nextOccasionMilestones(item: Occasion, localDate: string, limit = 3): OccasionMilestone[] {
    if (!occasionMilestoneEligible(item) || !isValidLocalDate(localDate)) return [];
    const cappedLimit = Math.max(1, Math.min(24, Math.round(limit) || 3));
    const candidates: OccasionMilestone[] = [];
    const anchor = item.date;
    for (const count of OCCASION_MILESTONE_LADDER) {
        const date = addDays(anchor, count);
        if (!date || date < localDate) continue;
        candidates.push({kind: "days", count, date, daysUntil: differenceInDays(localDate, date)});
    }
    if (item.calendar !== "lunar") {
        const base = parseLocalDate(anchor);
        const anchorMonths = base.getFullYear() * 12 + base.getMonth();
        for (let step = 1; step <= 1200; step += 1) {
            const total = anchorMonths + step;
            const date = monthDate(Math.floor(total / 12), (total % 12) + 1, base.getDate());
            if (date < localDate) continue;
            candidates.push({kind: "monthly", count: step, date, daysUntil: differenceInDays(localDate, date)});
            break;
        }
        const startYear = base.getFullYear();
        for (let step = 1; step <= 200; step += 1) {
            const date = monthDate(startYear + step, base.getMonth() + 1, base.getDate());
            if (date < localDate) continue;
            candidates.push({kind: "yearly", count: step, date, daysUntil: differenceInDays(localDate, date)});
            break;
        }
    }
    candidates.sort((left, right) => left.date.localeCompare(right.date) || left.kind.localeCompare(right.kind));
    return candidates.slice(0, cappedLimit);
}

/** 里程碑文案（事项列表与今日横幅共用单一实现）；生日年里程碑读作「N 岁」。 */
export function describeOccasionMilestone(item: Occasion, milestone: OccasionMilestone): string {
    const core = milestone.kind === "days"
        ? t("occ.milestoneDays", {n: milestone.count})
        : milestone.kind === "monthly"
            ? t("occ.milestoneMonthly", {n: milestone.count})
            : item.kind === "birthday" ? t("occ.milestoneAge", {n: milestone.count}) : t("occ.milestoneYearly", {n: milestone.count});
    return milestone.daysUntil === 0 ? t("occ.milestoneToday", {text: core}) : t("occ.milestoneUpcoming", {text: core, d: milestone.daysUntil});
}

/* ===== T-1492 时间表达升级（只读投影）：自然历跨度 + 长周期进度 ===== */

export interface ElapsedSpan {
    years: number;
    months: number;
    days: number;
}

/** 锚点至 localDate 的自然历跨度（年/月/日三段）。月满以钳制后的锚点日为准
    （锚点 31 日在 2 月按 28/29 日满月）；localDate 早于锚点或非法输入返回 undefined。 */
export function elapsedSpanSince(anchor: string, localDate: string): ElapsedSpan | undefined {
    if (!isValidLocalDate(anchor) || !isValidLocalDate(localDate) || localDate < anchor) return undefined;
    const base = parseLocalDate(anchor);
    const today = parseLocalDate(localDate);
    let months = (today.getFullYear() - base.getFullYear()) * 12 + (today.getMonth() - base.getMonth());
    if (localDate < monthDate(today.getFullYear(), today.getMonth() + 1, base.getDate())) months -= 1;
    if (months < 0) months = 0;
    const anchorPlusMonths = monthDate(base.getFullYear() + Math.floor((base.getMonth() + months) / 12), (base.getMonth() + months) % 12 + 1, base.getDate());
    return {years: Math.floor(months / 12), months: months % 12, days: differenceInDays(anchorPlusMonths, localDate)};
}

/** 跨度本地化组合：跳过前导与中间的零单位（2 年 0 个月 14 天 → 「2 年 14 天」），全零返回空。 */
export function describeElapsedSpan(span: ElapsedSpan): string {
    const parts: string[] = [];
    if (span.years > 0) parts.push(t("occ.spanYear", {n: span.years}));
    if (span.months > 0) parts.push(t("occ.spanMonth", {n: span.months}));
    if (span.days > 0 || !parts.length) parts.push(t("occ.spanDay", {n: span.days}));
    return parts.join(" ");
}

/** 长周期事项的本周期进度（0..1，percent 为四舍五入整数）。只派生太阳历固定周期
    且周期 > 14 天的口径（quarterly/halfyearly/annual-byday/monthly-byday/interval）；
    第 N 个星期 X、月末、农历与一次性事项不派生（前一周期的起点无法无歧义回推）。 */
export function occasionCycleProgress(item: Occasion, localDate: string): {progress: number; percent: number} | undefined {
    if (!isValidLocalDate(localDate) || !isValidLocalDate(item.date)) return undefined;
    if (item.calendar === "lunar" || item.recurrence === "once") return undefined;
    if (item.recurrence === "monthly" && item.monthlySubtype && item.monthlySubtype !== "byday") return undefined;
    if (item.recurrence === "annual" && item.annualSubtype === "nthweek") return undefined;
    const end = getOccurrenceDate(item, localDate);
    if (!end || end < localDate) return undefined;
    const anchorDay = parseLocalDate(item.date).getDate();
    const shiftMonths = (months: number): string => {
        const [endYear, endMonth] = end.split("-").map(Number);
        const index = endYear * 12 + (endMonth - 1) + months;
        return monthDate(Math.floor(index / 12), (index % 12) + 1, anchorDay);
    };
    let prev: string | undefined;
    switch (item.recurrence) {
        case "weekly": prev = addDays(end, -7) ?? undefined; break;
        case "monthly": prev = shiftMonths(-1); break;
        case "quarterly": prev = shiftMonths(-3); break;
        case "halfyearly": prev = shiftMonths(-6); break;
        case "annual": prev = shiftMonths(-12); break;
        case "interval": {
            const count = clampInteger(item.intervalCount, 1, 365, 1);
            prev = item.intervalUnit === "day" ? addDays(end, -count) ?? undefined : shiftMonths(item.intervalUnit === "year" ? -count * 12 : -count);
            break;
        }
        default: return undefined;
    }
    if (!prev || prev >= localDate) return undefined;
    const total = differenceInDays(prev, end);
    if (total < 14) return undefined;
    const progress = Math.min(1, Math.max(0, differenceInDays(prev, localDate) / total));
    return {progress, percent: Math.round(progress * 100)};
}

function differenceInDays(from: string, to: string): number {
    return daysBetweenHalfOpen(from, to) ?? 0;
}

function parseLocalDate(value: string): Date {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function monthDate(year: number, month: number, day: number): string {
    const safeDay = Math.min(day, new Date(year, month, 0).getDate());
    return toLocalDateKey(new Date(year, month - 1, safeDay));
}

function nthWeekdayOfMonth(year: number, month: number, nth: number, weekday: number): string | undefined {
    const first = new Date(year, month - 1, 1);
    const firstWeekday = first.getDay();
    const offset = (weekday - firstWeekday + 7) % 7;
    const day = offset + 1 + (nth - 1) * 7;
    if (day > new Date(year, month, 0).getDate()) return undefined;
    return toLocalDateKey(new Date(year, month - 1, day));
}

function isValidLocalDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    return toLocalDateKey(parseLocalDate(value)) === value;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
    const number = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
    return Math.min(max, Math.max(min, number));
}

function makeOccasionId(): string {
    return "occasion-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/* ===== T-2020 事项 2.0 轻量元数据校验与一句话闪电解析器 ===== */

export function normalizeOccasionTime(raw: unknown): string | undefined {
    if (typeof raw !== "string") return undefined;
    const match = raw.trim().match(/^(\d{1,2}):([0-5]\d)$/);
    if (!match) return undefined;
    const hours = Number(match[1]);
    if (!Number.isInteger(hours) || hours < 0 || hours > 23) return undefined;
    return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

export function normalizeOccasionPriority(raw: unknown): OccasionPriority | undefined {
    if (typeof raw !== "string") return undefined;
    const value = raw.trim().toLowerCase();
    return value === "high" || value === "medium" || value === "low" ? value : undefined;
}

const VALID_OCCASION_CATEGORIES = new Set<OccasionCategory>([
    "birthday", "anniversary", "expense", "renewal", "health", "festival", "scheduled",
]);

export function normalizeOccasionCategory(raw: unknown): OccasionCategory | undefined {
    if (typeof raw !== "string") return undefined;
    const value = raw.trim().toLowerCase() as OccasionCategory;
    return VALID_OCCASION_CATEGORIES.has(value) ? value : undefined;
}

/** T-2028：根据名称/备注与基础 kind 智能识别语义分类（历史存量事项零迁移即可准确分桶）。 */
export function inferOccasionCategory(name: string, note = "", kind: OccasionKind = "scheduled"): OccasionCategory {
    if (kind === "birthday") return "birthday";
    if (kind === "anniversary") return "anniversary";
    const text = `${name || ""} ${note || ""}`;
    if (/(?:生日|生辰|寿辰|诞辰)/.test(text)) return "birthday";
    if (/(?:纪念日|周年|相识|结婚|恋爱|入职)/.test(text)) return "anniversary";
    if (/(?:房贷|车贷|房租|租金|信用卡|花呗|白条|还款|水电|燃气|电费|水费|物业|话费|宽带|保费|社保|医保|账单|交费|缴费|报税|个税|定投|支出)/.test(text)) return "expense";
    if (/(?:续费|会员|订阅|到期|域名|服务器|云盘|iCloud|VIP|Plus|Pro|换证|护照|身份证|驾照|执照)/i.test(text)) return "renewal";
    if (/(?:体检|洗牙|牙医|疫苗|复查|复诊|医院|挂号|买药|驱虫|保养|年检|车检)/.test(text)) return "health";
    if (/(?:春节|元宵|清明|端午|七夕|中秋|重阳|除夕|腊八|母亲节|父亲节|情人节|圣诞|元旦|儿童节|教师节)/.test(text)) return "festival";
    return "scheduled";
}

export function resolveOccasionCategory(item: Pick<Occasion, "name" | "note" | "kind" | "category">): OccasionCategory {
    if (item.category && VALID_OCCASION_CATEGORIES.has(item.category)) return item.category;
    return inferOccasionCategory(item.name, item.note, item.kind);
}

export function occasionCategoryIcon(category: OccasionCategory): string {
    switch (category) {
        case "birthday": return "🎂";
        case "anniversary": return "💍";
        case "expense": return "💳";
        case "renewal": return "🔄";
        case "health": return "🏥";
        case "festival": return "🏮";
        default: return "📌";
    }
}

export function occasionCategoryLabelKey(category: OccasionCategory): string {
    switch (category) {
        case "birthday": return "occ.tplCategoryBirthday";
        case "anniversary": return "occ.tplCategoryAnniversary";
        case "expense": return "occ.tplCategoryExpense";
        case "renewal": return "occ.tplCategoryRenewal";
        case "health": return "occ.tplCategoryHealth";
        case "festival": return "occ.tplCategoryFestival";
        default: return "occ.kindScheduled";
    }
}

export function cleanOccasionBlockRef(raw: unknown): string {
    if (typeof raw !== "string") return "";
    const str = raw.trim();
    const refMatch = str.match(/^\(\(\s*([A-Za-z0-9_-]{10,64})(?:\s+['"].*?['"])?\s*\)\)$/);
    if (refMatch) return refMatch[1];
    const urlMatch = str.match(/siyuan:\/\/blocks\/([A-Za-z0-9_-]{10,64})/);
    if (urlMatch) return urlMatch[1];
    return str;
}

export function validateOccasionBlockRef(raw: unknown): string | undefined {
    const cleaned = cleanOccasionBlockRef(raw);
    return /^[A-Za-z0-9_-]{10,64}$/.test(cleaned) ? cleaned : undefined;
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

const CN_WEEKDAY_MAP: Record<string, number> = {
    "日": 0, "天": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6,
};

/**
 * T-2020：一句话闪电解析器（纯函数，无隐式时钟，以 baseDateKey 为确定性参考日）。
 * 支持相对日期、显式日期、农历/每年/每月/每周、时刻 HH:mm / 中文点钟、优先级标记、提前提醒天数及思源块引用。
 */
export function parseQuickOccasionInput(raw: string, baseDateKey: string): QuickOccasionDraft | undefined {
    if (typeof raw !== "string" || !isValidLocalDate(baseDateKey)) return undefined;
    let working = raw.replace(/[\r\n]+/g, " ").trim();
    if (!working) return undefined;

    // 1. 提取思源块引用 ((id 'title')) 或 siyuan://blocks/id
    let contextBlockId: string | undefined;
    let refFallbackTitle = "";
    working = working.replace(/\(\(\s*([A-Za-z0-9_-]{10,64})(?:\s+['"](.*?)['"])?\s*\)\)/g, (_, id: string, title?: string) => {
        if (!contextBlockId && /^[A-Za-z0-9_-]{10,64}$/.test(id)) contextBlockId = id;
        if (title && title.trim() && !refFallbackTitle) refFallbackTitle = title.trim();
        return " ";
    });
    working = working.replace(/siyuan:\/\/blocks\/([A-Za-z0-9_-]{10,64})/g, (_, id: string) => {
        if (!contextBlockId && /^[A-Za-z0-9_-]{10,64}$/.test(id)) contextBlockId = id;
        return " ";
    });

    // 2. 提取优先级 (!高 / !中 / !低 / #重要 / !!!)
    let priority: OccasionPriority | undefined;
    const prioRules: Array<[RegExp, OccasionPriority]> = [
        [/(?:^|\s)(?:[!！](?:高优?|紧急|重要|high|1)|!{3}|！{3}|#(?:重要|高优|紧急))(?=\s|$)/i, "high"],
        [/(?:^|\s)(?:[!！](?:中|普通|medium|2)|!{2}|！{2}|#(?:中等|关注))(?=\s|$)/i, "medium"],
        [/(?:^|\s)(?:[!！](?:低|low|3)|#低优)(?=\s|$)/i, "low"],
    ];
    for (const [pattern, level] of prioRules) {
        if (pattern.test(working)) {
            priority = level;
            working = working.replace(pattern, " ");
            break;
        }
    }

    // 3. 提取提前提醒天数 (提前N天)
    let explicitRemindDays: number | undefined;
    const remindMatch = working.match(/提前\s*(\d{1,3})\s*天(?:提醒)?/);
    if (remindMatch) {
        explicitRemindDays = clampInteger(Number(remindMatch[1]), 0, 365, 1);
        working = working.replace(remindMatch[0], " ");
    }

    // 4. 提取精确时刻 (15:00 或 下午3点半)
    let time: string | undefined;
    let impliedRelativeOffset: number | undefined;
    const colonTimeMatch = working.match(/(?:(今天|今日|今晚|明天|明日|明早|明晚|后天)\s*)?(上午|早上|晨间|中午|下午|傍晚|晚上)?\s*\b([01]?\d|2[0-3])[:：]([0-5]\d)\b/);
    if (colonTimeMatch) {
        const relWord = colonTimeMatch[1] || "";
        const period = colonTimeMatch[2] || "";
        let hour = Number(colonTimeMatch[3]);
        const min = colonTimeMatch[4];
        if ((period === "下午" || period === "傍晚" || period === "晚上" || relWord === "今晚" || relWord === "明晚") && hour < 12) hour += 12;
        if (relWord.startsWith("今")) impliedRelativeOffset = 0;
        else if (relWord.startsWith("明")) impliedRelativeOffset = 1;
        else if (relWord === "后天") impliedRelativeOffset = 2;
        time = `${String(hour).padStart(2, "0")}:${min}`;
        working = working.replace(colonTimeMatch[0], " ");
    } else {
        const cnTimeMatch = working.match(/(?:(今晚|明早|明晚)\s*|(今天|今日|明天|明日|后天)\s*(上午|早上|晨间|中午|下午|傍晚|晚上)?\s*|(上午|早上|晨间|中午|下午|傍晚|晚上)\s*)?(\d{1,2})\s*(?:点|时)(?:(半)|(\d{1,2})\s*分?)?(?!\s*[前内后])/);
        if (cnTimeMatch && (cnTimeMatch[1] || cnTimeMatch[2] || cnTimeMatch[3] || cnTimeMatch[4] || Number(cnTimeMatch[5]) <= 23)) {
            // 仅当有时间前缀修饰词，或明确写作 X点/X点半/X点Y分 时命中
            const relSpecial = cnTimeMatch[1] || "";
            const relDay = cnTimeMatch[2] || "";
            const period = cnTimeMatch[3] || cnTimeMatch[4] || "";
            let hour = Number(cnTimeMatch[5]);
            const min = cnTimeMatch[6] ? 30 : cnTimeMatch[7] ? Number(cnTimeMatch[7]) : 0;
            if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
                if ((period === "下午" || period === "傍晚" || period === "晚上" || relSpecial === "今晚" || relSpecial === "明晚") && hour < 12) hour += 12;
                else if (period === "中午" && hour >= 1 && hour <= 3) hour += 12;
                if (relSpecial === "今晚" || relDay.startsWith("今")) impliedRelativeOffset = 0;
                else if (relSpecial.startsWith("明") || relDay.startsWith("明")) impliedRelativeOffset = 1;
                else if (relDay === "后天") impliedRelativeOffset = 2;
                time = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
                working = working.replace(cnTimeMatch[0], " ");
            }
        }
    }

    // 5. 提取历法与周期规则
    const baseYear = Number(baseDateKey.slice(0, 4));
    const baseMonth = Number(baseDateKey.slice(5, 7));
    const baseDay = Number(baseDateKey.slice(8, 10));
    let calendar: OccasionCalendar | undefined;
    let lunarLeap = false;
    let recurrence: OccasionRecurrence | undefined;
    let monthlySubtype: MonthlySubtype | undefined;
    let weekday: number | undefined;
    let resolvedDate: string | undefined;

    if (/农历\s*闰/.test(working)) {
        calendar = "lunar";
        lunarLeap = true;
        recurrence = "annual";
        working = working.replace(/农历\s*闰/g, " ");
    } else if (/农历/.test(working)) {
        calendar = "lunar";
        recurrence = "annual";
        working = working.replace(/农历/g, " ");
    }

    const monthlyLastMatch = working.match(/每月(?:底|末|最后一天)/);
    const monthlyDayMatch = working.match(/每月\s*(\d{1,2})\s*[号日]?/);
    const weeklyMatch = working.match(/每周\s*([一二三四五六日天])/);
    if (monthlyLastMatch) {
        recurrence = "monthly";
        monthlySubtype = "lastday";
        resolvedDate = monthDate(baseYear, baseMonth, 31);
        working = working.replace(monthlyLastMatch[0], " ");
    } else if (monthlyDayMatch) {
        const dayNum = clampInteger(Number(monthlyDayMatch[1]), 1, 31, baseDay);
        recurrence = "monthly";
        const thisMonthCandidate = monthDate(baseYear, baseMonth, dayNum);
        const [nextY, nextM] = nextMonthPair(baseYear, baseMonth, 1);
        resolvedDate = thisMonthCandidate >= baseDateKey ? thisMonthCandidate : monthDate(nextY, nextM, dayNum);
        working = working.replace(monthlyDayMatch[0], " ");
    } else if (weeklyMatch) {
        recurrence = "weekly";
        weekday = CN_WEEKDAY_MAP[weeklyMatch[1]] ?? 1;
        const baseDow = parseLocalDate(baseDateKey).getDay();
        const delta = (weekday - baseDow + 7) % 7;
        resolvedDate = addDays(baseDateKey, delta) || baseDateKey;
        working = working.replace(weeklyMatch[0], " ");
    } else if (/每季度/.test(working)) {
        recurrence = "quarterly";
        working = working.replace(/每季度/g, " ");
    } else if (/每半年/.test(working)) {
        recurrence = "halfyearly";
        working = working.replace(/每半年/g, " ");
    } else if (/每年/.test(working)) {
        recurrence = "annual";
        working = working.replace(/每年/g, " ");
    } else if (/每月/.test(working)) {
        recurrence = "monthly";
        working = working.replace(/每月/g, " ");
    }

    // 6. 提取显式或相对日期
    const isoDateMatch = working.match(/\b(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})[日号]?(?!\d)/);
    const mdDateMatch = !isoDateMatch ? working.match(/(?:(正|腊|[一二三四五六七八九十]{1,2}|\d{1,2})\s*月\s*(初[一二三四五六七八九十]|廿[一二三四五六七八九]|三十|[一二三四五六七八九十]{1,3}|\d{1,2})\s*[日号]?)/) : null;
    if (isoDateMatch) {
        const y = Number(isoDateMatch[1]);
        const m = Number(isoDateMatch[2]);
        const d = Number(isoDateMatch[3]);
        const candidate = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (isValidLocalDate(candidate)) {
            resolvedDate = candidate;
            working = working.replace(isoDateMatch[0], " ");
        }
    } else if (mdDateMatch) {
        const m = parseChineseMonthOrNumber(mdDateMatch[1]);
        const d = parseChineseDayOrNumber(mdDateMatch[2]);
        if (m && d) {
            if (calendar === "lunar") {
                const solarThis = lunarToSolar(baseYear, m, d, lunarLeap);
                const solarNext = lunarToSolar(baseYear + 1, m, d, lunarLeap);
                const keyThis = solarThis ? toLocalDateKey(solarThis) : undefined;
                const keyNext = solarNext ? toLocalDateKey(solarNext) : undefined;
                resolvedDate = (keyThis && keyThis >= baseDateKey ? keyThis : (keyNext || keyThis)) || baseDateKey;
            } else {
                const candidateThis = monthDate(baseYear, m, d);
                resolvedDate = candidateThis >= baseDateKey ? candidateThis : monthDate(baseYear + 1, m, d);
            }
            working = working.replace(mdDateMatch[0], " ");
        }
    }

    if (!resolvedDate) {
        const afterDaysMatch = working.match(/(\d{1,3})\s*天后/);
        const weekdayRelMatch = working.match(/(下周|本周|这周|周|星期)([一二三四五六日天])/);
        if (afterDaysMatch) {
            resolvedDate = addDays(baseDateKey, clampInteger(Number(afterDaysMatch[1]), 0, 365, 0)) || baseDateKey;
            working = working.replace(afterDaysMatch[0], " ");
        } else if (weekdayRelMatch) {
            const prefix = weekdayRelMatch[1];
            const targetDow = CN_WEEKDAY_MAP[weekdayRelMatch[2]] ?? 1;
            const baseDow = parseLocalDate(baseDateKey).getDay();
            let delta = (targetDow - baseDow + 7) % 7;
            if (prefix === "下周") {
                const daysToNextMonday = ((8 - (baseDow === 0 ? 7 : baseDow)) % 7) || 7;
                const offsetFromMonday = targetDow === 0 ? 6 : targetDow - 1;
                delta = daysToNextMonday + offsetFromMonday;
            }
            resolvedDate = addDays(baseDateKey, delta) || baseDateKey;
            working = working.replace(weekdayRelMatch[0], " ");
        } else if (/(?:^|\s)(?:大后天)(?=\s|$)/.test(working) || working.includes("大后天")) {
            resolvedDate = addDays(baseDateKey, 3) || baseDateKey;
            working = working.replace(/大后天/g, " ");
        } else if (working.includes("后天")) {
            resolvedDate = addDays(baseDateKey, 2) || baseDateKey;
            working = working.replace(/后天/g, " ");
        } else if (/(?:明天|明日|tomorrow)/i.test(working)) {
            resolvedDate = addDays(baseDateKey, 1) || baseDateKey;
            working = working.replace(/(?:明天|明日|tomorrow)/gi, " ");
        } else if (/(?:今天|今日|today)/i.test(working)) {
            resolvedDate = baseDateKey;
            working = working.replace(/(?:今天|今日|today)/gi, " ");
        } else if (impliedRelativeOffset !== undefined) {
            resolvedDate = addDays(baseDateKey, impliedRelativeOffset) || baseDateKey;
        }
    }

    const finalDate = resolvedDate || baseDateKey;

    // 7. 清理剩余文本作为标题，并智能推断事项类别与合理默认周期
    let cleanName = working.replace(/\s+/g, " ").replace(/^[-·,，。:：]+|[-·,，。:：]+$/g, "").trim();
    if (!cleanName && refFallbackTitle) cleanName = refFallbackTitle;
    cleanName = cleanName.slice(0, 120).trim();
    if (!cleanName) return undefined;

    let kind: OccasionKind = "scheduled";
    if (/(?:生日|生辰|寿辰|诞辰)/.test(cleanName)) {
        kind = "birthday";
        if (!recurrence) recurrence = "annual";
    } else if (/(?:纪念日|周年|相识|结婚|恋爱|入职)/.test(cleanName)) {
        kind = "anniversary";
        if (!recurrence) recurrence = "annual";
    }
    const inferredCategory = inferOccasionCategory(cleanName, "", kind);
    const finalRecurrence: OccasionRecurrence = recurrence || (inferredCategory === "expense" ? "monthly" : inferredCategory === "renewal" || inferredCategory === "festival" ? "annual" : "once");
    const defaultRemind = kind === "birthday" || kind === "anniversary" || inferredCategory === "renewal" || inferredCategory === "health"
        ? 7
        : finalRecurrence === "once"
            ? (finalDate === baseDateKey ? 0 : 1)
            : 3;

    return {
        name: cleanName,
        kind,
        category: inferredCategory,
        date: finalDate,
        recurrence: finalRecurrence,
        ...(calendar ? {calendar} : {}),
        ...(lunarLeap ? {lunarLeap: true} : {}),
        ...(monthlySubtype ? {monthlySubtype} : {}),
        ...(weekday !== undefined ? {weekday} : {}),
        remindBeforeDays: explicitRemindDays ?? defaultRemind,
        ...(time ? {time} : {}),
        ...(priority ? {priority} : {}),
        ...(contextBlockId ? {contextBlockId} : {}),
        note: "",
    };
}

/** T-2024：格式化闪电解析草案的人类可读摘要标签。 */
export function formatQuickOccasionPreview(draft: QuickOccasionDraft): string {
    const cat = draft.category || inferOccasionCategory(draft.name, "", draft.kind);
    const icon = occasionCategoryIcon(cat);
    const tempItem: Occasion = {
        id: "",
        name: draft.name,
        kind: draft.kind,
        category: cat,
        date: draft.date,
        recurrence: draft.recurrence,
        calendar: draft.calendar,
        lunarLeap: draft.lunarLeap,
        monthlySubtype: draft.monthlySubtype,
        weekday: draft.weekday,
        remindBeforeDays: draft.remindBeforeDays,
        time: draft.time,
        priority: draft.priority,
        contextBlockId: draft.contextBlockId,
        note: "",
        enabled: true,
        completedDates: [],
        createdAt: "",
        updatedAt: "",
    };
    const parts = [`${icon} ${draft.name}`, t(occasionCategoryLabelKey(cat)), draft.time ? `${draft.date} ${draft.time}` : draft.date, describeRecurrence(tempItem)];
    if (draft.priority) {
        parts.push(t(draft.priority === "high" ? "occ.priorityHigh" : draft.priority === "medium" ? "occ.priorityMedium" : "occ.priorityLow"));
    }
    if (draft.remindBeforeDays > 0) parts.push(t("occ.remindSummary", {n: draft.remindBeforeDays}));
    if (draft.contextBlockId) parts.push("📎");
    return parts.filter(Boolean).join(" · ");
}

function parseChineseMonthOrNumber(token: string): number | undefined {
    const tStr = token.trim();
    if (/^\d+$/.test(tStr)) {
        const n = Number(tStr);
        return n >= 1 && n <= 12 ? n : undefined;
    }
    const map: Record<string, number> = {
        "正": 1, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6,
        "七": 7, "八": 8, "九": 9, "十": 10, "十一": 11, "十二": 12, "腊": 12,
    };
    return map[tStr];
}

function parseChineseDayOrNumber(token: string): number | undefined {
    const tStr = token.trim();
    if (/^\d+$/.test(tStr)) {
        const n = Number(tStr);
        return n >= 1 && n <= 31 ? n : undefined;
    }
    const digits: Record<string, number> = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10};
    if (tStr.startsWith("初") && tStr.length === 2 && digits[tStr[1]]) return digits[tStr[1]];
    if (tStr === "十") return 10;
    if (tStr.startsWith("十") && tStr.length === 2 && digits[tStr[1]]) return 10 + digits[tStr[1]];
    if (tStr === "二十") return 20;
    if (tStr.startsWith("廿") && tStr.length === 2 && digits[tStr[1]]) return 20 + digits[tStr[1]];
    if (tStr.startsWith("二十") && tStr.length === 3 && digits[tStr[2]]) return 20 + digits[tStr[2]];
    if (tStr === "三十") return 30;
    if (tStr === "三十一") return 31;
    return digits[tStr];
}

