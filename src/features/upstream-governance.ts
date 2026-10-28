/* T-1680：上游 issue、PR 与发布事实定期复核纯模型（研究与规则收敛）。
   规范上游公开契约协同准入、来源生命周期级别守门（三重门槛不变量）、
   以及单一 Canonical Source 互斥判定，无隐式时钟，纯函数，受 CLOCK_FREE_MODULES 保护。 */

import type {SourceStatus} from "./source-framework";

/** T-1680：外部来源就绪度核查上下文。 */
export interface UpstreamSourceCheckContext {
    sourceKey: string;
    label: string;
    issueReference?: string;
    /** 门槛 1：上游已正式合并公开契约 */
    isMergedUpstream: boolean;
    /** 门槛 2：上游已发布包含版本化公开契约的正式版本 */
    hasVersionedRelease: boolean;
    /** 门槛 3：已在真实思源宿主环境中完成全生命周期双向验收 */
    isVerifiedInRealHost: boolean;
    currentStatus: SourceStatus;
}

export interface UpstreamSourceReadinessDecision {
    sourceKey: string;
    canPromoteToStable: boolean;
    recommendedStatus: SourceStatus;
    missingPrerequisites: string[];
    decisionSummary: string;
}

/** T-1680：三重门槛守门决策器（Three-Tier Gate Invariant）。
    原则：只有版本化公开契约、对方合并发布和本地真实验收同时满足（三者全真），
    才允许提升来源级别为 stable；任一不满足时必须保持 experimental 或 planned，
    坚决杜绝把草案或未发版代码冒充稳定依赖。 */
export function evaluateUpstreamSourceReadiness(
    context: UpstreamSourceCheckContext
): UpstreamSourceReadinessDecision {
    const missing: string[] = [];

    if (!context.isMergedUpstream) {
        missing.push("upstream-merge-pending");
    }
    if (!context.hasVersionedRelease) {
        missing.push("versioned-release-pending");
    }
    if (!context.isVerifiedInRealHost) {
        missing.push("real-host-e2e-pending");
    }

    if (missing.length === 0) {
        return {
            sourceKey: context.sourceKey,
            canPromoteToStable: true,
            recommendedStatus: "stable",
            missingPrerequisites: [],
            decisionSummary: `All three prerequisites satisfied; ${context.sourceKey} can be promoted to stable.`,
        };
    }

    // 只要有任一缺失，绝不升级为 stable
    const recommendedStatus: SourceStatus = context.currentStatus === "disabled"
        ? "disabled"
        : "experimental";

    return {
        sourceKey: context.sourceKey,
        canPromoteToStable: false,
        recommendedStatus,
        missingPrerequisites: missing,
        decisionSummary: `Prerequisites missing [${missing.join(", ")}]; ${context.sourceKey} must remain ${recommendedStatus}.`,
    };
}

/** 外部合作提案记录快照（2026-10-29 定期复查） */
export interface UpstreamProposalSnapshot {
    proposalKey: string;
    sourceKey: string;
    label: string;
    issueNumber: number | null;
    fixturePath: string;
    lastAuditedDate: string; // YYYY-MM-DD
    upstreamStatus: "open-no-response" | "in-discussion" | "merged" | "declined";
    readinessStatus: SourceStatus;
    notes: string;
}

export const UPSTREAM_PROPOSAL_SNAPSHOTS: readonly UpstreamProposalSnapshot[] = Object.freeze([
    Object.freeze({
        proposalKey: "sireader-lifecycle-api",
        sourceKey: "sireader",
        label: "思阅（SiReader）",
        issueNumber: 55,
        fixturePath: "docs/contracts/upstream-proposals/sireader-lifecycle-api-v1.json",
        lastAuditedDate: "2026-10-29",
        upstreamStatus: "open-no-response",
        readinessStatus: "experimental",
        notes: "上游未发布版本化 CustomEvent 契约，维持 opt-in fallback 实验级，绝不重复催办。",
    }),
    Object.freeze({
        proposalKey: "siplayer-playback-api",
        sourceKey: "siplayer",
        label: "思播（SiPlayer）",
        issueNumber: 180,
        fixturePath: "docs/contracts/upstream-proposals/siplayer-playback-api-v1.json",
        lastAuditedDate: "2026-10-29",
        upstreamStatus: "open-no-response",
        readinessStatus: "experimental",
        notes: "维持本地事件采样与跨日切分，上游无版本契约前保持 experimental 观察级。",
    }),
    Object.freeze({
        proposalKey: "taskhorizon-calendar-consumer",
        sourceKey: "taskhorizon",
        label: "Task Horizon",
        issueNumber: null,
        fixturePath: "docs/contracts/upstream-proposals/taskhorizon-calendar-consumer-v1.json",
        lastAuditedDate: "2026-10-29",
        upstreamStatus: "in-discussion",
        readinessStatus: "experimental",
        notes: "T-1671 已收敛单一事实源与 5 分钟 TTL Fallback；双方真实联调待对方排期（T-1836 挂起）。",
    }),
    Object.freeze({
        proposalKey: "docktomato-focus-inbox",
        sourceKey: "docktomato",
        label: "Dock Tomato",
        issueNumber: null,
        fixturePath: "docs/docktomato-compat-pr-draft.md",
        lastAuditedDate: "2026-10-29",
        upstreamStatus: "in-discussion",
        readinessStatus: "experimental",
        notes: "T-1672 已完成收件箱与多窗口演练，不侵入私有存储，onunload 100% 注销防泄漏。",
    }),
]);

/** T-1680：批量审计全量上游外部来源状态。 */
export interface UpstreamAuditResult {
    totalAudited: number;
    stableCount: number;
    experimentalCount: number;
    unpromotedSafeCount: number;
    allCompliantWithGate: boolean;
}

export function auditUpstreamProposalSnapshots(
    proposals: readonly UpstreamProposalSnapshot[] = UPSTREAM_PROPOSAL_SNAPSHOTS
): UpstreamAuditResult {
    let stableCount = 0;
    let experimentalCount = 0;
    let unpromotedSafeCount = 0;
    let allCompliant = true;

    for (const proposal of proposals) {
        const isUpstreamReady = proposal.upstreamStatus === "merged";
        const decision = evaluateUpstreamSourceReadiness({
            sourceKey: proposal.sourceKey,
            label: proposal.label,
            isMergedUpstream: isUpstreamReady,
            hasVersionedRelease: isUpstreamReady,
            isVerifiedInRealHost: false, // 尚未进行正式发版后的宿主集成验收
            currentStatus: proposal.readinessStatus,
        });

        if (decision.canPromoteToStable) {
            stableCount += 1;
        } else {
            experimentalCount += 1;
            // 只要未满足条件且未擅自晋升为 stable，即符合安全守门
            if (proposal.readinessStatus !== "stable") {
                unpromotedSafeCount += 1;
            } else {
                allCompliant = false;
            }
        }
    }

    return {
        totalAudited: proposals.length,
        stableCount,
        experimentalCount,
        unpromotedSafeCount,
        allCompliantWithGate: allCompliant,
    };
}
