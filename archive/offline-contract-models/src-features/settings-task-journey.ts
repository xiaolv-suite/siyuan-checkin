/* T-1734 设置分区与任务入口再梳理（纯逻辑、无时钟、确定性）。
   围绕“先做什么”用户任务旅程，确立五大核心任务步骤与字段/动作/状态映射矩阵，
   100% 保留既存 data-* 属性、搜索定位选择器与跨表面回链。 */

export type SettingsTaskCategory =
    | "daily_display_reminders" // 任务 1：日常显示与提醒
    | "auto_ingest"             // 任务 2：第三方自动记录
    | "note_output"             // 任务 3：思源笔记写入
    | "data_recovery"           // 任务 4：数据恢复与备份
    | "capability_status";      // 任务 5：宿主与生态能力状态

export interface TaskStepDescriptor {
    readonly stepIndex: number;
    readonly stepKey: string;
    readonly titleKey: string;
    readonly descriptionKey: string;
    readonly requiredFields: readonly string[];
    readonly optionalFields: readonly string[];
    readonly actionSelectors: readonly string[];
    readonly stateSelector?: string;
}

export interface SettingsTaskWorkflow {
    readonly category: SettingsTaskCategory;
    readonly titleKey: string;
    readonly targetGroup: string;
    readonly steps: readonly TaskStepDescriptor[];
}

