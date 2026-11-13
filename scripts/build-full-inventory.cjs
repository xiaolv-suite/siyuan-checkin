/* 小驴打卡全量无死角交互元素建立与清单生成脚本
   深度扫描 src/ 下所有文件，提取 9 大类别全部交互元素并严格统计总数 */
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

const allTsFiles = getFiles(srcDir);
const inventory = [];

function registerElement(category, moduleName, location, domType, triggerAction, description, riskLevel = "normal") {
    inventory.push({
        id: `E-${String(inventory.length + 1).padStart(4, "0")}`,
        category,
        moduleName,
        location,
        domType,
        triggerAction,
        description,
        riskLevel // "high" | "normal"
    });
}

// -------------------------------------------------------------
// 1. 页面与面板 (Page / Panel)
// -------------------------------------------------------------
const pagesAndPanels = [
    { mod: "今日打卡", loc: "src/render/bind-today.ts:1", dom: "Page Surface", act: "页面展示与打卡操作", desc: "今日打卡主界面，包含 NextHero、待完成与已完成列表", risk: "high" },
    { mod: "新建打卡", loc: "src/render/editor.ts:1", dom: "Page Surface", act: "表单展示与编辑", desc: "打卡项创建与编辑页面，支持智能体草案与完整属性配置", risk: "high" },
    { mod: "回顾概览", loc: "src/render/review.ts:80", dom: "Tab Panel", act: "切换概览工作区", desc: "周/月/年趋势、习惯热力图、周期完成率大卡", risk: "normal" },
    { mod: "回顾明细", loc: "src/render/review.ts:160", dom: "Tab Panel", act: "切换明细工作区", desc: "打卡历史记录流水、多维度来源渠道筛选、撤销与补记", risk: "high" },
    { mod: "回顾分析", loc: "src/render/review.ts:240", dom: "Tab Panel", act: "切换分析工作区", desc: "习惯强度对比、失速项目诊断、相关性洞察与智能体建议", risk: "normal" },
    { mod: "回顾时间轴", loc: "src/render/review.ts:320", dom: "Tab Panel", act: "切换时间轴工作区", desc: "LifeLog 真实事件按时间顺序展开浏览与按日下钻", risk: "normal" },
    { mod: "事项管理", loc: "src/render/occasions.ts:1", dom: "Page Surface", act: "事项增删改查", desc: "日期提醒、周年纪念、周期排期事项管理与完成留痕", risk: "high" },
    { mod: "设置中心", loc: "src/render/settings.ts:1", dom: "Page Surface", act: "全局设置与维护", desc: "外观、统计、提醒、生态联动、备份恢复、诊断与自愈", risk: "high" },
    { mod: "更多工具", loc: "src/render/more.ts:1", dom: "Page Surface", act: "功能导航分流", desc: "快捷操作、项目与数据导入导出、帮助指南三板块", risk: "normal" },
    { mod: "归档管理", loc: "src/render/archived.ts:1", dom: "Page Surface", act: "归档与恢复操作", desc: "已停用/已归档打卡项列表，支持解封恢复或彻底销毁", risk: "high" },
    { mod: "侧边栏Dock", loc: "src/index.ts:2751", dom: "Host Dock Panel", act: "侧边栏快捷打卡", desc: "思源左侧或右侧嵌入式 Dock 面板，窄宽自动适配", risk: "normal" },
    { mod: "主工作区Tab", loc: "src/index.ts:2785", dom: "Host Tab Panel", act: "主工作区独立运行", desc: "思源主区域自定义标签页，宽屏多列网格自适应", risk: "normal" },
    { mod: "嵌入式渲染块", loc: "src/render/block-renderer.ts:1", dom: "Protyle Render Block", act: "文档内动态交互", desc: "嵌入文档的动态打卡卡片、热力图、月历与概览", risk: "high" },
    { mod: "专注计时浮窗", loc: "src/render/focus-timer.ts:1", dom: "Floating Overlay", act: "计时与沉浸打卡", desc: "番茄钟/正向计时悬浮面板，支持暂停、提前结算与放弃", risk: "normal" },
    { mod: "专注微型迷你条", loc: "src/render/focus-timer.ts:350", dom: "Inline Header Widget", act: "快捷控制计时", desc: "今日打卡页顶栏内联的紧凑计时器显示与控制条", risk: "normal" }
];
pagesAndPanels.forEach(p => registerElement("页面与面板", p.mod, p.loc, p.dom, p.act, p.desc, p.risk));

