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
    finishItemId: string;
    notesItemId: string;
}

export function normalizeWereadIntegration(source: unknown): WereadIntegrationPreference {
    const raw = source && typeof source === "object" ? (source as Record<string, unknown>) : {};
    return {
        enabled: Boolean(raw.enabled),
        itemId: typeof raw.itemId === "string" ? raw.itemId : "",
        thresholdMinutes: typeof raw.thresholdMinutes === "number" && Number.isFinite(raw.thresholdMinutes) && raw.thresholdMinutes > 0 ? Math.floor(raw.thresholdMinutes) : 30,
        apiKey: typeof raw.apiKey === "string" ? raw.apiKey.trim() : "",
        finishItemId: typeof raw.finishItemId === "string" ? raw.finishItemId : "",
        notesItemId: typeof raw.notesItemId === "string" ? raw.notesItemId : "",
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
