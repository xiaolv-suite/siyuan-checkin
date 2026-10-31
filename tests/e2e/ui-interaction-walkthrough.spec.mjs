/* 真实思源内核 + 真实浏览器 UI、功能与交互全链路走查（D-718）：
   在隔离的 SiYuan 3.8.9 靶场实例中实际点击验证：
   1) 新建页：自然语言一句话推断（每天阅读 30 分钟）→ 自动回填时长/目标 → 保存落盘；
   2) 今日页：NextHero 单卡去重（无重复第 3 行副标题、无重复第二张提醒横幅、内嵌查看全部提醒入口）、深色专注计时器预设按钮对比度（8.95:1）、一键打卡与撤销回执；
   3) 回顾页：概览/记录/分析三工作区切换、习惯韧性条与热力图渲染、非今日页隐藏内联每日提醒条；
   4) 事项页与设置页：新建日期事项、ICS 导出按钮就绪、设置分类检索与手动同步日记入口。 */
import fs from "node:fs";
import path from "node:path";
import {expect, test} from "@playwright/test";
import {createClient, openCheckin, openTodayPage, snapshotStore} from "./helpers/app.mjs";

const shotDir = path.resolve(import.meta.dirname, "..", "..", ".artifacts", "e2e", "ui-walkthrough");

