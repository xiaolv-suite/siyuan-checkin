/* T-1755 & T-1756 专项契约守门测试：
   数据恢复安全边界与对外能力纯度模型（D-651）。
   1. 数据操作安全边界（evaluateDataOperationSafety）：
      - 仅安全指导类（导出、建快照、查快照）允许推荐；
      - 破坏性操作（导入覆盖、快照回滚、清空审计、全部重置）100% 严禁推荐且强制二次弹窗；
      - 导入合并强制要求冲突人工审阅；
   2. 对外能力纯度（evaluateCapabilityPurity）：
      - Task Horizon 严守 waiting 状态，禁止伪装已连接；
      - API v5、快捷键、版本等只读契约严禁提供“采用推荐”按钮；
      - 仅内置/外部专注切换项允许推荐；
   3. 备份覆盖透明度（explainBackupCoverage）：
      - 单主档明确标注不含事项桶与提醒动作桶；
      - 多桶 Envelope 完整包含全量数据。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "src", "features", "data-and-capability-recommendation-boundary.ts");
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

const {
    evaluateDataOperationSafety,
    evaluateCapabilityPurity,
    explainBackupCoverage,
} = mod;

console.log("Starting data-and-capability-recommendation-boundary tests...");

// 1. 数据操作安全边界验证 (T-1755)
{
    // A. 安全引导项
    const safeOps = ["export_envelope", "create_snapshot", "inspect_snapshots"];
    for (const op of safeOps) {
        const res = evaluateDataOperationSafety(op);
        assert.equal(res.canBeRecommended, true, `${op} should be recommended as safe guidance`);
        assert.equal(res.safetyLevel, "safe_guidance");
    }

    // B. 破坏性操作坚决禁止自动推荐
    const destructiveOps = [
        "import_overwrite",
        "restore_snapshot",
        "clear_audit_history",
        "reset_all_preferences",
    ];
    for (const op of destructiveOps) {
        const res = evaluateDataOperationSafety(op);
        assert.equal(res.canBeRecommended, false, `${op} must NOT be recommended`);
        assert.equal(res.safetyLevel, "destructive_forbidden_in_rec");
        assert.equal(res.requiresConfirmationModal, true, `${op} must require confirmation modal`);
    }

    // C. 导入合并需要审阅
    const mergeRes = evaluateDataOperationSafety("import_merge");
    assert.equal(mergeRes.canBeRecommended, false);
    assert.equal(mergeRes.safetyLevel, "manual_review_required");
    assert.equal(mergeRes.requiresConfirmationModal, true);
}

// 2. 对外能力纯度与诚实状态验证 (T-1756)
{
    // A. Task Horizon 恒为 waiting
    const thRes = evaluateCapabilityPurity("task_horizon_contract");
    assert.equal(thRes.isConfigurablePreference, false);
    assert.equal(thRes.allowRecommendationButton, false);
    assert.equal(thRes.honestDisplayState, "waiting");

    // B. API v5 为 provided 状态，不可推荐
    const apiRes = evaluateCapabilityPurity("api_v5_provided");
    assert.equal(apiRes.isConfigurablePreference, false);
    assert.equal(apiRes.allowRecommendationButton, false);
    assert.equal(apiRes.honestDisplayState, "provided");

    // C. 快捷键与版本信息
    const kbdRes = evaluateCapabilityPurity("shortcuts_guide");
    assert.equal(kbdRes.allowRecommendationButton, false);
    assert.equal(kbdRes.honestDisplayState, "system_doc");

    // D. 专注切换为唯一内部可操作偏好
    const timerRes = evaluateCapabilityPurity("focus_timer_toggle");
    assert.equal(timerRes.isConfigurablePreference, true);
    assert.equal(timerRes.allowRecommendationButton, true);
    assert.equal(timerRes.honestDisplayState, "toggleable");
}

// 3. 备份覆盖透明度验证 (T-1755)
{
    const singleStore = explainBackupCoverage("single_store_json");
    assert.equal(singleStore.includesMainStore, true);
    assert.equal(singleStore.includesOccasionStore, false, "single store does not include occasions");
    assert.equal(singleStore.includesReminderActions, false, "single store does not include reminders");

    const envelope = explainBackupCoverage("backup_envelope");
    assert.equal(envelope.includesMainStore, true);
    assert.equal(envelope.includesOccasionStore, true);
    assert.equal(envelope.includesReminderActions, true);
    assert.equal(envelope.includesViewPreferences, true);
}

console.log("data-and-capability-recommendation-boundary: all safety levels, purity contracts and coverage explanations passed successfully.");
