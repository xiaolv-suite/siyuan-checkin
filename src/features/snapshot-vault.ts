import {normalizeCustomIconLibrary} from "../shared";
import {normalizeStore, type StreakFreezePeriod} from "../model";
import {mergeOccasionCompletions, normalizeOccasionStore, type OccasionStore} from "../occasions";
import type {CheckinStore, UserTemplate} from "../types";
import {normalizeUserTemplate} from "./templates";
import {normalizeViewPreferences, type CheckinViewPreferences} from "../view-preferences";
import {stripWereadSecretFromPreferences} from "./weread-secret";

export const CHECKIN_VAULT_PLUGIN_ID = "siyuan-checkin";
export const CHECKIN_VAULT_LABEL = "小驴打卡";
export const CHECKIN_VAULT_SCHEMA_VERSION = 1;

export interface CheckinVaultJournalData {
    templates?: unknown[];
    integration?: unknown;
}

export interface CheckinVaultSnapshotInput {
    pluginVersion?: string;
    exportedAt?: string;
    store: CheckinStore;
    occasionStore?: OccasionStore;
    userTemplates?: UserTemplate[];
    customIconLibrary?: string[];
    journalData?: CheckinVaultJournalData;
    mirrorJournal?: unknown;
    viewPreferences?: CheckinViewPreferences;
}

export interface CheckinVaultSnapshot {
    v: 1;
    pluginId: typeof CHECKIN_VAULT_PLUGIN_ID;
    schemaVersion: typeof CHECKIN_VAULT_SCHEMA_VERSION;
    pluginVersion?: string;
    exportedAt: string;
    store: CheckinStore;
    occasionStore?: OccasionStore;
    userTemplates?: UserTemplate[];
    customIconLibrary?: string[];
    journalData?: CheckinVaultJournalData;
    mirrorJournal?: unknown;
    viewPreferences?: Record<string, unknown>;
    summaryStats: {
        activeItems: number;
        archivedItems: number;
        eventCount: number;
        occasionCount: number;
    };
}

const SAFE_META_KEY_RE = /^(?:hasSecret|hasApiKey|secretSlot|secretSlots|configuredSecretSlots|secretSlotsToRebind|tokenCount|totalTokens|promptTokens|completionTokens|maxTokens|tokensUsed|tokenUsage|tokenBudget|tokenLimit|tokensPerMinute)$/i;

const SENSITIVE_KEY_EXACT_RE = /^(?:api[-_]?key|fallback[-_]?key|access[-_]?token|refresh[-_]?token|auth[-_]?token|bearer[-_]?token|gist[-_]?token|bot[-_]?token|client[-_]?secret|app[-_]?secret|secret[-_]?key|private[-_]?key|password|passwd|credential|credentials|authorization|ai[-_]?key|backup[-_]?key|weread[-_]?api[-_]?key|weread[-_]?cookie|weread[-_]?token|weread[-_]?skey|weread[-_]?vid|wr[-_]?skey|wr[-_]?vid|skey|vid|cookie|cookies|session[-_]?key|webhook[-_]?url|bark[-_]?url|token|secret)$/i;

const SENSITIVE_KEY_SUFFIX_RE = /(?:api[-_]?key|fallback[-_]?key|access[-_]?token|refresh[-_]?token|auth[-_]?token|bearer[-_]?token|gist[-_]?token|bot[-_]?token|client[-_]?secret|app[-_]?secret|secret[-_]?key|private[-_]?key|password|passwd|credential|webhook[-_]?url|bark[-_]?url|wr[-_]?skey|wr[-_]?vid|weread[-_]?cookie)$/i;

const EXCLUDED_NOISE_KEYS = new Set([
    "checkin-store-audit",
    "checkin-focus-diagnostics",
    "checkin-reminder-actions",
    "checkin-reminder-delivery",
    "agent-analysis-cache",
    "ai-draft-history",
    "ai-draft-history.json",
    "auditEntries",
    "diagnostics",
    "analysisHistory",
    "aiDraftHistory",
]);

