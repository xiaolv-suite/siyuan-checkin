import { Dialog } from "siyuan";
import { t } from "../i18n";
import { escapeHtml } from "../shared";
import { createFocusTrap } from "./lv-focus-trap";
import { createScopedShowMessage, lvNotify } from "./lv-notice-kit";

const rawScopedShowMessage = createScopedShowMessage("小驴打卡");

export const showMessage = (message: string, timeout = 3000, type: "info" | "error" = "info"): void => {
    if (typeof window !== "undefined") {
        (window as any).__messages = [...((window as any).__messages || []), String(message ?? "")];
        if (typeof (window as any).siyuan?.showMessage === "function") {
            (window as any).siyuan.showMessage(message, timeout, type);
        }
    }
    rawScopedShowMessage(message, timeout, type);
};

export interface PromptDialogOptions {
    title: string;
    message?: string;
    defaultValue?: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
    inputType?: "text" | "date";
    maxLength?: number;
    appearance?: "light" | "dark";
    palette?: string;
}

export interface ConfirmDialogOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    appearance?: "light" | "dark";
    palette?: string;
}

function resolveDialogTheme(appearance?: "light" | "dark", palette?: string): { appearance: "light" | "dark"; palette: string; isMobile: boolean } {
    const resolvedAppearance: "light" | "dark" = appearance ?? (
        typeof document !== "undefined" && (
            document.querySelector?.(".lc-checkin[data-appearance]")?.getAttribute?.("data-appearance") === "dark"
            || document.documentElement?.getAttribute?.("data-theme-mode") === "dark"
        ) ? "dark" : "light"
    );
    const resolvedPalette = palette ?? (
        typeof document !== "undefined"
            ? (document.querySelector?.(".lc-checkin[data-palette]")?.getAttribute?.("data-palette") || "lavender")
            : "lavender"
    );
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 600;
    return { appearance: resolvedAppearance, palette: resolvedPalette, isMobile };
}

