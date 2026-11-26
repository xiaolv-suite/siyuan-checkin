import type {CheckinEvent, CheckinItem, CheckinStore} from "../../types";
import {isValidDateKey} from "../../date-keys";
import {evaluateQuotaSchedule, getItemDirectionForDate, getItemRevisionForDate} from "../../rules";
import type {DayCompletionInput} from "./types";
import {dateKey} from "./types";
import {getEventsForDay, getEventsForItem, getSkipDatesForItem} from "./store-index";

export {DayCompletionInput};

export function evaluateDayCompletion({direction, kind, progress, target, skipped}: DayCompletionInput): boolean {
    if (!(target > 0)) return false;
    if (direction === "atMost") {
        if (skipped) return false;
        return kind === "binary" ? progress === 0 : progress <= target;
    }
    return atLeastWithTolerance(progress, target);
}

function atLeastWithTolerance(progress: number, target: number): boolean {
    const tolerance = Number.EPSILON * Math.max(Math.abs(progress), Math.abs(target)) * 8;
    return progress >= target || target - progress <= tolerance;
}

function isSkipEvent(event: Pick<CheckinEvent, "kind"> | undefined): boolean {
    return event?.kind === "skip";
}

export function getProgress(store: CheckinStore, item: CheckinItem, date = new Date()): number {
    const revision = getItemRevisionForDate(item, date);
    if (revision.schedule.type === "quota") {
        return evaluateQuotaSchedule(
            revision.schedule,
            getEventsForItem(store, item.id).filter((event) => !isSkipEvent(event)),
            item.id,
            date,
            revision.schedule.quota?.countMode === "value" ? revision.unit : undefined
        )?.progress || 0;
    }
    const unit = revision.unit;
    return getEventsForDay(store, item.id, date)
        .filter((event) => event.unit === unit && !isSkipEvent(event))
        .reduce((total, event) => total + event.value, 0);
}

export function isComplete(store: CheckinStore, item: CheckinItem, date = new Date()): boolean {
    const revision = getItemRevisionForDate(item, date);
    const target = revision.schedule.type === "quota" ? revision.schedule.quota?.amount || 0 : revision.target;
    const direction = getItemDirectionForDate(item, date);
    return evaluateDayCompletion({
        direction: direction === "atMost" ? "atMost" : undefined,
        kind: revision.kind,
        progress: getProgress(store, item, date),
        target,
        skipped: direction === "atMost" && getSkipDatesForItem(store, item.id).has(dateKey(date)),
    });
}

export function countCompletedDays(store: CheckinStore, item: CheckinItem, today: Date): number {
    const startCandidates = [item.createdDate, ...item.revisions.map((revision) => revision.effectiveDate)]
        .filter((key) => isValidDateKey(key))
        .sort((a, b) => a.localeCompare(b));
    const startKey = startCandidates[0];
    if (!startKey) return 0;
    const [year, month, day] = startKey.split("-").map(Number);
    const cursor = new Date(year, month - 1, day);
    const endKey = dateKey(today);
    let count = 0;
    for (let guard = 0; guard < 3660; guard += 1) {
        const key = dateKey(cursor);
        if (key > endKey) break;
        if (isComplete(store, item, cursor)) count += 1;
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}
