/* 事项页视图：从 index.ts 外置；依赖以 OccasionsViewContext 显式传入。 */
import {t} from "../i18n";
import {dateKey} from "../model";
import {daysBetweenHalfOpen} from "../date-keys";
import {currentCalendarDate, escapeHtml, parseLocalDateKey} from "../shared";
import {uiIcon} from "../ui/icons";
import {renderPageShellHead} from "./page-shell";
import {describeElapsedSpan, describeRecurrence, describeOccasionMilestone, elapsedSpanSince, findOverrideOriginFor, formatQuickOccasionPreview, getMissedOccurrence, getOccurrenceDate, isOccasionCompleted, nextOccasionMilestones, occasionCategoryIcon, occasionCategoryLabelKey, occasionCycleProgress, occasionTemplateName, OCCASION_TEMPLATES, parseQuickOccasionInput, resolveOccasionCategory, weekdayName} from "../occasions";
import {buildOccurrencePreview, type OccurrencePreviewEntry} from "../features/occasion-preview";
import type {ReminderUserAction} from "../reminders";
import type {MonthlySubtype, Occasion, OccasionCategory, OccasionKind, OccasionRecurrence, OccasionStore, OccasionTemplateCategory} from "../occasions";
import type {OccasionsRootContext} from "./occasion-session";

/* T-1621：提醒天数预设 datalist id 按 root 实例与渲染次序唯一化——
   多 root 同屏时 input[list] 不再绑到其他表面的同名 datalist。 */
let occasionRenderSequence = 0;

export interface OccasionsViewContext extends Pick<OccasionsRootContext, "editingOccasionId" | "occasionSearchQuery" | "occasionStatusFilter" | "occasionKindFilter" | "occasionTimeFilter" | "occasionTemplatesOpen" | "occasionTemplateCategory" | "formOpen" | "filtersOpen" | "helpOpen" | "actionsHelpOpen" | "noteExpandedIds" | "occurrenceMoves" | "formDraft" | "submitting" | "deletingOccasionIds" | "occasionActionBusyIds" | "quickDraftText"> {
    occasionStore: OccasionStore;
    sharedActionBusyIds?: Set<string>;
    appearance: "light" | "dark";
    occasionSortMode?: "next" | "name" | "updated";
    occasionPreviewOpen?: boolean;
    reminderUserActions?: ReminderUserAction[];
    linkedItems?: Array<{id: string; name: string; linkedOccasionId: string; archived: boolean}>;
    /** T-2022：宿主检测到 Task Horizon 公共接口可用时展示一键打开日历/看板入口。 */
    taskHorizonAvailable?: boolean;
}

