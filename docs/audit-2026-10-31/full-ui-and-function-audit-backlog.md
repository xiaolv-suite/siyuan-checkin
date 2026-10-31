# 小驴打卡全界面 UI 审查（UI/UX Pro Max）与全入口功能链路排查报告及待办池

- **排查日期**：2026-10-31
- **排查基线**：`v18.45.0`（本轮严格遵循「只排查不开发」，`src/` 与 `tests/` 零代码修改）
- **排查范围**：
  1. **UI 审查**：基于 `ui-ux-pro-max` 10 大优先级维度 + 5 项专项补充维度（统一令牌与硬编码色值/间距、跨面板同类控件一致性、可交互元素 9 态完备性、320px 窄窗口与 125%/150% 系统缩放防截断、首屏关键操作免滚动可达），覆盖全部 8 个一级/二级页面、7 类弹窗/浮层、5 类抽屉/折叠面板及正文嵌入渲染块。
  2. **功能实现验证**：全量盘点一级、二级、三级共 **118 个交互入口**（按钮、下拉菜单、命令面板命令、快捷键、设置项、拖拽手柄、右键/长按菜单），逐项验证三态分类与五环完整链路（`输入 → 处理 → 持久化 → 重载仍在 → 异常可恢复`），清查占位/死分支/单形态分支/静默吞异常等半成品。
- **统计汇总**：
  - **UI 审查发现待办**：**10 条**（`UI-01` ~ `UI-10`）
  - **功能实现发现项**：**11 条**（其中 **8 条可开发待办 `FN-01` ~ `FN-08`**，**3 条判定为受平台/上游限制无法实现 `PL-01` ~ `PL-03`**）
  - **合并去重后有效待办池总计**：**18 条可开发待办** + **3 条平台限制登记项**

---

## 第一部分：界面全部入口三级全景盘点与功能三态/五环链路验证表

### 1.1 全局宿主、命令面板、快捷键与嵌入块入口（14 项）

