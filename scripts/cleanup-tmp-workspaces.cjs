#!/usr/bin/env node
/**
 * 清理 os.tmpdir() 下思源测试遗留的临时工作区
 * ---------------------------------------------------------------
 * 背景：各插件的测试大量使用
 *     fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-xxx-"))
 * 建临时工作区跑内核，但绝大多数测试没有写 teardown。结果是每跑一次测试
 * 就在系统临时目录里留一个 `siyuan-xxx-<随机6位>` 目录，长期累积。实测
 * 2026-10-31 清理时已堆积 10,166 个、4.4 GB。
 *
 * 本脚本按「只删自己该删的」原则工作，四种模式：
 *
 *   1) 默认（按年龄）
 *      node scripts/cleanup-tmp-workspaces.cjs
 *      删掉 6 小时前的遗留。给 pretest / 每日巡检用，清理上次崩溃残留。
 *
 *   2) 快照基线
 *      node scripts/cleanup-tmp-workspaces.cjs --snapshot
 *      把当前已存在的目录名记进 .tmp/tmp-workspace-baseline.json。
 *
 *   3) 删本次新增
 *      node scripts/cleanup-tmp-workspaces.cjs --since-snapshot
 *      只删基线之后新出现的目录。给 posttest 用 —— 精确对应「这一轮测试
 *      产生的」，不会误伤其他项目的并发运行。
 *
 *   4) 全清
 *      node scripts/cleanup-tmp-workspaces.cjs --all
 *      无条件删所有匹配目录。只在明确要打扫战场时手动用。
 *
 * 安全网：
 *   - 删除失败（EBUSY/EPERM，例如目录正被运行中的 SiYuan 内核占用）只记录
 *     不重试升级，绝不会把活着的测试工作区删掉。
 *   - 匹配前缀限定为 siyuan- / SiYuan- / lc-（本项目及同类项目的约定），
 *     不碰临时目录里的其他东西。
 *   - 只处理目录，不处理文件。
 */

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const baselineFile = path.join(repoRoot, ".tmp", "tmp-workspace-baseline.json");
const TMP_ROOT = os.tmpdir();

// 思源插件测试建临时工作区的命名约定
const NAME_RE = /^(siyuan-|lc-)/i;

const DEFAULT_OLDER_THAN_HOURS = 6;

// ------------------------------------------------------------------ 参数

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f, dflt) => {
    const i = argv.indexOf(f);
    if (i === -1 || i === argv.length - 1) return dflt;
    const n = Number(argv[i + 1]);
    return Number.isFinite(n) ? n : dflt;
};

const MODE = has("--snapshot")
    ? "snapshot"
    : has("--since-snapshot")
      ? "since"
      : has("--all")
        ? "all"
        : "age";

const DRY_RUN = has("--dry-run");
const QUIET = has("--quiet");
const OLDER_THAN_HOURS = has("--all") ? 0 : valueOf("--older-than-hours", DEFAULT_OLDER_THAN_HOURS);

// ------------------------------------------------------------------ 工具

function say(msg) {
    if (!QUIET) console.log(`[tmp-workspaces] ${msg}`);
}

/** 列出临时目录里所有匹配命名约定的子目录 */
function listCandidates() {
    let entries;
    try {
        entries = fs.readdirSync(TMP_ROOT, { withFileTypes: true });
    } catch (e) {
        say(`读取临时目录失败: ${e.message}`);
        return [];
    }
    const out = [];
    for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (!NAME_RE.test(e.name)) continue;
        const full = path.join(TMP_ROOT, e.name);
        let st;
        try {
            st = fs.statSync(full);
        } catch {
            continue;
        }
        out.push({ name: e.name, full, mtimeMs: st.mtimeMs, ageHours: (Date.now() - st.mtimeMs) / 3.6e6 });
    }
    return out;
}

/** 目录里有多少文件、多大 */
function measure(dir) {
    let files = 0;
    let bytes = 0;
    const stack = [dir];
    while (stack.length) {
        const cur = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(cur, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            const p = path.join(cur, e.name);
            if (e.isDirectory()) {
                stack.push(p);
            } else {
                files++;
                try {
                    bytes += fs.statSync(p).size;
                } catch {
                    /* 忽略统计不到的 */
                }
            }
        }
    }
    return { files, bytes };
}

