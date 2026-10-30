/* T-1665 专项守门测试：焦点恢复、键盘模态与 aria-live 降噪模型
   1. 源码导出与无障碍契约守门；
   2. aria-live 降噪广播器（AriaLiveDeduplicator）：重复抑制、状态变更放行、冷却期与空串过滤；
   3. 失败时自动定位首个可修复控件（findFirstRepairableControl）；
   4. 模态键盘与 IME 输入防护（evaluateModalKeydown）：拼音组合输入期间 Esc/Enter 绝不误触关闭；
   5. Tab 键 Focus Trap 循环焦点测试；
   6. 纯函数零隐式时钟与无副作用契约。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const a11ySource = fs.readFileSync(path.join(root, "src", "features", "a11y-focus-announcer.ts"), "utf8");

/* —— 断言 1：源码接线守门 —— */
assert.match(a11ySource, /export class AriaLiveDeduplicator/, "a11y-focus-announcer exports AriaLiveDeduplicator");
assert.match(a11ySource, /export function findFirstRepairableControl/, "a11y-focus-announcer exports findFirstRepairableControl");
assert.match(a11ySource, /export function evaluateModalKeydown/, "a11y-focus-announcer exports evaluateModalKeydown");

/* —— 断言 2：纯函数动态编译与执行 —— */
function loadModule(relativePath) {
    const fullPath = path.join(root, relativePath);
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
    AriaLiveDeduplicator,
    findFirstRepairableControl,
    evaluateModalKeydown,
    clearFormValidationErrors,
    markFormControlInvalid,
    applyEditorValidationFeedback,
    applyOccasionValidationFeedback,
} = loadModule("src/features/a11y-focus-announcer.ts");

// 1. aria-live 降噪广播器测试
const deduplicator = new AriaLiveDeduplicator();
const now = 100_000;

// 空消息直接过滤
assert.equal(deduplicator.shouldAnnounce("today", "", now), false, "empty message is rejected");
assert.equal(deduplicator.shouldAnnounce("today", "   ", now), false, "whitespace message is rejected");

// 首次播报放行
assert.equal(deduplicator.shouldAnnounce("today", "已完成打卡", now), true, "initial message allowed");
deduplicator.recordAnnouncement("today", "已完成打卡", now);

// 冷却期（3000ms）内重复相同内容：降噪抑制
assert.equal(deduplicator.shouldAnnounce("today", "已完成打卡", now + 1000), false, "duplicate message throttled within cooldown");
assert.equal(deduplicator.shouldAnnounce("today", "已完成打卡", now + 2500), false, "duplicate message throttled within cooldown");

// 状态发生变化：立即放行
assert.equal(deduplicator.shouldAnnounce("today", "已完成打卡：连续 3 天", now + 1500), true, "changed message allowed immediately");
deduplicator.recordAnnouncement("today", "已完成打卡：连续 3 天", now + 1500);

// 超过冷却期（3000ms）：允许再次播报相同内容（如持续警示）
assert.equal(deduplicator.shouldAnnounce("today", "已完成打卡：连续 3 天", now + 5000), true, "message allowed after cooldown");

// 2. 失败后焦点自动靶向首个可修复控件
let focusedTarget = "";
const mockInput = {
    focus: () => { focusedTarget = "input-invalid"; },
    getAttribute: (name) => (name === "aria-invalid" ? "true" : null),
};
const mockRetryBtn = {
    focus: () => { focusedTarget = "btn-retry"; },
};

const containerWithInvalid = {
    querySelector: (selector) => {
        if (selector.includes('aria-invalid="true"')) return mockInput;
        return null;
    },
    querySelectorAll: () => [mockInput],
};
const target = findFirstRepairableControl(containerWithInvalid);
assert.equal(target, mockInput);
target.focus();
assert.equal(focusedTarget, "input-invalid", "focused first invalid input");

// 仅有重试按钮时的定位
const containerWithRetry = {
    querySelector: (selector) => {
        if (selector.includes('data-action="retry"')) return mockRetryBtn;
        return null;
    },
    querySelectorAll: () => [mockRetryBtn],
};
const retryTarget = findFirstRepairableControl(containerWithRetry);
assert.equal(retryTarget, mockRetryBtn);
retryTarget.focus();
assert.equal(focusedTarget, "btn-retry", "focused retry button when no invalid inputs");