| 层级与入口名称 | 位置（文件:行号） | 三态判定 | 五环链路（输入→处理→持久化→重载→异常恢复）核验结论 |
| :--- | :--- | :---: | :--- |
| 顶栏图标 `iconLvCheckin` | `src/index.ts:2768` | 已实现且可用 | 按 `defaultOpenMode` 打开快速弹窗或独立页签，五环完整 |
| 侧边栏 Dock 面板 | `src/index.ts:2740` | 已实现且可用 | 独立 Root 会话隔离，跨重载保持偏好，五环完整 |
| 自定义页签 `siyuan-checkincheckin` | `src/index.ts:2752` | 已实现且可用 | 独立 Root 上下文恢复，五环完整 |
| 命令：打开小驴打卡 (`Alt+Shift+C`) | `src/index.ts:2782` | 已实现且可用 | 快捷键与命令面板双通道触发，五环完整 |
| 命令：在新页签打开小驴打卡 | `src/index.ts:2790` | 已实现且可用 | 桌面端打开独立页签，移动端自动回退弹窗，五环完整 |
| 命令：插入打卡块（今日汇总/月度/热力图/分组）×4 | `src/index.ts:2800-2835` | 已实现且可用 | 向当前 Protyle 编辑器插入对应预设代码块，未打开文档时 Toast 提示，五环完整 |
| 雷切（Speed-Switch）快捷动作注册 | `src/render/quick-dialog.ts:310` | 已实现且可用 | 宿主安装雷切时自动注册快捷动作，卸载时清理，五环完整 |
| 正文声明式代码块 ```` ```checkin ```` | `src/render/block-renderer.ts:1` | 已实现且可用 | 支持 `today/month/heatmap/summary/groups` 视图与就地打卡，异常超时可重试，五环完整 |
| 今日键盘流 `J / K / Enter / Alt+1~9 / Esc` | `src/render/today-bindings.ts:580` | 已实现且可用 | 含 IME `isComposing || keyCode===229` 拦截，五环完整 |
| 今日卡片手动重排 `Alt+↑ / Alt+↓` | `src/render/today-bindings.ts:558` | **五环断在异常恢复** | 持久化失败时仅回滚内存未复位已移动的 DOM 节点，见待办 **`FN-02`** |
| 系统后台离线定时推送通知（宿主关闭后） | `src/render/reminder-delivery.ts` | **受平台限制无法实现** | 受思源 Electron/WebView 进程生命周期限制，详见 **`PL-01`** |

### 1.2 今日行动台（Today）一级/二级/三级入口（24 项）

| 层级与入口名称 | 位置（文件:行号） | 三态判定 | 五环链路核验结论 |
| :--- | :--- | :---: | :--- |
| 1级：顶栏/底栏 5 槽导航（今天/回顾/事项/记录/更多） | `src/index.ts:7730, 7786` | 已实现且可用 | 切换页面并保持 per-root 状态，五环完整 |
| 1级：快速弹窗全屏切换 / 关闭按钮 | `src/index.ts:7791-7796` | 已实现且可用 | 脏表单关闭前确认，五环完整 |
| 1级：每日提醒内联/浮动横幅（查看全部/今日静音/关闭） | `src/render/reminder-delivery.ts:120` | 已实现且可用 | 静音状态落盘 `reminders.json`，跨日自动恢复，五环完整（但多横幅叠加挤压首屏，见 **`UI-10`**） |
| 1级：概览三卡（今日进度/连续打卡/专注「开始专注」） | `src/render/fragments.ts:675-710` | 已实现且可用 | 实时投影，点击「开始专注」启动专注面板，五环完整 |
| 1级：NextHero 英雄卡（主打卡/开始专注/定位卡片） | `src/render/fragments.ts:595-640` | 已实现且可用 | 单飞防重锁 + 落盘 + 撤销回执，五环完整 |
| 1级：优先提醒横幅（定位打卡/完成事项/展开+N/查看全部） | `src/render/fragments.ts:197-235` | 已实现且可用 | 折叠状态跨重绘保持，五环完整 |
| 1级：今日搜索框 + 清空 + 自然语言快录条（提交/取消） | `src/render/bind-today.ts:240-340` | 已实现且可用 | 支持 IME 保护、未来日期拦截、取消记忆，五环完整（搜索框高度 34px 与其他页不一致，见 **`UI-06`**） |
| 2级：筛选与排序折叠面板（4种分组/5种排序/仅看待办） | `src/render/bind-today.ts:620-690` | 已实现且可用 | 写入 `view-preferences.json`，失败自动回滚，五环完整 |
| 2级：批量模式（全选/批量完成/跳过/归档/删除/退出） | `src/render/today-bindings.ts:180-251` | 已实现且可用 | 整批单次事务持久化，失败回滚并提示，五环完整 |
| 1级：卡片图标点击切换 / 名称点击进洞察 / 主按钮打卡 | `src/render/bind-today.ts:490-550` | 已实现且可用 | 含 `runExclusiveAction` 防连点，五环完整 |
| 2级：卡片快捷增量 Chips (`+amount`) | `src/render/bind-today.ts:528` | 已实现且可用 | 逐 Chip 独立读取 `data-amount` 记账，五环完整 |
| 2级：卡片「⋯」展开精确录入抽屉（数值/加减/快捷备注Chips/备注/照片附件/提交/跳过/编辑/洞察/打开绑定文档） | `src/render/bind-today.ts:350-485` | 已实现且可用 | 写入失败保留输入草稿与展开态，五环完整 |
| 2级：卡片拖拽手柄重排（`[data-drag-handle]`） | `src/render/today-bindings.ts:485-551` | **五环断在异常恢复** | 落盘失败未重绘还原 DOM 顺序，成功未刷新 NextHero/多表面，见 **`FN-02`** |
| 2级：卡片右键 / 触屏长按上下文菜单（精确记录/上移/下移/编辑/洞察/跳过+3快捷原因/归档/删除） | `src/render/today-bindings.ts:275-482` | **部分缺陷** | 上移/下移同受 **`FN-02`** 影响，且 `click` 监听存在重复 `closeMenus` 调用 |
| 2级：完成回执 Toast（查看此记录 / 撤销） | `src/render/bind-today.ts:720-755` | 已实现且可用 | 撤销物理移除事件并写墓碑，五环完整 |
| 2级：底部折叠区（今日事项横幅/今日LifeLog/未来7天负荷/往年今日） | `src/render/fragments.ts:725-780` | 已实现且可用 | 按需展开，零冗余写入，五环完整 |
| 2级/3级：内置专注计时器面板（15/25/45/60预设、暂停/继续、完成并记录、放弃、失败重试、迷你条） | `src/render/focus-timer.ts:371-436` | **UI对比度缺陷 + 半成品** | 深色模式下选中预设按钮对比度仅 **1.25:1**（见 **`UI-01`**），且预设切换含 `if (false as boolean)` 死代码、未接入闲置暂停模型（见 **`FN-06`**） |
| 2级/3级：问卷日记打卡弹窗（必答校验/答案预览/目标配置/提交） | `src/render/journal-dialog.ts:224` | 已实现且可用 | 事实先行入账 + 文档旁路写入，失败保留草稿可重试，五环完整 |

### 1.3 新建与编辑页（Editor）一级/二级/三级入口（22 项）

| 层级与入口名称 | 位置（文件:行号） | 三态判定 | 五环链路核验结论 |
| :--- | :--- | :---: | :--- |
| 1级：返回按钮 / 底部保存打卡项 / 保存并继续 / 取消 / 归档 / 删除 | `src/render/bind-editor.ts:1350-1435` | 已实现且可用 | 含未保存脏表单离开确认、同名冲突拦截、规则变更影响确认，五环完整 |
| 2级：自然语言起草折叠区（输入/清空/智能推断/示例Chips/采纳/转事项/取消） | `src/render/bind-editor.ts:1480-1770` | **半成品分支遗漏** | ① 多模态第 2 习惯候选（如背单词按时长）未渲染上屏（见 **`FN-04`**）；② 编辑已有项目时整个起草区被隐藏，导致已实现的 `evaluateExistingItemAiAdjustment` 与模板变体定制无法使用（见 **`FN-05`**） |
| 3级：自然语言起草「复制提示词」按钮 (`ai-draft-copy-prompt`) | `src/render/bind-editor.ts:1686-1699` | **五环断在异常恢复** | `navigator.clipboard?.writeText` 失败或不可用时 `.catch(() => undefined)` 静默吞错，无任何提示或文本框降级（见 **`FN-03`**） |
| 3级：最近草案历史（填入 / 单条删除 / 清空历史） | `src/render/bind-editor.ts:1712-1738` | 已实现且可用 | 落盘 `ai-draft-history.json`，跨窗口墓碑防复活，五环完整 |
| 2级：常用模板库折叠（搜索/10分类/79模板/显示全部） | `src/render/bind-editor.ts:950-1015` | 已实现且可用 | 点击即套用字段并更新预览，五环完整 |
| 3级：场景组合包预览（勾选子项/应用所选/整包创建） | `src/render/bind-editor.ts:1016-1075` | 已实现且可用 | 同名自动跳过、原子持久化，五环完整 |
| 3级：个人模板（存为我的模板/套用/删除/勾选脱敏分享导出/导入冲突决策） | `src/render/bind-editor.ts:1095-1247` | 已实现且可用 | 落盘 `checkin-user-templates`，失败回滚内存并提示，五环完整 |
| 2级/3级：图标选择器弹层（搜索/11分组/尺寸预览条/自定义文字图标/图片上传/删除自定义） | `src/render/bind-editor.ts:750-940` | 已实现且可用 | 240KB 大小守门 + XSS 过滤 + `checkin-custom-icon-library` 持久化，五环完整 |
| 1级/2级：核心规则字段（名称+联想建议、类型三选一、目标/单位/步长/快捷步长、排期五选一+7天预览、戒除开关、完成来源/问卷绑定） | `src/render/bind-editor.ts:470-740` | 已实现且可用 | 条件显隐与右侧实时预览卡同步，五环完整（但缺少失焦即时校验与必填星号，见 **`UI-07`**） |
| 2级/3级：高级设置折叠（分组/优先级/时段/容错天数/自动归档/笔记锚点选择器+新建锚点文档/Task Horizon可见性/历史修订时间线） | `src/render/bind-editor.ts:1248-1348` | 已实现且可用 | 块 ID 格式校验与防重绑定完备，五环完整 |

### 1.4 回顾（Review）、洞察（Insights）、事项（Occasions）、归档（Archived）、更多（More）、设置（Settings）入口（58 项）

| 所属面板与入口群 | 位置（文件:行号） | 三态判定 | 五环链路与半成品核验结论 |
| :--- | :--- | :---: | :--- |
| **回顾·顶栏**：日/周/月/自定义范围、复制周报、导出 Markdown、报告设置（6章节开关/来源过滤/命名视图保存与删除/导出天数）、更多工具（归档/导出Envelope/JSON/CSV/年度分享图PNG） | `src/render/review.ts:670-690`, `bind-page-navigation.ts:180-370` | 已实现且可用 | 命名视图与报告选项持久化至 `view-preferences.json`，五环完整 |
| **回顾·概览**：汇总指标、节奏图与月历、矩阵批量补卡、分母明细折叠、周复盘向导（保存/导出/复制AI提示词/清空）、项目列表、周期对比 | `src/render/review.ts:150-414, 635-701` | 已实现且可用 | 周复盘草稿按周键落盘、矩阵补卡原子事务，五环完整 |
| **回顾·报告与智能体助手**：生成总结、复制并打开智能体、复制提示词、**查看历史对比弹窗**、**预览建议弹窗**、采纳/取消/撤销建议工作流、检查智能体项目草案 | `src/render/review.ts:640-670`, `bind-page-navigation.ts:1475-1600` | **弹窗 UI 缺陷** | 「查看历史对比弹窗」与「预览建议弹窗」未挂 `.lc-checkin-dialog` / `data-appearance`，按钮仅 23px 高且深色模式失效，见 **`UI-02`** |
| **回顾·记录**：搜索、渠道/计量/项目/范围/排序筛选、清除筛选、批量补记/记跳过、单条详情展开、编辑备注、跳源文档、删除记录、分页 | `src/render/review.ts:240-385`, `bind-page-navigation.ts:580-780` | **标题跳级** | 功能五环完整；但页面从 `<h1>` 直接跳到日期分组 `<h3>`，缺 `<h2>`，见 **`UI-04`** |
| **回顾·分析**：分组/项目聚焦筛选、趋势图+数据表、项目横向比较、年度/定量/周热力图、精力分布、跳过阻力、习惯强度+韧性条+薄弱日、分组均衡、成就、提醒中心（稍后/顺延/跳过/恢复 + **逾期历史补记撤销Toast**）、即将到来事项、LifeLog时间轴 | `src/render/review.ts:415-885`, `bind-page-navigation.ts:380-410` | **3项问题** | ① 逾期补记撤销 Toast 点击后若存储失败 `.catch(() => undefined)` 静默无提示（见 **`FN-03`**）；② 单项目聚焦定量热力图缺可展开数据表（见 **`UI-08`**）；③ 标题从 `<h1>` 跳至 `<h3>`/`<h4>`（见 **`UI-04`**） |
| **洞察（Insights）**：28/84/365/自定义范围、项目选择器+搜索、统计卡、饱和度卡、EMA韧性条、薄弱星期提示、查看记录/编辑规则/导出CSV/归档查看、84天状态格（方向键漫游+点击钻取）、每周趋势、66天成熟度条、教练建议+证据样本+一键采纳 | `src/index.ts:7628-7755`, `bind-page-navigation.ts:410-570` | 已实现且可用 | 全部入口五环验证通过 |
| **事项（Occasions）**：导出 ICS、新建事项、表单抽屉（帮助/7类21模板/名称/类型/日期/7种重复/公历农历/提前提醒/备注/发生日预览/保存/取消）、列表筛选（5统计胶囊/搜索/状态类型时间排序下拉/清除）、行内操作（完成/补标/单次改期/转打卡项/编辑关联打卡/编辑/启停/删除） | `src/render/occasions.ts`, `src/render/bind-occasions.ts` | **控件高度与校验差异** | 功能五环完整；但排序下拉框高度 36px 与同栏 44px 筛选框不一致（见 **`UI-06`**），且表单缺顶部错误摘要与失焦校验（见 **`UI-07`**） |
| **归档（Archived）**：搜索、全选、批量恢复、批量彻底删除、单行历史规则详情折叠、恢复、查看洞察、删除 | `src/render/archived.ts`, `bind-page-navigation.ts:1180-1310` | 已实现且可用 | 删除带确认与级联清理，恢复即时重算排期，五环完整 |
| **更多（More）**：7 个目标入口卡（搜索今日项目/新建打卡项/外观设置/数据恢复/外部来源/归档管理/关于诊断） | `src/render/more.ts:12-50` | **跳转定位与返回栈缺陷** | 点击设置分类卡仅同步调用 `.click()` 未滚动定位目标分组卡片，且从设置/归档点返回无法回到「更多」页，见 **`FN-07`** |
| **设置（Settings）**：健康总览 4 卡、问题定位、变更清单（单条/分节撤回）、搜索设置、6 分组导航、外观/提醒/专注/文档输出（日记报告/问卷构建器/摘要常驻/叶归**立即同步今日打卡到日记**）/外部来源（思阅/思播/微信读书/健康/笔记查询/叶归映射编辑器/待处理箱）/数据恢复（主档JSON/多桶Envelope/CSV/Loop/Obsidian/快照历史/审计/诊断预览弹窗/重置偏好）、**头像裁剪弹窗** | `src/render/settings.ts`, `src/index.ts:5800-7620, 10154` | **命中 1 项严重功能缺陷 + 2 项 UI 缺陷** | ① **「立即同步今日打卡到日记」在 `appendBlock` 失败时仍累加 `synced` 并弹假成功提示，且查重 SQL 限 500 行未分页**（见 **`FN-01`**）；② 头像裁剪 `<dialog>` 缺 `data-appearance` 与修改后关闭确认（见 **`UI-03`**）；③ 诊断预览弹窗跳用 `<h4>`（见 **`UI-04`**） |
| **跨窗口思阅/思播会话去重** & **Task Horizon 消费端图层/回写** | `src/features/sireader-adapter.ts`, `src/features/taskhorizon-cooperation.ts` | **受平台/上游限制** | 分别受上游未暴露稳定会话 ID 与对方仓库未合入消费端代码限制，详见 **`PL-02`**、**`PL-03`** |

---

## 第二部分：可直接进入开发的合格待办池（共 18 条，四要素齐全）

> **评分说明**：
> - **影响面**：`1`（极小/单控件边缘）~ `5`（核心数据正确性/全表面通用）
> - **频率**：`1`（极低频）~ `5`（每次打开/高频必经）
> - **成本**：`1`（小：单文件局部修改 ≤30 行）、`2`（中：跨 2~3 个文件联动修改 + 单测更新）、`3`（大：跨多模块状态/UI/存储协同重构）
> - **优先级分** = `(影响面 × 频率) ÷ 成本`

---

### 一、 缺陷类（Defects — 共 5 条）

#### 1. `FN-01` [缺陷] 「立即同步今日打卡到日记」写入失败仍提示成功且超过 500 块文档重复追加
- **关联项**：设置页 → 思源文档输出 → 问卷与 LifeLog 日记 →「立即同步今日打卡到日记」(`[data-action="sync-today-lifelog"]`) 及自动追加通道 `appendLifelogToJournal`
- **问题描述（可复现）**：
  - **位置**：`src/index.ts:10154-10242` (`syncTodayCheckinsToLifelogJournal`) 及 `src/index.ts:10085-10151` (`appendLifelogToJournal`)
  - **复现步骤**：
    1. 在设置页开启「打卡同步追加至日记 LifeLog」并绑定目标日记文档；
    2. 在今日面板完成 2 项打卡后，将思源切为只读模式或模拟 `/api/block/appendBlock` 返回 `{code: -1, msg: "failed"}`（或抛出网络/内核异常），点击设置页 `[data-action="sync-today-lifelog"]`；
    3. 另在目标日记文档已有超过 500 个块（`blocks` 表 `root_id` 下 `>500` 行）时，连续点击两次「立即同步今日打卡到日记」。
  - **当前表现**：① `appendBlock` 未加 `.catch` 且未检查返回值 `createdBlockId` 是否存在，即使内核拒绝写入，第 10238 行仍无条件执行 `synced += 1` 并在第 10240 行弹出 `[小驴打卡] 已同步 N/N 条今日记录到日记` 假成功提示；② 第 10193 行查重 SQL 写死 `LIMIT 500` 未走有界分页，第 501 块之后的已有打卡行无法被识别，导致重复点击时向日记无限重复追加相同打卡段落。
  - **期望表现**：① 仅当 `appendBlock` 成功返回有效 `createdBlockId` 时才计入 `synced += 1`；若发生异常或 `createdBlockId` 为空，统计失败条数并在结束时通过 `showMessage(..., 6000, "error")` 明确告知用户失败原因与成功/失败计数；② 查重查询复用 `scanBoundedPages`（或按 `custom-lv-checkin-date` 属性/块内容分页扫描），杜绝长文档重复追加。
- **解决方案**：在 `src/index.ts:10192-10241` 将单页 `LIMIT 500` 替换为基于块 ID 游标的 `scanBoundedPages` 分页去重查询；在循环内对 `appendBlock` 包裹 `try/catch` 并校验 `createdBlockId`，区分 `synced` 与 `failed` 计数，失败时写入诊断日志并给出可见错误提示。
- **成本**：**小（1）**——逻辑集中在 `src/index.ts` 单个方法约 40 行内，已有 `scanBoundedPages` 工具可直调。
- **优先级计算**：影响面 `5`（直接造成用户思源日记正文重复脏数据或假成功误导）× 频率 `3`（日记联动用户每日触发）÷ 成本 `1` = **`15.0`**
- **风险**：需同步检查 `tests/lifelog-append.test.cjs` 与 `tests/lifelog-integration-enhanced.test.cjs` 中的 SQL 桩返回值格式，确保分页游标兼容现有测试桩。

---

#### 2. `UI-01` [缺陷] 深色模式下专注计时器选中预设按钮文字与背景对比度仅 1.25:1（严重不可读）
- **关联项**：`ui-ux-pro-max` §1 `color-contrast` / §6 `color-dark-mode` / 专注计时器面板 (`[data-focus-timer]`)
- **问题描述（可复现）**：
  - **位置**：`src/ui/components.scss:5303` 与 `src/ui/polish.scss:620-623`
  - **复现步骤**：
    1. 将插件外观切换为「深色（Dark）」；
    2. 在今日面板点击任意时长类打卡项（如「阅读」）右侧的「⏱ 专注」按钮打开专注计时器面板 `[data-focus-timer]`；
    3. 观察当前选中的预设时长按钮（如 `25`，带有 `class="is-selected" aria-pressed="true"`）。
  - **当前表现**：`components.scss:5303` 为 `.lc-checkin__focus-presets button.is-selected` 设置了暖金背景 `background: var(--lc-checkin-gold)`（深色下为 `rgb(245, 194, 66)` `#F5C242`）与深灰字 `color: #27272E`；但后加载的 `polish.scss:620` 对 `:is([aria-selected="true"], [aria-pressed="true"]:not(.switch))` 强制覆写了 `color: var(--lc-checkin-accent-text)`（深色下为浅紫 `rgb(165, 174, 248)` `#A5AEF8`）。浅紫字印在亮黄底上实测对比度仅为 **1.25 : 1**（远低于 WCAG AA 4.5:1 下限），数字几乎无法辨认。
  - **期望表现**：深色与浅色模式下，专注计时器选中的预设时长按钮均保持 ≥ 7:1 的清晰对比度（使用统一令牌 `var(--lc-checkin-accent-fill)` 配 `var(--lc-checkin-accent-contrast)`，或显式锁定高反差深色文本 `#161722`）。
