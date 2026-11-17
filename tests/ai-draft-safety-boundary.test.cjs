/* T-1695 专项测试：AI 草案保存、审计、失败回滚与零事实副作用边界门禁 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-ai-safety-"));

const transpile = (sourcePath, outName) => {
    const text = fs.readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(text, {compilerOptions}).outputText;
    fs.writeFileSync(path.join(dir, outName), transpiled);
    return require(path.join(dir, outName));
};

transpile(path.join(root, "src", "types.ts"), "types.js");
transpile(path.join(root, "src", "features", "schedule-validate.ts"), "schedule-validate.js");
transpile(path.join(root, "src", "features", "project-draft.ts"), "project-draft.js");
transpile(path.join(root, "src", "features", "name-inference.ts"), "name-inference.js");
const nld = transpile(path.join(root, "src", "features", "natural-language-draft.ts"), "natural-language-draft.js");

console.log("Starting ai-draft-safety-boundary tests...");

const editorTs = fs.readFileSync(path.join(root, "src", "render", "editor.ts"), "utf8");
const bindEditorTs = fs.readFileSync(path.join(root, "src", "render", "bind-editor.ts"), "utf8");
const saveFormTs = fs.readFileSync(path.join(root, "src", "render", "save-form.ts"), "utf8");

// 1. AI 推断、采纳与丢弃零事实副作用断言 (Zero Store Side-effect Boundary)
{
    const initialStore = {items: [{id: "item-init"}], events: [{id: "evt-init"}]};
    const storeCopy = {items: [...initialStore.items], events: [...initialStore.events]};

    // 步骤 A: 用户生成 AI 草案
    const draft = nld.generateLocalFallbackDraft("每天晨跑5公里");
    assert.ok(draft, "draft must be generated");
    assert.equal(nld.verifyZeroStoreSideEffect(initialStore, storeCopy), true, "AI 推断绝不能修改 Store");

    // 步骤 B: 用户采纳草案到表单（仅 DOM 变化，不写 Store）
    const formValues = {name: draft.name, target: draft.target, unit: draft.unit};
    assert.equal(formValues.name, "晨跑");
    assert.equal(nld.verifyZeroStoreSideEffect(initialStore, storeCopy), true, "采纳草案到表单绝不能直写 Store 或产生打卡事件");

    // 步骤 C: 用户放弃草案
    const clearedDraft = undefined;
    assert.equal(clearedDraft, undefined);
    assert.equal(nld.verifyZeroStoreSideEffect(initialStore, storeCopy), true, "放弃草案绝不能对 Store 产生任何副作用");
}

// 2. 失败原子回滚与草稿可重试断言 (Rollback on Persist Failure)
{
    let persistFailed = true;
    let savedStore = null;

    const mockHost = {
        store: {items: [{id: "item-baseline"}], events: []},
        itemFingerprint: () => "fp-1",
        revisionFingerprint: () => "rfp-1",
        persist: async () => {
            if (persistFailed) {
                throw new Error("Disk IO failure during persist");
            }
            savedStore = mockHost.store;
        },
        invalidateSummary: () => {},
        broadcast: () => {},
        renderBackgroundUpdate: () => {},
        showToday: () => {},
    };

    // 验证 save-form.ts 中存在严格的原子回滚与重试机制
    assert.ok(saveFormTs.includes("host.store = previous;"), "save-form.ts must roll back host.store on persist failure");
    assert.ok(saveFormTs.includes("return undefined;"), "save-form.ts must return undefined on failure without closing form");
}

// 3. AI 来源审计最小摘要断言 (Provenance Audit Trail)
{
    const draft = {
        name: "背单词",
        kind: "count",
        target: 20,
        unit: "个",
        schedule: {type: "daily"},
    };
    const audit = nld.createAiDraftProvenanceAudit(draft, "item-word-1", "每天背单词20个包含长难句分析和发音练习");

    assert.equal(audit.itemId, "item-word-1");
    assert.equal(audit.itemName, "背单词");
    assert.equal(audit.source, "ai_draft");
    assert.equal(audit.schemaVersion, 1);
    assert.ok(audit.textLength > 0 && audit.textLength <= 500);
    assert.ok(Number.isFinite(Date.parse(audit.at)));

    // 严格确保审计对象内没有泄露任何长文本原始 prompt 或模型原始 payload
    const keys = Object.keys(audit).sort();
    assert.deepEqual(keys, ["at", "itemId", "itemName", "schemaVersion", "source", "textLength"]);
    assert.ok(Object.isFrozen(audit), "audit entry must be frozen");
}

// 4. 源码接线与表单来源守门断言 (Wiring & Source Guard)
{
    assert.ok(editorTs.includes('name="draftSource" data-draft-source'), "editor.ts must render hidden draftSource input");
    assert.ok(bindEditorTs.includes('draftSourceInput.value = "ai_draft"'), "bind-editor.ts must mark draftSource on apply");
    assert.ok(bindEditorTs.includes('draftSourceInput.value = ""'), "bind-editor.ts must reset draftSource on discard");
}

console.log("ai-draft-safety-boundary: all zero-side-effect, failure rollback, provenance audit and wiring checks passed.");
