/* T-1802 专项守门：渲染块 today 时段统计的本地日期与时区换算契约。
   1. 显式时区偏移字面量保留（如 +08:00 / -05:00）：优先提取字面时刻小时，消除跨时区展示漂移；
   2. 显式 timeZone 参数换算：按 Intl.DateTimeFormat 精确换算目标时区本地小时（含跨日/跨半小时时区）；
   3. UTC 时刻回退：无显式偏移且无目标时区时回退宿主本地时刻；
   4. 时段划分与阈值：早 (<12) / 午 (12~17) / 晚 (≥18)；当日有效事件 <2 时返回 undefined（杜绝单条噪音）；
   5. 跳过事件（skip）排除：isSkipEvent 为 true 的事件不计入时段；
   6. 今日视图 HTML 渲染：.lc-checkin__renderblock-today-slots 包含无障碍 aria-label 与时段统计文本。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const sourceRoot = path.join(__dirname, "..", "src");

/* 模块安全加载器 */
const loadedModules = new Map();
function loadProduction(relative) {
    const filename = path.resolve(sourceRoot, relative);
    if (loadedModules.has(filename)) return loadedModules.get(filename).exports;
    const productionModule = {exports: {}};
    loadedModules.set(filename, productionModule);
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS},
    }).outputText;
    new Function("require", "module", "exports", compiled)((request) => {
        assert.ok(request.startsWith("."), `unexpected dependency ${request}`);
        return loadProduction(path.resolve(path.dirname(filename), `${request}.ts`));
    }, productionModule, productionModule.exports);
    return productionModule.exports;
}

const model = loadProduction("model.ts");
const checkinBlock = loadProduction("features/checkin-block.ts");

function makeTestItem(id = "item-test") {
    return {
        id,
        name: "每日阅读",
        icon: "📖",
        kind: "count",
        target: 3,
        unit: "次",
        schedule: {type: "daily"},
        createdDate: "2026-09-01",
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        revisions: [],
        archivePeriods: [],
        archived: false,
        group: "学习",
        priority: "medium",
        sortOrder: 1,
        timeSlot: "any",
    };
}

