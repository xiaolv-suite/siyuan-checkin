import {daysBetweenHalfOpen, isValidDateKey} from "../date-keys";
import {isWithinQuietHours, normalizeDailyReminderSlots, reminderMinutesOfDay, type DailyReminderPreference, type ReminderQuietHours} from "./reminder-preferences";

export interface ReminderDelivery {
    localDate: string;
    slot: string;
    context: "workspace";
}

export interface ReminderDeliveryState {
    version: 1;
    delivered: ReminderDelivery[];
    mutedDates: string[];
}

export function emptyReminderDeliveryState(): ReminderDeliveryState {
    return {version: 1, delivered: [], mutedDates: []};
}

export function deserializeReminderDeliveryState(value: unknown, today: string): ReminderDeliveryState | undefined {
    if (!isValidDateKey(today)) return undefined;
    if (value === undefined || value === null || value === "") return emptyReminderDeliveryState();
    let candidate: unknown = value;
    if (typeof candidate === "string") {
        try { candidate = JSON.parse(candidate); } catch { return undefined; }
    }
    if (!candidate || typeof candidate !== "object") return undefined;
    const source = candidate as Partial<ReminderDeliveryState>;
    if (source.version !== 1 || !Array.isArray(source.delivered) || !Array.isArray(source.mutedDates)) return undefined;
    if (source.mutedDates.some((date) => !isValidDateKey(date)) || source.delivered.some((entry) =>
        !entry || !isValidDateKey(entry.localDate) || entry.context !== "workspace"
        || (entry.slot !== "launch" && reminderMinutesOfDay(entry.slot) === undefined))) return undefined;
    const retained = (date: string) => {
        const age = daysBetweenHalfOpen(date, today);
        return age !== undefined && age >= 0 && age < 7;
    };
    const delivered = new Map<string, ReminderDelivery>();
    source.delivered.filter((entry) => retained(entry.localDate)).forEach((entry) => {
        delivered.set(`${entry.localDate}|${entry.context}|${entry.slot}`, {...entry});
    });
    return {
        version: 1,
        delivered: [...delivered.values()].sort((left, right) => left.localDate.localeCompare(right.localDate) || left.slot.localeCompare(right.slot)),
        mutedDates: [...new Set(source.mutedDates.filter(retained))].sort(),
    };
}

export function dueReminderDeliverySlots(state: ReminderDeliveryState, today: string, minutesOfDay: number, preference: DailyReminderPreference): string[] {
    if (!preference.enabled || state.mutedDates.includes(today) || !isValidDateKey(today)
        || !Number.isInteger(minutesOfDay) || minutesOfDay < 0 || minutesOfDay >= 1440) return [];
    const slots = normalizeDailyReminderSlots(preference.slots);
    const scheduled = slots.length ? slots.filter((slot) => minutesOfDay >= (reminderMinutesOfDay(slot) ?? 1441)) : ["launch"];
    return scheduled.filter((slot) => !state.delivered.some((entry) => entry.localDate === today && entry.context === "workspace" && entry.slot === slot));
}

export function markReminderDelivered(state: ReminderDeliveryState, today: string, slots: readonly string[]): ReminderDeliveryState {
    return deserializeReminderDeliveryState({
        ...state,
        delivered: [...state.delivered, ...slots.map((slot): ReminderDelivery => ({localDate: today, slot, context: "workspace"}))],
    }, today) ?? state;
}

export function muteReminderDeliveryToday(state: ReminderDeliveryState, today: string): ReminderDeliveryState {
    return deserializeReminderDeliveryState({...state, mutedDates: [...state.mutedDates, today]}, today) ?? state;
}

export function unmuteReminderDeliveryToday(state: ReminderDeliveryState, today: string): ReminderDeliveryState {
    if (!isValidDateKey(today)) return state;
    return deserializeReminderDeliveryState({
        ...state,
        mutedDates: state.mutedDates.filter((date) => date !== today),
    }, today) ?? state;
}

export interface ReminderSlotPlan {
    slot: string;
    minutesOfDay?: number;
    state: "delivered" | "quiet" | "muted" | "due" | "upcoming" | "disabled";
}

export interface ReminderPlanPreview {
    enabled: boolean;
    mutedToday: boolean;
    inQuietHours: boolean;
    slots: ReminderSlotPlan[];
    nextDueSlot?: string;
}

/** T-1662：每日提醒排期与状态矩阵计划预览——综合槽位、已投递状态、安静时段与今日静音，纯函数无副作用。 */
export function buildReminderPlanPreview(
    state: ReminderDeliveryState,
    today: string,
    currentMinutesOfDay: number,
    preference: DailyReminderPreference,
    quietHours: ReminderQuietHours,
): ReminderPlanPreview {
    const enabled = Boolean(preference.enabled);
    const mutedToday = state.mutedDates.includes(today);
    const inQuietHours = isWithinQuietHours(currentMinutesOfDay, quietHours);
    const rawSlots = normalizeDailyReminderSlots(preference.slots);
    const slotKeys = rawSlots.length ? rawSlots : ["launch"];

    let nextDueSlot: string | undefined;
    const slots: ReminderSlotPlan[] = slotKeys.map((slot) => {
        const slotMinutes = slot === "launch" ? undefined : reminderMinutesOfDay(slot);
        const delivered = state.delivered.some(
            (entry) => entry.localDate === today && entry.context === "workspace" && entry.slot === slot,
        );

        let slotState: ReminderSlotPlan["state"];
        if (!enabled) {
            slotState = "disabled";
        } else if (delivered) {
            slotState = "delivered";
        } else if (mutedToday) {
            slotState = "muted";
        } else if (slot === "launch") {
            slotState = inQuietHours ? "quiet" : "due";
        } else if (slotMinutes !== undefined) {
            if (slotMinutes <= currentMinutesOfDay) {
                slotState = inQuietHours ? "quiet" : "due";
            } else {
                slotState = "upcoming";
            }
        } else {
            slotState = "upcoming";
        }

        if (slotState === "due" && !nextDueSlot) {
            nextDueSlot = slot;
        }

        return {
            slot,
            ...(slotMinutes !== undefined ? {minutesOfDay: slotMinutes} : {}),
            state: slotState,
        };
    });

    return {
        enabled,
        mutedToday,
        inQuietHours,
        slots,
        ...(nextDueSlot ? {nextDueSlot} : {}),
    };
}
