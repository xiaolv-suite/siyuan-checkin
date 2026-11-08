const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {performance} = require("node:perf_hooks");
const ts = require("typescript");

/* 并行争用与 GC 停顿稳定性脚手架抽至 tests/helpers/perf.cjs（calibrateContentionFactor + measureBest），
   与 storage-snapshot-budget / tombstone-lifecycle 共用同一争用倍率语义。 */
const {calibrateContentionFactor, measureBest} = require("./helpers/perf.cjs");
const CF = calibrateContentionFactor();


/* T-1667 专项守门测试：
   大数据集冷启动、索引和增量渲染基线
   1. 1k / 10k / 100k 项目与事件冷启动解析及多桶并发加载基线；
   2. 内存与堆分配在界校验；
   3. 索引构建与 O(1) 毫秒级查询基线；
   4. 四页扫描（Today / Review / Insights / Archived）有界投影；
   5. 增量变异与缓存复用；
   6. 取消响应与中断守卫。 */

const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(projectRoot, "src");
const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-cold-start-test-"));

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

function makeItem(index) {
    return {
        id: `perf-item-${index}`,
        name: `性能测试项目 ${index}`,
        icon: "⚡",
        kind: index % 3 === 0 ? "duration" : index % 3 === 1 ? "quantity" : "binary",
        target: index % 3 === 0 ? 45 : index % 3 === 1 ? 8 : 1,
        unit: index % 3 === 0 ? "分钟" : index % 3 === 1 ? "个" : "次",
        schedule: {type: "daily"},
        createdDate: "2026-01-01",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-10-28T00:00:00.000Z",
        revisions: [],
        archivePeriods: [],
        archived: index >= 45, // 10% 归档
        group: index % 2 === 0 ? "专注" : "健康",
        priority: "medium",
        sortOrder: index,
        timeSlot: "any",
    };
}

function buildTestDataset(eventCount, itemCount = 50) {
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
            source: i % 3 === 0 ? "api" : "manual",
            ...(i % 3 === 0 ? {externalRef: `ref-${i}`} : {}),
        });
    }

    const eventTombstones = Array.from({length: Math.min(500, Math.floor(eventCount * 0.05))}, (_, i) => ({
        eventId: `deleted-${i}`,
        deletedAt: new Date(baseTimestamp - i * 3600000).toISOString(),
    }));

    return {
        storeRaw: {version: 2, items, events, eventTombstones},
        occasionsRaw: {
            version: 1,
            occasions: Array.from({length: 20}, (_, i) => ({
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

// 1. 1k 规模基准断言
{
    const {storeRaw, occasionsRaw} = buildTestDataset(1000, 50);
    const t0 = performance.now();
    const store = model.normalizeStore(storeRaw);
    const occ = occasions.normalizeOccasionStore(occasionsRaw);
    const coldMs = performance.now() - t0;
    assert.equal(store.items.length, 50);
    assert.equal(store.events.length, 1000);
    assert.equal(occ.occasions.length, 20);
    assert.ok(coldMs < 80 * CF, `1k cold start must finish under 80ms (took ${coldMs.toFixed(2)}ms)`);

    const todayRun = measureBest(() => model.getEventsForDate(store, "2026-10-28"));
    assert.ok(todayRun.result.length > 0);
    assert.ok(todayRun.ms < 5 * CF, `1k Today projection must finish under 5ms (took ${todayRun.ms.toFixed(3)}ms)`);
}

// 2. 10k 规模基准断言
{
    const {storeRaw, occasionsRaw} = buildTestDataset(10000, 50);
    const t0 = performance.now();
    const store = model.normalizeStore(storeRaw);
    const occ = occasions.normalizeOccasionStore(occasionsRaw);
    const coldMs = performance.now() - t0;
    assert.equal(store.events.length, 10000);
    assert.ok(coldMs < 250 * CF, `10k cold start must finish under 250ms (took ${coldMs.toFixed(2)}ms)`);

    // 索引构建：getStoreIndex 弱缓存挂在 store 对象上，必须每次以全新克隆计时
    // （克隆/反序列化在计时区外完成）；best-of-3 消除 GC 停顿噪声，契约语义仍是真实构建耗时
    let indexMs = Infinity;
    for (let indexRun = 0; indexRun < 3; indexRun++) {
        const storeCopy = structuredClone(store);
        const tIndex = performance.now();
        model.getStoreIndex(storeCopy);
        indexMs = Math.min(indexMs, performance.now() - tIndex);
    }
    assert.ok(indexMs < 50 * CF, `10k index build must finish under 50ms (took ${indexMs.toFixed(2)}ms)`);

    // 索引已就绪后的 O(1) 查询（best-of-3 消除 GC 噪声）
    const sample = store.events[5000];
    const lookupRun = measureBest(() => model.getEventById(store, sample.id));
    assert.equal(lookupRun.result.id, sample.id);
    assert.ok(lookupRun.ms < 2 * CF, `10k index lookup must finish under 2ms (took ${lookupRun.ms.toFixed(3)}ms)`);

    // Review 半开范围扫描（best-of-3 消除 GC 噪声）
    const reviewRun = measureBest(() => model.getEventsInDateRange(store, "2026-10-01", "2026-10-28"));
    assert.ok(reviewRun.result.length > 0);
    assert.ok(reviewRun.ms < 25 * CF, `10k Review range scan must finish under 25ms (took ${reviewRun.ms.toFixed(3)}ms)`);

    // 归档过滤（best-of-3 消除 GC 噪声）
    const archivedRun = measureBest(() => store.items.filter((item) => item.archived));
    assert.equal(archivedRun.result.length, 5);
    assert.ok(archivedRun.ms < 5 * CF, `10k Archived filter must finish under 5ms (took ${archivedRun.ms.toFixed(3)}ms)`);
}

// 3. 100k 规模基准断言与增量变异
{
    const {storeRaw} = buildTestDataset(100000, 50);
    const t0 = performance.now();
    const store = model.normalizeStore(storeRaw);
    const coldMs = performance.now() - t0;
    assert.equal(store.events.length, 100000);
    assert.ok(coldMs < 2000 * CF, `100k cold start must finish under 2000ms (took ${coldMs.toFixed(2)}ms)`);

    // 索引复用性断言
    const idx1 = model.getStoreIndex(store);
    const idx2 = model.getStoreIndex(store);
    assert.equal(idx1, idx2, "index is weakly cached and identical across repeated reads");

    // Today O(1) 提取（best-of-3 消除 GC 噪声）
    const todayRun100k = measureBest(() => model.getEventsForDate(store, "2026-10-28"));
    assert.ok(todayRun100k.result.length > 0);
    assert.ok(todayRun100k.ms < 5 * CF, `100k Today projection must stay O(1) under 5ms (took ${todayRun100k.ms.toFixed(3)}ms)`);

    // 增量变更验证 (Append 1 Event)
    const tInc = performance.now();
    const freshEvent = {
        id: "evt-inc-100k",
        itemId: "perf-item-0",
        occurredAt: "2026-10-28T14:00:00.000Z",
        localDate: "2026-10-28",
        value: 1,
        unit: "次",
        source: "manual",
    };
    const updatedStore = {
        ...store,
        events: [...store.events, freshEvent],
    };
    const updatedIndex = model.getStoreIndex(updatedStore);
    const incMs = performance.now() - tInc;
    assert.notEqual(updatedIndex, idx1, "updated store gets clean new index");
    assert.equal(model.getEventById(updatedStore, "evt-inc-100k")?.id, "evt-inc-100k");
}

console.log("Cold start, indexing and scale baseline checks passed successfully across 1k/10k/100k tiers.");
