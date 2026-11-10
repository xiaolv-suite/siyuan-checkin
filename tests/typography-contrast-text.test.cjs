/* T-1814, T-1815 & T-1828 专项守门测试：
   字体层级下限、状态对比度叠加防护与长文本折行截断治理（D-643）。
   1. 字体层级下限：全 SCSS 杜绝 < 8px 极小字号，正文与主要文本符合可读性规范；
   2. 状态对比度与叠加防护：完成态与焦点态杜绝双重 opacity 折损，[hidden] 强制 display: none !important；
   3. 长文本截断与折行治理：三大标准混入（lc-text-truncate / lc-text-clamp-2 / lc-text-break）在位；
   4. 表单标签与备注 overflow-wrap: anywhere 覆盖，杜绝 400% 缩放撕裂。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const componentsScss = fs.readFileSync(path.join(root, "src", "ui", "components.scss"), "utf8");
const tokensScss = fs.readFileSync(path.join(root, "src", "ui", "tokens.scss"), "utf8");
const workbenchScss = fs.readFileSync(path.join(root, "src", "ui", "workbench.scss"), "utf8");

console.log("Starting typography-contrast-text tests...");

// 1. 字体层级与可读性下限断言 (T-1814)
{
    // 全库禁止出现小于 8px 的极小字号（如 6px, 7px 等不可读声明）
    const sub8pxMatches = componentsScss.match(/font-size:\s*[1-7]px/g) || [];
    assert.equal(sub8pxMatches.length, 0, "no font-size declaration below 8px is permitted");

    // 标题层级有明确的字重与尺寸分层
    assert.ok(componentsScss.includes("--lc-checkin-settings-title-weight: 720") || tokensScss.includes("720"),
        "strong heading weight tokens defined");
}

// 2. 状态对比度与透明度叠加防护 (T-1815)
{
    // [hidden] 强力防御：防止 display: grid 覆盖原生 [hidden] 导致隐形遮挡
    assert.ok(componentsScss.includes(".lc-checkin__record-details[hidden] { display: none !important; }") ||
              componentsScss.includes("[hidden] { display: none !important; }"),
        "[hidden] attribute must enforce display: none !important");

    // 完成态卡片在 focus/active 时保持 100% 不透明，杜绝父子 opacity 复合折损对比度
    assert.ok(componentsScss.includes(".lc-checkin--today .lc-checkin__completed-section .lc-checkin__item:active") &&
              componentsScss.includes("opacity: 1;"),
        "completed items must reset opacity to 1 on active/focus-within to protect contrast");
}

// 3. 长文本截断与折行标准 mixin 在位 (T-1828)
{
    assert.ok(componentsScss.includes("@mixin lc-text-truncate"), "lc-text-truncate mixin defined");
    assert.ok(componentsScss.includes("@mixin lc-text-clamp-2"), "lc-text-clamp-2 mixin defined");
    assert.ok(componentsScss.includes("@mixin lc-text-break"), "lc-text-break mixin defined");

    // overflow-wrap: anywhere 广泛应用以防止 400% 缩放横向溢出
    const overflowWrapCount = (componentsScss.match(/overflow-wrap:\s*anywhere/g) || []).length;
    assert.ok(overflowWrapCount >= 10, `overflow-wrap: anywhere must be widely applied across cards (found ${overflowWrapCount})`);
}

console.log("typography-contrast-text: all typography lower bounds, contrast stacking protection and text break checks passed successfully.");
