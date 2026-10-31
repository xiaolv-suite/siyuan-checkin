import {t} from "../i18n";
import type {CheckinItem} from "../types";

export interface MoreNavigationHost {
    showToday(root?: HTMLElement): void;
    showArchived(root?: HTMLElement): void;
    showSettings(root?: HTMLElement): void;
    showEditor(item?: CheckinItem, returnTo?: "today" | "review" | "insights" | "more", root?: HTMLElement): void;
    pageForRoot?(root: HTMLElement): string;
}

/* T-1986（用户实测反馈）：更多页按内容类型分组 —— 此前 7 张卡片平铺一张网格，
   动作、管理、设置、帮助混在一起，用户无法预期「点这个会去哪」。现按心智模型
   分三组：快捷操作（动作）、项目与数据（管理）、偏好与帮助（配置与支持）。 */
const MORE_GROUPS: Array<{heading: string; tone?: "accent"; destinations: ReadonlyArray<readonly [string, string, string]>}> = [
    {
        heading: "more.groupActions",
        tone: "accent",
        destinations: [
            ["search", "more.searchTitle", "more.searchHint"],
            ["new-project", "more.newProjectTitle", "more.newProjectHint"],
        ],
    },
    {
        heading: "more.groupItemsData",
        destinations: [
            ["archived", "more.archivedTitle", "more.archivedHint"],
            ["data", "more.dataTitle", "more.dataHint"],
        ],
    },
    {
        heading: "more.groupPreferences",
        destinations: [
            ["appearance", "more.appearanceTitle", "more.appearanceHint"],
            ["external", "more.externalTitle", "more.externalHint"],
            ["about", "more.aboutTitle", "more.aboutHint"],
        ],
    },
];

export function renderMoreView(): string {
    const groups = MORE_GROUPS.map((group) => {
        const destinations = group.destinations.map(([action, title, hint]) =>
            `<button class="lc-checkin__more-destination" type="button" data-more-action="${action}"><span><strong>${t(title)}</strong><small>${t(hint)}</small></span><span class="lc-checkin__more-arrow" aria-hidden="true">›</span></button>`).join("");
        return `<section class="lc-checkin__more-group${group.tone === "accent" ? " is-accent" : ""}"><h2>${t(group.heading)}</h2><div class="lc-checkin__more-destinations">${destinations}</div></section>`;
    }).join("");
    return `<div class="lc-checkin lc-checkin--history lc-checkin--more"><header class="lc-checkin__editor-header"><div><div class="lc-checkin__eyebrow">${t("more.eyebrow")}</div><h1 class="lc-checkin__title">${t("nav.more")}</h1></div></header><main class="lc-checkin__more-groups" aria-label="${t("more.destinationsAria")}">${groups}</main></div>`;
}

export function bindMoreNavigationFor(host: MoreNavigationHost, root: HTMLElement): void {
    root.querySelectorAll<HTMLButtonElement>("[data-more-action]").forEach((button) => button.addEventListener("click", () => {
        const action = button.dataset.moreAction;
        if (action === "search") {
            host.showToday(root);
            if (host.pageForRoot?.(root) === "today" || !host.pageForRoot) root.querySelector<HTMLInputElement>("[data-today-search]")?.focus();
            return;
        }
        if (action === "new-project") {
            host.showEditor(undefined, "more", root);
            return;
        }
        if (action === "archived") {
            host.showArchived(root);
            return;
        }
        const group = action === "appearance" || action === "data" || action === "external" || action === "about" ? action : undefined;
        if (!group) return;
        host.showSettings(root);
        if (host.pageForRoot?.(root) === "settings" || !host.pageForRoot) {
            const navBtn = root.querySelector<HTMLButtonElement>(`[data-settings-nav="${group}"]`);
            navBtn?.click();
            const scrollToGroup = () => {
                const targetCard = root.querySelector<HTMLElement>(`[data-settings-group="${group}"]`);
                targetCard?.scrollIntoView?.({block: "start", behavior: "instant"});
                const heading = targetCard?.querySelector<HTMLElement>("h2");
                if (heading) {
                    heading.setAttribute("tabindex", "-1");
                    heading.focus({preventScroll: true});
                }
            };
            scrollToGroup();
            if (typeof requestAnimationFrame === "function") requestAnimationFrame(scrollToGroup);
        }
    }));
}
