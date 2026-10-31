/* 2026-10-31 全量审计收口回归测试（BP-001 ~ BP-005）：
   1. BP-001：editor.ts 自然语言起草区 0 内联 style 硬编码，全部走统一令牌类；
   2. BP-002：renderQuantitativeHeatmap 空 days 不崩溃、atMost 戒除口径正确、回顾分析聚焦筛选联动热力图/均衡/LifeLog；
   3. BP-003：D-713 习惯韧性条与薄弱星期诊断完整接入洞察页与回顾强度面板；
   4. BP-004：AI 草案历史持久化（ai-draft-history.json 归一化/TTL/防复活）与新建页习惯/事项消歧跳转接线；
   5. BP-005：洞察页 CSV 导出与事项页 ICS 导出接线。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-audit-1031-"));

function transpile(relPath) {
    const srcPath = path.join(root, "src", relPath);
    const outPath = path.join(tmp, relPath.replace(/\.ts$/, ".js"));
    fs.mkdirSync(path.dirname(outPath), {recursive: true});
    const out = ts.transpileModule(fs.readFileSync(srcPath, "utf8"), {compilerOptions}).outputText;
    fs.writeFileSync(outPath, out, "utf8");
    return require(outPath);
}

try {
    // 1. BP-001: editor.ts AI 起草区零内联 style 硬编码
    const editorSrc = fs.readFileSync(path.join(root, "src", "render", "editor.ts"), "utf8");
    const aiBlockStart = editorSrc.indexOf("data-ai-draft-disclosure");
    const aiBlockEnd = editorSrc.indexOf("</details>", aiBlockStart);
    assert.ok(aiBlockStart > 0 && aiBlockEnd > aiBlockStart, "editor.ts must render [data-ai-draft-disclosure]");
    const aiMarkup = editorSrc.slice(aiBlockStart, aiBlockEnd);
    assert.ok(!/\bstyle=/.test(aiMarkup), "AI draft section in editor.ts must not contain raw inline style= attributes");

    // 2. BP-002: 定量热力图空数组防崩溃 + atMost 口径
    transpile("types.ts");
    transpile("i18n.ts");
    transpile("lunar.ts");
    transpile("date-keys.ts");
    transpile("record-step.ts");
    transpile("quota.ts");
    transpile("rules.ts");
    transpile("occasions.ts");
    transpile("catalog.ts");
    const model = transpile("model.ts");
    const charts = transpile("charts.ts");
    const analytics = transpile("analytics.ts");
    transpile("features/schedule-validate.ts");
    transpile("features/project-draft.ts");
    transpile("features/name-inference.ts");
    transpile("features/natural-language-draft.ts");
    const aiGov = transpile("features/ai-draft-governance.ts");
    const occasionIcs = transpile("features/occasion-ics.ts");
    transpile("export.ts");
    const insightRecords = transpile("features/insight-records.ts");

    const emptySvg = charts.renderQuantitativeHeatmap({
        year: 2026,
        unit: "毫升",
        target: 2000,
        days: [],
        completedDays: 0,
        totalRecordedDays: 0,
        totalValue: 0,
    });
    assert.match(emptySvg, /<svg class="lc-yearheatmap lc-yearheatmap--quantitative"/, "empty days must render valid quantitative SVG without throwing");

    const atMostQuant = charts.buildQuantitativeHeatmap(
        [
            {id: "e1", itemId: "limit-cup", localDate: "2026-06-01", occurredAt: "2026-06-01T10:00:00.000Z", value: 1, unit: "杯", source: "manual"},
            {id: "e2", itemId: "limit-cup", localDate: "2026-06-02", occurredAt: "2026-06-02T10:00:00.000Z", value: 3, unit: "杯", source: "manual"},
        ],
        1,
        2026,
        {unit: "杯", itemId: "limit-cup", direction: "atMost"},
    );
    assert.equal(atMostQuant.completedDays, 1, "atMost item must not count breach day (3 > 1) as completed");

    // 3. BP-002 & BP-003: 回顾分析聚焦联动 + 习惯韧性条 & 薄弱日诊断接线
    const reviewSrc = fs.readFileSync(path.join(root, "src", "render", "review.ts"), "utf8");
    const indexSrc = fs.readFileSync(path.join(root, "src", "index.ts"), "utf8");
    assert.match(reviewSrc, /renderQuantitativeHeatmap\(/, "review.ts must render 4-tier quantitative heatmap on item focus");
    assert.match(reviewSrc, /renderHabitStrengthBar\(/, "review.ts must render EMA habit strength bar");
    assert.match(reviewSrc, /diagnoseWeakestDayOfWeek\(/, "review.ts must wire weakest day-of-week diagnosis");
    assert.match(reviewSrc, /else if \(filterGroupId\)\s*\{\s*const groupNames/, "review.ts LifeLog must filter by filterGroupId when group focus is active");
    assert.match(indexSrc, /renderHabitStrengthBar\(/, "index.ts Insights must render EMA habit strength bar");
    assert.match(indexSrc, /diagnoseWeakestDayOfWeek\(/, "index.ts Insights must wire weakest day-of-week diagnosis");

    // Verify archived item can also be diagnosed when explicitly requested by itemId
    const store = model.createDefaultStore();
    const archivedItem = model.normalizeItem({
        id: "arch-1",
        name: "历史冥想",
        icon: "🧘",
        kind: "binary",
        target: 1,
        unit: "次",
        archived: true,
        schedule: {type: "daily"},
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-10-30T00:00:00.000Z",
        createdDate: "2026-09-01",
    });
    store.items = [archivedItem];
    const evs = [];
    for (let i = 0; i < 28; i++) {
        const d = new Date(2026, 9, 30 - i);
        if (d.getDay() !== 6) {
            const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            evs.push({id: `ev-${i}`, itemId: "arch-1", localDate: dk, occurredAt: `${dk}T09:00:00.000Z`, value: 1, unit: "次", source: "manual"});
        }
    }
    store.events = evs;
    const archDiag = analytics.diagnoseWeakestDayOfWeek(store, {days: 28, itemId: "arch-1", asOf: new Date(2026, 9, 30)});
    assert.ok(archDiag && archDiag.hasWeakness && archDiag.weakestDay.dayOfWeek === 6, "archived item explicit inspection must compute weakest weekday");

    // 4. BP-004: AI 草案历史持久化归一化与新建页事项消歧接线
    assert.equal(aiGov.AI_DRAFT_HISTORY_STORAGE_NAME, "ai-draft-history.json");
    assert.match(indexSrc, /AI_DRAFT_HISTORY_STORAGE_NAME/, "index.ts must persist and load ai-draft-history.json");
    assert.match(indexSrc, /reconcileCrossWindowAiDraftBuckets/, "index.ts must reconcile cross-window AI draft buckets without zombie resurrection");
    const bindEditorSrc = fs.readFileSync(path.join(root, "src", "render", "bind-editor.ts"), "utf8");
    assert.match(bindEditorSrc, /generateAiIntentEnvelope\(/, "bind-editor.ts must classify habit vs occasion intent");
    assert.match(bindEditorSrc, /ai-draft-to-occasion/, "bind-editor.ts must bind occasion disambiguation switch");

    const nowIso = "2026-10-31T10:00:00.000Z";
    const recorded = aiGov.recordAiDraftHistoryEntry(aiGov.createEmptyAiDraftHistoryBucket(), {
        id: "aid_persist_1",
        summary: "妈妈生日 (2026-11-12)",
        intentType: "occasion",
        source: "local",
        draftPayload: {name: "妈妈生日", date: "2026-11-12", kind: "birthday", recurrence: "annual", remindBeforeDays: 3, note: ""},
        nowIso,
    });
    const roundtripped = aiGov.normalizeAiDraftHistoryBucket(JSON.stringify(recorded.bucket), nowIso);
    assert.equal(roundtripped.entries.length, 1);
    assert.equal(roundtripped.entries[0].id, "aid_persist_1");
    const expired = aiGov.normalizeAiDraftHistoryBucket(JSON.stringify(recorded.bucket), "2026-11-15T10:00:00.000Z");
    assert.equal(expired.entries.length, 0, "7-day TTL must prune expired entries on reload");

    // 5. BP-005: 洞察 CSV 导出与事项 ICS 导出接线
    assert.match(indexSrc, /data-insight-export-csv/, "Insights view must render CSV export button");
    assert.match(indexSrc, /exportInsightRecordsCsv/, "index.ts must implement exportInsightRecordsCsv");
    assert.match(indexSrc, /exportOccasionsIcs/, "index.ts must implement exportOccasionsIcs");
    const occasionsSrc = fs.readFileSync(path.join(root, "src", "render", "occasions.ts"), "utf8");
    assert.match(occasionsSrc, /data-action="export-occasion-ics"/, "Occasions view must render ICS export button");

    const csvOut = insightRecords.serializeInsightRecordsCsv(archivedItem, store.events.slice(0, 2));
    assert.match(csvOut, /eventId,itemId,itemName/, "Insight CSV export must include standard header");
    const icsOut = occasionIcs.buildOccasionsIcsCalendar([
        {id: "occ-1", name: "体检预约", kind: "scheduled", date: "2026-11-20", recurrence: "once", remindBeforeDays: 1, note: "空腹", enabled: true, completedDates: [], createdAt: nowIso, updatedAt: nowIso},
    ], {baseYear: 2026});
    assert.match(icsOut, /BEGIN:VCALENDAR[\s\S]*SUMMARY:体检预约[\s\S]*END:VCALENDAR/, "Occasion ICS export must build valid RFC 5545 calendar");

    console.log("audit-2026-10-31-closure: all BP-001 ~ BP-005 assertions passed.");
} finally {
    fs.rmSync(tmp, {recursive: true, force: true});
}
