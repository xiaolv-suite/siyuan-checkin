// @ts-check
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

console.log("Starting import-hash-perf tests...");

const root = path.join(__dirname, "..");
const srcPluginOps = fs.readFileSync(path.join(root, "src", "plugin-ops.ts"), "utf8");

// 1. T-1926 静态断言：importCsvRowsInto 与 importLoopPlanInto 使用 Set 预索引去重
assert.ok(srcPluginOps.includes("const knownKeys = new Set(store.events.map((event) => `${event.itemId}:${event.localDate}:${event.value}:${event.unit}`));"), "plugin-ops.ts must use Set for O(1) duplicate checks in import functions");
assert.ok(!srcPluginOps.includes("store.events.some((event) => event.itemId === item.id && event.localDate === date"), "importCsvRowsInto must not scan store.events linearly in inner loop");
assert.ok(!srcPluginOps.includes("events.some((event) => event.itemId === item.id && event.localDate === row.date"), "importLoopPlanInto must not scan events linearly in inner loop");

console.log("import-hash-perf: all assertions passed successfully!");