// 3. 模态键盘与 IME 拼音输入保护
// 拼音输入中按下 Escape（keyCode 229 或 isComposing=true），绝不误关闭
assert.equal(evaluateModalKeydown({key: "Escape", shiftKey: false, isComposing: true}), "none", "IME composing blocks Escape");
assert.equal(evaluateModalKeydown({key: "Escape", shiftKey: false, isComposing: false, keyCode: 229}), "none", "keyCode 229 blocks Escape");

// 正常按下 Escape：放行关闭
assert.equal(evaluateModalKeydown({key: "Escape", shiftKey: false, isComposing: false}), "close", "normal Escape triggers close");

// Tab 键 Focus Trap 循环
const firstEl = {focus: () => {}};
const lastEl = {focus: () => {}};
assert.equal(evaluateModalKeydown({key: "Tab", shiftKey: false}, {first: firstEl, last: lastEl, current: lastEl}), "trap-first", "Tab on last loops to first");
assert.equal(evaluateModalKeydown({key: "Tab", shiftKey: true}, {first: firstEl, last: lastEl, current: firstEl}), "trap-last", "Shift+Tab on first loops to last");
assert.equal(evaluateModalKeydown({key: "Tab", shiftKey: false}, {first: firstEl, last: lastEl, current: firstEl}), "none", "Tab on middle element is normal");

// 4. 上下文完整播报守护 (aria-atomic="true" contextual live updates / UI-UX Pro Max)
const fragmentsSrc = fs.readFileSync(path.join(root, "src", "render", "fragments.ts"), "utf8");
const archivedSrc = fs.readFileSync(path.join(root, "src", "render", "archived.ts"), "utf8");
const reviewSrc = fs.readFileSync(path.join(root, "src", "render", "review.ts"), "utf8");
const editorSrc = fs.readFileSync(path.join(root, "src", "render", "editor.ts"), "utf8");
const occasionsSrc = fs.readFileSync(path.join(root, "src", "render", "occasions.ts"), "utf8");

assert.match(fragmentsSrc, /data-bulk-selected-count role="status" aria-live="polite" aria-atomic="true"/, "bulk selected count must be atomic status region");
assert.match(archivedSrc, /lc-checkin__archived-result.*role="status" aria-live="polite" aria-atomic="true"/, "archived result must be atomic status region");
assert.match(reviewSrc, /lc-checkin__history-result.*role="status" aria-live="polite" aria-atomic="true"/, "history filter result must be atomic status region");
assert.match(editorSrc, /data-template-count.*aria-live="polite" aria-atomic="true"/, "template count must be atomic status region");
assert.match(editorSrc, /data-icon-count.*aria-live="polite" aria-atomic="true"/, "icon count must be atomic status region");
assert.match(occasionsSrc, /data-occasion-templates-toggle[\s\S]*?aria-live="polite" aria-atomic="true"/, "occasion template count must be atomic status region");

// 5. 表单校验失败错误状态与首个可修复控件焦点寻址 (WCAG 3.3.1 / 3.3.3 / 2.4.3 & UI-UX Pro Max focus-management)
assert.match(a11ySource, /export function clearFormValidationErrors/, "a11y-focus-announcer exports clearFormValidationErrors");
assert.match(a11ySource, /export function markFormControlInvalid/, "a11y-focus-announcer exports markFormControlInvalid");
assert.match(a11ySource, /export function applyEditorValidationFeedback/, "a11y-focus-announcer exports applyEditorValidationFeedback");
assert.match(a11ySource, /export function applyOccasionValidationFeedback/, "a11y-focus-announcer exports applyOccasionValidationFeedback");

// 源码调用点守门
const bindEditorSrc = fs.readFileSync(path.join(root, "src", "render", "bind-editor.ts"), "utf8");
const saveFormSrc = fs.readFileSync(path.join(root, "src", "render", "save-form.ts"), "utf8");
const bindOccasionsSrc = fs.readFileSync(path.join(root, "src", "render", "bind-occasions.ts"), "utf8");

assert.match(bindEditorSrc, /applyEditorValidationFeedback/, "bind-editor must invoke applyEditorValidationFeedback on validation failure");
assert.match(saveFormSrc, /applyEditorValidationFeedback/, "save-form must invoke applyEditorValidationFeedback on validation failure");
assert.match(bindOccasionsSrc, /applyOccasionValidationFeedback/, "bind-occasions must invoke applyOccasionValidationFeedback on validation failure");

