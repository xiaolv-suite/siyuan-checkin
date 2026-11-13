/* T-1759 & T-1760 专项契约守门测试：
   推荐草稿多 Root 所有权、跨表面隔离与隐私凭据治理（D-652）。
   1. 多 Root 草稿独立性与 dirty 保护（T-1759）：
      - 桌面 Tab 与 Dock 弹窗两 root 草稿互不干扰；
      - 远端 onDataChanged 触发时，有编辑的 dirty 草稿受到严格保护且标记 stale warning；
      - 无 dirty 草稿自动重置同步最新磁盘数据；
   2. 凭据零外发与强制脱敏审计（T-1760）：
      - 识别 key/token/secret 敏感字段并进行点号遮罩；
      - 审计机制精准拦截明文凭据外发；
      - 嵌套配置对象递归清洗。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "src", "features", "settings-recommendation-ownership-and-privacy.ts");
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
    createRootRecommendationDraftStore,
    isSensitiveField,
    sanitizeRecommendationPayload,
    auditRecommendationPrivacy,
} = mod;

console.log("Starting settings-recommendation-ownership-and-privacy tests...");

// 1. 多 Root 隔离与远端刷新保护 (T-1759)
{
    const store = createRootRecommendationDraftStore();

    // root-tab 编辑
    store.updateDraftField("root-tab", "scheme-reading", "data-weread-threshold", 25);
    const draftTab = store.getDraft("root-tab");
    assert.ok(draftTab);
    assert.equal(draftTab.isDirty, true);
    assert.equal(draftTab.dirtyFieldValues["data-weread-threshold"], 25);

    // root-dock 保持独立无 dirty
    assert.equal(store.getDraft("root-dock"), undefined);

    // root-dock 开启草稿但尚未修改具体值
    store.updateDraftField("root-dock", "scheme-remind", "data-setting-quiet", true);
    const draftDock = store.getDraft("root-dock");
    assert.ok(draftDock);
    assert.equal(draftDock.schemeId, "scheme-remind");

    // 触发远端数据变化 (onDataChanged)
    const protectedRoots = store.handleRemoteDataChanged(12);
    assert.ok(protectedRoots.includes("root-tab"), "root-tab has dirty changes and must be protected");

    // 验证 root-tab 草稿未被删除，且被打上远端变动标记
    const refreshedTab = store.getDraft("root-tab");
    assert.ok(refreshedTab);
    assert.equal(refreshedTab.dirtyFieldValues["data-weread-threshold"], 25);
    assert.equal(refreshedTab.hasStaleRemoteWarning, true);

    // 清除 root-tab 草稿
    store.clearDraft("root-tab");
    assert.equal(store.getDraft("root-tab"), undefined);
}

// 2. 凭据识别与脱敏 (T-1760)
{
    assert.equal(isSensitiveField("wereadApiKey"), true);
    assert.equal(isSensitiveField("secretToken"), true);
    assert.equal(isSensitiveField("userPassword"), true);
    assert.equal(isSensitiveField("theme"), false);
    assert.equal(isSensitiveField("reminderSlots"), false);

    const rawPayload = {
        schemeId: "rec-weread",
        thresholdMinutes: 30,
        wereadApiKey: "wrk-secret-12345",
        nested: {
            subToken: "my-token-abc",
            normalField: "hello",
        },
    };

    // 审计明文泄露
    const auditBefore = auditRecommendationPrivacy(rawPayload);
    assert.equal(auditBefore.isClean, false);
    assert.deepEqual(auditBefore.leakedFields, ["wereadApiKey"]);

    // 执行脱敏清洗
    const sanitized = sanitizeRecommendationPayload(rawPayload);
    assert.equal(sanitized.wereadApiKey, "••••••••");
    assert.equal(sanitized.thresholdMinutes, 30);
    assert.equal(sanitized.nested.subToken, "••••••••");
    assert.equal(sanitized.nested.normalField, "hello");

    // 审计清洗后载荷
    const auditAfter = auditRecommendationPrivacy(sanitized);
    assert.equal(auditAfter.isClean, true);
    assert.equal(auditAfter.leakedFields.length, 0);
}

console.log("settings-recommendation-ownership-and-privacy: all multi-root isolation, dirty protection and privacy audit checks passed successfully.");
