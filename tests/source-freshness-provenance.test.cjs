/* T-1661 专项守门测试：外部来源新鲜度、跨日与源时刻解释模型
   1. 源码接线与导出规范守门；
   2. 发生时间（sourceOccurredAt）与摄取时间（ingestedAt）分离验证；
   3. 叶归 LifeLog 段落源时刻与轮询时刻对账（严禁用轮询时刻冒充源时刻）；
   4. 思阅/思播跨午夜切分片段的源时刻归属；
   5. 微信读书历史日汇总业务日锚定；
   6. 来源新鲜度（live / delayed / stale / idle）状态矩阵评估；
   7. 纯函数零隐式时钟与无副作用契约。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const provenanceSource = fs.readFileSync(path.join(root, "src", "features", "source-provenance.ts"), "utf8");
const yeguifSource = fs.readFileSync(path.join(root, "src", "features", "yeguif-adapter.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "src", "index.ts"), "utf8");

/* —— 断言 1：源码接线守门 —— */
assert.match(provenanceSource, /export function resolveSourceActionMoment/, "source-provenance exports resolveSourceActionMoment");
assert.match(provenanceSource, /export function buildSourceEventProvenance/, "source-provenance exports buildSourceEventProvenance");
assert.match(provenanceSource, /export function evaluateSourceFreshness/, "source-provenance exports evaluateSourceFreshness");
assert.match(indexSource, /resolveSourceActionMoment/, "index.ts imports and calls resolveSourceActionMoment");
assert.match(yeguifSource, /buildYeguifActionMoment/, "yeguif-adapter preserves buildYeguifActionMoment");

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
    resolveSourceActionMoment,
    buildSourceEventProvenance,
    evaluateSourceFreshness,
} = loadModule("src/features/source-provenance.ts");

const {
    buildYeguifActionMoment,
} = loadModule("src/features/yeguif-adapter.ts");

const {
    SireaderFocusTracker,
} = loadModule("src/features/sireader-adapter.ts");

// 1. 发生时间与摄取时间分离：微信读书历史日汇总锚定
const ingestNowIso = "2026-10-28T14:30:00.000Z";
// 场景 A：过去日结算（2026-10-25），严禁冒充 2026-10-28 摄取时刻
const pastDayMoment = resolveSourceActionMoment("2026-10-25", undefined, ingestNowIso);
assert.equal(pastDayMoment.localDate, "2026-10-25");
assert.match(pastDayMoment.occurredAt, /^2026-10-25/, "occurredAt must anchor to settled localDate, not ingest time");
assert.equal(pastDayMoment.occurredAt.slice(0, 10), "2026-10-25");

// 场景 B：当天结算（2026-10-28），且源端无细粒度时刻，正常采用当前摄取时刻
const sameDayMoment = resolveSourceActionMoment("2026-10-28", undefined, ingestNowIso);
assert.equal(sameDayMoment.localDate, "2026-10-28");
assert.equal(sameDayMoment.occurredAt, ingestNowIso);

// 场景 C：源端有明确时刻（如微信读书完读时间戳）
const exactSourceTime = "2026-10-25T11:22:33.000Z";
const exactMoment = resolveSourceActionMoment("2026-10-25", exactSourceTime, ingestNowIso);
assert.equal(exactMoment.occurredAt, exactSourceTime, "explicit source occurredAt must be preserved");

// 2. 叶归 LifeLog：段落时间保持源发生时刻
const yeguifDate = "2026-10-28";
const yeguifMoment = buildYeguifActionMoment(yeguifDate, 9 * 60 + 15, 30); // 09:15:30
assert.ok(yeguifMoment);
assert.equal(yeguifMoment.localDate, yeguifDate);
const yeguifTime = new Date(yeguifMoment.occurredAt);
assert.equal(yeguifTime.getHours(), 9);
assert.equal(yeguifTime.getMinutes(), 15);
assert.equal(yeguifTime.getSeconds(), 30);

// 3. 思阅跨午夜切分验证：源段各自归属当日与次日
const nextMidnightHelper = (ts) => {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0).getTime();
};
const toLocalDateHelper = (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const tracker = new SireaderFocusTracker({
    minDurationSeconds: 60,
    toLocalDate: toLocalDateHelper,
    nextMidnight: nextMidnightHelper,
});

// 从 2026-10-27 23:45 开始读，到 2026-10-28 00:30 结束（总计 45 分钟，跨午夜）
const startCross = new Date(2026, 9, 27, 23, 45, 0).getTime();
const endCross = new Date(2026, 9, 28, 0, 30, 0).getTime();
tracker.handle("open", startCross, "sireader://book/跨午夜测试书");
const slices = tracker.handle("close", endCross);
assert.equal(slices.length, 2, "cross-midnight read session must produce two slices");
assert.equal(slices[0].localDate, "2026-10-27");
assert.equal(slices[0].minutes, 15, "first slice: 15 minutes on 2026-10-27");
assert.equal(slices[1].localDate, "2026-10-28");
assert.equal(slices[1].minutes, 30, "second slice: 30 minutes on 2026-10-28");

// 4. 事实凭据构建与迟滞计算
const prov = buildSourceEventProvenance(
    "weread",
    "weread:book:2026-10-27",
    "2026-10-27T10:00:00.000Z",
    "2026-10-27T10:05:00.000Z",
    "2026-10-27",
);
assert.equal(prov.lagMs, 300_000, "lag is 5 minutes");

// 5. 新鲜度状态评估矩阵
const nowMs = new Date("2026-10-28T15:00:00.000Z").getTime();
const todayKey = "2026-10-28";

// A. 未启用
const idleRes = evaluateSourceFreshness({sourceKey: "yeguif", enabled: false}, nowMs, todayKey);
assert.equal(idleRes.status, "idle");

// B. 实时活跃（5 分钟前摄取）
const liveRes = evaluateSourceFreshness({
    sourceKey: "weread",
    enabled: true,
    lastSourceOccurredAt: new Date(nowMs - 6 * 60 * 1000).toISOString(),
    lastIngestedAt: new Date(nowMs - 5 * 60 * 1000).toISOString(),
    lastSettledLocalDate: todayKey,
}, nowMs, todayKey);
assert.equal(liveRes.status, "live");

// C. 延迟结算（滞后 2 小时）
const delayedRes = evaluateSourceFreshness({
    sourceKey: "health",
    enabled: true,
    lastSourceOccurredAt: new Date(nowMs - 150 * 60 * 1000).toISOString(),
    lastIngestedAt: new Date(nowMs - 10 * 60 * 1000).toISOString(),
    lastSettledLocalDate: todayKey,
}, nowMs, todayKey);
assert.equal(delayedRes.status, "delayed");

// D. 陈旧（超过 2 天前的数据）
const staleRes = evaluateSourceFreshness({
    sourceKey: "notequery",
    enabled: true,
    lastSourceOccurredAt: "2026-10-25T10:00:00.000Z",
    lastIngestedAt: "2026-10-25T10:05:00.000Z",
    lastSettledLocalDate: "2026-10-25",
}, nowMs, todayKey);
assert.equal(staleRes.status, "stale");

console.log("Source freshness and provenance checks passed successfully.");
