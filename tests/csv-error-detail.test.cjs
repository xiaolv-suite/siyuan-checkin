// @ts-check
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

console.log("Starting csv-error-detail tests...");

const root = path.join(__dirname, "..");
const srcExport = fs.readFileSync(path.join(root, "src", "export.ts"), "utf8");
const srcDateKeys = fs.readFileSync(path.join(root, "src", "date-keys.ts"), "utf8");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};

const modDateKeys = {exports: {}};
new Function("module", "exports", ts.transpileModule(srcDateKeys, {compilerOptions}).outputText)(modDateKeys, modDateKeys.exports);

const modExport = {exports: {}};
const customRequire = (id) => {
    if (id === "./date-keys") return modDateKeys.exports;
    return require(id);
};
new Function("module", "exports", "require", ts.transpileModule(srcExport, {compilerOptions}).outputText)(modExport, modExport.exports, customRequire);
const {parseCheckinCsv} = modExport.exports;

// 1. 测试缺少表头名称/日期列时的诊断信息
const noNameHeader = parseCheckinCsv("日期,数值\n2026-10-26,1");
assert.equal(noNameHeader.rows.length, 0);
assert.equal(noNameHeader.errors.length, 1);
assert.equal(noNameHeader.errors[0].line, 1);
assert.match(noNameHeader.errors[0].reason, /缺少名称列/);

const noDateHeader = parseCheckinCsv("名称,数值\n阅读,1");
assert.equal(noDateHeader.rows.length, 0);
assert.equal(noDateHeader.errors.length, 1);
assert.equal(noDateHeader.errors[0].line, 1);
assert.match(noDateHeader.errors[0].reason, /缺少日期列/);

const noBothHeader = parseCheckinCsv("时间,数值\n2026-10-26,1");
assert.equal(noBothHeader.rows.length, 0);
assert.equal(noBothHeader.errors.length, 1);
assert.match(noBothHeader.errors[0].reason, /缺少名称和日期列/);

// 2. 测试名称缺失和日期无效的复合原因
const invalidRows = parseCheckinCsv("名称,日期,数值\n,2026-02-30,5\n跑步,2026-10-26,abc");
assert.equal(invalidRows.rows.length, 0);
assert.equal(invalidRows.invalid, 2);
assert.equal(invalidRows.errors.length, 2);
assert.equal(invalidRows.errors[0].line, 1); // Row 1 of data (index 1)
assert.match(invalidRows.errors[0].reason, /名称缺失/);
assert.match(invalidRows.errors[0].reason, /日期无效/);
assert.equal(invalidRows.errors[1].line, 2);
assert.match(invalidRows.errors[1].reason, /数值无效/);

console.log("csv-error-detail: all assertions passed successfully!");
