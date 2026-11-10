/* T-1696 专项测试：编辑已有项目“问 AI 调整”差异提取、同名冲突与历史不变门禁 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-existing-adj-"));

const transpile = (sourcePath, outName) => {
    const text = fs.readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(text, {compilerOptions}).outputText;
    fs.writeFileSync(path.join(dir, outName), transpiled);
    return require(path.join(dir, outName));
};

transpile(path.join(root, "src", "types.ts"), "types.js");
transpile(path.join(root, "src", "features", "schedule-validate.ts"), "schedule-validate.js");
transpile(path.join(root, "src", "features", "project-draft.ts"), "project-draft.js");
transpile(path.join(root, "src", "features", "name-inference.ts"), "name-inference.js");
const nld = transpile(path.join(root, "src", "features", "natural-language-draft.ts"), "natural-language-draft.js");

console.log("Starting existing-item-ai-adjustment tests...");

// 基础 Mock 习惯项
const baseItem = {
    id: "item-runner",
    name: "晨跑",
    icon: "🏃",
    kind: "quantity",
    target: 3,
    unit: "公里",
    schedule: {type: "daily"},
    direction: "atLeast",
    group: "健康",
    priority: "high",
    timeSlot: "morning",
    createdAt: "2026-09-01T00:00:00.000Z",
    createdDate: "2026-09-01",
    revisions: [],
    archivePeriods: [],
    archived: false,
};

// 1. 目标与单位数值自然语言调整提取断言 (Target & Unit Diff)
{
    const plan = nld.evaluateExistingItemAiAdjustment(baseItem, "坚持得不错，把目标提高到 5 公里", {
        effectiveDate: "2026-10-30",
    });

    assert.equal(plan.hasChanges, true);
    assert.equal(plan.hasNameConflict, false);
    assert.equal(plan.effectiveDate, "2026-10-30");
    assert.equal(plan.historyUnchanged, true, "自然语言调整必须严格声明历史事实不变");
    assert.equal(plan.adjustedFields.length, 1);

    const targetDiff = plan.adjustedFields[0];
    assert.equal(targetDiff.field, "target");
    assert.equal(targetDiff.before, 3);
    assert.equal(targetDiff.after, 5);
    assert.ok(targetDiff.impactSummary.includes("目标由 3 调整为 5"));
    assert.ok(plan.previewDiffText.includes("目标由 3 调整为 5"));
}

// 2. 排期变更与历史分母隔离声明断言 (Schedule Revision)
{
    const plan = nld.evaluateExistingItemAiAdjustment(baseItem, "工作太忙，改为工作日打卡", {
        effectiveDate: "2026-10-30",
    });

    assert.equal(plan.hasChanges, true);
    const scheduleDiff = plan.adjustedFields.find((d) => d.field === "schedule");
    assert.ok(scheduleDiff);
    assert.equal(scheduleDiff.before.type, "daily");
    assert.equal(scheduleDiff.after.type, "workdays");
    assert.ok(scheduleDiff.impactSummary.includes("仅影响未来打卡机会，历史分母保持不变"));
}

// 3. 改名提取与同名冲突检测断言 (Name Conflict Protection)
{
    const workspaceItems = [
        {id: "item-runner", name: "晨跑", archived: false},
        {id: "item-gym", name: "健身力量训练", archived: false},
        {id: "item-old", name: "晚间慢跑", archived: true}, // 已归档不冲突
    ];

    // 情况 A: 改名为未归档的已有项目，必须报警
    const conflictPlan = nld.evaluateExistingItemAiAdjustment(baseItem, "改名为「健身力量训练」", {
        existingItems: workspaceItems,
    });
    assert.equal(conflictPlan.hasChanges, true);
    assert.equal(conflictPlan.hasNameConflict, true, "命中未归档同名项目必须报警");
    assert.equal(conflictPlan.conflictingItemName, "健身力量训练");

    // 情况 B: 改名为全新名称或已归档名称，允许
    const safePlan = nld.evaluateExistingItemAiAdjustment(baseItem, "改名为「晚间慢跑」", {
        existingItems: workspaceItems,
    });
    assert.equal(safePlan.hasChanges, true);
    assert.equal(safePlan.hasNameConflict, false, "已归档同名项目不构成活跃冲突");
}

// 4. 负向习惯戒除类切换断言 (Direction Abstinence Switch)
{
    const habitItem = {...baseItem, name: "玩手机", direction: "atLeast", target: 60, unit: "分钟"};
    const plan = nld.evaluateExistingItemAiAdjustment(habitItem, "改为戒除习惯，每天不超过 30 分钟");

    const directionDiff = plan.adjustedFields.find((d) => d.field === "direction");
    assert.ok(directionDiff);
    assert.equal(directionDiff.after, "atMost");
    assert.ok(directionDiff.impactSummary.includes("切换为戒除类习惯"));

    const targetDiff = plan.adjustedFields.find((d) => d.field === "target");
    assert.ok(targetDiff);
    assert.equal(targetDiff.after, 30);
}

// 5. 空输入与无变动防御断言 (Empty & No-op Defense)
{
    const emptyPlan = nld.evaluateExistingItemAiAdjustment(baseItem, "");
    assert.equal(emptyPlan.hasChanges, false);
    assert.equal(emptyPlan.adjustedFields.length, 0);

    const noopPlan = nld.evaluateExistingItemAiAdjustment(baseItem, "今天天气真好，一起加油");
    assert.equal(noopPlan.hasChanges, false);
    assert.equal(noopPlan.adjustedFields.length, 0);
    assert.ok(noopPlan.previewDiffText.includes("未检测到明确的规则变更"));
}

console.log("existing-item-ai-adjustment: all target diff, schedule revision, conflict guard and no-op checks passed.");
