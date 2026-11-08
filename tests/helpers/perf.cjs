/**
 * 性能预算测试公共脚手架（并行 `node --test` 稳定性）：
 * 1. calibrateContentionFactor()：自旋校准当前进程算力水位（CPU 争用倍率），
 *    空载 ≈1，争用下按实际减速等比放大预算，封顶 8 倍——预算仍拦截算法级退化。
 * 2. measureBest(fn, runs)：幂等纯查询微基准 best-of-N，消除单次 GC/JIT 停顿噪声。
 * 弱缓存索引计时请勿直接 measureBest（缓存命中会掏空契约语义）：
 * 每次以全新克隆计时且克隆在计时区外完成（参考 cold-start-baseline 的索引构建段）。
 */
const {performance} = require("node:perf_hooks");

function calibrateContentionFactor() {
    let wall = Infinity;
    for (let round = 0; round < 2; round++) {
        const t0 = performance.now();
        let acc = 0;
        for (let i = 0; i < 1000000; i++) acc += (i % 7) ^ (i % 5);
        wall = Math.min(wall, performance.now() - t0);
        if (acc === -1) throw new Error("unreachable");
    }
    // 现代桌面空载约 2~4ms；以 4ms 为满速基准换算争用倍率，封顶 8 倍
    return Math.max(1, Math.min(8, wall / 4));
}

function measureBest(fn, runs = 3) {
    let best = Infinity;
    let result;
    for (let i = 0; i < runs; i++) {
        const t0 = performance.now();
        result = fn();
        best = Math.min(best, performance.now() - t0);
    }
    return {ms: best, result};
}

module.exports = {calibrateContentionFactor, measureBest};
