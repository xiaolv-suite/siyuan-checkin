/* T-1699 结构化 AI 草案历史治理、脱敏容量限制、跨窗口非并集合并与生命周期策略。
   - 隐私铁律：严禁持久化用户长文本 Prompt 原文，仅保留结构化字段与脱敏摘要；
   - 容量策略：单桶硬上限 20 条（MAX_AI_DRAFT_HISTORY_ENTRIES），7 天 TTL 物理淘汰；
   - 跨窗口并发：严禁复用事实桶的并集合并规则，采用快照覆盖 + 墓碑隔离防复活；
   - 失败回滚：写入失败自动降级为会话级内存缓存，绝不阻塞主打卡数据；
   - 导出契约：严格对齐 T-1627 / T-1862，主档备份与 CSV 绝对不包含 AI 草案历史。 */

import type {ProjectDraft} from "./project-draft";
import type {OccasionDraft} from "./natural-language-draft";

export const AI_DRAFT_HISTORY_STORAGE_NAME = "ai-draft-history.json";
export const MAX_AI_DRAFT_HISTORY_ENTRIES = 20;
export const AI_DRAFT_HISTORY_TTL_DAYS = 7;
export const MAX_TOMBSTONES_COUNT = 50;

export type AiDraftHistoryStatus = "pending" | "applied" | "discarded";

/** T-1699：结构化 AI 草案历史条目（无 Prompt 原文，仅脱敏结构体）。 */
export interface AiDraftHistoryEntry {
    readonly id: string;
    readonly createdAt: string; // ISO 8601
    readonly updatedAt: string; // ISO 8601
    readonly summary: string; // <= 40 字符脱敏名称或微调摘要
    readonly intentType: "checkin_item" | "occasion";
    readonly source: "local" | "provider" | "manual";
    readonly draftPayload: ProjectDraft | OccasionDraft;
    readonly status: AiDraftHistoryStatus;
    readonly ttlExpiresAt: string; // ISO 8601
}

/** T-1699：AI 草案历史辅助存储桶定义。 */
export interface AiDraftHistoryBucket {
    readonly schemaVersion: 1;
    readonly bucketId: "ai_draft_history";
    readonly clearedBefore?: string; // 全局清空截断点
    readonly tombstones: readonly string[]; // 显式删除的草案 ID
    readonly entries: readonly AiDraftHistoryEntry[];
}

/** T-1699：跨窗口非并集合并对账诊断回执。 */
export interface AiDraftMergeResult {
    readonly mergedBucket: AiDraftHistoryBucket;
    readonly droppedCount: number;
    readonly resurrectedPreventedCount: number;
    readonly prunedTtlCount: number;
}

/** 创建初始空的 AI 草案历史桶。 */
export function createEmptyAiDraftHistoryBucket(): AiDraftHistoryBucket {
    return Object.freeze({
        schemaVersion: 1,
        bucketId: "ai_draft_history",
        tombstones: Object.freeze([]),
        entries: Object.freeze([]),
    });
}

/** 计算指定时刻之后 N 天的 ISO 时间戳。 */
function computeTtlExpiryIso(nowIso: string, days: number = AI_DRAFT_HISTORY_TTL_DAYS): string {
    const ts = Date.parse(nowIso) || Date.now();
    return new Date(ts + days * 86400 * 1000).toISOString();
}

/** 净化脱敏摘要，确保不含长文本或个人凭据，硬截断至 40 字符。 */
export function sanitizeDraftSummary(rawSummary: string): string {
    return (rawSummary || "未命名草案")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/(?:bearer\s+[a-zA-Z0-9_.-]{16,}|(?:sk|ak)-[a-zA-Z0-9_-]{16,})/gi, "[TOKEN]")
        .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, "[EMAIL]")
        .trim()
        .slice(0, 40);
}

