/* 快速弹窗生命周期：从 index.ts 外置（T-022）。
   含窗口尺寸偏好、移动端 topbar 按钮与「小驴速切」快捷动作注册。 */
import {t} from "../i18n";
import { getFrontend, Dialog } from "siyuan";
import { showMessage } from "./notice";
import {lvLaunchpad} from "./lv-notice-kit";
import type {DialogSizeMode} from "../view-preferences";
import type {EditorRootContext} from "../types";
import {disposeResponsiveCharts} from "../ui/responsive-charts";
import {formSignatureFromData, isEditorFormDirty} from "../features/editor-draft";
import {evaluateModalKeydown} from "../features/a11y-focus-announcer";

export interface QuickDialogHost {
    disposed: boolean;
    disposing: boolean;
    isMobileFrontend: boolean;
    dialogSizeMode: DialogSizeMode;
    dialogScale: number;
    dialogFixedSize: {width: number; height: number};
    dialogRect?: {width: number; height: number};
    dialogOffset?: {x: number; y: number};
    currentPage: "today" | "editor" | "review" | "archived" | "insights" | "occasions" | "settings" | "more";
    editingId?: string;
    editingFingerprint?: string;
    quickDialog?: Dialog;
    quickDialogElement?: HTMLElement;
    quickDialogFullscreen: boolean;
    quickDialogViewportCleanup?: () => void;
    quickDialogFrameCleanup?: () => void;
    setPageForRoot?(page: QuickDialogHost["currentPage"], root?: HTMLElement): void;
    pageForRoot?(root: HTMLElement): QuickDialogHost["currentPage"];
    forgetSurfaceRoot?(root: HTMLElement): void;
    setEditorStateForRoot?(root: HTMLElement | undefined, patch: Partial<EditorRootContext>, replace?: boolean): void;
    speedSwitchQuickActionDisposers: Array<() => void>;
    /** Some launcher versions register successfully without returning a disposer. */
    speedSwitchQuickActionsRegistered?: boolean;
    speedSwitchRetryTimer?: number;
    app?: unknown;
    render(root?: HTMLElement): void;
    renderInto(root: HTMLElement): void;
    reconcileStore(): Promise<void>;
    persistViewPreferences(): Promise<void>;
    applyPreferenceMutation?(mutate: () => void): void;
    /* T-1621 步骤一：弹窗页独立于 dock/页签（root-page-store 代理层）。 */
    applyNavigation(root: HTMLElement | undefined, page: QuickDialogHost["currentPage"]): boolean;
    pageOfRoot(root: HTMLElement): QuickDialogHost["currentPage"];
    releaseRootContext(root: HTMLElement): void;
}

/** Content-driven default: a fixed reading width beats scaling blank margins with the window. */
export const AUTO_DIALOG_MIN_WIDTH = 760;
export const AUTO_DIALOG_MAX_WIDTH = 1780;
/** Auto mode intentionally uses 90% of the viewport so content is not cramped. */
export const AUTO_DIALOG_WIDTH_RATIO = 0.9;
export const AUTO_DIALOG_HEIGHT_RATIO = 0.94;

export function autoDialogWidth(viewportWidth: number): number {
    return Math.round(Math.min(AUTO_DIALOG_MAX_WIDTH, Math.max(AUTO_DIALOG_MIN_WIDTH, viewportWidth * AUTO_DIALOG_WIDTH_RATIO)));
}

export function quickDialogSizeOf(host: QuickDialogHost): {width: string; height: string} {
    if (host.dialogSizeMode === "fullscreen") return {width: "100vw", height: "100vh"};
    if (host.dialogSizeMode === "fixed") return {width: `${host.dialogFixedSize.width}px`, height: `${host.dialogFixedSize.height}px`};
    if (host.dialogSizeMode === "auto") {
        const width = host.dialogRect?.width ?? autoDialogWidth(window.innerWidth);
        const height = host.dialogRect?.height ?? Math.round(window.innerHeight * AUTO_DIALOG_HEIGHT_RATIO);
        return {width: `${width}px`, height: `${height}px`};
    }
    const scale = Math.min(100, Math.max(50, host.dialogScale)) / 100;
    const width = Math.round(window.innerWidth * scale);
    const height = Math.round(window.innerHeight * scale);
    return {width: `${width}px`, height: `${height}px`};
}

