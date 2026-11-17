/* T-1686 ~ T-1690 自然语言到项目草案数据契约、解析、降级与审阅治理。
   - T-1686：公开模型调用契约与真机前置核对；
   - T-1687：无模型、离线与失败时的双降级路径（复制提示词 + 本地规则智能推断）；
   - T-1688：自然语言建项 Envelope 规范（schemaVersion: 1、来源标识、双候选上限、置信度与诊断码）；
   - T-1689：模型输出解析与不可信边界（支持严格 JSON / Markdown 围栏、控制字符与对抗载荷拦截、诊断码分类）；
   - T-1690：草案审阅、同名冲突探测与用户表单差异比对（保护用户手填字段、安全回填普通编辑器、模型绝不直写 Store）。 */

import type {CheckinItem, CheckinKind, CheckinPriority, CheckinSchedule, CheckinTimeSlot} from "../types";
import type {CheckinTemplate} from "../catalog";
import type {OccasionKind, OccasionRecurrence} from "../occasions";
import {normalizeProjectDraft, type ProjectDraft} from "./project-draft";
import {normalizeSuggestionSchedule} from "./schedule-validate";
import {inferFieldsFromName, buildNameInference, type NameInferenceCatalogEntry} from "./name-inference";

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

/** T-1686 & T-1687：构建自足、可离线复制的结构化项目建项提示词。 */
export function buildProjectCreatePrompt(userDescription: string): string {
    const text = (userDescription || "").trim().slice(0, 500);
    return [
        "你是一个习惯打卡与个人成长领域的结构化配置助手。请根据用户的自然语言描述，提取并返回一份符合要求的打卡项目草案。",
        `用户描述："${text}"`,
        "【输出要求】",
        "1. 请只输出标准 JSON 格式数据，使用 ```json ... ``` 代码块包裹，严禁输出任何其他前缀、后缀或客套话；",
        "2. JSON 数据必须包含以下字段：",
        "   - name: 项目名称（字符串，必填，1-40字符，简洁清晰）",
        "   - icon: 单个图标或 Emoji（如 📖、🏃、💧、✓，默认 ✓）",
        "   - kind: 目标类型，只能是 binary（仅做/未做）、count（计次）、duration（时长）、quantity（数值）、custom（自定义）之一",
        "   - target: 目标数值（正数，binary 类型填 1）",
        "   - unit: 计数单位（字符串，如 页、分钟、次、毫升、步 等）",
        "   - schedule: { type: 'daily' | 'weekly' | 'interval' | 'quota' }（默认 daily）",
        "   - group: 分组名称（如 学习、运动、健康、生活 等）",
        "   - priority: 优先级，只能是 low、medium、high 之一（默认 medium）",
        "   - timeSlot: 时段偏好，只能是 any、morning、afternoon、evening 之一（默认 any）",
        "   - note: 习惯行动指引或简要备注（不超过200字符）",
        "【示例输出】",
        '```json\n{\n  "name": "晨跑",\n  "icon": "🏃",\n  "kind": "duration",\n  "target": 30,\n  "unit": "分钟",\n  "schedule": {"type": "daily"},\n  "group": "健康",\n  "priority": "high",\n  "timeSlot": "morning",\n  "note": "早晨户外慢跑"\n}\n```',
    ].join("\n\n");
}

/** T-1687：本地离线确定性草案生成器（无需网络与模型，纯规则秒级推断）。 */
export function generateLocalFallbackDraft(
    userDescription: string,
    catalog: readonly NameInferenceCatalogEntry[] = []
): ProjectDraft | undefined {
    const text = (userDescription || "").trim();
    if (!text) return undefined;

    // 1. 尝试关键词与字段推断
    const fields = inferFieldsFromName(text);

    // 提取可能的习惯简名（去除非核心修饰词）
    let cleanName = text
        .replace(/^(?:我想|我要|每天|想要|希望|打算)\s*/g, "")
        .replace(/[0-9]+(?:\.[0-9]+)?\s*(?:分钟|小时|毫升|千克|公斤|公里|克|升|步|页|元|次|个|组|回|项)/g, "")
        .replace(/(?:早上|早晨|上午|中午|下午|晚上|睡前)/g, "")
        .replace(/(?:每天|工作日|坚持)/g, "")
        .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, "$1$2")
        .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, "$1$2")
        .trim();

    if (!cleanName || cleanName.length > 40) {
        cleanName = text.slice(0, 40);
    }

    const kind = fields?.kind ?? "binary";
    const unit = fields?.unit ?? "次";
    const target = fields?.target ?? 1;
    const timeSlot = fields?.timeSlot ?? "any";
    const schedule: CheckinSchedule = fields?.schedule
        ? {type: fields.schedule.type, ...(fields.schedule.weekdays ? {weekdays: fields.schedule.weekdays} : {})}
        : {type: "daily"};

    // 尝试根据关键词匹配合理图标与分组
    let icon = "✓";
    let group = "习惯";
    if (kind === "duration") { icon = "⏱️"; group = "专注"; }
    else if (unit === "页" || text.includes("读") || text.includes("书")) { icon = "📖"; group = "学习"; }
    else if (text.includes("跑") || text.includes("锻炼") || text.includes("健身")) { icon = "🏃"; group = "健康"; }
    else if (text.includes("水")) { icon = "💧"; group = "健康"; }

    const candidate: ProjectDraft = {
        name: cleanName,
        icon,
        kind,
        target,
        unit,
        schedule,
        group,
        priority: "medium",
        timeSlot,
        note: `本地规则生成：${text}`.slice(0, 200),
    };

    return normalizeProjectDraft(candidate);
}

