/* T-1665 焦点恢复、键盘模态与 aria-live 降噪模型
   纪律：纯函数与轻量无障碍策略、零隐式时钟、无副作用。
   职责：
   1. aria-live 播报降噪：内容未发生实质变更时不重复触发读屏播报；
   2. 键盘模态保护：IME 拼音组合输入期间 Esc/Enter 绝不误触关闭或提交；
   3. 失败时焦点自动靶向首个可修复的表单控件，杜绝焦点丢失；
   4. 弹窗打开/关闭焦点记忆与成对恢复。 */

export interface AnnouncerChannelState {
    lastMessage: string;
    lastAnnouncedAt: number;
}

export class AriaLiveDeduplicator {
    private readonly channels = new Map<string, AnnouncerChannelState>();

    /**
     * 判断指定通道的消息是否应该被朗读。
     * 规则：
     * 1. 过滤空消息与纯空白；
     * 2. 相同通道、相同文本在冷却期（默认 3000ms）内不重复播报（降噪）；
     * 3. 文本变化时立即放行。
     */
    shouldAnnounce(channel: string, message: string, nowMs: number, cooldownMs = 3000): boolean {
        const trimmed = (message || "").trim();
        if (!trimmed) return false;
        const state = this.channels.get(channel);
        if (!state) return true;
        if (state.lastMessage !== trimmed) return true;
        return nowMs - state.lastAnnouncedAt >= cooldownMs;
    }

    /** 记录成功的播报，更新通道状态。 */
    recordAnnouncement(channel: string, message: string, nowMs: number): void {
        const trimmed = (message || "").trim().slice(0, 250);
        this.channels.set(channel, {
            lastMessage: trimmed,
            lastAnnouncedAt: nowMs,
        });
    }

    /** 清空通道缓存（如切换页面或弹窗关闭时）。 */
    clearChannel(channel: string): void {
        this.channels.delete(channel);
    }

    clearAll(): void {
        this.channels.clear();
    }
}

export interface FocusableElementLike {
    focus: (options?: {preventScroll?: boolean}) => void;
    getAttribute?: (name: string) => string | null;
    setAttribute?: (name: string, value: string) => void;
    removeAttribute?: (name: string) => void;
    closest?: (selector: string) => FocusableElementLike | null;
    scrollIntoView?: (options?: boolean | ScrollIntoViewOptions) => void;
    disabled?: boolean;
    offsetParent?: unknown;
    querySelector?: (selector: string) => FocusableElementLike | null;
    querySelectorAll?: (selector: string) => FocusableElementLike[] | NodeListOf<any>;
    insertAdjacentHTML?: (position: InsertPosition | any, html: string) => void;
    remove?: () => void;
    textContent?: string | null;
    id?: string;
    name?: string;
}

export interface FocusContainerLike {
    querySelector: (selector: string) => FocusableElementLike | null;
    querySelectorAll: (selector: string) => FocusableElementLike[] | NodeListOf<any>;
}

function escapeErrorText(text: string): string {
    return text.replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
    }[m] || m));
}

/**
 * 在容器中寻找首个出错或可修复的控件。
 * 优先级：
 * 1. 表单控件自身带有 [aria-invalid="true"]:not([disabled])（优先聚焦 input/select/textarea 而非外部容器）
 * 2. 任意容器元素 [aria-invalid="true"]:not([disabled])
 * 3. 原生 :invalid:not([disabled])
 * 4. [data-field-error]
 * 5. [data-action="retry"], [data-action*="retry"]
 */
export function findFirstRepairableControl(container: FocusContainerLike): FocusableElementLike | null {
    if (!container || typeof container.querySelector !== "function") return null;

    const invalid = container.querySelector('input[aria-invalid="true"]:not([disabled]), textarea[aria-invalid="true"]:not([disabled]), select[aria-invalid="true"]:not([disabled]), [aria-invalid="true"]:not([disabled])');
    if (invalid && typeof invalid.focus === "function") return invalid;

    const errorInput = container.querySelector('input:invalid:not([disabled]), textarea:invalid:not([disabled]), select:invalid:not([disabled])');
    if (errorInput && typeof errorInput.focus === "function") return errorInput;

    const retryAction = container.querySelector('[data-action="retry"]:not([disabled]), [data-action="retry-initialization"]:not([disabled]), [data-action*="retry"]:not([disabled])');
    if (retryAction && typeof retryAction.focus === "function") return retryAction;

    return null;
}

