/* T-2020 ~ T-2024：事项 2.0 升级全链路守门测试
   覆盖：
   1. 数据模型无损扩展（time / priority / blockId / contextBlockId）与旧结构兼容；
   2. 一句话闪电解析器（parseQuickOccasionInput）：相对日期、显式日期、农历换算、时刻、重要性、提前天数与思源块引用；
   3. 思源原生任务块双向映射引擎（occasion-siyuan-sync）：外层列表解析至 type='i',subtype='t'、Task Horizon 标准 custom-* 属性集、归属印记防误删、跨端勾选 [x] 对账回流；
   4. window.TaskHorizon 公共接口联动（查询今日待办、勾选状态、打开日历视图、tm:task-completed 回流）；
   5. 【事项 2.0】视图闪电录入栏与【今日】页事项 + Task Horizon 待办同屏去重渲染。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-occasions-v2-"));
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
const transpiled = new Set();

function transpileGraph(relPath) {
    const key = relPath.replace(/\\/g, "/");
    if (transpiled.has(key)) return;
    transpiled.add(key);
    const fullSrc = path.join(root, "src", key);
    const source = fs.readFileSync(fullSrc, "utf8");
    const target = path.join(dir, key.replace(/\.ts$/, ".js"));
    fs.mkdirSync(path.dirname(target), {recursive: true});
    const depth = key.split("/").length - 1;
    const stubSpec = JSON.stringify((depth ? "../".repeat(depth) : "./") + "siyuan-stub.js");
    const rewritten = source
        .replace(/from "siyuan"/g, `from ${stubSpec}`)
        .replace(/import\s+"\.[^"]+\.scss";?/g, "");
    fs.writeFileSync(target, ts.transpileModule(rewritten, {compilerOptions}).outputText);
    const imports = source.match(/from "(\.[^"]+)"/g) || [];
    for (const match of imports) {
        const spec = match.slice(6, -1);
        if (spec.endsWith(".scss")) continue;
        const base = path.posix.join(path.posix.dirname(key), spec);
        for (const candidate of [`${base}.ts`, path.posix.join(base, "index.ts")]) {
            if (fs.existsSync(path.join(root, "src", candidate))) transpileGraph(candidate);
        }
    }
}

fs.writeFileSync(path.join(dir, "siyuan-stub.js"), "module.exports = {showMessage: () => {}, openTab: async () => {}};\n");
for (const entry of [
    "occasions.ts",
    "features/occasion-siyuan-sync.ts",
    "ecosystem-bridge-kit.ts",
    "render/occasions.ts",
    "render/fragments.ts",
]) {
    transpileGraph(entry);
}

const occasions = require(path.join(dir, "occasions.js"));
const siyuanSync = require(path.join(dir, "features", "occasion-siyuan-sync.js"));
const bridgeKit = require(path.join(dir, "ecosystem-bridge-kit.js"));
const occasionsRender = require(path.join(dir, "render", "occasions.js"));
const fragmentsRender = require(path.join(dir, "render", "fragments.js"));

console.log("Starting occasions-v2-ecosystem tests...");

// 1. T-2020: 无损模型扩展与旧格式 100% 兼容
{
    const legacy = occasions.normalizeOccasion({
        id: "occ-legacy",
        name: "传统纪念日",
        kind: "anniversary",
        date: "2024-05-20",
        recurrence: "annual",
    });
    assert.equal("time" in legacy, false, "legacy object omits empty time");
    assert.equal("priority" in legacy, false, "legacy object omits empty priority");
    assert.equal("blockId" in legacy, false, "legacy object omits empty blockId");
    assert.equal("contextBlockId" in legacy, false, "legacy object omits empty contextBlockId");

    const enriched = occasions.normalizeOccasion({
        id: "occ-v2",
        name: "年度体检",
        kind: "scheduled",
        date: "2026-11-15",
        recurrence: "annual",
        time: "8:30",
        priority: "high",
        blockId: "20261101100000-taskblk",
        contextBlockId: "((20261101100000-prepdoc '体检前空腹须知'))",
    });
    assert.equal(enriched.time, "08:30", "normalizes single-digit hour to HH:mm");
    assert.equal(enriched.priority, "high");
    assert.equal(enriched.blockId, "20261101100000-taskblk");
    assert.equal(enriched.contextBlockId, "20261101100000-prepdoc", "strips SiYuan ((id 'title')) wrapper");
}

// 2. T-2020: 一句话闪电自然语言解析器 (parseQuickOccasionInput)
{
    const baseDate = "2026-11-01"; // 周日

    const d1 = occasions.parseQuickOccasionInput("明天 15:00 交周报 !高", baseDate);
    assert.ok(d1);
    assert.equal(d1.name, "交周报");
    assert.equal(d1.date, "2026-11-02");
    assert.equal(d1.time, "15:00");
    assert.equal(d1.priority, "high");
    assert.equal(d1.recurrence, "once");

    const d2 = occasions.parseQuickOccasionInput("每月20号 还房贷 提前3天", baseDate);
    assert.ok(d2);
    assert.equal(d2.name, "还房贷");
    assert.equal(d2.date, "2026-11-20");
    assert.equal(d2.recurrence, "monthly");
    assert.equal(d2.remindBeforeDays, 3);

    const d3 = occasions.parseQuickOccasionInput("妈妈生日 农历 十月初五", baseDate);
    assert.ok(d3);
    assert.equal(d3.name, "妈妈生日");
    assert.equal(d3.kind, "birthday");
    assert.equal(d3.recurrence, "annual");
    assert.equal(d3.calendar, "lunar");
    assert.equal(d3.remindBeforeDays, 7);

    const d4 = occasions.parseQuickOccasionInput("下周五 下午3点半 方案评审 ((20261101120000-abcdefg '评审提纲')) !中", baseDate);
    assert.ok(d4);
    assert.equal(d4.name, "方案评审");
    assert.equal(d4.date, "2026-11-06");
    assert.equal(d4.time, "15:30");
    assert.equal(d4.priority, "medium");
    assert.equal(d4.contextBlockId, "20261101120000-abcdefg");

    const d5 = occasions.parseQuickOccasionInput("((20261101120000-xyz9876 '报税材料清单'))", baseDate);
    assert.ok(d5);
    assert.equal(d5.name, "报税材料清单");
    assert.equal(d5.contextBlockId, "20261101120000-xyz9876");
}

// 3. T-2021: 思源原生任务块双向映射引擎 (Task Horizon kernel.js 属性协议兼容)
(async () => {
    const mockBlocks = new Map();
    const mockAttrs = new Map();
    let seq = 1;

    const fakeKernelPost = async (url, payload) => {
        if (url === "/api/filetree/createDocWithMd") {
            const docId = `20261101130000-doc000${seq++}`;
            mockBlocks.set(docId, {id: docId, type: "d", subtype: "", box: payload.notebook, hpath: payload.path, ial: "", markdown: payload.markdown});
            mockAttrs.set(docId, {});
            return {code: 0, data: docId};
        }
        if (url === "/api/attr/setBlockAttrs") {
            const cur = mockAttrs.get(payload.id) || {};
            Object.assign(cur, payload.attrs);
            mockAttrs.set(payload.id, cur);
            const blk = mockBlocks.get(payload.id);
            if (blk) {
                blk.ial = Object.entries(cur).map(([k, v]) => `${k}="${v}"`).join(" ");
            }
            return {code: 0, data: null};
        }
        if (url === "/api/attr/getBlockAttrs") {
            return {code: 0, data: {...(mockAttrs.get(payload.id) || {})}};
        }
        if (url === "/api/block/appendBlock") {
            // 模拟思源真实行为：追加 `- [ ] ...` 返回外层 type='l' 列表块，真实任务项为其子块 type='i', subtype='t'
            const listId = `20261101130000-lst000${seq++}`;
            const itemId = `20261101130000-tsk000${seq++}`;
            mockBlocks.set(listId, {id: listId, type: "l", subtype: "t", parent_id: payload.parentID, root_id: payload.parentID, markdown: payload.data});
            mockBlocks.set(itemId, {id: itemId, type: "i", subtype: "t", parent_id: listId, root_id: payload.parentID, markdown: payload.data});
            mockAttrs.set(itemId, {});
            return {code: 0, data: [{doOperations: [{id: listId}]}]};
        }
        if (url === "/api/block/updateBlock") {
            const blk = mockBlocks.get(payload.id);
            if (!blk) return {code: -1, msg: "not-found"};
            blk.markdown = payload.data;
            return {code: 0, data: [{doOperations: [{id: payload.id}]}]};
        }
        if (url === "/api/block/getChildBlocks") {
            const children = [...mockBlocks.values()].filter((b) => b.parent_id === payload.id);
            return {code: 0, data: children};
        }
        if (url === "/api/block/deleteBlock") {
            const blk = mockBlocks.get(payload.id);
            if (blk) {
                mockBlocks.delete(payload.id);
                for (const [cid, child] of mockBlocks.entries()) {
                    if (child.parent_id === payload.id) mockBlocks.delete(cid);
                }
            }
            return {code: 0, data: null};
        }
        if (url === "/api/query/sql") {
            const stmt = String(payload.stmt || "");
            if (stmt.includes(siyuanSync.OCCASION_BOOK_DOC_ATTR)) {
                const docs = [...mockBlocks.values()].filter((b) => b.type === "d" && (b.ial || "").includes(`${siyuanSync.OCCASION_BOOK_DOC_ATTR}="1"`));
                return {code: 0, data: docs};
            }
            if (stmt.includes("WITH RECURSIVE tree")) {
                const idMatch = stmt.match(/SELECT '([^']+)', 0/);
                const rootId = idMatch ? idMatch[1] : "";
                const self = mockBlocks.get(rootId);
                if (self && self.type === "i" && self.subtype === "t") return {code: 0, data: [{id: self.id}]};
                const children = [...mockBlocks.values()].filter((b) => b.parent_id === rootId && b.type === "i" && b.subtype === "t");
                return {code: 0, data: children.map((c) => ({id: c.id}))};
            }
            if (stmt.includes("SELECT id, type, subtype FROM blocks WHERE id =")) {
                const m = stmt.match(/WHERE id = '([^']+)'/);
                const hit = m ? mockBlocks.get(m[1]) : undefined;
                return {code: 0, data: hit ? [hit] : []};
            }
            if (stmt.includes("SELECT b.id, b.markdown, a.value AS dueDate")) {
                const rows = [...mockBlocks.values()]
                    .filter((b) => b.type === "i" && b.subtype === "t")
                    .map((b) => ({id: b.id, markdown: b.markdown, dueDate: (mockAttrs.get(b.id) || {})["custom-completion-time"] || ""}));
                return {code: 0, data: rows};
            }
            if (stmt.includes("SELECT parent_id FROM blocks")) {
                const m = stmt.match(/WHERE id = '([^']+)'/);
                const hit = m ? mockBlocks.get(m[1]) : undefined;
                return {code: 0, data: hit ? [{parent_id: hit.parent_id}] : []};
            }
            if (stmt.includes("SELECT b.type, (SELECT COUNT(1)")) {
                const m = stmt.match(/WHERE b.id = '([^']+)'/);
                const hit = m ? mockBlocks.get(m[1]) : undefined;
                const cnt = hit ? [...mockBlocks.values()].filter((c) => c.parent_id === hit.id).length : 0;
                return {code: 0, data: hit ? [{type: hit.type, cnt}] : []};
            }
            return {code: 0, data: []};
        }
        return {code: 0, data: null};
    };

    const occ = occasions.normalizeOccasion({
        id: "occ-sync-1",
        name: "结婚纪念日",
        kind: "anniversary",
        date: "2022-11-15",
        recurrence: "annual",
        time: "19:00",
        priority: "high",
        contextBlockId: "20261101090000-giftidea",
        note: "提前订餐厅",
    });

    const syncRes = await siyuanSync.syncOccasionToSiyuanBlock(fakeKernelPost, occ, {
        notebookId: "nb-main",
        todayKey: "2026-11-01",
        nowMs: 1793500000000,
    });
    assert.equal(syncRes.ok, true, "syncs occasion to SiYuan task block");
    assert.match(syncRes.blockId, /tsk000/, "resolves outer list block to real child task list-item (type='i', subtype='t')");

    const taskAttrs = mockAttrs.get(syncRes.blockId);
    assert.equal(taskAttrs["custom-lv-occasion-id"], "occ-sync-1");
    assert.equal(taskAttrs["custom-completion-time"], "2026-11-15");
    assert.equal(taskAttrs["custom-start-date"], "2026-11-15");
    assert.equal(taskAttrs["custom-time"], "19:00");
    assert.equal(taskAttrs["custom-priority"], "high");
    assert.equal(taskAttrs["custom-status"], "todo");
    assert.equal(taskAttrs["custom-milestone-event"], "1");
    assert.equal(taskAttrs["custom-task-horizon-attr-host-owner"], syncRes.blockId);
    assert.match(mockBlocks.get(syncRes.blockId).markdown, /\(\(20261101090000-giftidea '📎笔记'\)\)/, "embeds real SiYuan block ref for backlinks");

    // 模拟用户在 Task Horizon 或思源文档内直接勾选 `[x]`，测试反向对账回流
    mockBlocks.get(syncRes.blockId).markdown = mockBlocks.get(syncRes.blockId).markdown.replace("- [ ]", "- [x]");
    const occWithBlock = {...occ, blockId: syncRes.blockId};
    const reconciled = await siyuanSync.reconcileOccasionsFromSiyuanBlocks(fakeKernelPost, [occWithBlock], "2026-11-15");
    assert.deepEqual(reconciled.completedPairs, [{id: "occ-sync-1", occurrenceDate: "2026-11-15"}], "detects external [x] completion in SiYuan/Task Horizon");

    // 验证归属保护：绝不误删非本事项创建的自由正文块
    const userOwnBlockId = "20261101130000-usr9999";
    mockBlocks.set(userOwnBlockId, {id: userOwnBlockId, type: "p", markdown: "用户自有段落"});
    mockAttrs.set(userOwnBlockId, {});
    const safeGuard = await siyuanSync.removeOccasionMirroredBlock(fakeKernelPost, "other-occ-id", userOwnBlockId);
    assert.equal(safeGuard.deleted, false, "never deletes user block lacking matching custom-lv-occasion-id");
    assert.equal(mockBlocks.has(userOwnBlockId), true);

    // 验证合法镜像块清理（连同单子项外层空列表一并清理干净）
    const cleanDel = await siyuanSync.removeOccasionMirroredBlock(fakeKernelPost, "occ-sync-1", syncRes.blockId);
    assert.equal(cleanDel.deleted, true, "deletes owned mirrored block cleanly");
    assert.equal(mockBlocks.has(syncRes.blockId), false);

    // 4. T-2022: window.TaskHorizon 公共接口联动与今日横幅去重
    const prevWin = globalThis.window;
    const listeners = new Map();
    let openedView = "";
    let toggledStatus = null;
    globalThis.window = {
        addEventListener(name, fn) {
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name).add(fn);
        },
        removeEventListener(name, fn) {
            listeners.get(name)?.delete(fn);
        },
        TaskHorizon: {
            protocol: "task-horizon",
            apiVersion: 1,
            version: "3.3.6",
            capabilities: ["tasks.query", "tasks.status.write", "views.open", "events.completed"],
            isReady: () => true,
            whenReady: async () => true,
            queryTasks: async () => ({
                tasks: [
                    {id: "20261101140000-mirrored", blockId: "20261101140000-mirrored", title: "💍 结婚纪念日", docId: "d1", status: "todo", done: false, priority: "high", tags: []},
                    {id: "20261101140000-thtask1", blockId: "20261101140000-thtask1", title: "审阅架构方案", docId: "d2", status: "todo", done: false, priority: "high", tags: []},
                ],
                total: 2,
                partial: false,
                truncated: false,
            }),
            getStatusOptions: () => [{id: "todo", name: "待办", marker: " "}, {id: "done", name: "已完成", marker: "X"}],
            setTaskStatus: async (id, status) => { toggledStatus = {id, status}; return true; },
            openView: async (view) => { openedView = view; },
        },
    };

    assert.equal(bridgeKit.isTaskHorizonAvailable(), true);
    const thToday = await bridgeKit.fetchTaskHorizonTodayTasks(8);
    assert.equal(thToday.length, 2);

    const statusOk = await bridgeKit.setTaskHorizonTaskDoneSafely("20261101140000-thtask1", true);
    assert.equal(statusOk, true);
    assert.deepEqual(toggledStatus, {id: "20261101140000-thtask1", status: "done"});

    const viewOk = await bridgeKit.openTaskHorizonViewSafely("calendar");
    assert.equal(viewOk, true);
    assert.equal(openedView, "calendar");

    // 验证双事件名去重监听 (tm:task-completed & task-horizon:task-completed)
    let completedEvents = 0;
    const unsub = bridgeKit.onTaskHorizonCompleted(() => { completedEvents += 1; });
    const eventPayload = {detail: {id: "20261101140000-thtask1", blockId: "20261101140000-thtask1", title: "审阅架构方案", completedAt: 1793500001000, operationId: "op-1"}};
    for (const fn of listeners.get("tm:task-completed") || []) fn(eventPayload);
    for (const fn of listeners.get("task-horizon:task-completed") || []) fn(eventPayload);
    assert.equal(completedEvents, 1, "deduplicates identical operationId across tm:task-completed and task-horizon:task-completed");
    unsub();

    // 验证【今日】页事项条：镜像事项绝不与 Task Horizon 拉取列表重复出现两次
    const bannerStore = {
        version: 1,
        occasions: [
            occasions.normalizeOccasion({
                id: "occ-today",
                name: "结婚纪念日",
                kind: "anniversary",
                date: "2022-11-01",
                recurrence: "annual",
                remindBeforeDays: 3,
                blockId: "20261101140000-mirrored",
            }),
        ],
    };
    const bannerHtml = fragmentsRender.renderOccasionBannerView(bannerStore, new Date(2026, 10, 1, 12), thToday, true);
    assert.ok(bannerHtml.includes("审阅架构方案"), "renders non-mirrored Task Horizon today task");
    assert.equal((bannerHtml.match(/20261101140000-mirrored/g) || []).length, 0, "deduplicates mirrored occasion block from Task Horizon task chips");
    assert.ok(bannerHtml.includes('data-action="open-th-calendar"'), "renders quick calendar handoff button");

    // 5. T-2024: 【事项 2.0】页面渲染校验
    const occasionsViewHtml = occasionsRender.renderOccasionsView({
        occasionStore: {version: 1, occasions: [{...occ, blockId: "20261101140000-mirrored"}]},
        appearance: "light",
        occasionSearchQuery: "",
        occasionStatusFilter: "all",
        occasionKindFilter: "all",
        occasionTimeFilter: "all",
        occasionSortMode: "next",
        occasionTemplatesOpen: false,
        occasionTemplateCategory: "recommended",
        helpOpen: false,
        actionsHelpOpen: false,
        noteExpandedIds: new Set(),
        occurrenceMoves: {},
        submitting: false,
        deletingOccasionIds: new Set(),
        quickDraftText: "明天 15:00 提交年度复盘 !高",
        taskHorizonAvailable: true,
    });
    assert.ok(occasionsViewHtml.includes("data-occasion-quick-input"), "renders top lightning quick-add bar");
    assert.ok(occasionsViewHtml.includes('data-action="occasion-open-th-calendar"'), "renders Task Horizon calendar handoff in header");
    assert.ok(occasionsViewHtml.includes('data-action="occasion-open-book"'), "renders SiYuan Occasion Book button in header");
    assert.ok(occasionsViewHtml.includes("data-occasion-open-block"), "renders SiYuan block jump action on occasion row");
    assert.ok(occasionsViewHtml.includes("data-occasion-peek-block"), "renders SiYuan prep-note quote peek action on occasion row");
    assert.ok(occasionsViewHtml.includes("lc-checkin__occasion-priority is-high"), "renders priority pill on occasion row");
    assert.ok(occasionsViewHtml.includes("lc-checkin__occasion-card-grid"), "renders multi-column occasion card grid");
    assert.ok(occasionsViewHtml.includes("lc-checkin__occasion-title-btn"), "renders clickable card title for direct editing");
    assert.ok(occasionsViewHtml.includes("lc-checkin__occasion-detail-fold"), "folds secondary details by default to keep cards compact");
    assert.ok(occasionsViewHtml.includes("data-occasion-cat-chip=\"expense\""), "renders semantic category filter chips");

    // 6. T-2025 & T-2028: 验证点击编辑时旧新建态空 formDraft 绝不覆盖被编辑事项字段，且语义分类自动识别准确
    const expenseOcc = occasions.normalizeOccasion({
        id: "occ-exp-1",
        name: "招商信用卡还款",
        kind: "scheduled",
        date: "2026-11-20",
        recurrence: "monthly",
        note: "账单日5号",
    });
    assert.equal(occasions.resolveOccasionCategory(expenseOcc), "expense", "infers expense category from name/note");

    const editingViewHtml = occasionsRender.renderOccasionsView({
        occasionStore: {version: 1, occasions: [expenseOcc]},
        editingOccasionId: "occ-exp-1",
        // 模拟之前处于新建态时残留的空草稿（editingId: undefined），不得覆盖正在编辑的 occ-exp-1！
        formDraft: {editingId: undefined, values: {name: "", note: ""}},
        appearance: "light",
        occasionSearchQuery: "",
        occasionStatusFilter: "all",
        occasionKindFilter: "all",
        occasionTimeFilter: "all",
        occasionSortMode: "next",
        occasionTemplatesOpen: false,
        occasionTemplateCategory: "recommended",
        helpOpen: false,
        actionsHelpOpen: false,
        noteExpandedIds: new Set(),
        occurrenceMoves: {},
        submitting: false,
        deletingOccasionIds: new Set(),
    });
    assert.match(editingViewHtml, /name="name"[^>]*value="招商信用卡还款"/, "editing form populates item name despite stale empty draft");
    assert.match(editingViewHtml, /<option value="expense" selected>/, "editing form selects inferred semantic category (expense)");
    assert.ok(editingViewHtml.includes("账单日5号"), "editing form populates item note");

    globalThis.window = prevWin;
    console.log("occasions-v2-ecosystem: all assertions passed!");
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