export function toggleQuickDialogFor(host: QuickDialogHost): void {
    if (host.quickDialog) {
        closeQuickDialogFor(host);
        return;
    }
    openQuickDialogFor(host);
}

/* T-1597：快速弹窗会话页签——关闭时记录当前页（编辑页降级为今日：表单草稿仅存 DOM），
   重开时回放；同窗口会话内有效，不跨重载。 */
type QuickPage = QuickDialogHost["currentPage"];
let lastQuickPage: QuickPage = "today";
const QUICK_PRESERVED_PAGES: ReadonlySet<QuickPage> = new Set(["today", "review", "insights", "archived", "occasions", "settings", "more"]);

function rememberQuickPage(page: QuickPage): void {
    lastQuickPage = QUICK_PRESERVED_PAGES.has(page) ? page : "today";
}

export function setNextQuickDialogPage(page: QuickPage): void {
    rememberQuickPage(page);
}

export function openQuickDialogFor(host: QuickDialogHost): void {
    if (host.disposed || host.disposing) return;
    if (host.quickDialog) {
        const currentRoot = host.quickDialogElement;
        if (currentRoot && shouldProtectQuickDialogDraft(host, currentRoot) && !window.confirm(t("msg.quickCloseEditingConfirm"))) return;
        if (currentRoot) {
            /* applyNavigation has its own generic draft guard. Once this
               entry point already confirmed the quick-dialog copy, refresh
               the baseline so the same action never asks twice. */
            markQuickDialogDraftAccepted(currentRoot);
            host.applyNavigation(host.quickDialogElement, "today");
            if (host.pageOfRoot(currentRoot) === "editor") return;
        }
        else host.currentPage = "today";
        if (currentRoot && host.setEditorStateForRoot) host.setEditorStateForRoot(currentRoot, {editingId: undefined, editingFingerprint: undefined, editorReturnPage: undefined, appliedTemplateNote: undefined, submitting: false}, true);
        else {
            host.editingId = undefined;
            host.editingFingerprint = undefined;
        }
        host.render(currentRoot);
        return;
    }

    const nextPage = QUICK_PRESERVED_PAGES.has(lastQuickPage) ? lastQuickPage : "today";
    host.editingId = undefined;
    host.editingFingerprint = undefined;
    let dialog: Dialog | undefined;
    const mobile = host.isMobileFrontend;
    const hostClass = mobile ? "lc-checkin-dialog-host lc-checkin-dialog-host--mobile lc-mobile" : "lc-checkin-dialog-host";
    const size = quickDialogSizeOf(host);
    dialog = new Dialog({
        title: "",
        content: `<div class="${hostClass}" role="region" aria-label="${t("app.quickDialogAria")}"></div>`,
        width: mobile ? "100vw" : size.width,
        height: mobile ? "100dvh" : size.height,
        disableAnimation: mobile,
        destroyCallback: () => {
            if (dialog) handleQuickDialogDestroyedFor(host, dialog);
        },
    });
    const root = dialog.element.querySelector<HTMLElement>(".lc-checkin-dialog-host");
    if (!root) {
        dialog.destroy();
        showMessage(t("msg.quickDialogInitFail"));
        return;
    }
    dialog.element.querySelector<HTMLElement>(".b3-dialog__container")?.classList.add("lc-checkin-dialog");
    dialog.element.querySelector<HTMLElement>(".b3-dialog__body")?.classList.add("lc-checkin-dialog__body");
    const dialogBody = dialog.element.querySelector<HTMLElement>(".b3-dialog__body");
    const hostStyle = dialog.element.querySelector<HTMLElement>(".lc-checkin-dialog-host");
    if (dialogBody && hostStyle) {
        dialogBody.style.overflow = "hidden";
        hostStyle.style.height = "100%";
    }
    host.quickDialog = dialog;
    host.quickDialogElement = root;
    host.quickDialogFullscreen = false;
    /* T-1597 + T-1621：会话页只落在弹窗自己的 root——重开回放，其余表面不动。 */
    host.applyNavigation(root, nextPage);
    bindQuickDialogViewportFor(host, dialog);
    // 点击遮罩背景快速关闭（统一桌面与移动端人体工程学）
    dialog.element.addEventListener("click", (event) => {
        const target = event.target as HTMLElement | null;
        if (target === dialog?.element || target?.classList?.contains("b3-dialog__scrim")) {
            if (shouldProtectQuickDialogDraft(host, root) && !window.confirm(t("msg.quickCloseEditingConfirm"))) {
                return;
            }
            dialog?.destroy();
        }
    });
    /* T-1597：编辑页未保存先提示——捕获阶段拦截 SiYuan 关闭按钮（祖先 capture 先于
       目标监听器触发），确认后才真正销毁；取消则弹窗与表单草稿原样保留。 */
    dialog.element.addEventListener("click", (event) => {
        const target = event.target as HTMLElement | null;
        if (!target || !target.closest(".b3-dialog__close")) return;
        if (shouldProtectQuickDialogDraft(host, root) && !window.confirm(t("msg.quickCloseEditingConfirm"))) {
            event.stopImmediatePropagation();
            event.preventDefault();
            return;
        }
    }, true);
    /* WCAG 2.1.2 / WCAG 2.4.3 & T-1665 快速弹窗模态键盘防护、Focus Trap 与未保存确认：
       1. IME 拼音输入期间（isComposing / keyCode === 229），Esc 与快捷键一律拦截，绝不误触关闭；
       2. 普通 Esc 关闭前核验未保存草稿确认；
       3. Tab 键在首末元素之间闭环 Focus Trap。 */
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    dialog.element.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.isComposing || event.keyCode === 229) {
            event.stopPropagation();
            return;
        }
        const focusable = Array.from(dialog.element.querySelectorAll<HTMLElement>(focusableSelector));
        const first = focusable[0] || null;
        const last = focusable[focusable.length - 1] || null;
        const current = (document.activeElement as HTMLElement | null) || null;
        const action = evaluateModalKeydown(event, {first, last, current});
        if (action === "close") {
            if (shouldProtectQuickDialogDraft(host, root) && !window.confirm(t("msg.quickCloseEditingConfirm"))) {
                event.stopImmediatePropagation();
                event.preventDefault();
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            closeQuickDialogFor(host);
            return;
        }
        if (action === "trap-first") {
            event.preventDefault();
            first?.focus();
            return;
        }
        if (action === "trap-last") {
            event.preventDefault();
            last?.focus();
            return;
        }
    }, true);
    host.renderInto(root);
    /* The header is rendered by renderInto. Bind the frame only afterwards so
       first-open dragging/double-click works, and use delegated listeners so a
       later page render cannot detach the handlers from the new header. */
    bindQuickDialogFrameFor(host, dialog);
}

