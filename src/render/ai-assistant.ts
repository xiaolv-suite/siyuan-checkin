import { sanitizeAiInputText } from "../features/privacy-scope";
import { LvAiRouter, loadAiRouterConfig, sanitizeMessages, type AiChatPayload } from "./lv-ai-router";
import {
    assertLvAiChannelAllowed,
    getLvEcosystemToggles,
    lvAi,
    resolveLvAiDestinationLabel,
} from "./lv-notice-kit";

export interface UnifiedAiChatOptions {
    promptId: string;
    taskType?: AiChatPayload["taskType"];
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    signal?: AbortSignal;
}

export interface UnifiedAiChatResult {
    ok: boolean;
    content: string;
    provider?: string;
    destinationLabel?: string;
    unconfigured?: boolean;
    aborted?: boolean;
    blocked?: boolean;
    blockedCode?: string;
    guideMessage?: string;
}

export function sanitizeCheckinNoteForAi(note: unknown, maxLength = 200): string {
    return sanitizeAiInputText(note, maxLength);
}

function isAiPolicyBlockedError(err: unknown): err is { name?: string; code?: string; message?: string } {
    if (!err || typeof err !== "object") return false;
    const e = err as { name?: unknown; code?: unknown; message?: unknown };
    if (e.name === "LvAiPolicyBlockedError") return true;
    const code = typeof e.code === "string" ? e.code : "";
    if (code === "ai_siyuan_only" || code === "ai_shared_key_denied" || code === "ai_origin_mismatch") return true;
    const msg = typeof e.message === "string" ? e.message : "";
    return /ai_siyuan_only|ai_shared_key_denied|ai_origin_mismatch|仅思源本体\s*AI/.test(msg);
}

function formatAiPolicyBlockedMessage(err: { code?: string; message?: string }): string {
    if (err.code === "ai_shared_key_denied") {
        return "当前未授权「小驴打卡」使用共享外部 AI 密钥，请在「小驴罗盘 → AI 调度中枢」开启授权或改用思源内置 AI。";
    }
    if (err.code === "ai_origin_mismatch") {
        return err.message || "外部 AI 目标域名与预检确认不一致，已拦截此次发送。";
    }
    return "已开启「仅思源本体 AI」隐私保护，已拦截向外部 AI 通道发送数据；请在「小驴罗盘 → 生态开关」调整或使用思源内置 AI。";
}

function safeGetEcosystemToggles(): { aiSiyuanOnly?: boolean } {
    try {
        if (typeof getLvEcosystemToggles === "function") {
            return getLvEcosystemToggles() || {};
        }
    } catch { /* ignore */ }
    return {};
}

function safeResolveDestinationLabel(ctx: { channel?: string; endpoint?: string; url?: string }): { kind: string; label: string; hostname: string; origin: string } {
    try {
        if (typeof resolveLvAiDestinationLabel === "function") {
            return resolveLvAiDestinationLabel(ctx);
        }
    } catch { /* ignore */ }
    const ch = String(ctx?.channel || "").trim().toLowerCase();
    if (ch === "siyuan" || ch === "siyuan_editor" || ch === "siyuan_legacy") {
        return { kind: "siyuan", label: "思源内置 AI", hostname: "siyuan-kernel", origin: "" };
    }
    if (ch === "ollama") {
        return { kind: "ollama", label: "本地 Ollama", hostname: "127.0.0.1", origin: "http://127.0.0.1:11434" };
    }
    if (ch === "public_free") {
        return { kind: "public_free", label: "免密公用池", hostname: "text.pollinations.ai", origin: "https://text.pollinations.ai" };
    }
    return { kind: "user_custom", label: "用户自配外部接口", hostname: "", origin: "" };
}

function safeAssertAiChannelAllowed(ctx: { source?: string; pluginId?: string; channel?: string; endpoint?: string; url?: string; usesSharedKey?: boolean }): void {
    if (typeof assertLvAiChannelAllowed === "function") {
        assertLvAiChannelAllowed(ctx);
    }
}