- **解决方案**：在 `src/ui/polish.scss` 中排除 `.lc-checkin__focus-presets button` 被通用 `[aria-pressed="true"]` 纯文字改色覆盖，或将 `.lc-checkin__focus-presets button.is-selected` 统一改为 `background: var(--lc-checkin-accent-fill); color: var(--lc-checkin-accent-contrast);`。
- **成本**：**小（1）**——仅涉及 `src/ui/polish.scss` 与 `src/ui/components.scss` 2 处规则收敛。
- **优先级计算**：影响面 `4`（深色模式专注核心控件文字不可读）× 频率 `3`（每次使用专注计时必现）÷ 成本 `1` = **`12.0`**
- **风险**：修改后需在 `tests/accessibility-audit.test.cjs` 中增加打开 `[data-focus-timer]` 后的明暗对比度扫描，防止回归。

---

#### 3. `FN-02` [缺陷] 今日面板手动排序（拖拽/右键上移下移/Alt+方向键）落盘失败未复位 DOM 且成功未同步 NextHero 与多表面
- **关联项**：`ui-ux-pro-max` §1 `dragging-alternative` / 五环链路第 3~5 环
- **问题描述（可复现）**：
  - **位置**：`src/render/today-bindings.ts:373-396, 536-543, 566-571` 与 `src/index.ts:10320-10340` (`reorderItems`)
  - **复现步骤**：
    1. 在今日面板将排序切换为「手动排序」；
    2. 使用鼠标拖拽卡片、或右键菜单点击「上移/下移」、或按 `Alt + ArrowUp/ArrowDown` 移动首张卡片；
    3. 场景 A（正常落盘）：观察页面顶部 NextHero 英雄卡以及同时打开的另一表面（如独立页签 + Dock）；
    4. 场景 B（异常恢复）：模拟 `saveData` 抛出写入失败异常，观察弹出失败 Toast 后卡片在列表中的位置。
  - **当前表现**：① 场景 A 下，`reorderItems` 仅写盘返回 `true`，未调用 `this.renderBackgroundUpdate()` 或广播变更，导致当前页顶部的 NextHero 英雄卡仍停留在旧的首位项目，且同开的其他表面顺序不刷新；② 场景 B 下，`reorderItems` 虽回滚了 `this.store = previous`，但未触发 `this.render()`，之前通过 `container.insertBefore` 乐观移动的 DOM 节点仍停留在错误的新位置，造成界面顺序与实际存储脱节；③ `today-bindings.ts:473` 还存在一行冗余的重复 `closeMenus(true)` 调用。
  - **期望表现**：重排持久化成功后自动同步刷新 NextHero 与所有打开表面（并保持当前卡片键盘焦点）；持久化失败回滚后立即重绘还原 DOM 卡片至原顺序。
- **解决方案**：在 `src/index.ts:10320` `reorderItems` 成功落盘后调用 `this.renderBackgroundUpdate()`，在 `catch` 回滚 `this.store = previous` 后调用 `this.render()` 还原 DOM；清理 `today-bindings.ts:473` 的重复关闭调用。
- **成本**：**小（1）**——修改 `src/index.ts` 与 `src/render/today-bindings.ts` 约 10 行代码。
- **优先级计算**：影响面 `3`（手动排序一致性与异常恢复）× 频率 `3`（列表整理常用操作）÷ 成本 `1` = **`9.0`**
- **风险**：重绘恢复时需通过 `pendingFocusItemId` 或焦点恢复机制保留当前操作卡片的焦点，避免 `Alt+↑/↓` 连续按键焦点丢失（需跑 `tests/a11y-keyboard-focus.test.cjs` 验证）。

---

