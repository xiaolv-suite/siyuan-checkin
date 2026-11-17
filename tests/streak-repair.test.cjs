/* 连击救赎断点消除战役 (Streak Repair Flow) 单元测试
   断言要求：
   1. 断签识别条件（计划+未记录+未请假，排除已打卡、已跳过、非排期、atMost戒除型）
   2. 连击接续（D-1 补卡后 currentStreak 无缝接续不清零）
   3. EMA 80% 折算数值（增益精确折算 80%，低于正常打卡高于漏做）
   4. 每月 2 次上限拦截（达到 2 次后 exhausted=true，跨月独立统计）
   5. badge 联动更新（可救赎习惯并入待办计数，救赎后待办数减少） */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const sourceRoot = path.join(__dirname, "..", "src");
const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-streak-repair-"));

const filesToCompile = [
    "types.ts",
    "record-step.ts",
    "quota.ts",
    "rules.ts",
    "date-keys.ts",
    "model.ts",
    path.join("features", "streak-repair.ts"),
    path.join("features", "habit-score.ts"),
];

fs.mkdirSync(path.join(outputRoot, "features"), {recursive: true});

for (const relPath of filesToCompile) {
    const source = fs.readFileSync(path.join(sourceRoot, relPath), "utf8");
    fs.writeFileSync(
        path.join(outputRoot, relPath.replace(/\.ts$/, ".js")),
        ts.transpileModule(source, {
            compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS},
        }).outputText,
    );
}

const model = require(path.join(outputRoot, "model.js"));
const streakRepair = require(path.join(outputRoot, "features", "streak-repair.js"));
const habitScore = require(path.join(outputRoot, "features", "habit-score.js"));

const {
    scanStreakRepairOpportunities,
    getMonthlyStreakRepairCount,
    MONTHLY_STREAK_REPAIR_LIMIT,
} = streakRepair;

const {
    computeEventStreaks,
    dateKey,
} = model;

const {
    buildHabitScoreSeries,
    scoreMultiplier,
} = habitScore;

console.log("Starting streak repair flow tests...");

const todayDate = new Date(2026, 10, 5, 12); // 2026-11-05
const todayKey = dateKey(todayDate);
const yesterdayDate = new Date(2026, 10, 4, 12); // 2026-11-04
const yesterdayKey = dateKey(yesterdayDate);

function makeTestItem(overrides = {}) {
    return {
        id: "habit-1",
        name: "每日晨跑",
        icon: "🏃",
        target: 1,
        unit: "次",
        kind: "binary",
        direction: "atLeast",
        createdDate: "2026-10-01",
        updatedAt: "2026-10-01T00:00:00.000Z",
        schedule: {type: "daily"},
        ...overrides,
    };
}

// ============================================================================
// 1. 断签识别条件测试
// ============================================================================
{
    const store = {
        version: 3,
        items: [makeTestItem()],
        events: [],
        eventTombstones: [],
        itemTombstones: [],
    };

    // Case A: 昨日计划打卡，但未记录且未请假 -> 识别为可救赎
    const oppsA = scanStreakRepairOpportunities(store, todayDate);
    assert.equal(oppsA.length, 1, "未记录且未请假的习惯应识别为可救赎");
    assert.equal(oppsA[0].item.id, "habit-1");
    assert.equal(oppsA[0].yesterdayKey, yesterdayKey);
    assert.equal(oppsA[0].exhausted, false);
    assert.equal(oppsA[0].monthlyRepairsUsed, 0);

    // Case B: 昨日已打卡 -> 不可救赎
    const storeCompleted = {
        ...store,
        events: [{
            id: "ev-1",
            itemId: "habit-1",
            localDate: yesterdayKey,
            occurredAt: `${yesterdayKey}T08:00:00.000Z`,
            value: 1,
            unit: "次",
            source: "manual",
        }],
    };
    const oppsB = scanStreakRepairOpportunities(storeCompleted, todayDate);
    assert.equal(oppsB.length, 0, "昨日已打卡的习惯不应重复救赎");

    // Case C: 昨日已请假 (skip) -> 不可救赎（请假本就不算断签）
    const storeSkipped = {
        ...store,
        events: [{
            id: "ev-skip-1",
            itemId: "habit-1",
            localDate: yesterdayKey,
            occurredAt: `${yesterdayKey}T08:00:00.000Z`,
            value: 1,
            unit: "次",
            source: "manual",
            kind: "skip",
        }],
    };
    const oppsC = scanStreakRepairOpportunities(storeSkipped, todayDate);
    assert.equal(oppsC.length, 0, "昨日已请假的习惯不应触发救赎卡片");

    // Case D: 昨日非排期日
    const storeOffSchedule = {
        ...store,
        items: [makeTestItem({
            schedule: {type: "weekly", weekdays: [1]}, // 仅周一排期；2026-11-04 是周三
        })],
    };
    const oppsD = scanStreakRepairOpportunities(storeOffSchedule, todayDate);
    assert.equal(oppsD.length, 0, "昨日非排期日的习惯不应被标记断签");

    // Case E: atMost 戒除型习惯 -> 不适用救赎打卡
    const storeAtMost = {
        ...store,
        items: [makeTestItem({direction: "atMost"})],
    };
    const oppsE = scanStreakRepairOpportunities(storeAtMost, todayDate);
    assert.equal(oppsE.length, 0, "atMost 戒除型习惯不适用补卡救赎");

    // Case F: 习惯已归档 -> 不适用
    const storeArchived = {
        ...store,
        items: [makeTestItem({archived: true})],
    };
    const oppsF = scanStreakRepairOpportunities(storeArchived, todayDate);
    assert.equal(oppsF.length, 0, "已归档习惯不适用救赎");

    console.log("✓ 断签识别条件断言全部通过（计划+未记录+未请假）");
}

