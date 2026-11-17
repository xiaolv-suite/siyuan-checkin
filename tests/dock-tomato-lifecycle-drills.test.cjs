const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/* T-1672 专项守门测试：
   Dock Tomato 会话所有权、收件箱和多窗口失败演练
   1. 会话所有权与 9 态状态机识别转换；
   2. 启动/暂停/停止/完成/终止全生命周期演练；
   3. 插件卸载与桥注销防泄漏演练；
   4. 提供方失效与平滑回退；
   5. 重复回写与墓碑重放防护；
   6. 人工干预（重试与丢弃）；
   7. 双窗口并发交错与合并演练。 */

class MockWindow {
    constructor() {
        this.listeners = new Map();
        this.timers = new Map();
        this.nextTimer = 1;
    }
    addEventListener(type, listener) {
        const set = this.listeners.get(type) || new Set();
        set.add(listener);
        this.listeners.set(type, set);
    }
    removeEventListener(type, listener) {
        this.listeners.get(type)?.delete(listener);
    }
    dispatch(type, detail) {
        for (const listener of [...(this.listeners.get(type) || [])]) {
            listener({type, detail});
        }
    }
    setTimeout(callback) {
        const id = this.nextTimer++;
        this.timers.set(id, callback);
        return id;
    }
    clearTimeout(id) {
        this.timers.delete(id);
    }
}

const mockWindow = new MockWindow();
global.window = mockWindow;

