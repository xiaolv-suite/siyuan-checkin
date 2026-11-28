/**
 * 打卡伴生微反思回写 Daily Note 模态对话框 (Micro-Reflection Dialog)
 * 
 * 核心哲学：破除“打卡与日常日记知识沉淀脱节”痛点，
 * 在打卡当下以 1~2 句感悟沉淀心流，并增量回写至当日思源日记
 * “### 今日打卡与行动”子小节。
 */

import { Dialog } from "siyuan";
import { t } from "../i18n";
import { escapeHtml, isSafeIconImage, renderIconMarkup } from "../shared";
import { evaluateModalKeydown } from "../features/a11y-focus-announcer";
import { formatTimeOnly } from "../features/lifelog-append";
import { getFocusableElements } from "./lv-focus-trap";
import { lvSurfaceStack } from "./lv-notice-kit";
import { showMessage } from "./notice";
import type { HabitResilienceResult } from "../features/habit-resilience";
import type { CheckinEvent, CheckinItem } from "../types";

export interface MicroReflectionDialogDeps {
    item: CheckinItem;
    event?: CheckinEvent; // 若今日已打卡，则携带该事件
    date: Date;
    isMobileFrontend: boolean;
    currentStreak: number;
    resilience: HabitResilienceResult;
    targetSectionHeader?: string;
    suggestedValue?: number;
    appearance?: "light" | "dark";
    palette?: string;
    onSave: (params: {
        value?: number;
        note: string;
        energy?: 1 | 2 | 3 | 4 | 5;
        writebackToDailyNote: boolean;
    }) => Promise<boolean>;
}

