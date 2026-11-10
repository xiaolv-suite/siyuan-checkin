/* T-1727 ~ T-1731：事项体系深度研究与治理纯模型（D-635）。
   覆盖多选批量管理边界判定、自然语言条目意图分类、阶梯提醒调度与日历视图投影规约。
   纯函数，无隐式时钟，受 CLOCK_FREE_MODULES 保护。 */

import type {Occasion} from "../occasions";
import {daysBetweenHalfOpen} from "../date-keys";

/** T-1727：批量操作安全评估。
    不变量：
    1. 批量启停安全；
    2. 批量删除必须二次确认，并生成批量墓碑；
    3. 严禁对不同发生日的事项执行批量改期；
    4. 批量完成必须在同发生日下才允许，严禁跨日期盲目批量完成。 */
export type BatchOccasionAction = "enable" | "disable" | "delete" | "reschedule" | "complete";

export interface BatchOccasionEvaluationResult {
    isAllowed: boolean;
    safeCount: number;
    requiresConfirm: boolean;
    rejectionReason?: string;
}

export function evaluateBatchOccasionOperation(
    action: BatchOccasionAction,
    targetOccasions: readonly Occasion[],
    params: { sharedDate?: string } = {}
): BatchOccasionEvaluationResult {
    if (!targetOccasions || targetOccasions.length === 0) {
        return {
            isAllowed: false,
            safeCount: 0,
            requiresConfirm: false,
            rejectionReason: "No occasions selected for batch operation.",
        };
    }

    if (action === "enable" || action === "disable") {
        return {
            isAllowed: true,
            safeCount: targetOccasions.length,
            requiresConfirm: false,
        };
    }

    if (action === "delete") {
        return {
            isAllowed: true,
            safeCount: targetOccasions.length,
            requiresConfirm: true, // 强制二次确认
        };
    }

    if (action === "reschedule") {
        // 事项各具独立基点，批量强行改期会破坏各自的周期与纪念日语义
        return {
            isAllowed: false,
            safeCount: 0,
            requiresConfirm: false,
            rejectionReason: "Batch reschedule across occasions with different anchor dates is forbidden.",
        };
    }

    if (action === "complete") {
        // 只有显式指定了同日（如今日到期筛选区），或者全选条目同属一次性且锚点日期一致
        if (!params.sharedDate) {
            return {
                isAllowed: false,
                safeCount: 0,
                requiresConfirm: false,
                rejectionReason: "Batch complete requires an explicit shared occurrence date.",
            };
        }
        return {
            isAllowed: true,
            safeCount: targetOccasions.length,
            requiresConfirm: false,
        };
    }

    return {
        isAllowed: false,
        safeCount: 0,
        requiresConfirm: false,
        rejectionReason: "Unknown batch action.",
    };
}

/** T-1730：阶梯提醒策略评估（支持提前 N 天、N 天、当天多梯度）。 */
export interface LadderRemindEvaluationResult {
    shouldRemindToday: boolean;
    matchedLadderDay: number | null;
    isOverdue: boolean;
}

export function evaluateLadderRemindSchedule(
    occurrenceDate: string,
    currentDate: string,
    ladderDays: readonly number[] = [7, 3, 1, 0]
): LadderRemindEvaluationResult {
    if (!occurrenceDate || !currentDate) {
        return {shouldRemindToday: false, matchedLadderDay: null, isOverdue: false};
    }

    const daysUntil = daysBetweenHalfOpen(currentDate, occurrenceDate);
    if (daysUntil === undefined) {
        return {shouldRemindToday: false, matchedLadderDay: null, isOverdue: false};
    }

    // 逾期
    if (daysUntil < 0) {
        return {shouldRemindToday: false, matchedLadderDay: null, isOverdue: true};
    }

    // 匹配阶梯
    for (const step of ladderDays) {
        if (daysUntil === step) {
            return {
                shouldRemindToday: true,
                matchedLadderDay: step,
                isOverdue: false,
            };
        }
    }

    return {
        shouldRemindToday: false,
        matchedLadderDay: null,
        isOverdue: false,
    };
}

/** T-1731：自然语言条目分类器（打卡项目 vs 日期事项 vs 一次性提醒）。 */
export type EntryClassificationCategory = "checkin-item" | "occasion" | "one-shot-reminder";

export interface EntryClassificationResult {
    category: EntryClassificationCategory;
    confidence: number;
    detectedKeywords: string[];
    rationale: string;
    suggestedRecurrence?: string;
}

const HABIT_KEYWORDS = ["每天", "每周", "坚持", "习惯", "打卡", "背单词", "跑步", "阅读", "健身", "喝水", "冥想", "daily", "every week", "habit"];
const OCCASION_KEYWORDS = ["生日", "纪念日", "周年", "还房贷", "交房租", "年检", "保费", "节", "新年", "周年纪念", "birthday", "anniversary", "rent", "mortgage"];
const REMINDER_KEYWORDS = ["明天", "后天", "下午", "晚上", "开会", "取快递", "买菜", "提醒我", "todo", "meeting", "package"];

export function classifyNaturalLanguageEntry(text: string): EntryClassificationResult {
    if (!text || typeof text !== "string") {
        return {
            category: "one-shot-reminder",
            confidence: 0,
            detectedKeywords: [],
            rationale: "Empty input defaulted to one-shot reminder.",
        };
    }

    const lower = text.toLowerCase();

    // 匹配习惯打卡
    const habitMatches = HABIT_KEYWORDS.filter((k) => text.includes(k) || lower.includes(k));
    if (habitMatches.length > 0) {
        return {
            category: "checkin-item",
            confidence: 0.85 + Math.min(0.14, habitMatches.length * 0.05),
            detectedKeywords: habitMatches,
            rationale: "Matches recurring habit and frequency patterns.",
            suggestedRecurrence: text.includes("每周") ? "weekly" : "daily",
        };
    }

    // 匹配日期事项
    const occasionMatches = OCCASION_KEYWORDS.filter((k) => text.includes(k) || lower.includes(k));
    if (occasionMatches.length > 0) {
        return {
            category: "occasion",
            confidence: 0.88 + Math.min(0.11, occasionMatches.length * 0.05),
            detectedKeywords: occasionMatches,
            rationale: "Matches milestone, birthday, anniversary, or recurring bill patterns.",
            suggestedRecurrence: text.includes("房租") || text.includes("房贷") ? "monthly" : "annual",
        };
    }

    // 默认或单次提醒
    const reminderMatches = REMINDER_KEYWORDS.filter((k) => text.includes(k) || lower.includes(k));
    return {
        category: "one-shot-reminder",
        confidence: reminderMatches.length > 0 ? 0.75 : 0.5,
        detectedKeywords: reminderMatches,
        rationale: "Matches transient or temporary reminder patterns without habit or annual occasion markers.",
        suggestedRecurrence: "once",
    };
}