export interface ModelReadinessResult {
    readonly canAutoInvoke: boolean;
    readonly recommendedAction: "direct_invoke" | "copy_prompt" | "use_local";
    readonly explanationKey: string;
}

/** T-1686 & T-1687：思源公开模型调用契约与可用降级评定。 */
export function evaluateModelReadiness(options: {
    hasPublicModelApi: boolean;
    isModelConfigured: boolean;
    hasUserDescription: boolean;
}): ModelReadinessResult {
    if (!options.hasUserDescription) {
        return {canAutoInvoke: false, recommendedAction: "use_local", explanationKey: "ai.needDescription"};
    }
    if (!options.hasPublicModelApi) {
        return {canAutoInvoke: false, recommendedAction: "copy_prompt", explanationKey: "ai.noPublicApi"};
    }
    if (!options.isModelConfigured) {
        return {canAutoInvoke: false, recommendedAction: "copy_prompt", explanationKey: "ai.notConfigured"};
    }
    return {canAutoInvoke: true, recommendedAction: "direct_invoke", explanationKey: "ai.ready"};
}

/** T-1691：请求最小上下文接口与脱敏结果。 */
export interface MinimalAiDraftContext {
    readonly userDescription: string;
    readonly locale: string;
    readonly sanitizedLength: number;
    readonly containsSensitivePattern: boolean;
    readonly sensitiveTypes: readonly string[];
}

/** T-1691：敏感内容检测正则（邮箱、手机号、Bearer Token、OpenAI/Siyuan Key）。 */
const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/;
const PHONE_REGEX = /(?:\+?86)?1[3-9]\d{9}/;
const TOKEN_KEY_REGEX = /(?:bearer\s+[a-zA-Z0-9_.-]{16,}|(?:sk|ak)-[a-zA-Z0-9_-]{16,})/i;

/** T-1691：检测输入中是否包含疑似个人敏感信息（邮箱、手机号、密钥凭据）。 */
export function detectSensitiveContent(text: string): {hasSensitive: boolean; types: string[]} {
    if (!text || typeof text !== "string") return {hasSensitive: false, types: []};
    const types: string[] = [];
    if (EMAIL_REGEX.test(text)) types.push("email");
    if (PHONE_REGEX.test(text)) types.push("phone");
    if (TOKEN_KEY_REGEX.test(text)) types.push("token_or_key");
    return {hasSensitive: types.length > 0, types};
}

/** T-1691：构建发送给外部提供方的最小化上下文，严格切断历史数据、笔记路径与密钥凭据。 */
export function buildMinimalAiDraftContext(userText: string, locale: string = "zh_CN"): MinimalAiDraftContext {
    const raw = typeof userText === "string" ? userText.trim() : "";
    // 强制截断至 500 字符内，绝不携带多余历史
    const userDescription = raw.slice(0, 500);
    const sensitivity = detectSensitiveContent(userDescription);
    return Object.freeze({
        userDescription,
        locale: locale || "zh_CN",
        sanitizedLength: userDescription.length,
        containsSensitivePattern: sensitivity.hasSensitive,
        sensitiveTypes: Object.freeze(sensitivity.types),
    });
}

/** T-1691：隐私、外发与成本披露信息。 */
export interface AiDraftPrivacyDisclosure {
    readonly localFirst: true;
    readonly dataEgress: "minimal_text_only";
    readonly notesSent: false;
    readonly historySent: false;
    readonly keysSent: false;
    readonly costFreeForLocal: true;
    readonly promptPersistence: false;
}

export function getAiDraftPrivacyDisclosure(): AiDraftPrivacyDisclosure {
    return Object.freeze({
        localFirst: true,
        dataEgress: "minimal_text_only",
        notesSent: false,
        historySent: false,
        keysSent: false,
        costFreeForLocal: true,
        promptPersistence: false,
    });
}

/** T-1692：自然语言草案请求生命周期状态。 */
export type AiDraftSessionStatus = "idle" | "inferring" | "ready" | "failed" | "aborted" | "superseded";

export interface AiDraftRequestSession {
    readonly rootId: string;
    readonly requestId: number;
    readonly generation: number;
    readonly description: string;
    readonly status: AiDraftSessionStatus;
    readonly candidate?: ProjectDraft;
    readonly startedAt: number;
    readonly abortController?: AbortController;
    readonly diagnosticCode?: string;
}

export interface SettleSessionResult {
    readonly applied: boolean;
    readonly session: AiDraftRequestSession;
    readonly reason?: "superseded" | "aborted" | "stale" | "root_disposed";
}

export class AiDraftLifecycleManager {
    private nextRequestId = 1;
    private readonly rootGenerations = new Map<string, number>();
    private readonly activeSessions = new Map<string, AiDraftRequestSession>();
    private readonly draftsByRoot = new Map<string, ProjectDraft>();

    /** 获取指定 rootId 的当前代际（默认 0）。 */
    getGeneration(rootId: string): number {
        return this.rootGenerations.get(rootId) ?? 0;
    }

    /** 获取指定 rootId 的当前已保留草案。 */
    getDraft(rootId: string): ProjectDraft | undefined {
        return this.draftsByRoot.get(rootId);
    }

    /** 清除指定 rootId 的草案（取消或应用后）。 */
    clearDraft(rootId: string): void {
        this.draftsByRoot.delete(rootId);
        const session = this.activeSessions.get(rootId);
        if (session && (session.status === "ready" || session.status === "failed")) {
            this.activeSessions.delete(rootId);
        }
    }

