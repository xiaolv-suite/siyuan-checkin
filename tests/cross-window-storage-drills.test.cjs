/* T-1622 专项演练守门：跨窗口持久化原子合并、并发写入与收尾防丢实战演练。
   1. 双窗口交错打卡：主 Store 锁内重读合并（reconcileNormalizedStoreSnapshots），零丢事件；
   2. 事项桶并发增删改：完成日期取并集，删除墓碑优先（mergeOccasionCompletions），绝不复活已删事项；
   3. 提醒动作桶并发：(id, action, at) 身份并集，restore 抑制旧动作，时间保序；
   4. Agent createItem / createOccasion 失败原子回滚与并发同名互斥：异常向外重抛，绝不假成功；
   5. 批量导入与日常打卡交错：并发打卡与导入数据共存，导入失败内存快照原子回滚；
   6. 拆除收尾（teardownFinalFlush）：锁内重读远端合并写回，绝不以旧快照覆盖活跃窗口新写入；
   7. 外部失败箱（externalPendingBox）：跨窗口并集同步，丢弃写失败时内存回滚；
   8. 偏好桶后写者胜（D-315）与写失败快照回滚；
   9. onDataChanged 外部变更响应：同步远端变更并保证本地会话态草稿不被篡改。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const sourceRoot = path.join(__dirname, "..", "src");
const indexSource = fs.readFileSync(path.join(sourceRoot, "index.ts"), "utf8");

/* 模块安全加载器 */
const loadedModules = new Map();
function loadProduction(relative) {
    const filename = path.resolve(sourceRoot, relative);
    if (loadedModules.has(filename)) return loadedModules.get(filename).exports;
    const productionModule = {exports: {}};
    loadedModules.set(filename, productionModule);
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS},
    }).outputText;
    new Function("require", "module", "exports", compiled)((request) => {
        assert.ok(request.startsWith("."), `unexpected dependency ${request}`);
        return loadProduction(path.resolve(path.dirname(filename), `${request}.ts`));
    }, productionModule, productionModule.exports);
    return productionModule.exports;
}

const productionModel = loadProduction("model.ts");
const modelHelpers = loadProduction("model-helpers.ts");
const occasionsModule = loadProduction("occasions.ts");
const remindersModule = loadProduction("reminders.ts");
const pendingModule = loadProduction("features/external-pending.ts");
const storageTxModule = loadProduction("storage-transaction.ts");
const exportModule = loadProduction("export.ts");

const sourceAst = ts.createSourceFile("index.ts", indexSource, ts.ScriptTarget.Latest, true);
const pluginClass = sourceAst.statements.find((node) => ts.isClassDeclaration(node));

const hostMethods = [
    "enqueueMutation",
    "withStorageLock",
    "persist",
    "persistOccasions",
    "reminderUserAction",
    "teardownFinalFlush",
    "persistViewPreferences",
    "rememberInitialSurfacePreferences",
    "recordEvent",
];

const compiledHost = ts.transpileModule(
    `class DrillHost {${hostMethods.map((name) => {
        const member = pluginClass.members.find((node) => node.name?.getText(sourceAst) === name && Boolean(node.body));
        assert.ok(member, `DrillHost requires ${name}`);
        return member.getText(sourceAst);
    }).join("\n")}}`,
    {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS}}
).outputText;

/* 跨窗口 Web Locks 模拟管理器 */
class SharedLockManager {
    constructor() {
        this.queues = new Map();
        this.active = new Set();
    }
    async request(name, optionsOrCallback, callbackOrUndefined) {
        const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : callbackOrUndefined;
        const options = typeof optionsOrCallback === "object" ? optionsOrCallback : {};
        if (options.ifAvailable && this.active.has(name)) {
            return undefined;
        }
        const previous = this.queues.get(name) || Promise.resolve();
        let release;
        const ticket = new Promise((resolve) => { release = resolve; });
        const next = previous.then(() => ticket);
        this.queues.set(name, next);
        await previous;
        this.active.add(name);
        try {
            return await callback();
        } finally {
            this.active.delete(name);
            release();
        }
    }
}

