const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/* T-1621 & T-1663 专项测试：
   T-1621: 跨表面 SurfaceContext 全量恢复矩阵与多 root 隔离治理
   T-1663: 每 root 会话态、折叠态、焦点和滚动复合键 */

const rootDir = path.resolve(__dirname, "..");

function loadModule(relativePath) {
    const fullPath = path.join(rootDir, relativePath);
    const content = fs.readFileSync(fullPath, "utf8");
    const transpiled = ts.transpileModule(content, {
        compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
    }).outputText;
    const module = {exports: {}};
    new Function("require", "module", "exports", transpiled)((dep) => {
        if (dep.startsWith(".")) {
            return loadModule(path.join(path.dirname(relativePath), `${dep}.ts`));
        }
        return require(dep);
    }, module, module.exports);
    return module.exports;
}

const {
    readSurfaceContext,
    defaultReturnPage,
    getScrollTopKey,
    serializeSurfaceContext,
    deserializeSurfaceContext,
    applySurfaceContext,
    auditMultiRootIsolation,
} = loadModule("src/features/surface-context.ts");

console.log("Starting surface-context-restore tests...");

// 1. readSurfaceContext 全量矩阵测试
// 1.1 Today 页面
const todayCtx = readSurfaceContext({
    currentPage: "today",
    todayQuery: "运动",
    insightsReturnPage: "today",
});
assert.equal(todayCtx.page, "today");
assert.equal(todayCtx.returnTo, undefined);
assert.equal(todayCtx.params.query, "运动");

// 1.2 Review 页面
const reviewCtx = readSurfaceContext({
    currentPage: "review",
    historyScope: "day",
    selectedHistoryDate: "2026-10-28",
    reviewWorkspace: "records",
    summaryRange: "month",
    summaryCustomRange: {startDate: "2026-10-01", endDate: "2026-10-31"},
    historyQuery: "阅读",
    historySource: "weread",
    historyMetering: "duration",
    historyOrder: "oldest",
    historyPage: 2,
    reminderFilter: "overdue",
    insightsReturnPage: "today",
});
assert.equal(reviewCtx.page, "review");
assert.equal(reviewCtx.params.date, "2026-10-28");
assert.equal(reviewCtx.params.workspace, "records");
assert.deepEqual(reviewCtx.params.range, {startDate: "2026-10-01", endDate: "2026-10-31"});
assert.equal(reviewCtx.params.query, "阅读");
assert.equal(reviewCtx.params.filters.source, "weread");
assert.equal(reviewCtx.params.filters.metering, "duration");
assert.equal(reviewCtx.params.filters.order, "oldest");
assert.equal(reviewCtx.params.filters.page, 2);
assert.equal(reviewCtx.params.filters.reminder, "overdue");

// 1.3 Archived 页面
const archivedCtx = readSurfaceContext({
    currentPage: "archived",
    archivedQuery: "旧习惯",
    returnPage: "review",
    insightsReturnPage: "today",
});
assert.equal(archivedCtx.page, "archived");
assert.equal(archivedCtx.returnTo, "review");
assert.equal(archivedCtx.params.query, "旧习惯");

// 1.4 Insights 页面
const insightsCtx = readSurfaceContext({
    currentPage: "insights",
    insightsItemId: "water",
    insightsReturnPage: "review",
    insightsRange: "28",
    insightsItemQuery: "水",
});
assert.equal(insightsCtx.page, "insights");
assert.equal(insightsCtx.returnTo, "review");
assert.equal(insightsCtx.params.itemId, "water");
assert.equal(insightsCtx.params.range, "28");
assert.equal(insightsCtx.params.query, "水");

// 1.5 Editor 页面
const editorCtx = readSurfaceContext({
    currentPage: "editor",
    editingId: "stretch",
    editorReturnPage: "insights",
    insightsReturnPage: "today",
});
assert.equal(editorCtx.page, "editor");
assert.equal(editorCtx.returnTo, "insights");
assert.equal(editorCtx.params.itemId, "stretch");