export function openMicroReflectionDialog(deps: MicroReflectionDialogDeps): Dialog {
    const isMobile = deps.isMobileFrontend || (typeof window !== "undefined" && window.innerWidth <= 600);
    const appearance: "light" | "dark" = deps.appearance ?? (
        typeof document !== "undefined" && (
            document.querySelector?.(".lc-checkin[data-appearance]")?.getAttribute?.("data-appearance") === "dark"
            || document.documentElement?.getAttribute?.("data-theme-mode") === "dark"
        ) ? "dark" : "light"
    );
    const palette = deps.palette ?? (
        typeof document !== "undefined"
            ? (document.querySelector?.(".lc-checkin[data-palette]")?.getAttribute?.("data-palette") || "")
            : ""
    );
    const existingNote = deps.event?.note || "";
    let selectedEnergy: 1 | 2 | 3 | 4 | 5 = (deps.event?.energy && deps.event.energy >= 1 && deps.event.energy <= 5)
        ? (deps.event.energy as 1 | 2 | 3 | 4 | 5)
        : 4; // 缺省为充沛 4

    const energyLevels = [
        { level: 1, label: "枯竭", icon: "⚡1" },
        { level: 2, label: "疲劳", icon: "⚡2" },
        { level: 3, label: "平稳", icon: "⚡3" },
        { level: 4, label: "充沛", icon: "⚡4" },
        { level: 5, label: "心流", icon: "⚡5" },
    ] as const;

    const quickTags = [
        "#心流专注",
        "#克服阻力",
        "#微习惯",
        "#突破挑战",
        "#状态渐入",
        "#今日复盘",
    ];

    const targetHeader = deps.targetSectionHeader?.trim() || "今日打卡与行动";
    const previousFocus = (document.activeElement as HTMLElement | null) ?? null;

    const energyPillsMarkup = energyLevels.map((lvl) => {
        const active = lvl.level === selectedEnergy ? " is-active" : "";
        return `<button type="button" class="lc-reflection-energy-btn${active}" data-energy-level="${lvl.level}"><span>${lvl.icon}</span><small>${lvl.label}</small></button>`;
    }).join("");

    const quickTagsMarkup = quickTags.map((tag) => {
        return `<button type="button" class="lc-reflection-tag-chip" data-reflection-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`;
    }).join("");

    const isAlreadyCheckedIn = Boolean(deps.event);
    const defaultUnit = t("microReflection.defaultUnit");
    const statusLine = isAlreadyCheckedIn
        ? `<div class="lc-reflection-status-row"><span>${t("microReflection.checkedIn")}<strong>+${escapeHtml(String(deps.event!.value))} ${escapeHtml(deps.event!.unit || defaultUnit)}</strong></span><span class="lc-reflection-time">${escapeHtml(formatTimeOnly(deps.event!.occurredAt))}</span></div>`
        : `<div class="lc-reflection-input-row"><label class="lc-reflection-val-label"><span>${t("microReflection.increment")}</span><input type="number" step="any" min="0.01" class="b3-text-field lc-reflection-val-input" value="${deps.suggestedValue || 1}" /></label><span class="lc-reflection-unit">${escapeHtml(deps.item.unit || defaultUnit)}</span></div>`;

    const contentHtml = `
        <div class="lc-checkin lc-reflection-dialog-host ${isMobile ? "is-mobile" : ""}" data-appearance="${escapeHtml(appearance)}"${palette ? ` data-palette="${escapeHtml(palette)}"` : ""}>
            <div class="lc-reflection-header">
                <div class="lc-reflection-title-wrap">
                    <span class="lc-reflection-icon">${renderIconMarkup(deps.item.icon || "✨")}</span>
                    <div>
                        <h3 class="lc-reflection-name">${escapeHtml(deps.item.name)}</h3>
                        <div class="lc-reflection-meta">
                            <span class="lc-reflection-streak-badge" title="当前连续打卡天数">🔥 ${deps.currentStreak} 天</span>
                            <span class="lc-reflection-resilience-badge is-${deps.resilience.grade.toLowerCase()}" title="${escapeHtml(deps.resilience.hint)}">🛡️ 韧性 ${deps.resilience.score}% (${deps.resilience.label})</span>
                        </div>
                    </div>
                </div>
            </div>

            ${deps.resilience.inResilienceBuffer ? `<div class="lc-reflection-buffer-tip">💡 <strong>自律韧性保护中：</strong>即便偶有间断，习惯核心心流依旧稳固，持续打卡即重回巅峰。</div>` : ""}

            <form class="lc-reflection-form">
                ${statusLine}

                <div class="lc-reflection-field-group">
                    <label class="lc-reflection-field-label"><span>精力与心流状态</span></label>
                    <div class="lc-reflection-energy-bar">${energyPillsMarkup}</div>
                </div>

                <div class="lc-reflection-field-group">
                    <div class="lc-reflection-label-between">
                        <label class="lc-reflection-field-label"><span>当下微反思与感悟</span></label>
                        <span class="lc-reflection-word-count">0/200</span>
                    </div>
                    <textarea class="b3-text-field fn__block lc-reflection-textarea" rows="3" maxlength="200" placeholder="写下一两句当下的微反思或关键收获（例如：跑步配速平稳、递归思路比昨天清晰、专注30分钟未看手机）...">${escapeHtml(existingNote)}</textarea>
                    <div class="lc-reflection-tags-bar">${quickTagsMarkup}</div>
                </div>

                <div class="lc-reflection-target-row">
                    <label class="lc-reflection-sync-label">
                        <input type="checkbox" checked class="lc-reflection-sync-chk" />
                        <span>📓 增量回写至今日 Daily Note (小节：<strong>### ${escapeHtml(targetHeader)}</strong>)</span>
                    </label>
                </div>

                <p class="lc-reflection-error" data-reflection-error role="alert" style="margin:0 0 8px;color:var(--lc-checkin-danger-text);font-size:12px;" hidden></p>

                <div class="lc-reflection-actions">
                    <button type="button" class="b3-button b3-button--cancel" data-action="cancel">${t("common.cancel")}</button>
                    <button type="submit" class="b3-button b3-button--text" data-action="submit">${isAlreadyCheckedIn ? t("microReflection.saveWriteback") : t("microReflection.checkinWriteback")}</button>
                </div>
            </form>
        </div>
    `;

    let destroyed = false;
    let cleanedUp = false;
    let composing = false;
    let unregisterSurface: (() => void) | null = null;
    let onWindowKeydown: ((evt: KeyboardEvent) => void) | null = null;
    let handleCompositionStart: (() => void) | null = null;
    let handleCompositionEnd: (() => void) | null = null;
    let textarea: HTMLTextAreaElement | null = null;
    const surfaceId = `lc-micro-reflection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        destroyed = true;
        if (onWindowKeydown && typeof window !== "undefined" && typeof window.removeEventListener === "function") {
            window.removeEventListener("keydown", onWindowKeydown, true);
        }
        onWindowKeydown = null;
        unregisterSurface?.();
        unregisterSurface = null;
        if (textarea) {
            if (handleCompositionStart) textarea.removeEventListener?.("compositionstart", handleCompositionStart);
            if (handleCompositionEnd) textarea.removeEventListener?.("compositionend", handleCompositionEnd);
        }
        handleCompositionStart = null;
        handleCompositionEnd = null;
    };

    const safeTitleIcon = deps.item.icon && !isSafeIconImage(deps.item.icon) ? deps.item.icon : "💭";
    const dialog = new Dialog({
        title: escapeHtml(`${safeTitleIcon} 打卡微反思 · ${deps.item.name}`),
        content: contentHtml,
        width: isMobile ? "92vw" : "520px",
        destroyCallback: () => {
            cleanup();
            if (previousFocus?.isConnected) previousFocus.focus();
            else (document.querySelector(".lc-checkin") as HTMLElement | null)?.focus?.();
        },
    });

    const closeDialog = () => {
        if (destroyed) return;
        cleanup();
        dialog.destroy();
    };

    const el = dialog.element;
    el.classList?.add?.("lc-checkin-dialog-root", "lc-checkin-subdialog-root");
    el.setAttribute?.("data-appearance", appearance);
    if (palette) el.setAttribute?.("data-palette", palette);
    const dialogContainer = el.querySelector?.(".b3-dialog__container") as HTMLElement | null | undefined;
    dialogContainer?.classList?.add?.("lc-checkin-dialog");
    dialogContainer?.setAttribute?.("data-appearance", appearance);
    if (palette) dialogContainer?.setAttribute?.("data-palette", palette);
    if (appearance === "dark") {
        dialogContainer?.classList?.add?.("lc-checkin-dialog--dark");
    }
    if (isMobile) {
        dialogContainer?.classList?.add?.("lc-checkin-modal-container--mobile");
        el.querySelector?.(".lc-reflection-dialog-host")?.classList?.add?.("lc-checkin-modal-host--mobile");
    } else {
        el.querySelector?.(".b3-dialog__scroller")?.classList?.add?.("lc-checkin-dialog-scroller");
    }
    const form = el.querySelector<HTMLFormElement>(".lc-reflection-form");
    textarea = el.querySelector<HTMLTextAreaElement>(".lc-reflection-textarea");
    const wordCountEl = el.querySelector<HTMLElement>(".lc-reflection-word-count");
    const syncChk = el.querySelector<HTMLInputElement>(".lc-reflection-sync-chk");
    const valInput = el.querySelector<HTMLInputElement>(".lc-reflection-val-input");
    const submitBtn = el.querySelector<HTMLButtonElement>("[data-action='submit']");
    const cancelBtn = el.querySelector<HTMLButtonElement>("[data-action='cancel']");
    const errorEl = el.querySelector<HTMLElement>("[data-reflection-error]");

    handleCompositionStart = () => { composing = true; };
    handleCompositionEnd = () => { composing = false; };
    textarea?.addEventListener("compositionstart", handleCompositionStart);
    textarea?.addEventListener("compositionend", handleCompositionEnd);

    const updateWordCount = () => {
        if (!textarea || !wordCountEl) return;
        if (textarea.value.length > 200) {
            textarea.value = textarea.value.slice(0, 200);
        }
        const len = textarea.value.length;
        wordCountEl.textContent = `${len}/200`;
    };
    updateWordCount();
    textarea?.addEventListener("input", updateWordCount);

    // 精力档位点击切换
    el.querySelectorAll<HTMLButtonElement>(".lc-reflection-energy-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            el.querySelectorAll(".lc-reflection-energy-btn").forEach((b) => b.classList.remove("is-active"));
            btn.classList.add("is-active");
            const lvl = Number(btn.dataset.energyLevel);
            if (lvl >= 1 && lvl <= 5) {
                selectedEnergy = lvl as 1 | 2 | 3 | 4 | 5;
            }
        });
    });

    // 快捷标签点击插入
    el.querySelectorAll<HTMLButtonElement>(".lc-reflection-tag-chip").forEach((btn) => {
        btn.addEventListener("click", () => {
            const tag = btn.dataset.reflectionTag || "";
            if (!textarea || !tag) return;
            const current = textarea.value;
            if (current.includes(tag)) {
                // 已有则不重复插入
                return;
            }
            const nextText = current ? `${current.trim()} ${tag} ` : `${tag} `;
            if (nextText.length > 200) return;
            textarea.value = nextText;
            updateWordCount();
            textarea.focus();
        });
    });

    // 取消
    cancelBtn?.addEventListener("click", () => closeDialog());

    // 提交保存
    let submitting = false;
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (destroyed || submitting) return;
        submitting = true;
        if (errorEl) {
            errorEl.textContent = "";
            errorEl.hidden = true;
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = t("microReflection.saving");
        }
        const note = textarea?.value?.trim().slice(0, 200) || "";
        const writeback = syncChk?.checked ?? true;
        const val = valInput ? parseFloat(valInput.value) : (deps.event?.value ?? 1);

        try {
            const ok = await deps.onSave({
                value: Number.isFinite(val) && val > 0 ? val : 1,
                note,
                energy: selectedEnergy,
                writebackToDailyNote: writeback,
            });
            if (destroyed) return;
            if (ok) {
                closeDialog();
            } else {
                const msg = t("msg.saveFail");
                if (errorEl) {
                    errorEl.textContent = msg;
                    errorEl.hidden = false;
                }
                showMessage(msg, 3500, "error");
            }
        } catch {
            if (destroyed) return;
            const msg = t("msg.saveFail");
            if (errorEl) {
                errorEl.textContent = msg;
                errorEl.hidden = false;
            }
            showMessage(msg, 3500, "error");
        } finally {
            submitting = false;
            if (!destroyed && submitBtn && submitBtn.isConnected !== false) {
                submitBtn.disabled = false;
                submitBtn.textContent = isAlreadyCheckedIn ? t("microReflection.saveWriteback") : t("microReflection.checkinWriteback");
            }
        }
    });

    // 点击遮罩背景安全关闭
    el.addEventListener("click", (evt) => {
        const target = evt.target as HTMLElement | null;
        if (target === el || target?.classList?.contains("b3-dialog__scrim")) {
            closeDialog();
        }
    });

    // 统一浮层栈 + window 捕获阶段监听 Esc（防思源 v3.8.12 前置 window 捕获拦截）
    unregisterSurface = lvSurfaceStack?.push?.({
        id: surfaceId,
        dismiss: () => {
            if (destroyed || composing) return false;
            closeDialog();
            return true;
        },
    }) ?? null;

    onWindowKeydown = (evt: KeyboardEvent) => {
        if (destroyed) return;
        if (evt.isComposing || composing || evt.keyCode === 229) {
            return;
        }
        if (evt.key === "Escape") {
            const top = lvSurfaceStack?.top?.();
            if (top && top.id !== surfaceId) return;
            evt.preventDefault();
            evt.stopPropagation();
            closeDialog();
        }
    };
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
        window.addEventListener("keydown", onWindowKeydown, true);
    }

    // 键盘防护与 IME 合成期让路（Tab 焦点闭环 + Esc 兜底）
    el.addEventListener("keydown", (evt: KeyboardEvent) => {
        if (evt.isComposing || composing || evt.keyCode === 229) {
            evt.stopPropagation();
            return;
        }
        const focusable = getFocusableElements(el);
        const first = focusable[0] || null;
        const last = focusable[focusable.length - 1] || null;
        const current = (document.activeElement as HTMLElement | null) || null;
        if (evt.key === "Tab" && first && typeof el.contains === "function" && (!current || !el.contains(current))) {
            evt.preventDefault();
            first.focus();
            return;
        }
        const action = evaluateModalKeydown(evt, {first, last, current});
        if (action === "close") {
            evt.preventDefault();
            evt.stopPropagation();
            closeDialog();
            return;
        }
        if (action === "trap-first") {
            evt.preventDefault();
            first?.focus();
            return;
        }
        if (action === "trap-last") {
            evt.preventDefault();
            last?.focus();
        }
    }, true);

    setTimeout(() => textarea?.focus(), 80);
    return dialog;
}
