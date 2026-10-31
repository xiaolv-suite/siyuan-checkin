/* T-1733 专项契约守门测试：
   设置字段推荐适用性总表与治理规则（D-645）。
   1. 覆盖四大主分区（appearance_nav, today_reminders, integrations, data_recovery）与各子卡；
   2. 严格门禁：C 动作类与 D 只读类 100% 标记为 not_applicable 且坚决不可推荐；
   3. 凭据与文档换绑（weread_api_key, journal_notebook_id 等）100% 标记为 manual_required；
   4. 通用默认与证据驱动推荐逻辑纯净、确定；
   5. 高风险字段强制要求 section_batch 或 danger_modal 确认粒度。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

// 使用 ts 编译后的 js 或直接加载模块（通过 ts-node 或直接验证导出的纯数据与逻辑）
// 这里通过 require 编译产物或临时沙箱加载
const ts = require("typescript");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "src", "features", "settings-recommendation-governance.ts");
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
    SETTINGS_RECOMMENDATION_REGISTRY,
    evaluateFieldRecommendationEligibility,
    deriveEvidenceBasedRecommendations,
} = mod;

console.log("Starting settings-recommendation-governance tests...");

// 1. 分区完整性与字段覆盖
{
    assert.ok(Array.isArray(SETTINGS_RECOMMENDATION_REGISTRY), "registry must be an array");
    assert.ok(SETTINGS_RECOMMENDATION_REGISTRY.length >= 20, "registry must cover at least 20 core fields");

    const sections = new Set(SETTINGS_RECOMMENDATION_REGISTRY.map((f) => f.section));
    assert.ok(sections.has("appearance_nav"), "covers appearance_nav");
    assert.ok(sections.has("today_reminders"), "covers today_reminders");
    assert.ok(sections.has("integrations"), "covers integrations");
    assert.ok(sections.has("data_recovery"), "covers data_recovery");
}

// 2. 核心红线门禁：动作类 (C) 与 只读类 (D) 坚决不可推荐
{
    const forbiddenSemantics = SETTINGS_RECOMMENDATION_REGISTRY.filter(
        (f) => f.semantics === "C_action" || f.semantics === "D_readonly"
    );
    assert.ok(forbiddenSemantics.length >= 6, "must have registered action and readonly fields");

    for (const field of forbiddenSemantics) {
        assert.equal(
            field.applicability,
            "not_applicable",
            `Field ${field.key} with semantics ${field.semantics} must be not_applicable`
        );
        const decision = evaluateFieldRecommendationEligibility(field, "some_value");
        assert.equal(decision.eligible, false, `Field ${field.key} must NOT be eligible for recommendation`);
        assert.equal(decision.reason, "action_or_readonly_forbidden_in_recommendation");
    }
}

// 3. 凭据与文档高危字段强制人工选择 (manual_required)
{
    const manualFields = ["weread_api_key", "journal_notebook_id", "journal_target_doc", "avatar"];
    for (const key of manualFields) {
        const field = SETTINGS_RECOMMENDATION_REGISTRY.find((f) => f.key === key);
        assert.ok(field, `Field ${key} must exist in registry`);
        assert.equal(
            field.applicability,
            "manual_required",
            `Field ${key} must be classified as manual_required`
        );
        const decision = evaluateFieldRecommendationEligibility(field, "auto_val");
        assert.equal(decision.eligible, false, `Field ${key} must not be eligible for automatic recommendation`);
        assert.equal(decision.reason, "field_requires_explicit_manual_selection");
    }
}

// 4. 通用默认与空值保护
{
    const themeField = SETTINGS_RECOMMENDATION_REGISTRY.find((f) => f.key === "theme");
    assert.ok(themeField);
    assert.equal(themeField.applicability, "universal_default");

    // 传入有效值：合格
    const validDecision = evaluateFieldRecommendationEligibility(themeField, "dark");
    assert.equal(validDecision.eligible, true);
    assert.equal(validDecision.reason, "eligible_for_recommendation");

    // 传入 null/undefined：拦截
    const emptyDecision = evaluateFieldRecommendationEligibility(themeField, null);
    assert.equal(emptyDecision.eligible, false);
    assert.equal(emptyDecision.reason, "proposed_value_must_not_be_empty");
}

// 5. 本地证据推荐纯函数验证
{
    // 峰值打卡时间 8:00
    const recs1 = deriveEvidenceBasedRecommendations({
        peakCheckinHour: 8,
        hasDockTomatoAvailable: true,
        totalHabitCount: 12,
    });
    const slotsRec = recs1.find((r) => r.key === "reminder_slots");
    assert.ok(slotsRec, "should recommend reminder slots based on peak hour");
    assert.deepEqual(slotsRec.proposedValue, ["08:00", "21:00"]);

    const focusRec = recs1.find((r) => r.key === "focus_provider");
    assert.ok(focusRec);
    assert.equal(focusRec.proposedValue, "docktomato");

    const groupRec = recs1.find((r) => r.key === "group_mode");
    assert.ok(groupRec);
    assert.equal(groupRec.proposedValue, "schedule");

    // 无 Dock Tomato 且项目少
    const recs2 = deriveEvidenceBasedRecommendations({
        peakCheckinHour: 20,
        hasDockTomatoAvailable: false,
        totalHabitCount: 3,
    });
    const focusRec2 = recs2.find((r) => r.key === "focus_provider");
    assert.ok(focusRec2);
    assert.equal(focusRec2.proposedValue, "builtin");

    const slotsRec2 = recs2.find((r) => r.key === "reminder_slots");
    assert.ok(slotsRec2);
    assert.deepEqual(slotsRec2.proposedValue, ["09:00", "20:00"]);
}

// 6. 风险与确认粒度一致性
{
    const highRiskFields = SETTINGS_RECOMMENDATION_REGISTRY.filter((f) => f.risk === "high");
    assert.ok(highRiskFields.length > 0);
    for (const field of highRiskFields) {
        assert.ok(
            field.confirmationGranularity === "section_batch" ||
                field.confirmationGranularity === "danger_modal",
            `High risk field ${field.key} must have strict confirmation granularity`
        );
    }
}

console.log("settings-recommendation-governance: all registry, applicability and safety checks passed successfully.");