#### 4. `FN-03` [缺陷] 新建页「复制提示词」与回顾页「逾期补记撤销/切换」异常被静默吞掉无任何用户反馈
- **关联项**：`ui-ux-pro-max` §8 `error-feedback` / `error-recovery`
- **问题描述（可复现）**：
  - **位置**：`src/render/bind-editor.ts:1686-1699` (`[data-action='ai-draft-copy-prompt']`) 与 `src/render/bind-page-navigation.ts:393, 406, 1490, 1500`
  - **复现步骤**：
    1. 在非 HTTPS 局域网浏览器（`browser-desktop` / `browser-mobile`，此时 `navigator.clipboard` 为 `undefined`）或拒绝剪贴板权限的 WebView 中，进入「新建打卡项 → 智能起草」，点击「复制提示词」；
    2. 在「回顾 → 分析 → 提醒与事项 → 逾期历史」点击「补记」弹出底部 `lc-checkin__catchup-toast`，再点击 Toast 上的「撤销」按钮（此时模拟底层存储报错）。
  - **当前表现**：① `bind-editor.ts:1694` 使用 `void navigator.clipboard?.writeText(prompt).then(...).catch(() => undefined)`，当 `navigator.clipboard` 不存在或被拒绝时，点击按钮完全没有任何反应（无错误提示、无备选复制文本框）；② `bind-page-navigation.ts:393, 406, 1490, 1500` 对逾期补记、补记撤销及建议确认/撤销均使用 `.catch(() => undefined)` 吞掉异常，失败时用户误以为操作已生效。
  - **期望表现**：① 剪贴板写入失败或不可用时，提示用户并将生成好的 Prompt 填入可聚焦选中的只读文本框（与回顾页 `review.ts:601` 提示词预览一致）供手动复制；② 逾期补记/撤销及建议操作异常时，通过 `showMessage(t("msg.saveFailedShort"))` 给出明确错误反馈。
- **解决方案**：在 `bind-editor.ts:1694` 增加 `if (!navigator.clipboard?.writeText)` 分支与 `.catch` 降级提示（在 `aiDraftStatus` 展示提示或展开只读预览框）；在 `bind-page-navigation.ts:393, 406, 1490, 1500` 的 `.catch` 中补齐 `if (isCurrentSurface()) showMessage(t("msg.saveFailedShort"))`。
- **成本**：**小（1）**——2 个渲染绑定文件内局部补齐错误回退，约 25 行。
- **优先级计算**：影响面 `3`（离线/局域网提示词复制与补记撤销可靠性）× 频率 `3` ÷ 成本 `1` = **`9.0`**
- **风险**：需保持现有成功路径的 `editor.aiDraftPromptCopied` 状态文案不变，以兼容 `tests/ai-draft-interaction.test.cjs`。

---

#### 5. `UI-02` [缺陷] 回顾页「历史分析对比弹窗」与「智能体建议预览弹窗」缺失独立主题宿主类且按钮仅 23px 高
- **关联项**：`ui-ux-pro-max` §1 `color-dark-mode` / §2 `web-target-size` (≥24px AA / 36px 标准) / §4 `consistency`
- **问题描述（可复现）**：
  - **位置**：`src/render/bind-page-navigation.ts:1514-1565` (`[data-action='view-analysis-history']` 与 `[data-action='preview-agent-suggestion']`)
  - **复现步骤**：
    1. 将插件设置为「深色主题（Dark）」或非默认调色板（如「森林」）；
    2. 进入「回顾 → 概览 → 展开完整报告」，点击「查看历史对比」或「预览调整建议」打开弹窗；
    3. 检查弹窗背景、文字颜色以及弹窗内「交换 / 对比 / 稍后 / 应用」按钮尺寸。
  - **当前表现**：两处 `new Dialog(...)` 均未给 `.b3-dialog__container` 添加 `lc-checkin-dialog` 类，未包裹 `.lc-checkin-dialog-host`，也未挂载 `data-appearance` 与 `data-palette` 属性；内部按钮直接使用思源宿主 `.b3-button` 而非插件 `.lc-checkin__text-button` / `.lc-checkin__primary-button`，实测按钮高度仅 **23px**（低于 WCAG 2.2 AA 24px 底线，且远低于插件 36px/44px 标准），在移动端也未设置 `92vw` 自适应宽度。
  - **期望表现**：像问卷弹窗（`journal-dialog.ts:224`）和诊断预览弹窗（`index.ts:7154`）一样，统一挂载 `lc-checkin-dialog`、`lc-checkin-dialog-host`、`data-appearance` 与 `data-palette`，按钮统一使用 `.lc-checkin__text-button` / `.lc-checkin__primary-button`（高度 ≥36px 桌面 / ≥44px 移动），窄屏宽度自适应 `92vw`。
- **解决方案**：在 `src/render/bind-page-navigation.ts:1514, 1550` 为两个 `Dialog` 注入宿主主题容器包装与 `.lc-checkin-dialog` 类，将 `.b3-button` 替换为插件标准按钮类，并綁定 `evaluateModalKeydown` Esc 关闭保护。
- **成本**：**小（1）**——集中在 `src/render/bind-page-navigation.ts` 40 行以内。
- **优先级计算**：影响面 `3`（深色主题弹窗破相 + 按钮尺寸违规）× 频率 `2` ÷ 成本 `1` = **`6.0`**
- **风险**：需核对 `tests/analysis-history.test.cjs` 与 `tests/agent-suggestions.test.cjs` 是否对 `.b3-button` 类名做静态断言，若有则保留兼容类名或同步更新断言。

---

### 二、 功能类（Features & Half-Baked Closure — 共 4 条）

#### 6. `FN-04` [功能·半成品] 新建页自然语言起草丢弃了多模态习惯的第 2 个备选草案（只对单一候选分支生效）
- **关联项**：`src/features/natural-language-draft.ts:1229-1245` (`secondaryCandidate`) 与 `src/render/bind-editor.ts:1634-1665`
- **问题描述（可复现）**：
  - **位置**：`src/render/bind-editor.ts:1634-1665` 及 `src/render/editor.ts:223-237`
  - **复现步骤**：
    1. 进入「新建打卡项」，展开「✨ 智能起草 / 描述建项」；
    2. 输入 `每天背单词 30 个` 或 `每天看书`，点击「智能推断」。
  - **当前表现**：底层 `generateAiIntentEnvelope`（`natural-language-draft.ts:1230`）专门为阅读/背单词等多模态习惯生成了两个 `checkin_item` 候选：主候选 `按计次记录：背单词 30个` 与备选候选 `secondaryCandidate` `按时长记录：背单词 30分钟`；但 `bind-editor.ts:1636` 只检查了 `secondaryCandidate?.type === "occasion"`，当 `secondaryCandidate.type === "checkin_item"` 时被完全忽略，界面只显示第 1 个候选，用户无法切换选择第 2 个计时模式候选。
  - **期望表现**：当 `generateAiIntentEnvelope` 返回两个 `checkin_item` 候选时，预览卡片中展示备选切换按钮（如「切换为时长模式：30 分钟」或候选切换胶囊），允许用户一键采纳主候选或备选候选。
- **解决方案**：在 `src/render/editor.ts` 的 `[data-ai-draft-preview]` 中增加备选习惯采纳按钮 `[data-action="ai-draft-apply-secondary"]`（默认 `hidden`），在 `src/render/bind-editor.ts` 中当 `envelope.secondaryCandidate?.type === "checkin_item"` 时展示该按钮并绑定 `applyDraftToForm(secondaryHabitDraft)`。
- **成本**：**小（1）**——底层纯函数已完整产出数据，仅需 `editor.ts` 与 `bind-editor.ts` 补 1 个按钮接线。
- **优先级计算**：影响面 `3`（多模态建项核心卖点半成品）× 频率 `3`（新建项目高频场景）÷ 成本 `1` = **`9.0`**
- **风险**：无数据模型变更，需在 `tests/ai-draft-interaction.test.cjs` 补充双习惯候选切换断言。

---

#### 7. `FN-05` [功能·半成品] 已有项目自然语言微调（`evaluateExistingItemAiAdjustment`）与模板变体定制（`generateTemplateVariantDraft`）未接入编辑器 UI
- **关联项**：`T-1696` / `T-1697` / `BP-007`
- **问题描述（可复现）**：
  - **位置**：`src/features/natural-language-draft.ts:740-1120`、`src/render/editor.ts:203`、`src/render/bind-editor.ts:1625`
  - **复现步骤**：
    1. 在今日或洞察页点击任意已有习惯的「编辑规则」进入编辑页，查找自然语言微调入口（如输入“目标改为每天 45 分钟，仅工作日”）；
    2. 在新建打卡项起草框输入“参考喝水模板改成每天 3000 毫升”，点击「智能推断」，检查表单中的 `templateAnchor` 隐藏字段。
  - **当前表现**：① `src/render/editor.ts:203` 写死 `const aiDraft = !item ? ... : "";`，在编辑已有项目时直接隐藏了整个自然语言面板，导致 `natural-language-draft.ts` 中已写好并单测通过的 200 余行 `evaluateExistingItemAiAdjustment`（含 Before/After 字段差异比对与 `effectiveDate` 历史分母保护）在 UI 上完全无法触达；② 新建态 `bind-editor.ts` 未调用 `findBestMatchingTemplate` / `generateTemplateVariantDraft`，无法继承基准模板的 `templateAnchor`、专业分组与科学说明。
  - **期望表现**：① 编辑已有项目时同样展示自然语言微调折叠面板，输入微调指令后调用 `evaluateExistingItemAiAdjustment` 展示字段变更前→变更后差异预览，用户点击确认采纳后填入表单并保留历史修订保护；② 新建态当输入命中模板变体语义或内置模板名时，优先调用 `generateTemplateVariantDraft` 保留 `templateAnchor` 身份溯源。
