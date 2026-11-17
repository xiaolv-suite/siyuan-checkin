# 小驴打卡全量无死角交互与功能元素清单（Full Elements Inventory）

- **建立时间**：2026-11-01
- **元素总数**：`584` 个交互与状态节点
- **高风险区域**：`117` 个（涉及数据写删、核心流转、外部联动与安全边界）
- **常规交互区**：`467` 个（展示、切换、轻量操作与普通表单项）
- **分类统计**：
  - **页面与面板**：15 个
  - **弹窗与抽屉**：13 个
  - **快捷键与宿主命令**：11 个
  - **菜单项与右键菜单**：15 个
  - **设置项**：28 个
  - **按钮与图标按钮**：339 个
  - **空态与错误态**：24 个
  - **输入框与开关**：77 个
  - **下拉与分段控件**：62 个

---

## 元素全量明细表

| 编号 | 类别 | 模块 | 代码位置 | DOM/控件类型 | 触发动作 / 选择器 | 业务功能说明 | 风险等级 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `E-0001` | 页面与面板 | 今日打卡 | `src/render/bind-today.ts:1` | Page Surface | `页面展示与打卡操作` | 今日打卡主界面，包含 NextHero、待完成与已完成列表 | 🔥 高风险 |
| `E-0002` | 页面与面板 | 新建打卡 | `src/render/editor.ts:1` | Page Surface | `表单展示与编辑` | 打卡项创建与编辑页面，支持智能体草案与完整属性配置 | 🔥 高风险 |
| `E-0003` | 页面与面板 | 回顾概览 | `src/render/review.ts:80` | Tab Panel | `切换概览工作区` | 周/月/年趋势、习惯热力图、周期完成率大卡 | 常规 |
| `E-0004` | 页面与面板 | 回顾明细 | `src/render/review.ts:160` | Tab Panel | `切换明细工作区` | 打卡历史记录流水、多维度来源渠道筛选、撤销与补记 | 🔥 高风险 |
| `E-0005` | 页面与面板 | 回顾分析 | `src/render/review.ts:240` | Tab Panel | `切换分析工作区` | 习惯强度对比、失速项目诊断、相关性洞察与智能体建议 | 常规 |
| `E-0006` | 页面与面板 | 回顾时间轴 | `src/render/review.ts:320` | Tab Panel | `切换时间轴工作区` | LifeLog 真实事件按时间顺序展开浏览与按日下钻 | 常规 |
| `E-0007` | 页面与面板 | 事项管理 | `src/render/occasions.ts:1` | Page Surface | `事项增删改查` | 日期提醒、周年纪念、周期排期事项管理与完成留痕 | 🔥 高风险 |
| `E-0008` | 页面与面板 | 设置中心 | `src/render/settings.ts:1` | Page Surface | `全局设置与维护` | 外观、统计、提醒、生态联动、备份恢复、诊断与自愈 | 🔥 高风险 |
| `E-0009` | 页面与面板 | 更多工具 | `src/render/more.ts:1` | Page Surface | `功能导航分流` | 快捷操作、项目与数据导入导出、帮助指南三板块 | 常规 |
| `E-0010` | 页面与面板 | 归档管理 | `src/render/archived.ts:1` | Page Surface | `归档与恢复操作` | 已停用/已归档打卡项列表，支持解封恢复或彻底销毁 | 🔥 高风险 |
| `E-0011` | 页面与面板 | 侧边栏Dock | `src/index.ts:2751` | Host Dock Panel | `侧边栏快捷打卡` | 思源左侧或右侧嵌入式 Dock 面板，窄宽自动适配 | 常规 |
| `E-0012` | 页面与面板 | 主工作区Tab | `src/index.ts:2785` | Host Tab Panel | `主工作区独立运行` | 思源主区域自定义标签页，宽屏多列网格自适应 | 常规 |
| `E-0013` | 页面与面板 | 嵌入式渲染块 | `src/render/block-renderer.ts:1` | Protyle Render Block | `文档内动态交互` | 嵌入文档的动态打卡卡片、热力图、月历与概览 | 🔥 高风险 |
| `E-0014` | 页面与面板 | 专注计时浮窗 | `src/render/focus-timer.ts:1` | Floating Overlay | `计时与沉浸打卡` | 番茄钟/正向计时悬浮面板，支持暂停、提前结算与放弃 | 常规 |
| `E-0015` | 页面与面板 | 专注微型迷你条 | `src/render/focus-timer.ts:350` | Inline Header Widget | `快捷控制计时` | 今日打卡页顶栏内联的紧凑计时器显示与控制条 | 常规 |
| `E-0016` | 弹窗与抽屉 | 独立快速弹窗 | `src/render/quick-dialog.ts:1` | Modal Dialog | `openQuickDialog` | 全局快捷打卡弹窗（宽屏流体响应、全屏缩放切换） | 常规 |
| `E-0017` | 弹窗与抽屉 | 今日日记LifeLog弹窗 | `src/render/journal-dialog.ts:50` | Modal Dialog | `openJournalDialog` | 手动一键追加今日记录到日记、预览 Markdown 正文 | 🔥 高风险 |
| `E-0018` | 弹窗与抽屉 | 问卷日记打卡弹窗 | `src/render/journal-dialog.ts:180` | Modal Dialog | `openJournalEntry` | 结构化问卷填报并写入日记或指定文档 | 🔥 高风险 |
| `E-0019` | 弹窗与抽屉 | 文档目标选择器 | `src/render/journal-dialog.ts:320` | Modal Dialog | `pickDocumentTarget` | 按笔记本或关键词搜索并选择关联思源文档 | 常规 |
| `E-0020` | 弹窗与抽屉 | 图标头像选择器 | `src/render/avatar-editor.ts:1` | Modal Dialog | `openAvatarEditor` | 选择 Emoji、内置思源官方图标或输入自定义图标字符 | 常规 |
| `E-0021` | 弹窗与抽屉 | 回顾对比弹窗 | `src/render/review-compare.ts:1` | Modal Dialog | `openReviewCompare` | 横向对比上一周/上一月与当前周期的各项指标增减 | 常规 |
| `E-0022` | 弹窗与抽屉 | 智能体建议弹窗 | `src/render/suggestion-workflow.ts:1` | Modal Dialog | `openSuggestionWorkflow` | 展示智能体诊断证据、对比规则调整前后、一键采纳 | 🔥 高风险 |
| `E-0023` | 弹窗与抽屉 | 叶归映射编辑弹窗 | `src/render/yeguif-mappings.ts:1` | Modal Dialog | `openYeguifMappings` | 管理日记文本标签与打卡项关联规则、添加/删除映射 | 🔥 高风险 |
| `E-0024` | 弹窗与抽屉 | 智能体草案选择弹窗 | `src/render/project-choice.ts:1` | Modal Dialog | `openProjectChoice` | 从 AI 起草的候选项目中勾选导入或丢弃 | 常规 |
| `E-0025` | 弹窗与抽屉 | 导入冲突解决弹窗 | `src/features/import-conflicts.ts:1` | Modal Dialog | `openImportConflictDialog` | 导入数据遇到同名项目时选择覆盖、重命名或跳过 | 🔥 高风险 |
| `E-0026` | 弹窗与抽屉 | 未保存草稿确认框 | `src/render/bind-editor.ts:180` | Confirm Modal | `confirmDiscardDraft` | 表单有修改时阻拦意外导航，提示放弃或继续保存 | 常规 |
| `E-0027` | 弹窗与抽屉 | 删除项目二次确认框 | `src/render/bind-editor.ts:240` | Confirm Modal | `confirmDeleteItem` | 删除习惯项时的破坏性确认，提示关联历史记录处置 | 🔥 高风险 |
| `E-0028` | 弹窗与抽屉 | 重置数据二次确认框 | `src/render/settings.ts:850` | Confirm Modal | `confirmResetData` | 清空所有数据或恢复初始配置时的安全确认 | 🔥 高风险 |
| `E-0029` | 快捷键与宿主命令 | 快捷入口 | `src/features/quick-entry-capabilities.ts:125` | Command / Hotkey | `openCheckin (⌥⇧C)` | 呼出小驴打卡主弹窗，全局默认快捷键 ⌥⇧C | 常规 |
| `E-0030` | 快捷键与宿主命令 | 快捷入口 | `src/features/quick-entry-capabilities.ts:136` | Command | `openCheckinTab` | 在思源主工作区打开独立打卡标签页 | 常规 |
| `E-0031` | 快捷键与宿主命令 | 思源命令面板 | `src/features/block-presets.ts:23` | Command | `insertCheckinBlockPreset(summary)` | 在当前光标处一键插入打卡概览渲染块 | 🔥 高风险 |
| `E-0032` | 快捷键与宿主命令 | 思源命令面板 | `src/features/block-presets.ts:24` | Command | `insertCheckinBlockPreset(month)` | 在当前光标处一键插入月历渲染块 | 🔥 高风险 |
| `E-0033` | 快捷键与宿主命令 | 思源命令面板 | `src/features/block-presets.ts:25` | Command | `insertCheckinBlockPreset(heatmap)` | 在当前光标处一键插入年热力图渲染块 | 🔥 高风险 |
| `E-0034` | 快捷键与宿主命令 | 思源命令面板 | `src/features/block-presets.ts:26` | Command | `insertCheckinBlockPreset(groups)` | 在当前光标处一键插入分组进度卡片渲染块 | 🔥 高风险 |
| `E-0035` | 快捷键与宿主命令 | 顶栏图标 | `src/index.ts:2888` | TopBar Button | `openDefaultEntry` | 思源顶栏常驻小驴打卡图标，点击按偏好路由打开 | 常规 |
| `E-0036` | 快捷键与宿主命令 | 移动端顶栏 | `src/render/quick-dialog.ts:200` | Mobile TopBar | `openQuickDialogMobile` | 思源移动端顶栏快捷打卡按钮 | 常规 |
| `E-0037` | 快捷键与宿主命令 | 键盘打卡 | `src/render/today-bindings.ts:14` | Keyboard Shortcut | `Alt + 1 ~ 9` | 快捷对今日待办前 9 项进行一键打卡 | 常规 |
| `E-0038` | 快捷键与宿主命令 | 键盘排序 | `src/render/today-bindings.ts:558` | Keyboard Shortcut | `Alt + ArrowUp / ArrowDown` | 手动排序模式下通过键盘上下键微调卡片顺序 | 常规 |
| `E-0039` | 快捷键与宿主命令 | 键盘取消 | `src/render/today-bindings.ts:529` | Keyboard Shortcut | `Escape` | 取消拖拽排序、关闭上下文菜单或弹窗 | 常规 |
| `E-0040` | 菜单项与右键菜单 | 今日卡片右键 | `src/render/today-bindings.ts:292` | Menu Item | `toggle-exact` | 打开精确打卡折叠面板（微调数值、填写备注、上传凭据） | 常规 |
| `E-0041` | 菜单项与右键菜单 | 今日卡片右键 | `src/render/today-bindings.ts:293` | Menu Item | `move-up` | 卡片上移一位（手动排序模式下激活） | 常规 |
| `E-0042` | 菜单项与右键菜单 | 今日卡片右键 | `src/render/today-bindings.ts:294` | Menu Item | `move-down` | 卡片下移一位（手动排序模式下激活） | 常规 |
| `E-0043` | 菜单项与右键菜单 | 今日卡片右键 | `src/render/today-bindings.ts:295` | Menu Item | `edit` | 进入打卡项编辑表单 | 常规 |
| `E-0044` | 菜单项与右键菜单 | 今日卡片右键 | `src/render/today-bindings.ts:296` | Menu Item | `insights` | 查看该项目的多周期趋势与单项洞察 | 常规 |
| `E-0045` | 菜单项与右键菜单 | 今日卡片右键 | `src/render/today-bindings.ts:299` | Menu Item | `skip` | 跳过今日该习惯（不扣连击、记录跳过原因） | 🔥 高风险 |
| `E-0046` | 菜单项与右键菜单 | 今日卡片右键 | `src/render/today-bindings.ts:300` | Menu Item | `skip-quick (#时间冲突)` | 一键以时间冲突为由跳过今日打卡 | 常规 |
| `E-0047` | 菜单项与右键菜单 | 今日卡片右键 | `src/render/today-bindings.ts:301` | Menu Item | `skip-quick (#身体不适)` | 一键以身体不适为由跳过今日打卡 | 常规 |
| `E-0048` | 菜单项与右键菜单 | 今日卡片右键 | `src/render/today-bindings.ts:302` | Menu Item | `skip-quick (#主动休息)` | 一键以主动休息为由跳过今日打卡 | 常规 |
| `E-0049` | 菜单项与右键菜单 | 今日卡片右键 | `src/render/today-bindings.ts:298` | Menu Item | `unskip` | 取消今日跳过状态，恢复待打卡 | 常规 |
| `E-0050` | 菜单项与右键菜单 | 今日卡片右键 | `src/render/today-bindings.ts:303` | Menu Item | `archive` | 归档该项目（或从归档中恢复） | 🔥 高风险 |
| `E-0051` | 菜单项与右键菜单 | 今日卡片右键 | `src/render/today-bindings.ts:304` | Menu Item | `delete` | 删除打卡项并进入二次确认 | 🔥 高风险 |
| `E-0052` | 菜单项与右键菜单 | 事项操作菜单 | `src/render/bind-occasions.ts:85` | Menu Item | `occasion-edit` | 编辑事项名称、日期、周期或备注 | 常规 |
| `E-0053` | 菜单项与右键菜单 | 事项操作菜单 | `src/render/bind-occasions.ts:86` | Menu Item | `occasion-toggle-enable` | 启用或停用该事项提醒 | 常规 |
| `E-0054` | 菜单项与右键菜单 | 事项操作菜单 | `src/render/bind-occasions.ts:87` | Menu Item | `occasion-delete` | 删除事项并记入墓碑同步 | 🔥 高风险 |
| `E-0055` | 设置项 | 设置/外观 | `src/render/settings.ts:150` | Select / Radio | `appearance` | 主题模式切换：跟随思源 / 浅色模式 / 深色模式 | 常规 |
| `E-0056` | 设置项 | 设置/外观 | `src/render/settings.ts:180` | Select / Palette | `palette` | 调色板强调色选择：紫罗兰 / 珊瑚蓝 / 经典绿等 | 常规 |
| `E-0057` | 设置项 | 设置/外观 | `src/render/settings.ts:210` | Segment / Radio | `defaultOpenMode` | 默认打开方式：独立弹窗 / 工作区标签页 | 常规 |
| `E-0058` | 设置项 | 设置/外观 | `src/render/settings.ts:230` | Switch | `reducedMotion` | 减少动画效果（无障碍高对比与快速切换） | 常规 |
| `E-0059` | 设置项 | 设置/外观 | `src/render/settings.ts:250` | Switch | `hapticFeedback` | 移动端打卡震动反馈触觉开关 | 常规 |
| `E-0060` | 设置项 | 设置/统计 | `src/render/settings.ts:300` | Select | `todaySortMode` | 今日项目默认排序：按优先级 / 按时段 / 手动排序 / 按名称 | 常规 |
| `E-0061` | 设置项 | 设置/统计 | `src/render/settings.ts:330` | Select | `todayGroupMode` | 今日项目分组方式：按时段 / 按分类 / 不分组 | 常规 |
| `E-0062` | 设置项 | 设置/统计 | `src/render/settings.ts:360` | Switch | `completedCollapsed` | 默认折叠已完成的项目卡片 | 常规 |
| `E-0063` | 设置项 | 设置/统计 | `src/render/settings.ts:390` | Switch | `quickEntryNlp` | 智能自然语言搜索与快捷录入解析开关 | 常规 |
| `E-0064` | 设置项 | 设置/统计 | `src/render/settings.ts:420` | Select | `focusTimerProvider` | 专注计时器内核：内置秒表 / 底栏番茄钟插件联动 | 常规 |
| `E-0065` | 设置项 | 设置/提醒 | `src/render/settings.ts:460` | Switch | `reminderQuietHours.enabled` | 安静时段免打扰总开关 | 常规 |
| `E-0066` | 设置项 | 设置/提醒 | `src/render/settings.ts:480` | Time Input | `reminderQuietHours.start / end` | 安静时段起止时间（如 23:00 ~ 07:00） | 常规 |
| `E-0067` | 设置项 | 设置/提醒 | `src/render/settings.ts:510` | Input | `dailyReminder.slots` | 每日提醒时钟槽位配置（如 09:00, 14:00, 20:00） | 常规 |
| `E-0068` | 设置项 | 设置/提醒 | `src/render/settings.ts:540` | Switch | `occasionRemindOnce` | 事项提前提醒后当天不再重复弹出 | 常规 |
| `E-0069` | 设置项 | 设置/生态Hub | `src/render/settings.ts:600` | Button | `auto-connect-all` | ✨ 一键开启全部可用生态联动（傻瓜化接入已安装插件） | 🔥 高风险 |
| `E-0070` | 设置项 | 设置/生态 | `src/render/settings.ts:630` | Switch | `lifelogJournal.enabled` | 打卡实时追加到今日日记 LifeLog（支持自动建块与撤销） | 🔥 高风险 |
| `E-0071` | 设置项 | 设置/生态 | `src/render/settings.ts:660` | Doc Picker Input | `diaryReport.docId` | 每周/每月习惯报告导出绑定的日记文档 | 🔥 高风险 |
| `E-0072` | 设置项 | 设置/生态 | `src/render/settings.ts:690` | Doc Picker Input | `summaryResident.docId` | 每日汇总驻留写入的指定笔记文档 | 🔥 高风险 |
| `E-0073` | 设置项 | 设置/生态 | `src/render/settings.ts:720` | Switch | `sireaderIntegration.enabled` | 思阅 (SiReader) 读书专注时长自动同名打卡联动 | 🔥 高风险 |
| `E-0074` | 设置项 | 设置/生态 | `src/render/settings.ts:750` | Switch | `siplayerIntegration.enabled` | 思播 (SiPlayer) 音视频收听时长自动同名打卡联动 | 🔥 高风险 |
| `E-0075` | 设置项 | 设置/生态 | `src/render/settings.ts:780` | Input / Switch | `wereadIntegration` | 微信读书每日阅读时长自动同步（API Key、同步阈值） | 🔥 高风险 |
| `E-0076` | 设置项 | 设置/生态 | `src/render/settings.ts:810` | Switch | `yeguifIntegration.enabled` | 叶归 LifeLog 本地日记打卡标记自动反查与摄取 | 🔥 高风险 |
| `E-0077` | 设置项 | 设置/生态 | `src/render/settings.ts:840` | Switch | `healthInbox.enabled` | 健康指标收件箱（步数、心率、体重自动提取） | 🔥 高风险 |
| `E-0078` | 设置项 | 设置/维护 | `src/render/settings.ts:900` | Button | `export-json` | 导出完整数据备份包（JSON 封包） | 🔥 高风险 |
| `E-0079` | 设置项 | 设置/维护 | `src/render/settings.ts:920` | File Input | `import-json` | 从备份文件恢复完整数据（支持前置体检与冲突预演） | 🔥 高风险 |
| `E-0080` | 设置项 | 设置/维护 | `src/render/settings.ts:950` | Button | `export-csv` | 导出通用打卡明细与分析 CSV 表格 | 常规 |
| `E-0081` | 设置项 | 设置/维护 | `src/render/settings.ts:980` | Button | `check-bindings` | 集中体检所有绑定的思源文档状态与有效性 | 常规 |
| `E-0082` | 设置项 | 设置/维护 | `src/render/settings.ts:1010` | Button | `download-diagnostics` | 下载诊断日志包（自动脱敏敏感路径） | 常规 |
| `E-0083` | 按钮与图标按钮 | archived | `src/render/archived.ts:115` | 图标按钮 (Icon Button) | `data-action="restore-archived"` | 在 archived.ts 中触发 restore-archived | 🔥 高风险 |
| `E-0084` | 按钮与图标按钮 | archived | `src/render/archived.ts:115` | 图标按钮 (Icon Button) | `data-action="delete-archived"` | 在 archived.ts 中触发 delete-archived | 🔥 高风险 |
| `E-0085` | 空态与错误态 | archived | `src/render/archived.ts:116` | 空态 (Empty State) | `状态呈现` | 在 archived.ts 中的占位与反馈状态 | 常规 |
| `E-0086` | 按钮与图标按钮 | archived | `src/render/archived.ts:118` | 按钮 (Button) | `data-action="bulk-restore-archived"` | 在 archived.ts 中触发 bulk-restore-archived | 🔥 高风险 |
| `E-0087` | 按钮与图标按钮 | archived | `src/render/archived.ts:118` | 按钮 (Button) | `data-action="bulk-delete-archived"` | 在 archived.ts 中触发 bulk-delete-archived | 🔥 高风险 |
| `E-0088` | 按钮与图标按钮 | archived | `src/render/archived.ts:119` | 按钮 (Button) | `data-action="clear-archived-query"` | 在 archived.ts 中触发 clear-archived-query | 🔥 高风险 |
| `E-0089` | 输入框与开关 | avatar-editor | `src/render/avatar-editor.ts:30` | 输入框 (range) | `input` | 在 avatar-editor.ts 中的数据输入项 input | 常规 |
| `E-0090` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:213` | 按钮 (Button) | `data-action="retry-save"` | 在 bind-editor.ts 中触发 retry-save | 🔥 高风险 |
| `E-0091` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:297` | 图标按钮 (Icon Button) | `data-action="clear-icon-query"` | 在 bind-editor.ts 中触发 clear-icon-query | 🔥 高风险 |
| `E-0092` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:306` | 图标按钮 (Icon Button) | `data-action="clear-icon-query"` | 在 bind-editor.ts 中触发 clear-icon-query | 🔥 高风险 |
| `E-0093` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:313` | 按钮 (Button) | `data-action="back"` | 在 bind-editor.ts 中触发 back | 常规 |
| `E-0094` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:321` | 按钮 (Button) | `data-action="archive"` | 在 bind-editor.ts 中触发 archive | 🔥 高风险 |
| `E-0095` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:325` | 按钮 (Button) | `data-action="delete-item"` | 在 bind-editor.ts 中触发 delete-item | 🔥 高风险 |
| `E-0096` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:372` | 按钮 (Button) | `data-action="anchor-open-picker"` | 在 bind-editor.ts 中触发 anchor-open-picker | 常规 |
| `E-0097` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:373` | 按钮 (Button) | `data-action="anchor-clear"` | 在 bind-editor.ts 中触发 anchor-clear | 🔥 高风险 |
| `E-0098` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:377` | 按钮 (Button) | `data-action="anchor-create"` | 在 bind-editor.ts 中触发 anchor-create | 常规 |
| `E-0099` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:378` | 按钮 (Button) | `data-action="anchor-create-confirm"` | 在 bind-editor.ts 中触发 anchor-create-confirm | 常规 |
| `E-0100` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:517` | 图标按钮 (Icon Button) | `data-action="apply-custom-icon"` | 在 bind-editor.ts 中触发 apply-custom-icon | 常规 |
| `E-0101` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:533` | 图标按钮 (Icon Button) | `data-action="download-custom-icon"` | 在 bind-editor.ts 中触发 download-custom-icon | 常规 |
| `E-0102` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:550` | 图标按钮 (Icon Button) | `data-action="open-iconfont"` | 在 bind-editor.ts 中触发 open-iconfont | 常规 |
| `E-0103` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:709` | 按钮 (Button) | `data-action="anchor-today"` | 在 bind-editor.ts 中触发 anchor-today | 常规 |
| `E-0104` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:745` | 按钮 (Button) | `data-action="clear-template-query"` | 在 bind-editor.ts 中触发 clear-template-query | 🔥 高风险 |
| `E-0105` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:746` | 按钮 (Button) | `data-action="clear-template-filter"` | 在 bind-editor.ts 中触发 clear-template-filter | 🔥 高风险 |
| `E-0106` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:747` | 按钮 (Button) | `data-action="template-show-all"` | 在 bind-editor.ts 中触发 template-show-all | 常规 |
| `E-0107` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:751` | 按钮 (Button) | `data-action="template-show-all"` | 在 bind-editor.ts 中触发 template-show-all | 常规 |
| `E-0108` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:792` | 按钮 (Button) | `data-action="clear-template-query"` | 在 bind-editor.ts 中触发 clear-template-query | 🔥 高风险 |
| `E-0109` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:799` | 按钮 (Button) | `data-action="clear-template-filter"` | 在 bind-editor.ts 中触发 clear-template-filter | 🔥 高风险 |
| `E-0110` | 输入框与开关 | bind-editor | `src/render/bind-editor.ts:984` | 复选框/开关 | `${index}` | 在 bind-editor.ts 中的数据输入项 ${index} | 常规 |
| `E-0111` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:1208` | 按钮 (Button) | `data-action="save-template"` | 在 bind-editor.ts 中触发 save-template | 🔥 高风险 |
| `E-0112` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:1488` | 按钮 (Button) | `data-action="ai-draft-clear"` | 在 bind-editor.ts 中触发 ai-draft-clear | 🔥 高风险 |
| `E-0113` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:1492` | 按钮 (Button) | `data-action="ai-draft-infer"` | 在 bind-editor.ts 中触发 ai-draft-infer | 常规 |
| `E-0114` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:1493` | 按钮 (Button) | `data-action="ai-draft-to-occasion"` | 在 bind-editor.ts 中触发 ai-draft-to-occasion | 常规 |
| `E-0115` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:1531` | 按钮 (Button) | `data-action="ai-draft-apply"` | 在 bind-editor.ts 中触发 ai-draft-apply | 常规 |
| `E-0116` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:1683` | 按钮 (Button) | `data-action="ai-draft-copy-prompt"` | 在 bind-editor.ts 中触发 ai-draft-copy-prompt | 常规 |
| `E-0117` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:1727` | 按钮 (Button) | `data-action="ai-draft-apply"` | 在 bind-editor.ts 中触发 ai-draft-apply | 常规 |
| `E-0118` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:1763` | 按钮 (Button) | `data-action="ai-draft-history-clear"` | 在 bind-editor.ts 中触发 ai-draft-history-clear | 🔥 高风险 |
| `E-0119` | 按钮与图标按钮 | bind-editor | `src/render/bind-editor.ts:1767` | 按钮 (Button) | `data-action="ai-draft-discard"` | 在 bind-editor.ts 中触发 ai-draft-discard | 常规 |
| `E-0120` | 按钮与图标按钮 | bind-occasions | `src/render/bind-occasions.ts:118` | 按钮 (Button) | `data-action="back"` | 在 bind-occasions.ts 中触发 back | 常规 |
| `E-0121` | 按钮与图标按钮 | bind-occasions | `src/render/bind-occasions.ts:118` | 按钮 (Button) | `data-action="occasion-back"` | 在 bind-occasions.ts 中触发 occasion-back | 常规 |
| `E-0122` | 按钮与图标按钮 | bind-occasions | `src/render/bind-occasions.ts:130` | 按钮 (Button) | `data-action="new-occasion"` | 在 bind-occasions.ts 中触发 new-occasion | 常规 |
| `E-0123` | 按钮与图标按钮 | bind-occasions | `src/render/bind-occasions.ts:131` | 按钮 (Button) | `data-action="export-occasion-ics"` | 在 bind-occasions.ts 中触发 export-occasion-ics | 常规 |
| `E-0124` | 按钮与图标按钮 | bind-occasions | `src/render/bind-occasions.ts:132` | 按钮 (Button) | `data-action="cancel-occasion-edit"` | 在 bind-occasions.ts 中触发 cancel-occasion-edit | 常规 |
| `E-0125` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:611` | 按钮 (Button) | `data-action="back"` | 在 bind-page-navigation.ts 中触发 back | 常规 |
| `E-0126` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:662` | 按钮 (Button) | `data-action="analysis-filter-group"` | 在 bind-page-navigation.ts 中触发 analysis-filter-group | 常规 |
| `E-0127` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:666` | 按钮 (Button) | `data-action="analysis-filter-group"` | 在 bind-page-navigation.ts 中触发 analysis-filter-group | 常规 |
| `E-0128` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:668` | 按钮 (Button) | `data-action="analysis-filter-item"` | 在 bind-page-navigation.ts 中触发 analysis-filter-item | 常规 |
| `E-0129` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:671` | 按钮 (Button) | `data-action="analysis-filter-item"` | 在 bind-page-navigation.ts 中触发 analysis-filter-item | 常规 |
| `E-0130` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:673` | 按钮 (Button) | `data-action="clear-analysis-filter"` | 在 bind-page-navigation.ts 中触发 clear-analysis-filter | 🔥 高风险 |
| `E-0131` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:717` | 按钮 (Button) | `data-action="review-assistant"` | 在 bind-page-navigation.ts 中触发 review-assistant | 常规 |
| `E-0132` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:777` | 按钮 (Button) | `data-action="clear-item-compare-query"` | 在 bind-page-navigation.ts 中触发 clear-item-compare-query | 🔥 高风险 |
| `E-0133` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:942` | 按钮 (Button) | `data-action="change-heatmap-theme"` | 在 bind-page-navigation.ts 中触发 change-heatmap-theme | 常规 |
| `E-0134` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:952` | 按钮 (Button) | `data-action="change-heatmap-theme"` | 在 bind-page-navigation.ts 中触发 change-heatmap-theme | 常规 |
| `E-0135` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:974` | 按钮 (Button) | `data-action="archived"` | 在 bind-page-navigation.ts 中触发 archived | 🔥 高风险 |
| `E-0136` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:975` | 按钮 (Button) | `data-action="occasions"` | 在 bind-page-navigation.ts 中触发 occasions | 常规 |
| `E-0137` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1048` | 按钮 (Button) | `data-action="clear-history-query"` | 在 bind-page-navigation.ts 中触发 clear-history-query | 🔥 高风险 |
| `E-0138` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1055` | 按钮 (Button) | `data-action="clear-history-filters"` | 在 bind-page-navigation.ts 中触发 clear-history-filters | 🔥 高风险 |
| `E-0139` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1150` | 特化按钮 | `history-batch-action="skip"` | 特化按钮动作: history-batch-action="skip" | 常规 |
| `E-0140` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1329` | 按钮 (Button) | `data-action="clear-archived-query"` | 在 bind-page-navigation.ts 中触发 clear-archived-query | 🔥 高风险 |
| `E-0141` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1362` | 按钮 (Button) | `data-action="${action}"` | 在 bind-page-navigation.ts 中触发 ${action} | 常规 |
| `E-0142` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1364` | 按钮 (Button) | `data-action="back"` | 在 bind-page-navigation.ts 中触发 back | 常规 |
| `E-0143` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1412` | 按钮 (Button) | `data-action="bulk-restore-archived"` | 在 bind-page-navigation.ts 中触发 bulk-restore-archived | 🔥 高风险 |
| `E-0144` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1419` | 按钮 (Button) | `data-action="bulk-delete-archived"` | 在 bind-page-navigation.ts 中触发 bulk-delete-archived | 🔥 高风险 |
| `E-0145` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1472` | 按钮 (Button) | `data-action="generate-summary"` | 在 bind-page-navigation.ts 中触发 generate-summary | 常规 |
| `E-0146` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1504` | 按钮 (Button) | `data-action="view-analysis-history"` | 在 bind-page-navigation.ts 中触发 view-analysis-history | 常规 |
| `E-0147` | 下拉与分段控件 | bind-page-navigation | `src/render/bind-page-navigation.ts:1519` | 下拉选择框 | `${appearanceAttr}` | 在 bind-page-navigation.ts 中切换选择 ${appearanceAttr} | 常规 |
| `E-0148` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1584` | 按钮 (Button) | `data-action="preview-agent-suggestion"` | 在 bind-page-navigation.ts 中触发 preview-agent-suggestion | 常规 |
| `E-0149` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1598` | 按钮 (Button) | `data-action="preview-agent-schedule-suggestion"` | 在 bind-page-navigation.ts 中触发 preview-agent-schedule-suggestion | 常规 |
| `E-0150` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1614` | 按钮 (Button) | `data-action="edit-project-draft"` | 在 bind-page-navigation.ts 中触发 edit-project-draft | 常规 |
| `E-0151` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1652` | 按钮 (Button) | `data-action="copy-weekly-report"` | 在 bind-page-navigation.ts 中触发 copy-weekly-report | 常规 |
| `E-0152` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1664` | 按钮 (Button) | `data-action="${action}"` | 在 bind-page-navigation.ts 中触发 ${action} | 常规 |
| `E-0153` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1696` | 按钮 (Button) | `data-action="export-report"` | 在 bind-page-navigation.ts 中触发 export-report | 常规 |
| `E-0154` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1771` | 按钮 (Button) | `data-action="delete-saved-view"` | 在 bind-page-navigation.ts 中触发 delete-saved-view | 🔥 高风险 |
| `E-0155` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1775` | 按钮 (Button) | `data-action="save-saved-view"` | 在 bind-page-navigation.ts 中触发 save-saved-view | 🔥 高风险 |
| `E-0156` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1779` | 按钮 (Button) | `data-action="delete-saved-view"` | 在 bind-page-navigation.ts 中触发 delete-saved-view | 🔥 高风险 |
| `E-0157` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1784` | 按钮 (Button) | `data-action="export-all"` | 在 bind-page-navigation.ts 中触发 export-all | 常规 |
| `E-0158` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1789` | 按钮 (Button) | `data-action="export-csv"` | 在 bind-page-navigation.ts 中触发 export-csv | 常规 |
| `E-0159` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1790` | 按钮 (Button) | `data-action="export-json"` | 在 bind-page-navigation.ts 中触发 export-json | 常规 |
| `E-0160` | 按钮与图标按钮 | bind-page-navigation | `src/render/bind-page-navigation.ts:1791` | 按钮 (Button) | `data-action="export-share-card"` | 在 bind-page-navigation.ts 中触发 export-share-card | 常规 |
| `E-0161` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:172` | 按钮 (Button) | `data-action="record"` | 在 bind-today.ts 中触发 record | 常规 |
| `E-0162` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:172` | 按钮 (Button) | `data-action="quick-record"` | 在 bind-today.ts 中触发 quick-record | 常规 |
| `E-0163` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:172` | 按钮 (Button) | `data-action="toggle"` | 在 bind-today.ts 中触发 toggle | 常规 |
| `E-0164` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:182` | 按钮 (Button) | `data-action="focus"` | 在 bind-today.ts 中触发 focus | 常规 |
| `E-0165` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:217` | 按钮 (Button) | `data-action="quick-record"` | 在 bind-today.ts 中触发 quick-record | 常规 |
| `E-0166` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:217` | 按钮 (Button) | `data-action="record"` | 在 bind-today.ts 中触发 record | 常规 |
| `E-0167` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:217` | 按钮 (Button) | `data-action="toggle"` | 在 bind-today.ts 中触发 toggle | 常规 |
| `E-0168` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:279` | 按钮 (Button) | `data-action="quick-entry-record"` | 在 bind-today.ts 中触发 quick-entry-record | 常规 |
| `E-0169` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:288` | 按钮 (Button) | `data-action="record"` | 在 bind-today.ts 中触发 record | 常规 |
| `E-0170` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:288` | 按钮 (Button) | `data-action="quick-record"` | 在 bind-today.ts 中触发 quick-record | 常规 |
| `E-0171` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:288` | 按钮 (Button) | `data-action="toggle"` | 在 bind-today.ts 中触发 toggle | 常规 |
| `E-0172` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:302` | 按钮 (Button) | `data-action="cancel-quick-entry"` | 在 bind-today.ts 中触发 cancel-quick-entry | 常规 |
| `E-0173` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:310` | 按钮 (Button) | `data-action="quick-entry-record"` | 在 bind-today.ts 中触发 quick-entry-record | 常规 |
| `E-0174` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:330` | 按钮 (Button) | `data-action="record"` | 在 bind-today.ts 中触发 record | 常规 |
| `E-0175` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:330` | 按钮 (Button) | `data-action="quick-record"` | 在 bind-today.ts 中触发 quick-record | 常规 |
| `E-0176` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:330` | 按钮 (Button) | `data-action="toggle"` | 在 bind-today.ts 中触发 toggle | 常规 |
| `E-0177` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:332` | 按钮 (Button) | `data-action="clear-search"` | 在 bind-today.ts 中触发 clear-search | 🔥 高风险 |
| `E-0178` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:338` | 按钮 (Button) | `data-action="undo-record"` | 在 bind-today.ts 中触发 undo-record | 常规 |
| `E-0179` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:352` | 按钮 (Button) | `data-action="toggle-record-details"` | 在 bind-today.ts 中触发 toggle-record-details | 常规 |
| `E-0180` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:361` | 按钮 (Button) | `data-action="retry-save"` | 在 bind-today.ts 中触发 retry-save | 🔥 高风险 |
| `E-0181` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:374` | 按钮 (Button) | `data-action="record"` | 在 bind-today.ts 中触发 record | 常规 |
| `E-0182` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:374` | 按钮 (Button) | `data-action="quick-record"` | 在 bind-today.ts 中触发 quick-record | 常规 |
| `E-0183` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:374` | 按钮 (Button) | `data-action="toggle"` | 在 bind-today.ts 中触发 toggle | 常规 |
| `E-0184` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:376` | 按钮 (Button) | `data-action="toggle-pending-only"` | 在 bind-today.ts 中触发 toggle-pending-only | 常规 |
| `E-0185` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:380` | 按钮 (Button) | `data-action="history"` | 在 bind-today.ts 中触发 history | 常规 |
| `E-0186` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:381` | 按钮 (Button) | `data-action="skip-onboard"` | 在 bind-today.ts 中触发 skip-onboard | 常规 |
| `E-0187` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:382` | 按钮 (Button) | `data-action="archived"` | 在 bind-today.ts 中触发 archived | 🔥 高风险 |
| `E-0188` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:413` | 按钮 (Button) | `data-action="summary"` | 在 bind-today.ts 中触发 summary | 常规 |
| `E-0189` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:422` | 按钮 (Button) | `data-action="insights"` | 在 bind-today.ts 中触发 insights | 常规 |
| `E-0190` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:423` | 按钮 (Button) | `data-action="occasions"` | 在 bind-today.ts 中触发 occasions | 常规 |
| `E-0191` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:425` | 按钮 (Button) | `data-action="this-day-jump"` | 在 bind-today.ts 中触发 this-day-jump | 常规 |
| `E-0192` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:436` | 按钮 (Button) | `data-action="settings"` | 在 bind-today.ts 中触发 settings | 常规 |
| `E-0193` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:437` | 按钮 (Button) | `data-action="open-tab"` | 在 bind-today.ts 中触发 open-tab | 常规 |
| `E-0194` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:452` | 按钮 (Button) | `data-action="toggle-completed"` | 在 bind-today.ts 中触发 toggle-completed | 常规 |
| `E-0195` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:472` | 按钮 (Button) | `data-action="add"` | 在 bind-today.ts 中触发 add | 常规 |
| `E-0196` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:478` | 按钮 (Button) | `data-action="edit"` | 在 bind-today.ts 中触发 edit | 常规 |
| `E-0197` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:484` | 按钮 (Button) | `data-action="insights"` | 在 bind-today.ts 中触发 insights | 常规 |
| `E-0198` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:488` | 按钮 (Button) | `data-action="toggle"` | 在 bind-today.ts 中触发 toggle | 常规 |
| `E-0199` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:497` | 按钮 (Button) | `data-action="record"` | 在 bind-today.ts 中触发 record | 常规 |
| `E-0200` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:502` | 按钮 (Button) | `data-action="record"` | 在 bind-today.ts 中触发 record | 常规 |
| `E-0201` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:502` | 按钮 (Button) | `data-action="quick-record"` | 在 bind-today.ts 中触发 quick-record | 常规 |
| `E-0202` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:502` | 按钮 (Button) | `data-action="toggle"` | 在 bind-today.ts 中触发 toggle | 常规 |
| `E-0203` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:504` | 按钮 (Button) | `data-action="focus"` | 在 bind-today.ts 中触发 focus | 常规 |
| `E-0204` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:526` | 按钮 (Button) | `data-action="focus"` | 在 bind-today.ts 中触发 focus | 常规 |
| `E-0205` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:526` | 按钮 (Button) | `data-action="record"` | 在 bind-today.ts 中触发 record | 常规 |
| `E-0206` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:526` | 按钮 (Button) | `data-action="quick-record"` | 在 bind-today.ts 中触发 quick-record | 常规 |
| `E-0207` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:528` | 按钮 (Button) | `data-action="quick-record"` | 在 bind-today.ts 中触发 quick-record | 常规 |
| `E-0208` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:546` | 按钮 (Button) | `data-action="record"` | 在 bind-today.ts 中触发 record | 常规 |
| `E-0209` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:546` | 按钮 (Button) | `data-action="quick-record"` | 在 bind-today.ts 中触发 quick-record | 常规 |
| `E-0210` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:546` | 按钮 (Button) | `data-action="toggle"` | 在 bind-today.ts 中触发 toggle | 常规 |
| `E-0211` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:549` | 按钮 (Button) | `data-action="journal"` | 在 bind-today.ts 中触发 journal | 常规 |
| `E-0212` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:553` | 按钮 (Button) | `data-action="toggle-exact"` | 在 bind-today.ts 中触发 toggle-exact | 常规 |
| `E-0213` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:571` | 按钮 (Button) | `data-action="record"` | 在 bind-today.ts 中触发 record | 常规 |
| `E-0214` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:620` | 按钮 (Button) | `data-action="record"` | 在 bind-today.ts 中触发 record | 常规 |
| `E-0215` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:651` | 按钮 (Button) | `data-action="record"` | 在 bind-today.ts 中触发 record | 常规 |
| `E-0216` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:701` | 按钮 (Button) | `data-action="toggle-exact"` | 在 bind-today.ts 中触发 toggle-exact | 常规 |
| `E-0217` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:748` | 按钮 (Button) | `data-action="record"` | 在 bind-today.ts 中触发 record | 常规 |
| `E-0218` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:748` | 按钮 (Button) | `data-action="quick-record"` | 在 bind-today.ts 中触发 quick-record | 常规 |
| `E-0219` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:748` | 按钮 (Button) | `data-action="toggle"` | 在 bind-today.ts 中触发 toggle | 常规 |
| `E-0220` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:752` | 按钮 (Button) | `data-action="toggle-occasion"` | 在 bind-today.ts 中触发 toggle-occasion | 常规 |
| `E-0221` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:757` | 按钮 (Button) | `data-action="toggle-occasion"` | 在 bind-today.ts 中触发 toggle-occasion | 常规 |
| `E-0222` | 按钮与图标按钮 | bind-today | `src/render/bind-today.ts:759` | 按钮 (Button) | `data-action="open-daily-note"` | 在 bind-today.ts 中触发 open-daily-note | 常规 |
| `E-0223` | 输入框与开关 | editor | `src/render/editor.ts:148` | 输入框 (button) | `${escapeHtml(template.id)}` | 在 editor.ts 中的数据输入项 ${escapeHtml(template.id)} | 常规 |
| `E-0224` | 输入框与开关 | editor | `src/render/editor.ts:152` | 输入框 (radio) | `import-disposition-${decision.index}` | 在 editor.ts 中的数据输入项 import-disposition-${decision.index} | 常规 |
| `E-0225` | 输入框与开关 | editor | `src/render/editor.ts:189` | 输入框 (search) | `${t(` | 在 editor.ts 中的数据输入项 ${t( | 常规 |
| `E-0226` | 按钮与图标按钮 | editor | `src/render/editor.ts:190` | 按钮 (Button) | `data-action="clear-template-query"` | 在 editor.ts 中触发 clear-template-query | 🔥 高风险 |
| `E-0227` | 按钮与图标按钮 | editor | `src/render/editor.ts:196` | 按钮 (Button) | `data-action="clear-template-filter"` | 在 editor.ts 中触发 clear-template-filter | 🔥 高风险 |
| `E-0228` | 按钮与图标按钮 | editor | `src/render/editor.ts:198` | 按钮 (Button) | `data-action="template-show-all"` | 在 editor.ts 中触发 template-show-all | 常规 |
| `E-0229` | 按钮与图标按钮 | editor | `src/render/editor.ts:200` | 按钮 (Button) | `data-action="clear-template-filter"` | 在 editor.ts 中触发 clear-template-filter | 🔥 高风险 |
| `E-0230` | 按钮与图标按钮 | editor | `src/render/editor.ts:204` | 按钮 (Button) | `data-action="ai-draft-history-clear"` | 在 editor.ts 中触发 ai-draft-history-clear | 🔥 高风险 |
| `E-0231` | 输入框与开关 | editor | `src/render/editor.ts:211` | 输入框 (text) | `${t(` | 在 editor.ts 中的数据输入项 ${t( | 常规 |
| `E-0232` | 按钮与图标按钮 | editor | `src/render/editor.ts:212` | 按钮 (Button) | `data-action="ai-draft-clear"` | 在 editor.ts 中触发 ai-draft-clear | 🔥 高风险 |
| `E-0233` | 按钮与图标按钮 | editor | `src/render/editor.ts:214` | 按钮 (Button) | `data-action="ai-draft-infer"` | 在 editor.ts 中触发 ai-draft-infer | 常规 |
| `E-0234` | 按钮与图标按钮 | editor | `src/render/editor.ts:215` | 按钮 (Button) | `data-action="ai-draft-copy-prompt"` | 在 editor.ts 中触发 ai-draft-copy-prompt | 常规 |
| `E-0235` | 按钮与图标按钮 | editor | `src/render/editor.ts:232` | 按钮 (Button) | `data-action="ai-draft-apply"` | 在 editor.ts 中触发 ai-draft-apply | 常规 |
| `E-0236` | 按钮与图标按钮 | editor | `src/render/editor.ts:233` | 按钮 (Button) | `data-action="ai-draft-to-occasion"` | 在 editor.ts 中触发 ai-draft-to-occasion | 常规 |
| `E-0237` | 按钮与图标按钮 | editor | `src/render/editor.ts:234` | 按钮 (Button) | `data-action="ai-draft-discard"` | 在 editor.ts 中触发 ai-draft-discard | 常规 |
| `E-0238` | 输入框与开关 | editor | `src/render/editor.ts:252` | 输入框 (text) | `name` | 在 editor.ts 中的数据输入项 name | 常规 |
| `E-0239` | 输入框与开关 | editor | `src/render/editor.ts:256` | 输入框 (hidden) | `linkagePlan` | 在 editor.ts 中的数据输入项 linkagePlan | 常规 |
| `E-0240` | 输入框与开关 | editor | `src/render/editor.ts:257` | 输入框 (hidden) | `templateAnchor` | 在 editor.ts 中的数据输入项 templateAnchor | 常规 |
| `E-0241` | 输入框与开关 | editor | `src/render/editor.ts:258` | 输入框 (hidden) | `draftSource` | 在 editor.ts 中的数据输入项 draftSource | 常规 |
| `E-0242` | 输入框与开关 | editor | `src/render/editor.ts:267` | 输入框 (search) | `${t(` | 在 editor.ts 中的数据输入项 ${t( | 常规 |
| `E-0243` | 按钮与图标按钮 | editor | `src/render/editor.ts:268` | 图标按钮 (Icon Button) | `data-action="clear-icon-query"` | 在 editor.ts 中触发 clear-icon-query | 🔥 高风险 |
| `E-0244` | 按钮与图标按钮 | editor | `src/render/editor.ts:277` | 图标按钮 (Icon Button) | `data-action="clear-icon-query"` | 在 editor.ts 中触发 clear-icon-query | 🔥 高风险 |
| `E-0245` | 按钮与图标按钮 | editor | `src/render/editor.ts:280` | 图标按钮 (Icon Button) | `data-action="apply-custom-icon"` | 在 editor.ts 中触发 apply-custom-icon | 常规 |
| `E-0246` | 按钮与图标按钮 | editor | `src/render/editor.ts:281` | 图标按钮 (Icon Button) | `data-action="download-custom-icon"` | 在 editor.ts 中触发 download-custom-icon | 常规 |
| `E-0247` | 按钮与图标按钮 | editor | `src/render/editor.ts:281` | 图标按钮 (Icon Button) | `data-action="open-iconfont"` | 在 editor.ts 中触发 open-iconfont | 常规 |
| `E-0248` | 输入框与开关 | editor | `src/render/editor.ts:282` | 输入框 (file) | `input` | 在 editor.ts 中的数据输入项 input | 🔥 高风险 |
| `E-0249` | 输入框与开关 | editor | `src/render/editor.ts:287` | 输入框 (hidden) | `icon` | 在 editor.ts 中的数据输入项 icon | 常规 |
| `E-0250` | 输入框与开关 | editor | `src/render/editor.ts:289` | 输入框 (radio) | `kind` | 在 editor.ts 中的数据输入项 kind | 常规 |
| `E-0251` | 输入框与开关 | editor | `src/render/editor.ts:292` | 输入框 (number) | `target` | 在 editor.ts 中的数据输入项 target | 常规 |
| `E-0252` | 输入框与开关 | editor | `src/render/editor.ts:293` | 输入框 (text) | `unit` | 在 editor.ts 中的数据输入项 unit | 常规 |
| `E-0253` | 输入框与开关 | editor | `src/render/editor.ts:294` | 输入框 (number) | `recordStep` | 在 editor.ts 中的数据输入项 recordStep | 常规 |
| `E-0254` | 输入框与开关 | editor | `src/render/editor.ts:295` | 输入框 (text) | `quickSteps` | 在 editor.ts 中的数据输入项 quickSteps | 常规 |
| `E-0255` | 下拉与分段控件 | editor | `src/render/editor.ts:299` | 下拉选择框 | `select-control` | 在 editor.ts 中切换选择 select-control | 常规 |
| `E-0256` | 输入框与开关 | editor | `src/render/editor.ts:300` | 复选框/开关 | `weekday` | 在 editor.ts 中的数据输入项 weekday | 常规 |
| `E-0257` | 输入框与开关 | editor | `src/render/editor.ts:302` | 输入框 (number) | `intervalDays` | 在 editor.ts 中的数据输入项 intervalDays | 常规 |
| `E-0258` | 按钮与图标按钮 | editor | `src/render/editor.ts:303` | 按钮 (Button) | `data-action="anchor-today"` | 在 editor.ts 中触发 anchor-today | 常规 |
| `E-0259` | 下拉与分段控件 | editor | `src/render/editor.ts:307` | 下拉选择框 | `select-control` | 在 editor.ts 中切换选择 select-control | 常规 |
| `E-0260` | 输入框与开关 | editor | `src/render/editor.ts:308` | 输入框 (number) | `quotaAmount` | 在 editor.ts 中的数据输入项 quotaAmount | 常规 |
| `E-0261` | 下拉与分段控件 | editor | `src/render/editor.ts:310` | 下拉选择框 | `select-control` | 在 editor.ts 中切换选择 select-control | 常规 |
| `E-0262` | 输入框与开关 | editor | `src/render/editor.ts:314` | 复选框/开关 | `directionAtMost` | 在 editor.ts 中的数据输入项 directionAtMost | 常规 |
| `E-0263` | 下拉与分段控件 | editor | `src/render/editor.ts:317` | 下拉选择框 | `editor-hint-journal` | 在 editor.ts 中切换选择 editor-hint-journal | 常规 |
| `E-0264` | 下拉与分段控件 | editor | `src/render/editor.ts:318` | 下拉选择框 | `select-control` | 在 editor.ts 中切换选择 select-control | 常规 |
| `E-0265` | 下拉与分段控件 | editor | `src/render/editor.ts:319` | 下拉选择框 | `select-control` | 在 editor.ts 中切换选择 select-control | 常规 |
| `E-0266` | 按钮与图标按钮 | editor | `src/render/editor.ts:344` | 按钮 (Button) | `data-action="anchor-open-picker"` | 在 editor.ts 中触发 anchor-open-picker | 常规 |
| `E-0267` | 按钮与图标按钮 | editor | `src/render/editor.ts:344` | 按钮 (Button) | `data-action="anchor-clear"` | 在 editor.ts 中触发 anchor-clear | 🔥 高风险 |
| `E-0268` | 按钮与图标按钮 | editor | `src/render/editor.ts:348` | 按钮 (Button) | `data-action="anchor-create"` | 在 editor.ts 中触发 anchor-create | 常规 |
| `E-0269` | 按钮与图标按钮 | editor | `src/render/editor.ts:349` | 按钮 (Button) | `data-action="anchor-create-confirm"` | 在 editor.ts 中触发 anchor-create-confirm | 常规 |
| `E-0270` | 下拉与分段控件 | editor | `src/render/editor.ts:349` | 下拉选择框 | `anchor-create-confirm` | 在 editor.ts 中切换选择 anchor-create-confirm | 常规 |
| `E-0271` | 输入框与开关 | editor | `src/render/editor.ts:355` | 复选框/开关 | `anchorAppendNotes` | 在 editor.ts 中的数据输入项 anchorAppendNotes | 常规 |
| `E-0272` | 输入框与开关 | editor | `src/render/editor.ts:358` | 输入框 (text) | `group` | 在 editor.ts 中的数据输入项 group | 常规 |
| `E-0273` | 下拉与分段控件 | editor | `src/render/editor.ts:359` | 下拉选择框 | `select-control` | 在 editor.ts 中切换选择 select-control | 常规 |
| `E-0274` | 下拉与分段控件 | editor | `src/render/editor.ts:360` | 下拉选择框 | `select-control` | 在 editor.ts 中切换选择 select-control | 常规 |
| `E-0275` | 输入框与开关 | editor | `src/render/editor.ts:361` | 输入框 (number) | `autoArchiveDays` | 在 editor.ts 中的数据输入项 autoArchiveDays | 常规 |
| `E-0276` | 输入框与开关 | editor | `src/render/editor.ts:362` | 输入框 (number) | `streakToleranceDays` | 在 editor.ts 中的数据输入项 streakToleranceDays | 常规 |
| `E-0277` | 输入框与开关 | editor | `src/render/editor.ts:363` | 复选框/开关 | `taskHorizonVisible` | 在 editor.ts 中的数据输入项 taskHorizonVisible | 常规 |
| `E-0278` | 按钮与图标按钮 | editor | `src/render/editor.ts:371` | 按钮 (Button) | `data-action="back"` | 在 editor.ts 中触发 back | 常规 |
| `E-0279` | 按钮与图标按钮 | editor | `src/render/editor.ts:372` | 按钮 (Button) | `data-action="save-template"` | 在 editor.ts 中触发 save-template | 🔥 高风险 |
| `E-0280` | 按钮与图标按钮 | editor | `src/render/editor.ts:373` | 按钮 (Button) | `data-action="archive"` | 在 editor.ts 中触发 archive | 🔥 高风险 |
| `E-0281` | 按钮与图标按钮 | editor | `src/render/editor.ts:373` | 按钮 (Button) | `data-action="delete-item"` | 在 editor.ts 中触发 delete-item | 🔥 高风险 |
| `E-0282` | 按钮与图标按钮 | focus-timer | `src/render/focus-timer.ts:243` | 按钮 (Button) | `data-action="focus-toggle"` | 在 focus-timer.ts 中触发 focus-toggle | 常规 |
| `E-0283` | 按钮与图标按钮 | focus-timer | `src/render/focus-timer.ts:248` | 按钮 (Button) | `data-action="focus-finish"` | 在 focus-timer.ts 中触发 focus-finish | 常规 |
| `E-0284` | 按钮与图标按钮 | focus-timer | `src/render/focus-timer.ts:253` | 按钮 (Button) | `data-action="focus-abandon"` | 在 focus-timer.ts 中触发 focus-abandon | 常规 |
| `E-0285` | 按钮与图标按钮 | focus-timer | `src/render/focus-timer.ts:386` | 按钮 (Button) | `data-action="focus-toggle"` | 在 focus-timer.ts 中触发 focus-toggle | 常规 |
| `E-0286` | 按钮与图标按钮 | focus-timer | `src/render/focus-timer.ts:387` | 按钮 (Button) | `data-action="focus-finish"` | 在 focus-timer.ts 中触发 focus-finish | 常规 |
| `E-0287` | 按钮与图标按钮 | focus-timer | `src/render/focus-timer.ts:388` | 按钮 (Button) | `data-action="focus-abandon"` | 在 focus-timer.ts 中触发 focus-abandon | 常规 |
| `E-0288` | 按钮与图标按钮 | focus-timer | `src/render/focus-timer.ts:397` | 按钮 (Button) | `data-action="focus-toggle"` | 在 focus-timer.ts 中触发 focus-toggle | 常规 |
| `E-0289` | 按钮与图标按钮 | focus-timer | `src/render/focus-timer.ts:411` | 按钮 (Button) | `data-action="focus-finish"` | 在 focus-timer.ts 中触发 focus-finish | 常规 |
| `E-0290` | 按钮与图标按钮 | focus-timer | `src/render/focus-timer.ts:412` | 按钮 (Button) | `data-action="focus-abandon"` | 在 focus-timer.ts 中触发 focus-abandon | 常规 |
| `E-0291` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:113` | 按钮 (Button) | `data-action="toggle-record-details"` | 在 fragments.ts 中触发 toggle-record-details | 常规 |
| `E-0292` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:117` | 按钮 (Button) | `data-action="undo-record"` | 在 fragments.ts 中触发 undo-record | 常规 |
| `E-0293` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:135` | 图标按钮 (Icon Button) | `data-action="${item.status === "` | 在 fragments.ts 中触发 ${item.status ===  | 常规 |
| `E-0294` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:143` | 按钮 (Button) | `data-action="occasions"` | 在 fragments.ts 中触发 occasions | 常规 |
| `E-0295` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:168` | 按钮 (Button) | `data-action="this-day-jump"` | 在 fragments.ts 中触发 this-day-jump | 常规 |
| `E-0296` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:210` | 按钮 (Button) | `data-action="summary"` | 在 fragments.ts 中触发 summary | 常规 |
| `E-0297` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:225` | 按钮 (Button) | `data-action="retry-save"` | 在 fragments.ts 中触发 retry-save | 🔥 高风险 |
| `E-0298` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:269` | 图标按钮 (Icon Button) | `data-action="toggle"` | 在 fragments.ts 中触发 toggle | 常规 |
| `E-0299` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:293` | 按钮 (Button) | `data-action="insights"` | 在 fragments.ts 中触发 insights | 常规 |
| `E-0300` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:294` | 按钮 (Button) | `data-action="journal"` | 在 fragments.ts 中触发 journal | 常规 |
| `E-0301` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:295` | 按钮 (Button) | `data-action="edit"` | 在 fragments.ts 中触发 edit | 常规 |
| `E-0302` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:297` | 按钮 (Button) | `data-action="focus"` | 在 fragments.ts 中触发 focus | 常规 |
| `E-0303` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:300` | 按钮 (Button) | `data-action="journal"` | 在 fragments.ts 中触发 journal | 常规 |
| `E-0304` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:301` | 按钮 (Button) | `data-action="record"` | 在 fragments.ts 中触发 record | 常规 |
| `E-0305` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:302` | 按钮 (Button) | `data-action="quick-record"` | 在 fragments.ts 中触发 quick-record | 常规 |
| `E-0306` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:303` | 按钮 (Button) | `data-action="quick-record"` | 在 fragments.ts 中触发 quick-record | 常规 |
| `E-0307` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:304` | 按钮 (Button) | `data-action="toggle-exact"` | 在 fragments.ts 中触发 toggle-exact | 常规 |
| `E-0308` | 输入框与开关 | fragments | `src/render/fragments.ts:309` | 输入框 (number) | `input` | 在 fragments.ts 中的数据输入项 input | 常规 |
| `E-0309` | 输入框与开关 | fragments | `src/render/fragments.ts:318` | 输入框 (text) | `${t(` | 在 fragments.ts 中的数据输入项 ${t( | 常规 |
| `E-0310` | 输入框与开关 | fragments | `src/render/fragments.ts:321` | 输入框 (radio) | `energy-${escapeHtml(item.id)}` | 在 fragments.ts 中的数据输入项 energy-${escapeHtml(item.id)} | 常规 |
| `E-0311` | 输入框与开关 | fragments | `src/render/fragments.ts:323` | 输入框 (file) | `1` | 在 fragments.ts 中的数据输入项 1 | 🔥 高风险 |
| `E-0312` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:324` | 按钮 (Button) | `data-action="record"` | 在 fragments.ts 中触发 record | 常规 |
| `E-0313` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:508` | 按钮 (Button) | `data-action="summary"` | 在 fragments.ts 中触发 summary | 常规 |
| `E-0314` | 空态与错误态 | fragments | `src/render/fragments.ts:635` | 空态 (Empty State) | `状态呈现` | 在 fragments.ts 中的占位与反馈状态 | 常规 |
| `E-0315` | 空态与错误态 | fragments | `src/render/fragments.ts:636` | 空态 (Empty State) | `状态呈现` | 在 fragments.ts 中的占位与反馈状态 | 常规 |
| `E-0316` | 空态与错误态 | fragments | `src/render/fragments.ts:637` | 空态 (Empty State) | `状态呈现` | 在 fragments.ts 中的占位与反馈状态 | 常规 |
| `E-0317` | 空态与错误态 | fragments | `src/render/fragments.ts:638` | 空态 (Empty State) | `状态呈现` | 在 fragments.ts 中的占位与反馈状态 | 常规 |
| `E-0318` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:639` | 按钮 (Button) | `data-action="archived"` | 在 fragments.ts 中触发 archived | 🔥 高风险 |
| `E-0319` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:639` | 按钮 (Button) | `data-action="add"` | 在 fragments.ts 中触发 add | 常规 |
| `E-0320` | 空态与错误态 | fragments | `src/render/fragments.ts:639` | 空态 (Empty State) | `状态呈现` | 在 fragments.ts 中的占位与反馈状态 | 常规 |
| `E-0321` | 空态与错误态 | fragments | `src/render/fragments.ts:641` | 空态 (Empty State) | `状态呈现` | 在 fragments.ts 中的占位与反馈状态 | 常规 |
| `E-0322` | 空态与错误态 | fragments | `src/render/fragments.ts:642` | 空态 (Empty State) | `状态呈现` | 在 fragments.ts 中的占位与反馈状态 | 常规 |
| `E-0323` | 空态与错误态 | fragments | `src/render/fragments.ts:643` | 空态 (Empty State) | `状态呈现` | 在 fragments.ts 中的占位与反馈状态 | 常规 |
| `E-0324` | 空态与错误态 | fragments | `src/render/fragments.ts:644` | 空态 (Empty State) | `状态呈现` | 在 fragments.ts 中的占位与反馈状态 | 常规 |
| `E-0325` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:659` | 按钮 (Button) | `data-action="add"` | 在 fragments.ts 中触发 add | 常规 |
| `E-0326` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:660` | 按钮 (Button) | `data-action="skip-onboard"` | 在 fragments.ts 中触发 skip-onboard | 常规 |
| `E-0327` | 空态与错误态 | fragments | `src/render/fragments.ts:662` | 空态 (Empty State) | `状态呈现` | 在 fragments.ts 中的占位与反馈状态 | 常规 |
| `E-0328` | 空态与错误态 | fragments | `src/render/fragments.ts:663` | 空态 (Empty State) | `状态呈现` | 在 fragments.ts 中的占位与反馈状态 | 常规 |
| `E-0329` | 空态与错误态 | fragments | `src/render/fragments.ts:664` | 空态 (Empty State) | `状态呈现` | 在 fragments.ts 中的占位与反馈状态 | 常规 |
| `E-0330` | 空态与错误态 | fragments | `src/render/fragments.ts:665` | 空态 (Empty State) | `状态呈现` | 在 fragments.ts 中的占位与反馈状态 | 常规 |
| `E-0331` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:666` | 按钮 (Button) | `data-action="history"` | 在 fragments.ts 中触发 history | 常规 |
| `E-0332` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:666` | 按钮 (Button) | `data-action="add"` | 在 fragments.ts 中触发 add | 常规 |
| `E-0333` | 空态与错误态 | fragments | `src/render/fragments.ts:666` | 空态 (Empty State) | `状态呈现` | 在 fragments.ts 中的占位与反馈状态 | 常规 |
| `E-0334` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:670` | 按钮 (Button) | `data-action="clear-search"` | 在 fragments.ts 中触发 clear-search | 🔥 高风险 |
| `E-0335` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:675` | 按钮 (Button) | `data-action="toggle-completed"` | 在 fragments.ts 中触发 toggle-completed | 常规 |
| `E-0336` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:696` | 按钮 (Button) | `data-action="open-tab"` | 在 fragments.ts 中触发 open-tab | 常规 |
| `E-0337` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:697` | 图标按钮 (Icon Button) | `data-action="add"` | 在 fragments.ts 中触发 add | 常规 |
| `E-0338` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:711` | 按钮 (Button) | `data-action="clear-search"` | 在 fragments.ts 中触发 clear-search | 🔥 高风险 |
| `E-0339` | 下拉与分段控件 | fragments | `src/render/fragments.ts:713` | 下拉选择框 | `select-control` | 在 fragments.ts 中切换选择 select-control | 常规 |
| `E-0340` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:718` | 按钮 (Button) | `data-action="toggle-pending-only"` | 在 fragments.ts 中触发 toggle-pending-only | 常规 |
| `E-0341` | 下拉与分段控件 | fragments | `src/render/fragments.ts:718` | 下拉选择框 | `toggle-pending-only` | 在 fragments.ts 中切换选择 toggle-pending-only | 常规 |
| `E-0342` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:719` | 按钮 (Button) | `data-action="toggle-bulk"` | 在 fragments.ts 中触发 toggle-bulk | 常规 |
| `E-0343` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:723` | 按钮 (Button) | `data-action="bulk-all"` | 在 fragments.ts 中触发 bulk-all | 常规 |
| `E-0344` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:724` | 按钮 (Button) | `data-action="bulk-complete"` | 在 fragments.ts 中触发 bulk-complete | 常规 |
| `E-0345` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:725` | 按钮 (Button) | `data-action="bulk-skip"` | 在 fragments.ts 中触发 bulk-skip | 常规 |
| `E-0346` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:726` | 按钮 (Button) | `data-action="bulk-archive"` | 在 fragments.ts 中触发 bulk-archive | 🔥 高风险 |
| `E-0347` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:727` | 按钮 (Button) | `data-action="bulk-delete"` | 在 fragments.ts 中触发 bulk-delete | 🔥 高风险 |
| `E-0348` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:728` | 按钮 (Button) | `data-action="bulk-exit"` | 在 fragments.ts 中触发 bulk-exit | 常规 |
| `E-0349` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:753` | 按钮 (Button) | `data-action="open-daily-note"` | 在 fragments.ts 中触发 open-daily-note | 常规 |
| `E-0350` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:780` | 按钮 (Button) | `data-action="cancel-quick-entry"` | 在 fragments.ts 中触发 cancel-quick-entry | 常规 |
| `E-0351` | 按钮与图标按钮 | fragments | `src/render/fragments.ts:788` | 按钮 (Button) | `data-action="quick-entry-record"` | 在 fragments.ts 中触发 quick-entry-record | 常规 |
| `E-0352` | 按钮与图标按钮 | journal-dialog | `src/render/journal-dialog.ts:108` | 特化按钮 | `builder-action="${action}"` | 特化按钮动作: builder-action="${action}" | 常规 |
| `E-0353` | 下拉与分段控件 | journal-dialog | `src/render/journal-dialog.ts:115` | 下拉选择框 | `${i}` | 在 journal-dialog.ts 中切换选择 ${i} | 常规 |
| `E-0354` | 输入框与开关 | journal-dialog | `src/render/journal-dialog.ts:115` | 复选框/开关 | `${i}` | 在 journal-dialog.ts 中的数据输入项 ${i} | 常规 |
| `E-0355` | 输入框与开关 | journal-dialog | `src/render/journal-dialog.ts:150` | 输入框 (${q.type === ) | `input` | 在 journal-dialog.ts 中的数据输入项 input | 常规 |
| `E-0356` | 输入框与开关 | journal-dialog | `src/render/journal-dialog.ts:201` | 输入框 (range) | `${index}` | 在 journal-dialog.ts 中的数据输入项 ${index} | 常规 |
| `E-0357` | 输入框与开关 | journal-dialog | `src/render/journal-dialog.ts:203` | 输入框 (text) | `${index}` | 在 journal-dialog.ts 中的数据输入项 ${index} | 常规 |
| `E-0358` | 输入框与开关 | journal-dialog | `src/render/journal-dialog.ts:218` | 输入框 (radio) | `journalTarget` | 在 journal-dialog.ts 中的数据输入项 journalTarget | 常规 |
| `E-0359` | 输入框与开关 | journal-dialog | `src/render/journal-dialog.ts:219` | 输入框 (radio) | `journalTarget` | 在 journal-dialog.ts 中的数据输入项 journalTarget | 常规 |
| `E-0360` | 下拉与分段控件 | journal-dialog | `src/render/journal-dialog.ts:220` | 下拉选择框 | `select-control` | 在 journal-dialog.ts 中切换选择 select-control | 常规 |
| `E-0361` | 输入框与开关 | journal-dialog | `src/render/journal-dialog.ts:221` | 输入框 (text) | `journalDocId` | 在 journal-dialog.ts 中的数据输入项 journalDocId | 常规 |
| `E-0362` | 按钮与图标按钮 | more | `src/render/more.ts:44` | 特化按钮 | `more-action="${action}"` | 特化按钮动作: more-action="${action}" | 常规 |
| `E-0363` | 下拉与分段控件 | occasions | `src/render/occasions.ts:84` | 下拉选择框 | `${key}` | 在 occasions.ts 中切换选择 ${key} | 常规 |
| `E-0364` | 输入框与开关 | occasions | `src/render/occasions.ts:152` | 输入框 (button) | `${escapeHtml(item.id)}` | 在 occasions.ts 中的数据输入项 ${escapeHtml(item.id)} | 常规 |
| `E-0365` | 空态与错误态 | occasions | `src/render/occasions.ts:174` | 空态 (Empty State) | `状态呈现` | 在 occasions.ts 中的占位与反馈状态 | 常规 |
| `E-0366` | 空态与错误态 | occasions | `src/render/occasions.ts:196` | 空态 (Empty State) | `状态呈现` | 在 occasions.ts 中的占位与反馈状态 | 常规 |
| `E-0367` | 空态与错误态 | occasions | `src/render/occasions.ts:197` | 空态 (Empty State) | `状态呈现` | 在 occasions.ts 中的占位与反馈状态 | 常规 |
| `E-0368` | 空态与错误态 | occasions | `src/render/occasions.ts:198` | 空态 (Empty State) | `状态呈现` | 在 occasions.ts 中的占位与反馈状态 | 常规 |
| `E-0369` | 空态与错误态 | occasions | `src/render/occasions.ts:199` | 空态 (Empty State) | `状态呈现` | 在 occasions.ts 中的占位与反馈状态 | 常规 |
| `E-0370` | 空态与错误态 | occasions | `src/render/occasions.ts:200` | 空态 (Empty State) | `状态呈现` | 在 occasions.ts 中的占位与反馈状态 | 常规 |
| `E-0371` | 按钮与图标按钮 | occasions | `src/render/occasions.ts:202` | 按钮 (Button) | `data-action="new-occasion"` | 在 occasions.ts 中触发 new-occasion | 常规 |
| `E-0372` | 按钮与图标按钮 | occasions | `src/render/occasions.ts:248` | 图标按钮 (Icon Button) | `data-action="new-occasion"` | 在 occasions.ts 中触发 new-occasion | 常规 |
| `E-0373` | 输入框与开关 | occasions | `src/render/occasions.ts:260` | 输入框 (text) | `name` | 在 occasions.ts 中的数据输入项 name | 常规 |
| `E-0374` | 下拉与分段控件 | occasions | `src/render/occasions.ts:262` | 下拉选择框 | `select-control` | 在 occasions.ts 中切换选择 select-control | 常规 |
| `E-0375` | 输入框与开关 | occasions | `src/render/occasions.ts:263` | 输入框 (date) | `date` | 在 occasions.ts 中的数据输入项 date | 常规 |
| `E-0376` | 下拉与分段控件 | occasions | `src/render/occasions.ts:266` | 下拉选择框 | `select-control` | 在 occasions.ts 中切换选择 select-control | 常规 |
| `E-0377` | 下拉与分段控件 | occasions | `src/render/occasions.ts:275` | 下拉选择框 | `annual-calendar` | 在 occasions.ts 中切换选择 annual-calendar | 常规 |
| `E-0378` | 下拉与分段控件 | occasions | `src/render/occasions.ts:278` | 下拉选择框 | `select-control` | 在 occasions.ts 中切换选择 select-control | 常规 |
| `E-0379` | 下拉与分段控件 | occasions | `src/render/occasions.ts:279` | 下拉选择框 | `select-control` | 在 occasions.ts 中切换选择 select-control | 常规 |
| `E-0380` | 输入框与开关 | occasions | `src/render/occasions.ts:280` | 输入框 (hidden) | `annualSubtype` | 在 occasions.ts 中的数据输入项 annualSubtype | 常规 |
| `E-0381` | 下拉与分段控件 | occasions | `src/render/occasions.ts:283` | 下拉选择框 | `select-control` | 在 occasions.ts 中切换选择 select-control | 常规 |
| `E-0382` | 下拉与分段控件 | occasions | `src/render/occasions.ts:284` | 下拉选择框 | `monthly-nthweek` | 在 occasions.ts 中切换选择 monthly-nthweek | 常规 |
| `E-0383` | 下拉与分段控件 | occasions | `src/render/occasions.ts:287` | 下拉选择框 | `select-control` | 在 occasions.ts 中切换选择 select-control | 常规 |
| `E-0384` | 下拉与分段控件 | occasions | `src/render/occasions.ts:290` | 下拉选择框 | `select-control` | 在 occasions.ts 中切换选择 select-control | 常规 |
| `E-0385` | 输入框与开关 | occasions | `src/render/occasions.ts:293` | 输入框 (number) | `intervalCount` | 在 occasions.ts 中的数据输入项 intervalCount | 常规 |
| `E-0386` | 下拉与分段控件 | occasions | `src/render/occasions.ts:294` | 下拉选择框 | `select-control` | 在 occasions.ts 中切换选择 select-control | 常规 |
| `E-0387` | 输入框与开关 | occasions | `src/render/occasions.ts:296` | 输入框 (number) | `remindBeforeDays` | 在 occasions.ts 中的数据输入项 remindBeforeDays | 常规 |
| `E-0388` | 按钮与图标按钮 | occasions | `src/render/occasions.ts:299` | 按钮 (Button) | `data-action="cancel-occasion-edit"` | 在 occasions.ts 中触发 cancel-occasion-edit | 常规 |
| `E-0389` | 输入框与开关 | occasions | `src/render/occasions.ts:308` | 输入框 (search) | `${t(` | 在 occasions.ts 中的数据输入项 ${t( | 常规 |
| `E-0390` | 下拉与分段控件 | occasions | `src/render/occasions.ts:310` | 下拉选择框 | `select-control` | 在 occasions.ts 中切换选择 select-control | 常规 |
| `E-0391` | 按钮与图标按钮 | occasions | `src/render/occasions.ts:321` | 按钮 (Button) | `data-action="export-occasion-ics"` | 在 occasions.ts 中触发 export-occasion-ics | 常规 |
| `E-0392` | 按钮与图标按钮 | page-shell | `src/render/page-shell.ts:3` | 按钮 (Button) | `data-action="back"` | 在 page-shell.ts 中触发 back | 常规 |
| `E-0393` | 按钮与图标按钮 | page-shell | `src/render/page-shell.ts:104` | 按钮 (Button) | `data-action="back"` | 在 page-shell.ts 中触发 back | 常规 |
| `E-0394` | 按钮与图标按钮 | review | `src/render/review.ts:168` | 按钮 (Button) | `data-action="review-assistant"` | 在 review.ts 中触发 review-assistant | 常规 |
| `E-0395` | 按钮与图标按钮 | review | `src/render/review.ts:231` | 特化按钮 | `history-batch-action="record"` | 特化按钮动作: history-batch-action="record" | 常规 |
| `E-0396` | 按钮与图标按钮 | review | `src/render/review.ts:231` | 特化按钮 | `history-batch-action="skip"` | 特化按钮动作: history-batch-action="skip" | 常规 |
| `E-0397` | 输入框与开关 | review | `src/render/review.ts:231` | 复选框/开关 | `${escapeHtml(item.id)}` | 在 review.ts 中的数据输入项 ${escapeHtml(item.id)} | 常规 |
| `E-0398` | 输入框与开关 | review | `src/render/review.ts:236` | 输入框 (number) | `${escapeHtml(entry.itemId)}` | 在 review.ts 中的数据输入项 ${escapeHtml(entry.itemId)} | 常规 |
| `E-0399` | 下拉与分段控件 | review | `src/render/review.ts:356` | 下拉选择框 | `select-control` | 在 review.ts 中切换选择 select-control | 常规 |
| `E-0400` | 按钮与图标按钮 | review | `src/render/review.ts:361` | 按钮 (Button) | `data-action="clear-history-query"` | 在 review.ts 中触发 clear-history-query | 🔥 高风险 |
| `E-0401` | 下拉与分段控件 | review | `src/render/review.ts:361` | 下拉选择框 | `clear-history-query` | 在 review.ts 中切换选择 clear-history-query | 常规 |
| `E-0402` | 按钮与图标按钮 | review | `src/render/review.ts:378` | 按钮 (Button) | `data-action="clear-history-filters"` | 在 review.ts 中触发 clear-history-filters | 🔥 高风险 |
| `E-0403` | 空态与错误态 | review | `src/render/review.ts:402` | 空态 (Empty State) | `状态呈现` | 在 review.ts 中的占位与反馈状态 | 常规 |
| `E-0404` | 下拉与分段控件 | review | `src/render/review.ts:404` | 下拉选择框 | `select-control` | 在 review.ts 中切换选择 select-control | 常规 |
| `E-0405` | 下拉与分段控件 | review | `src/render/review.ts:494` | 下拉选择框 | `select-control` | 在 review.ts 中切换选择 select-control | 常规 |
| `E-0406` | 按钮与图标按钮 | review | `src/render/review.ts:534` | 按钮 (Button) | `data-action="change-heatmap-theme"` | 在 review.ts 中触发 change-heatmap-theme | 常规 |
| `E-0407` | 下拉与分段控件 | review | `src/render/review.ts:534` | 下拉选择框 | `change-heatmap-theme` | 在 review.ts 中切换选择 change-heatmap-theme | 常规 |
| `E-0408` | 下拉与分段控件 | review | `src/render/review.ts:583` | 下拉选择框 | `select-control` | 在 review.ts 中切换选择 select-control | 常规 |
| `E-0409` | 按钮与图标按钮 | review | `src/render/review.ts:601` | 特化按钮 | `reminder-action="restore"` | 特化按钮动作: reminder-action="restore" | 常规 |
| `E-0410` | 按钮与图标按钮 | review | `src/render/review.ts:605` | 特化按钮 | `reminder-action="snooze"` | 特化按钮动作: reminder-action="snooze" | 常规 |
| `E-0411` | 按钮与图标按钮 | review | `src/render/review.ts:605` | 特化按钮 | `reminder-action="defer"` | 特化按钮动作: reminder-action="defer" | 常规 |
| `E-0412` | 按钮与图标按钮 | review | `src/render/review.ts:605` | 特化按钮 | `reminder-action="skip"` | 特化按钮动作: reminder-action="skip" | 常规 |
| `E-0413` | 空态与错误态 | review | `src/render/review.ts:618` | 空态 (Empty State) | `状态呈现` | 在 review.ts 中的占位与反馈状态 | 常规 |
| `E-0414` | 下拉与分段控件 | review | `src/render/review.ts:629` | 下拉选择框 | `${reminderTitleId}` | 在 review.ts 中切换选择 ${reminderTitleId} | 常规 |
| `E-0415` | 按钮与图标按钮 | review | `src/render/review.ts:650` | 按钮 (Button) | `data-action="generate-summary"` | 在 review.ts 中触发 generate-summary | 常规 |
| `E-0416` | 下拉与分段控件 | review | `src/render/review.ts:654` | 下拉选择框 | `select-control` | 在 review.ts 中切换选择 select-control | 常规 |
| `E-0417` | 按钮与图标按钮 | review | `src/render/review.ts:655` | 按钮 (Button) | `data-action="copy-open-review-agent"` | 在 review.ts 中触发 copy-open-review-agent | 常规 |
| `E-0418` | 按钮与图标按钮 | review | `src/render/review.ts:655` | 按钮 (Button) | `data-action="copy-review-prompt"` | 在 review.ts 中触发 copy-review-prompt | 常规 |
| `E-0419` | 按钮与图标按钮 | review | `src/render/review.ts:655` | 按钮 (Button) | `data-action="view-analysis-history"` | 在 review.ts 中触发 view-analysis-history | 常规 |
| `E-0420` | 空态与错误态 | review | `src/render/review.ts:659` | 错误态 (Error State) | `状态呈现` | 在 review.ts 中的占位与反馈状态 | 常规 |
| `E-0421` | 按钮与图标按钮 | review | `src/render/review.ts:671` | 按钮 (Button) | `data-action="edit-project-draft"` | 在 review.ts 中触发 edit-project-draft | 常规 |
| `E-0422` | 按钮与图标按钮 | review | `src/render/review.ts:673` | 按钮 (Button) | `data-action="preview-agent-suggestion"` | 在 review.ts 中触发 preview-agent-suggestion | 常规 |
| `E-0423` | 按钮与图标按钮 | review | `src/render/review.ts:673` | 按钮 (Button) | `data-action="preview-agent-schedule-suggestion"` | 在 review.ts 中触发 preview-agent-schedule-suggestion | 常规 |
| `E-0424` | 输入框与开关 | review | `src/render/review.ts:676` | 输入框 (date) | `customStartDate` | 在 review.ts 中的数据输入项 customStartDate | 常规 |
| `E-0425` | 输入框与开关 | review | `src/render/review.ts:679` | 复选框/开关 | `${key}` | 在 review.ts 中的数据输入项 ${key} | 🔥 高风险 |
| `E-0426` | 下拉与分段控件 | review | `src/render/review.ts:682` | 下拉选择框 | `select-control` | 在 review.ts 中切换选择 select-control | 常规 |
| `E-0427` | 下拉与分段控件 | review | `src/render/review.ts:686` | 下拉选择框 | `select-control` | 在 review.ts 中切换选择 select-control | 常规 |
| `E-0428` | 按钮与图标按钮 | review | `src/render/review.ts:688` | 按钮 (Button) | `data-action="save-saved-view"` | 在 review.ts 中触发 save-saved-view | 🔥 高风险 |
| `E-0429` | 按钮与图标按钮 | review | `src/render/review.ts:688` | 按钮 (Button) | `data-action="delete-saved-view"` | 在 review.ts 中触发 delete-saved-view | 🔥 高风险 |
| `E-0430` | 下拉与分段控件 | review | `src/render/review.ts:688` | 下拉选择框 | `save-saved-view` | 在 review.ts 中切换选择 save-saved-view | 常规 |
| `E-0431` | 按钮与图标按钮 | review | `src/render/review.ts:689` | 按钮 (Button) | `data-action="copy-weekly-report"` | 在 review.ts 中触发 copy-weekly-report | 常规 |
| `E-0432` | 按钮与图标按钮 | review | `src/render/review.ts:689` | 按钮 (Button) | `data-action="export-report"` | 在 review.ts 中触发 export-report | 常规 |
| `E-0433` | 按钮与图标按钮 | review | `src/render/review.ts:689` | 按钮 (Button) | `data-action="archived"` | 在 review.ts 中触发 archived | 🔥 高风险 |
| `E-0434` | 按钮与图标按钮 | review | `src/render/review.ts:689` | 按钮 (Button) | `data-action="export-all"` | 在 review.ts 中触发 export-all | 常规 |
| `E-0435` | 按钮与图标按钮 | review | `src/render/review.ts:689` | 按钮 (Button) | `data-action="export-json"` | 在 review.ts 中触发 export-json | 常规 |
| `E-0436` | 按钮与图标按钮 | review | `src/render/review.ts:689` | 按钮 (Button) | `data-action="export-csv"` | 在 review.ts 中触发 export-csv | 常规 |
| `E-0437` | 按钮与图标按钮 | review | `src/render/review.ts:689` | 按钮 (Button) | `data-action="export-share-card"` | 在 review.ts 中触发 export-share-card | 常规 |
| `E-0438` | 输入框与开关 | review | `src/render/review.ts:726` | 复选框/开关 | `${escapeHtml(item.id)}` | 在 review.ts 中的数据输入项 ${escapeHtml(item.id)} | 常规 |
| `E-0439` | 按钮与图标按钮 | review | `src/render/review.ts:727` | 按钮 (Button) | `data-action="clear-item-compare-query"` | 在 review.ts 中触发 clear-item-compare-query | 🔥 高风险 |
| `E-0440` | 按钮与图标按钮 | review | `src/render/review.ts:798` | 按钮 (Button) | `data-action="analysis-filter-group"` | 在 review.ts 中触发 analysis-filter-group | 常规 |
| `E-0441` | 下拉与分段控件 | review | `src/render/review.ts:798` | 下拉选择框 | `analysis-filter-group` | 在 review.ts 中切换选择 analysis-filter-group | 常规 |
| `E-0442` | 按钮与图标按钮 | review | `src/render/review.ts:799` | 按钮 (Button) | `data-action="analysis-filter-item"` | 在 review.ts 中触发 analysis-filter-item | 常规 |
| `E-0443` | 下拉与分段控件 | review | `src/render/review.ts:799` | 下拉选择框 | `analysis-filter-item` | 在 review.ts 中切换选择 analysis-filter-item | 常规 |
| `E-0444` | 按钮与图标按钮 | review | `src/render/review.ts:800` | 按钮 (Button) | `data-action="clear-analysis-filter"` | 在 review.ts 中触发 clear-analysis-filter | 🔥 高风险 |
| `E-0445` | 按钮与图标按钮 | settings | `src/render/settings.ts:214` | 按钮 (Button) | `data-action="use-builtin-focus"` | 在 settings.ts 中触发 use-builtin-focus | 常规 |
| `E-0446` | 按钮与图标按钮 | settings | `src/render/settings.ts:340` | 按钮 (Button) | `data-action="auto-enable-all-integrations"` | 在 settings.ts 中触发 auto-enable-all-integrations | 常规 |
| `E-0447` | 输入框与开关 | settings | `src/render/settings.ts:500` | 输入框 (search) | `${point}` | 在 settings.ts 中的数据输入项 ${point} | 常规 |
| `E-0448` | 按钮与图标按钮 | settings | `src/render/settings.ts:528` | 按钮 (Button) | `data-action="export-focus-issues"` | 在 settings.ts 中触发 export-focus-issues | 常规 |
| `E-0449` | 按钮与图标按钮 | settings | `src/render/settings.ts:528` | 按钮 (Button) | `data-action="clear-focus-issues"` | 在 settings.ts 中触发 clear-focus-issues | 🔥 高风险 |
| `E-0450` | 按钮与图标按钮 | settings | `src/render/settings.ts:563` | 按钮 (Button) | `data-action="restore-snapshot"` | 在 settings.ts 中触发 restore-snapshot | 常规 |
| `E-0451` | 下拉与分段控件 | settings | `src/render/settings.ts:576` | 下拉选择框 | `select-control` | 在 settings.ts 中切换选择 select-control | 常规 |
| `E-0452` | 下拉与分段控件 | settings | `src/render/settings.ts:577` | 下拉选择框 | `select-control` | 在 settings.ts 中切换选择 select-control | 常规 |
| `E-0453` | 输入框与开关 | settings | `src/render/settings.ts:578` | 复选框/开关 | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0454` | 输入框与开关 | settings | `src/render/settings.ts:579` | 复选框/开关 | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0455` | 下拉与分段控件 | settings | `src/render/settings.ts:580` | 下拉选择框 | `select-control` | 在 settings.ts 中切换选择 select-control | 常规 |
| `E-0456` | 下拉与分段控件 | settings | `src/render/settings.ts:581` | 下拉选择框 | `select-control` | 在 settings.ts 中切换选择 select-control | 常规 |
| `E-0457` | 输入框与开关 | settings | `src/render/settings.ts:581` | 输入框 (text) | `${t(` | 在 settings.ts 中的数据输入项 ${t( | 常规 |
| `E-0458` | 下拉与分段控件 | settings | `src/render/settings.ts:584` | 下拉选择框 | `select-control` | 在 settings.ts 中切换选择 select-control | 常规 |
| `E-0459` | 下拉与分段控件 | settings | `src/render/settings.ts:585` | 下拉选择框 | `select-control` | 在 settings.ts 中切换选择 select-control | 常规 |
| `E-0460` | 输入框与开关 | settings | `src/render/settings.ts:586` | 复选框/开关 | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0461` | 输入框与开关 | settings | `src/render/settings.ts:587` | 复选框/开关 | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0462` | 输入框与开关 | settings | `src/render/settings.ts:588` | 复选框/开关 | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0463` | 输入框与开关 | settings | `src/render/settings.ts:590` | 复选框/开关 | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0464` | 输入框与开关 | settings | `src/render/settings.ts:591` | 输入框 (time) | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0465` | 输入框与开关 | settings | `src/render/settings.ts:592` | 复选框/开关 | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0466` | 按钮与图标按钮 | settings | `src/render/settings.ts:593` | 按钮 (Button) | `data-action="save-reminder-slots"` | 在 settings.ts 中触发 save-reminder-slots | 🔥 高风险 |
| `E-0467` | 按钮与图标按钮 | settings | `src/render/settings.ts:594` | 按钮 (Button) | `data-action="apply-reminder-preset"` | 在 settings.ts 中触发 apply-reminder-preset | 🔥 高风险 |
| `E-0468` | 按钮与图标按钮 | settings | `src/render/settings.ts:595` | 按钮 (Button) | `data-action="unmute-daily-reminder"` | 在 settings.ts 中触发 unmute-daily-reminder | 常规 |
| `E-0469` | 输入框与开关 | settings | `src/render/settings.ts:619` | 复选框/开关 | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0470` | 下拉与分段控件 | settings | `src/render/settings.ts:625` | 下拉选择框 | `select-control` | 在 settings.ts 中切换选择 select-control | 常规 |
| `E-0471` | 下拉与分段控件 | settings | `src/render/settings.ts:626` | 下拉选择框 | `select-control` | 在 settings.ts 中切换选择 select-control | 常规 |
| `E-0472` | 输入框与开关 | settings | `src/render/settings.ts:627` | 输入框 (range) | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0473` | 按钮与图标按钮 | settings | `src/render/settings.ts:628` | 按钮 (Button) | `data-action="reset-dialog-frame"` | 在 settings.ts 中触发 reset-dialog-frame | 🔥 高风险 |
| `E-0474` | 输入框与开关 | settings | `src/render/settings.ts:629` | 输入框 (number) | `${settingsViewId}-dialog-size-separator` | 在 settings.ts 中的数据输入项 ${settingsViewId}-dialog-size-separator | 常规 |
| `E-0475` | 按钮与图标按钮 | settings | `src/render/settings.ts:635` | 按钮 (Button) | `data-action="review"` | 在 settings.ts 中触发 review | 常规 |
| `E-0476` | 按钮与图标按钮 | settings | `src/render/settings.ts:638` | 按钮 (Button) | `data-action="export-envelope"` | 在 settings.ts 中触发 export-envelope | 常规 |
| `E-0477` | 按钮与图标按钮 | settings | `src/render/settings.ts:639` | 按钮 (Button) | `data-action="import-json"` | 在 settings.ts 中触发 import-json | 🔥 高风险 |
| `E-0478` | 按钮与图标按钮 | settings | `src/render/settings.ts:640` | 按钮 (Button) | `data-action="import-csv"` | 在 settings.ts 中触发 import-csv | 🔥 高风险 |
| `E-0479` | 按钮与图标按钮 | settings | `src/render/settings.ts:641` | 按钮 (Button) | `data-action="import-loop"` | 在 settings.ts 中触发 import-loop | 🔥 高风险 |
| `E-0480` | 按钮与图标按钮 | settings | `src/render/settings.ts:642` | 按钮 (Button) | `data-action="import-obsidian"` | 在 settings.ts 中触发 import-obsidian | 🔥 高风险 |
| `E-0481` | 按钮与图标按钮 | settings | `src/render/settings.ts:643` | 按钮 (Button) | `data-action="export-loop"` | 在 settings.ts 中触发 export-loop | 常规 |
| `E-0482` | 按钮与图标按钮 | settings | `src/render/settings.ts:644` | 按钮 (Button) | `data-action="export-obsidian"` | 在 settings.ts 中触发 export-obsidian | 常规 |
| `E-0483` | 按钮与图标按钮 | settings | `src/render/settings.ts:646` | 按钮 (Button) | `data-action="restore-backup"` | 在 settings.ts 中触发 restore-backup | 常规 |
| `E-0484` | 按钮与图标按钮 | settings | `src/render/settings.ts:647` | 按钮 (Button) | `data-action="export-snapshots"` | 在 settings.ts 中触发 export-snapshots | 常规 |
| `E-0485` | 按钮与图标按钮 | settings | `src/render/settings.ts:647` | 按钮 (Button) | `data-action="clear-snapshots"` | 在 settings.ts 中触发 clear-snapshots | 🔥 高风险 |
| `E-0486` | 按钮与图标按钮 | settings | `src/render/settings.ts:648` | 按钮 (Button) | `data-action="import-snapshots"` | 在 settings.ts 中触发 import-snapshots | 🔥 高风险 |
| `E-0487` | 按钮与图标按钮 | settings | `src/render/settings.ts:652` | 按钮 (Button) | `data-action="open-recovery-guide"` | 在 settings.ts 中触发 open-recovery-guide | 常规 |
| `E-0488` | 按钮与图标按钮 | settings | `src/render/settings.ts:652` | 按钮 (Button) | `data-action="export-diagnostics"` | 在 settings.ts 中触发 export-diagnostics | 常规 |
| `E-0489` | 按钮与图标按钮 | settings | `src/render/settings.ts:653` | 按钮 (Button) | `data-action="export-audit"` | 在 settings.ts 中触发 export-audit | 常规 |
| `E-0490` | 按钮与图标按钮 | settings | `src/render/settings.ts:653` | 按钮 (Button) | `data-action="clear-audit"` | 在 settings.ts 中触发 clear-audit | 🔥 高风险 |
| `E-0491` | 按钮与图标按钮 | settings | `src/render/settings.ts:656` | 按钮 (Button) | `data-action="reset-all-preferences"` | 在 settings.ts 中触发 reset-all-preferences | 🔥 高风险 |
| `E-0492` | 按钮与图标按钮 | settings | `src/render/settings.ts:657` | 按钮 (Button) | `data-action="reset-view-preferences"` | 在 settings.ts 中触发 reset-view-preferences | 🔥 高风险 |
| `E-0493` | 下拉与分段控件 | settings | `src/render/settings.ts:669` | 下拉选择框 | `select-control` | 在 settings.ts 中切换选择 select-control | 常规 |
| `E-0494` | 按钮与图标按钮 | settings | `src/render/settings.ts:670` | 按钮 (Button) | `data-action="export-diagnostics"` | 在 settings.ts 中触发 export-diagnostics | 常规 |
| `E-0495` | 按钮与图标按钮 | settings | `src/render/settings.ts:677` | 按钮 (Button) | `data-action="export-agent-audit"` | 在 settings.ts 中触发 export-agent-audit | 常规 |
| `E-0496` | 按钮与图标按钮 | settings | `src/render/settings.ts:686` | 按钮 (Button) | `data-action="check-note-bindings"` | 在 settings.ts 中触发 check-note-bindings | 常规 |
| `E-0497` | 按钮与图标按钮 | settings | `src/render/settings.ts:700` | 按钮 (Button) | `data-action="save-diary-doc"` | 在 settings.ts 中触发 save-diary-doc | 🔥 高风险 |
| `E-0498` | 按钮与图标按钮 | settings | `src/render/settings.ts:700` | 按钮 (Button) | `data-action="toggle-create-diary-doc"` | 在 settings.ts 中触发 toggle-create-diary-doc | 常规 |
| `E-0499` | 按钮与图标按钮 | settings | `src/render/settings.ts:701` | 按钮 (Button) | `data-action="create-diary-doc"` | 在 settings.ts 中触发 create-diary-doc | 常规 |
| `E-0500` | 下拉与分段控件 | settings | `src/render/settings.ts:701` | 下拉选择框 | `create-diary-doc` | 在 settings.ts 中切换选择 create-diary-doc | 常规 |
| `E-0501` | 按钮与图标按钮 | settings | `src/render/settings.ts:705` | 按钮 (Button) | `data-action="write-diary-report"` | 在 settings.ts 中触发 write-diary-report | 常规 |
| `E-0502` | 下拉与分段控件 | settings | `src/render/settings.ts:714` | 下拉选择框 | `select-control` | 在 settings.ts 中切换选择 select-control | 常规 |
| `E-0503` | 按钮与图标按钮 | settings | `src/render/settings.ts:717` | 按钮 (Button) | `data-action="save-journal-target"` | 在 settings.ts 中触发 save-journal-target | 🔥 高风险 |
| `E-0504` | 下拉与分段控件 | settings | `src/render/settings.ts:717` | 下拉选择框 | `save-journal-target` | 在 settings.ts 中切换选择 save-journal-target | 常规 |
| `E-0505` | 按钮与图标按钮 | settings | `src/render/settings.ts:723` | 按钮 (Button) | `data-action="save-journal-custom"` | 在 settings.ts 中触发 save-journal-custom | 🔥 高风险 |
| `E-0506` | 输入框与开关 | settings | `src/render/settings.ts:724` | 复选框/开关 | `lifelog-journal` | 在 settings.ts 中的数据输入项 lifelog-journal | 常规 |
| `E-0507` | 输入框与开关 | settings | `src/render/settings.ts:725` | 复选框/开关 | `lifelog-journal-skip` | 在 settings.ts 中的数据输入项 lifelog-journal-skip | 常规 |
| `E-0508` | 输入框与开关 | settings | `src/render/settings.ts:726` | 输入框 (text) | `lifelog-journal-header` | 在 settings.ts 中的数据输入项 lifelog-journal-header | 常规 |
| `E-0509` | 按钮与图标按钮 | settings | `src/render/settings.ts:727` | 按钮 (Button) | `data-action="sync-today-lifelog"` | 在 settings.ts 中触发 sync-today-lifelog | 常规 |
| `E-0510` | 按钮与图标按钮 | settings | `src/render/settings.ts:741` | 按钮 (Button) | `data-action="save-summary-doc"` | 在 settings.ts 中触发 save-summary-doc | 🔥 高风险 |
| `E-0511` | 输入框与开关 | settings | `src/render/settings.ts:744` | 复选框/开关 | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0512` | 按钮与图标按钮 | settings | `src/render/settings.ts:745` | 按钮 (Button) | `data-action="write-summary-now"` | 在 settings.ts 中触发 write-summary-now | 常规 |
| `E-0513` | 按钮与图标按钮 | settings | `src/render/settings.ts:764` | 按钮 (Button) | `data-action="reveal-binding"` | 在 settings.ts 中触发 reveal-binding | 常规 |
| `E-0514` | 按钮与图标按钮 | settings | `src/render/settings.ts:765` | 按钮 (Button) | `data-action="quick-create-sireader"` | 在 settings.ts 中触发 quick-create-sireader | 常规 |
| `E-0515` | 下拉与分段控件 | settings | `src/render/settings.ts:765` | 下拉选择框 | `sireader` | 在 settings.ts 中切换选择 sireader | 常规 |
| `E-0516` | 输入框与开关 | settings | `src/render/settings.ts:766` | 复选框/开关 | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0517` | 按钮与图标按钮 | settings | `src/render/settings.ts:771` | 按钮 (Button) | `data-action="probe-siplayer"` | 在 settings.ts 中触发 probe-siplayer | 常规 |
| `E-0518` | 按钮与图标按钮 | settings | `src/render/settings.ts:774` | 按钮 (Button) | `data-action="reveal-binding"` | 在 settings.ts 中触发 reveal-binding | 常规 |
| `E-0519` | 按钮与图标按钮 | settings | `src/render/settings.ts:775` | 按钮 (Button) | `data-action="quick-create-siplayer"` | 在 settings.ts 中触发 quick-create-siplayer | 常规 |
| `E-0520` | 下拉与分段控件 | settings | `src/render/settings.ts:775` | 下拉选择框 | `siplayer` | 在 settings.ts 中切换选择 siplayer | 常规 |
| `E-0521` | 输入框与开关 | settings | `src/render/settings.ts:776` | 复选框/开关 | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0522` | 按钮与图标按钮 | settings | `src/render/settings.ts:784` | 按钮 (Button) | `data-action="quick-create-weread"` | 在 settings.ts 中触发 quick-create-weread | 常规 |
| `E-0523` | 下拉与分段控件 | settings | `src/render/settings.ts:784` | 下拉选择框 | `quick-create-weread` | 在 settings.ts 中切换选择 quick-create-weread | 常规 |
| `E-0524` | 下拉与分段控件 | settings | `src/render/settings.ts:787` | 下拉选择框 | `weread-finish` | 在 settings.ts 中切换选择 weread-finish | 常规 |
| `E-0525` | 下拉与分段控件 | settings | `src/render/settings.ts:788` | 下拉选择框 | `weread-notes` | 在 settings.ts 中切换选择 weread-notes | 常规 |
| `E-0526` | 按钮与图标按钮 | settings | `src/render/settings.ts:789` | 按钮 (Button) | `data-action="clear-weread-key"` | 在 settings.ts 中触发 clear-weread-key | 🔥 高风险 |
| `E-0527` | 按钮与图标按钮 | settings | `src/render/settings.ts:790` | 按钮 (Button) | `data-action="save-weread"` | 在 settings.ts 中触发 save-weread | 🔥 高风险 |
| `E-0528` | 输入框与开关 | settings | `src/render/settings.ts:793` | 复选框/开关 | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0529` | 按钮与图标按钮 | settings | `src/render/settings.ts:794` | 按钮 (Button) | `data-action="weread-pull"` | 在 settings.ts 中触发 weread-pull | 常规 |
| `E-0530` | 按钮与图标按钮 | settings | `src/render/settings.ts:809` | 按钮 (Button) | `data-action="save-health-doc"` | 在 settings.ts 中触发 save-health-doc | 🔥 高风险 |
| `E-0531` | 按钮与图标按钮 | settings | `src/render/settings.ts:811` | 按钮 (Button) | `data-action="reveal-binding"` | 在 settings.ts 中触发 reveal-binding | 常规 |
| `E-0532` | 按钮与图标按钮 | settings | `src/render/settings.ts:813` | 按钮 (Button) | `data-action="add-health-binding"` | 在 settings.ts 中触发 add-health-binding | 常规 |
| `E-0533` | 按钮与图标按钮 | settings | `src/render/settings.ts:813` | 按钮 (Button) | `data-action="quick-create-health"` | 在 settings.ts 中触发 quick-create-health | 常规 |
| `E-0534` | 下拉与分段控件 | settings | `src/render/settings.ts:814` | 下拉选择框 | `select-control` | 在 settings.ts 中切换选择 select-control | 常规 |
| `E-0535` | 下拉与分段控件 | settings | `src/render/settings.ts:816` | 下拉选择框 | `select-control` | 在 settings.ts 中切换选择 select-control | 常规 |
| `E-0536` | 按钮与图标按钮 | settings | `src/render/settings.ts:817` | 按钮 (Button) | `data-action="preview-source"` | 在 settings.ts 中触发 preview-source | 常规 |
| `E-0537` | 按钮与图标按钮 | settings | `src/render/settings.ts:817` | 按钮 (Button) | `data-action="refresh-source"` | 在 settings.ts 中触发 refresh-source | 常规 |
| `E-0538` | 下拉与分段控件 | settings | `src/render/settings.ts:828` | 下拉选择框 | `select-control` | 在 settings.ts 中切换选择 select-control | 常规 |
| `E-0539` | 下拉与分段控件 | settings | `src/render/settings.ts:829` | 下拉选择框 | `select-control` | 在 settings.ts 中切换选择 select-control | 常规 |
| `E-0540` | 输入框与开关 | settings | `src/render/settings.ts:829` | 输入框 (text) | `20260101120000-xxxxxxxx` | 在 settings.ts 中的数据输入项 20260101120000-xxxxxxxx | 常规 |
| `E-0541` | 按钮与图标按钮 | settings | `src/render/settings.ts:830` | 按钮 (Button) | `data-action="quick-create-notequery"` | 在 settings.ts 中触发 quick-create-notequery | 常规 |
| `E-0542` | 下拉与分段控件 | settings | `src/render/settings.ts:830` | 下拉选择框 | `quick-create-notequery` | 在 settings.ts 中切换选择 quick-create-notequery | 常规 |
| `E-0543` | 输入框与开关 | settings | `src/render/settings.ts:831` | 输入框 (text) | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0544` | 输入框与开关 | settings | `src/render/settings.ts:832` | 输入框 (text) | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0545` | 按钮与图标按钮 | settings | `src/render/settings.ts:833` | 按钮 (Button) | `data-action="save-note-query"` | 在 settings.ts 中触发 save-note-query | 🔥 高风险 |
| `E-0546` | 按钮与图标按钮 | settings | `src/render/settings.ts:833` | 按钮 (Button) | `data-action="preview-source"` | 在 settings.ts 中触发 preview-source | 常规 |
| `E-0547` | 按钮与图标按钮 | settings | `src/render/settings.ts:833` | 按钮 (Button) | `data-action="refresh-source"` | 在 settings.ts 中触发 refresh-source | 常规 |
| `E-0548` | 输入框与开关 | settings | `src/render/settings.ts:848` | 输入框 (search) | `yeguif-nb` | 在 settings.ts 中的数据输入项 yeguif-nb | 常规 |
| `E-0549` | 按钮与图标按钮 | settings | `src/render/settings.ts:850` | 按钮 (Button) | `data-action="preview-source"` | 在 settings.ts 中触发 preview-source | 常规 |
| `E-0550` | 按钮与图标按钮 | settings | `src/render/settings.ts:850` | 按钮 (Button) | `data-action="refresh-source"` | 在 settings.ts 中触发 refresh-source | 常规 |
| `E-0551` | 输入框与开关 | settings | `src/render/settings.ts:866` | 输入框 (search) | `input` | 在 settings.ts 中的数据输入项 input | 常规 |
| `E-0552` | 输入框与开关 | settings | `src/render/settings.ts:1004` | 输入框 (radio) | `conflict-${escapeHtml(decision.name)}` | 在 settings.ts 中的数据输入项 conflict-${escapeHtml(decision.name)} | 常规 |
| `E-0553` | 按钮与图标按钮 | settings | `src/render/settings.ts:1011` | 按钮 (Button) | `data-action="clear-settings-search"` | 在 settings.ts 中触发 clear-settings-search | 🔥 高风险 |
| `E-0554` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:47` | 按钮 (Button) | `data-action="focus"` | 在 today-bindings.ts 中触发 focus | 常规 |
| `E-0555` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:47` | 按钮 (Button) | `data-action="record"` | 在 today-bindings.ts 中触发 record | 常规 |
| `E-0556` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:47` | 按钮 (Button) | `data-action="quick-record"` | 在 today-bindings.ts 中触发 quick-record | 常规 |
| `E-0557` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:109` | 按钮 (Button) | `data-action="record"` | 在 today-bindings.ts 中触发 record | 常规 |
| `E-0558` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:109` | 按钮 (Button) | `data-action="quick-record"` | 在 today-bindings.ts 中触发 quick-record | 常规 |
| `E-0559` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:109` | 按钮 (Button) | `data-action="toggle"` | 在 today-bindings.ts 中触发 toggle | 常规 |
| `E-0560` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:120` | 按钮 (Button) | `data-action="record"` | 在 today-bindings.ts 中触发 record | 常规 |
| `E-0561` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:120` | 按钮 (Button) | `data-action="quick-record"` | 在 today-bindings.ts 中触发 quick-record | 常规 |
| `E-0562` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:120` | 按钮 (Button) | `data-action="toggle"` | 在 today-bindings.ts 中触发 toggle | 常规 |
| `E-0563` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:161` | 按钮 (Button) | `data-action="toggle-bulk"` | 在 today-bindings.ts 中触发 toggle-bulk | 常规 |
| `E-0564` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:166` | 按钮 (Button) | `data-action="bulk-exit"` | 在 today-bindings.ts 中触发 bulk-exit | 常规 |
| `E-0565` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:191` | 按钮 (Button) | `data-action="bulk-all"` | 在 today-bindings.ts 中触发 bulk-all | 常规 |
| `E-0566` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:203` | 按钮 (Button) | `data-action="bulk-complete"` | 在 today-bindings.ts 中触发 bulk-complete | 常规 |
| `E-0567` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:215` | 按钮 (Button) | `data-action="bulk-skip"` | 在 today-bindings.ts 中触发 bulk-skip | 常规 |
| `E-0568` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:227` | 按钮 (Button) | `data-action="bulk-archive"` | 在 today-bindings.ts 中触发 bulk-archive | 🔥 高风险 |
| `E-0569` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:239` | 按钮 (Button) | `data-action="bulk-delete"` | 在 today-bindings.ts 中触发 bulk-delete | 🔥 高风险 |
| `E-0570` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:292` | 特化按钮 | `menu-action="toggle-exact"` | 特化按钮动作: menu-action="toggle-exact" | 常规 |
| `E-0571` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:293` | 特化按钮 | `menu-action="move-up"` | 特化按钮动作: menu-action="move-up" | 常规 |
| `E-0572` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:294` | 特化按钮 | `menu-action="move-down"` | 特化按钮动作: menu-action="move-down" | 常规 |
| `E-0573` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:295` | 特化按钮 | `menu-action="edit"` | 特化按钮动作: menu-action="edit" | 常规 |
| `E-0574` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:296` | 特化按钮 | `menu-action="insights"` | 特化按钮动作: menu-action="insights" | 常规 |
| `E-0575` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:298` | 特化按钮 | `menu-action="unskip"` | 特化按钮动作: menu-action="unskip" | 常规 |
| `E-0576` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:299` | 特化按钮 | `menu-action="skip"` | 特化按钮动作: menu-action="skip" | 常规 |
| `E-0577` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:300` | 特化按钮 | `menu-action="skip-quick"` | 特化按钮动作: menu-action="skip-quick" | 常规 |
| `E-0578` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:301` | 特化按钮 | `menu-action="skip-quick"` | 特化按钮动作: menu-action="skip-quick" | 常规 |
| `E-0579` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:302` | 特化按钮 | `menu-action="skip-quick"` | 特化按钮动作: menu-action="skip-quick" | 常规 |
| `E-0580` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:303` | 特化按钮 | `menu-action="archive"` | 特化按钮动作: menu-action="archive" | 常规 |
| `E-0581` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:304` | 特化按钮 | `menu-action="delete"` | 特化按钮动作: menu-action="delete" | 🔥 高风险 |
| `E-0582` | 按钮与图标按钮 | today-bindings | `src/render/today-bindings.ts:368` | 按钮 (Button) | `data-action="toggle-exact"` | 在 today-bindings.ts 中触发 toggle-exact | 常规 |
| `E-0583` | 下拉与分段控件 | yeguif-mappings | `src/render/yeguif-mappings.ts:83` | 下拉选择框 | `${index}` | 在 yeguif-mappings.ts 中切换选择 ${index} | 常规 |
| `E-0584` | 输入框与开关 | yeguif-mappings | `src/render/yeguif-mappings.ts:83` | 输入框 (text) | `${index}` | 在 yeguif-mappings.ts 中的数据输入项 ${index} | 常规 |