export function openPromptDialog(options: PromptDialogOptions): Promise<string | null> {
    if (typeof document === "undefined" || typeof Dialog !== "function") {
        return Promise.resolve(null);
    }
    const { appearance, palette, isMobile } = resolveDialogTheme(options.appearance, options.palette);
    const hostClass = isMobile ? "lc-checkin lc-checkin-dialog-host lc-checkin-modal-host--mobile" : "lc-checkin lc-checkin-dialog-host";
    const maxLenAttr = typeof options.maxLength === "number" && options.maxLength > 0 ? ` maxlength="${options.maxLength}"` : "";
    return new Promise((resolve) => {
        let settled = false;
        let trap: ReturnType<typeof createFocusTrap> | null = null;
        const finish = (value: string | null) => {
            if (settled) return;
            settled = true;
            trap?.release();
            trap = null;
            resolve(value);
        };
        const dialog = new Dialog({
            title: escapeHtml(options.title),
            content: `<div class="${hostClass}" data-appearance="${escapeHtml(appearance)}" data-palette="${escapeHtml(palette)}" style="min-height:0;height:auto;padding:16px;">
                ${options.message ? `<p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:var(--lc-checkin-text);">${escapeHtml(options.message)}</p>` : ""}
                <input type="${options.inputType === "date" ? "date" : "text"}" data-prompt-input class="b3-text-field fn__block" value="${escapeHtml(options.defaultValue ?? "")}" placeholder="${escapeHtml(options.placeholder ?? "")}"${maxLenAttr} style="width:100%;box-sizing:border-box;min-height:36px;padding:6px 10px;" />
                <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;flex-wrap:wrap;">
                    <button type="button" class="lc-checkin__text-button" data-prompt-cancel>${escapeHtml(options.cancelText || t("common.cancel"))}</button>
                    <button type="button" class="lc-checkin__primary-button" data-prompt-confirm>${escapeHtml(options.confirmText || t("common.confirm"))}</button>
                </div>
            </div>`,
            width: isMobile ? "92vw" : "min(420px, 94vw)",
            destroyCallback: () => finish(null),
        });
        const el = dialog.element;
        el.classList?.add?.("lc-checkin-dialog-root", "lc-checkin-subdialog-root");
        el.setAttribute?.("data-appearance", appearance);
        const container = el.querySelector?.(".b3-dialog__container") as HTMLElement | null | undefined;
        container?.classList?.add?.("lc-checkin-dialog");
        if (appearance === "dark") container?.classList?.add?.("lc-checkin-dialog--dark");
        if (isMobile) {
            container?.classList?.add?.("lc-checkin-modal-container--mobile");
        } else {
            el.querySelector?.(".b3-dialog__scroller")?.classList?.add?.("lc-checkin-dialog-scroller");
        }
        const input = el.querySelector?.("[data-prompt-input]") as HTMLInputElement | null | undefined;
        const closeWith = (value: string | null) => {
            finish(value);
            dialog.destroy();
        };
        el.addEventListener?.("click", (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target === el || target?.classList?.contains?.("b3-dialog__scrim") || target?.closest?.("[data-prompt-cancel]")) {
                closeWith(null);
            } else if (target?.closest?.("[data-prompt-confirm]")) {
                closeWith(input?.value ?? "");
            }
        });
        el.addEventListener?.("keydown", (event: KeyboardEvent) => {
            if (event.isComposing || event.keyCode === 229) {
                event.stopPropagation();
                return;
            }
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeWith(null);
                return;
            }
            if (event.key === "Enter" && (event.target as HTMLElement | null)?.matches?.("[data-prompt-input]")) {
                event.preventDefault();
                event.stopPropagation();
                closeWith(input?.value ?? "");
            }
        }, true);
        trap = createFocusTrap(el, { initialFocus: "[data-prompt-input]", restoreFocus: true, fallbackToContainer: true });
        trap.activate();
    });
}

export function openConfirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
    if (typeof document === "undefined" || typeof Dialog !== "function") {
        return Promise.resolve(false);
    }
    const { appearance, palette, isMobile } = resolveDialogTheme(options.appearance, options.palette);
    const hostClass = isMobile ? "lc-checkin lc-checkin-dialog-host lc-checkin-modal-host--mobile" : "lc-checkin lc-checkin-dialog-host";
    return new Promise((resolve) => {
        let settled = false;
        let trap: ReturnType<typeof createFocusTrap> | null = null;
        const finish = (value: boolean) => {
            if (settled) return;
            settled = true;
            trap?.release();
            trap = null;
            resolve(value);
        };
        const dialog = new Dialog({
            title: escapeHtml(options.title),
            content: `<div class="${hostClass}" data-appearance="${escapeHtml(appearance)}" data-palette="${escapeHtml(palette)}" style="min-height:0;height:auto;padding:16px;">
                <p style="margin:0 0 16px;font-size:13px;line-height:1.55;white-space:pre-wrap;color:var(--lc-checkin-text);">${escapeHtml(options.message)}</p>
                <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
                    <button type="button" class="lc-checkin__text-button" data-confirm-cancel>${escapeHtml(options.cancelText || t("common.cancel"))}</button>
                    <button type="button" class="${options.danger ? "lc-checkin__danger-button" : "lc-checkin__primary-button"}" data-confirm-ok>${escapeHtml(options.confirmText || t("common.confirm"))}</button>
                </div>
            </div>`,
            width: isMobile ? "92vw" : "min(420px, 94vw)",
            destroyCallback: () => finish(false),
        });
        const el = dialog.element;
        el.classList?.add?.("lc-checkin-dialog-root", "lc-checkin-subdialog-root");
        el.setAttribute?.("data-appearance", appearance);
        const container = el.querySelector?.(".b3-dialog__container") as HTMLElement | null | undefined;
        container?.classList?.add?.("lc-checkin-dialog");
        if (appearance === "dark") container?.classList?.add?.("lc-checkin-dialog--dark");
        if (isMobile) {
            container?.classList?.add?.("lc-checkin-modal-container--mobile");
        } else {
            el.querySelector?.(".b3-dialog__scroller")?.classList?.add?.("lc-checkin-dialog-scroller");
        }
        const closeWith = (value: boolean) => {
            finish(value);
            dialog.destroy();
        };
        el.addEventListener?.("click", (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target === el || target?.classList?.contains?.("b3-dialog__scrim") || target?.closest?.("[data-confirm-cancel]")) {
                closeWith(false);
            } else if (target?.closest?.("[data-confirm-ok]")) {
                closeWith(true);
            }
        });
        el.addEventListener?.("keydown", (event: KeyboardEvent) => {
            if (event.isComposing || event.keyCode === 229) {
                event.stopPropagation();
                return;
            }
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeWith(false);
            }
        }, true);
        trap = createFocusTrap(el, { initialFocus: "[data-confirm-ok]", restoreFocus: true, fallbackToContainer: true });
        trap.activate();
    });
}

export { lvNotify };