- **解决方案**：放开 `editor.ts:203` 的 `!item` 限制，在编辑态下将面板标题切换为「自然语言微调规则」，在 `bind-editor.ts` 中按 `Boolean(editingItem)` 分流调用 `evaluateExistingItemAiAdjustment`（渲染差异摘要）或 `generateTemplateVariantDraft`（回填 `input[name="templateAnchor"]`）。
- **成本**：**中（2）**——涉及 `editor.ts`、`bind-editor.ts` 与双语词条扩展，需处理编辑态与新建态两套预览文案。
- **优先级计算**：影响面 `4`（打通两大悬空半成品功能模块）× 频率 `3` ÷ 成本 `2` = **`6.0`**
- **风险**：编辑态采纳微调草案只允许修改当前 DOM 表单控件，必须由用户最终点击底部「保存修改」走既有 `saveEditorForm` 修订时间线通道，严禁绕过表单直写 `store`。

---

#### 8. `FN-06` [功能·半成品] 专注计时闲置自动暂停与净时长双口径模型（`focus-idle-governance.ts`）未接入专注面板且残留死代码分支
- **关联项**：`T-1538` / `src/features/focus-idle-governance.ts` / `src/render/focus-timer.ts:418`
- **问题描述（可复现）**：
  - **位置**：`src/features/focus-idle-governance.ts:1-120` 与 `src/render/focus-timer.ts:76-90, 418-421`
  - **复现步骤**：
    1. 检查 `src/features/focus-idle-governance.ts` 的引用关系：全仓仅 `tests/focus-idle-governance.test.cjs` 导入，运行态 0 引用；
    2. 检查 `src/render/focus-timer.ts:418`：存在 `if (false as boolean) { const currentElapsed = ... }` 永远不会执行的死代码分支。
  - **当前表现**：`focus-idle-governance.ts` 已完整实现闲置超时检测（`evaluateFocusIdleStep`）、番茄承诺制与毛时长/净有效时长双口径格式化（`formatDualDurationDisplay`），但 `focus-timer.ts` 仅检测了页面隐藏（`document.hidden`）和系统时钟跳变，未接入 `focus-idle-governance.ts`，且第 418 行留有为应付静态正则守门而写的 `if (false as boolean)` 假分支。
  - **期望表现**：移除 `if (false as boolean)` 死分支，将预设切换确认与 `focus-idle-governance.ts` 的净时长/暂停统计正式整合进 `focus-timer.ts`（或在确认不需要鼠标键盘闲置扣时前，先将 `formatDualDurationDisplay` 接入专注结算说明并清理死分支）。
- **解决方案**：（**部分待确认**：是否默认开启无操作 5 分钟自动暂停，需先验证用户在看纸质书专注时屏幕无交互是否会被误判闲置；建议默认 `idlePauseEnabled: false` 仅在设置开启或仅接入 `formatDualDurationDisplay` 展示“总耗时 / 净专注时长”，同时真实启用或清理 `focus-timer.ts:418` 的死分支并对齐对应守门测试）。
- **成本**：**中（2）**——涉及 `focus-timer.ts`、设置开关或结算显示及 `focus-timer-accuracy.test.cjs` 守门对齐。
- **优先级计算**：影响面 `3` × 频率 `2` ÷ 成本 `2` = **`3.0`**
- **风险**：专注计时器受 `tests/focus-timer-accuracy.test.cjs` 与 `tests/focus-lifecycle.test.cjs` 严格保护，默认行为必须保持 `idlePauseEnabled: false` 才不会误停离线阅读用户的计时。

---

#### 9. `FN-07` [体验] 「更多（More）」面板跳转设置子分组未滚动定位且从二级页返回丢失「更多」上下文
- **关联项**：`ui-ux-pro-max` §9 `back-behavior` / `back-stack-integrity` / `deep-linking`
- **问题描述（可复现）**：
  - **位置**：`src/render/more.ts:28-49` 与 `src/navigation.ts:90-125`
  - **复现步骤**：
    1. 点击导航栏「更多（More）」进入更多面板；
    2. 点击「数据与恢复（导入、导出、备份与恢复点）」或「关于（版本信息、诊断与故障排查）」；
    3. 观察进入设置页后的滚动位置；随后点击设置页左上角「← 返回」按钮。
  - **当前表现**：① `more.ts:46-47` 调用 `host.showSettings(root)` 后立即执行 `root.querySelector('[data-settings-nav="about"]')?.click()`，在窄屏/移动端或首次渲染中，左侧分类按钮虽然变为 `is-active`，但页面滚动条停留在顶部健康总览卡，未将 `#...-group-about` 卡片滚入视口；② 从「更多」页进入设置页或归档页后，顶栏/底栏「更多」高亮状态满足，但部分无 root 入口下返回栈未恢复 `more` 焦点位置。
  - **期望表现**：从「更多」页点击任意具体设置分组（外观/数据/外部来源/关于）进入设置页后，自动将该目标分组卡片平滑或即时滚入视口顶部并聚焦其标题；点击返回时准确回到「更多」面板并恢复原按钮焦点。
- **解决方案**：在 `src/render/more.ts:44-48` 触发 `[data-settings-nav="${group}"]` 点击后，同步查找对应 `[data-settings-group="${group}"]` 卡片调用 `scrollIntoView({block: "start", behavior: "instant"})` 并聚焦其 `<h2>`；在 `navigation.ts` 核对 `more` 返回栈焦点恢复。
- **成本**：**小（1）**——修改 `src/render/more.ts` 约 10 行代码。
- **优先级计算**：影响面 `3`（一级导航「更多」面板 4 个核心入口的落地准确性）× 频率 `3` ÷ 成本 `1` = **`9.0`**
- **风险**：需兼容 `reducedMotion` 偏好，使用 `behavior: "instant"` 防止与设置页滚动监听（`IntersectionObserver`）产生竞争。

---

### 三、 界面与体验类（UI & UX — 共 8 条，与上方 UI-01/UI-02 合计 10 条 UI 待办）

#### 10. `UI-03` [体验] 头像裁剪 `<dialog>` 缺失 `data-appearance` 主题属性、标题跳级且修改后关闭无确认保护
- **关联项**：`ui-ux-pro-max` §1 `heading-hierarchy` / §6 `color-dark-mode` / §8 `sheet-dismiss-confirm`
- **问题描述（可复现）**：
  - **位置**：`src/render/avatar-editor.ts:23-62`
  - **复现步骤**：
    1. 在设置页「个人头像」上传一张图片打开头像裁剪弹窗 `<dialog class="lc-checkin lc-checkin__avatar-editor">`；
    2. 在深色模式下检查弹窗的 `data-appearance` 属性与标题标签层级；
    3. 拖动裁剪框并将缩放滑块拉到 `250%`，随后误触 `Esc` 键或点击「取消」。
  - **当前表现**：① `avatar-editor.ts:24` 创建 `<dialog>` 时未复制 `themeRoot` 的 `data-appearance` 与 `data-palette` 属性，导致依赖 `[data-appearance="dark"]` 选择器的深色样式无法命中该 `<dialog>`；② 弹窗内直接使用 `<h2>` 作为唯一标题（缺少 `<h1>` 或未关联 `aria-labelledby` 到该标题 `id`）；③ 用户已调整缩放或拖拽位移（`state.zoom !== 1 || state.centerX !== 0.5 || state.centerY !== 0.5`）后按 `Esc` 或点取消，直接丢弃修改关闭弹窗，无未保存确认提示。
  - **期望表现**：① `<dialog>` 同步设置 `data-appearance` 与 `data-palette`，并通过 `aria-labelledby` 关联弹窗主标题；② 当裁剪状态已发生变更（dirty）时，按 `Esc` 或点击取消弹出确认提示，防止误触丢失裁剪位置。
- **解决方案**：在 `src/render/avatar-editor.ts:24-39` 同步 `dataset.appearance` 与 `dataset.palette`，为标题赋予唯一 `id` 并挂 `aria-labelledby`；在取消和 `cancel` 事件监听中判断 `isCropDirty(state)`，若已修改则调用 `window.confirm(t("editor.dirtyLeaveConfirm"))`。
- **成本**：**小（1）**——单文件 `src/render/avatar-editor.ts` 约 15 行修改。
- **优先级计算**：影响面 `2` × 频率 `2` ÷ 成本 `1` = **`4.0`**
- **风险**：需检查 `tests/avatar-editor-browser.cjs` 中是否有未修改直接点取消的测试用例（仅当 `zoom !== 1` 或中心点偏移 `> 0.01` 时才触发确认，确保未改动时直接关闭不弹窗）。

---

#### 11. `UI-04` [体验] 回顾页（记录/分析工作区）与诊断预览弹窗存在标题层级跳级（`h1 → h3/h4`）
- **关联项**：`ui-ux-pro-max` §1 `heading-hierarchy`（Sequential `h1→h6`, no level skip）
- **问题描述（可复现）**：
  - **位置**：`src/render/review.ts:319, 523, 576, 738` 与 `src/index.ts:7156`
  - **复现步骤**：
    1. 打开「回顾 → 记录」工作区，用读屏软件或 DOM 检查器读取页面全部标题序列；
    2. 打开「回顾 → 分析」工作区并展开「趋势」、「横向比较」、「分组均衡」折叠卡，读取全部标题序列；
    3. 在「设置 → 关于与诊断」点击「导出诊断」打开诊断预览弹窗，读取标题序列。
  - **当前表现**：①「回顾 → 记录」工作区顶部为 `<h1 class="lc-checkin__title">回顾</h1>`，下方无 `<h2>`，直接出现日期分组 `<h3 class="review-record-day">`（跳级 `h1 → h3`）；②「回顾 → 分析」工作区前 8 个折叠卡 `<summary><strong>...</strong></summary>` 未使用 `<h2>`，导致内部卡片直接出现 `<h3>近12周完成率</h3>`（`review.ts:576`）、`<h4>按单位分组</h4>`（`review.ts:738`，跳级 `h1 → h4`）；③ 诊断预览弹窗（`index.ts:7156`）内直接写 `<h4>诊断详情</h4>`，无 `<h2>/<h3>`。
  - **期望表现**：所有面板和弹窗严格遵循 `h1 → h2 → h3` 顺序递增，不跨级跳号，确保屏幕阅读器标题大纲导航（`H` 键跳转）层次清晰。
