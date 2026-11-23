/**
 * 习惯总览与自律看板实体文档同步服务（Habits Overview Document Persistence · T-数据主权）
 * 将小驴打卡中的全量习惯定义、排期、连击与嵌入式 checkin 视图落盘为思源原生文档《🎯 习惯总览与自律看板》，
 * 保证脱离插件私有 JSON 存储后，用户在原生思源笔记中依然拥有完备的习惯资产与打卡看板。
 */
import type { CheckinStore, CheckinItem } from "../types";
import { computeEventStreaks, computeLongestStreaks, dateKey } from "../model";

export const HABITS_OVERVIEW_ATTR = "custom-lv-habits-overview";
export const HABITS_DOC_TITLE = "🎯 习惯总览与自律看板";

export interface HabitsOverviewMarkdownInput {
    store: CheckinStore;
    generatedAt?: string;
}

/** 生成习惯总览文档的正文 Markdown */
export function buildHabitsOverviewMarkdown(input: HabitsOverviewMarkdownInput): string {
    const { store } = input;
    const now = new Date();
    const dateStr = dateKey(now);
    const activeItems = store.items.filter((i) => !i.archived);
    const archivedItems = store.items.filter((i) => i.archived);

    const currentStreaks = computeEventStreaks(store, now);
    const longestStreaks = computeLongestStreaks(store, now);

    const lines: string[] = [
        `# ${HABITS_DOC_TITLE}`,
        "",
        `> 💡 本文档由【小驴打卡】数据主权引擎自动沉淀，包含您的全部习惯资产、排期规格与原生打卡视图。`,
        `> 📅 最近同步时间：\`${dateStr} ${now.toTimeString().slice(0, 5)}\``,
        "",
        "## 📊 今日概览与自律仪表盘",
        "",
        "```checkin",
        JSON.stringify({ view: "summary" }, null, 2),
        "```",
        "",
        "```checkin",
        JSON.stringify({ view: "heatmap", year: now.getFullYear() }, null, 2),
        "```",
        "",
        `## 🏃 活跃习惯清单（共 ${activeItems.length} 项）`,
        "",
        "| 图标 | 习惯名称 | 分组 | 目标规格 | 排期频次 | 当前连击 | 历史最佳 | 创建日期 |",
        "| :---: | :--- | :--- | :--- | :--- | :---: | :---: | :---: |",
    ];

    for (const item of activeItems) {
        const icon = item.icon || "📌";
        const name = item.name.replace(/\|/g, "｜");
        const group = (item.group || "默认").replace(/\|/g, "｜");
        const targetStr = `${item.target} ${item.unit || "次"}`;
        const scheduleStr = formatScheduleText(item);
        const currStreak = `${currentStreaks.get(item.id) ?? 0} 天`;
        const maxStreak = `${longestStreaks.get(item.id) ?? 0} 天`;
        const created = item.createdDate || item.createdAt?.slice(0, 10) || "-";
        lines.push(`| ${icon} | **${name}** | ${group} | ${targetStr} | ${scheduleStr} | ${currStreak} | ${maxStreak} | ${created} |`);
    }

    if (archivedItems.length > 0) {
        lines.push(
            "",
            `## 📦 已归档习惯（${archivedItems.length} 项）`,
            "",
            "| 图标 | 习惯名称 | 分组 | 目标规格 | 归档状态 |",
            "| :---: | :--- | :--- | :--- | :--- |",
        );
        for (const item of archivedItems) {
            const icon = item.icon || "📌";
            const name = item.name.replace(/\|/g, "｜");
            const group = (item.group || "默认").replace(/\|/g, "｜");
            const targetStr = `${item.target} ${item.unit || "次"}`;
            lines.push(`| ${icon} | ~~${name}~~ | ${group} | ${targetStr} | 已归档封存 |`);
        }
    }

    lines.push(
        "",
        "---",
        "*(数据主权提示：您可自由在下方书写自律反思、周期复盘与心得，小驴打卡仅受控维护上方看板区块)*",
        "",
    );

    return lines.join("\n");
}

function formatScheduleText(item: CheckinItem): string {
    const s = item.schedule;
    if (!s) return "每天";
    if (s.type === "daily") return "每天";
    if (s.type === "workdays") return "工作日";
    if (s.type === "weekly" && s.weekdays?.length) {
        const cnDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
        return `每周 ${s.weekdays.map((d) => cnDays[d] ?? d).join("、")}`;
    }
    if (s.type === "interval" && s.intervalDays) return `每 ${s.intervalDays} 天`;
    if (s.type === "quota" && s.quota) {
        return `每${s.quota.period === "week" ? "周" : "月"} ${s.quota.amount} ${s.quota.countMode === "dates" ? "天" : item.unit || "次"}`;
    }
    return "自定义排期";
}

export async function syncHabitsOverviewDocument(
    kernelPost: (url: string, payload: unknown) => Promise<unknown>,
    notebookId: string,
    store: CheckinStore,
): Promise<{ docId: string; created: boolean } | null> {
    if (!notebookId || !store) return null;

    try {
        const escapedNb = notebookId.replace(/'/g, "''");
        // 1. 查找是否已存在习惯总览文档
        const findSql = `SELECT id, root_id FROM blocks WHERE type = 'd' AND box = '${escapedNb}' AND (ial LIKE '%${HABITS_OVERVIEW_ATTR}%' OR content LIKE '%${HABITS_DOC_TITLE}%') LIMIT 1`;
        const found = await kernelPost("/api/query/sql", { stmt: findSql }) as { code?: number; data?: Array<{ id: string; root_id?: string }> };
        const existingDocId = Array.isArray(found?.data) && found.data[0]?.id ? (found.data[0].root_id || found.data[0].id) : null;

        const markdown = buildHabitsOverviewMarkdown({ store });

        if (existingDocId) {
            // 已存在：受控更新文档正文
            await kernelPost("/api/block/updateBlock", {
                id: existingDocId,
                data: markdown,
                dataType: "markdown",
            });
            await kernelPost("/api/attr/setBlockAttrs", {
                id: existingDocId,
                attrs: {
                    [HABITS_OVERVIEW_ATTR]: "1",
                    "custom-lvct-updated": String(Date.now()),
                },
            });
            return { docId: existingDocId, created: false };
        }

        // 不存在：新建实体文档
        const hpath = `/${HABITS_DOC_TITLE}`;
        const createRes = await kernelPost("/api/filetree/createDocWithMd", {
            notebook: notebookId,
            path: hpath,
            markdown,
        }) as { code?: number; data?: string | { id: string } };

        let newDocId = "";
        if (createRes?.code === 0 && createRes.data) {
            newDocId = typeof createRes.data === "string" ? createRes.data : createRes.data.id;
        }

        if (newDocId) {
            await kernelPost("/api/attr/setBlockAttrs", {
                id: newDocId,
                attrs: {
                    [HABITS_OVERVIEW_ATTR]: "1",
                    "custom-lvct-created": String(Date.now()),
                },
            });
            return { docId: newDocId, created: true };
        }

        return null;
    } catch (e) {
        console.warn("[LvCheckin] 同步习惯总览实体文档失败:", e);
        return null;
    }
}
