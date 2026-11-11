/* R24 无障碍动效契约：凡声明 scroll-behavior: smooth 的样式文件，
   必须同文件包含 prefers-reduced-motion 降级块（平滑滚动对运动敏感用户也应退化为 auto）。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const files = ["src/ui/components.scss", "src/ui/polish.scss"];

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (["node_modules", "dist", "build", "release"].includes(e.name)) continue;
            walk(p, out);
        } else if (/\.(scss|css)$/.test(e.name)) out.push(p);
    }
    return out;
}

for (const file of walk(path.join(root, "src"))) {
    const src = fs.readFileSync(file, "utf8");
    if (!/scroll-behavior:\s*smooth/.test(src)) continue;
    const rel = path.relative(root, file);
    assert.match(src, /prefers-reduced-motion/, `${rel} 声明了平滑滚动，必须同文件携带 prefers-reduced-motion 降级`);
}

console.log("reduced-motion scroll contract passed");
