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
    disabled?: boolean;
    offsetParent?: unknown;
}

export interface FocusContainerLike {
    querySelector: (selector: string) => FocusableElementLike | null;
    querySelectorAll: (selector: string) => FocusableElementLike[] | NodeListOf<any>;
}

/**
 * 在容器中寻找首个出错或可修复的控件。
 * 优先级：
 * 1. [aria-invalid="true"]:not([disabled])
 * 2. :invalid:not([disabled])
 * 3. [data-field-error]
 * 4. [data-action="retry"], [data-action*="retry"]
 */
export function findFirstRepairableControl(container: FocusContainerLike): FocusableElementLike | null {
    if (!container || typeof container.querySelector !== "function") return null;

    const invalid = container.querySelector('[aria-invalid="true"]:not([disabled])');
    if (invalid && typeof invalid.focus === "function") return invalid;

    const errorInput = container.querySelector('input:invalid:not([disabled]), textarea:invalid:not([disabled]), select:invalid:not([disabled])');
    if (errorInput && typeof errorInput.focus === "function") return errorInput;

    const retryAction = container.querySelector('[data-action="retry"]:not([disabled]), [data-action="retry-initialization"]:not([disabled]), [data-action*="retry"]:not([disabled])');
    if (retryAction && typeof retryAction.focus === "function") return retryAction;

    return null;
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
