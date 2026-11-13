/* T-1726：事项多桶备份迁移与 ICS 导出研究纯模型（D-634）。
   定义事项至 RFC 5545 iCalendar (ICS) 的纯函数转换、农历损耗降级、
   单次改期投影，以及多桶备份 envelope 的分类决断与回滚防护。
   纯函数，无隐式时钟，受 CLOCK_FREE_MODULES 保护。 */

import type {Occasion} from "../occasions";
import {lunarToSolar} from "../lunar";

/** T-1726：转义 ICS 文本字段（RFC 5545 §3.3.11）。 */
export function escapeIcsText(text: string): string {
    if (!text || typeof text !== "string") return "";
    return text
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");
}

/** T-1726：格式化日历日为 ICS 全天事件日期格式 YYYYMMDD。 */
export function formatIcsDate(localDate: string): string {
    return localDate.replace(/-/g, "");
}

export interface IcsExportOptions {
    /** 农历事项在 ICS 中展开的未来年数（默认 3 年，因为 RFC 5545 不支持农历循环）。 */
    lunarUnrollYears?: number;
    /** 基准参考年份（默认从传入的锚点年份或 2026 开始）。 */
    baseYear?: number;
}

/** T-1726：单条事项转换为 VEVENT 字符串块。 */
export function generateOccasionIcsEvent(item: Occasion, options: IcsExportOptions = {}): string {
    const lines: string[] = [];
    const uid = `occasion-${item.id}@siyuan-checkin`;
    const summary = escapeIcsText(item.name);
    const description = escapeIcsText(item.note || "");

    // 农历事项特殊处理：RFC 5545 无农历支持，展开未来 N 年公历对应日
    if (item.recurrence === "annual" && item.calendar === "lunar") {
        const unrollYears = options.lunarUnrollYears ?? 3;
        const baseYear = options.baseYear ?? Number(item.date.slice(0, 4));
        const lunarMonth = Number(item.date.slice(5, 7));
        const lunarDay = Number(item.date.slice(8, 10));
        const isLeap = item.lunarLeap === true;

        const unrolledEvents: string[] = [];
        for (let offset = 0; offset < unrollYears; offset += 1) {
            const targetYear = baseYear + offset;
            const solarDate = lunarToSolar(targetYear, lunarMonth, lunarDay, isLeap);
            if (!solarDate) continue;

            const solarLocalDate = solarDate.getFullYear() + "-" + String(solarDate.getMonth() + 1).padStart(2, "0") + "-" + String(solarDate.getDate()).padStart(2, "0");

            const subLines: string[] = [
                "BEGIN:VEVENT",
                `UID:${uid}-${targetYear}`,
                `DTSTAMP:${formatIcsDate(item.createdAt.slice(0, 10))}T000000Z`,
                `DTSTART;VALUE=DATE:${formatIcsDate(solarLocalDate)}`,
                `SUMMARY:${summary} (农历)`,
                `X-LUNAR-ORIGIN:${item.date}`,
            ];
            if (description) {
                subLines.push(`DESCRIPTION:${description}`);
            }
            subLines.push("END:VEVENT");
            unrolledEvents.push(subLines.join("\r\n"));
        }
        return unrolledEvents.join("\r\n");
    }

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${formatIcsDate(item.createdAt.slice(0, 10))}T000000Z`);
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(item.date)}`);
    lines.push(`SUMMARY:${summary}`);
    if (description) {
        lines.push(`DESCRIPTION:${description}`);
    }

    // RRULE 规则映射
    switch (item.recurrence) {
        case "annual":
            if (item.annualSubtype === "nthweek" && typeof item.month === "number" && typeof item.nthWeek === "number" && typeof item.weekday === "number") {
                const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
                lines.push(`RRULE:FREQ=YEARLY;BYMONTH=${item.month};BYDAY=${item.nthWeek}${days[item.weekday]}`);
            } else {
                lines.push("RRULE:FREQ=YEARLY");
            }
            break;
        case "monthly":
            if (item.monthlySubtype === "nthweek" && typeof item.nthWeek === "number" && typeof item.weekday === "number") {
                const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
                lines.push(`RRULE:FREQ=MONTHLY;BYDAY=${item.nthWeek}${days[item.weekday]}`);
            } else if (item.monthlySubtype === "lastday") {
                lines.push("RRULE:FREQ=MONTHLY;BYMONTHDAY=-1");
            } else {
                lines.push("RRULE:FREQ=MONTHLY");
            }
            break;
        case "weekly":
            if (typeof item.weekday === "number") {
                const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
                lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${days[item.weekday]}`);
            } else {
                lines.push("RRULE:FREQ=WEEKLY");
            }
            break;
        case "quarterly":
            lines.push("RRULE:FREQ=MONTHLY;INTERVAL=3");
            break;
        case "halfyearly":
            lines.push("RRULE:FREQ=MONTHLY;INTERVAL=6");
            break;
        case "interval": {
            const count = Math.max(1, item.intervalCount ?? 1);
            if (item.intervalUnit === "day") {
                lines.push(`RRULE:FREQ=DAILY;INTERVAL=${count}`);
            } else if (item.intervalUnit === "year") {
                lines.push(`RRULE:FREQ=YEARLY;INTERVAL=${count}`);
            } else {
                lines.push(`RRULE:FREQ=MONTHLY;INTERVAL=${count}`);
            }
            break;
        }
        case "once":
        default:
            // 单次事项不带 RRULE
            break;
    }

    lines.push("END:VEVENT");
    return lines.join("\r\n");
}

/** T-1726：构建完整 VCALENDAR 文档。 */
export function buildOccasionsIcsCalendar(
    items: readonly Occasion[],
    options: IcsExportOptions = {}
): string {
    const header = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SiYuan//Checkin Occasions v18//CN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:小驴打卡·日期事项",
    ];

    const body = items
        .filter((item) => item.enabled)
        .map((item) => generateOccasionIcsEvent(item, options))
        .filter(Boolean)
        .join("\r\n");

    const footer = "END:VCALENDAR";

    return `${header.join("\r\n")}\r\n${body}\r\n${footer}\r\n`;
}

/** T-1726：多桶备份 envelope 中事项与提醒动作两桶的决断模型。 */
export interface OccasionEnvelopeResolution {
    bucketKey: string;
    category: "mutation" | "overwrite";
    defaultResolution: "overwrite" | "merge";
    sensitive: boolean;
    supportsRollbackSnapshot: true;
    explanationKey: string;
}

export function evaluateOccasionEnvelopeResolution(bucketKey: string): OccasionEnvelopeResolution {
    if (bucketKey === "checkin-reminder-actions") {
        return {
            bucketKey,
            category: "overwrite",
            defaultResolution: "merge",
            sensitive: true, // 包含用户个性化推迟与静音偏好，需显式授权
            supportsRollbackSnapshot: true,
            explanationKey: "envelope.reminderActions.mergeAudit",
        };
    }
    // checkin-occasion-store
    return {
        bucketKey: "checkin-occasion-store",
        category: "mutation",
        defaultResolution: "overwrite",
        sensitive: false,
        supportsRollbackSnapshot: true,
        explanationKey: "envelope.occasionStore.winnerMerge",
    };
}
