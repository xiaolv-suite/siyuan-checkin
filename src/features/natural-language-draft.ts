/* T-1688, T-1689, T-1690 自然语言到项目草案数据契约、解析与审阅治理。
   - T-1688：自然语言建项 Envelope 规范（schemaVersion: 1、来源标识、双候选上限、置信度与诊断码）；
   - T-1689：模型输出解析与不可信边界（支持严格 JSON / Markdown 围栏、控制字符与对抗载荷拦截、诊断码分类）；
   - T-1690：草案审阅、同名冲突探测与用户表单差异比对（保护用户手填字段、安全回填普通编辑器、模型绝不直写 Store）。 */

import type {CheckinKind, CheckinPriority, CheckinSchedule, CheckinTimeSlot} from "../types";
import {normalizeProjectDraft, type ProjectDraft} from "./project-draft";
import {normalizeSuggestionSchedule} from "./schedule-validate";

export type DraftEnvelopeSource = "local" | "provider" | "manual";
export type DraftConfidence = "high" | "medium" | "low";

export type DraftParseDiagnosticCode =
    | "ok"
    | "empty_payload"
    | "payload_too_large"
    | "invalid_json"
    | "schema_mismatch"
    | "untrusted_content"
    | "no_valid_candidates";

export interface ProjectDraftEnvelope {
    readonly schemaVersion: 1;
    readonly source: DraftEnvelopeSource;
    readonly capturedAt: string;
    readonly modelSummary: string;
    readonly candidates: readonly ProjectDraft[];
    readonly missingFields: readonly string[];
    readonly confidence: DraftConfidence;
    readonly diagnosticCode?: string;
}

export interface DraftFieldDiff {
    readonly field: keyof ProjectDraft;
    readonly before: unknown;
    readonly after: unknown;
    readonly isUserModified: boolean;
}

export interface DraftApplicationReview {
    readonly hasNameConflict: boolean;
    readonly conflictingItemName?: string;
    readonly diffs: readonly DraftFieldDiff[];
    readonly preservedUserFields: readonly (keyof ProjectDraft)[];
    readonly mergedDraft: ProjectDraft;
    readonly canApplyDirectly: boolean;
}

const MAX_MODEL_PAYLOAD_LENGTH = 4096;
const MAX_CANDIDATE_COUNT = 2;

/** T-1688：创建结构化项目草案 Envelope。 */
export function createProjectDraftEnvelope(options: {
    source: DraftEnvelopeSource;
    modelSummary: string;
    candidates: readonly ProjectDraft[];
    capturedAt?: string;
    missingFields?: readonly string[];
    confidence?: DraftConfidence;
    diagnosticCode?: string;
}): ProjectDraftEnvelope {
    const validCandidates: ProjectDraft[] = [];
    const seenNames = new Set<string>();

    for (const raw of options.candidates) {
        const normalized = normalizeProjectDraft(raw);
        if (!normalized) continue;
        const dedupeKey = `${normalized.name}::${normalized.kind}::${normalized.target}${normalized.unit}`;
        if (seenNames.has(dedupeKey)) continue;
        seenNames.add(dedupeKey);
        validCandidates.push(normalized);
        if (validCandidates.length >= MAX_CANDIDATE_COUNT) break;
    }

    const capturedAt = typeof options.capturedAt === "string" && Number.isFinite(Date.parse(options.capturedAt))
        ? new Date(options.capturedAt).toISOString()
        : new Date().toISOString();

    const confidence = options.confidence ?? (validCandidates.length > 0 ? "high" : "low");

    return Object.freeze({
        schemaVersion: 1,
        source: options.source,
        capturedAt,
        modelSummary: (options.modelSummary || "unknown").slice(0, 100),
        candidates: Object.freeze(validCandidates),
        missingFields: Object.freeze([...(options.missingFields || [])]),
        confidence,
        ...(options.diagnosticCode ? {diagnosticCode: options.diagnosticCode} : {}),
    });
}

/** T-1688：校验并归一化 Envelope（fail-closed）。 */
export function normalizeProjectDraftEnvelope(value: unknown): ProjectDraftEnvelope | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const source = value as Partial<ProjectDraftEnvelope>;
    if (source.schemaVersion !== 1) return undefined;
    if (source.source !== "local" && source.source !== "provider" && source.source !== "manual") return undefined;
    if (typeof source.capturedAt !== "string" || !Number.isFinite(Date.parse(source.capturedAt))) return undefined;
    if (!Array.isArray(source.candidates)) return undefined;

    return createProjectDraftEnvelope({
        source: source.source,
        modelSummary: typeof source.modelSummary === "string" ? source.modelSummary : "unknown",
        candidates: source.candidates,
        capturedAt: source.capturedAt,
        missingFields: Array.isArray(source.missingFields) ? source.missingFields.filter((f): f is string => typeof f === "string") : [],
        confidence: source.confidence === "high" || source.confidence === "medium" || source.confidence === "low" ? source.confidence : "low",
        diagnosticCode: typeof source.diagnosticCode === "string" ? source.diagnosticCode : undefined,
    });
}

