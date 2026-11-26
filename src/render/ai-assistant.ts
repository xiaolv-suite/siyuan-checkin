import { sanitizeAiInputText } from "../features/privacy-scope";
import { LvAiRouter, loadAiRouterConfig, sanitizeMessages, type AiChatPayload } from "./lv-ai-router";
import { lvAi } from "./lv-notice-kit";

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
    unconfigured?: boolean;
    aborted?: boolean;
    guideMessage?: string;
}

export function sanitizeCheckinNoteForAi(note: unknown, maxLength = 200): string {
    return sanitizeAiInputText(note, maxLength);
}

export async function invokeUnifiedAiChat(options: UnifiedAiChatOptions): Promise<UnifiedAiChatResult> {
    if (options.signal?.aborted) {
        return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
    }
    const safeMessages = sanitizeMessages(options.messages);
    const systemMsg = safeMessages.find((m) => m.role === "system")?.content || "";
    const userMsg = safeMessages.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");

    const aiHub = (typeof globalThis !== "undefined" ? (globalThis as any).__LV_AI_HUB__ : null)
        || (typeof window !== "undefined" ? (window as any).__LV_AI_HUB__ : null);

    if (aiHub && typeof aiHub.chat === "function") {
        try {
            const hubRes = await aiHub.chat({
                source: "打卡",
                taskType: options.taskType || "summary",
                messages: safeMessages,
                signal: options.signal,
            });
            if (options.signal?.aborted) {
                return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
            }
            const text = typeof hubRes?.content === "string" ? hubRes.content.trim() : "";
            if (hubRes?.ok !== false && text && hubRes?.provider !== "rule_fallback") {
                return { ok: true, content: text, provider: String(hubRes.provider || "ai_hub") };
            }
        } catch {
            if (options.signal?.aborted) {
                return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
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
                return { ok: true, content: text, provider: String(card.meta?.provider || "ai_hub") };
            }
        } catch {
            if (options.signal?.aborted) {
                return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
            }
            // 降级到 LvAiRouter
        }
    }

    if (options.signal?.aborted) {
        return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
    }

    const routerConfig = loadAiRouterConfig();
    const router = new LvAiRouter({
        ...routerConfig,
        enableRuleFallback: false,
    });
    try {
        const res = await router.chat({
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
            return { ok: true, content: text, provider: res.provider };
        }
    } catch {
        if (options.signal?.aborted) {
            return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
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
            const legacyRes = await lvAi.chat({
                source: "打卡",
                messages: safeMessages,
                signal: options.signal,
            });
            if (options.signal?.aborted) {
                return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
            }
            const text = typeof legacyRes?.content === "string" ? legacyRes.content.trim() : "";
            if (text) {
                return { ok: true, content: text, provider: "lv_ai_legacy" };
            }
        } catch {
            if (options.signal?.aborted) {
                return { ok: false, content: "", aborted: true, guideMessage: "已取消 AI 生成" };
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

    return {
        ok: false,
        content: "",
        unconfigured: !hasExplicitChannel,
        guideMessage: hasExplicitChannel
            ? "AI 服务暂未响应，请检查网络/模型配置，或前往「小驴罗盘 → AI 调度中枢」测试并切换备用通道。"
            : "尚未检测到可用的 AI 服务（思源内核智能体 / 自定义 API Key / 本地 Ollama）。请前往「小驴罗盘 → AI 调度中枢」配置一次，全家桶 8 大插件即可共用。",
    };
}