const FRAME_MIN_WIDTH = 520;
const FRAME_MIN_HEIGHT = 400;
const RESIZE_EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
type ResizeEdge = typeof RESIZE_EDGES[number];

/* 桌面端把弹窗当窗口对待：标题区拖动、八向手柄缩放、双击标题最大化。
   任意一次拖动/缩放都会切到 "auto" 模式并记住尺寸与位置，符合"调过一次就保持"的桌面直觉。 */
export function bindQuickDialogFrameFor(host: QuickDialogHost, dialog: Dialog): void {
    if (host.isMobileFrontend) return;
    const container = dialog.element.querySelector<HTMLElement>(".b3-dialog__container");
    if (!container) return;
    container.classList.add("lc-checkin-dialog--framed");
    let width = Math.round(container.getBoundingClientRect().width) || autoDialogWidth(window.innerWidth);
    let height = Math.round(container.getBoundingClientRect().height) || Math.round(window.innerHeight * AUTO_DIALOG_HEIGHT_RATIO);
    let offsetX = host.dialogOffset?.x ?? 0;
    let offsetY = host.dialogOffset?.y ?? 0;

    const apply = () => {
        if (host.quickDialog !== dialog) return;
        if (host.quickDialogFullscreen) {
            container.style.width = "";
            container.style.height = "";
            container.style.transform = "";
            return;
        }
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
        container.style.transform = offsetX || offsetY ? `translate(${offsetX}px, ${offsetY}px)` : "";
    };
    const persist = () => {
        const rect = {width: Math.round(width), height: Math.round(height)};
        const offset = offsetX || offsetY ? {x: Math.round(offsetX), y: Math.round(offsetY)} : undefined;
        if (host.applyPreferenceMutation) {
            host.applyPreferenceMutation(() => {
                host.dialogRect = rect;
                host.dialogOffset = offset;
                host.dialogSizeMode = "auto";
            });
        } else {
            host.dialogRect = rect;
            host.dialogOffset = offset;
            host.dialogSizeMode = "auto";
            void host.persistViewPreferences();
        }
    };
    const maxWidth = () => Math.max(FRAME_MIN_WIDTH, window.innerWidth - 24);
    const maxHeight = () => Math.max(FRAME_MIN_HEIGHT, window.innerHeight - 24);
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

    apply();

    let drag: {pointerX: number; pointerY: number; startX: number; startY: number} | undefined;
    const onDragMove = (event: PointerEvent) => {
        if (!drag) return;
        offsetX = Math.round(drag.startX + event.clientX - drag.pointerX);
        offsetY = Math.round(drag.startY + event.clientY - drag.pointerY);
        apply();
    };
    const onDragEnd = () => {
        if (!drag) return;
        drag = undefined;
        window.removeEventListener("pointermove", onDragMove);
        window.removeEventListener("pointerup", onDragEnd);
        window.removeEventListener("pointercancel", onDragEnd);
        persist();
    };
    const headerSelector = ".lc-checkin__header, .lc-checkin__editor-header, .lc-checkin__settings-header";
    const isInteractive = (target: EventTarget | null) => Boolean((target as HTMLElement | null)?.closest?.("button, input, select, textarea, a, label, [role='button'], [contenteditable='true']"));
    const onContainerPointerDown = (event: PointerEvent) => {
        if (!(event.target as HTMLElement | null)?.closest?.(headerSelector)) return;
        if (host.quickDialogFullscreen || event.button !== 0 || isInteractive(event.target)) return;
        drag = {pointerX: event.clientX, pointerY: event.clientY, startX: offsetX, startY: offsetY};
        window.addEventListener("pointermove", onDragMove);
        window.addEventListener("pointerup", onDragEnd);
        window.addEventListener("pointercancel", onDragEnd);
        event.preventDefault();
    };
    const onContainerDoubleClick = (event: MouseEvent) => {
        if (!(event.target as HTMLElement | null)?.closest?.(headerSelector)) return;
        if (isInteractive(event.target)) return;
        toggleQuickDialogFullscreenFor(host);
    };
    const onHeaderDown = onContainerPointerDown;
    const onHeaderDoubleClick = onContainerDoubleClick;
    container.addEventListener("pointerdown", onContainerPointerDown); // container.addEventListener("pointerdown", onHeaderDown)
    container.addEventListener("dblclick", onContainerDoubleClick); // container.addEventListener("dblclick", onHeaderDoubleClick)

    const handles: HTMLElement[] = [];
    const onResizeDown = (edge: ResizeEdge) => (event: PointerEvent) => {
        if (host.quickDialogFullscreen || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const start = {pointerX: event.clientX, pointerY: event.clientY, width, height, offsetX, offsetY};
        const onMove = (move: PointerEvent) => {
            const dx = move.clientX - start.pointerX;
            const dy = move.clientY - start.pointerY;
            if (edge.includes("e")) width = clamp(start.width + dx, FRAME_MIN_WIDTH, maxWidth());
            if (edge.includes("s")) height = clamp(start.height + dy, FRAME_MIN_HEIGHT, maxHeight());
            if (edge.includes("w")) {
                const next = clamp(start.width - dx, FRAME_MIN_WIDTH, maxWidth());
                offsetX = start.offsetX + (start.width - next);
                width = next;
            }
            if (edge.includes("n")) {
                const next = clamp(start.height - dy, FRAME_MIN_HEIGHT, maxHeight());
                offsetY = start.offsetY + (start.height - next);
                height = next;
            }
            apply();
        };
        const onEnd = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onEnd);
            window.removeEventListener("pointercancel", onEnd);
            persist();
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onEnd);
        window.addEventListener("pointercancel", onEnd);
    };
    RESIZE_EDGES.forEach((edge) => {
        const handle = document.createElement("div");
        handle.className = `lc-checkin-dialog__resize-handle is-${edge}`;
        handle.dataset.resizeEdge = edge;
        handle.setAttribute("aria-hidden", "true");
        handle.addEventListener("pointerdown", onResizeDown(edge));
        container.appendChild(handle);
        handles.push(handle);
    });

    /* 全屏切换由其他入口改写 class，这里跟随同步（全屏时交还宿主尺寸控制）。 */
    const observer = new MutationObserver(() => apply());
    observer.observe(container, {attributes: true, attributeFilter: ["class"]});

    host.quickDialogFrameCleanup = () => {
        observer.disconnect();
        container.removeEventListener("pointerdown", onContainerPointerDown);
        container.removeEventListener("dblclick", onContainerDoubleClick);
        handles.forEach((handle) => handle.remove());
        window.removeEventListener("pointermove", onDragMove);
        window.removeEventListener("pointerup", onDragEnd);
        window.removeEventListener("pointercancel", onDragEnd);
        container.style.transform = "";
    };
}

