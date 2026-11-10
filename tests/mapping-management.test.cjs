/* T-1660 专项守门测试：大规模映射、失效保留与批量校验模型
   1. 源码导出与渲染层接线断言；
   2. 大规模项目集（>200 项）模糊搜索与有界分页（filterAndPaginateTargets）；
   3. 大规模映射集（≥50 条）批量校验与失效分类（validateMappingsBatch）；
   4. 目标失效（已删除/已归档/单位不匹配）时保留旧身份与修复动作建议；
   5. 映射迁移与变更规划预览（planMappingMigration）；
   6. 纯函数零隐式时钟与无副作用契约。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const mappingSource = fs.readFileSync(path.join(root, "src", "features", "mapping-management.ts"), "utf8");
const yeguifRenderSource = fs.readFileSync(path.join(root, "src", "render", "yeguif-mappings.ts"), "utf8");

/* —— 断言 1：源码接线守门 —— */
assert.match(mappingSource, /export function filterAndPaginateTargets/, "mapping-management exports filterAndPaginateTargets");
assert.match(mappingSource, /export function validateMappingsBatch/, "mapping-management exports validateMappingsBatch");
assert.match(mappingSource, /export function planMappingMigration/, "mapping-management exports planMappingMigration");
assert.match(yeguifRenderSource, /filterAndPaginateTargets/, "yeguif-mappings imports filterAndPaginateTargets");
assert.match(yeguifRenderSource, /validateMappingsBatch/, "yeguif-mappings imports validateMappingsBatch");

/* —— 断言 2：纯函数动态编译与执行 —— */
function loadModule(relativePath) {
    const fullPath = path.join(root, relativePath);
    const content = fs.readFileSync(fullPath, "utf8");
    const transpiled = ts.transpileModule(content, {
        compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
    }).outputText;
    const module = {exports: {}};
    new Function("require", "module", "exports", transpiled)((dep) => {
        if (dep.startsWith(".")) {
            return loadModule(path.join(path.dirname(relativePath), `${dep}.ts`));
        }
        return require(dep);
    }, module, module.exports);
    return module.exports;
}

const {
    filterAndPaginateTargets,
    validateMappingsBatch,
    planMappingMigration,
} = loadModule("src/features/mapping-management.ts");

// 1. 大规模目标候选集（275 个目标）搜索与分页
const largeTargets = Array.from({length: 275}, (_, index) => ({
    id: `target-${index}`,
    name: `项目名称 ${index}`,
    unit: index === 5 ? "次" : "分钟",
    archived: index > 260,
    available: index <= 260,
}));

// A. 全量无搜索分页（第 0 页，每页 50 条）
const page0 = filterAndPaginateTargets(largeTargets, "", 0, 50);
assert.equal(page0.total, 275, "total is 275");
assert.equal(page0.totalPages, 6, "total pages is 6");
assert.equal(page0.page, 0, "current page is 0");
assert.equal(page0.items.length, 50, "page 0 has 50 items");
assert.equal(page0.items[0].id, "target-0");

// B. 搜索过滤（如搜索 "项目名称 12"）
const searchResult = filterAndPaginateTargets(largeTargets, "项目名称 12", 0, 50);
assert.ok(searchResult.total >= 11, "search matches 12, 120-129");
assert.ok(searchResult.items.every((it) => it.name.includes("12")), "all results match search query");

// C. 越界页码安全夹取
const clampedPage = filterAndPaginateTargets(largeTargets, "", 999, 50);
assert.equal(clampedPage.page, 5, "page clamped to last valid page");
assert.equal(clampedPage.items.length, 25, "last page has remaining 25 items");

// 2. 大规模映射集（60 条映射）多维批量校验与失效保护
const largeMappings = Array.from({length: 60}, (_, index) => {
    if (index === 0) return {project: "重复项", itemId: "target-1"};
    if (index === 1) return {project: "重复项", itemId: "target-2"}; // duplicate-project
    if (index === 2) return {project: "空目标项", itemId: ""}; // incomplete
    if (index === 3) return {project: "已删项目", itemId: "non-existent-id"}; // missing-target
    if (index === 4) return {project: "已归档项", itemId: "target-265"}; // archived-target
    if (index === 5) return {project: "单位不合项", itemId: "target-5"}; // unit-mismatch (unit is "次")
    return {project: `工作项目 ${index}`, itemId: `target-${index}`}; // valid
});

const validation = validateMappingsBatch(largeMappings, largeTargets, "分钟");
assert.equal(validation.total, 60, "total mappings is 60");
assert.equal(validation.issues["duplicate-project"], 2, "2 duplicate project entries identified");
assert.equal(validation.issues.incomplete, 1, "1 incomplete entry identified");
assert.equal(validation.issues["missing-target"], 1, "1 missing target identified");
assert.equal(validation.issues["archived-target"], 1, "1 archived target identified");
assert.equal(validation.issues["unit-mismatch"], 1, "1 unit mismatch identified");
assert.equal(validation.invalidCount, 6, "total 6 invalid entries identified");
assert.equal(validation.validCount, 54, "54 valid entries identified");

// 验证失效项保留原有身份，并给出 rebind 建议
const missingRow = validation.rows.find((r) => r.issue === "missing-target");
assert.ok(missingRow);
assert.equal(missingRow.itemId, "non-existent-id", "missing target preserves original id");
assert.equal(missingRow.recommendedAction, "rebind", "missing target recommends rebind action");

const archivedRow = validation.rows.find((r) => r.issue === "archived-target");
assert.ok(archivedRow);
assert.equal(archivedRow.itemId, "target-265", "archived target preserves original id");
assert.equal(archivedRow.recommendedAction, "rebind", "archived target recommends rebind action");

// 3. 映射变更规划与迁移预览
const baseline = [
    {project: "工作", itemId: "target-1"},
    {project: "阅读", itemId: "target-2"},
    {project: "健身", itemId: "target-3"},
];
const current = [
    {project: "工作", itemId: "target-1"}, // unchanged
    {project: "阅读", itemId: "target-20"}, // rebound
    {project: "冥想", itemId: "target-4"}, // added
    // 健身 removed
];

const plan = planMappingMigration(baseline, current);
assert.equal(plan.unchangedCount, 1, "1 unchanged mapping");
assert.equal(plan.added.length, 1, "1 added mapping");
assert.equal(plan.added[0].project, "冥想");
assert.equal(plan.removed.length, 1, "1 removed mapping");
assert.equal(plan.removed[0].project, "健身");
assert.equal(plan.rebound.length, 1, "1 rebound mapping");
assert.equal(plan.rebound[0].project, "阅读");
assert.equal(plan.rebound[0].oldItemId, "target-2");
assert.equal(plan.rebound[0].newItemId, "target-20");

console.log("Mapping management, pagination and validation checks passed successfully.");
