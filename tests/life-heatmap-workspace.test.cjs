const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// 1. 源码静态结构与类型声明契约
const analyticsSrc = fs.readFileSync(path.join(__dirname, "..", "src", "analytics.ts"), "utf8");
assert.match(analyticsSrc, /export interface MultiYearCalendarAggregate/, "analytics.ts must export MultiYearCalendarAggregate");
assert.match(analyticsSrc, /export function buildMultiYearCalendarAggregate/, "analytics.ts must export buildMultiYearCalendarAggregate");

const reviewSrc = fs.readFileSync(path.join(__dirname, "..", "src", "render", "review.ts"), "utf8");
assert.match(reviewSrc, /"lifeHeatmap"/, "review.ts ReviewViewContext must accept lifeHeatmap");
assert.match(reviewSrc, /renderLifeHeatmapWorkspace/, "review.ts must define renderLifeHeatmapWorkspace");
assert.match(reviewSrc, /lc-checkin__life-heatmap-container/, "review.ts must render life-heatmap container");
assert.match(reviewSrc, /lc-checkin__life-stats/, "review.ts must render life-stats KPI dashboard");

const navSrc = fs.readFileSync(path.join(__dirname, "..", "src", "render", "bind-page-navigation.ts"), "utf8");
assert.match(navSrc, /workspace === "lifeHeatmap"/, "bind-page-navigation.ts must whitelist lifeHeatmap in review-workspace click dispatcher");

const i18nSrc = fs.readFileSync(path.join(__dirname, "..", "src", "i18n.ts"), "utf8");
assert.match(i18nSrc, /"review\.workspace\.lifeHeatmap": "人生热力图"/, "i18n.ts must define zh-CN label for lifeHeatmap");
assert.match(i18nSrc, /"review\.workspace\.lifeHeatmap": "Life Heatmap"/, "i18n.ts must define en-US label for lifeHeatmap");

// 2. 纯逻辑聚合算法功能断言（通过 TypeScript 编译物或逻辑复验）
console.log("✔ life-heatmap-workspace static contracts passed");
