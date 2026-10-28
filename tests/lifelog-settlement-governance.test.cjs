/* T-1614 专项契约守门测试：
   LifeLog 多项目映射审核、容量边界与源时刻解耦（D-661）。
   1. 映射审核与状态机（auditYeguifMappingCollection）：
      - 重复活动名拦截（duplicate_source）；
      - 缺失目标拦截（target_missing）；
      - 归档目标拦截（target_archived）；
      - 非分钟单位拦截（unit_incompatible）；
      - 正常项标记（valid）；
      - 容量保护（上限 200 条，超限透明标记，禁止静默截断）；
   2. 双轨时刻解耦（resolveLifelogTimelineDisplayMoment）：
      - 优先消费 sourceStartMinute（如 08:30），杜绝被轮询时刻（12:05）污染；
      - 无源时刻时平滑回落至摄取时刻。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "src", "features", "lifelog-settlement-governance.ts");
const sourceCode = fs.readFileSync(sourcePath, "utf8");

const transpileResult = ts.transpileModule(sourceCode, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

const mod = {};
const moduleWrapper = new Function("exports", "module", "require", transpileResult.outputText);
moduleWrapper(mod, { exports: mod }, require);

const {
    YEGUIF_MAPPING_CAPACITY_LIMIT,
    auditYeguifMappingCollection,
    resolveLifelogTimelineDisplayMoment,
} = mod;

console.log("Starting lifelog-settlement-governance tests...");

const availableItems = [
    { id: "item-run", name: "户外跑步", unit: "分钟", archived: false },
    { id: "item-stretch", name: "日常拉伸", unit: "分钟", archived: false },
    { id: "item-read-pages", name: "读书页数", unit: "页", archived: false },
    { id: "item-archived-gym", name: "健身房力量", unit: "分钟", archived: true },
];

// 1. 映射集合状态机与容量审计 (T-1614)
{
    assert.equal(YEGUIF_MAPPING_CAPACITY_LIMIT, 200);

    const rawRules = [
        { sourceActivity: "跑步", targetItemId: "item-run" }, // valid
        { sourceActivity: "晨跑", targetItemId: "item-run" }, // valid (多对一映射允许！)
        { sourceActivity: "瑜伽", targetItemId: "item-stretch" }, // valid
        { sourceActivity: "瑜伽", targetItemId: "item-stretch" }, // duplicate_source (同一源活动配置两次)
        { sourceActivity: "看书", targetItemId: "item-read-pages" }, // unit_incompatible (单位是“页”)
        { sourceActivity: "举铁", targetItemId: "item-archived-gym" }, // target_archived (已归档)
        { sourceActivity: "游泳", targetItemId: "non-existent-item" }, // target_missing (不存在)
    ];

    const audit = auditYeguifMappingCollection(rawRules, availableItems);
    assert.equal(audit.totalCount, 7);
    assert.equal(audit.validCount, 2); // "跑步" 和 "晨跑" 有效
    assert.equal(audit.hasDuplicates, true);
    assert.equal(audit.isOverCapacity, false);

    const dupRules = audit.validatedRules.filter((r) => r.code === "duplicate_source");
    assert.equal(dupRules.length, 2);

    const unitRules = audit.validatedRules.filter((r) => r.code === "unit_incompatible");
    assert.equal(unitRules.length, 1);

    const archivedRules = audit.validatedRules.filter((r) => r.code === "target_archived");
    assert.equal(archivedRules.length, 1);

    const missingRules = audit.validatedRules.filter((r) => r.code === "target_missing");
    assert.equal(missingRules.length, 1);
}

// 2. 超限容量透明保护（杜绝静默截断 50 条问题）
{
    const bigRules = [];
    for (let i = 1; i <= 205; i++) {
        bigRules.push({ sourceActivity: `活动-${i}`, targetItemId: "item-run" });
    }

    const auditBig = auditYeguifMappingCollection(bigRules, availableItems);
    assert.equal(auditBig.totalCount, 205);
    assert.equal(auditBig.isOverCapacity, true, "must visibly flag over capacity (>200)");
}

// 3. 源时间 vs 轮询时间双轨解耦
{
    // A. 具有源开始时刻 (如 08:30)，虽然 12:05 才轮询拉取
    const entry1 = {
        externalRef: "yeguif:block-1",
        targetItemId: "item-run",
        durationMinutes: 30,
        sourceStartMinute: "08:30",
        ingestedAt: "2026-10-29T12:05:00.000Z",
    };
    const moment1 = resolveLifelogTimelineDisplayMoment(entry1, "2026-10-29");
    assert.equal(moment1.displayTime, "08:30");
    assert.equal(moment1.isoMoment, "2026-10-29T08:30:00.000Z");

    // B. 无源时刻，回落到摄取时刻
    const entry2 = {
        externalRef: "yeguif:block-2",
        targetItemId: "item-stretch",
        durationMinutes: 15,
        sourceStartMinute: "",
        ingestedAt: "2026-10-29T12:05:00.000Z",
    };
    const moment2 = resolveLifelogTimelineDisplayMoment(entry2, "2026-10-29");
    assert.equal(moment2.displayTime, "12:05");
    assert.equal(moment2.isoMoment, "2026-10-29T12:05:00.000Z");
}

console.log("lifelog-settlement-governance: all mapping validations, capacity protection and time decoupling checks passed successfully.");
