/* T-1737 & T-1738 专项契约守门测试：
   设置推荐事务提交、保存边界、内存回滚与 7 大前置检查（D-647）。
   1. 前置就绪度（evaluateRecommendationPreflight）：
      - 缺 Key、宿主未探测、目标不可达、单位冲突、无项、多候选、全部就绪；
   2. 事务执行协调（executeRecommendationTransaction）：
      - 全部成功（full_success）；
      - 部分成功（partial_success，诚实披露成功与失败桶，执行内存回滚）；
      - 完全失败（rolled_back，内存回滚）；
      - 空计划安全处理。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "src", "features", "settings-recommendation-transaction.ts");
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

const { evaluateRecommendationPreflight, executeRecommendationTransaction } = mod;

console.log("Starting settings-recommendation-transaction tests...");

// 1. 前置就绪度评估 (T-1738)
{
    // A. 缺少凭据
    const resKey = evaluateRecommendationPreflight("weread", { hasCredential: false });
    assert.equal(resKey.code, "missing_credential");
    assert.equal(resKey.isExecutable, false);
    assert.equal(resKey.resolutionPath, "input_credential");

    // B. 宿主未探测
    const resHost = evaluateRecommendationPreflight("docktomato", { hasCredential: true, isHostDetected: false });
    assert.equal(resHost.code, "host_undetected");
    assert.equal(resHost.isExecutable, false);
    assert.equal(resHost.resolutionPath, "verify_host_status");

    // C. 目标文档不可达
    const resTarget = evaluateRecommendationPreflight("journal", {
        hasCredential: true,
        isHostDetected: true,
        isTargetAccessible: false,
    });
    assert.equal(resTarget.code, "target_unreachable");
    assert.equal(resTarget.isExecutable, false);
    assert.equal(resTarget.resolutionPath, "choose_target_item");

    // D. 单位冲突
    const resUnit = evaluateRecommendationPreflight("reading", {
        hasCredential: true,
        isHostDetected: true,
        isTargetAccessible: true,
        hasUnitConflict: true,
    });
    assert.equal(resUnit.code, "unit_conflict");
    assert.equal(resUnit.isExecutable, false);
    assert.equal(resUnit.resolutionPath, "create_matching_item");

    // E. 零匹配项
    const resZero = evaluateRecommendationPreflight("reading", {
        hasCredential: true,
        isHostDetected: true,
        isTargetAccessible: true,
        matchingItemCount: 0,
    });
    assert.equal(resZero.code, "no_matching_item");
    assert.equal(resZero.isExecutable, false);
    assert.equal(resZero.resolutionPath, "create_matching_item");

    // F. 多项候选需人工定夺
    const resMulti = evaluateRecommendationPreflight("reading", {
        hasCredential: true,
        isHostDetected: true,
        isTargetAccessible: true,
        matchingItemCount: 3,
    });
    assert.equal(resMulti.code, "multiple_candidates");
    assert.equal(resMulti.isExecutable, false);
    assert.equal(resMulti.resolutionPath, "choose_target_item");
    assert.equal(resMulti.candidateCount, 3);

    // G. 全部就绪
    const resReady = evaluateRecommendationPreflight("reading", {
        hasCredential: true,
        isHostDetected: true,
        isTargetAccessible: true,
        matchingItemCount: 1,
    });
    assert.equal(resReady.code, "ready");
    assert.equal(resReady.isExecutable, true);
    assert.equal(resReady.resolutionPath, "apply_directly");
}

// 2. 事务执行与多桶保存边界 (T-1737)
async function testTransactions() {
    // A. 全部成功
    {
        const plan = {
            schemeId: "scheme-display",
            mutations: [
                {
                    key: "theme",
                    targetBucket: "checkin-view-preferences",
                    semantics: "B_immediate",
                    previousValue: "light",
                    nextValue: "auto",
                },
                {
                    key: "reminder_slots",
                    targetBucket: "checkin-view-preferences",
                    semantics: "A_explicit",
                    previousValue: ["09:00"],
                    nextValue: ["09:00", "21:00"],
                },
            ],
            requiresHighRiskConfirm: false,
        };

        let rollbackCalled = false;
        const outcome = await executeRecommendationTransaction(
            plan,
            async (_bucket, _mutations) => true,
            () => { rollbackCalled = true; }
        );

        assert.equal(outcome.ok, true);
        assert.equal(outcome.status, "full_success");
        assert.equal(outcome.rollbackExecuted, false);
        assert.equal(rollbackCalled, false);
        assert.deepEqual(outcome.succeededBuckets, ["checkin-view-preferences"]);
    }

    // B. 部分成功（多桶混合提交时一成功一失败）
    {
        const plan = {
            schemeId: "scheme-hybrid",
            mutations: [
                {
                    key: "theme",
                    targetBucket: "checkin-view-preferences",
                    semantics: "B_immediate",
                    previousValue: "light",
                    nextValue: "dark",
                },
                {
                    key: "journal_notebook",
                    targetBucket: "checkin-auxiliary-notebook",
                    semantics: "A_explicit",
                    previousValue: "old_nb",
                    nextValue: "new_nb",
                },
            ],
            requiresHighRiskConfirm: true,
        };

        let rolledBackValues = null;
        const outcome = await executeRecommendationTransaction(
            plan,
            async (bucket) => bucket === "checkin-view-preferences", // view-preferences 成功，auxiliary 失败
            (snapshot) => { rolledBackValues = snapshot; }
        );

        assert.equal(outcome.ok, false);
        assert.equal(outcome.status, "partial_success");
        assert.equal(outcome.rollbackExecuted, true);
        assert.deepEqual(outcome.succeededBuckets, ["checkin-view-preferences"]);
        assert.deepEqual(outcome.failedBuckets, ["checkin-auxiliary-notebook"]);
        assert.equal(outcome.userMessageKey, "set.rec.tx.partialSuccess");
        assert.deepEqual(rolledBackValues, { theme: "light", journal_notebook: "old_nb" });
    }

    // C. 全部失败并回滚
    {
        const plan = {
            schemeId: "scheme-fail",
            mutations: [
                {
                    key: "theme",
                    targetBucket: "checkin-view-preferences",
                    semantics: "B_immediate",
                    previousValue: "light",
                    nextValue: "dark",
                },
            ],
            requiresHighRiskConfirm: false,
        };

        let rolledBackValues = null;
        const outcome = await executeRecommendationTransaction(
            plan,
            async () => false,
            (snapshot) => { rolledBackValues = snapshot; }
        );

        assert.equal(outcome.ok, false);
        assert.equal(outcome.status, "rolled_back");
        assert.equal(outcome.rollbackExecuted, true);
        assert.deepEqual(outcome.failedBuckets, ["checkin-view-preferences"]);
        assert.equal(outcome.userMessageKey, "set.rec.tx.failedAndRolledBack");
        assert.deepEqual(rolledBackValues, { theme: "light" });
    }

    // D. 空计划
    {
        const emptyPlan = { schemeId: "empty", mutations: [], requiresHighRiskConfirm: false };
        const outcome = await executeRecommendationTransaction(emptyPlan, async () => true, () => {});
        assert.equal(outcome.ok, true);
        assert.equal(outcome.status, "full_success");
    }
}

testTransactions().then(() => {
    console.log("settings-recommendation-transaction: all preflight and transaction checks passed successfully.");
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
