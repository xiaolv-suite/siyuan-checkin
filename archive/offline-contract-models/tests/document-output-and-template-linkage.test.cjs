/* T-1750 & T-1751 专项契约守门测试：
   文档输出建议与编辑器模板联动规则收敛（D-658）。
   1. 文档输出建议安全性（evaluateDocumentOutputRecommendation）：
      - 空目标时状态为 needs_target_selection，canRecommendAutoEnable 恒为 false；
      - 最近写入失败时标为 recent_failed，提示检查权限；
      - 即使就绪，canRecommendAutoEnable 仍为 false（禁止私自开启自动写入开关）；
   2. 模板联动一致性校验（validateTemplateAndSettingsLinkageParity）：
      - 针对要求分钟指标的模板，单位非分钟时准确判定为不一致（isConsistent: false）。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "src", "features", "document-output-and-template-linkage.ts");
const sourceCode = fs.readFileSync(sourcePath, "utf8");

const transpileResult = ts.transpileModule(sourceCode, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

const mod = {};
const moduleWrapper = new Function("exports", "module", "require", transpileResult.outputText);
moduleWrapper(mod, { exports: mod }, require);

const { evaluateDocumentOutputRecommendation, validateTemplateAndSettingsLinkageParity } = mod;

console.log("Starting document-output-and-template-linkage tests...");

// 1. 文档输出安全性 (T-1750)
{
    // A. 目标文档未选择
    const evalEmpty = evaluateDocumentOutputRecommendation({
        outputType: "diary_report",
        targetDocId: "",
        isTargetDocAccessible: false,
        availableDocCandidates: [{ id: "doc-1", title: "日记" }],
    });
    assert.equal(evalEmpty.status, "needs_target_selection");
    assert.equal(evalEmpty.canRecommendAutoEnable, false, "never auto-enable when missing target");
    assert.equal(evalEmpty.candidateDocs.length, 1);

    // B. 最近写入失败
    const evalFailed = evaluateDocumentOutputRecommendation({
        outputType: "summary_resident",
        targetDocId: "doc-1",
        isTargetDocAccessible: true,
        lastWriteSuccess: false,
        lastWriteError: "Permission denied",
        availableDocCandidates: [],
    });
    assert.equal(evalFailed.status, "recent_failed");
    assert.equal(evalFailed.canRecommendAutoEnable, false);

    // C. 就绪态
    const evalReady = evaluateDocumentOutputRecommendation({
        outputType: "journal_questionnaire",
        targetDocId: "doc-1",
        isTargetDocAccessible: true,
        lastWriteSuccess: true,
        availableDocCandidates: [],
    });
    assert.equal(evalReady.status, "ready");
    assert.equal(evalReady.canRecommendAutoEnable, false, "auto enable must remain user-controlled");
}

// 2. 模板联动一致性校验 (T-1751)
{
    const minuteTemplate = {
        templateSlug: "reading-template",
        suggestedSource: "weread",
        targetUnit: "分钟",
        requiresMinutes: true,
    };

    const resValid = validateTemplateAndSettingsLinkageParity(minuteTemplate, "分钟");
    assert.equal(resValid.isConsistent, true);

    const resInvalid = validateTemplateAndSettingsLinkageParity(minuteTemplate, "次");
    assert.equal(resInvalid.isConsistent, false);
    assert.equal(resInvalid.reason, "unit_conflict_template_requires_minutes");
}

console.log("document-output-and-template-linkage: all safety boundaries and parity checks passed successfully.");
