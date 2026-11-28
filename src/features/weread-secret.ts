/* T-2026-11-27 微信读书 API Key 安全槽位管理：
   - 严禁将 wereadIntegration.apiKey 明文落盘到 checkin-view-preferences 或随多桶备份导出；
   - 密钥统一通过思源官方 /api/setting/setSecrets 存入冻结槽位 lv_checkin_weread_api_key；
   - 运行时优先使用显式/内存传入，其次读取 plugin.getSecret / window.siyuan.config.secrets.items。 */

export const WEREAD_SECRET_SLOT = "lv_checkin_weread_api_key";

let wereadSecretWriteQueue: Promise<unknown> = Promise.resolve();

export interface WereadSecretPluginReader {
    getSecret?: (name: string) => unknown;
}

function globalHost(): Record<string, any> | null {
    if (typeof window !== "undefined") return window as unknown as Record<string, any>;
    if (typeof globalThis !== "undefined") return globalThis as unknown as Record<string, any>;
    return null;
}

export function resolveWereadApiKey(explicitKey?: string, plugin?: WereadSecretPluginReader): string {
    const direct = typeof explicitKey === "string" ? explicitKey.trim() : "";
    if (direct) return direct;
    try {
        if (plugin && typeof plugin.getSecret === "function") {
            const val = String(plugin.getSecret(WEREAD_SECRET_SLOT) || "").trim();
            if (val) return val;
        }
        const w = globalHost();
        const pluginReader = w?.__LV_SECRET_PLUGIN__ || w?.__LV_HOST_API__?.plugin;
        if (pluginReader && typeof pluginReader.getSecret === "function") {
            const val = String(pluginReader.getSecret(WEREAD_SECRET_SLOT) || "").trim();
            if (val) return val;
        }
        const items = w?.siyuan?.config?.secrets?.items;
        if (Array.isArray(items)) {
            const hit = items.find((it: any) => it && (it.name === WEREAD_SECRET_SLOT || it.key === WEREAD_SECRET_SLOT));
            if (hit && typeof hit.value === "string" && hit.value.trim()) {
                return hit.value.trim();
            }
        }
    } catch { /* ignore */ }
    return "";
}

export async function saveWereadSecretToHost(
    value: string,
    fetchFunc?: typeof fetch,
): Promise<{ok: boolean; reason?: string; readOnlyFallback?: boolean}> {
    const trimmed = typeof value === "string" ? value.trim() : "";
    const w = globalHost();
    const isReadOnly =
        w?.siyuan?.isReadOnly === true
        || w?.isReadOnly === true
        || w?.isAdmin === false;
    if (isReadOnly) {
        return {ok: false, readOnlyFallback: true, reason: "readonly_or_non_admin"};
    }
    const fetchImpl = typeof fetchFunc === "function"
        ? fetchFunc
        : (typeof fetch === "function" ? fetch : undefined);
    if (!fetchImpl) {
        return {ok: false, readOnlyFallback: true, reason: "fetch_unavailable"};
    }
    const task = wereadSecretWriteQueue.catch(() => undefined).then(async () => {
        try {
            const existingItems: Array<{name: string; value: string; allowedHosts?: string[] | null}> = Array.isArray(w?.siyuan?.config?.secrets?.items)
                ? w.siyuan.config.secrets.items.filter(Boolean).map((it: any) => ({
                    name: String(it.name || it.key || ""),
                    value: String(it.value ?? ""),
                    allowedHosts: it.allowedHosts ?? null,
                }))
                : [];
            const idx = existingItems.findIndex((it) => it.name === WEREAD_SECRET_SLOT);
            const nextItems = existingItems.slice();
            if (trimmed) {
                const nextEntry = {
                    name: WEREAD_SECRET_SLOT,
                    value: trimmed,
                    allowedHosts: idx >= 0 ? existingItems[idx]?.allowedHosts ?? null : null,
                };
                if (idx >= 0) nextItems[idx] = nextEntry;
                else nextItems.push(nextEntry);
            } else if (idx >= 0) {
                nextItems.splice(idx, 1);
            }
            const resp = await fetchImpl("/api/setting/setSecrets", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({items: nextItems}),
            });
            if (resp.status === 401 || resp.status === 403) {
                return {ok: false, readOnlyFallback: true, reason: `http_${resp.status}`};
            }
            if (!resp.ok) {
                return {ok: false, reason: `http_${resp.status}`};
            }
            let nextConfigItems = nextItems;
            try {
                const json = await resp.json();
                if (typeof json?.code === "number" && json.code !== 0) {
                    return {ok: false, reason: json.msg || `code_${json.code}`};
                }
                if (Array.isArray(json?.data?.items)) {
                    nextConfigItems = json.data.items;
                }
            } catch {
                // ignore non-JSON ok response
            }
            if (w?.siyuan?.config) {
                if (!w.siyuan.config.secrets) w.siyuan.config.secrets = {items: []};
                w.siyuan.config.secrets.items = nextConfigItems;
            }
            return {ok: true};
        } catch (err: any) {
            return {ok: false, reason: err?.message || "setSecrets_error"};
        }
    });
    wereadSecretWriteQueue = task;
    return task;
}

export function stripWereadSecretFromPreferences<T>(preferences: T): T {
    if (!preferences || typeof preferences !== "object") return preferences;
    const source = preferences as Record<string, unknown>;
    const weread = source.wereadIntegration;
    if (!weread || typeof weread !== "object") return preferences;
    const wi = weread as Record<string, unknown>;
    const hasApiKey = Boolean((typeof wi.apiKey === "string" && wi.apiKey.trim()) || wi.hasApiKey === true);
    const {apiKey: _stripped, ...restWi} = wi;
    return {
        ...source,
        wereadIntegration: {
            ...restWi,
            apiKey: "",
            hasApiKey,
        },
    } as unknown as T;
}