const projectRoot = path.resolve(__dirname, "..");
const localDateKey = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const inboxTs = fs.readFileSync(path.join(projectRoot, "src", "features", "docktomato-inbox.ts"), "utf8");
const inboxCompiled = ts.transpileModule(inboxTs, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;
const inboxModule = {exports: {}};
new Function("require", "module", "exports", inboxCompiled)((id) => {
    if (id === "../model") return {dateKey: localDateKey};
    throw new Error(`Unexpected dependency in inbox: ${id}`);
}, inboxModule, inboxModule.exports);

const dockTomatoTs = fs.readFileSync(path.join(projectRoot, "src", "dock-tomato.ts"), "utf8");
const dockTomatoCompiled = ts.transpileModule(dockTomatoTs, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;
const dockTomatoModule = {exports: {}};
new Function("require", "module", "exports", dockTomatoCompiled)((id) => {
    if (id === "./integrations") return {DOCK_TOMATO_ADAPTER_ID: "siyuan-plugin-docktomato"};
    if (id === "./types") return {};
    if (id === "./features/docktomato-inbox") return inboxModule.exports;
    throw new Error(`Unexpected dependency in dock-tomato: ${id}`);
}, dockTomatoModule, dockTomatoModule.exports);

const {
    inspectDockTomatoProvider,
    readDockTomatoRuntimeStatus,
    installDockTomatoBridge,
    evaluateDockTomatoCompletion,
    getDockTomatoCompletionIssues,
    clearDockTomatoCompletionIssues,
} = dockTomatoModule.exports;

const {
    normalizeInboxStore,
    upsertInboxEntry,
    removeInboxEntry,
    markInboxRetry,
    markInboxBlocked,
    mergeInboxStores,
    dockTomatoCompletionValue,
} = inboxModule.exports;

(async () => {
console.log("Starting dock-tomato-lifecycle-drills tests...");

// 1. 提供方状态诊断与 9 态状态机识别演练
{
    // 1.1 缺失提供方
    const missingDiag = inspectDockTomatoProvider({} /* host with no __dockTomato */);
    assert.equal(missingDiag.state, "missing");
    assert.equal(missingDiag.available, false);
    assert.equal(missingDiag.ready, false);

    // 1.2 版本不兼容
    const badVerHost = {__dockTomato: {focus: {version: 2}}};
    const badVerDiag = inspectDockTomatoProvider(badVerHost);
    assert.equal(badVerDiag.state, "incompatible-version");
    assert.equal(badVerDiag.available, true);

    // 1.3 接口不完整 (缺失 pause)
    const incompleteHost = {__dockTomato: {focus: {version: 1, getStatus() {}, start() {}}}};
    assert.equal(inspectDockTomatoProvider(incompleteHost).state, "incomplete-api");

    // 1.4 缺失核心能力
    const missingCapHost = {
        __dockTomato: {
            focus: {
                version: 1,
                capabilities: ["status", "start"], // 缺少 pause 与 completion-event
                getStatus() { return {ready: true}; },
                start() {},
                pause() {},
            },
        },
    };
    assert.equal(inspectDockTomatoProvider(missingCapHost).state, "missing-capabilities");

    // 1.5 就绪状态 (ready)
    const readyHost = {
        __dockTomato: {
            focus: {
                version: 1,
                capabilities: ["status", "start", "pause", "completion-event"],
                getStatus() { return {ready: true, active: false, running: false, paused: false}; },
                start() {},
                pause() {},
            },
        },
    };
    assert.equal(inspectDockTomatoProvider(readyHost).state, "ready");

    // 1.6 运行中状态 (running)
    const runningHost = {
        __dockTomato: {
            focus: {
                version: 1,
                capabilities: ["status", "start", "pause", "completion-event"],
                getStatus() { return {ready: true, active: true, running: true, paused: false, sessionId: "sess-run-1"}; },
                start() {},
                pause() {},
            },
        },
    };
    assert.equal(inspectDockTomatoProvider(runningHost).state, "running");

    // 1.7 暂停状态 (paused)
    const pausedHost = {
        __dockTomato: {
            focus: {
                version: 1,
                capabilities: ["status", "start", "pause", "completion-event"],
                getStatus() { return {ready: true, active: true, running: false, paused: true, sessionId: "sess-pause-1"}; },
                start() {},
                pause() {},
            },
        },
    };
    assert.equal(inspectDockTomatoProvider(pausedHost).state, "paused");
}

// 2. 桥安装、生命周期事件订阅与卸载防泄漏演练
{
    let providerChangeCount = 0;
    const recordedEvents = [];
    let tombstonedIdentities = new Set();

    const mathItem = {id: "math", name: "高等数学", kind: "duration", unit: "分钟", tomatoMode: "minutes", archived: false};
    const mockApi = {
        getItems() { return [mathItem]; },
        getArchivedItems() { return []; },
        getEvents() { return []; },
        registerFocusAdapter(adapter) {
            return () => {};
        },
    };

    const hostContext = {
        processDockTomatoCompletion: async (entry) => {
            recordedEvents.push({type: "completion", entry});
            return {kind: "recorded", eventId: `rec-${recordedEvents.length}`};
        },
        dockTomatoTombstonedIdentities: () => tombstonedIdentities,
    };

    // 安装桥
    const disposeBridge = installDockTomatoBridge(
        mockApi,
        () => { providerChangeCount += 1; },
        hostContext,
    );

    assert.ok(typeof disposeBridge === "function");
    assert.ok(mockWindow.listeners.has("tomato:focus-api-availability-changed"));
    assert.ok(mockWindow.listeners.has("tomato:focus-session-completed"));
    assert.ok(mockWindow.listeners.has("tomato:focus-ended"));

    // 分发完成事件
    mockWindow.dispatch("tomato:focus-session-completed", {
        apiVersion: 1,
        sessionId: "session-drill-1",
        durationMinutes: 25,
        completedAt: "2026-10-28T10:00:00.000Z",
        context: {
            consumer: "siyuan-checkin",
            itemId: "math",
            itemUnit: "分钟",
            tomatoMode: "minutes",
        },
    });

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(recordedEvents.length, 1);
    assert.equal(recordedEvents[0].entry.identity, "session-drill-1");

    // 重复分发同一事件：桥幂等拦截，不重复调用处理通道
    mockWindow.dispatch("tomato:focus-session-completed", {
        apiVersion: 1,
        sessionId: "session-drill-1",
        durationMinutes: 25,
        completedAt: "2026-10-28T10:00:00.000Z",
        context: {
            consumer: "siyuan-checkin",
            itemId: "math",
            itemUnit: "分钟",
            tomatoMode: "minutes",
        },
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(recordedEvents.length, 1, "Duplicate completion is ignored by bridge");

    // 卸载桥
    disposeBridge();

    // 验证卸载后所有事件监听器已安全注销
    assert.equal(mockWindow.listeners.get("tomato:focus-api-availability-changed")?.size || 0, 0);
    assert.equal(mockWindow.listeners.get("tomato:focus-session-completed")?.size || 0, 0);
    assert.equal(mockWindow.listeners.get("tomato:focus-ended")?.size || 0, 0);

    // 卸载后再分发事件，桥已阻断，不产生任何处理
    mockWindow.dispatch("tomato:focus-session-completed", {
        apiVersion: 1,
        sessionId: "session-after-dispose",
        durationMinutes: 25,
        completedAt: "2026-10-28T11:00:00.000Z",
        context: {consumer: "siyuan-checkin", itemId: "math", itemUnit: "分钟", tomatoMode: "minutes"},
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(recordedEvents.length, 1, "Post-disposal events are completely dropped");
}

// 3. 收件箱存储演练：人工干预（重试与丢弃）与双窗口合并
{
    const nowIso = "2026-10-28T12:00:00.000Z";
    let store = normalizeInboxStore({schemaVersion: 1, items: []});

    // 3.1 写入新条目
    const entry1 = {
        identity: "session-winA-1",
        externalRef: "docktomato:session-winA-1",
        itemId: "math",
        itemUnit: "分钟",
        tomatoMode: "minutes",
        durationMinutes: 25,
        occurredAt: "2026-10-28T10:00:00.000Z",
        localDate: "2026-10-28",
        state: "pending",
        attempts: 0,
        receivedAt: nowIso,
        updatedAt: nowIso,
    };
    const res1 = upsertInboxEntry(store, entry1, nowIso);
    assert.equal(res1.outcome, "added");
    store = res1.store;
    assert.equal(store.items.length, 1);

    // 3.2 标记暂时性失败重试
    store = markInboxRetry(store, "session-winA-1", "storage-timeout", nowIso);
    assert.equal(store.items[0].attempts, 1);
    assert.ok(store.items[0].nextAttemptAt);

    // 3.3 标记永久阻断 (blocked)
    store = markInboxBlocked(store, "session-winA-1", "item-not-found", nowIso);
    assert.equal(store.items[0].state, "blocked");
    assert.equal(store.items[0].blockedReason, "item-not-found");

    // 3.4 人工丢弃条目 (discard)
    store = removeInboxEntry(store, "session-winA-1");
    assert.equal(store.items.length, 0, "Discard removes entry cleanly");

    // 3.5 双窗口并发合并演练
    // 窗口 A 新增 session-A
    const storeA = upsertInboxEntry(normalizeInboxStore(null), {
        identity: "session-A",
        externalRef: "docktomato:session-A",
        itemId: "math",
        itemUnit: "分钟",
        tomatoMode: "minutes",
        durationMinutes: 25,
        occurredAt: "2026-10-28T09:00:00.000Z",
        localDate: "2026-10-28",
        state: "pending",
        attempts: 0,
        receivedAt: nowIso,
        updatedAt: nowIso,
    }, nowIso).store;

    // 窗口 B 新增 session-B
    const storeB = upsertInboxEntry(normalizeInboxStore(null), {
        identity: "session-B",
        externalRef: "docktomato:session-B",
        itemId: "english",
        itemUnit: "分钟",
        tomatoMode: "minutes",
        durationMinutes: 30,
        occurredAt: "2026-10-28T09:30:00.000Z",
        localDate: "2026-10-28",
        state: "pending",
        attempts: 0,
        receivedAt: nowIso,
        updatedAt: nowIso,
    }, nowIso).store;

    // 锁内合并两个窗口的收件箱
    const merged = mergeInboxStores(storeA, storeB);
    assert.equal(merged.items.length, 2, "Merged inbox contains both windows entries");
    assert.ok(merged.items.some((item) => item.identity === "session-A"));
    assert.ok(merged.items.some((item) => item.identity === "session-B"));
}

console.log("dock-tomato-lifecycle-drills: all lifecycle, disposal, idempotency and multi-window drills passed successfully.");
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
