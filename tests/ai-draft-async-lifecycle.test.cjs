/* T-1692 专项测试：AI 自然语言起草异步请求生命周期、代际控制与多 Root 隔离门禁 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-ai-draft-async-"));

const transpile = (sourcePath, outName) => {
    const text = fs.readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(text, {compilerOptions}).outputText;
    fs.writeFileSync(path.join(dir, outName), transpiled);
    return require(path.join(dir, outName));
};

transpile(path.join(root, "src", "features", "schedule-validate.ts"), "schedule-validate.js");
transpile(path.join(root, "src", "features", "project-draft.ts"), "project-draft.js");
transpile(path.join(root, "src", "features", "name-inference.ts"), "name-inference.js");
const nld = transpile(path.join(root, "src", "features", "natural-language-draft.ts"), "natural-language-draft.js");

console.log("Starting ai-draft-async-lifecycle tests...");

// 1. 并发请求、Abort 与代际覆盖 (Superseded & Generation)
{
    const manager = new nld.AiDraftLifecycleManager();
    const rootId = "test-root-1";

    // 发起第一个慢请求
    const session1 = manager.createSession(rootId, "每天读书30页");
    assert.equal(session1.requestId, 1);
    assert.equal(session1.generation, 1);
    assert.equal(session1.status, "inferring");
    assert.equal(session1.abortController.signal.aborted, false);
    assert.equal(manager.isSessionCurrent(session1), true);

    // 用户在结果未返回前再次点击或修改描述，发起第二个请求
    const session2 = manager.createSession(rootId, "每天晨跑5公里");
    assert.equal(session2.requestId, 2);
    assert.equal(session2.generation, 2);
    assert.equal(session2.status, "inferring");
    assert.equal(session1.abortController.signal.aborted, true, "请求 1 必须被主动 abort");
    assert.equal(manager.isSessionCurrent(session1), false, "请求 1 必须失效");
    assert.equal(manager.isSessionCurrent(session2), true, "请求 2 为当前有效代际");

    // 模拟请求 1 迟到返回 (Late Arrival)，尝试结算
    const lateCandidate = {
        name: "读书",
        kind: "quantity",
        target: 30,
        unit: "页",
        schedule: {type: "daily"},
        icon: "📖",
    };
    const lateSettle = manager.settleSession(rootId, session1.requestId, {candidate: lateCandidate});
    assert.equal(lateSettle.applied, false, "迟到请求必须被拦截");
    assert.equal(lateSettle.reason, "superseded");
    assert.equal(manager.getDraft(rootId), undefined, "迟到草案不能入账");

    // 模拟请求 2 正常返回
    const currentCandidate = {
        name: "晨跑",
        kind: "quantity",
        target: 5,
        unit: "公里",
        schedule: {type: "daily"},
        icon: "🏃",
    };
    const currentSettle = manager.settleSession(rootId, session2.requestId, {candidate: currentCandidate});
    assert.equal(currentSettle.applied, true, "有效代际必须顺利结算");
    assert.equal(currentSettle.session.status, "ready");
    assert.deepEqual(manager.getDraft(rootId), currentCandidate, "草案归属当前 root");
}

// 2. 多 Root 独立隔离 (Multi-Root Isolation)
{
    const manager = new nld.AiDraftLifecycleManager();
    const rootA = "surface-tab-desktop";
    const rootB = "surface-quick-dialog";

    const sessionA = manager.createSession(rootA, "跳绳1000次");
    const sessionB = manager.createSession(rootB, "喝水2000毫升");

    assert.notEqual(sessionA.requestId, sessionB.requestId);
    assert.equal(manager.getGeneration(rootA), 1);
    assert.equal(manager.getGeneration(rootB), 1);

    const draftA = {name: "跳绳", kind: "count", target: 1000, unit: "次", schedule: {type: "daily"}, icon: "✓"};
    const draftB = {name: "喝水", kind: "quantity", target: 2000, unit: "毫升", schedule: {type: "daily"}, icon: "💧"};

    manager.settleSession(rootA, sessionA.requestId, {candidate: draftA});
    manager.settleSession(rootB, sessionB.requestId, {candidate: draftB});

    assert.equal(manager.getDraft(rootA).name, "跳绳");
    assert.equal(manager.getDraft(rootB).name, "喝水");

    // Root A 采纳并清除草案，不影响 Root B
    manager.clearDraft(rootA);
    assert.equal(manager.getDraft(rootA), undefined);
    assert.equal(manager.getDraft(rootB).name, "喝水");
}

// 3. Root 销毁、卸载与资源回收 (Root Disposal & Cleanup)
{
    const manager = new nld.AiDraftLifecycleManager();
    const rootDestroy = "modal-disposed-root";

    const session = manager.createSession(rootDestroy, "冥想15分钟");
    assert.equal(session.abortController.signal.aborted, false);

    // 编辑器关闭或 root 销毁
    manager.disposeRoot(rootDestroy);
    assert.equal(session.abortController.signal.aborted, true, "销毁必须 abort 在途任务");
    assert.equal(manager.getDraft(rootDestroy), undefined);
    assert.equal(manager.getGeneration(rootDestroy), 0);

    // 迟到请求再尝试入账
    const settleAfterDispose = manager.settleSession(rootDestroy, session.requestId, {
        candidate: {name: "冥想", kind: "duration", target: 15, unit: "分钟", schedule: {type: "daily"}},
    });
    assert.equal(settleAfterDispose.applied, false);
    assert.equal(settleAfterDispose.reason, "root_disposed");
}

// 4. 手动取消 (Manual Abort)
{
    const manager = new nld.AiDraftLifecycleManager();
    const rootCancel = "manual-cancel-root";

    const session = manager.createSession(rootCancel, "背单词");
    manager.abortSession(rootCancel, "user_discarded");

    assert.equal(session.abortController.signal.aborted, true);
    const settle = manager.settleSession(rootCancel, session.requestId, {
        candidate: {name: "背单词", kind: "count", target: 20, unit: "个", schedule: {type: "daily"}},
    });
    assert.equal(settle.applied, false);
    assert.equal(settle.reason, "aborted");
}

// 5. 源码接线与类型扩展守门断言
{
    const typesTs = fs.readFileSync(path.join(root, "src", "types.ts"), "utf8");
    const bindEditorTs = fs.readFileSync(path.join(root, "src", "render", "bind-editor.ts"), "utf8");

    assert.ok(typesTs.includes("interface AiDraftRootState"), "types.ts must declare AiDraftRootState");
    assert.ok(typesTs.includes("aiDraftState?: AiDraftRootState"), "EditorRootContext must declare aiDraftState");

    assert.ok(bindEditorTs.includes("getEditorRootId"), "bind-editor.ts must export getEditorRootId");
    assert.ok(bindEditorTs.includes("defaultAiDraftLifecycle.createSession"), "bind-editor.ts must use createSession");
    assert.ok(bindEditorTs.includes("defaultAiDraftLifecycle.settleSession"), "bind-editor.ts must use settleSession");
    assert.ok(bindEditorTs.includes("defaultAiDraftLifecycle.disposeRoot"), "bind-editor.ts must dispose root in cleanup");
}

console.log("ai-draft-async-lifecycle: all superseding, multi-root isolation, disposal and wiring checks passed.");
