/* 对外 API 工厂：从 index.ts 外置（T-022）。
   CheckinApiHost 以结构化接口声明插件宿主成员；index.ts 通过
   `createCheckinApi(this as unknown as CheckinApiHost)` 接线，绕开 private 可见性（仅编译期）。 */
import {getEventsInCustomRange, getEventRangeSummary, buildCustomSummaryContext, buildSummaryContext, diagnoseWeakestDayOfWeek, type CustomSummaryRange, type SummaryRange, type EventRangeSummary, type EventRangeSummaryOptions} from "./analytics";
import {computeEventStreaks, computeLongestStreaks, getEventsInDateRange, getItemRevisionForDate, dateKey, queryTodayItems, isComplete, getProgress, type StreakFreezePeriod} from "./model";
import {buildHabitScoreSeries, collectHabitScoreDays, scheduleFrequency} from "./features/habit-score";
import {filterEventsInRange, isValidEventSource, planBatchRecord, projectItems, type BatchEntryResult} from "./features/api-v5";
import {abstinenceMilestones} from "./features/pace-projection";
import type {CheckinEvent, CheckinIntegrationEvent, CheckinItem, CheckinKind, CheckinStore} from "./types";
import {currentCalendarDate, captureActionMoment, calendarDateFromKey, isValidLocalDateInput, withTimeout} from "./shared";
import {serializeCsv, serializeJson} from "./export";
import {getVisibleOccasions, resolveOccasionCategory, parseQuickOccasionInput, type Occasion, type OccasionCategory, type OccasionStore, type QuickOccasionDraft} from "./occasions";
import {CHECKIN_API_NAME, CHECKIN_EVENT_NAMES, type FocusAdapter, type SummaryProvider} from "./integrations";
import {normalizeSummaryProviderResult} from "./agent-suggestions";
import {CHECKIN_API_PROTOCOL, CHECKIN_API_VERSION, CHECKIN_CAPABILITIES, hasCheckinCapability, getCheckinApiDescriptor, getCheckinCapabilityInfo, type CheckinCapability, type CheckinApiDescriptor, type CheckinCapabilityInfo} from "./api-contract";
import {cloneSuggestionWorkflow, workflowSummary, workflowUpdatedAt, type SuggestionWorkflowState} from "./features/suggestion-workflow";
import {buildCalendarProjection, type CalendarProjection} from "./features/calendar-projection";
import {buildAnalyticsSnapshot, cloneAnalyticsSnapshot, summarizeAnalyticsSnapshot, type AnalyticsSnapshot, type AnalyticsSnapshotSummary} from "./charts";
import {sanitizeDiagnosticDetail} from "./features/diagnostics";

