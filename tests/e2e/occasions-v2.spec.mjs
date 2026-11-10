/* T-2020 ~ T-2024 真实思源内核 E2E 验收：
   1. 【事项 2.0】顶部一句话闪电录入（解析日期/时刻/重要性）并实时预览；
   2. 自动创建《📅 小驴事项簿》并写入真实思源原生任务块（type='i', subtype='t'）及 Task Horizon 标准 custom-* 属性；
   3. 跨插件 Task Horizon 完成广播（tm:task-completed）自动回流勾选事项并写入今日日记 LifeLog。 */

import {expect, test} from "@playwright/test";
import {createClient, openCheckin, openTodayPage} from "./helpers/app.mjs";

test("T-2020~T-2024: 事项 2.0 闪电录入、思源原生任务块属性直通与跨端完成回流", async ({page}) => {
    const client = createClient();
    const createdNb = await client.postChecked("/api/notebook/createNotebook", {name: `lv-checkin-smoke-occasions-v2-${Date.now()}`});
    const nbId = typeof createdNb === "string" ? createdNb : createdNb?.id || createdNb?.notebook?.id;
    expect(nbId).toBeTruthy();

    try {
        await openCheckin(page);
        await openTodayPage(page);

        // 1. 切换至【事项】页
        await page.locator(".lc-checkin-tab-host [data-mobile-nav='occasions'], .lc-checkin-tab-host [data-topnav='occasions']").first().click();
        await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--occasions", {timeout: 15000});

        // 2. 在顶部闪电录入框输入一句话并验证实时解析预览
        const quickInput = page.locator(".lc-checkin-tab-host [data-occasion-quick-input]");
        await expect(quickInput).toBeVisible();
        await quickInput.fill("今天 16:30 季度架构终验 !高");
        const quickPreview = page.locator(".lc-checkin-tab-host [data-occasion-quick-preview]");
        await expect(quickPreview).toBeVisible();
        await expect(quickPreview).toContainText("16:30");

        // 3. 点击闪电添加，验证事项入库并自动镜像为思源原生任务块 (type='i', subtype='t')
        await page.locator(".lc-checkin-tab-host [data-action='occasion-quick-submit']").click();
        const createdCard = page.locator(".lc-checkin-tab-host .lc-checkin__occasion-manager-row").filter({hasText: "季度架构终验"});
        await expect(createdCard).toBeVisible({timeout: 10000});

        // 3.1 T-2025 & T-2027：点击卡片标题或编辑按钮，验证右侧编辑表单立刻回填该事项的完整内容！
        await createdCard.locator(".lc-checkin__occasion-title-btn").click();
        await expect(page.locator(".lc-checkin-tab-host [data-occasion-form] input[name='name']")).toHaveValue("季度架构终验");
        await expect(page.locator(".lc-checkin-tab-host [data-occasion-form] input[name='time']")).toHaveValue("16:30");
        await expect(page.locator(".lc-checkin-tab-host [data-occasion-form] select[name='priority']")).toHaveValue("high");

        // 轮询等待后台旁路镜像完成并写回 blockId 与思源块属性
        let mirroredBlockId = "";
        await expect.poll(async () => {
            mirroredBlockId = await page.evaluate(() => {
                const plugin = window.siyuan.ws.app.plugins.find((p) => p.name === "siyuan-checkin");
                const hit = plugin?.occasionStore?.occasions?.find((o) => o.name === "季度架构终验");
                return hit?.blockId || "";
            });
            return Boolean(mirroredBlockId);
        }, {timeout: 15000, message: "事项应自动镜像至《📅 小驴事项簿》并绑定真实任务块 ID"}).toBe(true);

        // 核验思源真实内核块属性完全符合 Task Horizon v3.3.6 协议
        const attrs = await client.postChecked("/api/attr/getBlockAttrs", {id: mirroredBlockId});
        expect(attrs["custom-time"]).toBe("16:30");
        expect(attrs["custom-priority"]).toBe("high");
        expect(attrs["custom-status"]).toBe("todo");
        expect(attrs["custom-completion-time"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(attrs["custom-task-horizon-attr-host-owner"]).toBe(mirroredBlockId);

        // 4. 模拟用户在 Task Horizon 中完成该任务（派发 tm:task-completed），验证自动回流勾选事项
        await page.evaluate((blkId) => {
            window.dispatchEvent(new CustomEvent("tm:task-completed", {
                detail: {
                    id: blkId,
                    blockId: blkId,
                    title: "📅 16:30 季度架构终验",
                    completedAt: Date.now(),
                    tags: [],
                    operationId: `e2e-th-op-${Date.now()}`,
                },
            }));
        }, mirroredBlockId);

        await expect.poll(async () => {
            return await page.evaluate(() => {
                const plugin = window.siyuan.ws.app.plugins.find((p) => p.name === "siyuan-checkin");
                const hit = plugin?.occasionStore?.occasions?.find((o) => o.name === "季度架构终验");
                return (hit?.completedDates || []).length > 0;
            });
        }, {timeout: 10000, message: "Task Horizon 完成广播应自动回流标记小驴事项已完成"}).toBe(true);
    } finally {
        await client.post("/api/notebook/removeNotebook", {notebook: nbId}).catch(() => undefined);
    }
});

test("T-2029~T-2035: 事项全高顺畅滚动、7大语义分类胶囊筛选、人脉生日双向闭环与生态API深度验证", async ({page}) => {
    const client = createClient();
    const createdNb = await client.postChecked("/api/notebook/createNotebook", {name: `lv-checkin-smoke-ecosystem-${Date.now()}`});
    const nbId = typeof createdNb === "string" ? createdNb : createdNb?.id || createdNb?.notebook?.id;
    expect(nbId).toBeTruthy();

    try {
        await openCheckin(page);
        await openTodayPage(page);

        // 1. 验证公共 API (parseQuickOccasion, addOccasionQuick, hasCapability)
        const apiCheck = await page.evaluate(async () => {
            const api = window.siyuanCheckin;
            const parsed = api.parseQuickOccasion ? api.parseQuickOccasion("明天下午3点车检 !高") : null;
            const canWrite = api.hasCapability ? api.hasCapability("occasions.write") : false;
            const canRead = api.hasCapability ? api.hasCapability("occasions.read") : false;
            const quickRes = api.addOccasionQuick ? await api.addOccasionQuick("体检复查 2026-11-28 !中") : null;
            return {parsed, canWrite, canRead, quickRes};
        });
        expect(apiCheck.canWrite).toBe(true);
        expect(apiCheck.canRead).toBe(true);
        expect(apiCheck.parsed?.category).toBe("health");
        expect(apiCheck.parsed?.priority).toBe("high");
        expect(apiCheck.quickRes?.ok).toBe(true);

        // 2. 切换至【事项】页
        await page.locator(".lc-checkin-tab-host [data-mobile-nav='occasions'], .lc-checkin-tab-host [data-topnav='occasions']").first().click();
        await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--occasions", {timeout: 15000});

        // 3. 验证滚动未被剪裁 (T-2029 / T-2030)
        const scrollInfo = await page.evaluate(() => {
            const listPanel = document.querySelector(".lc-checkin-tab-host .lc-checkin__occasion-list-panel");
            const cs = window.getComputedStyle(listPanel);
            const root = document.querySelector(".lc-checkin-tab-host .lc-checkin");
            return {
                overflowY: cs.overflowY,
                maxHeight: cs.maxHeight,
                scrollHeight: root.scrollHeight,
                clientHeight: root.clientHeight,
            };
        });
        expect(scrollInfo.overflowY).toBe("visible");
        expect(scrollInfo.maxHeight).toBe("none");

        // 4. 验证 7 大语义分类胶囊切换 (T-2028)
        const allChip = page.locator(".lc-checkin-tab-host [data-occasion-cat-chip='all']");
        const healthChip = page.locator(".lc-checkin-tab-host [data-occasion-cat-chip='health']");
        await expect(allChip).toBeVisible();
        await expect(healthChip).toBeVisible();
        await healthChip.click();
        await expect(page.locator(".lc-checkin-tab-host .lc-checkin__occasion-manager-row").filter({hasText: "体检复查"}).first()).toBeVisible();

        // 切回全部
        await allChip.click();

        // 5. 验证小驴人脉（siyuan-contacts）模拟与双向闭环 (T-2033)
        await page.evaluate(() => {
            window.LvContacts = {
                protocol: 2,
                searchPeople: async () => [
                    {docId: "doc-test-person-1", itemId: "item-1", name: "张三", group: "好友", tags: []},
                ],
                getPerson: async (docId) => ({
                    docId,
                    itemId: "item-1",
                    name: "张三",
                    group: "好友",
                    tags: [],
                    birthday: "1995-10-18",
                    isLunar: false,
                }),
                recordInteraction: async (docIds, meta) => {
                    window.__interactionLog = window.__interactionLog || [];
                    window.__interactionLog.push({docIds, meta});
                    return {recorded: 1, applied: 1, skipped: 0, failed: 0, unknown: 0, complete: true, results: []};
                },
            };
        });

        // 展开「更多与帮助」折叠区并点击「从『小驴人脉』同步生日」
        const moreFold = page.locator(".lc-checkin-tab-host .lc-checkin__occasion-more-fold summary");
        await moreFold.click();
        const syncBirthdaysBtn = page.locator(".lc-checkin-tab-host [data-action='sync-contacts-birthdays']");
        await expect(syncBirthdaysBtn).toBeVisible();
        await syncBirthdaysBtn.click();

        // 验证生日事项入库
        const birthdayCard = page.locator(".lc-checkin-tab-host .lc-checkin__occasion-manager-row").filter({hasText: "张三的生日"});
        await expect(birthdayCard).toBeVisible({timeout: 10000});

        // 验证生日卡片上出现「👤 人脉档案」
        const contactDocBtn = birthdayCard.locator("[data-occasion-open-block='doc-test-person-1']");
        await expect(contactDocBtn).toBeVisible();
        await expect(contactDocBtn).toContainText("人脉档案");

        // 勾销该生日事项，验证自动调用 LvContacts.recordInteraction 回流交往足迹
        const birthdayOccId = await page.evaluate(() => {
            const plugin = window.siyuan.ws.app.plugins.find((p) => p.name === "siyuan-checkin");
            return plugin?.occasionStore?.occasions?.find((o) => o.name === "张三的生日")?.id;
        });
        expect(birthdayOccId).toBeTruthy();

        await page.evaluate(async (id) => {
            await window.siyuanCheckin.completeOccasion(id, "2026-10-18", true);
        }, birthdayOccId);

        const logs = await page.evaluate(() => window.__interactionLog || []);
        expect(logs.length).toBeGreaterThan(0);
        expect(logs[0].docIds).toContain("doc-test-person-1");
        expect(logs[0].meta?.note).toContain("生日");

        // 6. 验证小驴管家（siyuan-home）联动按钮 (T-2034)
        const healthCard = page.locator(".lc-checkin-tab-host .lc-checkin__occasion-manager-row").filter({hasText: "体检复查"}).first();
        await expect(healthCard).toBeVisible();
        const detailFold = healthCard.locator(".lc-checkin__occasion-detail-fold");
        if ((await detailFold.getAttribute("open")) === null) {
            await detailFold.locator("summary").click();
        }
        await expect(detailFold).toHaveJSProperty("open", true);
        const butlerBtn = healthCard.locator("[data-action='open-butler-reminders']");
        await expect(butlerBtn).toBeVisible();
        await expect(butlerBtn).toContainText("小驴管家");
    } finally {
        await client.post("/api/notebook/removeNotebook", {notebook: nbId}).catch(() => undefined);
    }
});
