const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const inventory = JSON.parse(fs.readFileSync(path.join(root, "docs", "inventory.json"), "utf8"));

// 批次规则匹配：
// Batch 1: 今日打卡 (bind-today, today-bindings, fragments 中的 today/hero/bulk/item, quick-dialog, index 中的顶栏与命令)
const batch1Items = [];
const batch2Items = [];
const batch3Items = [];
const batch4Items = [];
const batch5Items = [];
const batch6Items = [];

for (const it of inventory) {
    const loc = it.location;
    const mod = it.moduleName;
    const cat = it.category;

    if (mod === "今日打卡" || mod === "bind-today" || mod === "today-bindings" || loc.includes("bind-today") || loc.includes("today-bindings") || loc.includes("quick-entry") || (loc.includes("fragments.ts") && (it.triggerAction.includes("record") || it.triggerAction.includes("today") || it.triggerAction.includes("bulk") || it.triggerAction.includes("hero")))) {
        batch1Items.push(it);
    } else if (mod === "新建打卡" || mod === "bind-editor" || mod === "editor" || loc.includes("editor")) {
        batch2Items.push(it);
    } else if (mod === "事项管理" || mod === "bind-occasions" || mod === "occasions" || loc.includes("occasions")) {
        batch3Items.push(it);
    } else if (mod.includes("回顾") || mod === "review" || loc.includes("review") || loc.includes("charts") || loc.includes("analytics")) {
        batch4Items.push(it);
    } else if (mod.includes("设置") || mod === "settings" || loc.includes("settings") || mod.includes("生态") || mod.includes("维护") || cat === "设置项") {
        batch5Items.push(it);
    } else {
        batch6Items.push(it);
    }
}

console.log(`Inventory partitioning:
  Batch 1 (今日打卡与核心操作): ${batch1Items.length}
  Batch 2 (新建打卡与编辑器): ${batch2Items.length}
  Batch 3 (事项管理系统): ${batch3Items.length}
  Batch 4 (回顾统计与LifeLog): ${batch4Items.length}
  Batch 5 (设置中心与生态Hub): ${batch5Items.length}
  Batch 6 (辅助页面与浮窗弹窗): ${batch6Items.length}
  Total: ${batch1Items.length + batch2Items.length + batch3Items.length + batch4Items.length + batch5Items.length + batch6Items.length}
`);

fs.writeFileSync(path.join(root, "docs", "batches.json"), JSON.stringify({
    batch1: batch1Items.map(i => i.id),
    batch2: batch2Items.map(i => i.id),
    batch3: batch3Items.map(i => i.id),
    batch4: batch4Items.map(i => i.id),
    batch5: batch5Items.map(i => i.id),
    batch6: batch6Items.map(i => i.id),
}, null, 2));
