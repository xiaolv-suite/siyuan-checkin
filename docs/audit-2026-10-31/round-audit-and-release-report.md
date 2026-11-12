# 小驴打卡 2026-10-31 存量盘点、缺陷与半成品清查、界面审查及 v18.45.0 本地发版完整报告

- **执行日期**：2026-10-31
- **基线版本 → 发版版本**：`v18.44.0` → **`v18.45.0`**（本地定版并打标签 `v18.45.0`，全程零远程操作）
- **上一版可回滚产物备份**：[`.artifacts/rollback-backups/v18.44.0/`](../../.artifacts/rollback-backups/v18.44.0/)（`package.zip` SHA-256: `8b452e36d98b7a85f5321932ff94d17a396b366fa6e075446bd75629256b7f71`）
- **本版生产安装包摘要**：`package.zip` SHA-256: `355d4c7b55f91c6eb6e61a3751713b679619b0b12a7e5c6db5c6361215fb1a9a`（详见 [`docs/releases/release-notes-18.45.0.md`](../releases/release-notes-18.45.0.md)）
- **单一事实来源待办池**：[`docs/BACKLOG-SINGLE-SOURCE.md`](../BACKLOG-SINGLE-SOURCE.md)

---

## 第一部分：存量材料全量分级盘点与整合

排除 `.git/`、`node_modules/`、`dist/` 与运行时缓存/测试快照目录后，共扫描源码与测试以外存量文件 **478 份**，按实际内容归为 6 类并逐类判定状态（`有效` / `过期` / `重复` / `已落地未标记`）：

### 1.1 存量材料分类与四态判定

| 内容类别 | 代表文件与数量 | 状态判定 | 处置与单一事实来源整合动作 |
| :--- | :--- | :---: | :--- |
| **1. 根级治理与待办台账** | `TODO.md` (4496行)、`PROGRESS.md`、`DECISIONS.md`、`BLOCKERS.md`、`CHANGELOG.md`、`README.md`、`README_en.md`、`AGENTS.md` | `TODO.md`/`BLOCKERS.md` 属**重复/混杂**；其余**有效**；`BRANCH-PROTOCOL.md` **过期** | 有效开放项与本轮新发现项统一归入 [`docs/BACKLOG-SINGLE-SOURCE.md`](../BACKLOG-SINGLE-SOURCE.md)；原文件不删，顶部注明迁移去向 |
| **2. 隐藏任务与会话计划** | `.tasks/TASK-20261031-github-benchmark-fusion.md`、`.zcode/plans/plan-session_9e6ff40c57ca296e1465bbcc04e3b929.md` | `.tasks/*` 实测为**半成品（声称完成但未接 UI）**；`.zcode/plans/*` 前两阶段**已落地未标记**、CSS 预算治理部分**有效** | 半成品与 CSS 治理并入 `BP-001`~`BP-003` 本轮彻底收口；两份原文件保留并在顶部注明核查事实与迁移去向 |
| **3. 交互原型与原型规范** | `docs/prototypes/checkin-ui-v2.html`、`docs/ui-prototype-system-v2-2026-10-03.md`、`docs/prototypes/checkin-ui-v3.html`、`docs/ui-prototype-spec-v3-2026-10.md`、`docs/*prototype-2026-09-28.md` (3份) | v2 HTML 与 v2 规范**过期**；9 月三份局部流程原型**已落地未标记**；v3 原型与 v3 规范**有效** | `checkin-ui-v2.html` 移入归档目录 [`docs/archive/prototypes/`](../archive/prototypes/) 并附 [`README.md`](../archive/prototypes/README.md) 归档说明；其余文档顶部加注归档/迁移说明 |
| **4. 历史待办与路线图** | `docs/pre-merge-development-backlog-2026-10-02.md`、`docs/agent-execution-backlog-final-2026-10-03.md`、`docs/current-backlog-review-2026-10-03.md`、`docs/product-review-and-backlog-2026-10-06.md`、`docs/development-roadmap*.md`、`docs/v0.6~v13*.md` | 10 月初多份 backlog **重复/部分已落地未标记**；早期路线图**过期** | 原文件不删（部分守门测试引用历史路线文档路径），在主入口文件顶部统一注明迁移至 `docs/BACKLOG-SINGLE-SOURCE.md` |
| **5. 活跃架构规范与契约包** | `docs/architecture.md`、`docs/api-v5.md`、`docs/identity-and-merge.md`、`docs/export-formats.md`、`docs/low-pressure-baseline.md`、`contracts/*`、`examples/*` | **有效** | 与源码及 392 项守门测试逐项对齐，保持现行维护 |
| **6. 历史版本说明与外部交付包** | `docs/releases/release-notes-*.md` (59份)、`docs/v*-change-log.md` (72份)、`交付/2026-10-16/*` (20份) | 版本档案**有效**；`交付/2026-10-16/` 为 v18.17.6 外部合作快照（**过期快照**，留档备查） | 新增 `v18.45.0` 发布说明与更新日志；历史交付快照保留不删 |

