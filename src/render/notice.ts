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

export { lvNotify };