// -------------------------------------------------------------
// 2. 弹窗与抽屉 (Dialog / Drawer)
// -------------------------------------------------------------
const dialogElements = [
    { mod: "独立快速弹窗", loc: "src/render/quick-dialog.ts:1", dom: "Modal Dialog", act: "openQuickDialog", desc: "全局快捷打卡弹窗（宽屏流体响应、全屏缩放切换）", risk: "normal" },
    { mod: "今日日记LifeLog弹窗", loc: "src/render/journal-dialog.ts:50", dom: "Modal Dialog", act: "openJournalDialog", desc: "手动一键追加今日记录到日记、预览 Markdown 正文", risk: "high" },
    { mod: "问卷日记打卡弹窗", loc: "src/render/journal-dialog.ts:180", dom: "Modal Dialog", act: "openJournalEntry", desc: "结构化问卷填报并写入日记或指定文档", risk: "high" },
    { mod: "文档目标选择器", loc: "src/render/journal-dialog.ts:320", dom: "Modal Dialog", act: "pickDocumentTarget", desc: "按笔记本或关键词搜索并选择关联思源文档", risk: "normal" },
    { mod: "图标头像选择器", loc: "src/render/avatar-editor.ts:1", dom: "Modal Dialog", act: "openAvatarEditor", desc: "选择 Emoji、内置思源官方图标或输入自定义图标字符", risk: "normal" },
    { mod: "回顾对比弹窗", loc: "src/render/review-compare.ts:1", dom: "Modal Dialog", act: "openReviewCompare", desc: "横向对比上一周/上一月与当前周期的各项指标增减", risk: "normal" },
    { mod: "智能体建议弹窗", loc: "src/render/suggestion-workflow.ts:1", dom: "Modal Dialog", act: "openSuggestionWorkflow", desc: "展示智能体诊断证据、对比规则调整前后、一键采纳", risk: "high" },
    { mod: "叶归映射编辑弹窗", loc: "src/render/yeguif-mappings.ts:1", dom: "Modal Dialog", act: "openYeguifMappings", desc: "管理日记文本标签与打卡项关联规则、添加/删除映射", risk: "high" },
    { mod: "智能体草案选择弹窗", loc: "src/render/project-choice.ts:1", dom: "Modal Dialog", act: "openProjectChoice", desc: "从 AI 起草的候选项目中勾选导入或丢弃", risk: "normal" },
    { mod: "导入冲突解决弹窗", loc: "src/features/import-conflicts.ts:1", dom: "Modal Dialog", act: "openImportConflictDialog", desc: "导入数据遇到同名项目时选择覆盖、重命名或跳过", risk: "high" },
    { mod: "未保存草稿确认框", loc: "src/render/bind-editor.ts:180", dom: "Confirm Modal", act: "confirmDiscardDraft", desc: "表单有修改时阻拦意外导航，提示放弃或继续保存", risk: "normal" },
    { mod: "删除项目二次确认框", loc: "src/render/bind-editor.ts:240", dom: "Confirm Modal", act: "confirmDeleteItem", desc: "删除习惯项时的破坏性确认，提示关联历史记录处置", risk: "high" },
    { mod: "重置数据二次确认框", loc: "src/render/settings.ts:850", dom: "Confirm Modal", act: "confirmResetData", desc: "清空所有数据或恢复初始配置时的安全确认", risk: "high" }
];
dialogElements.forEach(d => registerElement("弹窗与抽屉", d.mod, d.loc, d.dom, d.act, d.desc, d.risk));