### 1.2 原型与当前生产实现对照（基于有效原型 `checkin-ui-v3.html` + `ui-prototype-spec-v3-2026-10.md`）

1. **原型已过期**：
   - `checkin-ui-v2.html`：旧 6 项平铺侧边栏与固定底栏 `action-dock`，已被 5 槽响应式导航轨（`今日 / 回顾 / 事项 / 记录 / 更多`）取代，已归档至 `docs/archive/prototypes/`。
2. **未实现（本轮处理前）**：
   - **洞察页「导出」入口**（`checkin-ui-v3.html:57`）：原型设计有头部导出按钮，且 `src/features/insight-records.ts` 已写好纯函数，但 UI 未接线 → **本轮 `BP-005` 已补齐接线**；
   - **薄弱星期证据与习惯韧性条**（`checkin-ui-v3.html:52` + `D-713`）：原型要求显示“周几记录较少 + 依据”，`analytics.ts` 与 `charts.ts` 已写纯函数但 UI 未调用 → **本轮 `BP-003` 已补齐上屏**；
   - **事项 ICS 导出**（`src/features/occasion-ics.ts`）：纯函数已就绪但事项页无入口 → **本轮 `BP-005` 已补齐接线**；
   - **全局 `⌘K` 命令面板与恢复中心暂停/草稿页签**：v3 规范 §3.3 明确定位为后续扩展概念，归入待办池 `BP-008`。
3. **实现走样（本轮处理前）**：
   - **新建页起草面板内联硬编码与控件高度失配**：`src/render/editor.ts:201-235` 含 17 处内联 `style="..."`，输入框实测高度 `34px`（同页标准控件 `44px`），且缺少事项消歧按钮与历史草案恢复 → **本轮 `BP-004`/`BP-005` 已修正**；
   - **回顾分析聚焦下拉框高度与数据联动走样**：`review-workspace.scss:980` 硬编码 `min-height: 28px`，且选择具体项目/分组后下方热力图仍展示全库混算数据 → **本轮 `BP-002`/`BP-005` 已修正为 `44px` 并全量联动**；
   - **今日页首屏纵向挤压**：桌面 `1180×760` 下首张待打卡卡片起始于 `Y=726px`~`896px`，挤压关键操作 → **本轮 `BP-005` 已收紧至 `Y=692px` 露头可见**。

---

## 第二部分：缺陷排查实测记录

按项目实际形态逐类排查，所有选中项均附可复现步骤与实测证据：

1. **崩溃类（空值下标越界）—— 命中并已修复（`BP-002`）**
   - **位置**：[`src/charts.ts`](../../src/charts.ts) `renderQuantitativeHeatmap`（原第 656 行）
   - **复现步骤**：对尚无按日生成的空 `QuantitativeHeatmap`（`days: []`）调用 `renderQuantitativeHeatmap({year: 2026, unit: "毫升", target: 2000, days: [], completedDays: 0, totalRecordedDays: 0, totalValue: 0})`。
   - **修复前表现**：直接读取 `heatmap.days[0].date` 抛出未捕获 `TypeError: Cannot read properties of undefined (reading 'date')`。
   - **修复后表现**：安全回退至 `heatmap.year`，正常输出合法空网格 `<svg class="lc-yearheatmap lc-yearheatmap--quantitative">`。