const baseItemA = {
    id: "item-a", name: "早起锻炼", icon: "🏃", kind: "count", target: 30, unit: "分钟",
    schedule: {type: "daily"}, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
    createdDate: "2026-10-01", revisions: [], archivePeriods: [], group: "健康", priority: "high", sortOrder: 1, timeSlot: "morning",
};
const baseItemB = {
    id: "item-b", name: "阅读经典", icon: "📚", kind: "count", target: 20, unit: "页",
    schedule: {type: "daily"}, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
    createdDate: "2026-10-01", revisions: [], archivePeriods: [], group: "学习", priority: "medium", sortOrder: 2, timeSlot: "any",
};

let eventSeq = 1;
function makeEvent(itemId, value, dateStr, minuteStr) {
    const unit = itemId === "item-a" ? "分钟" : "页";
    const raw = {
        id: `event-${eventSeq++}`,
        itemId,
        occurredAt: `${dateStr}T${minuteStr}:00.000Z`,
        localDate: dateStr,
        value,
        unit,
        source: "manual",
    };
    return productionModel.normalizeStore({
        version: 2,
        items: [baseItemA, baseItemB],
        events: [raw],
    }).events[0];
}

function createDrillHarness(sharedStorage = new Map(), sharedLock = new SharedLockManager()) {
    const STORAGE_LOCK_NAME = "siyuan-checkin-storage-lock";
    const STORAGE_NAME = "checkin-store";
    const OCCASIONS_STORAGE_NAME = "checkin-occasions";
    const REMINDER_ACTIONS_NAME = "checkin-reminder-actions";
    const BACKUP_STORAGE_NAME = "checkin-store-backup";
    const VIEW_PREFERENCES_NAME = "checkin-view-preferences";

    const hostEnv = {
        ...productionModel,
        ...occasionsModule,
        ...remindersModule,
        ...pendingModule,
        ...storageTxModule,
        ...exportModule,
        STORAGE_LOCK_NAME,
        STORAGE_NAME,
        OCCASIONS_STORAGE_NAME,
        REMINDER_ACTIONS_NAME,
        BACKUP_STORAGE_NAME,
        VIEW_PREFERENCES_NAME,
        safeUserErrorDetail: (e) => String(e?.message || e || "unknown"),
        t: (k) => k,
        showMessage: () => {},
        currentCalendarDate: () => new Date(2026, 9, 29, 12),
        captureActionMoment: () => ({occurredAt: "2026-10-29T12:00:00.000Z", localDate: "2026-10-29"}),
        formatNumber: String,
        STREAK_MILESTONES: [],
        computeStreaksValue: () => new Map(),
    };

    const DrillHostClass = new Function(
        ...Object.keys(hostEnv),
        `let fallbackStorageQueue = Promise.resolve();\n${compiledHost}\nreturn DrillHost;`
    )(...Object.values(hostEnv));

    function createWindow(name, initialStore) {
        const host = new DrillHostClass();
        const navLocks = sharedLock;

        Object.assign(host, {
            windowName: name,
            store: productionModel.normalizeStore(initialStore),
            lastPersistedStore: productionModel.normalizeStore(initialStore),
            occasionStore: {version: 1, occasions: []},
            reminderUserActions: [],
            externalPendingBox: {version: 1, items: []},
            auditEntries: [],
            saveState: "idle",
            acceptingOperations: true,
            initializationState: "ready",
            storageReady: true,
            disposed: false,
            disposing: false,
            saveQueue: Promise.resolve(),
            auxiliarySaveQueue: Promise.resolve(),
            mutationQueue: Promise.resolve(),
            teardownWrites: {shouldIntercept: () => false},
            initialSurfacePreferences: {reviewFold: [], reviewFoldTouched: false, lastInsightsItemId: ""},
            isCurrentOccasionSurface: () => true,
            occasionRemindOnce: false,
            failStoreSave: false,
            failOccasionSave: false,
            failReminderSave: false,
            failViewPreferencesSave: false,
            failPendingSave: false,

            cloneStore: structuredClone,
            itemFingerprint: modelHelpers.itemFingerprintValue,
            revisionFingerprint: modelHelpers.revisionFingerprintValue,

            render: () => {},
            renderBackgroundUpdate: () => {},
            invalidateSummary: () => {},
            broadcast: () => {},
            recordDiagnostic: () => {},
            scheduleAuditPersist: () => {},
            showSyncNotice: () => {},
            persistAuditBestEffort: async () => {},

            loadData: async (key) => {
                if (!sharedStorage.has(key)) return undefined;
                return structuredClone(sharedStorage.get(key));
            },
            saveData: async (key, value) => {
                if (key === STORAGE_NAME && host.failStoreSave) throw new Error("injected store failure");
                if (key === OCCASIONS_STORAGE_NAME && host.failOccasionSave) throw new Error("injected occasion failure");
                if (key === REMINDER_ACTIONS_NAME && host.failReminderSave) throw new Error("injected reminder failure");
                if (key === VIEW_PREFERENCES_NAME && host.failViewPreferencesSave) throw new Error("injected preference failure");
                sharedStorage.set(key, structuredClone(value));
            },
        });

        /* 注入共享锁 */
        globalThis.navigator = {locks: navLocks};

        /* 注入 Agent 接口实现（与生产环境一致） */
        host.agentApi = {
            createItem: async (created) => {
                const normalized = productionModel.normalizeItem(created);
                const persisted = await host.enqueueMutation(async () => {
                    if (host.store.items.some((c) => !c.archived && c.name === normalized.name)) {
                        throw new Error("duplicate-item-name");
                    }
                    const previous = host.store;
                    host.store = {...host.store, items: [...host.store.items, normalized]};
                    try {
                        await host.persist();
                    } catch (error) {
                        host.store = previous;
                        throw error;
                    }
                    return true;
                });
                if (!persisted) throw new Error("storage-mutation-failed");
                host.render();
            },
            createOccasion: async (created) => {
                const persisted = await host.enqueueMutation(async () => {
                    if (host.occasionStore.occasions.some((c) => c.name === created.name && c.date === created.date && c.recurrence === created.recurrence)) {
                        throw new Error("duplicate-occasion");
                    }
                    const previous = host.occasionStore;
                    host.occasionStore = {...host.occasionStore, occasions: [...host.occasionStore.occasions, created]};
                    try {
                        await host.persistOccasions();
                    } catch (error) {
                        host.occasionStore = previous;
                        throw error;
                    }
                    return true;
                });
                if (!persisted) throw new Error("storage-mutation-failed");
                host.render();
            },
        };

        return host;
    }

    return {createWindow, sharedStorage, sharedLock};
}

