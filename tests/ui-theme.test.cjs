const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {assertEffectiveStyle} = require("./helpers/css-cascade.cjs");

const styles = fs.readFileSync(path.join(__dirname, "..", "src", "index.scss"), "utf8");
const liveStyles = fs.readFileSync(path.join(__dirname, "..", "src", "ui", "components.scss"), "utf8");
const tokens = fs.readFileSync(path.join(__dirname, "..", "src", "ui", "tokens.scss"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "..", "src", "index.ts"), "utf8");
const reviewSource = fs.readFileSync(path.join(__dirname, "..", "src", "render", "review.ts"), "utf8");
const archivedSource = fs.readFileSync(path.join(__dirname, "..", "src", "render", "archived.ts"), "utf8");
const i18n = fs.readFileSync(path.join(__dirname, "..", "src", "i18n.ts"), "utf8");
assert.ok(!styles.includes("2.0 visual foundation"), "visual foundation must not return to legacy index.scss");
assert.match(liveStyles, /Semantic state tokens[\s\S]*data-status="missed"[\s\S]*data-status="partial"/,
    "semantic completion states belong to the live component layer");
assert.ok(!styles.includes("lc-checkin-dialog__resize-handle"), "dialog frame controls must not return to legacy index.scss");
assert.match(tokens, /--lc-checkin-control-height:\s*36px/);
assert.match(tokens, /--lc-checkin-muted-surface:/);
assert.match(tokens, /--lc-checkin-shadow:/);
assertEffectiveStyle(".lc-checkin__organize", {background: /transparent|--lc-checkin-/});
assert.doesNotMatch(liveStyles, /\.lc-template-(?:manager|card|form)\b/,
    "retired template prototype layout cannot return to the component layer");
assert.match(liveStyles, /\.lc-checkin\[data-reduced-motion="true"\]:is\([^)]*\.lc-checkin--today[\s\S]*scroll-behavior:\s*auto/,
    "reduced motion must disable Today scrolling from the root data attribute");
assert.match(liveStyles, /\.lc-checkin\[data-reduced-motion="true"\][\s\S]*transition:\s*none !important[\s\S]*transform:\s*none !important/,
    "reduced motion must disable root transitions and transforms");
assert.doesNotMatch(liveStyles, /\[data-reduced-motion="true"\]\s+\.lc-checkin--today/,
    "reduced-motion selectors must not assume the data attribute lives on an ancestor");
assert.match(liveStyles, /\.lc-checkin-dialog-host--mobile \.lc-checkin\[data-reduced-motion="true"\][\s\S]*backdrop-filter:\s*none/,
    "mobile dialog backdrop must honor the root reduced-motion state");
assert.match(liveStyles, /\.lc-checkin-dialog-host--mobile, \.lc-checkin-tab-host\)\[data-reduced-motion="true"\][\s\S]*\.lc-checkin__mobile-nav[\s\S]*transition:\s*none !important/,
    "sibling mobile navigation must honor the owning root reduced-motion state");
assert.match(source, /surface\.dataset\.reducedMotion = String\(this\.reducedMotion\);[\s\S]*root\.dataset\.reducedMotion = String\(this\.reducedMotion\);/,
    "owning host root must mirror reduced-motion for sibling navigation controls");
assertEffectiveStyle(".lc-checkin__occasion-chip.is-complete", {
    opacity: "1",
    color: "var(--lc-checkin-muted)",
    background: "var(--lc-checkin-muted-surface)",
}, "completed occasion chips keep subdued semantics without reducing text contrast");
assertEffectiveStyle(".lc-checkin__reminder-row.is-completed", {opacity: "1"},
    "completed reminders keep explicit text colors at full opacity");
assertEffectiveStyle(".lc-checkin__reminder-row.is-skipped", {opacity: "1"},
    "skipped reminders keep explicit text colors at full opacity");
assert.match(source, /computeLongestStreaks\(this\.store, currentCalendarDate\(\)\)\.get\(item\.id\)/,
    "insights all-time longest must use the model single implementation (T-1295)");
assert.match(source, /insights\.longestEver/, "insights must label the all-time longest stat");
assertEffectiveStyle(".lc-checkin__template", {"min-height": /58px|64px/},
    "live editor template controls retain a component-level touch baseline");
assertEffectiveStyle(".lc-checkin--editor .lc-checkin__form-scroll", {display: "grid", "grid-template-columns": /minmax\(0, 1fr\)/},
    "editor config area must stay single-column at every width");
