/* T-1755 & T-1756：数据恢复安全边界与对外能力纯度模型（纯逻辑、无时钟、确定性）。
   严格确立：
   1. 破坏性数据操作（导入覆盖、快照恢复、清空审计、全量重置）永不打包入一键推荐方案（T-1755）；
   2. 主档 JSON 与多桶备份 Envelope 边界透明（主档不含事项与提醒，全量迁移必须走 Envelope）；
   3. 对外契约（API v5、Task Horizon、Agent、快捷键、关于信息）100% 保持只读不可推荐（T-1756）；
   4. 绝不将外部等待状态伪装为“已配置/已连接”。 */

export type DataOperationType =
    | "export_envelope"        // 导出多桶备份（安全，可推荐）
    | "create_snapshot"       // 创建恢复快照（安全，可推荐）
    | "inspect_snapshots"     // 检查快照列表（只读，可推荐）
    | "import_merge"          // 导入并集合并（高风险，需审阅，不可自动推荐）
    | "import_overwrite"      // 导入覆盖（破坏性，严禁推荐）
    | "restore_snapshot"      // 快照回滚（破坏性，严禁推荐）
    | "clear_audit_history"   // 清空审计记录（破坏性，严禁推荐）
    | "reset_all_preferences";// 重置所有偏好（破坏性，严禁推荐）

export interface DataOperationSafetyDecision {
    readonly operation: DataOperationType;
    readonly canBeRecommended: boolean;
    readonly requiresExplicitUserAction: boolean;
    readonly requiresConfirmationModal: boolean;
    readonly safetyLevel: "safe_guidance" | "manual_review_required" | "destructive_forbidden_in_rec";
    readonly reasonKey: string;
}

/** 评估数据管理操作是否允许进入推荐方案（T-1755）。 */
export function evaluateDataOperationSafety(operation: DataOperationType): DataOperationSafetyDecision {
    switch (operation) {
        case "export_envelope":
        case "create_snapshot":
        case "inspect_snapshots":
            return {
                operation,
                canBeRecommended: true,
                requiresExplicitUserAction: true,
                requiresConfirmationModal: false,
                safetyLevel: "safe_guidance",
                reasonKey: "data.safe.guidanceAllowed",
            };

        case "import_merge":
            return {
                operation,
                canBeRecommended: false,
                requiresExplicitUserAction: true,
                requiresConfirmationModal: true,
                safetyLevel: "manual_review_required",
                reasonKey: "data.import.mergeRequiresConflictReview",
            };

        case "import_overwrite":
        case "restore_snapshot":
        case "clear_audit_history":
        case "reset_all_preferences":
        default:
            return {
                operation,
                canBeRecommended: false,
                requiresExplicitUserAction: true,
                requiresConfirmationModal: true,
                safetyLevel: "destructive_forbidden_in_rec",
                reasonKey: "data.destructive.forbiddenInRecommendation",
            };
    }
}

export type CapabilityDescriptorKey =
    | "api_v5_provided"
    | "task_horizon_contract"
    | "agent_capability"
    | "shortcuts_guide"
    | "plugin_version_info"
    | "focus_timer_toggle"; // 唯一内部可操作项

export interface CapabilityPurityDecision {
    readonly capabilityKey: CapabilityDescriptorKey;
    readonly isConfigurablePreference: boolean;
    readonly isReadOnlyOrExternalContract: boolean;
    readonly allowRecommendationButton: boolean;
    readonly honestDisplayState: "provided" | "waiting" | "system_doc" | "toggleable";
}

/** 检验系统能力是否具备可推荐性，确保外部状态不被伪装（T-1756）。 */
export function evaluateCapabilityPurity(key: CapabilityDescriptorKey): CapabilityPurityDecision {
    if (key === "focus_timer_toggle") {
        return {
            capabilityKey: key,
            isConfigurablePreference: true,
            isReadOnlyOrExternalContract: false,
            allowRecommendationButton: true,
            honestDisplayState: "toggleable",
        };
    }

    if (key === "task_horizon_contract") {
        return {
            capabilityKey: key,
            isConfigurablePreference: false,
            isReadOnlyOrExternalContract: true,
            allowRecommendationButton: false,
            honestDisplayState: "waiting", // 严格保持 waiting，绝不标已连接！
        };
    }

    if (key === "api_v5_provided") {
        return {
            capabilityKey: key,
            isConfigurablePreference: false,
            isReadOnlyOrExternalContract: true,
            allowRecommendationButton: false,
            honestDisplayState: "provided",
        };
    }

    return {
        capabilityKey: key,
        isConfigurablePreference: false,
        isReadOnlyOrExternalContract: true,
        allowRecommendationButton: false,
        honestDisplayState: "system_doc",
    };
}

export interface BackupCoverageExplanation {
    readonly format: "single_store_json" | "backup_envelope";
    readonly includesMainStore: boolean;
    readonly includesOccasionStore: boolean;
    readonly includesReminderActions: boolean;
    readonly includesViewPreferences: boolean;
    readonly guidanceKey: string;
}

/** 说明不同备份格式的数据覆盖范围（T-1755）。 */
export function explainBackupCoverage(format: "single_store_json" | "backup_envelope"): BackupCoverageExplanation {
    if (format === "single_store_json") {
        return {
            format,
            includesMainStore: true,
            includesOccasionStore: false,
            includesReminderActions: false,
            includesViewPreferences: false,
            guidanceKey: "data.backup.singleStoreNotice",
        };
    }
    return {
        format,
        includesMainStore: true,
        includesOccasionStore: true,
        includesReminderActions: true,
        includesViewPreferences: true,
        guidanceKey: "data.backup.fullEnvelopeRecommended",
    };
}
