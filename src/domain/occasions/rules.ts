import {lunarToSolar, solarToLunar} from "../../lunar";
import {t} from "../../i18n";
import {addDays, daysBetweenHalfOpen} from "../../date-keys";
import type {
    ElapsedSpan,
    IntervalUnit,
    MonthlySubtype,
    Occasion,
    OccasionCalendar,
    OccasionCategory,
    OccasionKind,
    OccasionMilestone,
    OccasionPriority,
    OccasionRecurrence,
    OccasionStore,
    OccasionTemplate,
    QuickOccasionDraft,
    VisibleOccasion,
} from "./types";
import {OCCASION_MILESTONE_LADDER} from "./types";

export function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(num)));
}

export function isValidLocalDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function isValidOccasionDate(value: string): boolean {
    return isValidLocalDate(value);
}

export function toLocalDateKey(date: Date): string {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

export function weekdayName(index: number): string {
    return t(`occ.wd${clampInteger(index, 0, 6, 0)}`);
}

export function occasionTemplateName(template: OccasionTemplate): string {
    return t(template.nameKey) || template.name;
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

export function differenceInDays(from: string, to: string): number {
    return daysBetweenHalfOpen(from, to) ?? 0;
}

export function parseLocalDate(value: string): Date {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

export function monthDate(year: number, month: number, day: number): string {
    const maxDays = new Date(year, month, 0).getDate();
    const clampedDay = Math.min(day, maxDays);
    return year + "-" + String(month).padStart(2, "0") + "-" + String(clampedDay).padStart(2, "0");
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

export function getOccurrenceDate(item: Occasion, localDate: string): string | undefined {
    if (!isValidLocalDate(localDate)) return undefined;
    const overrides = item.overrides || {};
    let earliest: string | undefined;
    for (const moved of Object.values(overrides)) {
        if (!moved || !isValidLocalDate(moved.date) || moved.date < localDate) continue;
        if (!earliest || moved.date < earliest) earliest = moved.date;
    }

    let candidate = calculateBaseOccurrenceDate(item, localDate);
    let guard = 0;
    while (candidate && overrides[candidate] && guard < 12) {
        guard += 1;
        const nextLocal = addDays(candidate, 1);
        if (!nextLocal) break;
        candidate = calculateBaseOccurrenceDate(item, nextLocal);
    }

    if (!candidate && !earliest) return undefined;
    if (!candidate) return earliest;
    if (!earliest) return candidate;
    return candidate <= earliest ? candidate : earliest;
}

function calculateBaseOccurrenceDate(item: Occasion, localDate: string): string | undefined {
    switch (item.recurrence) {
        case "once": return item.date >= localDate ? item.date : undefined;
        case "annual": return annualOccurrence(item, localDate);
        case "monthly": return monthlyOccurrence(item, localDate);
        case "weekly": return weeklyOccurrence(item, localDate);
        case "quarterly":
        case "halfyearly":
            return stepMonthlyOccurrence(item, localDate, item.recurrence === "quarterly" ? 3 : 6);
        case "interval": return intervalOccurrence(item, localDate);
        default: return undefined;
    }
}

function annualOccurrence(item: Occasion, localDate: string): string | undefined {
    if (item.annualSubtype === "nthweek") return annualNthWeekOccurrence(item, localDate);
    return item.calendar === "lunar" ? annualLunarOccurrence(item, localDate) : annualSolarOccurrence(item, localDate);
}

function annualSolarOccurrence(item: Occasion, localDate: string): string | undefined {
    const monthDay = item.date.slice(5);
    const year = Number(localDate.slice(0, 4));
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
    const isLeap = item.lunarLeap === true;
    const leapCandidates = isLeap ? [true, false] as const : [false] as const;
    for (const candidateYear of [year - 1, year, year + 1, year + 2]) {
        for (const leapFlag of leapCandidates) {
            const solar = lunarToSolar(candidateYear, lunar.month, lunar.day, leapFlag);
            if (!solar) continue;
            const key = toLocalDateKey(solar);
            if (key >= localDate && key >= item.date) return key;
        }
    }
    return undefined;
}

function annualNthWeekOccurrence(item: Occasion, localDate: string): string | undefined {
    const targetYear = parseLocalDate(localDate).getFullYear();
    const month = clampInteger(item.month, 1, 12, 1);
    const nth = clampInteger(item.nthWeek, 1, 5, 1);
    const weekday = clampInteger(item.weekday, 0, 6, 0);
    for (let year = targetYear; year <= targetYear + 2; year += 1) {
        const candidate = getNthWeekdayOfMonth(year, month, nth, weekday);
        if (candidate && candidate >= localDate && candidate >= item.date) return candidate;
    }
    return undefined;
}

function monthlyOccurrence(item: Occasion, localDate: string): string | undefined {
    if (item.monthlySubtype === "nthweek") return monthlyNthWeekOccurrence(item, localDate);
    if (item.monthlySubtype === "lastday") return monthlyLastDayOccurrence(item, localDate);
    return monthlyByDayOccurrence(item, localDate);
}

function monthlyByDayOccurrence(item: Occasion, localDate: string): string | undefined {
    const anchorDay = parseLocalDate(item.date).getDate();
    const target = parseLocalDate(localDate);
    for (let shift = 0; shift <= 24; shift += 1) {
        const year = target.getFullYear() + Math.floor((target.getMonth() + shift) / 12);
        const month = ((target.getMonth() + shift) % 12) + 1;
        const candidate = monthDate(year, month, anchorDay);
        if (candidate >= localDate && candidate >= item.date) return candidate;
    }
    return undefined;
}

function monthlyLastDayOccurrence(item: Occasion, localDate: string): string | undefined {
    const target = parseLocalDate(localDate);
    for (let shift = 0; shift <= 24; shift += 1) {
        const year = target.getFullYear() + Math.floor((target.getMonth() + shift) / 12);
        const month = ((target.getMonth() + shift) % 12) + 1;
        const lastDay = new Date(year, month, 0).getDate();
        const candidate = monthDate(year, month, lastDay);
        if (candidate >= localDate && candidate >= item.date) return candidate;
    }
    return undefined;
}

function monthlyNthWeekOccurrence(item: Occasion, localDate: string): string | undefined {
    const target = parseLocalDate(localDate);
    const nth = clampInteger(item.nthWeek, 1, 5, 1);
    const weekday = clampInteger(item.weekday, 0, 6, 0);
    for (let shift = 0; shift <= 24; shift += 1) {
        const year = target.getFullYear() + Math.floor((target.getMonth() + shift) / 12);
        const month = ((target.getMonth() + shift) % 12) + 1;
        const candidate = getNthWeekdayOfMonth(year, month, nth, weekday);
        if (candidate && candidate >= localDate && candidate >= item.date) return candidate;
    }
    return undefined;
}

function getNthWeekdayOfMonth(year: number, month: number, nth: number, weekday: number): string | undefined {
    const firstDay = new Date(year, month - 1, 1);
    const firstWeekday = firstDay.getDay();
    const offset = (weekday - firstWeekday + 7) % 7;
    const targetDay = 1 + offset + (nth - 1) * 7;
    const maxDays = new Date(year, month, 0).getDate();
    if (targetDay > maxDays) return undefined;
    return monthDate(year, month, targetDay);
}

function weeklyOccurrence(item: Occasion, localDate: string): string | undefined {
    const target = parseLocalDate(localDate);
    const targetWeekday = target.getDay();
    const wantedWeekday = clampInteger(item.weekday, 0, 6, 0);
    const offset = (wantedWeekday - targetWeekday + 7) % 7;
    const candidate = toLocalDateKey(new Date(target.getFullYear(), target.getMonth(), target.getDate() + offset));
    return candidate >= item.date ? candidate : undefined;
}

function stepMonthlyOccurrence(item: Occasion, localDate: string, step: number): string | undefined {
    const seed = parseLocalDate(item.date);
    const seedMonth = seed.getMonth() + 1;
    const seedDay = seed.getDate();
    let [year, month] = localDate.split("-").slice(0, 2).map(Number);
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

function intervalOccurrence(item: Occasion, localDate: string): string | undefined {
    if (!isValidLocalDate(item.date) || item.date > localDate) return isValidLocalDate(item.date) && item.date >= localDate ? item.date : undefined;
    const count = clampInteger(item.intervalCount, 1, 365, 1);
    const unit = item.intervalUnit || "month";
    if (unit === "day") {
        const diff = differenceInDays(item.date, localDate);
        const steps = Math.ceil(diff / count);
        const parsed = parseLocalDate(item.date);
        return toLocalDateKey(new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + steps * count));
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
    const target = resolveOverrideTarget(item, previous);
    if (!target || target >= localDate) return undefined;
    return item.completedDates.includes(target) ? undefined : target;
}

export function resolveOverrideTarget(item: Occasion, date: string): string {
    let current = date;
    for (let guard = 0; guard < 8; guard += 1) {
        const override = item.overrides?.[current];
        if (!override || !isValidLocalDate(override.date) || override.date === current) break;
        current = override.date;
    }
    return current;
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

export function occasionMilestoneEligible(item: Occasion): boolean {
    return (item.kind === "anniversary" || item.kind === "birthday") && isValidLocalDate(item.date);
}

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

export function describeOccasionMilestone(item: Occasion, milestone: OccasionMilestone): string {
    const core = milestone.kind === "days"
        ? t("occ.milestoneDays", {n: milestone.count})
        : milestone.kind === "monthly"
            ? t("occ.milestoneMonthly", {n: milestone.count})
            : item.kind === "birthday" ? t("occ.milestoneAge", {n: milestone.count}) : t("occ.milestoneYearly", {n: milestone.count});
    return milestone.daysUntil === 0 ? t("occ.milestoneToday", {text: core}) : t("occ.milestoneUpcoming", {text: core, d: milestone.daysUntil});
}

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

export function describeElapsedSpan(span: ElapsedSpan): string {
    const parts: string[] = [];
    if (span.years > 0) parts.push(t("occ.spanYear", {n: span.years}));
    if (span.months > 0) parts.push(t("occ.spanMonth", {n: span.months}));
    if (span.days > 0 || !parts.length) parts.push(t("occ.spanDay", {n: span.days}));
    return parts.join(" ");
}

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

export function nextMonthPair(year: number, month: number, step: number): [number, number] {
    const index = year * 12 + (month - 1) + step;
    return [Math.floor(index / 12), (index % 12) + 1];
}

const CN_WEEKDAY_MAP: Record<string, number> = {
    "日": 0, "天": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6,
};

export function parseQuickOccasionInput(raw: string, baseDateKey: string): QuickOccasionDraft | undefined {
    if (typeof raw !== "string" || !isValidLocalDate(baseDateKey)) return undefined;
    let working = raw.replace(/[\r\n]+/g, " ").trim();
    if (!working) return undefined;

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

    let explicitRemindDays: number | undefined;
    const remindMatch = working.match(/提前\s*(\d{1,3})\s*天(?:提醒)?/);
    if (remindMatch) {
        explicitRemindDays = clampInteger(Number(remindMatch[1]), 0, 365, 1);
        working = working.replace(remindMatch[0], " ");
    }

    let time: string | undefined;
    let impliedRelativeOffset: number | undefined;
    const colonTimeMatch = working.match(/(?:(今天|今日|今晚|明天|明日|明早|明晚|后天)\s*)?(上午|早上|晨间|中午|下午|傍晚|晚上)?\s*\b([01]?\d|2[0-3])[:：]([0-5]\d)\b/);
    if (colonTimeMatch) {
        const relWord = colonTimeMatch[1] || "";
        const period = colonTimeMatch[2] || "";
        let hour = Number(colonTimeMatch[3]);
        const min = colonTimeMatch[4];
        if ((period === "下午" || period === "傍晚" || period === "晚上" || relWord === "今晚" || relWord === "明晚") && hour >= 1 && hour < 12) hour += 12;
        if (relWord.startsWith("今")) impliedRelativeOffset = 0;
        else if (relWord.startsWith("明")) impliedRelativeOffset = 1;
        else if (relWord === "后天") impliedRelativeOffset = 2;
        time = `${String(hour).padStart(2, "0")}:${min}`;
        working = working.replace(colonTimeMatch[0], " ");
    } else {
        const cnTimeMatch = working.match(/(?:(今晚|明早|明晚)\s*|(今天|今日|明天|明日|后天)\s*(上午|早上|晨间|中午|下午|傍晚|晚上)?\s*|(上午|早上|晨间|中午|下午|傍晚|晚上)\s*)?(\d{1,2})\s*(?:点|时)(?:(半)|(\d{1,2})\s*分?)?(?!\s*[前内后])/);
        if (cnTimeMatch && (cnTimeMatch[1] || cnTimeMatch[2] || cnTimeMatch[3] || cnTimeMatch[4] || Number(cnTimeMatch[5]) <= 23)) {
            const relSpecial = cnTimeMatch[1] || "";
            const relDay = cnTimeMatch[2] || "";
            const period = cnTimeMatch[3] || cnTimeMatch[4] || "";
            let hour = Number(cnTimeMatch[5]);
            const min = cnTimeMatch[6] ? 30 : cnTimeMatch[7] ? Number(cnTimeMatch[7]) : 0;
            if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
                if ((period === "下午" || period === "傍晚" || period === "晚上" || relSpecial === "今晚" || relSpecial === "明晚") && hour >= 1 && hour < 12) hour += 12;
                else if (period === "中午" && hour >= 1 && hour <= 3) hour += 12;
                if (relSpecial === "今晚" || relDay.startsWith("今")) impliedRelativeOffset = 0;
                else if (relSpecial.startsWith("明") || relDay.startsWith("明")) impliedRelativeOffset = 1;
                else if (relDay === "后天") impliedRelativeOffset = 2;
                time = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
                working = working.replace(cnTimeMatch[0], " ");
            }
        }
    }

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