/** 记录一条结构化 AI 草案到辅助桶（自动脱敏、执行 TTL 与 20 条 FIFO 截断）。 */
export function recordAiDraftHistoryEntry(
    bucket: AiDraftHistoryBucket,
    input: {
        id?: string;
        summary: string;
        intentType: "checkin_item" | "occasion";
        source: "local" | "provider" | "manual";
        draftPayload: ProjectDraft | OccasionDraft;
        nowIso?: string;
    }
): {bucket: AiDraftHistoryBucket; recordedEntry: AiDraftHistoryEntry} {
    const now = input.nowIso || new Date().toISOString();
    const id = input.id || `aid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const summary = sanitizeDraftSummary(input.summary);
    const ttlExpiresAt = computeTtlExpiryIso(now, AI_DRAFT_HISTORY_TTL_DAYS);

    const entry: AiDraftHistoryEntry = Object.freeze({
        id,
        createdAt: now,
        updatedAt: now,
        summary,
        intentType: input.intentType,
        source: input.source,
        draftPayload: Object.freeze({...input.draftPayload}),
        status: "pending",
        ttlExpiresAt,
    });

    // 过滤掉已过期的条目，排除已存在同 ID
    const activeEntries = bucket.entries.filter((e) => e.id !== id && e.ttlExpiresAt > now);
    const updatedEntries = [entry, ...activeEntries].slice(0, MAX_AI_DRAFT_HISTORY_ENTRIES);

    const updatedBucket: AiDraftHistoryBucket = Object.freeze({
        ...bucket,
        entries: Object.freeze(updatedEntries),
    });

    return {bucket: updatedBucket, recordedEntry: entry};
}

/** 更新指定历史草案的状态（applied 采纳或 discarded 放弃）。 */
export function updateAiDraftHistoryStatus(
    bucket: AiDraftHistoryBucket,
    entryId: string,
    status: AiDraftHistoryStatus,
    nowIso?: string
): AiDraftHistoryBucket {
    const now = nowIso || new Date().toISOString();
    let hasChanges = false;

    const entries = bucket.entries.map((entry) => {
        if (entry.id === entryId && entry.status !== status) {
            hasChanges = true;
            return Object.freeze({
                ...entry,
                status,
                updatedAt: now,
            });
        }
        return entry;
    });

    if (!hasChanges) return bucket;

    return Object.freeze({
        ...bucket,
        entries: Object.freeze(entries),
    });
}

/** 显式删除单个 AI 草案：登记 Tombstone 墓碑，物理移除条目，防跨窗口死灰复燃。 */
export function deleteAiDraftHistoryEntry(
    bucket: AiDraftHistoryBucket,
    entryId: string,
    nowIso?: string
): AiDraftHistoryBucket {
    const existing = bucket.entries.find((e) => e.id === entryId);
    if (!existing && bucket.tombstones.includes(entryId)) {
        return bucket;
    }

    const newTombstones = [entryId, ...bucket.tombstones.filter((id) => id !== entryId)].slice(0, MAX_TOMBSTONES_COUNT);
    const remainingEntries = bucket.entries.filter((e) => e.id !== entryId);

    return Object.freeze({
        ...bucket,
        tombstones: Object.freeze(newTombstones),
        entries: Object.freeze(remainingEntries),
    });
}

/** 一键清除所有 AI 草案历史：更新 clearedBefore 截断点，彻底清空条目与墓碑。 */
export function clearAllAiDraftHistory(
    bucket: AiDraftHistoryBucket,
    nowIso?: string
): AiDraftHistoryBucket {
    const now = nowIso || new Date().toISOString();
    return Object.freeze({
        schemaVersion: 1,
        bucketId: "ai_draft_history",
        clearedBefore: now,
        tombstones: Object.freeze([]),
        entries: Object.freeze([]),
    });
}

/** T-1699 核心契约：跨窗口非并集合并对账纯函数。
 * 绝对严禁复用事实桶的无脑并集合并规则！
 * 1. 采用全局清空截断点 clearedBefore 隔离旧记录；
 * 2. 联合墓碑过滤，阻止已删除草案在其他窗口复活；
 * 3. 状态优先级加 LWW 解决并发修改；
 * 4. 强制执行 20 条硬容量与 7 天 TTL 淘汰。 */
export function reconcileCrossWindowAiDraftBuckets(
    localBucket: AiDraftHistoryBucket,
    remoteBucket: AiDraftHistoryBucket,
    options: {nowIso?: string} = {}
): AiDraftMergeResult {
    const now = options.nowIso || new Date().toISOString();

    // 1. 比较最大全清截断点
    const localCleared = localBucket.clearedBefore ? Date.parse(localBucket.clearedBefore) : 0;
    const remoteCleared = remoteBucket.clearedBefore ? Date.parse(remoteBucket.clearedBefore) : 0;
    const effectiveClearedBefore = Math.max(localCleared, remoteCleared);
    const effectiveClearedBeforeIso = effectiveClearedBefore > 0 ? new Date(effectiveClearedBefore).toISOString() : undefined;

    // 2. 墓碑集合并（去重取至多 50 个最新墓碑）
    const combinedTombstonesSet = new Set<string>([...localBucket.tombstones, ...remoteBucket.tombstones]);
    const combinedTombstones = Array.from(combinedTombstonesSet).slice(0, MAX_TOMBSTONES_COUNT);

    let resurrectedPreventedCount = 0;
    let prunedTtlCount = 0;
    let droppedCount = 0;

    // 3. 收集所有未被截断、未被删除且未过期的候选条目
    const candidateMap = new Map<string, AiDraftHistoryEntry>();
    const allCandidates = [...localBucket.entries, ...remoteBucket.entries];

    for (const entry of allCandidates) {
        // 检查是否早于全局清空时间
        if (effectiveClearedBefore > 0 && Date.parse(entry.createdAt) <= effectiveClearedBefore) {
            droppedCount++;
            continue;
        }

        // 检查是否命中墓碑（防跨窗口复活核心逻辑）
        if (combinedTombstonesSet.has(entry.id)) {
            resurrectedPreventedCount++;
            continue;
        }

        // 检查 TTL 过期
        if (Date.parse(entry.ttlExpiresAt) <= Date.parse(now)) {
            prunedTtlCount++;
            continue;
        }

        const existing = candidateMap.get(entry.id);
        if (!existing) {
            candidateMap.set(entry.id, entry);
        } else {
            // 解决并发冲突：终态状态（applied / discarded）优先于 pending 态
            const existingIsFinal = existing.status !== "pending";
            const currentIsFinal = entry.status !== "pending";

            if (currentIsFinal && !existingIsFinal) {
                candidateMap.set(entry.id, entry);
            } else if (existingIsFinal && !currentIsFinal) {
                // keep existing
            } else {
                // 相同状态级别，按 updatedAt 晚者胜出（LWW）
                const existingUpdated = Date.parse(existing.updatedAt) || 0;
                const currentUpdated = Date.parse(entry.updatedAt) || 0;
                if (currentUpdated > existingUpdated) {
                    candidateMap.set(entry.id, entry);
                }
            }
        }
    }

    // 4. 按创建时间从新到旧排序并执行 20 条硬上限截断
    const sortedEntries = Array.from(candidateMap.values())
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const finalEntries = sortedEntries.slice(0, MAX_AI_DRAFT_HISTORY_ENTRIES);
    if (sortedEntries.length > MAX_AI_DRAFT_HISTORY_ENTRIES) {
        droppedCount += (sortedEntries.length - MAX_AI_DRAFT_HISTORY_ENTRIES);
    }

    const mergedBucket: AiDraftHistoryBucket = Object.freeze({
        schemaVersion: 1,
        bucketId: "ai_draft_history",
        clearedBefore: effectiveClearedBeforeIso,
        tombstones: Object.freeze(combinedTombstones),
        entries: Object.freeze(finalEntries),
    });

    return Object.freeze({
        mergedBucket,
        droppedCount,
        resurrectedPreventedCount,
        prunedTtlCount,
    });
}

/** T-1699 导出边界审计：根据 T-1627 主档口径判定是否输出 AI 草案。 */
export function auditAiDraftExportScope(
    bucket: AiDraftHistoryBucket,
    exportFormat: "json_backup" | "backup_envelope" | "csv"
): {isIncluded: boolean; exportedEntries: readonly AiDraftHistoryEntry[]; reason: string} {
    if (exportFormat === "json_backup") {
        return Object.freeze({
            isIncluded: false,
            exportedEntries: Object.freeze([]),
            reason: "主档备份仅收录主 Store（项目、事件与墓碑），临时 AI 草案历史不在主档备份范围内（T-1627）",
        });
    }

    if (exportFormat === "csv") {
        return Object.freeze({
            isIncluded: false,
            exportedEntries: Object.freeze([]),
            reason: "普通打卡 CSV 仅导出打卡事实数据，不包含临时 AI 历史",
        });
    }

    // backup_envelope（多桶格式）仅在显式要求时导出纯脱敏结构
    return Object.freeze({
        isIncluded: true,
        exportedEntries: bucket.entries,
        reason: "多桶备份 Envelope 经脱敏后仅作为可选辅助桶导出，不复用事实桶并集语义",
    });
}

/** 归一化持久化读取的原始 JSON 数据，自动执行 7 天 TTL 与 20 条上限裁剪。 */
export function normalizeAiDraftHistoryBucket(raw: unknown, nowIso?: string): AiDraftHistoryBucket {
    const parsed = typeof raw === "string" ? (() => { try { return JSON.parse(raw) as unknown; } catch { return undefined; } })() : raw;
    if (!parsed || typeof parsed !== "object") return createEmptyAiDraftHistoryBucket();
    const candidate = parsed as Partial<AiDraftHistoryBucket>;
    const now = nowIso || new Date().toISOString();
    const nowMs = Date.parse(now) || Date.now();
    const tombstones = Array.isArray(candidate.tombstones)
        ? candidate.tombstones.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, MAX_TOMBSTONES_COUNT)
        : [];
    const tombstoneSet = new Set(tombstones);
    const clearedBefore = typeof candidate.clearedBefore === "string" && Number.isFinite(Date.parse(candidate.clearedBefore))
        ? candidate.clearedBefore
        : undefined;
    const clearedMs = clearedBefore ? Date.parse(clearedBefore) : 0;
    const entries: AiDraftHistoryEntry[] = [];
    if (Array.isArray(candidate.entries)) {
        for (const item of candidate.entries) {
            if (!item || typeof item !== "object") continue;
            const e = item as Partial<AiDraftHistoryEntry>;
            if (typeof e.id !== "string" || !e.id || tombstoneSet.has(e.id)) continue;
            if (e.intentType !== "checkin_item" && e.intentType !== "occasion") continue;
            if (!e.draftPayload || typeof e.draftPayload !== "object") continue;
            const createdAt = typeof e.createdAt === "string" && Number.isFinite(Date.parse(e.createdAt)) ? e.createdAt : now;
            if (clearedMs > 0 && Date.parse(createdAt) <= clearedMs) continue;
            const ttlExpiresAt = typeof e.ttlExpiresAt === "string" && Number.isFinite(Date.parse(e.ttlExpiresAt))
                ? e.ttlExpiresAt
                : computeTtlExpiryIso(createdAt, AI_DRAFT_HISTORY_TTL_DAYS);
            if (Date.parse(ttlExpiresAt) <= nowMs) continue;
            const status: AiDraftHistoryStatus = e.status === "applied" || e.status === "discarded" ? e.status : "pending";
            const source = e.source === "provider" || e.source === "manual" ? e.source : "local";
            entries.push(Object.freeze({
                id: e.id,
                createdAt,
                updatedAt: typeof e.updatedAt === "string" ? e.updatedAt : createdAt,
                summary: sanitizeDraftSummary(typeof e.summary === "string" ? e.summary : ""),
                intentType: e.intentType,
                source,
                draftPayload: e.draftPayload,
                status,
                ttlExpiresAt,
            }));
        }
    }
    entries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return Object.freeze({
        schemaVersion: 1,
        bucketId: "ai_draft_history",
        ...(clearedBefore ? {clearedBefore} : {}),
        tombstones: Object.freeze(tombstones),
        entries: Object.freeze(entries.slice(0, MAX_AI_DRAFT_HISTORY_ENTRIES)),
    });
}

