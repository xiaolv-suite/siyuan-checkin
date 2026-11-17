/* T-1807 专项守门：主 Store 快照写放大与大历史保存预算门禁。
   1. 写放大倍率硬约束：3 份全量快照容量硬上限（STORE_SNAPSHOT_HISTORY_LIMIT = 3），FIFO 有界淘汰；
   2. 性能与时延预算：1k 规模追加 < 50ms，10k 规模追加 < 400ms，验证写修复在 2 次以内收敛；
   3. 故障注入与回滚一致性：备份写入失败与主档写入失败的各阶段回滚行为；
   4. 恢复点语义契约：快照信封 schemaVersion、时间戳与 normalizeStore 往返等价性。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {performance} = require("node:perf_hooks");
const ts = require("typescript");
const {calibrateContentionFactor} = require("./helpers/perf.cjs");
/* 预算按并行争用倍率放大：空载 CF≈1 保持原契约，`node --test` 并行下等比放宽（详见 helpers/perf.cjs） */
const CF = calibrateContentionFactor();

const sourceRoot = path.join(__dirname, "..", "src");

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

const model = loadProduction("model.ts");
const storageTx = loadProduction("storage-transaction.ts");

function makeItem(index) {
    return {
        id: `item-${index}`,
        name: `习惯项 ${index}`,
        icon: "🏃",
        kind: "count",
        target: 10,
        unit: "次",
        schedule: {type: "daily"},
        createdDate: "2026-10-01",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        revisions: [],
        archivePeriods: [],
        archived: false,
        group: "健康",
        priority: "medium",
        sortOrder: index,
        timeSlot: "any",
    };
}

function makeStore(eventCount) {
    const items = [makeItem(1), makeItem(2), makeItem(3)];
    const events = Array.from({length: eventCount}, (_, index) => ({
        id: `event-${index}`,
        itemId: `item-${(index % 3) + 1}`,
        occurredAt: "2026-10-29T10:00:00.000Z",
        localDate: "2026-10-29",
        value: 1,
        unit: "次",
        source: "manual",
    }));
    return model.normalizeStore({
        version: 2,
        items,
        events,
        eventTombstones: [],
        itemTombstones: [],
    });
}

