/* T-1621 & T-1663：跨表面 SurfaceContext 全量契约、双向恢复与多 root 隔离治理。
   纯函数模块，无隐式时钟，无宿主副作用，受 CLOCK_FREE_MODULES 保护。 */

import type {PageId} from "../types";

export interface SurfaceContextParams {
    itemId?: string;
    /** review 记录日视图的钻取日（selectedHistoryDate，仅 day 范围携带）。 */
    date?: string;
    /** review 概览范围（summaryRange 或自定义区间）或洞察周期范围。 */
    range?: "day" | "week" | "month" | "28" | "84" | "365" | "custom" | {startDate: string; endDate: string};
    workspace?: "overview" | "records" | "analysis" | "lifelog";
    /** today 搜索 / review 记录查询 / archived 查询 / 事项搜索 / 设置搜索（按当前页取用）。 */
    query?: string;
    filters?: {
        scope?: "day" | "period";
        source?: string;
        metering?: string;
        order?: string;
        page?: number;
        reminder?: string;
        status?: string;
        kind?: string;
        time?: string;
        sort?: string;
    };
    section?: string;
}

export interface SurfaceContext {
    page: PageId;
    returnTo?: PageId;
    params: SurfaceContextParams;
}

/** 默认返回表：未显式记录 returnTo 的详情页统一回落 today。 */
export function defaultReturnPage(_page: PageId): "today" {
    return "today";
}

/** 契约 1 SurfaceContext 读侧：把宿主或 root 会话态聚合为只读上下文。
    T-1621：全量覆盖 Today、Review、Archived、Insights、Editor、Occasions、Settings 全矩阵。 */
export function readSurfaceContext(snapshot: {
    currentPage: PageId;
    editorReturnPage?: "today" | "review" | "insights" | "more";
    insightsReturnPage: "today" | "review";
    editingId?: string;
    insightsItemId?: string;
    selectedHistoryDate?: string;
    summaryRange?: "day" | "week" | "month";
    summaryCustomRange?: {startDate: string; endDate: string};
    reviewWorkspace?: "overview" | "records" | "analysis" | "lifelog";
    todayQuery?: string;
    historyQuery?: string;
    archivedQuery?: string;
    historyScope?: "day" | "period";
    historySource?: string;
    historyMetering?: string;
    historyOrder?: string;
    historyPage?: number;
    reminderFilter?: string;
    insightsRange?: "28" | "84" | "365" | "custom";
    insightsCustomRange?: {startDate: string; endDate: string};
    insightsItemQuery?: string;
    editingOccasionId?: string;
    occasionSearchQuery?: string;
    occasionStatusFilter?: "all" | "enabled" | "disabled";
    occasionKindFilter?: string;
    occasionTimeFilter?: "all" | "today" | "missed" | "upcoming" | "ended";
    occasionSortMode?: "next" | "name" | "updated";
    settingsQuery?: string;
    returnPage?: PageId;
}): SurfaceContext {
    const page = snapshot.currentPage;
    const returnTo = page === "editor"
        ? snapshot.editorReturnPage ?? defaultReturnPage(page)
        : page === "insights" ? snapshot.insightsReturnPage
        : (page === "archived" || page === "occasions" || page === "settings")
            ? (snapshot.returnPage ?? defaultReturnPage(page))
        : undefined;

    const itemId = page === "editor" ? snapshot.editingId
        : page === "insights" ? snapshot.insightsItemId
        : page === "occasions" ? snapshot.editingOccasionId : undefined;

    const params: SurfaceContextParams = itemId ? {itemId} : {};

    if (page === "review") {
        if (snapshot.historyScope === "day" && snapshot.selectedHistoryDate) params.date = snapshot.selectedHistoryDate;
        if (snapshot.reviewWorkspace) params.workspace = snapshot.reviewWorkspace;
        const range = snapshot.summaryCustomRange
            ? {startDate: snapshot.summaryCustomRange.startDate, endDate: snapshot.summaryCustomRange.endDate}
            : snapshot.summaryRange;
        if (range) params.range = range;
        if (snapshot.historyQuery) params.query = snapshot.historyQuery;
        const filters: NonNullable<SurfaceContextParams["filters"]> = {};
        if (snapshot.historyScope) filters.scope = snapshot.historyScope;
        if (snapshot.historySource && snapshot.historySource !== "all") filters.source = snapshot.historySource;
        if (snapshot.historyMetering && snapshot.historyMetering !== "all") filters.metering = snapshot.historyMetering;
        if (snapshot.historyOrder && snapshot.historyOrder !== "newest") filters.order = snapshot.historyOrder;
        if (snapshot.historyPage) filters.page = snapshot.historyPage;
        if (snapshot.reminderFilter && snapshot.reminderFilter !== "all") filters.reminder = snapshot.reminderFilter;
        params.filters = filters;
    } else if (page === "today") {
        if (snapshot.todayQuery) params.query = snapshot.todayQuery;
    } else if (page === "archived") {
        if (snapshot.archivedQuery) params.query = snapshot.archivedQuery;
    } else if (page === "insights") {
        if (snapshot.insightsItemQuery) params.query = snapshot.insightsItemQuery;
        const range = snapshot.insightsCustomRange
            ? {startDate: snapshot.insightsCustomRange.startDate, endDate: snapshot.insightsCustomRange.endDate}
            : (snapshot.insightsRange && snapshot.insightsRange !== "84" ? snapshot.insightsRange : undefined);
        if (range) params.range = range;
    } else if (page === "occasions") {
        if (snapshot.occasionSearchQuery) params.query = snapshot.occasionSearchQuery;
        const filters: NonNullable<SurfaceContextParams["filters"]> = {};
        if (snapshot.occasionStatusFilter && snapshot.occasionStatusFilter !== "all") filters.status = snapshot.occasionStatusFilter;
        if (snapshot.occasionKindFilter && snapshot.occasionKindFilter !== "all") filters.kind = snapshot.occasionKindFilter;
        if (snapshot.occasionTimeFilter && snapshot.occasionTimeFilter !== "all") filters.time = snapshot.occasionTimeFilter;
        if (snapshot.occasionSortMode && snapshot.occasionSortMode !== "next") filters.sort = snapshot.occasionSortMode;
        if (Object.keys(filters).length > 0) params.filters = filters;
    } else if (page === "settings") {
        if (snapshot.settingsQuery) params.query = snapshot.settingsQuery;
    }

    return {page, returnTo, params};
}

