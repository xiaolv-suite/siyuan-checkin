const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/* T-1668 专项守门测试：
   每 root 增量失效与渲染预算决策器
   1. 核心编辑器草稿绝对保护不变量；
   2. 活动输入框（input/textarea/contenteditable）延迟刷新；
   3. 事项表单正在输入时免受非事项后台更新打扰；
   4. 来源与诊断心跳仅刷新设置页，其余表面免重绘；
   5. 事项变更局部失效域（Today 与 Occasions 刷新，Review/Archived 免重绘）；
   6. 帧预算（16.6ms）与长任务（50ms）量化评估。 */

const projectRoot = path.resolve(__dirname, "..");
const featureTs = fs.readFileSync(path.join(projectRoot, "src", "features", "render-invalidation.ts"), "utf8");
const compiled = ts.transpileModule(featureTs, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;
const moduleUnderTest = {exports: {}};
new Function("require", "module", "exports", compiled)(() => {}, moduleUnderTest, moduleUnderTest.exports);

const {evaluateRootInvalidation, evaluateRenderBudget} = moduleUnderTest.exports;

console.log("Starting incremental-invalidation tests...");

// 1. 编辑器草稿绝对保护不变量
for (const reason of ["event-recorded", "event-undone", "source-ingest", "occasion-mutation", "preference-update", "diagnostics-update"]) {
    const decision = evaluateRootInvalidation(reason, {page: "editor", hasEditorDraft: true});
    assert.equal(decision.rootAction, "skip-editor-draft", `Editor page must skip background render for reason: ${reason}`);
}

// 2. 活动输入元素焦点防护
{
    const todayDecision = evaluateRootInvalidation("event-recorded", {page: "today", hasActiveInput: true});
    assert.equal(todayDecision.rootAction, "deferred-input", "Today page with active input must defer render until focusout");

    const settingsDecision = evaluateRootInvalidation("source-ingest", {page: "settings", hasActiveInput: true});
    assert.equal(settingsDecision.rootAction, "deferred-input", "Settings page with active input must defer render");
}

// 3. 事项草稿保护
{
    const occDecision = evaluateRootInvalidation("event-recorded", {page: "occasions", hasOccasionDraft: true});
    assert.equal(occDecision.rootAction, "no-op", "Occasions page with open form draft skips unrelated event update");

    const occMutDecision = evaluateRootInvalidation("occasion-mutation", {page: "occasions", hasOccasionDraft: false});
    assert.equal(occMutDecision.rootAction, "immediate-render", "Occasions page without draft updates immediately on occasion mutation");
}

// 4. 来源与诊断心跳最小失效域
{
    const settingsIngest = evaluateRootInvalidation("source-ingest", {page: "settings"});
    assert.equal(settingsIngest.rootAction, "immediate-render", "Settings renders on source ingest heartbeat");

    const todayIngest = evaluateRootInvalidation("source-ingest", {page: "today"});
    assert.equal(todayIngest.rootAction, "no-op", "Today does not redraw on ingest heartbeat");

    const reviewDiag = evaluateRootInvalidation("diagnostics-update", {page: "review"});
    assert.equal(reviewDiag.rootAction, "no-op", "Review does not redraw on diagnostics update");
}

// 5. 事项变异失效域
{
    const todayOcc = evaluateRootInvalidation("occasion-mutation", {page: "today"});
    assert.equal(todayOcc.rootAction, "immediate-render", "Today renders occasion banner on occasion mutation");

    const reviewOcc = evaluateRootInvalidation("occasion-mutation", {page: "review"});
    assert.equal(reviewOcc.rootAction, "no-op", "Review skips redraw on occasion mutation");

    const archivedOcc = evaluateRootInvalidation("occasion-mutation", {page: "archived"});
    assert.equal(archivedOcc.rootAction, "no-op", "Archived skips redraw on occasion mutation");
}

// 6. 打卡与撤销失效域
{
    const todayRec = evaluateRootInvalidation("event-recorded", {page: "today"});
    assert.equal(todayRec.rootAction, "immediate-render", "Today updates immediately on event record");

    const reviewUndone = evaluateRootInvalidation("event-undone", {page: "review"});
    assert.equal(reviewUndone.rootAction, "immediate-render", "Review updates immediately on event undo");

    const insightsUnrelated = evaluateRootInvalidation("event-recorded", {page: "insights", isFocusedItemChanged: false});
    assert.equal(insightsUnrelated.rootAction, "no-op", "Insights skips redraw when unaffected item is mutated");
}

// 7. 渲染帧预算 (16.6ms) 与长任务 (50ms) 评估
{
    const optimal = evaluateRenderBudget(8.5);
    assert.equal(optimal.withinFrameBudget, true);
    assert.equal(optimal.isLongTask, false);
    assert.equal(optimal.rating, "optimal");

    const acceptable = evaluateRenderBudget(25.0);
    assert.equal(acceptable.withinFrameBudget, false);
    assert.equal(acceptable.isLongTask, false);
    assert.equal(acceptable.rating, "acceptable");

    const longTask = evaluateRenderBudget(65.0);
    assert.equal(longTask.withinFrameBudget, false);
    assert.equal(longTask.isLongTask, true);
    assert.equal(longTask.rating, "degraded");
}

console.log("incremental-invalidation: all invalidation domains, input protections and budget ratings passed successfully.");