export interface CheckinApi {
    name: string;
    protocol: string;
    version: number;
    capabilities: readonly CheckinCapability[];
    hasCapability: (name: unknown) => name is CheckinCapability;
    describe: () => Readonly<CheckinApiDescriptor>;
    getCapabilityInfo: () => Readonly<Record<CheckinCapability, CheckinCapabilityInfo>>;
    isReady: () => boolean;
    whenReady: () => Promise<boolean>;
    open?: () => void;
    openDefaultEntry?: () => void;
    getStore: () => CheckinStore;
    getItems: () => CheckinItem[];
    /** Authoritative scheduled-day rows; no notes, credentials or external identities. */
    getDailyProjection: (localDate?: string) => CheckinDailyProjection;
    getEvents: () => CheckinEvent[];
    /** Bounded local-date projection; range is half-open [startDate, endDateExclusive). */
    getEventRangeSummary: (range: {startDate: string; endDateExclusive: string}, options?: EventRangeSummaryOptions) => EventRangeSummary;
    /** T-1391（calendar.read）：有界项目×日期只读日历投影；隐藏项目（taskHorizonCalendarVisible=false）与归档项目在服务端过滤。 */
    getCalendarProjection: (range: {startDate: string; endDateExclusive: string}) => CalendarProjection;
    /** v5:有界日期区间事件读(半开区间,升序);truncated=true 表示达到 limit 截断;options 支持 signal 取消与 itemIds 消毒。 */
    getEventsInRange: (range: {startDate: string; endDateExclusive: string}, options?: {itemIds?: string[]; source?: CheckinEvent["source"]; includeSkips?: boolean; limit?: number; signal?: AbortSignal}) => {events: CheckinEvent[]; truncated: boolean};
    /** v5:统一项目投影(归档语义二选一 + 类型过滤 + 限量)。 */
    queryItems: (options?: {includeArchived?: boolean; archivedOnly?: boolean; kinds?: CheckinKind[]; limit?: number}) => CheckinItem[];
    /** v5:派生指标门面——当前连续(与成就/洞察同一模型实现)。 */
    getStreaks: (itemIds?: string[]) => readonly {itemId: string; current: number; longest: number; milestones?: {achieved: number; next?: number; progressPct: number}}[];
    /** T-1361:会话诊断原因码(环形容量 20,防御性副本)。 */
    getDiagnostics: () => readonly {code: string; at: string; detail?: string}[];
    getOccasions: () => Occasion[];
    queryOccasions: (options?: {category?: OccasionCategory; includeDisabled?: boolean}) => Occasion[];
    getTodayOccasions: () => VisibleOccasion[];
    completeOccasion: (id: string, occurrenceDate: string, completed: boolean) => Promise<boolean>;
    parseQuickOccasion: (text: string, baseDateKey?: string) => QuickOccasionDraft | undefined;
    addOccasionQuick: (text: string, baseDateKey?: string) => Promise<{ok: boolean; occasion?: Occasion; reason?: string}>;
    syncBirthdaysFromContacts: () => Promise<{ok: boolean; count: number; reason?: string}>;
    getSummaryContext: (range: SummaryRange) => ReturnType<typeof buildSummaryContext>;
    getCustomSummaryContext: (range: CustomSummaryRange) => ReturnType<typeof buildCustomSummaryContext>;
    getAnalyticsSnapshot: (asOf?: Date) => AnalyticsSnapshot;
    getAnalyticsSummary: (asOf?: Date) => AnalyticsSnapshotSummary;
    /** T-1227：有界强度摘要（只读；窗口 7~366 天，默认 30；最多 200 个活跃项目）。 */
    getStrengthSummary: (options?: {windowDays?: number}) => {windowDays: number; startDate: string; endDate: string; items: Array<{itemId: string; name: string; score: number}>};
    /** 薄弱星期几诊断洞察 */
    getWeakestDayDiagnosis: (options?: {days?: number; itemId?: string}) => ReturnType<typeof diagnoseWeakestDayOfWeek>;
    getArchivedItems: () => CheckinItem[];
    setItemArchived: (itemId: string, archived: boolean) => Promise<boolean>;
    exportJson: () => string;
    exportCsv: () => string;
    recordEvent: (input: {itemId: string; value?: number; unit?: string; source?: CheckinEvent["source"]; note?: string; externalRef?: string}) => Promise<CheckinEvent | undefined>;
    /** v5:幂等批量写入——单次持久化,结果与输入严格 1:1;宿主级失败(未就绪/持久化失败/取消)整体拒绝。 */
    recordEventsBatch: (inputs: readonly {itemId: string; value?: number; unit?: string; source?: "api"; externalRef?: string; note?: string; occurredAt?: string}[], options?: {signal?: AbortSignal}) => Promise<BatchEntryResult[]>;
    startFocus: (itemId: string) => Promise<boolean>;
    stopFocus: () => Promise<boolean>;
    getFocusAdapters: () => ReadonlyArray<{id: string; name: string}>;
    getFocusStatus: () => Readonly<{busy: boolean; activeAdapterId?: string; adapterCount: number}>;
    registerFocusAdapter: (adapter: FocusAdapter, options?: {stopActive?: boolean}) => (unregisterOptions?: {stopActive?: boolean}) => void;
    registerSummaryProvider: (provider: SummaryProvider) => () => void;
    summarize: (range: SummaryRange, providerId?: string) => Promise<string | undefined>;
    summarizeCustom: (range: CustomSummaryRange, providerId?: string) => Promise<string | undefined>;
    getSuggestionWorkflow: () => SuggestionWorkflowState | undefined;
    getSuggestionWorkflowSummary: () => ReturnType<typeof workflowSummary> & {updatedAt: string} | undefined;
    subscribe: (listener: (event: CheckinIntegrationEvent) => void) => () => void;
}

type VisibleOccasion = Occasion & {occurrenceDate: string; status: "today" | "upcoming"; daysUntil: number; completionKey: string};

