import {t} from "../i18n";
import {classifyStorageFailure} from "../features/storage-failure";
import {sanitizeDiagnosticDetail} from "../features/diagnostics";
import {
    persistNormalizedStoreWithVerification,
    persistStoreWithReconciliation,
    reconcileNormalizedStoreSnapshots,
} from "../storage-transaction";

export * from "./locks";

export const STORAGE_NAME = "checkin-store";
export const BACKUP_STORAGE_NAME = "checkin-store-backup";
export const AUDIT_STORAGE_NAME = "checkin-store-audit";
export const VIEW_PREFERENCES_NAME = "checkin-view-preferences";
export const USER_TEMPLATES_NAME = "checkin-user-templates";
export const CUSTOM_ICON_LIBRARY_NAME = "checkin-custom-icon-library";
export const REMINDER_ACTIONS_NAME = "checkin-reminder-actions";
export const SUGGESTION_WORKFLOW_STORAGE_NAME = "checkin-suggestion-workflow";
export const FOCUS_DIAGNOSTICS_STORAGE_NAME = "checkin-focus-diagnostics";
export const DOCKTOMATO_INBOX_STORAGE_NAME = "checkin-docktomato-inbox";
export const EXTERNAL_PENDING_STORAGE_NAME = "checkin-external-pending";
export { OCCASIONS_STORAGE_NAME } from "../domain/occasions/types";

export const AUDIT_COALESCE_MS = 1500;

export function safeUserErrorDetail(error: unknown): string {
    const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
    const classified = classifyStorageFailure(error);
    if (classified.kind !== "unknown") {
        return t(classified.messageKey);
    }
    return sanitizeDiagnosticDetail(raw) || t("common.unknownError");
}

export {
    persistNormalizedStoreWithVerification,
    persistStoreWithReconciliation,
    reconcileNormalizedStoreSnapshots,
};
