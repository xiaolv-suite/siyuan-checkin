/* T-1733：设置字段推荐适用性总表与治理模型（纯逻辑、无时钟、确定性）。
   依据 docs/settings-field-registry-2026-09-28.md 的 A 显式保存/B 即时保存/C 动作/D 只读四类，
   逐字段标明“通用默认/本地证据推荐/必须人工选择/不可推荐”，坚决杜绝把动作、凭据与只读状态硬塞进推荐值。 */

export type SaveSemantics = "A_explicit" | "B_immediate" | "C_action" | "D_readonly";

export type RecommendationApplicability =
    | "universal_default" // 可给通用默认（无偏向的合理默认值）
    | "evidence_based"    // 可按本地证据推荐（根据打卡时段、安装插件推导）
    | "manual_required"   // 必须人工选择（特定文档、笔记本ID、凭据、危险动作）
    | "not_applicable";   // 不可推荐（严禁提供推荐值：C 动作类与 D 只读状态行）

export type RiskLevel = "low" | "medium" | "high";

export type SectionId = "appearance_nav" | "today_reminders" | "integrations" | "data_recovery";

export type ConfirmationGranularity = "none" | "single_field" | "section_batch" | "danger_modal";

export interface SettingsFieldRecommendationDescriptor {
    readonly key: string;
    readonly attribute?: string;
    readonly section: SectionId;
    readonly card: string;
    readonly semantics: SaveSemantics;
    readonly applicability: RecommendationApplicability;
    readonly defaultValue: unknown;
    readonly dependencies: readonly string[];
    readonly risk: RiskLevel;
    readonly storageBucket: string | null;
    readonly impactScope: string;
    readonly confirmationGranularity: ConfirmationGranularity;
    readonly rationale: string;
}