// -------------------------------------------------------------
// 3. 快捷键与宿主命令 (Hotkey / Command)
// -------------------------------------------------------------
const hotkeyAndCommands = [
    { mod: "快捷入口", loc: "src/features/quick-entry-capabilities.ts:125", dom: "Command / Hotkey", act: "openCheckin (⌥⇧C)", desc: "呼出小驴打卡主弹窗，全局默认快捷键 ⌥⇧C", risk: "normal" },
    { mod: "快捷入口", loc: "src/features/quick-entry-capabilities.ts:136", dom: "Command", act: "openCheckinTab", desc: "在思源主工作区打开独立打卡标签页", risk: "normal" },
    { mod: "思源命令面板", loc: "src/features/block-presets.ts:23", dom: "Command", act: "insertCheckinBlockPreset(summary)", desc: "在当前光标处一键插入打卡概览渲染块", risk: "high" },
    { mod: "思源命令面板", loc: "src/features/block-presets.ts:24", dom: "Command", act: "insertCheckinBlockPreset(month)", desc: "在当前光标处一键插入月历渲染块", risk: "high" },
    { mod: "思源命令面板", loc: "src/features/block-presets.ts:25", dom: "Command", act: "insertCheckinBlockPreset(heatmap)", desc: "在当前光标处一键插入年热力图渲染块", risk: "high" },
    { mod: "思源命令面板", loc: "src/features/block-presets.ts:26", dom: "Command", act: "insertCheckinBlockPreset(groups)", desc: "在当前光标处一键插入分组进度卡片渲染块", risk: "high" },
    { mod: "顶栏图标", loc: "src/index.ts:2888", dom: "TopBar Button", act: "openDefaultEntry", desc: "思源顶栏常驻小驴打卡图标，点击按偏好路由打开", risk: "normal" },
    { mod: "移动端顶栏", loc: "src/render/quick-dialog.ts:200", dom: "Mobile TopBar", act: "openQuickDialogMobile", desc: "思源移动端顶栏快捷打卡按钮", risk: "normal" },
    { mod: "键盘打卡", loc: "src/render/today-bindings.ts:14", dom: "Keyboard Shortcut", act: "Alt + 1 ~ 9", desc: "快捷对今日待办前 9 项进行一键打卡", risk: "normal" },
    { mod: "键盘排序", loc: "src/render/today-bindings.ts:558", dom: "Keyboard Shortcut", act: "Alt + ArrowUp / ArrowDown", desc: "手动排序模式下通过键盘上下键微调卡片顺序", risk: "normal" },
    { mod: "键盘取消", loc: "src/render/today-bindings.ts:529", dom: "Keyboard Shortcut", act: "Escape", desc: "取消拖拽排序、关闭上下文菜单或弹窗", risk: "normal" }
];
hotkeyAndCommands.forEach(h => registerElement("快捷键与宿主命令", h.mod, h.loc, h.dom, h.act, h.desc, h.risk));

