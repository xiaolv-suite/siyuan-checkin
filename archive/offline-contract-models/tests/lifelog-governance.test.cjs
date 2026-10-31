const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/* T-1677 专项守门测试：
   QingTrail / LifeLog 时间轴与类型聚合
   1. 段落修订指纹计算与幂等变异感知；
   2. 跨语言类型别名解析与用户自定义重命名；
   3. 按活动类型求和与时长占比切片；
   4. 时间轴、类型聚合与日历徽标价值/认知负荷量化评估。 */

const projectRoot = path.resolve(__dirname, "..");
const featureTs = fs.readFileSync(path.join(projectRoot, "src", "features", "lifelog-governance.ts"), "utf8");
const compiled = ts.transpileModule(featureTs, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;
const moduleUnderTest = {exports: {}};
new Function("require", "module", "exports", compiled)(() => {}, moduleUnderTest, moduleUnderTest.exports);

const {
    computeParagraphFingerprint,
    resolveTypeAlias,
    summarizeLifelogByType,
    evaluateLifelogPresentationAffordance,
} = moduleUnderTest.exports;

console.log("Starting lifelog-governance tests...");

// 1. 段落修订指纹计算断言
{
    const fp1 = computeParagraphFingerprint("12:00 工作：写日报");
    const fp2 = computeParagraphFingerprint("12:00 工作：写日报");
    const fp3 = computeParagraphFingerprint("12:00 工作：修改周报");
    assert.equal(fp1, fp2, "identical content produces identical fingerprint");
    assert.notEqual(fp1, fp3, "modified content produces different fingerprint");
    assert.equal(computeParagraphFingerprint(""), "0");
}

// 2. 跨语言别名解析断言
{
    assert.equal(resolveTypeAlias("work"), "工作");
    assert.equal(resolveTypeAlias("Working"), "工作");
    assert.equal(resolveTypeAlias("reading"), "阅读");
    assert.equal(resolveTypeAlias("exercise"), "运动");
    assert.equal(resolveTypeAlias("meditation"), "冥想");
    assert.equal(resolveTypeAlias("自定义分类"), "自定义分类");

    // 自定义别名覆盖
    const custom = {"code": "编程开发", "gym": "器械训练"};
    assert.equal(resolveTypeAlias("code", custom), "编程开发");
    assert.equal(resolveTypeAlias("gym", custom), "器械训练");
}

// 3. 按类型聚合统计断言
{
    const sampleEntries = [
        {occurredAt: "2026-10-28T09:00:00.000Z", time: "09:00", type: "work", text: "晨会", minutes: 30, itemName: "工作", colorIndex: 0},
        {occurredAt: "2026-10-28T09:30:00.000Z", time: "09:30", type: "工作", text: "需求分析", minutes: 90, itemName: "工作", colorIndex: 0},
        {occurredAt: "2026-10-28T14:00:00.000Z", time: "14:00", type: "reading", text: "阅读专业书", minutes: 40, itemName: "阅读", colorIndex: 1},
        {occurredAt: "2026-10-28T18:00:00.000Z", time: "18:00", type: "运动", text: "慢跑", minutes: 40, itemName: "运动", colorIndex: 2},
    ];

    const aggregates = summarizeLifelogByType(sampleEntries);
    assert.equal(aggregates.length, 3); // "work" 与 "工作" 自动合流

    // 工作: 30 + 90 = 120 分钟 (60.0%)
    assert.equal(aggregates[0].type, "工作");
    assert.equal(aggregates[0].totalMinutes, 120);
    assert.equal(aggregates[0].count, 2);
    assert.equal(aggregates[0].percentage, 60.0);

    // 阅读与运动各自 40 分钟 (20.0%)
    assert.equal(aggregates[1].totalMinutes, 40);
    assert.equal(aggregates[1].percentage, 20.0);
    assert.equal(aggregates[2].totalMinutes, 40);
    assert.equal(aggregates[2].percentage, 20.0);
}

// 4. 表现形式价值与认知负荷量化评估
{
    const timeline = evaluateLifelogPresentationAffordance("timeline");
    assert.equal(timeline.valueLevel, "high");
    assert.equal(timeline.cognitiveLoad, "low");
    assert.equal(timeline.recommendation, "adopted");

    const summary = evaluateLifelogPresentationAffordance("type-summary");
    assert.equal(summary.valueLevel, "high");
    assert.equal(summary.cognitiveLoad, "medium");
    assert.equal(summary.recommendation, "adopted");

    const badges = evaluateLifelogPresentationAffordance("calendar-badges");
    assert.equal(badges.valueLevel, "low");
    assert.equal(badges.cognitiveLoad, "high");
    assert.equal(badges.recommendation, "suppressed");
}

console.log("lifelog-governance: all fingerprint, aliasing, aggregation and affordance checks passed successfully.");
