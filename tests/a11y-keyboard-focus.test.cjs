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
assert.match(a11ySource, /export function renderErrorSummary/, "a11y-focus-announcer exports renderErrorSummary");
assert.match(a11ySource, /export function attachErrorSummary/, "a11y-focus-announcer exports attachErrorSummary");

/* —— 断言 2：纯函数动态编译与执行 —— */
function loadModule(relativePath) {
    const fullPath = path.join(root, relativePath);
    const content = fs.readFileSync(fullPath, "utf8");
    const transpiled = ts.transpileModule(content, {
        compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
    }).outputText;
    const module = {exports: {}};
    new Function("require", "module", "exports", transpiled)((dep) => {
        if (dep === "siyuan") {
            return {showMessage: () => {}, Dialog: class {}};
        }
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
    renderErrorSummary,
    attachErrorSummary,
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
    let inlineError = null;
    const fieldWrapper = {
        attributes: {},
        setAttribute: (k, v) => { fieldWrapper.attributes[k] = v; },
        removeAttribute: (k) => { delete fieldWrapper.attributes[k]; },
        querySelector: (sel) => (sel === ".lc-checkin__field-error" ? inlineError : null),
        insertAdjacentHTML: (pos, html) => {
            const match = html.match(/id="([^"]+)"[\s\S]*?>([^<]+)<\/small>/);
            if (match) {
                inlineError = {
                    id: match[1],
                    textContent: match[2],
                    remove: () => { inlineError = null; },
                };
            }
        },
    };
    const element = {
        name,
        tagName,
        attributes: {},
        focus: () => { focused = true; },
        scrollIntoView: () => {},
        getAttribute: (k) => element.attributes[k] ?? null,
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
        get inlineError() { return inlineError; },
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

// 6. 弹窗模态键盘防护与 Focus Trap 闭环 (WCAG 2.1.2 No Keyboard Trap & WCAG 2.4.3 Focus Order)
const quickDialogSrc = fs.readFileSync(path.join(root, "src", "render", "quick-dialog.ts"), "utf8");
const journalDialogSrc = fs.readFileSync(path.join(root, "src", "render", "journal-dialog.ts"), "utf8");

assert.match(quickDialogSrc, /evaluateModalKeydown/, "quick-dialog must invoke evaluateModalKeydown");
assert.match(journalDialogSrc, /evaluateModalKeydown/, "journal-dialog must invoke evaluateModalKeydown");
assert.match(quickDialogSrc, /action === "trap-first"[\s\S]*?action === "trap-last"/, "quick-dialog must cycle focus via Focus Trap");
assert.match(journalDialogSrc, /action === "trap-first"[\s\S]*?action === "trap-last"/, "journal-dialog must cycle focus via Focus Trap");

// 7. Toast 与反馈通知无障碍完整播报 (WCAG 4.1.3 Status Messages / aria-atomic / UI-UX Pro Max)
const bindNavSrc = fs.readFileSync(path.join(root, "src", "render", "bind-page-navigation.ts"), "utf8");
assert.match(bindNavSrc, /lc-checkin__catchup-toast[\s\S]*?setAttribute\("role", "status"\)[\s\S]*?setAttribute\("aria-live", "polite"\)[\s\S]*?setAttribute\("aria-atomic", "true"\)/, "catchup toast must declare role=status, aria-live=polite, and aria-atomic=true");
assert.match(fragmentsSrc, /lc-checkin__recent-record[\s\S]*?role="status" aria-live="polite" aria-atomic="true"/, "recent-record must be atomic status region");

// 8. 键盘无障碍直达链接与主要内容地标 (WCAG 2.4.1 Bypass Blocks / UI-UX Pro Max #45 Skip Links)
const indexSrc = fs.readFileSync(path.join(root, "src", "index.ts"), "utf8");
const pluginOpsSrc = fs.readFileSync(path.join(root, "src", "plugin-ops.ts"), "utf8");
const polishScssSrc = fs.readFileSync(path.join(root, "src", "ui", "polish.scss"), "utf8");

assert.match(indexSrc, /layout\.id\s*=\s*"lc-checkin-main-content"/, "index.ts must assign id=lc-checkin-main-content to layout");
assert.match(indexSrc, /layout\.setAttribute\("role",\s*"main"\)/, "index.ts must set role=main on layout");
assert.match(indexSrc, /layout\.tabIndex\s*=\s*-1/, "index.ts must set tabIndex=-1 on layout");
assert.match(indexSrc, /<a href="#lc-checkin-main-content" class="lc-checkin__skip-link" data-action="skip-to-content"/, "index.ts must inject skip-link pointing to main content");

assert.match(pluginOpsSrc, /data-action=\\?"skip-to-content\\?"/, "plugin-ops must bind skip-to-content action");
assert.match(pluginOpsSrc, /mainContent\.focus\(\)/, "plugin-ops must focus main content upon activating skip link");

assert.match(polishScssSrc, /\.lc-checkin__skip-link[\s\S]*?position:\s*absolute/, "polish.scss must style skip-link with absolute positioning");
assert.match(polishScssSrc, /\.lc-checkin__skip-link[\s\S]*?:focus[\s\S]*?outline:/, "polish.scss must define high-contrast focus outline for skip-link");

// 模拟 DOM 交互行为验证
let skipFocused = false;
let skipScrolled = false;
let defaultPrevented = false;
const mockMainContent = {
    id: "lc-checkin-main-content",
    tabIndex: 0,
    focus: () => { skipFocused = true; },
    scrollIntoView: (options) => { skipScrolled = Boolean(options); },
};
const mockSkipLink = {
    dataset: {},
    addEventListener: (event, handler) => {
        if (event === "click") {
            mockSkipLink._clickHandler = handler;
        }
    },
};
const mockRoot = {
    querySelector: (selector) => {
        if (selector.includes("data-action=\"skip-to-content\"")) return mockSkipLink;
        if (selector.includes("#lc-checkin-main-content")) return mockMainContent;
        return null;
    },
    querySelectorAll: () => [],
};

// 执行绑定逻辑
const {bindMobileNavFor} = loadModule("src/plugin-ops.ts");
bindMobileNavFor({}, mockRoot);

assert.equal(mockSkipLink.dataset.skipBound, "true", "skip link must be marked as bound");
assert.ok(mockSkipLink._clickHandler, "click handler must be attached to skip link");

// 触发点击事件
mockSkipLink._clickHandler({
    preventDefault: () => { defaultPrevented = true; },
});

assert.equal(defaultPrevented, true, "default navigation must be prevented");
assert.equal(skipFocused, true, "main content must receive focus");
assert.equal(skipScrolled, true, "main content must scroll into view smoothly");
assert.equal(mockMainContent.tabIndex, -1, "main content must have tabIndex=-1");

// 9. 表单字段辅助提示智能关联与内联错误靶向放置 (WCAG 3.3.1 / 1.3.1 & UI-UX Pro Max error-placement & input-helper-text)
assert.match(editorSrc, /aria-describedby="editor-hint-recordStep"/, "editor.ts must associate recordStep with persistent hint");
assert.match(editorSrc, /aria-describedby="editor-hint-quickSteps"/, "editor.ts must associate quickSteps with persistent hint");
assert.match(editorSrc, /aria-describedby="editor-hint-quota"/, "editor.ts must associate quotaAmount with persistent hint");
assert.match(editorSrc, /id="editor-hint-recordStep"/, "editor.ts must define id for recordStep hint");
assert.match(editorSrc, /id="editor-hint-quickSteps"/, "editor.ts must define id for quickSteps hint");
assert.match(editorSrc, /id="editor-hint-quota"/, "editor.ts must define id for quota hint");

assert.match(polishScssSrc, /\.lc-checkin__field-error[\s\S]*?color:\s*var\(--lc-checkin-danger\)/, "polish.scss must style inline field errors with danger tone");

// 校验失败时内联错误 role="alert" 与 aria-describedby 关联断言
const inlineErrorForm = (() => {
    const field = createMockField("name");
    return {
        fields: {name: field},
        querySelector: () => field,
        querySelectorAll: (sel) => (sel.includes('aria-invalid="true"') ? [field] : []),
    };
})();
applyEditorValidationFeedback(inlineErrorForm, {name: "请输入名称"});
assert.ok(inlineErrorForm.fields.name.inlineError, "inline error element must be created under field");
assert.equal(inlineErrorForm.fields.name.inlineError.id, "error-name", "inline error must have error-name ID");
assert.match(inlineErrorForm.fields.name.attributes["aria-describedby"] || "", /error-name/, "name input aria-describedby must reference error-name");

// 清除校验错误时，内联错误自动移除且恢复原状
clearFormValidationErrors(inlineErrorForm);
assert.equal(inlineErrorForm.fields.name.inlineError, null, "inline error must be removed on clear");
assert.equal(inlineErrorForm.fields.name.attributes["aria-describedby"], undefined, "aria-describedby error reference must be cleaned");

// 10. 加载态 aria-busy 无障碍声明与空态可操作性引导 (UI-UX Pro Max Issue #94 & #48)
assert.match(indexSrc, /loading \? 'role="status"' : 'role="alert"'/, "index.ts loading state must declare role=status");
assert.match(indexSrc, /loading \? '\s*aria-busy="true"' : ""/, "index.ts loading state must declare aria-busy=true");
assert.match(indexSrc, /<div class="lc-checkin__empty" \$\{stateAttrs\}\$\{busyAttr\}>/, "index.ts must stamp stateAttrs and busyAttr on loading container");
assert.match(indexSrc, /lc-checkin--insights[\s\S]*?role="status"[\s\S]*?lc-checkin__empty-actions[\s\S]*?data-action="back"/, "index.ts insights empty state must declare role=status and actionable return button");
assert.match(polishScssSrc, /\.lc-checkin__empty\[aria-busy="true"\][\s\S]*?animation:\s*lc-checkin-pulse/, "polish.scss must define pulse animation for aria-busy empty state");
assert.match(polishScssSrc, /@keyframes\s+lc-checkin-pulse/, "polish.scss must define @keyframes lc-checkin-pulse");

// 11. 图表图元键盘无障碍导航与数据点语义化增强 (WCAG 2.1.1 & UI-UX Pro Max Charts & Data focusable-elements)
const chartsSrc = fs.readFileSync(path.join(root, "src", "charts.ts"), "utf8");
assert.match(chartsSrc, /role="graphics-symbol" tabindex="0" aria-label="\$\{pointLabel\}"/, "charts.ts circle must be focusable with graphics-symbol role and aria-label");
assert.match(chartsSrc, /role="graphics-symbol" tabindex="0" aria-label="\$\{barLabel\}"/, "charts.ts rect must be focusable with graphics-symbol role and aria-label");

assert.match(polishScssSrc, /:is\(circle, rect\)\[tabindex="0"\][\s\S]*?:focus-visible[\s\S]*?outline:\s*2px solid var\(--lc-checkin-accent\)/, "polish.scss must define focus outline for chart symbols");

const {renderLineChart, renderBarChart} = loadModule("src/charts.ts");
const sampleSeries = {title: "测试趋势", unit: "次", points: [{label: "10/30", value: 5}, {label: "10/31", value: 8}]};
const lineOutput = renderLineChart(sampleSeries);
const barOutput = renderBarChart(sampleSeries);

assert.match(lineOutput, /<circle[^>]*role="graphics-symbol"[^>]*tabindex="0"[^>]*aria-label="10\/30：5次"/, "rendered line chart must have focusable accessible circles");
assert.match(barOutput, /<rect[^>]*role="graphics-symbol"[^>]*tabindex="0"[^>]*aria-label="10\/30：5次"/, "rendered bar chart must have focusable accessible bars");

// 12. 标签文本溢出披露与 Chips 微交互按压反馈 (UI-UX Pro Max #49 compact-label-overflow & #50 chip-collection-reflow & press-feedback)
assert.match(fragmentsSrc, /class="lc-checkin__item-tag is-skip-tag"\s+title="\$\{escapeHtml\(t\("today\.skipBadge"\)\)\}"/, "fragments.ts is-skip-tag must declare title attribute for overflow disclosure");
assert.match(fragmentsSrc, /class="lc-checkin__item-tag is-avoided"\s+title="\$\{escapeHtml\(t\("today\.avoided"\)\)\}"/, "fragments.ts is-avoided must declare title attribute for overflow disclosure");
assert.match(fragmentsSrc, /class="lc-checkin__item-tag is-high"\s+title="\$\{escapeHtml\(t\("priority\.high"\)\)\}"/, "fragments.ts is-high must declare title attribute for overflow disclosure");
assert.match(fragmentsSrc, /class="lc-checkin__quick-note-chip"[^>]*title="\$\{escapeHtml\(t\("item\.quickTagMorning"\)\)\}"/, "fragments.ts quick-note chips must declare title attribute");

const bindTodaySrc = fs.readFileSync(path.join(root, "src", "render", "bind-today.ts"), "utf8");
assert.match(bindTodaySrc, /element\.querySelectorAll<HTMLElement>\("\[data-action='quick-record'\]"\)\.forEach/, "bind-today.ts must bind all quick-record chips via querySelectorAll");

assert.match(polishScssSrc, /:is\(\.lc-checkin__chip-button[\s\S]*?touch-action:\s*manipulation;/, "polish.scss must define touch-action: manipulation for chips");
assert.match(polishScssSrc, /:is\(\.lc-checkin__chip-button[\s\S]*?:active:not\(\[disabled\]\):not\(\[data-action-busy="true"\]\)[\s\S]*?transform:\s*scale\(0\.95\)/, "polish.scss must define active press tactile feedback");
assert.match(polishScssSrc, /:is\(\.lc-checkin__chip-button[\s\S]*?:focus-visible[\s\S]*?outline:\s*2px solid var\(--lc-checkin-accent\)/, "polish.scss must define focus-visible ring for chips");

// 13. 滚动槽防跳动、微表面光标与习惯韧性条 (UI-UX Pro Max Core Web Vitals CLS < 0.1 & cursor-pointer)
// T-1985（用户实测反馈）：禁止在 .lc-checkin 上设置全局 scroll-behavior: smooth（防止打卡后 scrollTop 重建动画化为整页闪烁）
assert.match(polishScssSrc, /\.lc-checkin\s*\{[\s\S]*?scrollbar-gutter:\s*stable;/, "polish.scss must define scrollbar-gutter: stable for CLS prevention");
assert.ok(!/\.lc-checkin\s*\{[^}]*scroll-behavior:\s*smooth;/i.test(polishScssSrc), "polish.scss must NOT define global scroll-behavior: smooth on .lc-checkin (causes flicker on checkin)");
assert.match(polishScssSrc, /\.lc-habit-strength-bar[\s\S]*?\.lc-habit-strength-bar__track/, "polish.scss must define habit strength bar styles");

// 14. 表单撤离路径与取消按键全量守门 (UI-UX Pro Max #81 escape-routes & #100 visible cancel button)
assert.match(editorSrc, /<div class="lc-checkin__editor-actions"[^>]*>[\s\S]*?<button class="lc-checkin__text-button" type="button" data-action="back">/, "editor.ts must provide an explicit cancel button in action bar");
assert.match(bindEditorSrc, /root\.querySelectorAll<HTMLElement>\("\[data-action='back'\]"\)\.forEach/, "bind-editor.ts must bind all back/cancel buttons via querySelectorAll");

assert.match(occasionsSrc, /<div class="lc-checkin__editor-actions">[\s\S]*?data-action="cancel-occasion-edit"/, "occasions.ts must provide cancel button in occasion editor");

assert.match(bindOccasionsSrc, /root\.querySelectorAll<HTMLElement>\("\[data-action='back'\], \[data-action='occasion-back'\]"\)\.forEach/, "bind-occasions.ts must bind all back/cancel buttons via querySelectorAll");

// 15. 表单校验错误摘要、长文本折行防溢出与移动触控间距 (UI-UX Pro Max #109 Focusable Error Summary, #111 Long Token Wrapping & #22 / #104 Touch Target Spacing)
assert.match(a11ySource, /export function renderErrorSummary/, "a11y-focus-announcer must export renderErrorSummary");
assert.match(a11ySource, /export function attachErrorSummary/, "a11y-focus-announcer must export attachErrorSummary");

const summaryMarkup = renderErrorSummary([
    {field: "name", message: "请输入打卡名称"},
    {field: "target", message: "目标值必须大于 0"},
]);
assert.match(summaryMarkup, /class="lc-checkin__error-summary"/, "rendered summary has error-summary class");
assert.match(summaryMarkup, /role="alert"/, "rendered summary has role='alert'");
assert.match(summaryMarkup, /tabindex="-1"/, "rendered summary has tabindex='-1'");
assert.match(summaryMarkup, /data-focus-control="name"/, "rendered summary has link targeting name field");
assert.match(summaryMarkup, /data-focus-control="target"/, "rendered summary has link targeting target field");

// 模拟带有 insertAdjacentHTML 的完整表单容器进行交互与清理验证
let focusedFieldName = "";
let scrolledFieldName = "";
const mockInteractiveFields = {
    name: {
        focus: () => { focusedFieldName = "name"; },
        scrollIntoView: () => { scrolledFieldName = "name"; },
    },
    target: {
        focus: () => { focusedFieldName = "target"; },
        scrollIntoView: () => { scrolledFieldName = "target"; },
    },
};
let mountedSummaryEl = null;
const mockFullForm = {
    insertAdjacentHTML: (pos, html) => {
        const listeners = {};
        mountedSummaryEl = {
            classList: {contains: (c) => c === "lc-checkin__error-summary"},
            getAttribute: (attr) => (attr === "role" ? "alert" : null),
            remove: () => { mountedSummaryEl = null; },
            querySelectorAll: (sel) => {
                if (sel === ".lc-checkin__error-summary-link") {
                    return [
                        {
                            dataset: {focusControl: "name"},
                            addEventListener: (evt, fn) => { listeners["name"] = fn; },
                            click: () => listeners["name"]?.(),
                        },
                        {
                            dataset: {focusControl: "target"},
                            addEventListener: (evt, fn) => { listeners["target"] = fn; },
                            click: () => listeners["target"]?.(),
                        },
                    ];
                }
                return [];
            },
        };
    },
    querySelector: (sel) => {
        if (sel === ".lc-checkin__error-summary") return mountedSummaryEl;
        if (sel.includes("name='name'")) return mockInteractiveFields.name;
        if (sel.includes("name='target'")) return mockInteractiveFields.target;
        return null;
    },
    querySelectorAll: (sel) => [],
};

attachErrorSummary(mockFullForm, [
    {field: "name", message: "请输入打卡名称"},
    {field: "target", message: "目标值必须大于 0"},
]);
assert.ok(mountedSummaryEl, "error summary element must be mounted");
const errorLinks = mountedSummaryEl.querySelectorAll(".lc-checkin__error-summary-link");
assert.equal(errorLinks.length, 2, "must have 2 error links");
errorLinks[0].click();
assert.equal(focusedFieldName, "name", "clicking first error link focuses name field");
assert.equal(scrolledFieldName, "name", "clicking first error link scrolls name field into view");

// 清除表单校验错误时自动卸载错误摘要
clearFormValidationErrors(mockFullForm);
assert.equal(mountedSummaryEl, null, "error summary must be removed on clearFormValidationErrors");

// 样式守门断言
assert.match(polishScssSrc, /\.lc-checkin__error-summary[\s\S]*?border:\s*1px solid var\(--lc-checkin-danger\)/, "polish.scss must style error summary with danger border");
assert.match(polishScssSrc, /overflow-wrap:\s*anywhere;[\s\S]*?word-break:\s*break-word;/, "polish.scss must define long token wrapping");
assert.match(polishScssSrc, /@media\s*\(pointer:\s*coarse\)[\s\S]*?gap:\s*8px;/, "polish.scss must define 8px minimum gap on coarse pointer");

console.log("Aria-live deduplication, focus recovery, keyboard modal, aria-atomic contextual updates, form validation focus routing, dialog focus traps, toast accessibility, skip-to-content, inline error placement, accessible loading, empty state guidance, chart a11y, chip micro-interaction, scroll-gutter CLS, form escape routes, error summary, long token wrapping, and touch target spacing checks passed successfully.");
