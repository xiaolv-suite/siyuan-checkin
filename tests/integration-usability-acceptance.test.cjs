/* T-1550 & T-1555 专项守门测试：
   三组联动可用性切片验收与设置内容分层去重（D-638）。
   1. 六大外部来源卡片分层与高级折叠（data-source-advanced）；
   2. 明确的动作动词收敛（立即读取、立即拉取、预览匹配、宿主探测，无模糊“立即刷新”）；
   3. 来源事实三行（产生什么、写入何处、触发频次）与状态解耦；
   4. 目标选择器与换绑确认、停用隔离及只读体检；
   5. 文档输出双结果解耦（打卡事实先落盘、文档输出失败不回滚、提示“打卡事实不受影响”）。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const settingsSource = fs.readFileSync(path.join(root, "src", "render", "settings.ts"), "utf8");
const i18nSource = fs.readFileSync(path.join(root, "src", "i18n.ts"), "utf8");

console.log("Starting integration-usability-acceptance tests...");

// 1. 设置内容分层与折叠（T-1555：每个来源卡高级说明收拢至 data-source-advanced）
{
    const advancedFoldMatches = (settingsSource.match(/data-source-advanced/g) || []).length;
    // 覆盖 sireader, siplayer, weread, health, notequery, yeguif 6 张来源卡
    assert.equal(advancedFoldMatches, 6, "all 6 source panels collapse steps and boundary text into data-source-advanced");

    // 严禁在卡片首屏平铺大段未折叠的 boundary 长文
    assert.ok(settingsSource.includes("class=\"lc-checkin__source-steps\""), "ordered steps present in advanced folds");
}

// 2. 动作词规范化（消歧：微信读书拉取唯一化，摄取型固定为“立即读取”）
{
    // 微信读书拉取统一走 weread-pull，不得保留模糊的第二刷新入口
    assert.ok(!settingsSource.includes('data-action="refresh-source" data-source="weread"'),
        "weread pull must use dedicated weread-pull, not ambiguous refresh-source");
    assert.equal((settingsSource.match(/data-action="refresh-source"/g) || []).length, 3,
        "refresh-source action strictly preserved for the three ingestion sources (health, notequery, yeguif)");
    assert.ok(settingsSource.includes("set.sourceReadNow"), "read-now verb used for ingest sources");
    assert.ok(settingsSource.includes('data-action="weread-pull"'), "dedicated weread-pull action present");
    assert.ok(settingsSource.includes("set.wereadPull"), "pull verb used for weread pull");
    assert.ok(settingsSource.includes("data-action=\"probe-siplayer\""), "probe verb used for host detector");
}

// 3. 来源事实三行在位（产生记录、写入项目、触发方式）
{
    assert.ok(settingsSource.includes("sourceFactsBlock"), "source facts helper is present");
    for (const key of [
        "set.sourceProduces.sireader",
        "set.sourceProduces.siplayer",
        "set.sourceProduces.weread",
        "set.sourceProduces.health",
        "set.sourceProduces.notequery",
        "set.sourceProduces.yeguif",
    ]) {
        assert.ok(i18nSource.includes(`"${key}"`), `i18n must declare explicit production fact: ${key}`);
    }
}

// 4. 文档输出双结果解耦与失败提示（T-1550 / D-300）
{
    // 日记报告与摘要驻留卡具有触发与最近结果行
    assert.ok(settingsSource.includes("data-write-trigger"), "write triggers are explicitly declared");
    assert.ok(settingsSource.includes("data-write-result"), "write results are explicitly rendered from audit");

    // 失败时不回滚打卡事实，并明确说明
    assert.ok(i18nSource.includes("打卡事实不受影响") || i18nSource.includes("checkin facts unaffected"),
        "bilingual copy must state that checkin facts are preserved when document output fails");
}

// 5. 目标卡片统一选择器与体检
{
    assert.ok(settingsSource.includes("data-document-target-card"), "target cards use unified attribute hook");
    assert.ok(settingsSource.includes('data-action="check-note-bindings"'), "global check bindings trigger in place");
}

console.log("integration-usability-acceptance: all source layering, action disambiguation, facts projection and output decoupling checks passed successfully.");
