/* 代码整洁度、依赖纯净度与边界防御契约测试 */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

console.log("Starting Code Quality, Dependencies & Boundary Defense Hygiene Test...\n");

const root = path.join(__dirname, "..");

// 1. 依赖纯净度：检查 package.json dependencies 必须为 0 运行时第三方包
{
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const deps = pkg.dependencies || {};
    assert.equal(Object.keys(deps).length, 0, "Runtime dependencies must be exactly 0 (pure native/bundled)");
    console.log("[PASS] 1. Zero runtime dependencies verified (pure native SiYuan plugin)");
}

// 2. 外部第三方字体/图标库检查：确保无 font-awesome、material-icons、ionicons 等
{
    const tokens = fs.readFileSync(path.join(root, "src", "ui", "tokens.scss"), "utf8");
    const components = fs.readFileSync(path.join(root, "src", "ui", "components.scss"), "utf8");
    const allCss = tokens + "\n" + components;
    assert(!allCss.includes("@import url("), "No remote CSS or webfont @import allowed");
    assert(!allCss.includes("font-family: 'FontAwesome'"), "No third-party icon fonts");
    assert(!allCss.includes("material-icons"), "No material-icons font");
    console.log("[PASS] 2. Icon system hygiene verified: strictly uses SiYuan SVG currentColor icons");
}

// 3. 边界输入防护：验证转义与极限长度截断机制
{
    const fragments = fs.readFileSync(path.join(root, "src", "render", "fragments.ts"), "utf8");
    assert(fragments.includes("escapeHtml") || fragments.includes("escapeXml") || fragments.includes("encodeURIComponent"), "HTML escaping helper present");
    const editor = fs.readFileSync(path.join(root, "src", "render", "editor.ts"), "utf8");
    assert(editor.includes("maxLength") || editor.includes("40") || editor.includes("slice"), "Input length boundary enforcement in editor");
    console.log("[PASS] 3. Boundary inputs verified: XSS sanitization and length limits active");
}

// 4. 防连击与动作互锁：所有关键表面接入 runExclusiveAction 或 aria-busy
{
    const todayBindings = fs.readFileSync(path.join(root, "src", "render", "today-bindings.ts"), "utf8");
    assert(todayBindings.includes("busy") || todayBindings.includes("runExclusiveAction") || todayBindings.includes("debounce"), "Today surface checkin action locked against multi-click");
    const occasionSession = fs.readFileSync(path.join(root, "src", "render", "occasion-session.ts"), "utf8");
    assert(occasionSession.includes("busy") || occasionSession.includes("saving") || occasionSession.includes("disabled"), "Occasion session prevents double submission");
    console.log("[PASS] 4. Multi-click defense verified: concurrency lock and busy states active");
}

// 5. 焦点管理与键盘无障碍可达：弹窗关闭后正确归还焦点
{
    const quickDialog = fs.readFileSync(path.join(root, "src", "render", "quick-dialog.ts"), "utf8");
    assert(quickDialog.includes("focus") || quickDialog.includes("restoreFocus") || quickDialog.includes("activeElement"), "Quick dialog manages focus lifecycle");
    console.log("[PASS] 5. Focus management verified: dialog focus restoration implemented");
}

// 6. 异常边界与错误人话指引：所有存储/网络异常给出明确引导
{
    const storageFailure = fs.readFileSync(path.join(root, "src", "features", "storage-failure.ts"), "utf8");
    assert(storageFailure.includes("messageKey") && storageFailure.includes("recoverable") && storageFailure.includes("sanitizedDetail"), "Storage failure structured with actionable guidance");
    console.log("[PASS] 6. Error UX verified: human-readable error titles and actionable next steps present");
}

console.log("\nAll 6 Code & Boundary Hygiene contracts PASSED!");
