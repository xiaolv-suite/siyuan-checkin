/* T-1693 专项测试：自然语言起草输入与状态交互、示例Chips、IME防误触与焦点恢复门禁 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

console.log("Starting ai-draft-interaction tests...");

const editorTs = fs.readFileSync(path.join(root, "src", "render", "editor.ts"), "utf8");
const bindEditorTs = fs.readFileSync(path.join(root, "src", "render", "bind-editor.ts"), "utf8");
const i18nTs = fs.readFileSync(path.join(root, "src", "i18n.ts"), "utf8");

// 1. 结构与状态机声明断言 (State Machine Markup)
{
    assert.ok(editorTs.includes('data-ai-draft-state="idle"'), "editor.ts must initialize with data-ai-draft-state='idle'");
    assert.ok(editorTs.includes('data-action="ai-draft-clear"'), "editor.ts must include clear input action button");
    assert.ok(editorTs.includes('data-ai-draft-examples'), "editor.ts must include example chips container");
    assert.ok(editorTs.includes('data-ai-draft-example='), "editor.ts must provide clickable example chips");

    // 检查 4 个经典习惯示例 chips
    assert.ok(editorTs.includes('editor.aiDraftExampleRun'), "editor.ts must include run example");
    assert.ok(editorTs.includes('editor.aiDraftExampleRead'), "editor.ts must include read example");
    assert.ok(editorTs.includes('editor.aiDraftExampleWater'), "editor.ts must include water example");
    assert.ok(editorTs.includes('editor.aiDraftExampleMeditate'), "editor.ts must include meditate example");
}

// 2. 状态机流转与等待态防抖断言 (State Transition & Busy Defense)
{
    assert.ok(bindEditorTs.includes('setAiDraftState("inferring")'), "bind-editor.ts must transition to inferring");
    assert.ok(bindEditorTs.includes('setAiDraftState("needs-review")'), "bind-editor.ts must transition to needs-review");
    assert.ok(bindEditorTs.includes('setAiDraftState("failed")'), "bind-editor.ts must transition to failed");
    assert.ok(bindEditorTs.includes('setAiDraftState("applied")'), "bind-editor.ts must transition to applied");
    assert.ok(bindEditorTs.includes('setAiDraftState("cancelled")'), "bind-editor.ts must transition to cancelled");

    // inferring 状态必须声明忙碌态以防止重复点击与键盘连发
    assert.ok(bindEditorTs.includes('inferBtn.setAttribute("data-action-busy", "true")'), "inferBtn must set data-action-busy during inferring");
    assert.ok(bindEditorTs.includes('inferBtn.setAttribute("aria-busy", "true")'), "inferBtn must set aria-busy during inferring");
    assert.ok(bindEditorTs.includes('inferBtn.removeAttribute("data-action-busy")'), "inferBtn must release data-action-busy after settle");
}

// 3. 键盘回车与 IME 组合态防误触断言 (IME Composition Guard)
{
    assert.ok(bindEditorTs.includes('e.key === "Enter"'), "bind-editor.ts must support Enter key submission");
    assert.ok(bindEditorTs.includes('e.isComposing') && bindEditorTs.includes('keyCode === 229'),
        "bind-editor.ts must guard IME composition state (isComposing || keyCode === 229) to prevent premature submit");
}

// 4. 清空与错误焦点恢复断言 (Focus Restoration on Error & Clear)
{
    assert.ok(bindEditorTs.includes('aiDraftClearBtn?.addEventListener("click"'), "bind-editor.ts must bind clear action");
    assert.ok(bindEditorTs.includes('aiDraftInput.focus()'), "clear and failed state must return focus to aiDraftInput");
}

// 5. 示例 Chips 自动填入并推断断言 (Example Chips Wiring)
{
    assert.ok(bindEditorTs.includes('data-ai-draft-example'), "bind-editor.ts must handle example chip clicks");
    assert.ok(bindEditorTs.includes('aiDraftInput.value = exampleText'), "chip click must fill aiDraftInput");
    assert.ok(bindEditorTs.includes('triggerInfer()'), "chip click must auto trigger inference");
}

// 6. 中英双语全覆盖断言 (Bilingual Coverage)
{
    const keys = [
        "editor.aiDraftExampleRun",
        "editor.aiDraftExampleRead",
        "editor.aiDraftExampleWater",
        "editor.aiDraftExampleMeditate",
        "editor.aiDraftClear",
        "editor.aiDraftInferring",
        "editor.aiDraftApplied",
    ];

    for (const key of keys) {
        assert.ok(i18nTs.includes(`"${key}":`), `i18n.ts must define key ${key}`);
    }
}

console.log("ai-draft-interaction: all markup, state transitions, IME guard, focus restoration and i18n checks passed.");