assertEffectiveStyle(".lc-checkin--today .lc-checkin__item-name", {overflow: "hidden", "text-overflow": "ellipsis"},
    "long item names must truncate instead of widening cards");
assertEffectiveStyle(".lc-checkin--today .lc-checkin__item", {"grid-template-columns": /minmax\(0, 1fr\)/},
    "narrow containers must use the width-safe compact card grid", "lc5 (max-width: 719px)");
assert.match(liveStyles, /backdrop-filter:\s*blur\(12px\)|backdrop-filter:\s*blur\(14px\)/);
assert.match(reviewSource, /lc-checkin__summary-stats/, "overview retains its themed summary strip");
assert.match(reviewSource, /data-review-workspace-panel/, "review themes apply inside the active workspace");
assert.match(archivedSource, /lc-checkin--archived[\s\S]*t\("archived\.eyebrow"\)/);
assert.match(i18n, /"archived\.eyebrow": "暂不参与今日计划"/);
assert.ok(reviewSource.includes('t("review.eyebrow")'), "review eyebrow uses the i18n dictionary");
assert.match(source, /surface\.dataset\.appearance = this\.resolvedAppearance\(\)/);
assert.match(source, /surface\.dataset\.appearance = this\.resolvedAppearance\(\)/);
assert.match(source, /surface\.dataset\.reducedMotion = String\(this\.reducedMotion\)/);
const settingsSource = fs.readFileSync(path.join(__dirname, "..", "src", "render", "settings.ts"), "utf8");
assert.match(settingsSource, /lc-checkin__settings-nav/);
assert.match(source, /window\.confirm\(t\("msg\.prefsResetConfirm"\)\)/);
assert.match(i18n, /"msg\.prefsResetConfirm": "恢复全部显示偏好？.*打卡数据、来源绑定、Key、复盘草稿、保存视图与报告输出设置保留。"/);
assert.match(liveStyles, /\.lc-checkin\[data-reduced-motion="true"\]:is\([^)]*\.lc-checkin--history/);
assert.match(fs.readFileSync(path.join(__dirname, "..", "src", "ui", "tokens.scss"), "utf8"), /--lc-checkin-success:/);
assert.match(fs.readFileSync(path.join(__dirname, "..", "src", "ui", "tokens.scss"), "utf8"), /--lc-checkin-danger:/);
/* radius-lg 的真实生效声明在 tokens.scss（20px）；index.scss 里曾有一份死块里的 16px 从未生效 */
assert.match(fs.readFileSync(path.join(__dirname, "..", "src", "ui", "tokens.scss"), "utf8"), /--lc-checkin-radius-lg:\s*20px/, "v5 tokens define the large radius");
assert.ok(!source.includes("cycleDensity"), "density cycler must be removed");

/* Primary quick-record/record/save buttons share these foreground/fill tokens.
   Resolve the appearance + palette cascade, not isolated palette blocks:
   dark palettes once inherited dark text over the light palette's dark fill. */
const tokenBlock = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = tokens.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    assert.ok(match, `missing token selector: ${selector}`);
    return Object.fromEntries([...match[1].matchAll(/(--lc-checkin-[\w-]+):\s*([^;]+);/g)]
        .map((entry) => [entry[1], entry[2].trim()]));
};
const luminance = (hex) => {
    assert.match(hex, /^#[0-9a-f]{6}$/i, "primary contrast guard expects explicit six-digit color tokens");
    return hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255)
        .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
};
for (const appearance of ["light", "dark"]) {
    for (const palette of ["lavender", "ocean", "forest", "sunset"]) {
        const resolved = {...tokenBlock(".lc-checkin"), ...tokenBlock(`.lc-checkin[data-appearance="${appearance}"]`)};
        if (palette !== "lavender") {
            Object.assign(resolved, tokenBlock(`.lc-checkin[data-palette="${palette}"]`));
            if (appearance === "dark") Object.assign(resolved, tokenBlock(`.lc-checkin[data-appearance="dark"][data-palette="${palette}"]`));
        }
        const foreground = resolved["--lc-checkin-accent-contrast"];
        const background = resolved["--lc-checkin-accent-fill"];
        const a = luminance(foreground), b = luminance(background);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        assert.ok(ratio >= 4.5, `${appearance}/${palette} primary button contrast ${ratio.toFixed(2)}:1 (${foreground} on ${background}) must be >=4.5:1`);
    }
}
console.log("Modern responsive UI theme checks passed.");