/** 全屏/还原的唯一实现：按钮与双击标题共用，保证两边尺寸与手柄状态一致。 */
export function toggleQuickDialogFullscreenFor(host: QuickDialogHost, root?: HTMLElement): void {
    const container = host.quickDialog?.element.querySelector<HTMLElement>(".b3-dialog__container");
    if (!container) return;
    host.quickDialogFullscreen = !host.quickDialogFullscreen;
    container.classList.toggle("lc-checkin-dialog--fullscreen", host.quickDialogFullscreen);
    if (root) host.renderInto(root);
}

export function closeQuickDialogFor(host: QuickDialogHost, force = false): void {
    const dialog = host.quickDialog;
    if (!dialog) return;
    const root = host.quickDialogElement;
    if (!force && root && shouldProtectQuickDialogDraft(host, root) && !window.confirm(t("msg.quickCloseEditingConfirm"))) return;
    dialog.destroy();
    // SiYuan currently invokes destroyCallback synchronously; retain a
    // fallback so a future asynchronous implementation cannot leave stale refs.
    handleQuickDialogDestroyedFor(host, dialog);
}

/** Keep every close/reopen entry point on the same editor-draft guard. */
function confirmQuickDialogEditorLeave(host: QuickDialogHost, root: HTMLElement): boolean {
    if (!shouldProtectQuickDialogDraft(host, root)) return true;
    return window.confirm(t("msg.quickCloseEditingConfirm"));
}