export const SETTINGS_RECOMMENDATION_REGISTRY: readonly SettingsFieldRecommendationDescriptor[] = Object.freeze([
    // === 1. 外观与操作 (appearance_nav) ===
    {
        key: "theme",
        attribute: "data-setting-appearance",
        section: "appearance_nav",
        card: "appearance",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: "auto",
        dependencies: [],
        risk: "low",
        storageBucket: "checkin-view-preferences",
        impactScope: "UI 整体明暗配色",
        confirmationGranularity: "none",
        rationale: "跟随思源宿主或系统外观，最符合直觉与预期",
    },
    {
        key: "language",
        attribute: "data-setting-language",
        section: "appearance_nav",
        card: "appearance",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: "auto",
        dependencies: [],
        risk: "low",
        storageBucket: "checkin-view-preferences",
        impactScope: "全站界面双语文案",
        confirmationGranularity: "none",
        rationale: "跟随思源宿主语言，杜绝双语不一致",
    },
    {
        key: "open_mode",
        attribute: "data-setting-open-mode",
        section: "appearance_nav",
        card: "dialog",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: "dialog",
        dependencies: [],
        risk: "low",
        storageBucket: "checkin-view-preferences",
        impactScope: "顶部主入口打开呈现形式",
        confirmationGranularity: "none",
        rationale: "模态弹窗为思源插件标准沉浸式工作区",
    },
    {
        key: "quick_entry_nlp",
        attribute: "data-setting-quick-entry-nlp",
        section: "appearance_nav",
        card: "today_view",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: true,
        dependencies: [],
        risk: "low",
        storageBucket: "checkin-view-preferences",
        impactScope: "今日视图顶部自然语言速记栏",
        confirmationGranularity: "none",
        rationale: "低摩擦快速记账首选能力，默认开启",
    },
    {
        key: "motion",
        attribute: "data-setting-motion",
        section: "appearance_nav",
        card: "appearance",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: "auto",
        dependencies: [],
        risk: "low",
        storageBucket: "checkin-view-preferences",
        impactScope: "卡片折叠与微交互动效持续时间",
        confirmationGranularity: "none",
        rationale: "跟随系统 prefers-reduced-motion 媒体查询",
    },
    {
        key: "haptic",
        attribute: "data-setting-haptic",
        section: "appearance_nav",
        card: "appearance",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: true,
        dependencies: [],
        risk: "low",
        storageBucket: "checkin-view-preferences",
        impactScope: "移动端点击物理振动反馈",
        confirmationGranularity: "none",
        rationale: "移动端打卡触觉确认，桌面端静默无害",
    },
    {
        key: "palette",
        attribute: "data-setting-palette",
        section: "appearance_nav",
        card: "appearance",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: "violet",
        dependencies: [],
        risk: "low",
        storageBucket: "checkin-view-preferences",
        impactScope: "品牌紫罗兰主色及阶梯",
        confirmationGranularity: "none",
        rationale: "小驴打卡标志性紫罗兰主色，对比度达标",
    },
    {
        key: "avatar",
        attribute: "data-setting-avatar",
        section: "appearance_nav",
        card: "appearance",
        semantics: "B_immediate",
        applicability: "manual_required",
        defaultValue: "",
        dependencies: [],
        risk: "medium",
        storageBucket: "checkin-view-preferences",
        impactScope: "用户个性化形象与打卡卡片落款",
        confirmationGranularity: "single_field",
        rationale: "用户个人身份表达，不可由算法推测或强加",
    },
    {
        key: "dialog_mode",
        attribute: "data-setting-dialog-mode",
        section: "appearance_nav",
        card: "dialog",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: "auto",
        dependencies: [],
        risk: "low",
        storageBucket: "checkin-view-preferences",
        impactScope: "弹窗尺寸响应式自适应策略",
        confirmationGranularity: "none",
        rationale: "视口自适应可保证各分辨率下的最佳显示",
    },
    {
        key: "shortcuts_doc",
        section: "appearance_nav",
        card: "shortcuts",
        semantics: "D_readonly",
        applicability: "not_applicable",
        defaultValue: null,
        dependencies: [],
        risk: "low",
        storageBucket: null,
        impactScope: "快捷键指南展示",
        confirmationGranularity: "none",
        rationale: "只读帮助文档，无持久化配置",
    },

    // === 2. 今日与提醒 (today_reminders) ===
    {
        key: "group_mode",
        attribute: "data-setting-group",
        section: "today_reminders",
        card: "today_view",
        semantics: "B_immediate",
        applicability: "evidence_based",
        defaultValue: "schedule",
        dependencies: [],
        risk: "low",
        storageBucket: "checkin-view-preferences",
        impactScope: "今日待办项目分组聚类呈现",
        confirmationGranularity: "none",
        rationale: "若用户定义了丰富标签或时间段，可智能推荐时段/分组排序",
    },
    {
        key: "sort_mode",
        attribute: "data-setting-sort",
        section: "today_reminders",
        card: "today_view",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: "order",
        dependencies: [],
        risk: "low",
        storageBucket: "checkin-view-preferences",
        impactScope: "卡片手动与优先级顺序",
        confirmationGranularity: "none",
        rationale: "尊重用户在编辑页安排的自定义 order 顺序",
    },
    {
        key: "completed_folded",
        attribute: "data-setting-completed",
        section: "today_reminders",
        card: "today_view",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: false,
        dependencies: [],
        risk: "low",
        storageBucket: "checkin-view-preferences",
        impactScope: "完成区卡片是否折叠入底部折叠项",
        confirmationGranularity: "none",
        rationale: "默认展开已完成项给予正向成就反馈，避免盲目折叠",
    },
    {
        key: "week_strip",
        attribute: "data-setting-weekstrip",
        section: "today_reminders",
        card: "today_view",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: true,
        dependencies: [],
        risk: "low",
        storageBucket: "checkin-view-preferences",
        impactScope: "顶部周历快捷跳选条",
        confirmationGranularity: "none",
        rationale: "帮助用户洞察近 7 日连续节奏与补记入口",
    },
    {
        key: "quiet_hours_enabled",
        attribute: "data-setting-quiet",
        section: "today_reminders",
        card: "reminders",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: true,
        dependencies: [],
        risk: "medium",
        storageBucket: "checkin-view-preferences",
        impactScope: "夜间系统通知静音防护",
        confirmationGranularity: "none",
        rationale: "低压力原则核心基线：默认杜绝夜间打扰",
    },
    {
        key: "quiet_hours_range",
        attribute: "data-setting-quiet-range",
        section: "today_reminders",
        card: "reminders",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: {start: "23:00", end: "07:00"},
        dependencies: ["quiet_hours_enabled"],
        risk: "medium",
        storageBucket: "checkin-view-preferences",
        impactScope: "夜间静音半开时间区间",
        confirmationGranularity: "none",
        rationale: "符合大多数用户作息的 23:00~07:00 黄金免打扰区间",
    },
    {
        key: "reminder_daily_toggle",
        attribute: "data-setting-reminder-toggle",
        section: "today_reminders",
        card: "reminders",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: true,
        dependencies: [],
        risk: "medium",
        storageBucket: "checkin-view-preferences",
        impactScope: "思源宿主顶部通知下发",
        confirmationGranularity: "none",
        rationale: "主功能核心触达手段",
    },
    {
        key: "reminder_slots",
        attribute: "data-setting-reminder-slots",
        section: "today_reminders",
        card: "reminders",
        semantics: "A_explicit",
        applicability: "evidence_based",
        defaultValue: ["09:00", "20:00"],
        dependencies: ["reminder_daily_toggle"],
        risk: "medium",
        storageBucket: "checkin-view-preferences",
        impactScope: "每日提醒轮询时刻",
        confirmationGranularity: "section_batch",
        rationale: "可分析用户历史打卡时刻聚类（如晨间早起、晚间总结）自适应推荐最佳提醒点",
    },
    {
        key: "occasion_remind_once",
        attribute: "data-setting-occasion-once",
        section: "today_reminders",
        card: "reminders",
        semantics: "B_immediate",
        applicability: "universal_default",
        defaultValue: true,
        dependencies: [],
        risk: "low",
        storageBucket: "checkin-view-preferences",
        impactScope: "事项提前提醒防重复打扰",
        confirmationGranularity: "none",
        rationale: "避免每个事项的提前预警在同一天重复弹窗",
    },

    // === 3. 联动与目标 (integrations) ===
    {
        key: "focus_provider",
        attribute: "data-setting-focus-timer",
        section: "integrations",
        card: "host_capabilities",
        semantics: "B_immediate",
        applicability: "evidence_based",
        defaultValue: "builtin",
        dependencies: [],
        risk: "medium",
        storageBucket: "checkin-view-preferences",
        impactScope: "打卡专注计时后端服务",
        confirmationGranularity: "none",
        rationale: "根据环境中是否挂载 Dock Tomato 适配器，若探测健康则推荐桥接，否则推荐内置专注",
    },
    {
        key: "journal_integration_mode",
        attribute: "data-journal-mode",
        section: "integrations",
        card: "journal",
        semantics: "A_explicit",
        applicability: "evidence_based",
        defaultValue: "daily-append",
        dependencies: [],
        risk: "medium",
        storageBucket: "checkin-view-preferences",
        impactScope: "日记自动追加写入模式",
        confirmationGranularity: "section_batch",
        rationale: "根据用户是否存在日常日记习惯推荐文档单向追加，不改正文",
    },
    {
        key: "journal_notebook_id",
        attribute: "data-journal-notebook-id",
        section: "integrations",
        card: "journal",
        semantics: "A_explicit",
        applicability: "manual_required",
        defaultValue: "",
        dependencies: ["journal_integration_mode"],
        risk: "high",
        storageBucket: "checkin-view-preferences",
        impactScope: "日记自动创建目标笔记本",
        confirmationGranularity: "section_batch",
        rationale: "涉及具体思源笔记资产，必须由用户显式选定目标笔记本，绝不猜测",
    },
    {
        key: "journal_target_doc",
        attribute: "data-journal-target-doc",
        section: "integrations",
        card: "journal",
        semantics: "A_explicit",
        applicability: "manual_required",
        defaultValue: "",
        dependencies: ["journal_integration_mode"],
        risk: "high",
        storageBucket: "checkin-view-preferences",
        impactScope: "固定打卡汇总输出目标文档",
        confirmationGranularity: "section_batch",
        rationale: "写入外部笔记文档属不可逆持久化，必须人工明确选定",
    },
    {
        key: "weread_api_key",
        attribute: "data-weread-key",
        section: "integrations",
        card: "weread",
        semantics: "A_explicit",
        applicability: "manual_required",
        defaultValue: "",
        dependencies: [],
        risk: "high",
        storageBucket: "checkin-view-preferences",
        impactScope: "微信读书私有账密凭据",
        confirmationGranularity: "section_batch",
        rationale: "私人凭据只能由用户手工输入，绝不提供默认值或自动推测",
    },
    {
        key: "weread_threshold_minutes",
        attribute: "data-weread-threshold",
        section: "integrations",
        card: "weread",
        semantics: "A_explicit",
        applicability: "universal_default",
        defaultValue: 15,
        dependencies: ["weread_api_key"],
        risk: "medium",
        storageBucket: "checkin-view-preferences",
        impactScope: "每日阅读达标自动打卡门槛分钟数",
        confirmationGranularity: "section_batch",
        rationale: "15 分钟为公认微阅读低门槛黄金时长",
    },
    {
        key: "sireader_pull_action",
        section: "integrations",
        card: "sireader",
        semantics: "C_action",
        applicability: "not_applicable",
        defaultValue: null,
        dependencies: [],
        risk: "medium",
        storageBucket: null,
        impactScope: "立即探测思阅阅读进度",
        confirmationGranularity: "single_field",
        rationale: "动作类执行指令，不可作为静态偏好推荐",
    },
    {
        key: "api_v5_contract_status",
        section: "integrations",
        card: "host_capabilities",
        semantics: "D_readonly",
        applicability: "not_applicable",
        defaultValue: null,
        dependencies: [],
        risk: "low",
        storageBucket: null,
        impactScope: "API 开放能力探测状态",
        confirmationGranularity: "none",
        rationale: "系统运行态事实呈现，不可推荐",
    },

    // === 4. 数据与恢复 (data_recovery) ===
    {
        key: "backup_export_action",
        section: "data_recovery",
        card: "backup",
        semantics: "C_action",
        applicability: "not_applicable",
        defaultValue: null,
        dependencies: [],
        risk: "low",
        storageBucket: null,
        impactScope: "导出多桶全量备份数据包",
        confirmationGranularity: "single_field",
        rationale: "主动数据导出动作，非持久化配置",
    },
    {
        key: "backup_import_action",
        section: "data_recovery",
        card: "backup",
        semantics: "C_action",
        applicability: "not_applicable",
        defaultValue: null,
        dependencies: [],
        risk: "high",
        storageBucket: null,
        impactScope: "导入外部数据包覆盖或合并",
        confirmationGranularity: "danger_modal",
        rationale: "外部数据导入涉及事实重建，必须由用户显式触发并经冲突审阅",
    },
    {
        key: "reset_all_preferences_action",
        section: "data_recovery",
        card: "reset",
        semantics: "C_action",
        applicability: "not_applicable",
        defaultValue: null,
        dependencies: [],
        risk: "high",
        storageBucket: null,
        impactScope: "抹除偏好桶重置为出厂状态",
        confirmationGranularity: "danger_modal",
        rationale: "危险破坏性重置动作，严禁推荐执行",
    },
    {
        key: "storage_statistics",
        section: "data_recovery",
        card: "snapshots",
        semantics: "D_readonly",
        applicability: "not_applicable",
        defaultValue: null,
        dependencies: [],
        risk: "low",
        storageBucket: null,
        impactScope: "数据库体积与快照数量统计",
        confirmationGranularity: "none",
        rationale: "物理存储统计信息，属于只读事实",
    },
]);

