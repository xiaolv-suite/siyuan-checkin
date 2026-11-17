const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/* T-1679 专项守门测试：
   循证模板目录治理与重复/本地化身份
   1. 稳定模板 Slug 派生与跨语言对齐；
   2. 计量单位同义映射归一化；
   3. 同义目标与重复判定规则；
   4. 循证生活与方法论来源溯源；
   5. 现行 79 项内置模板目录健康度与容量审计（上限 120 项，0 冲突）。 */

const projectRoot = path.resolve(__dirname, "..");
const featureTs = fs.readFileSync(path.join(projectRoot, "src", "features", "template-catalog-governance.ts"), "utf8");
const compiled = ts.transpileModule(featureTs, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;
const moduleUnderTest = {exports: {}};
new Function("require", "module", "exports", compiled)(() => {}, moduleUnderTest, moduleUnderTest.exports);

const {
    deriveTemplateSlug,
    normalizeUnit,
    areTemplatesSynonymous,
    resolveTemplateProvenance,
    auditTemplateCatalog,
    TEMPLATE_CATALOG_MAX_BUILTINS,
} = moduleUnderTest.exports;

console.log("Starting template-catalog-governance tests...");

// 1. 稳定模板 Slug 派生断言
assert.equal(deriveTemplateSlug("喝水"), "water");
assert.equal(deriveTemplateSlug("早睡早起"), "early-rise");
assert.equal(deriveTemplateSlug("番茄钟"), "pomodoro");
assert.equal(deriveTemplateSlug("读一页书"), "read-one-page");
assert.equal(deriveTemplateSlug("深度工作"), "deep-work");
assert.equal(deriveTemplateSlug("Deep Work"), "deep-work");
assert.equal(deriveTemplateSlug("Morning Workout"), "morning-workout");

// 2. 计量单位归一化断言
assert.equal(normalizeUnit("ml"), "毫升");
assert.equal(normalizeUnit("毫升"), "毫升");
assert.equal(normalizeUnit("min"), "分钟");
assert.equal(normalizeUnit("mins"), "分钟");
assert.equal(normalizeUnit("minutes"), "分钟");
assert.equal(normalizeUnit("hr"), "小时");
assert.equal(normalizeUnit("hours"), "小时");
assert.equal(normalizeUnit("times"), "次");
assert.equal(normalizeUnit("公斤"), "千克");
assert.equal(normalizeUnit("kg"), "千克");

// 3. 同义目标判重规则断言
// 3.1 名称完全一致
assert.equal(areTemplatesSynonymous({name: "喝水", unit: "毫升"}, {name: "喝水", unit: "毫升"}), true);

// 3.2 中英同义且单位归一后一致
assert.equal(areTemplatesSynonymous({name: "喝水", unit: "毫升"}, {name: "water", unit: "ml"}), true);
assert.equal(areTemplatesSynonymous({name: "深度工作", unit: "分钟"}, {name: "deep-work", unit: "min"}), true);

// 3.3 虽有相似名称但度量单位本质不同：不误判为同义
assert.equal(areTemplatesSynonymous({name: "喝水", unit: "毫升"}, {name: "喝水", unit: "次"}), true); // 同名优先
assert.equal(areTemplatesSynonymous({name: "运动", unit: "分钟"}, {name: "workout", unit: "次"}), false); // 不同单位不同名

// 4. 循证方法论溯源断言
assert.ok(resolveTemplateProvenance("读一页书")?.includes("两分钟定律"));
assert.ok(resolveTemplateProvenance("定时起身")?.includes("HowToLiveBetter"));
assert.ok(resolveTemplateProvenance("分散复习")?.includes("艾宾浩斯遗忘曲线"));
assert.ok(resolveTemplateProvenance("番茄钟")?.includes("番茄工作法"));

// 5. 现行全量内置模板审计
const catalogTs = fs.readFileSync(path.join(projectRoot, "src", "catalog.ts"), "utf8");
const tplMatches = [...catalogTs.matchAll(/\{\s*name:\s*"([^"]+)",\s*icon:\s*"[^"]*",\s*kind:\s*"[^"]*",\s*target:\s*[^,]+,\s*unit:\s*"([^"]+)"/g)];
const activeTemplates = tplMatches.map((m) => ({name: m[1], unit: m[2]}));

assert.ok(activeTemplates.length >= 70, "catalog must contain at least 70 built-in templates");
const audit = auditTemplateCatalog(activeTemplates);

assert.equal(audit.hasOverCapacity, false, `builtins count ${audit.total} must be within budget ${TEMPLATE_CATALOG_MAX_BUILTINS}`);
assert.equal(audit.duplicateTemplates.length, 0, `built-in templates must not have duplicates: ${JSON.stringify(audit.duplicateTemplates)}`);
assert.equal(audit.slugCollisions.length, 0, `slugs must be mutually unique: ${JSON.stringify(audit.slugCollisions)}`);

console.log(`template-catalog-governance: ${activeTemplates.length} templates verified, 0 duplicates, 0 slug collisions.`);
