/* T-1667: 大数据集冷启动、索引和增量渲染基线（CLI Benchmark 独立脚本）。
   运行命令: node scripts/cold-start-benchmark.cjs
   支持 1k / 10k / 100k 真实规模事件与项目的冷启动、多桶加载、四页扫描、增量变异与内存占用测量。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {performance} = require("node:perf_hooks");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(projectRoot, "src");
const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-cold-start-bench-"));

function compile(filename) {
    const source = fs.readFileSync(path.join(sourceRoot, filename), "utf8");
    const output = ts.transpileModule(source, {
        compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS},
        fileName: filename,
    }).outputText;
    fs.writeFileSync(path.join(outputRoot, filename.replace(/\.ts$/, ".js")), output);
}

for (const filename of [
    "types.ts", "record-step.ts", "quota.ts", "date-keys.ts",
    "rules.ts", "model.ts", "storage-transaction.ts", "lunar.ts", "i18n.ts", "occasions.ts"
]) {
    compile(filename);
}

const model = require(path.join(outputRoot, "model.js"));
const occasions = require(path.join(outputRoot, "occasions.js"));

const SCALES = [1000, 10000, 100000];
const results = [];

function makeItem(index) {
    return {
        id: `item-${index}`,
        name: `项目 ${index}`,
        icon: "✓",
        kind: index % 3 === 0 ? "duration" : index % 3 === 1 ? "quantity" : "binary",
        target: index % 3 === 0 ? 30 : index % 3 === 1 ? 5 : 1,
        unit: index % 3 === 0 ? "分钟" : index % 3 === 1 ? "个" : "次",
        schedule: {type: "daily"},
        createdDate: "2026-01-01",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-10-28T00:00:00.000Z",
        revisions: [],
        archivePeriods: [],
        archived: index >= 90, // 10% 归档
        group: index % 2 === 0 ? "健康" : "工作",
        priority: "medium",
        sortOrder: index,
        timeSlot: "any",
    };
}

function generateBenchmarkDataset(eventCount, itemCount = 100) {
    const items = Array.from({length: itemCount}, (_, i) => makeItem(i));
    const baseTimestamp = new Date("2026-10-28T12:00:00.000Z").getTime();
    const events = [];

    for (let i = 0; i < eventCount; i += 1) {
        const item = items[i % itemCount];
        const dayOffset = Math.floor(i / itemCount);
        const eventTime = new Date(baseTimestamp - dayOffset * 86400000);
        const localDate = eventTime.toISOString().slice(0, 10);
        events.push({
            id: `evt-${i}`,
            itemId: item.id,
            occurredAt: eventTime.toISOString(),
            localDate,
            value: item.target,
            unit: item.unit,
            source: i % 4 === 0 ? "api" : "manual",
            ...(i % 4 === 0 ? {externalRef: `ref-${i}`} : {}),
        });
    }

    const eventTombstones = Array.from({length: Math.min(1000, Math.floor(eventCount * 0.05))}, (_, i) => ({
        eventId: `deleted-${i}`,
        deletedAt: new Date(baseTimestamp - i * 3600000).toISOString(),
    }));

    return {
        storeRaw: {version: 2, items, events, eventTombstones},
        occasionsRaw: {
            version: 1,
            occasions: Array.from({length: 50}, (_, i) => ({
                id: `occ-${i}`,
                name: `事项 ${i}`,
                kind: "scheduled",
                date: "2026-10-28",
                recurrence: "daily",
                calendar: "solar",
                remindBeforeDays: 0,
                enabled: true,
                completedDates: [],
            })),
        },
    };
}

console.log("=== T-1667 大数据集冷启动、索引和增量渲染基线跑分 ===");
console.log("环境: Node.js " + process.version + " (" + process.arch + ")");
console.log("规模: 1k / 10k / 100k 事件");
console.log("");

for (const scale of SCALES) {
    const {storeRaw, occasionsRaw} = generateBenchmarkDataset(scale, 100);

    // 1. 冷启动与多桶并发解析 (Cold Start & Multi-Bucket Load)
    if (global.gc) global.gc();
    const memBefore = process.memoryUsage().heapUsed;
    const t0 = performance.now();
    
    // 多桶并发归一化
    const normalizedStore = model.normalizeStore(storeRaw);
    const normalizedOccasions = occasions.normalizeOccasionStore(occasionsRaw);
    const coldStartMs = performance.now() - t0;
    const memAfter = process.memoryUsage().heapUsed;
    const heapDiffMb = (memAfter - memBefore) / (1024 * 1024);

    // 2. 索引构建与命中 (Index Construction & O(1) Lookup)
    const tIndex = performance.now();
    const index = model.getStoreIndex(normalizedStore);
    const indexBuildMs = performance.now() - tIndex;

    const tLookup = performance.now();
    const sampleEvent = normalizedStore.events[scale / 2];
    const foundById = model.getEventById(normalizedStore, sampleEvent.id);
    const foundByDate = model.getEventsForDate(normalizedStore, sampleEvent.localDate);
    const lookupMs = performance.now() - tLookup;
    assert.equal(foundById.id, sampleEvent.id);
    assert.ok(foundByDate.length > 0);

    // 3. 四页扫描与轻量投影 (Four-Page Projections)
    // 3.1 Today 投影 (按今日日期索引提取，O(1) 桶扫描)
    const tToday = performance.now();
    const todayEvents = model.getEventsForDate(normalizedStore, "2026-10-28");
    const todayProjectionMs = performance.now() - tToday;

    // 3.2 Review 概览范围投影 (按半开日期范围提取)
    const tReview = performance.now();
    const reviewRangeEvents = model.getEventsInDateRange(normalizedStore, "2026-10-01", "2026-10-29");
    const reviewProjectionMs = performance.now() - tReview;

    // 3.3 Insights 单项目历史扫描 (按 itemId 提取)
    const tInsights = performance.now();
    const itemEvents = model.getEventsForDay(normalizedStore, "item-0", new Date("2026-10-28T00:00:00+08:00"));
    const insightsProjectionMs = performance.now() - tInsights;

    // 3.4 Archived 归档过滤
    const tArchived = performance.now();
    const archivedItems = normalizedStore.items.filter((item) => item.archived);
    const archivedProjectionMs = performance.now() - tArchived;
    assert.equal(archivedItems.length, 10);

    // 4. 增量更新变异开销 (Incremental Mutation vs Cold Start)
    const tIncremental = performance.now();
    const newEvent = {
        id: `incremental-new-${scale}`,
        itemId: "item-0",
        occurredAt: "2026-10-28T13:00:00.000Z",
        localDate: "2026-10-28",
        value: 1,
        unit: "次",
        source: "manual",
    };
    const updatedStore = {
        ...normalizedStore,
        events: [...normalizedStore.events, newEvent],
    };
    const updatedIndex = model.getStoreIndex(updatedStore);
    const incrementalMs = performance.now() - tIncremental;

    results.push({
        scale,
        coldStartMs: Number(coldStartMs.toFixed(2)),
        heapDiffMb: Number(heapDiffMb.toFixed(2)),
        indexBuildMs: Number(indexBuildMs.toFixed(3)),
        lookupMs: Number(lookupMs.toFixed(3)),
        todayProjectionMs: Number(todayProjectionMs.toFixed(3)),
        reviewProjectionMs: Number(reviewProjectionMs.toFixed(3)),
        insightsProjectionMs: Number(insightsProjectionMs.toFixed(3)),
        archivedProjectionMs: Number(archivedProjectionMs.toFixed(3)),
        incrementalMs: Number(incrementalMs.toFixed(3)),
    });

    console.log(`[规模: ${scale.toLocaleString()} 事件 / 100 项目]`);
    console.log(`  - 冷启动 + 多桶归一化: ${coldStartMs.toFixed(2)} ms (堆增量 ~${heapDiffMb.toFixed(2)} MB)`);
    console.log(`  - 索引构建 / 查找: ${indexBuildMs.toFixed(3)} ms / ${lookupMs.toFixed(3)} ms`);
    console.log(`  - 四页扫描 (Today/Review/Insights/Archived): ${todayProjectionMs.toFixed(3)} / ${reviewProjectionMs.toFixed(3)} / ${insightsProjectionMs.toFixed(3)} / ${archivedProjectionMs.toFixed(3)} ms`);
    console.log(`  - 增量变异 (Append 1 Event): ${incrementalMs.toFixed(3)} ms (仅为冷启动的 ${(incrementalMs / coldStartMs * 100).toFixed(2)}%)`);
    console.log("");
}

// 写入基准工件
const artifactPath = path.join(projectRoot, ".artifacts", "cold-start-benchmark.json");
fs.mkdirSync(path.dirname(artifactPath), {recursive: true});
fs.writeFileSync(artifactPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    node: process.version,
    results,
}, null, 2));

console.log("基准测试完成，工件已持久化到 .artifacts/cold-start-benchmark.json");
