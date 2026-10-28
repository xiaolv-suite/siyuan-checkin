/* T-1659 专项守门测试：外部来源统一调度、退避与省电策略矩阵
   1. 源码接线与导出规范守门；
   2. 触发评估矩阵：停用、在飞、后台不可见省电跳过与回焦节流防抖；
   3. 失败指数退避（Exponential Backoff with Cap）与自动自愈；
   4. 独立代际（Generation）自增与在飞状态安全重置；
   5. 六大外部来源（微信读书/叶归/健康/笔记推导/思播/思阅）状态矩阵可解释性评估；
   6. 纯函数零隐式时钟与无副作用契约。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const schedulerSource = fs.readFileSync(path.join(root, "src", "features", "source-scheduler.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "src", "index.ts"), "utf8");

/* —— 断言 1：源码接线守门 —— */
assert.match(schedulerSource, /export const DEFAULT_SOURCE_SCHEDULE_CONFIGS/, "source-scheduler exports default configs");
assert.match(schedulerSource, /export function evaluateSourceTrigger/, "source-scheduler exports evaluateSourceTrigger");
assert.match(schedulerSource, /export function calculateBackoffDelay/, "source-scheduler exports calculateBackoffDelay");
assert.match(schedulerSource, /export function recordSourceAttempt/, "source-scheduler exports recordSourceAttempt");
assert.match(schedulerSource, /export function recordSourceSuccess/, "source-scheduler exports recordSourceSuccess");
assert.match(schedulerSource, /export function recordSourceFailure/, "source-scheduler exports recordSourceFailure");
assert.match(schedulerSource, /export function advanceSourceGeneration/, "source-scheduler exports advanceSourceGeneration");
assert.match(schedulerSource, /export function buildSourceSchedulerSummary/, "source-scheduler exports buildSourceSchedulerSummary");

assert.match(indexSource, /evaluateSourceTrigger/, "index.ts imports and calls evaluateSourceTrigger");
assert.match(indexSource, /triggerForegroundSources/, "index.ts implements triggerForegroundSources");
assert.match(indexSource, /getSourceSchedulerSummary/, "index.ts provides public getSourceSchedulerSummary");

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
    DEFAULT_SOURCE_SCHEDULE_CONFIGS,
    createInitialSourceState,
    calculateBackoffDelay,
    evaluateSourceTrigger,
    recordSourceAttempt,
    recordSourceSuccess,
    recordSourceFailure,
    advanceSourceGeneration,
    buildSourceSchedulerSummary,
} = loadModule("src/features/source-scheduler.ts");

// 1. 验证退避算法与上限
const wereadConfig = DEFAULT_SOURCE_SCHEDULE_CONFIGS.weread;
assert.equal(calculateBackoffDelay(0, wereadConfig), 0, "failures 0 -> delay 0");
assert.equal(calculateBackoffDelay(1, wereadConfig), 30_000, "failures 1 -> 30s");
assert.equal(calculateBackoffDelay(2, wereadConfig), 60_000, "failures 2 -> 60s");
assert.equal(calculateBackoffDelay(3, wereadConfig), 120_000, "failures 3 -> 120s");
assert.equal(calculateBackoffDelay(4, wereadConfig), 240_000, "failures 4 -> 240s");
assert.equal(calculateBackoffDelay(20, wereadConfig), wereadConfig.maxBackoffMs, "exponential backoff is capped by maxBackoffMs");

// 2. 状态机与触发决策评估
let state = createInitialSourceState("weread", false);
const now = 100_000_000;

// 未启用拦截
let evalRes = evaluateSourceTrigger(state, wereadConfig, now, "interval", true);
assert.equal(evalRes.allowed, false);
assert.equal(evalRes.reasonCode, "disabled");

// 启用后正常放行
state.enabled = true;
evalRes = evaluateSourceTrigger(state, wereadConfig, now, "interval", true);
assert.equal(evalRes.allowed, true);
assert.equal(evalRes.reasonCode, "ok");

