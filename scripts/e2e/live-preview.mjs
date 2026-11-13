#!/usr/bin/env node
/**
 * 小驴打卡 · D 盘持久隔离实测网页环境启动器（默认端口 43929，与小驴管家 43919、主思源 6806、E2E 6807 严格区分）
 *
 * 特性：
 * 1. 隔离工作区固定在 D 盘：`D:\思源插件配套\测试工作区\.isolated-workspaces\siyuan-checkin`（绝不写 C 盘 Temp，也不会被临时目录清理脚本误删）；
 * 2. 免密码直连：不设 accessAuthCode，浏览器打开 `http://127.0.0.1:43929/stage/build/desktop/` 直接进入思源桌面端与小驴打卡；
 * 3. 预置全场景真实数据与思源落地文档：
 *    - 习惯项目：精读系统思考（时长型，绑锚点文档+追加备注）、晨间慢跑（二值型）、每日饮水（计数型）、睡前刷短视频（上限戒断型）、每周复盘整理（周期型）及 1 个已归档项目；
 *    - 历史打卡：近 14 天连续/间断/跳过/多源（手动/番茄钟/思阅）记录，今日已完成 2 项、待完成 3 项，打开「今日」「回顾」「洞察」「事项」「更多」「设置」均有饱满数据；
 *    - 思源笔记真实落地文档（位于左侧文档树 `📒 小驴打卡实测演练本`）：
 *      ① `📖 阅读成长笔记`：绑定「精读系统思考」块属性 `custom-lv-checkin`、打卡自动追加读书备注、常驻每日摘要行 `(lv-checkin-summary)`、打卡汇总 Markdown 表格；
 *      ② `/daily note/2026/10/2026-10-31`：今日日记 `### 打卡流水` 分节下真实写入 `HH:MM 项目名：数值单位` LifeLog 流水块及 `custom-lv-checkin-*` 属性；
 *      ③ `🧩 文档内打卡嵌入块演练`：内嵌实时 `checkin` 渲染块（`view: today`）。
 * 4. 支持热同步更新：修改代码并 `pnpm run build` 后，执行 `node scripts/e2e/live-preview.mjs --sync` 即可秒级更新隔离环境插件产物，浏览器按 F5 立即生效。
 */

import {execSync, spawn} from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import {chromium} from "playwright";
import {resolveInstall} from "./lib.mjs";

function resolveBrowserExecutablePath() {
    const candidates = [
        process.env.CHECKIN_BROWSER,
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    ].filter(Boolean);
    const hit = candidates.find((p) => fs.existsSync(p));
    if (!hit) throw new Error("未找到 Chrome 浏览器，请设置 CHECKIN_BROWSER");
    return hit;
}

const REPO = path.resolve(import.meta.dirname, "..", "..");
const DIST = path.join(REPO, "dist");
const PLUGIN_ID = "siyuan-checkin";
const HOST = "127.0.0.1";
const DEFAULT_PORT = Number(process.env.CHECKIN_PREVIEW_PORT || 43929);
const DEFAULT_WORKSPACE = process.env.CHECKIN_PREVIEW_WORKSPACE
    ? path.resolve(process.env.CHECKIN_PREVIEW_WORKSPACE)
    : "D:\\思源插件配套\\测试工作区\\.isolated-workspaces\\siyuan-checkin";
const META_FILE = path.join(REPO, ".artifacts", "live-preview.json");
const MARKER_FILE = "siyuan-checkin-preview-isolated.json";

const SYNC_ONLY = process.argv.includes("--sync");
const RESET = process.argv.includes("--reset");
const HEADED = process.argv.includes("--headed");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function checkPortFree(port) {
    return new Promise((resolve) => {
        const srv = net.createServer();
        srv.once("error", () => resolve(false));
        srv.listen({host: HOST, port, exclusive: true}, () => srv.close(() => resolve(true)));
    });
}

function copyDistAndWritePetals(workspace) {
    if (!fs.existsSync(path.join(DIST, "index.js"))) {
        throw new Error("dist/index.js 不存在，请先运行 pnpm run build");
    }
    const pluginDst = path.join(workspace, "data", "plugins", PLUGIN_ID);
    fs.mkdirSync(pluginDst, {recursive: true});
    fs.cpSync(DIST, pluginDst, {recursive: true});

    const manifest = JSON.parse(fs.readFileSync(path.join(DIST, "plugin.json"), "utf8"));
    const petalsPath = path.join(workspace, "data", "storage", "petal", "petals.json");
    let petals = [];
    if (fs.existsSync(petalsPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(petalsPath, "utf8"));
            if (Array.isArray(parsed)) petals = parsed.filter((p) => p?.name !== PLUGIN_ID);
        } catch {}
    }
    petals.push({
        name: PLUGIN_ID,
        displayName: manifest.displayName?.["zh_CN"] || manifest.displayName?.default || "小驴打卡",
        version: manifest.version || "18.45.0",
        enabled: true,
        incompatible: false,
        disabledInPublish: true,
        userDisabledInPublish: false,
        disallowInstall: false,
        js: "",
        css: "",
        i18n: null,
        kernel: {js: "", existed: true, incompatible: false},
    });
    fs.mkdirSync(path.dirname(petalsPath), {recursive: true});
    fs.writeFileSync(petalsPath, JSON.stringify(petals, null, "\t"));
}