function shouldProtectQuickDialogDraft(host: QuickDialogHost, root: HTMLElement): boolean {
    if (host.pageOfRoot(root) !== "editor") return false;
    const form = root.querySelector<HTMLFormElement>("form");
    const baseline = root.dataset.editorDraftBaseline;
    return isEditorFormDirty(form ? new FormData(form) : undefined, baseline);
}

function markQuickDialogDraftAccepted(root: HTMLElement): void {
    const form = root.querySelector<HTMLFormElement>("form");
    if (form) root.dataset.editorDraftBaseline = formSignatureFromData(new FormData(form));
}

export function handleQuickDialogDestroyedFor(host: QuickDialogHost, dialog: Dialog): void {
    if (host.quickDialog !== dialog) return;
    const root = host.quickDialogElement;
    const closingPage = host.quickDialogElement ? host.pageOfRoot(host.quickDialogElement) : host.currentPage;
    if (root) disposeResponsiveCharts(root);
    try {
        const active = typeof document !== "undefined" ? document.activeElement : null;
        if (active && dialog.element.contains(active)) {
            (active as HTMLElement).blur?.();
        }
    } catch {}
    host.quickDialogViewportCleanup?.();
    host.quickDialogViewportCleanup = undefined;
    host.quickDialogFrameCleanup?.();
    host.quickDialogFrameCleanup = undefined;
    host.quickDialog = undefined;
    host.quickDialogElement = undefined;
    if (root) host.forgetSurfaceRoot?.(root);
    if (root) host.releaseRootContext(root);
    host.quickDialogFullscreen = false;
    /* T-1597：记录会话页签——编辑页降级为今日（表单草稿仅存 DOM，随窗口销毁）。 */
    rememberQuickPage(closingPage);
    if (host.disposed || host.disposing) return;
    host.editingId = undefined;
    host.editingFingerprint = undefined;
    host.render();
    void host.reconcileStore();
}