// 运行时功能测试：创建模拟表单 DOM
function createMockField(name, tagName = "input") {
    let invalid = false;
    let focused = false;
    const fieldWrapper = {
        attributes: {},
        setAttribute: (k, v) => { fieldWrapper.attributes[k] = v; },
        removeAttribute: (k) => { delete fieldWrapper.attributes[k]; },
    };
    const element = {
        name,
        tagName,
        attributes: {},
        focus: () => { focused = true; },
        scrollIntoView: () => {},
        setAttribute: (k, v) => {
            element.attributes[k] = v;
            if (k === "aria-invalid" && v === "true") invalid = true;
        },
        removeAttribute: (k) => {
            delete element.attributes[k];
            if (k === "aria-invalid") invalid = false;
        },
        closest: (selector) => (selector === ".lc-checkin__field" ? fieldWrapper : null),
        get isInvalid() { return invalid; },
        get isFocused() { return focused; },
        get fieldWrapper() { return fieldWrapper; },
    };
    return element;
}

const mockForm = (() => {
    const fields = {
        name: createMockField("name"),
        target: createMockField("target"),
        unit: createMockField("unit"),
        schedule: createMockField("schedule", "select"),
        quotaAmount: createMockField("quotaAmount"),
        anchorBlockId: createMockField("anchorBlockId"),
        date: createMockField("date"),
    };
    return {
        fields,
        querySelector: (selector) => {
            if (selector.includes("name='name'")) return fields.name;
            if (selector.includes("name='target'")) return fields.target;
            if (selector.includes("name='unit'")) return fields.unit;
            if (selector.includes("name='schedule'")) return fields.schedule;
            if (selector.includes("name='quotaAmount'")) return fields.quotaAmount;
            if (selector.includes("name='anchorBlockId'")) return fields.anchorBlockId;
            if (selector.includes("name='date'")) return fields.date;
            // 控件自身带有 aria-invalid 的优先匹配
            for (const f of Object.values(fields)) {
                if (f.attributes["aria-invalid"] === "true") return f;
            }
            return null;
        },
        querySelectorAll: (selector) => {
            if (selector.includes('aria-invalid="true"')) {
                return Object.values(fields).filter((f) => f.attributes["aria-invalid"] === "true");
            }
            return [];
        },
    };
})();

// 测试场景 1：名称缺失时，name 控件及其 wrapper 被标记 aria-invalid 并成功聚焦
const focusedTarget1 = applyEditorValidationFeedback(mockForm, {name: "请输入名称"});
assert.equal(focusedTarget1, mockForm.fields.name, "first invalid element is name input");
assert.equal(mockForm.fields.name.isInvalid, true, "name input has aria-invalid='true'");
assert.equal(mockForm.fields.name.fieldWrapper.attributes["aria-invalid"], "true", "name field wrapper has aria-invalid='true'");
assert.equal(mockForm.fields.name.isFocused, true, "name input received focus");

// 测试场景 2：目标值错误时，自动清除旧错误并将 target 设为 invalid 并聚焦
const focusedTarget2 = applyEditorValidationFeedback(mockForm, {target: "目标必须是大于 0 的数字"});
assert.equal(mockForm.fields.name.isInvalid, false, "old name invalid state is cleared");
assert.equal(focusedTarget2, mockForm.fields.target, "first invalid element is target input");
assert.equal(mockForm.fields.target.isInvalid, true, "target input has aria-invalid='true'");
assert.equal(mockForm.fields.target.isFocused, true, "target input received focus");

// 测试场景 3：事项表单校验，日期缺失时 date 控件标记并聚焦
const focusedTarget3 = applyOccasionValidationFeedback(mockForm, {date: true});
assert.equal(mockForm.fields.target.isInvalid, false, "old target invalid state is cleared");
assert.equal(focusedTarget3, mockForm.fields.date, "first invalid element in occasion is date input");
assert.equal(mockForm.fields.date.isInvalid, true, "date input has aria-invalid='true'");
assert.equal(mockForm.fields.date.isFocused, true, "date input received focus");

console.log("Aria-live deduplication, focus recovery, keyboard modal, aria-atomic contextual updates and form validation focus routing checks passed successfully.");