// 1.6 Occasions 页面
const occasionsCtx = readSurfaceContext({
    currentPage: "occasions",
    editingOccasionId: "birthday-1",
    occasionSearchQuery: "生日",
    occasionStatusFilter: "enabled",
    occasionKindFilter: "birthday",
    occasionTimeFilter: "upcoming",
    occasionSortMode: "name",
    returnPage: "more",
    insightsReturnPage: "today",
});
assert.equal(occasionsCtx.page, "occasions");
assert.equal(occasionsCtx.returnTo, "more");
assert.equal(occasionsCtx.params.itemId, "birthday-1");
assert.equal(occasionsCtx.params.query, "生日");
assert.equal(occasionsCtx.params.filters.status, "enabled");
assert.equal(occasionsCtx.params.filters.kind, "birthday");
assert.equal(occasionsCtx.params.filters.time, "upcoming");
assert.equal(occasionsCtx.params.filters.sort, "name");

// 1.7 Settings 页面
const settingsCtx = readSurfaceContext({
    currentPage: "settings",
    settingsQuery: "备份",
    returnPage: "review",
    insightsReturnPage: "today",
});
assert.equal(settingsCtx.page, "settings");
assert.equal(settingsCtx.returnTo, "review");
assert.equal(settingsCtx.params.query, "备份");

// 2. 序列化与反序列化测试 (Round-trip)
for (const ctx of [todayCtx, reviewCtx, archivedCtx, insightsCtx, editorCtx, occasionsCtx, settingsCtx]) {
    const serialized = serializeSurfaceContext(ctx);
    assert.equal(typeof serialized, "string");
    const deserialized = deserializeSurfaceContext(serialized);
    assert.deepEqual(deserialized, ctx, `Round-trip serialization failed for page ${ctx.page}`);
}

// 非法 JSON 容错
assert.equal(deserializeSurfaceContext(""), undefined);
assert.equal(deserializeSurfaceContext("invalid json"), undefined);
assert.equal(deserializeSurfaceContext(JSON.stringify({page: "unknown_page"})), undefined);

// 3. T-1663 滚动复合键 getScrollTopKey 测试
assert.equal(getScrollTopKey("editor", {itemId: "water"}), "editor:water");
assert.equal(getScrollTopKey("editor"), "editor");
assert.equal(getScrollTopKey("insights", {itemId: "stretch"}), "insights:stretch");
assert.equal(getScrollTopKey("insights"), "insights");
assert.equal(getScrollTopKey("today"), "today");
assert.equal(getScrollTopKey("review"), "review");
assert.equal(getScrollTopKey("occasions"), "occasions");
assert.equal(getScrollTopKey("settings"), "settings");

