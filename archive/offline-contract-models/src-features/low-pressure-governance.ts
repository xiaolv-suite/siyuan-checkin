/* T-1678：习惯产品与低压力交互基线更新纯模型（研究与规则收敛）。
   规范提醒降噪、断签容忍、休眠暂停、低压力成就与 Calm 禁则文案校验，
   无隐式时钟，纯函数，受 CLOCK_FREE_MODULES 保护。 */

/** T-1678：提醒降噪判定上下文。 */
export interface ReminderDenoiseContext {
    itemId: string;
    asOfDate: string; // YYYY-MM-DD
    isItemCompleted: boolean;
    isItemSkipped?: boolean;
    isItemPaused?: boolean;
    pausedUntil?: string; // YYYY-MM-DD
    quietRange?: {
        startMinutes: number; // 0..1439
        endMinutes: number;   // 0..1439
    };
    currentMinute?: number; // 0..1439
    remindersDeliveredToday?: number;
    dailyBudget?: number; // 默认 2 次
}

export type ReminderDenoiseReason =
    | "completed-today"
    | "skipped-today"
    | "item-paused"
    | "in-quiet-hours"
    | "daily-budget-reached"
    | "eligible";

export interface ReminderDenoiseDecision {
    shouldRemind: boolean;
    reason: ReminderDenoiseReason;
    detailsKey: string;
}

/** T-1678：评估提醒是否应当被降噪静音。
    竞品教训：Loop Habit Tracker issue #1573（打卡后仍弹通知造成严重打扰）。
    不变量：已打卡、已跳过、休眠期、安静时段与超限额提醒必须 100% 压制。 */
export function evaluateReminderDenoising(context: ReminderDenoiseContext): ReminderDenoiseDecision {
    if (context.isItemCompleted) {
        return {
            shouldRemind: false,
            reason: "completed-today",
            detailsKey: "reminder.denoise.completed",
        };
    }
    if (context.isItemSkipped) {
        return {
            shouldRemind: false,
            reason: "skipped-today",
            detailsKey: "reminder.denoise.skipped",
        };
    }
    // 检查项目是否处于休眠或假期中
    const isPaused = context.isItemPaused || (context.pausedUntil ? context.pausedUntil >= context.asOfDate : false);
    if (isPaused) {
        return {
            shouldRemind: false,
            reason: "item-paused",
            detailsKey: "reminder.denoise.paused",
        };
    }
    // 检查是否在安静免打扰时段内（支持跨午夜判断）
    if (context.quietRange && typeof context.currentMinute === "number") {
        const {startMinutes, endMinutes} = context.quietRange;
        const now = context.currentMinute;
        const inQuietHours = startMinutes <= endMinutes
            ? (now >= startMinutes && now < endMinutes)
            : (now >= startMinutes || now < endMinutes);
        if (inQuietHours) {
            return {
                shouldRemind: false,
                reason: "in-quiet-hours",
                detailsKey: "reminder.denoise.quietHours",
            };
        }
    }
    // 检查是否达到每日提醒预算上限
    const budget = context.dailyBudget ?? 2;
    if ((context.remindersDeliveredToday ?? 0) >= budget) {
        return {
            shouldRemind: false,
            reason: "daily-budget-reached",
            detailsKey: "reminder.denoise.budgetReached",
        };
    }

    return {
        shouldRemind: true,
        reason: "eligible",
        detailsKey: "reminder.denoise.eligible",
    };
}

/** T-1678：断签容忍与双日规则判定上下文。 */
export interface StreakToleranceContext {
    consecutiveMissedDays: number;
    streakTolerance?: number; // maxGap 配置，缺省为 0
    hasExplicitSkip?: boolean;
    currentStreak: number;
}

export type StreakToleranceStatus =
    | "continuous"
    | "tolerated-single-gap"
    | "skip-neutral-bridge"
    | "needs-rhythm-recovery";