export function resolveCheckinAiDestinationInfo(
    routerConfig = loadAiRouterConfig()
): { kind: string; label: string; hostname: string; siyuanOnly: boolean } {
    const toggles = safeGetEcosystemToggles();
    const siyuanOnly = toggles?.aiSiyuanOnly === true;
    const preferred = routerConfig?.preferredProvider;
    if (siyuanOnly || preferred === "siyuan") {
        const dest = safeResolveDestinationLabel({ channel: "siyuan" });
        return { kind: dest.kind, label: dest.label, hostname: dest.hostname, siyuanOnly };
    }
    if (preferred === "user_custom" || (!preferred && (routerConfig?.userCustom?.hasSecret || routerConfig?.userCustom?.apiKey))) {
        const dest = safeResolveDestinationLabel({
            channel: "user_custom",
            endpoint: routerConfig?.userCustom?.baseUrl || "https://api.siliconflow.cn/v1",
        });
        return { kind: dest.kind, label: dest.label, hostname: dest.hostname, siyuanOnly };
    }
    if (preferred === "ollama" || (!preferred && routerConfig?.ollama?.enabled)) {
        const dest = safeResolveDestinationLabel({
            channel: "ollama",
            endpoint: routerConfig?.ollama?.baseUrl || "http://127.0.0.1:11434",
        });
        return { kind: dest.kind, label: dest.label, hostname: dest.hostname, siyuanOnly };
    }
    if (preferred === "public_free" || routerConfig?.publicFree?.enabled) {
        const dest = safeResolveDestinationLabel({
            channel: "public_free",
            endpoint: routerConfig?.publicFree?.endpoint || "https://text.pollinations.ai",
        });
        return { kind: dest.kind, label: dest.label, hostname: dest.hostname, siyuanOnly };
    }
    const dest = safeResolveDestinationLabel({ channel: "siyuan" });
    return { kind: dest.kind, label: dest.label, hostname: dest.hostname, siyuanOnly };
}