// 4. applySurfaceContext 执行测试
const stateRecords = {};
const mockHost = {
    pageOfRoot(root) { return stateRecords[root.id]?.page || "today"; },
    applyNavigation(root, page) {
        stateRecords[root.id] = stateRecords[root.id] || {};
        stateRecords[root.id].page = page;
        return true;
    },
    setReturnPageForRoot(root, page) {
        stateRecords[root.id] = stateRecords[root.id] || {};
        stateRecords[root.id].returnTo = page;
    },
    returnPageForRoot(root) {
        return stateRecords[root.id]?.returnTo;
    },
    setTodayQueryForRoot(root, query) {
        stateRecords[root.id] = stateRecords[root.id] || {};
        stateRecords[root.id].todayQuery = query;
    },
    setArchivedQueryForRoot(root, query) {
        stateRecords[root.id] = stateRecords[root.id] || {};
        stateRecords[root.id].archivedQuery = query;
    },
    reviewStateForRoot(root) {
        stateRecords[root.id] = stateRecords[root.id] || {};
        return stateRecords[root.id].review = stateRecords[root.id].review || {};
    },
    setReviewStateForRoot(root, patch) {
        stateRecords[root.id] = stateRecords[root.id] || {};
        stateRecords[root.id].review = Object.assign(stateRecords[root.id].review || {}, patch);
    },
    insightsStateForRoot(root) {
        stateRecords[root.id] = stateRecords[root.id] || {};
        return stateRecords[root.id].insights = stateRecords[root.id].insights || {};
    },
    setInsightsStateForRoot(root, patch) {
        stateRecords[root.id] = stateRecords[root.id] || {};
        stateRecords[root.id].insights = Object.assign(stateRecords[root.id].insights || {}, patch);
    },
    editorStateForRoot(root) {
        stateRecords[root.id] = stateRecords[root.id] || {};
        return stateRecords[root.id].editor = stateRecords[root.id].editor || {};
    },
    setEditorStateForRoot(root, patch) {
        stateRecords[root.id] = stateRecords[root.id] || {};
        stateRecords[root.id].editor = Object.assign(stateRecords[root.id].editor || {}, patch);
    },
    occasionStateForRoot(root) {
        stateRecords[root.id] = stateRecords[root.id] || {};
        return stateRecords[root.id].occasions = stateRecords[root.id].occasions || {};
    },
    setOccasionStateForRoot(root, patch) {
        stateRecords[root.id] = stateRecords[root.id] || {};
        stateRecords[root.id].occasions = Object.assign(stateRecords[root.id].occasions || {}, patch);
    },
    settingsStateForRoot(root) {
        stateRecords[root.id] = stateRecords[root.id] || {};
        return stateRecords[root.id].settings = stateRecords[root.id].settings || {searchSession: {query: ""}};
    },
    renderInto(root) {
        stateRecords[root.id] = stateRecords[root.id] || {};
        stateRecords[root.id].rendered = true;
    },
    render(root) {
        if (root) this.renderInto(root);
    },
};

const mockRootDock = {id: "dock"};
const mockRootTab = {id: "tab"};

// 将 reviewCtx 恢复到 Dock
const appliedReview = applySurfaceContext(mockHost, mockRootDock, reviewCtx);
assert.equal(appliedReview, true);
assert.equal(stateRecords["dock"].page, "review");
assert.equal(stateRecords["dock"].review.historyQuery, "阅读");
assert.equal(stateRecords["dock"].review.selectedHistoryDate, "2026-10-28");
assert.equal(stateRecords["dock"].review.historySource, "weread");

// 将 editorCtx 恢复到 Tab
const appliedEditor = applySurfaceContext(mockHost, mockRootTab, editorCtx);
assert.equal(appliedEditor, true);
assert.equal(stateRecords["tab"].page, "editor");
assert.equal(stateRecords["tab"].editor.editingId, "stretch");
assert.equal(stateRecords["tab"].editor.editorReturnPage, "insights");

// 验证两个 root 互不干扰
assert.equal(stateRecords["dock"].page, "review");
assert.equal(stateRecords["tab"].page, "editor");

// 5. auditMultiRootIsolation 多 root 隔离审计
const auditClean = auditMultiRootIsolation([
    {root: mockRootDock, page: "review", context: {todayQuery: "", review: {}}},
    {root: mockRootTab, page: "editor", context: {todayQuery: "", editor: {draft: {controls: []}}}},
]);
assert.equal(auditClean.totalRoots, 2);
assert.equal(auditClean.distinctPages, 2);
assert.equal(auditClean.hasCrossPollution, false);

// 污染场景（共享同一 draft 对象实例）
const sharedDraft = {controls: [{name: "title", value: "shared"}]};
const auditPolluted = auditMultiRootIsolation([
    {root: mockRootDock, page: "editor", context: {editor: {draft: sharedDraft}}},
    {root: mockRootTab, page: "editor", context: {editor: {draft: sharedDraft}}},
]);
assert.equal(auditPolluted.hasCrossPollution, true);
assert.ok(auditPolluted.issues.some((msg) => msg.includes("Editor draft object is shared")));

console.log("surface-context-restore tests passed successfully!");
