const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

global.window = global.window || {};

const compiledCache = new Map();
function loadTs(filename) {
    const fullPath = path.resolve(filename);
    if (compiledCache.has(fullPath)) return compiledCache.get(fullPath).exports;
    const loaded = {exports: {}};
    compiledCache.set(fullPath, loaded);
    const compiled = ts.transpileModule(fs.readFileSync(fullPath, "utf8"), {
        compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}
    }).outputText;
    const localRequire = (name) => {
        if (name.startsWith(".")) {
            const resolvedTs = path.resolve(path.dirname(fullPath), name.endsWith(".ts") ? name : `${name}.ts`);
            return loadTs(resolvedTs);
        }
        return require(name);
    };
    new Function("require", "module", "exports", compiled)(localRequire, loaded, loaded.exports);
    return loaded.exports;
}

// 1. 测试 Protocol v1.5.0: lvAi 与 lvActivity.getDailyStats()
const noticeKit = loadTs(path.join(__dirname, "..", "src", "render", "lv-notice-kit.ts"));
const {lvAi, lvActivity} = noticeKit;

assert.ok(lvAi, "lvAi 必须存在");
assert.equal(typeof lvAi.chat, "function", "lvAi.chat 必须是函数");
assert.equal(typeof lvActivity.getDailyStats, "function", "lvActivity.getDailyStats 必须是函数");

// 模拟记录各项活动
lvActivity.record({source: "打卡", category: "habit", title: "晨跑 3 公里"});
lvActivity.record({source: "剪藏", category: "clip", title: "深度阅读认知笔记"});
lvActivity.record({source: "闪卡", category: "card", title: "复习 20 张卡片"});

const stats = lvActivity.getDailyStats();
assert.ok(stats.total >= 3, "总活动数必须 >= 3");
assert.ok(stats.habit >= 1, "打卡活动数必须 >= 1");
assert.ok(stats.clip >= 1, "剪藏活动数必须 >= 1");
assert.ok(stats.card >= 1, "闪卡活动数必须 >= 1");

// 2. 测试 renderTodayEcosystemActivityView 渲染作战大盘量化统计条与睡前日记按钮
const fragments = loadTs(path.join(__dirname, "..", "src", "render", "fragments.ts"));
const {renderTodayEcosystemActivityView} = fragments;

const todayHtml = renderTodayEcosystemActivityView(true, "今日坚持了晨跑与阅读，韧性十足！");
assert.match(todayHtml, /data-ecosystem-daily-stats/, "必须渲染量化统计大盘条");
assert.match(todayHtml, /今日产出 \d+ 项/, "统计大盘必须包含今日产出总计数");
assert.match(todayHtml, /data-today-ai-summary/, "必须渲染 AI 润色的成长总结卡片");
assert.match(todayHtml, /今日坚持了晨跑与阅读，韧性十足！/, "成长总结内容必须被正确呈现");
assert.match(todayHtml, /data-action="append-bedtime-ecosystem-diary"/, "必须包含【🌙 睡前一键追加全家桶日记】按钮");
assert.match(todayHtml, /data-action="ai-polish-today-journal"/, "必须包含【✨ AI 润色今日总结】按钮");

// 3. 测试 Review 视图中 AI 习惯韧性教练 (Habit Coach) 的呈现
const reviewModule = loadTs(path.join(__dirname, "..", "src", "render", "review.ts"));
const {renderReviewView} = reviewModule;

const fakeStore = {
    version: 3,
    items: [
        {id: "run", name: "晨跑", icon: "🏃", kind: "numeric", target: 3, unit: "公里", schedule: {type: "daily"}}
    ],
    events: [
        {id: "e1", itemId: "run", value: 3, unit: "公里", occurredAt: "2026-11-03T08:00:00.000Z", localDate: "2026-11-03"}
    ],
    eventTombstones: [],
    itemTombstones: [],
    templates: []
};

const fakeReviewContext = {
    store: fakeStore,
    occasionStore: {occasions: []},
    appearance: "light",
    historyMonth: new Date(2026, 10, 1),
    selectedHistoryDate: "2026-11-03",
    historyQuery: "",
    historySource: "all",
    historyOrder: "newest",
    historyScope: "day",
    historyItemId: "",
    historyPage: 0,
    reviewWorkspace: "overview",
    reviewProjectPage: 0,
    reviewProjectOrder: "attention",
    reviewTrend: "weekly",
    reviewStrengthItemId: "",
    reviewAssistantGoal: "summary",
    heatmapYearOffset: 0,
    reviewFoldSections: new Set(["report"]),
    reviewFoldTouched: true,
    summaryRange: "month",
    summaryRefreshing: false,
    summaryProvidersCount: 0,
    reportSections: {events: true, completion: true, items: true, baseline: true, deviations: true, highlights: true},
    reportSource: "",
    projectDrafts: [],
    reminderFilter: "all",
    reminderUserActions: [],
    analyticsSnapshot: loadTs(path.join(__dirname, "..", "src", "charts.ts")).buildAnalyticsSnapshot(fakeStore, new Date(2026, 10, 3)),
    aiCoachAdvice: "在过去30天中，您的晨跑保持率高达90%，但在周四表现稍有起伏。建议在周四调整为轻量拉伸。",
    aiCoachLoading: false,
};

const reviewHtml = renderReviewView(fakeReviewContext);
assert.match(reviewHtml, /data-ai-coach-section/, "回顾视图必须包含 AI 习惯教练模块");
assert.match(reviewHtml, /AI 习惯韧性教练/, "必须包含 AI 习惯教练标题");
assert.match(reviewHtml, /data-action="generate-ai-coach"/, "必须包含生成 AI 习惯指南按钮");
assert.match(reviewHtml, /在过去30天中，您的晨跑保持率高达90%/, "必须展示 AI 教练生成的习惯建议内容");

console.log("Phase 6 AI & Ecosystem Command Center tests passed: Habit coach, AI journal polish, and daily stats bar fully verified.");
