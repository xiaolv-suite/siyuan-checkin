/* T-1699 专项测试：结构化 AI 草案历史治理、脱敏容量限制、跨窗口防复活与备份范围门禁 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-ai-history-"));

const transpile = (sourcePath, outName) => {
    const text = fs.readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(text, {compilerOptions}).outputText;
    fs.writeFileSync(path.join(dir, outName), transpiled);
    return require(path.join(dir, outName));
};

transpile(path.join(root, "src", "types.ts"), "types.js");
transpile(path.join(root, "src", "i18n.ts"), "i18n.js");
transpile(path.join(root, "src", "lunar.ts"), "lunar.js");
transpile(path.join(root, "src", "date-keys.ts"), "date-keys.js");
transpile(path.join(root, "src", "occasions.ts"), "occasions.js");
transpile(path.join(root, "src", "catalog.ts"), "catalog.js");
transpile(path.join(root, "src", "features", "schedule-validate.ts"), "schedule-validate.js");
transpile(path.join(root, "src", "features", "project-draft.ts"), "project-draft.js");
transpile(path.join(root, "src", "features", "name-inference.ts"), "name-inference.js");
transpile(path.join(root, "src", "features", "natural-language-draft.ts"), "natural-language-draft.js");
const gov = transpile(path.join(root, "src", "features", "ai-draft-governance.ts"), "ai-draft-governance.js");

console.log("Starting ai-draft-history-governance tests...");

const mockNow = "2026-10-30T10:00:00.000Z";

// 1. 脱敏与摘要净化断言 (Sanitization & Summary Capping)
{
    const raw = "每天慢跑 30 分钟，联系方式 test@domain.com，token bearer sk-1234567890abcdef123456 密码";
    const cleaned = gov.sanitizeDraftSummary(raw);
    assert.ok(!cleaned.includes("test@domain.com"), "必须过滤邮箱");
    assert.ok(cleaned.includes("[EMAIL]"));
    assert.ok(!cleaned.includes("sk-1234567890abcdef123456"), "必须过滤 Token");
    assert.ok(cleaned.includes("[TOKEN]"));
    assert.ok(cleaned.length <= 40, "必须硬截断至 40 字符");
}

// 2. 结构化草案记录与 20 条硬上限 FIFO 淘汰 (Capacity Hard Cap FIFO)
{
    let bucket = gov.createEmptyAiDraftHistoryBucket();
    assert.equal(bucket.entries.length, 0);

    for (let i = 1; i <= 25; i++) {
        const timeIso = new Date(Date.parse(mockNow) + i * 1000).toISOString();
        const res = gov.recordAiDraftHistoryEntry(bucket, {
            id: `aid_${i}`,
            summary: `习惯草案 #${i}`,
            intentType: "checkin_item",
            source: "local",
            draftPayload: {
                name: `项目_${i}`,
                icon: "✓",
                kind: "binary",
                target: 1,
                unit: "次",
                schedule: {type: "daily"},
                group: "日常",
                priority: "medium",
                timeSlot: "any",
            },
            nowIso: timeIso,
        });
        bucket = res.bucket;
    }

    assert.equal(bucket.entries.length, gov.MAX_AI_DRAFT_HISTORY_ENTRIES, "硬上限必须严格限制为 20 条");
    assert.equal(bucket.entries[0].id, "aid_25", "最新条目排在最前");
    assert.equal(bucket.entries[19].id, "aid_6", "最老存活条目为第 6 条");
    assert.ok(!bucket.entries.some((e) => e.id === "aid_1"), "前 5 条旧记录必须被 FIFO 淘汰");
}

// 3. 状态流转与更新断言 (Status Transitions)
{
    let bucket = gov.createEmptyAiDraftHistoryBucket();
    const res = gov.recordAiDraftHistoryEntry(bucket, {
        id: "aid_status_test",
        summary: "背单词 30个",
        intentType: "checkin_item",
        source: "local",
        draftPayload: {name: "背单词", icon: "📖", kind: "quantity", target: 30, unit: "个", schedule: {type: "daily"}, group: "学习", priority: "high", timeSlot: "any"},
        nowIso: mockNow,
    });
    bucket = res.bucket;
    assert.equal(bucket.entries[0].status, "pending");

    bucket = gov.updateAiDraftHistoryStatus(bucket, "aid_status_test", "applied", "2026-10-30T10:05:00.000Z");
    assert.equal(bucket.entries[0].status, "applied");
    assert.equal(bucket.entries[0].updatedAt, "2026-10-05T10:05:00.000Z".replace("10-05", "10-30"));
}

// 4. 单条删除与墓碑标记断言 (Deletion & Tombstones)
{
    let bucket = gov.createEmptyAiDraftHistoryBucket();
    const res = gov.recordAiDraftHistoryEntry(bucket, {
        id: "aid_to_delete",
        summary: "喝水 2000ml",
        intentType: "checkin_item",
        source: "local",
        draftPayload: {name: "喝水", icon: "💧", kind: "quantity", target: 2000, unit: "毫升", schedule: {type: "daily"}, group: "健康", priority: "medium", timeSlot: "any"},
        nowIso: mockNow,
    });
    bucket = res.bucket;
    assert.equal(bucket.entries.length, 1);

    bucket = gov.deleteAiDraftHistoryEntry(bucket, "aid_to_delete");
    assert.equal(bucket.entries.length, 0, "物理条目必须移除");
    assert.ok(bucket.tombstones.includes("aid_to_delete"), "必须登记墓碑防复活");
}

// 5. 跨窗口并发非并集合并与防死灰复燃断言 (Cross-Window Non-Union & Zombie Prevention)
{
    // 场景 A：窗口 1 删除了草案 X，窗口 2 保留旧快照仍包含草案 X
    const bucketWin1 = gov.deleteAiDraftHistoryEntry(
        gov.recordAiDraftHistoryEntry(gov.createEmptyAiDraftHistoryBucket(), {
            id: "aid_zombie_target",
            summary: "晨跑",
            intentType: "checkin_item",
            source: "local",
            draftPayload: {name: "晨跑", icon: "🏃", kind: "duration", target: 30, unit: "分钟", schedule: {type: "daily"}, group: "运动", priority: "high", timeSlot: "morning"},
            nowIso: mockNow,
        }).bucket,
        "aid_zombie_target"
    );

    const bucketWin2 = gov.recordAiDraftHistoryEntry(gov.createEmptyAiDraftHistoryBucket(), {
        id: "aid_zombie_target",
        summary: "晨跑",
        intentType: "checkin_item",
        source: "local",
        draftPayload: {name: "晨跑", icon: "🏃", kind: "duration", target: 30, unit: "分钟", schedule: {type: "daily"}, group: "运动", priority: "high", timeSlot: "morning"},
        nowIso: mockNow,
    }).bucket;

    const reconcileResult = gov.reconcileCrossWindowAiDraftBuckets(bucketWin1, bucketWin2, {nowIso: mockNow});
    assert.equal(reconcileResult.mergedBucket.entries.length, 0, "绝不能复用事实桶并集规则导致已删除草案死灰复燃");
    assert.equal(reconcileResult.resurrectedPreventedCount, 1, "必须阻断 1 次僵尸数据复活");
}

// 6. 全局清空截断点跨窗口隔离断言 (Global Clear Isolation)
{
    const oldTime = "2026-10-30T09:00:00.000Z";
    const clearTime = "2026-10-30T10:00:00.000Z";

    // 窗口 1 执行了一键清空
    const bucketCleared = gov.clearAllAiDraftHistory(gov.createEmptyAiDraftHistoryBucket(), clearTime);

    // 窗口 2 保留着清空前的 2 条旧草案
    let bucketStale = gov.createEmptyAiDraftHistoryBucket();
    bucketStale = gov.recordAiDraftHistoryEntry(bucketStale, {
        id: "aid_stale_1",
        summary: "旧草案1",
        intentType: "checkin_item",
        source: "local",
        draftPayload: {name: "旧草案1", icon: "✓", kind: "binary", target: 1, unit: "次", schedule: {type: "daily"}, group: "日常", priority: "low", timeSlot: "any"},
        nowIso: oldTime,
    }).bucket;

    const reconcileResult = gov.reconcileCrossWindowAiDraftBuckets(bucketCleared, bucketStale, {nowIso: clearTime});
    assert.equal(reconcileResult.mergedBucket.entries.length, 0, "清空时间戳之后合并绝不能带回旧草案");
    assert.equal(reconcileResult.droppedCount, 1);
}

// 7. 备份与导出范围契约断言 (Export Scope Audit Alignment)
{
    let bucket = gov.createEmptyAiDraftHistoryBucket();
    bucket = gov.recordAiDraftHistoryEntry(bucket, {
        id: "aid_export_test",
        summary: "测试草案",
        intentType: "checkin_item",
        source: "local",
        draftPayload: {name: "测试草案", icon: "✓", kind: "binary", target: 1, unit: "次", schedule: {type: "daily"}, group: "日常", priority: "low", timeSlot: "any"},
        nowIso: mockNow,
    }).bucket;

    const jsonAudit = gov.auditAiDraftExportScope(bucket, "json_backup");
    assert.equal(jsonAudit.isIncluded, false, "JSON 主档备份绝对不得包含 AI 草案历史 (T-1627 铁律)");

    const csvAudit = gov.auditAiDraftExportScope(bucket, "csv");
    assert.equal(csvAudit.isIncluded, false, "打卡 CSV 绝对不得包含临时 AI 草案");

    const envAudit = gov.auditAiDraftExportScope(bucket, "backup_envelope");
    assert.equal(envAudit.isIncluded, true, "多桶 BackupEnvelope 可作为可选辅助桶导出");
}

console.log("ai-draft-history-governance: all sanitization, fifo, cross-window non-union, zombie prevention and export scope checks passed.");