export async function invokeUnifiedAiChat(options: UnifiedAiChatOptions): Promise<UnifiedAiChatResult> {
    if (options.signal?.aborted) {
        return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
    }
    const safeMessages = sanitizeMessages(options.messages);
    const systemMsg = safeMessages.find((m) => m.role === "system")?.content || "";
    const userMsg = safeMessages.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
    const toggles = safeGetEcosystemToggles();
    const routerConfig = loadAiRouterConfig();
    const destination = resolveCheckinAiDestinationInfo(routerConfig);

    const aiHub = (typeof globalThis !== "undefined" ? (globalThis as any).__LV_AI_HUB__ : null)
        || (typeof window !== "undefined" ? (window as any).__LV_AI_HUB__ : null);

    if (aiHub && typeof aiHub.chat === "function") {
        try {
            const hubRes = await aiHub.chat({
                source: "siyuan-checkin",
                pluginId: "siyuan-checkin",
                taskType: options.taskType || "summary",
                messages: safeMessages,
                signal: options.signal,
            });
            if (options.signal?.aborted) {
                return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
            }
            const text = typeof hubRes?.content === "string" ? hubRes.content.trim() : "";
            if (hubRes?.ok !== false && text && hubRes?.provider !== "rule_fallback") {
                const dest = safeResolveDestinationLabel({
                    channel: String(hubRes.provider || destination.kind),
                    endpoint: hubRes.endpoint,
                });
                return { ok: true, content: text, provider: String(hubRes.provider || "ai_hub"), destinationLabel: dest.label };
            }
        } catch (err) {
            if (options.signal?.aborted) {
                return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
            }
            if (isAiPolicyBlockedError(err)) {
                return {
                    ok: false,
                    content: "",
                    blocked: true,
                    blockedCode: String(err.code || "ai_siyuan_only"),
                    destinationLabel: destination.label,
                    guideMessage: formatAiPolicyBlockedMessage(err),
                };
            }
            // 降级到 LvAiRouter
        }
    }

    if (aiHub && typeof aiHub.runTask === "function") {
        try {
            const fallbackCtrl = typeof AbortController !== "undefined" ? new AbortController() : undefined;
            const taskSignal = options.signal ?? fallbackCtrl?.signal;
            const card = await aiHub.runTask({
                requestId: `checkin-${options.promptId}-${Date.now()}`,
                generationNonce: 1,
                sourcePlugin: "siyuan-checkin",
                capability: "L3",
                taskType: "summary",
                promptId: options.promptId,
                promptVersion: 1,
                context: {
                    focusBlockContent: systemMsg ? `${systemMsg}\n\n${userMsg}` : userMsg,
                },
                piiPolicy: "standard",
                allowFreePool: false,
                signal: taskSignal,
            });
            if (options.signal?.aborted) {
                return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
            }
            const mdBlock = Array.isArray(card?.blocks) ? card.blocks.find((b: any) => b?.type === "markdown" && typeof b.text === "string") : null;
            const text = typeof mdBlock?.text === "string" ? mdBlock.text.trim() : "";
            if (card?.state === "done" && text && card?.meta?.provider !== "rule_fallback") {
                return {
                    ok: true,
                    content: text,
                    provider: String(card.meta?.provider || "ai_hub"),
                    destinationLabel: destination.label,
                };
            }
        } catch (err) {
            if (options.signal?.aborted) {
                return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
            }
            if (isAiPolicyBlockedError(err)) {
                return {
                    ok: false,
                    content: "",
                    blocked: true,
                    blockedCode: String(err.code || "ai_siyuan_only"),
                    destinationLabel: destination.label,
                    guideMessage: formatAiPolicyBlockedMessage(err),
                };
            }
            // 降级到 LvAiRouter
        }
    }

    if (options.signal?.aborted) {
        return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
    }

    if (toggles?.aiSiyuanOnly === true && routerConfig.enableSiyuan === false) {
        try {
            safeAssertAiChannelAllowed({
                pluginId: "siyuan-checkin",
                source: "siyuan-checkin",
                channel: routerConfig.userCustom?.hasSecret || routerConfig.userCustom?.apiKey
                    ? "user_custom"
                    : routerConfig.ollama?.enabled
                    ? "ollama"
                    : "public_free",
                endpoint: routerConfig.userCustom?.baseUrl || routerConfig.ollama?.baseUrl || routerConfig.publicFree?.endpoint,
                usesSharedKey: Boolean(routerConfig.userCustom?.hasSecret && !routerConfig.userCustom?.apiKey),
            });
        } catch (err) {
            if (isAiPolicyBlockedError(err)) {
                return {
                    ok: false,
                    content: "",
                    blocked: true,
                    blockedCode: String(err.code || "ai_siyuan_only"),
                    destinationLabel: destination.label,
                    guideMessage: formatAiPolicyBlockedMessage(err),
                };
            }
        }
    }

    const router = new LvAiRouter({
        ...routerConfig,
        enableRuleFallback: false,
    });
    try {
        const res = await router.chat({
            source: "siyuan-checkin",
            messages: safeMessages,
            taskType: options.taskType || "summary",
            temperature: 0.65,
            signal: options.signal,
        });
        if (options.signal?.aborted || res?.error === "aborted") {
            return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
        }
        const text = typeof res?.content === "string" ? res.content.trim() : "";
        if (res?.ok && text && res.provider !== "rule_fallback") {
            const dest = safeResolveDestinationLabel({
                channel: res.provider,
                endpoint: res.provider === "user_custom"
                    ? routerConfig.userCustom?.baseUrl
                    : res.provider === "ollama"
                    ? routerConfig.ollama?.baseUrl
                    : undefined,
            });
            return { ok: true, content: text, provider: res.provider, destinationLabel: dest.label };
        }
    } catch (err) {
        if (options.signal?.aborted) {
            return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
        }
        if (isAiPolicyBlockedError(err)) {
            return {
                ok: false,
                content: "",
                blocked: true,
                blockedCode: String(err.code || "ai_siyuan_only"),
                destinationLabel: destination.label,
                guideMessage: formatAiPolicyBlockedMessage(err),
            };
        }
        // 继续检查旧通道兼容
    }

    if (options.signal?.aborted) {
        return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
    }

    const legacyCfg = lvAi.getConfig();
    const hasTier2Secret = typeof window !== "undefined" && Boolean((window as any).hasTier2SecretConfigured?.());
    const hasLegacyChannel = Boolean(
        legacyCfg && (
            legacyCfg.hasSecret === true
            || (typeof legacyCfg.secretSlot === "string" && legacyCfg.secretSlot.trim())
            || (typeof legacyCfg.endpoint === "string" && legacyCfg.endpoint.trim())
            || hasTier2Secret
        )
    );
    if (hasLegacyChannel) {
        try {
            const legacyChannel = legacyCfg?.endpoint ? "user_custom" : "siyuan";
            safeAssertAiChannelAllowed({
                pluginId: "siyuan-checkin",
                source: "siyuan-checkin",
                channel: legacyChannel,
                endpoint: legacyCfg?.endpoint,
                usesSharedKey: Boolean(legacyCfg?.secretSlot && !legacyCfg?.hasSecret),
            });
            const legacyRes = await lvAi.chat({
                source: "siyuan-checkin",
                messages: safeMessages,
                signal: options.signal,
            });
            if (options.signal?.aborted) {
                return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
            }
            const text = typeof legacyRes?.content === "string" ? legacyRes.content.trim() : "";
            if (text) {
                const dest = safeResolveDestinationLabel({ channel: legacyChannel, endpoint: legacyCfg?.endpoint });
                return { ok: true, content: text, provider: "lv_ai_legacy", destinationLabel: dest.label };
            }
        } catch (err) {
            if (options.signal?.aborted) {
                return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
            }
            if (isAiPolicyBlockedError(err)) {
                return {
                    ok: false,
                    content: "",
                    blocked: true,
                    blockedCode: String(err.code || "ai_siyuan_only"),
                    destinationLabel: destination.label,
                    guideMessage: formatAiPolicyBlockedMessage(err),
                };
            }
            // ignore
        }
    }

    const hasExplicitChannel = Boolean(
        routerConfig.userCustom?.hasSecret === true
        || (routerConfig.userCustom?.apiKey && routerConfig.userCustom.apiKey.trim())
        || routerConfig.publicFree?.enabled === true
        || routerConfig.enableSiyuan === true
        || routerConfig.ollama?.enabled === true
        || hasLegacyChannel
    );

    if (toggles?.aiSiyuanOnly === true && hasExplicitChannel) {
        return {
            ok: false,
            content: "",
            blocked: true,
            blockedCode: "ai_siyuan_only",
            destinationLabel: destination.label,
            guideMessage: "已开启「仅思源本体 AI」隐私保护，外部 AI 通道已被拦截；请配置思源内置 AI 或在「小驴罗盘 → 生态开关」关闭限制。",
        };
    }

    return {
        ok: false,
        content: "",
        destinationLabel: destination.label,
        unconfigured: !hasExplicitChannel,
        guideMessage: hasExplicitChannel
            ? "AI 服务暂未响应，请检查网络/模型配置，或前往「小驴罗盘 → AI 调度中枢」测试并切换备用通道。"
            : "尚未检测到可用的 AI 服务（思源内核智能体 / 自定义 API Key / 本地 Ollama）。请前往「小驴罗盘 → AI 调度中枢」配置一次，全家桶 8 大插件即可共用。",
    };
}
