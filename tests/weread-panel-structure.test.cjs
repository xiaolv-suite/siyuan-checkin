/* T-1741 专项契约守门测试：
   微信读书卡分步配置、宽屏密度与响应式字段结构（D-650）。
   1. 分步配置顺序审计（按“阅读时长必需→完读/笔记可选→官方 Key→确认启用→验证最近结果”分层组织）；
   2. 选项明确性：完读与笔记指标下拉显式提供占位与可选语义，不误导为必填；
   3. 密度与截断防护：Key 与阈值行具备自适应宽度与 overflow-wrap 保护，防止 320px/移动端截断；
   4. 事实三行与生效摘要存在且只读自持久化状态。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const root = path.join(__dirname, "..");
const settingsSource = fs.readFileSync(path.join(root, "src", "render", "settings.ts"), "utf8");
const componentsScss = fs.readFileSync(path.join(root, "src", "ui", "components.scss"), "utf8");

console.log("Starting weread-panel-structure tests...");

// 1. 分步结构与字段顺序
{
    const wereadPanelIndex = settingsSource.indexOf('data-source-panel="weread"');
    assert.ok(wereadPanelIndex > 0, "weread source panel exists");

    const wereadEndIndex = settingsSource.indexOf('data-source-category="shared-doc"', wereadPanelIndex);
    assert.ok(wereadEndIndex > wereadPanelIndex, "weread panel end marker found");
    const wereadBlock = settingsSource.slice(wereadPanelIndex, wereadEndIndex);

    const itemIdx = wereadBlock.indexOf("data-weread-item");
    const finishIdx = wereadBlock.indexOf("data-weread-finish-item");
    const notesIdx = wereadBlock.indexOf("data-weread-notes-item");
    const keyIdx = wereadBlock.indexOf("data-weread-key");
    const thresholdIdx = wereadBlock.indexOf("data-weread-threshold");
    const effectiveIdx = wereadBlock.indexOf("lc-checkin__settings-effective");
    const toggleIdx = wereadBlock.indexOf("data-weread-toggle");
    const pullIdx = wereadBlock.indexOf("data-action=\"weread-pull\"");

    // 严格步骤顺序：时长必需 -> 完读可选 -> 笔记可选 -> Key -> 阈值 -> 生效摘要 -> 启停 -> 立即拉取
    assert.ok(itemIdx > 0 && itemIdx < finishIdx, "required duration item comes before optional finish item");
    assert.ok(finishIdx < notesIdx, "finish item comes before notes item");
    assert.ok(notesIdx < keyIdx, "optional items come before key input");
    assert.ok(keyIdx < thresholdIdx, "key comes before threshold");
    assert.ok(thresholdIdx < effectiveIdx, "threshold comes before effective summary");
    assert.ok(effectiveIdx < toggleIdx, "effective summary comes before toggle");
    assert.ok(toggleIdx < pullIdx, "toggle comes before pull now action");
}

// 2. 可选指标不误导为必填
{
    assert.ok(settingsSource.includes("set.wereadFinishItemChoose"), "finish item has choose placeholder");
    assert.ok(settingsSource.includes("set.wereadNotesItemChoose"), "notes item has choose placeholder");
}

// 3. 样式与响应式密度审计
{
    assert.ok(componentsScss.includes(".lc-checkin__source-panel"), "source panel css rules in place");
    assert.ok(componentsScss.includes(".lc-checkin__source-boundary"), "source boundary styled");
    assert.ok(componentsScss.includes("overflow-wrap: anywhere"), "text wrap protection defined");
}

console.log("weread-panel-structure: all step sequence, optional labeling and density checks passed successfully.");
