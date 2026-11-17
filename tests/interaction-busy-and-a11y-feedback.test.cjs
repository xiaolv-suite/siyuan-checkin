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

// 4. 验证 bind-page-navigation.ts 周复盘清空前二次确认防误触
const bindPageNavSource = fs.readFileSync(path.join(__dirname, "../src/render/bind-page-navigation.ts"), "utf8");
assert.ok(
    bindPageNavSource.includes("if ((friction.trim() || adjustment.trim()) && !window.confirm(t(\"review.weeklyClearConfirm\"))) return;"),
    "weekly review clear draft must require confirm if friction or adjustment has content"
);
console.log("  ✓ Check 7: Weekly review clear draft confirm guard verified");

// 5. 验证 plugin-ops.ts 移动端导航溢出观察器与监听器清理
const pluginOpsSource = fs.readFileSync(path.join(__dirname, "../src/plugin-ops.ts"), "utf8");
assert.ok(
    pluginOpsSource.includes("navScrollerCleanups = new WeakMap") &&
    pluginOpsSource.includes("resizeObserver?.disconnect()"),
    "nav overflow hint must clean up previous listeners and observer per root"
);
console.log("  ✓ Check 8: Mobile nav overflow listener and observer cleanup verified");

// 6. 验证 bind-occasions.ts 清空筛选全量绑定与回焦
const bindOccasionsSource = fs.readFileSync(path.join(__dirname, "../src/render/bind-occasions.ts"), "utf8");
assert.ok(
    bindOccasionsSource.includes("root.querySelectorAll<HTMLElement>(\"[data-occasion-clear-filters]\").forEach") &&
    bindOccasionsSource.includes("root.querySelector<HTMLInputElement>(\"[data-occasion-search]\")?.focus()"),
    "occasion clear filters must bind all instances and focus search input"
);
console.log("  ✓ Check 9: Occasion clear filters full binding and search focus verified");

// 7. 验证 settings-navigation.ts 搜索滚动展开父级 details
const settingsNavSource = fs.readFileSync(path.join(__dirname, "../src/render/settings-navigation.ts"), "utf8");
assert.ok(
    settingsNavSource.includes("let details = row.closest<HTMLDetailsElement>(\"details\");") &&
    settingsNavSource.includes("details.open = true;"),
    "settings search scrollIntoView must recursively expand ancestor details"
);
console.log("  ✓ Check 10: Settings search scrollIntoView ancestor details expansion verified");

// 8. 验证 fragments.ts 中 Hero 按钮无障碍项目名称与附件按钮回显
const fragmentsSource = fs.readFileSync(path.join(__dirname, "../src/render/fragments.ts"), "utf8");
assert.ok(
    fragmentsSource.includes("aria-label=\"${escapeHtml(t(\"item.checkin\") + \" · \" + nextItem.name)}\"") &&
    fragmentsSource.includes("aria-label=\"${escapeHtml(t(\"item.focus\") + \" · \" + nextItem.name)}\""),
    "hero action buttons must include target item name in aria-label"
);
assert.ok(
    fragmentsSource.includes("const hasPhoto = Boolean(ctx.pendingAttachments?.has(item.id));") &&
    fragmentsSource.includes("lc-checkin__attach-button${hasPhoto ? \" has-photo\" : \"\"}"),
    "attach-button must reflect pendingAttachments state on redraw"
);
console.log("  ✓ Check 11: Hero actions a11y naming and attach button state persistence verified");

// 9. 验证 bind-page-navigation.ts AI 提示词复制成功后更新行内状态
assert.ok(
    bindPageNavSource.includes("const status = root.querySelector<HTMLElement>(\"[data-weekly-status]\");") &&
    bindPageNavSource.includes("if (status) status.textContent = t(\"review.aiCopied\");"),
    "weekly review AI copy must update status element for visible feedback"
);
console.log("  ✓ Check 12: Weekly review AI copy inline status feedback verified");

// 10. 验证 bind-occasions.ts 日期输入框监听 input 事件即时更新农历提示
assert.ok(
    bindOccasionsSource.includes("occasionDateInput?.addEventListener(\"input\"") &&
    bindOccasionsSource.includes("occasionDateInput?.addEventListener(\"change\""),
    "occasion date input must listen to both input and change events for real-time lunar hint"
);
console.log("  ✓ Check 13: Occasion date input real-time lunar hint feedback verified");

// 11. 验证 bind-occasions.ts 改期日期过去日与非法日期拦截
assert.ok(
    bindOccasionsSource.includes("!dateInput.value || !isValidLocalDateInput(dateInput.value) || dateInput.value < todayKey") &&
    bindOccasionsSource.includes("showMessage(t(\"occ.moveInvalid\"));"),
    "occasion move confirmation must guard against past or invalid dates"
);
console.log("  ✓ Check 14: Occasion move future date boundary guard verified");