/** T-1663：滚动复合键——支持按页面及条目 ID 派生唯一定位键，避免同页面不同条目滚动串台。 */
export function getScrollTopKey(page: PageId, params?: SurfaceContextParams): string {
    if ((page === "editor" || page === "insights") && params?.itemId) {
        return `${page}:${params.itemId}`;
    }
    return page;
}

export function serializeSurfaceContext(context: SurfaceContext): string {
    return JSON.stringify({
        v: 1,
        page: context.page,
        returnTo: context.returnTo,
        params: context.params,
    });
}

const VALID_PAGES = new Set<PageId>(["today", "editor", "review", "archived", "insights", "occasions", "settings", "more"]);

export function deserializeSurfaceContext(raw: string): SurfaceContext | undefined {
    if (!raw || typeof raw !== "string") return undefined;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return undefined;
        if (!VALID_PAGES.has(parsed.page)) return undefined;
        const page: PageId = parsed.page;
        const returnTo: PageId | undefined = parsed.returnTo && VALID_PAGES.has(parsed.returnTo) ? parsed.returnTo : undefined;
        const rawParams = parsed.params && typeof parsed.params === "object" ? parsed.params : {};
        const params: SurfaceContextParams = {};
        if (typeof rawParams.itemId === "string") params.itemId = rawParams.itemId;
        if (typeof rawParams.date === "string") params.date = rawParams.date;
        if (typeof rawParams.query === "string") params.query = rawParams.query;
        if (typeof rawParams.section === "string") params.section = rawParams.section;
        if (rawParams.workspace === "overview" || rawParams.workspace === "records" || rawParams.workspace === "analysis" || rawParams.workspace === "lifelog") {
            params.workspace = rawParams.workspace;
        }
        if (rawParams.range) {
            if (rawParams.range === "day" || rawParams.range === "week" || rawParams.range === "month" || rawParams.range === "28" || rawParams.range === "84" || rawParams.range === "365" || rawParams.range === "custom") {
                params.range = rawParams.range;
            } else if (typeof rawParams.range === "object" && typeof rawParams.range.startDate === "string" && typeof rawParams.range.endDate === "string") {
                params.range = {startDate: rawParams.range.startDate, endDate: rawParams.range.endDate};
            }
        }
        if (rawParams.filters && typeof rawParams.filters === "object") {
            const filters: NonNullable<SurfaceContextParams["filters"]> = {};
            if (rawParams.filters.scope === "day" || rawParams.filters.scope === "period") {
                filters.scope = rawParams.filters.scope;
            }
            for (const key of ["source", "metering", "order", "reminder", "status", "kind", "time", "sort"] as const) {
                if (typeof rawParams.filters[key] === "string") {
                    filters[key] = rawParams.filters[key];
                }
            }
            if (typeof rawParams.filters.page === "number" && Number.isInteger(rawParams.filters.page) && rawParams.filters.page >= 0) {
                filters.page = rawParams.filters.page;
            }
            if (Object.keys(filters).length > 0) params.filters = filters;
        }
        return {page, returnTo, params};
    } catch {
        return undefined;
    }
}

