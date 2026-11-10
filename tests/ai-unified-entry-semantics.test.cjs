/* T-1694 专项测试：系统中 4 大 AI 入口统一语义、降级矩阵与隐私边界门禁 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-ai-unified-"));

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

console.log("Starting ai-unified-entry-semantics tests...");

const i18nTs = fs.readFileSync(path.join(root, "src", "i18n.ts"), "utf8");
const bindEditorTs = fs.readFileSync(path.join(root, "src", "render", "bind-editor.ts"), "utf8");
const bindNavTs = fs.readFileSync(path.join(root, "src", "render", "bind-page-navigation.ts"), "utf8");

// 1. 4 大入口全景与核心契约断言 (All 4 Entry Points)
{
    const allSpecs = nld.getAllAiSurfaceSpecs();
    assert.equal(allSpecs.length, 4, "must register exactly 4 AI surface entry points");

    const entryKinds = allSpecs.map((s) => s.entryKind).sort();
    assert.deepEqual(entryKinds, [
        "editor_draft",
        "habit_coaching",
        "review_assistant",
        "weekly_review_prompt",
    ]);

    for (const spec of allSpecs) {
        assert.equal(spec.externalApiRequired, false, `${spec.entryKind} must never require mandatory external APIs`);
        assert.equal(spec.zeroDataLossGuarantee, true, `${spec.entryKind} must guarantee zero data loss on fallback`);
        assert.ok(Object.isFrozen(spec), "each spec must be frozen");
    }
}

// 2. 隐私外发边界精确约束断言 (Privacy Egress Scope)
{
    const editorSpec = nld.getAiSurfaceEntrySpec("editor_draft");
    assert.equal(editorSpec.privacyEgressScope, "user_text_only");
    assert.equal(editorSpec.promptCopyable, true);
    assert.equal(editorSpec.fallbackStrategy, "local_rules");

    const weeklySpec = nld.getAiSurfaceEntrySpec("weekly_review_prompt");
    assert.equal(weeklySpec.privacyEgressScope, "summary_facts_and_notes");
    assert.equal(weeklySpec.promptCopyable, true);
    assert.equal(weeklySpec.fallbackStrategy, "copy_prompt");

    const assistantSpec = nld.getAiSurfaceEntrySpec("review_assistant");
    assert.equal(assistantSpec.privacyEgressScope, "date_range_only");
    assert.equal(assistantSpec.promptCopyable, true);
    assert.equal(assistantSpec.fallbackStrategy, "native_chart_reading");

    const coachingSpec = nld.getAiSurfaceEntrySpec("habit_coaching");
    assert.equal(coachingSpec.privacyEgressScope, "none", "coaching suggestions must be 100% local with zero egress");
    assert.equal(coachingSpec.promptCopyable, false);
    assert.equal(coachingSpec.fallbackStrategy, "local_rules");
}

// 3. 双语词条映射与完整性断言 (Bilingual Keys Parity)
{
    const allSpecs = nld.getAllAiSurfaceSpecs();
    for (const spec of allSpecs) {
        assert.ok(i18nTs.includes(`"${spec.nameKey}":`), `i18n.ts must define nameKey ${spec.nameKey}`);
        assert.ok(i18nTs.includes(`"${spec.descriptionKey}":`), `i18n.ts must define descriptionKey ${spec.descriptionKey}`);
    }
}

// 4. 源码接线与反馈一致性断言 (Wiring & Status Feedback)
{
    // 周复盘复制提示词有系统通知与就地状态行更新双重反馈
    assert.ok(bindNavTs.includes('showMessage(t("review.aiCopied"))'), "weekly review must show toast on copy");
    assert.ok(bindNavTs.includes('status.textContent = t("review.aiCopied")'), "weekly review must update visible status text on copy");

    // 新建页复制提示词有系统通知与就地状态行更新双重反馈
    assert.ok(bindEditorTs.includes('showMessage(t("editor.aiDraftPromptCopied"))'), "editor draft must show toast on copy");
    assert.ok(bindEditorTs.includes('aiDraftStatus.textContent = t("editor.aiDraftPromptCopied")'), "editor draft must update visible status text on copy");
}

console.log("ai-unified-entry-semantics: all 4 entry specs, privacy egress, fallback and wiring checks passed.");