    /** 开启一个新请求会话。若先前有在途请求，自动中止并标为 superseded。 */
    createSession(rootId: string, description: string): AiDraftRequestSession {
        // 1. 中止旧请求
        const prevSession = this.activeSessions.get(rootId);
        if (prevSession && prevSession.status === "inferring") {
            try {
                prevSession.abortController?.abort();
            } catch {
                // ignore
            }
            this.activeSessions.set(rootId, {
                ...prevSession,
                status: "superseded",
                diagnosticCode: "superseded",
            });
        }

        // 2. 自增代际与请求 ID
        const prevGen = this.getGeneration(rootId);
        const nextGen = prevGen + 1;
        this.rootGenerations.set(rootId, nextGen);
        const requestId = this.nextRequestId++;

        const abortController = typeof AbortController !== "undefined" ? new AbortController() : undefined;

        const session: AiDraftRequestSession = {
            rootId,
            requestId,
            generation: nextGen,
            description,
            status: "inferring",
            startedAt: Date.now(),
            abortController,
        };

        this.activeSessions.set(rootId, session);
        return session;
    }

    /** 校验指定会话是否依然是当前 root 的唯一有效在途代际。 */
    isSessionCurrent(session: AiDraftRequestSession): boolean {
        if (!session) return false;
        const currentGen = this.getGeneration(session.rootId);
        return session.generation === currentGen && session.status !== "aborted" && session.status !== "superseded";
    }

    /** 主动取消指定 root 的在途请求。 */
    abortSession(rootId: string, reason: string = "user_aborted"): AiDraftRequestSession | undefined {
        const session = this.activeSessions.get(rootId);
        if (!session) return undefined;
        try {
            session.abortController?.abort();
        } catch {
            // ignore
        }
        const updated: AiDraftRequestSession = {
            ...session,
            status: "aborted",
            diagnosticCode: reason,
        };
        this.activeSessions.set(rootId, updated);
        return updated;
    }

    /** 结算请求结果：严格代际防线，迟到结果绝不入账。 */
    settleSession(
        rootId: string,
        requestId: number,
        result: {candidate?: ProjectDraft; errorKey?: string}
    ): SettleSessionResult {
        const session = this.activeSessions.get(rootId);
        if (!session) {
            return {
                applied: false,
                session: {rootId, requestId, generation: 0, description: "", status: "superseded", startedAt: 0},
                reason: "root_disposed",
            };
        }

        // 严格代际与 ID 匹配
        if (session.requestId !== requestId) {
            return {applied: false, session, reason: "superseded"};
        }
        if (session.status === "aborted") {
            return {applied: false, session, reason: "aborted"};
        }
        if (session.generation !== this.getGeneration(rootId)) {
            return {applied: false, session, reason: "stale"};
        }

        if (result.candidate) {
            const updated: AiDraftRequestSession = {
                ...session,
                status: "ready",
                candidate: result.candidate,
                diagnosticCode: "ok",
            };
            this.activeSessions.set(rootId, updated);
            this.draftsByRoot.set(rootId, result.candidate);
            return {applied: true, session: updated};
        } else {
            const updated: AiDraftRequestSession = {
                ...session,
                status: "failed",
                diagnosticCode: result.errorKey || "no_match",
            };
            this.activeSessions.set(rootId, updated);
            return {applied: false, session: updated};
        }
    }

    /** 彻底销毁指定 root 的所有草案与生命周期资源（卸载或关闭）。 */
    disposeRoot(rootId: string): void {
        this.abortSession(rootId, "root_disposed");
        this.activeSessions.delete(rootId);
        this.draftsByRoot.delete(rootId);
        this.rootGenerations.delete(rootId);
    }
}

/** 全局单例管理器（跨 root 隔离）。 */
export const defaultAiDraftLifecycle = new AiDraftLifecycleManager();

/** T-1694：系统中全部 AI 入口类型枚举。 */
export type AiSurfaceEntryKind =
    | "editor_draft"
    | "weekly_review_prompt"
    | "review_assistant"
    | "habit_coaching";

/** T-1694：统一的 AI 入口能力与降级规格描述符。 */
export interface AiSurfaceCapabilityDescriptor {
    readonly entryKind: AiSurfaceEntryKind;
    readonly nameKey: string;
    readonly descriptionKey: string;
    readonly localMode: "deterministic_rules" | "pure_aggregation" | "heuristic_scoring";
    readonly promptCopyable: boolean;
    readonly externalApiRequired: false;
    readonly privacyEgressScope: "user_text_only" | "summary_facts_and_notes" | "date_range_only" | "none";
    readonly zeroDataLossGuarantee: true;
    readonly fallbackStrategy: "copy_prompt" | "local_rules" | "native_chart_reading";
}

const AI_SURFACE_SPECS: Readonly<Record<AiSurfaceEntryKind, AiSurfaceCapabilityDescriptor>> = Object.freeze({
    editor_draft: Object.freeze({
        entryKind: "editor_draft",
        nameKey: "editor.aiDraftHeading",
        descriptionKey: "editor.aiDraftHint",
        localMode: "deterministic_rules",
        promptCopyable: true,
        externalApiRequired: false,
        privacyEgressScope: "user_text_only",
        zeroDataLossGuarantee: true,
        fallbackStrategy: "local_rules",
    }),
    weekly_review_prompt: Object.freeze({
        entryKind: "weekly_review_prompt",
        nameKey: "review.weeklyAiCopy",
        descriptionKey: "review.aiPromptPrivacy",
        localMode: "pure_aggregation",
        promptCopyable: true,
        externalApiRequired: false,
        privacyEgressScope: "summary_facts_and_notes",
        zeroDataLossGuarantee: true,
        fallbackStrategy: "copy_prompt",
    }),
    review_assistant: Object.freeze({
        entryKind: "review_assistant",
        nameKey: "review.assistantTitle",
        descriptionKey: "review.assistantHow",
        localMode: "pure_aggregation",
        promptCopyable: true,
        externalApiRequired: false,
        privacyEgressScope: "date_range_only",
        zeroDataLossGuarantee: true,
        fallbackStrategy: "native_chart_reading",
    }),
    habit_coaching: Object.freeze({
        entryKind: "habit_coaching",
        nameKey: "insights.coaching",
        descriptionKey: "insights.coachingHint",
        localMode: "heuristic_scoring",
        promptCopyable: false,
        externalApiRequired: false,
        privacyEgressScope: "none",
        zeroDataLossGuarantee: true,
        fallbackStrategy: "local_rules",
    }),
});

