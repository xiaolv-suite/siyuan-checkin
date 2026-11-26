import type {CheckinEvent, CheckinEventTombstone, CheckinItem, CheckinStore} from "../../types";
import {dateKey} from "./types";

export interface TombstoneLookup {
    eventIds: Set<string>;
    externalIdentities: Set<string>;
}

export interface StoreEventIndex {
    byItem: Map<string, CheckinEvent[]>;
    eventDatesByItem: Map<string, Set<string>>;
    skipDatesByItem: Map<string, Set<string>>;
    byItemDate: Map<string, CheckinEvent[]>;
    byDate: Map<string, CheckinEvent[]>;
    byId: Map<string, CheckinEvent>;
    ordinalById: Map<string, number>;
    byExternalIdentity: Set<string>;
    tombstones: TombstoneLookup;
    byDateOrdered?: Array<{date: string; event: CheckinEvent; ordinal: number}>;
    itemById: Map<string, CheckinItem>;
}

/**
 * S1 唯一共享 WeakMap 事件索引池（单例，杜绝 model 与 domain 双缓存漂移）
 */
const storeIndexes = new WeakMap<CheckinStore, StoreEventIndex>();
const EMPTY_EVENTS: CheckinEvent[] = [];
const EMPTY_SET: ReadonlySet<string> = new Set<string>();

export function invalidateStoreIndex(store: CheckinStore): void {
    storeIndexes.delete(store);
}

function getEventKey(event: CheckinEvent): string {
    if (event.localDate && /^\d{4}-\d{2}-\d{2}$/.test(event.localDate)) {
        return event.localDate;
    }
    const occurredAt = new Date(event.occurredAt);
    return Number.isNaN(occurredAt.getTime()) ? event.occurredAt.slice(0, 10) : dateKey(occurredAt);
}

function getExternalRefIdentity(event: CheckinEvent): string | undefined {
    return event.externalRef ? JSON.stringify([event.itemId, event.source, event.externalRef]) : undefined;
}

function buildTombstoneLookup(tombstones: readonly CheckinEventTombstone[]): TombstoneLookup {
    const eventIds = new Set<string>();
    const externalIdentities = new Set<string>();
    tombstones.forEach((tombstone) => {
        eventIds.add(tombstone.eventId);
        if (tombstone.itemId && tombstone.source && tombstone.externalRef) {
            externalIdentities.add(JSON.stringify([tombstone.itemId, tombstone.source, tombstone.externalRef]));
        }
    });
    return {eventIds, externalIdentities};
}

export function getStoreIndex(store: CheckinStore): StoreEventIndex {
    let index = storeIndexes.get(store);
    if (!index) {
        index = {
            byItem: new Map(),
            eventDatesByItem: new Map(),
            skipDatesByItem: new Map(),
            byItemDate: new Map(),
            byDate: new Map(),
            byId: new Map(),
            ordinalById: new Map(),
            byExternalIdentity: new Set(),
            tombstones: buildTombstoneLookup(store.eventTombstones || []),
            itemById: new Map(),
        };
        for (const item of store.items) {
            if (!index.itemById.has(item.id)) index.itemById.set(item.id, item);
        }
        for (let ordinal = 0; ordinal < store.events.length; ordinal += 1) {
            const event = store.events[ordinal];
            const itemEvents = index.byItem.get(event.itemId);
            if (itemEvents) itemEvents.push(event);
            else index.byItem.set(event.itemId, [event]);

            const day = getEventKey(event);
            const itemDates = index.eventDatesByItem.get(event.itemId);
            if (itemDates) itemDates.add(day);
            else index.eventDatesByItem.set(event.itemId, new Set([day]));

            if (event.kind === "skip") {
                const skipDates = index.skipDatesByItem.get(event.itemId);
                if (skipDates) skipDates.add(day);
                else index.skipDatesByItem.set(event.itemId, new Set([day]));
            }

            const itemDateKey = event.itemId + ":" + day;
            const itemDateEvents = index.byItemDate.get(itemDateKey);
            if (itemDateEvents) itemDateEvents.push(event);
            else index.byItemDate.set(itemDateKey, [event]);

            const dateEvents = index.byDate.get(day);
            if (dateEvents) dateEvents.push(event);
            else index.byDate.set(day, [event]);

            if (!index.byId.has(event.id)) {
                index.byId.set(event.id, event);
                index.ordinalById.set(event.id, ordinal);
            }

            const externalIdentity = getExternalRefIdentity(event);
            if (externalIdentity) index.byExternalIdentity.add(externalIdentity);
        }
        storeIndexes.set(store, index);
    }
    return index;
}

export function getEventsForItem(store: CheckinStore, itemId: string): CheckinEvent[] {
    return getStoreIndex(store).byItem.get(itemId) || EMPTY_EVENTS;
}

export function getEventsForDay(store: CheckinStore, itemId: string, date: Date | string = new Date()): CheckinEvent[] {
    const key = typeof date === "string" ? date : dateKey(date);
    return getStoreIndex(store).byItemDate.get(itemId + ":" + key) || EMPTY_EVENTS;
}

export function getEventDatesForItem(store: CheckinStore, itemId: string): ReadonlySet<string> {
    return getStoreIndex(store).eventDatesByItem.get(itemId) || EMPTY_SET;
}

export function getSkipDatesForItem(store: CheckinStore, itemId: string): ReadonlySet<string> {
    return getStoreIndex(store).skipDatesByItem.get(itemId) || EMPTY_SET;
}

export function getItemById(store: CheckinStore, itemId: string | undefined): CheckinItem | undefined {
    return itemId ? getStoreIndex(store).itemById.get(itemId) : undefined;
}
