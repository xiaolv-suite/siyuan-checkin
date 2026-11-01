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
        await expect(page.locator(".lc-checkin-tab-host .lc-checkin__occasion-manager-row").filter({hasText: "季度架构终验"})).toBeVisible({timeout: 10000});

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
