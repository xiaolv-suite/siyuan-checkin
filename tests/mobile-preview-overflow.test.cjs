const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {assertEffectiveStyle} = require("./helpers/css-cascade.cjs");

const styles = fs.readFileSync(path.join(__dirname, "..", "src", "index.scss"), "utf8");
const liveStyles = fs.readFileSync(path.join(__dirname, "..", "src", "ui", "components.scss"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "..", "src", "index.ts"), "utf8");
const fragments = fs.readFileSync(path.join(__dirname, "..", "src", "render", "fragments.ts"), "utf8");

assert.match(fragments, /class="lc-checkin__item-name"/, "preview cards must expose a dedicated name slot");
assert.match(fragments, /class="lc-checkin__item-meta"/, "preview cards must expose a dedicated unit/meta slot");
assert.match(fragments, /class="lc-checkin__quick-button"[\s\S]*<span>\$\{escapeHtml\(unit\)\}<\/span>/,
    "quantity preview actions must keep unit text separate from the action label");
assertEffectiveStyle(".lc-checkin__item-name", {"min-width": "0", "text-overflow": "ellipsis"},
    "long preview names must truncate instead of widening the card");
assertEffectiveStyle(".lc-checkin__item-meta", {overflow: "hidden", "text-overflow": "ellipsis"},
    "long units and progress metadata must truncate instead of widening the card");
assertEffectiveStyle(".lc-checkin--today .lc-checkin__item", {"grid-template-columns": /minmax\(0, 1fr\)/},
    "narrow preview actions must stay inside the card width", "lc5 (max-width: 719px)");
assertEffectiveStyle(".lc-checkin--today .lc-checkin__item-action .lc-checkin__record-button", {
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
}, "long units in quick actions must truncate without covering buttons");
const itemBlock = liveStyles.match(/Today card foundations[\s\S]*?\.lc-checkin__item\s*\{([\s\S]*?)\n\}/)?.[1] || "";
assert.doesNotMatch(itemBlock, /overflow-x:\s*auto/,
    "preview cards must not introduce horizontal scrolling");

for (const width of [320, 360, 390, 430]) assert.ok(width >= 320 && width <= 430);
console.log("Mobile preview overflow checks passed for 320/360/390/430px.");