export interface CheckinApiHost {
    streakFreezePeriods?: readonly StreakFreezePeriod[];
    acceptingOperations: boolean;
    disposed: boolean;
    disposing: boolean;
    initializationState: "loading" | "ready" | "failed";
    readyPromise: Promise<boolean>;
    store: CheckinStore;
    occasionStore: {occasions: Occasion[]};
    summaryProviders: Map<string, SummaryProvider>;
    focusAdapters: Map<string, FocusAdapter>;
    activeFocusAdapter?: FocusAdapter;
    focusBusy: boolean;
    focusOperation: Promise<void>;
    apiSubscriptions: Set<() => void>;
    cloneItem(item: CheckinItem): CheckinItem;
    cloneStore(store?: CheckinStore): CheckinStore;
    getSummaryEvents(range: SummaryRange, date?: Date): CheckinEvent[];
    enqueueMutation<T>(operation: () => Promise<T>): Promise<T>;
    setItemArchived(itemId: string, archived: boolean, moment: {occurredAt: string; localDate: string}, expectedFingerprint?: string): Promise<boolean>;
    setOccasionCompleted(id: string, occurrenceDate: string, completed: boolean): Promise<boolean>;
    recordExternalEvent(input: {itemId: string; value?: number; unit?: string; source?: CheckinEvent["source"]; note?: string; externalRef?: string}, moment: {occurredAt: string; localDate: string}, expectedRevisionFingerprint?: string): Promise<CheckinEvent | undefined>;
    recordEventsBatch(inputs: readonly {itemId: string; value?: number; unit?: string; source?: "api"; externalRef?: string; note?: string; occurredAt?: string}[], options?: {signal?: AbortSignal}): Promise<BatchEntryResult[]>;
    revisionFingerprint(item: CheckinItem, date: Date): string;
    itemFingerprint(item: CheckinItem): string;
    startFocus(itemId: string): Promise<boolean>;
    stopFocus(): Promise<boolean>;
    stopAdapterSilently(adapter: FocusAdapter): Promise<void>;
    getDiagnostics(): readonly {code: string; at: string; detail?: string}[];
    invalidateSummary(): void;
    renderBackgroundUpdate(): void;
    suggestionWorkflow?: SuggestionWorkflowState;
    createOccasionQuick?: (rawText: string) => Promise<{ok: boolean; occasion?: Occasion; reason?: string}>;
    syncBirthdaysFromContacts?: () => Promise<{ok: boolean; count: number; reason?: string}>;
    openDefaultEntry?: () => void;
}

/* Public occasion reads must not expose the nested override map. A shallow
   spread protects the top-level object but would still let a consumer mutate
   the host's reschedule history through overrides[origin].date. */
const cloneOccasionForApi = <T extends Occasion>(occasion: T): T => ({
    ...occasion,
    completedDates: [...occasion.completedDates],
    category: resolveOccasionCategory(occasion),
    ...(occasion.overrides ? {
        overrides: Object.fromEntries(Object.entries(occasion.overrides).map(([origin, override]) => [origin, {...override}])),
    } : {}),
} as T);

export interface CheckinDailyProjection {
    date: string;
    items: Array<{itemId: string; name: string; group: string; value: number; target: number; unit: string; completed: boolean}>;
    totalItems: number;
    truncated: boolean;
}

