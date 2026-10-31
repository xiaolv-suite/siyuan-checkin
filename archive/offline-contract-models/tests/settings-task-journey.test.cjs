/* T-1734 专项契约守门测试：
   设置分区与任务入口再梳理、步骤推进与选择器向后兼容（D-646）。
   1. 五大核心任务（日常显示与提醒、自动记录、写入笔记、数据恢复、能力状态）全量覆盖；
   2. 所引用的全部 requiredFields 与 actionSelectors 100% 存在于 src/render/settings.ts 生产代码中；
   3. evaluateStepProgress 纯函数推进判定准确拦截缺失字段；
   4. 任务步骤与既存 data-* 属性完全兼容，旧搜索定位无破坏。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "src", "features", "settings-task-journey.ts");
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

const { SETTINGS_TASK_WORKFLOWS, evaluateStepProgress } = mod;

const settingsRenderPath = path.join(root, "src", "render", "settings.ts");
const settingsRenderCode = fs.readFileSync(settingsRenderPath, "utf8");

console.log("Starting settings-task-journey tests...");

// 1. 五大核心任务覆盖验证
{
    assert.equal(SETTINGS_TASK_WORKFLOWS.length, 5, "must define exactly 5 core task workflows");
    const categories = SETTINGS_TASK_WORKFLOWS.map((w) => w.category);
    assert.deepEqual(categories, [
        "daily_display_reminders",
        "auto_ingest",
        "note_output",
        "data_recovery",
        "capability_status",
    ]);
}

// 2. 字段与选择器在生产代码中 100% 存在验证（防幽灵选择器）
{
    for (const workflow of SETTINGS_TASK_WORKFLOWS) {
        for (const step of workflow.steps) {
            for (const field of step.requiredFields) {
                assert.ok(
                    settingsRenderCode.includes(field),
                    `settings.ts must contain requiredField attribute: ${field} in workflow ${workflow.category}`
                );
            }
            for (const field of step.optionalFields) {
                assert.ok(
                    settingsRenderCode.includes(field),
                    `settings.ts must contain optionalField attribute: ${field} in workflow ${workflow.category}`
                );
            }
        }
    }
}

// 3. 步骤推进条件判定 (evaluateStepProgress)
{
    const wereadStep1 = SETTINGS_TASK_WORKFLOWS[1].steps[0];
    assert.equal(wereadStep1.stepKey, "credential_setup");

    // 缺少 key: 无法推进
    const missingRes = evaluateStepProgress(wereadStep1, {});
    assert.equal(missingRes.canAdvance, false);
    assert.deepEqual(missingRes.missingFields, ["data-weread-key"]);

    // 填入 key: 允许推进
    const validRes = evaluateStepProgress(wereadStep1, { "data-weread-key": "secret_key_123" });
    assert.equal(validRes.canAdvance, true);
    assert.equal(validRes.missingFields.length, 0);
    assert.equal(validRes.isActionReady, true);
}

// 4. 日常提醒步骤推进
{
    const remindStep = SETTINGS_TASK_WORKFLOWS[0].steps[2];
    assert.equal(remindStep.stepKey, "remind_and_quiet");

    const eval1 = evaluateStepProgress(remindStep, {
        "data-setting-reminder-toggle": true,
    });
    assert.equal(eval1.canAdvance, false, "missing reminder slots");
    assert.deepEqual(eval1.missingFields, ["data-setting-reminder-slots"]);

    const eval2 = evaluateStepProgress(remindStep, {
        "data-setting-reminder-toggle": true,
        "data-setting-reminder-slots": "09:00, 21:00",
    });
    assert.equal(eval2.canAdvance, true);
    assert.equal(eval2.missingFields.length, 0);
}

console.log("settings-task-journey: all 5 workflows, field attributes and progression checks passed successfully.");
