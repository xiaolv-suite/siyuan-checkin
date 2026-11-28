// @ts-check

export interface LifelogFormatInput {
    timeStr: string; // HH:mm
    itemName: string;
    value?: number;
    unit?: string;
    kind?: "checkin" | "skip";
    note?: string;
    energy?: 1 | 2 | 3 | 4 | 5;
    attachment?: string;
    style?: "standard" | "compact";
}

/**
 * 将打卡/跳过事件转化为符合 LifeLog 规范的时间线段落文本：
 * 行首必须是时间（HH:mm），后接项目名与内容，兼容叶归及主流日记格式。
 * 例：
 *   - 08:30 晨跑：完成
 *   - 10:15 编程学习 (45分钟)：#深度专注 算法两题 ⚡5
 *   - 21:00 力量训练 (跳过)：#主动休息 今天早睡
 */
export function formatLifelogEntry(input: LifelogFormatInput): string {
    const isSkip = input.kind === "skip";
    const valuePart = !isSkip && input.value !== undefined && input.value > 0 && input.unit && input.unit !== "次"
        ? `${input.value}${input.unit}`
        : "";
    /* 清洗备注文本：换行符转为空格，压缩连续空白，防止破坏日记段落块结构与时间戳行首契约 */
    const noteClean = (input.note || "")
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const parts: string[] = [];
    if (isSkip) {
        parts.push("(跳过)");
    } else if (valuePart) {
        parts.push(valuePart);
    }
    if (noteClean) {
        parts.push(noteClean);
    } else if (isSkip) {
        parts.push("主动跳过");
    } else if (!valuePart) {
        parts.push("完成");
    }
    const energyPart = input.energy && input.energy >= 1 && input.energy <= 5
        ? ` ⚡${input.energy}`
        : "";
    const content = parts.join(" ");
    /* 清洗项目名称：冒号替换为中划线，防止叶归/Marker 解析器提前截断项目名称 */
    const safeItemName = (input.itemName || "习惯")
        .replace(/[\r\n]+/g, " ")
        .replace(/[：:]/g, "-")
        .trim();
    return `${input.timeStr} ${safeItemName}：${content}${energyPart}`;
}

/** 生成写入思源块的完整 Markdown，若包含合法图片附件则追加 Markdown 图片语法 */
export function formatLifelogMarkdownBlock(input: LifelogFormatInput): string {
    const mainLine = formatLifelogEntry(input);
    if (!input.attachment || typeof input.attachment !== "string") {
        return `${mainLine}\n`;
    }
    const safeUrl = input.attachment.trim();
    if (safeUrl.startsWith("data:image/") || safeUrl.startsWith("http://") || safeUrl.startsWith("https://") || safeUrl.startsWith("assets/")) {
        return `${mainLine}\n\n![${input.itemName}](${safeUrl})\n`;
    }
    return `${mainLine}\n`;
}

/** 从 ISO 8601 或时间戳毫秒提取宿主本地 HH:mm 格式时间 */
export function formatTimeOnly(isoOrMs: string | number): string {
    const date = new Date(isoOrMs);
    if (Number.isNaN(date.getTime())) return "00:00";
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
}

/** 预览生成今日全部打卡/跳过事件的 LifeLog Markdown 时间线文本 */
export function previewTodayLifelogMarkdown(
    events: readonly {occurredAt: string; value: number; unit?: string; kind?: "checkin" | "skip"; note?: string; energy?: 1 | 2 | 3 | 4 | 5; itemId: string}[],
    itemNames: ReadonlyMap<string, string>,
    sectionHeader?: string,
): string {
    if (!events.length) return "今日暂无打卡事实。";
    const lines: string[] = [];
    if (sectionHeader?.trim()) {
        lines.push(`### ${sectionHeader.trim()}`);
    }
    const sorted = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    for (const event of sorted) {
        const itemName = itemNames.get(event.itemId);
        if (!itemName) continue;
        const timeStr = formatTimeOnly(event.occurredAt);
        lines.push(formatLifelogEntry({
            timeStr,
            itemName,
            value: event.value,
            unit: event.unit,
            kind: event.kind,
            note: event.note,
            energy: event.energy,
        }));
    }
    return lines.join("\n");
}

