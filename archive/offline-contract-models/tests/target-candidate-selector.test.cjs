/* T-1749 专项契约守门测试：
   来源目标候选选择器、大项目集支持与写前复核（D-655）。
   1. 大数据集支持（支持 > 200 项，支持分页与搜索）；
   2. 当前已绑定项（selectedId）即使归档或指标不符也强制置顶保留；
   3. 单位兼容性过滤准确（分钟、步数、公斤、二值）；
   4. 写前动态复核（auditTargetBeforeSave）准确阻断别窗归档或单位篡改。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "src", "features", "target-candidate-selector.ts");
const sourceCode = fs.readFileSync(sourcePath, "utf8");

const transpileResult = ts.transpileModule(sourceCode, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

const mod = {};
const moduleWrapper = new Function("exports", "module", "require", transpileResult.outputText);
moduleWrapper(mod, { exports: mod }, require);

const { projectTargetCandidates, auditTargetBeforeSave } = mod;

console.log("Starting target-candidate-selector tests...");

// 1. 生成 300 个项目测试大数据集支持 (> 200 项)
{
    const items = [];
    for (let i = 1; i <= 300; i++) {
        items.push({
            id: `item-${i}`,
            name: `习惯项目 ${i}`,
            unit: i % 2 === 0 ? "分钟" : "次",
            archived: i > 280,
        });
    }

    // A. 无截断全量检索（检索“习惯项目 250”，超过 200 项依然在位）
    const searchRes = projectTargetCandidates(items, {
        searchQuery: "250",
        requiredUnitKind: "minutes",
    });
    assert.equal(searchRes.length, 1);
    assert.equal(searchRes[0].item.id, "item-250");
    assert.equal(searchRes[0].eligibility, "eligible");
    assert.equal(searchRes[0].isSelectable, true);

    // B. 分页切片 (limit: 50, offset: 0)
    const pagedRes = projectTargetCandidates(items, {
        requiredUnitKind: "minutes",
        limit: 50,
        offset: 0,
    });
    assert.equal(pagedRes.length, 50);

    // C. 绑定项置顶保留（即使已归档）
    const retainedRes = projectTargetCandidates(items, {
        selectedId: "item-290", // 290 是已归档项
        requiredUnitKind: "minutes",
        limit: 10,
    });
    assert.equal(retainedRes[0].item.id, "item-290");
    assert.equal(retainedRes[0].eligibility, "retained_binding");
    assert.equal(retainedRes[0].isSelectable, true);
}

// 2. 单位兼容性过滤
{
    const items = [
        { id: "read", name: "读书", unit: "分钟" },
        { id: "run", name: "跑步", unit: "公里" },
        { id: "pushup", name: "俯卧撑", unit: "次" },
    ];

    const minCandidates = projectTargetCandidates(items, { requiredUnitKind: "minutes" });
    const eligibleMin = minCandidates.filter((c) => c.isSelectable);
    assert.equal(eligibleMin.length, 1);
    assert.equal(eligibleMin[0].item.id, "read");
}

// 3. 写前动态复核 (auditTargetBeforeSave)
{
    const latestItems = [
        { id: "read", name: "读书", unit: "分钟", archived: false },
        { id: "walk", name: "散步", unit: "页", archived: false }, // 被改成了“页”
        { id: "sleep", name: "早睡", unit: "分钟", archived: true }, // 被归档
    ];

    // 正常通过
    const audit1 = auditTargetBeforeSave("read", "minutes", latestItems);
    assert.equal(audit1.isSafeToBind, true);

    // 单位被别窗篡改
    const audit2 = auditTargetBeforeSave("walk", "minutes", latestItems);
    assert.equal(audit2.isSafeToBind, false);
    assert.equal(audit2.rejectionReason, "unit_incompatible");

    // 项目在别窗被归档
    const audit3 = auditTargetBeforeSave("sleep", "minutes", latestItems);
    assert.equal(audit3.isSafeToBind, false);
    assert.equal(audit3.rejectionReason, "item_archived");

    // 项目在别窗被删除
    const audit4 = auditTargetBeforeSave("missing", "minutes", latestItems);
    assert.equal(audit4.isSafeToBind, false);
    assert.equal(audit4.rejectionReason, "item_missing");
}

console.log("target-candidate-selector: all big catalog, unit filtering and pre-save audit checks passed successfully.");