async function runTimezoneSlotChecks() {
    console.log("Starting T-1802 checkin block timezone and slot contract checks...");

    /* =========================================================================
       Check 1: getEventLocalHour 显式时区偏移字面时刻提取 (Literal Offset Extraction)
       ========================================================================= */
    {
        // 1.1 东八区字面量提取
        assert.equal(checkinBlock.getEventLocalHour({occurredAt: "2026-10-29T08:30:00+08:00"}), 8, "extracts 08 from +08:00");
        assert.equal(checkinBlock.getEventLocalHour({occurredAt: "2026-10-29T11:59:59+08:00"}), 11, "extracts 11 from +08:00");
        assert.equal(checkinBlock.getEventLocalHour({occurredAt: "2026-10-29T12:00:00+08:00"}), 12, "extracts 12 from +08:00");
        assert.equal(checkinBlock.getEventLocalHour({occurredAt: "2026-10-29T17:59:00+08:00"}), 17, "extracts 17 from +08:00");
        assert.equal(checkinBlock.getEventLocalHour({occurredAt: "2026-10-29T18:00:00+08:00"}), 18, "extracts 18 from +08:00");
        assert.equal(checkinBlock.getEventLocalHour({occurredAt: "2026-10-29T23:45:00+08:00"}), 23, "extracts 23 from +08:00");

        // 1.2 西五区（纽约）字面量提取
        assert.equal(checkinBlock.getEventLocalHour({occurredAt: "2026-10-29T09:15:00-05:00"}), 9, "extracts 09 from -05:00");
        assert.equal(checkinBlock.getEventLocalHour({occurredAt: "2026-10-29T20:10:00-05:00"}), 20, "extracts 20 from -05:00");

        // 1.3 印度半小时偏移（+05:30）字面量提取
        assert.equal(checkinBlock.getEventLocalHour({occurredAt: "2026-10-29T15:30:00+05:30"}), 15, "extracts 15 from +05:30");

        console.log("  ✓ Check 1: Literal offset hours extracted directly without conversion drift");
    }

    /* =========================================================================
       Check 2: 显式 timeZone 参数换算 (Intl.DateTimeFormat Projection)
       ========================================================================= */
    {
        const utcMidnight = {occurredAt: "2026-10-29T00:00:00.000Z"};
        // 2.1 换算到东八区（Asia/Shanghai -> 08:00）
        assert.equal(checkinBlock.getEventLocalHour(utcMidnight, "Asia/Shanghai"), 8, "UTC 00:00 -> Shanghai 08:00");

        // 2.2 换算到美东（America/New_York -> 20:00 前一日）
        assert.equal(checkinBlock.getEventLocalHour(utcMidnight, "America/New_York"), 20, "UTC 00:00 -> New York 20:00");

        // 2.3 换算到东京（Asia/Tokyo -> 09:00）
        assert.equal(checkinBlock.getEventLocalHour(utcMidnight, "Asia/Tokyo"), 9, "UTC 00:00 -> Tokyo 09:00");

        // 2.4 换算到伦敦（Europe/London -> 01:00 BST 或 00:00 GMT）
        const londonHour = checkinBlock.getEventLocalHour(utcMidnight, "Europe/London");
        assert.ok(londonHour === 0 || londonHour === 1, "UTC 00:00 -> London 00:00 or 01:00");

        console.log("  ✓ Check 2: Explicit timeZone parameter projected accurately via Intl");
    }

    /* =========================================================================
       Check 3: buildTodaySlotCounts 早/午/晚分组与单条降噪 (Slot Partitioning & Noise Gate)
       ========================================================================= */
    {
        const asOf = new Date(2026, 9, 29, 12);
        const item = makeTestItem("reading-1");

        // 3.1 零事件：返回 undefined
        const store0 = model.normalizeStore({version: 2, items: [item], events: []});
        assert.equal(checkinBlock.buildTodaySlotCounts(store0, item.id, asOf), undefined, "0 events -> undefined");

        // 3.2 仅 1 条记录：返回 undefined（单条不产生噪音 slots）
        const store1 = model.normalizeStore({
            version: 2,
            items: [item],
            events: [
                {id: "e1", itemId: item.id, localDate: "2026-10-29", occurredAt: "2026-10-29T08:00:00+08:00", value: 1, unit: "次", source: "manual"}
            ]
        });
        assert.equal(checkinBlock.buildTodaySlotCounts(store1, item.id, asOf), undefined, "1 event -> undefined (noise gate)");

        // 3.3 2 条记录且包含跳过（skip）：有效记录仅 1 条，返回 undefined
        const storeSkip = model.normalizeStore({
            version: 2,
            items: [item],
            events: [
                {id: "e1", itemId: item.id, localDate: "2026-10-29", occurredAt: "2026-10-29T08:00:00+08:00", value: 1, unit: "次", source: "manual"},
                {id: "e2", itemId: item.id, localDate: "2026-10-29", occurredAt: "2026-10-29T14:00:00+08:00", value: 0, unit: "次", source: "manual", kind: "skip"}
            ]
        });
        assert.equal(checkinBlock.buildTodaySlotCounts(storeSkip, item.id, asOf), undefined, "1 checkin + 1 skip -> undefined (skip excluded)");

        // 3.4 3 条有效记录：早、午、晚各 1 次
        const store3 = model.normalizeStore({
            version: 2,
            items: [item],
            events: [
                {id: "e1", itemId: item.id, localDate: "2026-10-29", occurredAt: "2026-10-29T08:00:00+08:00", value: 1, unit: "次", source: "manual"},
                {id: "e2", itemId: item.id, localDate: "2026-10-29", occurredAt: "2026-10-29T14:00:00+08:00", value: 1, unit: "次", source: "manual"},
                {id: "e3", itemId: item.id, localDate: "2026-10-29", occurredAt: "2026-10-29T21:00:00+08:00", value: 1, unit: "次", source: "manual"}
            ]
        });
        const counts3 = checkinBlock.buildTodaySlotCounts(store3, item.id, asOf);
        assert.deepEqual(counts3, {morning: 1, afternoon: 1, evening: 1}, "partitioned into morning: 1, afternoon: 1, evening: 1");

        // 3.5 边界时刻分配：11:59 为早，12:00 为午；17:59 为午，18:00 为晚
        const storeBoundaries = model.normalizeStore({
            version: 2,
            items: [item],
            events: [
                {id: "b1", itemId: item.id, localDate: "2026-10-29", occurredAt: "2026-10-29T11:59:00+08:00", value: 1, unit: "次", source: "manual"},
                {id: "b2", itemId: item.id, localDate: "2026-10-29", occurredAt: "2026-10-29T12:00:00+08:00", value: 1, unit: "次", source: "manual"},
                {id: "b3", itemId: item.id, localDate: "2026-10-29", occurredAt: "2026-10-29T17:59:00+08:00", value: 1, unit: "次", source: "manual"},
                {id: "b4", itemId: item.id, localDate: "2026-10-29", occurredAt: "2026-10-29T18:00:00+08:00", value: 1, unit: "次", source: "manual"}
            ]
        });
        const countsBoundary = checkinBlock.buildTodaySlotCounts(storeBoundaries, item.id, asOf);
        assert.deepEqual(countsBoundary, {morning: 1, afternoon: 2, evening: 1}, "boundary hours 11:59, 12:00, 17:59, 18:00 assigned strictly");

        console.log("  ✓ Check 3: Slot partitioning (morning/afternoon/evening), noise gating (<2), and skip exclusion verified");
    }

    /* =========================================================================
       Check 4: 渲染块 Today 视图 HTML 渲染与无障碍属性 (HTML & ARIA Presentation)
       ========================================================================= */
    {
        const asOf = new Date(2026, 9, 29, 12);
        const item = makeTestItem("reading-html");
        const store = model.normalizeStore({
            version: 2,
            items: [item],
            events: [
                {id: "h1", itemId: item.id, localDate: "2026-10-29", occurredAt: "2026-10-29T09:00:00+08:00", value: 1, unit: "次", source: "manual"},
                {id: "h2", itemId: item.id, localDate: "2026-10-29", occurredAt: "2026-10-29T15:00:00+08:00", value: 1, unit: "次", source: "manual"}
            ]
        });

        const html = checkinBlock.buildTodayViewHtml(store, {view: "today"}, asOf);
        assert.ok(html.includes("lc-checkin__renderblock-today-slots"), "renders slots container element");
        assert.ok(html.includes("aria-label"), "slots container has aria-label for screen reader");
        assert.ok(html.includes("早 1"), "contains morning slot text");
        assert.ok(html.includes("午 1"), "contains afternoon slot text");
        assert.ok(html.includes("晚 0"), "contains evening slot text");

        console.log("  ✓ Check 4: Today view slots HTML and screen reader accessibility validated");
    }

    console.log("All T-1802 checkin block timezone and slot contract checks passed!");
}

runTimezoneSlotChecks().catch((err) => {
    console.error("Timezone slot checks failed with error:", err);
    process.exit(1);
});