export const SETTINGS_TASK_WORKFLOWS: readonly SettingsTaskWorkflow[] = Object.freeze([
    // === 任务 1：日常显示与提醒 ===
    {
        category: "daily_display_reminders",
        titleKey: "set.task.dailyRemindersTitle",
        targetGroup: "appearance",
        steps: [
            {
                stepIndex: 1,
                stepKey: "look_and_feel",
                titleKey: "set.task.stepLookTitle",
                descriptionKey: "set.task.stepLookDesc",
                requiredFields: ["data-setting-appearance"],
                optionalFields: ["data-setting-language", "data-setting-palette"],
                actionSelectors: [],
            },
            {
                stepIndex: 2,
                stepKey: "today_layout",
                titleKey: "set.task.stepTodayLayoutTitle",
                descriptionKey: "set.task.stepTodayLayoutDesc",
                requiredFields: ["data-setting-group", "data-setting-sort"],
                optionalFields: ["data-setting-completed", "data-setting-weekstrip"],
                actionSelectors: [],
            },
            {
                stepIndex: 3,
                stepKey: "remind_and_quiet",
                titleKey: "set.task.stepRemindQuietTitle",
                descriptionKey: "set.task.stepRemindQuietDesc",
                requiredFields: ["data-setting-reminder-toggle", "data-setting-reminder-slots"],
                optionalFields: ["data-setting-quiet", "data-setting-quiet-start", "data-setting-quiet-end"],
                actionSelectors: ["[data-action='save-reminder-slots']"],
            },
        ],
    },

    // === 任务 2：第三方自动记录（以微信读书为核心典型） ===
    {
        category: "auto_ingest",
        titleKey: "set.task.autoIngestTitle",
        targetGroup: "external",
        steps: [
            {
                stepIndex: 1,
                stepKey: "credential_setup",
                titleKey: "set.task.stepCredentialTitle",
                descriptionKey: "set.task.stepCredentialDesc",
                requiredFields: ["data-weread-key"],
                optionalFields: [],
                actionSelectors: [],
            },
            {
                stepIndex: 2,
                stepKey: "rule_and_threshold",
                titleKey: "set.task.stepRuleTitle",
                descriptionKey: "set.task.stepRuleDesc",
                requiredFields: ["data-weread-threshold"],
                optionalFields: ["data-weread-item"],
                actionSelectors: [],
            },
            {
                stepIndex: 3,
                stepKey: "probe_and_verify",
                titleKey: "set.task.stepVerifyTitle",
                descriptionKey: "set.task.stepVerifyDesc",
                requiredFields: [],
                optionalFields: [],
                actionSelectors: ["[data-action='weread-pull']"],
                stateSelector: "[data-weread-status]",
            },
        ],
    },

    // === 任务 3：思源笔记写入 ===
    {
        category: "note_output",
        titleKey: "set.task.noteOutputTitle",
        targetGroup: "external",
        steps: [
            {
                stepIndex: 1,
                stepKey: "journal_mode_select",
                titleKey: "set.task.stepJournalModeTitle",
                descriptionKey: "set.task.stepJournalModeDesc",
                requiredFields: ["data-journal-mode"],
                optionalFields: [],
                actionSelectors: [],
            },
            {
                stepIndex: 2,
                stepKey: "notebook_and_doc_bind",
                titleKey: "set.task.stepBindNotebookTitle",
                descriptionKey: "set.task.stepBindNotebookDesc",
                requiredFields: ["data-journal-notebook-id"],
                optionalFields: ["data-journal-target-doc"],
                actionSelectors: [],
            },
            {
                stepIndex: 3,
                stepKey: "template_format",
                titleKey: "set.task.stepTemplateFormatTitle",
                descriptionKey: "set.task.stepTemplateFormatDesc",
                requiredFields: [],
                optionalFields: ["data-journal-custom"],
                actionSelectors: ["[data-action='save-journal-settings']"],
            },
        ],
    },

    // === 任务 4：数据恢复与备份 ===
    {
        category: "data_recovery",
        titleKey: "set.task.dataRecoveryTitle",
        targetGroup: "data",
        steps: [
            {
                stepIndex: 1,
                stepKey: "export_safety_backup",
                titleKey: "set.task.stepExportBackupTitle",
                descriptionKey: "set.task.stepExportBackupDesc",
                requiredFields: [],
                optionalFields: [],
                actionSelectors: ["[data-action='export-envelope']"],
            },
            {
                stepIndex: 2,
                stepKey: "inspect_snapshots",
                titleKey: "set.task.stepInspectSnapshotsTitle",
                descriptionKey: "set.task.stepInspectSnapshotsDesc",
                requiredFields: [],
                optionalFields: [],
                actionSelectors: ["[data-action='restore-snapshot']", "[data-action='export-snapshots']"],
                stateSelector: "[data-recovery-guide]",
            },
            {
                stepIndex: 3,
                stepKey: "diagnostics_audit",
                titleKey: "set.task.stepDiagnosticsTitle",
                descriptionKey: "set.task.stepDiagnosticsDesc",
                requiredFields: [],
                optionalFields: [],
                actionSelectors: ["[data-action='export-diagnostics']", "[data-action='export-audit']"],
                stateSelector: "[data-diagnostics]",
            },
        ],
    },

    // === 任务 5：宿主与生态能力状态 ===
    {
        category: "capability_status",
        titleKey: "set.task.capabilityStatusTitle",
        targetGroup: "external",
        steps: [
            {
                stepIndex: 1,
                stepKey: "focus_provider_check",
                titleKey: "set.task.stepFocusProviderTitle",
                descriptionKey: "set.task.stepFocusProviderDesc",
                requiredFields: ["data-setting-focus-timer"],
                optionalFields: [],
                actionSelectors: ["[data-action='export-diagnostics']"],
                stateSelector: "[data-contract-center='docktomato']",
            },
            {
                stepIndex: 2,
                stepKey: "ecosystem_contracts",
                titleKey: "set.task.stepContractsTitle",
                descriptionKey: "set.task.stepContractsDesc",
                requiredFields: [],
                optionalFields: [],
                actionSelectors: [],
                stateSelector: "[data-contract-center='api']",
            },
        ],
    },
]);

/** 检验给定上下文是否足以推进到下一步。 */
export interface StepProgressEvaluation {
    readonly canAdvance: boolean;
    readonly missingFields: readonly string[];
    readonly isActionReady: boolean;
}

export function evaluateStepProgress(
    step: TaskStepDescriptor,
    currentValues: Record<string, unknown>
): StepProgressEvaluation {
    const missingFields: string[] = [];
    for (const field of step.requiredFields) {
        const val = currentValues[field];
        if (val === undefined || val === null || val === "") {
            missingFields.push(field);
        }
    }
    const canAdvance = missingFields.length === 0;
    return {
        canAdvance,
        missingFields: Object.freeze(missingFields),
        isActionReady: canAdvance,
    };
}