export function createCheckinApi(host: CheckinApiHost): CheckinApi {
    const summarizeWithProvider = async (range: SummaryRange, customRange: CustomSummaryRange | undefined, providerId?: string) => {
        if (!host.acceptingOperations || host.disposed) return undefined;
        if (customRange) {
            if (!isValidLocalDateInput(customRange.startDate) || !isValidLocalDateInput(customRange.endDate) || customRange.startDate > customRange.endDate) return undefined;
        } else if (!isSummaryRange(range)) {
            return undefined;
        }
        const provider = providerId ? host.summaryProviders.get(providerId) : host.summaryProviders.values().next().value;
        if (!provider) return undefined;
        const now = currentCalendarDate();
        const context = customRange ? buildCustomSummaryContext(host.store, customRange, now) : buildSummaryContext(host.store, range, now);
        const summaryItemIds = new Set(context.items.map((item) => item.itemId));
        const output = await withTimeout(provider.summarize({
            range,
            ...(customRange ? {customRange} : {}),
            items: host.store.items.filter((item) => summaryItemIds.has(item.id)).map((item) => host.cloneItem(item)),
            events: customRange ? getEventsInCustomRange(host.store, customRange) : host.getSummaryEvents(range, now),
            context,
        }), 30000, "总结适配器响应超时");
        const normalized = normalizeSummaryProviderResult(output, host.store.items);
        return host.disposed || host.disposing || host.summaryProviders.get(provider.id) !== provider || !normalized ? undefined : normalized.text;
    };
    const api: CheckinApi = {
        name: CHECKIN_API_NAME,
        protocol: CHECKIN_API_PROTOCOL,
        version: CHECKIN_API_VERSION,
        capabilities: CHECKIN_CAPABILITIES,
        hasCapability: (name: unknown): name is CheckinCapability => {
            if (name === "occasions.write") return true;
            return hasCheckinCapability(name);
        },
        describe: getCheckinApiDescriptor,
        getCapabilityInfo: getCheckinCapabilityInfo,
        /* C-02：isReady 与 whenReady 必须复验所属宿主就绪、未处于卸载中，且自身仍为全局挂载实例。 */
        isReady: () => host.initializationState === "ready" && host.acceptingOperations && !host.disposed && !host.disposing && (typeof window === "undefined" || (window as Window & {siyuanCheckin?: CheckinApi})[CHECKIN_API_NAME] === api),
        whenReady: () => host.readyPromise.then((ready) => ready && host.acceptingOperations && !host.disposed && !host.disposing && (typeof window === "undefined" || (window as Window & {siyuanCheckin?: CheckinApi})[CHECKIN_API_NAME] === api)),
        open: () => host.openDefaultEntry?.(),
        openDefaultEntry: () => host.openDefaultEntry?.(),
        getStore: () => host.cloneStore(),
        getItems: () => host.store.items.filter((item) => !item.archived).map((item) => host.cloneItem(item)),
        getDailyProjection: (localDate) => {
            const key = localDate ?? dateKey(currentCalendarDate());
            if (!isValidLocalDateInput(key)) throw new TypeError("invalid local date");
            if (!host.acceptingOperations || host.disposed || host.disposing || host.initializationState !== "ready") return {date: key, items: [], totalItems: 0, truncated: false};
            const at = calendarDateFromKey(key);
            const visible = queryTodayItems(host.store, at);
            return {date: key, totalItems: visible.length, truncated: visible.length > 1000, items: visible.slice(0, 1000).map((item) => {
                const revision = getItemRevisionForDate(item, at);
                return {itemId: item.id, name: item.name, group: item.group || "", value: getProgress(host.store, item, at), target: revision.schedule.type === "quota" ? revision.schedule.quota?.amount || 0 : revision.target, unit: revision.unit, completed: isComplete(host.store, item, at)};
            })};
        },
        getEvents: () => host.store.events.map((event) => ({...event})),
        getEventRangeSummary: (range, options) => getEventRangeSummary(host.store, range, options),
        /* T-1391（calendar.read）：服务端过滤隐藏/归档项目；纯数据快照，无备注/附件/externalRef。 */
        getCalendarProjection: (range) => {
            const asOfDate = dateKey(currentCalendarDate());
            const projection = buildCalendarProjection(host.store, {...range, asOfDate});
            return {
                ...projection,
                items: projection.items.map((item) => ({...item, points: item.points.map((point) => ({...point}))})),
            };
        },
        /* v5-1（D-240 / T-1670）：有界范围事件读——支持 AbortSignal 取消与未就绪快速返回空集。 */
        getEventsInRange: (range, options) => {
            if (options?.signal?.aborted) {
                throw new Error("checkin: events range read was aborted");
            }
            if (!host.acceptingOperations || host.disposed || host.disposing || host.initializationState !== "ready") {
                return {events: [], truncated: false};
            }
            if (!range || !isValidLocalDateInput(range.startDate) || !isValidLocalDateInput(range.endDateExclusive)) {
                throw new TypeError("checkin: range 必须提供合法的 startDate 与 endDateExclusive（YYYY-MM-DD）");
            }
            if (range.startDate > range.endDateExclusive) throw new TypeError("checkin: range.startDate 不得晚于 endDateExclusive");
            if (options?.itemIds !== undefined && !Array.isArray(options.itemIds)) throw new TypeError("checkin: itemIds 必须是字符串数组");
            if (options?.source !== undefined && !isValidEventSource(options.source)) throw new TypeError("checkin: source 必须是 manual、tomato、import、api、sireader、siplayer、weread 或 yeguif");
            if (range.startDate === range.endDateExclusive) return {events: [], truncated: false};
            const inRange = getEventsInDateRange(host.store, range.startDate, range.endDateExclusive);
            const filtered = filterEventsInRange(inRange, options ?? {});
            return {events: filtered.events.map((event) => ({...event})), truncated: filtered.truncated};
        },
        queryItems: (options) => {
            if (!host.acceptingOperations || host.disposed || host.disposing || host.initializationState !== "ready") {
                return [];
            }
            if (options?.kinds !== undefined && !Array.isArray(options.kinds)) throw new TypeError("checkin: kinds 必须是 CheckinKind 数组");
            return projectItems(host.store.items, options ?? {}).map((item) => host.cloneItem(item));
        },
        /* v5-3(D-240 / T-1670):streak 数字走模型单一实现,禁止消费端自算;longest 走同语义全历史扫描。 */
        getStreaks: (itemIds) => {
            if (!host.acceptingOperations || host.disposed || host.disposing || host.initializationState !== "ready") {
                return Object.freeze([]);
            }
            if (itemIds !== undefined && !Array.isArray(itemIds)) {
                throw new TypeError("checkin: itemIds 必须是字符串数组或 undefined");
            }
            const current = computeEventStreaks(host.store, currentCalendarDate(), host.streakFreezePeriods);
            const longest = computeLongestStreaks(host.store, currentCalendarDate(), host.streakFreezePeriods);
            let ids = [...current.keys()];
            if (Array.isArray(itemIds) && itemIds.length) {
                const wanted = new Set(itemIds.slice(0, 200).filter((id) => typeof id === "string" && id.length <= 160));
                ids = ids.filter((id) => wanted.has(id));
            }
            /* T-1415：at-most 项目附戒断里程碑（阶梯 1/3/7/14/30/60/90/180/365），与今日卡片/渲染块同口径。 */
            const directionById = new Map(host.store.items.map((item) => [item.id, item.direction]));
            return Object.freeze(ids.slice(0, 200).map((itemId) => {
                const base = {itemId, current: current.get(itemId) || 0, longest: longest.get(itemId) || 0};
                const milestones = directionById.get(itemId) === "atMost" ? abstinenceMilestones(base.current) : undefined;
                return Object.freeze(milestones ? {...base, milestones} : base);
            }));
        },
        /* T-1361 / T-1670：会话诊断原因码（环形容量 20；严格脱敏凭据与路径）。 */
        getDiagnostics: () => Object.freeze(host.getDiagnostics().map((entry) => Object.freeze({
            code: entry.code,
            at: entry.at,
            ...(entry.detail ? {detail: sanitizeDiagnosticDetail(entry.detail)} : {}),
        }))),
        getOccasions: () => host.occasionStore.occasions.map(cloneOccasionForApi),
        queryOccasions: (options) => {
            let list = host.occasionStore.occasions;
            if (options && typeof options === "object") {
                if (options.includeDisabled === false) list = list.filter((item) => item.enabled);
                if (typeof options.category === "string" && options.category.trim()) {
                    const targetCat = options.category.trim();
                    list = list.filter((item) => resolveOccasionCategory(item) === targetCat);
                }
            }
            return list.map(cloneOccasionForApi);
        },
        getTodayOccasions: () => getVisibleOccasions({version: 1, occasions: host.occasionStore.occasions} as never, currentCalendarDate()).map(cloneOccasionForApi),
        completeOccasion: (id, occurrenceDate, completed) => {
            /* 公共写接口在初始化/拆除阶段必须稳定返回 false；
               enqueueMutation 的兼容哨兵是 undefined，不能透出破坏 Promise<boolean> 契约。 */
            if (!host.acceptingOperations || host.disposed || host.disposing || host.initializationState !== "ready"
                || typeof id !== "string" || !id.trim() || !isValidLocalDateInput(occurrenceDate)
                || typeof completed !== "boolean" || !host.occasionStore.occasions.some((occasion) => occasion.id === id)) return Promise.resolve(false);
            return host.enqueueMutation(() => host.setOccasionCompleted(id, occurrenceDate, completed)).then((result) => result === true);
        },
        parseQuickOccasion: (text, baseDateKey) => {
            if (typeof text !== "string" || !text.trim()) return undefined;
            const todayKey = baseDateKey && isValidLocalDateInput(baseDateKey) ? baseDateKey : dateKey(currentCalendarDate());
            return parseQuickOccasionInput(text, todayKey);
        },
        addOccasionQuick: (text) => {
            if (!host.acceptingOperations || host.disposed || host.disposing || host.initializationState !== "ready" || !host.createOccasionQuick) {
                return Promise.resolve({ok: false, reason: "打卡插件宿主未就绪"});
            }
            return host.createOccasionQuick(text);
        },
        syncBirthdaysFromContacts: () => {
            if (!host.acceptingOperations || host.disposed || host.disposing || host.initializationState !== "ready" || !host.syncBirthdaysFromContacts) {
                return Promise.resolve({ok: false, count: 0, reason: "打卡插件宿主未就绪"});
            }
            return host.syncBirthdaysFromContacts();
        },
        getSummaryContext: (range) => {
            if (!isSummaryRange(range)) throw new TypeError("range 必须是 day、week 或 month");
            return buildSummaryContext(host.store, range, currentCalendarDate());
        },
        getCustomSummaryContext: (range) => {
            if (!range || !isValidLocalDateInput(range.startDate) || !isValidLocalDateInput(range.endDate) || range.startDate > range.endDate) throw new TypeError("自定义总结范围无效");
            return buildCustomSummaryContext(host.store, range, currentCalendarDate());
        },
        getAnalyticsSnapshot: (asOf = currentCalendarDate()) => cloneAnalyticsSnapshot(buildAnalyticsSnapshot(host.store, asOf)),
        getAnalyticsSummary: (asOf = currentCalendarDate()) => summarizeAnalyticsSnapshot(buildAnalyticsSnapshot(host.store, asOf)),
        /* T-1227：有界强度摘要——只读、窗口 7~366 天（默认 30）、最多 200 个活跃项目。 */
        getStrengthSummary: (options) => {
            const requested = Number(options?.windowDays);
            const windowDays = Number.isFinite(requested) ? Math.min(366, Math.max(7, Math.floor(requested))) : 30;
            const asOf = currentCalendarDate();
            const endExclusive = dateKey(new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate() + 1));
            const start = dateKey(new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate() - (windowDays - 1)));
            const items = host.store.items.filter((item) => !item.archived).slice(0, 200);
            return {
                windowDays,
                startDate: start,
                endDate: dateKey(asOf),
                items: items.map((item) => {
                    const series = buildHabitScoreSeries(
                        collectHabitScoreDays(host.store, item, start, endExclusive),
                        scheduleFrequency(getItemRevisionForDate(item, asOf).schedule),
                    );
                    return {itemId: item.id, name: item.name, score: series.length ? series[series.length - 1].score : 0};
                }),
            };
        },
        getWeakestDayDiagnosis: (options) => {
            if (!host.acceptingOperations || host.disposed || host.disposing || host.initializationState !== "ready") {
                return undefined;
            }
            return diagnoseWeakestDayOfWeek(host.store, {...options, asOf: currentCalendarDate()});
        },
        getArchivedItems: () => host.store.items.filter((item) => item.archived).map((item) => host.cloneItem(item)),
        setItemArchived: (itemId, archived) => {
            if (!host.acceptingOperations) return Promise.resolve(false);
            const moment = captureActionMoment();
            const expectedItem = host.store.items.find((item) => item.id === itemId);
            const expectedFingerprint = expectedItem ? host.itemFingerprint(expectedItem) : undefined;
            return host.enqueueMutation(() => host.setItemArchived(itemId, archived, moment, expectedFingerprint));
        },
        exportJson: () => serializeJson(host.cloneStore()),
        exportCsv: () => serializeCsv(host.cloneStore()),
        recordEventsBatch: (inputs, options) => {
            if (!host.acceptingOperations || host.disposed || host.disposing || host.initializationState !== "ready") {
                return Promise.reject(new Error("checkin: storage is not ready for batch recording"));
            }
            if (options?.signal?.aborted) {
                return Promise.reject(new Error("checkin: batch recording was aborted"));
            }
            return host.recordEventsBatch(inputs, options);
        },
        recordEvent: (input) => {
            if (!host.acceptingOperations) return Promise.resolve(undefined);
            const moment = captureActionMoment();
            /* T-1384/T-1385/T-1402/T-1457：sireader/siplayer/weread/yeguif 是内部适配器保留来源，公开 API 输入一律回落 api，防止伪造。 */
            const snapshot = input && typeof input === "object" ? {...input, ...(input.source === "sireader" || input.source === "siplayer" || input.source === "weread" || input.source === "yeguif" ? {source: "api" as const} : {})} : input;
            const expectedItem = snapshot && typeof snapshot === "object" && typeof snapshot.itemId === "string"
                ? host.store.items.find((item) => item.id === snapshot.itemId)
                : undefined;
            const expectedRevisionFingerprint = expectedItem
                ? host.revisionFingerprint(expectedItem, calendarDateFromKey(moment.localDate))
                : undefined;
            return host.enqueueMutation(() => host.recordExternalEvent(snapshot, moment, expectedRevisionFingerprint));
        },
        startFocus: (itemId) => host.startFocus(itemId),
        stopFocus: () => host.stopFocus(),
        getFocusAdapters: () => Object.freeze([...host.focusAdapters.values()].map((adapter) => Object.freeze({id: adapter.id, name: adapter.name}))),
        getFocusStatus: () => Object.freeze({busy: host.focusBusy, activeAdapterId: host.activeFocusAdapter?.id, adapterCount: host.focusAdapters.size}),
        /* 注销回调支持 {stopActive:false} 纯解绑:facade 失效/替换/卸载等生命周期
           不得模拟用户停止（docktomato PR #5 评审第四节）；默认保持原有停止行为兼容第三方。 */
        registerFocusAdapter: (adapter, options) => {
            if (!host.acceptingOperations || host.disposed || !adapter || typeof adapter.id !== "string" || !adapter.id || typeof adapter.canStart !== "function" || typeof adapter.start !== "function" || typeof adapter.stop !== "function") {
                return () => undefined;
            }
            host.focusAdapters.set(adapter.id, adapter);
            host.renderBackgroundUpdate();
            return (unregisterOptions?: {stopActive?: boolean}) => {
                if (host.focusAdapters.get(adapter.id) === adapter) {
                    host.focusAdapters.delete(adapter.id);
                }
                const stopActive = (unregisterOptions ?? options)?.stopActive !== false;
                if (host.activeFocusAdapter === adapter) {
                    host.activeFocusAdapter = undefined;
                    if (stopActive && !host.focusBusy) {
                        host.focusBusy = true;
                        const stop = host.stopAdapterSilently(adapter).finally(() => {
                            host.focusBusy = false;
                            host.renderBackgroundUpdate();
                        });
                        host.focusOperation = stop;
                    }
                }
                host.renderBackgroundUpdate();
            };
        },
        registerSummaryProvider: (provider) => {
            if (!host.acceptingOperations || host.disposed || !provider || typeof provider.id !== "string" || !provider.id || typeof provider.summarize !== "function") {
                return () => undefined;
            }
            host.invalidateSummary();
            host.summaryProviders.set(provider.id, provider);
            host.renderBackgroundUpdate();
            return () => {
                if (host.summaryProviders.get(provider.id) === provider) {
                    host.summaryProviders.delete(provider.id);
                    host.invalidateSummary();
                    host.renderBackgroundUpdate();
                }
            };
        },
        summarize: (range, providerId) => summarizeWithProvider(range, undefined, providerId),
        summarizeCustom: (range, providerId) => summarizeWithProvider("day", range, providerId),
        getSuggestionWorkflow: () => {
            const state = host.suggestionWorkflow;
            if (!state) return undefined;
            return cloneSuggestionWorkflow(state);
        },
        getSuggestionWorkflowSummary: () => {
            const state = host.suggestionWorkflow;
            if (!state) return undefined;
            return {...workflowSummary(state), updatedAt: workflowUpdatedAt(state)};
        },
        subscribe: (listener) => {
            if (!host.acceptingOperations || host.disposed || typeof listener !== "function") {
                return () => undefined;
            }
            const wrapped = (event: Event) => listener((event as CustomEvent<CheckinIntegrationEvent>).detail);
            Object.values(CHECKIN_EVENT_NAMES).forEach((eventName) => window.addEventListener(eventName, wrapped));
            const dispose = () => {
                Object.values(CHECKIN_EVENT_NAMES).forEach((eventName) => window.removeEventListener(eventName, wrapped));
                host.apiSubscriptions.delete(dispose);
            };
            host.apiSubscriptions.add(dispose);
            return dispose;
        },
    };
    return api;
}

function isSummaryRange(value: unknown): value is SummaryRange {
    return value === "day" || value === "week" || value === "month";
}