export interface StreakToleranceDecision {
    isTolerated: boolean;
    status: StreakToleranceStatus;
    effectiveStreak: number;
    messageKey: string;
}

/** T-1678：评估连击容错状态与双日规则。
    循证依据：断一天是数据，连断两天才是信号；单日中断对习惯自动性影响微弱。
    Duolingo 反例红线：坚决杜绝“付费买道具修补连击”等出局暗模式（dark pattern）。 */
export function evaluateStreakTolerance(context: StreakToleranceContext): StreakToleranceDecision {
    if (context.consecutiveMissedDays <= 0) {
        return {
            isTolerated: true,
            status: "continuous",
            effectiveStreak: context.currentStreak,
            messageKey: "streak.continuous",
        };
    }
    if (context.hasExplicitSkip) {
        // SKIP 显式跳过，中性桥接，不破坏连续也不计入天数
        return {
            isTolerated: true,
            status: "skip-neutral-bridge",
            effectiveStreak: context.currentStreak,
            messageKey: "streak.skipNeutral",
        };
    }
    const maxGap = Math.max(0, context.streakTolerance ?? 0);
    if (context.consecutiveMissedDays <= maxGap || context.consecutiveMissedDays === 1) {
        // 双日规则：单日漏卡在容错范围内视为中性观察数据
        return {
            isTolerated: true,
            status: "tolerated-single-gap",
            effectiveStreak: context.currentStreak,
            messageKey: "report.stalledNote", // "断一天是数据，连断两天才是信号"
        };
    }
    // 连续断 2 天及以上，平静重置，不使用“归零/失败”措辞
    return {
        isTolerated: false,
        status: "needs-rhythm-recovery",
        effectiveStreak: 0,
        messageKey: "streak.needsRhythmRecovery", // "找回节奏，随时重新起步"
    };
}

/** T-1678：休眠/假期暂停状态评估上下文。 */
export interface ItemPauseContext {
    isPaused?: boolean;
    isItemPaused?: boolean;
    pausedUntil?: string; // YYYY-MM-DD
    asOfDate: string;     // YYYY-MM-DD
}

export interface ItemPauseDecision {
    isPaused: boolean;
    exemptFromStalled: boolean;
    silenceReminders: boolean;
    statusTextKey: string;
}

/** T-1678：评估项目休眠/假期状态。
    真实场景：用户生病、出差、考试周等阶段性休止。
    原则：休眠期内豁免失速分析、压制提醒、冻结衰减，解除后无痛复苏。 */
export function evaluateItemPauseState(context: ItemPauseContext): ItemPauseDecision {
    const isPaused = Boolean(
        context.isItemPaused || (context.pausedUntil ? context.pausedUntil >= context.asOfDate : false)
    );
    if (isPaused) {
        return {
            isPaused: true,
            exemptFromStalled: true,
            silenceReminders: true,
            statusTextKey: "pause.onVacation",
        };
    }
    return {
        isPaused: false,
        exemptFromStalled: false,
        silenceReminders: false,
        statusTextKey: "pause.active",
    };
}

/** T-1678：低压力成就评估上下文。 */
export interface LowPressureAchievementCriteria {
    achievementId: string;
    targetMetric: number;
    currentProgress: number;
    isNegativeDeductionRequested?: boolean; // 外部请求扣分
    isDemotionRequested?: boolean;          // 外部请求掉级
    isLeaderboardShaming?: boolean;         // 外部请求社交排行施压
}

export interface LowPressureAchievementDecision {
    isQualified: boolean;
    milestoneLevelReached: number;
    cappedProgress: number;
    isPermanent: true;
    antiDarkPatternCompliant: boolean;
    rejectionReason?: string;
}

/** 戒断/连续阶梯里程碑固定参考（T-1415 沉淀） */
export const LOW_PRESSURE_MILESTONES = [1, 3, 7, 14, 30, 60, 90, 180, 365] as const;

