// @ts-check
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

console.log("Starting task-horizon-integration tests...");

const root = path.join(__dirname, "..");
const srcIndex = fs.readFileSync(path.join(root, "src", "index.ts"), "utf8");
const bridgeKit = fs.readFileSync(path.join(root, "src", "ecosystem-bridge-kit.ts"), "utf8");

// 1. 检查 ecosystem-bridge-kit.ts 是否包含 Task Horizon 类型与辅助监听器
assert.ok(
    bridgeKit.includes("onTaskHorizonCompleted"),
    "ecosystem-bridge-kit.ts must export onTaskHorizonCompleted helper"
);
assert.ok(
    bridgeKit.includes("TASK_COMPLETED: \"tm:task-completed\""),
    "ecosystem-bridge-kit.ts must define TASK_COMPLETED event"
);
assert.ok(
    bridgeKit.includes("TaskHorizonCompletedEventDetail"),
    "ecosystem-bridge-kit.ts must export TaskHorizonCompletedEventDetail interface"
);

// 2. 检查 index.ts 中生命周期接入与注销
assert.ok(
    srcIndex.includes("this.bindTaskHorizonConsumer()"),
    "index.ts must invoke bindTaskHorizonConsumer in onload"
);
assert.ok(
    srcIndex.includes("this.taskHorizonUnsubscribe?.()"),
    "index.ts must clean up taskHorizonUnsubscribe in onunload"
);
assert.ok(
    srcIndex.includes("private bindTaskHorizonConsumer()"),
    "index.ts must define bindTaskHorizonConsumer method"
);

// 3. 检查匹配与入账防重逻辑
assert.ok(
    srcIndex.includes("task-horizon:"),
    "bindTaskHorizonConsumer must format externalRef with task-horizon prefix"
);
assert.ok(
    srcIndex.includes("this.recordEventsBatch("),
    "bindTaskHorizonConsumer must dispatch to recordEventsBatch"
);

console.log("✓ Task Horizon 联动消费侧契约断言全部通过！");