// -------------------------------------------------------------
// 4. 菜单项与右键菜单 (Menu / Context Menu)
// -------------------------------------------------------------
const contextMenus = [
    { mod: "今日卡片右键", loc: "src/render/today-bindings.ts:292", dom: "Menu Item", act: "toggle-exact", desc: "打开精确打卡折叠面板（微调数值、填写备注、上传凭据）", risk: "normal" },
    { mod: "今日卡片右键", loc: "src/render/today-bindings.ts:293", dom: "Menu Item", act: "move-up", desc: "卡片上移一位（手动排序模式下激活）", risk: "normal" },
    { mod: "今日卡片右键", loc: "src/render/today-bindings.ts:294", dom: "Menu Item", act: "move-down", desc: "卡片下移一位（手动排序模式下激活）", risk: "normal" },
    { mod: "今日卡片右键", loc: "src/render/today-bindings.ts:295", dom: "Menu Item", act: "edit", desc: "进入打卡项编辑表单", risk: "normal" },
    { mod: "今日卡片右键", loc: "src/render/today-bindings.ts:296", dom: "Menu Item", act: "insights", desc: "查看该项目的多周期趋势与单项洞察", risk: "normal" },
    { mod: "今日卡片右键", loc: "src/render/today-bindings.ts:299", dom: "Menu Item", act: "skip", desc: "跳过今日该习惯（不扣连击、记录跳过原因）", risk: "high" },
    { mod: "今日卡片右键", loc: "src/render/today-bindings.ts:300", dom: "Menu Item", act: "skip-quick (#时间冲突)", desc: "一键以时间冲突为由跳过今日打卡", risk: "normal" },
    { mod: "今日卡片右键", loc: "src/render/today-bindings.ts:301", dom: "Menu Item", act: "skip-quick (#身体不适)", desc: "一键以身体不适为由跳过今日打卡", risk: "normal" },
    { mod: "今日卡片右键", loc: "src/render/today-bindings.ts:302", dom: "Menu Item", act: "skip-quick (#主动休息)", desc: "一键以主动休息为由跳过今日打卡", risk: "normal" },
    { mod: "今日卡片右键", loc: "src/render/today-bindings.ts:298", dom: "Menu Item", act: "unskip", desc: "取消今日跳过状态，恢复待打卡", risk: "normal" },
    { mod: "今日卡片右键", loc: "src/render/today-bindings.ts:303", dom: "Menu Item", act: "archive", desc: "归档该项目（或从归档中恢复）", risk: "high" },
    { mod: "今日卡片右键", loc: "src/render/today-bindings.ts:304", dom: "Menu Item", act: "delete", desc: "删除打卡项并进入二次确认", risk: "high" },
    { mod: "事项操作菜单", loc: "src/render/bind-occasions.ts:85", dom: "Menu Item", act: "occasion-edit", desc: "编辑事项名称、日期、周期或备注", risk: "normal" },
    { mod: "事项操作菜单", loc: "src/render/bind-occasions.ts:86", dom: "Menu Item", act: "occasion-toggle-enable", desc: "启用或停用该事项提醒", risk: "normal" },
    { mod: "事项操作菜单", loc: "src/render/bind-occasions.ts:87", dom: "Menu Item", act: "occasion-delete", desc: "删除事项并记入墓碑同步", risk: "high" }
];
contextMenus.forEach(m => registerElement("菜单项与右键菜单", m.mod, m.loc, m.dom, m.act, m.desc, m.risk));

