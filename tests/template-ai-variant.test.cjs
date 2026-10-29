/* T-1697 专项测试：模板/组合包变体自然语言定制、身份传承与覆写追踪门禁 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-tpl-variant-"));

const transpile = (sourcePath, outName) => {
    const text = fs.readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(text, {compilerOptions}).outputText;
    fs.writeFileSync(path.join(dir, outName), transpiled);
    return require(path.join(dir, outName));
};

transpile(path.join(root, "src", "types.ts"), "types.js");
transpile(path.join(root, "src", "i18n.ts"), "i18n.js");
transpile(path.join(root, "src", "catalog.ts"), "catalog.js");
transpile(path.join(root, "src", "features", "schedule-validate.ts"), "schedule-validate.js");
transpile(path.join(root, "src", "features", "project-draft.ts"), "project-draft.js");
transpile(path.join(root, "src", "features", "name-inference.ts"), "name-inference.js");
const nld = transpile(path.join(root, "src", "features", "natural-language-draft.ts"), "natural-language-draft.js");
const catalog = require(path.join(dir, "catalog.js"));

console.log("Starting template-ai-variant tests...");

const mockTemplates = catalog.CHECKIN_TEMPLATES || [
    {name: "喝水", icon: "💧", kind: "quantity", target: 2000, unit: "毫升", schedule: {type: "daily"}, group: "健康", priority: "high", timeSlot: "any", note: "多喝水"},
    {name: "运动", icon: "🏃", kind: "duration", target: 30, unit: "分钟", schedule: {type: "daily"}, group: "运动", priority: "high", timeSlot: "any", note: "慢跑"},
    {name: "阅读", icon: "📖", kind: "duration", target: 30, unit: "分钟", schedule: {type: "daily"}, group: "学习", priority: "high", timeSlot: "evening", note: "读书"},
];

// 1. 自动模糊匹配模板与数值覆写断言 (Auto Match & Target Override)
{
    const result = nld.generateTemplateVariantDraft("参考喝水模板，我每天喝 1500 毫升就够了", undefined, {
        templates: mockTemplates,
    });

    assert.ok(result, "must generate template variant result");
    assert.equal(result.baseTemplateName, "喝水");
    assert.equal(result.templateAnchor, "tpl-喝水", "必须传承基准模板身份");
    assert.equal(result.draft.name, "喝水");
    assert.equal(result.draft.icon, "💧", "未提及字段保持原模板配置");
    assert.equal(result.draft.group, "健康");
    assert.equal(result.draft.target, 1500, "目标必须被覆写为 1500");
    assert.equal(result.draft.unit, "毫升");
    assert.deepEqual(result.overriddenFields, ["target"], "覆写字段必须透明追踪");
    assert.ok(result.diffSummary.includes("目标由 2000 调整为 1500"));
}

// 2. 排期与时段偏好覆写断言 (Schedule & TimeSlot Override)
{
    const result = nld.generateTemplateVariantDraft("按运动模板，改成工作日早晨做 20 分钟", undefined, {
        templates: mockTemplates,
    });

    assert.ok(result);
    assert.equal(result.baseTemplateName, "运动");
    assert.equal(result.draft.target, 20);
    assert.equal(result.draft.schedule.type, "workdays", "排期必须被覆写为工作日");
    assert.equal(result.draft.timeSlot, "morning", "时段必须被覆写为早晨");
    assert.ok(result.overriddenFields.includes("schedule"));
    assert.ok(result.overriddenFields.includes("timeSlot"));
    assert.ok(result.overriddenFields.includes("target"));
}

// 3. 显式传入 BaseTemplate 定制断言 (Explicit Base Template)
{
    const readTpl = mockTemplates.find((t) => t.name === "阅读") || mockTemplates[0];
    const result = nld.generateTemplateVariantDraft("每天晚上阅读 45 分钟", readTpl);

    assert.ok(result);
    assert.equal(result.baseTemplateName, "阅读");
    assert.equal(result.draft.target, 45);
    assert.equal(result.draft.unit, "分钟");
    assert.equal(result.draft.timeSlot, "evening");
    assert.ok(result.overriddenFields.includes("target"));
}

// 4. 未匹配安全降级断言 (Fallback on No Match)
{
    const noMatch = nld.generateTemplateVariantDraft("今天心情很好，随便写写", undefined, {
        templates: mockTemplates,
    });
    assert.equal(noMatch, undefined, "无模板匹配时必须安全降级返回 undefined");
}

// 5. 不可变性与零对象污染断言 (Immutability Guard)
{
    const waterTpl = mockTemplates.find((t) => t.name === "喝水");
    const originalTarget = waterTpl.target;

    const result = nld.generateTemplateVariantDraft("喝水 1000 毫升", waterTpl);
    assert.equal(waterTpl.target, originalTarget, "原模板对象绝对不能被篡改");
    assert.ok(Object.isFrozen(result), "result must be frozen");
    assert.ok(Object.isFrozen(result.draft), "draft must be frozen");
    assert.ok(Object.isFrozen(result.overriddenFields), "overriddenFields array must be frozen");
}

console.log("template-ai-variant: all auto match, overrides, anchor inheritance and immutability checks passed.");
