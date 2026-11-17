/* T-1542, T-1543 & T-1544 专项契约守门测试：
   LifeLog 类型筛选聚合、日历徽标投影与段落修订检测（D-662）。
   1. 类型筛选与区间聚合（filterAndAggregateLifelogEntries）：
      - 别名归一（"work" 归一至 "工作"）；
      - 满足类型、时长下限与日期范围过滤；
      - 正确计算百分比与时长占比；
   2. 日历徽标与视觉降级（projectCalendarLifelogMetrics）：
      - 按日归集条数与时长；
      - 当日习惯完成率高 (>0.8) 时自动降级为 dot_indicator 防视觉冲突；
   3. 段落修订与事实不可变（evaluateParagraphRevisionSettlement）：
      - 内容未变 -> retain_existing；
      - 内容变动 -> tombstone_and_append 并强制 requiresTombstone: true。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const root = path.join(__dirname, "..");

function loadModule(relativePath) {
    const fullPath = path.join(root, relativePath);
    const code = fs.readFileSync(fullPath, "utf8");
    const transpileResult = ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const mod = {};
    const fn = new Function("exports", "module", "require", transpileResult.outputText);
    fn(mod, { exports: mod }, (p) => {
        if (p.startsWith("./")) {
            return loadModule(path.join(path.dirname(relativePath), p + ".ts"));
        }
        return require(p);
    });
    return mod;
}

const {
    filterAndAggregateLifelogEntries,
    projectCalendarLifelogMetrics,
    evaluateParagraphRevisionSettlement,
} = loadModule("src/features/lifelog-calendar-and-revision-projection.ts");

console.log("Starting lifelog-calendar-and-revision-projection tests...");

// 1. 类型筛选与区间聚合 (T-1542)
{
    const entries = [
        { time: "2026-10-28 09:00", minutes: 60, type: "work", note: "编程" },
        { time: "2026-10-28 14:00", minutes: 30, type: "工作", note: "开会" },
        { time: "2026-10-28 20:00", minutes: 30, type: "reading", note: "看书" },
        { time: "2026-10-29 08:00", minutes: 10, type: "exercise", note: "热身" },
    ];

    // 筛选 "工作" 类型（work 和 工作 均归一至 工作）
    const res = filterAndAggregateLifelogEntries(entries, {
        selectedTypes: ["工作"],
        minMinutes: 20,
    });

    assert.equal(res.filteredEntries.length, 2);
    assert.equal(res.totalMinutes, 90);
    assert.equal(res.typeBreakdown.length, 1);
    assert.equal(res.typeBreakdown[0].type, "工作");
    assert.equal(res.typeBreakdown[0].totalMinutes, 90);
    assert.equal(res.typeBreakdown[0].percentage, 100);
}

// 2. 日历徽标与视觉冗余防线 (T-1543)
{
    const entries = [
        { time: "2026-10-28 09:00", minutes: 60, type: "work", note: "" },
        { time: "2026-10-28 14:00", minutes: 30, type: "work", note: "" },
        { time: "2026-10-29 09:00", minutes: 45, type: "reading", note: "" },
    ];

    // 2026-10-28 习惯完成率 90% (高), 2026-10-29 完成率 50% (中)
    const metrics = projectCalendarLifelogMetrics(entries, {
        "2026-10-28": 0.9,
        "2026-10-29": 0.5,
    });

    assert.equal(metrics.length, 2);

    const day28 = metrics.find((m) => m.localDate === "2026-10-28");
    assert.ok(day28);
    assert.equal(day28.totalMinutes, 90);
    assert.equal(day28.entryCount, 2);
    assert.equal(day28.recommendedBadgeMode, "dot_indicator", "high habit completion downscales badge to dot");

    const day29 = metrics.find((m) => m.localDate === "2026-10-29");
    assert.ok(day29);
    assert.equal(day29.recommendedBadgeMode, "badge_text");
}

// 3. 段落修订与事实不可变 (T-1544)
{
    const originalText = "完成需求设计文档，耗时 60 分钟";
    const govMod = loadModule("src/features/lifelog-governance.ts");
    const originalHash = govMod.computeParagraphFingerprint(originalText);

    // 未修改
    const resSame = evaluateParagraphRevisionSettlement(originalHash, originalText);
    assert.equal(resSame.action, "retain_existing");
    assert.equal(resSame.hasContentChanged, false);
    assert.equal(resSame.requiresTombstone, false);

    // 文本被用户修改（如追加了备注）
    const modifiedText = "完成需求设计文档，耗时 60 分钟，并同步评审";
    const resModified = evaluateParagraphRevisionSettlement(originalHash, modifiedText);
    assert.equal(resModified.action, "tombstone_and_append");
    assert.equal(resModified.hasContentChanged, true);
    assert.equal(resModified.requiresTombstone, true);
}

console.log("lifelog-calendar-and-revision-projection: all aggregation, badge redundancy and revision tombstone checks passed successfully.");
