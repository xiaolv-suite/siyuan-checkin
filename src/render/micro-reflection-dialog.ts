/**
 * 打卡伴生微反思回写 Daily Note 模态对话框 (Micro-Reflection Dialog)
 * 
 * 核心哲学：破除“打卡与日常日记知识沉淀脱节”痛点，
 * 在打卡当下以 1~2 句感悟沉淀心流，并增量回写至当日思源日记
 * “### 今日打卡与行动”子小节。
 */

import { Dialog } from "siyuan";
import { t } from "../i18n";
import { escapeHtml } from "../shared";
import { evaluateModalKeydown } from "../features/a11y-focus-announcer";
import { formatTimeOnly } from "../features/lifelog-append";
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
    onSave: (params: {
        value?: number;
        note: string;
        energy?: 1 | 2 | 3 | 4 | 5;
        writebackToDailyNote: boolean;
    }) => Promise<boolean>;
}

export function openMicroReflectionDialog(deps: MicroReflectionDialogDeps): Dialog {
    const isMobile = deps.isMobileFrontend || (typeof window !== "undefined" && window.innerWidth <= 600);
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
        ? `<div class="lc-reflection-status-row"><span>${t("microReflection.checkedIn")}<strong>+${deps.event!.value} ${deps.event!.unit || defaultUnit}</strong></span><span class="lc-reflection-time">${formatTimeOnly(deps.event!.occurredAt)}</span></div>`
        : `<div class="lc-reflection-input-row"><label class="lc-reflection-val-label"><span>${t("microReflection.increment")}</span><input type="number" step="any" min="0.01" class="b3-text-field lc-reflection-val-input" value="${deps.suggestedValue || 1}" /></label><span class="lc-reflection-unit">${escapeHtml(deps.item.unit || defaultUnit)}</span></div>`;

    const contentHtml = `
        <div class="lc-reflection-dialog-host ${isMobile ? "is-mobile" : ""}">
            <div class="lc-reflection-header">
                <div class="lc-reflection-title-wrap">
                    <span class="lc-reflection-icon">${deps.item.icon || "✨"}</span>
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
                    <textarea class="b3-text-field fn__block lc-reflection-textarea" rows="3" placeholder="写下一两句当下的微反思或关键收获（例如：跑步配速平稳、递归思路比昨天清晰、专注30分钟未看手机）...">${escapeHtml(existingNote)}</textarea>
                    <div class="lc-reflection-tags-bar">${quickTagsMarkup}</div>
                </div>

                <div class="lc-reflection-target-row">
                    <label class="lc-reflection-sync-label">
                        <input type="checkbox" checked class="lc-reflection-sync-chk" />
                        <span>📓 增量回写至今日 Daily Note (小节：<strong>### ${escapeHtml(targetHeader)}</strong>)</span>
                    </label>
                </div>

                <div class="lc-reflection-actions">
                    <button type="button" class="b3-button b3-button--cancel" data-action="cancel">${t("common.cancel")}</button>
                    <button type="submit" class="b3-button b3-button--text" data-action="submit">${isAlreadyCheckedIn ? t("microReflection.saveWriteback") : t("microReflection.checkinWriteback")}</button>
                </div>
            </form>
        </div>
    `;

    const dialog = new Dialog({
        title: `${deps.item.icon || "💭"} 打卡微反思 · ${deps.item.name}`,
        content: contentHtml,
        width: isMobile ? "92vw" : "520px",
        destroyCallback: () => {
            if (previousFocus?.isConnected) previousFocus.focus();
            else (document.querySelector(".lc-checkin") as HTMLElement | null)?.focus?.();
        },
    });

    const el = dialog.element;
    const form = el.querySelector<HTMLFormElement>(".lc-reflection-form");
    const textarea = el.querySelector<HTMLTextAreaElement>(".lc-reflection-textarea");
    const wordCountEl = el.querySelector<HTMLElement>(".lc-reflection-word-count");
    const syncChk = el.querySelector<HTMLInputElement>(".lc-reflection-sync-chk");
    const valInput = el.querySelector<HTMLInputElement>(".lc-reflection-val-input");
    const submitBtn = el.querySelector<HTMLButtonElement>("[data-action='submit']");
    const cancelBtn = el.querySelector<HTMLButtonElement>("[data-action='cancel']");

    const updateWordCount = () => {
        if (!textarea || !wordCountEl) return;
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
            textarea.value = current ? `${current.trim()} ${tag} ` : `${tag} `;
            updateWordCount();
            textarea.focus();
        });
    });

    // 取消
    cancelBtn?.addEventListener("click", () => dialog.destroy());

    // 提交保存
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = t("microReflection.saving");
        }
        const note = textarea?.value?.trim() || "";
        const writeback = syncChk?.checked ?? true;
        const val = valInput ? parseFloat(valInput.value) : (deps.event?.value ?? 1);

        try {
            const ok = await deps.onSave({
                value: Number.isFinite(val) && val > 0 ? val : 1,
                note,
                energy: selectedEnergy,
                writebackToDailyNote: writeback,
            });
            if (ok) {
                dialog.destroy();
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = isAlreadyCheckedIn ? t("microReflection.saveWriteback") : t("microReflection.checkinWriteback");
            }
        }
    });

    // 点击遮罩背景安全关闭
    el.addEventListener("click", (evt) => {
        const target = evt.target as HTMLElement | null;
        if (target === el || target?.classList?.contains("b3-dialog__scrim")) {
            dialog.destroy();
        }
    });

    // 键盘防护与 IME 合成期让路
    el.addEventListener("keydown", (evt: KeyboardEvent) => {
        if (evt.isComposing || evt.keyCode === 229) return;
        if (evt.key === "Escape") {
            dialog.destroy();
            evt.stopPropagation();
        }
    });

    setTimeout(() => textarea?.focus(), 80);
    return dialog;
}
