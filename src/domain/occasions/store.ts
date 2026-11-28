import type {
    Occasion,
    OccasionCategory,
    OccasionOverride,
    OccasionRecurrence,
    OccasionStore,
    OccasionTombstone,
} from "./types";
import {OCCASIONS_STORE_VERSION} from "./types";
import {
    clampInteger,
    isValidLocalDate,
    isValidOccasionDate,
    normalizeOccasionCategory,
    normalizeOccasionPriority,
    normalizeOccasionTime,
    validateOccasionBlockRef,
} from "./rules";

export function makeOccasionId(): string {
    return "occ_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export function createDefaultOccasionStore(): OccasionStore {
    return {version: OCCASIONS_STORE_VERSION, occasions: []};
}

export function normalizeOccasionStore(value: unknown): OccasionStore {
    const source = value && typeof value === "object" ? value as Partial<OccasionStore> : {};
    const raw = Array.isArray(source.occasions) ? source.occasions : [];
    const tombstones = normalizeOccasionTombstones(source.tombstones);
    const deletedIds = new Set(tombstones.map((tombstone) => tombstone.occasionId));
    const winners = new Map<string, Occasion>();
    for (const candidate of raw) {
        const occasion = normalizeOccasion(candidate);
        if (!occasion) continue;
        const existing = winners.get(occasion.id);
        if (!existing) { winners.set(occasion.id, occasion); continue; }
        const challengerBetter = occasion.updatedAt > existing.updatedAt
            || (occasion.updatedAt === existing.updatedAt && occasion.completedDates.length > existing.completedDates.length);
        if (challengerBetter) winners.set(occasion.id, occasion);
    }
    const occasions = [...winners.values()].filter((item) => !deletedIds.has(item.id));
    return {version: OCCASIONS_STORE_VERSION, occasions, ...(tombstones.length ? {tombstones} : {})};
}

const RECURRENCES = new Set<OccasionRecurrence>(["once", "annual", "monthly", "weekly", "quarterly", "halfyearly", "interval"]);

export function normalizeOccasion(value: unknown): Occasion | undefined {
    if (!value || typeof value !== "object") return undefined;
    const source = value as Partial<Occasion>;
    const name = typeof source.name === "string" ? source.name.trim().slice(0, 120) : "";
    const date = typeof source.date === "string" ? source.date.trim() : "";
    const kind = source.kind === "birthday" || source.kind === "anniversary" || source.kind === "scheduled" ? source.kind : "scheduled";
    const recurrence = RECURRENCES.has(source.recurrence as OccasionRecurrence) ? source.recurrence as OccasionRecurrence
        : source.recurrence === "once" ? "once" : source.recurrence === "monthly" ? "monthly" : source.recurrence === "annual" ? "annual" : "once";
    if (!name || !isValidOccasionDate(date)) return undefined;
    const now = new Date().toISOString();
    const completedDates = Array.isArray(source.completedDates)
        ? [...new Set(source.completedDates.filter((item): item is string => typeof item === "string" && isValidLocalDate(item)))]
            .sort((left, right) => left.localeCompare(right))
            .slice(-120)
        : [];
    const overrides: Record<string, OccasionOverride> = {};
    if (source.overrides && typeof source.overrides === "object" && !Array.isArray(source.overrides)) {
        for (const [key, val] of Object.entries(source.overrides as Record<string, unknown>).slice(0, 60)) {
            if (!isValidOccasionDate(key)) continue;
            if (!val || typeof val !== "object" || Array.isArray(val)) continue;
            const moved = (val as {date?: unknown}).date;
            if (typeof moved !== "string" || !isValidOccasionDate(moved) || moved === key) continue;
            overrides[key] = {date: moved};
        }
    }
    const calendar = source.calendar === "lunar" ? "lunar" : "solar";
    const monthlySubtype = source.monthlySubtype === "nthweek" || source.monthlySubtype === "lastday" ? source.monthlySubtype : "byday";
    const annualSubtype = source.annualSubtype === "nthweek" ? "nthweek" : "byday";
    const intervalUnit = source.intervalUnit === "day" || source.intervalUnit === "year" ? source.intervalUnit : "month";
    const time = normalizeOccasionTime(source.time);
    const priority = normalizeOccasionPriority(source.priority);
    const blockId = validateOccasionBlockRef(source.blockId);
    const contextBlockId = validateOccasionBlockRef(source.contextBlockId);
    const rawKindStr = typeof source.kind === "string" ? source.kind.trim().toLowerCase() : "";
    const categoryFromKind = rawKindStr === "expense" || rawKindStr === "renewal" || rawKindStr === "health" || rawKindStr === "festival"
        ? (rawKindStr as OccasionCategory)
        : undefined;
    const category = normalizeOccasionCategory(source.category) || categoryFromKind;
    return {
        id: typeof source.id === "string" && source.id.trim() ? source.id : makeOccasionId(),
        name, kind, date, recurrence,
        calendar,
        lunarLeap: source.lunarLeap === true,
        annualSubtype,
        month: clampInteger(source.month, 1, 12, clampInteger(date.slice(5, 7), 1, 12, 1)),
        nthWeek: clampInteger(source.nthWeek, 1, 5, 1),
        weekday: clampInteger(source.weekday, 0, 6, 0),
        monthlySubtype,
        intervalUnit,
        intervalCount: clampInteger(source.intervalCount, 1, 365, 1),
        remindBeforeDays: clampInteger(source.remindBeforeDays, 0, 365, 0),
        note: typeof source.note === "string" ? source.note.trim().slice(0, 500) : "",
        enabled: source.enabled !== false, completedDates,
        ...(Object.keys(overrides).length ? {overrides} : {}),
        ...(time ? {time} : {}),
        ...(priority ? {priority} : {}),
        ...(blockId ? {blockId} : {}),
        ...(contextBlockId ? {contextBlockId} : {}),
        ...(category ? {category} : {}),
        createdAt: typeof source.createdAt === "string" ? source.createdAt : now,
        updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : now,
    };
}

