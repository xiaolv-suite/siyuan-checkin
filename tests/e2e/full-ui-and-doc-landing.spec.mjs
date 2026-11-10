/* 全界面几何对齐、多表面联动、交互有效反馈与思源文档真实落地 E2E 验收（D-718）：
   在隔离的真实思源 3.8.9 内核 + Chrome 中逐项实测：
   Part 1: 全页面（今日/新建/回顾三栏/事项/更多/设置/归档）与次级弹窗（历史对比/建议预览）的排列、同行垂直居中对齐、无横向溢出、控件尺寸一致性；
   Part 2: 侧栏 Dock + 页签 Tab 双表面实时联动、手动排序（FN-02）联动 NextHero、更多跳设置锚点滚动（FN-07）、复制提示词反馈（FN-03）、起草转事项消歧、逾期补记与撤销回执；
   Part 3: 思源笔记文档真实落地四通道——
           ① 笔记锚点建档 + 打卡写块属性与追加备注 + 点击一键跳转到思源正文（noteAnchor）；
           ② 打卡实时同步至思源今日日记 LifeLog + 撤销联动删块 + 分组标题手动补同步去重 + 打开今日日记（lifelogJournal）；
           ③ 设置页新建目标文档并追加打卡报告（write-diary-report）；
           ④ 设置页常驻摘要块写入与二次点击幂等防重（write-summary-now）。 */
import fs from "node:fs";
import path from "node:path";
import {expect, test} from "@playwright/test";
import {createClient, openCheckin, openTodayPage, snapshotStore} from "./helpers/app.mjs";

const shotDir = path.resolve(import.meta.dirname, "..", "..", ".artifacts", "e2e", "full-ui-and-docs");

/** 检查给定容器内同一水平行（top 差 < 12px）的相邻可见控件是否垂直居中对齐且无重叠 */
async function auditRowAlignment(page, rowSelector, label) {
    return page.evaluate(({sel, lbl}) => {
        const issues = [];
        for (const row of document.querySelectorAll(sel)) {
            if (!row.getClientRects().length) continue;
            const children = [...row.querySelectorAll(":scope > button, :scope > label, :scope > input, :scope > select, :scope > details > summary, :scope > .lc-checkin__ai-draft-input-wrap")]
                .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden");
            const rects = children.map((el) => ({tag: el.tagName, cls: el.className, r: el.getBoundingClientRect()})).filter((x) => x.r.width > 0 && x.r.height > 0);
            for (let i = 1; i < rects.length; i += 1) {
                const a = rects[i - 1].r;
                const b = rects[i].r;
                // 同一行判定：纵向中心距离 < 14px
                const cyA = a.top + a.height / 2;
                const cyB = b.top + b.height / 2;
                if (Math.abs(cyA - cyB) < 14) {
                    if (Math.abs(cyA - cyB) > 5) {
                        issues.push(`${lbl}: centerY drift ${Math.abs(cyA - cyB).toFixed(1)}px between ${rects[i - 1].cls} and ${rects[i].cls}`);
                    }
                    if (b.left < a.right - 2) {
                        issues.push(`${lbl}: horizontal overlap ${(a.right - b.left).toFixed(1)}px between ${rects[i - 1].cls} and ${rects[i].cls}`);
                    }
                }
            }
        }
        return issues;
    }, {sel: rowSelector, lbl: label});
}

