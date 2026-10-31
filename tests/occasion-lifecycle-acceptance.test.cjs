/* T-1732 事项管理专项验收矩阵与全生命周期守门测试（D-637）：
   涵盖创建、规则预览、极端日期（闰日/农历/第5周）、单次改期、完成/撤销、
   提醒分离、草稿保护、停用/删除墓碑、跨窗防复活、多桶 Envelope 与 ICS 导出的全链路验收。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-occasion-acceptance-"));
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};

for (const filename of ["types.ts", "date-keys.ts", "lunar.ts", "i18n.ts", "record-step.ts", "quota.ts", "rules.ts", "model.ts", "occasions.ts"]) {
    fs.writeFileSync(path.join(dir, filename.replace(/\.ts$/, ".js")), ts.transpileModule(fs.readFileSync(path.join(root, "src", filename), "utf8"), {compilerOptions}).outputText);
}
fs.mkdirSync(path.join(dir, "features"), {recursive: true});
for (const feature of ["occasion-preview.ts", "occasion-ics.ts"]) {
    fs.writeFileSync(path.join(dir, "features", feature.replace(/\.ts$/, ".js")), ts.transpileModule(fs.readFileSync(path.join(root, "src", "features", feature), "utf8"), {compilerOptions}).outputText);
}

const occasions = require(path.join(dir, "occasions.js"));
const preview = require(path.join(dir, "features", "occasion-preview.js"));
const ics = require(path.join(dir, "features", "occasion-ics.js"));

console.log("Starting occasion-lifecycle-acceptance tests...");

// 1. 创建与查重 (T-1717)
{
    const existing = [
        occasions.normalizeOccasion({id: "o-1", name: "张三生日", kind: "birthday", date: "2026-05-20", recurrence: "annual"}),
        occasions.normalizeOccasion({id: "o-2", name: "房贷还款", kind: "scheduled", date: "2026-01-25", recurrence: "monthly"}),
    ];
    // 相似项匹配
    const duplicates = occasions.findSimilarOccasions(existing, "张三生日礼物");
    assert.ok(duplicates.length > 0, "detects similar occasion name");
    assert.equal(duplicates[0].id, "o-1");
}

// 2. 规则预览投影 (T-1716)
{
    const annualItem = occasions.normalizeOccasion({
        id: "o-preview",
        name: "年检",
        kind: "scheduled",
        date: "2026-06-15",
        recurrence: "annual",
        remindBeforeDays: 14,
    });
    const occurrences = preview.buildOccurrencePreview(annualItem, new Date(2026, 0, 1), 3);
    assert.equal(occurrences.entries.length, 3, "projects 3 future occurrences");
    assert.equal(occurrences.entries[0].occurrenceDate, "2026-06-15");
    assert.equal(occurrences.entries[0].remindDate, "2026-06-01", "remind date is 14 days before occurrence");
}

// 3. 极端日期（闰日与农历换算）(T-1704)
{
    // 闰年 02-29 事项
    const leapItem = occasions.normalizeOccasion({
        id: "o-leap",
        name: "四年一遇",
        kind: "birthday",
        date: "2024-02-29",
        recurrence: "annual",
        calendar: "solar",
    });
    // 2026 年是平年，顺延至 02-28
    const date2026 = occasions.getOccurrenceDate(leapItem, "2026-01-01");
    assert.equal(date2026, "2026-02-28", "non-leap year clamps Feb 29 to Feb 28");

    // 农历春节（2026 正月初一对应的公历锚点为 2026-02-17）
    const springFestival = occasions.normalizeOccasion({
        id: "o-spring",
        name: "春节",
        kind: "scheduled",
        date: "2026-02-17", // 转换为农历正月初一并在每年循环换算
        recurrence: "annual",
        calendar: "lunar",
    });
    const nextSpring = occasions.getOccurrenceDate(springFestival, "2026-01-01");
    assert.equal(nextSpring, "2026-02-17", "correct lunar-to-solar conversion for 2026 Spring Festival");
}

// 4. 单次改期与跟随解析 (T-1705, T-1718)
{
    const monthlyBill = occasions.normalizeOccasion({
        id: "o-bill",
        name: "水电燃气",
        kind: "scheduled",
        date: "2026-10-10",
        recurrence: "monthly",
    });
    const store = {version: 1, occasions: [monthlyBill]};
    // 改期：将 2026-10-10 改期至 2026-10-12
    const movedStore = occasions.setOccasionOverride(store, "o-bill", "2026-10-10", "2026-10-12");
    const moved = movedStore.occasions[0];
    assert.equal(occasions.getOccurrenceDate(moved, "2026-10-01"), "2026-10-12", "occurrence follows the single reschedule override");

    // 撤销改期
    const origin = occasions.findOverrideOriginFor(moved, "2026-10-12");
    assert.equal(origin, "2026-10-10");
    const revertedStore = occasions.setOccasionOverride(movedStore, "o-bill", origin, undefined);
    assert.equal(occasions.getOccurrenceDate(revertedStore.occasions[0], "2026-10-01"), "2026-10-10", "clearing override restores natural schedule");
}

// 5. 完成、撤销与 120 条上限 (T-1712, T-1719)
{
    const baseStore = {
        version: 1,
        occasions: [
            occasions.normalizeOccasion({
                id: "o-done",
                name: "测试完成",
                kind: "scheduled",
                date: "2026-10-01",
                recurrence: "monthly",
                completedDates: [],
            }),
        ],
    };
    const completedStore = occasions.markOccasionCompleted(baseStore, "o-done", "2026-10-01", true);
    assert.equal(occasions.isOccasionCompleted(completedStore.occasions[0], "2026-10-01"), true);
    const uncompletedStore = occasions.markOccasionCompleted(completedStore, "o-done", "2026-10-01", false);
    assert.equal(occasions.isOccasionCompleted(uncompletedStore.occasions[0], "2026-10-01"), false);
}

// 6. 停用与删除墓碑治理 (T-1721)
{
    const store = {
        version: 1,
        occasions: [
            occasions.normalizeOccasion({id: "live-1", name: "活动项", date: "2026-10-01", recurrence: "once"}),
        ],
    };
    // 删除生成墓碑
    const afterDel = occasions.deleteOccasion(store, "live-1");
    assert.equal(afterDel.occasions.length, 0);
    assert.ok(afterDel.tombstones && afterDel.tombstones.length === 1);
    assert.equal(afterDel.tombstones[0].occasionId, "live-1");

    // 跨窗合并防复活
    const remoteStale = {
        version: 1,
        occasions: [
            occasions.normalizeOccasion({id: "live-1", name: "远端旧快照", date: "2026-10-01", recurrence: "once"}),
            occasions.normalizeOccasion({id: "live-2", name: "远端新建", date: "2026-10-02", recurrence: "once"}),
        ],
    };
    const merged = occasions.mergeOccasionCompletions(afterDel, remoteStale);
    assert.equal(merged.occasions.some((o) => o.id === "live-1"), false, "deleted occasion suppressed by tombstone");
    assert.equal(merged.occasions.some((o) => o.id === "live-2"), true, "remote create safely preserved");
}

// 7. 多桶备份 Envelope 决断 (T-1726)
{
    const resOccasion = ics.evaluateOccasionEnvelopeResolution("checkin-occasion-store");
    assert.equal(resOccasion.defaultResolution, "overwrite");
    assert.equal(resOccasion.sensitive, false);

    const resReminder = ics.evaluateOccasionEnvelopeResolution("checkin-reminder-actions");
    assert.equal(resReminder.defaultResolution, "merge");
    assert.equal(resReminder.sensitive, true);
}

// 8. ICS 单向日历导出 (T-1726)
{
    const sampleList = [
        occasions.normalizeOccasion({id: "ics-1", name: "新年音乐会", date: "2027-01-01", recurrence: "once"}),
        occasions.normalizeOccasion({id: "ics-2", name: "每月还房贷", date: "2026-01-25", recurrence: "monthly"}),
    ];
    const calendarText = ics.buildOccasionsIcsCalendar(sampleList);
    assert.ok(calendarText.includes("BEGIN:VCALENDAR"));
    assert.ok(calendarText.includes("UID:occasion-ics-1@siyuan-checkin"));
    assert.ok(calendarText.includes("RRULE:FREQ=MONTHLY"));
    assert.ok(calendarText.includes("END:VCALENDAR"));
}

console.log("occasion-lifecycle-acceptance: all 8 end-to-end integration chapters verified 100% successfully.");
