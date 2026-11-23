/**
 * 思源日记原生任务列表反向自愈引擎（Daily Task Self-Healing Engine · T-数据主权）
 * 允许用户在思源笔记默认日记正文中直接书写 `- [x] 晨跑 5km` 或 `- [x] 喝水`，
 * 插件启动或刷新时自动感应打勾事实，反向自愈补齐小驴打卡流水，实现正文与插件数据双向闭环。
 */
import type { CheckinItem, CheckinStore } from "../types";
import { dateKey, getProgress, isItemAvailableOnDate, isScheduledToday } from "../model";

export interface HealResult {
    scannedBlocks: number;
    healedCount: number;
    matchedItemNames: string[];
}

/** 清洗日记任务列表文本，提取用于匹配习惯的纯文本核心词 */
export function extractTaskCoreTitle(markdown: string): string {
    return markdown
        .replace(/^-\s*\[[\sxX]\]\s*/, "") // 剥离 - [ ] 与 - [x]
        .replace(/\*\*([^*]+)\*\*/g, "$1") // 剥离加粗
        .replace(/`([^`]+)`/g, "$1") // 剥离行内代码
        .replace(/#[^\s#]+/g, "") // 剥离标签
        .replace(/\d{1,2}:\d{2}(?::\d{2})?\s*/, "") // 剥离时间戳
        .replace(/\{:[^}]*\}\s*$/g, "") // 剥离 IAL
        .replace(/[\r\n\t]+/g, " ")
        .trim();
}

/** 智能模糊匹配任务文本对应的习惯项目 */
export function matchItemByTaskText(
    taskText: string,
    items: readonly CheckinItem[],
): CheckinItem | undefined {
    const clean = taskText.trim().toLowerCase();
    if (!clean) return undefined;

    // 1. 全等匹配
    const exact = items.find((i) => i.name.trim().toLowerCase() === clean);
    if (exact) return exact;

    // 2. 包含匹配：习惯名包含在任务文本中，或任务文本包含习惯名
    const matched = items.find((i) => {
        const name = i.name.trim().toLowerCase();
        if (name.length >= 2 && clean.includes(name)) return true;
        if (clean.length >= 2 && name.includes(clean)) return true;
        return false;
    });

    return matched;
}

/** 扫描指定日记文档并执行打卡自愈 */
export async function healDailyTasksFromJournal(
    kernelPost: (url: string, payload: unknown) => Promise<unknown>,
    docId: string,
    store: CheckinStore,
    onHealItem: (item: CheckinItem, blockId: string) => Promise<boolean>,
    asOfDate: Date = new Date(),
): Promise<HealResult> {
    if (!docId || !/^\d{14}-[0-9a-z]{7}$/.test(docId)) {
        return { scannedBlocks: 0, healedCount: 0, matchedItemNames: [] };
    }

    const todayStr = dateKey(asOfDate);
    const escapedDoc = docId.replace(/'/g, "''");
    const sqlStmt = `SELECT id, content, markdown, ial FROM blocks WHERE root_id = '${escapedDoc}' AND (markdown LIKE '- [x]%' OR markdown LIKE '- [X]%') AND (ial IS NULL OR instr(ial, 'custom-lv-checkin-synced') = 0) LIMIT 100`;

    let rows: Array<{ id: string; content?: string; markdown?: string; ial?: string }> = [];
    try {
        const res = await kernelPost("/api/query/sql", { stmt: sqlStmt }) as { code?: number; data?: unknown };
        if (res?.code === 0 && Array.isArray(res.data)) {
            rows = res.data as Array<{ id: string; content?: string; markdown?: string; ial?: string }>;
        }
    } catch {
        return { scannedBlocks: 0, healedCount: 0, matchedItemNames: [] };
    }

    if (!rows.length) {
        return { scannedBlocks: 0, healedCount: 0, matchedItemNames: [] };
    }

    const activeItems = store.items.filter((i) => !i.archived && isItemAvailableOnDate(i, asOfDate) && isScheduledToday(i, asOfDate));
    let healedCount = 0;
    const matchedItemNames: string[] = [];

    for (const row of rows) {
        if (!row.id || typeof row.markdown !== "string") continue;
        const taskCore = extractTaskCoreTitle(row.markdown);
        if (!taskCore) continue;

        const matchedItem = matchItemByTaskText(taskCore, activeItems);
        if (!matchedItem) continue;

        // 若该项目今日尚未达成目标
        const currentProgress = getProgress(store, matchedItem, asOfDate);
        if (currentProgress < matchedItem.target) {
            const ok = await onHealItem(matchedItem, row.id);
            if (ok) {
                healedCount++;
                matchedItemNames.push(matchedItem.name);
                // 给该块标记已自愈同步
                await kernelPost("/api/attr/setBlockAttrs", {
                    id: row.id,
                    attrs: {
                        "custom-lv-checkin-synced": "true",
                        "custom-lv-checkin-item-id": matchedItem.id,
                        "custom-lv-checkin-date": todayStr,
                    },
                }).catch(() => undefined);
            }
        }
    }

    return {
        scannedBlocks: rows.length,
        healedCount,
        matchedItemNames,
    };
}
