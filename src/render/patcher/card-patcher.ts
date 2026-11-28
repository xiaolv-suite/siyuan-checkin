import {t} from "../../i18n";
import type {CardPatchData, PatchResult, TodayPatchData} from "./types";

export function formatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/**
 * S6: 局部 Patch 定向更新单个打卡卡片 DOM
 * 核心目标：
 * 1. 仅定向修改目标卡片的类名、进度条、数值与连击标签，杜绝整个视图的 innerHTML 重新赋值；
 * 2. 避免正在输入的输入框（搜索框、金额、备注）失焦，消除视觉闪烁；
 * 3. 失败时返回 false，平滑降级至全量 renderInto()。
 */
export function patchCardNode(card: HTMLElement, patch: CardPatchData): boolean {
    if (!card || !card.isConnected) return false;

    // 1. 完成状态 class
    card.classList.toggle("is-complete", patch.complete);
    if (patch.isSkip !== undefined) {
        card.classList.toggle("is-skip", patch.isSkip);
    }

    // 2. CSS 变量与进度条
    const clampedPercent = Math.max(0, Math.min(100, Math.round(patch.percent)));
    card.style.setProperty("--item-progress", `${clampedPercent}%`);
    const progressBar = card.querySelector<HTMLElement>(".lc-checkin__item-progress > span");
    if (progressBar) {
        progressBar.style.width = `${clampedPercent}%`;
    }

    // 3. 数值与剩余量文本
    const valueContainer = card.querySelector<HTMLElement>(".lc-checkin__item-value");
    if (valueContainer) {
        const strong = valueContainer.querySelector("strong");
        if (strong) {
            strong.textContent = formatNumber(patch.progress);
        }
        const remainingEl = valueContainer.querySelector("small");
        if (remainingEl) {
            if (patch.remainingValue !== undefined && patch.remainingValue > 0) {
                remainingEl.textContent = t("today.remainingValue", {
                    value: formatNumber(patch.remainingValue),
                    unit: patch.unit,
                });
                remainingEl.removeAttribute("hidden");
            } else {
                remainingEl.setAttribute("hidden", "");
            }
        }
    }

    // 4. 连击 Badge 更新
    const streakBadge = card.querySelector<HTMLElement>(".lc-checkin__streak-badge");
    if (streakBadge) {
        if (patch.currentStreak > 1) {
            streakBadge.textContent = `🔥 ${patch.currentStreak}`;
            streakBadge.style.display = "";
        } else {
            streakBadge.style.display = "none";
        }
    }

    // 5. 操作按钮文字/状态同步
    // 仅更新主操作区 .lc-checkin__item-action 内的二值非限制型 [data-action='record']，
    // 绝不篡改精确录入区 [data-exact-entry] 内的「记录」按钮语义！
    const kind = card.dataset?.kind;
    const direction = card.dataset?.direction;
    const isBinaryAtLeast = (!kind || kind === "binary") && direction !== "atMost";
    const directActionBtn = card.querySelector<HTMLButtonElement>(".lc-checkin__item-action > [data-action='record']");
    const fallbackActionBtn = !directActionBtn ? card.querySelector<HTMLButtonElement>("[data-action='record']") : null;
    const recordBtn = directActionBtn || (fallbackActionBtn && !fallbackActionBtn.closest?.("[data-exact-entry]") ? fallbackActionBtn : null);
    if (recordBtn && isBinaryAtLeast) {
        recordBtn.textContent = patch.complete ? t("item.cancel") : t("item.checkin");
    }

    const toggleBtn = card.querySelector<HTMLButtonElement>("[data-action='toggle']");
    if (toggleBtn) {
        toggleBtn.setAttribute("aria-label", patch.complete ? t("item.undoAria", {name: ""}) : t("item.completeAria", {name: ""}));
    }

    // 6. 微动效反馈（不重新创建 DOM 节点）
    card.classList.remove("lc-checkin__card--pulse");
    // 强制回流以重置 CSS 动画
    void card.offsetWidth;
    card.classList.add("lc-checkin__card--pulse");
    if (typeof window !== "undefined") {
        window.setTimeout(() => {
            card.classList.remove("lc-checkin__card--pulse");
        }, 600);
    }

    return true;
}

/**
 * 在指定 Root 内查找目标卡片并执行局部 Patch
 */
export function patchItemInRoot(root: HTMLElement, itemId: string, patch: CardPatchData): boolean {
    if (!root || !root.isConnected) return false;
    const escapeId = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(itemId) : itemId;
    const card = root.querySelector<HTMLElement>(`.lc-checkin__item[data-item-id="${escapeId}"]`);
    if (!card) return false;
    return patchCardNode(card, patch);
}

/**
 * 遍历所有已连接的宿主表面，批量定向 Patch 目标卡片。
 * 若任一处于 today 页面的活跃表面未找到目标卡片（如排序/过滤变动），则调用 fallbackFn 执行全量重绘。
 */
export function patchItemInRoots(
    roots: HTMLElement[],
    itemId: string,
    patch: CardPatchData,
    fallbackFn?: () => void
): PatchResult {
    const activeRoots = roots.filter(r => Boolean(r && r.isConnected !== false));
    if (!activeRoots.length) {
        if (fallbackFn) fallbackFn();
        return {patched: false, cardFound: false, rootsUpdated: 0};
    }

    let rootsUpdated = 0;
    for (const root of activeRoots) {
        const success = patchItemInRoot(root, itemId, patch);
        if (success) {
            rootsUpdated++;
        }
    }

    // 契约（对标审查意见）：任一活跃 today root 未命中卡片时，必须降级至全量重绘保证多表面一致性
    if (rootsUpdated < activeRoots.length) {
        if (fallbackFn) fallbackFn();
        return {patched: false, cardFound: rootsUpdated > 0, rootsUpdated};
    }

    return {patched: true, cardFound: true, rootsUpdated};
}

/**
 * 定向 Patch 整个 Today 表面的卡片与概览环
 */
export function patchTodaySurface(
    root: HTMLElement,
    patch: TodayPatchData
): boolean {
    if (!root || root.isConnected === false) return false;

    // 1. 卡片就地更新
    const cardPatched = patchItemInRoot(root, patch.card.itemId, patch.card);

    // 2. 概览环与进度就地更新
    if (patch.overviewRingPercent !== undefined) {
        const ring = root.querySelector<HTMLElement>(".lc-checkin__overview-ring");
        if (ring) {
            ring.textContent = `${patch.overviewRingPercent}%`;
            ring.style.setProperty("--overview-progress", `${patch.overviewRingPercent}%`);
        }
        const bar = root.querySelector<HTMLElement>(".lc-checkin__overview-progress .lc-checkin__progress span");
        if (bar) {
            bar.style.width = `${patch.overviewRingPercent}%`;
        }
    }
    if (patch.completedCount !== undefined && patch.scheduledCount !== undefined) {
        const countEl = root.querySelector<HTMLElement>(".lc-checkin__overview-progress .lc-checkin__count");
        if (countEl) {
            countEl.innerHTML = `${patch.completedCount}<span>/</span>${patch.scheduledCount}`;
        }
    }

    return cardPatched;
}
