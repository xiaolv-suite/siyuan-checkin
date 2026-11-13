/* T-1778 & T-1788 专项守门测试：
   全页面视觉与操作语义复核及动态异常状态验收（D-639）。
   1. 七大主页面操作语义（主动作、次动作、空态、回链、无障碍）白名单；
   2. 回链必要性页面（editor/insights/archived）防护；
   3. 动态异常态（loading, error, slow-source, empty, long-text）韧性评估；
   4. 表单草稿失败保护与 400% 缩放防溢出规范。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const featureTs = fs.readFileSync(path.join(projectRoot, "src", "features", "page-semantic-audit.ts"), "utf8");

const compiled = ts.transpileModule(featureTs, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;

const moduleUnderTest = {exports: {}};
new Function("require", "module", "exports", compiled)(() => {}, moduleUnderTest, moduleUnderTest.exports);

const {
    PAGE_SEMANTIC_DEFINITIONS,
    auditPageSemanticIntegrity,
    evaluateDynamicStateResilience,
} = moduleUnderTest.exports;

console.log("Starting page-semantic-audit tests...");

// 1. 全页面主次动作与语义合规断言
{
    const pages = ["today", "review", "insights", "editor", "occasions", "archived", "settings", "more"];
    for (const page of pages) {
        assert.ok(PAGE_SEMANTIC_DEFINITIONS[page], `page ${page} must be defined in semantic definitions`);
        assert.ok(PAGE_SEMANTIC_DEFINITIONS[page].primaryAction);
        assert.ok(PAGE_SEMANTIC_DEFINITIONS[page].secondaryActions.length >= 2);
        assert.ok(PAGE_SEMANTIC_DEFINITIONS[page].emptyAction);

        const audit = auditPageSemanticIntegrity({
            page,
            formFactor: "tab",
            width: 1180,
            hasPrimaryAction: true,
            hasEmptyFallback: true,
            hasReturnNavigation: true,
            hasSearchOrFilter: true,
            hasA11yLabel: true,
        });
        assert.equal(audit.isCompliant, true, `page ${page} must pass compliance check`);
        assert.equal(audit.missingGuards.length, 0);
    }
}

// 2. 回链与主动作缺失拦截断言
{
    // 编辑器页缺失回链导航
    const editorNoReturn = auditPageSemanticIntegrity({
        page: "editor",
        formFactor: "dialog",
        width: 640,
        hasPrimaryAction: true,
        hasEmptyFallback: true,
        hasReturnNavigation: false,
        hasSearchOrFilter: true,
        hasA11yLabel: true,
    });
    assert.equal(editorNoReturn.isCompliant, false);
    assert.ok(editorNoReturn.missingGuards.includes("return-navigation-missing"));

    // 缺少主动作
    const todayNoPrimary = auditPageSemanticIntegrity({
        page: "today",
        formFactor: "tab",
        width: 1400,
        hasPrimaryAction: false,
        hasEmptyFallback: true,
        hasReturnNavigation: false,
        hasSearchOrFilter: true,
        hasA11yLabel: true,
    });
    assert.equal(todayNoPrimary.isCompliant, false);
    assert.ok(todayNoPrimary.missingGuards.includes("primary-action-missing"));
}

// 3. 动态异常状态韧性防御断言
{
    // Loading 状态测试
    const loadingBad = evaluateDynamicStateResilience({
        state: "loading",
        hasBusyIndicator: false,
    });
    assert.equal(loadingBad.isResilient, false);
    assert.ok(loadingBad.remediationHints[0].includes("aria-busy"));

    const loadingGood = evaluateDynamicStateResilience({
        state: "loading",
        hasBusyIndicator: true,
    });
    assert.equal(loadingGood.isResilient, true);

    // Error 状态测试
    const errorBad = evaluateDynamicStateResilience({
        state: "error",
        hasErrorMessage: false,
        hasRetryAction: false,
        isContentPreserved: false,
    });
    assert.equal(errorBad.isResilient, false);
    assert.equal(errorBad.remediationHints.length, 3);

    const errorGood = evaluateDynamicStateResilience({
        state: "error",
        hasErrorMessage: true,
        hasRetryAction: true,
        isContentPreserved: true,
    });
    assert.equal(errorGood.isResilient, true);

    // Long-Text 状态测试
    const longTextBad = evaluateDynamicStateResilience({
        state: "long-text",
        hasUnbrokenWordWrap: false,
    });
    assert.equal(longTextBad.isResilient, false);
    assert.ok(longTextBad.remediationHints[0].includes("overflow-wrap: anywhere"));

    const longTextGood = evaluateDynamicStateResilience({
        state: "long-text",
        hasUnbrokenWordWrap: true,
    });
    assert.equal(longTextGood.isResilient, true);
}

console.log("page-semantic-audit: all page semantic definitions, return navigation and dynamic state resilience checks passed successfully.");
