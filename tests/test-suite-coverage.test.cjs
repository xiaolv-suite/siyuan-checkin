const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const scriptText = Object.values(packageJson.scripts || {}).join(" ");
const retired = new Set([]);
const tests = fs.readdirSync(__dirname)
    .filter((name) => name.endsWith(".test.cjs"))
    .sort();

assert.ok(tests.length >= 50, "the maintained test inventory must contain at least 50 files");
for (const name of tests) {
    assert.ok(scriptText.includes(name) || retired.has(name), `${name} must be executed by a package script or explicitly retired`);
}
for (const name of retired) {
    assert.ok(tests.includes(name), `${name} retirement must refer to an existing test`);
    assert.ok(!scriptText.includes(name), `${name} must not silently re-enter the suite before its assertions are modernized`);
}

// 2. T-1674 专项扩展：非 .test.cjs 的辅助/浏览器 harness 脚本全覆盖审计
const harnessScripts = fs.readdirSync(__dirname)
    .filter((name) => name.endsWith(".cjs") && !name.endsWith(".test.cjs"))
    .sort();

// 已被其它测试/harness 模块显式导入并驱动的模块清单
const INVOKED_BY_TESTS = new Set([
    "attachment-ingestion.cjs", // driven by tests/render-boundary.test.cjs
    "smoke-kernel-safety.cjs",   // driven by tests/portable-paths.test.cjs
    "ui-content-audit.cjs",      // driven by tests/width-walkthrough.cjs
    "review-workspace-browser.cjs", // driven by tests/width-walkthrough.cjs
]);

// 在特定视觉走查或真机场景下按需触发的浏览器套件
const BROWSER_STANDALONE_HARNESSES = new Set([
    "visual-qa.cjs",
    "width-walkthrough.cjs",
    "ui-sweep.cjs",
    "first-success-browser.cjs",
    "insights-coach-cta-browser.cjs",
    "reminder-density-browser.cjs",
    "render-hostile-content.cjs",
    "settings-search-browser.cjs",
    "template-pack-browser.cjs",
]);

for (const name of harnessScripts) {
    const isScriptDriven = scriptText.includes(name);
    const isInvoked = INVOKED_BY_TESTS.has(name);
    const isStandalone = BROWSER_STANDALONE_HARNESSES.has(name);
    assert.ok(
        isScriptDriven || isInvoked || isStandalone,
        `${name} must be executed by package script, invoked by a test runner, or registered as a browser harness (zero orphan scripts)`
    );
}

console.log(`Test suite coverage checks passed: ${tests.length} test files, ${harnessScripts.length} harness files, ${retired.size} explicitly retired.`);