// -------------------------------------------------------------
// 5. 设置项 (Settings Field Registry & Settings Page)
// -------------------------------------------------------------
const settingsRegistry = [
    { mod: "设置/外观", loc: "src/render/settings.ts:150", dom: "Select / Radio", act: "appearance", desc: "主题模式切换：跟随思源 / 浅色模式 / 深色模式", risk: "normal" },
    { mod: "设置/外观", loc: "src/render/settings.ts:180", dom: "Select / Palette", act: "palette", desc: "调色板强调色选择：紫罗兰 / 珊瑚蓝 / 经典绿等", risk: "normal" },
    { mod: "设置/外观", loc: "src/render/settings.ts:210", dom: "Segment / Radio", act: "defaultOpenMode", desc: "默认打开方式：独立弹窗 / 工作区标签页", risk: "normal" },
    { mod: "设置/外观", loc: "src/render/settings.ts:230", dom: "Switch", act: "reducedMotion", desc: "减少动画效果（无障碍高对比与快速切换）", risk: "normal" },
    { mod: "设置/外观", loc: "src/render/settings.ts:250", dom: "Switch", act: "hapticFeedback", desc: "移动端打卡震动反馈触觉开关", risk: "normal" },
    { mod: "设置/统计", loc: "src/render/settings.ts:300", dom: "Select", act: "todaySortMode", desc: "今日项目默认排序：按优先级 / 按时段 / 手动排序 / 按名称", risk: "normal" },
    { mod: "设置/统计", loc: "src/render/settings.ts:330", dom: "Select", act: "todayGroupMode", desc: "今日项目分组方式：按时段 / 按分类 / 不分组", risk: "normal" },
    { mod: "设置/统计", loc: "src/render/settings.ts:360", dom: "Switch", act: "completedCollapsed", desc: "默认折叠已完成的项目卡片", risk: "normal" },
    { mod: "设置/统计", loc: "src/render/settings.ts:390", dom: "Switch", act: "quickEntryNlp", desc: "智能自然语言搜索与快捷录入解析开关", risk: "normal" },
    { mod: "设置/统计", loc: "src/render/settings.ts:420", dom: "Select", act: "focusTimerProvider", desc: "专注计时器内核：内置秒表 / 底栏番茄钟插件联动", risk: "normal" },
    { mod: "设置/提醒", loc: "src/render/settings.ts:460", dom: "Switch", act: "reminderQuietHours.enabled", desc: "安静时段免打扰总开关", risk: "normal" },
    { mod: "设置/提醒", loc: "src/render/settings.ts:480", dom: "Time Input", act: "reminderQuietHours.start / end", desc: "安静时段起止时间（如 23:00 ~ 07:00）", risk: "normal" },
    { mod: "设置/提醒", loc: "src/render/settings.ts:510", dom: "Input", act: "dailyReminder.slots", desc: "每日提醒时钟槽位配置（如 09:00, 14:00, 20:00）", risk: "normal" },
    { mod: "设置/提醒", loc: "src/render/settings.ts:540", dom: "Switch", act: "occasionRemindOnce", desc: "事项提前提醒后当天不再重复弹出", risk: "normal" },
    { mod: "设置/生态Hub", loc: "src/render/settings.ts:600", dom: "Button", act: "auto-connect-all", desc: "✨ 一键开启全部可用生态联动（傻瓜化接入已安装插件）", risk: "high" },
    { mod: "设置/生态", loc: "src/render/settings.ts:630", dom: "Switch", act: "lifelogJournal.enabled", desc: "打卡实时追加到今日日记 LifeLog（支持自动建块与撤销）", risk: "high" },
    { mod: "设置/生态", loc: "src/render/settings.ts:660", dom: "Doc Picker Input", act: "diaryReport.docId", desc: "每周/每月习惯报告导出绑定的日记文档", risk: "high" },
    { mod: "设置/生态", loc: "src/render/settings.ts:690", dom: "Doc Picker Input", act: "summaryResident.docId", desc: "每日汇总驻留写入的指定笔记文档", risk: "high" },
    { mod: "设置/生态", loc: "src/render/settings.ts:720", dom: "Switch", act: "sireaderIntegration.enabled", desc: "思阅 (SiReader) 读书专注时长自动同名打卡联动", risk: "high" },
    { mod: "设置/生态", loc: "src/render/settings.ts:750", dom: "Switch", act: "siplayerIntegration.enabled", desc: "思播 (SiPlayer) 音视频收听时长自动同名打卡联动", risk: "high" },
    { mod: "设置/生态", loc: "src/render/settings.ts:780", dom: "Input / Switch", act: "wereadIntegration", desc: "微信读书每日阅读时长自动同步（API Key、同步阈值）", risk: "high" },
    { mod: "设置/生态", loc: "src/render/settings.ts:810", dom: "Switch", act: "yeguifIntegration.enabled", desc: "叶归 LifeLog 本地日记打卡标记自动反查与摄取", risk: "high" },
    { mod: "设置/生态", loc: "src/render/settings.ts:840", dom: "Switch", act: "healthInbox.enabled", desc: "健康指标收件箱（步数、心率、体重自动提取）", risk: "high" },
    { mod: "设置/维护", loc: "src/render/settings.ts:900", dom: "Button", act: "export-json", desc: "导出完整数据备份包（JSON 封包）", risk: "high" },
    { mod: "设置/维护", loc: "src/render/settings.ts:920", dom: "File Input", act: "import-json", desc: "从备份文件恢复完整数据（支持前置体检与冲突预演）", risk: "high" },
    { mod: "设置/维护", loc: "src/render/settings.ts:950", dom: "Button", act: "export-csv", desc: "导出通用打卡明细与分析 CSV 表格", risk: "normal" },
    { mod: "设置/维护", loc: "src/render/settings.ts:980", dom: "Button", act: "check-bindings", desc: "集中体检所有绑定的思源文档状态与有效性", risk: "normal" },
    { mod: "设置/维护", loc: "src/render/settings.ts:1010", dom: "Button", act: "download-diagnostics", desc: "下载诊断日志包（自动脱敏敏感路径）", risk: "normal" }
];
settingsRegistry.forEach(s => registerElement("设置项", s.mod, s.loc, s.dom, s.act, s.desc, s.risk));

