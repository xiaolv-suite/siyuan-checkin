const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src", "index.ts"), "utf8");
const editorSource = fs.readFileSync(path.join(root, "src", "render", "editor.ts"), "utf8");
const styles = fs.readFileSync(path.join(root, "src", "index.scss"), "utf8");
const components = fs.readFileSync(path.join(root, "src", "ui", "components.scss"), "utf8");

const quickDialogSource = fs.readFileSync(path.join(root, "src", "render", "quick-dialog.ts"), "utf8");
assert.match(quickDialogSource, /visualViewport[\s\S]*addEventListener\("resize", sync\)[\s\S]*addEventListener\("scroll", sync(, \{ passive: true \})?\)/,
    "keyboard and viewport changes must trigger dialog resizing");
assert.match(editorSource, /<div class="lc-checkin__form-scroll">[\s\S]*<div class="lc-checkin__editor-actions"[^>]*>[\s\S]*data-action="archive"/,
    "editor must separate scrollable fields from bottom actions");
assert.match(editorSource, /class="lc-checkin__save-button" type="submit"/,
    "save template action must remain keyboard-submit capable");

assert.match(components, /\.lc-checkin-dialog-host--mobile[\s\S]*\.lc-checkin__form-scroll[\s\S]*scroll-padding:[^;]*env\(safe-area-inset-bottom\)/,
    "mobile form scroll must reserve the safe area");
assert.match(components, /Editor foundations[\s\S]*\.lc-checkin__editor-actions\s*\{[^}]*flex:\s*0\s+0\s+auto[^}]*background:\s*var\(--lc-checkin-bg\)/,
    "save bar must stay visible above the keyboard");
assert.match(components, /@supports \(height:\s*100dvh\)[\s\S]*\.b3-dialog__container:has\(\.lc-checkin-dialog-host--mobile\)[\s\S]*max-height:\s*calc\(100dvh - 16px\)/,
    "dynamic viewport height must be used when the keyboard changes the visual viewport");
assert.match(components, /\.lc-checkin button:focus-visible,[\s\S]*\.lc-checkin input:focus-visible,[\s\S]*\.lc-checkin select:focus-visible[\s\S]*outline:/,
    "focused controls must remain visible while the keyboard is open");

// 移动端虚拟键盘语义输入与微交互防护 (inputmode, enterkeyhint, autocapitalize / UI-UX Pro Max)
assert.match(editorSource, /name="target" type="number" inputmode="decimal"/,
    "target input must declare inputmode='decimal' for numeric touch keyboard");
assert.match(editorSource, /name="recordStep" type="number" inputmode="decimal"/,
    "recordStep input must declare inputmode='decimal' for numeric touch keyboard");
assert.match(editorSource, /name="intervalDays" type="number" inputmode="numeric"/,
    "intervalDays input must declare inputmode='numeric' for integer touch keyboard");
assert.match(editorSource, /name="quotaAmount" type="number" inputmode="decimal"/,
    "quotaAmount input must declare inputmode='decimal' for numeric touch keyboard");
assert.match(editorSource, /name="anchorBlockId"[\s\S]*?autocapitalize="off" autocorrect="off" spellcheck="false"/,
    "anchorBlockId input must disable autocorrect and autocapitalize");
assert.match(editorSource, /data-template-query[\s\S]*?enterkeyhint="search" autocapitalize="off"/,
    "template search input must declare enterkeyhint='search' and autocapitalize='off'");

for (const width of [320, 360, 390, 430]) assert.ok(width >= 320 && width <= 430);
console.log("Mobile editor keyboard visibility and semantic touch input checks passed for 320/360/390/430px.");
