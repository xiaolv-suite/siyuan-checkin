/* T-2021：事项 2.0 思源原生任务块双向映射引擎。
   设计契约：
   1. 纯依赖注入（KernelPost + 显式 todayKey / nowMs），零宿主全局访问，符合 R-A1 架构边界；
   2. 严格对齐 Task Horizon v3.3.6 kernel.js 原生任务块协议（type='i' AND subtype='t'）：
      - 自动解析 appendBlock 返回的外层列表（type='l'）至真实任务子项（type='i', subtype='t'）；
      - 在 updateBlock 后原子覆写 custom-completion-time / custom-start-date / custom-time /
        custom-priority / custom-status / custom-milestone-event / custom-remark / custom-lv-occasion-id；
   3. 仅删除明确带有 custom-lv-occasion-id 归属印记的镜像块，绝不误删用户自有正文块。 */

import {
    describeElapsedSpan,
    describeOccasionMilestone,
    describeRecurrence,
    elapsedSpanSince,
    getOccurrenceDate,
    isOccasionCompleted,
    nextOccasionMilestones,
    occasionCategoryIcon,
    occasionCategoryLabelKey,
    occasionMilestoneEligible,
    resolveOccasionCategory,
    type Occasion,
} from "../occasions";
import {t} from "../i18n";
import type {KernelPost, KernelPostResult} from "./note-anchor";

export const OCCASION_BOOK_DOC_ATTR = "custom-lv-occasion-book";
export const OCCASION_TASK_ID_ATTR = "custom-lv-occasion-id";
export const OCCASION_CATEGORY_ATTR = "custom-lv-occasion-category";
export const OCCASION_BOOK_DEFAULT_TITLE = "📅 小驴事项簿";

export interface OccasionTaskSyncPayload {
    effectiveDate: string;
    done: boolean;
    markdown: string;
    attrs: Record<string, string>;
}