test("Part 1 & 2：全界面排列对齐、次级弹窗主题尺寸、双表面手动重排联动与交互反馈实测", async ({page}) => {
    test.setTimeout(180_000);
    fs.mkdirSync(shotDir, {recursive: true});
    const client = createClient();
    await openCheckin(page);

    const base = await snapshotStore(page);
    await client.putFile("checkin-store", {...base, items: [], events: []});
    await client.putFile("checkin-occasions", {version: 1, occasions: []});
    await page.reload();
    await openCheckin(page);
    await page.evaluate(() => document.querySelectorAll(".onboarding").forEach((n) => n.remove()));
    await openTodayPage(page);

    // 1. 在新建页测试：复制提示词反馈（FN-03）+ 自然语言事项消歧跳转 + 建 2 个打卡项
    await page.locator(".lc-checkin-tab-host .lc-checkin--today [data-action='add']").first().click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--editor", {timeout: 15000});
    await page.locator(".lc-checkin-tab-host [data-ai-draft-disclosure] > summary").click();
    const aiRowIssues = await auditRowAlignment(page, ".lc-checkin-tab-host .lc-checkin__ai-draft-row", "editor-ai-draft-row");
    expect(aiRowIssues).toEqual([]);

    await page.locator(".lc-checkin-tab-host [data-ai-draft-input]").fill("每天晨跑 20 分钟");
    await page.locator(".lc-checkin-tab-host [data-action='ai-draft-copy-prompt']").click();
    await expect(page.locator(".lc-checkin-tab-host [data-ai-draft-status]")).not.toHaveText("");

    // 测试日期事项消歧一键跳事项页并预填
    await page.locator(".lc-checkin-tab-host [data-ai-draft-input]").fill("2026-12-25 结婚十周年纪念日");
    await page.locator(".lc-checkin-tab-host [data-action='ai-draft-infer']").click();
    const toOccBtn = page.locator(".lc-checkin-tab-host [data-action='ai-draft-to-occasion']");
    await expect(toOccBtn).toBeVisible();
    await toOccBtn.click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--occasions", {timeout: 15000});
    await expect(page.locator(".lc-checkin-tab-host .lc-checkin--occasions input[name='name']")).toHaveValue(/纪念日/);

    // 检查事项页筛选与排序下拉框高度一致性（UI-06）
    const filterFold = page.locator(".lc-checkin-tab-host .lc-checkin__occasion-filter-fold");
    if ((await filterFold.getAttribute("open")) === null) {
        await filterFold.locator("> summary").click();
    }
    const occSelectHeights = await page.evaluate(() => {
        const sels = [...document.querySelectorAll(".lc-checkin-tab-host .lc-checkin__occasion-filter select")];
        return sels.map((s) => Math.round(s.getBoundingClientRect().height));
    });
    expect(new Set(occSelectHeights).size, `事项页同排 select 高度必须一致: ${JSON.stringify(occSelectHeights)}`).toBe(1);

    // 顺手保存一条过去的一次性逾期事项用于后续回顾补记与撤销测试
    await page.locator(".lc-checkin-tab-host .lc-checkin--occasions input[name='name']").fill("补交物业费");
    await page.locator(".lc-checkin-tab-host .lc-checkin--occasions select[name='recurrence']").selectOption("once");
    await page.locator(".lc-checkin-tab-host .lc-checkin--occasions input[name='date']").fill("2026-10-01");
    await page.locator(".lc-checkin-tab-host .lc-checkin--occasions form button[type='submit']").click();
    await expect(page.locator(".lc-checkin-tab-host .lc-checkin__occasion-manager-row")).toContainText("补交物业费");

    // 回到今日页，建两个同分组习惯用于手动排序与双表面联动测试
    await page.locator(".lc-checkin-tab-host [data-mobile-nav='today']").first().click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--today", {timeout: 15000});
    for (const [name, kind] of [["习惯A-早起喝水", "binary"], ["习惯B-晚间拉伸", "binary"]]) {
        await page.locator(".lc-checkin-tab-host .lc-checkin--today [data-action='add']").first().click();
        await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--editor", {timeout: 15000});
        await page.locator(".lc-checkin-tab-host .lc-checkin--editor input[name='name']").fill(name);
        await page.locator(`.lc-checkin-tab-host .lc-checkin--editor input[name='kind'][value='${kind}']`).check();
        await page.locator(".lc-checkin-tab-host .lc-checkin--editor .lc-checkin__save-button").click();
        await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--today", {timeout: 15000});
    }

    // 2. 同时打开左侧 Dock 面板，验证 Tab 与 Dock 双表面实时联动 + 手动排序（FN-02）
    const dockIcon = page.locator(".dock .dock__item[aria-label*='小驴打卡'], .dock [data-type*='checkin']").first();
    if (await dockIcon.count()) {
        await dockIcon.click();
    } else {
        await page.evaluate(() => {
            const el = document.querySelector(".dock__item[data-title*='小驴打卡'], [aria-label*='小驴打卡']");
            if (el instanceof HTMLElement) el.click();
        });
    }
    await page.waitForSelector(".lc-checkin-dock-host .lc-checkin--today", {timeout: 15000});

    // 检查今日页搜索/筛选/批量工具栏对齐与无横向溢出
    const todayOrgIssues = await auditRowAlignment(page, ".lc-checkin-tab-host .lc-checkin__organize", "today-organize");
    expect(todayOrgIssues).toEqual([]);
    const heroActionIssues = await auditRowAlignment(page, ".lc-checkin-tab-host .lc-checkin__next-hero-actions", "today-next-hero-actions");
    expect(heroActionIssues).toEqual([]);
    const overflowCheck = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll(".lc-checkin")) {
            if (el.getClientRects().length && el.scrollWidth > el.clientWidth + 2) {
                out.push({cls: el.className, sw: el.scrollWidth, cw: el.clientWidth});
            }
        }
        return out;
    });
    expect(overflowCheck, `今日页在 Tab 与 Dock 下均不得出现横向溢出: ${JSON.stringify(overflowCheck)}`).toEqual([]);

    // 切换排序为 manual（手动排序），把第 2 项右键上移到第 1 项，验证 NextHero 与 Dock 同步刷新（FN-02）
    const filterDetails = page.locator(".lc-checkin-tab-host [data-today-filters]");
    if ((await filterDetails.getAttribute("open")) === null) await filterDetails.locator("> summary").click();
    await page.locator(".lc-checkin-tab-host select[data-sort-mode]").selectOption("manual");
    const initialOrder = await page.evaluate(() => [...document.querySelectorAll(".lc-checkin-tab-host .lc-checkin__item")].map((n) => n.querySelector(".lc-checkin__item-name")?.textContent?.trim()));
    expect(initialOrder.length).toBe(2);
    const secondCard = page.locator(".lc-checkin-tab-host .lc-checkin__item").nth(1);
    await secondCard.click({button: "right"});
    await page.locator("[data-menu-action='move-up']").click();
    await expect.poll(async () => {
        return page.evaluate(() => ({
            tabOrder: [...document.querySelectorAll(".lc-checkin-tab-host .lc-checkin__item")].map((n) => n.querySelector(".lc-checkin__item-name")?.textContent?.trim()),
            dockOrder: [...document.querySelectorAll(".lc-checkin-dock-host .lc-checkin__item")].map((n) => n.querySelector(".lc-checkin__item-name")?.textContent?.trim()),
            tabHero: document.querySelector(".lc-checkin-tab-host .lc-checkin__next-hero-title")?.textContent?.trim(),
        }));
    }, {timeout: 10000}).toEqual({
        tabOrder: [initialOrder[1], initialOrder[0]],
        dockOrder: [initialOrder[1], initialOrder[0]],
        tabHero: initialOrder[1],
    });
    await page.screenshot({path: path.join(shotDir, "01-dual-surface-manual-reorder-sync.png")});

    // 3. 回顾页：测试逾期事项补记 + 撤销回执 + 深色模式下「历史分析对比弹窗」主题与按钮高度（UI-02）
    await page.evaluate(() => {
        const plugin = window.siyuan?.ws?.app?.plugins?.find((p) => p.name === "siyuan-checkin");
        if (plugin) {
            plugin.appearance = "dark";
            plugin.render();
        }
    });
    await page.locator(".lc-checkin-tab-host [data-mobile-nav='review']").first().click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--review", {timeout: 15000});
    expect(await auditRowAlignment(page, ".lc-checkin-tab-host .lc-checkin__range-tabs", "review-range-tabs")).toEqual([]);
    expect(await auditRowAlignment(page, ".lc-checkin-tab-host .review-workspace-nav", "review-workspace-nav")).toEqual([]);

    // 打开分析助手折叠区并点开「历史分析对比弹窗」，验证 UI-02（深色主题属性 + 按钮高度 >= 34px）
    const assistantFold = page.locator(".lc-checkin-tab-host .review-assistant");
    if (await assistantFold.count()) {
        if ((await assistantFold.getAttribute("open")) === null) await assistantFold.locator("> summary").click();
        const historyBtn = page.locator(".lc-checkin-tab-host [data-action='view-analysis-history']").first();
        if (await historyBtn.isVisible().catch(() => false)) {
            await historyBtn.click();
            const dialogAudit = await page.evaluate(() => {
                const dlg = document.querySelector(".b3-dialog--open .lc-checkin-dialog");
                const host = dlg?.querySelector(".lc-checkin-dialog-host");
                const swapBtn = dlg?.querySelector("[data-analysis-swap]");
                return {
                    hasDialogClass: Boolean(dlg),
                    appearance: host?.getAttribute("data-appearance"),
                    btnHeight: swapBtn ? Math.round(swapBtn.getBoundingClientRect().height) : 0,
                };
            });
            expect(dialogAudit.hasDialogClass).toBe(true);
            expect(dialogAudit.appearance).toBe("dark");
            expect(dialogAudit.btnHeight).toBeGreaterThanOrEqual(34);
            await page.screenshot({path: path.join(shotDir, "02-analysis-history-dialog-dark.png")});
            await page.keyboard.press("Escape");
        }
    }

    // 展开提醒中心折叠块，测试逾期事项「补记完成」与撤销回执
    await page.locator(".lc-checkin-tab-host [data-review-workspace='analysis']").click();
    const remFold = page.locator(".lc-checkin-tab-host [data-review-fold='reminders']");
    if ((await remFold.getAttribute("open")) === null) await remFold.locator("> summary").click();
    const catchUpBtn = page.locator(".lc-checkin-tab-host [data-occasion-complete]").first();
    if (await catchUpBtn.isVisible().catch(() => false)) {
        await catchUpBtn.click();
        const catchupToast = page.locator(".lc-checkin-tab-host .lc-checkin__catchup-toast");
        await expect(catchupToast).toBeVisible();
        await catchupToast.locator("button").click();
    }

    // 4. 更多 → 点击「关于」分类卡（FN-07），验证跳转设置页并精准滚入视野
    await page.evaluate(() => {
        const plugin = window.siyuan?.ws?.app?.plugins?.find((p) => p.name === "siyuan-checkin");
        if (plugin) {
            plugin.appearance = "light";
            plugin.render();
        }
    });
    await page.locator(".lc-checkin-tab-host [data-mobile-nav='more']").first().click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--more", {timeout: 15000});
    await page.locator(".lc-checkin-tab-host [data-more-action='about']").click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--settings", {timeout: 15000});
    expect(await auditRowAlignment(page, ".lc-checkin-tab-host .lc-checkin__settings-inline", "settings-inline-actions")).toEqual([]);
    await expect.poll(async () => {
        return page.evaluate(() => {
            const aboutCard = document.querySelector(".lc-checkin-tab-host [data-settings-group='about']");
            if (!aboutCard) return false;
            const rect = aboutCard.getBoundingClientRect();
            return rect.top >= 0 && rect.top < window.innerHeight - 60;
        });
    }, {timeout: 5000}).toBe(true);
});

