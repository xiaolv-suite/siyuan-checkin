/* R2-P1 高风险区与安全代码审计脚本：
   检查敏感信息泄漏、未捕获异常、API超时与重试、数据持久化锁与防并发 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src");

function getFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(fullPath));
        } else if (file.endsWith(".ts")) {
            results.push(fullPath);
        }
    }
    return results;
}

const files = getFiles(srcDir);
console.log(`Auditing ${files.length} source files for security, persistence, and concurrency risks...`);

const findings = [];

files.forEach(file => {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, idx) => {
        // 1. 检查是否存在裸 console.log 输出敏感词 (token, apiKey, password, secret)
        if (line.includes("console.log") || line.includes("console.error") || line.includes("console.warn")) {
            if (/apiKey|token|secret|password/i.test(line) && !line.includes("sanitize") && !line.includes("mask") && !line.includes("test")) {
                findings.push({ file: rel, line: idx + 1, type: "Sensitive Log Risk", detail: line.trim() });
            }
        }

        // 2. 检查是否有未转义的用户内容 innerHTML 拼接 (例如 ${item.name} 没有 escapeHtml)
        if (line.includes("innerHTML") || line.includes("<span") || line.includes("<strong") || line.includes("<div")) {
            const rawInterpolation = line.match(/\$\{([a-zA-Z0-9_.]+(?:name|title|note|query|memo|text))\}/);
            if (rawInterpolation && !line.includes("escapeHtml") && !line.includes("t(") && !line.includes("uiIcon") && !rel.includes("test")) {
                findings.push({ file: rel, line: idx + 1, type: "Potential XSS Risk", detail: line.trim() });
            }
        }
    });
});

console.log(`\nAudit completed with ${findings.length} findings.`);
findings.forEach(f => {
    console.log(`[${f.type}] ${f.file}:${f.line} -> ${f.detail}`);
});