// 在飞中（inFlight）拦截
state = recordSourceAttempt(state, now);
assert.equal(state.inFlight, true);
assert.equal(state.lastAttemptAt, now);
evalRes = evaluateSourceTrigger(state, wereadConfig, now + 1000, "interval", true);
assert.equal(evalRes.allowed, false);
assert.equal(evalRes.reasonCode, "in-flight");
assert.equal(evalRes.status, "running");

// 后台不可见（isVisible: false）省电跳过
const stateIdle = recordSourceSuccess(state, now + 2000, wereadConfig);
assert.equal(stateIdle.inFlight, false);
assert.equal(stateIdle.consecutiveFailures, 0);
assert.equal(stateIdle.lastSuccessAt, now + 2000);
evalRes = evaluateSourceTrigger(stateIdle, wereadConfig, now + 10000, "interval", false);
assert.equal(evalRes.allowed, false);
assert.equal(evalRes.reasonCode, "paused-background");
assert.equal(evalRes.status, "paused-background");

// 手动模式（manual）即使在后台也能穿透
evalRes = evaluateSourceTrigger(stateIdle, wereadConfig, now + 10000, "manual", false);
assert.equal(evalRes.allowed, true);
assert.equal(evalRes.reasonCode, "ok");

// 3. 回前台节流防抖（foreground-throttled）
// 距离上次操作仅 10 秒（小于 minForegroundIntervalMs = 60s），回焦不重拉
evalRes = evaluateSourceTrigger(stateIdle, wereadConfig, now + 12000, "foreground", true);
assert.equal(evalRes.allowed, false);
assert.equal(evalRes.reasonCode, "foreground-throttled");
assert.ok(evalRes.waitMs > 0);

// 距离上次操作已过 65 秒，回焦允许补拉
evalRes = evaluateSourceTrigger(stateIdle, wereadConfig, now + 70000, "foreground", true);
assert.equal(evalRes.allowed, true);
assert.equal(evalRes.reasonCode, "ok");

// 4. 连续失败与退避期拦截
let failedState = recordSourceFailure(stateIdle, now + 70000, wereadConfig);
assert.equal(failedState.consecutiveFailures, 1);
assert.equal(failedState.nextRunAt, now + 70000 + 30000); // 30s 退避

// 在退避期内被拦截
evalRes = evaluateSourceTrigger(failedState, wereadConfig, now + 75000, "interval", true);
assert.equal(evalRes.allowed, false);
assert.equal(evalRes.reasonCode, "in-backoff");
assert.equal(evalRes.status, "backoff");

// 超过退避期后重新放行
evalRes = evaluateSourceTrigger(failedState, wereadConfig, now + 105000, "interval", true);
assert.equal(evalRes.allowed, true);

// 再次成功后自愈清零
const healedState = recordSourceSuccess(failedState, now + 106000, wereadConfig);
assert.equal(healedState.consecutiveFailures, 0);
assert.equal(healedState.nextRunAt, now + 106000 + wereadConfig.intervalMs);

// 5. 代际递增
const nextGen = advanceSourceGeneration(healedState);
assert.equal(nextGen.generation, healedState.generation + 1);
assert.equal(nextGen.inFlight, false);

// 6. 六大来源矩阵可解释性汇总
const allStates = {
    weread: healedState,
    yeguif: createInitialSourceState("yeguif", true),
    health: createInitialSourceState("health", true),
    notequery: createInitialSourceState("notequery", true),
    siplayer: createInitialSourceState("siplayer", false),
    sireader: createInitialSourceState("sireader", false),
};
const summary = buildSourceSchedulerSummary(allStates, DEFAULT_SOURCE_SCHEDULE_CONFIGS, now + 110000, true);
assert.equal(summary.length, 6, "all 6 sources represented in summary matrix");
const wereadSummary = summary.find((s) => s.key === "weread");
assert.ok(wereadSummary);
assert.equal(wereadSummary.status, "idle");
assert.equal(wereadSummary.consecutiveFailures, 0);

console.log("Source unified scheduler matrix checks passed successfully.");