export function setOccasionOverride(store: OccasionStore, id: string, originalDate: string, newDate: string | undefined): OccasionStore {
    if (!isValidLocalDate(originalDate)) return store;
    if (newDate !== undefined && (!isValidLocalDate(newDate) || newDate === originalDate)) return store;
    if (!store.occasions.some((item) => item.id === id)) return store;
    return {
        version: OCCASIONS_STORE_VERSION,
        occasions: store.occasions.map((item) => {
            if (item.id !== id) return item;
            const overrides: Record<string, OccasionOverride> = {...(item.overrides || {})};
            if (newDate) overrides[originalDate] = {date: newDate};
            else delete overrides[originalDate];
            const changed = JSON.stringify(overrides) !== JSON.stringify(item.overrides || {});
            if (!changed) return item;
            const next: Occasion = {...item, updatedAt: new Date().toISOString()};
            if (Object.keys(overrides).length) next.overrides = overrides;
            else delete next.overrides;
            return next;
        }),
        ...(store.tombstones?.length ? {tombstones: store.tombstones} : {}),
    };
}

export function findOverrideOriginFor(item: Occasion, next: string): string | undefined {
    for (const [origin, override] of Object.entries(item.overrides || {})) {
        if (override.date === next) return origin;
    }
    return undefined;
}

export function findSimilarOccasions(occasions: readonly Occasion[], name: string, excludeId?: string, limit = 5): Occasion[] {
    const needle = name.trim().toLocaleLowerCase();
    if (!needle) return [];
    const exact: Occasion[] = [];
    const similar: Occasion[] = [];
    for (const item of occasions) {
        if (item.id === excludeId) continue;
        const candidate = item.name.trim().toLocaleLowerCase();
        if (candidate === needle) exact.push(item);
        else if ((candidate.includes(needle) || needle.includes(candidate)) && candidate.length > 0) similar.push(item);
    }
    return [...exact, ...similar].slice(0, limit);
}

