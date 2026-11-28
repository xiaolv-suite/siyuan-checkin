export const WEREAD_INGEST_INTERVAL_MS = 1_800_000;
export const WEREAD_GATEWAY_URL = "https://i.weread.qq.com/api/agent/gateway";
export const wereadFinishRefPrefix = (itemId: string, bookId: string): string => `weread:finish:${itemId}:${bookId}:`;
export const wereadNotesRefPrefix = (itemId: string, date: string): string => `weread:notes:${itemId}:${date}`;

export function isWereadApiKey(value: unknown): value is string {
    return typeof value === "string" && /^wrk-\S+$/.test(value.trim());
}

export interface WereadIntegrationPreference {
    enabled: boolean;
    itemId: string;
    thresholdMinutes: number;
    apiKey: string;
    hasApiKey?: boolean;
    finishItemId: string;
    notesItemId: string;
}

export function normalizeWereadIntegration(source: unknown): WereadIntegrationPreference {
    const raw = source && typeof source === "object" ? (source as Record<string, unknown>) : {};
    const itemId = typeof raw.itemId === "string" ? raw.itemId.trim().slice(0, 160) : "";
    const candidateKey = typeof raw.apiKey === "string" ? raw.apiKey.trim().slice(0, 200) : "";
    const apiKey = isWereadApiKey(candidateKey) ? candidateKey : "";
    const hasApiKey = raw.hasApiKey === true;
    const finishItemId = typeof raw.finishItemId === "string" ? raw.finishItemId.trim().slice(0, 160) : "";
    const notesItemId = typeof raw.notesItemId === "string" ? raw.notesItemId.trim().slice(0, 160) : "";
    const thresholdRaw = typeof raw.thresholdMinutes === "number" && Number.isFinite(raw.thresholdMinutes) ? raw.thresholdMinutes : 30;
    const thresholdMinutes = Math.min(1440, Math.max(1, Math.round(thresholdRaw)));
    const enabled = raw.enabled === true && Boolean(itemId) && (Boolean(apiKey) || hasApiKey);
    return {
        enabled,
        itemId,
        thresholdMinutes,
        apiKey,
        ...(hasApiKey ? {hasApiKey: true} : {}),
        finishItemId,
        notesItemId,
    };
}

export const YEGUIF_INGEST_INTERVAL_MS = 300_000;
export const YEGUIF_MAX_BLOCKS = 200;

export interface YeguifProjectMapping {
    project: string;
    itemId: string;
}

export function normalizeYeguifMappings(value: unknown): YeguifProjectMapping[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const result: YeguifProjectMapping[] = [];
    for (const raw of value) {
        if (!raw || typeof raw !== "object") continue;
        const source = raw as Record<string, unknown>;
        const project = typeof source.project === "string" ? source.project.trim().slice(0, 60) : "";
        const itemId = typeof source.itemId === "string" ? source.itemId.trim().slice(0, 160) : "";
        const key = project.toLocaleLowerCase();
        if (!project || !itemId || seen.has(key)) continue;
        seen.add(key);
        result.push({project, itemId});
    }
    return result;
}