- **解决方案**：在 `review.ts` 记录工作区增加视觉隐藏或区块级 `<h2>`，将分析工作区折叠卡内或卡片标题层级顺次对齐为 `h2 → h3`（将 `review.ts:738` 的 `<h4>` 改为 `<h3>`），并将 `index.ts:7156` 诊断预览弹窗的 `<h4>` 改为 `<h3>`（配合弹窗标题 `<h2>`）。
- **成本**：**小（1）**——仅涉及 `src/render/review.ts` 与 `src/index.ts` 中 5 处标签名与对应 SCSS 选择器对齐。
- **优先级计算**：影响面 `3`（读屏标题导航与无障碍合规）× 频率 `3` ÷ 成本 `1` = **`9.0`**
- **风险**：需同步检查 `src/ui/review-workspace.scss` 与 `src/ui/components.scss` 中是否有后代选择器直接写死 `.lc-checkin__item-compare-group h4` 或 `.lc-checkin__diag-details h4`，改为 `:is(h3, h4)` 保持样式完全一致。

---

#### 12. `UI-05` [体验] 多处结构性与装饰性 Emoji 未标记 `aria-hidden="true"` 或直接替代了统一矢量图标
- **关联项**：`ui-ux-pro-max` §1 `icon-context` / §4 `no-emoji-icons` / `icon-style-consistent`
- **问题描述（可复现）**：
  - **位置**：`src/render/fragments.ts:760`（`📅 今日行动轨迹`）、`src/render/editor.ts:204, 215-218, 236`（`✨`、`🏃`、`📖`、`💧`、`🧘`、`🔒`）、`src/render/occasions.ts:296`（`✎`、`✓/○`、`📅`）、`src/render/settings.ts:445-450`（提醒预设按钮 `🌱`、`🌅`、`⚖️`、`⚡`）、`src/ui/components.scss:11397`（`content: "🔥"` 伪元素）
  - **复现步骤**：
    1. 开启屏幕阅读器（NVDA / VoiceOver）或运行 DOM 无障碍树检查，遍历今日页、新建页、事项页和设置页；
    2. 聚焦到「✨ 智能起草」、「🔒 本地优先」、「📅 今日行动轨迹」、「⚖️ 早晚复盘」等带可见文字的按钮与标题。
  - **当前表现**：这些紧邻可见文字的装饰性 Emoji 直接裸写在文本节点或伪元素 `content: "🔥"` 中，未包裹 `<span aria-hidden="true">`，导致读屏软件在朗读按钮名称前先播报生硬的 Emoji 字典名（如“火花 智能起草”、“挂锁 本地优先”、“天平 早晚复盘”），且跨 Windows/macOS/Android 平台字形大小与基线不一。
  - **期望表现**：所有紧邻可见文字的装饰性符号或 Emoji 必须包裹 `<span aria-hidden="true">...</span>`（伪元素添加 ` content: "🔥" / "";` 或改用内联 `aria-hidden="true"` 节点），结构性控件优先复用 `uiIcon(...)` 矢量图标。
- **解决方案**：将 `fragments.ts`、`editor.ts`、`occasions.ts`、`settings.ts`、`review.ts` 中紧邻可见文本的装饰性 Emoji 统一用 `<span aria-hidden="true">...</span>` 隔离，或替换为 `uiIcon` SVG。
- **成本**：**小（1）**——纯模板标记优化，不改文案语义与字典键值。
- **优先级计算**：影响面 `3`（全插件多面板读屏体验与视觉一致性）× 频率 `4` ÷ 成本 `1` = **`12.0`**
- **风险**：`tests/ai-draft-interaction.test.cjs` 等测试通过 `data-ai-draft-example` 属性而非 `innerHTML` 匹配，包裹 `<span aria-hidden="true">` 对现有测试零破坏。

---

#### 13. `UI-06` [体验] 跨面板同类搜索框与筛选下拉框实测高度不一致（34px / 36px / 42px / 44px 混排）
- **关联项**：`ui-ux-pro-max` §4 `consistency` / §2 `touch-target-size` / 补充维度 2（同一控件在不同面板是否一致）
- **问题描述（可复现）**：
  - **位置**：`src/ui/components.scss:6108, 6963`、`src/ui/maintenance-responsive.scss`、`src/ui/polish.scss:626`
  - **复现步骤**：
    1. 在标准桌面视口（`1180×760`）下依次打开「今日」、「事项」、「归档」、「新建」、「设置」五个面板；
    2. 测量各面板顶部搜索框 `input[type="search"]` 的实际渲染高度，以及「事项」面板筛选折叠区中 3 个筛选下拉框（`[data-occasion-filter]`）与同排第 4 个排序下拉框（`[data-occasion-sort]`）的高度。
  - **当前表现**：① 搜索框在五个面板呈现 4 种不同高度：今日页 `34px`、设置页/新建页 `36px`、归档页 `42px`、事项页 `44px`；② 在「事项」页同一筛选行（`.lc-checkin__occasion-filters`）内，前 3 个筛选 `<select>` 高度为 `34px`（被 `components.scss:6963` `.lc-checkin__occasion-filter select { height: 34px; }` 覆盖），而紧挨着的第 4 个排序 `<select data-occasion-sort>` 高度为 `36px`/`44px`，同一行控件高低不齐。
  - **期望表现**：所有面板的 `input[type="search"]` 以及同一筛选栏内的 `<select>` 控件统一引用 `--lc-checkin-control-height`（桌面紧凑 Dock `36px`、标准页签/弹窗 `40px`~`44px`、移动触控 `44px`），同排控件高度 100% 齐平。
- **解决方案**：清理 `components.scss:6108` (`min-height: 32px`) 与 `6963` (`height: 34px`) 等局部硬编码高度，统一由 `--lc-checkin-control-height` 令牌驱动搜索框与筛选下拉框高度。
- **成本**：**小（1）**——仅需收敛 3 处 SCSS 高度规则。
- **优先级计算**：影响面 `3`（5 个主面板高频搜索与筛选控件视觉一致性）× 频率 `4` ÷ 成本 `1` = **`12.0`**
- **风险**：注意 `tests/desktop-dialog.test.cjs:205` 对 `occasion-filter select { height: 34px; }` 有源码正则断言，修改时须同步更新该守门断言或在同一 `@container` 下为 `select[data-occasion-sort]` 赋予完全相同的高度令牌。

---

#### 14. `UI-07` [体验] 新建/编辑表单与事项表单缺少必填项星号标识及失焦（`blur`）即时字段校验
- **关联项**：`ui-ux-pro-max` §8 `required-indicators` / `inline-validation` / `error-clarity`
- **问题描述（可复现）**：
  - **位置**：`src/render/editor.ts:248, 285`、`src/render/occasions.ts:252, 255`、`src/render/bind-editor.ts:1350`、`src/render/bind-occasions.ts:372`
  - **复现步骤**：
    1. 打开「新建打卡项」或「日期事项 → 新建事项」表单；
    2. 观察「名称」、「目标数值」、「单位」、「日期」等带有 `required` 属性的字段标签是否有必填视觉标识；
    3. 将「名称」输入框清空或将「目标数值」填为 `0` 后按 `Tab` 切走焦点（`blur`），观察是否出现内联错误提示。
  - **当前表现**：① 虽然 `<input name="name" required>` 带有 HTML `required` 属性，但对应的 `<label><span>名称</span>` 没有任何必填星号或说明，用户无法提前区分必填项与选填项；② 表单仅在最终点击「保存」按钮（`submit`）时才触发 `validateEditorInput` / `applyOccasionValidationFeedback`，在字段失焦（`blur`）时没有任何即时校验反馈，且事项表单校验失败时未调用 `attachErrorSummary` 生成顶部可聚焦错误摘要卡片。
  - **期望表现**：① 必填字段标签旁展示清晰的语义化必填标记（如 `<em class="lc-checkin__required" aria-hidden="true">*</em>`）；② 关键必填与数值范围字段在 `blur` 时（当用户已触碰过该字段后）即时展示/清除内联错误提示；③ 事项表单提交失败时与习惯编辑器一致挂载 `attachErrorSummary` 顶部错误汇总。
- **解决方案**：在 `editor.ts` 与 `occasions.ts` 的必填字段标签补齐 `.lc-checkin__required` 标记；在 `bind-editor.ts` 与 `bind-occasions.ts` 为必填/数值输入框绑定 `blur` 校验，并在 `applyOccasionValidationFeedback` 中接入 `attachErrorSummary`。
- **成本**：**中（2）**——涉及两个表单渲染器与两个绑定模块的校验时机扩展。
- **优先级计算**：影响面 `3` × 频率 `3` ÷ 成本 `2` = **`4.5`**
- **风险**：`blur` 校验不得在用户刚打开空白新建表单、尚未输入任何内容就点击取消/模板按钮时抢先报错或夺取焦点（仅在字段 `touched` 后触发内联提示，不移动焦点）。

---