function prepareIsolatedWorkspace(workspace) {
    const resolved = path.resolve(workspace);
    if (!/^[dD]:[\\/]/.test(resolved)) {
        throw new Error(`根据安全约束，隔离环境工作区必须位于 D 盘，当前为: ${resolved}`);
    }
    fs.mkdirSync(path.join(resolved, "data", "storage", "petal"), {recursive: true});
    const confPath = path.join(resolved, "conf", "conf.json");
    if (!fs.existsSync(confPath)) {
        fs.mkdirSync(path.dirname(confPath), {recursive: true});
        fs.writeFileSync(confPath, JSON.stringify({api: {token: "lv-checkin-preview-token"}}, null, 2));
    }
    fs.writeFileSync(
        path.join(resolved, MARKER_FILE),
        JSON.stringify({createdBy: "siyuan-checkin-live-preview", createdAt: new Date().toISOString()}, null, 2) + "\n",
    );
}

/* T-1992：联动插件真实装机 —— 从宿主真实工作区拷贝已构建的联动插件 dist 到隔离
   工作区并登记 petals.json（enabled），让思阅/思播/番茄钟/Task Horizon 等联动
   在隔离环境里真实可探测。源缺失的插件逐个跳过并如实汇报，绝不臆造。 */
const COMPANION_PLUGIN_IDS = [
    "siyuan-sireader",
    "siyuan-speed-switch",
    "siyuan-plugin-docktomato",
    "siyuan-plugin-task-horizon",
    "siyuan-lv-cards",
    "siyuan-exam",
    "siyuan-glean",
    "xiaolv-common",
];
const COMPANION_SOURCE_ROOTS = ["D:\\SIYUAN\\data\\plugins", "D:\\biji\\SiYuan\\data\\plugins"];

function installCompanionPlugins(workspace) {
    const pluginRoot = path.join(workspace, "data", "plugins");
    fs.mkdirSync(pluginRoot, {recursive: true});
    const petalsPath = path.join(workspace, "data", "storage", "petal", "petals.json");
    let petals = [];
    if (fs.existsSync(petalsPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(petalsPath, "utf8"));
            if (Array.isArray(parsed)) petals = parsed;
        } catch {}
    }
    const installed = [];
    const skipped = [];
    for (const pluginId of COMPANION_PLUGIN_IDS) {
        if (pluginId === PLUGIN_ID) continue;
        const sourceRoot = COMPANION_SOURCE_ROOTS.map((rootDir) => path.join(rootDir, pluginId)).find((candidate) => fs.existsSync(path.join(candidate, "plugin.json")));
        if (!sourceRoot) {
            skipped.push(pluginId);
            continue;
        }
        const target = path.join(pluginRoot, pluginId);
        fs.cpSync(sourceRoot, target, {recursive: true});
        let displayName = pluginId;
        let version = "0.0.0";
        try {
            const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, "plugin.json"), "utf8"));
            displayName = manifest.displayName?.["zh_CN"] || manifest.displayName?.default || manifest.name || pluginId;
            version = manifest.version || version;
        } catch {}
        petals = petals.filter((entry) => entry?.name !== pluginId);
        petals.push({
            name: pluginId,
            displayName,
            version,
            enabled: true,
            incompatible: false,
            disabledInPublish: true,
            userDisabledInPublish: false,
            disallowInstall: false,
            js: "",
            css: "",
            i18n: null,
            kernel: {js: "", existed: true, incompatible: false},
        });
        installed.push(`${displayName} v${version}`);
    }
    fs.mkdirSync(path.dirname(petalsPath), {recursive: true});
    fs.writeFileSync(petalsPath, JSON.stringify(petals, null, "\t"));
    return {installed, skipped};
}

function readWorkspaceToken(workspace) {
    try {
        const conf = JSON.parse(fs.readFileSync(path.join(workspace, "conf", "conf.json"), "utf8"));
        return conf?.api?.token || "";
    } catch {
        return "";
    }
}

function makeApi(base, getToken) {
    return async function api(route, body = {}) {
        const headers = {"Content-Type": "application/json"};
        const tk = getToken();
        if (tk) headers.Authorization = `Token ${tk}`;
        const res = await fetch(`${base}${route}`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(25000),
        });
        return res.json();
    };
}

async function waitKernelReady(base, api) {
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
        try {
            const p = await api("/api/system/bootProgress");
            if (p?.code === 0 && Number(p?.data?.progress) >= 100) return;
        } catch {}
        await sleep(300);
    }
    throw new Error(`隔离思源内核启动超时 (${base})`);
}

async function shutdownKernel(api, child) {
    try {
        await api("/api/system/exit", {force: true});
    } catch {}
    await Promise.race([
        new Promise((resolve) => {
            if (!child || child.exitCode !== null) resolve(true);
            else child.once("exit", () => resolve(true));
        }),
        sleep(5000),
    ]);
    try {
        if (child && child.exitCode === null) child.kill("SIGKILL");
    } catch {}
}