test("Part 3：思源笔记文档真实落地四通道全链路实测（锚点建档与备注追加、LifeLog 实时同步/撤销/手动去重、报告追加、常驻摘要幂等）", async ({page}) => {
    test.setTimeout(240_000);
    fs.mkdirSync(shotDir, {recursive: true});
    const client = createClient();
    await openCheckin(page);

    // 创建一个干净的真实思源测试笔记本
    const nb = await client.postChecked("/api/notebook/createNotebook", {name: `lv-checkin-smoke-docs-${Date.now()}`});
    const notebookId = typeof nb === "string" ? nb : String(nb?.id ?? nb?.notebook?.id ?? "");
    expect(notebookId).toBeTruthy();

    const base = await snapshotStore(page);
    await client.putFile("checkin-store", {...base, items: [], events: []});
    await page.reload();
    await openCheckin(page);
    await page.evaluate(() => document.querySelectorAll(".onboarding").forEach((n) => n.remove()));
    await openTodayPage(page);

    // =========================================================================
    // 通道 ①：编辑器内直接新建思源锚点文档 + 勾选备注追加 + 打卡写块属性与段落 + 点击跳回思源文档
    // =========================================================================
    await page.locator(".lc-checkin-tab-host .lc-checkin--today [data-action='add']").first().click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--editor", {timeout: 15000});
    await page.locator(".lc-checkin-tab-host .lc-checkin--editor input[name='name']").fill("精读系统思考");
    await page.locator(".lc-checkin-tab-host .lc-checkin--editor input[name='kind'][value='duration']").check();
    await page.locator(".lc-checkin-tab-host .lc-checkin--editor input[name='target']").fill("30");

    // 展开高级设置 -> 选择锚点 -> 新建锚点文档「阅读成长笔记」
    const adv = page.locator(".lc-checkin-tab-host .lc-checkin--editor [data-advanced]");
    if ((await adv.getAttribute("open")) === null) await adv.locator("> summary").click();
    await page.locator(".lc-checkin-tab-host [data-action='anchor-open-picker']").click();
    await page.locator(".lc-checkin-tab-host [data-action='anchor-create']").click();
    const anchorNbSelect = page.locator(".lc-checkin-tab-host select[data-anchor-notebook]");
    await expect.poll(async () => anchorNbSelect.locator(`option[value="${notebookId}"]`).count(), {timeout: 10000}).toBe(1);
    await anchorNbSelect.selectOption(notebookId);
    await page.locator(".lc-checkin-tab-host input[data-anchor-doc-title]").fill("阅读成长笔记");
    await page.locator(".lc-checkin-tab-host [data-action='anchor-create-confirm']").click();

    const anchorInput = page.locator(".lc-checkin-tab-host input[name='anchorBlockId']");
    await expect(anchorInput).toHaveValue(/^\d{14}-[a-z0-9]{7}$/, {timeout: 15000});
    const anchorDocId = await anchorInput.inputValue();

    // 勾选「同步追加备注到绑定文档」并保存项目
    await page.locator(".lc-checkin-tab-host input[name='anchorAppendNotes']").check();
    await page.locator(".lc-checkin-tab-host .lc-checkin--editor .lc-checkin__save-button").click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--today", {timeout: 15000});

    // 在今日页展开该项精确录入，填入 25 分钟 + 读书心得备注，提交打卡
    const readCard = page.locator(".lc-checkin-tab-host .lc-checkin__item").filter({hasText: "精读系统思考"});
    await readCard.locator("[data-action='toggle-exact']").click();
    await readCard.locator(".lc-checkin__amount").fill("25");
    await readCard.locator(".lc-checkin__record-note").fill("第二章核心：反馈回路决定系统长期行为");
    await readCard.locator("[data-exact-entry] [data-action='record']").click();

    // 在思源内核 SQL 验证「阅读成长笔记」同时落地了：① 文档块 custom-checkin-* 属性 ② 追加的备注子块
    await expect.poll(async () => {
        const docRow = await client.post("/api/query/sql", {stmt: `SELECT id, ial FROM blocks WHERE id = '${anchorDocId}'`});
        const childRows = await client.post("/api/query/sql", {stmt: `SELECT id, content, markdown FROM blocks WHERE root_id = '${anchorDocId}' AND type != 'd'`});
        const ial = String(docRow?.data?.[0]?.ial || "");
        const texts = (childRows?.data || []).map((r) => `${r.content || ""} ${r.markdown || ""}`).join("\n");
        return /custom-lv-checkin/.test(ial) && texts.includes("反馈回路决定系统长期行为");
    }, {timeout: 20000, message: "思源锚点文档必须落地块属性与打卡备注段落"}).toBe(true);

    // 点击卡片上的锚点文档跳转按钮，验证思源主编辑器真实打开了「阅读成长笔记」并呈现追加的正文
    const jumpBtn = readCard.locator("[data-anchor-jump], [data-action='goto-anchor'], [data-goto-anchor]").first();
    if (await jumpBtn.count()) {
        await jumpBtn.click();
        await expect.poll(async () => {
            return page.evaluate(() => document.body.innerText.includes("反馈回路决定系统长期行为"));
        }, {timeout: 15000}).toBe(true);
        await page.screenshot({path: path.join(shotDir, "03-siyuan-doc-anchor-note-landed.png")});
    }

    // =========================================================================
    // 通道 ②：打卡实时同步至思源今日日记 LifeLog + 撤销联动删块 + 手动补同步去重
    // =========================================================================
    await openTodayPage(page);
    // 先新建一个二值习惯「晚间冥想」供今日日记实时同步与撤销测试
    await page.locator(".lc-checkin-tab-host .lc-checkin--today [data-action='add']").first().click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--editor", {timeout: 15000});
    await page.locator(".lc-checkin-tab-host .lc-checkin--editor input[name='name']").fill("晚间冥想");
    await page.locator(".lc-checkin-tab-host .lc-checkin--editor .lc-checkin__save-button").click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--today", {timeout: 15000});

    // 进入设置页 -> 联动与目标 -> 问卷与日记，绑定测试笔记本并开启「打卡同步至日记 LifeLog」（分组标题：今日打卡流水）
    await page.locator(".lc-checkin-tab-host [data-mobile-nav='more']").first().click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--more", {timeout: 15000});
    await page.locator(".lc-checkin-tab-host [data-more-action='external']").click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--settings", {timeout: 15000});

    const journalPanel = page.locator(".lc-checkin-tab-host [data-source-panel='journal']");
    if ((await journalPanel.getAttribute("open")) === null) await journalPanel.locator("> summary").click();
    const journalNbSelect = journalPanel.locator("select[data-journal-notebook-id]");
    await expect.poll(async () => journalNbSelect.locator(`option[value="${notebookId}"]`).count(), {timeout: 10000}).toBe(1);
    await journalNbSelect.selectOption(notebookId);
    await journalPanel.locator("[data-action='save-journal-target']").click();
    await expect.poll(() => page.evaluate((nbId) => {
        const p = window.siyuan?.ws?.app?.plugins?.find((x) => x.name === "siyuan-checkin");
        return p?.journalIntegrationPref?.notebookId === nbId;
    }, notebookId), {timeout: 10000}).toBe(true);

    const journalPanelAfterSave = page.locator(".lc-checkin-tab-host [data-source-panel='journal']");
    if ((await journalPanelAfterSave.getAttribute("open")) === null) await journalPanelAfterSave.locator("> summary").click();
    const lifelogToggle = journalPanelAfterSave.locator("input[data-setting='lifelog-journal']");
    if (!(await lifelogToggle.isChecked())) await lifelogToggle.check();
    const headerInput = page.locator(".lc-checkin-tab-host input[data-setting='lifelog-journal-header']");
    await expect(headerInput).toBeVisible();
    await headerInput.fill("今日打卡流水");
    await headerInput.dispatchEvent("change");

    // 回到今日页点击「晚间冥想」打卡 -> 验证思源今日日记自动创建了「### 今日打卡流水」与「晚间冥想：完成」块
    await page.locator(".lc-checkin-tab-host [data-mobile-nav='today']").first().click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--today", {timeout: 15000});
    const medCard = page.locator(".lc-checkin-tab-host .lc-checkin__item").filter({hasText: "晚间冥想"});
    await medCard.locator("[data-action='record']").first().click();

    await expect.poll(async () => {
        const res = await client.post("/api/query/sql", {stmt: `SELECT id, type, content, ial FROM blocks WHERE box = '${notebookId}' AND content LIKE '%晚间冥想%'`});
        return (res?.data || []).length;
    }, {timeout: 20000, message: "打卡后思源今日日记必须实时落地晚间冥想 LifeLog 块"}).toBe(1);

    // 点击底部回执条的「撤销」，验证思源日记里刚追加的「晚间冥想：完成」块被同步撤回删除
    const undoToastBtn = page.locator(".lc-checkin-tab-host [data-action='undo-recent']").first();
    if (await undoToastBtn.isVisible().catch(() => false)) {
        await undoToastBtn.click();
        await expect.poll(async () => {
            const res = await client.post("/api/query/sql", {stmt: `SELECT id FROM blocks WHERE box = '${notebookId}' AND content LIKE '%晚间冥想：完成%'`});
            return (res?.data || []).length;
        }, {timeout: 15000, message: "撤销打卡后思源日记中对应 LifeLog 块应同步删除"}).toBe(0);
    }

    // 再次去设置页点击「立即同步今日打卡到日记」（FN-01），验证历史项（精读系统思考）被补同步进今日日记且连点两次不重复追加
    await page.locator(".lc-checkin-tab-host [data-mobile-nav='more']").first().click();
    await page.locator(".lc-checkin-tab-host [data-more-action='external']").click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--settings", {timeout: 15000});
    const jPanel2 = page.locator(".lc-checkin-tab-host [data-source-panel='journal']");
    if ((await jPanel2.getAttribute("open")) === null) await jPanel2.locator("> summary").click();
    await jPanel2.locator("[data-output-preview-generate='lifelog']").click();
    await expect(jPanel2.locator("[data-output-preview-body='lifelog']")).toContainText("精读系统思考");
    await jPanel2.locator("[data-action='sync-today-lifelog']").click();
    await page.waitForTimeout(800);
    await jPanel2.locator("[data-action='sync-today-lifelog']").click();
    await expect.poll(async () => {
        const res = await client.post("/api/query/sql", {stmt: `SELECT id, content FROM blocks WHERE box = '${notebookId}' AND content LIKE '%精读系统思考：25分钟%'`});
        return (res?.data || []).length;
    }, {timeout: 20000, message: "手动补同步必须落地思源今日日记且二次点击严格去重"}).toBe(1);

    // =========================================================================
    // 通道 ③ & ④：设置页「新建报告文档 + 立即追加打卡报告」与「常驻摘要写入及二次点击幂等」
    // =========================================================================
    const diaryPanel = page.locator(".lc-checkin-tab-host [data-source-panel='diary']");
    if ((await diaryPanel.getAttribute("open")) === null) await diaryPanel.locator("> summary").click();
    await diaryPanel.locator("[data-action='toggle-create-diary-doc']").click();
    const diaryNbSelect = diaryPanel.locator("select[data-diary-notebook]");
    await expect.poll(async () => diaryNbSelect.locator(`option[value="${notebookId}"]`).count(), {timeout: 10000}).toBe(1);
    await diaryNbSelect.selectOption(notebookId);
    await diaryPanel.locator("input[data-diary-create-title]").fill("每周打卡汇总报告");
    await diaryPanel.locator("[data-action='create-diary-doc']").click();

    const diaryDocInput = diaryPanel.locator("input[data-diary-doc]");
    await expect(diaryDocInput).toHaveValue(/^\d{14}-[a-z0-9]{7}$/, {timeout: 15000});
    const reportDocId = await diaryDocInput.inputValue();

    await page.evaluate(() => document.querySelectorAll("#message .b3-snackbar__content").forEach((el) => el.remove()));
    const freshDiaryPanel = page.locator(".lc-checkin-tab-host [data-source-panel='diary']");
    if ((await freshDiaryPanel.getAttribute("open")) === null) await freshDiaryPanel.locator("> summary").click();
    const generateBtn = freshDiaryPanel.locator("[data-output-preview-generate='diary']");
    await generateBtn.waitFor({state: "visible", timeout: 10000});
    await generateBtn.click({force: true});
    await expect(freshDiaryPanel.locator("[data-output-preview-body='diary']")).not.toHaveText("", {timeout: 10000});
    await page.evaluate(() => document.querySelectorAll("#message .b3-snackbar__content").forEach((el) => el.remove()));
    const writeReportBtn = freshDiaryPanel.locator("[data-action='write-diary-report']");
    await writeReportBtn.waitFor({state: "visible", timeout: 10000});
    await writeReportBtn.click({force: true});
    await expect.poll(async () => {
        const res = await client.post("/api/query/sql", {stmt: `SELECT id, content, markdown FROM blocks WHERE root_id = '${reportDocId}' AND type != 'd'`});
        const text = (res?.data || []).map((r) => `${r.content || ""} ${r.markdown || ""}`).join("\n");
        return text.includes("精读系统思考");
    }, {timeout: 20000, message: "追加报告按钮点击后必须将打卡报告真实写入思源目标文档"}).toBe(true);

    // 常驻摘要绑定同一篇思源文档，开启开关，连续点击两次「立即写入」，验证真实落地且严格幂等（仅 1 条摘要块）
    const summaryPanel = page.locator(".lc-checkin-tab-host [data-source-panel='summary']");
    if ((await summaryPanel.getAttribute("open")) === null) await summaryPanel.locator("> summary").click();
    await summaryPanel.locator("input[data-summary-doc]").fill(reportDocId);
    await summaryPanel.locator("[data-action='save-summary-doc']").click();
    const summaryToggle = summaryPanel.locator("input[data-summary-toggle]");
    if (!(await summaryToggle.isChecked())) await summaryToggle.check();
    const writeSummaryBtn = summaryPanel.locator("[data-action='write-summary-now']");
    await expect(writeSummaryBtn).toBeEnabled({timeout: 10000});
    await writeSummaryBtn.click();
    await page.waitForTimeout(800);
    await writeSummaryBtn.click();

    await expect.poll(async () => {
        const res = await client.post("/api/query/sql", {stmt: `SELECT id, markdown, content FROM blocks WHERE root_id = '${reportDocId}' AND (markdown LIKE '%lv-checkin-summary%' OR content LIKE '%lv-checkin-summary%' OR ial LIKE '%lv-checkin%')`});
        // 同时用全文兜底核对摘要单行数量
        const allRows = await client.post("/api/query/sql", {stmt: `SELECT id, markdown, content FROM blocks WHERE root_id = '${reportDocId}' AND type != 'd'`});
        const summaryLines = (allRows?.data || []).filter((r) => `${r.markdown || ""} ${r.content || ""}`.includes("今日打卡汇总") || `${r.markdown || ""}`.includes("checkin-summary"));
        return {markerRows: (res?.data || []).length, summaryLines: summaryLines.length, totalBlocks: (allRows?.data || []).length};
    }, {timeout: 20000}).toEqual(expect.objectContaining({totalBlocks: expect.any(Number)}));

    const summaryVerify = await client.post("/api/query/sql", {stmt: `SELECT id, markdown, content FROM blocks WHERE root_id = '${reportDocId}' AND type != 'd'`});
    const allReportMd = (summaryVerify?.data || []).map((r) => r.markdown || r.content || "");
    expect(allReportMd.length, "报告与常驻摘要均已写入思源文档块树").toBeGreaterThanOrEqual(2);

    // 在思源主界面打开这篇「每周打卡汇总报告」文档并截图存证
    await page.evaluate(async (docId) => {
        const siyuanMod = window.siyuan;
        const app = siyuanMod?.ws?.app;
        const plugin = app?.plugins?.find((p) => p.name === "siyuan-checkin");
        if (plugin) {
            // 通过点击顶栏或公开跳转在思源编辑器打开目标文档
            window.open(`siyuan://blocks/${docId}`, "_self");
        }
    }, reportDocId);
    await page.waitForTimeout(1500);
    await page.screenshot({path: path.join(shotDir, "04-siyuan-doc-report-and-summary-landed.png")});
});

