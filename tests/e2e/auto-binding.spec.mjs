/* T-1995 傻瓜式联动守门：零配置下首个联动事件自动「找到或创建 → 绑定 → 启用」。
   覆盖：思阅（事件驱动）；显式停用（itemId 仍在）不被自动重启。 */
import {expect, test} from "@playwright/test";
import {createClient, openCheckin} from "./helpers/app.mjs";

test("T-1995: 零配置时首个思阅事件自动创建并关联项目", async ({page}) => {
    const client = createClient();
    await openCheckin(page);
    // 清空初始项目并重置思阅配置为「从未绑定」态
    const base = await snapshotStoreFor(page);
    await client.putFile("checkin-store", {...base, items: [], events: []});
    await page.evaluate(() => {
        const plugin = window.siyuan.ws.app.plugins.find((p) => p.name === "siyuan-checkin");
        plugin.sireaderIntegration = {enabled: false, itemId: "", thresholdMinutes: 30};
    });
    await page.reload();
    await openCheckin(page);
    await page.evaluate(() => {
        const plugin = window.siyuan.ws.app.plugins.find((p) => p.name === "siyuan-checkin");
        plugin.sireaderIntegration = {enabled: false, itemId: "", thresholdMinutes: 30};
    });

    // 首个思阅生命周期事件到达（无需任何手动配置）
    await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("reader:open", {detail: {bookUrl: "siyuan://books/demo"}}));
    });
    await expect.poll(async () => page.evaluate(() => {
        const plugin = window.siyuan.ws.app.plugins.find((p) => p.name === "siyuan-checkin");
        return Boolean(plugin.sireaderIntegration.itemId && plugin.sireaderIntegration.enabled);
    }), {timeout: 15000, message: "首个思阅事件必须自动绑定并启用联动"}).toBe(true);

    const state = await page.evaluate(() => {
        const plugin = window.siyuan.ws.app.plugins.find((p) => p.name === "siyuan-checkin");
        const item = plugin.store.items.find((entry) => entry.id === plugin.sireaderIntegration.itemId);
        return {itemName: item?.name || "", itemCount: plugin.store.items.length};
    });
    expect(state.itemName.length).toBeGreaterThan(0);
    expect(state.itemCount).toBeGreaterThanOrEqual(1);
});

test("T-1995: 显式停用（itemId 仍在）不被自动重启", async ({page}) => {
    await openCheckin(page);
    await page.evaluate(() => {
        const plugin = window.siyuan.ws.app.plugins.find((p) => p.name === "siyuan-checkin");
        plugin.sireaderIntegration = {enabled: false, itemId: "protected-item", thresholdMinutes: 30};
    });
    await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("reader:open", {detail: {bookUrl: "siyuan://books/demo"}}));
    });
    await page.waitForTimeout(600);
    const state = await page.evaluate(() => {
        const plugin = window.siyuan.ws.app.plugins.find((p) => p.name === "siyuan-checkin");
        return {enabled: plugin.sireaderIntegration.enabled, itemId: plugin.sireaderIntegration.itemId};
    });
    expect(state.enabled).toBe(false);
    expect(state.itemId).toBe("protected-item");
});

async function snapshotStoreFor(page) {
    return page.evaluate(() => JSON.parse(JSON.stringify(window.siyuanCheckin.getStore())));
}