const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
    /sk-[A-Za-z0-9_-]{8,}/g,
    /wrk-[A-Za-z0-9_-]{4,}/g,
    /Bearer\s+[A-Za-z0-9._-]{6,}/gi,
    /ghp_[A-Za-z0-9]{10,}/g,
    /xox[baprs]-[A-Za-z0-9-]{8,}/g,
    /(?:^|[;\s])(?:wr_skey|wr_vid|skey|Cookie)\s*=\s*[^;\s]+/gi,
];

function isSensitiveVaultKey(key: string, value: unknown): boolean {
    if (SAFE_META_KEY_RE.test(key)) return false;
    if (EXCLUDED_NOISE_KEYS.has(key)) return true;
    if (SENSITIVE_KEY_EXACT_RE.test(key) || SENSITIVE_KEY_SUFFIX_RE.test(key)) {
        return !(typeof value === "number" || typeof value === "boolean");
    }
    if (typeof value === "string" && /(?:token|secret|key|password|cookie|skey)$/i.test(key)) {
        if (!/(?:count|limit|budget|usage|slot|slots|name|label|mode|type|id)$/i.test(key)) {
            return true;
        }
    }
    return false;
}

export function stripSensitiveFieldsForVault<T>(value: T): T {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") {
        let next: string = value;
        for (const pattern of SECRET_VALUE_PATTERNS) {
            const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
            next = next.replace(re, "[REDACTED_SECRET]");
        }
        return next as unknown as T;
    }
    if (Array.isArray(value)) {
        return value.map((item) => stripSensitiveFieldsForVault(item)) as unknown as T;
    }
    if (typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (isSensitiveVaultKey(k, v)) continue;
            out[k] = stripSensitiveFieldsForVault(v);
        }
        return out as unknown as T;
    }
    return value;
}

export function sanitizeViewPreferencesForVault(preferences: unknown): Record<string, unknown> | undefined {
    if (!preferences || typeof preferences !== "object") return undefined;
    const stripped = stripWereadSecretFromPreferences(preferences) as Record<string, unknown>;
    const cloned = JSON.parse(JSON.stringify(stripped)) as Record<string, unknown>;
    const rawWeread = cloned.wereadIntegration;
    if (rawWeread && typeof rawWeread === "object") {
        const wi = rawWeread as Record<string, unknown>;
        cloned.wereadBindings = {
            itemId: typeof wi.itemId === "string" ? wi.itemId : "",
            thresholdMinutes: typeof wi.thresholdMinutes === "number" ? wi.thresholdMinutes : 30,
            finishItemId: typeof wi.finishItemId === "string" ? wi.finishItemId : "",
            notesItemId: typeof wi.notesItemId === "string" ? wi.notesItemId : "",
        };
    }
    delete cloned.wereadIntegration;
    if (typeof cloned.avatarImage === "string" && cloned.avatarImage.length > 131072) {
        delete cloned.avatarImage;
    }
    return stripSensitiveFieldsForVault(cloned);
}

