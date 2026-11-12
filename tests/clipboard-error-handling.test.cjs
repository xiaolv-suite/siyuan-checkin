/* R28 剪贴板失败路径覆盖率契约：
   源码中每一处 navigator.clipboard.writeText 调用，必须满足以下之一：
   1) 语句链携带 .catch(...)；
   2) .then(okFn, failFn) 双参拒绝回调；
   3) 被显式 try { ... } catch ( ...) 包裹。
   R22 曾发现 AI 诊断复制裸 await 导致权限被拒时零反馈（已修），本契约防止未来新增调用裸奔。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (["node_modules", "dist", "build", "release"].includes(e.name)) continue;
            walk(p, out);
        } else if (/\.(ts|svelte)$/.test(e.name)) out.push(p);
    }
    return out;
}

function balancedParens(src, openIdx, max = 600) {
    let depth = 0;
    for (let i = openIdx; i < Math.min(src.length, openIdx + max); i++) {
        if (src[i] === "(") depth++;
        else if (src[i] === ")") { depth--; if (depth === 0) return i; }
    }
    return -1;
}

function hasTwoArgThen(src, from) {
    const thenIdx = src.indexOf(".then(", from);
    if (thenIdx < 0 || thenIdx > from + 500) return false;
    const close = balancedParens(src, thenIdx + 5);
    if (close < 0) return false;
    // top-level comma inside the then(...) args → (onOk, onFail) form
    let depth = 0;
    for (let i = thenIdx + 6; i < close; i++) {
        if (src[i] === "(") depth++;
        else if (src[i] === ")") depth--;
        else if (src[i] === "," && depth === 0) return true;
    }
    return false;
}

function uncoveredSites(src) {
    const out = [];
    for (const m of src.matchAll(/clipboard\.writeText\s*\(/g)) {
        const pos = m.index;
        const window = src.slice(pos, pos + 500);
        if (/\.catch\s*\(/.test(window) || hasTwoArgThen(src, pos)) continue;
        // enclosing try: nearest try { before, catch after
        const before = src.slice(Math.max(0, pos - 2500), pos);
        const after = src.slice(pos, pos + 3000);
        const tryIdx = before.lastIndexOf("try {") >= 0 || before.lastIndexOf("try{") >= 0;
        if (tryIdx && /\bcatch\b/.test(after)) continue;
        const line = src.slice(0, pos).split("\n").length;
        out.push(line);
    }
    return out;
}

const offenders = [];
for (const file of walk(path.join(root, "src"))) {
    const src = fs.readFileSync(file, "utf8");
    if (!/clipboard\.writeText\s*\(/.test(src)) continue;
    for (const line of uncoveredSites(src)) {
        offenders.push(`${path.relative(root, file)}:${line}`);
    }
}
assert.deepEqual(offenders, [], `clipboard.writeText 存在未处理拒绝的调用（需 .catch / .then(ok, fail) / try-catch）：${offenders.join("; ")}`);

console.log("clipboard error-handling coverage passed");