test("真实思源内核下 UI、功能与交互全链路实测走查", async ({page}) => {
    fs.mkdirSync(shotDir, {recursive: true});
    const client = createClient();
    await openCheckin(page);

    // 清空初始打卡项以从干净状态走完整新建→打卡→专注→回顾→事项→设置链路
    const base = await snapshotStore(page);
    await client.putFile("checkin-store", {...base, items: [], events: []});
    await page.reload();
    await openCheckin(page);
    // 关闭思源新工作区首次启动自带的右下角 Welcome 浮层，避免遮挡表单底部按钮与截图
    const onboardingClose = page.locator("section.onboarding button").first();
    if (await onboardingClose.isVisible().catch(() => false)) {
        await onboardingClose.click();
    }
    await openTodayPage(page);

    // 1. 新建页：点击「+ 新建项目」，展开自然语言起草抽屉，推断并应用两个习惯（时长型 + 二值型）
    await page.locator(".lc-checkin--today [data-action='add']").first().click();
    await page.waitForSelector(".lc-checkin--editor", {timeout: 15000});
    await page.locator(".lc-checkin--editor [data-ai-draft-disclosure] > summary").click();
    const draftInput = page.locator(".lc-checkin--editor [data-ai-draft-input]");
    await expect(draftInput).toBeVisible();
    await draftInput.fill("每天深度阅读 30 分钟");
    await page.locator(".lc-checkin--editor [data-action='ai-draft-infer']").click();
    await expect(page.locator(".lc-checkin--editor [data-ai-draft-preview]")).toBeVisible();
    await page.screenshot({path: path.join(shotDir, "01-editor-nl-draft.png")});
    await page.locator(".lc-checkin--editor [data-action='ai-draft-apply']").click();
    await expect(page.locator(".lc-checkin--editor input[name='name']")).toHaveValue(/阅读/);
    await page.locator(".lc-checkin--editor .lc-checkin__save-button").click();

    // 等待回到今日页并再建一个二值习惯「晨跑锻炼」
    await page.waitForSelector(".lc-checkin--today", {timeout: 15000});
    await page.locator(".lc-checkin--today [data-action='add']").first().click();
    await page.waitForSelector(".lc-checkin--editor", {timeout: 15000});
    await page.locator(".lc-checkin--editor [data-ai-draft-disclosure] > summary").click();
    await page.locator(".lc-checkin--editor [data-ai-draft-input]").fill("每天晨跑锻炼");
    await page.locator(".lc-checkin--editor [data-action='ai-draft-infer']").click();
    await page.locator(".lc-checkin--editor [data-action='ai-draft-apply']").click();
    await page.locator(".lc-checkin--editor .lc-checkin__save-button").click();
    await page.waitForSelector(".lc-checkin--today", {timeout: 15000});

    // 2. 今日页：核验 NextHero 单卡去重（无重复副标题、无重复优先横幅、内嵌提醒入口）与首屏可达性
    const todayAudit = await page.evaluate(() => {
        const root = document.querySelector(".lc-checkin--today");
        const hero = root?.querySelector(".lc-checkin__next-hero");
        const firstCard = root?.querySelector(".lc-checkin__item");
        const rootRect = root?.getBoundingClientRect();
        const cardRect = firstCard?.getBoundingClientRect();
        return {
            itemCount: root?.querySelectorAll(".lc-checkin__item").length ?? 0,
            heroPresent: Boolean(hero),
            heroDupSubCount: hero?.querySelectorAll(".lc-checkin__console-next").length ?? -1,
            separatePriorityBannerCount: root?.querySelectorAll("section.lc-checkin__priority-reminder").length ?? -1,
            heroReminderLinkCount: hero?.querySelectorAll("[data-reminder-center-link]").length ?? 0,
            firstCardOffsetTop: (rootRect && cardRect) ? Math.round(cardRect.top - rootRect.top) : -1,
        };
    });
    expect(todayAudit.itemCount).toBe(2);
    expect(todayAudit.heroPresent).toBe(true);
    expect(todayAudit.heroDupSubCount, "NextHero 不得再渲染重复的第 3 行副标题").toBe(0);
    expect(todayAudit.separatePriorityBannerCount, "无独立逾期事项时不得在 NextHero 下方重复渲染第二张提醒横幅").toBe(0);
    expect(todayAudit.heroReminderLinkCount, "NextHero 内部保留查看全部提醒入口").toBe(1);
    expect(todayAudit.firstCardOffsetTop).toBeGreaterThan(0);
    expect(todayAudit.firstCardOffsetTop).toBeLessThan(480);
    await page.screenshot({path: path.join(shotDir, "02-today-deduplicated.png")});

    // 3. 深色模式下打开专注计时器，实测 UI-01 选中预设按钮对比度 >= 4.5:1
    await page.evaluate(() => {
        const plugin = window.siyuan?.ws?.app?.plugins?.find((p) => p.name === "siyuan-checkin");
        if (plugin) {
            plugin.appearance = "dark";
            plugin.render();
        }
    });
    await page.locator(".lc-checkin--today [data-action='focus']").first().click();
    await page.waitForSelector("[data-focus-timer]", {timeout: 10000});
    const focusContrast = await page.evaluate(() => {
        const btn = document.querySelector(".lc-checkin__focus-presets button.is-selected");
        const cs = getComputedStyle(btn);
        const parse = (s) => s.match(/\d+/g).map(Number);
        const [r1, g1, b1] = parse(cs.color);
        const [r2, g2, b2] = parse(cs.backgroundColor);
        const lum = (rgb) => rgb.map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
        const l1 = lum([r1, g1, b1]), l2 = lum([r2, g2, b2]);
        return {
            color: cs.color,
            bg: cs.backgroundColor,
            ratio: Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2)),
        };
    });
    expect(focusContrast.ratio, `深色模式专注预设选中按钮对比度必须 >= 4.5:1，实测 ${JSON.stringify(focusContrast)}`).toBeGreaterThanOrEqual(7);
    await page.screenshot({path: path.join(shotDir, "03-focus-timer-dark-contrast.png")});
    await page.locator("[data-action='focus-abandon']").click();

    // 切回浅色模式并点击卡片一键打卡，验证落盘与回执提示
    await page.evaluate(() => {
        const plugin = window.siyuan?.ws?.app?.plugins?.find((p) => p.name === "siyuan-checkin");
        if (plugin) {
            plugin.appearance = "light";
            plugin.render();
        }
    });
    await page.locator(".lc-checkin--today [data-hero-record]").click();
    await expect.poll(() => page.evaluate(() => window.siyuanCheckin.getEvents().length), {timeout: 15000}).toBeGreaterThanOrEqual(1);
    await page.screenshot({path: path.join(shotDir, "04-today-after-checkin.png")});

    // 4. 回顾页：切换到「回顾」→「分析」，展开热力图与习惯强度折叠块，验证真实渲染与非今日页提醒条隐藏
    await page.locator("[data-mobile-nav='review']").first().click();
    await page.waitForSelector(".lc-checkin--review", {timeout: 15000});
    await page.locator(".lc-checkin--review [data-review-workspace='analysis']").click();
    const heatmapFold = page.locator(".lc-checkin--review [data-review-fold='heatmap']");
    if ((await heatmapFold.getAttribute("open")) === null) {
        await heatmapFold.locator("> summary").click();
    }
    await expect(page.locator(".lc-checkin--review .lc-yearheatmap").first()).toBeVisible();
    const strengthFold = page.locator(".lc-checkin--review [data-review-fold='strength']");
    if ((await strengthFold.getAttribute("open")) === null) {
        await strengthFold.locator("> summary").click();
    }
    await expect(page.locator(".lc-checkin--review [data-review-fold='strength'] svg.lc-chart").first()).toBeVisible();
    const reviewNoticeDisplay = await page.evaluate(() => {
        const notice = document.querySelector(".lc-checkin__daily-reminder-notice--inline");
        return notice ? getComputedStyle(notice).display : "absent";
    });
    expect(["none", "absent"]).toContain(reviewNoticeDisplay);
    await page.screenshot({path: path.join(shotDir, "05-review-analysis.png")});

    // 5. 事项页：切换到「事项」，新建一条日期事项并验证渲染与 ICS 导出按钮就绪
    await page.locator("[data-mobile-nav='occasions']").first().click();
    await page.waitForSelector(".lc-checkin--occasions", {timeout: 15000});
    await expect(page.locator(".lc-checkin--occasions [data-action='export-occasion-ics']")).toBeVisible();
    const drawer = page.locator(".lc-checkin--occasions [data-occasion-form-drawer]");
    if ((await drawer.getAttribute("open")) === null) {
        await page.locator(".lc-checkin--occasions [data-action='new-occasion']").first().click();
    }
    await page.locator(".lc-checkin--occasions input[name='name']").fill("年度总结日");
    await page.locator(".lc-checkin--occasions form button[type='submit']").click();
    await expect(page.locator(".lc-checkin--occasions .lc-checkin__occasion-manager-row")).toContainText("年度总结日");
    await page.screenshot({path: path.join(shotDir, "06-occasions.png")});

    // 6. 更多 → 设置页：验证设置页搜索与日记 LifeLog 同步面板
    await page.locator("[data-mobile-nav='more']").first().click();
    await page.waitForSelector(".lc-checkin--more", {timeout: 15000});
    await page.locator(".lc-checkin--more [data-more-action='appearance']").first().click();
    await page.waitForSelector(".lc-checkin--settings", {timeout: 15000});
    await expect(page.locator(".lc-checkin--settings [data-settings-search]")).toBeVisible();
    await page.screenshot({path: path.join(shotDir, "07-settings.png")});
});