// 12. 验证 bind-page-navigation.ts 周复盘输入框 change 自动保存草稿
const updatedBindPageNavSource = fs.readFileSync(path.join(__dirname, "../src/render/bind-page-navigation.ts"), "utf8");
assert.ok(
    updatedBindPageNavSource.includes("frictionArea?.addEventListener(\"change\", autoSaveWeeklyDraft);") &&
    updatedBindPageNavSource.includes("adjustmentArea?.addEventListener(\"change\", autoSaveWeeklyDraft);"),
    "weekly review textareas must auto-save draft on change"
);
console.log("  ✓ Check 15: Weekly review input change auto-save draft verified");

// 13. 验证 bind-occasions.ts 改期同日安全退出
const latestBindOccasionsSource = fs.readFileSync(path.join(__dirname, "../src/render/bind-occasions.ts"), "utf8");
assert.ok(
    latestBindOccasionsSource.includes("if (dateInput.value === originDate) {") &&
    latestBindOccasionsSource.includes("writeState({occurrenceMoves: {...current.occurrenceMoves, [id]: {open: false, date: \"\"}}});"),
    "occasion move to same origin date must safely close without writing redundant override"
);
console.log("  ✓ Check 16: Occasion move same date no-op guard verified");

// 14. 验证 bind-page-navigation.ts 周复盘导出同时持久化草稿
assert.ok(
    updatedBindPageNavSource.includes("const outcome = await host.exportWeeklyReviewMarkdown?.(weekKey, friction, adjustment);") &&
    updatedBindPageNavSource.includes("void host.saveWeeklyReviewDraft?.(weekKey, friction, adjustment).catch"),
    "weekly review export must also persist draft to local store"
);
console.log("  ✓ Check 17: Weekly review export persists draft verified");

// 15. 验证 settings.ts 与 settings-navigation.ts 搜索空态卡片与一键清除
const settingsSource = fs.readFileSync(path.join(__dirname, "../src/render/settings.ts"), "utf8");
const updatedSettingsNavSource = fs.readFileSync(path.join(__dirname, "../src/render/settings-navigation.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "../src/index.ts"), "utf8");
assert.ok(
    settingsSource.includes("data-settings-search-empty") &&
    settingsSource.includes("data-action=\"clear-settings-search\""),
    "settings view must include search empty block and clear button"
);
assert.ok(
    updatedSettingsNavSource.includes("emptyNotice.hidden = !(Boolean(query) && matches === 0);") &&
    indexSource.includes("data-action='clear-settings-search'"),
    "settings navigation must toggle empty block and bind clear click in index"
);
console.log("  ✓ Check 18: Settings search empty state and clear feedback verified");

// 16. 验证 index.ts 集中体检目标丢失时提示反馈
assert.ok(
    indexSource.includes("if (!input) {\n                showMessage(t(\"bind.targetMissing\"));\n                return;\n            }"),
    "goto-binding must show target missing message when target element is absent"
);
console.log("  ✓ Check 19: Goto-binding target missing feedback verified");

// 17. 验证 components.scss 中周复盘文本域样式
const latestComponentsCss = fs.readFileSync(path.join(__dirname, "../src/ui/components.scss"), "utf8");
assert.ok(
    latestComponentsCss.includes(".lc-checkin__weekly-field textarea { width: 100%; min-height: 72px; line-height: 1.5;"),
    "weekly review textarea must have min-height 72px and line-height 1.5"
);
console.log("  ✓ Check 20: Weekly review textarea styling verified");

// 18. 验证 editor.ts 与 bind-editor.ts 新建页自然语言起草与提示词复制 (T-1685)
const editorSource = fs.readFileSync(path.join(__dirname, "../src/render/editor.ts"), "utf8");
const updatedBindEditorSource = fs.readFileSync(path.join(__dirname, "../src/render/bind-editor.ts"), "utf8");
assert.ok(
    editorSource.includes("data-ai-draft-disclosure") &&
    editorSource.includes("data-ai-draft-input") &&
    editorSource.includes("data-action=\"ai-draft-infer\"") &&
    editorSource.includes("data-action=\"ai-draft-copy-prompt\""),
    "editor view must include natural language AI draft section with infer and copy prompt actions"
);
assert.ok(
    (updatedBindEditorSource.includes("generateLocalFallbackDraft(text)") || updatedBindEditorSource.includes("generateLocalFallbackDraft(minContext.userDescription)")) &&
    (updatedBindEditorSource.includes("buildProjectCreatePrompt(text)") || updatedBindEditorSource.includes("buildProjectCreatePrompt(minContext.userDescription)")) &&
    updatedBindEditorSource.includes("data-action='ai-draft-apply'"),
    "bind-editor must wire up natural language infer, copy prompt, and safe apply into normal form"
);
console.log("  ✓ Check 21: Natural language AI project draft main workflow verified (T-1685)");

console.log("All interaction-busy, alignment and a11y feedback checks passed successfully!");