// ============================================================================
// 2. 连击接续（不清零）测试
// ============================================================================
{
    const item = makeTestItem();
    // 假设 D-4, D-3, D-2 均有打卡
    const eventsBefore = [
        {id: "e-d4", itemId: item.id, localDate: "2026-11-01", occurredAt: "2026-11-01T08:00:00.000Z", value: 1, unit: "次", source: "manual"},
        {id: "e-d3", itemId: item.id, localDate: "2026-11-02", occurredAt: "2026-11-02T08:00:00.000Z", value: 1, unit: "次", source: "manual"},
        {id: "e-d2", itemId: item.id, localDate: "2026-11-03", occurredAt: "2026-11-03T08:00:00.000Z", value: 1, unit: "次", source: "manual"},
    ];

    const brokenStore = {
        version: 3,
        items: [item],
        events: [...eventsBefore],
        eventTombstones: [],
        itemTombstones: [],
    };

    // D-1 (2026-11-04) 缺失打卡，今日 (2026-11-05) 也未打卡
    const streakBroken = computeEventStreaks(brokenStore, todayDate).get(item.id);
    assert.equal(streakBroken, 0, "D-1 漏打卡时，今日连击数应清零为 0");

    // 执行救赎补卡：向昨日追加流水 (repair: true)
    const repairEvent = {
        id: "e-repair",
        itemId: item.id,
        localDate: yesterdayKey,
        occurredAt: `${yesterdayKey}T23:59:00.000Z`,
        value: 1,
        unit: "次",
        source: "manual",
        repair: true,
    };

    const repairedStore = {
        ...brokenStore,
        events: [...eventsBefore, repairEvent],
    };

    const streakRepaired = computeEventStreaks(repairedStore, todayDate).get(item.id);
    // 连击无缝接续：D-4(1), D-3(2), D-2(3), D-1(4) -> 连击数应为 4！
    assert.equal(streakRepaired, 4, "救赎补卡后，连击数应无缝接续（为 4）而不是归零");

    // 若今日也完成打卡
    const todayEvent = {
        id: "e-today",
        itemId: item.id,
        localDate: todayKey,
        occurredAt: `${todayKey}T09:00:00.000Z`,
        value: 1,
        unit: "次",
        source: "manual",
    };
    const fullStore = {
        ...repairedStore,
        events: [...repairedStore.events, todayEvent],
    };
    const streakToday = computeEventStreaks(fullStore, todayDate).get(item.id);
    assert.equal(streakToday, 5, "今日继续打卡后，连击递增为 5");

    console.log("✓ 连击接续断言全部通过（救赎后无缝接续不清零）");
}

// ============================================================================
// 3. EMA 80% 增益折算数值测试
// ============================================================================
{
    const freq = {numerator: 1, denominator: 1};
    const m = scoreMultiplier(freq);
    const initialScore = 50;

    // 正常完成 1 天：done = 1.0
    const normalDays = [{
        date: yesterdayKey,
        scheduled: true,
        skipped: false,
        completion: 1,
        repair: false,
    }];
    const normalResult = buildHabitScoreSeries(normalDays, freq, {initial: initialScore});
    const expectedNormalGain = (1 - m) * 100;
    const expectedNormalScore = Math.round((initialScore * m + expectedNormalGain) * 10) / 10;
    assert.equal(normalResult[0].score, expectedNormalScore, "正常打卡应获得 100% EMA 增益");

    // 救赎补卡 1 天：done = 0.8
    const repairDays = [{
        date: yesterdayKey,
        scheduled: true,
        skipped: false,
        completion: 1,
        repair: true,
    }];
    const repairResult = buildHabitScoreSeries(repairDays, freq, {initial: initialScore});
    const expectedRepairGain = 0.8 * (1 - m) * 100;
    const expectedRepairScore = Math.round((initialScore * m + expectedRepairGain) * 10) / 10;
    assert.equal(repairResult[0].score, expectedRepairScore, "救赎补卡应精确按 80% 折算 EMA 增益");

    // 漏打卡（未救赎）：done = 0
    const missedDays = [{
        date: yesterdayKey,
        scheduled: true,
        skipped: false,
        completion: 0,
    }];
    const missedResult = buildHabitScoreSeries(missedDays, freq, {initial: initialScore});
    const expectedMissedScore = Math.round((initialScore * m) * 10) / 10;
    assert.equal(missedResult[0].score, expectedMissedScore, "漏打卡未救赎时分值自然衰减");

    // 确认不等式：missed < repair < normal
    assert.ok(repairResult[0].score > missedResult[0].score, "救赎得分必须高于漏打卡衰减分");
    assert.ok(repairResult[0].score < normalResult[0].score, "救赎得分必须低于当日全额打卡分");

    console.log("✓ EMA 80% 增益折算数值断言全部通过");
}

