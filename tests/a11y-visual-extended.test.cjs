const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {assertEffectiveStyle} = require("./helpers/css-cascade.cjs");

/* T-1666 专项守门测试：
   视觉无障碍扩展：reduced-motion、对比度、强制颜色与 200/400% 缩放防溢出
   1. 系统强制颜色 (forced-colors: active) 关键词与适配；
   2. 高对比度 (prefers-contrast: more) 轮廓与非颜色冗余；
   3. 减弱动效 (prefers-reduced-motion: reduce) 阻断与双闸门禁；
   4. 键盘焦点可见性 (:focus-visible) 与 2px 轮廓外展；
   5. 横竖屏自适应与 200%/400% 大字号/窄视口防横向溢出断言。 */

const projectRoot = path.resolve(__dirname, "..");
const componentsCss = fs.readFileSync(path.join(projectRoot, "src", "ui", "components.scss"), "utf8");
const tokensCss = fs.readFileSync(path.join(projectRoot, "src", "ui", "tokens.scss"), "utf8");
const polishCss = fs.readFileSync(path.join(projectRoot, "src", "ui", "polish.scss"), "utf8");
const compiledCss = fs.readFileSync(path.join(projectRoot, "dist", "index.css"), "utf8");

console.log("Starting a11y-visual-extended tests...");

// 1. 系统强制颜色 (forced-colors: active) 规则守门
{
    assert.match(componentsCss, /@media \(forced-colors: active\)/, "components.scss must declare forced-colors media block");
    assert.match(compiledCss, /@media\s*\(forced-colors:\s*active\)/, "compiled dist/index.css must retain forced-colors block");

    // 必须使用 Windows 强制颜色系统语义变量
    assert.ok(compiledCss.includes("Canvas") && compiledCss.includes("CanvasText") && compiledCss.includes("Highlight"),
        "forced-colors must map to system keywords: Canvas, CanvasText, Highlight");
    
    // 进度条与高亮控件必须保持高亮显示
    assertEffectiveStyle(".lc-checkin__item-progress span", {background: "Highlight"},
        "item progress must adapt to system Highlight in forced-colors mode", "forced-colors");
}

// 2. 高对比度增强 (prefers-contrast: more) 规则守门
{
    assert.match(componentsCss, /@media \(prefers-contrast: more\)/, "components.scss must declare prefers-contrast media block");
    assert.match(compiledCss, /@media\s*\(prefers-contrast:\s*more\)/, "compiled dist/index.css must retain prefers-contrast block");

    // 核心交互按钮带 2px 实体轮廓
    assert.match(componentsCss, /\.lc-checkin :is\(\.lc-checkin__primary-button, \.lc-checkin__record-button, \.lc-checkin__save-button\) \{[\s\S]*?outline:\s*2px solid currentColor/,
        "primary/record/save buttons must have 2px solid currentColor outline in high-contrast mode");

    // 边框加粗与强化
    assert.match(componentsCss, /\.lc-checkin :is\(input, select, textarea\) \{[\s\S]*?border-width:\s*2px/,
        "form controls must use 2px borders in high-contrast mode");
}

// 3. 减弱动效 (prefers-reduced-motion: reduce) 规则守门
{
    assert.match(componentsCss, /@media \(prefers-reduced-motion: reduce\)/, "components.scss must declare prefers-reduced-motion block");
    assert.match(compiledCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, "compiled dist/index.css must retain prefers-reduced-motion block");

    // 动效压缩至 .01ms 并禁止无限循环
    assert.match(componentsCss, /animation-duration:\s*\.01ms\s*!important/,
        "animation duration must be clamped to 0.01ms under reduced-motion");
    assert.match(componentsCss, /transition-duration:\s*\.01ms\s*!important/,
        "transition duration must be clamped to 0.01ms under reduced-motion");
}

// 4. 键盘焦点可见性 (:focus-visible) 规则守门
{
    // 全局禁止出现无轮廓焦点破坏
    assert.doesNotMatch(compiledCss, /:focus-visible\s*\{\s*outline:\s*none;\s*\}/,
        "destructive focus-visible outline:none is strictly forbidden");
    assert.doesNotMatch(compiledCss, /:focus-visible\s*\{\s*outline:\s*0;\s*\}/,
        "destructive focus-visible outline:0 is strictly forbidden");

    // 焦点轮廓必须显式外展以防止被溢出隐藏截断
    assert.match(componentsCss, /outline-offset:\s*2px/,
        "focus rings must declare outline-offset: 2px for clear visibility");
}

// 5. 非颜色冗余 (Non-color redundancy) 与状态辅助指示
{
    // 逾期与重要状态必须具备非颜色标识 (图标、标签文本或属性)
    const reviewCompareTs = fs.readFileSync(path.join(projectRoot, "src", "render", "review-compare.ts"), "utf8");
    const fragmentsTs = fs.readFileSync(path.join(projectRoot, "src", "render", "fragments.ts"), "utf8");

    // 比较看板 delta 带有符号指示
    assert.match(reviewCompareTs, /signedValue\(stat\.delta\)/,
        "compare stats delta must include explicit positive/negative sign in addition to tone color");

    // 今日打卡完成状态包含对勾图标或语义文字
    assert.ok(fragmentsTs.includes("lc-checkin__item-action") && fragmentsTs.includes("today.completed"),
        "completed action must have textual label or aria label");
}

// 6. 200%/400% 缩放与小视口换行保护 (Overflow & Word Break)
{
    // 必须有全局文本断字与溢出断行规则
    assert.match(compiledCss, /overflow-wrap:\s*anywhere|word-break:\s*break-word/,
        "styles must declare word breaking to prevent horizontal page overflow at 400% zoom");

    // 横屏短视口紧凑适配
    assert.match(componentsCss, /@media \(max-height: 520px\) and \(orientation: landscape\)/,
        "components must declare landscape short-viewport compact optimization");
}

// 7. 标题自然排版与防孤行折行 (Heading Line Balance & Paragraph Pretty Wrapping / UI-UX Pro Max)
{
    assert.match(compiledCss, /text-wrap:\s*balance/,
        "styles must declare text-wrap: balance for heading balance under supported browsers");
    assert.match(polishCss, /text-wrap:\s*pretty/,
        "polish.scss must declare text-wrap: pretty for paragraph line refinement under supported browsers");
}

// 8. 焦点无遮挡保障与错误聚焦轮廓 (Focus Not Obscured / WCAG 2.2 AA 2.4.11 & AAA 2.4.12 / UI-UX Pro Max)
{
    // 源码中必须声明 scroll-margin-block 避让吸顶与吸底导航
    assert.match(polishCss, /scroll-margin-block:\s*max\(64px,\s*calc\(var\(--lc-checkin-nav-height,\s*56px\)\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\s*\+\s*12px\)\)/,
        "polish.scss must declare scroll-margin-block for focus not obscured under sticky headers and footers");
    assert.match(compiledCss, /scroll-margin-block:\s*max\(64px/,
        "dist/index.css must retain compiled scroll-margin-block focus-not-obscured rule");

    // 校验错误状态焦点必须有专用危险色 focus-visible 轮廓
    assert.match(polishCss, /\[aria-invalid="true"\]:focus-visible[\s\S]*?outline:\s*2px solid var\(--lc-checkin-danger\)/,
        "polish.scss must declare danger focus ring on aria-invalid elements");
}

console.log("a11y-visual-extended: all forced-colors, contrast, reduced-motion, focus, zoom, text-wrap and focus-not-obscured checks passed successfully.");