export function buildCheckinVaultSnapshot(input: CheckinVaultSnapshotInput): CheckinVaultSnapshot {
    const cleanStore = normalizeStore(stripSensitiveFieldsForVault(JSON.parse(JSON.stringify(input.store))));
    const cleanOccasions = input.occasionStore
        ? normalizeOccasionStore(stripSensitiveFieldsForVault(JSON.parse(JSON.stringify(input.occasionStore))))
        : undefined;
    const cleanTemplates = Array.isArray(input.userTemplates)
        ? stripSensitiveFieldsForVault(JSON.parse(JSON.stringify(input.userTemplates)))
        : undefined;
    const cleanIcons = Array.isArray(input.customIconLibrary)
        ? stripSensitiveFieldsForVault(JSON.parse(JSON.stringify(input.customIconLibrary)))
        : undefined;
    const cleanJournal = input.journalData
        ? stripSensitiveFieldsForVault(JSON.parse(JSON.stringify(input.journalData)))
        : undefined;
    const cleanMirror = input.mirrorJournal !== undefined && input.mirrorJournal !== null
        ? stripSensitiveFieldsForVault(JSON.parse(JSON.stringify(input.mirrorJournal)))
        : undefined;
    const cleanPreferences = sanitizeViewPreferencesForVault(input.viewPreferences);

    const activeItems = cleanStore.items.filter((item) => !item.archived).length;
    const archivedItems = cleanStore.items.length - activeItems;

    return {
        v: 1,
        pluginId: CHECKIN_VAULT_PLUGIN_ID,
        schemaVersion: CHECKIN_VAULT_SCHEMA_VERSION,
        ...(input.pluginVersion ? {pluginVersion: input.pluginVersion} : {}),
        exportedAt: input.exportedAt || "",
        store: cleanStore,
        ...(cleanOccasions ? {occasionStore: cleanOccasions} : {}),
        ...(cleanTemplates ? {userTemplates: cleanTemplates} : {}),
        ...(cleanIcons ? {customIconLibrary: cleanIcons} : {}),
        ...(cleanJournal ? {journalData: cleanJournal} : {}),
        ...(cleanMirror !== undefined ? {mirrorJournal: cleanMirror} : {}),
        ...(cleanPreferences ? {viewPreferences: cleanPreferences} : {}),
        summaryStats: {
            activeItems,
            archivedItems,
            eventCount: cleanStore.events.length,
            occasionCount: cleanOccasions?.occasions.length ?? 0,
        },
    };
}

export interface ExtractedCheckinVaultData {
    store?: CheckinStore;
    occasionStore?: OccasionStore;
    userTemplates?: UserTemplate[];
    customIconLibrary?: string[];
    journalData?: CheckinVaultJournalData;
    mirrorJournal?: unknown;
    viewPreferences?: Record<string, unknown>;
}

export function extractCheckinVaultData(raw: unknown): ExtractedCheckinVaultData {
    if (!raw || typeof raw !== "object") return {};
    const candidate = raw as Record<string, unknown>;

    // 支持 BackupEnvelope 多桶格式（buckets["checkin-store"] 等）
    if (candidate.buckets && typeof candidate.buckets === "object") {
        const buckets = candidate.buckets as Record<string, {data?: unknown} | undefined>;
        const storeRaw = buckets["checkin-store"]?.data;
        const occRaw = buckets["checkin-occasion-store"]?.data;
        const tplRaw = buckets["checkin-templates"]?.data;
        const iconRaw = buckets["checkin-custom-icon-library"]?.data;
        const journalRaw = buckets["checkin-journal-data"]?.data;
        const prefsRaw = buckets["checkin-view-preferences"]?.data;
        return {
            store: storeRaw && typeof storeRaw === "object" ? normalizeStore(storeRaw) : undefined,
            occasionStore: occRaw && typeof occRaw === "object" ? normalizeOccasionStore(occRaw) : undefined,
            userTemplates: Array.isArray(tplRaw)
                ? tplRaw.map((t) => normalizeUserTemplate(t)).filter((t): t is UserTemplate => Boolean(t))
                : undefined,
            customIconLibrary: Array.isArray(iconRaw) ? normalizeCustomIconLibrary(iconRaw) : undefined,
            journalData: journalRaw && typeof journalRaw === "object" ? (journalRaw as CheckinVaultJournalData) : undefined,
            viewPreferences: prefsRaw && typeof prefsRaw === "object" ? (prefsRaw as Record<string, unknown>) : undefined,
        };
    }

    const storeSource = candidate.store && typeof candidate.store === "object"
        ? candidate.store
        : (Array.isArray(candidate.items) || Array.isArray(candidate.events) ? candidate : undefined);

    return {
        store: storeSource ? normalizeStore(storeSource) : undefined,
        occasionStore: candidate.occasionStore && typeof candidate.occasionStore === "object"
            ? normalizeOccasionStore(candidate.occasionStore)
            : undefined,
        userTemplates: Array.isArray(candidate.userTemplates)
            ? candidate.userTemplates.map((t) => normalizeUserTemplate(t)).filter((t): t is UserTemplate => Boolean(t))
            : undefined,
        customIconLibrary: Array.isArray(candidate.customIconLibrary)
            ? normalizeCustomIconLibrary(candidate.customIconLibrary)
            : undefined,
        journalData: candidate.journalData && typeof candidate.journalData === "object"
            ? (candidate.journalData as CheckinVaultJournalData)
            : undefined,
        mirrorJournal: candidate.mirrorJournal,
        viewPreferences: candidate.viewPreferences && typeof candidate.viewPreferences === "object"
            ? (candidate.viewPreferences as Record<string, unknown>)
            : undefined,
    };
}