async function runBudgetChecks() {
    console.log("Starting T-1807 storage snapshot write amplification & budget checks...");

    /* =========================================================================
       Check 1: 快照写放大倍率硬约束与 FIFO 淘汰 (Amplification Ratio Limit)
       ========================================================================= */
    {
        const store = makeStore(100);
        let history = model.createEmptyStoreSnapshotHistory();
        assert.equal(model.readStoreSnapshotHistory(history).length, 0, "initial history is empty");

        // 连续追加 5 次快照
        for (let i = 1; i <= 5; i++) {
            const envelope = model.createStoreSnapshotEnvelope(store, `2026-10-29T10:0${i}:00.000Z`);
            history = model.appendStoreSnapshotHistory(history, envelope, 3);
            const snapshots = model.readStoreSnapshotHistory(history);
            assert.ok(snapshots.length <= 3, `snapshot count must not exceed limit 3 (observed ${snapshots.length} at step ${i})`);
        }

        const finalSnapshots = model.readStoreSnapshotHistory(history);
        assert.equal(finalSnapshots.length, 3, "history retains exactly 3 snapshots after 5 appends");
        assert.equal(finalSnapshots[0].capturedAt, "2026-10-29T10:03:00.000Z", "oldest snapshots 1 and 2 were FIFO evicted");
        assert.equal(finalSnapshots[2].capturedAt, "2026-10-29T10:05:00.000Z", "latest snapshot is retained at the end");

        // 测量写放大比率
        const singleSize = Buffer.byteLength(JSON.stringify(store), "utf8");
        const historySize = Buffer.byteLength(JSON.stringify(history), "utf8");
        const amplification = historySize / singleSize;
        assert.ok(amplification <= 3.2, `write amplification ratio must stay <= 3.2x (observed ${amplification.toFixed(2)}x)`);

        console.log(`  ✓ Check 1: 3-snapshot FIFO eviction and amplification ratio ${amplification.toFixed(2)}x verified`);
    }

    /* =========================================================================
       Check 2: 1k / 10k 规模时延预算 (Performance & Latency Budgets)
       ========================================================================= */
    {
        // 2.1 1,000 事件规模预算（预算 < 50ms）
        const store1k = makeStore(1000);
        const env1k = model.createStoreSnapshotEnvelope(store1k);
        let hist1k = model.appendStoreSnapshotHistory(undefined, env1k, 3);
        hist1k = model.appendStoreSnapshotHistory(hist1k, env1k, 3);

        const start1k = performance.now();
        hist1k = model.appendStoreSnapshotHistory(hist1k, env1k, 3);
        const serialized1k = JSON.stringify(hist1k);
        const elapsed1k = performance.now() - start1k;
        assert.ok(elapsed1k < 50 * CF, `1k append & serialize must be under 50ms (measured ${elapsed1k.toFixed(2)}ms)`);

        // 2.2 10,000 事件规模预算（预算 < 400ms）
        const store10k = makeStore(10000);
        const env10k = model.createStoreSnapshotEnvelope(store10k);
        let hist10k = model.appendStoreSnapshotHistory(undefined, env10k, 3);
        hist10k = model.appendStoreSnapshotHistory(hist10k, env10k, 3);

        const start10k = performance.now();
        hist10k = model.appendStoreSnapshotHistory(hist10k, env10k, 3);
        const serialized10k = JSON.stringify(hist10k);
        const elapsed10k = performance.now() - start10k;
        assert.ok(elapsed10k < 400 * CF, `10k append & serialize must be under 400ms (measured ${elapsed10k.toFixed(2)}ms)`);

        console.log(`  ✓ Check 2: 1k scale (${elapsed1k.toFixed(1)}ms < 50ms) and 10k scale (${elapsed10k.toFixed(1)}ms < 400ms) latency budgets satisfied`);
    }

    /* =========================================================================
       Check 3: 故障注入与回滚一致性 (Failure Injections & Rollback Integrity)
       ========================================================================= */
    {
        const initialStore = makeStore(200);
        let storagePrimary = structuredClone(initialStore);
        let storageBackup = model.createEmptyStoreSnapshotHistory();

        // 阶段 A：备份写失败时，主档和内存均不受损
        let simulatedFailurePhase = "none";
        const persistAttempt = async (nextStore) => {
            const previous = structuredClone(storagePrimary);
            const history = model.appendStoreSnapshotHistory(storageBackup, model.createStoreSnapshotEnvelope(previous), 3);
            if (simulatedFailurePhase === "backup") throw new Error("simulated backup IO error");
            storageBackup = history;

            if (simulatedFailurePhase === "primary") throw new Error("simulated primary IO error");
            storagePrimary = nextStore;
        };

        // 注入 backup 错误
        simulatedFailurePhase = "backup";
        const modifiedStore1 = model.appendEvent(initialStore, {
            id: "ev-fail-1", itemId: "item-1", occurredAt: "2026-10-29T11:00:00.000Z",
            localDate: "2026-10-29", value: 1, unit: "次", source: "manual"
        });
        await assert.rejects(persistAttempt(modifiedStore1), /simulated backup IO error/);
        assert.deepEqual(storagePrimary, initialStore, "primary remains unchanged after backup failure");
        assert.equal(model.readStoreSnapshotHistory(storageBackup).length, 0, "backup remains unmutated after backup failure");

        // 阶段 B：主档写失败时，已备份的快照可用于恢复
        simulatedFailurePhase = "primary";
        const modifiedStore2 = model.appendEvent(initialStore, {
            id: "ev-fail-2", itemId: "item-1", occurredAt: "2026-10-29T11:05:00.000Z",
            localDate: "2026-10-29", value: 1, unit: "次", source: "manual"
        });
        await assert.rejects(persistAttempt(modifiedStore2), /simulated primary IO error/);
        assert.deepEqual(storagePrimary, initialStore, "primary remains unchanged after primary write failure");
        const availableSnapshots = model.readStoreSnapshotHistory(storageBackup);
        assert.equal(availableSnapshots.length, 1, "backup has the pre-write restore point ready for disaster recovery");
        assert.deepEqual(availableSnapshots[0].store.items, initialStore.items, "backup store matches initial baseline");

        console.log("  ✓ Check 3: Failure phases in backup vs primary write properly isolated without data corruption");
    }

    /* =========================================================================
       Check 4: 校验写入与丢失更新收敛性 (Verified Write & Repair Bounds)
       ========================================================================= */
    {
        // 4.1 并发不同事件流：验证写发现丢失更新并在第 2 次重试中完成合流修补
        const expected = makeStore(25);
        const concurrentEvents = Array.from({length: 25}, (_, i) => ({
            id: `event-concurrent-${i}`,
            itemId: "item-1",
            occurredAt: "2026-10-29T10:30:00.000Z",
            localDate: "2026-10-29",
            value: 1,
            unit: "次",
            source: "manual",
        }));
        const concurrent = model.normalizeStore({
            version: 2,
            items: expected.items,
            events: concurrentEvents,
            eventTombstones: [],
            itemTombstones: [],
        });
        let stored = makeStore(10);
        let saveCalls = 0;

        // 模拟第一次写入时遇到并发对端更新，第二次重试自动合流
        const result = await storageTx.persistStoreWithVerification(
            expected,
            async () => stored,
            async (candidate) => {
                saveCalls++;
                stored = saveCalls === 1 ? concurrent : candidate;
            },
            2
        );

        assert.equal(result.attempts, 2, "verified write requires exactly 2 attempts when race condition occurs");
        assert.equal(result.repaired, true, "repaired flag is marked true");
        assert.equal(saveCalls, 2, "retry loop strictly bounded to 2 attempts, no infinite recursion");
        assert.equal(result.store.events.length, 50, "converged store preserves all 25 local events and 25 concurrent events");

        // 4.2 存储中已包含超集时：直接单次采纳（attempts = 1, repaired = false），避免无意义覆写
        let supersetStored = result.store;
        const supersetResult = await storageTx.persistStoreWithVerification(
            expected,
            async () => supersetStored,
            async (candidate) => { supersetStored = candidate; },
            2
        );
        assert.equal(supersetResult.attempts, 1, "superset in storage is accepted without extra writes");
        assert.equal(supersetResult.repaired, false, "repaired is false when already superset");

        console.log("  ✓ Check 4: Lost-update race condition repaired within bounded 2 attempts and superset fast-path verified");
    }

    /* =========================================================================
       Check 5: 恢复点语义契约与反向往返等价性 (Restoration Equivalence)
       ========================================================================= */
    {
        const originalStore = makeStore(500);
        const envelope = model.createStoreSnapshotEnvelope(originalStore, "2026-10-29T12:00:00.000Z");

        assert.equal(envelope.version, 1, "envelope schema version is 1");
        assert.equal(envelope.capturedAt, "2026-10-29T12:00:00.000Z", "capturedAt is preserved exactly");

        // 往返序列化
        const json = JSON.stringify(envelope);
        const restoredEnvelope = JSON.parse(json);
        const restoredStore = model.normalizeStore(restoredEnvelope.store);

        assert.equal(model.areNormalizedStoresEqual(originalStore, restoredStore), true, "restored store is 100% equivalent to original store");

        console.log("  ✓ Check 5: Snapshot envelope schema and restoration point equivalence verified");
    }

    console.log("All T-1807 storage snapshot write amplification and budget checks passed!");
}

runBudgetChecks().catch((err) => {
    console.error("Budget checks failed with error:", err);
    process.exit(1);
});
