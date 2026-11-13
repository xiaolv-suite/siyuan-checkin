/* T-1737 & T-1738：设置推荐应用事务、保存边界与前置检查（纯逻辑、无时钟、确定性）。
   解决 A 类显式草稿与 B 类即时偏好混合提交、锁内复核、多桶原子回滚、
   部分成功如实说明，以及 7 大前置检查状态（缺 Key、无合适项目、多候选等）与动作路径。 */

import type { RecommendationApplicability, SaveSemantics } from "./settings-recommendation-governance";

export type PreflightCheckCode =
    | "ready"                  // 前置全部就绪，可一键应用
    | "missing_credential"     // 缺少凭据（如未填 API Key）
    | "no_matching_item"       // 无符合单位的打卡项（如缺少“分钟”单位项目）
    | "target_unreachable"     // 目标文档或笔记本不存在/无权访问
    | "host_undetected"        // 外部插件宿主未探测到
    | "unit_conflict"          // 既有项单位冲突（如二值项与数值需求冲突）
    | "multiple_candidates";   // 存在多个候选，必须人工定夺

export type ActionResolutionPath =
    | "apply_directly"
    | "input_credential"
    | "create_matching_item"
    | "choose_target_item"
    | "verify_host_status"
    | "skip_recommendation";

export interface RecommendationPreflightContext {
    readonly hasCredential?: boolean;
    readonly matchingItemCount?: number;
    readonly isTargetAccessible?: boolean;
    readonly isHostDetected?: boolean;
    readonly hasUnitConflict?: boolean;
}

export interface RecommendationPreflightResult {
    readonly code: PreflightCheckCode;
    readonly isExecutable: boolean;
    readonly resolutionPath: ActionResolutionPath;
    readonly hintKey: string;
    readonly candidateCount?: number;
}

/** 评估推荐项的前置就绪度（T-1738）。 */
export function evaluateRecommendationPreflight(
    key: string,
    context: RecommendationPreflightContext
): RecommendationPreflightResult {
    // 1. 凭据依赖优先检查
    if (context.hasCredential === false) {
        return {
            code: "missing_credential",
            isExecutable: false,
            resolutionPath: "input_credential",
            hintKey: "set.rec.preflight.missingKey",
        };
    }

    // 2. 宿主探测检查
    if (context.isHostDetected === false) {
        return {
            code: "host_undetected",
            isExecutable: false,
            resolutionPath: "verify_host_status",
            hintKey: "set.rec.preflight.hostUndetected",
        };
    }

    // 3. 目标资产连通性检查
    if (context.isTargetAccessible === false) {
        return {
            code: "target_unreachable",
            isExecutable: false,
            resolutionPath: "choose_target_item",
            hintKey: "set.rec.preflight.targetUnreachable",
        };
    }

    // 4. 单位冲突检查
    if (context.hasUnitConflict === true) {
        return {
            code: "unit_conflict",
            isExecutable: false,
            resolutionPath: "create_matching_item",
            hintKey: "set.rec.preflight.unitConflict",
        };
    }

    // 5. 候选项目数量检查
    const count = context.matchingItemCount ?? 0;
    if (count === 0) {
        return {
            code: "no_matching_item",
            isExecutable: false,
            resolutionPath: "create_matching_item",
            hintKey: "set.rec.preflight.noMatchingItem",
            candidateCount: 0,
        };
    }
    if (count > 1) {
        return {
            code: "multiple_candidates",
            isExecutable: false,
            resolutionPath: "choose_target_item",
            hintKey: "set.rec.preflight.multipleCandidates",
            candidateCount: count,
        };
    }

    return {
        code: "ready",
        isExecutable: true,
        resolutionPath: "apply_directly",
        hintKey: "set.rec.preflight.ready",
        candidateCount: 1,
    };
}

export interface RecommendationFieldMutation {
    readonly key: string;
    readonly targetBucket: string;
    readonly semantics: SaveSemantics;
    readonly previousValue: unknown;
    readonly nextValue: unknown;
}

export interface RecommendationTransactionPlan {
    readonly schemeId: string;
    readonly mutations: readonly RecommendationFieldMutation[];
    readonly requiresHighRiskConfirm: boolean;
}

export type BucketPersistFn = (bucket: string, mutations: readonly RecommendationFieldMutation[]) => Promise<boolean>;

export interface TransactionExecutionOutcome {
    readonly ok: boolean;
    readonly status: "full_success" | "partial_success" | "rolled_back";
    readonly succeededBuckets: readonly string[];
    readonly failedBuckets: readonly string[];
    readonly rollbackExecuted: boolean;
    readonly userMessageKey: string;
}

/** 执行多桶推荐方案提交事务（T-1737）。
 *  按桶聚合并行/串行写入；若出现部分失败，执行内存回滚并给出诚实的部分成功/完全失败说明。 */
export async function executeRecommendationTransaction(
    plan: RecommendationTransactionPlan,
    persistFn: BucketPersistFn,
    rollbackInMemoryFn: (previousValues: Record<string, unknown>) => void
): Promise<TransactionExecutionOutcome> {
    if (!plan.mutations.length) {
        return {
            ok: true,
            status: "full_success",
            succeededBuckets: [],
            failedBuckets: [],
            rollbackExecuted: false,
            userMessageKey: "set.rec.tx.empty",
        };
    }

    // 收集前置快照以备回滚
    const previousSnapshot: Record<string, unknown> = {};
    const mutationsByBucket = new Map<string, RecommendationFieldMutation[]>();

    for (const m of plan.mutations) {
        previousSnapshot[m.key] = m.previousValue;
        const bucketList = mutationsByBucket.get(m.targetBucket) ?? [];
        bucketList.push(m);
        mutationsByBucket.set(m.targetBucket, bucketList);
    }

    const succeededBuckets: string[] = [];
    const failedBuckets: string[] = [];

    for (const [bucket, bucketMutations] of mutationsByBucket.entries()) {
        try {
            const success = await persistFn(bucket, bucketMutations);
            if (success) {
                succeededBuckets.push(bucket);
            } else {
                failedBuckets.push(bucket);
            }
        } catch {
            failedBuckets.push(bucket);
        }
    }

    // 完全成功
    if (failedBuckets.length === 0) {
        return {
            ok: true,
            status: "full_success",
            succeededBuckets: Object.freeze(succeededBuckets),
            failedBuckets: Object.freeze(failedBuckets),
            rollbackExecuted: false,
            userMessageKey: "set.rec.tx.fullSuccess",
        };
    }

    // 部分失败或全失败：执行内存快照回滚
    rollbackInMemoryFn(previousSnapshot);

    if (succeededBuckets.length > 0) {
        return {
            ok: false,
            status: "partial_success",
            succeededBuckets: Object.freeze(succeededBuckets),
            failedBuckets: Object.freeze(failedBuckets),
            rollbackExecuted: true,
            userMessageKey: "set.rec.tx.partialSuccess",
        };
    }

    return {
        ok: false,
        status: "rolled_back",
        succeededBuckets: Object.freeze(succeededBuckets),
        failedBuckets: Object.freeze(failedBuckets),
        rollbackExecuted: true,
        userMessageKey: "set.rec.tx.failedAndRolledBack",
    };
}
