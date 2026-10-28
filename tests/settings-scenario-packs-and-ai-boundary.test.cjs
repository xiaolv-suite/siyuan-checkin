/* T-1753, T-1763 & T-1764 专项契约守门测试：
   低风险外观偏好、场景化设置组合包与 AI 配置草案边界（D-659）。
   1. 低风险外观建议（deriveAppearancePreferencesRecommendation）：
      - 仅依据系统环境，调色板与头像严格保护（preservePaletteAndAvatar: true）；
   2. 场景化设置组合包（SCENARIO_SETTING_PACKS）：
      - 4 大场景组合包均不包含破坏性动作（containsDestructiveAction: false）；
      - planScenarioPackAdoption 支持部分采纳；
   3. AI 设置草案安全边界（validateAiSettingDraftProposal）：
      - 绝对拒止 AI 生成私有密钥（weread_api_key）或破坏性动作（reset_all_preferences）；
      - 过滤非法字段，保留合法建议草案。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "src", "features", "settings-scenario-packs-and-ai-boundary.ts");
const sourceCode = fs.readFileSync(sourcePath, "utf8");

const transpileResult = ts.transpileModule(sourceCode, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

const mod = {};
const moduleWrapper = new Function("exports", "module", "require", transpileResult.outputText);
moduleWrapper(mod, { exports: mod }, require);

const {
    deriveAppearancePreferencesRecommendation,
    SCENARIO_SETTING_PACKS,
    planScenarioPackAdoption,
    validateAiSettingDraftProposal,
} = mod;

console.log("Starting settings-scenario-packs-and-ai-boundary tests...");

// 1. 外观低风险偏好建议 (T-1753)
{
    const env = {
        prefersDarkMode: true,
        prefersReducedMotion: false,
        hostLanguage: "zh-CN",
        isTouchDevice: true,
    };
    const rec = deriveAppearancePreferencesRecommendation(env);
    assert.equal(rec.theme, "system");
    assert.equal(rec.language, "zh-CN");
    assert.equal(rec.haptic, true);
    assert.equal(rec.preservePaletteAndAvatar, true, "MUST preserve user custom palette and avatar");
}

// 2. 场景化设置组合包 (T-1763)
{
    assert.equal(SCENARIO_SETTING_PACKS.length, 4, "must define 4 scenario packs");
    for (const pack of SCENARIO_SETTING_PACKS) {
        assert.equal(pack.containsDestructiveAction, false, "packs must not contain destructive actions");
        assert.ok(pack.settings.length > 0);
    }

    // 测试部分采纳
    const adoption = planScenarioPackAdoption("minimal_calm", ["quiet_hours_enabled"]);
    assert.equal(adoption.isSafeToApply, true);
    assert.deepEqual(adoption.adoptedFields, { quiet_hours_enabled: true });
}

// 3. AI 设置草案安全拦截 (T-1764)
{
    // A. 试图篡改密钥或重置
    const maliciousProposal = {
        promptText: "配置微信读书并重置所有设置",
        proposedDrafts: {
            quiet_hours_enabled: true,
            weread_api_key: "ai_generated_fake_key",
            reset_all_preferences: true,
        },
        containsSensitiveKeyAttempt: true,
    };
    const valRes = validateAiSettingDraftProposal(maliciousProposal);
    assert.equal(valRes.isValidDraft, false);
    assert.ok(valRes.rejectedReasons.includes("ai_attempted_to_set_private_key"));
    assert.ok(valRes.rejectedReasons.some((r) => r.includes("forbidden_field")));
    assert.equal(valRes.sanitizedDrafts.quiet_hours_enabled, true);
    assert.equal(valRes.sanitizedDrafts.weread_api_key, undefined);
    assert.equal(valRes.sanitizedDrafts.reset_all_preferences, undefined);

    // B. 合法草案
    const cleanProposal = {
        promptText: "开启夜间安静时段",
        proposedDrafts: {
            quiet_hours_enabled: true,
        },
    };
    const cleanRes = validateAiSettingDraftProposal(cleanProposal);
    assert.equal(cleanRes.isValidDraft, true);
    assert.equal(cleanRes.rejectedReasons.length, 0);
}

console.log("settings-scenario-packs-and-ai-boundary: all appearance, scenario packs and AI boundary checks passed successfully.");