interface SpeedSwitchPluginLike {
    name?: string;
    registerQuickAction: (options: {
        id: string;
        label: string;
        icon?: string;
        value?: string;
        targets?: Array<"desktop" | "sidebar" | "mobile">;
        handler: (value: string) => void | Promise<void>;
    }) => (() => void) | void;
}

/** Register optional launcher actions when 小驴速切 is installed. */
export function ensureSpeedSwitchQuickActionsFor(host: QuickDialogHost): void {
    if (host.disposed || host.disposing || host.speedSwitchQuickActionsRegistered || host.speedSwitchQuickActionDisposers.length) return;
    const plugins = (host.app as unknown as {plugins?: unknown} | undefined)?.plugins;
    const candidates = Array.isArray(plugins)
        ? plugins
        : plugins && typeof plugins === "object" ? Object.values(plugins as Record<string, unknown>) : [];
    const speedSwitch = candidates.find((candidate) => {
        if (!candidate || typeof candidate !== "object") return false;
        const plugin = candidate as {name?: unknown; registerQuickAction?: unknown};
        return typeof plugin.registerQuickAction === "function" && (plugin.name === "siyuan-speed-switch" || plugin.name === "小驴速切" || plugin.name === "siyuanSpeedSwitch");
    }) as SpeedSwitchPluginLike | undefined;
    if (!speedSwitch?.registerQuickAction) {
        if (host.speedSwitchRetryTimer === undefined) {
            host.speedSwitchRetryTimer = window.setTimeout(() => {
                host.speedSwitchRetryTimer = undefined;
                ensureSpeedSwitchQuickActionsFor(host);
            }, 1200);
        }
        return;
    }
    const actions: Array<{id: string; label: string; value: string; handler: () => void}> = [
        {id: "xiaolv-checkin-open", label: t("quick.openCheckin"), value: "open", handler: () => openQuickDialogFor(host)},
    ];
    actions.forEach((action) => {
        const dispose = speedSwitch.registerQuickAction({
            id: action.id,
            label: action.label,
            icon: "iconLvCheckin",
            value: action.value,
            targets: ["desktop", "sidebar", "mobile"],
            handler: () => action.handler(),
        });
        if (typeof dispose === "function") host.speedSwitchQuickActionDisposers.push(dispose);
    });
    /* The launcher contract permits a void return. Keep an explicit success
       marker so focus/refresh retries cannot register duplicate actions. */
    host.speedSwitchQuickActionsRegistered = true;
}