/** T-1689：从不可信模型文本输出中安全提取 JSON。 */
export function extractJsonFromModelOutput(rawText: string): {jsonString: string; isCodeFenced: boolean} | undefined {
    if (typeof rawText !== "string") return undefined;
    const text = rawText.trim();
    if (!text || text.length > MAX_MODEL_PAYLOAD_LENGTH) return undefined;

    // 检查是否有对抗性脚本注入标签
    if (/<script\b[^>]*>/i.test(text) || /javascript:/i.test(text) || /data:text\/html/i.test(text)) {
        return undefined;
    }

    // 1. 尝试匹配 ```json ... ``` 或 ``` ... ``` 围栏
    const fenceMatch = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(text);
    if (fenceMatch && fenceMatch[1]) {
        return {jsonString: fenceMatch[1].trim(), isCodeFenced: true};
    }

    // 2. 尝试匹配第一个 { ... } 或 [ ... ]
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        return {jsonString: text.slice(firstBrace, lastBrace + 1), isCodeFenced: false};
    }

    const firstBracket = text.indexOf("[");
    const lastBracket = text.lastIndexOf("]");
    if (firstBracket >= 0 && lastBracket > firstBracket) {
        return {jsonString: text.slice(firstBracket, lastBracket + 1), isCodeFenced: false};
    }

    return undefined;
}

/** T-1689：解析模型输出文本并进行不可信内容过滤。 */
export function parseProjectDraftFromModelOutput(
    rawText: string,
    options: {modelSummary?: string; source?: DraftEnvelopeSource} = {}
): {envelope?: ProjectDraftEnvelope; diagnostic: DraftParseDiagnosticCode} {
    if (!rawText || !rawText.trim()) {
        return {diagnostic: "empty_payload"};
    }
    if (rawText.length > MAX_MODEL_PAYLOAD_LENGTH) {
        return {diagnostic: "payload_too_large"};
    }

    const extracted = extractJsonFromModelOutput(rawText);
    if (!extracted) {
        return {diagnostic: "untrusted_content"};
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(extracted.jsonString);
    } catch {
        return {diagnostic: "invalid_json"};
    }

    if (!parsed || typeof parsed !== "object") {
        return {diagnostic: "schema_mismatch"};
    }

    const candidateList: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as Record<string, unknown>).candidates)
            ? ((parsed as Record<string, unknown>).candidates as unknown[])
            : Array.isArray((parsed as Record<string, unknown>).drafts)
                ? ((parsed as Record<string, unknown>).drafts as unknown[])
                : [parsed];

    const candidates: ProjectDraft[] = [];
    const missingFieldsList = new Set<string>();

    for (const item of candidateList) {
        if (!item || typeof item !== "object") continue;
        const normalized = normalizeProjectDraft(item);
        if (normalized) {
            candidates.push(normalized);
        } else {
            // 记录缺少的重要字段
            const cand = item as Record<string, unknown>;
            if (!cand.name) missingFieldsList.add("name");
            if (!cand.unit) missingFieldsList.add("unit");
            if (!cand.target) missingFieldsList.add("target");
        }
    }

    if (candidates.length === 0) {
        return {diagnostic: "no_valid_candidates"};
    }

    const envelope = createProjectDraftEnvelope({
        source: options.source || "provider",
        modelSummary: options.modelSummary || "model-parser",
        candidates,
        missingFields: [...missingFieldsList],
        confidence: missingFieldsList.size === 0 ? "high" : "medium",
        diagnosticCode: "ok",
    });

    return {envelope, diagnostic: "ok"};
}

/** T-1690：草案审阅、同名冲突探测与用户当前表单差异比对。 */
export function evaluateDraftApplicationDiff(
    currentForm: Partial<ProjectDraft>,
    draft: ProjectDraft,
    existingItems: readonly {id: string; name: string; archived?: boolean}[] = []
): DraftApplicationReview {
    const hasNameConflict = existingItems.some((item) => !item.archived && item.name.trim().toLowerCase() === draft.name.trim().toLowerCase());
    const conflictingItem = existingItems.find((item) => !item.archived && item.name.trim().toLowerCase() === draft.name.trim().toLowerCase());

    const diffs: DraftFieldDiff[] = [];
    const preservedUserFields: (keyof ProjectDraft)[] = [];

    const fieldsToCheck: (keyof ProjectDraft)[] = ["name", "icon", "kind", "target", "unit", "group", "priority", "timeSlot", "note"];

    for (const field of fieldsToCheck) {
        const userVal = currentForm[field];
        const draftVal = draft[field];
        const isUserModified = userVal !== undefined && userVal !== "" && userVal !== 0;

        if (JSON.stringify(userVal) !== JSON.stringify(draftVal)) {
            diffs.push({
                field,
                before: userVal,
                after: draftVal,
                isUserModified,
            });
            // 若用户显式手填了该值，默认保护用户手填值不被草案强行冲刷
            if (isUserModified) {
                preservedUserFields.push(field);
            }
        }
    }

    // 合并策略：草案为基底，用户显式手填值保留
    const mergedDraft: ProjectDraft = {
        ...draft,
    };
    for (const preservedField of preservedUserFields) {
        const userVal = currentForm[preservedField];
        if (userVal !== undefined) {
            (mergedDraft as unknown as Record<string, unknown>)[preservedField] = userVal;
        }
    }

    return Object.freeze({
        hasNameConflict,
        conflictingItemName: conflictingItem?.name,
        diffs: Object.freeze(diffs),
        preservedUserFields: Object.freeze(preservedUserFields),
        mergedDraft: Object.freeze(mergedDraft),
        canApplyDirectly: !hasNameConflict,
    });
}
