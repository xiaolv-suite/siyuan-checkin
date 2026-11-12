/* 检查 src/ 内是否有孤立未被任何地方（包括 tests/）引用的导出符号 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src");
const testsDir = path.join(root, "tests");

function getAllFiles(dir, exts = [".ts", ".cjs", ".mjs", ".js"]) {
    let files = [];
    const list = fs.readdirSync(dir);
    for (const f of list) {
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            files = files.concat(getAllFiles(full, exts));
        } else if (exts.some(ext => f.endsWith(ext))) {
            files.push(full);
        }
    }
    return files;
}

const allTs = getAllFiles(srcDir, [".ts"]);
const allCode = getAllFiles(root, [".ts", ".cjs", ".mjs"]).filter(f => !f.includes("node_modules") && !f.includes(".git") && !f.includes("dist"));

// 读取所有代码内容合集（用于匹配引用）
const codeContents = allCode.map(f => ({
    file: path.relative(root, f).replace(/\\/g, "/"),
    text: fs.readFileSync(f, "utf8")
}));

const exportsList = [];

for (const f of allTs) {
    const rel = path.relative(root, f).replace(/\\/g, "/");
    const content = fs.readFileSync(f, "utf8");
    
    // 匹配 export function xxx, export const xxx, export type xxx, export interface xxx
    const regex = /export\s+(?:async\s+)?(?:function|const|let|var|class|type|interface)\s+([A-Za-z0-9_$]+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const symbol = match[1];
        // 排除常见生命周期或标准入口
        if (["default", "init", "destroy", "onLayoutReady", "Plugin", "onunload"].includes(symbol)) continue;
        exportsList.push({ symbol, file: rel });
    }
}

console.log(`Found ${exportsList.length} exported symbols in src/`);

const unused = [];

for (const item of exportsList) {
    const { symbol, file } = item;
    // 检查其他文件中是否出现该 symbol
    let references = 0;
    for (const c of codeContents) {
        if (c.file === file) {
            // 在同文件内看出现次数
            const count = (c.text.match(new RegExp(`\\b${symbol}\\b`, "g")) || []).length;
            if (count > 1) {
                // 在同文件被其他函数使用
            }
        } else {
            // 在其他文件是否出现
            if (c.text.includes(symbol)) {
                references++;
            }
        }
    }
    if (references === 0) {
        unused.push(item);
    }
}

console.log(`Potentially unused exports (0 references in other files): ${unused.length}`);
unused.slice(0, 30).forEach(u => console.log(`  ${u.file}: export ${u.symbol}`));
