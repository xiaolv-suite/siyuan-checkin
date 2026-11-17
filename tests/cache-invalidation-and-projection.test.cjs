// @ts-check
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

console.log("Starting cache-invalidation-and-projection tests...");

const root = path.join(__dirname, "..");
const srcIndex = fs.readFileSync(path.join(root, "src", "index.ts"), "utf8");
const srcModel = fs.readFileSync(path.join(root, "src", "model.ts"), "utf8");

// 1. T-1656 静态断言：导入/恢复/远端通知后必须失效缓存与锚点解析
const onDataChangedStart = srcIndex.indexOf("async onDataChanged()");
const onDataChangedEnd = srcIndex.indexOf("this.renderBackgroundUpdate();", onDataChangedStart);
const onDataChangedBlock = srcIndex.slice(onDataChangedStart, onDataChangedEnd);
assert.ok(onDataChangedBlock.includes("this.invalidateSummary();"), "onDataChanged must call this.invalidateSummary()");
assert.ok(onDataChangedBlock.includes("clearAnchorResolveCache();"), "onDataChanged must call clearAnchorResolveCache()");

const importCsvBlock = srcIndex.slice(srcIndex.indexOf("importCsvRows(parsed.rows)"), srcIndex.indexOf('showMessage(t("msg.csvDone"'));
assert.ok(importCsvBlock.includes("this.invalidateSummary();"), "importCsvRows must call this.invalidateSummary()");
assert.ok(importCsvBlock.includes("clearAnchorResolveCache();"), "importCsvRows must call clearAnchorResolveCache()");

const importLoopBlock = srcIndex.slice(srcIndex.indexOf("importLoopPlan(plan)"), srcIndex.indexOf('showMessage(t("msg.loopDone"'));
assert.ok(importLoopBlock.includes("this.invalidateSummary();"), "importLoopPlan must call this.invalidateSummary()");
assert.ok(importLoopBlock.includes("clearAnchorResolveCache();"), "importLoopPlan must call clearAnchorResolveCache()");

const importObsidianBlock = srcIndex.slice(srcIndex.indexOf("importObsidianHabitsInto(this.store, plan)"), srcIndex.indexOf('showMessage(t("msg.obsidianDone"'));
assert.ok(importObsidianBlock.includes("this.invalidateSummary();"), "importObsidian must call this.invalidateSummary()");
assert.ok(importObsidianBlock.includes("clearAnchorResolveCache();"), "importObsidian must call clearAnchorResolveCache()");

const conflictConfirmBlock = srcIndex.slice(srcIndex.indexOf("[data-import-conflict-confirm]"), srcIndex.indexOf("settings.importConflictSession = undefined;"));
assert.ok(srcIndex.includes("settings.importConflictSession = undefined;\n                    this.syncSettingsCompatibilityForRoot(root);\n                    this.invalidateSummary();\n                    clearAnchorResolveCache();"), "conflict decision confirm must invalidate summary and clear anchor cache");

const restoreSnapshotBlock = srcIndex.slice(srcIndex.indexOf("restoreLatestBackup("), srcIndex.indexOf('showMessage(t("msg.snapshotRestored"'));
assert.ok(restoreSnapshotBlock.includes("this.invalidateSummary();"), "restoreLatestBackup must call this.invalidateSummary()");
assert.ok(restoreSnapshotBlock.includes("clearAnchorResolveCache();"), "restoreLatestBackup must call clearAnchorResolveCache()");

const restoreJsonBlock = srcIndex.slice(srcIndex.indexOf("preflight.bucketPlans"), srcIndex.indexOf('settingsFeedback(t("msg.importFailSafe"'));
assert.ok(restoreJsonBlock.includes("this.invalidateSummary();"), "json/envelope restore must call this.invalidateSummary()");
assert.ok(restoreJsonBlock.includes("clearAnchorResolveCache();"), "json/envelope restore must call clearAnchorResolveCache()");

// 2. T-1870 静态断言：normalizeStore 保留 templates 数组防丢
assert.ok(srcModel.includes("...(Array.isArray(candidate.templates) ? {templates: candidate.templates} : {}),"), "normalizeStore must preserve templates array");

console.log("cache-invalidation-and-projection: all assertions passed successfully!");