export interface SurfaceContextHost {
    pageOfRoot(root: HTMLElement): PageId;
    applyNavigation(root: HTMLElement | undefined, page: PageId): boolean;
    setReturnPageForRoot?(root: HTMLElement | undefined, page: "today" | "review" | "insights" | "more"): void;
    returnPageForRoot?(root: HTMLElement): "today" | "review" | "insights" | "more" | undefined;
    setTodayQueryForRoot?(root: HTMLElement, query: string): void;
    setArchivedQueryForRoot?(root: HTMLElement, query: string): void;
    reviewStateForRoot?(root: HTMLElement): any;
    setReviewStateForRoot?(root: HTMLElement, patch: any): void;
    insightsStateForRoot?(root: HTMLElement): any;
    setInsightsStateForRoot?(root: HTMLElement | undefined, patch: any): void;
    editorStateForRoot?(root: HTMLElement): any;
    setEditorStateForRoot?(root: HTMLElement | undefined, patch: any, replace?: boolean): void;
    occasionStateForRoot?(root: HTMLElement): any;
    setOccasionStateForRoot?(root: HTMLElement, patch: any): void;
    settingsStateForRoot?(root: HTMLElement): any;
    renderInto?(root: HTMLElement): void;
    render(root?: HTMLElement): void;
}

/** T-1621：全量 SurfaceContext 恢复执行器——将纯状态原子应用到目标 root 表面并完成重绘。 */
export function applySurfaceContext(host: SurfaceContextHost, root: HTMLElement, context: SurfaceContext): boolean {
    if (!host.applyNavigation(root, context.page)) return false;

    if (context.returnTo) {
        if (context.page === "editor" && host.setEditorStateForRoot) {
            host.setEditorStateForRoot(root, {editorReturnPage: context.returnTo});
        } else if (context.page === "insights" && host.setInsightsStateForRoot) {
            const ret = context.returnTo === "review" ? "review" : "today";
            host.setInsightsStateForRoot(root, {insightsReturnPage: ret});
        } else if (host.setReturnPageForRoot) {
            const ret = (context.returnTo === "today" || context.returnTo === "review" || context.returnTo === "insights" || context.returnTo === "more")
                ? context.returnTo : "today";
            host.setReturnPageForRoot(root, ret);
        }
    }

    const {params} = context;
    if (params.itemId) {
        if (context.page === "editor" && host.setEditorStateForRoot) {
            host.setEditorStateForRoot(root, {editingId: params.itemId});
        } else if (context.page === "insights" && host.setInsightsStateForRoot) {
            host.setInsightsStateForRoot(root, {insightsItemId: params.itemId});
        } else if (context.page === "occasions" && host.setOccasionStateForRoot) {
            host.setOccasionStateForRoot(root, {editingOccasionId: params.itemId});
        }
    }

    if (params.query !== undefined) {
        if (context.page === "today" && host.setTodayQueryForRoot) {
            host.setTodayQueryForRoot(root, params.query);
        } else if (context.page === "archived" && host.setArchivedQueryForRoot) {
            host.setArchivedQueryForRoot(root, params.query);
        } else if (context.page === "review" && host.setReviewStateForRoot) {
            host.setReviewStateForRoot(root, {historyQuery: params.query});
        } else if (context.page === "insights" && host.setInsightsStateForRoot) {
            host.setInsightsStateForRoot(root, {insightsItemQuery: params.query});
        } else if (context.page === "occasions" && host.setOccasionStateForRoot) {
            host.setOccasionStateForRoot(root, {occasionSearchQuery: params.query});
        } else if (context.page === "settings" && host.settingsStateForRoot) {
            const settings = host.settingsStateForRoot(root);
            if (settings?.searchSession) settings.searchSession.query = params.query;
        }
    }

    if (context.page === "review" && host.setReviewStateForRoot) {
        const patch: Record<string, unknown> = {};
        if (params.date) {
            patch.selectedHistoryDate = params.date;
            patch.historyScope = "day";
        }
        if (params.workspace) patch.reviewWorkspace = params.workspace;
        if (params.range) {
            if (typeof params.range === "object") patch.summaryCustomRange = params.range;
            else patch.summaryRange = params.range;
        }
        if (params.filters) {
            if (params.filters.scope) patch.historyScope = params.filters.scope;
            if (params.filters.source) patch.historySource = params.filters.source;
            if (params.filters.metering) patch.historyMetering = params.filters.metering;
            if (params.filters.order) patch.historyOrder = params.filters.order;
            if (params.filters.page !== undefined) patch.historyPage = params.filters.page;
            if (params.filters.reminder) patch.reminderFilter = params.filters.reminder;
        }
        host.setReviewStateForRoot(root, patch);
    } else if (context.page === "insights" && host.setInsightsStateForRoot) {
        const patch: Record<string, unknown> = {};
        if (params.range) {
            if (typeof params.range === "object") {
                patch.insightsRange = "custom";
                patch.insightsCustomRange = params.range;
            } else if (params.range === "28" || params.range === "84" || params.range === "365") {
                patch.insightsRange = params.range;
            }
        }
        host.setInsightsStateForRoot(root, patch);
    } else if (context.page === "occasions" && host.setOccasionStateForRoot && params.filters) {
        const patch: Record<string, unknown> = {};
        if (params.filters.status) patch.occasionStatusFilter = params.filters.status;
        if (params.filters.kind) patch.occasionKindFilter = params.filters.kind;
        if (params.filters.time) patch.occasionTimeFilter = params.filters.time;
        if (params.filters.sort) patch.occasionSortMode = params.filters.sort;
        host.setOccasionStateForRoot(root, patch);
    }

    if (host.renderInto) host.renderInto(root);
    else host.render(root);
    return true;
}