2. **状态与数据类（筛选失真、口径反转、假持久化声明）—— 命中 3 项并已修复（`BP-002` / `BP-004`）**
   - **缺陷 2A（分析聚焦失真）**：进入「回顾 → 分析」，顶部聚焦选择单项目（如「每日饮水」）或分组（如「健康」），顶部显示 `🎯 已按「每日饮水」筛选看板`，但展开「年度热力图」仍调用全库 `buildYearHeatmap(ctx.store)`，「分组均衡」与分组模式下的「LifeLog 时间轴」（`src/render/review.ts:706` 漏 `else if (filterGroupId)`）均未过滤。**已修复**：单项目聚焦自动切换 4 阶定量热力图，分组聚焦同步过滤热力图、均衡条与 LifeLog。
   - **缺陷 2B（戒除项达标口径反转）**：`buildQuantitativeHeatmap` 对 `direction: "atMost"` 戒除/上限项目把超标破戒（`value > target`）计入 `completedDays += 1`。**已修复**：区分 `direction === "atMost"`，超标日降为低阶警示且不计达标。
   - **缺陷 2C（草案历史未落盘）**：`README.md` 声明存储 `ai-draft-history.json`，但 `ai-draft-governance.ts` 从未被 `src/index.ts` 导入，新建页生成的草案在重载插件后 100% 丢失。**已修复**：完整接入 `loadData` / `saveData`、`onDataChanged` 跨窗口非并集防复活合并及 7 天 TTL 自动清理。
3. **状态类（测试桩与连点互斥锁回归）—— 命中并已修复（`BP-001`）**
   - **位置**：`tests/recording-history-structure.test.cjs:110` 与 `tests/visual-qa.cjs:510-513`
   - **复现步骤**：执行 `pnpm run test:extended` 与 `node tests/visual-qa.cjs`。
   - **修复前表现**：前序提交 `d64f5fb4` 将快捷步长改为 `querySelectorAll("[data-action='quick-record']")` 后未同步桩方法，且 `0f1b2a9e` 全局注入 `scroll-behavior: smooth` 导致 `visual-qa.cjs` 窄屏滚动复位在动画未完时读到 `scrollTop = 1164`、窄屏设置卡片 `padding: 20px 22px` 挤压文档 ID 输入框宽度不足 `200px`。**已全部修复并通过实测**。
4. **交互类（操作无入口）—— 命中并已修复（`BP-003` / `BP-005`）**
   - 洞察记录 CSV 导出与事项 ICS 导出空有底层函数而界面无按钮，现已补齐按钮、忙碌防重与空结果提示 Toast。
5. **集成类 —— 判断不适用本轮新增缺陷修复（跳过说明）**
   - 经核查 `src/features/*-adapter.ts`、`src/ecosystem.ts` 与 `pnpm run test:ecosystem`（18 项契约测试全过），宿主 API 超时保护（`withTimeout` 10s/18s）、外部来源代际守门与失败待处理箱均正常工作；Task Horizon 与思阅跨窗口会话属上游未实现依赖，不存在本地宿主接口变更静默失效问题。

---

## 第三部分：核心功能全链路验证与半成品清查

静态可达性图谱分析显示：`src/` 共 **196** 个 `.ts` 模块，修复前仅 **167** 个可从入口 `src/index.ts` 到达，存在 **29 个零运行时引用的孤立模块** 及 `analytics.ts` / `charts.ts` 中 5 个零 UI 调用的悬空函数。逐项核查结论如下（严格按三态分类）：

### 3.1 已实现且可用（经单元 + 浏览器 + 思源 3.8.9 真实内核重载实测通过）
- **五类习惯定义、今日打卡、快捷增量、跳过、备注与撤销**：写入 `checkin-store` → 刷新/禁用重启用插件后仍在 → 存储异常自动回滚内存快照并保留重试面板；
- **自然语言智能起草、事项意图消歧与历史持久化（本轮闭环）**：输入描述 → 本地推断或复制自足提示词 → 落盘 `ai-draft-history.json` → 生日/单点日期一键跳转事项页预填 → 重载后最近草案仍可一键填入或删除；
- **回顾概览 / 记录流水 / 多维聚焦分析 / 4 阶定量热力图 / 习惯韧性条 / 薄弱星期观察（本轮闭环）**：全链路数据口径一致，热力图日格支持点击与键盘 `Enter/Space` 钻取回原始记录；
- **单项目洞察与 CSV 导出、日期事项（公历/农历）与 ICS 日历导出（本轮闭环）**：浏览器与原生保存通道双路兼容，公式注入字符自动转义；
- **内置专注计时（单调时钟校准）、多桶备份恢复（`BackupEnvelope`）与公开 API v5（20 项能力协商）**。