/**
 * 清除容器内所有 aria-invalid 状态标记与内联错误提示（包括控件及其父级 .lc-checkin__field 容器，以及顶部错误汇总）。
 */
export function clearFormValidationErrors(container: FocusContainerLike): void {
    if (!container || typeof container.querySelectorAll !== "function") return;
    const elements = container.querySelectorAll('[aria-invalid="true"]');
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el && typeof el.removeAttribute === "function") {
            el.removeAttribute("aria-invalid");
        }
        if (el && typeof el.getAttribute === "function" && typeof el.setAttribute === "function") {
            const describedBy = el.getAttribute("aria-describedby") || "";
            const filtered = describedBy.split(/\s+/).filter((id: string) => !id.startsWith("error-")).join(" ").trim();
            if (filtered) {
                el.setAttribute("aria-describedby", filtered);
            } else if (typeof el.removeAttribute === "function") {
                el.removeAttribute("aria-describedby");
            }
        }
        if (el && typeof el.closest === "function") {
            const field = el.closest(".lc-checkin__field");
            if (field) {
                if (typeof field.removeAttribute === "function") {
                    field.removeAttribute("aria-invalid");
                }
                const errorEl = typeof field.querySelector === "function" ? field.querySelector(".lc-checkin__field-error") : null;
                if (errorEl && typeof errorEl.remove === "function") {
                    errorEl.remove();
                }
            }
        }
    }
    const summary = typeof container.querySelector === "function" ? container.querySelector(".lc-checkin__error-summary") : null;
    if (summary && typeof (summary as any).remove === "function" && ((summary as any).classList?.contains?.("lc-checkin__error-summary") || (summary as any).className?.includes?.("lc-checkin__error-summary") || (summary as any).getAttribute?.("role") === "alert")) {
        (summary as any).remove();
    }
}

/**
 * 标记指定表单控件为错误状态，挂载内联 role=alert 错误提示，并同步关联 aria-describedby。
 */
export function markFormControlInvalid(control: FocusableElementLike | null | undefined, errorMessage?: string): void {
    if (!control) return;
    if (typeof control.setAttribute === "function") {
        control.setAttribute("aria-invalid", "true");
    }
    if (typeof control.closest === "function") {
        const field = control.closest(".lc-checkin__field");
        if (field) {
            if (typeof field.setAttribute === "function") {
                field.setAttribute("aria-invalid", "true");
            }
            if (errorMessage) {
                const controlName = (typeof control.getAttribute === "function" ? control.getAttribute("name") : "") || (control as any).name || "control";
                const errorId = `error-${controlName}`;
                let errorEl = typeof field.querySelector === "function" ? field.querySelector(".lc-checkin__field-error") : null;
                if (!errorEl && typeof (field as any).insertAdjacentHTML === "function") {
                    (field as any).insertAdjacentHTML("beforeend", `<small class="lc-checkin__field-error" id="${errorId}" role="alert">${escapeErrorText(errorMessage)}</small>`);
                    errorEl = typeof field.querySelector === "function" ? field.querySelector(".lc-checkin__field-error") : null;
                } else if (errorEl) {
                    errorEl.textContent = errorMessage;
                    errorEl.id = errorId;
                }
                if (typeof control.getAttribute === "function" && typeof control.setAttribute === "function") {
                    const prevDescribedBy = control.getAttribute("aria-describedby") || "";
                    if (!prevDescribedBy.includes(errorId)) {
                        control.setAttribute("aria-describedby", prevDescribedBy ? `${errorId} ${prevDescribedBy}` : errorId);
                    }
                }
            }
        }
    }
}

export interface FormErrorEntry {
    field: string;
    message: string;
    control?: FocusableElementLike | null;
}

/**
 * 渲染符合 W3C WAI Web Accessibility Tutorials 与 GOV.UK 规范的错误汇总卡片 (Error Summary)。
 * - role="alert" 与 aria-labelledby
 * - tabindex="-1" 支持程序化定位
 * - 包含错误项列表与每个错误控件的交互式直达按键
 */
