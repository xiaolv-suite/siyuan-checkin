/* T-1753, T-1763 & T-1764：外观低风险偏好、场景化设置组合包与 AI 配置草案边界模型（纯逻辑、无时钟、确定性）。
   1. 低风险外观与操作建议（T-1753）：仅依据宿主/系统媒体查询，绝不强加个人审美，绝不重置自定义配色和头像；
   2. 场景化设置组合包（T-1763）：四大典型预设包（极简低打扰/手动专注/阅读自动记账/笔记文档输出），支持部分采用，零破坏性操作；
   3. 自然语言“帮我配置”AI 草案边界（T-1764）：AI 仅生成可审阅的配置草案，严禁直出操作指令；
      零 Key、零笔记路径、零历史外发红线；必须经过用户表单差异审阅后手动保存。 */

export interface SystemMediaEnvironment {
    readonly prefersDarkMode: boolean;
    readonly prefersReducedMotion: boolean;
    readonly hostLanguage: "zh-CN" | "en-US" | "other";
    readonly isTouchDevice: boolean;
}

export interface AppearanceRecommendation {
    readonly theme: "system" | "light" | "dark";
    readonly language: "zh-CN" | "en-US" | "follow";
    readonly motion: "auto";
    readonly haptic: boolean;
    readonly preservePaletteAndAvatar: true;
}

/** 基于可验证系统环境推导低风险外观建议（T-1753）。 */
export function deriveAppearancePreferencesRecommendation(
    env: SystemMediaEnvironment
): AppearanceRecommendation {
    const theme = env.prefersDarkMode ? "system" : "system"; // 推荐跟随宿主与系统
    const language = env.hostLanguage === "zh-CN" ? "zh-CN" : env.hostLanguage === "en-US" ? "en-US" : "follow";
    return {
        theme,
        language,
        motion: "auto",
        haptic: env.isTouchDevice,
        preservePaletteAndAvatar: true, // 核心守门：自定义调色板与头像绝不重置
    };
}

// === T-1763 场景化设置组合包 ===

export type ScenarioPackId = "minimal_calm" | "manual_focus" | "reading_automation" | "doc_journaling";

export interface ScenarioSettingItem {
    readonly fieldKey: string;
    readonly proposedValue: unknown;
    readonly impactDescriptionKey: string;
}

export interface ScenarioPackDefinition {
    readonly id: ScenarioPackId;
    readonly titleKey: string;
    readonly descriptionKey: string;
    readonly settings: readonly ScenarioSettingItem[];
    readonly containsDestructiveAction: false;
}

export const SCENARIO_SETTING_PACKS: readonly ScenarioPackDefinition[] = Object.freeze([
    {
        id: "minimal_calm",
        titleKey: "set.pack.minimalCalmTitle",
        descriptionKey: "set.pack.minimalCalmDesc",
        containsDestructiveAction: false,
        settings: [
            { fieldKey: "quiet_hours_enabled", proposedValue: true, impactDescriptionKey: "set.pack.quietHours" },
            { fieldKey: "quiet_hours_range", proposedValue: { start: "23:00", end: "07:00" }, impactDescriptionKey: "set.pack.quietRange" },
            { fieldKey: "occasion_remind_once", proposedValue: true, impactDescriptionKey: "set.pack.occasionOnce" },
        ],
    },
    {
        id: "manual_focus",
        titleKey: "set.pack.manualFocusTitle",
        descriptionKey: "set.pack.manualFocusDesc",
        containsDestructiveAction: false,
        settings: [
            { fieldKey: "quick_entry_nlp", proposedValue: true, impactDescriptionKey: "set.pack.nlpQuick" },
            { fieldKey: "focus_provider", proposedValue: "builtin", impactDescriptionKey: "set.pack.builtinTimer" },
            { fieldKey: "week_strip", proposedValue: true, impactDescriptionKey: "set.pack.weekStrip" },
        ],
    },
    {
        id: "reading_automation",
        titleKey: "set.pack.readingAutoTitle",
        descriptionKey: "set.pack.readingAutoDesc",
        containsDestructiveAction: false,
        settings: [
            { fieldKey: "weread_threshold_minutes", proposedValue: 15, impactDescriptionKey: "set.pack.wereadThreshold" },
        ],
    },
    {
        id: "doc_journaling",
        titleKey: "set.pack.docJournalTitle",
        descriptionKey: "set.pack.docJournalDesc",
        containsDestructiveAction: false,
        settings: [
            { fieldKey: "journal_integration_mode", proposedValue: "daily-append", impactDescriptionKey: "set.pack.journalMode" },
        ],
    },
]);

export interface PackAdoptionPlan {
    readonly packId: ScenarioPackId;
    readonly adoptedFields: Readonly<Record<string, unknown>>;
    readonly isSafeToApply: boolean;
}

/** 规划组合包的部分采纳（T-1763）。 */
export function planScenarioPackAdoption(
    packId: ScenarioPackId,
    selectedFieldKeys: readonly string[]
): PackAdoptionPlan {
    const pack = SCENARIO_SETTING_PACKS.find((p) => p.id === packId);
    if (!pack) {
        return { packId, adoptedFields: {}, isSafeToApply: false };
    }

    const adopted: Record<string, unknown> = {};
    for (const item of pack.settings) {
        if (selectedFieldKeys.includes(item.fieldKey)) {
            adopted[item.fieldKey] = item.proposedValue;
        }
    }

    return {
        packId,
        adoptedFields: Object.freeze(adopted),
        isSafeToApply: Object.keys(adopted).length > 0,
    };
}

// === T-1764 自然语言 AI 设置草案安全边界 ===

export interface AiSettingDraftPayload {
    readonly promptText: string;
    readonly proposedDrafts: Readonly<Record<string, unknown>>;
    readonly containsSensitiveKeyAttempt?: boolean;
    readonly containsDocDeletionAttempt?: boolean;
}

export interface AiSettingDraftValidation {
    readonly isValidDraft: boolean;
    readonly rejectedReasons: readonly string[];
    readonly sanitizedDrafts: Readonly<Record<string, unknown>>;
}

const FORBIDDEN_AI_FIELD_TARGETS = new Set([
    "reset_all_preferences",
    "restore_snapshot",
    "import_overwrite",
    "clear_audit_history",
    "weread_api_key",
]);

/** 严格校验 AI 生成的自然语言设置草案，阻断危险操作与凭据篡改（T-1764）。 */
export function validateAiSettingDraftProposal(
    proposal: AiSettingDraftPayload
): AiSettingDraftValidation {
    const rejected: string[] = [];
    const sanitized: Record<string, unknown> = {};

    if (proposal.containsSensitiveKeyAttempt) {
        rejected.push("ai_attempted_to_set_private_key");
    }
    if (proposal.containsDocDeletionAttempt) {
        rejected.push("ai_attempted_to_alter_or_delete_docs");
    }

    for (const [field, val] of Object.entries(proposal.proposedDrafts)) {
        if (FORBIDDEN_AI_FIELD_TARGETS.has(field)) {
            rejected.push(`forbidden_field_${field}`);
            continue;
        }
        sanitized[field] = val;
    }

    return {
        isValidDraft: rejected.length === 0,
        rejectedReasons: Object.freeze(rejected),
        sanitizedDrafts: Object.freeze(sanitized),
    };
}
