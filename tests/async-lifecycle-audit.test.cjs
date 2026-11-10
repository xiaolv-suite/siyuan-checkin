/* T-1664 专项守门测试：异步请求代际与销毁清理总审计
   1. 源码导出与宿主接线断言；
   2. 异步生命周期管理器资源追踪与靶向单项注销；
   3. 同键重复登记旧资源安全置换与自动清理；
   4. 代际（Generation）自增与过期快速失效断言；
   5. 按 Owner（Root/Modal/Plugin）靶向批量释放，多 root 隔离不误伤；
   6. onunload 全量释放后零泄漏审计断言。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const lifecycleSource = fs.readFileSync(path.join(root, "src", "features", "async-lifecycle.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "src", "index.ts"), "utf8");

/* —— 断言 1：源码接线守门 —— */
assert.match(lifecycleSource, /export class AsyncLifecycleManager/, "async-lifecycle exports AsyncLifecycleManager");
assert.match(indexSource, /AsyncLifecycleManager/, "index.ts imports AsyncLifecycleManager");
assert.match(indexSource, /this\.asyncLifecycle\.disposeAll\(\)/, "onunload calls asyncLifecycle.disposeAll");
assert.match(indexSource, /auditAsyncLifecycleLeaks/, "index.ts exposes auditAsyncLifecycleLeaks");

/* —— 断言 2：纯函数动态编译与执行 —— */
function loadModule(relativePath) {
    const fullPath = path.join(root, relativePath);
    const content = fs.readFileSync(fullPath, "utf8");
    const transpiled = ts.transpileModule(content, {
        compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
    }).outputText;
    const module = {exports: {}};
    new Function("require", "module", "exports", transpiled)((dep) => {
        if (dep.startsWith(".")) {
            return loadModule(path.join(path.dirname(relativePath), `${dep}.ts`));
        }
        return require(dep);
    }, module, module.exports);
    return module.exports;
}

const {
    AsyncLifecycleManager,
} = loadModule("src/features/async-lifecycle.ts");

const manager = new AsyncLifecycleManager();

// 1. 基础代际管理
assert.equal(manager.getGeneration("dock", "search"), 0, "initial generation is 0");
assert.equal(manager.isCurrent("dock", "search", 0), true, "gen 0 is current");
assert.equal(manager.isCurrent("dock", "search", 1), false, "gen 1 is not current");

const nextGen = manager.advanceGeneration("dock", "search");
assert.equal(nextGen, 1, "generation advances to 1");
assert.equal(manager.isCurrent("dock", "search", 0), false, "old gen 0 is now stale");
assert.equal(manager.isCurrent("dock", "search", 1), true, "new gen 1 is now current");

// 2. 资源追踪与释放
let timerCleaned = false;
let rafCleaned = false;

const unbindTimer = manager.trackResource("tab", "debounce", "timer", () => {
    timerCleaned = true;
});
const unbindRaf = manager.trackResource("tab", "render-frame", "raf", () => {
    rafCleaned = true;
});

const initialAudit = manager.auditResourceLeaks();
assert.equal(initialAudit.leakCount, 2, "2 active resources tracked");
assert.deepEqual(initialAudit.activeOwners, ["tab"]);

// 单项精准释放
unbindTimer();
assert.equal(timerCleaned, true, "timer disposer was executed");
assert.equal(manager.auditResourceLeaks().leakCount, 1, "1 resource remaining");

// 3. 同键重复登记：旧资源自动提前处置
let supersededCleaned = false;
manager.trackResource("dialog", "preview", "timer", () => {
    supersededCleaned = true;
});
assert.equal(supersededCleaned, false, "initial resource not yet disposed");

// 再次登记同 owner + key
let replacementCleaned = false;
manager.trackResource("dialog", "preview", "timer", () => {
    replacementCleaned = true;
});
assert.equal(supersededCleaned, true, "superseded resource was automatically disposed on overwrite");
assert.equal(replacementCleaned, false, "replacement resource is active");

// 4. 按 Owner 靶向批量释放（模拟 root destroy）
let dockResourceCleaned = false;
manager.trackResource("dock", "watcher", "listener", () => {
    dockResourceCleaned = true;
});

const dialogDisposedCount = manager.disposeByOwner("dialog");
assert.equal(dialogDisposedCount, 1, "1 dialog resource disposed");
assert.equal(replacementCleaned, true, "dialog resource executed disposer");
assert.equal(dockResourceCleaned, false, "dock resource remained untouched");

// 5. onunload 全量释放审计
const totalDisposed = manager.disposeAll();
assert.ok(totalDisposed >= 2, "disposeAll cleaned all remaining resources");
assert.equal(dockResourceCleaned, true, "dock resource was cleaned up in disposeAll");

const finalAudit = manager.auditResourceLeaks();
assert.equal(finalAudit.leakCount, 0, "0 resource leaks after disposeAll");
assert.equal(finalAudit.activeOwners.length, 0, "0 active owners remaining");

console.log("Async lifecycle and leak audit checks passed successfully.");