export function renderErrorSummary(
    errors: readonly FormErrorEntry[],
    options?: {title?: string},
): string {
    if (!errors.length) return "";
    const title = options?.title || "请修正以下错误后再保存：";
    const itemsMarkup = errors.map((entry) => {
        return `<li><button type="button" class="lc-checkin__error-summary-link" data-focus-control="${escapeErrorText(entry.field)}">${escapeErrorText(entry.message)}</button></li>`;
    }).join("");
    return `<div class="lc-checkin__error-summary" role="alert" tabindex="-1" aria-labelledby="lc-error-summary-title">` +
        `<strong class="lc-checkin__error-summary-title" id="lc-error-summary-title">${escapeErrorText(title)}</strong>` +
        `<ul class="lc-checkin__error-summary-list">${itemsMarkup}</ul>` +
        `</div>`;
}

/**
 * 挂载表单级错误摘要卡片并绑定交互跳转事件。
 */
export function attachErrorSummary(
    container: FocusContainerLike,
    errors: readonly FormErrorEntry[],
    options?: {title?: string},
): FocusableElementLike | null {
    if (!container || !errors.length) return null;

    // 清理既有错误摘要
    const oldSummary = typeof container.querySelector === "function" ? container.querySelector(".lc-checkin__error-summary") : null;
    if (oldSummary && typeof (oldSummary as any).remove === "function" && ((oldSummary as any).classList?.contains?.("lc-checkin__error-summary") || (oldSummary as any).className?.includes?.("lc-checkin__error-summary") || (oldSummary as any).getAttribute?.("role") === "alert")) {
        (oldSummary as any).remove();
    }

    const html = renderErrorSummary(errors, options);
    const scrollContainer = typeof container.querySelector === "function" ? container.querySelector(".lc-checkin__form-scroll") : null;
    const targetMount = (scrollContainer && ((scrollContainer as any).classList?.contains?.("lc-checkin__form-scroll") || (scrollContainer as any).className?.includes?.("lc-checkin__form-scroll"))) ? scrollContainer : container;

    if (typeof (targetMount as any).insertAdjacentHTML === "function") {
        (targetMount as any).insertAdjacentHTML("afterbegin", html);
    }

    const summaryEl = typeof container.querySelector === "function" ? container.querySelector(".lc-checkin__error-summary") : null;
    if (summaryEl && typeof summaryEl.querySelectorAll === "function") {
        const links = summaryEl.querySelectorAll(".lc-checkin__error-summary-link");
        for (let i = 0; i < links.length; i++) {
            const link = links[i];
            const targetField = (link as any).dataset?.focusControl;
            if (targetField && typeof link.addEventListener === "function") {
                link.addEventListener("click", () => {
                    const control = container.querySelector(`[name='${targetField}']`);
                    if (control && typeof control.focus === "function") {
                        control.focus();
                        if (typeof (control as any).scrollIntoView === "function") {
                            (control as any).scrollIntoView({behavior: (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) ? "auto" : "smooth", block: "nearest"});
                        }
                    }
                });
            }
        }
    }
    return summaryEl;
}

/**
 * 编辑器表单校验失败时应用视觉与无障碍错误状态，并自动寻址首个可修复控件。
 */
