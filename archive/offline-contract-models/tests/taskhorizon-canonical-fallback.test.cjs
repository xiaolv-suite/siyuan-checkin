const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/* T-1671 专项守门测试：
   Task Horizon Canonical Source 与过期 Fallback
   1. 连接状态判定与用户可解释说明（waiting / experimental-ready / fallback / incompatible）；
   2. 单一 Canonical Source 事实源互斥与冲突防护；
   3. 缓存 TTL 与基于事件驱动的即时失效判定；
   4. 卸载/断开连接时严禁幽灵缓存复活。 */

const projectRoot = path.resolve(__dirname, "..");
const featureTs = fs.readFileSync(path.join(projectRoot, "src", "features", "taskhorizon-cooperation.ts"), "utf8");
const compiled = ts.transpileModule(featureTs, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;
const moduleUnderTest = {exports: {}};
new Function("require", "module", "exports", compiled)(() => {}, moduleUnderTest, moduleUnderTest.exports);

const {
    evaluateTaskHorizonConnection,
    validateTaskHorizonCanonicalSource,
    isProjectionCacheStale,
    TASK_HORIZON_PROJECTION_TTL_MS,
} = moduleUnderTest.exports;

console.log("Starting taskhorizon-canonical-fallback tests...");

// 1. 连接状态与可解释性矩阵断言
{
    // 1.1 服务未运行或已断开
    const disconnected = evaluateTaskHorizonConnection({
        isApiPresent: false,
        isReady: false,
        hasCalendarCapability: false,
        hasEventsRecordCapability: false,
    });
    assert.equal(disconnected.state, "disconnected-fallback");
    assert.equal(disconnected.canRenderCalendarLayer, false);
    assert.ok(disconnected.userExplanation.includes("服务已断开"));

    // 1.2 插件已卸载
    const disposed = evaluateTaskHorizonConnection({
        isApiPresent: true,
        isDisposed: true,
        protocol: "siyuan-checkin",
        apiVersion: 5,
        isReady: true,
        hasCalendarCapability: true,
        hasEventsRecordCapability: true,
    });
    assert.equal(disposed.state, "disconnected-fallback");
    assert.equal(disposed.canRenderCalendarLayer, false);

    // 1.3 版本低于 5
    const oldVersion = evaluateTaskHorizonConnection({
        isApiPresent: true,
        protocol: "siyuan-checkin",
        apiVersion: 4,
        isReady: true,
        hasCalendarCapability: false,
        hasEventsRecordCapability: true,
    });
    assert.equal(oldVersion.state, "incompatible-version");
    assert.equal(oldVersion.canRenderCalendarLayer, false);

    // 1.4 等待就绪态 (waiting)
    const waiting = evaluateTaskHorizonConnection({
        isApiPresent: true,
        protocol: "siyuan-checkin",
        apiVersion: 5,
        isReady: false,
        hasCalendarCapability: true,
        hasEventsRecordCapability: true,
    });
    assert.equal(waiting.state, "waiting");
    assert.equal(waiting.canRenderCalendarLayer, false);
    assert.ok(waiting.userExplanation.includes("等待小驴打卡服务初始化就绪"));

    // 1.5 实验性就绪态 (experimental-ready)
    const ready = evaluateTaskHorizonConnection({
        isApiPresent: true,
        protocol: "siyuan-checkin",
        apiVersion: 5,
        isReady: true,
        hasCalendarCapability: true,
        hasEventsRecordCapability: true,
    });
    assert.equal(ready.state, "experimental-ready");
    assert.equal(ready.canRenderCalendarLayer, true);
    assert.equal(ready.canRecordTaskCompletion, true);
    assert.ok(ready.userExplanation.includes("实验性只读日历图层就绪"));
}

// 2. 单一 Canonical Source 事实源互斥校验断言
{
    // 2.1 无绑定状态允许任意通道
    assert.equal(validateTaskHorizonCanonicalSource("none", "record-checkbox-task").valid, true);
    assert.equal(validateTaskHorizonCanonicalSource("none", "sync-checkin-history").valid, true);

    // 2.2 普通任务回写项禁止被打卡循环覆盖
    const conflict1 = validateTaskHorizonCanonicalSource("checkbox-task", "sync-checkin-history");
    assert.equal(conflict1.valid, false);
    assert.ok(conflict1.conflictReason.includes("已绑定普通任务完成回写"));

    // 2.3 打卡循环同步项禁止接收普通任务勾选
    const conflict2 = validateTaskHorizonCanonicalSource("checkin-history", "record-checkbox-task");
    assert.equal(conflict2.valid, false);
    assert.ok(conflict2.conflictReason.includes("已绑定 Task Horizon 内部打卡循环"));

    // 2.4 同一通道正常放行
    assert.equal(validateTaskHorizonCanonicalSource("checkbox-task", "record-checkbox-task").valid, true);
    assert.equal(validateTaskHorizonCanonicalSource("checkin-history", "sync-checkin-history").valid, true);
}

// 3. 缓存 TTL 与事件驱动失效断言
{
    const baseTime = 1700000000000;
    const cacheMeta = {
        cachedAtMs: baseTime,
        versionSequence: 10,
        projectedRange: {startDate: "2026-10-01", endDateExclusive: "2026-10-29"},
    };

    // 3.1 2 分钟内且版本号一致：缓存有效
    assert.equal(isProjectionCacheStale(cacheMeta, baseTime + 120000, 10), false);

    // 3.2 超过 5 分钟 (300,000ms)：缓存超时失效
    assert.equal(isProjectionCacheStale(cacheMeta, baseTime + TASK_HORIZON_PROJECTION_TTL_MS + 1000, 10), true);

    // 3.3 版本号推进（数据更新广播）：缓存立即失效
    assert.equal(isProjectionCacheStale(cacheMeta, baseTime + 30000, 11), true);

    // 3.4 异常时间倒流：防御性失效
    assert.equal(isProjectionCacheStale(cacheMeta, baseTime - 5000, 10), true);
}

console.log("taskhorizon-canonical-fallback: all state transitions, canonical source and TTL invariants passed successfully.");