export function markOccasionCompleted(store: OccasionStore, id: string, occurrenceDate: string, completed: boolean): OccasionStore {
    if (!isValidLocalDate(occurrenceDate)) return store;
    let changed = false;
    const occasions = store.occasions.map((item) => {
        if (item.id !== id) return item;
        const dates = new Set(item.completedDates);
        if (completed) dates.add(occurrenceDate); else dates.delete(occurrenceDate);
        const nextDates = [...dates].sort().slice(-120);
        changed = nextDates.join("|") !== item.completedDates.join("|");
        return changed ? {...item, completedDates: nextDates, updatedAt: new Date().toISOString()} : item;
    });
    return changed ? {version: OCCASIONS_STORE_VERSION, occasions, ...(store.tombstones?.length ? {tombstones: store.tombstones} : {})} : store;
}

export function upsertOccasion(store: OccasionStore, occasion: Occasion): OccasionStore {
    if (store.tombstones?.some((tombstone) => tombstone.occasionId === occasion.id)) return store;
    const exists = store.occasions.some((item) => item.id === occasion.id);
    const occasions = exists
        ? store.occasions.map((item) => item.id === occasion.id ? occasion : item)
        : [...store.occasions, occasion];
    return {version: OCCASIONS_STORE_VERSION, occasions, ...(store.tombstones?.length ? {tombstones: store.tombstones} : {})};
}

export function deleteOccasion(store: OccasionStore, id: string): OccasionStore {
    if (!store.occasions.some((item) => item.id === id)) return store;
    const tombstones = mergeOccasionTombstones(store.tombstones || [], [{occasionId: id, deletedAt: new Date().toISOString()}]);
    return {version: OCCASIONS_STORE_VERSION, occasions: store.occasions.filter((item) => item.id !== id), tombstones};
}

export function mergeOccasionCompletions(local: OccasionStore, remote: OccasionStore): OccasionStore {
    const remoteById = new Map(remote.occasions.map((item) => [item.id, item]));
    const tombstones = mergeOccasionTombstones(local.tombstones || [], remote.tombstones || []);
    const deletedIds = new Set(tombstones.map((tombstone) => tombstone.occasionId));
    let changed = tombstones.length !== (local.tombstones || []).length
        || tombstones.some((tombstone, index) => tombstone.occasionId !== local.tombstones?.[index]?.occasionId || tombstone.deletedAt !== local.tombstones?.[index]?.deletedAt);
    const occasions = local.occasions.flatMap((item) => {
        if (deletedIds.has(item.id)) {
            changed = true;
            return [];
        }
        const counterpart = remoteById.get(item.id);
        if (!counterpart) return [item];
        const dates = new Set([...item.completedDates, ...counterpart.completedDates]);
        const nextDates = [...dates].sort().slice(-120);
        if (nextDates.join("|") === item.completedDates.join("|")) return [item];
        changed = true;
        return [{...item, completedDates: nextDates}];
    });
    for (const [id, item] of remoteById) {
        if (deletedIds.has(id) || local.occasions.some((candidate) => candidate.id === id)) continue;
        occasions.push(item);
        changed = true;
    }
    return changed ? {version: local.version, occasions, ...(tombstones.length ? {tombstones} : {})} : local;
}

export function normalizeOccasionTombstones(value: unknown): OccasionTombstone[] {
    if (!Array.isArray(value)) return [];
    const byId = new Map<string, OccasionTombstone>();
    value.forEach((candidate) => {
        if (!candidate || typeof candidate !== "object") return;
        const entry = candidate as Partial<OccasionTombstone>;
        if (typeof entry.occasionId !== "string" || !entry.occasionId.trim() || typeof entry.deletedAt !== "string" || Number.isNaN(Date.parse(entry.deletedAt))) return;
        const tombstone = {occasionId: entry.occasionId.trim().slice(0, 200), deletedAt: new Date(entry.deletedAt).toISOString()};
        const existing = byId.get(tombstone.occasionId);
        if (!existing || tombstone.deletedAt > existing.deletedAt) byId.set(tombstone.occasionId, tombstone);
    });
    return [...byId.values()].sort((left, right) => left.occasionId.localeCompare(right.occasionId) || left.deletedAt.localeCompare(right.deletedAt)).slice(-240);
}

export function mergeOccasionTombstones(local: readonly OccasionTombstone[], remote: readonly OccasionTombstone[]): OccasionTombstone[] {
    return normalizeOccasionTombstones([...local, ...remote]);
}
