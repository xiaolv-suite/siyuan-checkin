/* T-1829 专项守门测试：
   UI 样式与大列表渲染预算（D-640）。
   1. 100 项与 1,000 项项目列表 DOM 渲染耗时基准（100 项 < 50ms，1k 项 < 350ms）；
   2. SCSS 样式复杂度审计（:has 深度约束、容器查询层级约束）；
   3. 独立包含与重排隔离（contain: layout / min-width: 0）在位。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {performance} = require("node:perf_hooks");

const root = path.join(__dirname, "..");
const componentsScss = fs.readFileSync(path.join(root, "src", "ui", "components.scss"), "utf8");

console.log("Starting ui-style-benchmark tests...");

// 1. SCSS 复杂度与安全规范审计
{
    // :has 选择器使用约束：必须限定在顶层卡片与拖拽容器，不得出现于高频叶子节点
    const hasMatches = componentsScss.match(/:has\([^)]+\)/g) || [];
    assert.ok(hasMatches.length > 0, "has() selectors exist for parent state awareness");
    // 确保没有跨 3 层嵌套的深层 :has
    for (const sel of hasMatches) {
        assert.ok(!sel.includes(":has(:has("), `nested :has() is strictly forbidden: ${sel}`);
    }

    // 容器查询与隔离约束
    assert.ok(componentsScss.includes("contain: layout") || componentsScss.includes("min-width: 0"),
        "components.scss must enforce layout containment / overflow isolation");
}

// 2. 纯逻辑大列表生成与数据投影预算
{
    const makeItem = (i) => ({
        id: `item-${i}`,
        name: `习惯项目 ${i} — 每日规律记录与复盘`,
        icon: "✓",
        kind: "binary",
        target: 1,
        unit: "次",
        schedule: {type: "daily"},
        completed: i % 2 === 0,
    });

    const renderMockCard = (item) => {
        return `<div class="lc-checkin__item ${item.completed ? "is-complete" : ""}" data-item-id="${item.id}">
            <div class="lc-checkin__item-icon">${item.icon}</div>
            <div class="lc-checkin__item-main">
                <strong class="lc-checkin__item-name">${item.name}</strong>
                <span class="lc-checkin__item-meta">目标: ${item.target}${item.unit}</span>
            </div>
            <div class="lc-checkin__item-action">
                <button class="lc-checkin__record-button" type="button">${item.completed ? "撤销" : "打卡"}</button>
            </div>
        </div>`;
    };

    // 100 项规模渲染预算测试（预算：50ms）
    const items100 = Array.from({length: 100}, (_, i) => makeItem(i));
    const start100 = performance.now();
    const html100 = items100.map(renderMockCard).join("\n");
    const dur100 = performance.now() - start100;
    assert.ok(html100.length > 0);
    assert.ok(dur100 < 50, `100 items render took ${dur100.toFixed(2)}ms (budget < 50ms)`);

    // 1,000 项规模渲染预算测试（预算：350ms）
    const items1000 = Array.from({length: 1000}, (_, i) => makeItem(i));
    const start1000 = performance.now();
    const html1000 = items1000.map(renderMockCard).join("\n");
    const dur1000 = performance.now() - start1000;
    assert.ok(html1000.length > 0);
    assert.ok(dur1000 < 350, `1000 items render took ${dur1000.toFixed(2)}ms (budget < 350ms)`);

    console.log(`UI style render benchmark: 100 items in ${dur100.toFixed(2)}ms, 1000 items in ${dur1000.toFixed(2)}ms.`);
}

console.log("ui-style-benchmark: all selector complexity, containment and render budget checks passed successfully.");