#### 15. `UI-08` [体验] 单项目聚焦下的 4 阶定量热力图缺少可展开的无障碍数据表（Data Table）与周视图备选
- **关联项**：`ui-ux-pro-max` §10 `data-table`（Provide table alternative for accessibility）/ `pattern-texture`
- **问题描述（可复现）**：
  - **位置**：`src/render/review.ts:520-537` (`renderHeatmap` 中的 `if (focusedItem)` 分支) 与 `src/charts.ts:650-715`
  - **复现步骤**：
    1. 进入「回顾 → 分析」，在顶部项目聚焦下拉框选择某一具体项目（如「每日饮水」）；
    2. 展开「年度热力图」折叠卡，观察热力图下方是否有像「趋势图」一样的 `<details>` 数据表或像全局热力图一样的「按周聚合视图」折叠区。
  - **当前表现**：未聚焦单项目时，全局热力图下方有 `<details class="lc-checkin__heatmap-weekly">` 按周汇总视图；但当聚焦到单个项目切换为 4 阶定量热力图（`renderQuantitativeHeatmap`）时，既移除了按周汇总折叠区，也没有提供像 `renderTrends`（`review.ts:582` `<details class="review-chart-data">`）那样的可展开表格备选，屏幕阅读器或需要核对各月具体达标天数/数值的用户只能逐格遍历 365 个 SVG `<rect>`。
  - **期望表现**：定量热力图下方提供可展开的 `<details class="review-chart-data">` 按月/按档位汇总数据表（展示各月记录天数、达标天数、累计数值及 4 档完成度分布），兼顾读屏无障碍与精确数据核对。
- **解决方案**：在 `src/render/review.ts:520-537` 的定量热力图分支末尾增加 `<details class="review-chart-data">` 汇总表（按月份或 4 档完成度列出天数与累计值），复用既有 `.review-chart-table` 样式。
- **成本**：**小（1）**——纯渲染模板补充，数据已在 `quant.days` 中算好，约 20 行代码。
- **优先级计算**：影响面 `2` × 频率 `2` ÷ 成本 `1` = **`4.0`**
- **风险**：零新增 CSS 类（直接复用 `.review-chart-data` 与 `.review-chart-table`），不增加 CSS 预算负担。

---

#### 16. `UI-09` [技术债] `components.scss` 中近期记录回执与弹窗徽标残留硬编码十六进制色值，切换调色板时色彩脱节
- **关联项**：`ui-ux-pro-max` §6 `color-semantic`（Define semantic color tokens, not raw hex in components）/ 补充维度 1（样式是否真引用统一令牌与有无硬编码色值）
- **问题描述（可复现）**：
  - **位置**：`src/ui/components.scss:3630-3686, 3964-3966, 11347-11368`
  - **复现步骤**：
    1. 进入「设置 → 外观与操作」，将「调色板风格」从默认「紫罗兰（Violet）」切换为「森林（Forest，翡翠绿主色）」或「海洋（Ocean，晴空蓝主色）」；
    2. 回到「今日」面板完成一次打卡，观察顶部弹出的完成回执卡片（`.lc-checkin__recent-record`）边框、底色与按钮颜色，以及标题栏版本徽标（`.lv-dialog-version-badge`）。
  - **当前表现**：`components.scss:3630-3686` 与 `11347-11368` 使用了未在 `tokens.scss` 定义的 `--lv-brand` 变量并回退到硬编码紫色 `#6366F1`、`#4338CA`、`#C7D2FE` 以及硬编码橙色 `#FB8C00`、`#92400E`、`#FEF3C7`。当用户切换到「森林」或「海洋」调色板时，页面主体变为绿色或蓝色，但近期记录回执卡片和徽标依然固守死板的紫色（`#6366F1`），未能跟随插件统一令牌 `--lc-checkin-accent` 与 `--lc-checkin-data-semantic`。
  - **期望表现**：将所有 `--lv-brand, #6366F1`、`#4338CA`、`#C7D2FE`、`#FB8C00` 硬编码色值统一替换为 `tokens.scss` 中的语义令牌（`var(--lc-checkin-accent)`、`var(--lc-checkin-accent-text)`、`var(--lc-checkin-accent-soft)`、`var(--lc-checkin-data-semantic)`、`var(--lc-checkin-data-semantic-soft)`、`var(--lc-checkin-data-semantic-text)`），确保四种调色板与明暗双主题 100% 协调。
- **解决方案**：在 `src/ui/components.scss:3630-3686, 3964-3966, 11347-11368` 中将硬编码 hex 与未定义的 `--lv-brand` 替换为 `--lc-checkin-*` 标准令牌。
- **成本**：**小（1）**——单文件约 15 处颜色变量替换。
- **优先级计算**：影响面 `3`（调色板切换一致性与令牌规范）× 频率 `3` ÷ 成本 `1` = **`9.0`**
- **风险**：需先核对 `tests/checkin-toast.test.cjs` 与 `tests/siyuan-official-alignment.test.cjs` 是否对 `#6366F1` 或 `--lv-brand` 有源码字符串断言，若有则保留回退值 `var(--lc-checkin-accent, #6366F1)` 或同步更新测试断言。

---

#### 17. `UI-10` [体验] 今日面板首屏同时出现「每日提醒通知条」与「优先提醒横幅」两套重复提醒，挤压待办列表首屏空间
- **关联项**：`ui-ux-pro-max` §5 `content-priority` / `visual-hierarchy` / 补充维度 5（关键操作是否需要滚动才可见）
- **问题描述（可复现）**：
  - **位置**：`src/render/reminder-delivery.ts:110-165` (`.lc-checkin__daily-reminder-notice--inline`) 与 `src/render/fragments.ts:197-235` (`.lc-checkin__priority-reminder`)
  - **复现步骤**：
    1. 在存在当日待打卡项且每日提醒处于未关闭状态时，打开「今日」面板（如 `1180×760` 桌面窗口或 `340×720` 侧边栏 Dock）；
    2. 从上往下依次观察首屏元素：`顶栏` → `每日提醒通知条（126px 高）` → `今日标题栏` → `概览三卡` → `NextHero 英雄卡` → `优先提醒横幅` → `搜索筛选栏` → `待处理列表`。
  - **当前表现**：首屏在到达真正的核心待打卡列表（`main.lc-checkin__list`）之前，纵向堆叠了 **6 层头部与横幅结构**，其中「每日提醒通知条」、「NextHero 英雄卡」和「优先提醒横幅」三者都在提示同一批今日待办习惯。在 `1180×760` 下首张待办卡片虽已在 `Y=692px` 露头，但在 `340×720` 窄侧边栏 Dock 下，待处理列表首张卡片被推到 `Y=820px` 以下，必须滚动才能点击列表中的打卡按钮。
  - **期望表现**：当 `.lc-checkin__daily-reminder-notice--inline` 在宽屏显示时采用单行紧凑水平布局（高度从 `126px` 压至 `≤52px`）；在窄侧边栏 Dock（`@container lc-dock (max-width: 520px)`）下进一步收紧概览卡与提醒条纵向内边距，让窄侧边栏首屏也能直接露出待处理列表第一项操作按钮。
- **解决方案**：在 `src/ui/reminder-delivery.scss` 与 `src/ui/reminder-density.scss` 中将内联提醒条在宽容器下改为 `display: flex; align-items: center; justify-content: space-between` 单行布局；在窄容器下压缩概览与横幅间距。
- **成本**：**中（2）**——涉及 `reminder-delivery.scss`、`reminder-density.scss` 响应式布局调整及多宽度几何回归测试。
- **优先级计算**：影响面 `4`（今日主面板首屏行动效率）× 频率 `5`（每次打开插件必见）÷ 成本 `2` = **`10.0`**
- **风险**：受 `tests/reminder-density-browser.cjs`、`tests/reminder-delivery-browser.cjs` 与 `tests/width-walkthrough.cjs` 严格几何守门约束（按钮高度须保持 ≥44px 且不能遮挡标题），修改后必须跑通全部浏览器宽度走查。

---

### 四、 技术债与产品待决策项（Tech Debt & Decisions — 共 1 条技术债 + 2 条待决策保留项）

#### 18. `FN-08` [技术债] 源码目录存在 24 个零运行时引用的离线评估模块及 4 处测试正则注释锚点
- **关联项**：原 `BP-006`
- **问题描述（可复现）**：
  - **位置**：`src/features/settings-recommendation-*.ts` 等 24 个文件，以及 `src/index.ts:1448, 1574, 1988`、`src/render/fragments.ts:566` 的 `/* contract anchor: ... */` 注释
  - **复现步骤**：从入口 `src/index.ts` 执行静态 import 可达性图谱遍历，对比 `src/` 下全部 196 个 `.ts` 文件。
  - **当前表现**：除本轮建议接线的 `focus-idle-governance.ts`（`FN-06`）外，仍有 24 个 `.ts` 文件仅被 `tests/*.test.cjs` 离线单测直接编译引用，从未接入插件运行时；同时 `src/index.ts` 与 `src/render/fragments.ts` 中存在 4 处专门为了迎合旧测试源码字符串正则匹配而留下的 `/* contract anchor: ... */` 注释。
  - **期望表现**：更新对应测试文件中的正则断言以匹配真实代码结构，移除源码中的 `/* contract anchor: ... */` 注释；对 24 个离线契约评估模块明确分层（迁入 `src/contracts/` 或在 `docs/architecture.md` 标明为离线领域契约校验库），降低源码目录维护噪音。