export function renderOccasionsView(ctx: OccasionsViewContext, root?: HTMLElement): string {
    const renderId = `${root?.dataset.occasionRootId || "surface"}-${++occasionRenderSequence}`;
    const editing = ctx.editingOccasionId ? ctx.occasionStore.occasions.find((item) => item.id === ctx.editingOccasionId) : undefined;
    /* T-1990：已建立关联的事项不再重复提供转打卡入口（防重复转换守卫在 bind 侧）。 */
    const linkedFor = (occasionId: string): boolean => (ctx.linkedItems || []).some((entry) => entry.linkedOccasionId === occasionId);
    const validDraft = ctx.formDraft && (!Object.prototype.hasOwnProperty.call(ctx.formDraft, "editingId") || (ctx.formDraft.editingId ?? "") === (ctx.editingOccasionId ?? ""))
        ? ctx.formDraft
        : undefined;
    const draftValue = (name: string, fallback: string): string => validDraft?.values[name] ?? fallback;
    const occasionQuery = (ctx.occasionSearchQuery || "").trim().toLocaleLowerCase();
    const todayKey = dateKey(currentCalendarDate());
    const withNext = ctx.occasionStore.occasions.map((item) => ({item, next: getOccurrenceDate(item, todayKey)}));
    /* T-1715（D-361）：排序选择——next=启用优先→下次日期→名称（既有默认）；
       name=启用优先→名称；updated=启用优先→最近修改。无下次日期排在有日期之后。 */
    const sortMode = ctx.occasionSortMode || "next";
    const allOccasions = withNext.sort((left, right) => {
        if (left.item.enabled !== right.item.enabled) return left.item.enabled ? -1 : 1;
        if (sortMode === "name") {
            const byName = left.item.name.localeCompare(right.item.name, "zh-CN");
            if (byName !== 0) return byName;
            if (left.next !== right.next) return left.next ? (right.next ? left.next.localeCompare(right.next) : -1) : 1;
            return left.item.id.localeCompare(right.item.id);
        }
        if (sortMode === "updated") {
            const byUpdated = (right.item.updatedAt || "").localeCompare(left.item.updatedAt || "");
            if (byUpdated !== 0) return byUpdated;
            return left.item.name.localeCompare(right.item.name, "zh-CN");
        }
        if (left.next !== right.next) return left.next ? (right.next ? left.next.localeCompare(right.next) : -1) : 1;
        return left.item.name.localeCompare(right.item.name);
    });
    const busyOccasionIds = new Set([...(ctx.occasionActionBusyIds || []), ...(ctx.sharedActionBusyIds || [])]);
    const filteredOccasions = allOccasions.filter(({item, next}) => {
        if (occasionQuery && !`${item.name} ${item.note || ""}`.toLocaleLowerCase().includes(occasionQuery)) return false;
        if (ctx.occasionStatusFilter !== "all" && (ctx.occasionStatusFilter === "enabled") !== item.enabled) return false;
        const itemCategory = resolveOccasionCategory(item);
        if (ctx.occasionKindFilter !== "all" && itemCategory !== ctx.occasionKindFilter && item.kind !== ctx.occasionKindFilter) return false;
        if (ctx.occasionTimeFilter === "today" && next !== todayKey) return false;
        if (ctx.occasionTimeFilter === "upcoming" && (!next || next <= todayKey)) return false;
        if (ctx.occasionTimeFilter === "ended" && next) return false;
        /* T-1713（D-356）：错过口径与 agenda missed 桶同源（启用 + getMissedOccurrence）。 */
        if (ctx.occasionTimeFilter === "missed" && (!item.enabled || next === todayKey || !getMissedOccurrence(item, todayKey))) return false;
        return true;
    });
    const enabledCount = ctx.occasionStore.occasions.filter((item) => item.enabled).length;
    const todayCount = withNext.filter(({item, next}) => item.enabled && next === todayKey).length;
    /* T-1713（D-356）：统计口径与 agenda 分桶同源（enabled+getMissedOccurrence/next），
       统计块改为可点击筛选入口（is-active 高亮当前筛选），title 明示口径。 */
    const missedCount = withNext.filter(({item, next}) => item.enabled && next !== todayKey && Boolean(getMissedOccurrence(item, todayKey))).length;
    const endedCount = withNext.filter(({item, next}) => item.enabled && !next).length;
    const statButton = (key: string, label: string, hint: string, count: number, active: boolean, status: string, time: string): string => `<button class="lc-checkin__occasion-stat${active ? " is-active" : ""}" type="button" data-occasion-stat="${escapeHtml(key)}" data-stat-status="${escapeHtml(status)}" data-stat-time="${escapeHtml(time)}" title="${escapeHtml(hint)}" aria-pressed="${active}"><strong>${count}</strong><small>${escapeHtml(label)}</small></button>`;
    const stats = [
        statButton("all", t("occ.filterAll"), t("occ.statAllHint"), ctx.occasionStore.occasions.length, ctx.occasionStatusFilter === "all" && ctx.occasionTimeFilter === "all", "all", "all"),
        statButton("enabled", t("occ.filterEnabled"), t("occ.statEnabledHint"), enabledCount, ctx.occasionStatusFilter === "enabled" && ctx.occasionTimeFilter === "all", "enabled", "all"),
        statButton("today", t("occ.filterToday"), t("occ.statTodayHint"), todayCount, ctx.occasionStatusFilter === "enabled" && ctx.occasionTimeFilter === "today", "enabled", "today"),
        statButton("missed", t("occ.filterMissed"), t("occ.statMissedHint"), missedCount, ctx.occasionStatusFilter === "enabled" && ctx.occasionTimeFilter === "missed", "enabled", "missed"),
        statButton("ended", t("occ.filterEnded"), t("occ.statEndedHint"), endedCount, ctx.occasionStatusFilter === "all" && ctx.occasionTimeFilter === "ended", "all", "ended"),
    ].join("");
    const hasActiveFilters = Boolean(occasionQuery || ctx.occasionStatusFilter !== "all" || ctx.occasionKindFilter !== "all" || ctx.occasionTimeFilter !== "all");
    const activeFilterCount = Number(ctx.occasionStatusFilter !== "all") + Number(ctx.occasionKindFilter !== "all") + Number(ctx.occasionTimeFilter !== "all");
    const filterSelect = (key: string, label: string, value: string, options: Array<[string, string]>): string => `<label class="lc-checkin__occasion-filter"><span>${label}</span><select data-occasion-filter="${key}" aria-label="${label}">${options.map(([optionValue, text]) => `<option value="${optionValue}"${optionValue === value ? " selected" : ""}>${text}</option>`).join("")}</select></label>`;
    const categoryCounts = new Map<OccasionCategory, number>();
    for (const {item} of allOccasions) {
        const cat = resolveOccasionCategory(item);
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }
    const categoryOrder: OccasionCategory[] = ["birthday", "anniversary", "expense", "renewal", "health", "festival", "scheduled"];
    const alwaysShowCats = new Set<OccasionCategory>(["birthday", "anniversary", "expense", "renewal", "scheduled"]);
    const categoryChipHtml = [
        `<button type="button" class="lc-checkin__occasion-cat-chip${ctx.occasionKindFilter === "all" ? " is-active" : ""}" data-occasion-cat-chip="all" aria-pressed="${ctx.occasionKindFilter === "all"}"><span>${t("occ.filterAll")}</span><em>${allOccasions.length}</em></button>`,
        ...categoryOrder
            .filter((cat) => alwaysShowCats.has(cat) || (categoryCounts.get(cat) || 0) > 0 || ctx.occasionKindFilter === cat)
            .map((cat) => {
                const active = ctx.occasionKindFilter === cat;
                const cnt = categoryCounts.get(cat) || 0;
                const label = `${occasionCategoryIcon(cat)} ${t(occasionCategoryLabelKey(cat))}`;
                return `<button type="button" class="lc-checkin__occasion-cat-chip${active ? " is-active" : ""}" data-occasion-cat-chip="${cat}" aria-pressed="${active}"><span>${escapeHtml(label)}</span><em>${cnt}</em></button>`;
            }),
    ].join("");
    const rowMarkup = filteredOccasions.map(({item, next}) => {
        const rowBusy = busyOccasionIds.has(item.id);
        const busyAttr = rowBusy ? " disabled" : "";
        const itemCategory = resolveOccasionCategory(item);
        const icon = occasionCategoryIcon(itemCategory);
        const kind = t(occasionCategoryLabelKey(itemCategory));
        const days = next ? Math.max(0, daysBetweenHalfOpen(todayKey, next) ?? 0) : undefined;
        const countdown = next ? t("occ.daysAway", {n: days ?? 0}) : t("occ.ended");
        const recurrence = describeRecurrence(item);
        const milestone = item.enabled ? nextOccasionMilestones(item, todayKey, 1)[0] : undefined;
        const milestoneMarkup = milestone ? `<div class="lc-checkin__occasion-milestone${milestone.daysUntil === 0 ? " is-today" : ""}">${escapeHtml(describeOccasionMilestone(item, milestone))}</div>` : "";
        const span = item.enabled && (item.kind === "birthday" || item.kind === "anniversary") ? elapsedSpanSince(item.date, todayKey) : undefined;
        const spanText = span ? describeElapsedSpan(span) : "";
        const countdownLabel = next && days !== undefined && days > 0 && days <= 14 ? t("occ.rhythmSoon", {n: days}) : countdown;
        const cycle = item.enabled ? occasionCycleProgress(item, todayKey) : undefined;
        const cycleMarkup = cycle ? `<div class="lc-checkin__occasion-cycle"><div class="lc-checkin__occasion-cycle-track" aria-hidden="true"><span class="lc-checkin__occasion-cycle-bar" style="width:${cycle.percent}%"></span></div><small>${t("occ.cycleProgress", {p: cycle.percent})}</small></div>` : "";
        /* T-1494：错过处理（中性提示+补标记）与单次改期（仅循环事项）。 */
        const missed = getMissedOccurrence(item, todayKey);
        const lateMarkup = missed ? `<div class="lc-checkin__occasion-late"><span>${t("occ.lateHint", {date: missed})}</span><button class="lc-checkin__text-button" type="button" data-occasion-late-complete data-occasion-late-id="${escapeHtml(item.id)}" data-occasion-late-date="${escapeHtml(missed)}"${busyAttr}>${t("occ.lateComplete")}</button></div>` : "";
        /* T-1718（D-359）：改期来源解析——当前发生日被单次改期时提供撤销（只清本次覆盖，
           不影响其他周期或历史）；原日→新日核对在 move 行内呈现。 */
        const moveOrigin: string | undefined = next ? findOverrideOriginFor(item, next) : undefined;
        /* T-1712（D-355）：当前可处理发生日（下次发生日）的完成切换与"本次已完成"回显——
           复用 setOccasionCompleted 单一通道，撤销/补标/多表面同源；启停与完成语义分离。 */
        const doneThisTime = Boolean(next && isOccasionCompleted(item, next));
        /* T-1722（D-365）：提醒处理状态——当前发生日的最新用户动作（snooze 未过期/
           skip），与"事项已完成"语义分离展示；提醒动作不写 completedDates（既有纪律）。 */
        const reminderActionsForOccurrence = (ctx.reminderUserActions || [])
            .filter((action) => action.id === `occasion:${item.id}:${next}`)
            .sort((left, right) => right.at.localeCompare(left.at));
        let reminderMarkup = "";
        if (next && !doneThisTime) {
            const latest = reminderActionsForOccurrence[0];
            if (latest?.action === "skip") {
                reminderMarkup = `<span class="lc-checkin__occasion-remind-state">${t("review.remindersSkipped")}</span>`;
            } else if (latest?.action === "snooze") {
                const expiry = typeof latest.expiresAt === "string" && Number.isFinite(Date.parse(latest.expiresAt)) ? Date.parse(latest.expiresAt) : undefined;
                const sameDay = latest.at.slice(0, 10) === dateKey(currentCalendarDate());
                const stillDeferred = expiry !== undefined ? Date.now() <= expiry : sameDay;
                if (stillDeferred) reminderMarkup = `<span class="lc-checkin__occasion-remind-state">${t("review.remindersSnoozed")}</span>`;
            }
        }
        const doneMarkup = item.enabled && next
            ? `<span class="lc-checkin__occasion-done${doneThisTime ? " is-done" : ""}">${doneThisTime ? t("occ.doneThisTime") : ""}<button class="lc-checkin__text-button" type="button" data-occasion-complete="${escapeHtml(item.id)}" data-occasion-complete-date="${escapeHtml(next)}" data-occasion-complete-target="${doneThisTime ? "false" : "true"}" aria-pressed="${doneThisTime}"${busyAttr}>${doneThisTime ? t("occ.undoDone") : t("occ.markDone")}</button></span>`
            : "";
        /* T-1719（D-362）：完成记录保留窗口透明化——completedDates 归一为唯一升序保留
           最近 120 条；恰好 120 条=窗口已满（可能存在更早历史被截断），行内如实提示，
           并显示保留窗口内的完成计数。不暗示完整历史。 */
        const keptCompletions = item.completedDates.length;
        const historyCapped = keptCompletions >= 120;
        const historyMarkup = keptCompletions > 0
            ? `<span class="lc-checkin__occasion-history" title="${escapeHtml(historyCapped ? t("occ.historyCappedHint") : "")}">${t("occ.doneCount", {n: keptCompletions})}${historyCapped ? ` · ${t("occ.historyCapped")}` : ""}</span>`
            : "";
        /* T-1720（D-363）：转打卡关联项目徽章——显示关联项目名与归档态；点击进该项目
           编辑器（跨页编辑，返回回事项页）。项目被删除后徽章自然消失（无墓碑，诊断
           归 T-1721）；重建走既有转打卡按钮（重复拦截已排除归档项）。 */
        const linked = (ctx.linkedItems || []).filter((entry) => entry.linkedOccasionId === item.id);
        const linkedMarkup = linked.length ? `<span class="lc-checkin__occasion-linked"><button class="lc-checkin__text-button" type="button" data-occasion-linked-edit="${escapeHtml(linked[0].id)}" title="${escapeHtml(t("occ.linkedItem"))}"${busyAttr}>${linked[0].archived ? `${escapeHtml(linked[0].name)} · ${t("occ.linkedArchived")}` : escapeHtml(linked[0].name)}${linked.length > 1 ? ` +${linked.length - 1}` : ""}</button></span>` : "";
        const moveAvailable = item.enabled && item.recurrence !== "once" && Boolean(next);
        /* T-1621：改期行是事项表面的 root-local 会话草稿。动作重绘或
           过滤切换时沿用该 root 的展开态与日期，不从另一个 surface 借 DOM 状态。 */
        const moveState = ctx.occurrenceMoves?.[item.id];
        const moveDate = moveState?.date || "";
        const moveOpen = moveState?.open === true;
        const moveUndoMarkup = moveAvailable && moveOrigin && next ? `<button class="lc-checkin__text-button" type="button" data-occasion-move-undo="${escapeHtml(item.id)}" data-occasion-move-undo-origin="${escapeHtml(moveOrigin)}" data-occasion-move-undo-next="${escapeHtml(next)}"${busyAttr}>${t("occ.moveUndo")}</button>` : "";
        const moveMarkup = moveAvailable && next ? `<div class="lc-checkin__occasion-move"><button class="lc-checkin__text-button" type="button" data-occasion-move-toggle="${escapeHtml(item.id)}" aria-expanded="${moveOpen ? "true" : "false"}"${busyAttr}>${t("occ.moveOccurrence")}</button><div class="lc-checkin__occasion-move-row" data-occasion-move-row="${escapeHtml(item.id)}"${moveOpen ? "" : " hidden"}><span class="lc-checkin__occasion-move-origin-label" data-occasion-move-origin-label="${escapeHtml(item.id)}">${escapeHtml(t("occ.moveFrom", {date: next}))}</span><input type="date" data-occasion-move-date="${escapeHtml(item.id)}" value="${escapeHtml(moveDate)}" min="${escapeHtml(todayKey)}" aria-label="${t("occ.moveNewDate")}"${busyAttr} /><button class="lc-checkin__text-button" type="button" data-occasion-move-confirm="${escapeHtml(item.id)}" data-occasion-move-origin="${escapeHtml(next)}"${moveDate ? "" : " disabled"}${busyAttr}>${t("occ.moveConfirm")}</button>${moveUndoMarkup}</div></div>` : "";
        /* The next date is the scanning anchor; recurrence and lead time are
           supporting detail. Only exceptional states need a visible badge. */
        const isToday = item.enabled && next === todayKey;
        const status = !item.enabled ? t("occ.statusDisabled") : isToday ? t("occ.statusToday") : "";
        const dateLine = next
            ? `<time datetime="${escapeHtml(next)}">${escapeHtml(next)}</time><strong>${escapeHtml(countdown)}</strong>`
            : `<span>${t("occ.ended")}</span>`;
        // Long notes remain fully readable on demand without turning a list
        // of twenty dates into twenty expanded paragraphs on a phone.
        const note = !item.note ? "" : item.note.length > 48
            ? `<details class="lc-checkin__occasion-note-fold"><summary><span>${t("occ.note")}</span><span>${escapeHtml(item.note)}</span></summary><small class="lc-checkin__occasion-row-note">${escapeHtml(item.note)}</small></details>`
            : `<small class="lc-checkin__occasion-row-note">${escapeHtml(item.note)}</small>`;
        /* T-1990：转打卡降级出主路径 —— 事项的最小目的是「日期提醒 + 完成留痕」，
           完成本次已覆盖留痕；跨系统桥接（转打卡）收进编辑表单高级区，行内动作栏
           只保留 编辑/启停/删除。已关联项目仍以徽章展示（linkedMarkup）。
           data-occasion-edit= / data-occasion-toggle= / data-occasion-delete= 为行内显式动作钩子；
           data-occasion-toitem= 在编辑表单高级区（lc-checkin__occasion-toitem-row）。 */
        const priorityMarkup = item.priority
            ? `<span class="lc-checkin__occasion-priority is-${escapeHtml(item.priority)}">${escapeHtml(t(item.priority === "high" ? "occ.priorityHigh" : item.priority === "medium" ? "occ.priorityMedium" : "occ.priorityLow"))}</span>`
            : "";
        const isEditingThis = ctx.editingOccasionId === item.id;
        const countdownBadge = `<span class="lc-checkin__occasion-countdown${isToday ? " is-today" : days !== undefined && days <= 7 ? " is-soon" : ""}">${escapeHtml(isToday ? t("occ.statusToday") : countdownLabel)}</span>`;
        const contextBtnLabel = (itemCategory === "birthday" || itemCategory === "anniversary") ? t("occ.contactsDoc") : t("occ.noteJump");
        const contextMarkup = item.contextBlockId ? `<button class="lc-checkin__text-button" type="button" data-occasion-open-block="${escapeHtml(item.contextBlockId)}"${busyAttr}>${contextBtnLabel}</button><button class="lc-checkin__text-button" type="button" data-occasion-peek-block="${escapeHtml(item.contextBlockId)}"${busyAttr}>${t("occ.notePeek")}</button>` : "";
        const primaryMeta = [
            next ? `<time datetime="${escapeHtml(next)}">${escapeHtml(next)}${item.time ? ` ${escapeHtml(item.time)}` : ""}</time>` : `<span>${t("occ.ended")}</span>`,
            `<span>${escapeHtml(kind)}</span>`,
            `<span>${escapeHtml(recurrence)}</span>`,
            spanText ? `<span>${escapeHtml(spanText)}</span>` : "",
            contextMarkup,
        ].filter(Boolean).join("");
        const taskBlockMarkup = item.blockId ? `<button class="lc-checkin__text-button" type="button" data-occasion-open-block="${escapeHtml(item.blockId)}"${busyAttr}>${t("occ.taskBlockJump")}</button>` : "";
        const homeBtnMarkup = (itemCategory === "expense" || itemCategory === "renewal" || itemCategory === "health") ? `<button class="lc-checkin__text-button" type="button" data-action="open-butler-reminders" title="${escapeHtml(t("occ.homeRemindersHint"))}">${t("occ.homeReminders")}</button>` : "";
        const detailInner = `${lateMarkup}${milestoneMarkup}${cycleMarkup}${moveMarkup}<div class="lc-checkin__occasion-detail-meta"><span>${t("occ.remindSummary", {n: item.remindBeforeDays})}</span>${historyMarkup}${linkedMarkup}${taskBlockMarkup}${homeBtnMarkup}</div>`;
        const detailFoldMarkup = `<details class="lc-checkin__occasion-detail-fold"${moveOpen ? " open" : ""}><summary>${t("occ.detailFold")}</summary><div class="lc-checkin__occasion-detail-body">${detailInner}</div></details>`;
        const action = (attr: string, value: string, aria: string, title: string, content: string, extra = "") => `<button class="lc-checkin__small-button${extra ? ` ${escapeHtml(extra)}` : ""}" type="button" ${attr}="${escapeHtml(value)}" aria-label="${escapeHtml(aria)}" title="${escapeHtml(title)}"${rowBusy ? " disabled" : ""}><span class="lc-checkin__action-icon" aria-hidden="true">${content}</span><span class="lc-checkin__action-label">${escapeHtml(title)}</span></button>`;
        return `<article class="lc-checkin__occasion-manager-row ${item.enabled ? isToday ? "is-today" : "" : "is-disabled"}${isEditingThis ? " is-editing" : ""}" data-occasion-cat="${itemCategory}"${rowBusy ? ` aria-busy="true"` : ""}><span class="lc-checkin__occasion-icon" aria-hidden="true">${icon}</span><div class="lc-checkin__occasion-row-body"><div class="lc-checkin__occasion-row-title"><button type="button" class="lc-checkin__occasion-title-btn" data-occasion-edit-title="${escapeHtml(item.id)}" title="${escapeHtml(t("occ.editAria", {name: item.name}))}"${rowBusy ? " disabled" : ""}><strong>${escapeHtml(item.name)}</strong></button>${countdownBadge}${priorityMarkup}${!item.enabled && status ? `<span class="lc-checkin__occasion-status">${status}</span>` : ""}${reminderMarkup}${doneMarkup}</div><div class="lc-checkin__occasion-row-meta">${primaryMeta}</div>${note}${detailFoldMarkup}</div><div class="lc-checkin__occasion-row-actions">${action("data-occasion-edit", item.id, t("occ.editAria", {name: item.name}), t("occ.editBtn"), uiIcon("edit"))}${action("data-occasion-toggle", item.id, t("occ.toggleAria", {name: item.name}), item.enabled ? t("occ.disable") : t("occ.enable"), uiIcon(item.enabled ? "pause" : "play"), item.enabled ? "is-on" : "")}${action("data-occasion-delete", item.id, t("occ.deleteAria", {name: item.name}), t("common.delete"), uiIcon("trash"))}</div></article>`;
    });
    /* T-1713：零结果给可恢复路径——有筛选时空态附清除筛选按钮。 */
    const rows = rowMarkup.length ? rowMarkup.join("") : `<div class="lc-checkin__empty-description">${hasActiveFilters ? `${t("occ.searchEmpty")}<button class="lc-checkin__text-button" type="button" data-occasion-clear-filters>${t("occ.clearFilters")}</button>` : t("occ.empty")}</div>`;
    /* T-1580/T-1592：agenda 分组优先——今日→已错过→即将→已结束→已停用，组头计数；
       过滤先行，分组只重排不改成员。 */
    const agendaGroup = (id: string, label: string, groupRows: string[]): string => groupRows.length ? `<div class="lc-checkin__source-category" data-agenda-section="${id}">${label} · ${groupRows.length}</div><div class="lc-checkin__occasion-card-grid">${groupRows.join("")}</div>` : "";
    const agendaBuckets: Record<string, string[]> = {today: [], missed: [], upcoming: [], ended: [], disabled: []};
    /* T-1706：行与条目按构建序 zip 一次映射——同 id 数据不再经 findIndex 串行错行（O(n²)→O(n)）。 */
    filteredOccasions.forEach(({item, next}, index) => {
        const row = rowMarkup[index];
        if (!row) return;
        if (!item.enabled) agendaBuckets.disabled.push(row);
        else if (next === todayKey) agendaBuckets.today.push(row);
        else if (getMissedOccurrence(item, todayKey)) agendaBuckets.missed.push(row);
        else if (next) agendaBuckets.upcoming.push(row);
        else agendaBuckets.ended.push(row);
    });
    const agendaRows = [
        agendaGroup("today", t("occ.agendaToday"), agendaBuckets.today),
        agendaGroup("missed", t("occ.agendaMissed"), agendaBuckets.missed),
        agendaGroup("upcoming", t("occ.agendaUpcoming"), agendaBuckets.upcoming),
        agendaGroup("ended", t("occ.agendaEnded"), agendaBuckets.ended),
        agendaGroup("disabled", t("occ.agendaDisabled"), agendaBuckets.disabled),
    ].filter(Boolean).join("");
    const agendaEmpty = `<div class="lc-checkin__empty lc-checkin__occasion-empty" role="status">
        <div class="lc-checkin__empty-mark" aria-hidden="true">${hasActiveFilters ? "⌕" : "◷"}</div>
        <strong class="lc-checkin__empty-title">${hasActiveFilters ? t("occ.searchEmpty") : t("occ.empty")}</strong>
        <p class="lc-checkin__empty-description">${hasActiveFilters ? t("occ.clearFilters") : t("occ.formHint")}</p>
        <div class="lc-checkin__empty-actions">
            ${hasActiveFilters ? `<button class="lc-checkin__text-button" type="button" data-occasion-clear-filters>${t("occ.clearFilters")}</button>` : ""}
            <button class="lc-checkin__primary-button" type="button" data-action="new-occasion">${t("occ.add")}</button>
        </div>
    </div>`;
    const date = draftValue("date", editing?.date || dateKey(currentCalendarDate()));
    const editLabel = editing ? t("occ.edit") : t("occ.create");
    const editTitle = editing ? t("occ.editingHeading", {name: editing.name}) : t("occ.heading");
    const defaultKindOrCat = editing ? resolveOccasionCategory(editing) : "scheduled";
    const kindValue = draftValue("kind", defaultKindOrCat);
    const recurrenceValue = draftValue("recurrence", editing?.recurrence || "annual");
    const kind: OccasionCategory = ["birthday", "anniversary", "expense", "renewal", "health", "festival", "scheduled"].includes(kindValue)
        ? (kindValue as OccasionCategory)
        : "scheduled";
    const recurrence: OccasionRecurrence = ["once", "annual", "monthly", "weekly", "quarterly", "halfyearly", "interval"].includes(recurrenceValue) ? recurrenceValue as OccasionRecurrence : "annual";
    const calendar = draftValue("calendar", editing?.calendar || "solar");
    const annualSubtype = draftValue("annualSubtype", editing?.annualSubtype || "byday");
    const monthlySubtypeValue = draftValue("monthlySubtype", editing?.monthlySubtype || "byday");
    const monthlySubtype: MonthlySubtype = ["byday", "nthweek", "lastday"].includes(monthlySubtypeValue) ? monthlySubtypeValue as MonthlySubtype : "byday";
    const sel = (value: string, current: string | undefined): string => value === current ? " selected" : "";
    const templateDescription = (template: typeof OCCASION_TEMPLATES[number]): string => describeRecurrence({...template, id: "", date: template.date || dateKey(currentCalendarDate()), remindBeforeDays: template.remindBeforeDays, note: template.note || "", enabled: true, completedDates: [], createdAt: "", updatedAt: ""} as Occasion);
    /* 模板量增大后不再提供「全部」视图：默认与首档为「推荐」精选分组，
       其余按类别浏览（D-161）。 */
    const visibleTemplates = OCCASION_TEMPLATES.map((template, index) => ({template, index})).filter(({template}) => ctx.occasionTemplateCategory === "recommended" ? Boolean(template.recommended) : template.category === ctx.occasionTemplateCategory);
    const templateChips = visibleTemplates.map(({template, index}) => {
        const name = occasionTemplateName(template);
        const recurrenceDescription = templateDescription(template);
        const accessibleName = `${name} · ${recurrenceDescription}`;
        return `<button type="button" class="lc-checkin__occasion-template" data-occasion-template="${index}" aria-label="${escapeHtml(accessibleName)}" title="${escapeHtml(accessibleName)}"><span class="lc-checkin__occasion-template-icon" aria-hidden="true">${escapeHtml(template.icon)}</span><span class="lc-checkin__occasion-template-name">${escapeHtml(name)}</span></button>`;
    }).join("");
    const templateCategories: Array<["recommended" | OccasionTemplateCategory, string]> = [["recommended", t("occ.tplCategoryRecommended")], ["birthday", t("occ.tplCategoryBirthday")], ["anniversary", t("occ.tplCategoryAnniversary")], ["expense", t("occ.tplCategoryExpense")], ["renewal", t("occ.tplCategoryRenewal")], ["health", t("occ.tplCategoryHealth")], ["festival", t("occ.tplCategoryFestival")]];
    const templateCategoryTabs = templateCategories.map(([value, label]) => {
        const count = value === "recommended" ? OCCASION_TEMPLATES.filter((template) => template.recommended).length : OCCASION_TEMPLATES.filter((template) => template.category === value).length;
        const selected = value === ctx.occasionTemplateCategory;
        return `<button type="button" class="${selected ? "is-active" : ""}" data-occasion-template-category="${value}" aria-label="${escapeHtml(`${label}（${count}）`)}" aria-pressed="${selected}"><span class="lc-checkin__occasion-template-category-label">${escapeHtml(label)}</span><em aria-hidden="true">${count}</em></button>`;
    }).join("");
    const weekdayOptions = [0, 1, 2, 3, 4, 5, 6].map((value) => `<option value="${value}"${Number(draftValue("annualWeekday", String(editing?.weekday ?? 0))) === value ? " selected" : ""}>${weekdayName(value)}</option>`).join("");
    const monthOptions = Array.from({length: 12}, (_, index) => `<option value="${index + 1}"${Number(draftValue("annualMonth", String(editing?.month ?? 1))) === index + 1 ? " selected" : ""}>${t("date.monthN", {n: index + 1})}</option>`).join("");
    const nthOptions = [1, 2, 3, 4, 5].map((value) => `<option value="${value}"${Number(draftValue("annualNth", String(editing?.nthWeek ?? 1))) === value ? " selected" : ""}>${t(`occ.nth${value}`)}</option>`).join("");
    const isFormOpen = ctx.formOpen ?? Boolean(editing);
    /* Keep the controls visible whenever a filter is active.  A select change
       re-renders the root, and the native details state itself is not part of
       the root session; relying on the stale `filtersOpen: false` would hide
       the clear button immediately after selecting a filter. */
    const isFilterOpen = Boolean(ctx.filtersOpen || activeFilterCount);
    const presetId = `lc-occasion-remind-presets-${renderId}`;
    /* T-1987（用户实测反馈）：事项页重构为「新建 / 已有 / 其他」三个独立板块。
       定位：事项管「哪天要做什么」（生日、纪念日、缴费续费与未来日程的集中提醒），
       与每日打卡的习惯互补 —— 页头下加一句定位说明；管理工具（搜索/分类/排序）
       常驻可见，低频工具（导出 ICS、按钮说明）收进「其他」。 */
    const moreHelp = `<span><strong>＋ ${t("occ.toItem")}</strong> — ${t("occ.toItemDesc")}</span><span><strong>✎ ${t("occ.editBtn")}</strong> — ${t("occ.editDesc")}</span><span><strong>✓/○ ${t("occ.enable")}/${t("occ.disable")}</strong> — ${t("occ.toggleDesc")}</span><span><strong>× ${t("common.delete")}</strong> — ${t("occ.deleteDesc")}</span><span><strong>📅 ${t("occ.autoAppearTitle")}</strong> — ${t("occ.autoAppearDesc")}</span>`;
    const quickText = ctx.quickDraftText || "";
    const quickParsed = quickText.trim() ? parseQuickOccasionInput(quickText, todayKey) : undefined;
    const quickPreviewText = quickParsed ? `${t("occ.quickPreviewPrefix")}${formatQuickOccasionPreview(quickParsed)}` : "";
    const headerActions = [
        ctx.taskHorizonAvailable ? `<button class="lc-checkin__small-button" type="button" data-action="occasion-open-th-calendar" aria-label="${escapeHtml(t("occ.openThCalendarAria"))}" title="${escapeHtml(t("occ.openThCalendarAria"))}">${uiIcon("calendar")}<span>${t("occ.openThCalendar")}</span></button>` : "",
        `<button class="lc-checkin__small-button" type="button" data-action="occasion-open-book" aria-label="${escapeHtml(t("occ.openBookAria"))}" title="${escapeHtml(t("occ.openBookAria"))}">${uiIcon("external")}<span>${t("occ.openBook")}</span></button>`,
        `<button class="lc-checkin__icon-button" type="button" data-action="new-occasion" aria-label="${t("occ.newAria")}" title="${t("occ.newAria")}">+</button>`,
    ].filter(Boolean).join("");
    const priorityDraft = draftValue("priority", editing?.priority || "");
    const kindSelectOptions: Array<[string, string]> = [
        ["birthday", `🎂 ${t("occ.tplCategoryBirthday")}`],
        ["anniversary", `💍 ${t("occ.tplCategoryAnniversary")}`],
        ["expense", `💳 ${t("occ.tplCategoryExpense")}`],
        ["renewal", `🔄 ${t("occ.tplCategoryRenewal")}`],
        ["health", `🏥 ${t("occ.tplCategoryHealth")}`],
        ["festival", `🏮 ${t("occ.tplCategoryFestival")}`],
        ["scheduled", `📌 ${t("occ.kindScheduled")}`],
    ];
    return `<div class="lc-checkin lc-checkin--occasions" data-appearance="${ctx.appearance}" data-occasion-root-instance="${escapeHtml(renderId)}">
            ${renderPageShellHead({eyebrow: t("occasions.eyebrow"), title: t("occasions.title"), actionsHtml: headerActions})}
            <p class="lc-checkin__occasion-positioning">${escapeHtml(t("occasions.positioning"))}</p>
            <div class="lc-checkin__occasion-quickbar" data-occasion-quickbar>
                <div class="lc-checkin__occasion-quickbar-row">
                    <input type="text" data-occasion-quick-input maxlength="160" value="${escapeHtml(quickText)}" placeholder="${escapeHtml(t("occ.quickPlaceholder"))}" aria-label="${escapeHtml(t("occ.quickAria"))}" enterkeyhint="done" autocomplete="off" />
                    <button class="lc-checkin__primary-button" type="button" data-action="occasion-quick-submit">${t("occ.quickAdd")}</button>
                </div>
                <small class="lc-checkin__occasion-quick-preview" data-occasion-quick-preview${quickPreviewText ? "" : " hidden"}>${escapeHtml(quickPreviewText)}</small>
            </div>
            <div class="lc-checkin__occasion-manager" data-form-open="${isFormOpen ? "true" : "false"}">
                <details class="lc-checkin__occasion-form-drawer" data-occasion-form-drawer ${isFormOpen ? "open" : ""}>
                    <summary><span class="lc-checkin__section-kicker">${editLabel}</span><strong>${escapeHtml(editTitle)}</strong><span class="lc-checkin__fold-chevron" aria-hidden="true">⌄</span></summary>
                <section class="lc-checkin__occasion-form-panel">
                    <div class="lc-checkin__section-heading"><div><span class="lc-checkin__section-kicker">${editLabel}</span><strong>${escapeHtml(editTitle)}</strong><small class="lc-checkin__occasion-form-hint">${t("occ.formHint")}</small></div></div>
                    <details class="lc-checkin__occasion-templates-fold" ${ctx.occasionTemplatesOpen ? "open" : ""}>
                        <summary data-occasion-templates-toggle aria-label="${t("occ.templatesHint")}" title="${t("occ.templatesHint")}"><span>${t("occ.templatesFold")}</span><em>${OCCASION_TEMPLATES.length}</em><span class="lc-checkin__fold-chevron" aria-hidden="true">⌄</span></summary>
                        <div class="lc-checkin__occasion-template-browser"><div class="lc-checkin__occasion-template-browser-head"><span>${t("occ.templatesHint")}</span><em aria-live="polite" aria-atomic="true">${t("occ.templatesShown", {n: visibleTemplates.length})}</em></div><div class="lc-checkin__occasion-template-categories" aria-label="${t("occ.tplCategoriesAria")}">${templateCategoryTabs}</div><div class="lc-checkin__occasion-templates" aria-label="${t("occ.templatesFold")}">${templateChips}</div></div>
                    </details>
                    <form data-occasion-form${ctx.submitting ? ` aria-busy="true"` : ""}>
                        <label class="lc-checkin__field"><span>${t("occ.name")}</span><input name="name" required maxlength="120" placeholder="${t("occ.namePlaceholder")}" value="${escapeHtml(draftValue("name", editing?.name || ""))}" /></label>
                        <div class="lc-checkin__form-row">
                            <label class="lc-checkin__field"><span>${t("occ.kind")}</span><select name="kind">${kindSelectOptions.map(([val, text]) => `<option value="${val}"${sel(val, kind)}>${escapeHtml(text)}</option>`).join("")}</select></label>
                            <label class="lc-checkin__field"><span>${t("occ.date")}</span><input name="date" type="date" required value="${escapeHtml(date)}" /></label>
                        </div>
                        <div class="lc-checkin__form-row">
                            <label class="lc-checkin__field"><span>${t("occ.recurrence")}</span><select name="recurrence" data-occasion-recurrence>
                                <option value="once"${sel("once", recurrence)}>${t("occ.once")}</option>
                                <option value="annual"${sel("annual", recurrence)}>${t("occ.annual")}</option>
                                <option value="monthly"${sel("monthly", recurrence)}>${t("occ.monthly")}</option>
                                <option value="weekly"${sel("weekly", recurrence)}>${t("occ.weekly")}</option>
                                <option value="quarterly"${sel("quarterly", recurrence)}>${t("occ.quarterly")}</option>
                                <option value="halfyearly"${sel("halfyearly", recurrence)}>${t("occ.halfyearly")}</option>
                                <option value="interval"${sel("interval", recurrence)}>${t("occ.interval")}</option>
                            </select></label>
                            <div class="lc-checkin__field" data-occasion-block="annual-calendar"${recurrence === "annual" ? "" : " hidden"}><span class="lc-checkin__field-label">${t("occ.calendar")}</span><select name="calendar" data-occasion-calendar aria-label="${t("occ.calendar")}"><option value="solar"${sel("solar", calendar)}>${t("occ.solar")}</option><option value="lunar"${sel("lunar", calendar)}>${t("occ.lunar")}</option></select><small class="lc-checkin__field-hint" data-occasion-lunar-hint hidden></small></div>
                        </div>
                        <div class="lc-checkin__form-row" data-occasion-block="annual-nthweek"${recurrence === "annual" && annualSubtype === "nthweek" ? "" : " hidden"}>
                            <label class="lc-checkin__field"><span>${t("occ.month")}</span><select name="annualMonth">${monthOptions}</select></label>
                            <label class="lc-checkin__field"><span>${t("occ.weekday")}</span><select name="annualWeekday">${weekdayOptions}</select></label>
                            <input type="hidden" name="annualSubtype" value="${escapeHtml(annualSubtype)}" />
                        </div>
                        <div class="lc-checkin__form-row" data-occasion-block="monthly-sub"${recurrence === "monthly" ? "" : " hidden"}>
                            <label class="lc-checkin__field"><span>${t("occ.monthlyMode")}</span><select name="monthlySubtype" data-occasion-monthly-subtype><option value="byday"${sel("byday", monthlySubtype)}>${t("occ.monthlyByday")}</option><option value="nthweek"${sel("nthweek", monthlySubtype)}>${t("occ.monthlyNthweek")}</option><option value="lastday"${sel("lastday", monthlySubtype)}>${t("occ.monthlyLastday")}</option></select></label>
                            <div class="lc-checkin__field" data-occasion-block="monthly-nthweek"${monthlySubtype === "nthweek" ? "" : " hidden"}><span class="lc-checkin__field-label">${t("occ.weekday")}</span><select name="monthlyWeekday" aria-label="${t("occ.weekday")}">${weekdayOptions}</select></div>
                        </div>
                        <div class="lc-checkin__form-row" data-occasion-block="nthweek-ordinal"${(recurrence === "annual" && annualSubtype === "nthweek") || (recurrence === "monthly" && monthlySubtype === "nthweek") ? "" : " hidden"}>
                            <label class="lc-checkin__field"><span>${t("occ.nthOccurrence")}</span><select name="annualNth">${nthOptions}</select></label>
                        </div>
                        <div class="lc-checkin__form-row" data-occasion-block="weekly"${recurrence === "weekly" ? "" : " hidden"}>
                            <label class="lc-checkin__field"><span>${t("occ.weekday")}</span><select name="weeklyWeekday">${weekdayOptions}</select></label>
                        </div>
                        <div class="lc-checkin__form-row" data-occasion-block="interval"${recurrence === "interval" ? "" : " hidden"}>
                            <label class="lc-checkin__field"><span>${t("occ.intervalCount")}</span><input name="intervalCount" type="number" inputmode="numeric" min="1" max="365" step="1" value="${escapeHtml(draftValue("intervalCount", String(editing?.intervalCount ?? 1)))}" /></label>
                            <label class="lc-checkin__field"><span>${t("occ.unit")}</span><select name="intervalUnit"><option value="day"${sel("day", draftValue("intervalUnit", editing?.intervalUnit || "month"))}>${t("occ.unitDay")}</option><option value="month"${sel("month", draftValue("intervalUnit", editing?.intervalUnit || "month"))}>${t("occ.unitMonth")}</option><option value="year"${sel("year", draftValue("intervalUnit", editing?.intervalUnit || "month"))}>${t("occ.unitYear")}</option></select></label>
                        </div>
                        <label class="lc-checkin__field"><span>${t("occ.remindDays")}</span><input name="remindBeforeDays" type="number" inputmode="numeric" min="0" max="365" step="1" list="${presetId}" value="${escapeHtml(draftValue("remindBeforeDays", String(editing?.remindBeforeDays ?? 3)))}" /><datalist id="${presetId}"><option value="0"><option value="1"><option value="3"><option value="7"><option value="14"><option value="30"></datalist></label>
                        <div class="lc-checkin__form-row">
                            <label class="lc-checkin__field"><span>${t("occ.time")}</span><input name="time" type="time" value="${escapeHtml(draftValue("time", editing?.time || ""))}" /></label>
                            <label class="lc-checkin__field"><span>${t("occ.priority")}</span><select name="priority"><option value=""${sel("", priorityDraft)}>${t("occ.priorityNone")}</option><option value="high"${sel("high", priorityDraft)}>${t("occ.priorityHigh")}</option><option value="medium"${sel("medium", priorityDraft)}>${t("occ.priorityMedium")}</option><option value="low"${sel("low", priorityDraft)}>${t("occ.priorityLow")}</option></select></label>
                        </div>
                        <label class="lc-checkin__field"><span>${t("occ.contextBlock")}</span><input name="contextBlockId" maxlength="120" placeholder="${escapeHtml(t("occ.contextBlockPlaceholder"))}" value="${escapeHtml(draftValue("contextBlockId", editing?.contextBlockId || ""))}" /></label>
                        <label class="lc-checkin__field"><span>${t("occ.note")}</span><textarea name="note" maxlength="500" rows="2" placeholder="${t("occ.notePlaceholder")}">${escapeHtml(draftValue("note", editing?.note || ""))}</textarea></label>
                        ${renderOccurrencePreviewView(editing, ctx.occasionPreviewOpen === true)}
                        <div class="lc-checkin__editor-actions"><button class="lc-checkin__primary-button" type="submit" ${ctx.submitting ? `disabled aria-busy="true"` : ""}>${editing ? t("occ.save") : t("occ.add")}</button><button class="lc-checkin__text-button" type="button" data-action="cancel-occasion-edit" ${ctx.submitting ? "disabled" : ""}>${editing ? t("occ.cancelEdit") : t("common.cancel")}</button></div>
                    </form>
                    ${editing && !linkedFor(editing.id) ? `<div class="lc-checkin__occasion-toitem-row"><button class="lc-checkin__text-button" type="button" data-occasion-toitem="${escapeHtml(editing.id)}"${ctx.submitting ? " disabled" : ""}>${t("occ.toItem")}</button><small>${escapeHtml(t("occ.toItemDesc"))}</small></div>` : ""}
                </section>
                </details>
                <section class="lc-checkin__occasion-list-panel">
                    <div class="lc-checkin__section-heading"><div><span class="lc-checkin__section-kicker">${t("occ.listKicker")}</span><strong>${t("occ.listHeading")}</strong></div><span class="lc-checkin__section-count">${filteredOccasions.length}/${ctx.occasionStore.occasions.length}</span></div>
                    <div class="lc-checkin__occasion-cat-bar" role="group" aria-label="${t("occ.filterKind")}">${categoryChipHtml}</div>
                    <div class="lc-checkin__occasion-toolbar">
                        <label class="lc-checkin__occasion-search">${uiIcon("search")}<input type="search" data-occasion-search value="${escapeHtml(ctx.occasionSearchQuery)}" placeholder="${t("occ.searchPlaceholder")}" aria-label="${t("occ.searchAria")}" enterkeyhint="search" autocapitalize="off" autocorrect="off" spellcheck="false" /></label>
                        <label class="lc-checkin__occasion-filter"><span hidden>${t("occ.sortLabel")}</span><select data-occasion-sort aria-label="${t("occ.sortLabel")}"><option value="next"${(ctx.occasionSortMode || "next") === "next" ? " selected" : ""}>${t("occ.sortNext")}</option><option value="name"${ctx.occasionSortMode === "name" ? " selected" : ""}>${t("occ.sortName")}</option><option value="updated"${ctx.occasionSortMode === "updated" ? " selected" : ""}>${t("occ.sortUpdated")}</option></select></label>
                    </div>
                    <details class="lc-checkin__occasion-filter-fold" ${isFilterOpen ? "open" : ""}>
                        <summary><span>${t("occ.filters")}</span>${activeFilterCount ? `<em>${activeFilterCount}</em>` : ""}<span class="lc-checkin__fold-chevron" aria-hidden="true">⌄</span></summary>
                        <div class="lc-checkin__occasion-stats" role="group" aria-label="${t("occ.statsAria")}">${stats}</div>
                        <div class="lc-checkin__occasion-filters">${filterSelect("kind", t("occ.filterKind"), ctx.occasionKindFilter, [["all", t("occ.filterAll")], ...kindSelectOptions])}${filterSelect("status", t("occ.filterStatus"), ctx.occasionStatusFilter, [["all", t("occ.filterAll")], ["enabled", t("occ.filterEnabled")], ["disabled", t("occ.filterDisabled")]])}${filterSelect("time", t("occ.filterTime"), ctx.occasionTimeFilter, [["all", t("occ.filterAll")], ["today", t("occ.filterToday")], ["missed", t("occ.filterMissed")], ["upcoming", t("occ.filterUpcoming")], ["ended", t("occ.filterEnded")]])}${hasActiveFilters ? `<button class="lc-checkin__text-button" type="button" data-occasion-clear-filters>${t("occ.clearFilters")}</button>` : ""}</div>
                    </details>
                    <div class="lc-checkin__occasion-manager-list" data-occasion-agenda>${agendaRows || agendaEmpty}</div>
                </section>
                <details class="lc-checkin__occasion-more-fold" ${ctx.helpOpen ? "open" : ""}>
                    <summary><span class="lc-checkin__section-kicker">${t("occ.moreKicker")}</span><strong>${t("occ.moreHeading")}</strong><span class="lc-checkin__fold-chevron" aria-hidden="true">⌄</span></summary>
                    <div class="lc-checkin__occasion-more-body">
                        <div class="lc-checkin__occasion-more-row"><button class="lc-checkin__text-button" type="button" data-action="sync-occasions-book">${t("occ.syncBookNow")}</button><small>${escapeHtml(t("occ.syncBookHint"))}</small></div>
                        <div class="lc-checkin__occasion-more-row"><button class="lc-checkin__text-button" type="button" data-action="sync-contacts-birthdays">${t("occ.syncContactsBirthdays")}</button><small>${escapeHtml(t("occ.syncContactsHint"))}</small></div>
                        ${ctx.taskHorizonAvailable ? `<div class="lc-checkin__occasion-more-row"><button class="lc-checkin__text-button" type="button" data-action="occasion-open-th-kanban">${t("occ.openThKanban")}</button><small>${escapeHtml(t("occ.openThCalendarAria"))}</small></div>` : ""}
                        <div class="lc-checkin__occasion-more-row"><button class="lc-checkin__text-button" type="button" data-action="copy-upcoming-markdown" aria-label="${escapeHtml(t("occ.copyMarkdownAria"))}">${t("occ.copyMarkdown")}</button><small>${escapeHtml(t("occ.copyMarkdownHint"))}</small></div>
                        <div class="lc-checkin__occasion-more-row"><button class="lc-checkin__text-button" type="button" data-action="export-occasion-ics" aria-label="${escapeHtml(t("occ.exportIcsAria"))}">${t("occ.exportIcs")}</button><small>${escapeHtml(t("occ.exportIcsHint"))}</small></div>
                        <div class="lc-checkin__occasion-more-help" role="note">${moreHelp}</div>
                    </div>
                </details>
            </div>
        </div>`;
}

export type {Occasion};

/** T-1716（D-358）：规则预览骨架——编辑既有事项时以当前规则渲染；新建时为空骨架，
    由 bind 侧按表单值实时填充（同一 buildOccurrencePreview 投影，零第二套计算）。 */
function renderOccurrencePreviewView(item: Occasion | undefined, open: boolean): string {
    const entries = item ? buildOccurrencePreview(item, currentCalendarDate()).entries : [];
    const rows = entries.map((entry: OccurrencePreviewEntry) => `<div class="lc-checkin__occasion-preview-row"><time datetime="${escapeHtml(entry.occurrenceDate)}">${escapeHtml(entry.occurrenceDate)}</time><small>${escapeHtml(t("occ.previewRemind", {date: entry.remindDate}))}</small></div>`).join("");
    return `<details class="lc-checkin__occasion-preview" data-occasion-preview ${open ? "open" : ""}><summary>${t("occ.previewTitle")}</summary><div class="lc-checkin__occasion-preview-body" data-occasion-preview-body>${rows}</div></details>`;
}
