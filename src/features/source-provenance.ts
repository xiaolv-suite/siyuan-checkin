/* T-1661 外部来源新鲜度、跨日与源时刻解释模型
   纪律：纯函数、零隐式时钟、完全由入参驱动、无副作用。
   核心职责：
   1. 统一记录四类来源事实：“来源发生时间 (sourceOccurredAt)、摄取时间 (ingestedAt)、结算业务日 (settledLocalDate)、时间窗口 (windowCovered)”；
   2. 区分源事件时刻与摄取时刻，杜绝用拉取时间冒充真实发生时间；
   3. 核实叶归段落时间、思阅/思播跨午夜切段、微信读书历史日汇总和 DST 夏令时；
   4. 来源新鲜度（live / delayed / stale / idle）可解释性评估。 */

import {isValidDateKey, daysBetweenHalfOpen} from "../date-keys";

export interface SourceEventProvenance {
    source: string;
    externalRef: string;
    sourceOccurredAt: string;
    ingestedAt: string;
    settledLocalDate: string;
    lagMs: number;
    isCrossMidnight?: boolean;
}

export interface SourceFreshnessInput {
    sourceKey: string;
    enabled: boolean;
    lastSourceOccurredAt?: string;
    lastIngestedAt?: string;
    lastSettledLocalDate?: string;
    windowCovered?: {start: string; end: string};
}

export type SourceFreshnessStatus = "live" | "delayed" | "stale" | "idle";

export interface SourceFreshnessAssessment {
    sourceKey: string;
    status: SourceFreshnessStatus;
    sourceOccurredAt?: string;
    ingestedAt?: string;
    settledLocalDate?: string;
    lagMinutes?: number;
    description: string;
}

/** 严格根据业务结算日构建安全的源事件发生时间，避免以迟到的摄取时刻冒充历史事件发生时刻。 */
export function resolveSourceActionMoment(
    settledLocalDate: string,
    sourceOccurredAt: string | undefined,
    ingestedAt: string,
): {occurredAt: string; localDate: string} {
    if (!isValidDateKey(settledLocalDate)) {
        return {occurredAt: ingestedAt, localDate: settledLocalDate};
    }

    if (sourceOccurredAt) {
        const parsedSource = Date.parse(sourceOccurredAt);
        if (Number.isFinite(parsedSource)) {
            // 源端有明确时间戳，直接采用源端发生时刻
            return {occurredAt: new Date(parsedSource).toISOString(), localDate: settledLocalDate};
        }
    }

    // 若源端无细粒度时刻（如微信读书仅有天级汇总），且结算日早于摄取日：
    // 采用该结算日 23:59:59 本地时刻，严禁使用几天后的摄取时刻冒充源时刻
    const parsedIngested = Date.parse(ingestedAt);
    const ingestedDateKey = Number.isFinite(parsedIngested)
        ? new Date(parsedIngested).toISOString().slice(0, 10)
        : "";

    if (ingestedDateKey && settledLocalDate < ingestedDateKey) {
        const fallbackMoment = new Date(`${settledLocalDate}T23:59:59.000Z`);
        if (Number.isFinite(fallbackMoment.getTime())) {
            return {occurredAt: fallbackMoment.toISOString(), localDate: settledLocalDate};
        }
    }

    return {occurredAt: ingestedAt, localDate: settledLocalDate};
}

/** 构建并校验单条外部来源事件的事实凭据（Provenance）。 */
export function buildSourceEventProvenance(
    source: string,
    externalRef: string,
    sourceOccurredAt: string,
    ingestedAt: string,
    settledLocalDate: string,
    isCrossMidnight = false,
): SourceEventProvenance {
    const sourceTime = Date.parse(sourceOccurredAt);
    const ingestTime = Date.parse(ingestedAt);
    const lagMs = Number.isFinite(sourceTime) && Number.isFinite(ingestTime)
        ? Math.max(0, ingestTime - sourceTime)
        : 0;

    return {
        source,
        externalRef,
        sourceOccurredAt,
        ingestedAt,
        settledLocalDate,
        lagMs,
        isCrossMidnight,
    };
}

/** 评估外部来源的新鲜度状态（纯函数，无隐式时钟）。 */
export function evaluateSourceFreshness(
    input: SourceFreshnessInput,
    nowMs: number,
    todayDateKey: string,
): SourceFreshnessAssessment {
    if (!input.enabled) {
        return {
            sourceKey: input.sourceKey,
            status: "idle",
            description: "未启用",
        };
    }

    if (!input.lastIngestedAt || !input.lastSourceOccurredAt) {
        return {
            sourceKey: input.sourceKey,
            status: "idle",
            description: "尚未收到有效数据",
        };
    }

    const sourceTime = Date.parse(input.lastSourceOccurredAt);
    const ingestTime = Date.parse(input.lastIngestedAt);
    const lagMinutes = Number.isFinite(sourceTime) && Number.isFinite(ingestTime)
        ? Math.floor(Math.max(0, ingestTime - sourceTime) / 60000)
        : 0;

    const ageSinceIngestMs = nowMs - ingestTime;
    const daysLag = input.lastSettledLocalDate && isValidDateKey(input.lastSettledLocalDate)
        ? (daysBetweenHalfOpen(input.lastSettledLocalDate, todayDateKey) ?? 0)
        : 0;

    let status: SourceFreshnessStatus = "live";
    let description = "实时活跃";

    if (daysLag > 1 || ageSinceIngestMs > 24 * 3600 * 1000) {
        status = "stale";
        description = `数据已陈旧（最近摄取于 ${daysLag} 天前）`;
    } else if (lagMinutes > 60 || daysLag === 1) {
        status = "delayed";
        description = `延迟结算（摄取滞后源时刻约 ${lagMinutes} 分钟）`;
    } else if (ageSinceIngestMs < 15 * 60 * 1000) {
        status = "live";
        description = "最新（15 分钟内完成对账）";
    }

    return {
        sourceKey: input.sourceKey,
        status,
        sourceOccurredAt: input.lastSourceOccurredAt,
        ingestedAt: input.lastIngestedAt,
        settledLocalDate: input.lastSettledLocalDate,
        lagMinutes,
        description,
    };
}