/** 评估某个设置字段是否允许被推荐方案修改。 */
export interface RecommendationEligibilityDecision {
    readonly eligible: boolean;
    readonly key: string;
    readonly applicability: RecommendationApplicability;
    readonly reason: string;
}

export function evaluateFieldRecommendationEligibility(
    descriptor: SettingsFieldRecommendationDescriptor,
    proposedValue: unknown
): RecommendationEligibilityDecision {
    if (descriptor.semantics === "C_action" || descriptor.semantics === "D_readonly") {
        return {
            eligible: false,
            key: descriptor.key,
            applicability: descriptor.applicability,
            reason: "action_or_readonly_forbidden_in_recommendation",
        };
    }
    if (descriptor.applicability === "not_applicable") {
        return {
            eligible: false,
            key: descriptor.key,
            applicability: descriptor.applicability,
            reason: "field_explicitly_marked_not_applicable",
        };
    }
    if (descriptor.applicability === "manual_required") {
        return {
            eligible: false,
            key: descriptor.key,
            applicability: descriptor.applicability,
            reason: "field_requires_explicit_manual_selection",
        };
    }
    if (proposedValue === undefined || proposedValue === null) {
        return {
            eligible: false,
            key: descriptor.key,
            applicability: descriptor.applicability,
            reason: "proposed_value_must_not_be_empty",
        };
    }
    return {
        eligible: true,
        key: descriptor.key,
        applicability: descriptor.applicability,
        reason: "eligible_for_recommendation",
    };
}

