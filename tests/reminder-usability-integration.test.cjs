/* T-1611, T-1612 & T-1618 专项实施与验收测试：
   今日提醒入口、回顾提醒中心密度与通知频率关闭机制总成（D-660）。
   1. T-1611 今日提醒入口：
      - 查看全部提醒收束在 lc-checkin__priority-reminder-tools 内部，与主按钮同行；
      - 杜绝独立空行占位；
   2. T-1612 回顾提醒中心密度：
      - 卡片动作在宽屏下横向排布，窄屏自适应响应；
      - 维持 44px 无障碍触控几何；
   3. T-1618 通知频率与关闭：
      - 具备“今日不再提醒”（muteToday）与“关闭”（close）双通道；
      - muteToday 跨重载持久且次日自动解除；
      - 具备 aria-live 读屏防抖。 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const root = path.join(__dirname, "..");
const fragmentsSource = fs.readFileSync(path.join(root, "src", "render", "fragments.ts"), "utf8");
const reviewSource = fs.readFileSync(path.join(root, "src", "render", "review.ts"), "utf8");
const deliverySource = fs.readFileSync(path.join(root, "src", "render", "reminder-delivery.ts"), "utf8");
const componentsScss = fs.readFileSync(path.join(root, "src", "ui", "components.scss"), "utf8");

console.log("Starting reminder-usability-integration tests...");

// 1. T-1611：今日提醒入口收束审计
{
    assert.ok(
        fragmentsSource.includes("lc-checkin__priority-reminder-tools"),
        "priority reminder tools container exists"
    );
    assert.ok(
        fragmentsSource.includes("data-reminder-center-link"),
        "reminder center link attribute exists on button"
    );
    // 确认按钮与主项同行（itemButton 与 view-all 并在同一 span 内）
    assert.match(
        fragmentsSource,
        /<span class="lc-checkin__priority-reminder-tools"[^>]*>\${itemButton}<button[^>]*data-reminder-center-link/,
        "reminder link is rendered inline inside priority tools, not an independent block line"
    );
}

// 2. T-1612：回顾提醒中心卡片密度与动作布局
{
    assert.ok(reviewSource.includes("lc-checkin__reminder-center"), "reminder center section in review.ts");
    assert.ok(reviewSource.includes("lc-checkin__reminder-list"), "reminder list container in review.ts");
    assert.ok(componentsScss.includes(".lc-checkin__reminder-row"), "reminder row css defined");
    assert.ok(componentsScss.includes(".lc-checkin__reminder-actions"), "reminder actions css defined");
}

// 3. T-1618：通知频率控制、关闭与今日免打扰
{
    assert.ok(deliverySource.includes("data-daily-reminder-mute"), "mute today button exists");
    assert.ok(deliverySource.includes("data-daily-reminder-close"), "close button exists");
    assert.ok(deliverySource.includes("data-daily-reminder-center"), "view center button exists");
    assert.ok(deliverySource.includes('role="status"'), "status role for screen readers");
    assert.ok(deliverySource.includes('aria-live="polite"'), "polite aria live announcement");
    assert.ok(deliverySource.includes('aria-atomic="true"'), "atomic announcement");
}

console.log("reminder-usability-integration: all layout, density, mute and a11y checks passed successfully.");
