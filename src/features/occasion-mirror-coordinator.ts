import type {Occasion} from "../occasions";
import {syncOccasionToSiyuanBlock} from "./occasion-siyuan-sync";
import type {KernelPost} from "./note-anchor";

export const MIRROR_JOURNAL_NAME = "occasion-mirror-identities-v1.json";
export interface MirrorIdentity {itemId: string; phase: "reserved" | "bound"; blockId?: string; bookDocId?: string}
export interface MirrorJournal {v: 1; entries: MirrorIdentity[]}
export function readMirrorJournal(raw: unknown): MirrorJournal {
    if (raw == null) return {v: 1, entries: []};
    const value = raw as MirrorJournal;
    if (value.v !== 1 || !Array.isArray(value.entries) || value.entries.length > 10000) throw Error("mirror-journal-invalid");
    const ids = new Set<string>();
    for (const entry of value.entries) {
        if (!entry || typeof entry.itemId !== "string" || !entry.itemId || ids.has(entry.itemId) || !["reserved", "bound"].includes(entry.phase) || entry.phase === "bound" && !entry.blockId) throw Error("mirror-journal-invalid");
        ids.add(entry.itemId);
    }
    return structuredClone(value);
}
/** Restoring older local data must never erase an already-sent creation identity. */
export function assertMirrorRestore(current: MirrorJournal, incoming: MirrorJournal): void {
    for (const old of current.entries) {
        const next = incoming.entries.find((entry) => entry.itemId === old.itemId);
        if (!next || old.blockId && next.blockId !== old.blockId || old.bookDocId && next.bookDocId !== old.bookDocId) throw Error("mirror-restore-would-lose-identity");
    }
}
let fallback = Promise.resolve();
export function withOccasionMirrorLock<T>(task: () => Promise<T>): Promise<T> {
    if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request("siyuan-checkin-occasion-mirror-v1", task) as Promise<T>;
    if (typeof window !== "undefined") return Promise.reject(Error("mirror-cross-window-lock-unavailable"));
    const next = fallback.then(task, task); fallback = next.then(() => {}, () => {}); return next;
}
export interface MirrorCoordinatorDeps {
    post: KernelPost;
    lock<T>(task: () => Promise<T>): Promise<T>;
    freshItem(itemId: string): Promise<Occasion | undefined>;
    readJournal(): Promise<unknown>;
    saveJournal(journal: MirrorJournal): Promise<void>;
    bind(itemId: string, blockId: string): Promise<void>;
}
export function createOccasionMirrorCoordinator(deps: MirrorCoordinatorDeps) {
    return (itemId: string, options: {notebookId: string; todayKey: string; nowMs: number; bookDocId?: string}) => deps.lock(async () => {
        const item = await deps.freshItem(itemId);
        if (!item) return {ok: false, reason: "occasion-deleted"};
        const journal = readMirrorJournal(await deps.readJournal());
        let entry = journal.entries.find((row) => row.itemId === itemId);
        const blockId = entry?.blockId || item.blockId;
        const result = await syncOccasionToSiyuanBlock(deps.post, {...item, ...(blockId ? {blockId} : {})}, {
            ...options, bookDocId: entry?.bookDocId || options.bookDocId,
            // A durable reservation without a receipt is an unknown creation,
            // never permission to replay append. Attribute lookup may reconcile it.
            allowAppend: !entry,
            beforeAppend: async () => {
                if (!entry) { entry = {itemId, phase: "reserved"}; journal.entries.push(entry); }
                await deps.saveJournal(journal);
            },
            onAppended: async (createdId, bookDocId) => {
                entry!.blockId = createdId; entry!.bookDocId = bookDocId; entry!.phase = "bound";
                await deps.saveJournal(journal);
            },
        });
        if (result.blockId) {
            if (!entry) {entry = {itemId, phase: "bound"}; journal.entries.push(entry);}
            entry.blockId = result.blockId; entry.phase = "bound";
            if (result.bookDocId) entry.bookDocId = result.bookDocId;
            await deps.saveJournal(journal);
            try { await deps.bind(itemId, result.blockId); }
            catch { return {...result, ok: false, reason: "binding-persist-not-confirmed"}; }
        }
        return result;
    });
}
