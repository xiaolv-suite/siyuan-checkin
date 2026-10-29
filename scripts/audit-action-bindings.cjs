/* 自动化扫描插件全量按钮与操作绑定：提取 render 模板中的动作并验证其接线完整性 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const renderDir = path.join(root, "src", "render");

const renderFiles = fs.readdirSync(renderDir).filter(f => f.endsWith(".ts"));
console.log(`Auditing ${renderFiles.length} render files in ${renderDir}...`);

const actions = new Map(); // action -> { templateFile, lines: [] }
const dataAttrs = new Map(); // attr -> { templateFile, lines: [] }

for (const file of renderFiles) {
    const content = fs.readFileSync(path.join(renderDir, file), "utf8");
    const lines = content.split("\n");
    
    lines.forEach((line, idx) => {
        // 匹配 data-action="..."
        const actionMatches = [...line.matchAll(/data-action=["']([^"']+)["']/g)];
        for (const m of actionMatches) {
            const action = m[1];
            if (!actions.has(action)) actions.set(action, []);
            actions.get(action).push({file, line: idx + 1});
        }

        // 匹配主要特化动作属性 data-*-action, data-*-copy, data-*-clear 等
        const attrMatches = [...line.matchAll(/(data-[a-z0-9-]+(?:action|clear|save|export|apply|infer|discard|delete|move|edit|toggle|focus)[a-z0-9-]*)/g)];
        for (const m of attrMatches) {
            const attr = m[1];
            if (!dataAttrs.has(attr)) dataAttrs.set(attr, []);
            dataAttrs.get(attr).push({file, line: idx + 1});
        }
    });
}

console.log(`Found ${actions.size} unique data-action values and ${dataAttrs.size} specialized data attributes.`);

// 检查每个 action 在代码库中的绑定情况
const sourceFiles = [
    path.join(root, "src", "index.ts"),
    ...renderFiles.map(f => path.join(renderDir, f))
];

const sourceContents = sourceFiles.map(f => fs.readFileSync(f, "utf8")).join("\n");

const unboundActions = [];
for (const [action, sites] of actions.entries()) {
    // 检查是否存在对该 action 的选择器监听
    const regex1 = new RegExp(`\\[data-action=["']?${action}["']?\\]`, "g");
    const regex2 = new RegExp(`data-action\\s*===\\s*["']${action}["']`, "g");
    const regex3 = new RegExp(`dataset\\.action\\s*===\\s*["']${action}["']`, "g");
    const regex4 = new RegExp(`action\\s*===\\s*["']${action}["']`, "g");
    
    if (!regex1.test(sourceContents) && !regex2.test(sourceContents) && !regex3.test(sourceContents) && !regex4.test(sourceContents)) {
        unboundActions.push({action, sites});
    }
}

console.log(`\nUnbound data-actions count: ${unboundActions.length}`);
if (unboundActions.length > 0) {
    unboundActions.forEach(u => {
        console.log(`  - data-action="${u.action}" at ${u.sites.map(s => `${s.file}:${s.line}`).join(", ")}`);
    });
}
