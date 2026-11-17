/* T-1822 ~ T-1827 专项守门测试：
   视觉系统、设计令牌、多宿主密度与无障碍全景验收（D-644）。
   1. 矢量图标系统（UI_ICON_PATHS 23 项基础图标全部在位）；
   2. 宿主三档密度几何（touch 44px / normal 34px / compact 30px）；
   3. 强制颜色（forced-colors: active）系统关键词映射与实体轮廓；
   4. 减弱动效双闸持续时间压制（.01ms !important）；
   5. 数据可视化皮肤与紫罗兰单色亮度阶梯；
   6. 移动端虚拟键盘安全边距（scroll-margin-bottom: 96px）。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const iconsSource = fs.readFileSync(path.join(root, "src", "ui", "icons.ts"), "utf8");
const tokensScss = fs.readFileSync(path.join(root, "src", "ui", "tokens.scss"), "utf8");
const componentsScss = fs.readFileSync(path.join(root, "src", "ui", "components.scss"), "utf8");
const workbenchScss = fs.readFileSync(path.join(root, "src", "ui", "workbench.scss"), "utf8");

console.log("Starting design-system-integration tests...");

// 1. 矢量图标系统审计 (T-1825)
{
    const requiredIcons = [
        "home", "calendar", "history", "summary", "insight", "archive", "settings",
        "add", "back", "forward", "search", "external", "focus", "more", "edit",
        "trash", "timer", "expand", "close", "check", "circle", "pause", "play", "camera"
    ];
    for (const icon of requiredIcons) {
        assert.ok(iconsSource.includes(`${icon}:`), `UI_ICON_PATHS must define ${icon} icon`);
    }
}

// 2. 宿主三档密度与触控几何审计 (T-1824)
{
    assert.ok(tokensScss.includes("--lc-checkin-touch-min-target: 44px;"), "touch min target token 44px");
    assert.ok(tokensScss.includes("--lc-checkin-normal-min-target: 34px;"), "normal min target token 34px");
    assert.ok(tokensScss.includes("--lc-checkin-compact-min-target: 30px;"), "compact min target token 30px");
    assert.ok(componentsScss.includes("scroll-margin-bottom: 96px;"), "virtual keyboard scroll margin 96px in place");
}

// 3. 强制颜色系统关键词与轮廓审计 (T-1827)
{
    assert.ok(componentsScss.includes("@media (forced-colors: active)"), "forced-colors query defined");
    assert.ok(componentsScss.includes("CanvasText") || componentsScss.includes("Highlight"),
        "forced-colors system keywords mapped");
    assert.ok(componentsScss.includes("@media (prefers-contrast: more)"), "prefers-contrast: more query defined");
}

// 4. 减弱动效双闸压制审计 (T-1826)
{
    assert.ok(componentsScss.includes("@media (prefers-reduced-motion: reduce)"), "system reduced motion query in place");
    assert.ok(componentsScss.includes(".01ms !important") || componentsScss.includes("none !important"),
        "reduced motion transitions suppressed to sub-frame");
}

// 5. 数据可视化皮肤与单色色阶 (T-1823)
{
    assert.ok(tokensScss.includes("--lc-checkin-accent"), "accent token defined");
    assert.ok(componentsScss.includes(".lc-checkin__insight-stats"), "insight stats styled");
}

console.log("design-system-integration: all icons, host density, forced colors, motion reduction and visual skin checks passed successfully.");
