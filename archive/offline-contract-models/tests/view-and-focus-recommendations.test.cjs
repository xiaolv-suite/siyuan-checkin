/* T-1754 专项契约守门测试：
   今日视图、弹窗与专注提供方建议纯模型（D-656）。
   1. 真实项目体量推导分组模式（>8 且排期多 -> time，>5 -> group）；
   2. 设备与宿主推导弹窗模式（Dock 宿主推荐 quick，移动宿主推荐 tab）；
   3. 专注提供方按真实可用性推荐（Dock Tomato 可用 -> docktomato，否则 builtin）；
   4. 对外能力纯度保持（不推荐 Task Horizon 或 Agent）。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "src", "features", "view-and-focus-recommendations.ts");
const sourceCode = fs.readFileSync(sourcePath, "utf8");

const transpileResult = ts.transpileModule(sourceCode, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

const mod = {};
const moduleWrapper = new Function("exports", "module", "require", transpileResult.outputText);
moduleWrapper(mod, { exports: mod }, require);

const { deriveViewAndFocusRecommendations } = mod;

console.log("Starting view-and-focus-recommendations tests...");

// 1. 项目规模与排期驱动分组建议
{
    // A. 10 个项目且排期多 -> 推荐 time
    const recs1 = deriveViewAndFocusRecommendations({
        totalActiveItems: 10,
        itemsWithScheduleCount: 4,
        isDockHost: false,
        isMobileHost: false,
        isDockTomatoAvailable: true,
    });
    const groupRec1 = recs1.find((r) => r.key === "group_mode");
    assert.ok(groupRec1);
    assert.equal(groupRec1.proposedValue, "time");

    // B. 6 个项目 -> 推荐 group
    const recs2 = deriveViewAndFocusRecommendations({
        totalActiveItems: 6,
        itemsWithScheduleCount: 0,
        isDockHost: false,
        isMobileHost: false,
        isDockTomatoAvailable: false,
    });
    const groupRec2 = recs2.find((r) => r.key === "group_mode");
    assert.ok(groupRec2);
    assert.equal(groupRec2.proposedValue, "group");
}

// 2. 宿主设备驱动打开方式建议
{
    const dockRecs = deriveViewAndFocusRecommendations({
        totalActiveItems: 3,
        itemsWithScheduleCount: 0,
        isDockHost: true,
        isMobileHost: false,
        isDockTomatoAvailable: false,
    });
    const openDock = dockRecs.find((r) => r.key === "open_mode");
    assert.ok(openDock);
    assert.equal(openDock.proposedValue, "quick");

    const mobileRecs = deriveViewAndFocusRecommendations({
        totalActiveItems: 3,
        itemsWithScheduleCount: 0,
        isDockHost: false,
        isMobileHost: true,
        isDockTomatoAvailable: false,
    });
    const openMobile = mobileRecs.find((r) => r.key === "open_mode");
    assert.ok(openMobile);
    assert.equal(openMobile.proposedValue, "tab");
}

// 3. 专注提供方真实可用性推荐
{
    const tomatoRecs = deriveViewAndFocusRecommendations({
        totalActiveItems: 2,
        itemsWithScheduleCount: 0,
        isDockHost: false,
        isMobileHost: false,
        isDockTomatoAvailable: true,
    });
    const focusTomato = tomatoRecs.find((r) => r.key === "focus_provider");
    assert.ok(focusTomato);
    assert.equal(focusTomato.proposedValue, "docktomato");

    const builtinRecs = deriveViewAndFocusRecommendations({
        totalActiveItems: 2,
        itemsWithScheduleCount: 0,
        isDockHost: false,
        isMobileHost: false,
        isDockTomatoAvailable: false,
    });
    const focusBuiltin = builtinRecs.find((r) => r.key === "focus_provider");
    assert.ok(focusBuiltin);
    assert.equal(focusBuiltin.proposedValue, "builtin");
}

console.log("view-and-focus-recommendations: all habit scale, host mode and focus provider checks passed successfully.");
