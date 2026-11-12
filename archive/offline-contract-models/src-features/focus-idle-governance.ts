/* T-1538 专注计时闲置暂停与净时长口径治理模型（D-695）。
   核心原则：
   1. 尊重番茄承诺制（strict_pomodoro）：不可随意插队扣除，全有全无；
   2. 支持宽松净时长（relaxed_net_duration）：空闲超阈值自动暂停，显式区分「净时长 / 闲置扣除」双口径；
   3. 零隐式篡改：任何扣除或自动暂停必须显式透明告知用户，严禁静默丢时长。 */

export type FocusPolicyMode = "strict_pomodoro" | "relaxed_net_duration";

export interface FocusIdleConfig {
    readonly mode: FocusPolicyMode;
    readonly idleThresholdSec: number; // 默认 180 (3分钟) 或 300 (5分钟)
    readonly autoPauseOnIdle: boolean;
}

export interface FocusIdleEvaluation {
    readonly isIdle: boolean;
    readonly idleDeductedSec: number;
    readonly netFocusSec: number;
    readonly grossElapsedSec: number;
    readonly shouldAutoPause: boolean;
    readonly statusNoteKey: string;
}

export const DEFAULT_IDLE_THRESHOLD_SEC = 180; // 3 分钟未活动判定为闲置

export function createDefaultFocusIdleConfig(mode: FocusPolicyMode = "strict_pomodoro"): FocusIdleConfig {
    return Object.freeze({
        mode,
        idleThresholdSec: DEFAULT_IDLE_THRESHOLD_SEC,
        autoPauseOnIdle: mode === "relaxed_net_duration",
    });
}

/** 评估专注计时过程中的单步闲置状态与时长扣除计算。 */
export function evaluateFocusIdleStep(
    grossElapsedSec: number,
    lastActivityDeltaSec: number,
    config: FocusIdleConfig
): FocusIdleEvaluation {
    const gross = Math.max(0, Math.floor(grossElapsedSec));
    const delta = Math.max(0, Math.floor(lastActivityDeltaSec));
    const threshold = Math.max(30, config.idleThresholdSec);

    if (delta <= threshold) {
        return Object.freeze({
            isIdle: false,
            idleDeductedSec: 0,
            netFocusSec: gross,
            grossElapsedSec: gross,
            shouldAutoPause: false,
            statusNoteKey: "focus.active",
        });
    }

    // 超过闲置阈值
    if (config.mode === "strict_pomodoro") {
        // 严格番茄制：承诺不可拆分，绝不静默扣除时间，但输出闲置警示
        return Object.freeze({
            isIdle: true,
            idleDeductedSec: 0,
            netFocusSec: gross,
            grossElapsedSec: gross,
            shouldAutoPause: false, // 严格番茄钟不自动静默暂停，由用户决定是否放弃
            statusNoteKey: "focus.idlePrompt",
        });
    }

    // 宽松净时长模式：超时部分计入闲置扣除
    const excessIdle = delta - threshold;
    const idleDeducted = Math.min(gross, excessIdle);
    const net = Math.max(0, gross - idleDeducted);

    return Object.freeze({
        isIdle: true,
        idleDeductedSec: idleDeducted,
        netFocusSec: net,
        grossElapsedSec: gross,
        shouldAutoPause: config.autoPauseOnIdle,
        statusNoteKey: "focus.idlePaused",
    });
}

/** 格式化双口径显示文本（如主显净时长，副显闲置扣除）。 */
export function formatDualDurationDisplay(
    netSec: number,
    idleDeductedSec: number
): {mainMinutes: number; idleMinutes: number; hasDeduction: boolean; summary: string} {
    const netMinutes = Math.floor(netSec / 60);
    const idleMinutes = Math.floor(idleDeductedSec / 60);
    const hasDeduction = idleMinutes > 0;

    const summary = hasDeduction
        ? `净专注 ${netMinutes} 分钟（闲置扣除 ${idleMinutes} 分钟）`
        : `专注 ${netMinutes} 分钟`;

    return Object.freeze({
        mainMinutes: netMinutes,
        idleMinutes,
        hasDeduction,
        summary,
    });
}