### 3.2 技术上可行但未做（已清理主流程半成品，剩余归入待办池）
- **本轮已清零的主流程半成品**：`ai-draft-governance.ts`、`insight-records.ts`、`occasion-ics.ts`、`calculateHabitStrength`、`renderHabitStrengthBar`、`buildQuantitativeHeatmap`、`renderQuantitativeHeatmap`、`diagnoseWeakestDayOfWeek`、`generateAiIntentEnvelope` 均已正式接入运行态 `dist/index.js`（可达模块由 167 升至 170，零虚假功能宣传）。
- **暂未接入 UI 的离线治理/推荐模型（25 个纯函数文件，归入 `BP-006` / `BP-007`）**：包括 `settings-recommendation-*.ts`、`focus-idle-governance.ts`、`page-semantic-audit.ts` 等设计期评估模型。Webpack 生产构建已自动 Tree-shake 剔除，不占用运行体积，且已从 README 移除任何未上屏的过度表述，后续按 `BP-006`/`BP-007` 决定按需上屏或迁入测试辅助目录。

### 3.3 受平台限制无法实现（附限制来源与替代方案）
1. **思源完全退出后的操作系统后台定时弹窗通知**
   - **限制来源**：思源插件运行于前端渲染进程（Electron/WebView），宿主退出后无系统常驻守护进程权限。
   - **替代方案**：启动时与前台定时槽自动补投递提醒横幅，并可使用本轮接通的事项页「导出 ICS 日历」导入系统原生日历获得系统级提醒。
2. **思阅 / 思播跨多窗口同一阅读/播放会话的绝对合并**
   - **限制来源**：上游插件公开事件与控制器未提供跨窗口共享的稳定 `sessionId`（`BLOCKERS.md` `T-1508`）。
   - **替代方案**：按精确起始时刻幂等去重，异常片段进入外部失败待处理箱由用户确认。
3. **Task Horizon 原生日历「打卡图层」展示与任务复选框自动回写**
   - **限制来源**：依赖对方插件仓库合并消费端代码（`T-1836`）。
   - **替代方案**：本插件已提供稳定 `window.siyuanCheckin` API v5 与 `examples/task-horizon-bridge/` 可运行桥接示例。

---

## 第四部分：界面审查发现与前后对比截图

所有审查截图均由真实 Chrome 渲染当前生产构建捕获，存放于 [`docs/audit-2026-10-31/screenshots/`](screenshots/)：

1. **统一令牌引用与内联硬编码清理**
   - **位置**：[`src/render/editor.ts:201-238`](../../src/render/editor.ts) 与 [`src/ui/polish.scss:1599-1638`](../../src/ui/polish.scss)
   - **实测问题**：新建页自然语言起草区含 17 处内联 `style="..."`，输入框高度仅 `34px`（低于同页标准输入框 `44px`）。
   - **修复结果**：内联 `style` 降至 **0 处**，全部改由 `.lc-checkin__ai-draft*` 令牌类驱动，实测高度对齐 `--lc-checkin-control-height`（桌面紧凑 `36px` / 标准与触控 `44px`）。
   - **证据截图**：修复前 [`before-editor-1180.png`](screenshots/before-editor-1180.png) → 修复后 [`after-editor-1180.png`](screenshots/after-editor-1180.png)
2. **跨面板同类控件一致性与分析看板联动**
   - **位置**：[`src/ui/review-workspace.scss:980`](../../src/ui/review-workspace.scss) 与 [`src/render/review.ts:428-540`](../../src/render/review.ts)
   - **实测问题**：分析看板顶部聚焦 `<select>` 高度硬编码 `28px`（同页趋势 `<select>` 为 `44px`），且单项目聚焦时缺少定量热力图与韧性条。
   - **修复结果**：聚焦下拉框实测高度对齐为 **`44px`**，选中项目即时渲染 4 阶定量热力图与习惯韧性条。
   - **证据截图**：修复前 [`before-review-analysis-1180.png`](screenshots/before-review-analysis-1180.png) → 修复后 [`after-review-analysis-1180.png`](screenshots/after-review-analysis-1180.png)；洞察页修复前 [`before-insights-1180.png`](screenshots/before-insights-1180.png) → 修复后 [`after-insights-1180.png`](screenshots/after-insights-1180.png)；事项页 [`after-occasions-1180.png`](screenshots/after-occasions-1180.png)