/** 智能证据上下文（用于本地证据驱动推荐）。 */
export interface LocalEvidenceContext {
    readonly peakCheckinHour?: number;
    readonly hasDockTomatoAvailable?: boolean;
    readonly totalHabitCount?: number;
    readonly prefersQuietNight?: boolean;
}

export interface ProposedRecommendation {
    readonly key: string;
    readonly proposedValue: unknown;
    readonly evidenceReason: string;
}

/** 基于本地证据纯函数生成证据推荐草案。 */
export function deriveEvidenceBasedRecommendations(
    context: LocalEvidenceContext
): readonly ProposedRecommendation[] {
    const proposals: ProposedRecommendation[] = [];

    // 1. 提醒槽根据打卡峰值小时推荐
    if (typeof context.peakCheckinHour === "number" && context.peakCheckinHour >= 0 && context.peakCheckinHour <= 23) {
        const peak = context.peakCheckinHour;
        const morningSlot = peak < 12 ? `${String(peak).padStart(2, "0")}:00` : "09:00";
        const eveningSlot = peak >= 12 ? `${String(peak).padStart(2, "0")}:00` : "21:00";
        proposals.push({
            key: "reminder_slots",
            proposedValue: [morningSlot, eveningSlot],
            evidenceReason: `Based on your peak checkin hour around ${peak}:00`,
        });
    }

    // 2. 专注提供方根据宿主插件探测
    if (context.hasDockTomatoAvailable === true) {
        proposals.push({
            key: "focus_provider",
            proposedValue: "docktomato",
            evidenceReason: "Dock Tomato plugin detected and healthy",
        });
    } else {
        proposals.push({
            key: "focus_provider",
            proposedValue: "builtin",
            evidenceReason: "Using reliable built-in timer as default",
        });
    }

    // 3. 项目分组按项目体量推荐
    if (typeof context.totalHabitCount === "number" && context.totalHabitCount > 8) {
        proposals.push({
            key: "group_mode",
            proposedValue: "schedule",
            evidenceReason: "Recommended schedule-based grouping for larger habit collections (> 8)",
        });
    }

    return Object.freeze(proposals);
}
