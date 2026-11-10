/* CSS 层叠行为测试助手（D-718）：
   同时扫描 src/ui/*.scss AST 与 dist/index.css（约 45ms），按（媒体/容器上下文, 单选择器）建立 O(1) 最终胜出声明表，
   支持按任意单选择器（无论是否与其他选择器逗号合组、是否位于 :is(...) 内、是否跨多个同选择器块合并）断言有效样式。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");
const postcss = require(path.join(root, "node_modules", ".pnpm", "postcss@8.5.28", "node_modules", "postcss"));

const ORDER = [
    "tokens",
    "components",
    "workbench",
    "content-responsive",
    "maintenance-responsive",
    "interaction-states",
    "review-detail",
    "review-workspace",
    "reminder-delivery",
    "reminder-density",
    "polish",
];

const norm = (s) => s
    .replace(/\[([^=\]]+)=["']([^"'\]]*)["']\]/g, "[$1=$2]")
    .replace(/\s*([>+~])\s*/g, " $1 ")
    .replace(/\b0+(\.\d+)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
const normVal = (v) => norm(v).replace(/\s*,\s*/g, ", ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");

function splitTopComma(str) {
    const out = [];
    let cur = "", depth = 0;
    for (const ch of str) {
        if (ch === "(" || ch === "[") depth++;
        else if (ch === ")" || ch === "]") depth--;
        if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; }
        else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

function expandIsBranches(sel) {
    const m = sel.match(/:is\(([^()]*)\)/);
    if (!m) return [norm(sel)];
    const parts = splitTopComma(m[1]);
    if (parts.length <= 1 || parts.length > 12) return [norm(sel)];
    const prefix = sel.slice(0, m.index);
    const suffix = sel.slice(m.index + m[0].length);
    const res = [];
    for (const p of parts) {
        for (const sub of expandIsBranches(`${prefix}${p}${suffix}`)) res.push(sub);
    }
    return res;
}

function expandNestedSelectors(rule) {
    let sels = splitTopComma(rule.selector).map(norm);
    for (let p = rule.parent; p && p.type !== "root"; p = p.parent) {
        if (p.type === "rule") {
            const pSels = splitTopComma(p.selector).map(norm);
            const next = [];
            for (const ps of pSels) {
                for (const cs of sels) {
                    next.push(norm(cs.includes("&") ? cs.replace(/&/g, ps) : `${ps} ${cs}`));
                }
            }
            sels = next;
        }
    }
    return sels;
}

let cached = null;

function ensureCascade() {
    if (cached) return cached;
    const byCtx = new Map();
    const record = (ctx, sel, prop, val) => {
        let selMap = byCtx.get(ctx);
        if (!selMap) { selMap = new Map(); byCtx.set(ctx, selMap); }
        let declMap = selMap.get(sel);
        if (!declMap) { declMap = new Map(); selMap.set(sel, declMap); }
        const prev = declMap.get(prop);
        declMap.set(prop, !prev ? val : prev.includes(val) ? prev : `${prev} | ${val}`);
    };
    const ctxOf = (node) => {
        const parts = [];
        for (let p = node.parent; p && p.type !== "root"; p = p.parent) {
            if (p.type === "atrule") parts.unshift(`@${p.name} ${norm(p.params)}`);
        }
        return parts.join(" | ");
    };
    const ingestAst = (ast) => {
        ast.walkRules((rule) => {
            if (rule.parent?.type === "atrule" && /keyframes/.test(rule.parent.name)) return;
            const ctx = ctxOf(rule);
            const variants = new Set([norm(rule.selector)]);
            for (const s of expandNestedSelectors(rule)) {
                variants.add(s);
                for (const b of expandIsBranches(s)) {
                    variants.add(b);
                    if (b.startsWith(".lc-checkin ")) variants.add(b.slice(".lc-checkin ".length).trim());
                    if (b.includes(".lc-checkin.lc-checkin--")) variants.add(b.replace(/\.lc-checkin\.lc-checkin--/g, ".lc-checkin--"));
                }
            }
            rule.each((d) => {
                if (d.type !== "decl") return;
                const val = `${normVal(d.value)}${d.important ? " !important" : ""}`;
                for (const v of variants) {
                    record(ctx, v, d.prop, val);
                    record("*", v, d.prop, val);
                }
            });
        });
    };
    const css = fs.readFileSync(path.join(root, "dist", "index.css"), "utf8");
    ingestAst(postcss.parse(css));
    for (const f of ORDER) {
        const file = path.join(root, "src", "ui", `${f}.scss`);
        if (fs.existsSync(file)) ingestAst(postcss.parse(fs.readFileSync(file, "utf8")));
    }
    cached = {byCtx, css};
    return cached;
}

function getEffectiveDecls(selector, atRule = "*") {
    const {byCtx} = ensureCascade();
    const target = norm(selector);
    const merged = new Map();
    for (const [ctx, selMap] of byCtx) {
        if (ctx === "*") continue;
        if (atRule !== "*" && ctx !== "" && (atRule instanceof RegExp ? !atRule.test(ctx) : !ctx.includes(norm(atRule)))) continue;
        for (const [sel, declMap] of selMap) {
            if (sel === target || sel.endsWith(` ${target}`)) {
                for (const [p, v] of declMap) {
                    const prev = merged.get(p);
                    merged.set(p, !prev ? v : prev.includes(v) ? prev : `${prev} | ${v}`);
                }
            }
        }
    }
    return merged;
}

function assertEffectiveStyle(selector, expected, message, atRule = "*") {
    const decls = getEffectiveDecls(selector, atRule);
    for (const [prop, matcher] of Object.entries(expected)) {
        const actual = decls.get(prop);
        assert.ok(actual !== undefined, message || `Expected "${selector}" (${atRule}) to have property "${prop}"`);
        if (matcher instanceof RegExp) {
            assert.match(actual, matcher, message || `Expected "${selector}" ${prop}="${actual}" to match ${matcher}`);
        } else {
            const normExpected = normVal(String(matcher));
            assert.ok(
                actual.toLowerCase() === normExpected.toLowerCase() || actual.toLowerCase().includes(normExpected.toLowerCase()),
                message || `Expected "${selector}" ${prop} to include "${normExpected}", got "${actual}"`,
            );
        }
    }
}

module.exports = {
    ensureCascade,
    getEffectiveDecls,
    assertEffectiveStyle,
};