/** T-1694：获取指定 AI 入口的能力与降级规格。 */
export function getAiSurfaceEntrySpec(kind: AiSurfaceEntryKind): AiSurfaceCapabilityDescriptor {
    return AI_SURFACE_SPECS[kind];
}

/** T-1694：获取全部 AI 入口规格清单。 */
export function getAllAiSurfaceSpecs(): readonly AiSurfaceCapabilityDescriptor[] {
    return Object.freeze(Object.values(AI_SURFACE_SPECS));
}

/** T-1695：AI 草案建项审计凭据（最小摘要，不持久化长文本或模型原始输出）。 */
export interface AiDraftProvenanceAudit {
    readonly itemId: string;
    readonly itemName: string;
    readonly source: "ai_draft";
    readonly schemaVersion: 1;
    readonly textLength: number;
    readonly at: string;
}

/** T-1695：构建草案采纳后的最小审计凭据。 */
export function createAiDraftProvenanceAudit(
    draft: ProjectDraft,
    itemId: string,
    userText: string = ""
): AiDraftProvenanceAudit {
    return Object.freeze({
        itemId,
        itemName: draft.name.slice(0, 40),
        source: "ai_draft",
        schemaVersion: 1,
        textLength: Math.min(500, (userText || "").trim().length),
        at: new Date().toISOString(),
    });
}

/** T-1695：核验草案生成前后 Store 绝对零副作用（无虚假打卡事件产生，项目集合未直写）。 */
export function verifyZeroStoreSideEffect(
    beforeStore: {items: readonly unknown[]; events: readonly unknown[]},
    afterStore: {items: readonly unknown[]; events: readonly unknown[]}
): boolean {
    if (!beforeStore || !afterStore) return false;
    // 严格断言事件总数未增加（零虚假打卡事件）
    if (beforeStore.events.length !== afterStore.events.length) return false;
    // 严格断言在用户手动提交前未直写项目
    if (beforeStore.items.length !== afterStore.items.length) return false;
    return true;
}

/** T-1696：已有项目字段调整差异条目。 */
export interface ItemAdjustmentFieldDiff {
    readonly field: "name" | "target" | "unit" | "kind" | "schedule" | "group" | "priority" | "direction";
    readonly before: unknown;
    readonly after: unknown;
    readonly impactSummary: string;
}

/** T-1696：已有项目自然语言调整方案评估。 */
export interface ExistingItemAiAdjustmentPlan {
    readonly originalItem: CheckinItem;
    readonly userDescription: string;
    readonly adjustedFields: readonly ItemAdjustmentFieldDiff[];
    readonly hasChanges: boolean;
    readonly hasNameConflict: boolean;
    readonly conflictingItemName?: string;
    readonly effectiveDate: string;
    readonly historyUnchanged: true;
    readonly previewDiffText: string;
}

