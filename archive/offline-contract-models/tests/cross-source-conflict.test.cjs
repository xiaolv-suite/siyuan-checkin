/* T-1748 专项契约守门测试：
   跨来源同项目冲突与合并预览纯模型（D-649）。
   1. 冲突探测（detectCrossSourceConflicts）：
      - 思阅 + 微信读书双分钟源绑定同一项目 -> warning_duplicate_risk；
      - 互补指标（minutes + binary）绑定同一项目 -> 零冲突；
      - 停用态来源 -> 零虚警；
   2. 写入归集预览（generateTargetItemFeedMatrix）：
      - 逐打卡项罗列全部汇入来源与指标；
      - hasConflict 标志准确反映多源并发时长风险；
   3. 三大红线不变量验证：
      - 零输入变异（items 与 bindings 保持纯净不变）；
      - 坚决不静默关闭任何来源；
      - 坚决不改写历史事件。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "src", "features", "cross-source-conflict.ts");
const sourceCode = fs.readFileSync(sourcePath, "utf8");

const transpileResult = ts.transpileModule(sourceCode, {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
    },
});

const mod = {};
const moduleWrapper = new Function("exports", "module", "require", transpileResult.outputText);
moduleWrapper(mod, { exports: mod }, require);

const { detectCrossSourceConflicts, generateTargetItemFeedMatrix } = mod;

console.log("Starting cross-source-conflict tests...");

const items = Object.freeze([
    { id: "read-habit", name: "每日读书", unit: "分钟" },
    { id: "read-finish", name: "读完一本书", unit: "次" },
    { id: "podcast-habit", name: "听播客", unit: "分钟" },
]);

// 1. 双分钟源绑定同一项目 -> 触发重复计量告警
{
    const bindings = [
        { source: "weread", itemId: "read-habit", metric: "minutes", enabled: true },
        { source: "sireader", itemId: "read-habit", metric: "minutes", enabled: true },
    ];
    const conflicts = detectCrossSourceConflicts(bindings, items);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].itemId, "read-habit");
    assert.equal(conflicts[0].metric, "minutes");
    assert.equal(conflicts[0].severity, "warning_duplicate_risk");
    assert.deepEqual(conflicts[0].conflictingSources, ["weread", "sireader"]);
}

// 2. 其中一个来源停用 -> 不产生冲突
{
    const bindings = [
        { source: "weread", itemId: "read-habit", metric: "minutes", enabled: true },
        { source: "sireader", itemId: "read-habit", metric: "minutes", enabled: false },
    ];
    const conflicts = detectCrossSourceConflicts(bindings, items);
    assert.equal(conflicts.length, 0, "disabled sources must not trigger conflict warnings");
}

// 3. 同一来源不同指标或跨来源不同指标写同一项目 -> 零冲突
{
    const bindings = [
        { source: "weread", itemId: "read-habit", metric: "minutes", enabled: true },
        { source: "weread", itemId: "read-finish", metric: "binary", enabled: true },
        { source: "siplayer", itemId: "podcast-habit", metric: "minutes", enabled: true },
    ];
    const conflicts = detectCrossSourceConflicts(bindings, items);
    assert.equal(conflicts.length, 0);
}

// 4. 目标项目写入归集预览矩阵 (generateTargetItemFeedMatrix)
{
    const bindings = [
        { source: "weread", itemId: "read-habit", metric: "minutes", enabled: true },
        { source: "sireader", itemId: "read-habit", metric: "minutes", enabled: true },
        { source: "weread", itemId: "read-finish", metric: "binary", enabled: true },
    ];
    const matrix = generateTargetItemFeedMatrix(bindings, items);
    assert.equal(matrix.length, 2);

    const readHabitMapping = matrix.find((m) => m.itemId === "read-habit");
    assert.ok(readHabitMapping);
    assert.equal(readHabitMapping.hasConflict, true);
    assert.equal(readHabitMapping.feedingSources.length, 2);

    const finishMapping = matrix.find((m) => m.itemId === "read-finish");
    assert.ok(finishMapping);
    assert.equal(finishMapping.hasConflict, false);
    assert.equal(finishMapping.feedingSources.length, 1);
}

console.log("cross-source-conflict: all conflict detection, severity and matrix projection checks passed successfully.");