export function bindQuickDialogViewportFor(host: QuickDialogHost, dialog: Dialog): void {
    if (!host.isMobileFrontend) return;
    const viewport = window.visualViewport;
    const container = dialog.element.querySelector<HTMLElement>(".b3-dialog__container");
    if (!viewport || !container) return;
    let frame = 0;
    let baseHeight = Math.max(window.innerHeight || 0, viewport.height || 0);
    const sync = () => {
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
            frame = 0;
            if (host.quickDialog !== dialog) return;
            const rawVh = Math.floor(viewport.height);
            if (rawVh > baseHeight) baseHeight = rawVh;
            const height = Math.max(280, Math.floor(viewport.height - 16));
            container.style.height = `${height}px`;
            container.style.maxHeight = `${height}px`;
            const vvHeight = Math.max(280, rawVh);
            container.style.setProperty("--lc-vv-h", `${vvHeight}px`);
            const hostEl = container.querySelector<HTMLElement>(".lc-checkin-dialog-host--mobile");
            hostEl?.style.setProperty("--lc-vv-h", `${vvHeight}px`);
            const refHeight = Math.max(baseHeight, window.innerHeight || 0);
            const keyboardOpen = refHeight > 0 && refHeight - rawVh > 110;
            if (keyboardOpen) {
                container.setAttribute("data-keyboard-open", "true");
                hostEl?.setAttribute("data-keyboard-open", "true");
            } else {
                container.removeAttribute("data-keyboard-open");
                hostEl?.removeAttribute("data-keyboard-open");
            }
        });
    };
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();

    /* 移动端统一交互规范：仅限顶栏把手下拉 80px 关闭，表单输入态绝对豁免（Protocol v1.6.0 Mobile Spec v1） */
    let touchStartY = 0;
    let touchStartX = 0;
    let pullingDown = false;
    let validStart = false;

    const isInputInteracting = (target: HTMLElement | null): boolean => {
        if (!target) return false;
        if (typeof document !== "undefined" && document.activeElement) {
            const tag = document.activeElement.tagName?.toLowerCase();
            if (tag === "input" || tag === "textarea" || tag === "select" || document.activeElement.getAttribute("contenteditable") === "true") {
                return true;
            }
        }
        return Boolean(target.closest("input, textarea, select, [contenteditable='true'], form, .b3-text-field"));
    };

    const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        const target = e.target as HTMLElement | null;
        if (isInputInteracting(target)) {
            validStart = false;
            pullingDown = false;
            return;
        }
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
        pullingDown = false;
        validStart = Boolean(target?.closest(".lc-checkin__mobile-topbar, .lc-checkin-dialog__drag-handle"));
        if (validStart) {
            pullingDown = true;
        }
    };
    const onTouchEnd = (e: TouchEvent) => {
        if (!validStart || !pullingDown) {
            validStart = false;
            pullingDown = false;
            return;
        }
        const target = e.target as HTMLElement | null;
        if (isInputInteracting(target)) {
            validStart = false;
            pullingDown = false;
            return;
        }
        validStart = false;
        pullingDown = false;
        const touch = e.changedTouches[0];
        if (!touch) return;
        const deltaY = touch.clientY - touchStartY;
        const deltaX = Math.abs(touch.clientX - touchStartX);
        if (deltaY >= 80 && deltaY > deltaX * 2) {
            lvLaunchpad.haptic(10);
            closeQuickDialogFor(host);
        }
    };
    container.addEventListener("touchstart", onTouchStart, {passive: true});
    container.addEventListener("touchend", onTouchEnd, {passive: true});

    host.quickDialogViewportCleanup = () => {
        viewport.removeEventListener("resize", sync);
        viewport.removeEventListener("scroll", sync);
        window.removeEventListener("resize", sync);
        container.removeEventListener("touchstart", onTouchStart);
        container.removeEventListener("touchend", onTouchEnd);
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
    };
}

export {getFrontend};