function escapeSql(raw: string): string {
    return raw.replace(/'/g, "''");
}

async function safePost(post: KernelPost, url: string, payload: unknown): Promise<KernelPostResult & {data?: unknown}> {
    try {
        return (await post(url, payload)) as KernelPostResult & {data?: unknown};
    } catch (error) {
        return {code: -1, msg: error instanceof Error ? error.message : String(error)};
    }
}

/**
 * 纯函数：生成单条事项对应的思源原生复选框 Markdown 与 Task Horizon 标准属性表。
 */
export function buildOccasionTaskSyncPayload(
    item: Occasion,
    todayKey: string,
    nowMs: number,
    taskBlockId = "",
): OccasionTaskSyncPayload {
    const nextDate = getOccurrenceDate(item, todayKey);
    const effectiveDate = nextDate || item.date;
    const done = isOccasionCompleted(item, effectiveDate);
    const marker = !item.enabled ? "-" : done ? "x" : " ";
    const category = resolveOccasionCategory(item);
    const icon = occasionCategoryIcon(category);
    const safeName = item.name.replace(/[\r\n]+/g, " ").trim();
    const timePrefix = item.time ? `${item.time} ` : "";
    const contextSuffix = item.contextBlockId ? ` ((${item.contextBlockId} '📎笔记'))` : "";
    const markdown = `- [${marker}] ${icon} ${timePrefix}${safeName}${contextSuffix}`;

    const remarkParts: string[] = [t(occasionCategoryLabelKey(category))];
    const recText = describeRecurrence(item);
    if (recText) remarkParts.push(recText);
    if (item.enabled && occasionMilestoneEligible(item)) {
        const span = elapsedSpanSince(item.date, todayKey);
        const spanText = span ? describeElapsedSpan(span) : "";
        if (spanText) remarkParts.push(spanText);
        const milestone = nextOccasionMilestones(item, todayKey, 1)[0];
        if (milestone) remarkParts.push(describeOccasionMilestone(item, milestone));
    }
    if (item.note) {
        const cleanNote = item.note.replace(/[\r\n]+/g, " ").trim();
        if (cleanNote) remarkParts.push(cleanNote);
    }

    const statusId = !item.enabled ? "cancelled" : done ? "done" : "todo";
    const isMilestone = item.kind === "birthday" || item.kind === "anniversary";

    const attrs: Record<string, string> = {
        [OCCASION_TASK_ID_ATTR]: item.id,
        [OCCASION_CATEGORY_ATTR]: category,
        "custom-completion-time": effectiveDate,
        "custom-start-date": effectiveDate,
        "custom-time": item.time || "",
        "custom-priority": item.priority || "",
        "custom-status": statusId,
        "custom-milestone-event": isMilestone ? "1" : "",
        "custom-remark": remarkParts.join(" · ").slice(0, 400),
        "custom-task-complete-at": done ? new Date(nowMs).toISOString() : "",
        ...(taskBlockId ? {"custom-task-horizon-attr-host-owner": taskBlockId} : {}),
        "custom-task-horizon-attr-host-updated-at": String(nowMs),
    };

    return {effectiveDate, done, markdown, attrs};
}

function extractInsertedBlockId(data: unknown): string {
    if (!Array.isArray(data) || !data.length) return "";
    const first = data[0] as {doOperations?: Array<{id?: unknown}>} | undefined;
    const opId = first?.doOperations?.[0]?.id;
    return typeof opId === "string" ? opId.trim() : "";
}

async function resolveRealTaskItemBlockId(post: KernelPost, candidateBlockId: string): Promise<string> {
    if (!candidateBlockId) return "";
    const stmt = `
        WITH RECURSIVE tree(id, depth) AS (
            SELECT '${escapeSql(candidateBlockId)}', 0
            UNION ALL
            SELECT b.id, tree.depth + 1 FROM blocks b JOIN tree ON b.parent_id = tree.id WHERE tree.depth < 4
        )
        SELECT b.id FROM blocks b JOIN tree ON tree.id = b.id
        WHERE b.type = 'i' AND b.subtype = 't'
        ORDER BY tree.depth ASC, b.sort ASC, b.created ASC LIMIT 1
    `;
    const res = await safePost(post, "/api/query/sql", {stmt});
    const rows = res.code === 0 && Array.isArray(res.data) ? (res.data as Array<{id?: string}>) : [];
    if (rows.length && rows[0]?.id) return String(rows[0].id).trim();
    // 回退：直接检查子块列表（新建块尚未刷入 SQLite 索引的瞬态窗口）
    const childrenRes = await safePost(post, "/api/block/getChildBlocks", {id: candidateBlockId});
    const children = childrenRes.code === 0 && Array.isArray(childrenRes.data)
        ? (childrenRes.data as Array<{id?: string; type?: string; subType?: string; subtype?: string}>)
        : [];
    const directItem = children.find((c) => {
        const tp = String(c.type || "").toLowerCase();
        const sub = String(c.subType || c.subtype || "").toLowerCase();
        return (tp === "i" || tp === "nodelistitem") && sub === "t";
    });
    if (directItem?.id) return String(directItem.id).trim();
    return candidateBlockId;
}

/**
 * 零配置定位或幂等创建《📅 小驴事项簿》文档。
 */
export async function ensureOccasionBookDoc(
    post: KernelPost,
    notebookId: string,
    docTitle = OCCASION_BOOK_DEFAULT_TITLE,
): Promise<{ok: boolean; docId: string; reason?: string}> {
    const byAttr = await safePost(post, "/api/query/sql", {
        stmt: `SELECT id FROM blocks WHERE type = 'd' AND ial LIKE '%${OCCASION_BOOK_DOC_ATTR}="1"%' ORDER BY id ASC LIMIT 1`,
    });
    if (byAttr.code !== 0 || !Array.isArray(byAttr.data)) return {ok: false, docId: "", reason: "book-query-unavailable"};
    if (byAttr.code === 0 && Array.isArray(byAttr.data) && byAttr.data.length) {
        const hit = (byAttr.data[0] as {id?: string})?.id;
        if (hit) return {ok: true, docId: String(hit)};
    }

    if (!notebookId) return {ok: false, docId: "", reason: "no-notebook"};
    const safeTitle = docTitle.replace(/[\\/]/g, "／").trim() || OCCASION_BOOK_DEFAULT_TITLE;
    const hubBranchPath = `/01-小驴打卡/${safeTitle}`;
    const legacyHPath = `/${safeTitle}`;
    const byPath = await safePost(post, "/api/query/sql", {
        stmt: `SELECT id FROM blocks WHERE type = 'd' AND box = '${escapeSql(notebookId)}' AND (hpath = '${escapeSql(hubBranchPath)}' OR hpath = '${escapeSql(legacyHPath)}' OR hpath = '${escapeSql(safeTitle)}') ORDER BY id ASC LIMIT 1`,
    });
    if (byPath.code !== 0 || !Array.isArray(byPath.data)) return {ok: false, docId: "", reason: "book-query-unavailable"};
    if (byPath.code === 0 && Array.isArray(byPath.data) && byPath.data.length) {
        const docId = String((byPath.data[0] as {id?: string})?.id || "");
        if (docId) {
            const marked = await safePost(post, "/api/attr/setBlockAttrs", {id: docId, attrs: {[OCCASION_BOOK_DOC_ATTR]: "1"}});
            return {ok: marked.code === 0, docId, ...(marked.code === 0 ? {} : {reason: marked.msg || "book-attributes-failed"})};
        }
    }

    const branchCheck = await safePost(post, "/api/query/sql", {
        stmt: `SELECT id FROM blocks WHERE type = 'd' AND box = '${escapeSql(notebookId)}' AND hpath = '/01-小驴打卡' LIMIT 1`,
    });
    if (branchCheck.code !== 0 || !Array.isArray(branchCheck.data)) return {ok: false, docId: "", reason: "book-query-unavailable"};
    const hasHubBranch = branchCheck.code === 0 && Array.isArray(branchCheck.data) && branchCheck.data.length > 0;
    const hpath = hasHubBranch ? hubBranchPath : legacyHPath;

    const intro = `> 本页面由「小驴打卡 · 事项 2.0」自动维护，所有事项均以思源原生任务块呈现，可在 **Task Horizon** 的日历、看板、时间轴与四象限视图中直接查看与勾选。\n`;
    const created = await safePost(post, "/api/filetree/createDocWithMd", {
        notebook: notebookId,
        path: hpath,
        markdown: intro,
    });
    const docId = created.code === 0 && typeof created.data === "string" ? created.data.trim() : "";
    if (!docId) return {ok: false, docId: "", reason: created.msg || "create-doc-failed"};
    const marked = await safePost(post, "/api/attr/setBlockAttrs", {id: docId, attrs: {[OCCASION_BOOK_DOC_ATTR]: "1"}});
    return {ok: marked.code === 0, docId, ...(marked.code === 0 ? {} : {reason: marked.msg || "book-attributes-failed"})};
}

const inMemoryOccasionBlockIds = new Map<string, string>();
const occasionSyncChains = new Map<string, Promise<unknown>>();

/**
 * 将单条事项幂等同步为思源文档中的原生任务块，并写入 Task Horizon 全套属性。
 */
export async function syncOccasionToSiyuanBlock(
    post: KernelPost,
    item: Occasion,
    options: {notebookId: string; todayKey: string; nowMs: number; bookDocId?: string; allowAppend?: boolean; beforeAppend?: () => Promise<void>; onAppended?: (blockId: string, bookDocId: string) => Promise<void>},
): Promise<{ok: boolean; blockId?: string; bookDocId?: string; reason?: string}> {
    const queue = occasionSyncChains.get(item.id) || Promise.resolve();
    let releaseLock!: () => void;
    const taskGate = new Promise<void>((resolve) => { releaseLock = resolve; });
    occasionSyncChains.set(item.id, queue.then(() => taskGate, () => taskGate));
    try {
        await queue;
        const effectiveBlockId = item.blockId || inMemoryOccasionBlockIds.get(item.id);
        const effectiveItem = effectiveBlockId ? {...item, blockId: effectiveBlockId} : item;
        const result = await doSyncOccasionToSiyuanBlock(post, effectiveItem, options);
        if (result.ok && result.blockId) {
            inMemoryOccasionBlockIds.set(item.id, result.blockId);
        }
        return result;
    } finally {
        releaseLock();
        if (occasionSyncChains.get(item.id) === taskGate) {
            occasionSyncChains.delete(item.id);
        }
    }
}

async function doSyncOccasionToSiyuanBlock(
    post: KernelPost,
    item: Occasion,
    options: {notebookId: string; todayKey: string; nowMs: number; bookDocId?: string; allowAppend?: boolean; beforeAppend?: () => Promise<void>; onAppended?: (blockId: string, bookDocId: string) => Promise<void>},
): Promise<{ok: boolean; blockId?: string; bookDocId?: string; reason?: string}> {
    let existingTaskBlockId = "";

    // 1. 优先检验已绑定的 blockId 是否仍在库中
    if (item.blockId) {
        const check = await safePost(post, "/api/query/sql", {
            stmt: `SELECT id, type, subtype FROM blocks WHERE id = '${escapeSql(item.blockId)}' LIMIT 1`,
        });
        if (check.code !== 0 || !Array.isArray(check.data)) return {ok: false, blockId: item.blockId, reason: "task-query-unavailable"};
        const rows = check.code === 0 && Array.isArray(check.data)
            ? (check.data as Array<{id?: string; type?: string; subtype?: string}>)
            : [];
        if (rows.length && rows[0]?.id) {
            existingTaskBlockId = rows[0].type === "i" && rows[0].subtype === "t"
                ? String(rows[0].id)
                : await resolveRealTaskItemBlockId(post, String(rows[0].id));
        } else if (inMemoryOccasionBlockIds.get(item.id) === item.blockId) {
            existingTaskBlockId = item.blockId;
        }
    }

    // 2. 若未命中，按 custom-lv-occasion-id 属性反查防重复建块
    if (!existingTaskBlockId) {
        const byAttr = await safePost(post, "/api/query/sql", {
            stmt: `SELECT b.id FROM blocks b JOIN attributes a ON a.block_id = b.id WHERE a.name = '${OCCASION_TASK_ID_ATTR}' AND a.value = '${escapeSql(item.id)}' AND b.type = 'i' AND b.subtype = 't' ORDER BY b.updated DESC LIMIT 1`,
        });
        if (byAttr.code !== 0 || !Array.isArray(byAttr.data)) return {ok: false, reason: "task-query-unavailable"};
        const rows = byAttr.code === 0 && Array.isArray(byAttr.data) ? (byAttr.data as Array<{id?: string}>) : [];
        if (rows.length && rows[0]?.id) {
            existingTaskBlockId = String(rows[0].id);
        }
    }

    // 3. 更新已有块或追加至《📅 小驴事项簿》
    let bookDocId = options.bookDocId || "";
    let finalTaskBlockId = existingTaskBlockId;
    const initialPayload = buildOccasionTaskSyncPayload(item, options.todayKey, options.nowMs, existingTaskBlockId);

    if (existingTaskBlockId) {
        const updated = await safePost(post, "/api/block/updateBlock", {
            id: existingTaskBlockId,
            data: initialPayload.markdown,
            dataType: "markdown",
        });
        if (updated.code === 0) {
            const updatedId = extractInsertedBlockId(updated.data) || existingTaskBlockId;
            finalTaskBlockId = await resolveRealTaskItemBlockId(post, updatedId);
        } else {
            // A failed response can mean a committed update with a lost receipt.
            // Keep the known identity; never turn an uncertain update into create.
            return {ok: false, blockId: existingTaskBlockId, ...(bookDocId ? {bookDocId} : {}), reason: updated.msg || "update-result-unknown"};
        }
    }

    if (!finalTaskBlockId) {
        if (options.allowAppend === false) return {ok: false, ...(bookDocId ? {bookDocId} : {}), reason: "creation-result-unknown"};
        if (!bookDocId) {
            const book = await ensureOccasionBookDoc(post, options.notebookId);
            if (!book.ok || !book.docId) return {ok: false, reason: book.reason || "book-unavailable"};
            bookDocId = book.docId;
        }
        await options.beforeAppend?.();
        const appended = await safePost(post, "/api/block/appendBlock", {
            parentID: bookDocId,
            data: initialPayload.markdown + `\n{: ${OCCASION_TASK_ID_ATTR}="${item.id.replace(/["\\\r\n]/g, "")}" }`,
            dataType: "markdown",
        });
        if (appended.code !== 0) return {ok: false, bookDocId, reason: appended.msg || "append-failed"};
        const outerId = extractInsertedBlockId(appended.data);
        if (!outerId) return {ok: false, bookDocId, reason: "missing-inserted-id"};
        finalTaskBlockId = await resolveRealTaskItemBlockId(post, outerId);
        await options.onAppended?.(finalTaskBlockId, bookDocId);
    }

    // 4. 在真实任务列表项（type='i', subtype='t'）上写入 Task Horizon 标准属性
    const finalPayload = buildOccasionTaskSyncPayload(item, options.todayKey, options.nowMs, finalTaskBlockId);
    const attrsResult = await safePost(post, "/api/attr/setBlockAttrs", {
        id: finalTaskBlockId,
        attrs: finalPayload.attrs,
    });

    return {ok: attrsResult.code === 0, blockId: finalTaskBlockId, ...(bookDocId ? {bookDocId} : {}), ...(attrsResult.code !== 0 ? {reason: attrsResult.msg || "task-attributes-failed"} : {})};
}

/**
 * 删除事项时安全清理本插件创建的镜像任务块（仅清理带有匹配 custom-lv-occasion-id 印记的块）。
 */
export async function removeOccasionMirroredBlock(
    post: KernelPost,
    occasionId: string,
    blockId?: string,
): Promise<{ok: boolean; deleted: boolean}> {
    let targetId = blockId || "";
    if (targetId) {
        const attrsRes = await safePost(post, "/api/attr/getBlockAttrs", {id: targetId});
        const attrs = attrsRes.code === 0 && attrsRes.data && typeof attrsRes.data === "object"
            ? (attrsRes.data as Record<string, string>)
            : {};
        if (attrs[OCCASION_TASK_ID_ATTR] !== occasionId) {
            targetId = "";
        }
    }
    if (!targetId) {
        const byAttr = await safePost(post, "/api/query/sql", {
            stmt: `SELECT block_id FROM attributes WHERE name = '${OCCASION_TASK_ID_ATTR}' AND value = '${escapeSql(occasionId)}' LIMIT 1`,
        });
        const rows = byAttr.code === 0 && Array.isArray(byAttr.data) ? (byAttr.data as Array<{block_id?: string}>) : [];
        if (rows.length && rows[0]?.block_id) targetId = String(rows[0].block_id);
    }
    if (!targetId) return {ok: true, deleted: false};

    // 检查父列表容器是否仅有这一个子项，避免留下空列表壳
    let deleteId = targetId;
    const infoRes = await safePost(post, "/api/query/sql", {
        stmt: `SELECT parent_id FROM blocks WHERE id = '${escapeSql(targetId)}' LIMIT 1`,
    });
    const parentId = infoRes.code === 0 && Array.isArray(infoRes.data) && infoRes.data.length
        ? String((infoRes.data[0] as {parent_id?: string})?.parent_id || "")
        : "";
    if (parentId) {
        const parentCheck = await safePost(post, "/api/query/sql", {
            stmt: `SELECT b.type, (SELECT COUNT(1) FROM blocks c WHERE c.parent_id = b.id) AS cnt FROM blocks b WHERE b.id = '${escapeSql(parentId)}' LIMIT 1`,
        });
        const pRow = parentCheck.code === 0 && Array.isArray(parentCheck.data) && parentCheck.data.length
            ? (parentCheck.data[0] as {type?: string; cnt?: number | string})
            : undefined;
        if (pRow?.type === "l" && Number(pRow.cnt) <= 1) {
            deleteId = parentId;
        }
    }
    const del = await safePost(post, "/api/block/deleteBlock", {id: deleteId});
    return {ok: del.code === 0, deleted: del.code === 0};
}

/**
 * 反向对账：扫描思源文档中已被用户或 Task Horizon 勾选为 [x]/[X] 的镜像块，回流未记录的本期完成状态。
 */
export async function reconcileOccasionsFromSiyuanBlocks(
    post: KernelPost,
    occasions: readonly Occasion[],
    todayKey: string,
): Promise<{completedPairs: Array<{id: string; occurrenceDate: string}>; staleCycleItems: Occasion[]}> {
    const bound = occasions.filter((item) => item.enabled && Boolean(item.blockId));
    if (!bound.length) return {completedPairs: [], staleCycleItems: []};

    const idList = bound.map((item) => `'${escapeSql(item.blockId!)}'`).join(",");
    const res = await safePost(post, "/api/query/sql", {
        stmt: `SELECT b.id, b.markdown, a.value AS dueDate FROM blocks b LEFT JOIN attributes a ON a.block_id = b.id AND a.name = 'custom-completion-time' WHERE b.id IN (${idList}) LIMIT ${bound.length + 10}`,
    });
    const rows = res.code === 0 && Array.isArray(res.data)
        ? (res.data as Array<{id?: string; markdown?: string; dueDate?: string}>)
        : [];
    const byBlockId = new Map(rows.filter((r) => r.id).map((r) => [String(r.id), r]));

    const completedPairs: Array<{id: string; occurrenceDate: string}> = [];
    const staleCycleItems: Occasion[] = [];

    for (const item of bound) {
        const row = byBlockId.get(item.blockId!);
        if (!row) continue;
        const nextDate = getOccurrenceDate(item, todayKey) || item.date;
        const checkedInDoc = /^[\s>*+-]*\[[xX]\]/m.test(String(row.markdown || ""));
        const blockDueDate = String(row.dueDate || "").trim();

        if (checkedInDoc) {
            const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(blockDueDate) ? blockDueDate : nextDate;
            if (!isOccasionCompleted(item, targetDate)) {
                completedPairs.push({id: item.id, occurrenceDate: targetDate});
            } else if (item.recurrence !== "once" && nextDate > targetDate && !isOccasionCompleted(item, nextDate)) {
                // 周期事项已跨过上一轮完成日进入新一轮，但思源块仍停留在旧日期且打勾：加入待推进刷新队列
                staleCycleItems.push(item);
            }
        } else if (blockDueDate && blockDueDate !== nextDate) {
            staleCycleItems.push(item);
        }
    }

    return {completedPairs, staleCycleItems};
}
