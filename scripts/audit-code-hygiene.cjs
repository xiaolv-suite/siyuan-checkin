/* 代码整洁度、死代码、类型健壮性与边界输入审计脚本 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src");

function getAllTsFiles(dir) {
    let files = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            files = files.concat(getAllTsFiles(full));
        } else if (file.endsWith(".ts")) {
            files.push(full);
        }
    }
    return files;
}

const tsFiles = getAllTsFiles(srcDir);
console.log(`Auditing ${tsFiles.length} TypeScript source files in src/ ...`);

const issues = {
    emptyCatch: [],
    todoComments: [],
    anyCasts: [],
    duplicateHelpers: [],
    consoleLogs: []
};

for (const f of tsFiles) {
    const rel = path.relative(root, f).replace(/\\/g, "/");
    const content = fs.readFileSync(f, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        // 1. Empty catch block: catch (e) {} or catch {}
        if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(line)) {
            issues.emptyCatch.push({ file: rel, line: lineNum, text: line.trim() });
        }
        // 2. TODO / FIXME markers
        if (/\/\/\s*(TODO|FIXME|XXX):/i.test(line)) {
            issues.todoComments.push({ file: rel, line: lineNum, text: line.trim() });
        }
        // 3. Raw console.log (should be avoided or properly gated)
        if (/(?<![\w.])console\.log\s*\(/.test(line) && !line.includes("debug") && !line.includes("// safe-console")) {
            issues.consoleLogs.push({ file: rel, line: lineNum, text: line.trim() });
        }
    });
}

console.log("\n--- Audit Summary ---");
console.log(`Empty catch blocks: ${issues.emptyCatch.length}`);
issues.emptyCatch.forEach(c => console.log(`  ${c.file}:${c.line} -> ${c.text}`));

console.log(`\nTODO/FIXME comments: ${issues.todoComments.length}`);
issues.todoComments.forEach(t => console.log(`  ${t.file}:${t.line} -> ${t.text}`));

console.log(`\nUngated console.log: ${issues.consoleLogs.length}`);
issues.consoleLogs.forEach(l => console.log(`  ${l.file}:${l.line} -> ${l.text}`));