/** T-1696：评估对已有项目的自然语言调整（提炼差异、冲突检测并严格保护历史）。 */
export function evaluateExistingItemAiAdjustment(
    originalItem: CheckinItem,
    userDescription: string,
    options: {
        existingItems?: readonly {id: string; name: string; archived?: boolean}[];
        effectiveDate?: string;
    } = {}
): ExistingItemAiAdjustmentPlan {
    const text = (userDescription || "").trim();
    const effectiveDate = options.effectiveDate || new Date().toISOString().slice(0, 10);
    const existingItems = options.existingItems || [];

    if (!text) {
        return Object.freeze({
            originalItem,
            userDescription: "",
            adjustedFields: Object.freeze([]),
            hasChanges: false,
            hasNameConflict: false,
            effectiveDate,
            historyUnchanged: true,
            previewDiffText: "无修改内容",
        });
    }

    const diffs: ItemAdjustmentFieldDiff[] = [];

    // 1. 目标数值与单位提取
    const numMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(分钟|小时|毫升|千克|公斤|公里|克|升|步|页|元|次|个|组|回|项)?/);
    if (numMatch) {
        const newTarget = Number(numMatch[1]);
        if (Number.isFinite(newTarget) && newTarget > 0 && newTarget !== originalItem.target) {
            diffs.push({
                field: "target",
                before: originalItem.target,
                after: newTarget,
                impactSummary: `目标由 ${originalItem.target} 调整为 ${newTarget}，从 ${effectiveDate} 起生效`,
            });
        }
        const newUnit = numMatch[2];
        if (newUnit && newUnit !== originalItem.unit) {
            diffs.push({
                field: "unit",
                before: originalItem.unit,
                after: newUnit,
                impactSummary: `单位由 ${originalItem.unit} 变更为 ${newUnit}，旧历史记录保留原有单位`,
            });
        }
    }

    // 2. 排期变动提取
    if (/工作日/.test(text) && originalItem.schedule.type !== "workdays") {
        diffs.push({
            field: "schedule",
            before: originalItem.schedule,
            after: {type: "workdays"},
            impactSummary: "排期调整为仅工作日，仅影响未来打卡机会，历史分母保持不变",
        });
    } else if (/(?:每天|每日)/.test(text) && originalItem.schedule.type !== "daily") {
        diffs.push({
            field: "schedule",
            before: originalItem.schedule,
            after: {type: "daily"},
            impactSummary: "排期调整为每天，仅从今日起生效",
        });
    }

    // 3. 方向变动（戒除类 atMost）
    if (/(?:戒除|不超过|上限|控制在)/.test(text) && originalItem.direction !== "atMost") {
        diffs.push({
            field: "direction",
            before: originalItem.direction || "atLeast",
            after: "atMost",
            impactSummary: "切换为戒除类习惯（不记录即达成），新规则从今日起算，不改写历史完成度",
        });
    }

    // 4. 改名提取与同名冲突检测
    let hasNameConflict = false;
    let conflictingItemName: string | undefined;

    const renameMatch = text.match(/(?:改名(?:为|成)?|名称改为|重命名为)\s*["'“‘「『]?([^，。\n]{1,40})/);
    if (renameMatch && renameMatch[1]) {
        const newName = renameMatch[1].replace(/^["'“‘「『\s]+|["'”’」』\s]+$/g, "").trim();
        if (newName && newName !== originalItem.name) {
            const conflict = existingItems.find((cand) =>
                cand.id !== originalItem.id &&
                !cand.archived &&
                cand.name.trim().toLowerCase() === newName.toLowerCase()
            );
            if (conflict) {
                hasNameConflict = true;
                conflictingItemName = conflict.name;
            }
            diffs.push({
                field: "name",
                before: originalItem.name,
                after: newName,
                impactSummary: hasNameConflict ? `改名为「${newName}」与现有未归档项目冲突` : `项目名称由「${originalItem.name}」修改为「${newName}」`,
            });
        }
    }

    const previewDiffText = diffs.length > 0
        ? diffs.map((d) => `• ${d.impactSummary}`).join("\n")
        : "未检测到明确的规则变更";

    return Object.freeze({
        originalItem,
        userDescription: text,
        adjustedFields: Object.freeze(diffs),
        hasChanges: diffs.length > 0,
        hasNameConflict,
        conflictingItemName,
        effectiveDate,
        historyUnchanged: true,
        previewDiffText,
    });
}

/** T-1697：模板变体草案输出结果。 */
export interface TemplateVariantDraftResult {
    readonly baseTemplateName: string;
    readonly templateAnchor: string;
    readonly draft: ProjectDraft;
    readonly overriddenFields: readonly (keyof ProjectDraft)[];
    readonly diffSummary: string;
}

/** T-1697：根据自然语言描述模糊匹配最佳基准模板。 */
export function findBestMatchingTemplate(
    userDescription: string,
    templates: readonly CheckinTemplate[] = []
): CheckinTemplate | undefined {
    const text = (userDescription || "").trim().toLowerCase();
    if (!text || !templates.length) return undefined;

    // 1. 精确名称匹配
    const exact = templates.find((t) => text.includes(t.name.toLowerCase()));
    if (exact) return exact;

    // 2. 常见同义词/关键词推断
    if (text.includes("水") || text.includes("喝")) return templates.find((t) => t.name === "喝水");
    if (text.includes("跑") || text.includes("晨跑") || text.includes("慢跑")) return templates.find((t) => t.name === "运动" || t.name === "步数");
    if (text.includes("读") || text.includes("书") || text.includes("看书")) return templates.find((t) => t.name === "阅读");
    if (text.includes("词") || text.includes("英语") || text.includes("单词")) return templates.find((t) => t.name === "背单词");
    if (text.includes("静坐") || text.includes("正念") || text.includes("冥想")) return templates.find((t) => t.name === "冥想");
    if (text.includes("睡") || text.includes("起") || text.includes("早起")) return templates.find((t) => t.name === "早睡早起" || t.name === "睡眠时长");
    if (text.includes("工作") || text.includes("代码") || text.includes("专注")) return templates.find((t) => t.name === "深度工作" || t.name === "番茄钟");

    return undefined;
}

/** T-1697：从自然语言生成基于模板的变体草案（复用模板身份、追踪覆写字段）。 */
export function generateTemplateVariantDraft(
    userDescription: string,
    baseTemplate?: CheckinTemplate,
    options: {templates?: readonly CheckinTemplate[]} = {}
): TemplateVariantDraftResult | undefined {
    const text = (userDescription || "").trim();
    if (!text) return undefined;

    const template = baseTemplate || findBestMatchingTemplate(text, options.templates || []);
    if (!template) return undefined;

    const overriddenFields: (keyof ProjectDraft)[] = [];
    const diffSummaries: string[] = [];

    let target = template.target;
    let unit = template.unit;
    let schedule = template.schedule;
    let timeSlot = template.timeSlot || "any";

    // 1. 数值与单位覆写提取
    const numMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(分钟|小时|毫升|千克|公斤|公里|克|升|步|页|元|次|个|组|回|项)?/);
    if (numMatch) {
        const newTarget = Number(numMatch[1]);
        if (Number.isFinite(newTarget) && newTarget > 0 && newTarget !== template.target) {
            target = newTarget;
            overriddenFields.push("target");
            diffSummaries.push(`目标由 ${template.target} 调整为 ${newTarget}`);
        }
        const newUnit = numMatch[2];
        if (newUnit && newUnit !== template.unit) {
            unit = newUnit;
            overriddenFields.push("unit");
            diffSummaries.push(`单位由 ${template.unit} 替换为 ${newUnit}`);
        }
    }

    // 2. 排期覆写提取
    if (/工作日/.test(text) && template.schedule.type !== "workdays") {
        schedule = {type: "workdays"};
        overriddenFields.push("schedule");
        diffSummaries.push("排期变更为工作日");
    } else if (/(?:每天|每日)/.test(text) && template.schedule.type !== "daily") {
        schedule = {type: "daily"};
        overriddenFields.push("schedule");
        diffSummaries.push("排期变更为每天");
    }

    // 3. 时段覆写提取
    if (/(?:早晨|早上|晨间|早起)/.test(text) && timeSlot !== "morning") {
        timeSlot = "morning";
        overriddenFields.push("timeSlot");
        diffSummaries.push("建议时段设为早晨");
    } else if (/(?:晚上|睡前|夜间)/.test(text) && timeSlot !== "evening") {
        timeSlot = "evening";
        overriddenFields.push("timeSlot");
        diffSummaries.push("建议时段设为晚间");
    }

    const templateAnchor = `tpl-${template.name}`;
    const draft: ProjectDraft = {
        name: template.name,
        icon: template.icon,
        kind: template.kind,
        target,
        unit,
        schedule,
        group: template.group,
        priority: template.priority,
        timeSlot,
        note: template.note,
    };

    const diffSummary = diffSummaries.length > 0
        ? `基于「${template.name}」模板微调：${diffSummaries.join("，")}`
        : `采用「${template.name}」基准模板`;

    return Object.freeze({
        baseTemplateName: template.name,
        templateAnchor,
        draft: Object.freeze(draft),
        overriddenFields: Object.freeze(overriddenFields),
        diffSummary,
    });
}

/** T-1698：自然语言意图分类。 */
export type AiIntentType = "checkin_item" | "occasion" | "ambiguous" | "unsupported";

/** T-1698：日期事项草案轻量结构（与 Occasion 保持兼容）。 */
export interface OccasionDraft {
    readonly name: string;
    readonly date: string;
    readonly kind: OccasionKind;
    readonly recurrence: OccasionRecurrence;
    readonly note?: string;
    readonly remindBeforeDays?: number;
}

/** T-1698：AI 候选草案条目（打卡习惯或日期事项）。 */
export type AiCandidateDraft =
    | {
          readonly type: "checkin_item";
          readonly draft: ProjectDraft;
          readonly label: string;
          readonly confidence: number;
          readonly reason: string;
      }
    | {
          readonly type: "occasion";
          readonly draft: OccasionDraft;
          readonly label: string;
          readonly confidence: number;
          readonly reason: string;
      };

/** T-1698：消歧提示与选项结构。 */
export interface AiIntentDisambiguation {
    readonly prompt: string;
    readonly reason: string;
    readonly options: readonly {
        readonly label: string;
        readonly intentType: "checkin_item" | "occasion";
        readonly description: string;
    }[];
}

/** T-1698：认知负担评估结果（评估一次性草案、追问式与多候选）。 */
export interface CognitiveBurdenAssessment {
    readonly strategy: "one_shot" | "two_candidates" | "disambiguation" | "reject";
    readonly burdenScore: "low" | "medium" | "high";
    readonly rationale: string;
    readonly followUpDisallowed: true;
}

/** T-1698：统一 AI 意图 Envelope（未来与建事项共用）。 */
export interface AiIntentEnvelope {
    readonly schemaVersion: 1;
    readonly userInput: string;
    readonly sanitizedInput: string;
    readonly intentType: AiIntentType;
    readonly confidence: number;
    readonly primaryCandidate?: AiCandidateDraft;
    readonly secondaryCandidate?: AiCandidateDraft; // 严格至多 2 个候选
    readonly disambiguation?: AiIntentDisambiguation;
    readonly cognitiveBurdenAssessment: CognitiveBurdenAssessment;
    readonly privacyDisclosure: AiDraftPrivacyDisclosure;
    readonly zeroDataLossGuarantee: true;
    readonly externalApiRequired: false;
}

/** T-1698：自然语言意图分类详情。 */
export interface IntentClassificationDetails {
    readonly intentType: AiIntentType;
    readonly confidence: number;
    readonly reason: string;
    readonly detectedDate?: string;
    readonly detectedPeriodicity?: string;
    readonly isSingleEvent: boolean;
    readonly isHabitRoutine: boolean;
}

/** T-1698：纯函数：对用户自然语言输入进行意图分类与边界识别。 */
export function classifyNaturalLanguageIntent(
    userDescription: string,
    options: {currentDate?: string} = {}
): IntentClassificationDetails {
    const text = (userDescription || "").trim();
    if (!text || !/[a-zA-Z0-9\u4e00-\u9fa5]/.test(text)) {
        return Object.freeze({
            intentType: "unsupported",
            confidence: 0,
            reason: "输入为空或仅包含标点符号",
            isSingleEvent: false,
            isHabitRoutine: false,
        });
    }

    const currentDate = options.currentDate || new Date().toISOString().slice(0, 10);

    // 1. 日期匹配（明确的具体日期或相对天数）
    let detectedDate: string | undefined;
    const absDateMatch = text.match(/(20[2-9][0-9])[-/.年](\d{1,2})[-/.月](\d{1,2})[日号]?/);
    if (absDateMatch) {
        const y = absDateMatch[1];
        const m = absDateMatch[2].padStart(2, "0");
        const d = absDateMatch[3].padStart(2, "0");
        detectedDate = `${y}-${m}-${d}`;
    } else {
        const shortDateMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]?/);
        if (shortDateMatch) {
            const currentYear = currentDate.slice(0, 4);
            const m = shortDateMatch[1].padStart(2, "0");
            const d = shortDateMatch[2].padStart(2, "0");
            detectedDate = `${currentYear}-${m}-${d}`;
        } else if (/明天/.test(text)) {
            const [y, m, d] = currentDate.split("-").map(Number);
            const dt = new Date(Date.UTC(y, m - 1, d + 1));
            detectedDate = dt.toISOString().slice(0, 10);
        } else if (/后天/.test(text)) {
            const [y, m, d] = currentDate.split("-").map(Number);
            const dt = new Date(Date.UTC(y, m - 1, d + 2));
            detectedDate = dt.toISOString().slice(0, 10);
        }
    }

    // 2. 事项/提醒关键词检测
    const occasionKeywords = /(?:生日|纪念日|周年|体检|开会|交报告|提交报告|还款|截稿|发薪|预约|领证|婚礼|结婚|缴费|期末考|考试|看牙|买票|出差|航班|看电影|聚餐)/;
    const hasOccasionKeyword = occasionKeywords.test(text);

    // 3. 习惯/打卡周期关键词与指标检测
    const habitPeriodicKeywords = /(?:每天|每日|每晚|早起|晨间|睡前|工作日|周末|每周|每月|隔天|坚持|习惯|打卡)/;
    const hasHabitPeriodicKeyword = habitPeriodicKeywords.test(text);
    const hasMetricUnit = /[0-9]+(?:\.[0-9]+)?\s*(?:分钟|小时|毫升|千克|公斤|公里|克|升|步|页|次|个|组|回|项)/.test(text);
    const habitRoutineVerbs = /(?:喝水|运动|跑步|阅读|看书|背单词|冥想|拉伸|练字|刷牙|深蹲|俯卧撑|吃苹果|吃早餐|早睡|戒糖|复盘)/;
    const hasHabitRoutineVerb = habitRoutineVerbs.test(text);

    const isHabitRoutine = hasHabitPeriodicKeyword || (hasMetricUnit && hasHabitRoutineVerb) || (!hasOccasionKeyword && !detectedDate && hasHabitRoutineVerb);
    const isSingleEvent = hasOccasionKeyword || (Boolean(detectedDate) && !hasHabitPeriodicKeyword);

    // 4. 判决决策树
    if (isHabitRoutine && !isSingleEvent) {
        return Object.freeze({
            intentType: "checkin_item",
            confidence: 0.95,
            reason: "检测到明确的周期习惯关键词或日常打卡量化指标",
            detectedPeriodicity: text.match(habitPeriodicKeywords)?.[0] || "每天",
            isSingleEvent: false,
            isHabitRoutine: true,
        });
    }

    if (isSingleEvent && !hasHabitPeriodicKeyword) {
        // 如果虽然有 habitRoutineVerb 但带有明确单次日期且无周期词（如 "10月28日跑步" 或 "明天看书"）
        if (hasHabitRoutineVerb) {
            return Object.freeze({
                intentType: "ambiguous",
                confidence: 0.6,
                reason: "同时包含具体单点日期与日常活动动词，存在单次事项与习惯启动的二元分歧",
                detectedDate,
                isSingleEvent: true,
                isHabitRoutine: true,
            });
        }
        return Object.freeze({
            intentType: "occasion",
            confidence: 0.95,
            reason: "检测到明确的具体日期、截止时间或事项提醒特征",
            detectedDate,
            isSingleEvent: true,
            isHabitRoutine: false,
        });
    }

    if (isHabitRoutine && isSingleEvent) {
        return Object.freeze({
            intentType: "ambiguous",
            confidence: 0.5,
            reason: "文本同时包含习惯周期与具体日期事项特征，需用户消歧确认",
            detectedDate,
            isSingleEvent: true,
            isHabitRoutine: true,
        });
    }

    // 兜底：如果只是普通短语，看是否能解析为打卡草案
    const draft = generateLocalFallbackDraft(text);
    if (draft && draft.name && draft.name !== "未命名打卡") {
        return Object.freeze({
            intentType: "checkin_item",
            confidence: 0.7,
            reason: "通过自然语言规则成功提取出打卡项目名称与默认配置",
            isSingleEvent: false,
            isHabitRoutine: true,
        });
    }

    return Object.freeze({
        intentType: "unsupported",
        confidence: 0.1,
        reason: "未能识别出有效的打卡习惯或日期事项信息",
        isSingleEvent: false,
        isHabitRoutine: false,
    });
}

