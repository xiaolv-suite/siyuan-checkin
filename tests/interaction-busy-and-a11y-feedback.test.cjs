const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

console.log("Starting interaction-busy, alignment and a11y feedback tests...");

// 1. 验证 CSS 样式中存在对 action-busy / aria-busy 的反馈支持与 tabular-nums
const cssContent = fs.readFileSync(path.join(__dirname, "../src/ui/interaction-states.scss"), "utf8");
assert.ok(
    cssContent.includes('[aria-busy="true"]') && cssContent.includes('[data-action-busy="true"]'),
    "interaction-states.scss must define aria-busy and data-action-busy rules"
);
assert.ok(
    cssContent.includes("cursor: wait") && cssContent.includes("pointer-events: none"),
    "busy rules must declare cursor: wait and pointer-events: none"
);
console.log("  ✓ Check 1: Action-busy and aria-busy feedback styles verified");

// 2. 验证 components.scss 中 day-chip 与 energy-option 具备 tabular-nums
const componentsCss = fs.readFileSync(path.join(__dirname, "../src/ui/components.scss"), "utf8");
assert.ok(
    componentsCss.includes(".lc-checkin--today .lc-checkin__day-chip strong") &&
    componentsCss.includes("font-variant-numeric: tabular-nums"),
    "day-chip strong must specify tabular-nums"
);
console.log("  ✓ Check 2: Day chip and numeric typography alignment verified");

// 3. 验证 bind-today.ts 源码中包含修复后的安全守门
const bindTodaySource = fs.readFileSync(path.join(__dirname, "../src/render/bind-today.ts"), "utf8");

// 验证 overview-focus 安全回退
assert.ok(
    bindTodaySource.includes("focusItem.direction === \"atMost\"") &&
    bindTodaySource.includes("host.openFocusTimer(targetId)"),
    "overview-focus must have safe fallback when card DOM query misses"
);
console.log("  ✓ Check 3: Overview focus safe fallback verified");

// 验证 undo-record 防重复点击与 busy 标记
assert.ok(
    bindTodaySource.includes("target.dataset.actionBusy = \"true\"") &&
    bindTodaySource.includes("target.setAttribute(\"aria-busy\", \"true\")"),
    "undo-record must mark target as busy"
);
console.log("  ✓ Check 4: Undo record debounce & busy attribute verified");

// 验证 amount 输入框 IME composition 保护
assert.ok(
    bindTodaySource.includes("if (event.isComposing || event.keyCode === 229) return;\n            if (event.key !== \"Enter\") return;"),
    "amount keydown must guard against IME composing and keyCode 229"
);
console.log("  ✓ Check 5: Amount keydown IME composition guard verified");

// 验证 quick-note-chips 初始化状态同步
assert.ok(
    bindTodaySource.includes("syncChipsState();\n        quickChips.forEach"),
    "quick-note-chips must call syncChipsState() on bind initialization"
);
console.log("  ✓ Check 6: Quick note chips initial state synchronization verified");

console.log("All interaction-busy, alignment and a11y feedback checks passed successfully!");
