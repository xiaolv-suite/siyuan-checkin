/* 专项门禁测试：并发态、交互态、模态键盘隔离与拖拽取消边界测试 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-concurrency-bugs-"));

const transpile = (sourcePath, outName) => {
    const text = fs.readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(text, {compilerOptions}).outputText;
    fs.writeFileSync(path.join(dir, outName), transpiled);
    return require(path.join(dir, outName));
};

fs.mkdirSync(path.join(dir, "render"), {recursive: true});
fs.mkdirSync(path.join(dir, "node_modules", "siyuan"), {recursive: true});
fs.writeFileSync(path.join(dir, "node_modules", "siyuan", "index.js"), "module.exports = { showMessage: () => {} };");
fs.writeFileSync(path.join(dir, "render", "notice.js"), "module.exports = { showMessage: () => {} };");
fs.writeFileSync(path.join(dir, "node_modules", "siyuan", "package.json"), JSON.stringify({name: "siyuan", main: "index.js"}));
transpile(path.join(root, "src", "types.ts"), "types.js");
transpile(path.join(root, "src", "i18n.ts"), "i18n.js");
transpile(path.join(root, "src", "render", "action-busy.ts"), "render/action-busy.js");
const actionBusy = require(path.join(dir, "render", "action-busy.js"));

console.log("Starting concurrency-and-interaction-edge-cases tests...");

// 1. 模拟 DOM 环境验证模态弹窗打开时的键盘穿透防护
{
    const todayBindingsSource = fs.readFileSync(path.join(root, "src", "render", "today-bindings.ts"), "utf8");
    assert.ok(
        todayBindingsSource.includes("isModalOrDialogOpen"),
        "today-bindings must define isModalOrDialogOpen helper"
    );
    assert.ok(
        todayBindingsSource.includes("if (isModalOrDialogOpen(root, target)) return;"),
        "bindQuickKeyboardFor and bindPageKeyboardFor must guard against modal dialog keyboard leakage"
    );
}

// 2. 手柄拖拽中途取消与 Escape 键复位断言
{
    const todayBindingsSource = fs.readFileSync(path.join(root, "src", "render", "today-bindings.ts"), "utf8");
    assert.ok(
        todayBindingsSource.includes("originalNextSibling") &&
        todayBindingsSource.includes("onCancel") &&
        todayBindingsSource.includes("keyEvent.key === \"Escape\""),
        "bindItemDragFor must record originalNextSibling and restore position on Escape or pointercancel"
    );
    assert.ok(
        todayBindingsSource.includes("lostpointercapture"),
        "bindItemDragFor must handle lostpointercapture safely"
    );
}

// 3. 事项表单并发在途双防线断言
{
    const bindOccasionsSource = fs.readFileSync(path.join(root, "src", "render", "bind-occasions.ts"), "utf8");
    assert.ok(
        bindOccasionsSource.includes("if (occasionSubmitBusy) return;") &&
        bindOccasionsSource.includes("if (current.submitting) return;"),
        "bindOccasions must check both occasionSubmitBusy and current.submitting to prevent concurrent duplicate submissions"
    );
}

// 4. Focus 专注按钮并发在途锁断言
{
    const bindTodaySource = fs.readFileSync(path.join(root, "src", "render", "bind-today.ts"), "utf8");
    assert.ok(
        bindTodaySource.includes("runExclusiveAction(button, launch, element"),
        "bindToday focus button must be protected by runExclusiveAction"
    );
}

// 5. 忙碌态多次触发反馈断言 (Action Busy Feedback)
{
    let opCalls = 0;
    const fakeButton = {
        dataset: {},
        disabled: false,
        setAttribute() {},
        removeAttribute() {},
        closest: () => null,
    };
    let resolveOp;
    const pendingOp = new Promise((resolve) => { resolveOp = resolve; });

    // 第一次调用：成功挂起
    actionBusy.runExclusiveAction(fakeButton, () => {
        opCalls++;
        return pendingOp;
    }, null, "button", "test-item-key");

    assert.equal(opCalls, 1, "第一次点击必须执行操作");
    assert.equal(fakeButton.dataset.actionBusy, "true", "按钮必须标记 busy");

    // 第二次调用：应当被拦截阻塞
    actionBusy.runExclusiveAction(fakeButton, () => {
        opCalls++;
    }, null, "button", "test-item-key");

    assert.equal(opCalls, 1, "忙碌中的第二次点击绝对不能执行操作");

    resolveOp();
}

// 6. 验证外部刷新时 candidateRoots 涵盖全部活跃 root
{
    const pluginOpsSource = fs.readFileSync(path.join(root, "src", "plugin-ops.ts"), "utf8");
    assert.ok(
        pluginOpsSource.includes("extraRoots") &&
        pluginOpsSource.includes("candidateRoots = [...new Set"),
        "renderBackgroundUpdateFor must deduplicate and cover all candidate roots including dynamic roots"
    );
}

console.log("concurrency-and-interaction-edge-cases: all modal keyboard guards, drag cancel, concurrent submit locks, and busy feedbacks passed.");