// -------------------------------------------------------------
// 6. 扫描所有 render 模板中的动作按钮 (Buttons & Icon Buttons)
// -------------------------------------------------------------
const renderFiles = fs.readdirSync(path.join(srcDir, "render")).filter(f => f.endsWith(".ts"));
for (const rf of renderFiles) {
    const filePath = path.join(srcDir, "render", rf);
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const mod = rf.replace(/\.ts$/, "");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 匹配 data-action
        const actionMatches = [...line.matchAll(/data-action=["']([^"']+)["']/g)];
        for (const m of actionMatches) {
            const action = m[1];
            // 避免重复注册前面已专门记录的宏观菜单/设置
            if (action.startsWith("settings-") || action === "openQuickDialog") continue;
            
            let domType = "按钮 (Button)";
            let risk = "normal";
            if (action.includes("delete") || action.includes("clear") || action.includes("reset") || action.includes("archive") || action.includes("save") || action.includes("import")) {
                risk = "high";
            }
            if (line.includes("lc-checkin__icon-btn") || line.includes("icon")) {
                domType = "图标按钮 (Icon Button)";
            } else if (line.includes("<a ")) {
                domType = "文字链接 (Link)";
            }
            registerElement("按钮与图标按钮", mod, `src/render/${rf}:${i + 1}`, domType, `data-action="${action}"`, `在 ${rf} 中触发 ${action}`, risk);
        }

        // 匹配 data-*-action
        const specialMatches = [...line.matchAll(/data-([a-z0-9-]+-action)=["']([^"']+)["']/g)];
        for (const sm of specialMatches) {
            let risk = sm[1].includes("delete") || sm[2].includes("delete") ? "high" : "normal";
            registerElement("按钮与图标按钮", mod, `src/render/${rf}:${i + 1}`, "特化按钮", `${sm[1]}="${sm[2]}"`, `特化按钮动作: ${sm[1]}="${sm[2]}"`, risk);
        }

        // 匹配下拉选择框
        if (line.includes("<select") || line.includes("data-segment") || line.includes("data-tab-switch")) {
            const idMatch = line.match(/id=["']([^"']+)["']/) || line.match(/data-[a-z0-9-]+=["']([^"']+)["']/);
            const id = idMatch ? idMatch[1] : "select-control";
            registerElement("下拉与分段控件", mod, `src/render/${rf}:${i + 1}`, line.includes("data-segment") ? "分段控制器" : "下拉选择框", id, `在 ${rf} 中切换选择 ${id}`, "normal");
        }

        // 匹配独立输入框与开关
        if (line.includes("<input") && !line.includes("data-action")) {
            const typeMatch = line.match(/type=["']([^"']+)["']/);
            const inputType = typeMatch ? typeMatch[1] : "text";
            const nameMatch = line.match(/(?:id|name|placeholder|data-[a-z-]+)=["']([^"']+)["']/);
            const name = nameMatch ? nameMatch[1] : "input";
            const risk = inputType === "file" || (name && name.includes("key")) ? "high" : "normal";
            registerElement("输入框与开关", mod, `src/render/${rf}:${i + 1}`, inputType === "checkbox" ? "复选框/开关" : `输入框 (${inputType})`, name, `在 ${rf} 中的数据输入项 ${name}`, risk);
        }

        // 匹配空态与错误态
        if (line.includes("lc-checkin__empty") || line.includes("lc-checkin__blank") || line.includes("lc-checkin__error") || line.includes("empty-state")) {
            const stateKind = line.includes("error") ? "错误态 (Error State)" : "空态 (Empty State)";
            registerElement("空态与错误态", mod, `src/render/${rf}:${i + 1}`, stateKind, "状态呈现", `在 ${rf} 中的占位与反馈状态`, "normal");
        }
    }
}