3. **窄窗口（320px/340px）与 150% 缩放截断排查**
   - **位置**：[`src/ui/polish.scss:1007`](../../src/ui/polish.scss)（`.lc-checkin--settings .lc-checkin__settings-card`）
   - **实测问题**：`visual-qa.cjs` 窄屏（320px/340px）走查捕获到设置页卡片固定左右 `22px` 内边距叠加滚动槽后，把问卷目标文档输入框 `[data-journal-target-doc]` 挤压至不足 `200px` 宽。
   - **修复结果**：改为响应式 `padding: 16px clamp(10px, 3cqi, 22px)`，`320px/360px/390px/430px` 移动矩阵及 150% 缩放全表面 `scrollWidth === clientWidth`，输入框宽度恢复 `>= 200px`。
4. **首屏关键操作可见性（免滚动可达）**
   - **位置**：[`src/ui/workbench.scss:47-63`](../../src/ui/workbench.scss) 与 [`src/ui/polish.scss:681-688`](../../src/ui/polish.scss)
   - **实测问题**：`1180×760` 视口下，今日页头部、概览卡、NextHero 与提醒条纵向间距偏大，导致待处理列表首张卡片落到 `Y=726px~896px`。
   - **修复结果**：适度收紧纵向间距后，首张待处理卡片上移至 `Y=692px`，与 NextHero 主打卡按钮同屏可见。
   - **证据截图**：修复前 [`before-today-1180.png`](screenshots/before-today-1180.png) → 修复后 [`after-today-1180.png`](screenshots/after-today-1180.png)

---

## 第五部分：串行验收、关键路径冒烟与本地发版证据

本轮所有构建与测试均严格**单条串行**执行，100% 实测通过：

1. **类型与生产构建**：`pnpm run check`（0 错误）、`pnpm run build`（`dist/index.css` `736,092 B <= 737,280 B` 硬上限，0 死类，0 重复规则）。
2. **单元、界面、移动、生态、扩展、v18、性能全链**：
   - `pnpm test`：140+ 核心单测（含新增 [`tests/audit-2026-10-31-closure.test.cjs`](../../tests/audit-2026-10-31-closure.test.cjs)）全部通过；
   - `pnpm run test:ui`：双语 3014 键对齐、README 折叠结构守门、组件浏览器回归全部通过；
   - `pnpm run test:mobile`：`320/360/390/430px` 响应式与横竖屏测试全部通过；
   - `pnpm run test:ecosystem`：公开 API v5 与外部来源契约全部通过；
   - `pnpm run test:extended`：392 个测试文件覆盖守门、1429 对明暗颜色对比度 **0 违规**、CSS 卫生守门全部通过；
   - `pnpm run test:v18`：108 项专项治理与跨窗口并发演练全部通过；
   - `pnpm run test:perf`：10k 事件渲染中位数 `15ms`，100k 批量生命周期 `59.3ms`。
3. **明暗双主题真实 Chrome 视觉走查**：
   - `node tests/visual-qa.cjs`（浅色 + `CHECKIN_QA_THEME=dark` 深色）：全部几何、草稿冲突、多表面隔离断言通过，`pageErrors: []`。
4. **发布资产、回滚演练与真实思源内核安装冒烟验证**：
   - 四处版本号一致：`package.json` = `18.45.0`、`plugin.json` = `18.45.0`、`src/version.ts` = `18.45.0`、`README.md` / `README_en.md` = `18.45.0`；
   - `pnpm run check:release`：11 项发布资产 SHA-256 核验与 4 步故障回滚演练通过，上一版 `v18.44.0` 完整安装包与 `dist/` 已留存于 `.artifacts/rollback-backups/v18.44.0/`；
   - **真实思源宿主隔离安装实测**：将 `v18.45.0` 生产产物安装至独立临时靶场并启动本机 `SiYuan-Kernel.exe`（思源 v3.8.9），实跑 `api-v5.spec.mjs`、`checkin-persistence.spec.mjs`、`plugin-lifecycle.spec.mjs` **4/4 全部通过（18.5s）**，验证打卡写入落盘、页面重载恢复、只读拦截与插件禁用/重启用全链路完好。
5. **本地 Git 锚点**：提交本地代码并创建本地附注标签 `v18.45.0`，严格未执行任何 `git push`、远程标签或 GitHub Release 操作。
