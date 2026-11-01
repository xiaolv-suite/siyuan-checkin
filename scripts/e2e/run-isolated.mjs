#!/usr/bin/env node
/* 隔离靶场 E2E 启动器（pnpm e2e:isolated）：
   自动准备带安全标记的独立临时工作区与空闲本地端口，调用 Playwright 启动真思源内核跑 E2E。 */
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import {spawnSync} from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const defaultWorkspace = path.join(repoRoot, ".artifacts", "e2e-isolated-workspace");

function isPortFree(port, host = "127.0.0.1") {
    return new Promise((resolve) => {
        const srv = net.createServer();
        srv.once("error", () => resolve(false));
        srv.listen({host, port, exclusive: true}, () => srv.close(() => resolve(true)));
    });
}

async function pickFreePort(startPort = 6807) {
    for (let p = startPort; p < startPort + 30; p += 1) {
        if (p === 6808) continue; // 6808 为思源默认本地 HTTPS 保留端口，HTTP 客户端必须避开
        if (await isPortFree(p)) return p;
    }
    throw new Error(`未找到空闲 E2E 端口（已尝试 ${startPort}~${startPort + 29}）`);
}

const workspace = process.env.CHECKIN_E2E_WORKSPACE
    ? path.resolve(process.env.CHECKIN_E2E_WORKSPACE)
    : defaultWorkspace;
fs.mkdirSync(path.dirname(workspace), {recursive: true});
if (workspace === defaultWorkspace && fs.existsSync(path.join(workspace, "checkin-e2e.json"))) {
    fs.rmSync(workspace, {recursive: true, force: true});
}

const port = process.env.CHECKIN_E2E_PORT
    ? Number(process.env.CHECKIN_E2E_PORT)
    : await pickFreePort(6807);

let token = process.env.SIYUAN_TOKEN || process.env.CHECKIN_E2E_TOKEN || "";
if (!token) {
    const confPath = path.join(workspace, "conf", "conf.json");
    if (fs.existsSync(confPath)) {
        try {
            token = JSON.parse(fs.readFileSync(confPath, "utf8"))?.api?.token || "";
        } catch {}
    }
    if (!token) token = `e2e-${crypto.randomBytes(12).toString("hex")}`;
}

const env = {
    ...process.env,
    CHECKIN_E2E_WORKSPACE: workspace,
    CHECKIN_E2E_PORT: String(port),
    SIYUAN_TOKEN: token,
    CHECKIN_E2E_TOKEN: token,
    SIYUAN_E2E_ALLOW_SHARED: "1",
};

const cliPath = path.join(repoRoot, "node_modules", "@playwright", "test", "cli.js");
const rawArgs = process.argv.slice(2);
const keepPreview = rawArgs.includes("--keep");
const extraArgs = rawArgs.filter((arg) => arg !== "--keep");
if (keepPreview && extraArgs.length === 0) {
    const previewRes = spawnSync(
        process.execPath,
        [path.join(repoRoot, "scripts", "e2e", "live-preview.mjs"), "--reset"],
        {cwd: repoRoot, stdio: "inherit", env: process.env},
    );
    process.exit(previewRes.status ?? 0);
}
console.log(`[e2e:isolated] 靶场工作区: ${workspace} · 端口: ${port}`);
const result = spawnSync(
    process.execPath,
    [cliPath, "test", "--config", "playwright.e2e.config.mjs", ...extraArgs],
    {cwd: repoRoot, stdio: "inherit", env},
);
if ((result.status ?? 1) === 0 && keepPreview) {
    spawnSync(
        process.execPath,
        [path.join(repoRoot, "scripts", "e2e", "live-preview.mjs"), "--reset"],
        {cwd: repoRoot, stdio: "inherit", env: process.env},
    );
}
process.exit(result.status ?? 1);