export function extractCheckinVaultCounts(raw: unknown): {items: number; events: number; occasions: number; total: number} {
    const extracted = extractCheckinVaultData(raw);
    const items = extracted.store?.items.length ?? 0;
    const events = extracted.store?.events.length ?? 0;
    const occasions = extracted.occasionStore?.occasions.length ?? 0;
    return {
        items,
        events,
        occasions,
        total: items + events + occasions,
    };
}

export function countCheckinVaultRecords(snapshot: Record<string, unknown> | null | undefined): number {
    if (!snapshot || typeof snapshot !== "object") return 0;
    return extractCheckinVaultCounts(snapshot).total;
}

export function previewCheckinVaultDiff(
    current: {store: CheckinStore; occasionStore?: OccasionStore},
    incoming: Record<string, unknown> | null | undefined
): {currentCount: number; incomingCount: number; summary: string} {
    const curItems = current.store?.items?.length ?? 0;
    const curEvents = current.store?.events?.length ?? 0;
    const curOccasions = current.occasionStore?.occasions?.length ?? 0;
    const currentCount = curItems + curEvents + curOccasions;

    const inc = extractCheckinVaultCounts(incoming);
    return {
        currentCount,
        incomingCount: inc.total,
        summary: `习惯 ${curItems}→${inc.items} · 打卡记录 ${curEvents}→${inc.events} · 重要日子 ${curOccasions}→${inc.occasions}`,
    };
}

export function mergeCheckinVaultPreferences(
    localPrefs: CheckinViewPreferences,
    incomingRaw: Record<string, unknown> | undefined
): CheckinViewPreferences {
    if (!incomingRaw || typeof incomingRaw !== "object") return localPrefs;
    const sanitizedIncoming = stripWereadSecretFromPreferences(stripSensitiveFieldsForVault(incomingRaw));
    const normalizedIncoming = normalizeViewPreferences(sanitizedIncoming);

    // 合并冷冻期（按 startDate+endDate 去重）
    const freezeMap = new Map<string, StreakFreezePeriod>();
    for (const period of localPrefs.streakFreezePeriods || []) {
        freezeMap.set(`${period.startDate}:${period.endDate}`, period);
    }
    for (const period of normalizedIncoming.streakFreezePeriods || []) {
        const key = `${period.startDate}:${period.endDate}`;
        if (!freezeMap.has(key)) freezeMap.set(key, period);
    }

    // 合并已保存视图（按 id 去重，保留本机优先）
    const savedViewsMap = new Map<string, CheckinViewPreferences["savedViews"][number]>();
    for (const view of normalizedIncoming.savedViews || []) {
        savedViewsMap.set(view.id, view);
    }
    for (const view of localPrefs.savedViews || []) {
        savedViewsMap.set(view.id, view);
    }

    // 合并分组折叠与最近模板
    const collapsedGroups = Array.from(new Set([
        ...(localPrefs.collapsedGroups || []),
        ...(normalizedIncoming.collapsedGroups || []),
    ])).slice(0, 200);
    const recentTemplates = Array.from(new Set([
        ...(localPrefs.recentTemplates || []),
        ...(normalizedIncoming.recentTemplates || []),
    ])).slice(0, 24);

    // 非敏微信读书绑定字段回填（绝不覆盖/写入 apiKey 与 enabled）
    const incomingBindings = (sanitizedIncoming as Record<string, unknown>).wereadBindings as Record<string, unknown> | undefined;
    const mergedWeread = {
        ...localPrefs.wereadIntegration,
        itemId: localPrefs.wereadIntegration.itemId || (typeof incomingBindings?.itemId === "string" ? incomingBindings.itemId : normalizedIncoming.wereadIntegration.itemId),
        thresholdMinutes: localPrefs.wereadIntegration.thresholdMinutes || (typeof incomingBindings?.thresholdMinutes === "number" ? incomingBindings.thresholdMinutes : normalizedIncoming.wereadIntegration.thresholdMinutes),
        finishItemId: localPrefs.wereadIntegration.finishItemId || (typeof incomingBindings?.finishItemId === "string" ? incomingBindings.finishItemId : normalizedIncoming.wereadIntegration.finishItemId),
        notesItemId: localPrefs.wereadIntegration.notesItemId || (typeof incomingBindings?.notesItemId === "string" ? incomingBindings.notesItemId : normalizedIncoming.wereadIntegration.notesItemId),
    };

    return {
        ...localPrefs,
        appearance: localPrefs.appearance !== "system" ? localPrefs.appearance : normalizedIncoming.appearance,
        palette: localPrefs.palette !== "lavender" ? localPrefs.palette : normalizedIncoming.palette,
        heatmapTheme: localPrefs.heatmapTheme && localPrefs.heatmapTheme !== "violet-glow"
            ? localPrefs.heatmapTheme
            : normalizedIncoming.heatmapTheme,
        streakFreezePeriods: Array.from(freezeMap.values()),
        savedViews: Array.from(savedViewsMap.values()),
        collapsedGroups,
        recentTemplates,
        wereadIntegration: mergedWeread,
    };
}