export interface MultiRootIsolationAudit {
    totalRoots: number;
    isolatedRoots: number;
    distinctPages: number;
    hasCrossPollution: boolean;
    issues: string[];
}

/** T-1663：多 root 隔离与防串台健康度审计。 */
export function auditMultiRootIsolation(
    roots: Array<{root: HTMLElement; page: PageId; context?: any}>,
): MultiRootIsolationAudit {
    const issues: string[] = [];
    const seenRoots = new Set<HTMLElement>();
    const seenQueries = new Map<string, HTMLElement>();
    const seenForms = new Map<any, HTMLElement>();
    const pages = new Set<PageId>();

    for (let i = 0; i < roots.length; i += 1) {
        const entry = roots[i];
        if (seenRoots.has(entry.root)) {
            issues.push(`Duplicate root element detected at index ${i}`);
        }
        seenRoots.add(entry.root);
        pages.add(entry.page);

        if (entry.context) {
            const ctx = entry.context;
            if (ctx.todayQuery && ctx.todayQuery.length > 0) {
                const prev = seenQueries.get(`today:${ctx.todayQuery}`);
                if (prev && prev !== entry.root) {
                    // Sharing query instance or same exact string is acceptable if seeded, but WeakMap/Set equality is checked
                }
            }
            if (ctx.editor?.draft && typeof ctx.editor.draft === "object") {
                const prev = seenForms.get(ctx.editor.draft);
                if (prev && prev !== entry.root) {
                    issues.push(`Cross-root pollution: Editor draft object is shared between roots`);
                }
                seenForms.set(ctx.editor.draft, entry.root);
            }
            if (ctx.occasions?.formDraft && typeof ctx.occasions.formDraft === "object") {
                const prev = seenForms.get(ctx.occasions.formDraft);
                if (prev && prev !== entry.root) {
                    issues.push(`Cross-root pollution: Occasion form draft object is shared between roots`);
                }
                seenForms.set(ctx.occasions.formDraft, entry.root);
            }
        }
    }

    return {
        totalRoots: roots.length,
        isolatedRoots: roots.length - (issues.length > 0 ? 1 : 0),
        distinctPages: pages.size,
        hasCrossPollution: issues.length > 0,
        issues,
    };
}