/** T-1678：评估低压力成就与反暗模式合规性。
    红线原则：
    1. 成就永久保活（只进不退、不设到期、不因漏卡被剥夺）；
    2. 坚决拒绝任何扣分、扣灵石、掉级（修仙打卡反例深评结论）；
    3. 超额完成封顶 1.5 倍奖励，防刷防刷单（mhabit 经验）；
    4. 零社交排行榜，零同伴羞辱。 */
export function evaluateLowPressureAchievement(
    criteria: LowPressureAchievementCriteria
): LowPressureAchievementDecision {
    // 检查是否存在暗模式侵入
    if (criteria.isNegativeDeductionRequested || criteria.isDemotionRequested || criteria.isLeaderboardShaming) {
        return {
            isQualified: false,
            milestoneLevelReached: 0,
            cappedProgress: 0,
            isPermanent: true,
            antiDarkPatternCompliant: false,
            rejectionReason: "Dark pattern rejected: deductions, demotions and social ranking are forbidden.",
        };
    }

    // 超额上限 1.5 倍，防止刷单
    const maxAllowed = criteria.targetMetric * 1.5;
    const cappedProgress = Math.min(Math.max(0, criteria.currentProgress), maxAllowed);

    // 匹配最高达成的里程碑阶梯
    let milestoneLevelReached = 0;
    for (const milestone of LOW_PRESSURE_MILESTONES) {
        if (cappedProgress >= milestone) {
            milestoneLevelReached = milestone;
        } else {
            break;
        }
    }

    const isQualified = cappedProgress >= criteria.targetMetric;

    return {
        isQualified,
        milestoneLevelReached,
        cappedProgress,
        isPermanent: true,
        antiDarkPatternCompliant: true,
    };
}

/** T-1678：Calm 文案禁则词表与替换推荐。 */
export const CALM_PROHIBITED_WORDS = [
    "你落后了",
    "前功尽弃",
    "归零",
    "失败",
    "惩罚",
    "罚款",
    "补签收费",
    "掉级",
    "落后他人",
    "you've fallen behind",
    "back to zero",
    "failed",
    "penalty",
    "demoted",
    "shame",
] as const;

export const CALM_REPLACEMENTS: Readonly<Record<string, string>> = {
    "你落后了": "按自己的节奏调整",
    "前功尽弃": "每一份记录都算数",
    "归零": "找回节奏/重新起步",
    "失败": "数据记录/暂未达成",
    "惩罚": "中性跳过/休息调整",
    "补签收费": "自由补记/免责补录",
    "掉级": "里程碑永久点亮",
    "you've fallen behind": "adjust at your own pace",
    "back to zero": "reset & find your rhythm",
    "failed": "recorded data",
    "penalty": "neutral break",
};

export interface CalmCopyValidationResult {
    isCalm: boolean;
    prohibitedMatches: string[];
    suggestedReplacements: Record<string, string>;
}

/** T-1678：Calm 文案校验器——防止用户可见界面或 AI 生成内容引入愧疚/羞耻/惩罚文案。 */
export function validateCalmCopy(text: string): CalmCopyValidationResult {
    if (!text || typeof text !== "string") {
        return {
            isCalm: true,
            prohibitedMatches: [],
            suggestedReplacements: {},
        };
    }
    const lower = text.toLowerCase();
    const prohibitedMatches: string[] = [];
    const suggestedReplacements: Record<string, string> = {};

    for (const word of CALM_PROHIBITED_WORDS) {
        if (text.includes(word) || lower.includes(word.toLowerCase())) {
            prohibitedMatches.push(word);
            if (CALM_REPLACEMENTS[word]) {
                suggestedReplacements[word] = CALM_REPLACEMENTS[word];
            }
        }
    }

    return {
        isCalm: prohibitedMatches.length === 0,
        prohibitedMatches,
        suggestedReplacements,
    };
}
