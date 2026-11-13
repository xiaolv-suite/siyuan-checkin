/* T-1746 & T-1747 专项契约守门测试：
   笔记推导与叶归 LifeLog 映射推荐治理（D-657）。
   1. 笔记推导样例验证（evaluateNoteQueryRecommendation）：
      - 缺少 notebook/doc/pattern 拦截；
      - 零匹配样例时坚决禁止给出“推荐已就绪”（canSave: false, reasonKey: "set.notequery.noVerifiableSamples"）；
      - 有匹配样例时准确输出匹配数与忽略数预估；
   2. 叶归多项目映射建议（deriveLifeLogMappingProposals）：
      - 识别同名分钟项并给出高置信度；
      - 识别部分包含项给出中置信度；
      - 核心红线：所有提议映射的 requiresConfirmation 100% 为 true（禁止同名直接静默生效）。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "src", "features", "note-query-and-lifelog-recommendation.ts");
const sourceCode = fs.readFileSync(sourcePath, "utf8");

const transpileResult = ts.transpileModule(sourceCode, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

const mod = {};
const moduleWrapper = new Function("exports", "module", "require", transpileResult.outputText);
moduleWrapper(mod, { exports: mod }, require);

const { evaluateNoteQueryRecommendation, deriveLifeLogMappingProposals } = mod;

console.log("Starting note-query-and-lifelog-recommendation tests...");

// 1. 笔记推导样例就绪度与扫描预估 (T-1746)
{
    // A. 范围缺失
    const evalMissing = evaluateNoteQueryRecommendation({
        notebookId: "",
        docId: "",
        queryMode: "property",
        propertyOrTagName: "read_time",
        targetItemId: "item-1",
        targetItemUnit: "分钟",
        sampleMatches: [],
    }, 100);
    assert.equal(evalMissing.isReadyForPreview, false);
    assert.equal(evalMissing.canSave, false);

    // B. 无匹配样例 -> 绝不判定为就绪
    const evalZeroSamples = evaluateNoteQueryRecommendation({
        notebookId: "nb-1",
        docId: "doc-1",
        queryMode: "property",
        propertyOrTagName: "read_time",
        targetItemId: "item-1",
        targetItemUnit: "分钟",
        sampleMatches: [],
    }, 100);
    assert.equal(evalZeroSamples.isReadyForPreview, false);
    assert.equal(evalZeroSamples.canSave, false);
    assert.equal(evalZeroSamples.reasonKey, "set.notequery.noVerifiableSamples");

    // C. 存在真实样例 -> 就绪，给出扫描匹配与忽略预估
    const evalReady = evaluateNoteQueryRecommendation({
        notebookId: "nb-1",
        docId: "doc-1",
        queryMode: "property",
        propertyOrTagName: "read_time",
        targetItemId: "item-1",
        targetItemUnit: "分钟",
        sampleMatches: [
            { blockId: "b-1", matchedTagOrProperty: "read_time", extractedValue: 30, sampleDate: "2026-10-28" },
            { blockId: "b-2", matchedTagOrProperty: "read_time", extractedValue: 45, sampleDate: "2026-10-29" },
        ],
    }, 50);
    assert.equal(evalReady.isReadyForPreview, true);
    assert.equal(evalReady.canSave, true);
    assert.equal(evalReady.estimatedMatchCount, 2);
    assert.equal(evalReady.ignoredCount, 48);
}

// 2. 叶归映射建议与人工确认红线 (T-1747)
{
    const samples = [
        { activityName: "跑步", durationMinutes: 30, occurredAt: "2026-10-29T08:00:00" },
        { activityName: "拉伸与瑜伽", durationMinutes: 15, occurredAt: "2026-10-29T08:30:00" },
    ];

    const items = [
        { id: "item-run", name: "跑步", unit: "分钟", archived: false },
        { id: "item-yoga", name: "瑜伽", unit: "分钟", archived: false },
        { id: "item-read", name: "读书", unit: "分钟", archived: false },
    ];

    const proposals = deriveLifeLogMappingProposals(samples, items);
    assert.equal(proposals.length, 2);

    // 精确同名项
    const runProp = proposals.find((p) => p.activityName === "跑步");
    assert.ok(runProp);
    assert.equal(runProp.proposedItemId, "item-run");
    assert.equal(runProp.confidence, "high");
    assert.equal(runProp.requiresConfirmation, true, "MUST require confirmation even for exact match");

    // 部分包含项
    const yogaProp = proposals.find((p) => p.activityName === "拉伸与瑜伽");
    assert.ok(yogaProp);
    assert.equal(yogaProp.proposedItemId, "item-yoga");
    assert.equal(yogaProp.confidence, "medium");
    assert.equal(yogaProp.requiresConfirmation, true);
}

console.log("note-query-and-lifelog-recommendation: all sample gating and confirmation requirements passed successfully.");
