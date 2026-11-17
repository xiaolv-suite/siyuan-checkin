/* T-1799 事件墓碑生命周期、容量与压缩治理模型
   纪律：纯函数、零隐式时钟、无外部副作用。
   核心职责：
   1. 墓碑容量硬上限与渐进淘汰（EVENT_TOMBSTONES_CAP = 10,000）；
   2. 外部身份优先保活（ExternalRef First Invariant）：
      带有 externalRef 的墓碑绝不被优先淘汰，彻底防止微信读书/叶归/思阅等外部来源重放复活；
   3. 纯内部 ID 墓碑按 deletedAt 从旧到新安全淘汰；
   4. 墓碑健康度与可追溯性审计（auditTombstoneCapacity）。 */

import type {CheckinEventTombstone} from "../types";
import {
    EVENT_TOMBSTONES_CAP,
    EVENT_TOMBSTONES_EXTERNAL_CAP,
    pruneEventTombstones,
} from "../model";

export {EVENT_TOMBSTONES_CAP, EVENT_TOMBSTONES_EXTERNAL_CAP, pruneEventTombstones};

export const EVENT_TOMBSTONES_WARN_LIMIT = 25_000;

export interface TombstoneCapacityAudit {
    total: number;
    externalCount: number;
    idOnlyCount: number;
    oldestDeletedAt?: string;
    newestDeletedAt?: string;
    isNearLimit: boolean;
    isOverLimit: boolean;
}

export function hasExternalIdentity(tombstone: CheckinEventTombstone): boolean {
    return Boolean(tombstone.itemId && tombstone.source && tombstone.externalRef);
}

/** 墓碑排序：按 deletedAt 升序，相同时按 eventId 升序。 */
export function compareTombstoneAge(left: CheckinEventTombstone, right: CheckinEventTombstone): number {
    return left.deletedAt < right.deletedAt ? -1 : left.deletedAt > right.deletedAt ? 1 : left.eventId.localeCompare(right.eventId);
}

/** 墓碑容量与健康状态审计。 */
export function auditTombstoneCapacity(
    tombstones: readonly CheckinEventTombstone[],
): TombstoneCapacityAudit {
    let externalCount = 0;
    let idOnlyCount = 0;
    let oldestDeletedAt: string | undefined;
    let newestDeletedAt: string | undefined;

    for (const t of tombstones) {
        if (hasExternalIdentity(t)) externalCount += 1;
        else idOnlyCount += 1;

        if (!oldestDeletedAt || t.deletedAt < oldestDeletedAt) oldestDeletedAt = t.deletedAt;
        if (!newestDeletedAt || t.deletedAt > newestDeletedAt) newestDeletedAt = t.deletedAt;
    }

    const total = tombstones.length;
    return {
        total,
        externalCount,
        idOnlyCount,
        oldestDeletedAt,
        newestDeletedAt,
        isNearLimit: total >= EVENT_TOMBSTONES_WARN_LIMIT,
        isOverLimit: total >= EVENT_TOMBSTONES_CAP,
    };
}