export function mergeUserTemplatesForVault(local: readonly UserTemplate[], incoming: readonly UserTemplate[]): UserTemplate[] {
    const map = new Map<string, UserTemplate>();
    for (const tpl of local) map.set(tpl.id, tpl);
    for (const tpl of incoming) {
        if (!map.has(tpl.id)) map.set(tpl.id, tpl);
    }
    return Array.from(map.values());
}

export function mergeCustomIconsForVault(local: readonly string[], incoming: readonly string[]): string[] {
    return normalizeCustomIconLibrary([...local, ...incoming]);
}

export function mergeOccasionStoresForVault(local: OccasionStore, incoming: OccasionStore): OccasionStore {
    return mergeOccasionCompletions(local, incoming);
}

export interface CheckinVaultAdapterDeps {
    getSnapshotInput: () => Promise<CheckinVaultSnapshotInput> | CheckinVaultSnapshotInput;
    getCurrentState: () => {store: CheckinStore; occasionStore?: OccasionStore};
    applyMerge: (incoming: ExtractedCheckinVaultData) => Promise<boolean>;
}

export function createCheckinVaultAdapter(deps: CheckinVaultAdapterDeps) {
    return {
        pluginId: CHECKIN_VAULT_PLUGIN_ID,
        label: CHECKIN_VAULT_LABEL,
        schemaVersion: CHECKIN_VAULT_SCHEMA_VERSION,
        countRecords(snapshot: Record<string, unknown>): number {
            return countCheckinVaultRecords(snapshot);
        },
        async exportSnapshot(): Promise<Record<string, unknown>> {
            const input = await deps.getSnapshotInput();
            return buildCheckinVaultSnapshot(input) as unknown as Record<string, unknown>;
        },
        async previewDiff(incoming: Record<string, unknown>): Promise<{currentCount: number; incomingCount: number; summary: string}> {
            const current = deps.getCurrentState();
            return previewCheckinVaultDiff(current, incoming);
        },
        async importMerge(incoming: Record<string, unknown>): Promise<boolean> {
            const extracted = extractCheckinVaultData(incoming);
            if (!extracted.store && !extracted.occasionStore && !extracted.userTemplates && !extracted.customIconLibrary && !extracted.viewPreferences) {
                return false;
            }
            return await deps.applyMerge(extracted);
        },
    };
}