// ============================================================================
// 4. 每月 2 次上限拦截测试
// ============================================================================
{
    const item = makeTestItem();
    const monthPrefix = yesterdayKey.slice(0, 7); // 2026-11

    const store = {
        version: 3,
        items: [item],
        events: [
            // 本月已存在 1 次救赎
            {
                id: "rep-1",
                itemId: item.id,
                localDate: `${monthPrefix}-01`,
                occurredAt: `${monthPrefix}-01T23:59:00.000Z`,
                value: 1,
                unit: "次",
                source: "manual",
                repair: true,
            },
        ],
        eventTombstones: [],
        itemTombstones: [],
    };

    // 已用 1 次
    assert.equal(getMonthlyStreakRepairCount(store, item.id, monthPrefix), 1);
    let opps = scanStreakRepairOpportunities(store, todayDate);
    assert.equal(opps[0].exhausted, false, "当月使用 1 次时，尚未超限");
    assert.equal(opps[0].monthlyRepairsUsed, 1);

    // 增加第 2 次救赎
    store.events.push({
        id: "rep-2",
        itemId: item.id,
        localDate: `${monthPrefix}-02`,
        occurredAt: `${monthPrefix}-02T23:59:00.000Z`,
        value: 1,
        unit: "次",
        source: "manual",
        repair: true,
    });

    assert.equal(getMonthlyStreakRepairCount(store, item.id, monthPrefix), 2);
    opps = scanStreakRepairOpportunities(store, todayDate);
    assert.equal(opps[0].exhausted, true, "当月达到 2 次上限时，必须标记 exhausted=true 拦截");
    assert.equal(opps[0].monthlyRepairsUsed, 2);

    // 上个月的救赎不占用本月配额
    store.events.push({
        id: "rep-old",
        itemId: item.id,
        localDate: "2026-10-15",
        occurredAt: "2026-10-15T23:59:00.000Z",
        value: 1,
        unit: "次",
        source: "manual",
        repair: true,
    });
    assert.equal(getMonthlyStreakRepairCount(store, item.id, monthPrefix), 2, "跨月救赎不应累加至本月");

    console.log("✓ 每月 2 次上限拦截断言全部通过");
}

// ============================================================================
// 5. Badge 联动更新测试
// ============================================================================
{
    const item1 = makeTestItem({id: "h-1", name: "早起"});
    const item2 = makeTestItem({id: "h-2", name: "阅读"});

    // 假设 item1 今日未打卡（今日待办 = 1）
    // item2 昨日漏打卡（可救赎待办 = 1）
    const store = {
        version: 3,
        items: [item1, item2],
        events: [],
        eventTombstones: [],
        itemTombstones: [],
    };

    // 模拟 getDueCount 逻辑
    function calcDue(s) {
        const activeItems = s.items.filter((i) => !i.archived);
        const scheduled = activeItems.filter((i) => i.schedule.type === "daily");
        const done = scheduled.filter((i) => s.events.some((e) => e.itemId === i.id && e.localDate === todayKey)).length;
        const todayDue = scheduled.length - done;
        const repairDue = scanStreakRepairOpportunities(s, todayDate).filter((o) => !o.exhausted).length;
        return todayDue + repairDue;
    }

    const initialDue = calcDue(store);
    // 今日待办 2 项 + 昨日可救赎 2 项 = 4 项
    assert.equal(initialDue, 4, "未打卡且昨日漏卡时，救赎项应并入待办总数");

    // 救赎 item2 的昨日漏卡（通过不可变 store 更新，确保 WeakMap 索引正确刷新）
    const storeAfterRepair = {
        ...store,
        events: [{
            id: "rep-item2",
            itemId: item2.id,
            localDate: yesterdayKey,
            occurredAt: `${yesterdayKey}T23:59:00.000Z`,
            value: 1,
            unit: "次",
            source: "manual",
            repair: true,
        }],
    };

    const afterRepairDue = calcDue(storeAfterRepair);
    // item2 昨日已救赎，可救赎项减少 1，待办数变为 3
    assert.equal(afterRepairDue, 3, "救赎成功后，待办数应实时减少 1");

    console.log("✓ Badge 联动更新断言全部通过");
}

console.log("\nAll Streak Repair Flow assertions passed successfully! 🩹🔥");