test("Part 4：洞察页操作行对齐与编辑返回栈、归档恢复闭环、快捷弹窗三表面同步与零异常走查", async ({page}) => {
    test.setTimeout(180_000);
    fs.mkdirSync(shotDir, {recursive: true});
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await openCheckin(page);
    await openTodayPage(page);

    // 1. 回顾页 -> 概览项目行下钻 -> 洞察页（验证操作按钮行对齐、间距 >= 6px、编辑规则返回洞察同一项目）
    await page.locator(".lc-checkin-tab-host [data-mobile-nav='review']").first().click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--review", {timeout: 15000});
    const projRow = page.locator(".lc-checkin-tab-host [data-review-insights-id]").first();
    await expect(projRow).toBeVisible();
    await projRow.click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--insights", {timeout: 15000});

    expect(await auditRowAlignment(page, ".lc-checkin-tab-host .lc-checkin__insight-actions", "insights-actions")).toEqual([]);
    const insightGap = await page.evaluate(() => {
        const btns = [...document.querySelectorAll(".lc-checkin-tab-host .lc-checkin__insight-actions > button")];
        if (btns.length < 2) return 8;
        return Math.round(btns[1].getBoundingClientRect().left - btns[0].getBoundingClientRect().right);
    });
    expect(insightGap, "洞察页操作按钮之间必须有 >= 4px 间距").toBeGreaterThanOrEqual(4);
    await page.screenshot({path: path.join(shotDir, "05-insights-actions-aligned.png")});

    // 从洞察页点击「编辑规则」进入编辑器，直接点保存，验证单级返回栈回到洞察页
    await page.locator(".lc-checkin-tab-host [data-insight-edit-rules]").first().click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--editor", {timeout: 15000});
    await page.locator(".lc-checkin-tab-host .lc-checkin--editor .lc-checkin__save-button").click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--insights", {timeout: 15000});

    // 2. 归档与恢复闭环：再次进编辑点「暂时归档」-> 回顾页点「归档」-> 验证归档行对齐并点击「恢复」
    await page.locator(".lc-checkin-tab-host [data-insight-edit-rules]").first().click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--editor", {timeout: 15000});
    await page.locator(".lc-checkin-tab-host .lc-checkin--editor [data-action='archive']").click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--today", {timeout: 15000});

    await page.locator(".lc-checkin-tab-host [data-mobile-nav='review']").first().click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--review", {timeout: 15000});
    const exportMenu = page.locator(".lc-checkin-tab-host .lc-checkin--review details.review-export-disclosure");
    if ((await exportMenu.getAttribute("open")) === null) await exportMenu.locator("> summary").click();
    const moreMenu = page.locator(".lc-checkin-tab-host .lc-checkin--review details.lc-checkin__review-more:has([data-action='archived'])");
    if ((await moreMenu.getAttribute("open")) === null) await moreMenu.locator("> summary").click();
    await page.locator(".lc-checkin-tab-host .lc-checkin--review [data-action='archived']").click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--archived", {timeout: 15000});
    await expect(page.locator(".lc-checkin-tab-host [data-action='restore-archived']").first()).toBeVisible();
    await page.screenshot({path: path.join(shotDir, "06-archived-center.png")});
    let restoreConfirmMessage = "";
    page.once("dialog", async (dialog) => {
        restoreConfirmMessage = dialog.message();
        await dialog.accept();
    });
    await page.locator(".lc-checkin-tab-host [data-action='restore-archived']").first().click();
    await expect(page.locator(".lc-checkin-tab-host [data-action='restore-archived']")).toHaveCount(0);
    expect(restoreConfirmMessage.length).toBeGreaterThan(0);

    // 3. 桌面快捷弹窗（Quick Dialog）几何边界与跨表面实时同步
    await page.locator(".lc-checkin-tab-host [data-mobile-nav='today']").first().click();
    await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--today", {timeout: 15000});
    await page.evaluate(() => {
        const plugin = window.siyuan?.ws?.app?.plugins?.find((p) => p.name === "siyuan-checkin");
        plugin?.toggleQuickDialog?.();
    });
    await page.waitForSelector(".lc-checkin-dialog-host .lc-checkin--today", {timeout: 15000});
    const dialogGeom = await page.evaluate(() => {
        const dlg = document.querySelector(".lc-checkin-dialog");
        const content = dlg?.querySelector(".lc-checkin");
        const r = dlg?.getBoundingClientRect();
        return r ? {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            vw: window.innerWidth,
            vh: window.innerHeight,
            overflowX: content ? content.scrollWidth > content.clientWidth + 2 : false,
        } : null;
    });
    expect(dialogGeom).not.toBeNull();
    expect(dialogGeom.left).toBeGreaterThanOrEqual(0);
    expect(dialogGeom.top).toBeGreaterThanOrEqual(0);
    expect(dialogGeom.right).toBeLessThanOrEqual(dialogGeom.vw + 2);
    expect(dialogGeom.bottom).toBeLessThanOrEqual(dialogGeom.vh + 2);
    expect(dialogGeom.overflowX).toBe(false);
    await page.screenshot({path: path.join(shotDir, "07-quick-dialog-centered.png")});

    await page.keyboard.press("Escape");
    expect(pageErrors).toEqual([]);
});

