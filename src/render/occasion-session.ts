import type {OccasionCategory, OccasionKind, OccasionTemplateCategory} from "../occasions";

export interface OccasionFormDraft {
    editingId?: string;
    values: Record<string, string>;
    focus?: {name: string; start: number | null; end: number | null};
}

export interface OccasionsRootContext {
    editingOccasionId?: string;
    renderedEditingOccasionId?: string;
    skipNextDraftCapture?: boolean;
    occasionSearchQuery: string;
    occasionStatusFilter: "all" | "enabled" | "disabled";
    occasionKindFilter: "all" | OccasionKind | OccasionCategory;
    occasionTimeFilter: "all" | "today" | "missed" | "upcoming" | "ended";
    occasionSortMode: "next" | "name" | "updated";
    occasionTemplatesOpen: boolean;
    occasionTemplateCategory: "recommended" | OccasionTemplateCategory;
    formOpen?: boolean;
    filtersOpen?: boolean;
    helpOpen: boolean;
    actionsHelpOpen: boolean;
    noteExpandedIds: Set<string>;
    occurrenceMoves: Record<string, {open: boolean; date: string}>;
    formDraft?: OccasionFormDraft;
    formSession: number;
    submitting: boolean;
    deletingOccasionIds: Set<string>;
    /** Row-level async action mutex; all competing actions for one occasion share it. */
    occasionActionBusyIds?: Set<string>;
    /** T-2024：顶部一句话闪电录入草稿（按 root 隔离保留）。 */
    quickDraftText?: string;
}

export interface OccasionsRootStateHost {
    /** 生命周期字段由宿主提供；可选以保持无 root/旧测试夹具兼容。 */
    disposed?: boolean;
    disposing?: boolean;
    acceptingOperations?: boolean;
    occasionStateForRoot?(root: HTMLElement): OccasionsRootContext;
    setOccasionStateForRoot?(root: HTMLElement, patch: Partial<OccasionsRootContext>): void;
    isSurfaceRoot?(root: HTMLElement, page?: string): boolean;
    editingOccasionId?: string;
    occasionSearchQuery?: string;
    occasionStatusFilter?: OccasionsRootContext["occasionStatusFilter"];
    occasionKindFilter?: OccasionsRootContext["occasionKindFilter"];
    occasionTimeFilter?: OccasionsRootContext["occasionTimeFilter"];
    occasionSortMode?: OccasionsRootContext["occasionSortMode"];
    occasionTemplatesOpen?: boolean;
    occasionTemplateCategory?: OccasionsRootContext["occasionTemplateCategory"];
}

export function createOccasionsRootContext(seed: Partial<OccasionsRootContext> = {}): OccasionsRootContext {
    return {
        occasionSearchQuery: "", occasionStatusFilter: "all", occasionKindFilter: "all", occasionTimeFilter: "all", occasionSortMode: "next",
        occasionTemplatesOpen: false, occasionTemplateCategory: "recommended", helpOpen: false, actionsHelpOpen: false,
        formSession: 0, submitting: false, ...seed,
        noteExpandedIds: new Set(seed.noteExpandedIds),
        deletingOccasionIds: new Set(seed.deletingOccasionIds),
        occasionActionBusyIds: new Set(seed.occasionActionBusyIds),
        occurrenceMoves: Object.fromEntries(Object.entries(seed.occurrenceMoves ?? {}).map(([id, move]) => [id, {...move}])),
        formDraft: seed.formDraft ? {editingId: seed.formDraft.editingId, values: {...seed.formDraft.values}, focus: seed.formDraft.focus ? {...seed.formDraft.focus} : undefined} : undefined,
    };
}

export function captureOccasionDraftFor(root: HTMLElement, state: OccasionsRootContext): void {
    if (state.skipNextDraftCapture) {
        state.skipNextDraftCapture = false;
        return;
    }
    if ((state.renderedEditingOccasionId ?? "") !== (state.editingOccasionId ?? "")) {
        return;
    }
    const form = root.querySelector<HTMLFormElement>("[data-occasion-form]");
    if (!form) return;
    const values: Record<string, string> = {};
    let focus: OccasionFormDraft["focus"];
    const active = root.ownerDocument?.activeElement;
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input[name], select[name], textarea[name]").forEach((control) => {
        values[control.name] = control.value;
        if (control === active) {
            const selection = control as HTMLInputElement;
            focus = {name: control.name, start: selection.selectionStart ?? null, end: selection.selectionEnd ?? null};
        }
    });
    state.formDraft = {editingId: state.editingOccasionId, values, focus};
}

export function restoreOccasionDraftFor(root: HTMLElement, state: OccasionsRootContext): void {
    state.renderedEditingOccasionId = state.editingOccasionId;
    const draft = state.formDraft;
    if (!draft) return;
    if (Object.prototype.hasOwnProperty.call(draft, "editingId") && (draft.editingId ?? "") !== (state.editingOccasionId ?? "")) return;
    const form = root.querySelector<HTMLFormElement>("[data-occasion-form]");
    if (!form) return;
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input[name], select[name], textarea[name]").forEach((control) => {
        if (Object.prototype.hasOwnProperty.call(draft.values, control.name)) control.value = draft.values[control.name];
        if (draft.focus?.name !== control.name) return;
        control.focus({preventScroll: true});
        if (draft.focus.start === null || draft.focus.end === null) return;
        try { (control as HTMLInputElement).setSelectionRange(draft.focus.start, draft.focus.end); } catch {}
    });
}

export function readOccasionsRootContext(host: OccasionsRootStateHost, root: HTMLElement): OccasionsRootContext {
    if (host.occasionStateForRoot) return host.occasionStateForRoot(root);
    return createOccasionsRootContext({
        editingOccasionId: host.editingOccasionId,
        occasionSearchQuery: host.occasionSearchQuery,
        occasionStatusFilter: host.occasionStatusFilter,
        occasionKindFilter: host.occasionKindFilter,
        occasionTimeFilter: host.occasionTimeFilter,
        occasionSortMode: host.occasionSortMode,
        occasionTemplatesOpen: host.occasionTemplatesOpen,
        occasionTemplateCategory: host.occasionTemplateCategory,
    });
}

export function writeOccasionsRootContext(host: OccasionsRootStateHost, root: HTMLElement, patch: Partial<OccasionsRootContext>): void {
    if (host.setOccasionStateForRoot) {
        host.setOccasionStateForRoot(root, patch);
        return;
    }
    Object.assign(host, patch);
}

export function isOccasionsRootOpen(host: OccasionsRootStateHost & {pageForRoot?(root: HTMLElement): string}, root: HTMLElement): boolean {
    if (host.disposed || host.disposing || host.acceptingOperations === false) return false;
    if (root.isConnected === false) return false;
    if (host.isSurfaceRoot && !host.isSurfaceRoot(root, "occasions")) return false;
    return host.pageForRoot ? host.pageForRoot(root) === "occasions" : Boolean(root.querySelector(".lc-checkin--occasions"));
}

export function nextOccasionFormSession(state: OccasionsRootContext): number {
    state.formSession += 1;
    return state.formSession;
}

export function isCurrentOccasionFormSession(host: OccasionsRootStateHost & {pageForRoot?(root: HTMLElement): string}, root: HTMLElement, session: number): boolean {
    if (!isOccasionsRootOpen(host, root)) return false;
    return readOccasionsRootContext(host, root).formSession === session;
}
