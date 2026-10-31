const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/* T-1680 专项守门测试：
   上游 issue、PR 与发布事实定期复核
   1. 三重门槛不变量（合并 + 发版 + 真实宿主验收同时满足才允许升级 stable）；
   2. 缺一不可守门拦截；
   3. 全量合作提案快照审计（思阅 #55、思播 #180、Task Horizon、Dock Tomato）；
   4. 绝不越权提级与安全保留 experimental。 */

const projectRoot = path.resolve(__dirname, "..");
const featureTs = fs.readFileSync(path.join(projectRoot, "src", "features", "upstream-governance.ts"), "utf8");
const compiled = ts.transpileModule(featureTs, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;
const moduleUnderTest = {exports: {}};
new Function("require", "module", "exports", compiled)(() => {}, moduleUnderTest, moduleUnderTest.exports);

const {
    evaluateUpstreamSourceReadiness,
    auditUpstreamProposalSnapshots,
    UPSTREAM_PROPOSAL_SNAPSHOTS,
} = moduleUnderTest.exports;

console.log("Starting upstream-governance tests...");

// 1. 三重门槛决策器断言
{
    // 全满足：三条件全真允许升级为 stable
    const allPassed = evaluateUpstreamSourceReadiness({
        sourceKey: "sireader",
        label: "思阅",
        isMergedUpstream: true,
        hasVersionedRelease: true,
        isVerifiedInRealHost: true,
        currentStatus: "experimental",
    });
    assert.equal(allPassed.canPromoteToStable, true);
    assert.equal(allPassed.recommendedStatus, "stable");
    assert.equal(allPassed.missingPrerequisites.length, 0);

    // 缺失门槛 1：上游未合并
    const unmerged = evaluateUpstreamSourceReadiness({
        sourceKey: "sireader",
        label: "思阅",
        isMergedUpstream: false,
        hasVersionedRelease: false,
        isVerifiedInRealHost: false,
        currentStatus: "experimental",
    });
    assert.equal(unmerged.canPromoteToStable, false);
    assert.equal(unmerged.recommendedStatus, "experimental");
    assert.ok(unmerged.missingPrerequisites.includes("upstream-merge-pending"));

    // 缺失门槛 2：已合并但未发布稳定版本（仍在 main 分支草稿态）
    const unreleased = evaluateUpstreamSourceReadiness({
        sourceKey: "siplayer",
        label: "思播",
        isMergedUpstream: true,
        hasVersionedRelease: false,
        isVerifiedInRealHost: false,
        currentStatus: "experimental",
    });
    assert.equal(unreleased.canPromoteToStable, false);
    assert.equal(unreleased.recommendedStatus, "experimental");
    assert.ok(unreleased.missingPrerequisites.includes("versioned-release-pending"));

    // 缺失门槛 3：已合并已发版但本地尚未真实完成全链路宿主验收
    const unverified = evaluateUpstreamSourceReadiness({
        sourceKey: "taskhorizon",
        label: "Task Horizon",
        isMergedUpstream: true,
        hasVersionedRelease: true,
        isVerifiedInRealHost: false,
        currentStatus: "experimental",
    });
    assert.equal(unverified.canPromoteToStable, false);
    assert.equal(unverified.recommendedStatus, "experimental");
    assert.ok(unverified.missingPrerequisites.includes("real-host-e2e-pending"));

    // 停用状态保持停用
    const disabled = evaluateUpstreamSourceReadiness({
        sourceKey: "test",
        label: "测试",
        isMergedUpstream: false,
        hasVersionedRelease: false,
        isVerifiedInRealHost: false,
        currentStatus: "disabled",
    });
    assert.equal(disabled.canPromoteToStable, false);
    assert.equal(disabled.recommendedStatus, "disabled");
}

// 2. 外部合作提案快照完整性与状态断言
{
    assert.equal(UPSTREAM_PROPOSAL_SNAPSHOTS.length, 4, "exact 4 upstream proposals tracked");
    const bySource = new Map(UPSTREAM_PROPOSAL_SNAPSHOTS.map((p) => [p.sourceKey, p]));

    // 思阅：issue #55
    const sireader = bySource.get("sireader");
    assert.ok(sireader);
    assert.equal(sireader.issueNumber, 55);
    assert.equal(sireader.readinessStatus, "experimental");
    assert.equal(sireader.upstreamStatus, "open-no-response");

    // 思播：issue #180
    const siplayer = bySource.get("siplayer");
    assert.ok(siplayer);
    assert.equal(siplayer.issueNumber, 180);
    assert.equal(siplayer.readinessStatus, "experimental");
    assert.equal(siplayer.upstreamStatus, "open-no-response");

    // Task Horizon
    const taskhorizon = bySource.get("taskhorizon");
    assert.ok(taskhorizon);
    assert.equal(taskhorizon.readinessStatus, "experimental");

    // Dock Tomato
    const docktomato = bySource.get("docktomato");
    assert.ok(docktomato);
    assert.equal(docktomato.readinessStatus, "experimental");

    // 检查快照夹具文件在工程树中真实存在
    for (const p of UPSTREAM_PROPOSAL_SNAPSHOTS) {
        assert.ok(fs.existsSync(path.join(projectRoot, p.fixturePath)), `fixture file must exist: ${p.fixturePath}`);
    }
}

// 3. 批量提案就绪度安全审计断言
{
    const auditRes = auditUpstreamProposalSnapshots();
    assert.equal(auditRes.totalAudited, 4);
    assert.equal(auditRes.stableCount, 0, "no external proposal is prematurely promoted to stable");
    assert.equal(auditRes.experimentalCount, 4);
    assert.equal(auditRes.unpromotedSafeCount, 4);
    assert.equal(auditRes.allCompliantWithGate, true, "100% compliant with three-tier gate invariant");
}

console.log("upstream-governance: all three-tier gate, proposal snapshot and audit checks passed successfully.");
