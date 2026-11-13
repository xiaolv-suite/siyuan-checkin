#!/usr/bin/env node
const {spawnSync} = require("node:child_process");
const path = require("node:path");

const files = process.argv.slice(2);
if (!files.length) {
    console.error("用法: node scripts/run-tests.cjs <file1> <file2> ...");
    process.exit(1);
}

const root = path.resolve(__dirname, "..");
let passed = 0;
const start = Date.now();

for (const file of files) {
    const fullPath = path.resolve(root, file);
    const result = spawnSync(process.execPath, [fullPath], {
        cwd: root,
        stdio: "inherit",
        env: process.env,
    });
    if (result.status !== 0) {
        console.error(`\n❌ 测试失败: ${file} (退出码 ${result.status})`);
        process.exit(result.status || 1);
    }
    passed++;
}

const elapsed = ((Date.now() - start) / 1000).toFixed(2);
console.log(`\n✅ 测试套件执行完毕: ${passed} 项测试全部通过 (${elapsed}s)`);