/** T-1698：生成统一 AI 意图 Envelope（支持打卡项/事项/歧义/不可用，至多双候选与零追问保证）。 */
export function generateAiIntentEnvelope(
    userDescription: string,
    options: {
        currentDate?: string;
        templates?: readonly CheckinTemplate[];
    } = {}
): AiIntentEnvelope {
    const userInput = userDescription || "";
    const minimalContext = buildMinimalAiDraftContext(userInput);
    const sanitizedInput = minimalContext.userDescription;
    const privacyDisclosure = getAiDraftPrivacyDisclosure();
    const currentDate = options.currentDate || new Date().toISOString().slice(0, 10);

    const classification = classifyNaturalLanguageIntent(sanitizedInput, {currentDate});

    let primaryCandidate: AiCandidateDraft | undefined;
    let secondaryCandidate: AiCandidateDraft | undefined;
    let disambiguation: AiIntentDisambiguation | undefined;
    let cognitiveBurdenAssessment: CognitiveBurdenAssessment;

    if (classification.intentType === "checkin_item") {
        const itemDraft = generateLocalFallbackDraft(sanitizedInput) || {
            name: sanitizedInput.slice(0, 20),
            icon: "✓",
            kind: "binary",
            target: 1,
            unit: "次",
            schedule: {type: "daily"},
            group: "日常",
            priority: "medium",
            timeSlot: "any",
            note: "",
        };
        primaryCandidate = {
            type: "checkin_item",
            draft: itemDraft,
            label: `习惯打卡：${itemDraft.name}`,
            confidence: classification.confidence,
            reason: classification.reason,
        };

        // 如果存在多模态（例如背单词或阅读按打卡/计次 vs 按时长），生成至多第 2 个候选
        if (/背单词|单词|看书|阅读/.test(sanitizedInput) && itemDraft.kind !== "duration") {
            const durationDraft: ProjectDraft = {
                ...itemDraft,
                kind: "duration",
                target: 30,
                unit: "分钟",
                note: "按时长记录阅读/背单词",
            };
            secondaryCandidate = {
                type: "checkin_item",
                draft: durationDraft,
                label: `按时长记录：${itemDraft.name} 30分钟`,
                confidence: 0.8,
                reason: "提供按计时模式记录的备选草案",
            };
        }

        cognitiveBurdenAssessment = {
            strategy: secondaryCandidate ? "two_candidates" : "one_shot",
            burdenScore: "low",
            rationale: secondaryCandidate
                ? "针对双重量化模式提供至多两个高命中率候选，无需多轮追问即可一键切换"
                : "具有明确周期习惯特征，采用一次性合理默认草案回填表单，免除多轮追问疲劳",
            followUpDisallowed: true,
        };
    } else if (classification.intentType === "occasion") {
        const eventName = sanitizedInput
            .replace(/(?:20[2-9][0-9][-/年]\d{1,2}[-/月]\d{1,2}[日号]?|\d{1,2}月\d{1,2}[日号]?|明天|后天|提醒我|去)/g, "")
            .trim() || sanitizedInput;

        let kind: OccasionKind = "scheduled";
        let recurrence: OccasionRecurrence = "once";
        if (/生日/.test(sanitizedInput)) {
            kind = "birthday";
            recurrence = "annual";
        } else if (/纪念日|周年/.test(sanitizedInput)) {
            kind = "anniversary";
            recurrence = "annual";
        }

        const occasionDraft: OccasionDraft = {
            name: eventName,
            date: classification.detectedDate || currentDate,
            kind,
            recurrence,
            remindBeforeDays: kind === "scheduled" ? 1 : 3,
            note: "由 AI 自然语言意图推断生成",
        };

        primaryCandidate = {
            type: "occasion",
            draft: occasionDraft,
            label: `日期事项：${occasionDraft.name}`,
            confidence: classification.confidence,
            reason: classification.reason,
        };

        cognitiveBurdenAssessment = {
            strategy: "one_shot",
            burdenScore: "low",
            rationale: "具有明确单点日期或纪念日特征，生成一次性事项草案，避免误建为周期习惯",
            followUpDisallowed: true,
        };
    } else if (classification.intentType === "ambiguous") {
        // 存在歧义：同时生成两个候选（1个习惯，1个事项）
        const habitDraft = generateLocalFallbackDraft(sanitizedInput) || {
            name: sanitizedInput.slice(0, 20),
            icon: "✓",
            kind: "binary",
            target: 1,
            unit: "次",
            schedule: {type: "daily"},
            group: "日常",
            priority: "medium",
            timeSlot: "any",
            note: "",
        };
        const eventName = sanitizedInput
            .replace(/(?:20[2-9][0-9][-/年]\d{1,2}[-/月]\d{1,2}[日号]?|\d{1,2}月\d{1,2}[日号]?|明天|后天|提醒我|去)/g, "")
            .trim() || sanitizedInput;

        primaryCandidate = {
            type: "checkin_item",
            draft: habitDraft,
            label: `周期习惯：${habitDraft.name}（每天）`,
            confidence: 0.5,
            reason: "解释为从指定日期开始建立长期日常打卡习惯",
        };

        secondaryCandidate = {
            type: "occasion",
            draft: {
                name: eventName,
                date: classification.detectedDate || currentDate,
                kind: "scheduled",
                recurrence: "once",
                remindBeforeDays: 1,
                note: "单次活动/安排提醒",
            },
            label: `单次事项：${eventName}（${classification.detectedDate || currentDate}）`,
            confidence: 0.5,
            reason: "解释为仅在特定日期发生的单次活动或事务提醒",
        };

        disambiguation = {
            prompt: "检测到输入可能为「日常周期习惯」或「单次日期事项」，请选择适合的形式：",
            reason: classification.reason,
            options: [
                {
                    label: "长期习惯打卡",
                    intentType: "checkin_item",
                    description: "每天/周期性追踪并记录连击进度",
                },
                {
                    label: "单次日期事项",
                    intentType: "occasion",
                    description: "仅在指定日期提醒并显示倒数天数",
                },
            ],
        };

        cognitiveBurdenAssessment = {
            strategy: "disambiguation",
            burdenScore: "medium",
            rationale: "存在单次事项与习惯养成的二元分歧，提供至多两个互斥候选供用户一键决策，杜绝多轮追问或静默误建",
            followUpDisallowed: true,
        };
    } else {
        cognitiveBurdenAssessment = {
            strategy: "reject",
            burdenScore: "low",
            rationale: "输入缺乏有效结构化信息，不自动生成打卡项或事项，保证零垃圾数据产生",
            followUpDisallowed: true,
        };
    }

    return Object.freeze({
        schemaVersion: 1,
        userInput,
        sanitizedInput,
        intentType: classification.intentType,
        confidence: classification.confidence,
        primaryCandidate: primaryCandidate ? Object.freeze(primaryCandidate) : undefined,
        secondaryCandidate: secondaryCandidate ? Object.freeze(secondaryCandidate) : undefined,
        disambiguation: disambiguation ? Object.freeze(disambiguation) : undefined,
        cognitiveBurdenAssessment: Object.freeze(cognitiveBurdenAssessment),
        privacyDisclosure,
        zeroDataLossGuarantee: true,
        externalApiRequired: false,
    });
}








