/* R21 i18n 字典 parity 契约：
   zhCN/enUS 双字典键集严格一致（en 漏译=英文用户看到中文；zh 漏译=直接回退键名）；
   源码 t("dotted.key") 字面量引用必须两字典均可命中。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const i18nSource = fs.readFileSync(path.join(root, "src", "i18n.ts"), "utf8");

function dictKeys(name) {
    const match = new RegExp(`const ${name}: Dict = \\{([\\s\\S]*?)\\n\\};`).exec(i18nSource);
    assert.ok(match, `i18n.ts 必须声明 const ${name}: Dict`);
    return new Set([...match[1].matchAll(/"([^"]+)"\s*:/g)].map(m => m[1]));
}

const zhKeys = dictKeys("zhCN");
const enKeys = dictKeys("enUS");

const zhOnly = [...zhKeys].filter(k => !enKeys.has(k));
const enOnly = [...enKeys].filter(k => !zhKeys.has(k));
assert.deepEqual(zhOnly, [], `enUS 缺失以下 zhCN 键（英文用户将看到中文）：${zhOnly.join(", ")}`);
assert.deepEqual(enOnly, [], `zhCN 缺失以下 enUS 键：${enOnly.join(", ")}`);

/* 源码 t("dotted.key") 字面量引用闭环 */
function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (["node_modules", "dist", "build", "release"].includes(e.name)) continue;
            walk(p, out);
        } else if (/\.(ts|svelte)$/.test(e.name) && !e.name.endsWith("i18n.ts")) out.push(p);
    }
    return out;
}

const missing = new Set();
for (const file of walk(path.join(root, "src"))) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/(?<![\w$.])t\(\s*"([a-z][\w-]*(?:\.[\w-]+)+)"/g)) {
        if (!zhKeys.has(m[1])) missing.add(`${path.relative(root, file)}: ${m[1]}`);
    }
}
assert.deepEqual([...missing], [], `t() 字面量引用存在未登记键：${[...missing].join("; ")}`);

console.log("i18n dict parity checks passed");
