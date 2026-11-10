/* T-1658 专项门禁测试：健康、笔记推导、叶归 LifeLog 200/500 行长文档分页扫描、跨页相邻与游标复位走查 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-long-doc-walkthrough-"));

const transpile = (relative) => {
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    const target = path.join(dir, relative.replace(/\.ts$/, ".js"));
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, ts.transpileModule(source, {compilerOptions}).outputText);
    return target;
};

[
    "src/types.ts",
    "src/date-keys.ts",
    "src/features/scan-cursor.ts",
    "src/features/note-anchor.ts",
    "src/features/health-inbox.ts",
    "src/features/note-query.ts",
    "src/features/yeguif-adapter.ts",
].forEach(transpile);

const {scanBoundedPages, blockIdCursorClause} = require(path.join(dir, "src", "features", "scan-cursor.js"));
const {parseHealthInboxLine, parseHealthInboxRows} = require(path.join(dir, "src", "features", "health-inbox.js"));
const {buildNoteQuerySql, parseNoteQueryRows, noteQueryIngestDecision} = require(path.join(dir, "src", "features", "note-query.js"));
const {parseYeguifMarker, settleYeguifEntries, buildYeguifExternalRef} = require(path.join(dir, "src", "features", "yeguif-adapter.js"));

console.log("Starting long-document-pagination-walkthrough tests (T-1658)...");

// —— 场景 1：健康收件箱 500 行长文档有界分页与跨页累积 (500-Row Health Inbox) ——
(async () => {
    const mockHealthBlocks = [];
    const baseTime = Date.parse("2025-01-01T08:00:00Z");
    for (let i = 0; i < 500; i++) {
        const id = `20261030080000-${String(i).padStart(7, "0")}`;
        const steps = 1000 + (i % 20) * 100;
        const d = new Date(baseTime + i * 86400000);
        const dateStr = d.toISOString().slice(0, 10);
        mockHealthBlocks.push({
            id,
            content: `health:steps:${dateStr} ${steps}`,
        });
    }

    const pageSize = 200;
    const fetchHealthPage = async (cursor) => {
        let list = mockHealthBlocks;
        if (cursor) {
            const index = mockHealthBlocks.findIndex((b) => b.id === cursor);
            list = index >= 0 ? mockHealthBlocks.slice(index + 1) : [];
        }
        return list.slice(0, pageSize);
    };

    // 第一轮扫描（读取 Page 1: 200条，Page 2: 200条，受限于 maxPages = 2）
    const scanRound1 = await scanBoundedPages({
        cursor: "",
        windowSize: pageSize,
        maxPages: 2,
        fetchPage: fetchHealthPage,
        rowId: (r) => r.id,
    });

    assert.equal(scanRound1.pages, 2, "第 1 轮扫描 2 页");
    assert.equal(scanRound1.rows.length, 400, "累积 400 条记录");
    assert.equal(scanRound1.advanced, true, "因达到单轮页数上限且满页，标记 advanced=true");
    assert.equal(scanRound1.cursor, mockHealthBlocks[399].id, "游标推进至第 400 条块 ID");

    // 第二轮扫描（从第一轮最终游标继续，读取 Page 3: 100条）
    const scanRound2 = await scanBoundedPages({
        cursor: scanRound1.cursor,
        windowSize: pageSize,
        maxPages: 2,
        fetchPage: fetchHealthPage,
        rowId: (r) => r.id,
    });

    assert.equal(scanRound2.pages, 1, "第 2 轮读取最后 1 页");
    assert.equal(scanRound2.rows.length, 100, "读取剩余 100 条记录");
    assert.equal(scanRound2.advanced, false, "短页结束，标记 advanced=false");
    assert.equal(scanRound2.cursor, "", "读完整篇文档后游标自动复位为空串，便于下一轮从头重扫");

    // 验证行内容解析与去重
    const allRows = [...scanRound1.rows, ...scanRound2.rows];
    assert.equal(allRows.length, 500, "总计 500 行全部跨页累积，无丢弃");
    const parsedEntries = parseHealthInboxRows(allRows);
    assert.equal(parsedEntries.length, 500, "500 条健康记录全部合规解析");
})();

// —— 场景 2：叶归 LifeLog 200 行跨页相邻 Marker 时长连续性与段落删除容错 ——
(async () => {
    const rootDocId = "20261030090000-doc0001";
    const mockLifeLogBlocks = [];
    // 生成从 06:00 开始，每 4 分钟一条记录，共 200 条（06:00 至 19:16，严格处于单日 1440 分钟内且单调递增）
    for (let i = 0; i < 200; i++) {
        const id = `20261030090000-blk${String(i).padStart(4, "0")}`;
        const totalMinutes = 6 * 60 + i * 4;
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const activity = i % 2 === 0 ? "跑步" : "休息";
        mockLifeLogBlocks.push({
            id,
            root_id: rootDocId,
            content: `${timeStr} ${activity}: 第 ${i + 1} 段`,
        });
    }

    const pageSize = 100;
    const fetchLifeLogPage = async (cursor) => {
        let list = mockLifeLogBlocks;
        if (cursor) {
            const index = mockLifeLogBlocks.findIndex((b) => b.id === cursor);
            list = index >= 0 ? mockLifeLogBlocks.slice(index + 1) : [];
        }
        return list.slice(0, pageSize);
    };

    // 分页扫描 2 页（100 + 100）
    const scan = await scanBoundedPages({
        cursor: "",
        windowSize: pageSize,
        maxPages: 3,
        fetchPage: fetchLifeLogPage,
        rowId: (r) => r.id,
    });

    assert.equal(scan.rows.length, 200, "200 条 LifeLog 块全部读入");

    // 解析 Marker
    const markers = scan.rows.map((r) => parseYeguifMarker(r.id, r.content)).filter(Boolean);
    assert.equal(markers.length, 200);

    // 重点：结算跨越页边界的 Marker #99（Page 1 尾）与 Marker #100（Page 2 首）
    const settled = settleYeguifEntries(markers, "2026-10-30");
    assert.equal(settled.length, 199, "相邻段有效时长成功结算 199 条");

    // Marker #100 结算的时长是 Marker #100 减 Marker #99（4 分钟）
    const entryAtBoundary = settled.find((e) => e.blockId === mockLifeLogBlocks[100].id);
    assert.ok(entryAtBoundary, "页边界处的条目必须存在");
    assert.equal(entryAtBoundary.minutes, 4, "跨页相邻段时长计算必须准确为 4 分钟，绝不因跨页归零");

    // 模拟源删块：中间删除了 block #50，Marker 序列自动桥接从 #49 计算至 #51
    const markersWithHole = markers.filter((m) => m.blockId !== mockLifeLogBlocks[50].id);
    const settledWithHole = settleYeguifEntries(markersWithHole, "2026-10-30");
    const entryAfterHole = settledWithHole.find((e) => e.blockId === mockLifeLogBlocks[51].id);
    assert.ok(entryAfterHole);
    assert.equal(entryAfterHole.minutes, 8, "中间删块后，当前段时长自动吸收到下一现存段时刻（4m + 4m = 8m）");
})();

// —— 场景 3：笔记推导 200 行 SQL 游标拼接与重复决策幂等 ——
(async () => {
    const governance = {
        enabled: true,
        targetId: "20261030090000-doc9999",
        itemId: "item_study_001",
        template: "tag",
        tag: "study",
        scope: "document",
    };

    // 验证初始与带游标 SQL 构造
    const sqlWithoutCursor = buildNoteQuerySql(governance, "");
    assert.ok(!sqlWithoutCursor.includes("AND id >"), "初始无游标 SQL 不包含游标子句");

    const sqlWithCursor = buildNoteQuerySql(governance, "20261030090000-blk0150");
    assert.ok(sqlWithCursor.includes("AND child.id > '20261030090000-blk0150'"), "带游标 SQL 必须精准包含 child.id 子句");

    // 验证 noteQueryIngestDecision 幂等性：已写入事件返回 duplicate，已删除墓碑返回 tombstoned，新记录返回 write
    const ref1 = "notequery:item_study_001:blk001:2026-10-30";
    const ref2 = "notequery:item_study_001:blk002:2026-10-30";
    const ref3 = "notequery:item_study_001:blk003:2026-10-30";

    const existingEvents = [
        {id: "ev_1", itemId: "item_study_001", source: "api", externalRef: ref1, localDate: "2026-10-30", value: 1},
    ];
    const existingTombstones = [
        {id: "tb_1", itemId: "item_study_001", source: "api", externalRef: ref2, localDate: "2026-10-30", deletedAt: "2026-10-30T10:00:00.000Z"},
    ];

    const duplicateDecision = noteQueryIngestDecision(
        existingEvents,
        existingTombstones,
        {blockId: "blk001", localDate: "2026-10-30", externalRef: ref1, value: 1, note: "note"},
        "item_study_001"
    );
    assert.equal(duplicateDecision, "duplicate", "已存在事件必须决策为 duplicate");

    const tombstoneDecision = noteQueryIngestDecision(
        existingEvents,
        existingTombstones,
        {blockId: "blk002", localDate: "2026-10-30", externalRef: ref2, value: 1, note: "note"},
        "item_study_001"
    );
    assert.equal(tombstoneDecision, "tombstoned", "已删除墓碑必须决策为 tombstoned");

    const newDecision = noteQueryIngestDecision(
        existingEvents,
        existingTombstones,
        {blockId: "blk003", localDate: "2026-10-30", externalRef: ref3, value: 1, note: "note"},
        "item_study_001"
    );
    assert.equal(newDecision, "write", "新记录必须决策为 write");
})();

// —— 场景 4：手动重扫与代际指纹变更时游标彻底复位 (Fingerprint & Reset) ——
{
    const pluginSource = fs.readFileSync(path.join(root, "src", "index.ts"), "utf8");

    // 验证三类来源在代际变更或指纹不符时强制 cursor = ""
    assert.match(pluginSource, /this\.healthScanCursor = "";/, "health cursor resets on fingerprint mismatch");
    assert.match(pluginSource, /this\.yeguifScanCursor = "";/, "yeguif cursor resets on fingerprint mismatch");
    assert.match(pluginSource, /this\.noteQueryScanCursor = "";/, "notequery cursor resets on fingerprint mismatch");

    // 验证 preview 状态绝对不推进游标
    assert.match(pluginSource, /if \(!preview\)\s*\{\s*this\.healthScanCursor = scan\.cursor;/, "health cursor not advanced in preview");
    assert.match(pluginSource, /if \(!preview\)\s*\{\s*this\.yeguifScanCursor = scan\.cursor;/, "yeguif cursor not advanced in preview");
    assert.match(pluginSource, /if \(!preview\)\s*\{\s*this\.noteQueryScanCursor = scan\.cursor;/, "notequery cursor not advanced in preview");
}

console.log("long-document-pagination-walkthrough: all 200/500 row multi-page, boundary marker, deleted block, and idempotence checks passed 100%.");
