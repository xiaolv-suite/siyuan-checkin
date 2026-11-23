import type {CheckinKind, ScheduleType} from "./types";
import {t} from "./i18n";

export interface EditorValidationInput {
    name: string;
    kind: CheckinKind;
    target: number;
    unit: string;
    schedule: ScheduleType;
    weekdays: readonly number[];
    quotaAmount?: number;
}

export interface EditorValidationResult {
    valid: boolean;
    errors: Partial<Record<"name" | "target" | "unit" | "schedule", string>>;
}

export function validateEditorInput(input: EditorValidationInput): EditorValidationResult {
    const errors: EditorValidationResult["errors"] = {};
    // 2026-11-21 走查修复：目标值/配额补上界——手滑输入 1e9 会被静默入库，达标率/热力图全线趋零
    const MAX_AMOUNT = 1_000_000;
    if (!input.name.trim()) errors.name = t("val.name");
    if (input.kind !== "binary" && (!Number.isFinite(input.target) || input.target <= 0 || input.target > MAX_AMOUNT)) errors.target = t("val.target");
    if (input.kind !== "binary" && !input.unit.trim()) errors.unit = t("val.unit");
    if ((input.schedule === "weekly" || input.schedule === "custom") && input.weekdays.length === 0) errors.schedule = t("val.scheduleWeekdays");
    if (input.schedule === "quota" && (!Number.isFinite(input.quotaAmount) || (input.quotaAmount || 0) <= 0 || (input.quotaAmount || 0) > MAX_AMOUNT)) errors.schedule = t("val.quotaAmount");
    return {valid: Object.keys(errors).length === 0, errors};
}