/**
 * 删除一个目录。被占用就放弃并如实返回失败原因，不做强制重试 ——
 * 删不掉通常意味着有活的 SiYuan 内核正在用它，那就不该删。
 */
function removeDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 2, retryDelay: 120 });
        return { ok: true };
    } catch (e) {
        return { ok: false, reason: e.code || e.message };
    }
}

function readBaseline() {
    try {
        const raw = fs.readFileSync(baselineFile, "utf8");
        const parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed.names) ? parsed.names : []);
    } catch {
        return null;
    }
}

function writeBaseline(names) {
    try {
        fs.mkdirSync(path.dirname(baselineFile), { recursive: true });
        fs.writeFileSync(
            baselineFile,
            JSON.stringify({ takenAt: new Date().toISOString(), names: [...names].sort() }, null, 2),
            "utf8",
        );
        return true;
    } catch (e) {
        say(`写基线失败: ${e.message}`);
        return false;
    }
}

// ------------------------------------------------------------------ 主流程

function main() {
    const all = listCandidates();

    if (MODE === "snapshot") {
        const ok = writeBaseline(all.map((d) => d.name));
        if (ok) say(`已记录基线：${all.length} 个遗留目录（不会删除任何东西）`);
        process.exit(ok ? 0 : 1);
    }

    let targets;
    if (MODE === "all") {
        targets = all;
        say(`模式=全清，匹配 ${all.length} 个目录`);
    } else if (MODE === "since") {
        const base = readBaseline();
        if (base === null) {
            // 没有基线说明没跑过 --snapshot，退化成按年龄，避免误删全部
            say("未找到基线，降级为按年龄清理（请检查 pretest 是否配了 --snapshot）");
            targets = all.filter((d) => d.ageHours >= Math.min(OLDER_THAN_HOURS, 1));
        } else {
            targets = all.filter((d) => !base.has(d.name));
            say(`模式=删本次新增，基线 ${base.size} 个，新增 ${targets.length} 个`);
        }
    } else {
        targets = all.filter((d) => d.ageHours >= OLDER_THAN_HOURS);
        say(`模式=按年龄，阈值 ${OLDER_THAN_HOURS} 小时，命中 ${targets.length} / ${all.length} 个`);
    }

    if (targets.length === 0) {
        say("无需清理");
        process.exit(0);
    }

    let removed = 0;
    let removedFiles = 0;
    let removedBytes = 0;
    const failures = [];

    for (const d of targets) {
        if (DRY_RUN) {
            const m = measure(d.full);
            say(`  [dry-run] ${d.name}  ${(m.bytes / 1048576).toFixed(1)} MB  ${m.files} 文件  ${d.ageHours.toFixed(1)}h`);
            removed++;
            removedFiles += m.files;
            removedBytes += m.bytes;
            continue;
        }
        const m = measure(d.full);
        const r = removeDir(d.full);
        if (r.ok) {
            removed++;
            removedFiles += m.files;
            removedBytes += m.bytes;
        } else {
            failures.push({ name: d.name, reason: r.reason });
        }
    }

    const mb = (removedBytes / 1048576).toFixed(1);
    if (DRY_RUN) {
        say(`[dry-run] 将删除 ${removed} 个目录，共 ${mb} MB / ${removedFiles} 文件`);
    } else {
        say(`已删除 ${removed} 个目录，释放 ${mb} MB / ${removedFiles} 文件`);
    }
    if (failures.length) {
        say(`${failures.length} 个目录未能删除（多为正被运行中的内核占用，属正常）`);
        if (!QUIET) {
            for (const f of failures.slice(0, 8)) say(`  跳过 ${f.name}: ${f.reason}`);
            if (failures.length > 8) say(`  ...另有 ${failures.length - 8} 个`);
        }
    }

    // 按年龄模式清理成功后，顺手刷新基线，避免陈旧基线让 --since 误判
    if (MODE === "age" && !DRY_RUN) {
        writeBaseline(listCandidates().map((d) => d.name));
    }
}

main();
