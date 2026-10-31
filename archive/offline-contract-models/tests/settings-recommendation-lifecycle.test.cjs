/* T-1739 & T-1740 专项契约守门测试：
   推荐版本生命周期、过期判定与总览三态（建议/待确认/需修复）分流（D-648）。
   1. 推荐新鲜度与过期判定（evaluateRecommendationStaleness）：
      - 项目删除、归档、单位变更、文档不可达触发过期；
      - 用户手动草稿绝对保护（preserveUserDraft: true）；
      - 用户 opt-out / dismissed 状态保持；
   2. 设置总览三态分类（categorizeSettingsOverviewItems）：
      - 核心红线：未启用的外部来源绝对禁止进入 requires_fix；
      - 写入失败与凭据失效精准进入 requires_fix 且 isBlocking=true；
      - 未保存草稿与重名冲突进入 pending_confirmation；
      - 优化建议进入 suggested；
      - 全部项具备有效 targetSelector。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "src", "features", "settings-recommendation-lifecycle.ts");
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
    RECOMMENDATION_LIFECYCLE_VERSION,
    evaluateRecommendationStaleness,
    categorizeSettingsOverviewItems,
} = mod;

console.log("Starting settings-recommendation-lifecycle tests...");

// 1. 推荐新鲜度与过期检查 (T-1739)
{
    assert.equal(RECOMMENDATION_LIFECYCLE_VERSION, 2);

    const baseSnapshot = {
        recommendationId: "rec-weread-duration",
        targetKey: "weread_duration",
        boundItemId: "item-read-1",
        boundItemUnit: "分钟",
        boundDocId: "doc-journal-1",
        proposedValue: 30,
        generatedAtVersion: 1,
    };

    const healthyEnv = {
        items: [{ id: "item-read-1", name: "读书", unit: "分钟", archived: false }],
        accessibleDocIds: ["doc-journal-1"],
    };

    // A. 正常活跃态
    const resActive = evaluateRecommendationStaleness(baseSnapshot, healthyEnv);
    assert.equal(resActive.status, "active");
    assert.equal(resActive.isStale, false);
    assert.equal(resActive.preserveUserDraft, false);

    // B. 用户手填了草稿 -> preserveUserDraft 必须为 true
    const envWithDraft = { ...healthyEnv, userDraftValue: 45 };
    const resDraft = evaluateRecommendationStaleness(baseSnapshot, envWithDraft);
    assert.equal(resDraft.status, "active");
    assert.equal(resDraft.preserveUserDraft, true);

    // C. 项目被删除 -> stale
    const envItemDeleted = { items: [], accessibleDocIds: ["doc-journal-1"] };
    const resDeleted = evaluateRecommendationStaleness(baseSnapshot, envItemDeleted);
    assert.equal(resDeleted.status, "stale");
    assert.equal(resDeleted.isStale, true);
    assert.equal(resDeleted.reason, "item_deleted");

    // D. 项目被归档 -> stale
    const envItemArchived = {
        items: [{ id: "item-read-1", name: "读书", unit: "分钟", archived: true }],
        accessibleDocIds: ["doc-journal-1"],
    };
    const resArchived = evaluateRecommendationStaleness(baseSnapshot, envItemArchived);
    assert.equal(resArchived.status, "stale");
    assert.equal(resArchived.reason, "item_archived");

    // E. 项目单位修订 -> stale
    const envUnitRevised = {
        items: [{ id: "item-read-1", name: "读书", unit: "页", archived: false }],
        accessibleDocIds: ["doc-journal-1"],
    };
    const resUnit = evaluateRecommendationStaleness(baseSnapshot, envUnitRevised);
    assert.equal(resUnit.status, "stale");
    assert.equal(resUnit.reason, "item_unit_revised");

    // F. 目标文档不可达 -> stale
    const envDocMissing = {
        items: [{ id: "item-read-1", name: "读书", unit: "分钟", archived: false }],
        accessibleDocIds: ["other-doc"],
    };
    const resDoc = evaluateRecommendationStaleness(baseSnapshot, envDocMissing);
    assert.equal(resDoc.status, "stale");
    assert.equal(resDoc.reason, "target_doc_unreachable");

    // G. 用户已标记 opted_out
    const resOptOut = evaluateRecommendationStaleness({ ...baseSnapshot, isOptedOut: true }, healthyEnv);
    assert.equal(resOptOut.status, "opted_out");
    assert.equal(resOptOut.isStale, false);
}

// 2. 设置总览三态分类与红线禁则验证 (T-1740)
{
    // A. 仅有未启用来源：绝对不能产生 requires_fix 项！
    const unconfiguredInput = {
        unconfiguredSources: ["sireader", "siplayer", "health", "weread"],
    };
    const itemsUnconfigured = categorizeSettingsOverviewItems(unconfiguredInput);
    assert.equal(itemsUnconfigured.length, 0, "unconfigured sources must NOT generate requires_fix");

    // B. 真实故障：产生 requires_fix 且 isBlocking: true
    const failureInput = {
        unconfiguredSources: ["sireader"],
        failedWriteSources: [{ source: "weread", error: "network timeout" }],
        invalidKeys: ["weread"],
        unreachableDocs: ["doc-not-found"],
    };
    const itemsFailure = categorizeSettingsOverviewItems(failureInput);
    assert.equal(itemsFailure.length, 3);
    for (const item of itemsFailure) {
        assert.equal(item.category, "requires_fix");
        assert.equal(item.isBlocking, true);
        assert.ok(item.targetSelector, "must provide target selector for location");
    }

    // C. 待确认：草稿与导入冲突
    const pendingInput = {
        pendingDraftCount: 2,
        importConflictsPending: true,
    };
    const itemsPending = categorizeSettingsOverviewItems(pendingInput);
    assert.equal(itemsPending.length, 2);
    for (const item of itemsPending) {
        assert.equal(item.category, "pending_confirmation");
        assert.equal(item.isBlocking, false);
    }

    // D. 建议：可选改善
    const sugInput = {
        optionalSuggestions: [
            { key: "quiet_hours", hintKey: "Enable quiet hours 23:00~07:00", selector: "[data-setting-quiet]" },
        ],
    };
    const itemsSug = categorizeSettingsOverviewItems(sugInput);
    assert.equal(itemsSug.length, 1);
    assert.equal(itemsSug[0].category, "suggested");
    assert.equal(itemsSug[0].isBlocking, false);
}

console.log("settings-recommendation-lifecycle: all staleness, tri-state and anti-false-positive checks passed successfully.");
