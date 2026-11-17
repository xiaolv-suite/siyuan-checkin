/* 全量无死角交互元素扫描器：从代码中静态扫描并提取所有页面、面板、弹窗、按钮、菜单、输入、设置、快捷键、状态态等 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src");

// 递归收集所有 ts 文件
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

const allTsFiles = getFiles(srcDir);
console.log(`Scanning ${allTsFiles.length} TypeScript files in src/...`);

// 记录所有元素
// 类别：
// 1. 页面与面板 (Page / Panel)
// 2. 弹窗与抽屉 (Dialog / Drawer)
// 3. 按钮与图标按钮 (Button / Icon Button)
// 4. 菜单项与右键菜单 (Menu / Context Menu)
// 5. 下拉与分段控件 (Select / Segment Control)
// 6. 输入框与开关 (Input / Switch)
// 7. 设置项 (Settings Field)
// 8. 快捷键与宿主命令 (Hotkey / Command)
// 9. 空态与错误态 (Empty / Error State)

const inventory = [];

function addEntry(category, location, type, triggerAction, description) {
    inventory.push({
        id: `INV-${String(inventory.length + 1).padStart(4, "0")}`,
        category,
        location,
        type,
        triggerAction,
        description: description || triggerAction
    });
}

// 1. 扫描页面与面板 (从 navigation.ts, page-shell.ts, index.ts)
const pages = [
    { name: "今日打卡 (Today)", loc: "src/render/bind-today.ts", type: "核心页面", action: "展示今日打卡项、NextHero、连击与进度，触发打卡与快速操作" },
    { name: "新建与编辑打卡 (Editor)", loc: "src/render/editor.ts", type: "核心页面", action: "创建/编辑打卡项、目标、周期、图标、智能体起草、多维度属性" },
    { name: "回顾统计 (Review) - 概览 (Overview)", loc: "src/render/review.ts:80", type: "标签页面板", action: "周/月/年趋势、习惯热力图、周期完成率汇总" },
    { name: "回顾统计 (Review) - 明细 (Records)", loc: "src/render/review.ts:160", type: "标签页面板", action: "历史打卡流水、多维度来源筛选、补记、撤销打卡" },
    { name: "回顾统计 (Review) - 分析 (Analysis)", loc: "src/render/review.ts:240", type: "标签页面板", action: "习惯强度对比、失速分析、相关性分析、智能体建议诊断" },
    { name: "回顾统计 (Review) - 时间轴 (LifeLog)", loc: "src/render/review.ts:320", type: "标签页面板", action: "按时间顺序浏览打卡与事件流水、支持按天过滤" },
    { name: "事项管理 (Occasions)", loc: "src/render/occasions.ts", type: "核心页面", action: "按日提醒事项、周期事项、完成打勾、编辑、转习惯" },
    { name: "设置中心 (Settings)", loc: "src/render/settings.ts", type: "核心页面", action: "外观调色板、统计选项、提醒设置、生态联动、备份恢复、高级维护" },
    { name: "更多与工具 (More)", loc: "src/render/more.ts", type: "辅助页面", action: "快捷操作、项目与数据导入导出、偏好与帮助入口" },
    { name: "归档项目管理 (Archived)", loc: "src/render/archived.ts", type: "辅助页面", action: "查看已归档项目、恢复归档、永久删除" },
    { name: "思源侧边栏 Dock 面板", loc: "src/index.ts:2751", type: "宿主常驻面板", action: "在思源侧边栏直接打卡、窄屏响应式展示" },
    { name: "思源主标签页 Tab 面板", loc: "src/index.ts:2785", type: "宿主页签面板", action: "在思源主工作区作为独立标签页运行" },
    { name: "思源嵌入式渲染块 (Checkin Block)", loc: "src/render/block-renderer.ts", type: "文档内嵌面板", action: "在文档内实时渲染今日打卡、单项打卡卡片或进度条" },
    { name: "专注计时浮动面板 (Focus Timer)", loc: "src/render/focus-timer.ts", type: "常驻浮动面板", action: "番茄钟/正向计时、暂停、继续、提前结算或放弃" },
    { name: "专注微型迷你条 (Focus Mini Strip)", loc: "src/render/focus-timer.ts", type: "页头嵌入面板", action: "今日打卡页头部紧凑常驻计时状态与快捷控制" }
];

for (const p of pages) {
    addEntry("页面与面板", p.loc, p.type, p.name, p.action);
}

// 2. 扫描弹窗与抽屉
const dialogs = [
    { name: "快速打卡独立弹窗 (Quick Dialog)", loc: "src/render/quick-dialog.ts", type: "模态弹窗", action: "全局弹窗快捷打卡、全屏切换、键盘 Esc 关闭" },
    { name: "今日日记 LifeLog 弹窗", loc: "src/render/journal-dialog.ts:50", type: "模态弹窗", action: "今日打卡一键追加到日记、预览 Markdown、修改配置" },
    { name: "问卷式日记打卡弹窗 (Journal Form)", loc: "src/render/journal-dialog.ts:180", type: "模态弹窗", action: "填写当日反思/问卷问题并写入对应文档" },
    { name: "文档目标选择器弹窗 (Target Picker)", loc: "src/render/journal-dialog.ts:320", type: "模态弹窗", action: "搜索选择日记或笔记目标文档及所在笔记本" },
    { name: "图标/表情选择器弹窗 (Avatar Editor)", loc: "src/render/avatar-editor.ts", type: "模态弹窗", action: "选择 Emoji、内置思源图标、输入自定义字符或图标" },
    { name: "回顾周期对比弹窗 (Review Compare)", loc: "src/render/review-compare.ts", type: "模态弹窗", action: "横向对比上一周/上一月与本期完成率及变化" },
    { name: "智能体建议工作流预览弹窗 (Suggestion Preview)", loc: "src/render/suggestion-workflow.ts", type: "模态弹窗", action: "查看 AI/规则诊断建议、对比改动前后、一键采纳或推迟" },
    { name: "叶归 LifeLog 映射关系编辑弹窗", loc: "src/render/yeguif-mappings.ts", type: "模态弹窗", action: "配置日记文本标记与打卡项的自动映射规则" },
    { name: "智能体项目草案选择弹窗 (Project Choice)", loc: "src/render/project-choice.ts", type: "模态弹窗", action: "从 AI 起草的候选项目中勾选导入或丢弃" },
    { name: "导入冲突处理弹窗 (Import Conflict)", loc: "src/features/import-conflicts.ts", type: "模态弹窗", action: "导入重复项目时选择覆盖、重命名或跳过" },
    { name: "未保存草稿离开确认弹窗", loc: "src/render/bind-editor.ts", type: "确认提示弹窗", action: "编辑器表单有未保存更改时提示放弃或继续编辑" },
    { name: "删除项目二次确认弹窗", loc: "src/render/bind-editor.ts", type: "确认提示弹窗", action: "删除打卡项时的破坏性操作确认与级联提示" },
    { name: "重置数据二次确认弹窗", loc: "src/render/settings.ts", type: "确认提示弹窗", action: "重置偏好或清空数据前弹出安全验证" }
];

for (const d of dialogs) {
    addEntry("弹窗与抽屉", d.loc, d.type, d.name, d.action);
}

// 3. 扫描 settings.ts 中的所有设置项
const settingsContent = fs.readFileSync(path.join(srcDir, "render", "settings.ts"), "utf8");
// 匹配各类设置项和开关
const settingsLines = settingsContent.split("\n");
let currentSettingsSection = "通用设置";
for (let i = 0; i < settingsLines.length; i++) {
    const line = settingsLines[i];
    const sectionMatch = line.match(/data-settings-section=["']([^"']+)["']/);
    if (sectionMatch) {
        currentSettingsSection = sectionMatch[1];
    }
    // 匹配设置项 input/select/switch/action
    const switchMatch = line.match(/data-settings-switch=["']([^"']+)["']/);
    if (switchMatch) {
        addEntry("设置项", `src/render/settings.ts:${i + 1}`, "开关 (Switch)", `settings-switch:${switchMatch[1]}`, `[${currentSettingsSection}] 开关配置: ${switchMatch[1]}`);
    }
    const fieldMatch = line.match(/data-settings-field=["']([^"']+)["']/);
    if (fieldMatch) {
        addEntry("设置项", `src/render/settings.ts:${i + 1}`, "输入/选择字段", `settings-field:${fieldMatch[1]}`, `[${currentSettingsSection}] 字段配置: ${fieldMatch[1]}`);
    }
}

// 4. 从所有 render 文件中扫描所有带有 data-action 的按钮和元素
const renderDir = path.join(srcDir, "render");
const renderFiles = fs.readdirSync(renderDir).filter(f => f.endsWith(".ts"));

for (const rf of renderFiles) {
    const filePath = path.join(renderDir, rf);
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 匹配 data-action
        const actionMatches = [...line.matchAll(/data-action=["']([^"']+)["']/g)];
        for (const m of actionMatches) {
            const action = m[1];
            // 区分类型
            let type = "按钮 (Button)";
            if (line.includes("<button")) {
                type = line.includes("lc-checkin__icon-btn") || line.includes("icon") ? "图标按钮 (Icon Button)" : "按钮 (Button)";
            } else if (line.includes("<a")) {
                type = "超链接动作 (Link Action)";
            } else if (line.includes("<select") || line.includes("<option")) {
                type = "下拉选项 (Option)";
            } else if (line.includes("<input")) {
                type = line.includes('type="checkbox"') ? "复选框 (Checkbox)" : "输入框动作 (Input Action)";
            }
            addEntry("按钮与图标按钮", `src/render/${rf}:${i + 1}`, type, `data-action="${action}"`, `在 ${rf} 中触发 ${action}`);
        }

        // 匹配特化按钮 data-*-action
        const specialMatches = [...line.matchAll(/data-([a-z0-9-]+-action)=["']([^"']+)["']/g)];
        for (const sm of specialMatches) {
            addEntry("按钮与图标按钮", `src/render/${rf}:${i + 1}`, "特化按钮", `${sm[1]}="${sm[2]}"`, `特化动作: ${sm[1]}=${sm[2]}`);
        }

        // 匹配下拉与分段控件 (<select 或 segment)
        if (line.includes("<select") || line.includes("data-segment") || line.includes("data-tab-switch")) {
            const idMatch = line.match(/id=["']([^"']+)["']/) || line.match(/data-[a-z0-9-]+=["']([^"']+)["']/);
            const id = idMatch ? idMatch[1] : "select-control";
            addEntry("下拉与分段控件", `src/render/${rf}:${i + 1}`, line.includes("data-segment") ? "分段控件" : "下拉选择框", id, `在 ${rf} 中的选择控件 ${id}`);
        }

        // 匹配独立输入框与开关
        if (line.includes("<input") && !line.includes("data-settings-") && !line.includes("data-action")) {
            const typeMatch = line.match(/type=["']([^"']+)["']/);
            const inputType = typeMatch ? typeMatch[1] : "text";
            const nameMatch = line.match(/(?:id|name|placeholder|data-[a-z-]+)=["']([^"']+)["']/);
            const name = nameMatch ? nameMatch[1] : "input";
            addEntry("输入框与开关", `src/render/${rf}:${i + 1}`, inputType === "checkbox" ? "复选开关" : `输入框 (${inputType})`, name, `在 ${rf} 中的输入项 ${name}`);
        }

        // 匹配空态与错误态
        if (line.includes("lc-checkin__empty") || line.includes("lc-checkin__blank") || line.includes("lc-checkin__error") || line.includes("alert-danger") || line.includes("empty-state")) {
            addEntry("空态与错误态", `src/render/${rf}:${i + 1}`, line.includes("error") || line.includes("danger") ? "错误提示态" : "空数据占位态", "状态展现", `在 ${rf} 中的状态反馈`);
        }
    }
}

// 5. 扫描快捷键与命令 (Command / Hotkey)
const indexContent = fs.readFileSync(path.join(srcDir, "index.ts"), "utf8");
const indexLines = indexContent.split("\n");
for (let i = 0; i < indexLines.length; i++) {
    const line = indexLines[i];
    if (line.includes("addCommand({")) {
        // 向后读几行抓取 langKey 和 hotkey
        const chunk = indexLines.slice(i, i + 10).join(" ");
        const langMatch = chunk.match(/langKey:\s*["']([^"']+)["']/);
        const hotkeyMatch = chunk.match(/hotkey:\s*["']([^"']+)["']/);
        const langKey = langMatch ? langMatch[1] : "command";
        const hotkey = hotkeyMatch ? hotkeyMatch[1] : "未绑定缺省快捷键";
        addEntry("快捷键与宿主命令", `src/index.ts:${i + 1}`, "宿主命令与快捷键", langKey, `命令: ${langKey} (默认热键: ${hotkey})`);
    }
}

// 6. 扫描右键菜单与上下文菜单项
const todayBindingsContent = fs.readFileSync(path.join(srcDir, "render", "today-bindings.ts"), "utf8");
const tbLines = todayBindingsContent.split("\n");
for (let i = 0; i < tbLines.length; i++) {
    const line = tbLines[i];
    if (line.includes("contextMenu") || line.includes("data-menu-item") || line.includes(".showMenu(")) {
        addEntry("菜单项与右键菜单", `src/render/today-bindings.ts:${i + 1}`, "右键上下文菜单项", "itemContextMenu", "今日卡片右键菜单（快速打卡、跳过、补记、编辑、专注、复制等）");
    }
}
const occasionsBindingsContent = fs.readFileSync(path.join(srcDir, "render", "bind-occasions.ts"), "utf8");
const obLines = occasionsBindingsContent.split("\n");
for (let i = 0; i < obLines.length; i++) {
    const line = obLines[i];
    if (line.includes("contextmenu") || line.includes("menu-action") || line.includes("dropdown")) {
        addEntry("菜单项与右键菜单", `src/render/bind-occasions.ts:${i + 1}`, "事项菜单项", "occasionMenu", "事项卡片更多操作菜单（编辑、重置排期、转习惯、删除）");
    }
}

// 输出统计结果
console.log(`\n================ Total Inventory Count: ${inventory.length} ================`);
const categoryCounts = {};
for (const item of inventory) {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
}
for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`  - ${cat}: ${count}`);
}

// 写入全量清单 JSON 与 Markdown
const jsonPath = path.join(root, "docs", "inventory-raw.json");
fs.writeFileSync(jsonPath, JSON.stringify(inventory, null, 2));
console.log(`Saved raw inventory to ${jsonPath}`);