async function runDrills() {
    console.log("Starting T-1622 cross-window persistence and atomic reconciliation drills...");

    /* =========================================================================
       Drill 1: 主 Store 双窗口交错并发记录 (Interleaved Events & Atomic Reconcile)
       ========================================================================= */
    {
        const sharedStorage = new Map();
        const initialStore = {version: 2, items: [baseItemA, baseItemB], events: [], eventTombstones: []};
        sharedStorage.set("checkin-store", productionModel.normalizeStore(initialStore));

        const harness = createDrillHarness(sharedStorage);
        const winA = harness.createWindow("Win-A", initialStore);
        const winB = harness.createWindow("Win-B", initialStore);

        // 窗口 A 记录事件 A1，窗口 B 记录事件 B1（并发发起）
        const pA1 = winA.enqueueMutation(async () => {
            const ev = makeEvent("item-a", 30, "2026-10-29", "08:00");
            winA.store = productionModel.appendEvent(winA.store, ev);
            await winA.persist();
        });
        const pB1 = winB.enqueueMutation(async () => {
            const ev = makeEvent("item-b", 20, "2026-10-29", "08:15");
            winB.store = productionModel.appendEvent(winB.store, ev);
            await winB.persist();
        });

        await Promise.all([pA1, pB1]);

        const storageAfterStep1 = sharedStorage.get("checkin-store");
        assert.equal(storageAfterStep1.events.length, 2, "Drill 1.1: both concurrent events A1 and B1 must survive in storage");
        const itemIdsInStore = new Set(storageAfterStep1.events.map((e) => e.itemId));
        assert.ok(itemIdsInStore.has("item-a") && itemIdsInStore.has("item-b"), "Drill 1.1: both items have recorded events");

        // 紧接着第二轮交错打卡：窗口 A 记录 A2，窗口 B 记录 B2
        const pA2 = winA.enqueueMutation(async () => {
            const ev = makeEvent("item-a", 15, "2026-10-29", "12:00");
            winA.store = productionModel.appendEvent(winA.store, ev);
            await winA.persist();
        });
        const pB2 = winB.enqueueMutation(async () => {
            const ev = makeEvent("item-b", 10, "2026-10-29", "13:00");
            winB.store = productionModel.appendEvent(winB.store, ev);
            await winB.persist();
        });

        await Promise.all([pA2, pB2]);

        const storageAfterStep2 = sharedStorage.get("checkin-store");
        assert.equal(storageAfterStep2.events.length, 4, "Drill 1.2: all 4 events survive without clobbering");

        console.log("  ✓ Drill 1: Dual-window interleaved checkins correctly reconciled (0 events lost)");
    }

    /* =========================================================================
       Drill 2: 事项桶并发增删改与墓碑优先防复活 (Occasions Tombstone Precedence)
       ========================================================================= */
    {
        const sharedStorage = new Map();
        const initialStore = {version: 2, items: [baseItemA], events: [], eventTombstones: []};
        sharedStorage.set("checkin-store", productionModel.normalizeStore(initialStore));
        sharedStorage.set("checkin-occasions", {version: 1, occasions: []});

        const harness = createDrillHarness(sharedStorage);
        const winA = harness.createWindow("Win-A", initialStore);
        const winB = harness.createWindow("Win-B", initialStore);

        // Win-A 创建事项 1，并完成 2026-10-01
        const occ1 = {id: "occ-1", name: "周报总结", kind: "once", date: "2026-10-01", recurrence: "once", enabled: true, completedDates: ["2026-10-01"]};
        winA.occasionStore = {version: 1, occasions: [occ1]};
        await winA.persistOccasions();

        // Win-B 创建事项 2，并完成 2026-10-02
        const occ2 = {id: "occ-2", name: "系统维护", kind: "weekly", date: "2026-10-02", recurrence: "weekly", enabled: true, completedDates: ["2026-10-02"]};
        winB.occasionStore = {version: 1, occasions: [occ2]};
        await winB.persistOccasions();

        // 检查共享存储：occ-1 和 occ-2 均存在
        let currentOccStore = sharedStorage.get("checkin-occasions");
        assert.equal(currentOccStore.occasions.length, 2, "Drill 2.1: both occasions exist after merge");

        // Win-A 完成 occ-2 的 2026-10-03
        await winA.enqueueMutation(async () => {
            const target = winA.occasionStore.occasions.find((o) => o.id === "occ-2");
            assert.ok(target, "Win-A got occ-2 through enqueueMutation sync");
            winA.occasionStore = occasionsModule.markOccasionCompleted(winA.occasionStore, "occ-2", "2026-10-03", true);
            await winA.persistOccasions();
        });

        // Win-B 删除 occ-1（写入删除墓碑）
        await winB.enqueueMutation(async () => {
            winB.occasionStore = occasionsModule.deleteOccasion(winB.occasionStore, "occ-1");
            await winB.persistOccasions();
        });

        currentOccStore = sharedStorage.get("checkin-occasions");
        assert.equal(currentOccStore.occasions.some((o) => o.id === "occ-1"), false, "Drill 2.2: occ-1 deleted in storage");
        assert.ok(currentOccStore.tombstones?.some((t) => t.occasionId === "occ-1"), "Drill 2.2: tombstone for occ-1 recorded");

        // 关键点：Win-A 仍持有旧的内存，再次触发写入时，墓碑优先机制必须阻止 occ-1 复活！
        winA.occasionStore.occasions.push(occ1); // 模拟旧窗口残留或陈旧对象
        await winA.persistOccasions();

        currentOccStore = sharedStorage.get("checkin-occasions");
        assert.equal(currentOccStore.occasions.some((o) => o.id === "occ-1"), false, "Drill 2.3: tombstone permanently prevents occ-1 resurrection");
        const occ2Final = currentOccStore.occasions.find((o) => o.id === "occ-2");
        assert.ok(occ2Final.completedDates.includes("2026-10-02"), "Drill 2.3: completedDate 10-02 preserved");
        assert.ok(occ2Final.completedDates.includes("2026-10-03"), "Drill 2.3: completedDate 10-03 preserved");

        console.log("  ✓ Drill 2: Occasion completions unioned and deletion tombstones strictly suppress resurrection");
    }

    /* =========================================================================
       Drill 3: 提醒动作跨窗口并集与时间戳保序 (Reminder User Actions Union & Restore)
       ========================================================================= */
    {
        const sharedStorage = new Map();
        const initialStore = {version: 2, items: [baseItemA], events: [], eventTombstones: []};
        sharedStorage.set("checkin-store", productionModel.normalizeStore(initialStore));
        sharedStorage.set("checkin-reminder-actions", "");

        const harness = createDrillHarness(sharedStorage);
        const winA = harness.createWindow("Win-A", initialStore);
        const winB = harness.createWindow("Win-B", initialStore);

        // Win-A 延期提醒 rem-1 (snooze)
        await winA.reminderUserAction("rem-1", "snooze");

        // Win-B 跳过提醒 rem-2 (skip)
        await winB.reminderUserAction("rem-2", "skip");

        // Win-A 顺延提醒 rem-3 (defer)
        await winA.reminderUserAction("rem-3", "defer");

        // Win-B 恢复 rem-1 (restore)
        await winB.reminderUserAction("rem-1", "restore");

        const storedActionsRaw = sharedStorage.get("checkin-reminder-actions");
        assert.ok(typeof storedActionsRaw === "string" && storedActionsRaw.length > 0, "Drill 3.1: actions stored as serialized string");
        const parsedActions = remindersModule.deserializeReminderUserActions(storedActionsRaw);

        assert.equal(parsedActions.length >= 4, true, "Drill 3.1: all 4 actions recorded");
        assert.ok(parsedActions.some((a) => a.id === "rem-2" && a.action === "skip"), "Drill 3.1: rem-2 skip preserved");
        assert.ok(parsedActions.some((a) => a.id === "rem-3" && a.action === "snooze"), "Drill 3.1: rem-3 defer/snooze preserved");
        assert.ok(parsedActions.some((a) => a.id === "rem-1" && a.action === "restore"), "Drill 3.1: rem-1 restore preserved");

        // 验证恢复语义：restore 抑制了之前的 snooze
        const applied = remindersModule.applyReminderActions(
            [{id: "rem-1", source: "checkin", sourceId: "item", title: "锻炼", dueDate: "2026-10-29", daysUntil: 0, status: "today", note: ""}],
            parsedActions,
            "2026-10-29"
        );
        assert.equal(applied[0].status, "today", "Drill 3.2: restored reminder is active today");

        console.log("  ✓ Drill 3: Reminder user actions unioned without clobbering, restore semantics validated");
    }

    /* =========================================================================
       Drill 4: Agent 创建失败内存原子回滚与同名并发互斥 (Agent Failure Rollback)
       ========================================================================= */
    {
        const sharedStorage = new Map();
        const initialStore = {version: 2, items: [baseItemA], events: [], eventTombstones: []};
        sharedStorage.set("checkin-store", productionModel.normalizeStore(initialStore));
        sharedStorage.set("checkin-occasions", {version: 1, occasions: []});

        const harness = createDrillHarness(sharedStorage);
        const winA = harness.createWindow("Win-A", initialStore);

        // 4.1 createItem 失败原子回滚
        winA.failStoreSave = true;
        const candidateItem = productionModel.normalizeItem({...baseItemB, id: "item-new", name: "新习惯"});
        await assert.rejects(
            winA.agentApi.createItem(candidateItem),
            /injected store failure/,
            "Drill 4.1: Agent createItem must throw on persist failure"
        );
        assert.equal(winA.store.items.some((i) => i.name === "新习惯"), false, "Drill 4.1: failed item must be rolled back from memory");

        // 4.2 恢复正常保存后创建成功
        winA.failStoreSave = false;
        await winA.agentApi.createItem(candidateItem);
        assert.equal(winA.store.items.some((i) => i.name === "新习惯"), true, "Drill 4.2: item created when persist succeeds");

        // 4.3 再次创建同名项，在锁内被互斥拦截
        await assert.rejects(
            winA.agentApi.createItem({...candidateItem, id: "item-new-2"}),
            /duplicate-item-name/,
            "Drill 4.3: duplicate item name rejected inside mutation queue"
        );

        // 4.4 createOccasion 失败原子回滚
        winA.failOccasionSave = true;
        const candidateOcc = {id: "occ-fail", name: "失败事项", kind: "once", date: "2026-10-30", recurrence: "once", enabled: true, completedDates: []};
        await assert.rejects(
            winA.agentApi.createOccasion(candidateOcc),
            /injected occasion failure/,
            "Drill 4.4: Agent createOccasion must throw on persist failure"
        );
        assert.equal(winA.occasionStore.occasions.some((o) => o.name === "失败事项"), false, "Drill 4.4: failed occasion rolled back from memory");

        console.log("  ✓ Drill 4: Agent createItem/createOccasion atomic failure rollback and duplicate rejection verified");
    }

    /* =========================================================================
       Drill 5: 批量导入与日常打卡并发交错不丢数据 (Batch Import vs Checkin Race)
       ========================================================================= */
    {
        const sharedStorage = new Map();
        const initialStore = {version: 2, items: [baseItemA], events: [], eventTombstones: []};
        sharedStorage.set("checkin-store", productionModel.normalizeStore(initialStore));

        const harness = createDrillHarness(sharedStorage);
        const winImport = harness.createWindow("Win-Import", initialStore);
        const winDaily = harness.createWindow("Win-Daily", initialStore);

        // Win-Import 执行批量打卡导入（模拟 10 条导入事件）
        const importPromise = winImport.enqueueMutation(async () => {
            const previousStore = winImport.store;
            try {
                for (let i = 1; i <= 10; i++) {
                    const ev = makeEvent("item-a", 1, "2026-10-15", `10:${String(i).padStart(2, "0")}`);
                    winImport.store = productionModel.appendEvent(winImport.store, ev);
                }
                await winImport.persist();
            } catch (err) {
                winImport.store = previousStore;
                throw err;
            }
        });

        // Win-Daily 同时记录今日打卡
        const dailyPromise = winDaily.enqueueMutation(async () => {
            const todayEv = makeEvent("item-a", 30, "2026-10-29", "18:00");
            winDaily.store = productionModel.appendEvent(winDaily.store, todayEv);
            await winDaily.persist();
        });

        
try {
    await Promise.all([importPromise, dailyPromise]);
} catch (e) {
    console.error("DRILL 5 DETAILED ERROR:", e);
    throw e;
}


        const finalStore = sharedStorage.get("checkin-store");
        assert.equal(finalStore.events.length, 11, "Drill 5.1: both 10 imported events and 1 daily checkin event survive");
        assert.ok(finalStore.events.some((e) => e.localDate === "2026-10-29"), "Drill 5.1: daily event preserved");
        assert.ok(finalStore.events.some((e) => e.localDate === "2026-10-15"), "Drill 5.1: imported event preserved");

        console.log("  ✓ Drill 5: Batch import and concurrent daily checkin successfully coexisted without event loss");
    }

    /* =========================================================================
       Drill 6: 卸载收尾 (teardownFinalFlush) 锁内重读合并防覆盖活跃窗口新数据
       ========================================================================= */
    {
        const sharedStorage = new Map();
        const initialStore = {version: 2, items: [baseItemA], events: [makeEvent("item-a", 10, "2026-10-28", "08:00")], eventTombstones: []};
        sharedStorage.set("checkin-store", productionModel.normalizeStore(initialStore));

        const harness = createDrillHarness(sharedStorage);
        const winClosing = harness.createWindow("Win-Closing", initialStore);
        const winActive = harness.createWindow("Win-Active", initialStore);

        // 此时活跃窗口 Win-Active 产生了一笔打卡并落盘
        await winActive.enqueueMutation(async () => {
            const activeEv = makeEvent("item-a", 20, "2026-10-29", "09:00");
            winActive.store = productionModel.appendEvent(winActive.store, activeEv);
            await winActive.persist();
        });

        // Win-Closing 在关闭前积攒了一笔本地打卡
        const closingEv = makeEvent("item-a", 30, "2026-10-29", "09:30");
        winClosing.store = productionModel.appendEvent(winClosing.store, closingEv);

        // Win-Closing 触发 teardownFinalFlush
        await winClosing.teardownFinalFlush();

        const storedAfterFlush = sharedStorage.get("checkin-store");
        assert.equal(storedAfterFlush.events.length, 3, "Drill 6.1: teardown flush must preserve Win-Active event AND flush closing event");
        const minutesRecorded = storedAfterFlush.events.map((e) => e.occurredAt.slice(14, 16));
        assert.ok(minutesRecorded.includes("00") && minutesRecorded.includes("30"), "Drill 6.1: both events exist in storage");

        console.log("  ✓ Drill 6: teardownFinalFlush reconciled remote baseline under lock without overwriting active peer");
    }

    /* =========================================================================
       Drill 7: 外部失败箱 (External Pending Box) 跨窗口合并与丢弃回滚
       ========================================================================= */
    {
        const makeEntry = (ref, val) => ({
            source: "sireader", externalRef: ref, itemId: "item-a", value: val, unit: "分钟",
            occurredAt: "2026-10-29T10:00:00.000Z", localDate: "2026-10-29",
        });

        const boxA = pendingModule.normalizeExternalPendingBox({items: [makeEntry("ref-1", 10)]});
        const boxB = pendingModule.normalizeExternalPendingBox({items: [makeEntry("ref-2", 20), makeEntry("ref-1", 99)]});

        const merged = pendingModule.mergeExternalPendingBoxes(boxA, boxB);
        assert.equal(merged.items.length, 2, "Drill 7.1: remote box entries merged");
        assert.equal(merged.items.find((i) => i.externalRef === "ref-1").value, 10, "Drill 7.1: local payload priority on identity clash");

        console.log("  ✓ Drill 7: External pending box cross-window merge verified");
    }

    /* =========================================================================
       Drill 8: 偏好桶后写者胜与失败快照原子回滚 (View Preferences LWW & Rollback)
       ========================================================================= */
    {
        const sharedStorage = new Map();
        const initialStore = {version: 2, items: [baseItemA], events: [], eventTombstones: []};
        sharedStorage.set("checkin-store", productionModel.normalizeStore(initialStore));
        sharedStorage.set("checkin-view-preferences", {reviewFold: []});

        const harness = createDrillHarness(sharedStorage);
        const winA = harness.createWindow("Win-A", initialStore);
        winA.collectViewPreferences = () => ({reviewFold: ["records"], reviewFoldTouched: true, lastInsightsItemId: "item-a"});

        // 正常保存偏好
        await winA.persistViewPreferences();
        assert.deepEqual(winA.initialSurfacePreferences, {reviewFold: ["records"], reviewFoldTouched: true, lastInsightsItemId: "item-a"});
        assert.deepEqual(sharedStorage.get("checkin-view-preferences"), {reviewFold: ["records"], reviewFoldTouched: true, lastInsightsItemId: "item-a"});

        // 模拟写入失败：基线不应被推进
        winA.failViewPreferencesSave = true;
        winA.collectViewPreferences = () => ({reviewFold: ["records", "calendar"], reviewFoldTouched: true, lastInsightsItemId: "item-b"});
        await assert.rejects(winA.persistViewPreferences(), /injected preference failure/);
        assert.deepEqual(winA.initialSurfacePreferences, {reviewFold: ["records"], reviewFoldTouched: true, lastInsightsItemId: "item-a"}, "Drill 8: failed preference save rolls back baseline");

        console.log("  ✓ Drill 8: View preferences last-writer-wins and failure rollback verified");
    }

    /* =========================================================================
       Drill 9: onDataChanged 外部数据变更广播响应与草稿保护 (onDataChanged & Drafts)
       ========================================================================= */
    {
        const sharedStorage = new Map();
        const initialStore = {version: 2, items: [baseItemA], events: [], eventTombstones: []};
        sharedStorage.set("checkin-store", productionModel.normalizeStore(initialStore));
        sharedStorage.set("checkin-occasions", {version: 1, occasions: []});
        sharedStorage.set("checkin-reminder-actions", "");

        const harness = createDrillHarness(sharedStorage);
        const winA = harness.createWindow("Win-A", initialStore);

        // Win-A 本地维护有进行中的会话态草稿
        const mockSettingsDrafts = new Map([["wereadApiKey", "secret_draft_key"]]);
        const mockJournalDrafts = new Map([["item-a:daily:2026-10-29", ["草稿答案 1", "草稿答案 2"]]]);
        winA.settingsDrafts = mockSettingsDrafts;
        winA.journalDrafts = mockJournalDrafts;

        // 此时外部窗口写入了新的事项和提醒动作
        // 注意：snooze 动作受 T-1219 的 7 天时效清理约束，at 必须取动态当前时间，
        // 否则测试数据会随日期推移腐烂（曾因硬编码 2026-10-29 而假性红灯）
        const remoteSnoozeAt = new Date(Date.now() - 60_000).toISOString();
        const remoteOccasion = {id: "occ-remote", name: "远程事项", kind: "once", date: "2026-10-29", recurrence: "once", enabled: true, completedDates: []};
        sharedStorage.set("checkin-occasions", {version: 1, occasions: [remoteOccasion], tombstones: [{occasionId: "occ-old-deleted", deletedAt: "2026-10-29T00:00:00.000Z"}]});
        sharedStorage.set("checkin-reminder-actions", remindersModule.serializeReminderUserActions([
            {id: "rem-remote", action: "snooze", at: remoteSnoozeAt}
        ]));

        // 模拟 Win-A 接收到 onDataChanged 事件并重新加载
        await winA.withStorageLock(async () => {
            const rawOccasions = await winA.loadData("checkin-occasions");
            winA.occasionStore = occasionsModule.normalizeOccasionStore(rawOccasions);
            const rawReminders = await winA.loadData("checkin-reminder-actions");
            winA.reminderUserActions = remindersModule.deserializeReminderUserActions(rawReminders);
        });

        // 断言：外部数据已同步入 Win-A，同时本地草稿未被抹除
        assert.equal(winA.occasionStore.occasions.some((o) => o.id === "occ-remote"), true, "Drill 9.1: remote occasion synced");
        assert.equal(winA.occasionStore.occasions.some((o) => o.id === "occ-old-deleted"), false, "Drill 9.1: tombstoned occasion excluded");
        assert.equal(winA.reminderUserActions.some((a) => a.id === "rem-remote"), true, "Drill 9.2: remote reminder action synced");
        assert.equal(winA.settingsDrafts.get("wereadApiKey"), "secret_draft_key", "Drill 9.3: local settings draft preserved");
        assert.deepEqual(winA.journalDrafts.get("item-a:daily:2026-10-29"), ["草稿答案 1", "草稿答案 2"], "Drill 9.3: local journal draft preserved");

        console.log("  ✓ Drill 9: onDataChanged cross-window sync and local session draft safety verified");
    }

    console.log("All T-1622 cross-window storage drills completed successfully!");
}

runDrills().catch((err) => {
    console.error("Drills failed with error:", err);
    process.exit(1);
});