export function applyEditorValidationFeedback(
    form: FocusContainerLike | null | undefined,
    errors: {name?: string; target?: string; unit?: string; schedule?: string},
    anchorInvalid = false,
    anchorErrorMessage?: string,
): FocusableElementLike | null {
    if (!form) return null;
    clearFormValidationErrors(form);
    const errorEntries: FormErrorEntry[] = [];
    if (errors.name) {
        errorEntries.push({field: "name", message: errors.name, control: form.querySelector("input[name='name']")});
        markFormControlInvalid(form.querySelector("input[name='name']"), errors.name);
    }
    if (errors.target) {
        errorEntries.push({field: "target", message: errors.target, control: form.querySelector("input[name='target']")});
        markFormControlInvalid(form.querySelector("input[name='target']"), errors.target);
    }
    if (errors.unit) {
        errorEntries.push({field: "unit", message: errors.unit, control: form.querySelector("input[name='unit']")});
        markFormControlInvalid(form.querySelector("input[name='unit']"), errors.unit);
    }
    if (errors.schedule) {
        const scheduleVal = (form.querySelector("select[name='schedule']") as any)?.value || "";
        const targetControl = scheduleVal === "quota" ? form.querySelector("input[name='quotaAmount']") : form.querySelector("select[name='schedule']");
        const targetName = scheduleVal === "quota" ? "quotaAmount" : "schedule";
        errorEntries.push({field: targetName, message: errors.schedule, control: targetControl});
        if (scheduleVal === "quota") {
            markFormControlInvalid(form.querySelector("input[name='quotaAmount']"), errors.schedule);
        } else {
            markFormControlInvalid(form.querySelector("select[name='schedule']"), errors.schedule);
        }
    }
    if (anchorInvalid) {
        const msg = anchorErrorMessage || "无效的笔记锚点块 ID";
        errorEntries.push({field: "anchorBlockId", message: msg, control: form.querySelector("input[name='anchorBlockId']")});
        markFormControlInvalid(form.querySelector("input[name='anchorBlockId']"), msg);
    }
    if (errorEntries.length) {
        attachErrorSummary(form, errorEntries);
    }
    const firstInvalid = findFirstRepairableControl(form);
    if (firstInvalid && typeof firstInvalid.focus === "function") {
        firstInvalid.focus();
        if (typeof (firstInvalid as any).scrollIntoView === "function") {
            (firstInvalid as any).scrollIntoView({behavior: (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) ? "auto" : "smooth", block: "nearest"});
        }
    }
    return firstInvalid;
}

/**
 * 事项表单校验失败时应用视觉与无障碍错误状态，并自动寻址首个可修复控件。
 */
export function applyOccasionValidationFeedback(
    form: FocusContainerLike | null | undefined,
    errors: {name?: boolean | string; date?: boolean | string},
): FocusableElementLike | null {
    if (!form) return null;
    clearFormValidationErrors(form);
    const errorEntries: FormErrorEntry[] = [];
    if (errors.name) {
        const msg = typeof errors.name === "string" ? errors.name : "请填写事项名称";
        errorEntries.push({field: "name", message: msg, control: form.querySelector("input[name='name']")});
        markFormControlInvalid(form.querySelector("input[name='name']"), msg);
    }
    if (errors.date) {
        const msg = typeof errors.date === "string" ? errors.date : "请选择有效日期";
        errorEntries.push({field: "date", message: msg, control: form.querySelector("input[name='date']")});
        markFormControlInvalid(form.querySelector("input[name='date']"), msg);
    }
    if (errorEntries.length) {
        attachErrorSummary(form, errorEntries);
    }
    const firstInvalid = findFirstRepairableControl(form);
    if (firstInvalid && typeof firstInvalid.focus === "function") {
        firstInvalid.focus();
        if (typeof (firstInvalid as any).scrollIntoView === "function") {
            (firstInvalid as any).scrollIntoView({behavior: (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) ? "auto" : "smooth", block: "nearest"});
        }
    }
    return firstInvalid;
}

export type ModalKeyboardAction = "close" | "trap-first" | "trap-last" | "none";

/**
 * 键盘模态事件判断：
 * 1. IME 拼音输入期间（isComposing / keyCode === 229），Esc 与 Enter 一律忽略（返回 none）；
 * 2. 普通 Esc 触发关闭（返回 close）；
 * 3. Tab 在首末元素之间循环 Focus Trap。
 */
export function evaluateModalKeydown(
    event: {key: string; shiftKey: boolean; isComposing?: boolean; keyCode?: number},
    hasFocusElements?: {first: FocusableElementLike | null; last: FocusableElementLike | null; current: FocusableElementLike | null},
): ModalKeyboardAction {
    if (event.isComposing || event.keyCode === 229) {
        return "none";
    }

    if (event.key === "Escape") {
        return "close";
    }

    if (event.key === "Tab" && hasFocusElements?.first && hasFocusElements?.last) {
        if (event.shiftKey && hasFocusElements.current === hasFocusElements.first) {
            return "trap-last";
        }
        if (!event.shiftKey && hasFocusElements.current === hasFocusElements.last) {
            return "trap-first";
        }
    }

    return "none";
}
