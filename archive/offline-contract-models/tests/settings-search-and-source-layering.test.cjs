/* T-1757 & T-1758 专项契约守门测试：
   来源卡四轴状态去重、动作词消歧与设置元数据精准搜索（D-653）。
   1. 来源状态四轴正交解耦（evaluateSourceStatusAxes）：
      - 配置态、运行态、今日活动与故障状态彼此正交；
      - 停用且未配置时 problemState 保持健康，绝不报假故障；
      - 密钥失效精准标记 credential_invalid；
   2. 动作动词消歧（SOURCE_ACTION_VERBS）：
      - 6 大来源专属动词消歧（拉取、读取、采样、探测、同步、推导）；
   3. 元数据精准搜索（searchSettingsRegistry）：
      - 键名精确匹配分值最高；
      - 支持按 DOM data-* 属性定位；
      - 输出结构化面包屑路径导航（section > card > field）。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const root = path.join(__dirname, "..");

// 编译治理与搜索模块
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

const { evaluateSourceStatusAxes, SOURCE_ACTION_VERBS, searchSettingsRegistry } = loadModule(
    "src/features/settings-search-and-source-layering.ts"
);

console.log("Starting settings-search-and-source-layering tests...");

// 1. 来源状态四轴正交模型 (T-1757)
{
    // A. 未配置且停用
    const axes1 = evaluateSourceStatusAxes({
        hasKeyOrBinding: false,
        enabled: false,
        todayRecordCount: 0,
    });
    assert.equal(axes1.configState, "unconfigured");
    assert.equal(axes1.runtimeState, "disabled");
    assert.equal(axes1.activityOutcome, "no_records_today");
    assert.equal(axes1.problemState, "healthy"); // 必须是 healthy，未配置绝不是故障！

    // B. 已配置且正在运行
    const axes2 = evaluateSourceStatusAxes({
        hasKeyOrBinding: true,
        enabled: true,
        todayRecordCount: 3,
    });
    assert.equal(axes2.configState, "configured");
    assert.equal(axes2.runtimeState, "running");
    assert.equal(axes2.activityOutcome, "has_records_today");
    assert.equal(axes2.problemState, "healthy");

    // C. 密钥失效
    const axes3 = evaluateSourceStatusAxes({
        hasKeyOrBinding: true,
        enabled: true,
        todayRecordCount: 0,
        isKeyInvalid: true,
    });
    assert.equal(axes3.problemState, "credential_invalid");

    // D. 写入失败
    const axes4 = evaluateSourceStatusAxes({
        hasKeyOrBinding: true,
        enabled: true,
        todayRecordCount: 0,
        hasWriteFailed: true,
    });
    assert.equal(axes4.problemState, "write_failed");
}

// 2. 六大来源专属动词消歧 (T-1757)
{
    const expected = ["weread", "sireader", "siplayer", "health", "yeguif", "notequery"];
    for (const src of expected) {
        assert.ok(SOURCE_ACTION_VERBS[src], `must define action verb for ${src}`);
        assert.ok(SOURCE_ACTION_VERBS[src].verb.includes("_"), "verb format is source_action");
    }
    assert.equal(SOURCE_ACTION_VERBS.weread.verb, "weread_pull");
    assert.equal(SOURCE_ACTION_VERBS.sireader.verb, "sireader_read");
    assert.equal(SOURCE_ACTION_VERBS.siplayer.verb, "siplayer_sample");
    assert.equal(SOURCE_ACTION_VERBS.health.verb, "health_probe");
    assert.equal(SOURCE_ACTION_VERBS.yeguif.verb, "yeguif_sync");
    assert.equal(SOURCE_ACTION_VERBS.notequery.verb, "notequery_derive");
}

// 3. 设置元数据精准搜索 (T-1758)
{
    // A. 键名精确命中
    const themeResults = searchSettingsRegistry("theme");
    assert.ok(themeResults.length > 0);
    assert.equal(themeResults[0].key, "theme");
    assert.ok(themeResults[0].score >= 100);
    assert.equal(themeResults[0].breadcrumb, "appearance_nav > appearance > theme");

    // B. DOM data-* 属性命中
    const wereadResults = searchSettingsRegistry("data-weread-key");
    assert.ok(wereadResults.length > 0);
    assert.equal(wereadResults[0].key, "weread_api_key");

    // C. 空查询返回空
    const emptyResults = searchSettingsRegistry("   ");
    assert.equal(emptyResults.length, 0);
}

console.log("settings-search-and-source-layering: all status axes, verb disambiguation and search indexing checks passed successfully.");