export interface DailyAchievementItem {
    itemId: string;
    itemName: string;
    completed: boolean;
    tier?: "none" | "base" | "target" | "heroic";
    value?: number;
    target?: number;
    unit?: string;
    note?: string;
    energy?: 1 | 2 | 3 | 4 | 5;
    timeStr?: string;
}

export interface DailyAchievementCardInput {
    date: string; // YYYY-MM-DD
    items: readonly DailyAchievementItem[];
    currentStreak?: number;
    completionRate?: number; // 0~100
    motto?: string;
}

/**
 * 生成符合思源原生 Callout 规范的高级 Bento 风格每日自律成就卡 Markdown
 * 兼具极佳视觉美感与思源原生双向可解析 IAL 属性。
 */
export function formatDailyAchievementCardMarkdown(input: DailyAchievementCardInput): string {
    const { date, items, currentStreak, completionRate } = input;
    const completedCount = items.filter(i => i.completed).length;
    const totalCount = items.length;
    const rate = typeof completionRate === "number"
        ? Math.round(completionRate)
        : (totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0);
    const streakStr = typeof currentStreak === "number" && currentStreak > 0 ? ` · 连续 ${currentStreak} 天🔥` : "";

    const lines: string[] = [
        `> 🌅 **今日自律成就卡 · ${date}**`,
        `> 达成率: **${rate}%** (${completedCount}/${totalCount})${streakStr}`,
        `>`,
    ];

    for (const item of items) {
        const checkbox = item.completed ? "[x]" : "[ ]";
        const tierBadge = item.tier === "heroic"
            ? "🔥 突破"
            : (item.tier === "target" ? "🟢 达标" : (item.tier === "base" ? "⚪ 保底" : ""));
        const valuePart = item.value !== undefined && item.unit && item.unit !== "次"
            ? ` (${item.value}${item.unit})`
            : "";
        const badgePart = tierBadge ? ` \`${tierBadge}\`` : "";
        const energyPart = item.energy ? ` ⚡${item.energy}` : "";
        const notePart = item.note ? ` —— ${item.note.trim()}` : "";
        const ial = `{: custom-checkin-id="${item.itemId}" custom-checkin-date="${date}" }`;

        lines.push(`> - ${checkbox} **${item.itemName}**${valuePart}${badgePart}${energyPart}${notePart} ${ial}`);
    }

    if (input.motto?.trim()) {
        lines.push(`>`);
        lines.push(`> *"${input.motto.trim()}"*`);
    }

    lines.push(`{: custom-type="daily-achievement" custom-checkin-card="true" }`);
    return lines.join("\n") + "\n";
}

export interface ProtyleCheckboxMutationInput {
    text: string;
    checked: boolean;
    customAttrs?: Record<string, string>;
}

export interface ProtyleReverseCheckinResult {
    itemId: string;
    date: string;
    checked: boolean;
    action: "record" | "revoke";
}

/**
 * 解析用户在思源原生编辑器（Protyle）中勾选待办框 `- [x]` 时的属性，派生反向联动打卡事件
 */
export function parseProtyleCheckboxMutation(
    input: ProtyleCheckboxMutationInput,
    fallbackDate: string
): ProtyleReverseCheckinResult | null {
    if (!input || typeof input.text !== "string") return null;

    let itemId = input.customAttrs?.["custom-checkin-id"] || "";
    let date = input.customAttrs?.["custom-checkin-date"] || "";

    // 若未在 DOM 属性中提取到，尝试从行内 IAL 文本正则解析: custom-checkin-id="xxx"
    if (!itemId) {
        const mId = input.text.match(/custom-checkin-id=["']([^"']+)["']/);
        if (mId) itemId = mId[1];
    }
    if (!date) {
        const mDate = input.text.match(/custom-checkin-date=["']([^"']+)["']/);
        if (mDate) date = mDate[1];
    }

    if (!itemId) return null;

    return {
        itemId,
        date: date || fallbackDate,
        checked: Boolean(input.checked),
        action: input.checked ? "record" : "revoke",
    };
}