function spawnKernel(kernel, appDir, workspace, port, detachProcess = false) {
    if (detachProcess && process.platform === "win32") {
        const pidStr = execSync(
            `powershell.exe -NoProfile -Command "(Start-Process -FilePath '${kernel}' -ArgumentList 'serve','--workspace','${workspace.replace(/'/g, "''")}','--wd','${appDir.replace(/'/g, "''")}','--port','${port}','--lang','zh_CN' -WindowStyle Hidden -PassThru).Id"`,
            {encoding: "utf8"},
        ).trim();
        return {child: {pid: Number(pidStr) || undefined, exitCode: null, unref() {}, once() {}, kill() {}}};
    }
    const child = spawn(
        kernel,
        ["serve", "--workspace", workspace, "--wd", appDir, "--port", String(port), "--lang", "zh_CN"],
        {
            detached: detachProcess,
            windowsHide: true,
            stdio: detachProcess ? "ignore" : ["ignore", "pipe", "pipe"],
            env: {...process.env, SIYUAN_WORKSPACE_PATH: workspace},
        },
    );
    return {child};
}

function localDateKeyOffset(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

async function main() {
    const workspace = DEFAULT_WORKSPACE;
    const port = DEFAULT_PORT;
    const base = `http://${HOST}:${port}`;
    const desktopUrl = `${base}/stage/build/desktop/`;
    const mobileUrl = `${base}/stage/build/mobile/`;

    // 若指定 --sync，直接热更新 dist/ 到正在运行的 D 盘隔离工作区
    if (SYNC_ONLY) {
        prepareIsolatedWorkspace(workspace);
        copyDistAndWritePetals(workspace);
        console.log(`[preview:sync] 已将最新 dist/ 同步至 D 盘隔离工作区: ${workspace}`);
        console.log(`[preview:sync] 请在浏览器直接按 F5 刷新查看: ${desktopUrl}`);
        return;
    }

    // 检查端口是否已有存活内核
    const portFreeBefore = await checkPortFree(port);
    if (!portFreeBefore) {
        const existingToken = readWorkspaceToken(workspace);
        const existingApi = makeApi(base, () => existingToken);
        if (!RESET) {
            try {
                const ver = await existingApi("/api/system/version");
                if (ver?.code === 0) {
                    copyDistAndWritePetals(workspace);
                    console.log(`[preview:isolated] 检测到端口 ${port} 隔离内核已在运行，已同步最新 dist/ 产物！`);
                    console.log(`  桌面端直达: ${desktopUrl}`);
                    console.log(`  移动端直达: ${mobileUrl}`);
                    console.log(`  D盘工作区:  ${workspace}`);
                    return;
                }
            } catch {}
        }
        try {
            await existingApi("/api/system/exit", {force: true});
        } catch {}
        for (let i = 0; i < 10 && !(await checkPortFree(port)); i += 1) {
            await sleep(300);
        }
        if (!(await checkPortFree(port)) && process.platform === "win32") {
            try {
                execSync(
                    `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='SiYuan-Kernel.exe'\\" | Where-Object { $_.CommandLine -like '*--port ${port}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`,
                    {stdio: "ignore"},
                );
            } catch {}
            for (let i = 0; i < 20 && !(await checkPortFree(port)); i += 1) {
                await sleep(300);
            }
        }
    }

    if (RESET && fs.existsSync(path.join(workspace, MARKER_FILE))) {
        fs.rmSync(workspace, {recursive: true, force: true});
    }

    const {kernel, appDir} = resolveInstall();
    prepareIsolatedWorkspace(workspace);
    const companions = installCompanionPlugins(workspace);
    copyDistAndWritePetals(workspace);

    console.log(`[preview:isolated] D 盘隔离工作区: ${workspace}`);
    console.log(`[preview:isolated] 隔离内核端口:   ${base}（区别于小驴管家 43919 与主思源 6806）`);
    if (companions.installed.length) console.log(`[preview:isolated] 已安装联动插件: ${companions.installed.join(" · ")}`);
    if (companions.skipped.length) console.log(`[preview:isolated] 未找到本机构建、已跳过: ${companions.skipped.join(" · ")}`);

    let token = "";
    const api = makeApi(base, () => token);

    // 1. 后台常驻启动隔离内核（无 accessAuthCode，浏览器免密直达）
    let proc = spawnKernel(kernel, appDir, workspace, port, true);
    await waitKernelReady(base, api);
    await sleep(600);
    token = readWorkspaceToken(workspace);

    // 2. 开启集市信任并启用小驴打卡插件
    const trustRes = await api("/api/setting/setBazaar", {trust: true});
    if (trustRes?.code !== 0) throw new Error(`setBazaar 失败: ${JSON.stringify(trustRes)}`);
    const enableRes = await api("/api/petal/setPetalEnabled", {packageName: PLUGIN_ID, enabled: true});
    if (enableRes?.code !== 0) throw new Error(`setPetalEnabled 失败: ${JSON.stringify(enableRes)}`);
    const petalsRes = await api("/api/petal/loadPetals", {frontend: "desktop"});
    const loadedPetal = (petalsRes?.data || []).find((item) => item.name === PLUGIN_ID);
    if (!loadedPetal || !(loadedPetal.js || "").length) {
        throw new Error(`内核未成功下发 ${PLUGIN_ID}`);
    }

    // 3. 准备演示笔记本与思源文档
    const lsNb = await api("/api/notebook/lsNotebooks");
    const notebooks = lsNb?.data?.notebooks ?? [];
    for (const nb of notebooks) {
        if (/用户指南|User Guide/i.test(nb.name)) {
            await api("/api/notebook/removeNotebook", {notebook: nb.id, callback: ""}).catch(() => undefined);
        }
    }
    let demoNb = notebooks.find((n) => n.name === "📒 小驴打卡实测演练本");
    if (!demoNb) {
        const createdNb = await api("/api/notebook/createNotebook", {name: "📒 小驴打卡实测演练本"});
        demoNb = createdNb?.data?.notebook;
    }
    const notebookId = demoNb.id;

    // 创建 2 篇演练文档：📖 阅读成长笔记（锚点+备注+报告+常驻摘要）、🧩 文档内打卡嵌入块演练（Protyle 渲染块）
    const anchorDocRes = await api("/api/filetree/createDocWithMd", {
        notebook: notebookId,
        path: "/📖 阅读成长笔记",
        markdown: "# 📖 阅读成长笔记\n\n> 本篇文档已与小驴打卡「精读系统思考」项目绑定：支持写入 `custom-lv-checkin` 块属性、打卡时自动在文末追加阅读感悟、驻留每日打卡摘要行，以及追加 Markdown 统计报告。\n",
    });
    const anchorDocId = String(anchorDocRes?.data || "");

    const embedDocRes = await api("/api/filetree/createDocWithMd", {
        notebook: notebookId,
        path: "/🧩 文档内打卡嵌入块演练",
        markdown: [
            "# 🧩 文档内打卡嵌入块演练",
            "",
            "在任意思源文档中插入 `checkin` 代码块，即可将小驴打卡嵌入笔记正文中直接交互打卡：",
            "",
            "```checkin",
            "view: today",
            "itemIds: item-read-systems, item-morning-run, item-water-8cups",
            "title: 今日核心习惯内嵌面板",
            "```",
            "",
        ].join("\n"),
    });
    const embedDocId = String(embedDocRes?.data || "");

    // 构造饱满的 30 天多源真实打卡数据与全形态事项数据（T-1992）
    const todayKey = localDateKeyOffset(0);
    const nowIso = new Date().toISOString();
    const createdAtIso = new Date(Date.now() - 60 * 86400_000).toISOString();
    const createdDateKey = localDateKeyOffset(-60);

    const mkItem = (over) => ({
        id: over.id,
        name: over.name,
        icon: over.icon,
        kind: over.kind,
        target: over.target,
        unit: over.unit,
        group: over.group || "",
        ...(over.recordStep ? {recordStep: over.recordStep} : {}),
        ...(over.quickSteps ? {quickSteps: over.quickSteps} : {}),
        ...(over.direction ? {direction: over.direction} : {}),
        ...(over.noteAnchor ? {noteAnchor: over.noteAnchor} : {}),
        ...(over.completionSource ? {completionSource: over.completionSource} : {}),
        ...(over.tomatoMode ? {tomatoMode: over.tomatoMode} : {}),
        schedule: over.schedule,
        sortOrder: over.sortOrder ?? 0,
        archived: over.archived ?? false,
        createdAt: createdAtIso,
        updatedAt: nowIso,
        createdDate: createdDateKey,
        revisions: [{
            effectiveDate: createdDateKey,
            kind: over.kind,
            target: over.target,
            unit: over.unit,
            ...(over.recordStep ? {recordStep: over.recordStep} : {}),
            direction: over.direction === "atMost" ? "atMost" : "atLeast",
            schedule: over.schedule,
        }],
        archivePeriods: [],
    });

    const items = [
        mkItem({id: "item-read-systems", name: "精读系统思考", icon: "📚", kind: "duration", target: 30, unit: "分钟", group: "学习成长", recordStep: 15, quickSteps: [15, 30, 45], schedule: {type: "daily"}, noteAnchor: {blockId: anchorDocId, appendNotes: true}, sortOrder: 0}),
        mkItem({id: "item-morning-run", name: "晨间有氧慢跑", icon: "🏃", kind: "binary", target: 1, unit: "次", group: "运动健康", recordStep: 1, schedule: {type: "daily"}, sortOrder: 1}),
        mkItem({id: "item-water-8cups", name: "足量温水摄入", icon: "💧", kind: "count", target: 2000, unit: "毫升", group: "运动健康", recordStep: 250, quickSteps: [250, 500, 1000], schedule: {type: "daily"}, sortOrder: 2}),
        mkItem({id: "item-limit-short-video", name: "睡前刷短视频管控", icon: "📵", kind: "duration", target: 20, unit: "分钟", group: "精力节律", recordStep: 5, quickSteps: [5, 10, 15], direction: "atMost", schedule: {type: "daily"}, sortOrder: 3}),
        mkItem({id: "item-video-course", name: "视频课程进修", icon: "🎓", kind: "duration", target: 45, unit: "分钟", group: "专业技能", recordStep: 15, quickSteps: [15, 30, 45], schedule: {type: "daily"}, sortOrder: 4}),
        mkItem({id: "item-weread-reading", name: "微信读书·每天读一会", icon: "📖", kind: "duration", target: 25, unit: "分钟", group: "学习成长", recordStep: 10, quickSteps: [10, 25, 40], schedule: {type: "daily"}, sortOrder: 5}),
        mkItem({id: "item-deep-work", name: "深度工作专注", icon: "🧠", kind: "duration", target: 50, unit: "分钟", group: "数字生活", recordStep: 25, quickSteps: [25, 50], completionSource: "tomato", tomatoMode: "minutes", schedule: {type: "daily"}, sortOrder: 6}),
        mkItem({id: "item-strength-training", name: "力量训练", icon: "🏋️", kind: "binary", target: 1, unit: "次", group: "运动健康", recordStep: 1, schedule: {type: "quota", quota: {period: "week", amount: 3, countMode: "dates"}}, sortOrder: 7}),
        mkItem({id: "item-weekly-review", name: "周度复盘与收件箱清空", icon: "🧭", kind: "binary", target: 1, unit: "次", group: "学习成长", recordStep: 1, schedule: {type: "interval", intervalDays: 3, anchorDate: localDateKeyOffset(-27)}, sortOrder: 8}),
        mkItem({id: "item-english-listening", name: "英语听力磨耳朵", icon: "🎧", kind: "duration", target: 20, unit: "分钟", group: "学习成长", recordStep: 10, quickSteps: [10, 20, 30], schedule: {type: "daily"}, sortOrder: 9}),
        mkItem({id: "item-journal-note", name: "晚间日记与反思", icon: "🌙", kind: "duration", target: 15, unit: "分钟", group: "精力节律", recordStep: 5, schedule: {type: "daily"}, sortOrder: 10}),
        mkItem({id: "item-ledger-entries", name: "记账与流水整理", icon: "🧾", kind: "count", target: 5, unit: "笔", group: "数字生活", recordStep: 1, schedule: {type: "daily"}, sortOrder: 11}),
        mkItem({id: "item-archived-meditation", name: "午间正念呼吸（第一阶段已结项）", icon: "🧘", kind: "duration", target: 15, unit: "分钟", group: "精力节律", recordStep: 5, schedule: {type: "daily"}, sortOrder: 12, archived: true}),
        mkItem({id: "item-archived-gym", name: "旧健身房计划（已归档）", icon: "🎫", kind: "binary", target: 1, unit: "次", group: "运动健康", recordStep: 1, schedule: {type: "daily"}, sortOrder: 13, archived: true}),
    ];

    // 事件：确定性伪随机（index 驱动，可复现），8 种来源全覆盖
    const events = [];
    let evSeq = 0;
    const evId = () => `ev-seed-${String(++evSeq).padStart(4, "0")}`;
    const at = (offset, hours, minutes) => new Date(`${localDateKeyOffset(offset)}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`).toISOString();
    const push = (event) => events.push({kind: "checkin", source: "manual", ...event, id: evId()});

    for (let offset = -29; offset <= -1; offset += 1) {
        const dow = (new Date(`${localDateKeyOffset(offset)}T12:00:00`).getDay() + 7) % 7; // 0=周一
        // 精读系统思考：25/29 天完成；思阅联动每 3 天一次；跳过 2 天带原因
        if (offset === -8 || offset === -19) {
            push({itemId: "item-read-systems", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 21, 10), value: 0, unit: "分钟", kind: "skip", source: "manual", note: offset === -8 ? "#生病休息 感冒早睡主动顺延" : "#差旅外出 高铁上不便阅读"});
        } else if (offset % 3 === 0) {
            push({itemId: "item-read-systems", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 21, 15), value: 40, unit: "分钟", source: "sireader", note: `#思阅阅读 《系统之美》第 ${((offset % 8) + 1)} 章 高亮 12 处`, energy: 4, externalRef: `sireader:${localDateKeyOffset(offset)}`});
        } else {
            push({itemId: "item-read-systems", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 21, 15), value: offset % 2 === 0 ? 35 : 30, unit: "分钟", source: "manual", note: "#深度阅读 思考反馈回路与时滞", energy: (offset % 5) + 1});
        }
        // 晨间有氧慢跑：约 6 成天数
        if (offset % 5 !== 2) {
            push({itemId: "item-morning-run", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 6, 40), value: 1, unit: "次", source: "manual", note: offset % 2 === 0 ? "#5公里轻松跑 配速 5'45\"" : "#户外晨跑 心率区间 2", energy: 5});
        }
        // 足量温水摄入：每天达标或接近
        push({itemId: "item-water-8cups", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 14, 15), value: offset % 4 === 0 ? 1500 : 2000, unit: "毫升", source: "manual", note: offset % 4 === 0 ? "下午开会只喝了 1500ml" : "日常饮水达标"});
        // 睡前刷短视频管控（上限型）：多数 10~15 分钟；3 天思播联动同步且超标
        if (offset === -4 || offset === -10 || offset === -22) {
            push({itemId: "item-limit-short-video", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 22, 45), value: offset === -22 ? 42 : 35, unit: "分钟", source: "siplayer", note: "#思播播放 短视频时长自动同步，超时未收敛", externalRef: `siplayer:${localDateKeyOffset(offset)}`});
        } else {
            push({itemId: "item-limit-short-video", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 22, 30), value: offset % 3 === 0 ? 15 : 10, unit: "分钟", source: "manual", note: "准时放下手机，线性收敛"});
        }
        // 视频课程进修：周一/三/五思播联动
        if (dow % 2 === 0) {
            push({itemId: "item-video-course", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 20, 5), value: 45, unit: "分钟", source: "siplayer", note: `#思播播放 《CSAPP》Lecture ${10 + (offset % 12)} 深入理解计算机系统`, energy: 4, externalRef: `siplayer:lecture:${localDateKeyOffset(offset)}`});
        }
        // 微信读书：每天读一会，微信读书适配器同步
        push({itemId: "item-weread-reading", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 13, 20), value: 20 + (offset % 4) * 5, unit: "分钟", source: "weread", note: `#微信读书 《掌控习惯》第 ${1 + (offset % 12)} 章 划线 ${1 + (offset % 5)} 处`, externalRef: "weread:book:270ef2a5"});
        // 深度工作专注：工作日番茄钟联动 2 个番茄（50 分钟），周六 1 个
        if (dow <= 4) {
            push({itemId: "item-deep-work", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 10, 0), value: 50, unit: "分钟", source: "tomato", note: "#番茄钟 25 分钟 ×2，中间休息 5 分钟", externalRef: `docktomato:${localDateKeyOffset(offset)}:am`});
        } else if (dow === 5) {
            push({itemId: "item-deep-work", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 10, 0), value: 25, unit: "分钟", source: "tomato", note: "#番茄钟 周六轻量专注 1 个番茄", externalRef: `docktomato:${localDateKeyOffset(offset)}:am`});
        }
        // 力量训练（每周 3 次配额）：周一/三/六
        if (dow === 0 || dow === 2 || dow === 5) {
            push({itemId: "item-strength-training", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 19, 0), value: 1, unit: "次", source: "manual", note: offset % 2 === 0 ? "#力量训练 深蹲 5×5 硬拉 3×5" : "#力量训练 卧推 5×5 引体 3×8", energy: 4});
        }
        // 周度复盘（每 3 天间隔排期）：锚点对齐
        if ((offset + 27) % 3 === 0) {
            push({itemId: "item-weekly-review", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 21, 50), value: 1, unit: "次", source: "manual", note: "#周复盘 清空收件箱，下周只做三件事", energy: 3});
        }
        // 英语听力：周二/四/日由外部 API（播放器同步）写入
        if (dow === 1 || dow === 3 || dow === 6) {
            push({itemId: "item-english-listening", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 8, 10), value: 20, unit: "分钟", source: "api", note: "接口写入 · 播客播放器自动同步", externalRef: `api:media-log:${localDateKeyOffset(offset)}`});
        }
        // 晚间日记与反思：叶归 LifeLog 适配器从日记时间线摄取
        push({itemId: "item-journal-note", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 22, 50), value: 15, unit: "分钟", source: "yeguif", note: "晚间日记：写复盘与明日三件事", externalRef: `yeguif:20261031-seed-${Math.abs(offset)}`});
        // 记账与流水整理：每周三整理一笔 + 周末导入批量
        if (dow === 2) {
            push({itemId: "item-ledger-entries", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 18, 30), value: 5, unit: "笔", source: "manual", note: "整理本周信用卡流水"});
        }
        if (dow === 6 && offset <= -7) {
            push({itemId: "item-ledger-entries", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 17, 0), value: 10, unit: "笔", source: "import", note: "CSV 批量导入上周账单"});
        }
        // 已归档项目的历史事件（保证归档页与洞察历史也有内容）
        if (offset % 2 === 0) {
            push({itemId: "item-archived-meditation", localDate: localDateKeyOffset(offset), occurredAt: at(offset, 12, 30), value: 15, unit: "分钟", source: "manual", note: "午间正念 15 分钟"});
        }
    }

    // 今日预置：半程饮水（1000/2000ml）；其余全部待完成 —— 留给真实交互打卡写入思源文档与日记
    push({itemId: "item-water-8cups", localDate: todayKey, occurredAt: nowIso, value: 1000, unit: "毫升", source: "manual", note: "上午两杯温水"});

    const storePayload = {
        version: 2,
        items,
        events,
        ruleRevisions: [],
        journalTemplates: [],
        itemTombstones: [],
    };

    // 事项：全形态（once/annual/annual-lunar/monthly/weekly/halfyearly/interval + 关联项目 + 完成历史）
    const mkOccasion = (over) => ({
        id: over.id,
        name: over.name,
        kind: over.kind,
        date: over.date,
        recurrence: over.recurrence,
        ...(over.calendar ? {calendar: over.calendar} : {}),
        ...(over.monthlySubtype ? {monthlySubtype: over.monthlySubtype} : {}),
        ...(over.intervalUnit ? {intervalUnit: over.intervalUnit} : {}),
        ...(over.intervalCount ? {intervalCount: over.intervalCount} : {}),
        ...(over.weekday !== undefined ? {weekday: over.weekday} : {}),
        remindBeforeDays: over.remindBeforeDays,
        note: over.note || "",
        enabled: over.enabled ?? true,
        completedDates: over.completedDates || [],
        ...(over.linkedItemId ? {linkedItemId: over.linkedItemId} : {}),
        createdAt: createdAtIso,
        updatedAt: nowIso,
    });
    const occasionsPayload = {
        version: 1,
        occasions: [
            mkOccasion({id: "occ-family-birthday", name: "家人纪念日聚餐", kind: "anniversary", date: localDateKeyOffset(2), recurrence: "once", remindBeforeDays: 3, note: "提前预订餐厅与鲜花"}),
            mkOccasion({id: "occ-annual-review", name: "年度个人体系大复盘", kind: "scheduled", date: localDateKeyOffset(5), recurrence: "annual", remindBeforeDays: 7, note: "汇总全年阅读笔记与习惯韧性曲线"}),
            mkOccasion({id: "occ-half-marathon", name: "秋季城市半程马拉松", kind: "scheduled", date: localDateKeyOffset(14), recurrence: "once", remindBeforeDays: 14, linkedItemId: "item-morning-run", note: "赛前保持轻松跑与充足睡眠", completedDates: []}),
            mkOccasion({id: "occ-mom-birthday-lunar", name: "妈妈生日（农历）", kind: "birthday", date: `${new Date().getFullYear()}-09-12`, recurrence: "annual", calendar: "lunar", remindBeforeDays: 7, note: "提前订蛋糕；农历生日，表单里可核对公历换算", completedDates: []}),
            mkOccasion({id: "occ-mortgage-repay", name: "房贷还款日", kind: "scheduled", date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-15`, recurrence: "monthly", monthlySubtype: "byday", remindBeforeDays: 3, note: "确认扣款账户余额充足", completedDates: [localDateKeyOffset(-30), localDateKeyOffset(-61), localDateKeyOffset(-92)]}),
            mkOccasion({id: "occ-team-weekly", name: "团队周报提交", kind: "scheduled", date: localDateKeyOffset(1), recurrence: "weekly", weekday: 5, remindBeforeDays: 0, note: "每周五下班前提交", completedDates: []}),
            mkOccasion({id: "occ-car-insurance", name: "车辆保险续保", kind: "scheduled", date: `${new Date().getFullYear()}-12-20`, recurrence: "halfyearly", remindBeforeDays: 30, note: "对比报价后再续保", completedDates: []}),
            mkOccasion({id: "occ-health-checkup", name: "年度体检复查", kind: "scheduled", date: localDateKeyOffset(-20), recurrence: "interval", intervalUnit: "day", intervalCount: 90, remindBeforeDays: 7, note: "复查血压与血脂指标", completedDates: [localDateKeyOffset(-20)]}),
            mkOccasion({id: "occ-retired-project", name: "旧房子租约到期（已停用）", kind: "scheduled", date: `${new Date().getFullYear() + 1}-03-01`, recurrence: "once", remindBeforeDays: 30, enabled: false, note: "停用示例：不再提醒但保留历史"}),
        ],
    };

    const storageDir = path.join(workspace, "data", "storage", "petal", PLUGIN_ID);
    fs.mkdirSync(storageDir, {recursive: true});
    fs.writeFileSync(path.join(storageDir, "checkin-store"), JSON.stringify(storePayload, null, 2));
    fs.writeFileSync(path.join(storageDir, "checkin-occasions"), JSON.stringify(occasionsPayload, null, 2));

    // 4. 启动 Chrome 在隔离桌面端执行真实点击落地（绑定日记本 + 打卡写锚点文档/Daily Note + 写报告/常驻摘要 + 保存桌面页签布局）
    const executablePath = resolveBrowserExecutablePath();
    const browser = await chromium.launch({
        executablePath,
        headless: !HEADED,
        args: ["--disable-gpu", "--no-first-run", "--no-default-browser-check", "--window-position=-32000,-32000"],
    });
    try {
        const ctx = await browser.newContext({viewport: {width: 1440, height: 900}, locale: "zh-CN"});
        const page = await ctx.newPage();
        await page.goto(desktopUrl, {waitUntil: "domcontentloaded", timeout: 45000});
        await page.waitForFunction(
            () => typeof window.siyuanCheckin?.whenReady === "function",
            undefined,
            {timeout: 45000},
        );
        const isReady = await page.evaluate(() => window.siyuanCheckin.whenReady());
        if (!isReady) throw new Error("小驴打卡插件未完成初始化");
        // 等思源工作区布局与联动插件全部挂载完（T-1992：8 个联动插件各有首启引导）
        await page.waitForFunction(() => !document.querySelector("#loading") && (document.querySelector("#layouts")?.children.length || 0) > 0, null, {timeout: 60000});
        await sleep(2500);
        // 多轮清场：思源引导 + 各联动插件的首启 onboarding 弹窗（挂载有先后，需反复收）
        for (let round = 0; round < 6; round += 1) {
            await page.evaluate(() => {
                document.querySelector("#ignoreAddMicrosoftDefenderExclusion")?.click?.();
                document.querySelectorAll(".onboarding, .b3-dialog--open, .b3-dialog__scrim").forEach((el) => el.remove());
            });
            await sleep(700);
            const remaining = await page.evaluate(() => document.querySelectorAll(".b3-dialog--open").length);
            if (remaining === 0) break;
            await page.keyboard.press("Escape").catch(() => undefined);
            await sleep(500);
        }
        await page.evaluate(() => {
            document.querySelectorAll(".onboarding, .b3-dialog--open, .b3-dialog__scrim").forEach((el) => el.remove());
        });

        // 配置日记本与常驻摘要文档，并触发真实打卡让数据落入思源文档
        await page.evaluate(async ({nbId, anchorId}) => {
            const plugin = window.siyuan.ws.app.plugins.find((p) => p.name === "siyuan-checkin");
            plugin.journalIntegrationPref = {
                ...plugin.journalIntegrationPref,
                targetMode: "daily",
                notebookId: nbId,
                docId: anchorId,
            };
            plugin.lifelogJournal = {
                enabled: true,
                choice: "on",
                sectionHeader: "打卡流水",
            };
            plugin.summaryResident = {
                enabled: true,
                docId: anchorId,
            };
            await plugin.persistViewPreferences();
            plugin.openTabPage();
        }, {nbId: notebookId, anchorId: anchorDocId});

        await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--today", {timeout: 20000});

        // 在今日页对「精读系统思考」录入 30 分钟 + 读书笔记，真实触发锚点文档写入 + Daily Note LifeLog 分节写入 + 常驻摘要更新
        const readCard = page.locator(".lc-checkin-tab-host .lc-checkin__item").filter({hasText: "精读系统思考"});
        await readCard.locator("[data-action='toggle-exact']").click();
        await readCard.locator(".lc-checkin__amount").fill("30");
        await readCard.locator(".lc-checkin__record-note").fill("#深度阅读 第一章：反馈回路与系统时滞");
        await readCard.locator("[data-exact-entry] [data-action='record']").click();
        await sleep(1800);

        // 对「晨间有氧慢跑」一键打卡，真实写入第 2 条 Daily Note LifeLog
        const runCard = page.locator(".lc-checkin-tab-host .lc-checkin__item").filter({hasText: "晨间有氧慢跑"});
        await runCard.locator("[data-action='record']").first().click();
        await sleep(1800);

        // 切到设置页触发一次「向绑定文档追加报告」与「立即写入今日摘要」，让《📖 阅读成长笔记》同时具备完整落地内容
        await page.locator(".lc-checkin-tab-host [data-mobile-nav='more']").first().click();
        await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--more", {timeout: 15000});
        await page.locator(".lc-checkin-tab-host [data-more-action='appearance']").first().click();
        await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--settings", {timeout: 15000});
        await page.evaluate(() => {
            document.querySelectorAll(".lc-checkin-tab-host .lc-checkin--settings details[data-settings-group]").forEach((d) => d.setAttribute("open", ""));
        });
        const diaryPanel = page.locator(".lc-checkin-tab-host [data-source-panel='diary']");
        if ((await diaryPanel.getAttribute("open")) === null) await diaryPanel.locator("> summary").click();
        await diaryPanel.locator("[data-action='toggle-create-diary-doc']").click();
        const diaryNbSelect = diaryPanel.locator("select[data-diary-notebook]");
        await diaryNbSelect.selectOption(notebookId);
        await diaryPanel.locator("input[data-diary-create-title]").fill("📊 每周打卡汇总报告");
        await diaryPanel.locator("[data-action='create-diary-doc']").click();
        await sleep(800);
        await diaryPanel.locator("[data-action='write-diary-report']").click();
        await sleep(1000);

        const summaryPanel = page.locator(".lc-checkin-tab-host [data-source-panel='summary']");
        if ((await summaryPanel.getAttribute("open")) === null) await summaryPanel.locator("> summary").click();
        await summaryPanel.locator("input[data-summary-doc]").fill(anchorDocId);
        await summaryPanel.locator("[data-action='save-summary-doc']").click();
        const summaryToggle = summaryPanel.locator("input[data-summary-toggle]");
        if (!(await summaryToggle.isChecked())) await summaryToggle.check();
        await summaryPanel.locator("[data-action='write-summary-now']").click();
        await sleep(1000);

        // 切回今日页，保持打开网页时首屏展示「今日」与左侧演练本
        await page.locator(".lc-checkin-tab-host [data-mobile-nav='today']").first().click();
        await page.waitForSelector(".lc-checkin-tab-host .lc-checkin--today", {timeout: 15000});

        await sleep(2000);
    } finally {
        await browser.close();
    }

    fs.mkdirSync(path.dirname(META_FILE), {recursive: true});
    fs.writeFileSync(
        META_FILE,
        JSON.stringify(
            {
                desktopUrl,
                mobileUrl,
                baseUrl: base,
                port,
                workspace,
                pid: proc.child.pid,
                notebookId,
                anchorDocId,
                embedDocId,
                updatedAt: new Date().toISOString(),
            },
            null,
            2,
        ),
    );

    console.log("\n================================================================================");
    console.log("✅ 小驴打卡 · D 盘持久隔离实测网页已就绪（常驻后台运行，随时可在浏览器打开）");
    console.log(`  🌐 桌面端测试网页: ${desktopUrl}`);
    console.log(`  📱 移动端测试网页: ${mobileUrl}`);
    console.log(`  📂 D 盘隔离工作区: ${workspace}`);
    console.log(`  🔌 独立端口:       ${port}（与小驴管家 43919、主思源 6806 互不干扰）`);
    console.log(`  ⚙️ 后台内核 PID:   ${proc.child.pid}`);
    console.log("  💡 后续每次改完代码只需运行 `pnpm run build` + `pnpm run preview:sync`，刷新网页即可看到最新效果！");
    console.log("================================================================================\n");
}

main().catch((err) => {
    console.error("[preview:isolated] 启动失败:", err?.stack || err);
    process.exitCode = 1;
});