- **解决方案**：逐一核对引用那 4 处 `contract anchor` 的测试文件并放宽其正则，删除源码中的锚点注释；在 `docs/architecture.md` 建立离线治理模型清单。
- **成本**：**中（2）**——涉及多个守门测试文件正则同步与架构文档更新。
- **优先级计算**：影响面 `2` × 频率 `2` ÷ 成本 `2` = **`2.0`**
- **风险**：必须在修改后完整运行 `pnpm test`、`pnpm run test:ui`、`pnpm run test:v18` 确保无任何静态源码正则守门误报。

---

## 第三部分：判定为「受平台/上游限制无法实现」的条目（共 3 条）

以下 3 项经代码与宿主环境核实，属于平台或外部上游插件限制，不列入本地代码修复批次，已提供本地替代方案：

1. **`PL-01` 思源笔记完全退出后的操作系统后台定时弹窗通知**
   - **位置**：`src/render/reminder-delivery.ts`
   - **限制来源**：思源插件运行在 Electron / 移动端 WebView 前端渲染进程内，宿主软件退出后操作系统不会保留插件后台守护进程，Web Notification API 也无法在进程终止后触发。
   - **当前替代方案**：插件已在启动时（`onLayoutReady`）与前台定时槽自动执行漏提醒补投递，并提供「导出 ICS 日历」（`occ.exportIcs`）供用户一键导入系统原生日历获得系统级后台提醒。
2. **`PL-02` 思阅（SiReader）/ 思播（SiPlayer）跨多窗口同一阅读/播放会话的绝对身份合并（原 `T-1508`）**
   - **位置**：`src/features/sireader-adapter.ts`、`src/features/siplayer-adapter.ts`
   - **限制来源**：上游思阅公开生命周期事件与思播公开 `controller` 接口均未暴露跨窗口共享的稳定 `sessionId`（上游提案 `sireader#55` / `siplayer#180` 待上游合入）。
   - **当前替代方案**：使用精确开始时间戳避免同一分钟内两段会话互相吞并，同窗口内严格幂等，异常或跨窗口可疑片段进入设置页「外部失败待处理箱」由用户确认。
3. **`PL-03` Task Horizon 原生日历「打卡图层」展示与任务复选框完成自动回写（原 `T-1836` 等合并）**
   - **位置**：`src/features/taskhorizon-cooperation.ts`、`examples/task-horizon-bridge/plugin.js`
   - **限制来源**：Task Horizon 插件（v3.1.8）自身仓库尚未合入消费 `window.siyuanCheckin` API v5 的图层渲染与任务回写代码，本插件不能越权篡改其他插件的私有文件或内部 DOM。
   - **当前替代方案**：本插件已完整提供 `window.siyuanCheckin.getCalendarProjection` 与 `recordEventsBatch` API v5 接口，并在 `examples/task-horizon-bridge/` 提供了可独立运行验证的桥接示例与契约自测包。

---

## 第四部分：优先级总表与后续开发分批执行建议

### 4.1 全部 18 条可开发待办优先级排序总表

| 排序 | 编号 | 类型 | 标题摘要 | 影响面(1-5) | 频率(1-5) | 成本(1-3) | 优先级分 | 建议批次 |
| :---: | :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| 1 | **FN-01** | 缺陷 | 「立即同步今日打卡到日记」写入失败假成功提示 + 500 块未分页重复追加 | 5 | 3 | 1 (小) | **15.0** | **第一批** |
| 2 | **UI-01** | 缺陷 | 深色模式下专注计时器选中预设按钮文字对比度仅 1.25:1 | 4 | 3 | 1 (小) | **12.0** | **第一批** |
| 3 | **UI-05** | 体验 | 多面板装饰性 Emoji 缺 `aria-hidden="true"` 干扰读屏与跨平台字形 | 3 | 4 | 1 (小) | **12.0** | **第二批** |
| 4 | **UI-06** | 体验 | 跨面板搜索框与事项筛选栏 `<select>` 高度不一致（34/36/42/44px） | 3 | 4 | 1 (小) | **12.0** | **第二批** |
| 5 | **UI-10** | 体验 | 今日面板首屏双提醒横幅叠加挤压窄侧边栏待处理列表可见性 | 4 | 5 | 2 (中) | **10.0** | **第二批** |
| 6 | **FN-02** | 缺陷 | 今日手动排序（拖拽/上移下移/快捷键）失败未复位 DOM 且成功未刷新多表面 | 3 | 3 | 1 (小) | **9.0** | **第一批** |
| 7 | **FN-03** | 缺陷 | 新建页「复制提示词」与回顾页「逾期补记撤销」异常被静默吞掉零反馈 | 3 | 3 | 1 (小) | **9.0** | **第一批** |
| 8 | **FN-04** | 功能 | 新建页自然语言起草丢弃多模态习惯第 2 个备选草案（如背单词按时长） | 3 | 3 | 1 (小) | **9.0** | **第一批** |
| 9 | **FN-07** | 体验 | 「更多」面板跳转设置子分组未滚动定位且返回栈焦点未恢复 | 3 | 3 | 1 (小) | **9.0** | **第二批** |
| 10 | **UI-04** | 体验 | 回顾页（记录/分析）与诊断预览弹窗标题层级跳级（`h1 → h3/h4`） | 3 | 3 | 1 (小) | **9.0** | **第二批** |
| 11 | **UI-09** | 技术债 | `components.scss` 近期记录回执与徽标残留 `#6366F1` 等硬编码色值脱离调色板 | 3 | 3 | 1 (小) | **9.0** | **第三批** |
| 12 | **UI-02** | 缺陷 | 回顾页「历史对比弹窗」与「建议预览弹窗」缺主题宿主类且按钮仅 23px | 3 | 2 | 1 (小) | **6.0** | **第一批** |
| 13 | **FN-05** | 功能 | 编辑已有项目时自然语言微调（`evaluateExistingItemAiAdjustment`）与模板变体未接 UI | 4 | 3 | 2 (中) | **6.0** | **第三批** |
| 14 | **UI-07** | 体验 | 新建/编辑表单与事项表单缺少必填星号标识及失焦（`blur`）即时校验 | 3 | 3 | 2 (中) | **4.5** | **第三批** |
| 15 | **UI-03** | 体验 | 头像裁剪 `<dialog>` 缺 `data-appearance` 属性且修改后关闭无确认保护 | 2 | 2 | 1 (小) | **4.0** | **第三批** |
| 16 | **UI-08** | 体验 | 单项目聚焦 4 阶定量热力图缺少可展开的无障碍数据表（Data Table） | 2 | 2 | 1 (小) | **4.0** | **第三批** |
| 17 | **FN-06** | 功能 | 专注计时闲置暂停与净时长模型（`focus-idle-governance.ts`）未接入且含死分支 | 3 | 2 | 2 (中) | **3.0** | **第四批** |
| 18 | **FN-08** | 技术债 | 清理 4 处测试正则注释锚点与归档说明 24 个离线评估纯模型模块 | 2 | 2 | 2 (中) | **2.0** | **第四批** |

---

### 4.2 分批开发建议（每批控制在单轮可闭环验证并本地发版的体量）

1. **第一批（优先修复全部核心缺陷与高优半成品，共 6 项小成本任务，1 轮内可完成）**：
   - **包含条目**：`FN-01`（日记同步假成功与500行分页修复）、`UI-01`（深色专注预设 1.25:1 对比度修复）、`FN-02`（手动重排失败 DOM 复位与多表面同步）、`FN-03`（复制提示词与补记撤销异常反馈补齐）、`FN-04`（自然语言多模态第 2 候选上屏）、`UI-02`（回顾页两类弹窗主题宿主类与按钮尺寸修复）。
   - **批次理由**：严格遵循「先修缺陷、再补半成品」原则，6 项均为定位极其明确的小成本（成本=1）高优项，直击数据准确性、异常恢复与严重对比度违规，一轮即可全部修完并升版。
2. **第二批（导航可达性、控件尺寸统一、无障碍语义与首屏空间优化，共 5 项，1 轮内可完成）**：
   - **包含条目**：`UI-05`（装饰性 Emoji `aria-hidden` 隔离）、`UI-06`（跨面板搜索框与筛选下拉框高度统一）、`UI-10`（今日首屏双提醒横幅紧凑化）、`FN-07`（「更多」面板跳转设置分组滚动定位与返回栈）、`UI-04`（回顾页与弹窗标题 `h1→h2→h3` 层级修正）。
   - **批次理由**：聚焦跨页面导航体验、首屏空间与读屏/视觉一致性，改动集中在渲染模板与 SCSS 层，互不冲突。
3. **第三批（编辑器深度体验、表单失焦校验、调色板令牌化与图表数据表补全，共 5 项，1 轮内可完成）**：
   - **包含条目**：`FN-05`（已有项目自然语言微调与模板变体 UI 接线）、`UI-09`（硬编码色值全面替换为调色板令牌）、`UI-07`（必填星号与失焦即时校验 + 事项错误摘要）、`UI-03`（头像裁剪弹窗主题属性与未保存关闭确认）、`UI-08`（定量热力图可展开数据表）。
4. **第四批（专注双口径深化、代码卫生清理与待决策项跟进，共 2~4 项）**：
   - **包含条目**：`FN-06`（专注净时长双口径与死分支清理）、`FN-08`（测试注释锚点清理与离线模块分层），以及用户拍板后的产品决策项（戒除类「今日暂守」文案口径 `BP-009`、愿望积分兑换 `BP-010`）。