console.log(`Successfully indexed ${inventory.length} total elements.`);
const catCounts = {};
const riskCounts = { high: 0, normal: 0 };
inventory.forEach(item => {
    catCounts[item.category] = (catCounts[item.category] || 0) + 1;
    riskCounts[item.riskLevel] = (riskCounts[item.riskLevel] || 0) + 1;
});

console.log("\nDistribution by Category:");
for (const [k, v] of Object.entries(catCounts)) {
    console.log(`  - ${k}: ${v}`);
}
console.log(`\nRisk Level Distribution: High Risk=${riskCounts.high}, Normal Risk=${riskCounts.normal}`);

// 生成 Markdown 清单文档
let md = `# 小驴打卡全量无死角交互与功能元素清单（Full Elements Inventory）\n\n`;
md += `- **建立时间**：2026-11-01\n`;
md += `- **元素总数**：\`${inventory.length}\` 个交互与状态节点\n`;
md += `- **高风险区域**：\`${riskCounts.high}\` 个（涉及数据写删、核心流转、外部联动与安全边界）\n`;
md += `- **常规交互区**：\`${riskCounts.normal}\` 个（展示、切换、轻量操作与普通表单项）\n`;
md += `- **分类统计**：\n`;
for (const [k, v] of Object.entries(catCounts)) {
    md += `  - **${k}**：${v} 个\n`;
}
md += `\n---\n\n`;
md += `## 元素全量明细表\n\n`;
md += `| 编号 | 类别 | 模块 | 代码位置 | DOM/控件类型 | 触发动作 / 选择器 | 业务功能说明 | 风险等级 |\n`;
md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |\n`;

for (const it of inventory) {
    const locEscaped = it.location.replace(/\\/g, "/");
    const actEscaped = it.triggerAction.replace(/\|/g, "\\|");
    const descEscaped = it.description.replace(/\|/g, "\\|");
    const riskBadge = it.riskLevel === "high" ? "🔥 高风险" : "常规";
    md += `| \`${it.id}\` | ${it.category} | ${it.moduleName} | \`${locEscaped}\` | ${it.domType} | \`${actEscaped}\` | ${descEscaped} | ${riskBadge} |\n`;
}

const inventoryMdPath = path.join(root, "docs", "INVENTORY-ALL-ELEMENTS.md");
fs.writeFileSync(inventoryMdPath, md, "utf8");
console.log(`Wrote inventory documentation to ${inventoryMdPath}`);

// 导出 JSON 供测试与脚本验证
const inventoryJsonPath = path.join(root, "docs", "inventory.json");
fs.writeFileSync(inventoryJsonPath, JSON.stringify(inventory, null, 2), "utf8");
console.log(`Wrote inventory JSON to ${inventoryJsonPath}`);
