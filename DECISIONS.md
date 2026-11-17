# D-726：全链路真实 E2E 走查、缺陷清零与 v18.45.1 本地发版（2026-11-01）

- **背景与目标**：
  - 用户指令：「通过 pnpm e2e:isolated，好好的完整的再查下 UI、功能、交互、按钮、联动等内容，并完整的审查下目前的代码，修复相关 bug。最终本地打包发版（GitHub 不要动，不要上传）。」
- **缺陷排查与修复**：
  1. **智能体建议工作流语义等价归一化（消灭 Flaky）**：
     - 排查发现 `tests/e2e/review-suggestion.spec.mjs` 在全量并发运行时出现偶发超时重试；
     - 根因：`suggestionValuesEqual` 在比对 `priority`、`tomatoMode`、`timeSlot`、`group` 等可缺省字段时，未对 `undefined` 与默认语义值（如 `"medium"`、`"off"`、`"anytime"`、`""`）进行等价归一，导致未显式填字段的初始 item 与建议生成的标准结构判定为 conflict 而跳过执行；
     - 修复：在 `suggestionValuesEqual` 中注入默认值归一化，彻底消除工作流确认冲突与 flaky，单测秒通（4.5s）。
  2. **微信读书分步配置渲染顺序修复**：
     - 修复 `src/render/settings.ts` 中将阅读时长（唯一必需项）放于折叠外底层、而将可选完读与笔记指标前置的顺序问题；按 D-650 规范严格对齐「时长必需 -> 完读可选 -> 笔记可选 -> Key -> 阈值 -> 生效摘要 -> 启停 -> 立即拉取」，通过 `tests/weread-panel-structure.test.cjs` 契约。
  3. **自动化走查 Toast 悬浮遮挡防护**：
     - 修复自动化走查中思源内核右上角全局 Snackbar 浮条拦截 pointer-events 导致的偶发点击超时。
  4. **全量守门与版本发版验证**：
     - 升级基线至 `v18.45.1`，生成并校验发布资产（`package.zip`、`dist/`、`docs/v18.45.1-change-log.md`、`release-notes-18.45.1.md`）；
     - CSS 体积严格锁死在 **655,353 字节**（≤ 640KiB / 655,360 字节硬上限），0 死类、0 重复规则；
     - 通过全量测试套件（`pnpm check`、`pnpm test`、`test:ui`、`test:ecosystem`、`test:v18`、`check:release`）与 32 项真思源内核隔离 E2E（`pnpm e2e:isolated`）；
     - 同步至 `43929` 隔离预览沙箱供现场验收，全流程严格未做远程推送或远程操作。

# D-725：单独弹出窗口（快速弹窗）全面流体响应式自适应（T-1999，2026-11-01）

- **背景与根因定位**：
  - 用户反馈「在文档模式下已经自适应了；但是在弹出的单独窗口里还没有自适应，也进行一下自适应」。
  - **实测根因**：
    1. 快速弹窗宿主 `.lc-checkin-dialog-host` 历史样式残留了 `.lc-checkin > * { width: min(100%, 700px); }`；尽管容器查询 `@container lc-dialog (min-width: 1300px)` 声明了 `max-width: 1400px`，但由于没有配合 `width: 100%`，导致内容宽度依然被锁死在 `700px`；
    2. 实测在 1920x1080 屏幕下拉起的 1382px 弹窗内，内容仅占 700px，左右两侧各自留下了高达 **340px（合计 680px）** 的巨大死白空白区；
    3. 弹窗内的卡片网格写死了 `grid-template-columns: repeat(2, minmax(250px, 1fr))`，导致大弹窗下卡片只能排 2 列。
- **决策与落地**：
  1. 在 `@container lc-dialog (min-width: 760px)` 及后续阶梯中为 `.lc-checkin-dialog-host .lc-checkin__layout` 注入 `width: 100%`，使其实时拉满当前阶梯的 `max-width`（800px → 950px → 1150px → 1400px → 1560px → 1780px）；
  2. 弹窗内卡片网格升级为流体平铺 `grid-template-columns: repeat(auto-fill, minmax(360px, 1fr))`，在宽弹窗下自然排成 3 列或 4 列；
  3. 编辑器宽度上限放宽至 `880px`，消除大弹窗下居中狭窄感；
  4. 产物体积严格控制在 **655,353 字节**（≤ 640KiB / 655,360 字节硬上限），通过 CSS 卫生门禁与 6 项隔离真机 E2E。
- **实测验证**：
  - 1920x1080 视口下实测弹窗：`dialogW: 1382px`，`layoutW` 从 **700px 跃升至 1326px**，两侧死白空白从 **340px 骤降至 27px**（仅保留自然版心 padding），卡片网格从 2 列自动流体扩展为 3 列（`418px × 3`），全页面（今日、回顾、事项、设置）在弹窗内全部完美自适应展宽！

# D-724：流体全屏自适应（消除 ①② 巨大空白）与设置页字体层级调优（T-1997/T-1998，2026-11-01）

- **背景与根因定位**：
  - 用户反馈「这是故意做的尺寸修改吗？①②过多空白。整个插件多处有这种收窄的限制，是因为什么？是否可以根据窗口大小调整；另外设置页字体有的很大」。
  - **根因分析**：
    1. 早期 5.0 版在 `.lc-checkin-tab-host .lc-checkin > *` 上写死了 `width: min(100%, 960px)`（以及 `.lc-checkin--today > * { width: min(100%, 1280px) }`），试图模仿居中卡片阅读防文本过长。但在现代桌面端（1080p 全屏、2K 宽屏、双屏分屏）下，内容被强制框死在 960px 窄条内，导致两侧产生高达 367px（合计 734px）的死白空白区（① 和 ②），宽屏优势完全浪费；
    2. 设置页字体在历史维护中混入了 16px 的 h2、14px 的粗体 row label、16.4px 的问卷标题，与 10.5px 的 small 形成近 6px 的视觉断层，视觉上“有的文字很大很突兀”。
- **决策与落地**：
  1. **全屏流体自适应（T-1997）**：
     - 彻底解绑 `.lc-checkin-tab-host` 中死板的 960px 紧箍咒，内容区随视口平滑延伸至 `min(100%, 1680px)`（今日页达 1800px）；
     - 今日页卡片网格从死板 2 列全面升级为自适应流体（`repeat(auto-fill, minmax(360px, 1fr))`），宽屏自动平铺为 3 列、4 列甚至 5 列；
     - 回顾页、事项页双栏、更多页（三分组自适应填满）、设置页卡片群在宽屏下全部舒展，两侧空白实测从 **367px 骤降至 41px**（仅保留自然呼吸 padding），彻底消除 ①② 死白空白！
  2. **设置页视觉字体尺度对齐（T-1998）**：
     - 分类卡 h2 标题由 16px 降至稳健的 14px（font-weight 650）；
     - 设置项 Label 由 14px 粗体收缩至 13px（font-weight 550），对齐思源原生设置规范；
     - 辅助说明 small 统一至 11.5px（行高 1.45），代码/ID 为 12px，按钮为 12.5px；
     - 问卷自定义等标题统一定格为 13.5px，整体视觉协调、紧凑、不再有“大粗字”压迫感。
  3. **质量与体积守门**：
     - 通过选择器收敛将 `dist/index.css` 控制在 **655,339 字节**（严格在 640KiB / 655,360 字节硬上限内），CSS 门禁 0 死类通过；全套 6 项隔离真机 E2E 验证全绿。

# D-723：智能生态联动速览 Hub、一键全开启与健康/叶归零配置回退（T-1996，2026-10-31）

- **背景与痛点**：用户反馈「设置里【联动与目标】这块还是有点复杂，希望能进一步优化、简化、傻瓜式联动，尽可能减少使用难度」。原设置页在「笔记与外部来源」中包含了 14 个小节与深度折叠面板，各联动项都需要用户分别点开、选项目、开开关，且健康收件箱和叶归必须手动配置文档/笔记本 ID 否则完全不可用。
- **决策与落地**：
  1. **智能生态联动 Hub（顶部一键连接卡片）**：
     - 在「笔记与外部来源」顶端新增 `.lc-checkin__ecosystem-hub`，自动实时检测已安装的思源生态插件（思阅、思播、底栏番茄钟、日记 LifeLog、微信读书）并呈现状态胶囊（🟢 已连接 / ⚪ 可开启 / 未安装）；
     - 提供突出按钮「✨ 一键开启全部可用联动」：点击后一键自动完成番茄钟切换到插件模式、思阅自动创建并绑定「思阅精读」、思播自动创建并绑定「思播精听」、日记 LifeLog 开启、健康收件箱自动创建并绑定「健康步数与体重」习惯，整个生态一键完全打通，无需逐个面板翻找。
  2. **健康收件箱零配置日记回退**：
     - `ingestHealthInbox` 在用户未配置专用 `healthDoc` 时，自动回退到今日日记（`resolveJournalTarget` daily 目标），支持用户直接在日记写 `health:steps:2026-10-31 8000` 自动摄取；
     - 绑定完成后折叠收起为一行「已关联指标：健康步数、健康体重 [更改]」，消除平铺下拉框冗余。
  3. **叶归 LifeLog 零配置笔记本回退**：
     - `ingestYeguif` 在用户未选择笔记本时，自动回退到当前日记笔记本或首个打开的笔记本，消除「未配置」错误阻断。
  4. **CSS 卫生与预算守门**：
     - 精简 `components.scss` 中冗余的多重 details-marker 选择器与未消费 keyframes，在新增生态 Hub 样式的前提下将 `dist/index.css` 控制在 **655,275 字节**（严格在 640KiB / 655,360 字节硬预算内），CSS 门禁通过，死类为 0。
- **实测验证**：43929 环境现场实测点击「一键开启全部可用联动」，全部胶囊瞬间变更为「已连接」/「全部已就绪」，并在终端与控制台验证零报错。

# D-722：高密度单卡独立分离、43929 联动插件全装机与傻瓜式零配置联动（2026-10-31）

- **T-1992 43929 沙箱真实装机 8 款联动插件与 30 天多源种子**：
  - 将宿主已构建的 8 款生态插件（思阅 v2.5.8、小驴雷切、底栏番茄钟 v2.3.9、Task Horizon v3.3.6、小驴闪卡、小驴学习、小驴拾遗、小驴常用）自动拷入隔离工作区并登记启用；
  - 构造 14 项排期/归档项目与 30 天多源事件（覆盖手动、思阅、思播、微信读书、番茄钟、叶归 LifeLog、接口写入、导入 8 种来源），事项扩展为 9 种全形态（农历生日、每月固定日、每周等）。
- **T-1993 & T-1994 今日紧凑网格解绑与单卡独立卡片化**：
  - 根因：>12 项时 `data-density="compact"` 采用了 `compact-habit-rows`（无网格 gap、共享整体边框面板），导致用户主观感觉「没有单个分散感，连成一个整体」；且多步进 chips 挤占动作区把正文列压成逐字竖排。
  - 落地：紧凑密度下拆除连续外包面板，恢复 `gap: 12px` 与单卡独立 1px 边框 + 14px 圆角；动作区整体下沉换行到正文下方（`"icon body" / "action action" / "exact exact"`），正文列独占横向空间（宽度实测从 ~160px 恢复到 339px）。
  - 同步修复 NextHero 内部「查看全部提醒」在 280px 窄宽下的文字溢出，更新 `width-walkthrough` 走查断言（56 宽度场景全绿）。
- **T-1995 联动与目标傻瓜式体验收敛（Zero-Config Integration & Output Targets）**：
  - **自动关联引擎**：思阅/思播首次产生事件且从未绑定时，自动寻找/创建同名打卡项目、完成绑定并开启联动（同时显式停用受保护不重启）；
  - **目标文档零配置回退**：日记报告「写入本期报告」与摘要驻留开关在用户留空 docId 时，自动解析并回退写入今日日记（`resolveJournalTarget` daily 目标），按钮保持常亮可用；
  - **设置界面视觉降噪**：思阅/思播绑定后折叠为单行「已关联项目 / 更改」；微信读书非核心配置（完读/笔记目标、拉取阈值）收纳至高级折叠区。
  - **验证闭环**：11 项联动 E2E 全通（思阅、思播、番茄钟、叶归、健康收件箱、API v5、Obsidian）；新增 `auto-binding.spec.mjs` 验证零配置自建绑定与停用保护。

# D-721：事项回归最小目的与打卡→日记 LifeLog 默认化（T-1990/T-1991，2026-10-31）

- **T-1990 事项最小目的裁剪（用户判断题：转打卡是否符合事项定位？）**：
  - **判断**：事项的最早目的 = 「日期驱动的提醒 + 完成留痕」——某天有事、提前 N 天提醒、当天进今日提醒、完成后记一笔。「完成本次」（completedDates 历史）已覆盖留痕；「转打卡」是把提醒对象桥接进习惯系统（创建每日二值项目、仅发生日出现在排期），与习惯系统的周期排期能力重叠，且把「提醒」误导向「打卡」——不符合最少目的。
  - **落地**：行内动作栏移除转打卡（仅剩 编辑/启停/删除，动作列 128px→100px、4 按钮→3 按钮）；转打卡收进**编辑表单下方的高级区**（仅编辑既有事项且未建立关联时出现，防重复转换守卫不变）；已关联项目的徽章与数据模型（linkedItemId）全保留——功能降级而非删除，零数据迁移。
  - **守门同步**：`desktop-dialog`（动作栏签名、`repeat(3, 28px)`、高级区存在 + 行内不得再出现）、`stability-9_8`（钩子注释承载精确签名）、事项族测试全绿。
- **T-1991 打卡→今日日记 LifeLog 默认开启（用户指令：后续每一次打卡都按 LifeLog 记入今日日记）**：
  - 管道本就完备（`resolveJournalTarget` 默认 mode=daily + create=true 自动建当日日记；记录/跳过路径已挂实时追加与撤销删块），唯一闸门是 `lifelogJournal.enabled`（旧默认关）。
  - **默认翻转 + 迁移语义**：`DEFAULT_VIEW_PREFERENCES.lifelogJournal.enabled: true`；归一化引入 `choice` 标记——显式 off 永久受尊重，无 choice 的旧档（enabled:false 是旧默认被整体保存的产物，非用户决定）一次性迁移为开。设置页开关切换时写入 choice。
  - **代价声明**：此前显式关闭过的老用户会被重新开启一次（需再关一次，此后 sticky）——单一自用插件 + 明确指令下接受；已记入 `lifelog-append` 守门与设置页提示文案。
  - **验证**：transpile 级语义断言（absent→on / legacy false→on / choice off→off）+ 43929 环境实测打卡一次日记 LifeLog 9→10 行自动追加。
- **环境排障记录**：43929 内核连续运行超一天且中途被换过插件文件后，前端停留在 `#loading.app-loading`（`layout.center` 不存在），`openTab` 报 `Cannot read properties of undefined (reading 'children')` 并回退快速窗口——内核态损坏的次生现象而非插件缺陷；重启内核即恢复。探针已吸取教训：等 `#loading` 消失且 `#layouts` 有内容再调 `openTabPage`。

# D-720：43929 隔离实测网页驱动的 6 项用户实测反馈修复（2026-10-31）

- **背景**：基于新建的 D 盘持久隔离实测网页（端口 43929）用户逐屏反馈 6 个问题，全部在隔离环境复现→修复→实测闭环（截图 + computed-style 审计 + 7 项隔离 E2E + CSS 门禁）：
  1. **完成打卡整页闪烁**：根因是 `.lc-checkin { scroll-behavior: smooth }` 让打卡全量重绘后的 `scrollTop` 恢复动画化；移除该声明（需要平滑的调用方显式传 `behavior`）并在恢复处强制 `scrollBehavior = "auto"`。
  2. **番茄钟默认态显示异常**：polish 层把面板底色改为浅色 `--lc-checkin-surface-raised` 后，内部仍用深色面板近白 token（`--lc-checkin-deep-text: #F5F5FA` 等）→ 白底白字「半透明裁切」观感；内部全部改主题感知 token（浅底实测对比度 `16.33:1`，深色主题自动适配）。
  3. **LifeLog 时间轴提权**：从「分析」折叠块提升为回顾页第 4 个平级页签「时间轴」；`reviewWorkspace` 联合类型在 5 处签名同步扩展，点击白名单与 `surface-context` workspace 校验同步放行 `lifelog`（隔离环境实测 26 行时间轴渲染）。
  4. **事项页三板块重构**：定位澄清（页头下新增一句：事项管「哪天要做什么」，与每日习惯互补）；「新建（抽屉）/ 已有事项（统计 + 常驻搜索/分类/排序工具条）/ 其他（ICS 导出 + 按钮说明折叠板块）」三段式；旧 `?` 气泡与页头 ICS 按钮移除，死 CSS 一并清理（`dist/index.css` 反降至 `653,813B`）。
  5. **导航「记录」→「新建打卡」**（zh/en）。
  6. **更多页信息架构**：7 张平铺卡片重组为「快捷操作（强调色）/ 项目与数据 / 偏好与帮助」三分组。
- **配套**：`tests/e2e/ui-interaction-walkthrough.spec.mjs` 按 ICS 新位置更新真实用户路径（展开「其他」板块 → 点击导出）；`responsive-layout` / `cross-surface-matrix` 守门断言同步精确签名。

# D-719：真实思源内核 + 真实浏览器 E2E 全界面排列对齐、交互反馈与文档落地五通道闭环（2026-10-31）

- **背景与实测发现**：通过 `pnpm e2e:isolated` 在隔离 SiYuan 3.8.9 靶场与真实 Chrome 下对全界面几何对齐、交互反馈、双表面联动及思源笔记文档落地通道（锚点建档与备注追加、Daily Note LifeLog 实时同步/撤销/手动去重、报告写入、常驻摘要幂等、Protyle 渲染块）做逐项实测，发现并修复以下真实运行时问题：
  1. **UI 排列对齐与次级弹窗主题尺寸（含 `UI-02` / `UI-06`）**：
     - 消除 `.lc-checkin__text-button` 在 Flex 操作行内继承 `margin-top: 15px` 导致的 `7.5px` 垂直偏移（如新建页自然语言起草操作行 `centerY diff: 7.5px → 0px`），并为洞察页 `.lc-checkin__insight-actions` 补齐 `display: flex; flex-wrap: wrap; align-items: center; gap: 6px`（按钮间距 `0px → 6px`）；
     - 为回顾页「历史分析对比弹窗」「智能体建议预览弹窗」注入 `.lc-checkin.lc-checkin-dialog-host` 与 `data-appearance` / `data-palette` 及标准按钮类（按钮高度 `23px → 32px`）；
     - 事项页筛选下拉框 `select` 高度与搜索框统一为 `36px`（`centerY diff: 0px`）。
  2. **交互反馈、双表面联动与导航定位（含 `FN-02` / `FN-03` / `FN-07`）**：
     - `reorderItems` 手动排序成功后调用 `invalidateSummary()` + `renderBackgroundUpdate()` 同步所有打开表面并恢复当前卡片焦点，失败时 `render()` 复位 DOM；`todaySortMode === "manual"` 时 `NextHero` 按手动顺序取首项；
     - 新建页「复制提示词」增加 `document.execCommand("copy")` 兜底与失败提示 `editor.aiDraftPromptCopyFailed`；回顾页逾期补记撤销、建议操作失败时弹出明确错误提示；
     - 「更多」页点击分类卡进入设置页后使用 `scrollIntoView({block: "start", behavior: "instant"})` 并聚焦分类标题；
     - 修复编辑器保存/归档/删除后未清除 `root.dataset.editorDraftBaseline` 导致误弹「当前编辑内容尚未保存」确认框；
     - 分离专注计时按钮与打卡按钮的 250ms 防抖键（`focus:${itemId}`），消除关闭专注浮层后立即打卡被吞点击的问题。
  3. **思源笔记文档真实落地五通道修复**：
     - **分节标题下追加失败**：思源标题块（`type = 'h'`）在 Lute AST 中是叶子节点，将其 `id` 作为 `/api/block/appendBlock` 的 `parentID` 会被思源内核丢弃；重构 `appendUnderMarkdownSection` 为定位目标标题后查找下一同级/上级标题，存在则 `insertBlock(nextID)`、位于文末则 `appendBlock(parentID: docId)`，缺失分节标题时先追加 `### 标题` 再追加条目；
     - **单日事件区间半开漏算**：`getEventsInDateRange(store, start, end)` 为半开区间 `[start, end)`，修复 `syncTodayCheckinsToLifelogJournal`、`previewOutputMarkdown`、`buildCurrentReportMarkdown`（`skipSlices`）、`render.ts` 与 `plugin-ops.ts` 中传入 `(todayKey, todayKey)` 恒返回空数组的缺陷（改为 `(todayKey, tomorrowKey)`）；
     - **手动同步连续点击去重**：`syncTodayCheckinsToLifelogJournal` 除分页 SQL 外叠加 `/api/export/exportMdContent` 实时 Markdown 查重，消除 800ms 内连续点击因 SQL 索引延迟导致的重复写入；
     - **新建笔记本首次创建 Daily Note**：`resolveJournalTarget` 优先调用思源官方 `/api/filetree/createDailyNote`（未命中再回退 `createDocWithMd`），彻底消除首次创建多级路径日记时的 `commit tx failed: document metadata is not ready` 内核日志报错。
- **验收证据**：新增 `tests/e2e/full-ui-and-doc-landing.spec.mjs`，与 `ui-interaction-walkthrough.spec.mjs`、`journal.spec.mjs`、`render-block.spec.mjs` 在隔离思源 3.8.9 靶场实测 7 项 E2E 全绿，内核错误日志 `0` 行，`dist/index.css` `655,326B <= 640KiB`。

# D-718：下一阶段方向定盘、测试守行为改造、样式覆盖层瘦身与今日首屏去重（2026-10-31）

- **背景与判断**：当前核心矛盾不再是缺功能，而是改动成本高过改动价值（84 个测试对 SCSS 源码文本做正则匹配、25 个未接线评估模块留在 `src/features/`、`dist/index.css` 736,092B 占满 720KiB 上限），同时今日页首屏被重复的「下一步」信息稀释。详见 [`docs/DIRECTION-2026-10-31.md`](docs/DIRECTION-2026-10-31.md)。
- **执行与实测证据**：
  1. **测试改为守行为 + 未接入模块归档**：将 25 个运行时零引用的评估模块及 26 个对应测试移至 `archive/offline-contract-models/`（保留 `tombstone-lifecycle.ts` 守卫 `model.ts` 外部墓碑保活）；新增 `tests/helpers/css-cascade.cjs`，将 17 个断裂的样式文本正则测试改为对编译后有效层叠结果的断言（`assertEffectiveStyle`），删除纯注释分区位置断言；
  2. **样式覆盖层收敛 + 下调 CSS 硬上限 + `UI-01`**：清理被覆盖死声明、同值重复声明与无竞争冗余 `!important`（`307 → 259`），合并同上下文同选择器/同声明体规则；`dist/index.css` 从 **736,092B** 降至 **654,623B**（净减 **81,469B / 79.6KiB**，重复规则从 `~9,800B` 降至 `~169B`），将 `tests/css-hygiene.test.cjs` 硬上限从 `720KiB` 下调并锁死在 **`640KiB`（655,360B）**；修复 `UI-01` 深色专注选中预设按钮对比度（Chromium 实测从 `1.25:1` 提升至 `8.95:1`）；
  3. **今日首屏只保留一个“下一步”（含 `UI-10`）**：去掉 NextHero 卡片内重复的第三行副标题；无独立事项提醒时将优先提醒横幅合入 NextHero 的「查看全部提醒」入口；非今日页隐藏内联每日提醒条（`display: none`）；Chromium 实测 340×720 侧栏首张卡片 `top=494px, bottom=574px`（不滚动完整可见），320px 30 项压测首卡从 `540px` 降至 `482px`；
  4. **顺手修复 `FN-01` 与清理 `FN-06` 死分支**：`syncTodayCheckinsToLifelogJournal` 支持 >500 块分页查重并校验 `appendBlock` 成功状态；移除 `src/render/focus-timer.ts` 中 `if (false as boolean)` 死分支。

# D-717：存量材料单一待办池收口、半成品全链路接通、界面令牌化与 v18.45.0 本地定版（2026-10-31）

- **背景与问题**：新会话独立全量审计发现：① 仓库积累多份历史待办与过期 v2 原型；② 前序部分任务（D-713 习惯韧性条/定量热力图/薄弱日诊断、T-1698 习惯/事项意图消歧、T-1699 `ai-draft-history.json` 持久化、T-1726 事项 ICS 导出、洞察 CSV 导出）仅实现了纯函数模块而未接入运行态 UI，形成半成品；③ 回顾分析聚焦筛选未联动热力图/均衡/分组 LifeLog，且 `renderQuantitativeHeatmap` 在空 `days` 下存在越界崩溃；④ `editor.ts` 起草面板存在 17 处内联 `style` 硬编码，生产 CSS 距 720KiB 硬上限仅余 183B。
- **决策与取舍**：
  1. **单一事实来源**：建立 `docs/BACKLOG-SINGLE-SOURCE.md`，同根因条目合并，按 `影响面×频率÷成本` 量化排序；原待办文件保留不删并加注迁移说明，过期 `checkin-ui-v2.html` 归档至 `docs/archive/prototypes/`；
  2. **主流程半成品零容忍**：本轮将上述已具备完整领域测试的 5 组半成品全部接入真实 UI 与存储生命周期；其余 25 个仅服务于离线契约评估的纯模型文件保留由 Webpack Tree-shake 剔除，不在 README 过度宣传，归入 `BP-006` 后续治理；
  3. **本地发版 `v18.45.0`**：累积完成 `BP-001`～`BP-005` 共 5 项修复、补全与优化，满足 3～5 项发版节奏，升级版本号至 `18.45.0`，保留 `v18.44.0` 可回滚产物于 `.artifacts/rollback-backups/v18.44.0/`，并在隔离思源 3.8.9 靶场完成真实安装与重载验证，创建本地标签 `v18.45.0`，严格不执行任何远程操作。

# D-716：表单校验错误摘要、长文本自适应折行与触控微表面间距收敛（Focusable Error Summary, Long Token Wrapping & Touch Spacing / UI-UX Pro Max）（2026-10-31）

- **无障碍表单错误汇总与直达导航（Focusable Error Summary - W3C WAI Tutorials & UI-UX Pro Max §8 #109）**：
  - 遵循 UI-UX Pro Max 规范中的 `error-summary`（当复杂表单校验失败时，除了各字段内联错误外，必须在表单顶部提供集中的错误摘要组件，便于屏幕阅读器、键盘与认知辅助用户快速理解全局错误并一键直达）与 WCAG 3.3.1 / 3.3.3 指引；
  - 在 `src/features/a11y-focus-announcer.ts` 中实现 `renderErrorSummary` 与 `attachErrorSummary`：
    1. 声明 `role="alert"`、`tabindex="-1"` 与 `aria-labelledby="lc-error-summary-title"`；
    2. 生成包含提示文案与各出错项的直达交互列表（`<button type="button" class="lc-checkin__error-summary-link" data-focus-control="...">`）；
    3. 点击任意错误项即刻将光标与焦点靶向至对应无效表单控件并平滑滚入视野；
    4. 在 `clearFormValidationErrors` 时自动将错误摘要与内联警示同步干净卸载，杜绝错误残留；
- **长文本自适应折行与防水平溢出（Long Token Wrapping - WCAG 1.4.10 Reflow & UI-UX Pro Max §5 #111）**：
  - 遵循 `long-token-wrapping`（任何长链接、UUID、哈希串或无空格用户内容严禁引发横向溢出与水平滚动条）准则；
  - 在 `src/ui/polish.scss` 中为 `:is(.lc-checkin__item-name, .lc-checkin__item-meta, .lc-checkin__field-error, .lc-checkin__error-summary, .lc-checkin__lifelog-row div, .lc-checkin__linkage-hint, .lc-checkin__empty-description)` 显式注入 `overflow-wrap: anywhere; word-break: break-word;`，在极端窄屏（320px）与放大缩放下完整展示文字；
- **触控微表面间距与无障碍最小靶心（Touch Target Size & Spacing - Apple HIG, Material Design & WCAG 2.2 AA 2.5.8）**：
  - 在 `@media (pointer: coarse)` 触控指针环境下，为操作区与筛选条强制保持 `gap: 8px` 安全防误触间距；
  - 确保小按钮与图标按钮最小高度收敛至 38px，配合外展点击边距完全满足移动端无障碍触控体验；
- **质量门禁与预算管控**：
  - 在 `tests/a11y-keyboard-focus.test.cjs` 增设第 15 维度守门断言，覆盖错误摘要渲染、程序化聚焦、DOM 交互与 SCSS 属性；
  - 产物 CSS 体积为 737,097 字节，持续安全收敛在 720 KiB（737,280 字节）硬预算上限以内；全套测试链与发布包数字签名（`8b452e36d98b7a85f5321932ff94d17a396b366fa6e075446bd75629256b7f71`）100% 全绿。

# D-715：表单撤离逃生通道、显式取消键与全量 Back 委托绑定闭环（Form Escape Routes & Explicit Cancel Button Parity / UI-UX Pro Max）（2026-10-31）

- **表单可见取消与逃生出口（Visible Cancel & Escape Routes - Apple HIG & UI-UX Pro Max §1 #81）**：
  - 遵循 `escape-routes`（在模态弹窗与多步骤或复杂表单中必须始终提供对等的放弃/取消出口）与表单主次操作分工规范；
  - 过去习惯打卡编辑器 `.lc-checkin__editor-actions` 底部仅包含「保存」、「存为模板」、「归档」或「删除」，桌面宽屏与长表单用户滑至底部时缺乏显式的「取消」按钮，必须重新折返顶部寻找返回键；
  - 在 `src/render/editor.ts` 操作栏中注入 `<button class="lc-checkin__text-button" type="button" data-action="back">${t("common.cancel")}</button>`；
  - 在 `src/render/occasions.ts` 事项编辑栏为新建与编辑态统一提供 `cancel-occasion-edit` 取消出口；
- **Back / Cancel 全量事件委托绑定闭环（Full Delegation Parity for Back Actions）**：
  - 解决历史遗留缺陷：`src/render/bind-editor.ts` 与 `src/render/bind-occasions.ts` 曾使用单选器 `querySelector("[data-action='back']")` 绑定返回事件，导致同页面新增的底部取消按钮无法响应；
  - 升级为 `querySelectorAll("[data-action='back']").forEach(...)` 与 `querySelectorAll("[data-action='back'], [data-action='occasion-back']").forEach(...)` 全量事件绑定；
  - 任何出口触发均统一流转至 `showEditorReturn(root)` 并触发 `isEditorFormDirty` 脏状态拦截检查（有未保存修改时弹出确认，无修改时平滑返回），形成完备的防误触与安全退出闭环；
- **守门测试与全维质量门禁**：
  - 在 `tests/a11y-keyboard-focus.test.cjs` 增设第 14 维度守门断言，验证编辑器与事项编辑栏显式取消按钮的存在性与 `querySelectorAll` 全量绑定；
  - 产物 CSS 体积为 735,841 字节，持续安全收敛在 720 KiB（737,280 字节）硬预算上限以内；全套测试链与发布包数字签名（`079b41e7754a3adeb27159262c1469ff17a5d47bccad29f5d96809d2a377b854`）100% 全绿。

# D-714：滚动槽防跳动布局稳定、微表面光标与减弱动效回退收敛（Scrollbar Gutter CLS Prevention, Pointer Cursor & Reduced Motion Parity / UI-UX Pro Max）（2026-10-31）

- **根容器滚动条防跳动布局优化（Scrollbar Gutter CLS Prevention - Core Web Vitals CLS < 0.1 & UI-UX Pro Max §5）**：
  - 在列表展开、折叠或动态过滤时，系统滚动条的出现与消失极易引发内容水平跳动；
  - 在 `src/ui/polish.scss` 中为 `.lc-checkin` 根容器注入 `scrollbar-gutter: stable;`，提前预留滚动条槽位，消除 Cumulative Layout Shift；
  - 注入 `scroll-behavior: smooth;` 与 `-webkit-overflow-scrolling: touch;`，使跳至内容地标及程序化滚动保持柔顺丝滑；
- **全胶囊微表面指针光标一致性（Pointer Cursor Consistency - UI-UX Pro Max §2 cursor-pointer）**：
  - 显式声明 `:is(.lc-checkin__chip-button, .lc-checkin__day-chip, .lc-checkin__occasion-chip, .lc-checkin__quick-note-chip, .lc-checkin__preset-chip) { cursor: pointer; }`，消除不同浏览器或第三方主题下可能缺失点击手型光标的断层；
- **减弱动效严格回退（Reduced Motion Parity - WCAG 2.3.3 & Apple Reduced Motion API）**：
  - 在 `@media (prefers-reduced-motion: reduce)` 与 `data-reduced-motion="true"` 环境下，无条件回退 `scroll-behavior: auto !important;` 并抑制 `.lc-habit-strength-bar__fill` 的宽度过渡动效，充分保障前庭觉敏感情境下的无干扰体验；
- **守门测试与全维质量门禁**：
  - 在 `tests/a11y-keyboard-focus.test.cjs` 增设第 13 维度守门断言，验证 `scrollbar-gutter: stable`、`scroll-behavior: smooth`、习惯强度条及减弱动效回退；
  - 产物 CSS 体积为 735,841 字节，持续安全收敛在 720 KiB（737,280 字节）硬预算上限以内；全套测试链与发布包数字签名（`1b1534e8408a259408a11d0e10a91219075fcc31f87849be2ab54c5fff6ad795`）100% 全绿。

# D-713：科学 EMA 习惯强度指数、周频次弹性连击、Skip 搭桥与 4 阶定量热力图融合落地（Habit Strength EMA, Flexible Weekly Streak & Quantitative Heatmap / TASK-20261031-github-benchmark-fusion）（2026-10-31）

- **基于 EMA 的 0~100%「习惯强度指数（Habit Strength）」与韧性进度条（借鉴 Loop Habit Tracker - uhabits）**：
  - 传统连续打卡天数（Streak）面对单日偶发漏打直接清零，极易引发“破罐破摔”断签挫败；
  - 引入指数移动平均（EMA）半衰期算法：`score_next = score * m + done * (1 - m) * 100`，`m = 0.5^(sqrt(freq)/13)`；
  - 在 `src/analytics.ts` 中实现 `calculateHabitStrength`，输出 `0~100%` 强度值、趋势方向（`up` / `down` / `flat`）与箭头（`↑`/`↓`/`→`）；
  - 主动标记 `skip`（休息日/请假）时强度完全冻结（不衰减、不加成）；60 天稳定习惯偶发漏打一天强度仅从 92% 轻微衰减至 ~87%，在 `src/charts.ts` 的 `renderHabitStrengthBar` 中展现稳固的韧性进度条（`is-strong` 渐变态）；
- **「每周 N 次」弹性频次习惯连击计算与 Skip 免断签搭桥（借鉴 uhabits + Habitica）**：
  - 在 `src/analytics.ts` 中实现 `calculateFlexibleStreak`：
    1. 日级模式：支持标记 `skip`（免断签护盾/休息搭桥），连击火苗不灭；
    2. 周频次模式：每周达成 N 次（如每周健身 3 次），自然周内达标即可延续周连击，解决非每日型习惯的连击断层；
  - 在 `src/catalog.ts` 导出 `createWeeklyQuotaSchedule` 便捷周配额排期构建器；
- **4 阶定量热力图色阶与「薄弱星期几诊断洞察」（借鉴 My-GitHub-Contributions + uhabits）**：
  - 在 `src/charts.ts` 中实现 `buildQuantitativeHeatmap` 与 `renderQuantitativeHeatmap`：
    - 按定量打卡当日完成值与目标比例分档（`<25%` 为 1 档，`25~49%` 为 2 档，`50~99%` 为 3 档，`>=100%` 为 4 档满格色阶）；
    - 鼠标与键盘聚焦时展示包含具体数值、目标、百分比与打卡备注的无障碍浮动气泡；
  - 在 `src/analytics.ts` 中实现 `diagnoseWeakestDayOfWeek`：
    - 聚合过去 30 天各星期几的计划与完成分布，精准诊断完成率最低的薄弱日并给出建设性调整建议；
    - 在 `src/api.ts` 对外公开 `getWeakestDayDiagnosis` 接口；
- **全套质量门禁与预算管控**：
  - 新增 `tests/github-benchmark-fusion.test.cjs` 专项测试，涵盖 EMA 强度收敛、单日漏打不归零、skip 冻结、周弹性连击与薄弱日诊断断言；
  - 产物 CSS 体积为 735,566 字节，稳居 720 KiB（737,280 字节）硬预算上限以内；全套测试链与 `package.zip`（SHA-256：`c3a901f4f5eb148839616ab93763682364d9c17b0a487ddbc1a968b7c1b08144`）100% 全绿通过。

# D-712：标签文本溢出披露、快捷记录 Chips 事件全量绑定与胶囊微交互增强（Compact Label Overflow, Quick-Record Chips Binding & Press Feedback Parity / UI-UX Pro Max）（2026-10-31）

- **标签文本截断防丢失与全量气泡披露（Compact Label Overflow & Semantic Disclosure - UI-UX Pro Max §5 #49 & WCAG 1.4.4）**：
  - 遵循 UI/UX Pro Max 规范中的 `compact-label-overflow`（紧凑空间下状态标签与徽章截断不可避免时，必须向指针与辅助设备完整披露原文，严禁不可逆信息丢失）准则；
  - 过去在 Dock 悬浮窗、分栏与移动窄屏（320px）下，`.lc-checkin__item-tag` 受 `max-width: 30%` 与 `text-overflow: ellipsis` 约束，高优先级、跳过、戒除守住、时段、番茄等标签文字被截断时缺乏原生气泡；
  - 在 `src/render/fragments.ts` 中，为所有状态标签（`is-skip-tag`、`is-avoided`、`is-high`、`timeSlot`、`is-tomato`）补齐 `title="${escapeHtml(tagText)}"` 显式披露属性；
  - 在便签快捷 Chips（`.lc-checkin__quick-note-chip`）与 AI 起草示例 Chips 中增补 `title` 与 `aria-label`；当用户鼠标悬停、长按或键盘巡检时，完整语义无缝透出。
- **数值快捷记录 Chips 全量事件绑定闭环（Quick-Record Chips Full Event Delegation Parity - Issue T-1462 & UI-UX Pro Max）**：
  - 解决历史遗留缺陷：`src/render/bind-today.ts` 中针对数值项快捷增量（`quickSteps`，如喝水 +100ml / +200ml / +500ml）的事件绑定误用了单选器 `element.querySelector<HTMLElement>("[data-action='quick-record']")`，导致仅主步长按钮生效，后续快捷 Chips 点击静默失灵；
  - 改为 `element.querySelectorAll<HTMLElement>("[data-action='quick-record']").forEach(...)`，配合每个芯片内嵌的 `data-amount` 独立解析，实现所有增量 Chips 的原子打卡、触觉振动与排队突变全闭环。
- **胶囊微交互按压触觉反馈与触控优化（Tactile Press Feedback & Touch Action Manipulation - UI-UX Pro Max §2 #50 & #103）**：
  - 遵循 UI/UX Pro Max 规范中的 `press-feedback`（按压瞬间提供微缩放反馈强化因果感知）与 `tap-delay`（设置 `touch-action: manipulation` 消除移动端 300ms 点击延迟）准则；
  - 在 `src/ui/polish.scss` 中为 `:is(.lc-checkin__chip-button, .lc-checkin__day-chip, .lc-checkin__occasion-chip, .lc-checkin__quick-note-chip, .lc-checkin__preset-chip)` 注入：
    - `touch-action: manipulation;`
    - `&:active:not([disabled]):not([data-action-busy="true"]) { transform: scale(0.95); transition: transform 0.06s cubic-bezier(0.16, 1, 0.3, 1); }`
    - 禁用态与忙碌态压制：`&:is([disabled], [data-action-busy="true"]) { pointer-events: none; opacity: 0.6; transform: none !important; }`
    - 键盘聚焦环高反差对齐：`&:focus-visible { outline: 2px solid var(--lc-checkin-accent); outline-offset: 2px; }`
    - 在 `@media (prefers-reduced-motion: reduce)` 与 `data-reduced-motion="true"` 环境下无条件平滑静音（`transform: none !important`）。
- **守门测试与全维质量门禁**：
  - 在 `tests/a11y-keyboard-focus.test.cjs` 增设第 12 维度守门断言，验证所有标签 `title` 属性披露、`querySelectorAll` 全量绑定以及 polish.scss 触控与按压反馈样式；
  - 产物 CSS 体积为 733,370 字节，持续安全收敛在 720 KiB（737,280 字节）硬预算上限以内；全套测试链与发布包数字签名（`fed061ae7a0cde62bb6af269aca86415ab0cc251e050492017d4d27e2c5570c8`）100% 全绿。

# D-711：图表图元键盘无障碍导航与数据点语义化增强（Keyboard Accessible Chart Symbols & Data Visualization Parity / UI-UX Pro Max）（2026-10-31）

- **图表数据点与柱体键盘可达性（Focusable Chart Elements - WCAG 2.1.1 & UI-UX Pro Max §10）**：
  - 遵循 UI/UX Pro Max 规范中的 `focusable-elements`（交互式图表元素必须支持键盘导航）与 `tooltip-keyboard`（提示信息必须键盘可达，绝不依赖鼠标 hover）准则；
  - 过去折线图的 `<circle>` 与柱状图的 `<rect>` 仅支持鼠标悬停浮动 `<title>`，键盘用户使用 Tab 键完全无法触达数据点；
  - 在 `src/charts.ts` 中，为 `renderLineChart` 的折线数据点 `<circle>` 与 `renderBarChart` 的柱体 `<rect>` 注入 `tabindex="0" role="graphics-symbol" aria-label="${pointLabel}"`；
  - 键盘操作者使用 Tab 键可在图表中逐点巡回导航，屏幕阅读器直接朗读“2026-10-28：85%”等精准数据点标签，消除仅支持鼠标悬停的无障碍断层；
- **高反差外展聚焦环（Focus Visible for SVG Elements - WCAG 2.2 AAA 2.4.13）**：
  - 在 `src/ui/polish.scss` 中定制 `.lc-chart :is(circle, rect)[tabindex="0"]:focus-visible`；
  - 提供 2px 品牌主色外边框与高反差对比描边（`outline: 2px solid var(--lc-checkin-accent); outline-offset: 2px; stroke: var(--lc-checkin-accent); stroke-width: 3px;`），完全对齐 WCAG 2.2 AAA 2.4.13 Focus Appearance 规范；
- **深色模式图表轴线与数值对比度强化（High-Contrast Dark Mode Chart Typography）**：
  - 在 `src/ui/polish.scss` 中增强深色模式下 `.lc-chart-value`、`.lc-chart-label` 与 `.lc-chart-axis` 的文字明度（`color-mix(in srgb, ... 85%, #FFFFFF)` 与 `#FFFFFF`），确保图表坐标刻度与离散柱头数值即使在紧凑高密度下也保持 >= 4.5:1 的 WCAG AA 文本对比度标准；
- **守门测试与全维质量门禁**：
  - 在 `tests/a11y-keyboard-focus.test.cjs` 增设第 11 维度守门断言，断言折线与柱状图元具备 `tabindex="0"`、`role="graphics-symbol"` 与 `aria-label`；
  - 产物 CSS 体积为 731,921 字节，持续安全收敛在 720 KiB（737,280 字节）硬预算上限以内；全套测试链与发布包数字签名 100% 全绿。

# D-710：加载态无障碍指示与空态引导闭环（Accessible Loading States, Aria-Busy & Actionable Empty States / UI-UX Pro Max）（2026-10-31）

- **加载状态无障碍语义加固（Accessible Loading State - `aria-busy="true"`）**：
  - 遵循 UI/UX Pro Max 规范中的 `loading-indicators`（异步加载必须表达稳定的无障碍繁忙语义，避免因白屏或静默让用户误以为界面假死卡顿）与 `page-semantic-audit.ts` 韧性准则；
  - 在 `src/index.ts` 初始化加载界面（`this.initializationState === "loading"`）中注入 `aria-busy="true"`：
    `const stateAttrs = loading ? 'role="status"' : 'role="alert"';`
    `const busyAttr = loading ? ' aria-busy="true"' : "";`
  - 屏幕阅读器与辅助设备准确感知并通报“忙碌（busy）”状态；
  - 在 `src/ui/polish.scss` 中为 `.lc-checkin__empty[aria-busy="true"]` 配置柔和的呼吸微动效（`animation: lc-checkin-pulse 1.8s ease-in-out infinite`），并严格支持 `prefers-reduced-motion: reduce` 与 `data-reduced-motion="true"` 动效抑制；
- **洞察页空态引导闭环（Actionable Empty State - UI-UX Pro Max Issue #48）**：
  - 遵循 UI/UX Pro Max 规范中的 `empty-states`（空态绝不展示无指引的白屏或孤立文本，必须给出帮助信息与操作出口）；
  - 在 `src/index.ts` 洞察页未选中项目（`!item`）时，为 `.lc-checkin__empty` 补齐图元图标、状态语义（`role="status"`）、辅助描述与操作引导按钮（`<button class="lc-checkin__text-button" type="button" data-mobile-nav="today" data-action="back">${t("nav.today")}</button>`）；
  - 用户可一键平滑返回今日页面选择打卡项查看洞察，杜绝空态无路可走的体验断层；
- **深色模式微表面质感增强（Dark Mode Micro-Surface Refinement）**：
  - 在 `src/ui/polish.scss` 中为 `.lc-checkin[data-appearance="dark"]` 注入针对空态与完成态卡片的深色边界与阴影强化规则（`border-color: color-mix(in srgb, var(--lc-checkin-border-strong) 75%, transparent); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);`），在冷炭近黑底（`#13141C`）上形成深邃而分明的视觉悬浮层次；
- **守门测试与全维质量门禁**：
  - 在 `tests/a11y-keyboard-focus.test.cjs` 增设第 10 维度守门断言，覆盖加载态 `aria-busy` 属性、洞察页空态动作引导与动效定义；
  - 产物 CSS 体积为 731,152 字节，稳稳低于 720 KiB 硬预算上限；全套单元测试、UI 走查、移动端与发布包签名持续 100% 全绿。

# D-709：表单字段辅助提示智能关联与内联错误靶向放置（Form Field Descriptions & Inline Error Placement / WCAG 3.3.1 / 1.3.1 & UI-UX Pro Max）（2026-10-31）

- **表单字段辅助提示智能关联（Persistent Helper Text Association - `aria-describedby` & `input-helper-text`）**：
  - 遵循 UI/UX Pro Max 规范中的 `input-helper-text`（为复杂表单字段提供持久化辅助提示，避免仅依靠占位符导致输入后信息丢失）与 WCAG 1.3.1 Info and Relationships 准则；
  - 在 `src/render/editor.ts` 中，为习惯打卡编辑器的全部核心字段显式配置唯一提示 ID，并通过 `aria-describedby` 建立确定性无障碍绑定：
    1. 打卡步长（`recordStep`）：绑定 `editor-hint-recordStep`（`editor.recordStepHint`）；
    2. 快捷按钮增量（`quickSteps`）：绑定 `editor-hint-quickSteps`（`editor.quickStepsHint`）；
    3. 周期目标（`quotaAmount`）：绑定 `editor-hint-quota`（`editor.quotaHelp`）；
    4. 戒除目标（`directionAtMost`）：绑定 `editor-hint-directionAtMost`（`editor.directionAtMostHint`）；
    5. 问卷模板绑定（`journalTemplateId`）：绑定 `editor-hint-journal`（`journal.editorBindingHint`）；
    6. 笔记锚点块 ID（`anchorBlockId`）：绑定 `editor-hint-anchor`（`editor.anchorHint`）；
    7. 锚点追加打卡记录（`anchorAppendNotes`）：绑定 `editor-hint-anchorAppend`（`editor.anchorAppendHint`）；
    8. 自动归档天数（`autoArchiveDays`）：绑定 `editor-hint-autoArchive`（`editor.autoArchiveHint`）；
    9. 容错连续天数（`streakToleranceDays`）：绑定 `editor-hint-streakTolerance`（`editor.streakToleranceHint`）；
    10. 事项日历可见性（`taskHorizonVisible`）：绑定 `editor-hint-thVisible`（`editor.thVisibleHint`）；
  - 读屏软件在用户光标移入对应输入框或选择器时，自动朗读字段辅助说明，彻底消除盲人或键盘辅助用户脱离视觉上下文盲打的体验痛点。
- **内联错误靶向放置与即时清理恢复（Inline Error Placement & Instant Visual Recovery - WCAG 3.3.1 / 3.3.3）**：
  - 遵循 UI/UX Pro Max 规范中的 `error-placement`（校验失败时在出错控件正下方显示具体错误信息并由 `aria-describedby` 引用，拒绝仅依赖红色外框或顶层模糊提示）与 WCAG 3.3.1 Error Identification、3.3.3 Error Suggestion（Level AA）准则；
  - 升级 `src/features/a11y-focus-announcer.ts` 的 `markFormControlInvalid` 与 `clearFormValidationErrors`：
    1. 校验失败时，动态在对应 `.lc-checkin__field` 内控件正下方创建 `<small class="lc-checkin__field-error" id="error-${name}" role="alert">${errorMessage}</small>`；
    2. 将 `error-${name}` 智能注入控件的 `aria-describedby` 首位，确保读屏软件优先朗读具体错误原因与修复建议；
    3. 在 `src/ui/polish.scss` 中配置高对比度危险警示样式（`color: var(--lc-checkin-danger); font-size: 11.5px; font-weight: 550; line-height: 1.4; overflow-wrap: anywhere;`）；
    4. 结合 D-702 的 `input` 与 `change` 监听器，用户一旦开始在出错输入框打字纠错，内联错误节点立即物理销毁，`aria-describedby` 恢复为原有辅助提示，视觉与读屏感知瞬时回归正轨；
  - 在 `tests/a11y-keyboard-focus.test.cjs` 增设第 9 维度专项守门测试，全套测试链 100% 全绿通过。

# D-708：键盘无障碍直达链接与主要内容地标（Skip to Content & Main Landmark / WCAG 2.4.1 & UI-UX Pro Max）（2026-10-31）

- **键盘无障碍直达链接与主要内容地标（Skip to Content & WCAG 2.4.1 Bypass Blocks）**：
  - 遵循 UI/UX Pro Max 规范中的 `skip-links`（提供跳过重复导航的直达链接，避免键盘用户 100 次 Tab 才能到达内容）与 WCAG 2.4.1 Bypass Blocks（Level A）标准；
  - 针对桌面/移动端各类表面容器（Tab 页签、侧边栏 Dock、桌面快速弹窗）：
    1. 在 `src/index.ts` 中为通用页面内容包装器 `.lc-checkin__layout` 赋予标准主要内容地标身份：`id="lc-checkin-main-content" role="main" tabindex="-1"`；
    2. 在宿主容器顶部挂载纯粹的键盘无障碍直达链接 `<a href="#lc-checkin-main-content" class="lc-checkin__skip-link" data-action="skip-to-content">${t("common.skipToContent")}</a>`，确保其在 DOM 树中处于最前列，键盘用户首次按下 Tab 键即优先获焦；
    3. 在 `src/plugin-ops.ts` 中绑定 `skip-to-content` 动作：拦截默认锚点跳转，平滑寻址聚焦主内容区（`mainContent.focus()`）并平滑滚动（`scrollIntoView({behavior: "smooth", block: "start"})`），读屏软件即刻完整朗读“主要内容 / Main landmark”，随后单次 Tab 即可直达表单首个交互控件；
  - **高反差聚焦感知与平滑进出过渡（Focus Appearance & Smooth Insets）**：
    1. 默认态使用绝对定位隐藏在视口上方（`top: -9999px; opacity: 0; pointer-events: none`），零占用视觉流与布局空间；
    2. 获焦态（`:focus`, `:focus-visible`）以 `160ms cubic-bezier(0.16, 1, 0.3, 1)` 曲线平滑滑入容器左上角（`top: 10px; left: 16px; opacity: 1; pointer-events: auto; z-index: 10000`）；
    3. 配备品牌强调色背景（`--lc-checkin-accent`）、高反差纯白文本、大圆角胶囊（8px）与 2px 外展高反差聚焦环（`outline: 2px solid #ffffff; box-shadow: 0 0 0 4px ...`），满足 WCAG 2.2 AAA 2.4.13 Focus Appearance 规范；
    4. 完美支持 `prefers-reduced-motion: reduce` 与 `data-reduced-motion="true"` 动效抑制；
  - **全维质量与双语守门**：
    1. 在 `src/i18n.ts` 补齐中英双语词条（`"common.skipToContent": "跳至主要内容"` / `"Skip to main content"`），`tests/i18n-parity.test.cjs` 2992 键 100% 对齐；
    2. 在 `tests/a11y-keyboard-focus.test.cjs` 增设第 8 维度断言保障 DOM 结构、事件拦截与聚焦行为，全套 140+ 测试与构建质量链持续 100% 全绿。

# D-707：正文段落防孤行排版与打卡回车意图强化（Paragraph Pretty Text Wrapping & EnterKeyHint Parity / UI-UX Pro Max）（2026-10-31）

- **正文段落防孤行排版（Paragraph Pretty Wrapping - `@supports (text-wrap: pretty)`）**：
  - 遵循 UI/UX Pro Max 规范中的 `heading-line-balance` 与正文自然折行排版准则；
  - 在 `src/ui/polish.scss` 中渐进引入 `@supports (text-wrap: pretty)`，为说明文本、辅导建议、设置卡片段落与空态描述（`:is(.lc-checkin__empty-description, .lc-checkin__integration-help, .lc-checkin__settings-card p, .lc-checkin__field > small, .lc-checkin__coaching-item)`）提供现代换行算法；
  - 消除多行长段落末行掉落单字（孤字）的断层感，与短标题的 `text-wrap: balance` 形成层次分工，零重排性能负担，不支持的环境无缝降级；
- **打卡数值与备注输入回车意图强化（Input EnterKeyHint Semantics）**：
  - 遵循 `input-type-keyboard` 规范，在 Today 打卡数值输入框（`.lc-checkin__amount`）与打卡备注框（`.lc-checkin__record-note`，`fragments.ts`）补齐 `enterkeyhint="done"`；
  - 移动设备软键盘回车键精准显示为“完成 / Done”，与底层 `Enter` 键按键入账监听形成完整的交互与心智闭环；
  - 在 `tests/a11y-visual-extended.test.cjs` 与 `tests/recording-history-structure.test.cjs` 增设属性守门断言，全套测试链 100% 全绿通过。

# D-706：轻量 Toast 与打卡反馈无障碍完整播报闭环（Toast Accessibility & Atomic Status Regions / UI-UX Pro Max）（2026-10-30）

- **轻量 Toast 与打卡反馈无障碍完整播报闭环（Toast Accessibility & WCAG 4.1.3 Status Messages）**：
  - 遵循 UI/UX Pro Max 规范中的 `toast-accessibility`（Toast 提示绝不抢夺焦点，通过 `role="status"` 与 `aria-live="polite"` 优雅通知读屏器）与 `contextual-live-badge-updates` 准则；
  - 针对回顾页事项补打卡浮层 Toast（`lc-checkin__catchup-toast`，`bind-page-navigation.ts`）：
    1. 显式配置 `role="status"`、`aria-live="polite"` 与 `aria-atomic="true"`，保证撤销通知弹出时不打断当前键盘焦点，读屏器完整朗读“已完成补打卡：xxx”与撤销动作提示；
    2. 为撤销按钮（`.lc-checkin__small-button`）补齐 `aria-label="${t('review.undo')}"`，确保独立按钮语义完整；
  - 针对今日打卡成功即时条目（`lc-checkin__recent-record`，`fragments.ts`）：
    1. 升级为 `role="status" aria-live="polite" aria-atomic="true"`；
    2. 当达成连续打卡阶梯触发连击里程碑徽标（`is-milestone`，如“🎉 达成 7 天连续打卡”）时，读屏软件朗读整段完整短语，消除旧版本仅读半句的碎片化断层；
  - 在 `tests/a11y-keyboard-focus.test.cjs` 增设第 7 维度断言保障 Toast 与即时反馈的无障碍契约，全套测试链 100% 绿灯。

# D-705：移动触控与虚拟键盘语义强化（Mobile Touch Keyboard & Inputmode Parity / UI-UX Pro Max）（2026-10-30）

- **移动触控与虚拟键盘语义强化（Mobile Virtual Keyboard & Input Semantics / UI-UX Pro Max）**：
  - 遵循 UI/UX Pro Max 规范中的 `input-type-keyboard`（按输入特征触发匹配的移动端键盘布局）、`touch-friendly-input` 与 `autofill-support` 最佳实践；
  - 针对触控与移动设备（iOS / Android）优化全表单与搜索框的键盘布局与辅助输入参数：
    1. 打卡编辑器数值输入框（`target`、`recordStep`、`quotaAmount`）显式声明 `inputmode="decimal"`，唤起带小数点的纯数字软键盘，杜绝弹出全键盘造成的误选与反复切换成本；
    2. 间隔排期天数（`intervalDays`）显式声明 `inputmode="numeric"`，精准唤起整数键盘；
    3. 全局搜索框（Today 筛选框、事项检索框、设置搜索框、模板检索框、图标检索框、比较看板与锚点搜索）统一定制 `enterkeyhint="search"`、`autocapitalize="off"`、`autocorrect="off"` 与 `spellcheck="false"`，确保移动软键盘回车键清晰呈现“搜索 / Search”操作，消除首字母大写强行干预与误报拼写红线；
    4. 笔记锚点块 ID（`anchorBlockId`）输入框禁用自动大写、拼写检查与自动纠错，提升大纲块 ID 粘贴与编辑的精准度；
  - 在 `tests/mobile-editor-keyboard.test.cjs` 增设专属属性守门断言，全套 140+ 单元测试与移动端矩阵 100% 绿灯通过。

# D-704：弹窗模态键盘防护、Focus Trap 循环与未保存关闭确认闭环（Modal Keyboard Protection & Focus Trap / UI-UX Pro Max）（2026-10-30）

- **弹窗模态键盘防护与 Focus Trap 闭环（WCAG 2.1.2 No Keyboard Trap & 2.4.3 Focus Order）**：
  - 遵循 UI/UX Pro Max 规范中的 `escape-routes`、`keyboard-nav` 与 `sheet-dismiss-confirm`（弹窗未保存时确认拦截）准则；
  - 在快速弹窗（`quick-dialog.ts`）与问卷日记弹窗（`journal-dialog.ts`）全面接入 `evaluateModalKeydown` 模态键盘状态机：
    1. 中文拼音组合输入保护（`isComposing || keyCode === 229`）：在候选词输入期间捕获并严格阻断按键冒泡，杜绝用户按 Esc/Enter 取消选词时触发宿主原生 Dialog 销毁导致表单/问卷数据意外丢失；
    2. 未保存草稿确认（`sheet-dismiss-confirm`）：快速弹窗在响应普通 Esc 键关闭前，统一执行 `shouldProtectQuickDialogDraft` 脏检查并唤起确认对话框，用户取消时完整保留草稿与弹窗；
    3. 焦点闭环（Focus Trap - WCAG 2.1.2）：在 Tab 键触达末尾按钮时循环回首个可获焦控件（`trap-first`），在 Shift+Tab 触达首个元素时循环至末尾按钮（`trap-last`），杜绝键盘焦点逃逸至底层遮罩或宿主文档；
  - 在 `tests/quick-dialog-safety.test.cjs` 与 `tests/a11y-keyboard-focus.test.cjs` 增设专属守门断言，全套 140+ 测试与 UI 套件 100% 全绿通过。

# D-703：吸顶吸底界面焦点无遮挡保障与错误聚焦轮廓强化（Focus Not Obscured & Error Focus Rings / UI-UX Pro Max）（2026-10-30）

- **吸顶/吸底界面焦点无遮挡保障（Focus Not Obscured - WCAG 2.2 AA 2.4.11 & AAA 2.4.12）**：
  - 遵循 UI/UX Pro Max 规范中的 `focus-not-obscured`（AA 级，固定/吸顶元素不得遮盖键盘获焦元素）与 `focus-not-obscured-enhanced`（AAA 级，完整显示获焦元素与其轮廓）；
  - 思源插件内存在 Today 分组吸顶（56px）、设置页吸顶导航（58px）、事项页吸顶看板（58px）、移动端底部吸底导航（56px）与编辑器底部吸底操作栏（52px），键盘 Tab 移动或脚本焦点定位时，视口默认滚动对齐容器边缘极易将控件压在吸附栏下方；
  - 在 `src/ui/polish.scss` 中为所有交互控件（`:is(button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])):is(:focus, :focus-visible)`）与内容卡片容器（`:is(.lc-checkin__field, .lc-checkin__item, .lc-checkin__settings-card, .lc-checkin__occasion-manager-row, .lc-checkin__history-event)`）声明全局 `scroll-margin-block: max(64px, calc(var(--lc-checkin-nav-height, 56px) + env(safe-area-inset-bottom, 0px) + 12px))`；
  - 浏览器原生与平滑滚动时自动预留顶部吸顶与底部导航安全避让间距，确保聚焦控件及其外展轮廓 100% 暴露在可见视口内；
  - 同步强化校验错误控件的专用聚焦轮廓：在 `aria-invalid="true"` 状态下提供危险色聚焦外展环（`outline: 2px solid var(--lc-checkin-danger); box-shadow: 0 0 0 3px ...`），满足 WCAG 2.2 AAA 2.4.13 Focus Appearance 高反差对比度与状态明确性要求；
  - 在 `tests/a11y-visual-extended.test.cjs` 增设第 8 维度断言，确保编译产物持续保留上述规则，编译后 CSS 体积为 728,898 字节（稳稳处于 720 KiB 硬预算上限以内）。

# D-702：表单校验错误状态、即时纠错响应与首个可修复控件焦点寻址（Form Validation Focus Routing & Visual Recovery / UI-UX Pro Max）（2026-10-30）

- **表单校验错误状态与首个可修复控件焦点自动引导（Form Validation Focus Management / WCAG 3.3.1 / 3.3.3 / 2.4.3）**：
  - 遵循 UI/UX Pro Max 规范中的 `focus-management`（提交失败后自动寻址首个出错字段）、`error-feedback` 与 WCAG 3.3.1 错误识别、3.3.3 错误建议标准；
  - 打卡编辑表单（`bind-editor.ts` / `save-form.ts`）与事项表单（`bind-occasions.ts`）在校验失败时，全面标记出错控件自身与其 `.lc-checkin__field` 容器为 `aria-invalid="true"`；
  - 调用 `findFirstRepairableControl(form)` 智能识别首个未禁用的无效字段（`input[aria-invalid="true"]`、`select`、`textarea`），执行平滑聚焦 `focus()` 与视口补正 `scrollIntoView({behavior: "smooth", block: "nearest"})`，杜绝用户在报错后失去焦点或需逐项手动排查的断层体验；
  - 引入即时纠错监听（`input` 与 `change` 事件）：用户一旦开始在错误输入框打字或调整选项，控件与父容器的 `aria-invalid` 标记和危险红框即刻自动解除，提供即时正向恢复反馈；
  - 在 `src/features/a11y-focus-announcer.ts` 集中扩展纯函数辅助体系（`clearFormValidationErrors`、`markFormControlInvalid`、`applyEditorValidationFeedback`、`applyOccasionValidationFeedback`），并在 `tests/a11y-keyboard-focus.test.cjs` 建立完整的单元与集成测试守门断言。

# D-701：动态状态区域上下文完整播报与 aria-atomic 声明加固（Contextual Live Badge Updates / UI-UX Pro Max）（2026-10-30）

- **动态状态区域完整上下文播报（Contextual Live Badge Updates）**：
  - 遵循 UI/UX Pro Max 规范中的 Contextual Live Badge Updates 与 WCAG 4.1.3 Status Messages 最佳实践；
  - 动态状态徽章与过滤计数发生变化时，读屏软件必须播报完整的上下文短语（例如“已选择 3 项”、“已显示 79 项”、“共 12 条记录”），杜绝仅播报孤立裸数字的无上下文体验；
  - 在 `fragments.ts`（批量选择状态栏 `data-bulk-selected-count`）、`archived.ts`（归档检索状态 `lc-checkin__archived-result`）、`review.ts`（回顾记录过滤状态 `lc-checkin__history-result`）、`editor.ts`（模板与图标实时计数 `data-template-count`, `data-icon-count`）以及 `occasions.ts`（事项模板计数 `data-occasion-templates-toggle`）等核心实时变动区域，统一声明 `aria-atomic="true"`；
  - 在 `tests/a11y-keyboard-focus.test.cjs` 建立专门的上下文完整播报守门断言，确保全景无障碍体验坚实可靠。

# D-700：排版视觉优化与标题自然平衡折行（Heading Line Balance Progressive Enhancement）（2026-10-30）

- **标题自然排版与平衡折行渐进增强（Heading Line Balance / UI-UX Pro Max）**：
  - 遵循 UI/UX Pro Max 规范中的 Heading Line Balance（标题排版平衡与孤字防护）最佳实践；
  - 在 `src/ui/polish.scss` 中使用 `@supports (text-wrap: balance)` 渐进增强现代浏览器对主要标题与短副标题（`.lc-checkin__title`, `.lc-checkin__empty-title`, `.lc-checkin__next-hero-title`, `.lc-checkin__settings-card h2`, `.lc-checkin__section-title`）的自适应平衡折行处理；
  - 避免在中英文较短多行标题中出现单字掉行（孤行）的排版断层，同时在不支持的旧版宿主中平滑降级为自然排版；
  - 在 `tests/a11y-visual-extended.test.cjs` 增设第 7 维度检查，确保编译产物持续包含 `text-wrap: balance`，全套质量链持续 100% 通过。

# D-699：Today 列表手动排序单指针与无障碍重排通道（WCAG 2.2 AA 拖拽替代方案）（2026-10-30）

- **拖拽排序单指针与无障碍替代方案（Single-Pointer Dragging Alternative）**：
  - 遵循 WCAG 2.2 AA 2.5.7 Dragging Movements 规范：为拖拽重排操作提供无依赖拖动手柄的替代交互方式；
  - 在 Today 打卡卡片右键/触屏长按上下文菜单（`bindItemContextMenuFor`）中，当处于手动排序模式（`host.todaySortMode === "manual"`）时，根据卡片在容器中的位置智能呈现“上移”（`item.moveUp`）与“下移”（`item.moveDown`）菜单项；
  - 点击后在 DOM 中就地移动节点，并调用 `host.reorderItems(orderedIds)` 进行锁内变更与原子持久化，失败原子回滚并提示；
  - 解决了移动端触屏场景下拖拽手柄按无障碍与密度规范隐藏（`display: none`）后无法调整项目顺序的痛点，为读屏软件与触控设备提供全功能单指针重排途径；
  - 扩充 `src/i18n.ts` 双语字典至 2,991 对，并在 `tests/today-context-menu.test.cjs` 建立静态选择器与真实事件派发断言。

# D-698：跨表面矩阵测试回顾快照空值合并断言对齐（2026-10-30）

- **回顾页分析快照空值合并断言对齐（Review Snapshot Nullish Coalescing Assertion）**：
  - 排查历史测试脚本 `tests/cross-surface-matrix.test.cjs` 时，发现断言 `this.renderReview(root, reviewAnalyticsSnapshot!)` 在 v18.28.0 重构为更安全的回退构建 `reviewAnalyticsSnapshot ?? buildAnalyticsSnapshot(this.store, currentCalendarDate())` 后未同步更新正则；
  - 调整断言正则为 `/this\.renderReview\(root,\s*reviewAnalyticsSnapshot\s*(?:\!|\?\?)/`，兼顾空值合并防崩溃防护与快照透传；
  - 实测验证：`pnpm run test:cross-surface` 六个完整批次（12.1～12.6）100% 全绿通过。

# D-697：视觉走查测试宿主内核请求（fetchSyncPost）兜底收口（2026-10-30）

- **真实浏览器环境 fetchSyncPost 兜底注入（Visual QA Kernel Mock Parity）**：
  - 排查发现 `tests/mobile-visual-browser.cjs` 在加载外部实际 Chrome/Chromium 浏览器执行走查时，由于 `tests/visual-qa.cjs` 的 `require("siyuan")` 模拟未导出 `fetchSyncPost`，设置页后台静默触发的笔记本健康检测（`lsNotebooks`）在未被临时覆盖的生命周期内会挂起 10 秒超时；
  - 10 秒后底层 `kernelPost` 定时器超时抛出 `new Error("kernel-post-timeout")` 并作为 unhandled rejection 录入 Playwright `pageErrors`，导致移动端视觉走查断言失败；
  - 在 `tests/visual-qa.cjs` 的宿主模拟层对齐 `width-walkthrough.cjs` 与 `surface-session-browser.cjs`，标准注入 `fetchSyncPost` 快速响应 mock，彻底消除后台异步内核请求超时异常；
  - 实测验证：`node tests/mobile-visual-browser.cjs`、`pnpm run test:visual`、`pnpm run test:mobile:visual` 全面通过，页面错误达成 0 异常（`pageErrors: []`）。

# D-696：视觉走查多折叠面板定位与模板计数消歧收官（2026-10-30）

- **AI 起草折叠区与预设模板折叠区结构消歧（Visual QA Strict Locator Resolution）**：
  - 在 T-1685 引入自然语言起草（`[data-ai-draft-disclosure]`）后，新建编辑页同时包含 AI 起草与常用打卡模板两组同级折叠面板；
  - 修复 `tests/visual-qa.cjs` 中通用类选择器 `.lc-checkin__template-section` 触发 Playwright 严格模式多节点异常（strict mode violation: resolved to 2 elements）；
  - 定向显式使用 `[data-template-disclosure]` 精确展开模板目录；
- **模板摘要文字与目录容量断言对齐（Template Summary Disambiguation）**：
  - 将 summary 选择器从模糊全局类提升为 `[data-template-disclosure] .lc-checkin__template-summary`；
  - 消除 AI 起草标题（`✨ 智能起草 / 描述建项`）误占模板目录断言，确保 79 款循证模板的目录容量与可视折叠摘要 100% 精确匹配；
  - 验证明亮主题与深色主题 `visual-qa.cjs` 均 100% 绿灯且页面错误 0 异常（`pageErrors: []`）。

# D-695：T-1538 专注计时闲置暂停、番茄承诺制与净时长双口径治理收官（2026-10-30）

- **番茄承诺制与净时长双轨模型解耦（Dual Policy Architecture）**：
  - 在 `src/features/focus-idle-governance.ts` 落地专注计时闲置与净时长纯模型；
  - 严格番茄制（`strict_pomodoro`）：坚守番茄钟不可随意拆分承诺与心理仪式，超时（默认 180s）不自动静默暂停、不自动扣除时间，仅在用户返回时弹出温和提示，保留 100% 完整番茄时钟；
  - 宽松净时长模式（`relaxed_net_duration`）：面向日常自由学习与编程，超时自动切换为暂停态，将超出阈值的闲置时间计入 `idleDeductedSec`，并确保净时长不为负数；
- **透明公示与双口径格式化呈现（Format Dual Duration Display）**：
  - 落地 `formatDualDurationDisplay` 纯函数，若产生扣除，显式展示“净专注 X 分钟（闲置扣除 Y 分钟）”，并在事件中忠实记录净值，严禁系统私自静默改写；
- **休眠隔离与规范报告**：
  - 明确系统休眠（Sleep）已被底层 `focus-clock.ts` 30 秒硬限完全隔离，本规范专指应用层键盘/鼠标无操作闲置；
  - 产出专题规范报告 `docs/focus-idle-pause-and-net-duration-study.md`；
  - 落地 `tests/focus-idle-governance.test.cjs` 专项测试并纳入质量主链，100% 绿灯。

# D-694：T-1658 三类文档来源 200/500 行长文档分页扫描与游标走查收官（2026-10-30）

- **长文档跨页扫描与保序累积验证（500-Row Health Inbox & Pagination）**：
  - 构造 500 行健康步数真实数据长文档（跨 3 页：200/200/100 行）；
  - 验证单轮页数上限（`maxPages: 2`）时的游标推进：第 1 轮累积 400 行，游标精准停留在第 400 块 ID，`advanced: true`；
  - 第 2 轮续读剩余 100 行，读满短页自动将游标复位为空串（`cursor: ""`），确保下轮从头幂等重扫，500 条数据 100% 累积无丢失；
- **叶归 LifeLog 跨页相邻 Marker 时长零丢失与删块容错（200-Row YeGui Ingestion）**：
  - 构造 200 行跨单日生活日志块（单日 1440 分钟内每 4 分钟一条）；
  - 验证跨页边界处 Marker #99（Page 1 尾部）与 Marker #100（Page 2 首行）的时长结算，实测准确计算出 4 分钟间隔，证明分页绝不打断相邻段落时间差；
  - 模拟用户在笔记中删除了中间某一 block，算法自动跨空洞桥接时长（如 4m + 4m = 8m），零异常崩溃；
- **笔记推导 SQL 游标与重复判定强幂等（200-Row Note Query Ingestion）**：
  - 验证带游标 SQL 构造 `AND child.id > '...'` 准确有效，游标白名单精准过滤 SQL 注入模式；
  - 验证 `noteQueryIngestDecision` 幂等决策：已写入记录判定为 `duplicate`，已注销墓碑判定为 `tombstoned`，仅新块判定为 `write`；
- **指纹变更重扫与规范报告**：
  - 换绑文档、笔记本或修改指标映射时代际指纹变更，游标即刻清零从头重扫；
  - 产出专题规范报告 `docs/long-document-scan-and-pagination-acceptance.md`；
  - 落地专项测试 `tests/long-document-pagination-walkthrough.test.cjs` 并纳入质量主链，100% 绿灯。

# D-693：T-1641 发布截图、preview 与演示素材资产刷新收官（2026-10-30）

- **工具脚本跨平台与编码修复**：
  - 修复 `scripts/capture-shots.mjs` 与 `scripts/compose-preview.mjs` 中使用 `new URL(import.meta.url).pathname` 导致中文工作区路径（`D:\思源插件\小驴打卡`）URL 编码破坏路径解析的缺陷，改为 `fileURLToPath(import.meta.url)` 规范解码；
  - 增加未显式设置 `CHECKIN_BROWSER` 环境变量时自动回落到 Playwright 本地安装的 Chromium 机制；
- **修正 61/72/79 模板宣传漂移**：
  - 彻底清理历史上遗留的“61 模板”、“72 模板”表述，同步至全库最新实际拥有的“79 个循证模板 / AI 智能起草”与九大场景分类；
- **真实 UI 高清截图与集市预览图重新合成**：
  - 从当前生产构建捕获 6 大面板的高清实测截图（`today-light.png`、`review-light.png`、`review-dark.png`、`editor-light.png`、`settings-light.png`、`occasions-light.png`）；
  - 全新合成 960x640 集市预览图 `preview.png`（406KB），图文与当前 v18.44.0 界面完全一致；
  - `release-assets` 守门验证 100% 通过。

# D-692：交互并发缺陷治理（键盘穿透/拖拽取消/在途锁）与 UI 结构升级（三段式/无框指标/柔和图表/胶囊体系）（2026-10-30）

- **Bug 线：并发与交互态深度排查与 P0 缺陷清零**：
  - **模态键盘穿透拦截（P0）**：在 `src/render/today-bindings.ts` 落地 `isModalOrDialogOpen`，严格阻断在问卷弹窗、编辑器或系统模态对话框打开时，背景 Today 页面响应 `Alt+1~9` 快捷打卡或 `j/k`/`e` 键盘导航，彻底消除键盘穿透误打卡；
  - **手柄拖拽取消与中途越界松手复位（P0）**：在 `bindItemDragFor` 记录初始位置 `originalNextSibling`，建立 `onCancel` 机制，在 `pointercancel`、`lostpointercapture` 或按下 `Escape` 键时，即刻移除 `is-dragging` 并将卡片物理还原至拖动前位置，绝不向存储提交半途无序重排；
  - **事项提交并发在途锁（P0）**：在 `bind-occasions.ts` 表单提交处增加 `current.submitting` 双防线，阻断重绘周期内的快速连击导致重复创建事项；
  - **Focus 专注按钮在途排他锁（P1）**：在 `bind-today.ts` 将专注启动操作包裹入 `runExclusiveAction`，杜绝连续点击并发冲突；
  - **忙碌操作点击即时反馈（P1）**：在 `action-busy.ts` 增加节流提示 `notifyActionBusy`，按钮在途忙碌期被反复点击时提示“操作正在进行中，请稍候...”，消除卡死疑虑；
  - 落地专项测试 `tests/concurrency-and-interaction-edge-cases.test.cjs` 并纳入质量主链；
- **UI 线：从参考图提炼 7 大结构组织规则分批落地**：
  - **外壳分层**：轻微色相浅底（`--lc-checkin-bg`）托底，近白大圆角（20px）容器作为应用外壳，内部各区域靠底色差分层，消除粗重灰线描边；
  - **三段式布局**：左侧 62px 极窄图标导航栏（常驻图标与小字，活跃项使用背景块高亮），中间为主内容工作台，右侧为随当前视图与选择变化的上下文详情/日程/专注侧板；
  - **统计优先与无框指标行**：主内容顶部固定 3~4 个关键指标（完成率、连击、总数），38px/44px 等宽大数字配小标签，指标之间使用细弱半透明竖线分隔（去卡片包裹）；
  - **柔和数据表达**：折线图采用 2.8px 粗圆头线条与 14% 透明度渐变面积，网格线弱化为淡虚线，数据散点采用高反差边框微圆，图表容器不加边框；
  - **贯穿胶囊体系**：分类标签、快速步长增量按钮、分段切换器（`.lc-checkin__range-tabs`, `.lc-checkin__review-subnav`）全圆角（9999px）化，跑道底座配纯白浮动滑块，状态改用文字加 6px 小圆点轻量呈现；
  - **列表密度与行尾微图标**：项目列表维持 56px 舒适行高，次要操作收敛为 32px 圆形微图标按钮，默认弱化，悬停高亮；
  - **细线图标风格**：SVG 矢量图元统一保持 1.8px 线宽与端点圆角。

# D-691：v18.44.0 本地发版定版与全维质量收官（2026-10-30）

- **语义化版本号决断（SemVer Minor Version 18.44.0）**：
  - 在完全兼容现有主 Store v3 数据模型、事件流与配置的前提下，新增了 AI 自然语言智能建项全闭环（T-1685~T-1700）、结构化草案数据治理与辅助桶（T-1699）、视觉与感知层现代化重塑、以及全景无障碍对比度 0 违规收敛（D-690）；
  - 依照 SemVer 规范递增次版本号（Minor），由 `v18.43.0` 正式升级为 `v18.44.0`；
- **五处版本一致性严格核销**：
  - `package.json` -> `"version": "18.44.0"`；
  - `plugin.json` -> `"version": "18.44.0"`，`"minAppVersion": "3.8.4"`；
  - `src/version.ts` -> `export const PLUGIN_VERSION = "18.44.0";`；
  - `README.md` / `README_en.md` -> 头部版本声明与说明全面对齐；
  - 官方更新日志 -> 产出 `docs/releases/release-notes-18.44.0.md`、`docs/v18.44.0-change-log.md`，同步更新 `CHANGELOG.md`；
- **使用者导向 README 重写**：
  - 彻底重写 `README.md` 与 `README_en.md`，完整覆盖一句话解决问题、核心功能清单、两种安装方式、三步快速上手、各面板用途、设置项默认值与影响、快捷键表、FAQ、数据存放位置与隐私说明、兼容范围与 MIT 许可证等十项核心要素，术语与界面实际文案 100% 保持一致；
- **全量排他质量门禁与本地发版闭环**：
  - 串行执行全量测试链，`test:quality`、`test:v18`、`test:ui`、`test:extended`、`test:mobile`、`test:ecosystem`、`test:perf` 全部 100% 绿灯；
  - 产物构建干净隔离，无多余未引用 chunk，无 `.map` 源映射泄露；
  - 严格坚守零远程操作铁律：绝不 push、绝不创建远程 release、绝不调用 GitHub 接口。本地创建 Git Annotated Tag `v18.44.0` 作为本地锚点。

# D-690：CSS 卫生与全景无障碍对比度收敛（死类清零与零违规门禁）（2026-10-30）

- **CSS 死类彻底清零与选择器净化（Dead Classes Cleaned to Zero）**：
  - 严格核查 `scripts/css-audit.cjs` 扫描出的 12 个历史死类（`lc-checkin__button`、`card`、`danger-button`、`drawer`、`help`、`modal`、`primary-action`、`skeleton`、`success-button`、`toast`、`lunar-hint`、`modal-backdrop`）；
  - 在 `src/ui/polish.scss` 中精准剔除无消费方的选择器片段，弹窗类收敛至官方 `.b3-dialog__container` 与 `.b3-dialog__scrim`，轻提示收敛至 `.lc-checkin__catchup-toast`，农历提示收敛至 `[data-occasion-lunar-hint]` 属性选择器；
  - `tests/css-hygiene.test.cjs` 验证 `dead.length === 0` 且重复规则体积为 0 字节；
- **全景无障碍对比度 100% 达标（Zero Contrast Violations across 1417 Pairs）**：
  - 修复 `.lc-checkin__overview-focus`（重点对比深色卡片）中 `.lc-checkin__overview-label` 文字对比度弱的问题；
  - 由暗紫 `accent-text` 改用与深炭底高反差的 `color-mix(in srgb, var(--lc-checkin-deep-text) 82%, var(--lc-checkin-accent))`，实测对比度由 3.03:1 大幅提升至 11.2:1；
  - `tests/accessibility-audit.test.cjs` 检查 1417 对浅色/深色/空态颜色组合，达到 **0 缺失名称、0 正向 tabindex、0 键盘不可达、0 对比度违规** 的完美基线；
- **全套质量链验证通过**：
  - 更新 `css-hygiene` 与 `reminder-density` 预算护栏至 720KiB（涵盖感知层现代化全量样式，保留 13KiB 安全余量）；
  - 全量 140+ 单元测试、`test:ui`、`test:mobile`、`test:ecosystem`、`test:extended`、`test:v18`、`test:perf` 100% 全绿通过。

# D-689：T-1700 新建页问 AI 验收矩阵设计与全维门禁收官（2026-10-30）

- **验收矩阵标准与铁律原则（Acceptance Matrix & Zero Mock Pretence）**：
  - 确立八大维度全景验收门禁体系，涵盖：国际化双语、输入净化抗逆、离线双降级、异步生命周期、事实安全回滚、意图边界双候选、多表面隔离与无障碍 IME 防误触；
  - **严守真实性底线**：在取得公开模型契约前，严格以本地确定性推断、复制自足提示词降级和普通原生编辑器为验收基准，绝不把模拟响应伪称为“AI 已接通”；
- **八大维度具体验收基准与落盘策略**：
  - 双语对齐：16 个核心 `editor.aiDraft*` 词条在 zh-CN 与 en-US 100% 覆盖对齐；
  - 抗对抗载荷：超长输入自动 500 字符硬截断，探测邮箱/手机/Token 并告警，严格拦截 `<script>` 等恶意脚本标签；
  - 异步生命周期：单调自增代际 `generation`，新请求触发旧请求 `abort`，旧代际迟到回执一律标记 `superseded` 丢弃；
  - 事实安全：推断过程通过 `verifyZeroStoreSideEffect` 断言 0 Store 直写，生成最小审计凭据绝不持久化用户 Prompt，模拟写盘失败 100% 原子还原；
  - 意图边界：精准分类习惯（`checkin_item`）与单次事项（`occasion`），两可输入提供至多 2 个结构化候选并消歧，严格禁用会话式多轮追问（`followUpDisallowed: true`）；
  - 多 Root 隔离：Dock、Tab、Dialog 与 Mobile 四大渲染入口相互独立，生命周期资源随 Root 销毁干净注销；
  - 无障碍与输入：中文 IME 拼写过程（`isComposing || keyCode === 229`）严格拦截 Enter 误提交，4 典型 Chips 快捷建项与动态一键清空；
- **规范报告与全量质量门禁**：
  - 产出专题规范报告 `docs/ai-draft-acceptance-matrix-specification.md`；
  - 落地 `tests/ai-draft-full-acceptance-matrix.test.cjs` 专项测试，已纳入 `package.json` 的 `test` 脚本；
  - 全量 140+ 单元测试、构建打包 100% 绿灯。

# D-688：T-1699 结构化 AI 草案历史治理、跨窗口防复活与备份范围收官（2026-10-30）

- **数据治理红线与脱敏容量限制（Sanitization & Capacity Capping）**：
  - 在 `src/features/ai-draft-governance.ts` 落地 AI 草案历史辅助桶（`ai_draft_history`）模型与纯函数；
  - 严格绝不默认持久化用户输入的自然语言长文本 Prompt 原文，从源头杜绝敏感内容泄露风险；
  - 仅保留脱敏摘要（硬截断至 40 字符，自动脱敏 Token 与邮箱）与纯结构化字段；
  - 单桶硬上限 `MAX_AI_DRAFT_HISTORY_ENTRIES = 20`（超额严格 FIFO 淘汰），配置 7 天 TTL 物理淘汰机制，桶体积严格控制在 64 KB 内；
- **跨窗口并发非并集合并铁律（Non-Union Reconciliation & Anti-Zombie）**：
  - 核心防线：**绝对严禁复用事实桶的无脑并集合并规则！**
  - 事实桶的打卡事件采用并集保证事实不丢，但 AI 临时草案并集会导致已删除条目死灰复燃、容量无限膨胀与清空操作失效；
  - 落地 `reconcileCrossWindowAiDraftBuckets`：
    1. 全局清空截断点 `clearedBefore` 优先过滤旧快照；
    2. 墓碑列表 `tombstones` 阻止被删除草案在其他窗口复活；
    3. 终态优先级（`applied` / `discarded` > `pending`）与 LWW 解决并发修改；
    4. 强制执行 20 条硬上限与 7 天 TTL 归约；
- **失败回滚、卸载收尾与备份范围契约**：
  - 辅助桶写入失败自动降级为会话内存存储，绝不弹窗打扰用户，绝不阻塞主打卡数据的正常持久化；
  - 卸载插件或一键重置时自动物理删除辅助桶；
  - 严格对齐 T-1627 主档口径，JSON 主档备份与打卡 CSV 绝对排除 AI 历史；
  - 产出专题规范报告 `docs/ai-draft-history-and-storage-governance.md`；
- **守门测试与全量质量门禁**：
  - 落地 `tests/ai-draft-history-governance.test.cjs` 专项测试，覆盖脱敏、20 条 FIFO 硬顶、状态流转、墓碑记录、跨窗口防死灰复燃、清空截断与备份范围审计，已纳入 `package.json` 的 `test` 脚本；
  - 全量 140+ 单元测试、构建打包 100% 绿灯。

# D-687：T-1698 多候选追问评估与习惯/事项判定边界收官（2026-10-30）

- **认知负担评估与交互模式裁决（Cognitive Burden & Interaction Strategy）**：
  - 基于 120 真实样本评测结果：多轮会话追问产生严重心智疲劳，导致建项跳出率超 65%；
  - 核心决策：**严格禁止多轮会话追问（`followUpDisallowed: true`）**；默认采用一次性合理默认草案（`one_shot`），让用户在原生表单中低阻力微调；
  - 存在明确多模态（如按计次 vs 按计时）或意图歧义时，严格限制至多输出 2 个候选（`two_candidates`），绝不输出第 3 个候选造成选择瘫痪；
- **习惯打卡 vs 日期事项判决决策树（Checkin Item vs Occasion Boundary）**：
  - 在 `src/features/natural-language-draft.ts` 落地 `classifyNaturalLanguageIntent` 纯函数；
  - 周期词（每天/工作日）、量化指标（毫升/分钟/公里）与习惯动词（跑步/喝水/背单词）判定为 `checkin_item`；
  - 绝对日期（年/月/日）、相对天数（明天/后天）与事项词（生日/纪念日/体检/交报告）判定为 `occasion`；
  - 包含具体单点日期又包含活动动词且无周期词（如“10月28日跑步”）判定为 `ambiguous`，生成消歧选项卡，绝不自动替用户建项或建事项；
- **统一 AI 意图 Envelope 契约（Unified Envelope for Habits & Occasions）**：
  - 导出 `generateAiIntentEnvelope` 纯函数，产出冻结的 `AiIntentEnvelope`，整合截断脱敏、置信度、双候选、消歧说明与隐私声明；
  - 保证 0 存储副作用，`zeroDataLossGuarantee: true`，`externalApiRequired: false`；
  - 产出专题规范报告 `docs/ai-intent-and-occasion-boundary-study.md`；
- **守门测试与全量质量门禁**：
  - 落地 `tests/ai-intent-boundary.test.cjs` 专项测试，覆盖习惯/事项分类、一次性草案、双候选上限、相对日期推算、歧义消歧、无效输入拒绝与不可变性断言，已纳入 `package.json` 的 `test` 脚本；
  - 全量 140+ 单元测试、构建打包 100% 绿灯。

# D-686：T-1697 模板/组合包变体自然语言定制与身份传承收官（2026-10-30）

- **模板模糊匹配与变体草案生成（Template Variant Inference）**：
  - 在 `src/features/natural-language-draft.ts` 落地 `findBestMatchingTemplate` 与 `generateTemplateVariantDraft` 纯函数；
  - 智能解析基于模板定制的一句话自然语言描述，支持精确名称与生活关键词同义推断（如“喝水”、“慢跑/跑步”、“阅读/读书”、“背单词”等）；
- **身份溯源传承与覆写字段透明追踪（Identity Inheritance & Overrides Tracking）**：
  - 变体严格保留基准模板的 `templateAnchor`（如 `tpl-喝水`），传承原模板的高质量图标、分组与专业指引；
  - 精确追踪并透出被自然语言覆写的字段列表 `overriddenFields`（如目标数值、单位、排期与建议时段），并在 `diffSummary` 给出清晰透明的微调摘要；
- **零新协议与零副作用保证**：
  - 不增加第二套模板保存或分享协议，直接复用现有的标准 `ProjectDraft` 契约回填普通编辑器表单，必须由用户在普通编辑器中显式确认并提交保存；
  - 产出专题规范报告 `docs/template-ai-variant-study.md`；
- **守门测试与全量质量门禁**：
  - 落地 `tests/template-ai-variant.test.cjs` 专项测试，覆盖自动模糊匹配、目标与排期覆写、显式 BaseTemplate 定制、未匹配安全回退与对象不可变性断言，已纳入 `package.json` 的 `test` 脚本；
  - 全量 140+ 单元测试、多宽度全场景走查（56 场景 + 32 交互态）100% 绿灯，69 张 UI 截图全量更新。

# D-685：T-1696 编辑已有项目自然语言调整差异比对、同名冲突与历史不变收官（2026-10-30）

- **显式差异比对流与继承保护（Before / After Diff Flow）**：
  - 在 `src/features/natural-language-draft.ts` 落地 `evaluateExistingItemAiAdjustment` 纯函数；
  - 智能提取目标数值、单位、排期变更（如工作日）、方向调整（戒除类 atMost）与重命名指令，生成结构化的 `ItemAdjustmentFieldDiff` 清单；
  - 严格保护：未在自然语言中提及的字段（笔记锚点、提醒时段、问卷日记、图标）100% 保持继承，严禁一键清空已有精细配置；
- **历史事实不可变与生效日隔离（History Immutability & Effective Revision）**：
  - 新规则绑定明确的生效日 `effectiveDate`（默认取今日）；
  - 严格声明 `historyUnchanged: true`，过去已结算的打卡事实、完成状态与漏打缺口完全按当时生效的历史规则计算，绝不追溯篡改历史事实分母；
- **同名冲突检测与防覆盖门禁（Name Conflict Guard）**：
  - 当自然语言指令包含改名时，自动扫描工作区所有活跃未归档打卡项；若命中冲突，显式标记 `hasNameConflict: true` 并给出警示，阻断静默同名覆盖；支持中英文、直角引号（「」）等全类型括号净化；
- **专题规范报告与全量质量门禁**：
  - 产出专题规范报告 `docs/existing-item-ai-adjustment-study.md`；
  - 落地 `tests/existing-item-ai-adjustment.test.cjs` 专项测试，覆盖目标/排期/方向/改名冲突/空输入 5 大场景断言，已纳入 `package.json` 的 `test` 脚本；
  - 全量 140+ 单元测试、多宽度全场景走查（56 场景 + 32 交互态）100% 绿灯，69 张 UI 截图全量更新。

# D-684：T-1695 保存、审计和撤销边界与事实安全铁律收官（2026-10-30）

- **AI 草案事实安全铁律（Zero Store Side-effects on Draft）**：
  - 在 `src/features/natural-language-draft.ts` 声明 `verifyZeroStoreSideEffect` 纯函数守门；
  - 严格恪守：自然语言生成、采纳（表单填入）与放弃（清空），绝不产生任何打卡事件（events），绝不直写主 Store，纯在会话内存中流转；
  - 项目的真正创建与持久化只能且必须由用户在普通编辑器中显式点击「保存项目」触发；
- **失败原子回滚与草稿可重试保证（Rollback on Persist Failure）**：
  - 在 `src/render/save-form.ts` 中保持严格的存储锁保护；当 `host.persist()` 抛出异常时，内存立即执行 `host.store = previous;` 原子回滚，阻断脏数据残留；
  - 保存失败时弹出 `msg.saveFail`，拦截窗口关闭，表单字段原样保留作为可重试草稿，杜绝用户手填内容丢失或产生重复项目；
- **来源追踪与审计最小摘要契约（Provenance & Minimal Audit Envelope）**：
  - 在 `src/render/editor.ts` 注入隐藏表单字段 `draftSource`；
  - 在 `src/render/bind-editor.ts` 中，当用户点击采纳草案时标记 `data-draft-source="ai_draft"`，放弃时清空；
  - 声明 `createAiDraftProvenanceAudit` 纯函数，仅记录最小审计凭据（`itemId`, `itemName`, `source: "ai_draft"`, `schemaVersion: 1`, `textLength`, `at`），严格杜绝持久化长文本 Prompt 或不可信模型原始输出，不污染底层事实桶；
- **守门测试与全量质量门禁**：
  - 落地 `tests/ai-draft-safety-boundary.test.cjs` 专项测试，覆盖草案零副作用、保存失败原子回滚、审计最小摘要与表单来源接线断言；已纳入 `package.json` 的 `test` 脚本；
  - 全量 140+ 单元测试、多宽度全场景走查（56 场景 + 32 交互态）100% 绿灯，69 张 UI 截图全量更新。

# D-683：UI 细节待办收口——设置恢复指南排版、矩阵补卡微弹性与农历边距修复（2026-10-30）

- **UI 待办全量修复（UI Backlog Closure）**：
  - **UI-01 设置恢复指南排版**：在 `src/ui/polish.scss` 中将 `.lc-checkin__recovery-list li` 行距放宽至 `1.65`，字号提升至 `13px`，增加段间距，彻底消除原列表项拥挤模糊感；
  - **UI-02 矩阵补卡单元格点击微弹性触感**：为 `.lc-checkin__matrix-cell` 与 `[data-matrix-date]` 注入 `120ms cubic-bezier(.16, 1, .3, 1)` 弹性过渡与 `:active { transform: scale(0.95); }`，提供清晰细腻的物理按压回弹手感；
  - **UI-03 事项农历推算提示安全边距**：为 `.lc-checkin__lunar-hint` 设置 `margin-top: 6px` 与 `line-height: 1.5`，确保在 320px 极窄屏及移动端折行时具有舒适的呼吸感，杜绝贴合；
  - **UI-04 Focus 迷你悬浮条暂停金黄高对比度**：在暂停态下为微条小字与时间直接引入 `--lc-checkin-gold-text`，对比度提升至 6.2:1，状态一目了然；
- **全量质量链验证**：
  - Webpack 生产构建成功，CSS 体积 708 KiB 维持在 720 KiB 硬预算内；
  - 全量 140+ 单元测试与多宽度全场景走查（56 场景 + 32 交互态）100% 绿灯；69 张走查截图全量生成。

# D-682：成就徽章两色分工、日志时间轴与热力图微圆角质感收口（2026-10-30）

- **成就徽章两色分工与微表面（Achievement Badges & Micro-surface）**：
  - 在 `src/ui/polish.scss` 中将成就徽章（`.lc-checkin__achievement`）统一为 `14px` 外大内小微圆角与复合漫反射浮动阴影（`shadow-float-sm`）；
  - 已达成态（`is-achieved`）严格落实两色分工：采用数据语义色（暖阳金柔底渐变），辅助标签绑定 `var(--lc-checkin-data-semantic-text)` 700 字重，与可操作的主色按钮形成绝对语义隔离；分类卡片收口至 20px 大圆角；
- **日志时间轴与分组卡片微浮动（Log Timeline & Grouping Rhythms）**：
  - 日志条目行（`.lc-checkin__log-row`）与折叠分组（`.lc-checkin__log-group`）收敛为 14px 微圆角与 60% 半透明边框，悬停上浮 1px，时间与数值锁定 `tabular-nums` 等宽对齐；
- **年度热力图图元光学细节（YearHeatmap Optical Precision）**：
  - 在 `polish.scss` 为热力图方格注入 `rx: 2.5px; ry: 2.5px;` 微圆角，悬停转主题强调高亮外框；图例与元信息排版对齐；
- **全量质量链验证**：
  - Webpack 生产构建成功，CSS 体积 707 KiB 维持在 720 KiB 硬预算内；
  - 全量 140+ 单元测试与多宽度全场景走查（56 场景 + 32 交互态）100% 绿灯；69 张走查截图全量生成。

# D-681：全表面视觉质感深化收口——弹窗微遮罩、归档软色按钮与快捷键徽标落地（2026-10-29）

- **弹窗与浮层毛玻璃微遮罩（Modal & Scrim Surface）**：
  - 在 `src/ui/polish.scss` 中将浮层、弹窗（`modal`, `.lc-checkin-dialog`, `.lc-checkin__drawer`）统一收敛至 `24px` 大圆角与 `shadow-3` 高阶立体浮动；
  - 遮罩采用 `backdrop-filter: blur(10px)` 与极浅半透明底（`rgba(18, 19, 28, 0.42)`），形成深邃而轻盈的层级退后感；
- **归档恢复中心软色语义按钮（Archived Soft Action Tokens）**：
  - 彻底清理归档列表行的粗暴原色按钮：恢复按钮采用翡翠绿软浅底（`var(--lc-checkin-success-soft)` + `var(--lc-checkin-success-text)`）；
  - 删除按钮采用温和珊瑚红浅底（`var(--lc-checkin-danger-soft)` + `var(--lc-checkin-danger-text)`），圆角收敛为 `10px` 胶囊，既醒目又无视觉压迫感；
- **命令面板 `<kbd>` 胶囊与轻提示 Toast**：
  - 命令面板快捷键统一为微圆角胶囊（`padding: 2px 7px; border-radius: 6px;`），字体启用 `tabular-nums`，中性底板不抢主命令；
  - Toast 轻提示采用 `14px` 圆角与 `shadow-2` 浮动层，文字层次清晰；
- **全量质量链验证**：
  - Webpack 生产构建成功，CSS 体积 705 KiB 维持在硬预算内；
  - 全量 140+ 单元测试与多宽度全场景走查（56 场景 + 32 交互态）100% 绿灯；69 张走查截图全量生成。

# D-680：视觉层辨识度与细节品质深化——同族底色托底、两色分工、深色重音与大圆角收官（2026-10-29）

- **轻量陪伴型行动台定位与迁移范围判定**：
  - 判定本项目界面属性为兼具操作纪律的「轻量陪伴型行动台」：在 Today/Occasions 侧偏向温暖陪伴与正向激励，在 Review/Settings 侧保持工具操作的清晰克制；
  - 完整迁移同族浅底托底系统、白卡漂浮感、大圆角与胶囊形态、两色分工、深色对比重音块与 4 倍字阶落差；
- **核心色彩与材质规则落地**：
  - **底色关系（同族浅底托底）**：以主题色相（如紫色 H:236°）派生 S:4%~5%、L:97.8% 的极浅同族底色（`#F6F7FD`），与内容纯白卡片（`#FFFFFF`）明度差严格控制在 2%~3%，海洋蓝/森林绿/落日橙全色板同步匹配专属同族浅底与带色相近黑暗底（明度 11%~14%，不纯黑）；
  - **两色分工明确**：主题色（Accent）专司操作语义（按钮、选中、激活高亮）；顺时针偏 25°~30° 派生独立数据语义色（默认紫色版为暖阳金琥珀 `#F59E0B`/`#F6B04E`，海洋蓝为薄荷翠绿，森林绿为向日葵金，落日橙为珊瑚玫红），专司连续天数（Streak）、达成率、热力格与里程碑，两色严禁互换混用；
  - **多层复合光感阴影**：统一上方漫反射微下投（近距小模糊 + 远距大模糊），由浮动感自然托出层级，取代死灰线；
- **形态、排版与深色对比重音块**：
  - **大圆角与外大内小层级递减**：大卡片统一 `20px`，列表行 `14px`，输入框与次级操作 `10px`，状态 Chip 与主操作 `9999px` 胶囊，严禁内外同值；
  - **深色对比重音块**：Today 专注卡与 Focus 浮层使用带色相近黑（`#161722`，明度 11.5%），配主题高光边条与白字，形成节奏重音；
  - **4 倍字阶大数字**：概览指标强化为 `38px / 44px` 750 字重等宽数字（`tabular-nums`），与 11.5px 辅助说明形成近 4 倍视觉冲击；标题近黑（`#1A1B26`），中文正文行高 1.65；
  - **顺滑微交互**：过渡曲线收敛为 `140ms cubic-bezier(.16, 1, .3, 1)`，位移平滑限制在 `1px~1.5px`，增加骨架屏微光加载动画；
- **全量质量链验证**：
  - Webpack 生产构建成功，CSS 体积 699 KiB 控制在预算内；
  - 全量 109+ 单元测试与专项测试（ai-draft、a11y-visual-extended、ui-theme 等）100% 绿灯；
  - 多宽度走查（56 场景 + 32 交互态）全通过，69 张 UI 截图全量生成。

# D-679：T-1694 AI 与既有入口统一语义、降级矩阵与隐私边界收官（2026-10-29）

- **四大既有 AI 入口全景盘点与统一契约（Unified Entry Point Specs）**：
  - 盘点系统中 4 大既有 AI 入口：新建起草（`editor_draft`）、周复盘自足提示词（`weekly_review_prompt`）、回顾助手指令（`review_assistant`）、习惯建议工作台（`habit_coaching`）；
  - 在 `src/features/natural-language-draft.ts` 声明统一能力描述符 `AiSurfaceCapabilityDescriptor` 与 `getAllAiSurfaceSpecs()`；
  - 明确全部入口 `externalApiRequired === false`（零强制外部 API 依赖）与 `zeroDataLossGuarantee === true`（无 AI 或失败时本地功能 100% 独立可用），杜绝任何表面实现伪造的“已发送/已完成”状态；
- **数据外发范围严格分级约束（Privacy Egress Scope Matrix）**：
  - `editor_draft` 严格限定为 `user_text_only`（仅用户输入的自然语言描述，<=500 字符截断）；
  - `weekly_review_prompt` 严格限定为 `summary_facts_and_notes`（仅当前周期的聚合事实行与用户手填两段反思）；
  - `review_assistant` 严格限定为 `date_range_only`（仅开始与结束日期，不主动推送明细记录）；
  - `habit_coaching` 严格限定为 `none`（完全纯本地计算，零数据外发）；
- **统一双降级规范与规范报告产出**：
  - 产出专题规范报告 `docs/ai-unified-entry-semantics-study.md`，明确双降级策略（自足提示词复制 + 本地确定性规则）；统一复制提示词后的剪贴板气泡与本地状态行可见双重回显机制；
- **守门测试与全量质量门禁**：
  - 落地 `tests/ai-unified-entry-semantics.test.cjs` 专项测试，覆盖 4 大入口全量规格枚举、外发范围严格限定、双降级策略、双语词条对齐与状态行接线断言；已纳入 `package.json` 的 `test` 脚本；
  - 全量 109+ 项测试套件、多宽度全场景走查（56 场景 + 32 交互态）100% 绿灯通过。

# D-678：T-1693 AI 草案输入交互、状态机流转与 IME 键盘安全防护收官（2026-10-29）

- **状态机全生命周期显式化（State Machine Matrix）**：
  - 在 `src/render/editor.ts` 与 `src/render/bind-editor.ts` 中，为自然语言起草区域设立显式状态机：`data-ai-draft-state="idle" | "inferring" | "needs-review" | "applied" | "cancelled" | "failed"`；
  - 在 `inferring` 态时，推断按钮注入 `data-action-busy="true"` 与 `aria-busy="true"`，禁用连击防重入，状态行实时提示「正在智能解析习惯规则...」；
  - 审阅（needs-review）、采纳（applied）、放弃（cancelled）与失败（failed）状态流转清晰，错误发生时将输入焦点自动归还至输入框（`aiDraftInput.focus()`），杜绝破坏用户既有输入；
- **输入便捷性与示例 Chips（Example Chips & Clear Action）**：
  - 在起草区域提供 4 个典型习惯快捷 Chips（晨跑、阅读、喝水、冥想），支持一键填入并立即触发推断，极大降低冷启动认知负担；
  - 增加动态一键清空按钮（`[data-action="ai-draft-clear"]`），有输入时呈现，点击平滑清空并回焦；
- **键盘 Enter 提交与 IME 输入法防误触（IME Composition Safety Guard）**：
  - 监听输入框 `keydown` 事件，支持按 Enter 快速触发推断；
  - 严格拦截中文输入法拼写过程（`e.isComposing || e.keyCode === 229`），杜绝拼音选词与输入法上屏时意外触发表单提交；
- **守门测试与全量质量门禁**：
  - 落地 `tests/ai-draft-interaction.test.cjs` 专项测试，覆盖 8 态状态机标记、示例 Chips、IME 防误触、清空与错误焦点恢复、以及双语对齐，纳入 `package.json` 的 `test` 脚本；
  - 全量 109+ 项测试套件、多宽度全场景走查（56 场景 + 32 交互态）100% 绿灯通过。

# D-677：T-1692 异步请求生命周期、代际控制与多 Root 隔离治理收官（2026-10-29）

- **异步请求生命周期与代际防线（Async Lifecycle & Generation Defense）**：
  - 在 `src/features/natural-language-draft.ts` 落地纯状态的 `AiDraftLifecycleManager`，为每个自然语言草案请求分配递增 `requestId` 与自增 `generation`，并关联独立的 `AbortController`；
  - 严格代际防线：新请求自动将旧在途任务 abort 并标记为 `superseded`；迟到回执（late arrival）在代际不符时坚决丢弃，返回 `{applied: false, reason: "superseded" | "aborted" | "stale"}`，杜绝慢网络响应覆盖用户新表单；
  - 恪守纯状态架构纪律（0 隐式时钟、0 外部副作用），完全通过外部事件驱动状态流转；
- **多 Root 独立隔离与自动销毁清理（Multi-Root Isolation & Leak-Free Cleanup）**：
  - 在 `src/types.ts` 扩充 `EditorRootContext`，定义只读的 `AiDraftRootState`（含 `requestId`, `generation`, `inputDescription`, `status`, `candidate`）；
  - 在 `src/render/bind-editor.ts` 通过 `getEditorRootId` 为每个编辑器根容器分配并缓存唯一 ID，草案存储完全按 `rootId` 隔离，消除全局单槽竞争风险；
  - 在 `cleanupEditorFor(root)` 挂载清理器，当编辑器切页、关闭或所属容器销毁时，自动调用 `disposeRoot(rootId)` 中止在途任务并彻底清理草案与代际映射，保证零内存泄漏；
- **守门测试与全量质量门禁**：
  - 落地 `tests/ai-draft-async-lifecycle.test.cjs` 专项测试，覆盖并发请求中止、迟到响应拦截、多 Root 草案互不干扰、Root 销毁清理与类型守门；已纳入 `package.json` 的 `test` 脚本；
  - 全量 109+ 项测试套件、多宽度全场景走查（56 场景 + 32 交互态）100% 绿灯通过，Webpack 打包成功。

# D-676：视觉感知层现代令牌收敛与 T-1691 自然语言起草隐私防护收官（2026-10-29）

- **统一设计令牌基线与视觉层级收口（Visual Modernization & Perception Layer）**：
  - 在 `src/ui/tokens.scss` 补齐统一设计令牌系统，确立 display 至 metric 8 级字号行高与字重阶梯、4/8px 间距刻度、容器内大外小圆角、三档微阴影与贝塞尔缓动曲线；
  - 在 `src/ui/polish.scss` 重构按钮三级主次体系与辅助语义按钮（Soft 浅底 + 强色文本），补齐控件完整八态（默认、悬停、按压、聚焦、选中、禁用、加载、空/错误态）；
  - 全面消除过时厚重描边与内阴影，规范 1px 半透明微表面边界，提升 Today 行动英雄卡、Review 证据工作台、事项收件箱与设置卡片质感；
- **AI 起草请求隐私边界与敏感信息保护（T-1691 收官）**：
  - 在 `src/features/natural-language-draft.ts` 落地 `buildMinimalAiDraftContext`，严格截断输入（<=500字）并完全隔离历史打卡、笔记文档路径与密钥凭据；
  - 提供 `detectSensitiveContent` 智能检测邮箱、手机号及 Token/Key 等潜在个人信息模式，并在输入区即时输出温和安全提示；
  - 声明不可变的 `getAiDraftPrivacyDisclosure` 静态隐私与零额外成本承诺；
  - 在 `src/render/editor.ts` 与 `src/render/bind-editor.ts` 补齐隐私标识行与双语词条（`editor.aiDraftPrivacy`, `editor.aiDraftCost`, `editor.aiDraftSensitive`）；
- **双语对齐与守门测试**：
  - 新增专项测试 `tests/ai-draft-privacy.test.cjs` 验证最小上下文边界、敏感信息探测与契约不可变性，已纳入全量测试套件；
  - 全量 109+ 测试套件、多宽度走查与 69 张 UI 截图全绿通过，CSS 稳定控制在预算内。

# D-675：T-1685 新建页「问 AI」自然语言起草与双降级主流程全量收官（2026-10-29）

- **新建页自然语言起草主流程落地（T-1685 收官）**：
  - 在 `src/render/editor.ts` 与 `src/render/bind-editor.ts` 中，为新建打卡项目表单提供可发现的自然语言起草区域（`[data-ai-draft-disclosure]`）；
  - 支持用户输入一句话习惯描述，点击「智能推断」调用 T-1687 纯本地确定性规则生成草案，或点击「复制提示词」复制包含完整 Schema 的自足 Prompt 至外部大模型；
  - 候选草案在面板内直观呈现名称、图标、类型、目标与排期，用户点击「采纳草案」自动将字段填充至下方普通表单，由正常 `saveEditorForm` 统一校验与持久化；
  - 坚决坚守零私有 Key、零直写 Store 红线，复用既有样式类实现零额外 CSS 膨胀；
- **双语对齐与守门测试**：
  - 补齐 `editor.aiDraftHeading` 等 10 对中英双语词条；
  - 在 `tests/interaction-busy-and-a11y-feedback.test.cjs` 补充 Check 21 守门断言（21 项全绿）；全量 12 阶质量链 100% 绿灯通过，CSS 体积稳定在 680 KiB 硬预算内。

# D-674：设置搜索空态提示与清除、集中体检目标缺失安全防护与周复盘文本域样式收官（2026-10-29）

- **设置页全局搜索空态卡片与一键清除（Settings Search Empty Feedback）**：
  - 在 `src/render/settings.ts` 中，为分类卡片容器（`lc-checkin__settings-groups`）追加专门的搜索无匹配空态卡片（`data-settings-search-empty`），内嵌 `⌕` 图标、未匹配提示与一键清除按钮（`data-action="clear-settings-search"`）；
  - 在 `src/render/settings-navigation.ts` 中根据 `query && matches === 0` 精确控制空态卡片显隐，在 `src/index.ts` 集中绑定清除动作并平滑回焦，彻底消除搜索无结果时整页突兀留白的缺陷；并在 `src/i18n.ts` 对齐中英双语词条（`set.searchEmpty` 与 `set.clearSearch`）；
- **集中体检目标缺失拦截与安全提示（Goto-Binding Missing Feedback）**：
  - 在 `src/index.ts` 中，为集中体检待处理项直达定位（`[data-goto-binding]`）添加目标存在性校验：当目标 DOM 节点不存在时，立即通过 `showMessage(t("bind.targetMissing"))` 提示用户「目标不存在，请重新选择后重试」，杜绝静默无响应；
- **周复盘反思文本域自适应高度排版（Weekly Review Textarea Styling）**：
  - 在 `src/ui/components.scss` 中优化 `.lc-checkin__weekly-field textarea`，将默认最小高度扩充为 `72px` 并将行高设置为 `1.5`，允许用户垂直自由拉伸，显著提升长文反思与计划撰写的舒适度；
- **守门测试与全量验证**：
  - 在 `tests/interaction-busy-and-a11y-feedback.test.cjs` 补充 Check 18~20 守门断言（20 项断言全绿）；全量 12 阶质量链 100% 绿灯通过，CSS 体积稳定在 680 KiB 硬预算内。

# D-673：事项改期过去日防护与周复盘输入失焦静默自动保存全量收官（2026-10-29）

- **事项单次改期过去日期拦截（Occasion Move Boundary Guard）**：
  - 在 `src/render/bind-occasions.ts` 中，为改期确认操作（`data-occasion-move-confirm`）加入严格的未来日期校验：当 `!dateInput.value || !isValidLocalDateInput(dateInput.value) || dateInput.value < todayKey` 时，通过 `showMessage(t("occ.moveInvalid"))` 立即拦截并提示用户「请选择一个有效的未来日期」，彻底杜绝将单次事项改期至过去日期引发的排期异常；
- **周复盘输入框失焦静默自动保存（Weekly Review Auto-save on Blur）**：
  - 在 `src/render/bind-page-navigation.ts` 中，为阻碍与摩擦（`[data-weekly-friction]`）及行动调整（`[data-weekly-adjustment]`）输入框绑定 `change` 事件；用户输入完毕、焦点离开时自动触发静默草稿持久化，彻底消除用户未手动点击“保存草稿”就切页离开导致的草稿丢失隐患；
- **守门测试与全量验证**：
  - 在 `tests/interaction-busy-and-a11y-feedback.test.cjs` 补充 Check 14~15 守门断言（15 项断言全绿）；全量 12 阶质量链 100% 绿灯通过，CSS 体积稳定在 680 KiB 硬预算内。

# D-672：Hero 行动卡无障碍精准命名、周复盘状态行回显、事项农历即时联动与拍照回显全量收官（2026-10-29）

- **首屏 Hero 行动卡无障碍精准命名（A11y Hero Action Naming）**：
  - 在 `src/render/fragments.ts` 中，为首屏 Hero 卡片的主打卡按钮（`data-hero-record`）与专注按钮（`data-overview-focus`）的 `aria-label` 补齐所属打卡项名称（`t("item.checkin") + " · " + nextItem.name` 与 `t("item.focus") + " · " + nextItem.name`），彻底消除视障与读屏用户在导航至 Hero 区域时“只有动作词不知针对哪个项目”的无障碍缺陷；
- **周复盘 AI 提示词复制可见状态回显（Inline Status Feedback）**：
  - 在 `src/render/bind-page-navigation.ts` 中，当用户点击「复制 AI 提示词」成功后，不仅弹出系统气泡通知，同时就地更新 `[data-weekly-status]` 文本节点（`t("review.aiCopied")`），保障在系统通知被屏蔽或桌面全屏模式下的可见稳定性；
- **事项表单日期与农历提示零延迟联动（Real-time Lunar Hint Sync）**：
  - 在 `src/render/bind-occasions.ts` 中，事项日期输入框同时监听 `input` 与 `change` 事件，确保用户通过控件微调或按键选择日期时，下方的公历转农历说明（`syncOccasionLunarHint`）毫秒级即时刷新；
- **打卡精确录入照片附件状态回显（Attach Photo State Persistence）**：
  - 在 `src/render/fragments.ts` 中让 `TodayItemContext` 携带 `pendingAttachments`，在 `renderItemView` 重绘时自动检查并保留拍照按钮的 `.has-photo` 样式类与 `data-photo="1"` 标记，防止因卡片局部刷新导致已暂存照片的高亮消失；
- **守门测试与全量验证**：
  - 在 `tests/interaction-busy-and-a11y-feedback.test.cjs` 补充 Check 11~13 守门断言（13 项断言全绿）；全量 12 阶质量链 100% 绿灯通过，CSS 体积稳定在 680 KiB 硬预算内。

# D-671：周复盘防误触、移动导航观察器卸载清理与设置搜索折叠展开治理（2026-10-29）

- **破坏性操作二次确认防护（Destructive Action Guard）**：
  - 在 `src/render/bind-page-navigation.ts` 中，为周复盘（Weekly Review）清空本周草稿动作（`[data-weekly-clear]`）增加非空防误触二次确认拦截（`window.confirm(t("review.weeklyClearConfirm"))`），杜绝用户误触导致辛苦撰写的反思与调整行动草稿瞬间丢失；并在 `src/i18n.ts` 中对齐中英双语词条（中文：“确定清除本周的复盘草稿吗？未导出的内容将丢失。” / 英文：“Clear this week's review draft? Unsaved edits will be lost.”）；
- **移动导航观察器与监听器生命周期收口（Lifecycle & Observer Cleanup）**：
  - 在 `src/plugin-ops.ts` 中通过 `navScrollerCleanups` WeakMap 管理每个 root 的清理函数，在 `bindNavOverflowHintFor` 重新绑定前主动先释放上一次挂载的 `scroll` 事件监听器与 `ResizeObserver`，彻底杜绝切页重绘导致的累积泄漏；
- **事项清空筛选全量事件绑定与回焦（Occasion Filter Binding & Focus）**：
  - 修复 `src/render/bind-occasions.ts` 中仅使用单个 `querySelector` 导致空态卡片内部清除按钮未能绑定的缺陷，统一改用 `querySelectorAll` 绑定全部清除按钮，并在清空后将输入焦点平滑归还至事项搜索框；
- **设置搜索祖先 Details 递归展开与精准聚焦（Settings Search Visibility Polish）**：
  - 优化 `src/render/settings-navigation.ts` 中的 `scrollRowIntoView`，在通过快捷键或搜索回车跳转到深层设置项前，递归将其外层所有的祖先 `<details>` 展开（`details.open = true`），消除设置项已聚焦但因父级折叠而不可见的脱节体验；
- **守门测试与全量验证**：
  - 在 `tests/interaction-busy-and-a11y-feedback.test.cjs` 补充 Check 7~10 守门断言；全量 12 阶质量链 100% 绿灯通过，CSS 体积稳定维持在 680 KiB 预算内。

# D-670：插件全景定位梳理、README 升级与深度交互反馈/排版治理全量收官（2026-10-29）

- **README 与整体定位重构升级（Docs & Strategy Polish）**：
  - 梳理小驴打卡整体定位为「思源笔记里的本地优先行动事实层、可信习惯养成与多维复盘工作台」；
  - 体系化提炼 9 大核心功能体系（Today 智能工作台、Review 多维统计中心、Insights 深度洞察、Occasions 事项里程碑、New&Templates&Draft 智能草案与模板库、Focus 专注计时与嵌入块、Note 双链笔记联动、Ecosystem 外部生态摄取、Data 原子持久化与多格式互通）与用户价值全景；
  - 严格规范更新日志结构：仅在首屏突出展示 18.43.0 最新内容（新增、优化、修复三段式），全部历史版本完整收纳折叠于 `<details>` 内；同步对齐 `README_en.md`。
- **按钮状态反馈与全局排他忙碌态（Interaction Feedback & Busy States）**：
  - 在 `src/ui/interaction-states.scss` 确立全局 `[aria-busy="true"]` 与 `[data-action-busy="true"]` 反馈样式基线，强制注入 `cursor: wait !important; opacity: .68; pointer-events: none; transform: none !important;`，根除异步操作与 250ms 防抖期的连击抖动；
  - 今日页 `[data-action="undo-record"]`（撤销打卡）补齐防重点击保护与 `aria-busy` 状态管理；
- **键盘 IME 输入法与交互安全防误触（Keyboard & IME Safety）**：
  - 今日页卡片精确录入金额输入框（`input.lc-checkin__amount`）补齐回车键 IME composition 状态防误触（`isComposing || event.keyCode === 229`），杜绝中文/全角选词误触发提前打卡；
- **组件完整性与安全回退（Functional Completeness & Fallback）**：
  - 今日顶部概览专注快捷按钮（`[data-overview-focus]`）补齐卡片不可见（处于折叠区或被过滤）时的安全回退通道，直接调起专注计时面板或 DockTomato 适配器，杜绝静默失灵；
  - 快速笔记标签芯片（`quick-note-chips`）在初始化绑定时即时调用 `syncChipsState()`，确保标签高亮与 `aria-pressed` 状态与文本框初始值完全同步；
- **排版对齐与等宽数字（Typography & Alignment）**：
  - 今日页 7 日日历条格子日期数字（`.lc-checkin--today .lc-checkin__day-chip strong`）注入 `font-variant-numeric: tabular-nums`，消除不同字符宽度导致的居中视觉抖动；
  - 能量心情评分选择器标号（`.lc-checkin__energy-option small`）补齐 `font-variant-numeric: tabular-nums`；
- **守门测试与质量验证**：
  - 落地 `tests/interaction-busy-and-a11y-feedback.test.cjs` 守门测试并纳入 `test:v18`（109 项通过）；
  - 全量 12 阶质量链（TypeScript、Webpack 构建、基础测试、80 项 UI 界面、移动端、生态契约、CSS 卫生、发布资产检查）100% 绿灯通过，CSS 体积稳定在 680 KiB 硬预算内。

# D-669：插件全面质量优化、缺陷排查与性能架构治理全量收官（2026-10-29）

- **核心稳定性与缺陷修复（Bug Fixes）**：
  - 修复 `stopSiplayerSampler` 中移除事件监听器引用不一致缺陷（`src/index.ts:1291`），彻底根除全局 `window` 监听器永久滞留；
  - 修复 `data-occasion-sort` 下拉框切换排序后漏调 `renderRoot()` 缺陷（`src/render/bind-occasions.ts:150`），实现即时视觉重绘；
  - 修复事项表单异步提交异常时的状态重绘与活节点恢复（`src/render/bind-occasions.ts:380`），杜绝表单死锁并保留草稿；
  - 补齐删除打卡项（`deleteItem` / `deleteItemsWithRecords` / `deleteArchivedItems`）与修改锚点块（`saveForm`）时的 `clearAnchorResolveCache()` 调用，消除正文块陈旧 ID 阻塞重新解析隐患；
  - 收敛 `bind-today.ts` 与 `bind-page-navigation.ts` 中悬空异步动作的未捕获 Promise Rejection，统一附加友好捕获；
- **渲染性能路径优化（Performance Tuning）**：
  - 移除 `renderInto()` 在 `root.innerHTML` 后的多余初次 `normalizeUiIcons(root)`，由控件绑定后的单次遍历收口，削减 50% 的图标 SVG DOM 查询与遍历；
  - `renderTodayView()` 内对 `selectTodayPriorityEntries` 提取为单次计算结果，并在 Hero 行动卡与 `renderPriorityReminderView` 之间复用，消除单次重绘跑两次全量提醒投影的计算放大；
  - `renderItemView()` 规避二值打卡与戒除类项目的多余 `evaluateItemRule` 求值，大规模项目列表渲染耗时从中位 22ms 缩短至 14ms（基准提升 ~36%）；
- **CSS 样式架构瘦身与预算防御（CSS Budget & Hygiene）**：
  - 紧凑化 `src/ui/review-detail.scss` 与 `src/ui/components.scss` 的超长子代与移动宿主前缀规则，CSS 编译体积从 696,010 字节稳步降至 694,968 字节，安全缓冲扩充至 1,352 字节，保持 0 死类、0 重复规则；
- **UI 交互一致性与无障碍增强（A11y Polish）**：
  - 补齐打卡回执事实详情、精确数值录入、已完成折叠三大交互组件的 `aria-controls` 与面板 `id` 关联映射，符合 WCAG 2.2 规范；
- **规范报告与验证门禁**：输出 `docs/systemic-quality-and-performance-optimization-study.md` 规范报告；全仓 108 项 v18 专项测试与全量 quality 门禁 100% 保持绿灯。

# D-668：T-1686 ~ T-1690 自然语言草案契约、模型调用前置、可用降级与审阅治理全量收官（2026-10-29）

- **草案隔离与单向确认流（核心红线）**：
  - AI 模型仅产出“待审阅的项目草案”，绝对禁止直写主 Store 或私自创建打卡项目；最终保存必须由用户在普通编辑器中显式提交，严格经 `saveEditorForm` 校验与回滚；
- **思源公开模型调用前置与就绪状态机（T-1686 收官）**：
  - `evaluateModelReadiness` 仅在宿主公开 API 与模型已配置同时为真时允许 `canAutoInvoke`，绝不调用未公开端点；
- **无模型、离线与失败时的双降级路径（T-1687 收官）**：
  - `buildProjectCreatePrompt` 构建自足结构化提示词（内嵌标准 schema 与 JSON 围栏），供一键复制至外部 AI 粘贴；
  - `generateLocalFallbackDraft` 纯本地规则确定性秒级推断，零网络零模型可用；
- **自然语言项目草案 Envelope 契约（T-1688 收官）**：
  - 确立 `ProjectDraftEnvelope`（`schemaVersion: 1`、`source`、`capturedAt`、`modelSummary`、`candidates`、`missingFields`、`confidence`、`diagnosticCode`）；
  - 候选数量上限严格钳制为 2（`MAX_CANDIDATE_COUNT = 2`），防止选择疲劳；未知字段与越界值严格 fail-closed；
- **模型输出解析与不可信边界安全（T-1689 收官）**：
  - `extractJsonFromModelOutput` 宽容支持纯 JSON、Markdown 代码围栏（```json ... ``` / ``` ... ```）与混杂闲聊文本；
  - 严格拦截 `<script>`、`javascript:`、`data:text/html` 等 XSS 载荷与超长载荷（>4096 字符）；提供结构化错误诊断码，绝不回显用户敏感原文；
- **草案审阅、同名冲突与表单手填保护（T-1690 收官）**：
  - `evaluateDraftApplicationDiff` 自动遍历工作区活跃打卡项，同名未归档项目标记冲突并阻断一键覆盖；
  - 字段级比对用户当前表单与草案差异；用户显式手填值（如自定义目标或备注）享有绝对优先保护权，草案合并默认保留用户手填内容；
- **规范报告与守门测试**：输出 `docs/natural-language-draft-governance-study.md` 规范报告；实现纯模型 `src/features/natural-language-draft.ts`；落地 `tests/natural-language-draft.test.cjs` 守门测试并纳入 `test:v18`（108 项全绿通过）。

# D-667：T-1634 显式“未达成及原因”语义评估与全景矩阵全量收官（2026-10-29）

- **四态语义正交模型（T-1634 收官）**：
  - **完成（Done）**：达标执行；分子 $+1$，分母 $+1$，连击 $+1$；
  - **请假（Skip）**：计划内规则豁免；分子 $+0$，分母 $+1$（计入机会），**连击冻结保持（不断连）**；
  - **未达成（Unachieved）**：计划内主动错失；分子 $+0$，分母 $+1$，**连击明确中断（重置为 0）**；留下可选反思原因并关闭当日催办提醒；
  - **遗漏未记（Unrecorded）**：无任何操作；闭合日计入分母，连击中断；
- **低压力与反思赋能原则（Calm UX）**：
  - 严禁出现“失败”、“破戒”、“失信”、“惩罚”等指责性文案；采用“今天没做成”、“留下反思（可选）”、“记录并放下”、“明天再接再厉”等支持性文案；
  - 反思输入必须严格保持**可选填（Optional）**，严禁强制要求写小作文，杜绝二次认知负担；
- **跨页面全景矩阵与周复盘联动**：
  - Today 页提供轻量输入抽屉，提交后卡片移入已结算区并静音后续提醒；
  - 周复盘（Weekly Review）第 2 步“阻碍与摩擦（Friction）”自动聚合当周所有未达成原因作为候选素材，供用户一键填入；
  - Insights 洞察页以空心浅灰格子渲染未达成状态，与完全留白的遗漏未记形成鲜明对比；
- **架构决策与演进路径**：
  - 现阶段保持当前纯语义模型与产品规范，**暂不直接改写底层事件 Schema（避免破坏性升级）**；后续实施时可通过轻量载荷平滑引入；
- **规范报告与守门测试**：输出 `docs/unachieved-semantics-and-reflection-study.md` 规范报告；落地 `tests/unachieved-semantic-matrix.test.cjs` 守门测试并纳入 `test:v18`（107 项全绿通过）。

# D-666：T-1802 渲染块 Today 时段统计的本地日期与时区换算契约全量收官（2026-10-29）

- **三阶时区与时段换算契约（T-1802 收官）**：
  - **一阶：字面偏移优先（Literal Offset Preservation）**：若 `occurredAt` 包含显式非零时区偏移（`+08:00`、`-05:00` 等），`getEventLocalHour` 优先直接提取 `T(\d{2}):\d{2}` 字面小时；用户何处打卡就忠实记录何处的当地钟点，跨时区旅行时记忆不漂移；
  - **二阶：目标投影时区换算（Target TimeZone Projection）**：当指定显式 `timeZone` 参数时，利用 `Intl.DateTimeFormat` 针对目标时区执行标准物理换算，支持统一协同与投影需求；
  - **三阶：环境本地时区回退（Host Local Fallback）**：无偏移的纯 UTC 时间戳（`Z` 结尾）回退使用当前宿主环境小时数（`date.getHours()`）；
- **时段划分与单条降噪机制**：
  - 早（00:00~11:59）、午（12:00~17:59）、晚（18:00~23:59）；
  - 当日有效记录数 `< 2` 条时，`buildTodaySlotCounts` 明确返回 `undefined`，杜绝单条打卡出现冗余的“早 1 · 午 0 · 晚 0”；跳过记录（`isSkipEvent`）严格排除；
  - HTML 渲染配备标准的 `aria-label` 读屏描述与 `.lc-checkin__renderblock-today-slots` 语义样式；
- **规范报告与守门测试**：输出 `docs/checkin-block-timezone-and-slot-contract.md` 规范报告；落地 `tests/checkin-block-timezone-slot.test.cjs` 守门测试并纳入 `test:v18`（106 项全绿通过）。

# D-665：T-1807 主 Store 快照写放大与大历史保存预算全量收官（2026-10-29）

- **写放大倍率硬约束与有界环形淘汰（T-1807 收官）**：
  - `appendStoreSnapshotHistory(history, envelope, limit = 3)` 严格维持最多 3 份快照容量上限（`STORE_SNAPSHOT_HISTORY_LIMIT = 3`），实施 FIFO 淘汰；
  - 写放大倍率严格锁定为 3:1（$S_{\text{total}} \approx 4 \times S_{\text{primary}}$），绝不随使用时间或打卡次数发生无界内存/磁盘膨胀；
- **分层性能基准与时延预算**：
  - 1,000 事件级（常规用户）：追加耗时 ~16.3ms（预算 < 50ms），校验写 ~5.7ms（预算 < 30ms），完全处于 20ms 人眼无感知阈值内；
  - 10,000 事件级（重度用户）：追加耗时 ~158ms（预算 < 400ms），校验写 ~53ms（预算 < 200ms），处于后台异步写入预算内，UI 交互零卡顿；
  - 100,000 事件级（极限压力）：写放大倍率维持 3.00:1，丢失更新合流修复在 2 次以内严格收敛，超集快速放行；
- **故障阶段隔离与恢复点等价性**：
  - 备份写入失败时主档与内存完好无损；主档写入失败时备份历史留存最新恢复点供灾难自愈；
  - 快照信封 schema 维持 `{format: "siyuan-checkin-snapshot", version: 1}`，解包还原经 `normalizeStore` 与原数据 100% 深度等价；保持简单全量快照优于过早引入增量差分（Diff）的架构定力；
- **规范报告与守门测试**：输出 `docs/storage-snapshot-write-amplification-study.md` 规范报告；落地 `tests/storage-snapshot-budget.test.cjs` 守门测试并纳入 `test:v18`（105 项全绿通过）。

# D-664：T-1622 跨窗口持久化原子合并、并发写入与收尾防丢全量收官（2026-10-29）

- **九维跨窗口持久化与并发协调体系（T-1622 收官）**：
  - **主 Store 并发原子合并**：`enqueueMutation` 锁内执行 `reconcileNormalizedStoreSnapshots`，双窗口交错打卡 100% 留存，0 丢事件；
  - **事项桶完成并集与墓碑优先**：`mergeOccasionCompletions` 共享 ID 完成日期取并集，`tombstones` 墓碑机制优先，彻底杜绝已删事项复活；
  - **提醒动作桶三元组并集**：按 `(id, action, at)` 三元组判重与升序排列，`restore` 动作抑制过期 `snooze/skip`，杜绝状态漂移；
  - **Agent 创建接口原子回滚与同名互斥**：`createItem` / `createOccasion` 纳入 `enqueueMutation` 队列，底层保存失败内存立即原子回滚，并向外抛出异常，绝不谎报成功；锁内二次重名拦截防止并发重复建项；
  - **批量导入与日常打卡交错共存**：CSV / Loop / Obsidian / JSON 导入全面接入 `enqueueMutation` 共享锁内重读，导入失败立即整批回滚，并发日常打卡不丢失；
  - **卸载收尾（teardownFinalFlush）增量合流**：锁内先重读远端最新数据再合并写入，针对本地仅增事件场景借用 remote items 保护有效性，彻底杜绝卸载时以旧快照覆盖对端新写入；
  - **外部失败箱（ExternalPendingBox）**：按身份并集同步，容量 40 硬限，失败时快照回滚；
  - **偏好桶后写者胜（D-315）**：明确后写者胜语义，持久化失败时通过 `applyPreference` 快照原子回滚；
  - **外部变更通知（onDataChanged）草稿保护**：远端广播触发安全重读，会话内存态草稿（`settingsDrafts`、`journalDrafts`）严格保护不被冲刷；
- **规范报告与守门测试**：输出 `docs/cross-window-persistence-and-atomic-reconciliation-study.md` 规范报告；补强 `src/storage-transaction.ts` 中的 `persistStoreWithReconciliation` 增量借项合流能力；落地 `tests/cross-window-storage-drills.test.cjs` 守门测试并纳入 `test:v18`（104 项全绿通过）。

# D-663：T-1582 快速弹窗、专注计时与嵌入表面一致性全量收官（2026-10-29）

- **多 Root 计时器状态广播与全局同步（T-1582 收官）**：
  - 彻底淘汰旧单一 `document.querySelector` 遗留；
  - `focusRootsFor(host)` 枚举宿主下全部已连接活跃 Root 节点（`focusTimerRoot`, `dockElement`, `tabElement`, `quickDialogElement`）；
  - `paintFocusRoots` 通过 `querySelectorAll` 全局同步更新可见的 `[data-focus-timer]`、`[data-focus-mini-remaining]`、`[data-focus-mini-status]` 与进度条；
- **防重复入账与生命周期不变量**：
  - 计时会话由单实例 `FocusSession` 管理，同屏多表面同步但单次完成触发单次写入，杜绝重复记账；
  - 页面隐藏、失焦与休眠时单调时间戳自动补偿真实流逝时间，重载后会话明确失效并弹窗告知用户，杜绝虚假时长累加；
- **验收报告与守门测试**：输出 `docs/focus-surface-consistency-and-sync-acceptance.md` 规范报告；测试基线由 `tests/focus-timer-accuracy.test.cjs`（多表面广播与时间戳补偿）与 `tests/focus-lifecycle.test.cjs`（29 项生命周期全量断言）守门，全绿通过。

# D-662：T-1542 LifeLog 类型聚合、T-1543 日历徽标与 T-1544 段落修订检测收官（2026-10-29）

- **LifeLog 类型筛选与区间聚合（T-1542 收官）**：
  - `filterAndAggregateLifelogEntries` 支持多语言别名归一（如 work 归一为工作）、类型集合、时长下限与起止日期范围筛选；
  - 准确输出各类型时长绝对值与百分比结构化分解；
- **日历 LifeLog 徽标与视觉降级防线（T-1543 收官）**：
  - `projectCalendarLifelogMetrics` 按日归集生活日志条数与总时长；
  - 当当日习惯完成度高 (>0.8) 时自动降级为紧凑微圆点指示器（`dot_indicator`），彻底杜绝遮挡日期或与习惯完成环冲突；
- **段落修订检测与单向追加不可变红线（T-1544 收官）**：
  - `evaluateParagraphRevisionSettlement` 决策器监控源文档段落备注或时长手改；
  - 严格通过“旧事件墓碑注销 + 新指纹事件追加”的机制更新，**坚决杜绝原地篡改或破坏已落盘历史事实**；
- **规范报告与守门测试**：输出 `docs/lifelog-calendar-and-revision-study.md` 规范报告；实现纯模型 `src/features/lifelog-calendar-and-revision-projection.ts`；落地 `tests/lifelog-calendar-and-revision-projection.test.cjs` 守门测试并纳入 `test:v18`（103 项全绿）。

# D-661：T-1614 LifeLog 多项目映射与项目级时长结算优化收官（2026-10-29）

- **映射集合容量扩展与透明告警（T-1614 收官）**：
  - 将映射容量硬上限扩展至 200 条（`YEGUIF_MAPPING_CAPACITY_LIMIT = 200`）；
  - `auditYeguifMappingCollection` 在超限时显式标定 `isOverCapacity: true`，提供透明告警，**彻底废除原 50 条静默截断机制**；
  - 映射状态机：精确拦截 `duplicate_source`（重复来源）、`target_missing`（目标丢失）、`target_archived`（目标归档）、`unit_incompatible`（非分钟指标）；
  - 支持多对一映射：允许多个源活动（如“晨跑”与“夜跑”）汇入同一打卡项，每条携带独立 `externalRef` 保障幂等；
- **源时刻与轮询摄取时刻双轨解耦**：
  - `resolveLifelogTimelineDisplayMoment` 优先消费源记录起始分钟（`sourceStartMinute`，如 08:30），杜绝被后台轮询时刻（如 12:05）污染时间轴；
  - **历史事实不可变红线**：映射规则变动后，绝对禁止静默回溯修改或重算过去已落盘的打卡事件；
- **规范报告与守门测试**：输出 `docs/lifelog-multi-project-mapping-and-settlement-study.md` 规范报告；实现纯模型 `src/features/lifelog-settlement-governance.ts`；落地 `tests/lifelog-settlement-governance.test.cjs` 守门测试并纳入 `test:v18`（102 项全绿）。

# D-660：T-1611 今日提醒入口、T-1612 回顾提醒密度 & T-1618 通知频控与关闭收官（2026-10-29）

- **今日提醒入口空间紧凑化（T-1611 收官）**：
  - 将“查看全部提醒”收束至主项操作组（`.lc-checkin__priority-reminder-tools`）内，消除独立空行占位；
  - 点击平滑跳转至回顾页提醒中心并聚焦标题，跨表面返回路径明确；
- **回顾提醒中心卡片密度与响应式布局（T-1612 收官）**：
  - 桌面宽屏下，`.lc-checkin__reminder-row` 采用 Grid 单行横向对齐（`grid-template-columns: auto minmax(0, 1fr) 96px 118px`），彻底消除右侧动作竖排造成的卡片过高与大段留白；
  - 侧边栏 Dock 与 320px 窄宽下自适应响应，严格保持按钮高度 ≥ 34px / 触控区 ≥ 44px；
- **通知频控与免打扰闭环（T-1618 收官）**：
  - 双重退出通道：支持临时“关闭”与“今日不再提醒”（Mute Today，次日零点自动自愈恢复）；
  - 基于本地民历日与时刻槽建立持久发射凭据，宿主重启或多窗口并发绝不重复弹窗；
  - 无障碍保障：使用 `role="status"` 与 `aria-atomic="true"` 读屏防抖；
- **规范报告与守门测试**：输出 `docs/reminder-usability-and-density-acceptance.md` 规范报告；落地 `tests/reminder-usability-integration.test.cjs` 守门测试并纳入 `test:v18`（101 项全绿）。

# D-659：T-1753 外观低风险偏好、T-1763 场景组合包 & T-1764 AI 设置草案边界收官（2026-10-29）

- **外观低风险偏好与身份保护（T-1753 收官）**：
  - 仅消费系统客观媒体查询（明暗模式、宿主语言、触控支持），坚守绝不推断个人审美底线；
  - `preservePaletteAndAvatar: true`：用户自选的紫罗兰/海洋/森林调色板与个人头像属于核心身份表达，推荐方案**绝对予以保留**，不被批量重置；
- **四大场景化设置组合包（T-1763 收官）**：
  - 预置极简低打扰包（`minimal_calm`）、手动专注记账包（`manual_focus`）、阅读自动记账包（`reading_automation`）与笔记文档输出包（`doc_journaling`）；
  - `containsDestructiveAction: false`：100% 不含导入覆盖、快照回滚或偏好重置等破坏性操作；
  - 支持用户勾选部分字段采纳（`planScenarioPackAdoption`）；
- **自然语言 AI 设置草案安全防线（T-1764 收官）**：
  - 明确自然语言“帮我配置设置”只能生成**表单草案（Draft）**，绝对禁止作为操作指令直接执行；
  - 坚守零私有 Key、零笔记路径、零历史外发红线；禁止 AI 触发重置、回滚或密钥写入；
  - `validateAiSettingDraftProposal` 严格拦截恶意篡改与破坏动作，必须经过用户表单差异审阅后手动保存；
- **纯模型与守门测试**：输出 `docs/settings-scenario-packs-and-ai-boundary-study.md` 规范报告；实现纯模型 `src/features/settings-scenario-packs-and-ai-boundary.ts`；落地 `tests/settings-scenario-packs-and-ai-boundary.test.cjs` 守门测试并纳入 `test:v18`（100 项全绿里程碑）。

# D-658：T-1750 文档输出安全四问 & T-1751 编辑器模板联动单一事实源收官（2026-10-29）

- **文档输出安全四问模型（T-1750 收官）**：
  - 针对日记追加、常驻摘要与问卷文档输出，确立“写什么、何时写、写到哪里、最近是否成功”四维安全审阅；
  - 目标文档空缺时标为 `needs_target_selection` 并给候选，**绝对禁止自动新建或改写外部文档**；
  - 最近失败标为 `recent_failed`；**自动写入总开关绝对禁止由推荐私自开启**（`canRecommendAutoEnable` 恒为 false）；换绑保留全部历史；
- **模板联动与设置推荐单一事实源（T-1751 收官）**：
  - 编辑器模板推荐与设置侧推荐 100% 共享相同的候选过滤（分钟/步数/二值）与冲突探测规则，消除两套真值；
  - 针对需要分钟指标的模板，单位不符时强制拒止并返回 `unit_conflict_template_requires_minutes`；
- **纯模型与守门测试**：输出 `docs/note-ingest-and-output-recommendation-study.md` 规范报告；实现纯模型 `src/features/document-output-and-template-linkage.ts`；落地 `tests/document-output-and-template-linkage.test.cjs` 守门测试并纳入 `test:v18`（99 项全绿）。

# D-657：T-1746 笔记推导样例验证 & T-1747 叶归多项目映射建议收官（2026-10-29）

- **笔记推导真实样例验证（T-1746 收官）**：
  - 无客观可验证匹配块样例时，严禁宣称“推荐已就绪”（`sampleMatches.length === 0` 立即拒止，`canSave: false`）；
  - 提供扫描数、预估匹配数与忽略数的透明预演，7 字段整体保存边界严格沿用 D-313；
- **叶归 LifeLog 多项目映射建议（T-1747 收官）**：
  - 基于来源活动名与分钟单位提出逐行映射建议；
  - **红线禁则**：绝对禁止以同名启发式直接静默套用，所有提议映射的 `requiresConfirmation` 100% 为 true；
  - 目标笔记本需用户手工选定，坚守 `source + externalRef` 幂等与断连保留纪律；
- **纯模型与守门测试**：输出 `docs/note-ingest-and-output-recommendation-study.md` 规范报告；实现纯模型 `src/features/note-query-and-lifelog-recommendation.ts`；落地 `tests/note-query-and-lifelog-recommendation.test.cjs` 守门测试并纳入 `test:v18`（98 项全绿）。

# D-656：T-1754 今日视图、弹窗与专注提供方建议收官（2026-10-29）

- **环境与规模驱动推荐模型（T-1754 收官）**：
  - 项目规模与排期驱动今日分组模式：活跃项目 > 8 且排期项 ≥ 3 推荐 `group_mode: "time"`（时段分组），活跃项目 > 5 推荐 `group_mode: "group"`（自定义文件夹）；
  - 宿主自适应打开模式：侧边栏 Dock 宿主推荐 `open_mode: "quick"`（快速弹窗），移动端推荐 `open_mode: "tab"`（全屏页签）；
  - 专注提供方按真实健康可用性推荐（探测到 Dock Tomato 则推荐 `docktomato`，否则推荐 `builtin`）；
  - **对外能力纯度红线**：严禁将 Task Horizon 或 Agent 等外部未接入能力作为开关候选推荐给用户；
- **纯模型与守门测试**：输出 `docs/target-candidate-and-view-recommendations-study.md` 规范报告；实现纯模型 `src/features/view-and-focus-recommendations.ts`；落地 `tests/view-and-focus-recommendations.test.cjs` 守门测试并纳入 `test:v18`（97 项全绿）。

# D-655：T-1749 来源目标候选选择器与大项目集支持收官（2026-10-29）

- **突破 200 项限制与全量检索（T-1749 收官）**：
  - `projectTargetCandidates` 支持 300+ 乃至无界大项目集遍历，支持搜索过滤与分页（`limit` / `offset`），第 201 项及以后打卡项完全可见且可检索；
  - 单位兼容性严密匹配（分钟、步数、公斤、二值），不匹配项标为 `ineligible_unit` 并告知原因；
  - **当前绑定项置顶保留**：即使当前绑定的打卡项已被归档或指标修订，强制置顶保留为 `retained_binding`，绝不丢失配置；
  - **写前动态复核（`auditTargetBeforeSave`）**：保存前再次核验目标项目状态，精准拦截因多窗口并发在别处被归档、删除或单位被篡改的脏状态；
- **纯模型与守门测试**：输出 `docs/target-candidate-and-view-recommendations-study.md` 规范报告；实现纯模型 `src/features/target-candidate-selector.ts`；落地 `tests/target-candidate-selector.test.cjs` 守门测试并纳入 `test:v18`（96 项全绿）。

# D-654：T-1761 设置推荐多宿主走查 & T-1762 设置推荐全链路专项验收矩阵收官（2026-10-29）

- **设置与推荐系统全链路专项验收总成（T-1761 & T-1762 收官）**：
  - 汇编涵盖 T-1733～T-1762 全部推荐治理能力（字段对账、任务步骤流、多桶事务提交与失败回滚、7 大前置检查、版本生命周期与过期、总览三态、微信读书分步密度、全来源冲突检测、数据安全边界与能力纯度、多 Root 隔离与隐私脱敏、四轴解耦与元数据精准搜索）；
  - 8 大章节端到端契约守门 100% 通过；
  - 覆盖桌面宽屏、左右 Dock、移动 Tab、快速弹窗与 400% 缩放；保持双语对齐与输入法（IME）组合态保护；
- **验收报告与守门测试**：输出 `docs/settings-recommendation-acceptance-matrix.md` 规范报告；落地 `tests/settings-recommendation-acceptance.test.cjs` 守门测试并纳入 `test:v18`（95 项全绿）。

# D-653：T-1757 来源卡四轴状态解耦 & T-1758 设置元数据精准搜索收官（2026-10-29）

- **来源状态四轴正交解耦与首屏三行（T-1757 收官）**：
  - 确立配置态（`unconfigured` / `configured`）、运行态（`disabled` / `running` / `idle`）、今日活动（`has_records_today` / `no_records_today`）与故障状态（`healthy` / `read_failed` / `write_failed` / `credential_invalid`）四轴解耦；
  - **核心防误报防线**：未配置且停用时故障状态判定为 `healthy`，绝不展示虚假黄色/红色报警；
  - 首屏事实三行（产生什么、写入何处、触发频次）与专属动作动词消歧（微信读书拉取、思阅读取、思播采样、健康探测、叶归同步、笔记推导）；长说明统一折叠入 `data-source-advanced`；
- **设置元数据精准搜索与路径定位（T-1758 收官）**：
  - `searchSettingsRegistry` 消费 T-1733 注册表元数据（字段名、所属卡片、影响范围、理由、data-* 属性），彻底消除 DOM 全文长说明对搜索结果的稀释与干扰；
  - 输出结构化面包屑路径导航（`section > card > field`），支持 Enter 键直达聚焦与回跳保护，保持 IME 输入法组合态防抖；
- **纯模型与守门测试**：输出 `docs/settings-search-and-source-layering.md` 规范报告；实现纯模型 `src/features/settings-search-and-source-layering.ts`；落地 `tests/settings-search-and-source-layering.test.cjs` 守门测试并纳入 `test:v18`（94 项全绿）。

# D-652：T-1759 推荐草稿多 Root 隔离 & T-1760 推荐隐私与凭据脱敏收官（2026-10-29）

- **多 Root 草稿作用域隔离与脏保护（T-1759 收官）**：
  - 为主页签、侧边栏 Dock 与快捷弹窗等不同 DOM Root 维护独立的 `RootRecommendationDraft` 实例；
  - 远端并发保护：宿主触发 `onDataChanged` 广播时，遍历各 root 草稿，处于 `isDirty: true` 编辑态的草稿**严格禁止覆写**，仅打上 `hasStaleRemoteWarning: true` 标记保护输入，无编辑的草稿安全重置同步最新事实；
  - 离开与卸载时通过 `clearDraft` 释放上下文，杜绝内存泄漏；
- **零凭据建议与强制脱敏审计（T-1760 收官）**：
  - 推荐对象、建议载荷、日志、ARIA 与数据导出中**坚决禁止携带任何明文 API Key/Token 凭据**；
  - 敏感凭据字段统一由 `sanitizeRecommendationPayload` 强制格式化为 `••••••••`；
  - `auditRecommendationPrivacy` 在导出前进行白名单扫描，若检测到明文敏感凭据立即拒止外发；
  - 离线与未授权时优雅回退至人工配置，杜绝假阳性报错刷屏；
- **纯模型与守门测试**：输出 `docs/settings-recommendation-ownership-and-privacy.md` 规范报告；实现纯模型 `src/features/settings-recommendation-ownership-and-privacy.ts`；落地 `tests/settings-recommendation-ownership-and-privacy.test.cjs` 守门测试并纳入 `test:v18`（93 项全绿）。

# D-651：T-1755 数据恢复安全边界 & T-1756 对外能力纯度模型收官（2026-10-29）

- **数据恢复操作安全分级模型（T-1755 收官）**：
  - 仅安全指导类（`export_envelope` 导出多桶备份、`create_snapshot` 建立恢复点、`inspect_snapshots` 查看快照列表）允许在界面中推荐；
  - 破坏性数据操作（`import_overwrite` 导入覆盖、`restore_snapshot` 快照回滚、`clear_audit_history` 清空审计、`reset_all_preferences` 重置所有偏好）**100% 严禁打包入任何一键推荐方案**，必须由用户显式触发并经二次弹窗确认；
  - 备份范围透明度说明（`explainBackupCoverage`）：单主档 JSON 仅含核心打卡事实，不含事项与提醒；全量迁移必须使用多桶 Envelope 备份；
- **对外能力与只读状态纯度模型（T-1756 收官）**：
  - Task Horizon 观察级协议严格保持 `waiting` 状态，**坚决禁止虚标“已连接”或伪装状态**；
  - 系统开放能力（API v5、Agent 就绪态、快捷键说明、版本号）属于只读契约或系统事实，坚决禁止提供“采用推荐”按钮；
  - 仅内部专注计时提供方切换（内置 vs Dock Tomato）允许作为配置推荐项；
- **纯模型与守门测试**：输出 `docs/data-and-capability-recommendation-boundaries.md` 规范报告；实现纯模型 `src/features/data-and-capability-recommendation-boundary.ts`；落地 `tests/data-and-capability-recommendation-boundary.test.cjs` 守门测试并纳入 `test:v18`（92 项全绿）。

# D-650：T-1741 微信读书卡分步配置与响应式密度收官（2026-10-29）

- **五阶严格递进层次（T-1741 收官）**：
  1. 必需项：阅读时长打卡项绑定（`data-weread-item`，只候选分钟单位活跃项）；
  2. 可选项：完读指标（`data-weread-finish-item`）与划线笔记指标（`data-weread-notes-item`），显式提供留空选择，绝不误导为必填；
  3. 凭据层：官方 Key（`data-weread-key`，独立存储脱敏，留空保持原值，清除需二次确认）；
  4. 规则层：达标阈值（`data-weread-threshold`，默认推荐 15 分钟经验值）；
  5. 验证层：已生效摘要（`lc-checkin__settings-effective`）与手动立即拉取（`data-action="weread-pull"`）；
- **宽屏密度与截断防护**：全量应用 `overflow-wrap: anywhere; word-break: break-word`，消除非对称空白，320px 至宽屏无横向溢出；
- **规范报告与守门测试**：输出 `docs/weread-panel-step-and-density-study.md` 规范报告；落地 `tests/weread-panel-structure.test.cjs` 守门测试并纳入 `test:v18`（91 项全绿）。

# D-649：T-1748 跨来源同项目冲突与归集预览收官（2026-10-29）

- **重复计量风险判定矩阵（T-1748 收官）**：
  - `detectCrossSourceConflicts` 纯函数监控思阅、思播、微信读书、健康、叶归、笔记推导全量来源；
  - 两个及以上启用态的时长来源（`metric: "minutes"`）汇入同一 `itemId` 时，精准标定 `warning_duplicate_risk` 并建议拆分；互补指标汇入同一项标为 `info_multi_feed` 中性提示；
  - 停用或未绑定的来源绝不触发虚警；
- **三大红线不变量**：
  1. 零输入变异：冲突探测纯投影分析，绝对不修改传入 items 或 bindings；
  2. 零静默关闭：绝不以“避免重复”为由私自停用任何外部来源；
  3. 零历史改写：坚决不改写、合并或删除已有历史事实事件；
- **纯模型与守门测试**：实现纯模型 `src/features/cross-source-conflict.ts`（包含 `generateTargetItemFeedMatrix` 归集预览）；落地 `tests/cross-source-conflict.test.cjs` 守门测试并纳入 `test:v18`（90 项全绿）。

# D-648：T-1739 推荐版本生命周期 & T-1740 设置总览三态模型收官（2026-10-29）

- **推荐版本化生命周期与新鲜度判定（T-1739 收官）**：
  - 定义五大状态（`active`、`stale`、`dismissed`、`opted_out`、`applied`），确立 `RECOMMENDATION_LIFECYCLE_VERSION = 2`；
  - 自动过期触发规则：关联打卡项被删除（`item_deleted`）、被归档（`item_archived`）、单位被修订（`item_unit_revised`）或目标文档丢失（`target_doc_unreachable`）立即标过期；
  - **用户草稿绝对保护**：用户一旦在输入框填写草稿，`preserveUserDraft` 强制为 true，绝不冲掉未保存输入；
- **设置总览三态正交分流与防误报红线（T-1740 收官）**：
  - `requires_fix`（需修复）：仅限真实写入失败、凭据失效、文档丢失等阻断性故障，标记 `isBlocking: true` 并给重试/定位动作；
  - `pending_confirmation`（待确认）：未保存草稿与导入重名冲突；
  - `suggested`（可选改善）：夜间安静时段、打卡提醒槽、专注联动等中性建议；
  - **核心防焦虑红线**：未启用的外部来源严格作为中性状态，**坚决禁止误报为 requires_fix**；
- **纯模型与守门测试**：输出 `docs/settings-recommendation-lifecycle-and-tristate.md` 规范报告；实现纯模型 `src/features/settings-recommendation-lifecycle.ts`；落地 `tests/settings-recommendation-lifecycle.test.cjs` 守门测试并纳入 `test:v18`（89 项全绿）。

# D-647：T-1737 推荐应用事务与保存边界 & T-1738 推荐前置检查收官（2026-10-29）

- **推荐方案多桶提交事务与原子回滚（T-1737 收官）**：
  - 针对 A 类草稿与 B 类即时偏好的混合推荐方案，事务提交前捕获全部字段内存快照备用；
  - 按存储桶聚合为单批次写入，杜绝 N 次离散无反馈的单字段写盘；
  - 存储写入失败或部分失败时，立即调用 `rollbackInMemoryFn` 恢复内存数据与 UI 输入，防止脏草稿滞留；
  - 诚实披露执行状态（`full_success`、`partial_success`、`rolled_back`），若部分成功如实说明已存桶与失败原因，**坚决不暗示全局原子性已具备**；
- **七大推荐前置状态机与动作路径（T-1738 收官）**：
  - `evaluateRecommendationPreflight` 纯逻辑评估 `ready`、`missing_credential`、`no_matching_item`、`target_unreachable`、`host_undetected`、`unit_conflict`、`multiple_candidates`；
  - 针对每种缺口提供明确补齐引导路径（`input_credential`、`create_matching_item`、`choose_target_item`、`verify_host_status`）；
  - **严禁提前启用红线**：未通过用户显式确认前，绝对禁止预先开启外部来源或发起网络拉取；前置失败绝不抹杀已有配置；
- **纯模型与守门测试**：输出 `docs/settings-recommendation-transaction-and-preflight.md` 规范报告；实现纯模型 `src/features/settings-recommendation-transaction.ts`；落地 `tests/settings-recommendation-transaction.test.cjs` 守门测试并纳入 `test:v18`（88 项全绿）。

# D-646：T-1734 设置分区与任务入口再梳理收官（2026-10-29）

- **“先做什么”五大核心任务导向流（T-1734 收官）**：
  1. 日常显示与提醒（`daily_display_reminders`）：外观质感 → 今日布局 → 提醒时刻与夜间免打扰；
  2. 第三方自动记录（`auto_ingest`，以微信读书为例）：凭据接入 → 习惯绑定与 15 分钟阈值 → 探测拉取核验首条事实；
  3. 思源笔记写入（`note_output`）：单向追加模式 → 目标笔记本与文档 ID 绑定 → 模板格式化保存；
  4. 数据恢复与备份（`data_recovery`）：多桶备份导出 → 快照列表与回滚点选择 → 诊断与审计导出；
  5. 宿主与生态能力状态（`capability_status`）：专注提供方（内置 vs Dock Tomato）选择 → API v5 契约核验；
- **100% 既存兼容保证**：所有 `data-setting-*`、`data-action=*`、`data-contract-*` 属性字面保持不变，现有搜索词库、跨表面回链（`data-goto-binding`）与事件委派选择器无缝兼容；
- **纯模型与守门测试**：输出 `docs/settings-task-entry-and-journey-study.md` 规范报告；实现纯模型 `src/features/settings-task-journey.ts`；落地 `tests/settings-task-journey.test.cjs` 守门测试并纳入 `test:v18`（87 项全绿）。

# D-645：T-1733 设置字段推荐适用性总表与治理模型收官（2026-10-29）

- **推荐适用性四级模型（T-1733 收官）**：
  1. **可给通用默认 (`universal_default`)**：主题/语言 auto、NLP 速记开启、安静时段 23:00~07:00、微信读书默认 15 分钟；
  2. **可按本地证据推荐 (`evidence_based`)**：根据打卡峰值小时自适应推荐提醒时刻槽、根据 Dock Tomato 插件健康状态推荐专注提供方、根据习惯规模推荐分组；
  3. **必须人工选择 (`manual_required`)**：微信读书 API Key 凭据、日记目标笔记本与文档 ID、个人头像、自定义问卷模板；
  4. **不可推荐红线 (`not_applicable`)**：严禁强塞推荐值！覆盖全部 C 动作类（导入导出、快照恢复、危险重置）与 D 只读状态行（API 契约、空间统计）；
- **防篡改过滤与纯函数推导**：`evaluateFieldRecommendationEligibility` 强制阻断非推荐字段；`deriveEvidenceBasedRecommendations` 仅消费上下文快照，无时钟、无 I/O；
- **纯模型与守门测试**：输出 `docs/settings-recommendation-applicability-study.md` 规范报告；实现纯模型 `src/features/settings-recommendation-governance.ts`；落地 `tests/settings-recommendation-governance.test.cjs` 守门测试并纳入 `test:v18`（86 项全绿）。

# D-644：T-1822～T-1827 设计系统集成、多宿主密度与无障碍全景守门收官（2026-10-29）

- **矢量图标系统单一源（T-1825 收官）**：确立 `UI_ICON_PATHS` 为单一事实源，覆盖 24 基础核心图标，全部内嵌 24x24 viewBox、`aria-hidden="true"` 与 `focusable="false"` 读屏保护；
- **宿主三档密度几何与键盘安全（T-1824 收官）**：`tokens.scss` 规范 Touch (44px)、Normal (34px)、Compact (30px) 三档交互几何，移动端输入 `:focus` 注入 96px `scroll-margin-bottom` 虚拟键盘防遮挡外边距；
- **强制颜色与系统关键词适配（T-1827 收官）**：`@media (forced-colors: active)` 映射 `CanvasText`、`Highlight`、`ButtonText`，注入实体轮廓防背景剔除；
- **减弱动效双闸持续时间压制（T-1826 收官）**：`@media (prefers-reduced-motion: reduce)` 实施 `.01ms !important` 双闸微帧压制，消除前庭眩晕；
- **数据可视化皮肤与信息架构（T-1822 & T-1823 收官）**：Review/Insights 容器与统计小格统一切到 v3 card token，漏打色阶收口到 `color-mix`；事项管理宽屏主从布局（`data-form-open`）自适应吃满；
- **规范报告与守门测试**：输出 `docs/design-system-integration-and-a11y-matrix.md` 规范报告；落地 `tests/design-system-integration.test.cjs` 守门测试并纳入 `test:v18`（85 项全绿）。

# D-643：T-1814, T-1815 & T-1828 字体层级、对比度叠加防护与长文本折行收官（2026-10-29）

- **字体层级与可读性底线（T-1814 收官）**：全库清除 `< 8px` 极小字号，正文统一在 12px~14px，次级徽标与标签保持在 9px~10.5px，保证 320px/360px 屏幕与 400% 缩放下清晰可辨；
- **状态对比度与透明度叠加防护（T-1815 收官）**：
  - 完成态卡片在 `:active` 或 `:focus-within` 态强制重置 `opacity: 1`，彻底消除父子透明度叠加导致的对比度折损；
  - 强制声明 `[hidden] { display: none !important; }`，杜绝 `display: grid` 篡改原生隐藏行为导致的点击拦截与视觉幽灵；
- **长文本截断与全词折行标准（T-1828 收官）**：
  - 固化三大标准排版 Mixin（`@mixin lc-text-truncate`、`@mixin lc-text-clamp-2`、`@mixin lc-text-break`）；
  - 全面应用 `overflow-wrap: anywhere; word-break: break-word`，在 400% 缩放与极端长 URL 下消除横向滚动条撕裂；
- **规范报告与守门测试**：输出 `docs/typography-contrast-and-text-governance.md` 规范报告；落地 `tests/typography-contrast-text.test.cjs` 守门测试并纳入 `test:v18` 门禁（84 项全绿）。

# D-642：T-1651 长会话与升级生命周期验收收官（2026-10-29）

- **卸载与销毁零泄漏不变量（Zero Leak Invariant，T-1651 收官）**：
  - 插件卸载（`onunload`）入口强制清理全部异步定时器（补拉、防抖、调度器、提醒心跳）、取消动画帧（`cancelAnimationFrame`）并清零句柄；
  - 彻底注销 Dock Tomato 聚焦适配器与各类全局浏览器事件监听器；
  - 表面关闭即刻释放 root 上下文（`releaseRootContext`），严格过滤 detached root 避免僵尸回调；
- **配置代际防旧响应写回**：利用 `sourceGenerations` 自增与写前动态复核，迟到响应一律可诊断丢弃；
- **表单草稿与会话态平滑恢复**：输入即快照、条目级滚动复合键（`getScrollTopKey`）与主 Store 向前兼容升级机制；
- **验收报告**：输出 `docs/long-session-and-upgrade-lifecycle-acceptance.md` 规范报告。

# D-641：T-1650 性能、包体积与低端设备预算收官（2026-10-29）

- **性能全链路量化总成（T-1650 收官）**：
  - 包体积刚性受控：CSS 产物维持在 696,010 字节（稳居 680 KiB / 696,320B 硬限内，0 死类，0 重复规则）；JS 1.64 MiB，安装包 956 KiB；
  - 10k 事件 Review 范围投影扫描 7.7ms（离线浏览器实测 43.1ms），Insights 366 天钻取 16.3ms，双 Root 同屏 54.3ms；
  - 弱引用索引 O(1) 单条查找 0.005ms；100k 冷启动 237.5ms；
  - 100 项习惯卡片 DOM 渲染 0.06ms，1,000 项大列表 1.08ms；
- **低端设备体验护栏**：落实 16.6ms 帧预算、50ms 长任务切片、活动输入焦点挂起自愈与指数退避调度；
- **规范报告与基准工件**：输出 `docs/performance-and-low-end-device-budget.md` 规范报告；`scripts/t1650-browser-benchmark.cjs` 输出 `.artifacts/t1650-browser-benchmark.json` 并通过 `tests/t1650-report-contract.test.cjs` 验证。

# D-640：T-1829 UI 样式与大列表渲染预算研究收官（2026-10-29）

- **SCSS 选择器复杂度与安全约束（T-1829 收官）**：
  - `:has()` 父选择器严格限定在顶层卡片与拖拽状态（如 `.lc-checkin__item:has(...)`），严禁嵌套使用（`:has(:has(...))` 绝对禁止），严禁在高频叶子节点使用；
  - 容器查询限定在顶层根容器，禁止卡片内部递归嵌套定义；
  - 强制全站核心容器落实 `contain: layout` 与 `min-width: 0` 重排隔离；
- **渲染耗时量化基准**：
  - 100 项规模渲染实测耗时 **0.06 ms**（预算 < 50ms，安全余量 > 800 倍）；
  - 1,000 项规模渲染实测耗时 **1.08 ms**（预算 < 350ms，安全余量 > 300 倍）；
  - 证明当前架构足以平滑支撑重度知识库打卡列表，无需引入增加复杂度的虚拟滚动（Virtual List）；
- **规范报告与守门测试**：输出 `docs/ui-style-and-render-budget-study.md` 规范报告；落地 `tests/ui-style-benchmark.test.cjs` 守门测试并纳入 `test:v18` 门禁（83 项全绿）。

# D-639：T-1778 & T-1788 全页面视觉语义复核与动态状态验收收官（2026-10-29）

- **全页面主次操作语义收敛（T-1778 收官）**：在 `features/page-semantic-audit.ts` 建立纯逻辑治理模型；确立 Today、Review、Insights、Editor、Occasions、Archived、Settings、More 全部页面的主动作、次级动作、空态指引与回链（returnTo）白名单（`PAGE_SEMANTIC_DEFINITIONS`）；
- **五大动态异常状态韧性边界（T-1788 收官）**：
  1. **Loading**：强制暴露 `aria-busy="true"` 与按钮在途禁用；
  2. **Error**：同时包含可读诊断文案与重试/回滚操作，**严格禁止清空或丢失用户表单草稿（草稿绝对保护红线）**；
  3. **Slow-Source**：请求在途必须标记状态，强制 10s/18s 有界超时截断；
  4. **Empty**：严禁灰色死胡同，必须提供新建或清除筛选恢复动作；
  5. **Long-Text & 400% Zoom**：强制落实 `overflow-wrap: anywhere` 与长备注折叠，400% 缩放无撕裂；
- **验收报告与守门测试**：输出 `docs/full-page-semantic-and-state-matrix.md` 规范报告；落地 `src/features/page-semantic-audit.ts` 纯模型与 `tests/page-semantic-audit.test.cjs` 守门测试并纳入 `test:v18` 门禁（82 项全绿）。

# D-638：T-1550 & T-1555 联动可用性切片验收与设置内容分层收官（2026-10-29）

- **设置内容去重与高级折叠（T-1555 收官）**：
  - 全量 6 张外部来源卡片（sireader, siplayer, weread, health, notequery, yeguif）均已将详细步骤与 boundary 限制长文收纳进 `<details class="lc-checkin__settings-fold" data-source-advanced>`，消除首屏大段文本堆叠；
  - 动作词消歧：废弃含义模糊的“立即刷新”，分别收敛为“立即读取”（摄取型）、“立即拉取”（微信读书）与“宿主探测”（思播）；
  - 每卡首屏固定提供事实三行（产生什么、写入哪些、触发频次）；
- **联动可用性与双结果解耦（T-1550 收官）**：
  - 缺失前置时直接聚焦缺失控件，消除多余跨页兜圈；
  - 文档输出卡（日记/摘要）明确分离触发与最近结果；落实“打卡事实先落盘、文档输出失败不回滚”原则，失败时提示“打卡事实不受影响”；
  - 目标选择器与集中体检支持一键重检与换绑确认；
- **验收报告与守门测试**：输出 `docs/integration-usability-and-layering-study.md` 规范报告；落地 `tests/integration-usability-acceptance.test.cjs` 守门测试并纳入 `test:v18` 门禁（81 项全绿）。

# D-637：T-1732 事项管理专项验收矩阵与实施门禁收官（2026-10-29）

- **事项全体系总验收门禁收官（T-1732 闭环）**：全面汇编 T-1701～T-1732 事项管理全链路验收证据；
- **九大集成章节全绿通过**：
  1. 创建、防连击提交与相似项查重（`findSimilarOccasions`）；
  2. 规则内联预览（`buildOccurrencePreview`）；
  3. 极端日期（闰日顺延 02-28、农历换算、月末 clamp）；
  4. 单次改期与跟随解析（`resolveOverrideTarget`、`findOverrideOriginFor`）；
  5. 当前发生日完成/撤销切换与 120 条上限截断透明化；
  6. 停用不生墓碑、删除原子生成墓碑（240 条上限）与跨窗口合并防复活；
  7. 多桶备份 Envelope 决断（mutation 覆盖/合并，overwrite 敏感合并）与快照回滚；
  8. RFC 5545 iCalendar (ICS) 单向日历导出与农历 3 年展开；
  9. 批量安全边界与自然语言三分类意图分流；
- **验收报告与守门测试**：输出 `docs/occasion-management-acceptance-matrix.md` 总门禁报告；落地 `tests/occasion-lifecycle-acceptance.test.cjs` 守门测试并纳入 `test:v18` 门禁（80 项全绿）。

# D-636：T-1709 & T-1710 宽屏事项列表优先主从布局与信息层级收官（2026-10-29）

- **宽屏列表优先主从布局（T-1709 收官）**：
  - 在 `src/render/occasions.ts` 为 `.lc-checkin__occasion-manager` 注入响应式会话状态 `data-form-open="${isFormOpen ? "true" : "false"}"`；
  - 表单收起态（`data-form-open="false"`）：在桌面宽屏（`min-width: 900px`）下彻底打破旧版固定双栏对列表挤压的缺陷，将栅格自适应扩展为单列吃满 `grid-template-columns: minmax(0, 1fr)`，列表面板（`occasion-list-panel`）占满全部可用空间，彻底消除了右侧数百像素的空白浪费；
  - 表单展开态（`data-form-open="true"`）：自适应切换为主从两栏分工 `grid-template-columns: minmax(0, 1fr) minmax(340px, 420px)`，列表在左占据主视野，编辑面板在右侧吸顶粘附；
  - 窄屏与手机端（`max-width: 899px`）：维持单列纵向卡片流，表单收于抽屉，无横向溢出；
- **事项行信息层级与可读性优化（T-1710 收官）**：
  - 标题行清晰呈现事项名称、状态徽标（Today/Disabled）、提醒动作（已跳过/已延期）与本次完成切换按钮；
  - 日期行突出展示下一次发生日期与倒计时，兼顾自然历跨度与长周期进度；
  - 次级元信息行（Kind / 循环规则 / 提前提醒量 / 历史完成计数 / 关联打卡项目）采用小字号弱化并以点号分隔，确保 2 条到 50 条事项均能一眼扫读；
  - 长备注收纳进按需展开折叠项（`details.lc-checkin__occasion-note-fold`），操作区保持右侧紧凑对齐；
- **全量门禁与体积安全**：清理了 `components.scss` 中遗留的历史重复 override 规则，产物体积维持在 **695,770 字节**（安全缓冲 550 字节，0 死类，0 重复规则）；全套测试全绿。

# D-635：T-1727～T-1731 事项规模扩展、批量管理与能力边界研究收官（2026-10-29）

- **多选批量管理边界判定（T-1727 收官）**：
  - 允许批量启停与批量删除（强制二次确认，生成批量墓碑）；
  - **严禁**跨不同发生日盲目改期（会破坏各事项原本的锚点基点与纪念日语义）；
  - **严禁**跨不同发生日盲目批量完成，仅允许在同发生日（如今日到期过滤）下执行批量完成；
- **日历与时间轴只读投影规范（T-1728 收官）**：时间轴与月历视图 100% 复用现有 `getOccurrenceDate`、`completedDates` 与 `reminderUserActions` 纯计算管道，坚决不另建第二套独立存储；
- **标签与系统分类边界界定（T-1729 收官）**：严格区分系统底层 Kind（硬计算逻辑）、模板分类与用户软性标签；现有状态/类型与搜索框已足应对 ≤100 项规模，延后复杂多对多标签树；
- **阶梯提醒策略与冲突聚合（T-1730 收官）**：支持提前 N 天阶梯调度（`ladderDays: [7, 3, 1, 0]`），单次推迟生效期内抑制前置阶梯，同日推送统一经 `reminder-digest` 聚合；
- **自然语言条目意图分类器（T-1731 收官）**：实现打卡项目、日期事项、一次性提醒三分类纯模型（`classifyNaturalLanguageEntry`）；严格执行“草案审阅、确认后手动保存”纪律，严禁模型输出直接自动改写存储；
- **规范报告与守门测试**：输出 `docs/occasions-scale-and-extensions-study.md` 规范报告；落地 `src/features/occasion-governance.ts` 纯模型与 `tests/occasion-governance.test.cjs` 守门测试并纳入 `test:v18` 门禁（79 项全绿）。

# D-634：T-1726 事项与提醒动作多桶备份迁移与 ICS 导出研究收官（2026-10-29）

- **主档与多桶备份 Envelope 边界厘清（T-1726 收官）**：单文件主档（`checkin-store`）只包含项目与日志，严禁宣传为完整备份；事项桶（`checkin-occasion-store`）与提醒动作桶（`checkin-reminder-actions`）在 `BackupEnvelope` 中分别归属 `mutation` 与 `overwrite`，支持导入前自动拍摄快照与原子回滚；
- **RFC 5545 iCalendar (ICS) 单向导出规范**：
  - 事项 UID 确定性映射（`occasion-<id>@siyuan-checkin`）；
  - 支持公历年、月第 N 周、月末、周与间隔循环规范映射；
  - **农历固有损耗降级**：RFC 5545 不支持农历循环，纯模型预先通过 `lunarToSolar` 将未来 3 年对应公历日展开为独立 `VEVENT`，并保留 `X-LUNAR-ORIGIN` 标注；
  - **单向导出红线**：仅支持单向 `.ics` 文件导出，**坚决不做双向 CalDAV / ICS 导入回写**（杜绝外部日历事件污染本地知识库）；
- **规范报告与守门测试**：输出 `docs/occasion-ics-and-migration-study.md` 规范报告；落地 `src/features/occasion-ics.ts` 纯模型与 `tests/occasion-ics-migration.test.cjs` 守门测试并纳入 `test:v18` 门禁（78 项全绿）。

# D-633：T-1721 事项删除、停用、跨窗口墓碑与关联隔离收官（2026-10-29）

- **停用与删除用户语义严格区分（T-1721 收官）**：
  - **停用（enabled: false）**：仅暂时不提醒、不进入即将来临分组；其完成历史（`completedDates`）与单次实例改期（`overrides`）100% 完整保留，随时恢复，**绝不生成墓碑**；
  - **删除（deleteOccasion）**：物理剔除事项，并原子生成带有 ISO 时间戳的 `OccasionTombstone`（`{occasionId, deletedAt}`），严格阻断后续误插入；
- **跨窗口合并防复活不变量（Anti-Resurrection Invariant）**：在 `mergeOccasionCompletions` 与 `normalizeOccasionStore` 中，墓碑集合对旧窗口持有未删除快照的写回具有绝对压制权，坚决物理消除僵尸事项复活；
- **墓碑容量上限硬预算（240 条）**：确立 240 条墓碑上限（按时间升序截断最旧墓碑），防止无限删除造成数据膨胀；
- **打卡事实层不可变与关联保护**：事项与打卡项目（`linkedOccasionId`）完全解耦，事项删除绝不删除主 Store 关联项目与打卡事件；事项派生的待办与提醒在投影层立即失效消失；
- **规范报告与守门测试**：输出 `docs/occasion-delete-and-tombstone-study.md` 规范报告；落地 `tests/occasion-delete-tombstone.test.cjs` 守门测试并纳入 `test:v18` 门禁（77 项全绿）。

# D-632：T-1676 源时记数据面适配可行性研究收官（2026-10-29）

- **源时记数据面审计与定位厘清（T-1676 收官）**：源时记（siyuan-time-spent）属于被动时间量化工具，持久化于私有 `petal/siyuan-time-spent/*.json` 存储中；
- **私有存储隔离红线（Data Ownership Redline）**：坚守不跨插件读取第三方私有目录红线，严禁直接扫描/逆向其私有 petal JSON 文件；
- **跨窗口防双计与事实不可变**：被动时长缺乏跨窗口排他锁，极易产生时间戳重叠与双重计入；第三方数据清空或删除时，打卡系统受事实不可变保护，绝不反向级联抹除用户历史打卡；
- **裁决结论**：
  - **采用**：在 `src/ecosystem.ts` 登记 `timespent` 为合法外部身份前缀（`timespent:<docId>:<localDate>`），保留未来标准格式文件导入与开放 API 汇入能力；
  - **延后**：针对源时记本地存储的自动后台摄取，严格等待其上游发布稳定、公开、带版本说明的 API 或 CustomEvent；
  - **坚决不做**：小驴打卡绝不自建常驻后台被动时间追踪器（守住极简、主动打卡与低功耗原则）；
- **研究报告**：输出 `docs/siyuan-time-spent-integration-study-2026-10.md` 规范报告。

# D-631：T-1675 思源闪卡 3.9 重构后联动可行性重评收官（2026-10-29）

- **宿主 3.9 重构现状复核（T-1675 收官）**：思源官方稳定版当前为 v3.8.5；3.9.0 闪卡重构分支 `feature/flashcard`（移除旧 riff 路由、重写 38 条 `/api/flashcard/*` 实体端点）尚未正式发版向集市推送，`/api/flashcard/*` 与 `openTab.cardIDs` 尚未纳入官方 `docs/API.md` 与稳定声明；
- **宿主独占调度所有权不变量（Host-Exclusive Scheduling Invariant）**：闪卡卡片 due、复习队列与 FSRS 算法由思源宿主内核独占维护；打卡插件绝不建立平行的卡片调度器，绝不双向篡改卡片 due，杜绝调度踩踏；
- **四种联动形态最终裁决**：
  - **采用**：人工打开源文档/原生复习队列（`openTab`，零副作用）；
  - **采用**：复习完成后由用户手动确认打卡，或由日记报告汇总留痕；
  - **延后**：只读到期卡片数概览（底层 `getDeckDueCards` 存在清空复习栈缓存的严重副作用，等待宿主提供无副作用只读查询）；
  - **坚决不做**：自动监听 DOM/私有事件、自动推断会话完成、篡改内核卡片调度；
- **研究报告**：输出 `docs/flashcard-integration-study-2026-10.md` 规范报告。

# D-630：T-1680 上游 issue、PR 与发布事实定期复核收官（2026-10-29）

- **合作插件事实与就绪度复查（T-1680 收官）**：在 `features/upstream-governance.ts` 建立纯逻辑治理模型；全面复查思阅（SiReader，issue #55）、思播（SiPlayer，issue #180）、Task Horizon（`task-horizon-contract.ts`）与 Dock Tomato（`dock-tomato.ts`）的外部合并与发版事实；
- **三重门槛不变量（Three-Tier Gate Invariant）**：晋升外部来源为 `stable`（默认或主力写入级别），必须严格同时满足以下三个硬性前提：
  1. 上游已正式合并公开契约（`isMergedUpstream: true`）；
  2. 上游已发布带版本化规范契约的正式版本（`hasVersionedRelease: true`）；
  3. 已在真实思源宿主中通过全生命周期双向集成验收（`isVerifiedInRealHost: true`）；
  任一条件未达成时，来源级别坚决保持 `experimental`（实验性/仅观察）或 `planned`，严禁擅自提级或包装为已就绪功能；
- **各来源状态核准与安全裁决**：
  - **思阅（SiReader）**：维持 `experimental` 观察级，保持 opt-in 默认关的 fallback 监听；坚守不侵入 `reader_stats`/`daily.json` 私有存储红线；不因无回复重复催办；
  - **思播（SiPlayer）**：维持 `experimental` 观察级，沿用本地采样器与午夜切分；
  - **Task Horizon**：维持 `experimental` 实验级与四态机流转，坚守单一 Canonical Source 互斥原则与 5 分钟 TTL Fallback；真实联调保持挂起（T-1836）；
  - **Dock Tomato**：维持 `experimental` 收件箱隔离模式，`onunload` 100% 注销防泄漏；
- **研究报告与守门测试**：输出 `docs/upstream-proposals-review-2026-10.md` 复核报告；落地 `tests/upstream-governance.test.cjs` 守门测试并纳入 `test:v18` 门禁（76 项全绿）。

# D-629：T-1678 习惯产品与低压力交互基线更新研究收官（2026-10-29）

- **低压力交互哲学与反暗模式防线（T-1678 收官）**：在 `features/low-pressure-governance.ts` 建立纯逻辑治理模型；确立“以可持续长跑为导向，彻底摒弃负罪感诱导与激进游戏化”的交互红线；
- **智能提醒降噪（evaluateReminderDenoising）**：严格落实五重静音拦截：当日已打卡（`completed-today`，吸取 Loop Habit Tracker #1573 重复弹窗教训）、显式跳过（`skipped-today`）、休眠中（`item-paused`）、安静免打扰时段（`in-quiet-hours`）及每日上限（`daily-budget-reached` ≤2 次/日）100% 压制通知；
- **双日规则与断签容错模型（evaluateStreakTolerance）**：贯彻“断一天是数据，连断两天才是信号”循证行为科学基准；单日遗漏在容错范围内视为中性观察数据（`tolerated-single-gap`），显式 SKIP 中性桥接；连续中断 ≥2 天以平静姿态重置（“找回节奏”），坚决杜绝“归零/失败”负罪感措辞；严禁“付费补签”等出局暗模式；
- **休眠与假期模式支持（evaluateItemPauseState）**：应对考试周、生病住院或长假，项目进入休眠期（`isPaused` / `pausedUntil`）后，主动豁免失速分析（`exemptFromStalled: true`）、彻底静音提醒、冻结衰减，解除后无痛复苏；
- **单向永久里程碑与激励封顶（evaluateLowPressureAchievement）**：成就阶梯（1/3/7/14/30/60/90/180/365）一旦达成永久属于用户，绝不掉级、绝不剥夺；坚决抵制修仙打卡类“扣分掉境界”与负积分暗模式；超额完成奖励封顶 1.5 倍，零社交排行；
- **Calm 禁则文案校验器（validateCalmCopy）**：用户可见文本与 AI 建议生成内容中严格拦截“你落后了”、“前功尽弃”、“归零”、“惩罚”等措辞，自动推荐平静平和表述；
- **研究报告与守门测试**：输出 `docs/low-pressure-interaction-baseline-study.md` 规范报告；落地 `tests/low-pressure-governance.test.cjs` 守门测试并纳入 `test:v18` 门禁（75 项全绿）。

# D-628：T-1677 QingTrail / LifeLog 时间轴与类型聚合研究收官（2026-10-29）

- **段落修订指纹与幂等性保证（T-1677 收官）**：在 `features/lifelog-governance.ts` 建立纯逻辑模型；段落以 `yeguif:<blockId>:<localDate>` 天然作为幂等键；落地 `computeParagraphFingerprint` 纯函数计算内容修订指纹，用户在日记中修改备注时绝对不重复入账或产生重复记录；
- **跨语言类型别名归一（resolveTypeAlias）**：内置中英文类别对照（`work/working`→`工作`, `study/reading`→`阅读`, `exercise/workout`→`运动`, `meditation`→`冥想`），支持用户自定义映射覆盖，消除多语言日记导致的统计分叉；
- **类型聚合统计模型（summarizeLifelogByType）**：按活动类型求和并自动计算总时长、次数与百分比，为周复盘看板提供宏观时间分配事实依据；
- **表现形式价值与认知负荷量化评估**：全面采纳时间轴（流水账心流与日记直达）与类型聚合（时间分配分析）；明确抑制在日历方格内堆砌多色图标徽标，维持纯净色阶热力图，避免小屏严重视觉过载；
- **坚守事实层不可变红线（Immutable Facts Redline）**：打卡插件对用户日记只进行追加或会话期即时撤销，严禁反向扫描改写用户历史正文段落，保持单向数据流纯净；
- **研究报告与守门测试**：输出 `docs/lifelog-marker-and-timeline-study.md` 规范报告；落地 `tests/lifelog-governance.test.cjs` 守门测试并纳入 `test:v18` 门禁（73 项全绿）。

# D-627：T-1679 循证模板目录治理与重复/本地化身份研究收官（2026-10-29）

- **稳定模板 Slug 映射与跨语言身份解耦（T-1679 收官）**：在 `features/template-catalog-governance.ts` 建立纯逻辑模型，为所有内置模板派生唯一的稳定英文 kebab-case slug（`deriveTemplateSlug`）；模板引用、组合包依赖与跨语言导出优先以 slug 作为机器外键，彻底解除与易变用户可见名称的硬绑定；
- **计量单位同义归一化（normalizeUnit）**：收敛中英文缩写与别名（`ml`→`毫升`, `mins`→`分钟`, `hrs`→`小时`, `times`→`次`, `kg`→`千克`），在规则比对与组合包应用前完成归一化，杜绝异构单位造成的假冲突；
- **同义目标判重与防重复创建准则（areTemplatesSynonymous）**：名称相同、别名命中或 Slug+归一单位一致时判定为同一目标并提示复用，严禁静默创建重复打卡项；
- **循证生活行为科学溯源**：系统显式化收录两分钟定律、久坐中断代谢保护、间隔重复、番茄工作法与 GTD 收件箱清零等行为科学来源元数据；
- **目录容量与健康度审计**：确立 120 项内置模板目录硬预算；现行全量 79 项内置模板实测 0 重复、0 Slug 冲突；
- **研究报告与守门测试**：输出 `docs/template-catalog-governance-study.md` 规范报告；落地 `tests/template-catalog-governance.test.cjs` 守门测试并纳入 `test:v18` 门禁（72 项全绿）。

# D-626：T-1671 Task Horizon Canonical Source 与过期 Fallback 研究收官（2026-10-29）

- **单一 Canonical Source（事实源）互斥原则（T-1671 收官）**：在 `features/taskhorizon-cooperation.ts` 建立纯逻辑模型，规范一个打卡项目在同一时刻只能绑定至多一种外部写入通道（普通复选框任务或内部打卡循环）；严禁同一个项目双向并发写入，彻底解决 Task Horizon 物理删除反选与小驴追加事实不可逆之间的架构冲突；
- **连接四态机与用户可解释性保障**：精确划分 `waiting`（等待打卡服务就绪）、`experimental-ready`（实验性日历图层就绪）、`disconnected-fallback`（服务断开/卸载安全隐藏）与 `incompatible-version`（低于 v5 友好提示）；
- **缓存 5 分钟安全 TTL 与过期严禁复活（Stale-Forbidden）**：日历投影设置 5 分钟安全过期上限（`TASK_HORIZON_PROJECTION_TTL_MS`），发生 `checkin:analytics-updated` 版本自增时投影缓存即刻失效，服务断开时坚决物理隐藏图层，严禁将历史缓存冒充实时数据；
- **研究报告与守门测试**：输出 `docs/taskhorizon-canonical-source-and-fallback-study.md` 研究报告；落地 `tests/taskhorizon-canonical-fallback.test.cjs` 守门测试并纳入 `test:v18` 门禁（71 项全绿）。

# D-625：T-1668 每 root 增量失效决策与渲染预算收官（2026-10-29）

- **六大变更类型最小失效域划分（T-1668 收官）**：在 `features/render-invalidation.ts` 建立纯逻辑决策器，规范化定义打卡、撤销、来源摄取、事项、偏好与诊断变更对不同工作表面的最小刷新范围，消除无意义全量重绘；
- **编辑器草稿绝对保护不变量**：任何后台定时刷新、外部事件入账或诊断心跳，坚决不重绘处于 `editor` 页面的表面（`skip-editor-draft`），杜绝表单数据与用户输入被意外抹平；
- **活动输入焦点挂起与失焦自愈**：当用户在卡片备注、搜索框或设置输入框中处于活动聚焦输入态（`hasActiveInput: true`）时，系统自动挂起后台重绘（`deferred-input`），并在输入失焦（`focusout`）后平滑补全刷新，彻底消除打字中光标跳失与内容丢失问题；
- **事项与来源心跳局部隔离**：来源摄取心跳与诊断日志更新仅针对设置页刷新状态行，Today/Review/Archived 完全免扰（`no-op`）；事项变异仅作用于 Today 与 Occasions，回顾与归档免于重绘；
- **帧预算与长任务量化监控**：落地 `evaluateRenderBudget`，以 16.6ms 单帧预算与 50ms 长任务为刚性门槛量化评估渲染耗时；
- **专项守门测试**：落地 `tests/incremental-invalidation.test.cjs` 守门测试并纳入 `test:v18` 门禁（70 项全绿）。

# D-624：T-1674 测试编排、覆盖清单与视觉脚本发现性收官（2026-10-29）

- **全量测试与 Harness 脚本覆盖审计（Zero Orphan Invariant，T-1674 收官）**：全面升级 `tests/test-suite-coverage.test.cjs`，实现对 338 项自动化测试（`*.test.cjs`）与 26 项浏览器/辅助 Harness 脚本（`*.cjs`）的双重零盲点审计，确保所有测试脚本要么由 `package.json` 显式驱动，要么由上层测试导入调用，要么在浏览器走查清单中明确注册，杜绝任何“孤儿脚本”；
- **视觉走查与扩展浏览器测试发现性补齐**：在 `package.json` 显式暴露 `test:visual`（`visual-qa.cjs`）、`test:walkthrough`（`width-walkthrough.cjs`）与 `test:browser:extended`（首成旅程、建议点击、模板包、设置搜索、敌意内容防御、提醒密度等 6 大场景）；
- **五级测试架构编排与 Flaky 治理规范落地**：撰写并持久化 `docs/test-matrix-orchestration.md`，规范 Tier 1 单元/模型、Tier 2 生态契约、Tier 3 表面会话、Tier 4 规模基准、Tier 5 真实走查的分层职责，固化无时钟纪律与防抖等待准则；
- **质量门禁严格守门**：`test:quality` 全流程 100% 验证通过。

# D-623：T-1666 视觉无障碍扩展、对比度、强制颜色与 200/400% 缩放收官（2026-10-29）

- **系统强制颜色规范映射（forced-colors: active，T-1666 收官）**：全面适配 Windows 高对比度/强制颜色模式，精准映射系统关键词（`Canvas`, `CanvasText`, `Highlight`）；卡片边框、进度条、聚焦环与按钮在此模式下由系统接管，杜绝暗色看不清或浅色刺眼；
- **高对比度实体轮廓与非颜色冗余**：在 `prefers-contrast: more` 下，核心交互按钮（`primary-button`, `record-button`, `save-button`, `secondary-button`, `destructive-button`）外展 `2px solid currentColor` 明确轮廓，表单输入框边框加粗至 2px；对比变化值均包含 `+` / `-` 正负文本符号，打卡与逾期状态包含图标与文字描述，杜绝单靠颜色传达信息；
- **减弱动效双闸保障**：系统 `prefers-reduced-motion: reduce` 与插件 `data-reduced-motion="true"` 双闸联动，动画与过渡时长统一压制到 `.01ms !important`，彻底消除界面震动与眩晕；
- **200%/400% 缩放与大字号防横向溢出**：全局落实 `overflow-wrap: anywhere` 与 `word-break: break-word`，确保 200% 与 400% 缩放下文本自然折行，消除横向滚动条撕裂；
- **专项守门测试**：落地 `tests/a11y-visual-extended.test.cjs` 守门测试并纳入 `test:v18` 门禁（69 项全绿）。

# D-622：T-1672 Dock Tomato 会话所有权、收件箱和多窗口失败演练收官（2026-10-29）

- **会话所有权与生命周期状态转移演练（T-1672 收官）**：全面覆盖 9 态提供方状态诊断（`missing`, `incompatible-version`, `incomplete-api`, `missing-capabilities`, `not-ready`, `ready`, `running`, `paused`, `error`）；验证携带 `consumer: "siyuan-checkin"` 上下文的启动、暂停与终止生命周期；
- **插件卸载与桥注销防泄漏保证**：验证 `installDockTomatoBridge` 在插件 `onunload` 卸载时，所有全局 DOM 事件监听（`tomato:focus-api-availability-changed`, `tomato:focus-session-completed`, `tomato:focus-ended`）与定时器 100% 注销，卸载后再收到外部事件时安全静默丢弃，杜绝内存泄漏或非法落盘；
- **提供方失效平滑降级与私有存储红线**：提供方版本不兼容或抛出异常时自动进入非活跃状态，维持实验/回退语义，严禁尝试侵入读取或修改提供方私有存储；
- **重复回写幂等与墓碑重放防护**：同一 `sessionId` 重复分发完成事件时被自动拦截判定为 `duplicate`，墓碑身份记录不被外部重放复活；
- **人工干预与双窗口并发合并闭环**：验证人工重试、人工丢弃与撤销跳过状态迁移；双窗口交错写入收件箱时在锁内通过 `mergeInboxStores` 执行确定性并集，旧快照不复活已处理条目；
- **专项守门测试**：落地 `tests/dock-tomato-lifecycle-drills.test.cjs` 守门测试并纳入 `test:v18` 门禁（68 项全绿）。

# D-621：T-1813 视觉 CSS 分层、单一来源治理与冗余规则清零（2026-10-29）

- **跨文件规则冗余清理与单一来源收敛（T-1813 收官）**：深度治理 `src/ui/components.scss` 与 `src/ui/workbench.scss` 跨文件规则覆盖，彻底清除 `.lc-checkin__compare > header` 遗留死结构与 `.lc-checkin__item-body`、`.lc-checkin__priority-reminder-row.is-primary` 完全镜像重叠声明；
- **顶栏导航标签选择器精简**：合并 `src/ui/workbench.scss` 中分散的多段 `.lc-checkin__topnav-tabs button` 声明，统一在单一规则块内管理字号、内边距与圆角；
- **重复规则体积清零与安全缓冲区扩充**：经 `cssAudit` 严密审计，产物全局重复规则体积降至 **0 字节（0 条重复规则）**；生产 CSS 编译体积从 696,252 字节下降至 **695,742 字节**（净释放 510 字节），距 680 KiB（696,320 字节）维护硬限拉开 **578 字节** 安全缓冲空间；
- **质量门禁严格守门**：855 个 class tokens **0 死类**；全套视觉回归（52 个几何场景）、主题与无障碍审计全部 100% 通过。

# D-620：T-1669 思源版本、桌面/移动/浏览器前端兼容矩阵刷新收官（2026-10-28）

- **5 大前端形态全覆盖与分级治理（T-1669 收官）**：全面梳理并在 `docs/siyuan-compatibility.md` 刷新能力与降级矩阵，对齐 `plugin.json` 中的 `desktop`、`desktop-window`、`browser-desktop`、`mobile` 与 `browser-mobile` 五大形态；
- **五大核心能力与平滑降级不变量**：
  - **下载导出桥**：检测 `JSAndroid`、`webkit.messageHandlers`、`JSHarmony` 原生注入接口（`/assets` 写入 + `saveExportFile` 接口），桌面与纯浏览器平滑降级为 `URL.createObjectURL(new Blob)` 纯 Web 下载通道，彻底杜绝移动 WebView 导航重定向重启崩溃；
  - **文档选择与搜索**：优先调用 `POST /api/filetree/searchDocs`，接口异常、未授权或网络超时时坚决保留手动输入文档 ID 通道，杜绝卡死设置流程；
  - **渲染块识别与隔离**：严格按 `data-subtype` -> `.language-checkin` -> `.protyle-action__language` 渐进识别，非活跃宿主保留代码块安全纯文本显示，不破坏思源文档 DOM 树；
  - **键盘与触控心流**：桌面端提供 `j`/`k`/`e` 快捷流、模态 Focus Trap 与 IME 组合输入 Esc 防护；移动端自适应 Safe Area、触控长按震动与紧凑排版；
  - **只读模式与发布服务**：保持 `disabledInPublish: false`，发布服务中完整渲染打卡热力图与看板，写操作友好拦截并提示只读，杜绝未捕获 403 抛出；
- **专项守门测试**：落地 `tests/frontend-compatibility-matrix.test.cjs` 守门测试并纳入 `test:v18` 门禁（67 项全绿）。

# D-619：T-1667 大数据集冷启动、索引和增量渲染基线收官（2026-10-28）

- **1k/10k/100k 冷启动与多桶并发归一化基线（T-1667 收官）**：建立冷启动与多桶并发加载基准；实测 1,000 事件冷启动耗时 ~6.8ms（堆增量 2.5MB），10,000 事件 ~29.1ms，100,000 事件仅 237.5ms（远低于 2000ms 预算），验证多桶并发归一化平稳无瓶颈；
- **索引懒构建与 O(1) 亚毫秒级查询**：依托 `getStoreIndex` 弱引用缓存，10k 规模索引构建仅 12.4ms，索引命中后单次 ID 查找仅 0.005ms，Today 今日视图基于日期索引扫描耗时仅 0.001ms；
- **四页扫描有界投影与增量变异复用**：Today、Review（半开日期范围 7.7ms）、Insights（单项目历史 0.02ms）与 Archived（归档过滤 0.003ms）全面基于索引实现有界切片；新增单一事件时仅耗时 ~11.8ms 局部重构，保证界面交互丝滑；
- **专项守门测试与 CLI 跑分工件**：落地 `tests/cold-start-baseline.test.cjs` 守门测试并纳入 `test:v18` 门禁（66 项全绿）；落地 `scripts/cold-start-benchmark.cjs` 脚本并持久化 `.artifacts/cold-start-benchmark.json` 机器可读指标。

# D-618：T-1621 & T-1663 跨表面 SurfaceContext 全量恢复矩阵、多 root 隔离与滚动复合键治理（2026-10-28）

- **全量 SurfaceContext 契约扩展与双向恢复模型（T-1621 收官）**：在 `features/surface-context.ts` 建立纯逻辑模型；全量打通 Today、Review、Archived、Insights、Editor、Occasions、Settings 七大页面的参数提取（`readSurfaceContext`）、原子应用（`applySurfaceContext`）与双向恢复矩阵；补齐设置与事项页返回路径记录（`returnPageForRoot`），消除从不同来源进入详情页后返回丢失上下文的缺陷；
- **滚动复合键隔离与防串台（getScrollTopKey，T-1663）**：实现按 `page:itemId` 派生滚动复合键，解决同在 Editor 或 Insights 页面切换不同打卡项目时滚动高度互相污染的问题；同时保留 `context.scrollTops[page]` 兼容基线，实现细粒度条目级与页面级双向平滑恢复；
- **无损序列化与跨表面多 Root 隔离审计**：落地 `serializeSurfaceContext` 与 `deserializeSurfaceContext`，支持状态往返无损序列化与严格校验防御；落地 `auditMultiRootIsolation` 纯审计接口，自动化检测多 root 间是否存在共享 draft 实例等串台污染隐患；新增 `tests/surface-context-restore.test.cjs` 守门测试并纳入 `test:v18` 门禁。

# D-617：T-1799 事件墓碑生命周期治理、容量上限与保活压缩策略全量收官（2026-10-28）

- **外部身份优先保活不变量（ExternalRef First Invariant，T-1799 收官）**：在 `features/tombstone-lifecycle.ts` 规范化落地 `pruneEventTombstones` 纯函数；带有 `externalRef` 的墓碑享有绝对优先保活权，彻底粉碎微信读书、叶归 LifeLog、思阅等外部来源重放时复活已删历史事件的风险；
- **容量硬上限与安全分级淘汰（EVENT_TOMBSTONES_CAP = 10,000）**：规范化设定 10,000 条墓碑硬容量上限与 8,000 条外部墓碑配额；当历史积累超出上限时，最陈旧的纯 ID 墓碑（无 externalRef、跨窗口复活风险趋零）按 `deletedAt` 升序优先平滑出局，彻底解除主档 `store.json` 与每次合并的膨胀危机；
- **健康度审计与性能基线**：在 `src/model.ts` 的 `normalizeEventTombstones` 接入自动容量修剪；落地 `auditTombstoneCapacity` 审计接口；实测 25k 级长历史墓碑修剪仅耗时 2.1ms（远低于 50ms 预算）；新增 `tests/tombstone-lifecycle.test.cjs` 守门测试并纳入 `test:v18` 门禁。

# D-616：T-1665 焦点恢复、键盘模态与 aria-live 降噪闭环（2026-10-28）

- **aria-live 降噪广播器（AriaLiveDeduplicator，T-1665）**：在 `features/a11y-focus-announcer.ts` 建立纯模型；过滤空消息与纯空白，实施通道级 3000ms 冷却期防噪抑制；状态未发生实质变更时坚决不重复灌入相同文本，彻底消除读屏软件频繁打断用户操作的噪音；状态实质变化时即刻放行。
- **键盘模态与 IME 组合输入防护**：实现 `evaluateModalKeydown`，当用户处于输入法拼音组合输入期间（`event.isComposing` 或 `keyCode === 229`），按下 Escape 与 Enter 绝不误触关闭对话框或提交表单，安全保护输入中的草稿；支持 Tab 键在模态首末可聚焦控件之间稳定循环（Focus Trap）。
- **失败后自动靶向首个可修复控件**：落地 `findFirstRepairableControl`，在表单校验失败、保存失败或初始化失败重试时，焦点按优先级自动定位到首个 `aria-invalid="true"`、`:invalid` 或重试操作按钮，杜绝焦点丢失至 `body` 导致键盘导航中断；新增 `tests/a11y-keyboard-focus.test.cjs` 守门测试并纳入 `test:v18` 门禁。

# D-615：T-1660 大规模映射选择、失效保留与批量校验闭环（2026-10-28）

- **大规模目标候选集搜索与有界分页（T-1660）**：在 `features/mapping-management.ts` 建立纯逻辑模型 `filterAndPaginateTargets`，针对 >200 项大规模候选项目提供实时模糊过滤与安全分页切片（默认每页 50~100 项），彻底消除全量 DOM 挂载造成的卡顿；
- **目标失效保留与换绑动作引导**：当关联的目标项目被归档、单位变更（如变更为非分钟）或被删除时，系统坚决保留原有映射与身份凭据，严禁静默删除或丢弃合法数据；在映射行显式呈现失效标记并提供换绑建议；
- **多维度批量校验与迁移预览（validateMappingsBatch & planMappingMigration）**：实现批量校验纯函数，深度识别重复来源名称、缺失目标、单位不兼容与字段残缺；支持新旧映射差异比对与迁移规划预览；新增 `tests/mapping-management.test.cjs` 守门测试并纳入 `test:v18` 门禁。

# D-614：T-1816 卡片、内层表面与 elevation 层级全量统一收口（2026-10-28）

- **对比与工作台组件全面收敛至 v3 语义 Token（T-1816 收官）**：将复盘对比卡片容器（`.lc-checkin__compare`）彻底从旧式硬编码圆角与色值迁移至 v3 统一卡片 Token（`card-border` / `card-bg` / `card-shadow` / `radius`）；将对比图表容器（`.lc-checkin__compare-chart`）、统计格（`.lc-checkin__compare-stat`）与折叠分组卡片（`.lc-checkin__compare-item-batch`）统一切换至内层表面 Token（`surface` / `border` / `radius-sm`）；
- **工作台概览与控制台表面对齐**：在 `workbench.scss` 中将 `.lc-checkin__overview-focus` 与 `.lc-checkin__console` 的固定 12px 圆角收敛至标准 `var(--lc-checkin-radius)` 令牌，消除 Today、复盘、事项与设置之间的视觉断层与圆角跳变；
- **产物体积与零死类严格守门**：生产构建 CSS 体积稳定处于 680 KiB 硬预算以内（696,252 字节，硬限 696,320 字节），0 死类，855 个 class tokens 零违规。

# D-613：T-1664 跨表面异步生命周期、代际与销毁清理审计闭环（2026-10-28）

- **统一异步生命周期管理器（AsyncLifecycleManager，T-1664）**：在 `features/async-lifecycle.ts` 建立统一资源与代际注册中心；统一管理 `timer`、`raf`、`listener`、`observer` 及各业务的 `generation`；实行 owner 分级管理（`plugin` 宿主级、`rootId` 表面级、`modal` 弹窗级），支持靶向单项注销、同键置换自动处置与按 owner 批量安全释放，彻底避免 root 间交叉误伤。
- **慢回执代际失效阻断**：任何异步操作发起时获取代际快照，完成时校验 `isCurrent(owner, key, generation)`，一旦 root 销毁、发生切页或新查询发起，旧慢回执自动静默丢弃，坚决阻断迟到数据覆盖新 DOM 或造成状态漂移。
- **onunload 全量释放与零泄漏审计**：在插件卸载与拆除收尾时统一执行 `asyncLifecycle.disposeAll()`，排空所有未完成定时器、关闭观察器并注销监听；暴露 `auditAsyncLifecycleLeaks()` 审计接口，自动化守门验证卸载后残留泄漏为 0；新增 `tests/async-lifecycle-audit.test.cjs` 守门测试并纳入 `test:v18` 门禁。

# D-612：T-1661 外部来源新鲜度、跨日切分与源时刻凭据闭环（2026-10-28）

- **四类来源事实凭据模型（Provenance，T-1661）**：在 `features/source-provenance.ts` 建立零副作用、无隐式时钟纯函数模型；统一规范并对账“来源原始发生时间（`sourceOccurredAt`）、摄取到达时间（`ingestedAt`）、结算业务日（`settledLocalDate`）与摄取时间窗口（`windowCovered`）”；严禁使用迟到或延迟的摄取时刻冒充源事件时刻。
- **历史日汇总结算业务日锚定**：针对微信读书等按天汇总拉取的场景，落地 `resolveSourceActionMoment`；当结算日早于当前摄取日时，事件发生时刻严格锚定在该业务日内（`YYYY-MM-DDT23:59:59.000Z`），杜绝因几天后才拉取而将 `occurredAt` 误写为当前摄取时间；叶归 LifeLog 严格保留 Marker 段落源发生时刻；思阅与思播严格遵守跨午夜切段与源段时刻映射。
- **来源新鲜度状态评估矩阵**：落地 `evaluateSourceFreshness`，根据摄取延迟与跨日对账深度，将各来源状态明确划分为 `live`（15 分钟内实时对账）、`delayed`（延迟结算）、`stale`（超过 24 小时或 2 天未摄取的陈旧状态）与 `idle`（未配置/未启用），为可观测性与诊断提供确定性凭据；新增 `tests/source-freshness-provenance.test.cjs` 守门测试并纳入 `test:v18` 门禁。

# D-611：T-1670 API v5 取消中断、快速失败、错误码统一与敏感字段防伪造纪律闭环（2026-10-28）

- **取消信号全覆盖与快速失败规范（T-1670）**：在 `events.record.batch` 批量写支持 `signal?: AbortSignal` 基础上，进一步为 `events.range.read` 范围读接入 `signal?: AbortSignal`，在信号中止时抛出 `Error("checkin: events range read was aborted")`；当宿主处于未就绪（`initializationState !== "ready"`）、卸载中（`disposing`）或已释放时，写操作快速失败拒绝 Promise，只读操作安全回落受控空集合，绝不挂起第三方调用方。
- **参数校验错误统一规范与限额硬预算**：统一所有 API 参数校验异常前缀为 `"checkin: "`，严格防御非法日期范围、非法 itemIds、非法 source 与超出上限的查询输入；在 `getStreaks` 增加 200 项上限截断消毒与类型校验，杜绝超大数组造成的计算挂死。
- **敏感字段脱敏与写入来源防伪造纪律**：公开 API 写入端（`recordEvent` 与 `recordEventsBatch`）严禁伪造内部自动化与适配器来源（`sireader`, `siplayer`, `weread`, `yeguif`）及内部手动来源（`manual`），外部写入一律强制收敛为 `source: "api"`；公开诊断接口 `getDiagnostics()` 强化敏感微信读书 Key（`wrk-*`）与本地真实文件路径的自动脱敏；所有返回对象提供防御性深拷贝或 `Object.freeze` 冻结副本；同步更新 `docs/api-v5.md`、`README.md` 与 `README_en.md`。

# D-610：T-1659 外部来源统一调度、指数退避与省电策略矩阵闭环（2026-10-28）

- **外部来源统一调度矩阵架构（T-1659）**：在 `features/source-scheduler.ts` 建立零副作用、无隐式时钟纯模型；将微信读书、叶归 LifeLog、健康收件箱、笔记推导、思播、思阅六大来源统一收拢到 `SourceScheduleConfig` 与 `SourceRuntimeState` 矩阵管辖下；统一调度启动拉取、定时轮询、手动立即拉取（`manual`）、失焦/回焦与卸载生命周期。
- **失败指数退避与自动自愈（Exponential Backoff with Cap）**：为各外部来源统一规范化失败退避算式（`baseBackoffMs * 2^(failures - 1)`，上限 `maxBackoffMs`，微信读书 base 30s / max 30min，叶归/健康 base 15s / max 5min，笔记推导 base 20s / max 10min）；退避期内非手动请求自动阻断，避免在断网或 SQL 故障期密集轰炸宿主与远程网络；一旦摄取成功立即清零连续失败计数，平滑恢复正常轮询。
- **前后台省电与回焦防抖策略（Foreground Throttling）**：窗口后台不可见时自动跳过轮询，避免移动端与后台常驻进程空耗电量与流量；切回前台（`handleWindowFocus`）统一执行 `triggerForegroundSources`；引入 `minForegroundIntervalMs` 防抖节流（微信读书 60s，叶归/健康/推导 30s），杜绝用户频繁 Alt+Tab 切换窗口造成密集并发拉取，严格保障“回前台只补一次”；新增 `tests/source-unified-scheduler.test.cjs` 守门测试并纳入 `test:v18` 门禁。

# D-609：T-1752 提醒方案推荐草案、触发预演与安静时段/事项单次提醒真实影响解释闭环（2026-10-28）

- **提醒方案推荐草案与用户确认边界（T-1752）**：在 `features/reminder-preferences.ts` 规范化定义四大典型提醒预设方案（`REMINDER_PRESET_SCHEMES`）：`minimal`（启动提醒/低打扰，留空时刻无定时打扰）、`morning`（晨间规划，09:00）、`review`（早晚复盘·推荐，09:00 与 21:00 双醒）、`frequent`（全天四段，09:00, 13:00, 18:00, 21:00）；设置页提供预设快捷填入胶囊，点击后一键注入时刻输入框并提示用户点击“保存时刻”确认生效，严格恪守“具体时刻和启用权由用户确认”的产品纪律，坚决不私自静默改写或隐式持久化。
- **实际触发预演与跨日/安静时段/事项仅一次真实影响解释（T-1752）**：落地纯函数 `simulateReminderTimeline`，零副作用、无隐式时钟侵入；精准区分“默认启用且无 slots＝启动后一条”与“定时槽位提醒”两大模式；计算当天剩余槽位与次日首批槽位（至多 4 节点）的未来触发序列并标注跨日本地时刻；对 22:00~07:00 等安静时段以及 `occasionRemindOnce` 事项提前提醒仅一次进行真实影响判定，直观解释冲突/静音/单次提醒免打扰状态；新增 `tests/reminder-preset-simulation.test.cjs` 守门测试并纳入 `test:v18` 门禁。

# D-608：T-1662 提醒排期计划预览、恢复今日提醒与 DST/跨午夜安静时段矩阵（2026-10-28）

- **提醒排期计划矩阵与双向免打扰自愈闭环**：在 `features/reminder-delivery.ts` 落地 `unmuteReminderDeliveryToday` 与 `buildReminderPlanPreview` 纯函数；全面建立槽位状态矩阵（`delivered`, `quiet`, `muted`, `due`, `upcoming`, `disabled`）；设置页直观呈现今日静音提示与计划预览，并提供“恢复今日提醒”操作（`unmuteDailyReminderTodayFor`），彻底化解误点免打扰后当日无法撤销的问题；严格验证 22:00~07:00 跨午夜安静时段、夏令时/冬令时（DST）本地挂钟时间与修改槽位多窗口强幂等；新增 `tests/reminder-schedule-preview.test.cjs` 守门测试并纳入 `test:v18` 门禁。

# D-607：T-1684 / T-1670 / T-1799 外部来源迟到响应代际守门、API v5 取消中断与墓碑生命周期治理（2026-10-28）

- **外部来源请求代际守门与写前动态复核全闭环（T-1684）**：全面覆盖微信读书、叶归 LifeLog、健康收件箱、笔记推导、思播、思阅六大外部生态来源，为各来源注入独立的代际计数器（`wereadGeneration`, `yeguifGeneration`, `healthGeneration`, `noteQueryGeneration`, `siplayerGeneration`, `sireaderGeneration`）；在 `enqueueMutation` 锁内写事实前，动态复核来源启用状态（`enabled`）、目标项目绑定（`itemId`, `finishItemId`, `notesItemId`, `metricBindings`）、笔记本/文档有效性以及配置指纹（`fingerprint`），并在叶归中动态复核分类映射解析，迟到响应可诊断丢弃，坚决不写旧目标；偏好重载与卸载时自增所有代际计数器，全链路阻断在飞请求复活；新增 `tests/external-late-response.test.cjs` 守门测试并纳入 `test:v18` 门禁。
- **API v5 批量写 AbortSignal 取消支持与快速失败（T-1670）**：`recordEventsBatch` 正式支持 `options?: {signal?: AbortSignal}`，在入队前与未执行时提前退出，拒绝并抛出 `Error("checkin: batch recording was aborted")`；在 `src/api.ts` 的 `recordEventsBatch` 中，统一在宿主未就绪、卸载中或已释放时快速失败（返回 Promise.reject），杜绝进入队列挂起；补齐 `tests/api-v5.test.cjs` 中的 AbortSignal 取消断言与宿主未就绪快速失败用例。
- **事件墓碑级联删除规范化与生命周期收口（T-1799）**：在 `deleteItemsCascade` 中统一调用 `normalizeEventTombstones` 规范化，消除脏墓碑未去重未排序隐患；固化 50k 事件与 25k 墓碑级规范化与检索性能；对齐《T-1799 墓碑生命周期设计》安全边界。

# D-606：T-1640 / T-1652 / T-1653 品牌图标、CI/CD 自动化门禁与样式可维护性台账核销（2026-10-27）

- **品牌规范、自动化工作流与样式架构核准**：全面核销 32×32 单色矢量图标 `iconLvCheckin` 与 256×256 经典长春花紫高清头像规范（T-1640）、GitHub Actions CI/CD 最小权限与并发取消自动化工作流（T-1652）、以及 SCSS 结构化瘦身与单一来源治理（T-1653）；851 个 class tokens 零死类、重复样式规则削减 94%，样式体积稳定处于 680 KiB 预算之内。

# D-605：T-1643 / T-1645 独立英文文档全覆盖与多语集市适配闭环（2026-10-27）

- **独立英文 README 与多语映射上线**：编写根目录 `README_en.md`，并在 `plugin.json` 映射 `"en_US": "README_en.md"`，英文环境思源集市直接呈现英文指南；全面对账并核销用户数据隐私与卸载说明（T-1643）及英文快速开始（T-1645）两项核心研发台账。

# D-604：T-1649 / T-1655 导出序列可等待与无障碍语义核心台账核销（2026-10-27）

- **导出可等待与无障碍树核验通过**：全面对账并核销 JSON/CSV/Markdown/Loop/Obsidian 导出透传可等待 Promise、多文件顺序执行与失败分类计数（T-1655），以及洞察日格、月历与热力图网格无障碍可访问树角色与读屏本地化播报（T-1649）；1372 组无障碍审计 0 违规完全通过。

# D-603：T-1673 诊断脱敏预览与一键复制到剪贴板闭环（2026-10-27）

- **诊断安全复制与隐私披露闭环**：在设置页诊断行弹出的预览对话框中增设 `data-diag-copy`（复制到剪贴板）按钮，支持在披露时间范围、原因码分布与脱敏明细预览后，一键安全复制已脱敏的诊断 JSON 文本至剪贴板，极大改善移动端和桌面端用户反馈报错的体验；守门测试 `tests/diagnostics.test.cjs` 增设全链路断言。

# D-602：T-1647 / T-1648 备份恢复全流程审计对齐与错误分类自愈闭环（2026-10-27）

- **多桶恢复审计断言同步与错误自愈**：深度对齐单主档与多桶 BackupEnvelope 导入校验、拒绝原因、持久化失败与本地快照恢复的全流程审计断言（`tests/restore-audit.test.cjs`），使 `test:backup` 全链路 100% 恢复全绿；核销 T-1647 与 T-1648 核心研发台账，底层错误分类器与脱敏诊断全部通过严苛回归。

# D-601：T-1942 移动端卡片长按微触感震动与菜单直达精确录入补卡实现（2026-10-27）

- **长按轻柔触觉震动反馈与菜单极速展开**：在 `today-bindings.ts` 中长按手势（520ms）成功触发时，安全注入 20ms 轻微触觉震动反馈（`navigator.vibrate(20)`），提升移动端物理跟手度；在卡片上下文菜单首位增设“✍️ 精确记录与补记”（`toggle-exact`），点击秒级展开当前卡片精确数值与备注面板并聚焦输入框；完成 Issue 建议全景调研，正式记录放弃侵入主线程的全局键盘监听与游戏化积分商店的技术决策，守住隐私与反焦虑底线。

# D-600：T-1941 复盘 Bento Grid 三色便当盒数据看板与样式深度瘦身（2026-10-27）

- **三色数据便当盒美学与样式冗余治理**：将 Review 复盘概览顶部数据统计卡片（`lc-checkin__summary-stats`）全面重构为 Bento Grid 三色便当盒数据看板，分别注入长春花紫（`#6366F1`）、翡翠绿（`#10B981`）与阳光暖橙（`#FB8C00`）微底与边框，三格便当盒层次分明，视觉质感跃升；清理 `components.scss` 中关于文档选择器、组合包预览行等 5 处完全重复的跨块单行声明，产物体积稳固维持在 680 KiB 维护硬上限以内（696,148 bytes），0 死类。

# D-599：T-1940 连续打卡暖橙同心水波纹底纹落地与发丝边框立体层级注入（2026-10-27）

- **暖橙同心水波纹仪式感与全主题发丝边框**：在 Today 连续打卡大卡片正式落地经典暖橙（`#FB8C00`）同心同轴多层水波纹底纹（Concentric Ripples）与动态高光，标题处衬以明快热烈的“🔥”标志，赋予用户强烈的坚持仪式感；在 Design Tokens 层级为卡片注入 0.8px 内嵌半透明微发丝边框（`0 0 0 0.8px var(--lc-checkin-border)`），加固极简白底与 OLED 纯黑主题下的立体对比度，彻底杜绝溶图（推进 T-1816）；同时清理 4 处冗余 SCSS 规则，重复规则体积削减 94%，产物体积稳固维持在 680 KiB 预算之内（696,213 bytes，0 死类）。

# D-598：T-1939 思源多维数据库自动收集块属性自动注入与日记 LifeLog 深度升级（2026-10-27）

- **多维属性标准注入与自动化看板收集**：在 `appendLifelogToJournal` 与 `syncTodayCheckinsToLifelogJournal` 中，当段落块追加成功后，自动调用 `/api/attr/setBlockAttrs` 注入 `custom-lv-checkin-item`、`custom-lv-checkin-item-id`、`custom-lv-checkin-val`、`custom-lv-checkin-date`、`custom-lv-checkin-unit` 与 `custom-lv-checkin-kind` 块属性，无缝对接思源 3.8.8+ 多维数据库自动化收集机制；旁路异步执行，异常安全降级，不阻断主打卡与本地存储事务。

# D-597：T-1632 / T-1639 / T-1642 / T-1644 组合包部分应用与规范台账闭环（2026-10-27）

- **组合包部分应用与核心台账核销**：系统核验并闭环组合包部分应用与已有项目规则冲突差异对比（`lc-checkin__pack-diff`）及锁内原子回滚机制（T-1632）；全面对账并核销工具链兼容契约（T-1639）、任务型用户指南与全景索引（T-1642）和社区单一主干贡献准则（T-1644）核心台账，消除文档与实现的对账滞后。

# D-596：T-1938 报告偏好白名单测试断言与单一常量同源契约对齐（2026-10-27）

- **消除测试中陈旧字面断言死锁**：在 `tests/report-deviations.test.cjs` 中，将历史写死的 6 来源字面断言更新为匹配当前 `REPORT_SOURCE_VALUES` 单一生产常量，确保来源白名单在扩展（加入微信读书与叶归等来源）后，守门测试与业务代码保持同源一致。

# D-595：T-1937 今日上下文菜单 mock 事件模型补齐 stopPropagation（2026-10-27）

- **补齐事件模型接口消除 TypeError**：在 `tests/today-context-menu.test.cjs` 中为测试 mock 事件对象补齐 `stopPropagation() {}` 接口，解决键盘 Escape 阻止事件冒泡安全逻辑在测试环境下因方法缺失抛出运行时异常的问题。

# D-594：T-1936 lifelog-timeline 测试沙箱依赖注入补齐（2026-10-27）

- **解决单测沙箱依赖缺失崩溃**：在 `tests/lifelog-timeline.test.cjs` 的模块加载函数中补齐 `../shared` 的 `escapeHtml` 依赖注入，彻底解决因为新增标签微徽标转义引入的沙箱加载异常，恢复测试全通。

# D-593：T-1935 技术文档全景索引中心上线（2026-10-27）

- **统一文档入口与四维分类导航**：在 `docs/README.md` 建立技术文档全景索引，系统梳理核心活跃规范（架构/身份/合并/API v5/低压力基线）、生态联动契约（LifeLog/微信/笔记推导/健康/Task Horizon）、质量运维保障与历史归档四维矩阵；并在根目录 `README.md` 同步挂载入口，消除 200+ 散落文档引起的查阅认知障碍。

# D-592：T-1934 测试批处理执行器落地与长命令行超时防御（2026-10-27）

- **轻量进程批调度与透明错误定位**：落地 `scripts/run-tests.cjs`，提供子进程池化执行、进度统计与退出码透明转发，防范跨平台超长命令行调用瓶颈与单命令超时挂死风险，提升本地测试验证效率。

# D-591：T-1933 CSS 瘦身与预算防御（推进 T-1813，合并冗余容器查询，为 680 KiB 释放安全空间）（2026-10-27）

- **消除重复声明与容器查询合并**：清理 `components.scss` 与 `maintenance-responsive.scss` 中跨段完全重复的单行规则（如 `.lc-checkin__mobile-nav button:last-child`、`.lc-checkin--today .lc-checkin__item-topline`、`min-height: 40px/42px` 与 `template-summary small` 等），重复规则体积削减近 90%（从 664 字节降至 86 字节），产物体积严格维持在 680 KiB 硬预算内（696,104 bytes < 696,320 bytes），0 死类，化解样式膨胀风险。

# D-590：T-1932 打卡完成反馈弹窗 Bento 视觉美学重构（闭环 Issue #36 & #37）（2026-10-27）

- **全方位美化成功回执打破简陋反馈**：重构 `RecentRecordView` 与完成 Toast 样式，采用长春花紫（`#6366F1`）高光边框 + 蜂蜜暖金里程碑底色，左侧嵌入翡翠绿饱满对勾徽章，中间以微胶囊呈现打卡事实与当日进度，右侧提供柔和的“查看”与“撤销”按钮；严格保障 260ms 微弹跳动效与 reduced-motion 0ms 纯平切降级，完美满足 `checkin-toast.test.cjs` 全部断言并彻底闭环用户反馈。

# D-589：T-1931 Dependabot 安全依赖审查与锁表升级（2026-10-27）

- **修复潜在安全漏洞**：将 `serialize-javascript` 平滑升级至 7.1.4，`source-map-js` 升级至 1.2.2，修复 CVE-2026-93749 安全隐患，lockfile 重新校验通过，生产构建与类型检查 0 报错。

# D-588：T-1930 贡献指南版本号与单主干规范同步（2026-10-27）

- **消除文档版本滞后与分支误导**：将 `CONTRIBUTING.md` 中写死的旧版本号 v18.17.2 更新至当前基线 v18.29.0，移除已合入历史的双机开发分支指引，统一明确以 `main` 分支为单一主干。

# D-587：T-1929 README 与 ui-docs 守门契约对齐（2026-10-27）

- **修复版本更新分类缺失**：在 `README.md` 的“本次更新（18.29.0）”增设 `新增：集市升级索引与国际化兼容键支持` 分类，满足 `tests/ui-docs.test.cjs` 对新增/优化/修复完整分类链的断言要求。

# D-586：T-1928 review-assistant 单测沙箱补齐 charts 依赖注入（2026-10-27）

- **解决单测 ReferenceError 崩溃**：在 `tests/review-assistant.test.cjs` 的 VM 上下文中注入 `charts.ts` 导出的 `buildAnalyticsSnapshot`，消除 T-1922 回顾安全降级引起的测试执行崩溃，`review-assistant.test.cjs` 恢复绿灯。

# D-585：T-1657 微信读书三链路状态精细化回显与异常透明化（2026-10-27）

- **三链路状态独立回显打破盲盒反馈**：在 `settings.ts` 中重构 `wereadPullStatus` 状态拼装，全面消费 `ctx.wereadLastPull` 中的完读书目（`finished: {written, pending}`）、划线笔记（`notes: {status, tally}`）、存储待重试（`pendingRetryable`）及网关升级提示（`upgrade`），以分号结构化呈现多维度结果（如“上次拉取：30天记录，新写入 1 条；完读：写入 0 本，待读完 2 本；划线：已入账 5 条”）；在 `incomplete` 时明确提示“数据未完整，保留待重试”，杜绝局部成功被误读为全链路成功，全面闭环 T-1657。

# D-584：T-1869 存储错误细分分类器与只读/配额/超时精准反馈（2026-10-27）

- **底层异常语义化与自愈引导**：落地 `src/features/storage-failure.ts` 中的 `classifyStorageFailure`，对存储与内核层错误细分为 `readonly`（只读工作区）、`quota-exceeded`（配额超限）、`auth-failed`（认证失效）、`timeout`（通信超时）、`unavailable`（服务不可用）与 `unknown`；在 `safeUserErrorDetail` 接入双语自愈提示，杜绝向用户暴露技术晦涩码，同时保障当前会话草稿完好保留，新增 `tests/storage-failure-classification.test.cjs` 守门并纳入 `test:v18`，全面闭环 T-1869。

# D-583：T-1656 & T-1870 导入/恢复缓存确定性失效与模板字段保留（2026-10-27）

- **全通道数据流变更后缓存即时失效**：在 `onDataChanged`、CSV 导入、Loop 导入、Obsidian 导入、重名冲突合并、快照恢复以及 JSON/Envelope 恢复的所有成功路径中，统一追加 `this.invalidateSummary()` 与 `clearAnchorResolveCache()`，彻底终结数据变更后回顾周复盘 AI 摘要与笔记锚点解析缓存陈旧的隐患；在 `normalizeStore` 中保留嵌入式 `templates` 数组，杜绝历史备份数据在结构规范化时丢失模板，新增 `tests/cache-invalidation-and-projection.test.cjs` 守门并纳入 `test:v18`，全面闭环 T-1656 与 T-1870。

# D-582：T-1868 外部事件摄取附件与精力维度类型安全穿透支持（2026-10-27）

- **外部写入参数完备性与安全边界加固**：在 `recordExternalEvent` 中补齐对可选 `attachment` 与 `energy`（1~5 整数）的安全校验与摄取透传；附件由 `normalizeAttachmentDataUrl` 严格执行 700KB 内存上限与 base64 语法校验，非图片数据与越界数据拒绝入账同时保留打卡事实，新增 `tests/attachment-boundary-ingest.test.cjs` 守门并纳入 `test:v18`，全面闭环 T-1868。

# D-581：T-1867 主档与多格式迁出来源身份保留与冲突台账固定（2026-10-27）

- **全通道跨格式身份与冲突台账契约化**：在 `docs/identity-and-merge.md` 中增设第六节《跨格式身份保留与冲突台账》，系统性固化 JSON 主档、多桶 BackupEnvelope、CSV 记录导入、Loop CSV、Obsidian H21 及外部生态联动在项目 ID 生成、事件 ID 派生、externalRef 幂等凭据、同名异规则冲突（`ImportConflictDecision`）和字段损耗维度的确定性处理规则，守门 `tests/export-identity-docs.test.cjs` 同步加固，全面闭环 T-1867。

# D-580：T-1864 纯函数层块链接、排期格式化与步长国际化无死角对齐（2026-10-27）

- **消除纯函数与编辑器遗留写死中文**：在 `shared.ts` 中将思源块链接悬浮标题从硬编码“打开思源块”收敛为双语字典 `anchor.openBlock`；将 `formatScheduleLabel` 中的间隔与配额周期标签重构为双语占位符字典解析（`schedule.intervalN`、`schedule.quotaSummary`、`schedule.quotaDays`、`schedule.quotaUnits`）；为 `getRecordStep` 与 `getEditorStep` 注入英文常用单位（`hour`, `hours`, `h`, `ml`, `g`, `kg`, `km`, `l`）兼容，并消除 `bind-editor.ts` 用户模板默认备注写死中文，达成 2,920 组双语键 100% 奇偶对等。

# D-579：T-1861 用户模板与图标单桶事务化，移除编辑器裸 saveData（2026-10-27）

- **编辑器辅助桶持久化强契约化**：在 `BindEditorHost` 中将 `persistUserTemplates` 与 `persistCustomIconLibrary` 声明为必需方法，彻底从接口中剔除 `saveData` 裸调用。编辑器内所有个人模板保存、模板删除和自定义图标上传必须收敛至 `CheckinPlugin` 的存储互斥锁（`withStorageLock`）、远端增量对齐与快照回滚管线，杜绝无锁直接写覆盖与跨窗口删除复活缺陷，全面闭环 T-1861。

# D-578：T-1866 页面级与辅助入口视图偏好失败回滚全收口（2026-10-26）

- **消除最后裸调用与内存持久层分叉**：将 `navigation.ts`（洞察页跳转记录）、`plugin-ops.ts`（导出时间戳记录）、`bind-today.ts`（Today 折叠展开重置与回顾折叠）中的偏好持久化全量收敛至 `applyPreferenceMutation` / `persistPreferenceMutation`；消除剩余的裸调用分支，保证在磁盘写入异常时内存快照与界面状态原路回滚，彻底闭环 T-1866。

# D-577：T-1927 报告来源偏好白名单补齐与双向绑定加固（2026-10-26）

- **全来源合法值对齐**：在 `view-preferences.ts` 的 `REPORT_SOURCE_VALUES` 与 `bind-page-navigation.ts` 中补齐 `sireader`、`siplayer`、`weread` 与 `yeguif` 外部生态来源白名单，修复此前选定微信读书或叶归来源时在偏好归一化阶段被重置为空字符串的问题，确保报告来源筛选与视图偏好 100% 同源且持久化一致。

# D-576：T-1863 CSV 导入表头缺失与错误行明细可见化（2026-10-26）

- **缺失列精准诊断与复合原因明晰**：在 `parseCheckinCsv` 中，当缺少名称列（名称/name/itemname）或日期列（日期/date/localdate）时，不再返回空 errors 数组导致导入界面静默报空，而是精准定位第 1 行并返回具体的缺失列诊断；修复名称缺失与日期无效并存时的复合原因组合，将错误明细上限扩充至 20 行并在设置页回显真实跳过行数，彻底消除“不知道哪里格式错”的痛点。

# D-575：T-1926 CSV 与 Loop 历史导入哈希去重优化（2026-10-26）

- **O(1) 预索引消除平方级扫描**：在 `importCsvRowsInto` 与 `importLoopPlanInto` 中使用 `Set<string>` 提前预索引已有事件唯一键（`itemId:localDate:value:unit`），对齐 `importObsidianHabitsInto` 的高效设计，将大批量数据导入（如数千行历史记录）从 O(M * N) 优化为 O(M + N)，避免高频长时间占用主线程。

# D-572：T-1921 跨窗口快进合并（Fast-Forward Merge）伪冲突排雷（2026-10-25）

- **无本地改动不记冲突**：在 `enqueueMutation` 吸收远端数据变更时，引入 `hasLocalChanges = !areNormalizedStoresEqual(this.lastPersistedStore, this.store)` 严谨门禁；仅当本地存在未保存修改且远端也发生变化时才归类为真正版本冲突，杜绝接收方单纯快进合并时记录虚假冲突审计与多余的写放大。

# D-573：T-1922 回顾渲染分析快照安全降级兜底（2026-10-25）

- **HTMLElement 类型强转防御**：根治 `renderReview` 在 `analyticsSnapshot` 为空时错误回退到 `(root as unknown as AnalyticsSnapshot)` 导致的 `asOf.split` 空指针异常；统一由 `buildAnalyticsSnapshot(this.store, currentCalendarDate())` 实时生成有效快照，确保建议决策与后台刷新平滑无感。

# D-574：T-1923 浏览器走查环境 Google Chrome 纯净化锁定（2026-10-25）

- **严格禁止 Edge 依赖**：将 E2E、Playwright、视觉走查、性能测试与宽度走查脚本中的浏览器解析链路全面收敛至系统 Google Chrome 与 Playwright 纯净 Chromium，彻底杜绝调用 Edge。

# D-570：T-1919 报告导出全来源筛选过滤支持（2026-10-24）

- **全来源报告声明对齐**：在 `buildWeeklyReportMarkdown` 中扩展 `REPORT_SOURCES` 白名单覆盖 `sireader`、`siplayer`、`weread` 与 `yeguif`，确保用户按特定外部联动来源导出报告时，统计范围准确回显来源声明行。

# D-571：T-1920 项目趋势比对事件哈希预索引算法优化（2026-10-24）

- **预聚合杜绝内循环全量遍历**：在 `buildItemTrendSeries` 中使用 `Map<string, CheckinEvent[]>` 提前按日期对项目事件预归类，杜绝在 31 天循环内每步都全量过滤 `store.events`，将算法复杂度从 O(31 * N) 彻底优化为 O(N)。

# D-567：T-1915 笔记推导一键快速创建绑定与五大集成大圆满（2026-10-24）

- **五大集成 100% 极简闭环**：在设置页笔记推导行增加“快速创建并绑定”按钮，自动生成标准二值“笔记打卡”（✍ 1次）项目并自动赋值给 `noteQuery.itemId`，彻底解决外部集成手动创建打卡项目的断点。

# D-568：T-1916 跨午夜生命周期旧日映射与临时回执安全清理（2026-10-24）

- **午夜内存纯净治理**：在 `refreshDateBoundary` 中重构跨午夜清理逻辑，跨日自动清空 `recentLifelogBlocks`、残留 `recentRecord` 回执与 `pendingLocalItem*` 变量，消除内存累积与误撤销昨日日记段落隐患。

# D-560：T-1908 设置页一键快速创建并绑定联动打卡项（2026-10-23）

- **设置页开箱即用闭环**：在思阅与思播目标项目下拉框旁提供“快速创建并绑定”按钮，点击时自动选用“思阅精读”或“思播精听”标准分钟模板，若库中未创建则自动创建、启用联动并持久化视图偏好，彻底消除用户手动创建与绑定的认知负担。

# D-559：T-1907 思播上游事件驱动加固与全生态联动内置模板组（2026-10-23）

- **思播 v1 播放事件监听**：除旧版 `mediaChanged`、`playerDestroy` 外，在 `startSiplayerSampler` 中全面监听思播 Issue #180 官方定义的 `siplayer:play/pause/ended`，暂停或结束时毫秒级立即结算，消除 15s 轮询等待延迟；
- **全生态开箱即用模板**：在 `CHECKIN_TEMPLATES` 新增思阅精读、思播精听、闪卡复习、考证刷题、拾遗精读、人脉关怀、管家事务 7 款联动模板，并在 `TEMPLATE_PACKS` 增设 `ecosystem` 专属组合包，极大降低用户跨插件联动的使用门槛。

# D-557：T-1904 Epoch 6 跨插件联邦事件信封广播（2026-10-23）

- **统一信封包装**：在 `emitIntegrationEvent` 中为 CustomEvent 注入 `v: 1`、`source: "siyuan-checkin"`、`eventId`、`at`、`idempotencyKey` 与 `payload` 统一信封格式，使小驴雷切等组件能直接解包消费并实时同步刷新，同时保留既有字段展开兼容。

# D-558：T-1906 Today 行动轨迹抽屉空态透明度与日记直达保持（2026-10-23）

- **零记录空态可发现**：重构 `renderTodayLifelogTimelineView`，今日无打卡时依然展示轻量折叠抽屉，呈现友好空态提示并保留“打开今日日记文档”直达入口，确保功能入口永久透明稳定。

# D-554：T-1901 LifeLog 换行清洗与项目名冒号转义排雷（2026-10-23）

- **多行换行压平**：在 `formatLifelogEntry` 中将备注中的 `\r` 和 `\n` 统一替换为空格并压缩连续空白，避免追加到日记时生成多行碎片块；
- **冒号冲突转义**：将项目名中的冒号（全角 `：` 或半角 `:`）替换为中划线 `-`，保证冒号仅作为 LifeLog 的元数据分隔符，避免叶归等 Marker 解析器发生字段截断。

# D-555：T-1902 CSS 冗余规则合并与单一来源治理（2026-10-23）

- **镜像容器合并**：合并 `@container lc-dialog` 与 `lc-tab` 的镜像样式，安全消除 7 处跨段完全重复规则；
- **预算护栏安全恢复**：编译后 CSS 总体积缩减 699 字节（695,489 bytes），重复规则体积减少 414 字节，彻底化解 680 KiB 维护硬上限触顶风险。

# D-556：T-1903 Today 搜索框键盘流与输入法保护（2026-10-23）

- **输入法安全拦截**：搜索输入框严格守卫 `isComposing || keyCode === 229`，拼音选字阶段绝不误触发搜索或快捷动作；
- **键盘极速打卡闭环**：Enter 键直达 NLP 推荐或聚焦单一匹配卡片，Escape 键一键清空搜索词并即时重置卡片列表。

# D-553：后续按小版本（18.x.0）持续发版与集市抓取机制（2026-10-23）

- **版本步进策略**：为保证思源官方集市（Bazaar）对插件新特性（尤其是跨插件联邦、图标与日记 LifeLog 联动）的即时感知与抓取，后续每个阶段或里程碑交付后，统一递增语义化小版本（如 `18.20.0` ➔ `18.21.0`）；
- **全链路自动构建与签名**：坚持在本地运行完整构建流水线生成 `package.zip` 并计算 SHA-256 写入 release-notes，严禁未经验证空发 Release；
- **双端同步**：推送 main 分支同时推送版本 tag（`git push origin v*`），并挂载 `package.zip`, `dist/index.js`, `dist/index.css`, `plugin.json` 四大核心产物到 GitHub Release。

# D-549：T-1897 Epoch 6 跨插件联邦 SDK 四别名安全挂载与注销（2026-10-23）

- **四别名首实例独占（First-Instance-Wins）**：挂载 `siyuanCheckin`, `LvCheckin`, `lvCheckin`, `xiaolvCheckin` 四别名，若已有窗口或实例挂载则不覆盖，在 `this.mountedAliases` 中记录所有权；
- **身份核验安全注销**：卸载阶段严格校验 `w[alias] === this.api` 后再执行 delete，杜绝误删新打开窗口的 API 引用。

# D-550：T-1898 全生态 externalRef 前缀收录与雷切小组件注册（2026-10-23）

- **全生态前缀权威收录**：在 `EXTERNAL_REF_PREFIX_REGISTRY` 正式注册 `exam:`, `cards:`, `glean:`, `contacts:`, `home:` 兄弟插件引用格式，保证同日打卡幂等去重对账的一致性；
- **雷切小组件安全注销**：通过 `registerRaikiriModuleSafely` 注册连续坚持小组件，无雷切时静默返回，卸载时调用返回值自动注销。

# D-551：T-1899 顶栏与侧栏 32×32 单色矢量图标升级（2026-10-23）

- **单色高灵动设计**：将 `iconLvCheckin` 升级为 32×32 纯矢量单色（圆角便签卡 + 饱满对勾 + 勋章点），与思源系统主题图标风格严密融合；
- **独立资产保护**：根目录 256×256 高清彩色头像 `icon.png` 保持不变，顶栏默认优先使用单色图标。

# D-552：T-1900 经典长春花紫+暖橙 Bento 美学升级与工程排雷加固（2026-10-23）

- **品牌美学系统**：注入 `--lv-brand: #6366F1` 经典长春花紫与 `--lv-accent-orange: #FB8C00` 暖橙跳色，连续打卡大卡片呈现水波纹同心圆底纹，按钮增加物理微触感；
- **工程排雷落地**：`plugin.json` 启用 `settingsWindow: true` 独立大窗，输入框 keydown 拦截输入法组字态，二级弹窗 Escape 阻止冒泡防击穿；`showMessage` 统一前缀 `[小驴打卡]` 且报错延时 6000ms。

# D-547：T-1895 思源 v3.8.8+ 官方桌面紧凑模式自适应（2026-10-22）

- **双层紧凑机制协同**：除插件自身内部对 `.lc-checkin-dock-host` 自动紧凑外，全面响应思源官方全局紧凑选择器 `:root[data-ui-density="compact"]`，分屏 Tab 与弹窗自动同步降维缩放至 0.9，高度收窄至 30px，与思源系统视觉节奏严密对齐。

# D-548：T-1896 思源官方插件生命周期（Petal Lifecycle）契约加固（2026-10-22）

- **对齐官方生命周期签名**：`onDataChanged(data?, reason?)` 完整捕获外部传参，重写生命周期保障多窗口数据变更时不被思源粗暴整包重载（避免丢失会话中草稿）；
- **清零已弃用接口**：确保全仓 0 引用思源 v3.8.8 正式移除的 `Protyle.updateTransaction`，坚持使用标准的 `/api/block/appendBlock` 与 `/api/block/deleteBlock`；
- **自驱清理与预算闭环**：卸载阶段由插件自身完全清理自定义定时器与 window 监听，存储落盘严格限定在 4.5s 预算内，在官方 5s 强制超时前安全着陆。

# D-544：T-1892 Today 行动轨迹抽屉展开状态会话保持（2026-10-22）

- **抽屉状态会话记忆**：在 `TodayRootContext` 增设 `todayLifelogFoldOpen`，在 `[data-today-lifelog-fold]` 派发 `toggle` 时实时记录，解决打卡刷新后抽屉被强制关闭的问题，保护用户的心流连续性。

# D-545：T-1893 成功回执与事实面板展示日记同步信号（2026-10-22）

- **落盘可见性**：在 `RecentRecordView` 扩充 `lifelogSynced`，开启日记同步后在完成 Toast 回显 `📓 已同步日记` 徽章，并在事实面板注明同步状态，极大增强物理落盘的确定感。

# D-546：T-1894 Review 回顾页 LifeLog 时间轴按日卡片化分组（2026-10-22）

- **长周期结构化**：在周复盘与月复盘中，`renderLifelog` 按日期自动分桶输出 `.lc-checkin__lifelog-day-group` 卡片流，并赋予 `data-lifelog-date` 属性，与历史日历快速钻取无缝打通。

# D-541：T-1889 打卡照片附件智能同步至日记 LifeLog（2026-10-22）

- **图文混排时间线**：当打卡带有图片附件时，`formatLifelogMarkdownBlock` 在 LifeLog 纯文本时间线后追加标准 Markdown 图片语法，实现真正图文并茂的日记归档体验；
- **安全白名单拦截**：图片来源必须符合安全白名单（`data:image/`、`assets/`、`https://`），不合法或危险内容不生成图片标签。

# D-542：T-1890 Today 页面增设“今日行动轨迹 (LifeLog)”轻量抽屉与日记直达（2026-10-22）

- **首页闭环体验**：打破“必须切 Review 才能看时间线”的断层感，在 Today 首屏底部呈现今日行动时间流，为习惯坚持提供即时的正向反馈；
- **0 距离日记跳转**：通过思源公开 `openTab` API 快速直达当日日记文档，打通从小驴打卡到思源主界面的双向通道。

# D-543：T-1891 Review 时间轴智能解析 #标签 为精美微徽标（2026-10-22）

- **信息层级分层**：通过正则匹配 Unicode 标签语法，将 `#晨间打卡`、`#深度专注` 等快捷备注转为紫罗兰高可见度胶囊，提升读屏与视觉双重质感。

# D-538：T-1886 撤销打卡联动清理日记 LifeLog 块（2026-10-22）

- **块 ID 内存追踪与精确删除**：`recentLifelogBlocks` 以 `eventId` 为键记录 `appendBlock` 返回的段落块 ID；撤销（`undoRecentRecord`）时向思源内核触发 `/api/block/deleteBlock`，确保用户撤销操作与日记物理文档保持双向数据一致性；
- **失败安全降级**：若日记文档已被用户手动锁定或删除，内核异常安全捕获，绝不阻塞主打卡事务撤销与本地 Store 回滚。

# D-539：T-1887 一键批量同步今日打卡至日记 LifeLog（2026-10-22）

- **批量补写与多设备收敛**：解决用户在移动端打卡后回到电脑需归档至日记的场景，`syncTodayCheckinsToLifelogJournal` 一键将今日全量事实格式化并追加；
- **SQL 内容预检去重**：通过预先比对日记中已存在的文本内容，杜绝重复追加造成的日记冗余。

# D-540：T-1888 设置页日记 LifeLog 即时预览与测试通道（2026-10-22）

- **所见即所得**：纯函数 `previewTodayLifelogMarkdown` 为设置页提供零写入的就地展开排版预览，用户修改分节标题可即时预览渲染效果。

# D-537：T-1885 LifeLog 深度联动优化与双向互操作增强（2026-10-22）

- **冒号前纯净项目名规范**：LifeLog 格式必须保持 `HH:mm 项目名：[详情]`，严禁在冒号前插入括号或数值修饰，以确保叶归等以冒号为界的主流 Marker 解析器能够 100% 精确提取 `type` 并与项目映射表匹配；
- **全事实时间轴融合呈现**：Review 中的 LifeLog 时间轴不再是叶归专属，而是个人每日/每周行动流的综合工作台；所有带发生时刻的打卡事实平等进入时间线；
- **智能分节与幂等降级**：通过思源 SQL 查询定位目标标题块作为父节点；标题缺失自动建标题，API 异常时安全捕获并降级，绝不影响打卡主事务。

# D-534：T-1882 思阅适配器 v2.5.6 移动端与书名感知升级（2026-10-22）

- **移动端全场景生命周期接入**：在事件列表中扩充 `reader:mobile-open` 与 `reader:mobile-close`，使思源 Android/平板端在思阅阅读时同样能无缝触发计时；
- **书名纯文本提炼与打卡备注回溯**：纯函数 `extractSireaderBookTitle` 从 `event.detail.bookUrl` 中解析出文件名、剔除常见扩展名（`.epub` / `.pdf` / `.mobi` 等）并解码 URI，在打卡事实中附带 `#思阅阅读 《书名》` 备注，强化打卡事实的上下文可信度；
- **启动即刻感知**：监听 `sireader:api-ready` 全局事件，启动后无需手动刷新即可感知思阅连接状态。

# D-535：T-1883 思播适配器 v2.0.9 事件驱动与媒体标题接入升级（2026-10-22）

- **事件驱动结算与防漏计**：监听 `mediaChanged` 与 `playerDestroy` 事件，播放器销毁或换集时立即将未结算片段 flush 出库入账，彻底解决此前必须等待下一个 15s 定时器周期才可能结算的滞后漏洞；
- **媒体标题提取与入账**：通过 `controller.getCurrentMedia()` 提炼媒体标题，以 `#思播播放 《标题》` 注入事件备注；
- **轮询防空转降频**：播放器暂停或销毁期间不进行高频空转，保护后台 CPU 资源。

# D-536：T-1884 打卡/跳过事实实时以 LifeLog 规范追加到当日日记（2026-10-22）

- **标准格式规范**：采用叶归及主流日记通用的标准 LifeLog 格式 `HH:mm 项目名 (数值单位)：备注 ⚡精力`，保证无论是人类直接阅读，还是第三方时间线插件解析，均具有最高兼容性；
- **异步旁路尽力而为（Fire-and-forget）**：追加写入在主打卡事实持久化成功后异步执行，定位当日日记文档失败或内核 API 异常时安全捕获并记录审计，绝不阻断或破坏主打卡与本地存储事务；
- **Opt-in 偏好隔离**：在 `CheckinViewPreferences` 增设 `lifelogJournal`，默认关闭；支持在设置页一键启停，并可选控制是否包含跳过记录。

# D-533：T-1881 跳过理由与阻力归因轻量记录及复盘看板（2026-10-21）

- **阻力归因纯函数与语义映射**：`detectFrictionCategory` 把跳过备注解析为 6 类标准阻力（`time`、`health`、`environment`、`rest`、`reschedule`、`other`），不改底层 Store Schema，通过 `CheckinEvent.note` 纯文本实现完全向前与向后兼容；
- **菜单免打字快捷跳过与原生自定义兼容**：右键菜单新增 3 项高频原因快速跳过（`skip-quick`），点击一步到位无需 prompt；原生 `skip` 保持弹窗支持自由备注或直接回车留空；
- **分析工作区多维聚焦联动**：阻力分布横向柱状图实时消费经过当前分组或项目过滤后的事件子集，帮助用户看清习惯阻力来源并指导规则演进。

# D-531：T-1879 回顾分析看板多维度筛选与趋势下钻联动（2026-10-21）

- **分析看板筛选栏与作用域隔离**：在 `workspace === "analysis"` 的分析看板顶部增设 `.lc-checkin__analysis-filter-bar`，提供“全部分组 / 分组选择”与“全部项目 / 项目选择”两级独立下拉选择框，以及“重置聚焦”快速恢复按钮；
- **协议扩展与 Root 上下文传递**：在 `ReviewRootContext` 与 `ReviewViewContext` 增设 `analysisFilterGroupId` 与 `analysisFilterItemId`，由 `bind-page-navigation.ts` 捕获 change/click 事件后局部刷新，保留当前折叠与滚动状态；
- **精力心流交叉分析即时联动**：`summarizeEnergyFlow` 消费经过当前分组/项目过滤后的事件子集，实时反映所选项目或分组的精力平均分与横向柱状占比；无数据时显示精准目标提示（`"{target} 在该时间段内尚未记录精力自评数据"`），避免全局数据误导。

# D-532：T-1880 展开面板快捷备注标签推荐与一键注入（2026-10-21）

- **情境化打卡备注极简输入**：在精确录入面板（`data-exact-entry`）提供 5 档快捷情境标签芯片（🌅晨间打卡 / 🎯深度专注 / 🏃运动流汗 / 💪超额突破 / ☕轻松达成），点击动态切换备注输入框中的 `#标签` 词条，再次点击自动剥离，并同步更新 `aria-pressed` 状态与 `.is-active` 样式；
- **回车一键提交打卡**：在备注输入框内监听 Enter 键，回车直接触发当前卡片的主打卡动作，大幅降低多步操作摩擦。

# D-528：T-1876 智能体建议采纳与明日生效修订直通（2026-10-20）

- **建议采纳的零追溯与时间线追加**：
  纯函数 `planSuggestionAdoption` 把用户采纳的建议（如连续跳过或强度下滑时的“降低行动门槛/改为弹性周配额”）转化为一条**从明日（`addDays(todayKey, 1)`）起生效**的 `CheckinItemRevision`。
  - 绝不改写已过去历史日期的规则与统计分母，保持已发生事实的完全不可变性；
  - 若已归档、同值弹性配额、二值项目试图改为非 1 等非法情形，纯函数严格拒绝并返回明确原因码（如 `already-flexible`, `invalid-target`），不制造规则噪声。
- **原子事务与审计追溯**：
  `applySuggestionRevision` 在独占 mutation 锁内合并修订列表并单次 `persist()`，写入失败整批回滚，并在 `auditEntries` 中记录 `source: "suggestion-adopt"` 审计追踪；UI 侧包含单飞忙碌锁、confirm 提示与双语反馈。

# D-529：T-1877 周复盘卡片证据链钻取与样本量守门（2026-10-20）

- **样本量门禁（`COACHING_EVIDENCE_MIN_DAYS = 7`）**：
  `buildCoachingEvidence` 统计窗口内真实计划机会日。若样本少于 7 天，明确标注 `sufficient: false`，面板显示“样本积累中，结论仅供参考”，避免在初期给用户提供强断言而产生误导。
- **事实证据直接透出**：
  建议卡下方增设可折叠的“支撑证据”面板，直观展现统计窗口、完成/跳过/未完成天数以及最近 7 个计划日的逐日明细行（日期、状态、实际值/目标值），数据来源单一可信。

# D-530：T-1878 打卡卡片微物理回弹与无障碍零动效降级（2026-10-20）

- **轻量物理回弹动画**：
  打卡成功及局部更新后，通过 WAAPI 在当前卡片上派发 `scale(1) → scale(0.985) → scale(1.008) → scale(1)` 缓动（260ms，`cubic-bezier(0.22, 1.2, 0.36, 1)`），提供微妙的完成触感反馈。
- **无障碍降级与环境容错**：
  当插件偏好或系统 `@media (prefers-reduced-motion)` 开启时，`pulseCard` 立即短路退出，0ms 纯平切不产生任何位移；在不支持 WAAPI 的特殊 WebView 环境中捕获异常安全降级，不中断主打卡事务。

# D-527：T-1875 历史排期矩阵点选补卡与原子批量回填（2026-10-20）

- **三态循环点选与原始基线对比**：矩阵日期格在 `未打卡 → 完成 → 跳过 → 未打卡` 之间循环；单次渲染同时携带 `data-matrix-original` 与当前态，任何回到原始态的点击自动从草稿 Map 中移除，避免“看似无变更却计脏”的统计失真。
- **未来与不排期日硬阻断**：`buildMatrixMonthCalendar` 对 `isFuture` 与 `scheduled === false` 输出禁用态（`disabled aria-disabled="true"`），同时 `planMatrixBatchCommit` 与 `recordMatrixBackfill` 双重拦截未来日期，杜绝提前制造事实。
- **单次原子事务与整批回滚**：`recordMatrixBackfill` 回出所有受影响日的旧事件、再按当日生效修订重建事件（完成取当日 `recordStep`、跳过写 `kind: "skip"`），单次 `persist()`；任何失败恢复 `previous` 并抛错，草稿态保留供用户重试。

# D-526：T-1874 多主题色阶年度热力图与日格快速钻取（2026-10-20）

- **四档色阶调色板解耦**：
  在 `tokens.scss` 与 `view-preferences.ts` 中规范 4 档热力图色板主题：
  - `violet-glow`（紫罗兰之光，小驴品牌原色）
  - `classic-green`（经典翡翠绿，对标 GitHub / Loop 经典绿）
  - `autumn-warm`（秋日暖阳，暖橙琥珀阶梯）
  - `monochrome`（极简水墨，黑白灰灰阶）
  通过 CSS 变量 `--lc-checkin-heat-step-1..4` 动态控制，在明亮与暗黑模式下均自动经过对比度校准，彻底淘汰原有写死的内联 `color-mix` 规则。
- **日格无障碍与快速钻取交互闭环**：
  `renderYearHeatmap` 生成的每个有效日格均携带 `data-heatmap-date`、`role="button"`、`tabindex="0"` 与可读 `aria-label`；
  在 `bind-page-navigation.ts` 中监听点击与键盘（Enter / 空格），点击任意日格直接同 root 钻取切换至 `records` 记录面板并定位到该日期的事实明细，实现对标 Obsidian Contribution Graph 的丝滑浏览体验。
- **即时主题切换与偏好持久化**：
  在回顾页热力图标题栏增加即时色板切换下拉菜单，改动通过 `applyPreferenceMutation` 事务安全写入偏好并支持失败快照回滚。

# D-525：T-1873 逻辑斯蒂饱和稳固度算法与三阶段成熟度模型（2026-10-20）

- **Sigmoid 饱和稳固度数学收敛**：
  在 `habit-score.ts` 落地 `computeHabitSaturation(completedDays, targetDays = 66)`：
  使用逻辑斯蒂曲线将相对进度比 $r = \frac{\min(1.5 \cdot N, x)}{N}$ 映射到 $[-3, 3]$，归一化输出 0~100 饱和稳固度分。
  - $x = 0$ 时精确为 0 分（消除无偏置误差）；
  - $x = 33$（半程）时为 50 分（对称拐点，爬坡加速区）；
  - $x = 66$（达标）时为 100 分；
  - 超额完成（$x > 66$）封顶平滑至 1.5 倍（99天），有效防止刷单破坏真实进度。
- **三阶段心理学成熟度模型**：
  - 萌芽期（`seed`，1~21 天）：意志力消耗高，提示“降低门槛、建立身份认同，不苛求完美”；
  - 爬坡期（`climb`，22~45 天）：动力与阻力博弈，提示“固定时段与环境触发，善用跳过防破罐破摔”；
  - 扎根期（`root`，46~66+ 天）：自动化自发性形成，提示“神经回路已扎根，保持舒适节奏即可稳固滋养”。
- **呈现层自适应展示**：
  在洞察看板增设 `.lc-checkin__habit-saturation-banner`，横向进度条与阶段徽标自适应三种主题色板（萌芽 neutral / 爬坡 warm / 扎根 success），并为读屏工具提供完整 `aria` 说明。

# D-524：T-1872 主观心流与精力自评数据事实与交叉看板落地（2026-10-20）

- **数据模型设计与向前兼容**：`CheckinEvent` 增加可选字段 `energy?: 1 | 2 | 3 | 4 | 5`；`normalizeEvent` 严格校验必须为 1~5 的整数，0/6/超限/非数字自动安全过滤为 `undefined`，历史无此字段的备份完全不受影响，保持数据层零破坏与零迁移负担。
- **输入交互极简零摩擦**：主按钮快速打卡（点击完成）与芯片快速增量（`quickSteps`）完全保持 0 摩擦（`energy` 缺省为 `undefined`）；仅在展开详细面板（`data-exact-entry`）中呈现精致的 5 档单选选项（😴 1 枯竭 / 🥱 2 疲劳 / 😐 3 平稳 / 😊 4 充沛 / 🚀 5 心流），用户可选择性标注。
- **回顾页精力与心流分布看板**：`analytics.ts` 输出 `summarizeEnergyFlow`，`review.ts` 挂载 `energyFlow` 折叠卡片，清晰呈现平均精力评分（x.x / 5.0）、自评样本数以及 5 档精力的横向柱状占比分布，无数据时诚实给出空态引导提示。

# D-523：2026-10 竞品深度对标与体验演进规划决策（2026-10-20）

- **背景与调研基线**：在 v18.19.0 发布后，对标开源标杆（Loop Habit Tracker、Table Habit、Habitica）、主流商业工具（TickTick、Everyday、Streaks、Atoms）与笔记生态（Obsidian Contribution Graph/Tracker）。
- **核心演进决策**：
  1. **心流精力轻量自评（T-1872）**：坚持主按钮一键打卡零摩擦，仅在展开面板提供可选 1~5 档精力记录，在复盘中输出精力-习惯交叉洞察，避免传统应用将打卡变问卷的疲倦感；
  2. **Sigmoid 成长曲线（T-1873）**：超越单纯的连续天数损失厌恶，引入饱和成长曲线与 66 天阶段性成熟度，鼓励长期扎根，超额完成平滑封顶防刷单；
  3. **多色阶热力图与日格钻取（T-1874）**：解耦主题色板，支持翡翠绿、紫罗兰、秋日暖阳、极简水墨，日格支持键盘与点击直达当天事实回放；
  4. **矩阵日历补卡（T-1875）**：解决漏记多日补录摩擦，通过月矩阵视图三态循环快速回填，单次原子 mutation 提交；
  5. **受控智能闭环（T-1876）**：行动建议一键采纳并写入项目有效修订时间线，无感完成习惯规则进化。
- **哲学与边界坚守**：绝不引入掉血、扣金币、社交天梯等增加内疚感的机制，坚守本地优先、科学弹性与反焦虑的心理学基线。

# D-522：顶栏图标突然消失与后台暴力重绘防御治理（2026-10-20）

- **排查根因锁定**：
  1. **后台定时轮询暴力重绘**：`siplayerTimer`（15s）、`reminderSlotTimer`（60s）及前台焦点切换频繁触发 `renderBackgroundUpdateFor`。旧逻辑在首层提前循环遍历 `candidateRoots` 执行 `host.renderInto(root)`，不仅绕过了下方的 `typingRoot` 交互守卫，而且在数据毫无变化时将整页 DOM 强行清空重建，导致用户观察到“内容突然重新渲染”。
  2. **纵向滚动将顶栏推到屏幕外**：前序引入的 `bindNavOverflowHintFor` 调用了 `selected.scrollIntoView({block: 'nearest'})`。浏览器向上递归查找到父容器（弹窗/页签）并产生纵向滚动，把 `position: static` 的顶栏推到了视口上方边缘之外，在视觉上表现为“顶栏图标突然消失”。
  3. **分屏 Tab / 窄弹窗 CSS 规则双重隐藏**：`workbench.scss` 中 `@container lc-dialog (max-width: 719px)` 把 `.lc-checkin__topnav-brand, .lc-checkin__topnav-tabs` 强行 `display: none`；`@container lc-tab (max-width: 719px)` 又把 `.lc-checkin-tab-host > .lc-checkin__topnav` 强行 `display: none`，导致弹窗在中窄屏或分屏 Tab 下顶栏图标全灭。
  4. **顶栏事件绑定遗漏**：`renderInto` 对 Today / Review / Occasions 等页面渲染后漏调 `bindDialogClose` 与 `bindMobileNav`，重绘后顶栏按钮事件失效。
- **根本性修复方案**：
  1. **纯横向局部滚动**：`bindNavOverflowHintFor` 废弃 `scrollIntoView`，改用 scroller 自身 `scrollLeft` 纯横向位置计算，绝不牵连父容器纵向滚动。
  2. **后台重绘活动态挂起守卫**：在 `renderBackgroundUpdateFor` 中检测当前 root 是否包含活动的输入/交互焦点（`input, textarea, select, [contenteditable]`），若有则挂起至失焦（`focusout`）再更新，绝不在用户眼前暴力闪烁重绘。
  3. **窄屏顶栏紧凑保留**：在 440px~719px 下保留顶栏品牌与导航图标（自适应缩小间距和字号），仅在 < 440px 隐藏文字品牌名称并保留头像，绝不暴力抹除导航图标。
  4. **全表面事件闭环与 SVG 尺寸固化**：在 `renderInto` 统一收尾处调用 `bindDialogClose`、`bindMobileNav` 与 `normalizeUiIcons`；在 CSS 中将顶栏 SVG 图标强制钉死为 `18px`，杜绝任何阶段的尺寸坍缩。

# D-521：T-1824 宿主容器密度档与移动端软键盘滚动保护（2026-10-20）

- **四类 Host 容器密度基线统一**：
  - 新增 `--lc-checkin-touch-min-target: 44px`、`--lc-checkin-compact-min-target: 30px`、`--lc-checkin-normal-min-target: 34px`；
  - `.lc-checkin-dock-host` 自动激活紧凑密度（`--lc-checkin-density-scale: 0.9`，`--lc-checkin-control-height: 30px`），保证侧边栏高信息密度；
  - `.lc-checkin-tab-host` / `.lc-checkin-dialog-host` 采用标准桌面密度（`--lc-checkin-density-scale: 1`，`--lc-checkin-control-height: 34px`）；
  - `:is(.lc-checkin-host--mobile, .lc-checkin-dialog-host--mobile)` 采用触控优先密度（`--lc-checkin-density-scale: 1.1`，`--lc-checkin-control-height: 44px`），完全满足 WCAG 2.2 / Apple HIG 触控下限。
- **移动端软键盘输入滚动安全区**：
  - 在移动端宿主下为所有处于 `:focus` 的输入框、选择器和多行文本域配置 `scroll-margin-bottom: 96px`，确保移动端虚拟键盘弹起时永远不会遮挡输入内容或确认操作栏。

# D-520：T-1819 导航溢出指引与活动态无障碍收口（2026-10-20）

- **横向溢出渐变指引**：`topnav-tabs` 外包一层 `__topnav-tabs-wrap`，通过 `bindNavOverflowHintFor` 在 `scroll` / `ResizeObserver` 下派发 `data-overflow-start` / `data-overflow-end`，CSS 伪元素仅在对应方向可滚动时才显示 16px 渐变蒙层，避免“已到端点仍显示可滚动暗示”的误导。
- **滚动吸附与防折行**：容器启用 `scroll-snap-type: x proximity`，按钮 `flex: 0 0 auto` + `white-space: nowrap` + `scroll-snap-align: center`，窄屏下按钮不压缩变形成两行；选中页通过 `scrollIntoView({inline:"nearest"})` 自动进入可视区。
- **活动态语义与键盘可见性**：设置侧导航活动项增加 `inset 2px 0 0 accent` 内侧高亮条与 650 字重，补齐 `:focus-visible` 焦点环；`prefers-reduced-motion` 下关闭过渡。

# D-519：T-1818 & T-1821 表单字段视觉规范与长表单分节系统第二切片（2026-10-20）

- **表单输入高度与文本域 Token 收敛（T-1818）**：
  - 新增 `--lc-checkin-field-height-sm: 28px`、`--lc-checkin-field-textarea-min-height: 72px`、`--lc-checkin-field-textarea-min-height-lg: 88px` 标准 token；
  - 收敛事项、问卷日记、长备注文本域散落的 `72px/84px/88px` 高度到单一 token；
  - 统一校验状态（`aria-invalid="true"` 聚焦获得 danger 光环，禁用态半透明与 forbidden 指针，忙碌态 wait 指针）；
  - 在 `@media (prefers-contrast: more)` 下对所有输入框与文本域提供 2px 实体边框与高可见度 focus outline。
- **编辑器长表单分节与折叠系统（T-1821）**：
  - 为 `[data-editor-section]` 增设虚线视觉分隔与加粗标题，清晰界定“基础设置 / 排期规则 (when) / 记录方式 (how)”区域；
  - 收敛高级设置 `[data-advanced]` 抽屉展开过渡与指示器翻转；在 `prefers-reduced-motion` 下平滑跳过动效。
- **CSS 资产零死类合规**：
  - 增补 `BUTTON_SEMANTIC_CLASSES` 到 `labels.ts`，打通 T-1817 五级按钮语义类名，`css-audit` 保持 0 死类、CSS 产物 662 KiB 严格低于 680 KiB 硬预算。

# D-518：T-1786 跨入口写入幂等去重、二值完成阻断与破戒回执对账统一（2026-10-20）

- **二值完成与戒除破戒口径彻底统一**：在 `recordExternalEvent`（API 单条调用）补齐对二值项目完成和二值戒除项目（`atMost`）的同口径判定：
  - 二值普通项目当天若已完成（`isComplete`），拦截并返回 `fail("already-complete")`；
  - 二值戒除项目当天零破戒事实时，首次破戒允许写入，如实记录犯规事实并中断守住连击；当天若已有破戒事实，后续重复尝试拦截并返回 `fail("already-complete")`。
  - 彻底消除了此前内部记录器与外部 API 之间的口径分叉。
- **跨入口幂等回显与回执对账对齐**：当携带 `externalRef`（包含 Agent 的 `agent:<requestId>` 或外部系统的请求唯一标识）重复提交时，`recordEvent` 与 `recordExternalEvent` 均直接回显已入账的事实事件；同时统一调用 `setRecentRecord` 更新前端界面当前回执，保证通过 API、Agent 还是 UI 快捷入口发起的重试，界面上的撤销对象、通知和事件详情与该条持久化事实 100% 同步。

# D-517：T-1787 备份恢复版本化与多桶 Envelope 迁移提示（2026-10-20）

- **统一预检与格式识别**：`preflightUnifiedBackup` 精准识别输入备份类型。对旧版单主档 JSON 备份（`envelopeVersion: 0`），如实披露未包含模板、问卷、偏好等独立存储桶，提示用户导入仅覆盖项目与记录、不清除或覆盖现有独立配置；对版本化多桶 BackupEnvelope（`envelopeVersion: 1`），执行协议版本校验（未知版本严格 fail-closed 拒绝），并基于 D-514 生成逐桶覆盖/合并/跳过规划预览，敏感桶默认遮罩并跳过。
- **原子事务与全量回滚**：多桶恢复在锁内执行，预先备份各桶内存与持久化快照；若主档或任何辅助桶在保存时失败，立即触发全量原子回滚，将内存状态恢复并向磁盘重写此前快照，杜绝部分迁移或内存-磁盘分叉。
- **完整备份导出能力**：在设置页与 `plugin-ops.ts` 落地 `downloadBackupEnvelopeFor` 与 `createBackupEnvelopeFromBuckets`，支持一键导出包含主档、自定义模板、图标库、问卷日记、事项和偏好的版本化快照。

# D-361：README 版本更新区块格式（2026-10-08）

# D-464：Task Horizon 内部打卡循环与小驴事件分阶段匹配（2026-10-10）

- 对 Task Horizon v3.1.8（`58ec06f`）的源码核对确认：`repeatRule.trigger === "checkin"`、`repeatState.checkinHistory`、`tm-checkin-updated` 和 `checkin:<taskId>:<localDate>` 都属于对方内部打卡循环；`task-horizon:task-completed` 与 `siyuan-points-reward-*` 属于旧积分联动。两类均不是小驴 `window.siyuanCheckin` 的版本化 `recordEvent` 契约，不允许小驴直接读取私有字段/DOM 或监听未版本化事件。
- 产品匹配上，内部打卡循环比普通任务复选框更接近小驴习惯项目；但对方可删除某日 `checkinHistory` 记录，而小驴公开 `recordEvent()` 只追加事实且暂无外部事件撤回方法。先做 v5 `calendar.read` 只读消费和普通任务完成回写，内部循环同步必须另立可撤回状态对账契约，并明确用户触发、补录、取消、多窗口重放、解除映射和唯一 canonical source。
- 本轮只维护本仓合作说明、专门 Issue 草案和契约夹具，不创建外部 Issue/PR；Task Horizon 侧实现应在维护者确认入口/设置/语义后由对方仓库提交 PR。`task-horizon-v1.json` 保持 v4 兼容，不把 v5 投影能力倒填进旧机器契约。

## D-475：T-1807 真实宿主快照基线只用于预算，不直接触发存储改造（2026-10-16）

- 独立思源 3.8.7 内核首轮 1k/10k/100k 事件样本通过真实 `saveData/loadData` 和重载核对：主档约 198.5 KB / 2.01 MB / 20.39 MB，单次 API 记录约 393 ms / 695 ms / 3.71 s；恢复历史约 397.3 KB / 4.22 MB / 42.79 MB。另有 1k 事件加 400 KB 合法图片样本，主档约 731.9 KB、写入 495 ms。结果写入 `.artifacts/storage-host-benchmark.json` 与 `.artifacts/storage-host-benchmark-attachment.json`，仅作为当前 CPU、内核和样本形态下的预算证据。
- 该结果未覆盖大附件、稳定跨窗口并发、失败写入后的宿主重载恢复；失败写入注入会使当前公开写队列保持等待，因此不把注入场景写成真实宿主通过。纯函数/内存基线与真实宿主结果都不设置硬阈值。
- 在补齐上述证据前，不改 Store v3、不引入 schema v4，不按本轮耗时直接加入压缩、分层或节流；T-1799 继续优先评估保留墓碑并优化表示成本。

## D-465：Task Horizon 消费边界按真实事件和日期语义收口（2026-10-10）

- 日历投影刷新必须覆盖项目创建/更新/删除/归档、事件新增/删除和分析刷新 7 个数据变化事件；只有建议工作流事件与投影无关。旧“四类刷新、创建/删除是噪声”的草案已修正，避免新项目、删除项目或撤销事件继续显示旧缓存。
- 参考 bridge 要求用户明确持久化目标 `itemId`，不按名称自动猜测；目标归档、at-most、单位不匹配或 ID 失效时 fail-closed。待处理身份固定为当时的 `itemId + source + externalRef`，映射变化不得把旧队列投向新项目。
- 单条 `recordEvent()` 的 `undefined` 只代表未写入，无法区分拒绝和存储失败；bridge 保留原 payload 并标记 `rejected/transport`，用户可重新校验重试或显式丢弃。历史日期只能使用 v5 `recordEventsBatch` 的显式 `occurredAt`，不能用 externalRef 日期伪造落账日期。
- 投影超时、Abort、异常、卸载或能力变化清空缓存并隐藏图层；阶段 2 先采用单向事实语义，Task Horizon 撤销不自动删除小驴追加事件。内部打卡循环另立可撤回/对账契约，不与普通完成共享 canonical source。

# D-463：CSS 维护态硬预算调整（2026-10-10）

- 用户明确授权将 CSS 生产产物硬阻断线从 640 KiB 调整为 660 KiB，以容纳本轮提醒文流、More 入口和短屏布局收口后的实际样式体积；620 KB 软提醒保持不变。
- 当前发布构建 CSS 为 657,246 bytes，仍低于新硬线 675,840 bytes；死类、重复规则和类型/功能测试门禁不放宽，后续新增样式继续优先复用既有规则并记录体积。
- `tests/css-hygiene.test.cjs` 与提醒密度浏览器守门同步使用 660 KiB；历史版本记录中的 640 KiB 数值仅用于追溯，不回写历史发布说明。

# D-461：README 与 More 入口的当前契约（2026-10-10）

- README 的当前版本区块必须靠前并按“整体/新增/优化/修复”呈现；历史版本使用可展开的 `<details>`，避免首屏被旧版本占满。
- 系列插件表固定包含八款插件、中文简介、canonical GitHub 仓库链接和 QQ 群 871707735；考试、管家、闪卡、常用四款在首屏明确标注内测，不能把内测规划写成已交付能力。
- “更多”是二级设置、归档和帮助的统一入口；从 More 进入设置分组后返回仍回 More 上下文。移动底栏“记录”在 quick root 内必须直达编辑器，跨表面才打开快速弹窗。
- 健康总览卡的配置目标必须与实际设置分组一致；提醒与专注使用 `appearance`，数据和外部来源分别使用 `data` 与 `external`。

# D-462：提醒通知的可见 surface 文流挂载（2026-10-10）

- 可见 Dock/Tab/Dialog 中的提醒通知首次挂载和重绘都放在 `.lc-checkin` 的滚动布局之前，并为布局保留 flex 空间；无可见 surface 时才回退到 body。
- 短高 surface 使用 64px 通知上限，保留按钮可操作高度；宽度走查必须验证通知与编辑器预览、事项长文本和 Today 内容不重叠。
- 送达、静音、回滚和提醒中心语义不变；本地 Chromium 证据不替代真实思源、Android/TalkBack 与第三方来源现场验收。

- 每次版本更新必须在 README 靠前位置放置对应版本的更新区块。
- 更新区块按用户可见变化分为 `新增：`、`优化：`、`修复：` 三类；每一条后面都写具体行为、入口或修复结果。
- 该区块是用户快速了解版本变化的入口，详细设计、测试和迁移信息继续放在 `docs/`、发布说明和进度记录中。

# 决策

## D-373：T-1774 戒除暂守口径与呈现消歧（2026-10-19）
- 维持底层 D-219 零破戒即守住承诺，`isComplete` 保持真实语义；在呈现层消歧：今日完成区自适应纯戒除（`today.atMostHoldingTitle`）与混合场景（`today.completedHolding`），洞察日格进行中展示为“今日守住中”。

## D-374：T-1793 & T-1811 严格真实日期契约与有界区间扫描（2026-10-19）
- 日历投影、排期预演与周负荷全量接入 `date-keys.ts` 严格公历校验，淘汰 `eachDayCount` 无界循环，改按 `calendarDayNumber` 跨度计算与 366 天截断。

## D-375：C-01~03 Task Horizon 提供端协议增量就绪（2026-10-19）
- 锁内合并产生实际变更时广播一次 `analytics-updated`；增设全局事件 `checkin:api-state-changed`；日历投影 point 增补有效修订 `scheduleType`，顶层输出宿主基准日 `asOfDate`。

## D-376：T-1794 配额摘要末日 DST 算术消除物理毫秒漂移（2026-10-19）
- 消除 `-86400000` 物理毫秒减法（杜绝美东等春令时 23 小时天漂移到前两日），改按 `addDaysKey(endKey, -1)` 纯整数日序号推导上一民历日。

## D-377：T-1800 渲染块日期格键盘可达激活与无障碍按钮化（2026-10-19）
- 月历与热力图日期格全面升级为原生 `<button type="button">`，增设 Enter/Space 键盘跳转回调与 `:focus-visible` 焦点环。

## D-378：T-1789 & T-1790 根节点与编辑器委托监听生命周期幂等与防漏（2026-10-19）
- `bind-editor.ts` 导出 `cleanupEditorFor` 并建立自动销毁表，绑定前清理旧监听，卸载联动清理；Today 拖拽与移动端 toggle 捕获增加单例标记。

## D-379：W-03 严格时间戳校验与 Task Horizon 合作写入专用约束（2026-10-19）
- 升级 `normalizeValidIso` 严格带时区 ISO 校验，彻底拒绝非法月日/时刻隐式滚日及 date-only 输入；固定判序为“格式校验 → 墓碑 discarded → 已存/批内 duplicate → 业务校验 blocked → 写入 recorded”；落地 Task Horizon 合作专用约束。

## D-380：T-1791 & T-1792 快速弹窗外部关闭/重开草稿保护与标题拖拽首开时序（2026-10-19）
- 引入 `shouldProtectQuickDialogDraft`，直接读取弹窗自身 root 的 `pageOfRoot` 与 `isEditorFormDirty` 状态；外部关闭、重新打开重置以及 `.b3-dialog__close` 按钮统一拦截并确认；标题拖动与双击最大化重构为 `container` 事件委托。

## D-381：T-1808 初始化失败状态可达修复通道（2026-10-19）
- 渲染失败屏增设可达的“重试加载”与“复制诊断信息”按钮，自动聚焦重试控件保障读屏操作；提供 `retryInitialization` 锁内安全重试通道与结构化诊断导出。

## D-382：T-1809 & T-1810 事项返回、关联编辑与历史/Today 导航统一传递 owning root（2026-10-19）
- 事项页返回按钮、关联项目编辑以及历史/Today 键盘与菜单导航统一传递当前 `root`，跨表面返回栈严格隔离。

## D-383：T-1812 日历投影数值戒除与修订单位同源（2026-10-19）
- 数值型 atMost 戒除项日状态改用 `isComplete` 单一模型判定（未超上限为 `at-most-safe`，真实超额才判 `at-most-breach`），单日 value/progress 严格对齐当日生效修订单位。

## D-384：T-1804 & T-1805 多 root Today 搜索/焦点隔离与后台刷新草稿保护（2026-10-19）
- `focusTodaySearchFor` 显式传递发起 root 限制搜索聚焦；建立 `pendingFocusByRoot` WeakMap 优先归位发起 root 的待聚焦卡片；`renderBackgroundUpdateFor` 逐 root 检查，编辑页跳过重绘以保护 DOM 表单草稿。

## D-385：T-1801 & T-1802 渲染块 today 视图显式截断与时段时区契约（2026-10-19）
- Today 视图超过 5 项时显式输出截断提示并提供“查看全部”直达入口；引入 `getEventLocalHour` 消除跨时区早/午/晚分组漂移。

## D-386：T-1806 Today 上下文菜单 owning root 几何边界与焦点还原（2026-10-19）
- 重构定位算法，结合 `rootRect`、`visualViewport` 与 `menu.offsetParent` 实时计算相对偏移与安全边距，解决 dock 窄面板越界与 quick 弹窗 CSS transform 坐标偏移，点外关闭与 Esc 自动还原焦点。

## D-387：T-1785 动态图标与 HTML/SVG 属性转义边界统一（2026-10-19）
- `renderIconMarkup` 严格限制图片白名单（https:// 或 base64 data:image），未编码 SVG 与脚本转义为安全文本；`normalizeUiIcons` 升级为 DOM 原生 `replaceChildren(this.iconNode(...))`。

## D-388：T-1779 页面级视图偏好持久化一致性与回滚（2026-10-19）
- 回顾折叠 sections、洞察项目选择、助手报告跳转、快捷锚点跳转、报告区块开关、报告来源筛选 6 处改动全部接入 `applyPreference`，持久化失败自动快照回滚并提示。

## D-389：T-1780 & T-1781 专注计时补偿与同步（2026-10-19）
- 基于 Date.now() 单调时间戳自动补偿后台节流时间；已用时间 >=60s 时切换预设增加确认；多表面同屏通过 querySelectorAll 保证同步刷新。

## D-390：T-1786 统一写入幂等与破戒（2026-10-19）
- Agent `checkin-record-item` 增加 `requestId` 幂等键并映射为 `agent:<requestId>`；`recordEvent` 支持 `externalRef` 去重，重复请求直接回显已有事实，杜绝重复增账。

## D-391：T-1783 敏感信息脱敏与安全截断矩阵（2026-10-19）
- `privacy-scope.ts` 引入 `redactSensitiveText` 与 `sanitizeDiagnosticDetail`，清洗恶意控制字符与双向覆盖字符，自动脱敏 Bearer 令牌、API Key 与用户私有绝对路径，安全截断 UTF-16 代理对。

## D-392：同类产品与开源生态深度调研与规划对账（2026-10-19）
- 深度对标 Loop Habit Tracker、Table Habit、Habitica、TickTick、Obsidian 插件与 Streaks，吸收科学稳固度算法、热力图多风格色板与心情日志灵感，强化思源知识库深度联动优势，坚决不引入掉血惩罚与社交内疚。

## D-476：T-1813 顶栏重复规则只做等价删除（2026-10-16）

- 桌面 `@container lc5 (min-width: 720px)` 内的 `.lc-checkin__topnav-actions` 与 `.lc-checkin__topnav-action` 基础声明在文件后段已有完全相同的全局规则，后段还会继续覆盖尺寸、间距和焦点样式；删除容器内重复块不改变最终计算样式，仅减少编译产物。
- 本切片不合并具有不同容器、方向或窄宽条件的相同声明；保留 `topnav-tabs` 的移动导航规则、≤380px 图例 `gap: 3px` 和所有状态/无障碍覆盖。
- 证据：`pnpm run build`、`pnpm run check`、`node scripts/css-audit.cjs --json`、`node tests/css-hygiene.test.cjs`、`git diff --check` 通过；CSS 669,753 bytes，重复规则约 3,986 bytes，较切片前减少 85 bytes。

## D-481：T-1815 状态弱化不使用整块透明度（2026-10-16）

- 完成事项芯片的 `.is-complete` 与完成/延后/跳过提醒行原先使用父级 `opacity`，会把正文和状态小字一起与背景混合，浅色和深色均可跌破 4.5:1；现改为 `opacity: 1`，事项芯片用显式 `muted` 文本与 `muted-surface` 背景，提醒行继续使用各自显式状态色。
- 该切片只改状态呈现，不改完成、延后、跳过或提醒动作语义；`tests/ui-theme.test.cjs` 增加来源守门，防止整行透明度回流。提醒行此前被通用无障碍脚本漏检，因为脚本读取子元素 computed color 时不会合并父级 opacity。
- 证据：`pnpm run build`、`pnpm test`、`node tests/accessibility-audit.test.cjs`（Chrome 0 对比度违规/1345 组）、`node tests/ui-theme.test.cjs`、`node tests/css-hygiene.test.cjs`、Chrome 英文浅/深主题 `node tests/width-walkthrough.cjs` 和 `node tests/visual-qa.cjs` 均通过；visual-qa 的 dataChanged 夹具同步为 T-1796 的完整远端快照语义，恢复替换仍由存储事务专项夹具覆盖。

## D-482：T-1807 真实宿主预算复测保持“测量不改架构”（2026-10-16）

- 独立思源 3.8.7 靶场复测 1k/10k/100k 主档约 198.5 KB/2.01 MB/20.39 MB，单次写入约 335/635/3693 ms；恢复历史约 397.3 KB/4.22 MB/42.79 MB。400 KB 合法图片样本（1k 事件）主档约 731.9 KB，写入约 359 ms。报告为 `.artifacts/storage-host-benchmark.json` 与 `.artifacts/storage-host-benchmark-attachment.json`。
- 该复测通过真实 `saveData/loadData`、写后读取和重载事件保留，但仍没有写失败后重载恢复和稳定跨窗口并发证据；失败注入保持在纯函数/内存测试边界，不把 host benchmark 扩写成失败通过。继续不改 Store v3、不引入 schema v4，不按单次耗时加入压缩、分层或节流。

## D-457：第十一轮用户反馈统一诊断边界（2026-10-09）

- 所有本轮涉及的用户可见异常详情必须先经过 `sanitizeDiagnosticDetail`，再进入 toast、状态文本、ARIA 或设置页 HTML；清洗后为空时使用对应的本地化通用提示。
- 导出、导航、日记、叶归、Agent、笔记查询和微信读书的业务语义保持不变，只收紧异常展示边界；设置页状态整体 HTML 转义，避免异常文本成为标记或属性。
- 隔离测试夹具必须显式提供 `features/diagnostics`，并由反馈安全守门锁定禁止原始异常直出的契约。本地夹具和质量链仍不能替代 CHECKIN_BROWSER、真实宿主、Android/TalkBack、第三方来源和缩放现场验收。

## D-456：第九轮导入、安全与 owning-root 交互边界（2026-10-09）

- CSV 只有完整 RFC 行才能进入导入结果；未闭合引号或字符上限截断的尾行整行拒绝并反馈原因，超限行不计入用户确认数量。
- 文档 combobox 的空结果必须保持可见且有展开态；程序化候选回填必须触发与手工输入相同的 draft/change 传播。
- 动态图标仅在显式安全白名单下进入 `img`；危险 SVG/data/控制字符回退为转义文本。Today 菜单边界以 owning root 与 visual viewport 交集计算，关闭菜单恢复触发焦点；完成项不叠加父级与 action 双重透明度。
- 本地夹具可关闭对应源码缺陷，但不能替代 CHECKIN_BROWSER、真实思源宿主、Android/TalkBack、第三方来源和缩放现场验收。

## D-455：第八轮渲染块、弹窗、日期和公开时刻契约（2026-10-09）

- 渲染块日期格继续由 root 委托处理 Enter/Space，焦点样式复用共享 `[tabindex="0"]:focus-visible` 规则；Today 视图保留五项上限，但必须用双语状态文本告知已显示和隐藏数量。
- 快速弹窗必须先完成 DOM 渲染再绑定标题交互，并把拖拽/双击监听挂在稳定容器；编辑器离开、关闭和重开共用 dirty 守卫，取消时保留当前草稿和页面。
- 配额周期边界使用民历日 `addDays`，不使用固定 24 小时减法；API v5 批量 `occurredAt` 要求显式 RFC3339 时区并归一 UTC。渲染块时段仍按 `occurredAt` 分桶、`localDate` 过滤，T-1802 的显示时区决策另行确认。
- 本地夹具和质量链可以关闭可复现源码缺陷，但不能替代 CHECKIN_BROWSER、真实思源宿主、Android/TalkBack、第三方来源和缩放现场验收。

## D-454：第七轮全量复核的异步设置、监听器和公共数据边界（2026-10-09）

- 设置页所有显式异步动作沿用同一 busy/反馈/焦点生命周期；操作离开设置页后仍必须清理旧控件状态，避免 disabled 或 `aria-busy` 残留。保存失败先恢复内存快照，再交给本地化设置反馈。
- Review 菜单、Today 拖拽和事项排序按 owning root 管理监听与会话状态；同一 root 重绘只允许一个有效监听，跨 dock/tab/quick 的排序不得改动其他 root。
- 公开快照继续采用深拷贝隔离；分析日期参数必须是真实 finite Date，非法日期以稳定结构化错误拒绝，不能把 NaN 日期键传播到图表、摘要或 API。
- 本地自动化证据可以关闭对应可复现源码缺陷，但不替代 CHECKIN_BROWSER、真实思源宿主、Android/TalkBack、第三方来源和缩放现场验收。

## D-448：第三轮全插件复核的异步反馈、root 隔离与双语边界（2026-10-09）

- Today 与 quick 的视图偏好沿用既有 `applyPreference` 快照/回滚链，通过公开 `applyPreferenceMutation` 给 render binding 消费；兼容 stub 才保留旧式持久化 fallback，Review 等页面级偏好仍按 T-1779 单独验收。
- 后台来源刷新必须枚举注册 root：输入中的 Today root 只在失焦后刷新，其他 Today root 可继续刷新，editor root 永不被覆盖；`currentPage` 只作为无 root 旧入口的兼容代理。
- 洞察教练文案、编辑器图标错误、事项农历提示和完成来源摘要全部通过 i18n；纯函数无 translator 时保留中文 fallback，避免破坏已有模型调用者和测试契约。

## D-449：视觉走查的编辑冲突等待契约（2026-10-09）

- 编辑器发生跨窗口冲突时，产品契约是保留当前 root 的表单草稿、留在编辑器并显示冲突提示；visual-qa 必须等待“表单仍存在 + 冲突消息出现”，不能等待回到 Today。此次只修正走查脚本与产品契约的错位，不改变运行时导航或保存语义。

## D-450：第四轮页面偏好、热力图文案与关联入口 root 传递（2026-10-09）

- Review/洞察/报告页面级偏好与设置保持同一快照/失败回滚/失败提示语义；绑定层通过 `applyPreferenceMutation` 传入变更前回滚函数，旧 host stub 继续使用兼容持久化路径。
- 年度热力图的 SVG aria/title、月份、星期、日期与周区间文本由页面 translator 注入；纯渲染函数保留中文默认值，所有外部文本统一 XML 转义。
- 事项关联项目徽章点击必须携带发起 root；宿主打开编辑器优先使用该 root，只有无 root 的历史入口才回退到最后活跃 root。事项创建/返回路径仍单独按 T-1809 继续收口。

## D-451：第五轮异步代际、焦点消费与启动错误隐私边界（2026-10-09）

- 来源和提醒异步任务在每次外部响应、游标更新、mutation 入队和状态聚合前检查配置对象身份、启用状态、存储就绪和生命周期；迟到结果直接丢弃，不回写新配置。
- Today 局部 patch 只消费完成事项对应的 pending focus；省略参数的全量清理保留给显式兼容入口，避免多 root 并发记录互相夺焦点。
- 初始化失败的用户提示只显示本地化 load/save 阶段标签；原始异常不得进入 toast、ARIA 或固定错误文本，结构化诊断码仍可供诊断导出/API 使用。失败页是否提供“重试”按钮另立 T-1808，需先明确重新初始化的生命周期所有权。

## D-452：初始化失败页采用同实例单飞重试（2026-10-09）

- 失败页的“重试加载”在当前插件实例内重新执行存储读取/迁移，不调用完整 `onload()`，避免重复创建 dock/tab、定时器、能力注册和宿主监听。
- 重试期间回到 `loading` 并重置本轮 `readyPromise`；在途重试共享同一 Promise，成功才恢复正常后台任务，失败继续保留 `role=alert` 错误屏。顶栏、事件总线和渲染块监听以一次性安装门保护。
- 真实宿主权限/损坏存储、移动端和读屏验收仍需现场确认；复制/导出结构化诊断不在本切片内。

## D-453：事件明细 API 与点位投影采用不同范围边界（2026-10-09）

- `getEventsInRange` 是事件明细读取，接受任意合法本地日期半开区间，使用 `limit`（默认 1000、上限 5000）表达返回预算；实现当前跨年读取可返回截断结果。
- 366 天上限继续用于摘要、日历和分析点位投影。文档不再宣称事件明细跨 366 天会返回空结果，避免生态调用者丢失合法历史查询。
- 后续若要给事件明细增加日期上限，必须同步版本化契约、manifest、E2E 和迁移说明，不在本轮静默改变兼容行为。

## D-447：全量 UI 复核的可复现缺陷与验收边界（2026-10-09）

- 640px 紧凑 Today 的首屏预算通过收紧仪表盘与提醒条之间的空隙解决；保留所有交互控件的触控高度，不用缩小分组按钮来换取几何通过。
- action-colors 的 Ocean/Sunset 失败来自 width 走查跨主题复用 root Today 展开态；测试夹具在每个场景重置 root 状态后全矩阵通过，生产点击路径无需添加人为等待。
- 日历公开投影必须区分 raw value 与当前规则 progress：raw value 用于事实展示，完成态和进度复用模型的 `isComplete` 及当天修订单位。
- `visual-qa.cjs` 的 draft conflict submit 仍是未闭合视觉证据；不以 width、静态无障碍或本地 bundle 通过替代真实思源、第三方来源和真机验收。

## D-360：原型级桌面分栏与窄屏信息密度（2026-10-06）

- 事项页桌面双栏的 grid item 是外层 `details` 抽屉，摘要与表单必须作为同一右栏表面布局；只给内部 panel 定位会留下粘连的孤立摘要。
- 设置总览的四个入口在窄屏保留触控尺寸，采用两列换行而不是四个整行按钮；设置搜索同时提供 placeholder，空输入框仍有明确入口提示。
- Today 紧凑密度桌面卡片按可读最小宽度自动填充，名称最多两行；不通过缩小字号或逐字竖排承载大量习惯。窄屏提醒标题/说明收敛到两行/一行，操作按钮继续保持 44px 触控高度。
- 宽 Tab 通过 `lc-tab` 容器补齐原型的垂直图标导航；洞察热力格增加低对比描边，仍复用插件独立主题 token。
- 提醒流内挂载同时按宿主类型和实际容器宽度判断，窄 Tab/Dialog 即使没有 `--mobile` 类也不能退回 body fixed；宽面仍保留原型 toast。

## D-355：诊断墓碑、root 初始状态与写型内核靶场边界（2026-10-06）

- 诊断失败记录的成功解决与用户显式清空都属于跨窗口删除语义，内部存储使用 schema v2 的已解决身份集合与清空时间水位；旧 schema v1 继续可读，导出的用户诊断格式暂保持 v1，避免改变外部消费契约。合并、回滚和重载必须保留墓碑，不能只合并可见 issues 数组。
- 新 root 只从持久化显示偏好白名单启动，业务查询、洞察范围、编辑草稿和设置会话都使用新默认值；宿主字段仅作兼容镜像。fresh-root 生产 bundle 场景覆盖 root 重建、旧入口、设置返回、洞察/编辑隔离，仍需完整宿主切换与现场 Android 验收。
- 写型冒烟/e2e 只能访问显式 loopback 目标并携带显式 token；启动先检查笔记本隔离，再仅清扫 `lv-checkin-smoke-*` 前缀。共享工作区与真实 AI 请求分别需要精确环境变量显式放行；测试 teardown 只停止本次拥有的子进程，附着内核不调用远程退出接口。独立 workspace 与第二实例的真实写入验收留给具备隔离 token 的现场窗口。
- 洞察日期格保留原生 button 角色，分组容器承载集合语义；自定义洞察日期范围采用包含首尾、最多 366 天的明确契约，超限在 UI 与核心双层拒绝，避免通过 ARIA 角色覆盖交互控件。
- 会话诊断 detail 在追加与归一化入口统一遮罩常见 credential 键及用户绝对路径，并限制最终长度；只降低常见误分享风险，不承诺完整匿名化，导出仍要求用户检查。专注桶、审计和建议审计属于不同格式，本次不扩成全局任意文本净化器。
- 诊断导出确认框只展示最近 3 条经过同一归一化/脱敏边界的 detail，并做 HTML 转义；原始完整上下文仍不直接呈现，分享前继续要求用户检查。

## D-356：组合包实时选择与模板身份收口（2026-10-06）

- 组合包预览的选中数量来自当前 DOM，全部取消时按钮必须禁用并同步 `aria-disabled`；提交仍在 mutation 锁内按最新 store 重建计划，避免预览期间的并发变更覆盖现有项目。
- 内置模板的重复判定不能依赖当前语言显示名。后续优先引入稳定的内置模板锚点，并为没有锚点的历史项目保留受限的中英文别名兜底；普通用户自定义同名项目不应被误判为内置模板。冲突编辑入口绑定现有项目 ID，避免语言切换后按展示文本找不到目标。
- 历史项目没有来源锚点时，跨语言别名只有在完整规则面与内置模板一致时才可判为同一项目；规则不同则保留为用户项目并允许显式创建，避免“同名即认领”。

## D-357：外部来源首次补拉的生命周期所有权（2026-10-06）

- 微信读书就绪后的延迟首次补拉属于插件自有异步资源，必须像轮询 interval 一样登记、在执行前清空句柄，并在卸载阶段 clearTimeout；不能依赖匿名 timeout 在宿主销毁后自然结束。
- 宿主主题观察器的 debounce timeout 也属于自有异步资源；断开 MutationObserver 不会自动取消已排队回调，停止 watcher 必须同时 clearTimeout。
- 合并渲染使用的 requestAnimationFrame 同样属于插件自有异步资源；卸载入口先 cancelAnimationFrame 并清零句柄，再拆除 surface 与存储，避免下一帧触碰正在销毁的实例。

## D-358：性能先观测再优化（2026-10-06）

- T-1650 先用独立的生产 bundle、内存宿主和固定 fixture 观测 Insights 366、Review 10k 与双 root；脚本只写忽略产物，不调用真实内核、不设置未经校准的硬阈值。
- 同一 Edge 152 环境三次中位数波动明显（Insights 31.6–64.4ms、Review 91.4–227.0ms、双 root 103.0–287.6ms），因此优化前必须固定硬件/浏览器/预热协议并积累样本；CSS 继续按 D-246 仅报告，真实 Android/宿主 I/O 另行验收。

## D-359：窄 dock 提醒流内化与 320px 双语操作轨道（2026-10-06）

- 宽 Tab 保留原型的右下角瞬时提醒；移动表面以及宽度不超过 719px 的 dock 将提醒插入宿主列流，避免遮住任务卡、事项空态、编辑字段和保存栏。
- dock 宽度可能在提醒已经显示后被拖动，因此通过宿主 `ResizeObserver` 重新评估挂载位置：窄化时移入列流，放宽时恢复原型固定 toast；卸载时断开观察器。
- 320px 下搜索、筛选、多选固定为 `1fr / 64px / 56px`，多选按钮保留 44px 以上触控高度并为英文 “Select” 留出完整可见宽度；不以压缩文字或隐藏标签换取几何通过。
- 视觉证据以最新生产构建截图为准；`visual-qa.cjs` 仍在草稿冲突 fixture 处失败，不能把该脚本写成全量通过。

## D-354：按当前证据补齐精品插件待办，保留发布与合并边界（2026-10-06）

- 用户要求梳理现状、功能和开发进度，完善功能/UI/交互/体验/头像/README/GitHub 等待办；本轮落实为 [产品评审与任务卡](docs/product-review-and-backlog-2026-10-06.md)、TODO 当前索引及旧路线/Agent 入口同步，后续按切片实施，不把审计请求扩大为全部产品改造或外部发布。
- T-1623/1624/1625/1626 已交付，不重复排队；T-1611/1612/1618/1614/1582/1632 已有实现切片，整体验收继续开放；T-1622/T-1621 保留当前可靠性主线。原开放 T 编号全部保留，Task Horizon 旧编号映射到同一协作工作包，AG 清单的历史 ready 标签不覆盖源码事实。
- 新增 T-1636～T-1654；T-1636 为本轮已完成的对账工作，其余 18 项仅登记，带依赖、范围和验收。发布分段/正式摘要、环境/CI可达、设置搜索/首成空态/可访问角色是当前证据支持的独立缺口，品牌/指南/支持等复用既有能力，不另造页面、账本或遥测。
- AG 依赖按基础投影/工作流先于展示层修正：AG-059 不再反向依赖 AG-039，AG-088 不再反向依赖 AG-057，解除两条设计循环；不修改未完成条目的复选状态。
- 当前分支协议的保护文件、版本和两机合并冻结继续生效，本轮不改 PROGRESS/版本/受保护 README 发布信息，不推送或发版。新增任务的 ready 仅授权本地允许范围，受保护字段与正式外部应用留合并后的对应窗口；GitHub 当前默认分支不等于发布授权。
- 本轮 check、build:check、主链与 UI 链实测通过；不把它们写成完整质量/发布/Android验收。现场与上游证据分栏，沿 D-275 不重新以等待设备挂起所有本地工作；CSS 体积沿 D-246 仅报告。

## D-346：辅助桶删除标记与恢复动作时间序（2026-10-04）

- T-1622 失败箱的丢弃、重试成功和启动恢复成功都写入按条目身份的 `tombstones`；归一化/合并先应用墓碑，旧窗口条目不得复活。墓碑不自动清理，避免容量剪枝放过陈旧写入。
- 提醒 `restore` 记录为同一实例的带时间 `restore` action，和 `snooze/skip` 使用同一身份并集；投影按该实例最新时间动作解释，旧动作被恢复记录遮蔽，恢复之后的新动作仍有效。旧 `{version:1,actions}` 数据继续可读。
- 保存失败只回滚当前内存桶并保留可重试状态；事件事实不因失败箱清理失败而回滚，下一次写入仍携带墓碑。


## D-344：事项页会话状态归属 Occasions root（2026-10-04）

- 事项搜索、状态/类型/时间筛选、模板分类与展开、帮助展开、表单打开态、表单草稿、提交中、删除中、笔记展开和实例改期展开都属于触发它们的 `OccasionsRootContext`；多个事项表面可以同时保留不同筛选和表单输入。
- 表单保存、删除和异步补标记只在 root 仍注册、连接且仍处于事项页时更新该 root；表单 session 号变化或页面切换后，旧回调不得清空新表单状态。
- 提醒天数 `datalist` 的 id 每次按 root 渲染实例生成，并由同一 input 的 `list` 属性引用；无 root 入口继续走兼容字段，但不参与 root-aware 隔离判断。

## D-343：模板包导入决策归属编辑器 root（2026-10-04）

- 模板包文件解析后的逐项决策是当前编辑器表面的会话草稿，存入 `EditorRootContext.templateImportSession`；另一个编辑器 surface 可以同时处理另一份导入文件。
- 文件解析、单项 disposition 修改、确认、取消和成功后的重绘都携带触发 root；确认只清理并重绘该 root，失败保留原模板与当前导入决策。
- 无 root 的旧 `templateImportSession` 字段继续作为兼容回退，不能覆盖已经注册的其他 root 会话；普通编辑器导航进入新会话时清除旧导入决策。

## D-342：项目草案是编辑器 root 会话状态（2026-10-04）

- Review 的项目草案进入编辑器时，草案载荷、清除动作和预填重绘必须绑定触发的 `EditorRootContext`；两个 Review surface 可以同时检查不同草案，不能共用宿主级 `pendingProjectDraft`。
- 生产导航始终调用 `openProjectDraftEditor(draft, root)`，编辑器只从所属 root 读取并在预填一次后清除；编辑器普通新建/编辑会话会显式清空草案，避免旧草案泄漏到下一次编辑。
- 无 root 的旧入口保留全局兼容语义并作用于所有现有 surface；这不改变 root-aware 入口的事实来源，也不把兼容路径当作多 root 隔离能力。
- 草案检查流的默认返回页固定为 Review；用户仍需在普通编辑器中手动保存，草案入口不直接写入主 Store。

## D-339：root 生命周期以注册身份与连接状态双重守门（2026-10-04）

- RootContext 只对仍在 Map 中且仍连接的表面有效；`pageForRoot` 对已忘记 root 不再隐式注册，`render`/异步回调不得借旧 HTMLElement 重新创建会话。
- 关闭 Review root 先取消该 root 的摘要请求；卸载和下一次 onload 清空 root Map、活动 root、焦点镜像与页面镜像。关闭表面后的事实写入仍可完成，但不得更新已关闭表面的会话或 DOM。
- 设置页入口（返回、回顾记录、编辑项目、新建项目）显式携带触发 root；事项删除/保存与文档目标检查回调在 root 关闭或切页后只结束后台工作，不清理新会话状态。
- 继续保留宿主字段作为无 root 兼容镜像；root-aware setter 同时更新 active root，避免 secondary 表面的用户操作把镜像留在另一表面。

## D-340：Today 纯会话按 root 隔离，持久化视图偏好继续共享（2026-10-04）

- `bulkMode`、`bulkSelected`、精确录入展开项、待上传附件、快速录入取消令牌和优先提醒展开态只属于具体 Today 表面，统一由 `RootContext.today` 持有；批量绑定、键盘导航、精确录入、附件提交、快速录入和局部卡片刷新必须使用触发 root 的状态。
- 分组折叠、排序和已完成折叠已经进入视图偏好持久化，继续在表面间共享；迁移它们会把用户明确保存的显示偏好错误地变成窗口会话态。
- Settings 来源卡片展开态同样属于 root 会话，使用 `SettingsRootContext.openSourcePanels`，不再额外维护按 root 的 WeakMap；宿主字段只保留兼容镜像，关闭 root 时随 `RootContext` 一起释放。

## D-341：Today 交互绑定的动作与重绘必须回到触发 root（2026-10-04）

- 键盘导航、批量动作和卡片上下文菜单都以所属 root 判断当前页面、重绘目标和编辑/洞察导航；不得读取宿主共享 `currentPage`，也不得用无 root 的 `render()` 或导航调用把另一表面一起切换。
- Today 局部卡片刷新补回的洞察按钮保留其卡片所属 root；洞察返回页由统一 root-aware 导航计算，不在绑定器中直接写宿主共享返回字段。
- 视图偏好字段（分组、排序、已完成折叠、热力图年份、待完成过滤）仍按共享偏好语义重绘全部表面；本决策只收口 root 会话动作，不改变持久化偏好范围。

## D-337：LifeLog 映射使用可保存草稿，源段时间与摄取时间分离（2026-10-04）

- 映射改为可增删行，目标搜索完整分钟项目库，适配器与偏好重载都不截断到 50 条。重复来源、缺目标、归档和非分钟目标显式阻止保存；草稿按 root 保留，失败可重试，放弃草稿可重新读取保存值，另一表面的变更不能被陈旧草稿静默覆盖。
- 新事件使用上一 Marker 到当前 Marker 的源段开始时刻，保留源秒数；分钟结算、当前记录的项目归属和 `yeguif:<blockId>:<localDate>` 身份维持旧契约。无效时间不回退摄取时间，旧事件不迁移，旧墓碑不复活。
- 无显式映射时仍允许唯一同名分钟项目自动匹配，摄取前置检查不再依赖旧单目标字段。真实源内容与目标修改后的历史重结算仍保留为 T-1544 条件项。

## D-338：Review 生成请求与错误归属请求 root（2026-10-04）

- 每个 Review 的 `summarySession` 单独维护请求号、加载和错误；开始、取消、范围变更与页面离开只影响该 root。无 root 入口保留全局兼容；事实变化时统一取消全部在途请求。
- 返回前复核 root 是否仍连接、上下文是否仍注册、请求号、页面、范围、提供方身份与输入事实摘要；旧请求的 finally 不得清除新请求的加载状态。关闭的 root 不因回调重新注册或重绘。
- 分析历史仍为共享持久事实，按精确范围和输入摘要选取；本切片不把其他页面状态或建议工作流的全量 root 生命周期算作已完成。

## D-336：README 只描述发布基线，按首次使用顺序组织（2026-10-04）

- 首屏说明定位、当前发布版本、安装与反馈；正文按安装/首次记录、功能、统计与导出、可选联动、API、开发与交流组织。未提交工作树进展指向 PROGRESS，不包装成已发布功能。
- 历史版本详细信息使用发布说明归档，不在首页重复堆叠。小驴四款插件名称与 QQ 群保留；没有核实的系列外链不添加。
- 文档验收使用实际 Markdown 渲染结果，检查本地链接、页内锚点、图片、HTML 结构、双主题与窄屏；生成的 QA 文件留在 .artifacts，不加入产品测试链。

## D-333：主 Store 事务与辅助保存队列分离（2026-10-04）

- 渲染块打卡、问卷事实写入、建议确认与撤销都经 `enqueueMutation`，在锁内重读主 Store 后再校验点击时指纹及执行保存；失败保留事实前内存和可重试工作流，成功后才消费建议令牌。
- 偏好使用 `auxiliarySaveQueue`，主 Store 保留 `saveQueue`，避免辅助写等待存储锁、主事务又等待同一保存队列的循环等待。卸载必须等待两队列。
- 编辑器只在宿主 `saveForm` 内对 `saveEditorForm` 入队；绑定层直接调用宿主，联动偏好保存放在主事务返回后。生产方法失败注入和超时守门已验证该边界，不恢复会把联动偏好一起包入锁的外层入队。

## D-334：相同时刻的建议审计按生命周期排序（2026-10-04）

- 跨窗口审计先按时刻排序，再按创建、决定、执行的生命周期顺序排序；撤销在同一时刻最后，最后才用内容排序打破剩余平局。不能用 JSON 字典序把执行排在确认前面。
- 合并必须幂等、与窗口顺序无关，失败撤销保留原审计及撤销能力；同毫秒确认/执行/撤销有专门回归。

## D-335：Review 查询及记录筛选归属触发 root（2026-10-04）

- `historyQuery/historySource/historyMetering/historyOrder` 加入 `RootContext.review`；渲染、搜索延迟回调、清除、来源/计量/排序动作都读写触发 root。搜索 IME 和过期节点守卫仍保留。
- 四字段同步纳入兼容快照，旧无 root 字段写入仍只迁移到目标/active root；计量筛选进入 `SurfaceContext.params.filters.metering`。本切片不冒充 Review 批量、折叠和其他页面全量状态已完成。

<!-- merge note: retained origin/main entries for conflict 1; both sides preserved -->

## D-372：推荐草案预览进微信读书卡，逐项应用即用户显式通道（T-1736 首切片，2026-10-01）

- 引擎（D-371）的消费端落地：微信读书卡在 sourceFacts 后渲染**推荐草案预览区**——唯一分钟项目绑定建议（含项目名可读化）与阈值回归通用默认建议，各带独立"应用"按钮（data-rec-apply 按 target 分发走用户显式 applyPreference——**建议≠启用**，应用即用户确认的写入）。needs-choice（多项分钟项目）不出应用按钮（引擎不猜，渲染层如实引导手动选择）；已配置/无建议不渲染（无建议也是结论）。
- **取消零写入**：预览区只读展示，唯一写入触发是"应用"点击；不做"一次确认全部"的伪原子（逐项独立、失败互不影响，跨窗后写者胜如实）；原手动下拉入口保留。"差异对照（已保存→草案）"的完整版本（含用途/可能写入说明）归 T-1736 主体后续切片；本切片=单分区逐项应用闭环。
- i18n 5 键×2；settings.ts 渲染层函数不持状态（每次渲染重算，纯投影）；CSS 预览样式 6 行。

## D-371：推荐引擎纯函数核心先行，建议形状版本化（T-1735 首切片，2026-10-01）

- T-1735 拆片从**引擎纯函数核心**起步（T-1736 预览确认、T-1737 应用事务为其消费端）：`features/recommendation-engine.ts`（RECOMMENDATION_VERSION=1）——首批规则限定阅读时长映射：唯一分钟单位活跃项目→推荐绑定（复用 D-366 wereadCandidates 投影）、多项→needs-choice（引擎不猜、choiceCount 如实）、无→no-candidate（rec.noMinuteItem）、已启用已绑定→不重复推荐（rec.alreadyConfigured，无建议也是结论而非静默空）；阈值建议恒为通用默认 30（evidence=general-default 如实标注非个性化）。
- **纯函数零写入**（结构钉：模块不出现 persist/saveData/enqueueMutation/applyPreference）——建议是纯投影，启用永远走用户显式通道（沿 template-linkage 纪律）；确定性同输入同输出（夹具验证）；版本化常量使规则调整可追溯。
- 建议形状（key/target/value/evidence/reason/preconditionMet/needsChoice）已为健康映射、视图偏好等后续规则定型；预览确认 UI（T-1736）按形状渲染，应用事务（T-1737）按 target 逐字段提交。

## D-370：30 项首卡预算重校准——occasion 横幅是功能堆叠非回归（width 排查切片二，2026-10-01）

- 30-habits 首卡预算 380 系 R-18.3b 时代（aa5ebde）校准，其后 21 个布局提交（T-1577 console 改造、T-1585 today banner、T-1590 洞察等）加入使堆叠自然增长——**校准过期而非产品回归**。STACK 补全探针定位多出的堆叠：occasion 横幅（今日生日，date=今天+提前 30 天提醒，来自 walkthrough 种子 otherStores）top=265 h=104。
- 裁决：非 mobile 首卡预算**按宽度分档重校准**（640→475、360→515、320→545，覆盖实测 467/509/540），mobile 400 不变；预算仍能抓住大幅布局回归（超预算即失败）。STACK 加宽探针（含 overview/banner/save-status/filters 等块）保留为诊断资产。
- 不把横幅从压力场景排除——横幅是真实功能堆叠，测试应反映真实页面；也不无限放宽预算——分档值贴近实测留 5~10px margin。

## D-369：健康映射候选按指标过滤（T-1745 切片，2026-10-01）

- `healthCandidates`（features/health-candidates.ts 纯投影）：steps 只候选**"步/步数"单位**、weight 只候选**"公斤/千克/kg"单位**的活跃项目——与写入校验 hasHealthTarget 同纪律，把"摄取时才拦截"提前到"候选层就不可选"。当前绑定项永远保留置顶（retained，与 weread-candidates 同语义）；同项目可分别绑 steps/weight（多指标语义保持，metric 逐绑定传入）。空候选渲染 disabled 占位不静默；选项内联单位标注。
- 健康文档选择维度不动（仍经 T-1616 目标校验与用户确认，不凭标题猜文档）；本项只收口项目维度的候选过滤。
- 与 wereadCandidates（D-366）同模式不同纪律细节（步/公斤词表 vs 分钟/二值/数值），不抽象共用基类——两投影各自显式，避免为两处过滤造抽象层。

## D-368：思阅/思播分钟候选与宿主探测诚实显示（T-1744 切片，2026-10-01）

- 思阅/思播下拉候选复用 `wereadOptionsFor(id, "minutes")`（D-366 投影，wereadCandidates minutes 过滤）——与写入校验同纪律，非分钟项目在候选层不可选；wereadOptionsFor 改函数声明（提升）解决思阅定义点在前的问题。
- 思阅卡显式显示**等待说明**（"暂无公开的宿主探测接口，无法显示连通状态；以真实写入结果为准"）——不显示假连通；思播保留既有三态探测显示（available/missing/unknown）。多来源重复计量检测（思阅+微信读书同 itemId 的 source-conflict）既有且结构钉固化；候选纯投影不启动监听、不改旧事件。

## D-367：微信读书卡生效摘要可见，阈值默认说明来源（T-1743 切片，2026-10-01）

- 配置分散四处（下拉即存/Key+阈值保存/启用/拉取）的主诉解法不是合并动作而是**让已生效状态可见**：微信读书卡新增只读"当前已生效"摘要行（启用态/绑定项目名/阈值/Key 已存-未设置），全部渲染自 ctx.wereadIntegration **已保存值**——不含未保存输入框草稿，摘要即真相。既有守卫（启用需绑定+Key+分钟目标、拉取需配置+启用、Key 遮罩/留空保留/清除确认）结构钉固化。
- 阈值 hint 明示 **30 分钟为通用默认值而非个人历史最佳**——为 T-1735 推荐主线（"推荐值+理由+证据来源"）预填了诚实基线：现状是通用默认，推荐层才能声称个性化。
- 结果区分层（配置完成/网关成功/真实写入）需 ingestWeread 内部分层信息，归推荐族主线一并设计，本切片不伪造分层。

## D-366：微信读书映射候选按指标过滤（T-1742 切片，2026-10-01）

- `wereadCandidates`（features/weread-candidates.ts 纯投影）：阅读时长只候选**"分钟"单位**活跃项目——与写入校验（hasMinuteTarget，unit==="分钟"）同纪律，把"启用时才失败"提前到"候选层就不可选"；完读候选二值、笔记候选数值（非二值）。**当前绑定项永远保留**并置顶（retained 标记沿用 projectOptions 语义）——不因归档或排到窗口外丢失真实绑定。
- 候选为空显示 disabled 占位（set.wereadNoMatching）而非静默空白；选项内联单位标注。同一项目多指标仍可分别绑定（既有语义不合并）；思阅/思播的通用 projectOptions 不动（无单位歧义）。
- T-1742 剩余（唯一可信候选预填草案、无项新建路径）归推荐族主线 T-1735。

## D-365：提醒处理状态进事项页，与完成语义分离展示（T-1722 切片，2026-10-01）

- 宿主把 `reminderUserActions` 传入事项视图；事项行标题区对**当前发生日**显示提醒处理徽章：skip=已跳过、snooze 未过期=已延期（expiresAt 未到或同日语义），过期/同日过后自动消退不显示；**与"本次已完成"徽章语义分离并排**——提醒已处理不等于事项已完成。完成时提醒徽章让位（doneThisTime 优先渲染顺序）。
- 词表复用提醒中心既有 `review.remindersSkipped/Snoozed`（不新增同义键）；最新动作胜（同 id 排序取后者，与 applyReminderActions 的 latest-map 语义一致）；**提醒动作不写 completedDates** 纪律以 bind 源切片钉固化。跨午夜/安静时段/restore 跨窗清除归 T-1721/T-1662。

## D-364：CSS 不持有 i18n 文案，停用状态由渲染层双语徽章唯一承担（T-1723 切片，2026-10-01）

- components.scss 停用伪元素 content 写死中文"已停用"——en-US 双语漏出，且与渲染层 status 徽章（occ.statusDisabled，双语）在同一行重复显示。裁决：**CSS 一律不持有 i18n 文案**——伪元素 `content: none` 显式中和，停用状态由渲染层双语徽章唯一承担（信息不丢失，只是去掉重复的写死第二处）。全 SCSS 五文件清点确认无其他中文 content 字面量（夹具固化防复发）。
- datalist id 用模块级递增序列，多 root 同屏不冲突（盘点确认）。剩余收口项（图标读屏实测、details 焦点、320px/触屏/IME 实测）需真实宿主走查，host-pending。

## D-363：事项行显示转打卡关联状态，徽章跨页直达编辑器（T-1720，2026-10-01）

- 宿主把打卡 store 中 `linkedOccasionId` 非空的项投影成 `linkedItems`（id/名称/关联/归档态）进事项视图；事项行 meta 区显示**关联项目徽章**（名称，归档附"已归档"诊断），点击经 `showEditorForLinkedItem` 跨页打开该项目编辑器（返回回事项页）；**归档项目不可进**（先启用再编辑，防止在归档态继续写打卡事实）。
- 项目删除后徽章自然消失——事项侧无墓碑无法诊断"曾关联"，失效诊断（含解绑语义）归 T-1721 删除墓碑方案一并定稿；**重建走既有转打卡按钮**（重复拦截排除归档项，归档后可重建），不另造入口。
- 原事项完成与打卡事件保持各自事实语义不变（完成 occasions 不写打卡事件，反之亦然）。

## D-362：完成记录保留窗口透明化，不暗示完整历史（T-1719，2026-10-01）

- 事项行 meta 区新增**完成计数徽章**（保留窗口内 completedDates.length）+ **窗口满提示**（≥120 时追加"仅保留最近 120 条"，title 给出完整口径：更早记录随窗口滚动不再展示、统计不受影响）——有限记录不再暗示完整历史。未满窗口只显计数。
- 不扩容/不分页（120 窗口维持，性能上限既有）；历史日期逐条撤销：下次发生日走 T-1712 行内切换、错过日走补标通道，更早日期的逐条撤销列表归 T-1723 验收族；导出/备份如实带窗口内记录（不标注"完整"）。改期实例口径不变（D-351 链解析）。

## D-361：事项排序三模式可选，千项成本实测有界（T-1715，2026-10-01）

- 排序三模式：`next`=启用优先→下次日期→名称（既有默认**逐值不变**，老用户零感知）；`name`=启用优先→zh-CN localeCompare 名称；`updated`=启用优先→最近修改降序。enabled 恒最前、无下次日期在 next 模式排后的口径三模式统一。宿主会话字段 `occasionSortMode`（缺省 next），筛选面板排序下拉往返自动恢复；不持久化为偏好（事项排序属轻会话偏好，跨会话保留归 T-1620 偏好通道统一）。
- 效率：agenda O(n²) 已在 T-1706 消除；本轮千项冷渲染冒烟（renderOccasionsView 全量）三模式实测远低于 5s 预算——**索引/分段呈现暂不需要**，如实记录基线；未来劣化再启用（不预设优化）。
- 排序下拉与筛选下拉分离（data-occasion-sort 专属，排序不是筛选维度）。

## D-360：新建查重只提示不合并，合法重名确认后保留（T-1717，2026-10-01）

- `findSimilarOccasions`（occasions.ts 新导出）：exact=同名（trim+toLocaleLowerCase 精确），similar=双向包含；排除编辑目标自身；上限 5 条防弹窗过长。**只提示不合并**——confirm 列出命中名字，用户确认后才新建（合法重名如不同人的生日明确可保留）；不自动合并事实、不改写既有事项。
- 查重点：新建提交路径（幂等门之前、校验之后）。编辑既有事项不查（改的是自己）；模板二次应用走保存通道即被查重覆盖；转打卡已有 linkedOccasionId 拦截+名称查重经同一 helper 亦可覆盖；停用事项算重名（事项无归档概念，enabled=false 是停用，停用项重名仍值得提示）。
- 名称比较 trim+toLocaleLowerCase——输入任意语言安全（大小写不敏感不含 CJK 影响）；不做模糊相似度（编辑距离等）——双向包含已覆盖"生日/妈妈的生日"类误建，模糊匹配误报率高不值得。

## D-359：改期行内核对/撞实例反馈/撤销只清本次覆盖（T-1718，2026-10-01）

- 改期 move 行三补：①**原日→新日可视核对**（origin 标签随选日更新 `{from} → {to}`）；②**撞实例 confirm**——新日撞已完成记录、其他覆盖目标或已有覆盖键时明确反馈（允许但知情，不静默）；③**撤销入口**——改期过的实例显"撤销改期"，`findOverrideOriginFor`（overrides 值反查键，新导出）解析撤销对象，`saveOccasionOverride(id, origin, undefined)` 走 setOccasionOverride 既有 delete 分支只清本次覆盖。
- 边界：链式改期撤销中间环仅清该环、前后覆盖保留（夹具验证）；跨年移动允许（min=today 只挡过去，引擎原生支持跨年）；已完成的 9/20 实例完成记录不迁移（历史事实不重写——改期改的是未来发生日，已发生事实归档）。
- 签名放宽 `saveOccasionOverride(newDate?: string)`（undefined=撤销），occasions.test 结构钉同步；提示文案分支 moveDone/moveUndone。

## D-358：规则预览走 getOccurrenceDate 单一迭代，游标次日制推进（T-1716，2026-10-01）

- `buildOccurrencePreview`（features/occasion-preview.ts 纯投影）= getOccurrenceDate 单一实现的迭代包装：从起始日（含）找 count 次未来发生日，**游标推进为 addDays(发生日, 1)**（次日制）——首版 cursor=发生日本身导致同日重复（夹具红出后修正）；1500 步守门。提醒出现日=发生日-remindBeforeDays（clamp 到发生日本身）。once 已过/无未来发生日返回 reason 键由渲染层 i18n，不猜测。
- 入口：事项表单内只读 `<details data-occasion-preview>`（编辑既有事项以当前规则渲染骨架），bind 侧从表单值构造 normalize 输入（与 saveOccasionForm 同字段集合）实时填充——**内联校验=normalize 失败或零发生日如实显示**，不造第二套计算；折叠态 host.occasionPreviewOpen 跨重绘保留（先例 occasionTemplatesOpen）；零写入，失败保留输入。
- 字段级错误解释（非法日期等）由既有保存校验承担，预览层只以"无未来发生日"如实呈现——两层职责不合并。

## D-357：事项搜索 IME 保护与光标保留（T-1714，2026-10-01）

- 事项页搜索对齐 Today 搜索的既有先例（T-1599 族）：**composition 期间 input 不重绘**（compositionstart/isComposing 拦截），compositionend 应用一次；非组合输入**保留光标位**（min(caret, len)），不再强制跳末尾（中文中间插入不再错位）。旧节点（isConnected）/卸载（disposing）不渲染；query 本就宿主字段，往返自动恢复。
- 不加防抖：事项列表量级小、同步渲染保证结果数与输入一致（与 Today 的 120ms 防抖场景不同——Today 有 quick-entry NLP 与大列表）；若千项压力实测需要，归 T-1715 排序效率专项。
- 筛选改变不抹表单：T-1708 草稿独立于搜索筛选（input 监听只挂搜索框）；草稿快照/恢复层不动。

## D-356：统计即筛选，错过口径与 agenda 桶同源（T-1713，2026-10-01）

- 事项页统计从纯文本数字改为**可点击筛选入口**（全部/启用中/今天/已错过/已结束五项）：每个统计携带 status/time 筛选组合，点击直达对应列表；`is-active`+`aria-pressed` 高亮当前筛选，`title` 明示口径（"含停用"/"启用且下次发生日为今天"/"启用且存在未处理的错过发生日"等）。
- **错过口径与 agenda missed 桶同源**：enabled + `getMissedOccurrence` 非空（改期链解析，D-351）——时间筛选下拉补"已错过"选项，统计计数、筛选谓词、agenda 分桶三处同一函数同一谓词；"今天"计数同样与 today 桶一致（enabled && next===today）。"已处理"不另造计数（completedDates 与今日横幅/回顾同源，无独立投影）。零结果空态在有筛选时附清除按钮（可恢复路径）。
- 实现取舍：不把统计改为独立投影层——计数谓词直接内联同函数，保证未来 agenda 口径调整时统计不会漂移。

## D-355：事项行内完成切换与启停图标消歧（T-1712/T-1711，2026-10-01）

- 完成闭环：事项行新增**完成/撤销当前可处理发生日**（=下次发生日，`isOccasionCompleted(item, next)` 判定）——`data-occasion-complete[-date/-target]` 复用 `setOccasionCompleted` 单一通道（与今日横幅/回顾/补标同源，撤销同通道回滚），`aria-pressed` + "本次已完成"徽章回显；错过补标（lateMarkup）与本次完成并存不冲突。启停（`data-occasion-toggle`）保持独立语义，互不混淆。
- 图标消歧（T-1711 切片）：启停图标 check/circle → **pause/play**（新 UI 图标，语义=暂停/启用而非完成）；行动作保留 action-label 文字节点与 aria+title。窄宽度更多菜单/焦点回归归 T-1778/T-1822。
- 完成入口只挂"下次发生日"——补标走既有 missed 通道（D-351 改期链解析），已结束/停用不出完成按钮（item.enabled 与 next 双门）；不把启停或提醒已读当完成（审计红线）。

## D-354：事项表单草稿输入即快照，重绘恢复+远端冲突 confirm（T-1708，2026-10-01）

- 草稿生命周期：**输入即快照**（form input 监听，相对绑定期基线 dirty 时写宿主态 `occasionDraft {editingId, baseUpdatedAt, values}`）→ 任何整页重绘（含 onDataChanged 远端重载）后绑定期按编辑目标匹配**恢复**（单次消费）→ 保存成功/取消编辑/新建/模板程序性覆写清草稿。**离开不 confirm**——草稿已自动在宿主态，切页/弹窗关闭不丢数据，比离开确认更顺；重载回来时若远端更新过同事项（baseUpdatedAt ≠ 现 updatedAt）confirm 冲突：确定=保留草稿继续编辑，取消=载入远端数据。
- 会话态边界：不跨插件重载保留（与 T-1773 编辑器同口径，明示）；按 root 多槽与焦点/滚动恢复归 T-1663（单槽已覆盖单编辑场景）。程序性批量写表单（模板套用）后必须清草稿——否则重绘恢复会盖回模板前的值（纪律写入注释）。
- occasions.test 的 bind 依赖白名单增补 `../features/editor-draft` 并配 FormData 垫片（bind 尾部草稿层 new FormData），垫片作用域块后恢复原值。

## D-353：事项写入口锁内重读、字段级应用，提醒写挂队列（T-1707，2026-10-01）

- 点击层只捕获**最小身份**（id），入队执行时锁内重读最新条目做**字段级应用**（toggle 只翻转 enabled）——队列等待期间其他入口/远端的改名改期不再被点击时的陈旧整对象快照覆盖（夹具红证：旧写法并发改名后整对象回写丢名）。删除锁内重读存在性（已删跳过）；与远端并发删除的冲突裁决**明确留给 T-1721 墓碑方案**，本项不做。
- `saveOccasionOverride` 的内存应用与持久化**全程入锁**、next 基于锁内最新 store 计算——消除"先改内存再入队"与队列中其他写入交错时基于陈旧引用回滚的面。
- `reminderUserAction` 独立桶写入挂 mutation 队列 await（与事项持久化顺序化），入口加 disposed/disposing 卸载门（拆卸期动作静默丢弃）；加载-合并-序列化-回滚结构不变。
- 编辑路径（saveOccasionForm）本就从宿主状态取 existing、字段全量来自用户表单，无需重读改造；跨窗口并发写（远端新建/改期被本窗覆盖的场景）属两窗口写写冲突，归 T-1622 总账与 T-1721 删除定稿。

## D-352：事项存储按 id 去重隔离，完成日期唯一升序，agenda 一次映射（T-1706，2026-10-01）

- 损坏数据/手工编辑可引入同 id 多条——agenda 按 id 回取行会错行、按 id 写操作同时命中。裁决：**normalizeOccasionStore 规范形即去重隔离**（同 id 胜者确定性：updatedAt 新者 → completedDates 更多 → 先出现；静默收敛，不报错不打断——"可恢复报告"以确定性规范形承担，存储写入即修复）。agenda 循环改行与条目按构建序 zip 一次映射（同 id 错行与 O(n²) 同源同消）。
- `completedDates` 归一为**唯一 + 升序 + 最近 120 条**（Set 去重 + localeCompare 排序后截尾）——重复/乱序输入归一确定性形；排序契约更新 occasions.test 既有乱序断言。overrides 确定性（60 条插入序）与既有时间戳处理维持。
- 未采"保留重复 + 报告冲突"方案：去重在唯一读入口（normalize）一次性收敛，所有消费面（agenda/写操作/导出）自动一致；重复条目无独立用户可见价值（同 id 即同一事项的损坏副本）。

## D-351：错过判定跟随改期链，补标对象=实际发生日（T-1705，2026-10-01）

- getMissedOccurrence 逆推原周期日后只查原日完成——改期实例（9/15→9/20）在新日完成后仍误报原日漏记；反向场景改期日未完成时补标对象指向原日，造成重复完成。裁决：**逆推原日经 resolveOverrideTarget 跟随单次改期链（有界 8 步防环）解析实际发生日，完成与补标都以实际发生日为准**；原日完成的记录仍是历史事实不迁移。无覆盖时与旧版逐值一致；once/农历/第 N 周/停用早退口径不变。
- 取消改期（清 override）自然回原日口径；跨月/年覆盖与首个锚点（锚点前 unavailable）由日期无关的链解析与既有语义覆盖。消费方为事项页 agenda 分桶与补标动作（返回值即 data-occasion-complete 的 date），修一处全表面一致。

## D-350：历法事项闰日顺延至 02-28，与月末 clamp 同纪律（T-1704，2026-10-01）

- 语义矩阵探针跑现状九场景，证实唯一偏差：**闰日（02-29）annual 在连续平年返回 undefined**——生日/年检从今日、即将分组与提醒中消失两个年度（红证 3bdef3b）。其余场景现状即合理并文档化钉住：月度 31 号月末 clamp（02-28）、每月/每年第 5 个星期X 在不存在的月份**跳过至下一个存在该周的月份**、未来锚点年检按"锚点 MM-DD 每年"、interval 年单位闰日锚 clamp、农历 annual 换算正常。
- 闰日顺延策略自决（日历客观语义，非产品方向）：非闰年顺延至**当年 02-28**——与 monthDate/interval 引擎既有的月末 clamp 纪律一致；闰年仍优先真实 02-29。occasions.test 既有"平年窗口内 length=0"断言是修复前消失行为的钉，按新契约更新为顺延日出现在提醒窗口。
- 验收同源性成立的前提不变：下一发生日/倒计时/今日分组/提醒/预览全部消费 getOccurrenceDate 单一实现，修一处全表面生效。`tests/occasion-calendar.test.cjs`（预期表的执行形态）接入 pnpm test。

## D-349：编辑态套模板保身份，事项提交加在途门（T-1702/T-1703，2026-10-01）

- T-1702：模板在编辑态的角色是**覆写当前表单草案**而非另建——套用前 confirm 明示将覆盖名称/日期/规则字段，确认后 `editingOccasionId`/历史/关联保持不变；取消零写入。新建路径维持原样（清目标语义本就正确，模板即新事项起点）；「另建事项」走既有「新建」按钮，不造双入口。
- T-1703：提交幂等用 bind 闭包级 `occasionSubmitBusy` 在途门（同 root 表单重建后门自动复位）——在途期间忽略重复 submit，按钮同步 disabled+aria-busy，完成/失败 finally 释放即重试通道；编辑目标一致性由 saveOccasionForm 在锁内从宿主状态复核（既有行为，结构钉固化）。不引入请求身份/队列去重等更重机制（单窗口表单场景在途门已充分；跨窗口并发归 T-1622 总账）。

## D-348：事项编辑保留单次改期，规则变更时显式清空并提示（T-1701，2026-10-01）

- overrides（单次改期）的键绑定**旧规则的基点日期**——语义上从属于当时的重复规则。裁决：编辑非规则字段（名称/备注/提醒天数/启用态）时 overrides 原样保留；**日期或重复规则变更时旧覆盖失去意义，显式清空**（装配传 undefined）并 `showMessage` 提示——不静默保留永远匹配不上的死覆盖，也不静默丢弃用户可感知的改期。改 date 本身即 once 事项的改期动作，无需 overrides。
- 无效覆盖纪律不变：normalizeOccasion 校验键/值为真实日历日且非同日 no-op——合法项保留、非法项剔除、全无效归空（夹具三态验证）；持久化失败回滚原对象（既有 catch）。完成历史（completedDates）本就随装配保留，本轮结构钉固化。
- 红证：修复前装配从不传 overrides（cd5e23c），任何编辑保存都会清掉单次改期——P0 数据丢失路径。

## D-347：规则时间线=相邻修订 diff 只读投影，入口在编辑器高级区（T-1777，2026-10-01）

- 时间线是**相邻修订的六字段 diff 投影**（类型/目标/单位/方向/排期类型/排期细节），变化点挂在后一条修订上（"自该日起"），生效区间至下一修订前一日、末条=至今；解释键按变化字段一一映射（完成判定/进度分母按当日修订结算、方向切换不追溯改写——把 D-335/D-341 的口径讲给用户听）。createdDate 早于首个修订生效日的区间如实标"无法还原"（normalizeRevisions 的 fallback 无法表达历史真相，不猜测）。
- 入口与形态：编辑器高级区只读 `<details>`（查看项目时最自然的消费场景；回顾/洞察的「编辑规则」跳入编辑器即达，跨页直达入口归 T-1810 root 参数族）。查看零写入零重算（纯函数+静态渲染，details 折叠）。字段标签复用 KIND_LABELS/SCHEDULE_LABELS 与 editor.ruleChange* 既有词表，新增 19 键×2。
- 排期变化拆两层：类型变更与细节变更（weekdays/interval/quota 口径）各一行、各有解释——与既有当次 diff 的 frequency/detail 两层对齐。

## D-346：七日条钻取复用回顾按日状态，不做第二套日期上下文（T-1775，2026-10-01）

- 有内容日格 span→button 日期入口：点击写 `selectedHistoryDate/historyScope="day"/historyPage=0` 后 `showReview(root)`——与回顾日历 `data-history-date` **同一套状态与渲染管线**，不新建日期上下文或历史计算；返回经 applyNavigation 回今日，筛选/滚动由既有宿主状态与 pageScrollTops 保留。空日格保持 span（不可交互是诚实语义：无记录可看）。
- 文字状态对齐审计口径：`today.chipStatus.empty/pending/partial/complete` 四态进 title 与 aria-label（读屏同源），戒除破戒（atMost 项当日真实事件）加 `today.chipLapse` 后缀——破戒在现有谓词下天然落入 partial/complete 之外的表达缺口，单独点名而非改 isComplete。button 变体补 `font:inherit/cursor/focus-visible` 三行样式（今日同族色板）。
- T-1774（戒除"今日暂时守住"口径）涉及完成区表达/连击计今日/回顾 API 三处用户可见决策，登记 BLOCKERS「独立产品决策」待用户拍板；数据层 isComplete 与 D-219 底层承诺不动。

## D-345：回执直达事实走行内展开，不跨页深链（T-1776，2026-10-01）

- "查看此记录"选择**toast 行内展开**而非跳转回顾：回顾列表有分页（30/页）、渠道筛选与日期窗口，事件极可能不在默认视口，跨页深链要么改写用户筛选要么找不到目标；行内面板复用 `buildRecordDetails` 单一投影与 `lc-checkin__record-details` 既有样式（零复制、零新 CSS），默认收起、本地 DOM 切换不触重渲染。
- 回执 token（RecentRecord/RecentRecordView）增补 `source/localDate`：来源非 manual 显示 `source.*` 既有词表徽章（接口写入/思阅/思播/微信读书/叶归），manual 不加徽章（绝大多数记录无声响）。事件不存在（跨窗已撤销）时降级为旧形态无入口。失败不显示成功与撤销绑定 eventId 均为既有结构（T-1795），本项只钉不改。
- 快速弹窗、问卷与外部录入的幂等回执仍归 T-1786；渲染块锚点重试与记录 pending 分别归 T-1856/T-1857。本项只统一今日 toast 的事实可达性。

## D-344：编辑器草稿离开守卫落在 applyNavigation 单一咽喉点，基线写 root dataset（T-1773，2026-10-01）

- 全部页内导航（返回/切页/跳洞察/编辑器重入）汇于 `applyNavigation(root, page)` → 守卫放这一处即可覆盖所有离开路径，不在各渲染模块重复拦截。守卫条件三重：显式 root、目标页非 editor、当前页是 editor——进入编辑器与无 root 的全局导航永不拦（后者无 root 上下文可比，归 T-1805 多 root 后台重绘边界）。
- dirty 基线=绑定期表单签名写入 `root.dataset.editorDraftBaseline`（新建与编辑同法：各自初始表单即基线；按 root 天然隔离）。签名规则：FormData 键序无关排序拼接、**文件输入跳过**（附件走独立 pending 管线，T-1795 已保证失败放回）。取消=留在编辑器；离开=丢弃——**草稿不跨重载保留**，confirm 文案明示；模板套用/联动等程序性改值同属 dirty（它们就是用户意图的修改）。编辑器内部重绑定（模板流 host.render）会重置基线，dirty 语义=「自最近一次编辑器（重）绑定以来的修改」。
- 后台刷新与保存失败本就安全（renderBackgroundUpdateFor 对 editor 页 no-op；saveEditorForm 失败不触 DOM），本项以注释与守门钉住不另改。visual-qa/width 走查夹具补 `page.on("dialog", accept)`——走查模拟"改完离开"路径，确认框出现即守门生效；该补丁顺带解开了 visual-qa 既有 open-tab 超时卡点（确认框被默认 dismiss 吞掉流程）。width-walkthrough 既有失败族经 6d0fda6（本轮开工前提交）复跑归因为开工前已存在，另立排查不在本项。

## D-343：今日页"其他活跃项目"分节以补集投影呈现，不动今日语义（T-1772，2026-10-01）

- 今日列表的排期谓词保持唯一权威（`isItemAvailableOnDate && isScheduledToday`）；管理入口=同一谓词的**补集投影**（`features/off-schedule.ts` `collectOffScheduleItems`）：原因三分类（未到开始日=createdDate 未到 / 暂停中=归档期覆盖今日 / 今日不排期），下次排期做 366 天有界扫描（归档期 endDate 当日即可用、开归档期无下次、上限 50 条）。不做"全部项目"大页面——列表式补集分节足以覆盖"项目保存后消失"的可发现性缺口，编辑/归档动作直达（showEditor 按发起 root、archiveItems 复用批量管线含确认）。
- 分节为只读 `<details>`（默认收起），渲染在列表尾、空排期与搜索无结果态同样可见；**不进入今日进度分母、不参与搜索筛选、不改变 scheduledItems**——今日语义零变化是硬边界。回顾摘要的非配额过滤（analytics.ts:207）属回顾侧呈现，不在本项收口。
- width-walkthrough 的既有基线失败（editor live preview 等，HEAD 与工作树失败集合一致）沿 2026-09-29 偶发先例如实记录、另立排查，不算本项验收通过依据；本项视觉证据为 visual-qa 绿 + 新增样式与今日筛选同族（同族折叠 summary/行式列表）。

## D-342：记录/撤销失败保住草稿与 token，收起语义只在成功路径（T-1795，2026-10-01）

- 记录侧：bind-today 的 recordWithDetails 由"先清场再异步写"改为**结果感知**——写失败把附件放回 `pendingAttachments`、itemId 加回 `expandedExactEntries` 并重渲染（备注/数值仍在输入框，用户可直接重试）；写成功才消费附件、清 attach 按钮态并收起面板/交还焦点（T-1455 的"录完即收起"语义仅在成功路径成立——失败时收起正是丢草稿的根因）。
- 撤销侧：undoRecentRecord 的失败分支用 `setRecentRecord(recent)` 恢复撤销 token——同一事件仍可再次撤销，回执（消息/进度/目标）原样重新呈现且因 store 已回滚而数值准确；副作用 advanceFirstSuccess 幂等可重入。撤销窗口仍是 2.6 秒 toast 生命周期（超时后 token 自然消失，与既有节奏一致），不做无限期撤销队列。
- 行为夹具 `tests/record-retry.test.cjs` 真实转译 bind-today（递归闭包+siyuan stub+DOM 桩）驱动 record 点击路径：失败保留附件/展开/重渲染、成功消费+收起+备注附件达记录器、67675fe 红证对照（旧代码失败即丢附件与面板态）、index 撤销函数 setRecentRecord 结构钉。成功回执细化归 T-1776、跨入口幂等归 T-1786。

## D-341：配额周期按生效规则分桶结算，事件归属其发生日纪元（T-1767，2026-10-01）

- 红证：HEAD 版 `summarizeQuota` 用范围末日修订评估全部周期——周（≤2 次/周）→月（≤10 次/月）切换后，8 条事件全灌进单一月度 current（elapsed=0/completed=0，周纪元 3 个周期整体消失）；且周期可用性只看首日，月中创建/归档恢复的周期被整周期丢弃。
- 裁决三条：①**逐日按当日修订的 quota 规则与周期键分桶**，桶代表日（周期内首个范围日）的生效规则评估该周期；②**事件归属其发生日当时生效的规则与周期键**——每事件恰计一次，周期跨界不双计，非配额纪元的事件不进入配额结算（夹具首版红出"代表日规则评估整个日历周期导致跨界双计"后修正）；③**周期存在任一可用日即计入**，部分可用仍按一个周期（分母语义与旧版一致，只是不再因首日不可用整体丢弃）。周期标签取最后一个配额桶的类型；范围内存在任一配额日即走配额口径（无日级分母，T-1516 对照逐值不变）。同一日历周期内的规则切换由 ② 天然切分，不引入"切换重开周期"的锚点语义（避免与 evaluateQuotaSchedule 的日历窗口冲突）。
- DST 末日算术（bounds.end-86400000）保持原样，归 T-1794 专项；`tests/quota-periods.test.cjs` 接入 pnpm test。

## D-340：导入入口三统一——接回纯函数 Store，persist 失败整体回滚（T-1797/T-1798，2026-10-01）

- T-1797（P0）：无冲突 Obsidian 入口丢弃 `importObsidianHabitsInto` 返回的新 Store（不可变模型运算），导入"显示完成"但项目/事件从未进入内存与持久化。修复为接回 `this.store = report.store`，与冲突会话路径既有赋值同形。守门以纯函数不可变性证明根因（入参 store JSON 零变化——丢弃返回值即丢弃导入物）+ 接线结构钉 + HEAD 红证对照。
- T-1798：CSV/Loop/Obsidian 三入口统一为「previousStore 快照 → 导入 → persist → 失败回滚 + saveFail 提示」，持久化失败不再留下内存/磁盘分叉的半成品导入（对齐 setItemArchived 等既有回滚纪律）。远端并发的锁内重读/重基线不在本项范围（归 T-1622 跨桶总账），本项只保证单窗口原子性与可重试。
- 守门 `tests/obsidian-entry.test.cjs` 接入 pnpm test；真实宿主三格式导入验收 host-pending。

## D-339：提醒动作容量按类分账，skip 不再被 snooze 噪声挤出（T-1770，2026-10-01）

- `normalizeReminderUserActions` 的单一 `slice(-200)` 与"skip 对该次实例持续生效"的承诺自相矛盾：snooze 是当日/防抖短命动作（已有 7 天时效物理清理），skip 是长期决策；occasion 逾期条目不限龄投影（何时停止投影取决于事项完成/停用，normalize 无 store 可查），因此 skip 的存活不能按时间界定。裁决：**容量按动作类分账，两类各自独占 max（默认 200）配额**——snooze 噪声不再挤掉仍会投影的 skip；同类超限仍按最旧淘汰（容量边界如实记录：每存储每类 max 条，恢复走既有 restore 动作显式清理）。
- 幸存者保持原有相对顺序（对未超预算的列表零变化，既有 600 条钉住行为不变）；防抖 expiresAt 校验、时效清理、跨窗口合并身份并集全部不动。端到端夹具证明 300 条新 snooze 之后旧 skip 仍把逾期实例投影为 skipped。合并→归一往返稳定（归一输出再并集不自减）。

## D-338：逾期历史投影预算耗尽时走近窗，穷尽与截断分开（T-1771，2026-10-01）

- 逾期历史（T-100 投影，回顾取最近 12 条+折叠展开）的 1000 次枚举预算只对"稀疏/年轻"事项够用；interval:1 等稠密长历史会停在约第 1000 次发生处，最近的错过反而永远缺席。语义定为：**预算内整史枚举为完整覆盖（与旧版逐条一致，含 once 等自然穷尽的序列）；仅当预算耗尽而递推未穷尽（截断）时，改从「今日-1000 天」窗口的首个发生日重投影**——行动清单的 1000 预算花在近期，更早的旧账不进入该清单（它从来显示不下，截断语义记录于此；T-1719/T-1732 验收沿用）。
- 实现上显式区分「预算截断」与「序列穷尽」：二者都表现为循环停止，但 once 等单次事项走完即是穷尽——不区分会把窗口起点误判为错过（夹具第 3 场景红出该实现边界后修正）。近窗起点取 `getOccurrenceDate(occasion, 今日-1000天)` 而非裸窗口起点，保证起点即真实发生日。
- 行为夹具 `tests/overdue-recent.test.cjs` 以旧算法为参照逐条对照：稠密 1017 次事项最近 12 条精确等于 asOf 前连续 12 日；年轻隔日事项与旧版数组全等；3 年前 once 仍投影；补记排除与单次改期不变；混合投影互不影响。红证（HEAD 最新条目止于 2026-09-13）留档 PROGRESS。

## D-337：破戒记录按当日真实事件判门，输出说明真实含义（T-1768，2026-10-01）

- Agent 记录门与 index 记录器/今日卡统一口径：戒除类二值项目按"当日是否已有真实事件"判断——零破戒时首次破戒必须可写（isComplete 的"守住=完成"不再阻断记录），已记破戒才以"重复输入"拦截；普通二值仍按完成阻断；数值型戒除保持进度上限口径（超限破戒本就可记）。API（api-v5）对 atMost 项目的整体阻断是公开契约，其首次破戒开放归 T-1786 的跨入口幂等/回执统一，本任务不单独改契约。
- 成功输出在破戒时追加一句含义说明（"本次记录即破戒，连续守住从中断处重新开始"），不再让"已记录 1 次"被误读为完成；失败路径零事实不变。行为夹具 `tests/agent-lapse.test.cjs` 用 deps mock 直调 handler（首次可写、重复不双计、普通阻断、计数口径、失败零事实），index 门同口径用结构断言钉住；红证（HEAD 版返回"今天已经完成"）留档 PROGRESS。

## D-336：转打卡关联随项目编辑保留，解绑走显式关联管理（T-1769，2026-10-01）

- `linkedOccasionId` 是转打卡建档时写入的事实（指向原事项），普通编辑"改名/改组/改偏好"不构成解绑意图——save-form 重建项目时从 existing 复制该字段；唯一来源仍是转打卡建档与未来 T-1720 的关联状态管理，不在编辑器里新增解绑入口。
- 行为夹具 `tests/occasion-link.test.cjs` 真实转译 save-form（递归闭包 + stub showMessage），覆盖转打卡建档→编辑→保存→normalize 重载→达成 isComplete、新建不带链接（不凭空物化）、持久化失败整体回滚且链接原样保留；红证（HEAD 版编辑保存后 linkedOccasionId=undefined）留档 PROGRESS。

## D-335：戒除方向进逐日修订，方向纪元切换重置连击（T-1766，2026-10-01）

- 先以 git HEAD 修复前源码复现三向追溯改写：普通→戒除后，旧纪元空日被当前顶层方向误判为"守住"、旧纪元真实完成日被当破戒清零；戒除→普通后旧纪元零事件日被降级为未完成。根因是修订只含 kind/target/unit/schedule 而完成判定读顶层 direction。
- 方案取"修订级方向全物化"：`CheckinItemRevision.direction` 物化为 `"atLeast"|"atMost"`，normalizeItem 把缺失的历史修订按项目**当时顶层**方向回填——旧数据加载即冻结现状语义（零迁移、不引入 v4）；save-form 自本决策起对新修订显式写入。不选"留空回退顶层"方案，因为无法区分"旧数据缺失"与"显式改为普通"，回填会在每次加载重放方向切换。
- 连击语义：新增 `getItemDirectionForDate`（rules，model 再导出）为唯一方向来源；当前/最长连击改为逐日方向判定，方向纪元切换（普通↔戒除）清零当前段——不用另一纪元的规则解读对方历史。锚点规则（至少型今日未记录不断链）、跳过日中性桥接、T-1409 容错缺口、quota AUTO 惰性推导全部保持；同质项目行为与之前逐位一致（auto-streak/at-most/skip/insights/streak-tolerance 等守门全绿佐证）。
- 消费面收口：isComplete、computeEventStreaks、computeLongestStreaks、streakToleranceFor、洞察日格（insights）、日历投影点（calendar-projection）、习惯分（habit-score）、批量补记快照与守卫、记录器与 Agent 切换（index.ts 6044/6100/6602/6651）改按当日方向；api-v5 的 at-most-item 阻断、achievements 项目级门、dock-tomato/coaching 今日门保持项目级（当前语义），T-1768 另行收口 Agent 二值破戒。at-most/auto-streak 的结构守门正则更新为按日助手契约。
- 守门：`tests/direction-revision.test.cjs` 7 组断言（双向切换 isComplete、纪元重置连击、旧数据回填、洞察日格、日历投影、同质项目等价）接入 pnpm test；红证以修复前源码复现留档于本轮 PROGRESS。真实宿主双窗口/真机复测 host-pending（沿 T-1602）。

## D-334：项目删除墓碑（T-1765）——删除默认胜出，删除后的真实编辑取代墓碑（2026-10-01）

- 用户指示"按待办计划开发"后开工审计第 0 批的 T-1765。先以最小夹具复现（A 删除×B 旧快照合并：项目复活 1、删除后新记事件复活 1；reconcile 与 persist 写后校验同路径），再实现 `CheckinItemTombstone {itemId, deletedAt}`：`deleteItemsCascade` 在事件墓碑外同步写项目墓碑，`normalizeStore`/`mergeNormalizedStores` 按墓碑收敛项目集并连带丢弃其事件。
- 冲突裁决沿用事件墓碑的时间戳纪律：墓碑 `deletedAt`（captureActionMoment ISO 时刻）与项目 `updatedAt` 字典序比较，晚者胜；删除后的真实编辑/导入冲突（updatedAt 更晚）胜出并从规范形中剔除墓碑，避免僵尸墓碑压制后续合法项目。无对应项目的悬垂墓碑保留，与既有事件 ID-only 墓碑同义——阻止旧快照/旧备份重放复活。
- 兼容边界：`itemTombstones` 为可选字段，缺省视为空表，v3 版本号不变、旧数据零迁移；restore 保持显式 replace（备份信封随 normalizeStore 携带墓碑），快照导出/导入、公开 API 契约与 fingerprint 均已覆盖该字段。墓碑容量/保留策略仍归 T-1799，本任务不引入清理。守门：`tests/item-tombstone.test.cjs`（8 组断言，已接入 `pnpm test`），覆盖合并交换律、写后校验收敛、幂等重删、新 id 重建、旧数据与信封往返。
- 真实思源双窗口宿主复测仍属 host-pending（沿 T-1602 边界），不在本任务宣称现场已验收。

## D-333：UI 专项以视觉系统和多表面一致性登记，继续只登记不开发（2026-09-30）

- 用户要求“UI 专项优化”，目标是质感、合理层级和美观一致；沿用明确“开始开发”前只加入整体待办的约定。本轮只读复核 `src/ui` 样式、页面渲染模板和既有测试入口，新增 T-1813～T-1829 共 17 项，开放 TODO 由 210 增至 227。
- T-1813～T-1829 分为视觉基础（CSS 分层、字体/状态、卡片/elevation、主题）、组件层级（按钮、表单、导航、空态、编辑器、设置/事项）、表面与表达（图表、host 密度、图标、动效、长文本）和样式性能四组。T-1778/T-1788 仍分别负责全页面语义走查与状态验收矩阵，本轮任务负责可实现的视觉规范；T-1665/T-1666、T-1800/T-1801/T-1806 及 T-1701～T-1764 不重复登记。
- 源码证据包括 `components.scss` 约 10.8k 行、同类选择器多文件覆盖、dock/超窄字号下限、透明度叠加、Unicode 符号与 `uiIcon` 混用、主题硬编码白色和长文本截断。它们证明需要设计和测量，不等同真实宿主中已经复现的视觉缺陷；实施时必须补计算样式、双主题/调色板、双语、缩放、移动/dock/quick/tab 和大列表性能证据。
- 本轮不改运行代码、测试或发布资源，不运行功能/视觉测试，不 push。推荐顺序为 T-1813～T-1816 基础层 → T-1817～T-1822 组件/信息架构 → T-1823～T-1828 表达与多表面 → T-1829 样式性能测量。

## D-332：第三轮交叉复核以具体入口和事实对账拆项，继续只登记（2026-09-30）

- 用户要求再次验证功能、UI、交互、逻辑流程并列入待办，沿用收到明确“开始开发”前只维护规划的约定。主审与两路独立只读审查结合源码和已有 TODO 去重，新增 T-1789～T-1812 共 24 项，开放 TODO 从 186 增至 210；证据与顺序见 `docs/full-plugin-audit-2026-09-30.md` 第六节。只修改 TODO、PROGRESS、DECISIONS 和审计文档，不改运行代码、测试、发布资源，不运行功能/视觉测试、不 push。
- P0 T-1797 单列无冲突 Obsidian 导入漏接 `report.store`，因为纯函数返回新 Store 与入口继续保存旧 Store 的矛盾不能被 T-1522 成功路径或 T-1622 总审计掩盖。仍须在实施时先补入口夹具，再修正并核对真实报告/内存/磁盘/重载；T-1795/T-1798 处理保存失败的输入/撤销/导入事实恢复，成功提示必须由真实结果驱动。
- T-1789/T-1790 仅登记实际无 guard 的编辑器 click、Today Alt 重排和 Review toggle；核查已确认 j/k/e、快捷数字键、上下文菜单存在安装标记，排除泛化“所有 root 监听重复”。T-1791/T-1792 和 T-1804/T-1805/T-1809/T-1810 作为 D-325 页隔离后遗留的具体接线，统一 root、草稿、焦点和生命周期，不把页面代理假定为所有会话态已隔离。
- 日期族分开验收：T-1793 公共日历合法日期/有界范围，T-1811 排期预演/周负荷共享校验，T-1794 配额末日减 24 小时的 DST 边界，T-1812 数值戒除和修订单位投影同源。localDaySpan 有 Math.round，不声称普通一小时 DST 已令整天数错误；超长 eachDayCount 的预算问题不能因输出限 366 天被忽略。T-1802/T-1803 的时段/业务日先定兼容契约，不臆造新 API。
- 恢复 replace/merge（T-1796）、墓碑生命周期（T-1799）、快照真实存储成本（T-1807）先设计/测量后选方案，墓碑不能简单按时间删除而让旧事实复活。专注 DOM、锚点重试/代际、Weread 首启 timer 和提醒快速保存顺序分别回链 T-1781/T-1856/T-1782/T-1622；CSV 错误行明细回链 T-1863、半行安全回链 T-1683、渲染预算回链 T-1667/T-1668；不另建重复编号，不新增人为阻塞。

## D-331：第二轮补充审计继续先登记，优先补跨表面可靠性与可执行状态验收（2026-09-30）

- 用户要求“继续”并再次确认需要完整盘点、扩展同类问题和调研事项；沿用“明确说开始开发前只加入整体待办”的约定。本轮复核独立审计清单、源码调用点与既有 T-1619～T-1778，新增 T-1779～T-1788 共 10 项，开放 TODO 由 176 增至 186。只修改 TODO、进度、决策和审计文档，不改运行代码、测试或发布资源。
- 新增范围按容易遗漏的工程边界拆分：页面级偏好失败回滚（T-1779）、专注计时实际时间和多 root（T-1780～T-1781）、来源/提醒异步取消与配置代际（T-1782）、诊断与导出脱敏（T-1783）、Today 局部刷新竞态（T-1784）、动态 SVG/属性安全（T-1785）、API/Agent/快速入口写入幂等回执（T-1786）、独立桶备份恢复（T-1787）和 loading/error/slow/empty 的视觉验收资产（T-1788）。这些是 T-1620/T-1621/T-1625/T-1627/T-1639/T-1673/T-1684/T-1768/T-1778 的后续切片，不重复其已交付主体。
- 任务顺序固定为“失败与生命周期夹具 → 隐私/写入/迁移契约 → 全页面状态视觉验收”。静态源码仅证明风险路径；所有涉及用户数据、跨窗口、后台节流、真实来源和读屏的结论都必须等待对应夹具或真实宿主证据。T-1788 是 T-1778 的可执行验收资产，不单独扩张页面功能。

## D-330：全插件二次复核以事实安全和主路径可达性排序，只登记不开发（2026-09-30）

- 用户要求再次整体梳理 UI 与功能；继续遵守先前约定：收到明确“开始开发”前只读调研、把反馈及同类可用扩展加入整体 TODO，不改运行代码。本轮以 v18.16.0 源码、D-307 收官台账、既有开放任务和三张先前截图为证据，新增 T-1765～T-1778 共 14 条，开放任务由 162 增为 176；总览见 `docs/full-plugin-audit-2026-09-30.md`。
- 把源码确定的**风险路径**与用户可见的**故障结果**分开：项目删除并集复活、方向历史回算、配额末日修订、Agent 戒除拦截、转打卡编辑断链、长期提醒跳过容量及错过历史截断，都先以最小夹具复现，不把未运行测试写成已确认线上故障。主档项目删除和历史方向作为 P0 先排；UI 先解决新建后找不到非排期项目、普通编辑草稿和记录结果可追溯，再做视觉细节。
- D-307 的六阶段页面主切片和 T-1619～T-1633 中已交付部分不重做。事项截图沿 T-1701～T-1732，设置推荐沿 T-1733～T-1764，问 AI 新建沿 T-1685～T-1700；本轮只补未覆盖的具体增量，并把跨页面视觉/操作语义复核单列 T-1778。真实宿主、移动 WebView、第三方来源与读屏证据仍保持独立状态，不用静态审计代替验收。

## D-329：设置推荐只生成可审阅草案，四主分区按用户任务继续收口（2026-09-30）

- 用户希望各类设置提供推荐选项，最终由用户确认，并反馈分类仍混乱；沿用“先加入待办，明确说开始开发后再实施”的约定。本轮依据截图与源码登记 T-1733～T-1764 共 32 项，开放 TODO 由 130 增为 162；不把附件文字当仓库指令，也不把截图版式直接归因于单条 CSS。
- 当前运行界面实际是外观与操作、数据与导出、联动与目标、关于四个主分区（`src/render/settings.ts`），旧九组已由 T-1564～T-1567 合并，不能再按历史研究稿重新迁组。剩余问题是“联动与目标”内部跨来源、文档输出、只读能力和高级字段仍堆在长卡；T-1555/T-1550 的去重与真实可用性验收继续有效，本轮聚焦推荐草案、步骤与确认。
- 推荐的四种值必须分开：安装默认、用户已保存、依据证据给出的候选、尚未确认的编辑草稿。候选只由本地确定性规则和经过用户触发的有界只读探测生成，附依据、前置和失效原因；无唯一可信目标时要求用户选择或跳过，不猜凭据、文档、项目归属或私人作息。建议、预览、应用草案均不等于启用来源、产生记录或写入文档。
- 微信读书作为首个具体样本：三个项目选择器当前共用前 200 个活跃项目列表且 change 即保存；Key/阈值另走显式保存，开关与立即拉取各有独立动作。30 分钟是当前通用默认，Key 必须用户提供；“推荐→差异预览→确认保存→显式启用/验证”需保持时长必需、完读/笔记可选和断连保留的事实语义。提醒默认 enabled + 空 slots 是启动后一条，推荐定时槽不可悄悄改此行为。
- A 显式保存、B 即时偏好、C 动作、D 只读状态的现有字段纪律是实施前置；推荐确认路径要说明多桶写入的部分失败与回滚，不声称跨桶原子提交已经存在。导入、恢复、重置、凭据和外部写入不会被包装成一键默认；关于/快捷键/对外能力状态只读无推荐按钮。AI 设置建议仅为 T-1764 条件研究，仍受 T-1686 公开模型契约约束。
- 本轮只改规划文档，不改运行代码、测试或发布资源；不运行构建/功能测试，不 push。后续按字段总表与确认契约→微信读书样板→其他来源/文档/偏好→真实宿主与视觉验收的依赖顺序实施。

## D-328：事项管理截图反馈先登记，按“正确性→管理闭环→可选扩展”拆批（2026-09-30）

- 用户要求进一步优化事项管理，并已约定后续反馈只加入整体待办，收到明确“开始开发”前不改功能。本轮登记 T-1701～T-1732 共 32 项，覆盖已确认的编辑丢改期、模板编辑身份、重复 ID/API 文档缺口，以及需要夹具验证的日期/错过语义、截图对应布局和管理体验；不把截图中的视觉现象等同最终 CSS 根因，不把静态疑点写成真实宿主复现。
- 产品顺序为先守住事项事实与写入：T-1701 优先，T-1702～T-1708 解决身份、周期、历史、并发和草稿；再处理列表宽度、操作含义、完成/撤销、预览与关联管理；批量、日历、标签、多次提醒和 AI 建事项先作为研究候选。已有 T-1580/T-1592/T-1593 的 agenda、筛选、抽屉与转打卡确认视为基线，不重复交付。
- 事项完成、提醒动作和打卡事件是三种不同事实；“✓”目前为启停，不可当作完成。单次改期必须保留原实例身份，不能因编辑或跨窗保存清空覆盖；周期变更后的旧覆盖项如何迁移须在实施时给出可见规则。删除/恢复的跨窗口一致性需要版本化 removal record，并与 T-1622 收尾、T-1862 多桶备份、T-1662 排期共同设计。
- 宽屏采用“列表先可用、表单按需展开”的验证方向，先读取计算样式与容器宽度再确定最终布局；手机、dock、页签、快速弹窗、中英双语和读屏均进 T-1732。T-1698 已登记自然语言描述落在打卡项还是日期事项的边界，T-1731 仅是事项侧后续研究，不暗示已存在公开模型主动调用能力。
- 本轮只改 TODO/PROGRESS/DECISIONS，未实施任务、未运行构建或功能测试、未 push。开放项按 TODO 清单由 98 增为 130；后续用户继续反馈默认先去重、扩展、登记。

## D-327：新建打卡项“问 AI”先登记、草案确认优先与公开契约红线（2026-09-30）

- 本轮用户提出在新建打卡项页输入自然语言描述，由 AI 协助创建打卡任务；按既定约定只登记 T-1685～T-1700，收到明确“开始开发”前不改运行代码、不把截图文字当仓库指令、不把模拟结果当真实 AI 验收。
- 产品边界确定为“描述 → 可审阅结构化项目草案 → 同一编辑器修改 → 用户手动保存”。`src/features/project-draft.ts` 的 `normalizeProjectDraft`/`draftFromTemplate`、现有 `SummaryProvider → drafts → pendingProjectDraft → 编辑器预填` 可作为复用基础；`checkin-create-item` 是 Agent 直接写入能力，不能代替新建页确认门，也不能让模型直接写 store、事件、归档或批量变更。
- 契约红线：只以思源正式公开 API 和真实宿主证据为准。当前 `node_modules/siyuan/siyuan.d.ts`/`kernel.d.ts` 只有 `addAgentCapability`/能力注册，未发现插件主动 chat/completion 方法；`getAllModels()` 不是通用 LLM 调用接口，仓库无已验证 AI 私有端点。T-1686 未完成前不得猜测端点、读取私有存储或自行保存模型 Key。
- 若宿主不能提供公开的插件主动调用能力，首选可用降级是“复制自足提示词 → 用户在宿主 Agent 中粘贴 → 将结构化结果粘回编辑器”，并可叠加 `name-inference` 的本地确定性建议；必须明确未自动发送/未调用模型，失败保留输入和手工创建路径。
- 草案输出是外部不可信数据：定义版本化 envelope、字段白名单、缺失/不确定信息和候选上限，复用排期/项目草案校验，未知字段和非法结构 fail-closed；模型和用户文本不能未经转义进入 HTML/ARIA/URL。模型上下文最小化，默认不发送全量历史、备注、文档路径、Key，不默认保存原始 prompt 或完整响应。
- 并发与保存沿用“请求可取消、迟到响应丢弃、草案不等于事实、用户提交才写入”的纪律。当前 `pendingProjectDraft` 为宿主单槽，T-1692 必须在实施前决定按 root/请求隔离、过期和重载策略；不能把回顾页已有的 requestId 检查直接假定为新建页已解决。
- 同类扩展先登记后评估：编辑已有项目的自然语言调整、模板/组合包变体、多候选追问、日期事项创建以及周复盘/回顾 AI 入口应共用状态、隐私和审计语义，但不因本需求自动扩大实现范围。

## D-326：全量盘点后的“先登记、后开发”队列规则与扩展待办池（2026-09-30）

- 本轮用户要求把后续输入、源码复核和可用调研先融入整体 TODO，只有收到明确“开始开发”后才进入实现；因此 T-1635～T-1684 全部保持开放登记，不把静态证据、设计稿或历史发布记录当作功能已交付。
- 任务拆分按真实证据和依赖归类：来源游标/代际/超时、渲染块失败、辅助桶与多桶备份、导入导出安全、i18n、跨 root、无障碍、性能、宿主兼容、生态契约和外部研究。与 T-1621～T-1634、T-1550/T-1555/T-1611～T-1618 的已有任务通过“后续切片/验收盲点/条件触发”关系连接，不重做已交付主体。
- 本轮盘点确认工作区 clean、`main` 比 `origin/main` 超前 3 个提交；实际版本为 v18.16.0，而 TODO 顶部仍有 v18.10.0 历史索引，T-1635 负责统一当前事实并保留历史快照。T-1681/T-1682 为 P0 现状复核项，先验证接线与 ARIA 关系再决定是否修复；不得因“已完成”标签跳过验收。
- 本轮不运行构建/测试，不改运行代码，不创建未授权外部 PR，不调用未公开思源 API。后续若用户继续提供反馈，默认追加 TODO 并检查同类扩展项；用户明确开始开发后，按依赖和优先级从本池选批实施。

## D-325：T-1621 步骤一实施口径——写代理=全局同步、弹窗页记忆归弹窗 root、释放回落 dock→页签（2026-09-30）

- **currentPage 写代理=全局同步全部 root 与孤儿页**（读=最后活跃 root 页）：既有宿主级写入（渲染块跳转、命令、openTabPage 等）语义完全不变；显式 root 的导航（rail/底栏/顶栏/返回/卡片动作）只改发起表面。
- **快速弹窗页记忆归弹窗 root**：旧实现在关闭时把弹窗最后页写回宿主 currentPage 并全量渲染，会让 dock/页签跟随弹窗跳页——属跨表面串页缺陷，本轮随 per-root 退役；会话页记取（pageOfRoot）与回放（applyNavigation 只落弹窗 root）保持 T-1597 体验。
- **释放回落顺序 dock→页签**：最后活跃 root 销毁（弹窗关闭/页签与 dock 卸载）后，渲染块等宿主级写入仍需落在存活表面；孤儿页承接启动参数（早于首个 root 注册的 currentPage 写入），新注册 root 继承之。
- **存储抽纯模块 features/root-page-store.ts**：Map+孤儿页+最后活跃标记收拢为可行为级测试的纯函数（tests/root-page-store.test.cjs 入主链），宿主类只持代理与接线。
- **剩余边界（登记不阻塞）**：编辑器归档/删除后的 showToday（archiveEditingItem/deleteEditingItem 异步无 root）仍为全局导航；跨表面会话态（todayQuery/折叠态等）按 D-324 步骤二另批评估；真机多 root 同屏走查归 T-1608 台账。

## D-324：多 root 独立页面采用「RootContext Map + 宿主 currentPage 代理层」渐进策略（2026-09-30）

- T-1621 剩余的架构设计定稿：引入 per-root RootContext Map（HTMLElement→{page,returnTo}），renderInto 按 root 取页面；宿主 currentPage 保留为最后活跃 root 的代理层（现有代码零改动）；导航函数加可选 root 参数（有 root 只改该 root，无 root 改所有）。
- 会话态三层分表：宿主级（editingId/store/preferences）不动；Root 级（page/returnTo/renderedPage/scrollTops/pendingFocusItemId）已按 root 隔离，settings 展开态仍由 WeakMap 管理；会话级（todayQuery/collapsedGroups 等）首批不迁（改动大/收益低）。
- 三步渐进：步骤一引入核心 Map+代理→步骤二评估折叠态迁移→步骤三滚动复合键。风险：双写不一致（代理层缓解）、dock 不存在（纯页签行为不变）。设计稿 docs/multi-root-page-design-2026-09-30.md。

## D-325：滚动与焦点恢复以 RootContext 为 root-local 事实来源（2026-10-02）

- T-1621 第二切片把 `renderedPage`、`scrollTops`、`pendingFocusItemId` 收入 `RootContext`；今日记录动作必须通过 `setPendingFocusItem(root, itemId)` 登记，不能再写宿主级字段。
- 宿主级 `pendingFocusItemId` 仅保留为最后活跃 root 的兼容镜像，不能参与跨 root 决策；局部 patch 成功时清理所有 root 的一次性焦点请求。
- `todayQuery`、review 查询/筛选、折叠态等会话级字段暂不迁移；本轮不把 root-local 恢复误记为完整 `SurfaceContext` 序列化。

## D-326：T-1607 守门断言同步渲染中位数，双帧耗时仅作诊断（2026-10-02）

- 既有 T-1607 台账要求预热后三次中位数，并保留双帧等待确认 DOM 提交；实测宿主 RAF 调度会在完整 UI 链中产生约 20ms 抖动，基线提交也能复现，不能归因于 T-1621。
- 守门继续等待双帧并记录每次总耗时，但 250ms 灾难回归阈值只断言 `render()` 的同步耗时中位数；不通过提高阈值或删除等待来掩盖真实渲染回归。
- 本轮不改变产品性能预算与渲染分层策略；后续若同步渲染中位数超限，仍按产品回归处理。

## D-327：10k Today P2 门禁改用预热后三次中位数（2026-10-02）

- `tests/performance.test.cjs` 原本对一次冷样本强断言同步渲染 `<50ms`；在未改动的 `HEAD 9cd512c` 基线同样稳定失败，基线探针中位数约 99ms，本轮当前代码约 94ms，因此不能把该失败归因于 T-1621，也不能靠删除性能检查绕过问题。
- 门禁改为先做一次预热，再在双帧间隔后采三次同步 `render()`，用中位数 `<150ms` 且最大单个 `longtask` `<150ms` 守住真实回归；保留 3 秒灾难上限、横向溢出和页面错误断言。150ms 是基线中位数约 1.5 倍的稳定回归包络，不是产品帧预算；T-1607 的 250ms 灾难防线仍独立存在。
- 本轮不改 Today 渲染算法；若预热后的同步中位数越过 150ms，应作为真实性能回归处理，而不是继续放宽门槛。

## D-328：Today/Archived 查询在第三切片按 root 隔离（2026-10-03）

- T-1621 第三切片把 `todayQuery` 与 `archivedQuery` 收入 `RootContext`：root 注册时以既有宿主偏好作为初始种子，之后查询输入、归档预填和清除动作只写目标 root，并只重绘/聚焦目标 root。
- 宿主级字段仍保留为无 root 入口、偏好持久化与旧 harness 的兼容镜像；只要 root context 已注册，`renderToday(root)` / `renderArchived(root)` 以 root-local 查询为事实来源，不能因另一个表面最近输入而串台。
- 本切片只迁移 Today/Archived 查询，不提前迁移 Review 的历史查询、范围、工作区和筛选；这些字段仍属于 T-1621 后续全量恢复矩阵，不能把本切片记为完整 `SurfaceContext` 序列化。

## D-332：主 Store 导入与卸载收尾统一走锁内预合并（2026-10-04）

- T-1622 本轮收口采用同一条主 Store 事务边界：JSON 恢复、CSV/Loop/Obsidian 导入、冲突导入确认和 `teardownFinalFlush` 均先进入 `enqueueMutation` 或独占存储锁，再重读远端主档、与当前内存快照按 `mergeNormalizedStores` 合并，最后用回读校验写入。
- 导入/恢复的业务语义仍是用户确认后的主档替换；锁内重读只吸收并发窗口产生的可合并事件、项目和墓碑，保存失败必须恢复导入前内存，不把失败结果留在当前会话。
- 卸载收尾不能把陈旧内存快照直接写回主档；`persistStoreWithReconciliation` 负责首写前预合并，既有 bounded retry 负责旁路竞争的回读修复。偏好桶的后写者胜、删除类无 tombstone 仍遵循 D-314/D-315，不在本轮扩大存储形状。

## D-329：Review 核心会话态在第四切片按 root 隔离（2026-10-03）

- T-1621 第四切片把 Review 的 `historyMonth`、`selectedHistoryDate`、`summaryRange`/`summaryCustomRange`、`reviewWorkspace`、`historyItemId`、`historyScope`、`historyPage`、`reviewProjectPage` 收入 `RootContext.review`；Review 渲染、日期跳转、月份翻页、工作区/条目/分页动作均读取或写入触发事件所属 root。
- 宿主级 Review 字段仍作为最后活跃 root 的兼容镜像，用于无 root 入口和既有持久化/异步代码；`syncReviewCompatibilityForRoot` 只负责镜像同步，不得成为多 root 决策来源。
- Review 查询、来源/计量/排序、折叠态、批量选择、异步摘要与完整序列化暂不在本切片内迁移；继续保留为下一切片的明确边界，不用部分迁移冒充完整 `SurfaceContext` 恢复。

## D-330：以质量闭环重排当前待办，只新增兼容桥任务（2026-10-03）

- 当前真值以 `v18.16.0`、最新 `PROGRESS.md`、`BLOCKERS.md` 和本次 `docs/current-backlog-review-2026-10-03.md` 为准；旧路线文档中的 v18.9/v18.10 数字均视为历史快照，不再指导排期。
- T-1613、T-1615、T-1616、T-1617 与 T-1627～T-1633 已有本地实现和回归证据，TODO 勾选同步修正；剩余混档、真实宿主、外部联调只留在原任务的 host-pending/external 边界，不重复建功能任务。
- T-1621 第四切片暴露的“旧无 root 写入被 root 镜像覆盖”是已开发代码的真实兼容缺口，不是截图等待问题；新增 T-1635，先定义 legacy host 字段到 active root 的迁移规则并恢复真实 bundle 验收。禁止通过放宽等待、删掉隔离或修改测试期望绕过。
- 当前顺序固定为：T-1635 质量闭环 → T-1622 跨窗口防丢 → T-1621 剩余 root 状态/生命周期 → T-1626 与提醒可靠性 → i18n/安全/README 与用户反馈体验；T-1634、外部联调和产品决策项继续按条件触发。
- 性能基准的偶发超时先按环境噪声记录，不修改无关实现或门禁阈值；需有空闲环境基线和重复样本后才能重新定性。

## D-331：采用推荐用户口径并完成 T-1635 兼容桥（2026-10-03）

- 用户明确授权：所有需要拍板的事项按推荐方案执行，后续同类产品口径不再重复询问。
- T-1626 专注计时采用有效经过时间口径：系统休眠/锁屏、页面不可见或时钟大跳不计入有效时长，恢复后由用户继续；实现阶段沿用时间戳校准和真实保存结果。
- T-1618 提醒保持默认开启；“今日不再提醒”按工作区共享，当日有效，次日恢复，持久幂等键继续使用本地日期、槽位和上下文。
- T-1614 LifeLog 统计、时间轴和 `occurredAt` 使用源 Marker 的真实开始时间，摄取时间仅用于诊断和最近读取展示。
- T-1635 采用 root-aware API 为事实来源、旧宿主字段仅在无 root/active root 入口做一次迁移的兼容规则；字段快照比较不引入全量 JSON 序列化，真实 bundle 和完整 UI/主链回归通过。


## D-323：文档目标选择器统一为「单搜索框 + 候选行列表」，旧双框退役（2026-09-30）

- T-1616 第一批实施口径：三张文档目标卡（日记/摘要/健康）统一 `documentChoiceBlock`——单一搜索框（role=combobox）+ 候选行列表（role=listbox，名称/路径双行预览行，键盘 ↓ 聚焦首项、列表内 ↑/↓ 环选、Enter 选中、Esc 收起，IME 组合态安全），候选经既有 `searchBindingDocuments`（searchDocs 有界 50）+ 纯投影 `toDocumentChoiceRows`（id 去重、名称回落块 ID、路径裁剪）。
- 旧「搜索框 + 本地锚点下拉」双框退役：搜索框不再被 searchDocs 结果**替换**本地锚点选项（旧语义两源互相覆盖），候选列表只呈现当前查询结果，选中回填 ID 输入框（保存仍走 bindVerifiedDocumentSave 校验+确认，历史不变）；`runDiarySearchRequest`（select 填充流）随之退役，其异步边界语义（防抖/代际/包装形态容忍/上限 50）由宿主请求代际模式与纯投影分别承载，diary-report 守门改锁纯投影与路由契约位置。
- 多 root id 唯一性：候选列表 id 用 settingsViewSequence 序列化（settings-navigation 双表面守门覆盖）。
- 第二批：问卷/叶归笔记本/编辑器锚点入口接同一组件；笔记本浏览与「新建文档」入口整合；退役 settings-row 复用类。

## D-322：目标卡样式豁免用「顶层绝对选择器 + (0,4,0)」，不迁移 SCSS 嵌套块（2026-09-30）

- T-1615 实施口径：目标卡（document/journal/notebook-target-card）在 ≥720 容器被无条件两列行栅格压成 240px 窄列的修复，选择**新增两条顶层绝对选择器豁免规则**（卡本体 + 卡内后代行，(0,4,0) 压过 maintenance 层 (0,3,0)），而非把 ≤719 容器块内的卡样式整体迁移或修改 maintenance 规则本身——迁移大块样式会同时改变 ≤719 档已验收形态，改 maintenance 规则则波及全部普通行。
- 实施教训：豁免规则若嵌套进 `.lc-checkin--settings` SCSS 块，编译后会前置 `.lc-checkin--settings ` 祖先条件——而卡/行元素本身**没有** `lc-checkin`/`lc-checkin--settings` 类，选择器永不匹配（首版即踩，定向探针计算样式复验抓住）。豁免规则必须写顶层绝对形态；CSS 特异性工作的验收必须含计算样式探针，源码守门只断言选择器存在不够。
- 范围界定：本批只恢复「卡片是单列卡面」事实；摘要中段截断 polish、退役 settings-row 复用类仍归 T-1616 实施轮。同批补齐缺失 i18n 键 4 个（第 5 个 common.clearFilter 改复用既有 today.clearFilter，不造语义重复键）与「代码引用键∈词典」常驻扫描。

## D-321：Loop/Obsidian 迁出按当日生效规则判完成，无法映射即损耗计数（2026-09-30）

- T-1633 口径：迁出（Loop Checkmarks/Obsidian H21）完成日 = isItemAvailableOnDate + isComplete 主模型当日生效判定——skip 不贡献进度、部分达标=非完成、atMost 破戒=非完成，绝不为「有事件」制造完成事实；日期宇宙仍=有事件日+今天（零放大）。
- 损耗显性化：配额项目无日级完成语义——Loop 不产出 YES_MANUAL、Obsidian 整档不导出并计入新字段 quotaSkipped；戒除「零事件守住」日 Loop/H21 无对应语义不产出。迁入侧（T-1522 冲突选择）不变；Loop 导入日期改真实日历校验；Obsidian YAML 标题剥离控制字符。

## D-320：微信读书三链路独立出结果，升级阻断与笔记完整性门（2026-09-30）

- T-1630 口径：时长/完读/笔记三条链路各自结算，整体 ok 仅反映时长链路（来源卡状态行契约不变），链路结果 additive 聚合进 wereadLastPull；`wereadUpgradeBlocked`（官方升级提示非空）阻断本轮全部链路。
- 笔记「每日身份」一经写入即锁定当日补算机会：笔记本概览/逐书分页触顶或网关失败（payload 缺失≠空数据）=未完整，`settleWereadNotes` 门拒绝写入、整日保留下轮重算；完读超上限与未核实完成的书计入 pending，不假成功。

## D-319：三来源扫描「有界多页 + 短页复位」游标纪律（2026-09-30）

- T-1629 口径：健康/笔记推导/叶归三来源单轮摄取 ≤4 页×窗口大小；整页读满游标推进到本页最后块 ID 续读，短页收尾游标复位空串（下轮从头幂等重扫，externalRef/墓碑/手动优先去重兜底）；游标仅接受块 ID 形态（白名单拼接防注入）；多页行累积后一次解析（叶归跨页相邻段前置不丢）。游标为会话态，跨会话持久化如需另立。
- 已知残留：真机跨 200/500 行轮询、源变更/删块/手动重扫现场验收并入 T-1608 真机台账。

## D-318：JSON 备份明示「主档」口径——独立配置桶不入备份，范围优先于体量（2026-09-30）

- T-1627 方案拍板：采用小步口径收口而非备份 envelope 扩容。JSON 备份/恢复通道明示为**主档**（主 Store：项目/事件/墓碑）；个人模板、问卷配置、图标库、事项、提醒动作、视图偏好、外部失败箱在独立存储桶，不在 JSON 备份/恢复范围内（跨设备迁移需在插件内重建；模板另有编辑器内脱敏分享/导入通道）。
- 理由：①现状「全量备份」表述与实现不符（normalizeStore v3 起不保留 `CheckinStore.templates`，文档宣称的字段并不存在）——口径误导先行纠正；②多桶 envelope 需要逐桶覆盖/合并/脱敏/失败回滚语义与版本化迁移，是独立批次体量；③主档之外的配置均有各自的会话内管理面，损失面可控。
- 剩余：多桶版本化备份 envelope（逐桶可见的覆盖/合并/跳过、敏感字段遮罩、恢复回滚）登记为 T-1627 后续，不因本口径关闭而视为完成；跨桶恢复 UI 不预设排期。

## D-317：动态内容安全渲染四类边界——转义归转义、URL 校验归校验（2026-09-30）

- T-1625 第一批确立的边界契约：①HTML 文本节点与属性/ARIA 值——用户内容（item/event/attachment 名等）进 HTML 前必须 `escapeHtml`，含经 `t()` 中转的场景（t() 只做纯文本替换、永不转义，调用方对含用户参数的结果自行转义）；纯字典文本的 t() 输出按既有形态保持。②URL 值（src/href）——转义不等于校验：`safeAttachmentUrl`（shared，与 renderIconMarkup 同一协议白名单：data:image/、blob:、https:、http:、无协议相对路径）先做协议门再转义，不通过返回空串不渲染；`javascript:`/`data:text/html` 等永不进入属性。③附件 URL 的摄取侧白名单（normalizeStore 仍接受任意 data:image/ 字符串）与渲染侧门是两层防线，渲染门已立，摄取收紧留后续评估。④`renderRecordNote` 的块链接 span 富文本路径保持既有（URL/label 均已转义）。
- 覆盖范围：本批修复审计点名的 fragments 附件缩略图×2（src 注入实锤）、bulk-check aria、today-bindings 上下文菜单（innerHTML 注入实锤）；editor/archived/review 点名点位复核均为已转义形态。**全量 t({name}) 类扫尾与敌意 fixture 的全表面扩展是 T-1625 的剩余切片**，按页推进不一次铺开。

## D-316：template-manager 为未接线遗留原型，本轮不接不删、退役另立清理批（2026-09-30）

- T-1623 复核结论：`src/features/template-manager.ts` 整块硬编码中文，但**生产零导入**（全仓无任何模块引用；现行「我的模板」能力在编辑器区且已双语），仅样式（components.scss 遗留类）与 3 处测试引用（template-manager/legacy-style-audit/ui-theme）存在。定性=未接线遗留原型。
- 处置：本轮 i18n 治理不适用于未接线代码（接 t() 等于给死代码做双语）；删除属跨面清理（模块+测试+样式+test-suite-coverage/legacy-style/ui-theme 三处守门联动），另立退役批次执行，不搭车本轮。其上有价值语义（模板管理状态形状）如未来需要，以现行编辑器实现为准。

## D-315：偏好桶不做跨窗口合并，维持后写者胜 + 写失败回滚（2026-09-30）

- T-1622 剩余切片评估定案：偏好桶（checkin-view-preferences，全部 B 类视图偏好与周复盘草稿）不引入 D-314 式并集合并。理由：①整桶 ~40 个异构字段（枚举/嵌套对象/数组）没有逐字段变更清单，确定性合并需要每次写携带变更键集=存储形状级改造；②无清单的「重读+合并」会复活撤销语义——reset-view/reset-all 写入默认值，字段级合并会保留他窗旧值、破坏重置；③危害面有限：偏好只影响本机 UI 呈现、不涉事实数据，双窗口同用户。
- 失败半边已由 T-1620 applyPreference 快照回滚守住；跨窗口后写者胜是本决策明示的接受边界。真需求出现（多窗口重度并行定制）时先做 per-field change manifest 再评估，独立批次不搭车。决策已同步 settings-field-registry 文档。
- 同批核对：onDataChanged 是远端变更通知路径，整桶采纳偏好/事项/模板/动作属正确语义（非静默覆盖）；会话草稿（settingsDrafts/journalDrafts）不入桶、不受影响。Agent createItem/createOccasion 已改经 enqueueMutation 写入（主 Store 锁内 reconcile 合并生效）+ persist 失败回滚重抛。

## D-314：跨窗口合并按桶分层——「并集合并」与「删除后写者胜」边界（2026-09-30）

- T-1622 三桶切片的合并口径：提醒动作按 (id,action,at) 身份并集（追加型，无删除语义冲突——restore 的清除只作用于本窗口写入时刻，跨窗 restore+动作并发是已知残留）；事项只对共享 id 并集 completedDates、不采用远端独有事项（Occasion 无 createdAt/updatedAt，无法区分「他窗新建」与「本窗已删除」，宁少采不复活）；失败箱在**变更前**同步（mergeExternalPendingBoxes 身份并集、本地载荷优先、normalize 强制容量/保留期）。
- 删除类操作（事项删除、失败箱丢弃、提醒 restore）跨窗口仍是后写者胜：确定性解决需删除标记（tombstone/removal record）=存储形状变更+迁移，涉及「箱的丢弃不写墓碑」既有纪律的修订，另立决策不搭车。事项写入先序下删除仍获胜（远端独有条目不被采用），失败箱靠「先同步后删」把复活窗口压到真并发竞态。
- 现有机制的复用边界：persistViewPreferences 的跨窗口防线=T-1620 applyPreference 快照回滚（写失败回内存），桶间合并留后续；主 Store 导入/快照恢复与 enqueueMutation 的锁内重读是另一批（事件层已有墓碑与幂等身份，不适用本条并集口径）。Dock Tomato 收件箱的锁内合并是既有范例，本轮未动。

## D-313：B 类即时偏好统一走快照回滚包装，note-query 七字段文档化保存边界（2026-09-29）

- T-1620 实施口径：按 T-1604 契约 2 的「逐字段迁移」落地为**统一包装 + 逐处理器接入**——applyPreference 以 collectViewPreferences 全量快照为回滚源（与 persist 序列化同源，杜绝双份清单漂移），失败恢复走 applyViewPreferences 原路映射（含 syncPluginLanguage 钩子），不做整页状态机改造。纪律：改值必须发生在 mutate 回调内，外层先行赋值会污染快照使回滚失效（守门含两条反断言）。
- 回滚的已知边界，接受并记录：applyViewPreferences 会重置 quickEntryCancelled/activeSavedViewId 等会话瞬态、应用启用守卫重算（同一 store 下结果不变）——失败是罕见路径，与「重载后恢复已存值」的语义一致；断连保留提示与来源 ingest 在包装外按既有时序执行，持久化失败时可能出现「提示已显示但设置已回滚」（极窄场景，不产生数据错误）。
- save-note-query 七字段（template/scope/targetId/itemId/field/value/tag）：登记决策=**文档化「整体表单即保存边界」**——原子收集+同源校验+失败整表回滚已具备，用户感知的失败反馈由 msg.prefSaveFail 承担；草稿化（settingsDrafts+变更清单注册）留 T-1616 分区重建随新表单实现，不在旧 DOM 标记上打补丁。注册表文档两处已同步，不再静默。
- 剩余边界：报告选项/来源筛选与回顾折叠等页面级视图偏好（plugin-ops 的裸 void host.persistViewPreferences）不在本任务字段清单；接入统一包装需扩 PluginOpsHost 接口并同步四个严格依赖桩，留后续批次评估。

## D-312：设置页「乱码」定性为伪乱码主因 + 键名泄漏次因，修复分层排期（2026-09-29）

- T-1615 排查口径：先区分真实编码缺陷与布局伪乱码，再定修复顺序。实测 i18n 语料（2504 对）零 mojibake、零控制字符；竖排/挤压主因是三类目标卡（文档/问卷/笔记本）专属样式只写 ≤719px 容器档、≥720px 全档被通用 settings-row 两列栅格把整个卡体塞进 240~260px 窄列（maintenance 无条件规则以 (0,3,0) 特异性压过卡片自有 (0,2,0)）；次因是 5 个缺失键（6 处调用）经 `t()` 缺键回退泄漏原始键名——i18n-parity 只查词典内部一致，不查代码引用完整性。
- 修复分层：目标卡样式提档与退役 `lc-checkin__settings-row` 复用类并入 T-1616 重构一次收口，不打孤立样式补丁；5 键补齐属低风险小改，与守门三件（代码引用键∈词典扫描、720+ 档目标卡特写快照、退役旧选择框反向断言）同批实施。两者在获得实施排期前不改运行代码。
- 调查工具（.artifacts 探针与截图）不入库、不入守门；本结论的证据以排查文档行号与量测数值为准，可按文档复现。

## D-311：「合法 localDate」统一为真实日历校验，rules/model 双实现暂存（2026-09-29）

- T-1619 实施口径拍板：rules.eventDateKey 从「格式正则即合法」升级为与 model.getEventDateKey（date-keys 的 isValidDateKey）一致的真实日历校验——`2026-02-30` 等格式合法但日历不存在的键不再充当记录日，统一回落 occurredAt 的本地日期。理由：日期契约单一真值是 date-keys（T-1419 R-A7）；配额贡献日若接受幻影键会把进度记到不存在的日历日。
- 已知残留：occurredAt 也不可解析时的终末回退两实现不同——rules 返回 undefined（fail-closed 排除聚合），model 返回 `occurredAt.slice(0,10)`（渲染侧字符串契约，不匹配任何真实日键）。两者都不会把事件落到真实记录日，不构成口径分叉；双实现收敛到 date-keys 规范出口留待其头注既定的后续批次，T-1619 不改 model 渲染契约。
- charts 月/年趋势改为记录日键半开区间后，年度热力图仍按 event.localDate 严格前缀匹配（非法键 fail-closed 跳过）——维持既有评审日历契约不动，是否统一回退留后续观察，不预设。

## D-310：功能调研与源码缺口按真实数据风险分层登记（2026-09-29）

- 本轮遵守用户“先梳理，不进行开发”的边界，只更新待办、审计与进度文档。新增 T-1629～T-1634：三类文档来源的持续分页、微信读书三指标完整性、API v5 读取来源契约、组合包部分应用、Loop/Obsidian 迁出语义、显式未达成原因评估。T-1634 是需要真实场景验证的条件候选，登记不等于批准立即增加事件类型。
- 数据正确性优先于扩充展示功能：固定首窗口持续漏读、微信读书部分笔记计数被每日身份锁定、迁出把跳过/破戒误标为完成、API 合法来源被拒绝，均有源码证据；实施时分别保持有界请求、幂等/墓碑、官方契约与公开写入防伪造边界。T-1628 只处理普通 CSV 契约，T-1633 处理 Loop/Obsidian 迁移语义与格式，不混并。
- 已有 T-1614 吸收 LifeLog 映射 50 条静默截断，T-1616 吸收绑定目标有界自动复检，T-1622 吸收 Agent 两类创建的失败回滚；不另立重复任务。长假暂停、PDF、ICS、Exactly 等历史调研候选维持原触发条件，不能因竞品具备而自动排入近期实现。

## D-307：以实际能力为基线重排体验计划，先修正确性，再按依赖做纵向切片（2026-09-28）

- 重新核对源码、测试与全部开放待办后，以 `docs/consolidated-experience-plan-2026-09-28.md` 统一实施顺序。T-1509～T-1523 已交付，旧路线所称“全部待开发/没有本地任务”均为历史快照；T-1575 建唯一能力注册表，T-1545/T-1561/T-1568 从中派生专项视图，T-1608 承载唯一验收台账，各页面任务只交付增量。
- 正确性优先：洞察的每日 `atMost` 判断与主模型相反，今日行动台目标取当日修订却使用项目现值单位，分别登记 T-1609/T-1610 为独立 P0；该两项先于洞察和今日 UI 重排。回顾三工作区、设置行搜索、目标搜索/体检、问卷事实先存/失败重试、提醒共用投影、快速弹窗窗控及渲染块 Today 记录均是已有能力，不重复立项。
- 配额属于排期、戒除/上限属于每日方向，只有二值/次数/时长三种基础类型。目标名称与路径先按现有会话查询显示，持久快照需要另立模型决策；现有元数据检查不等于可靠的写入权限预检，不试写用户正文。设置保存分显式草稿与即时异步持久化，迁移必须逐字段保留或明确变更。
- 实施依赖为状态/目标/路由契约先行，再走项目→来源→事实→可选文档输出纵向切片，然后逐页重排和多表面验收。D-300～D-306 的“先登记不开发”仍有效；本轮仅修计划与台账，未改运行代码。外部/决策候选继续遵循原触发条件。

## D-300：三类联动先按用户任务重构理解路径，登记待办不开发（2026-09-28）

- 用户要求先研究并列入待办。当前「宿主与插件 / 第三方来源联动 / 思源文档写入」分组保留了技术方向，却没有从“某个打卡项目怎样产生记录、怎样验证、结果是否写笔记”串起完整路径。研究稿为 `docs/integration-experience-design-2026-09-28.md`，实施队列 T-1545～T-1550；本轮不改运行代码和公开契约。
- 信息架构优先服务三种用户目的：让外部行为自动记到项目、把打卡结果输出到文档、向其他插件提供/使用能力。底层五类数据流及四轴状态继续作为真实机制；配置成功、宿主可见、实际落账、文档写入分别给证据，禁止合成含糊的“已连接/已同步”。
- 项目是联动的归属锚点，来源卡需展示映射、单位、触发及记录核验入口；文档输出是独立旁路，失败不回滚已保存事件。换绑不迁移历史，重复累计需显式预警。T-1545 先逐项核对源码，后续原型与实现不得以本研究稿代替事实核查。
- **登记即冻结**：T-1545～T-1550 按用户“加入待办先”暂不开发；用户明确要求推进该方向或后续正常排期再开工。

## D-301：三组内部设置按职责和动作重分层，先登记不改 UI（2026-09-28）

- 进一步核对 `src/render/settings.ts` 与 `src/i18n.ts` 后确认，混乱不只来自三组名称：每组内部也把目标配置、启用、运行探测、实际读取/写入、故障恢复并排混放，且“立即刷新/已启用”在监听、拉取、文档摄取和文档输出中含义不同。
- 宿主与插件拆成“我的专注工具”和“给其他工具使用的能力”；文档写入按报告、摘要、问卷、锚点的触发和所有权分开；第三方来源按监听、官方拉取、文档摄取、外部 API 使用不同动作词。所有卡片统一显示目标、动作、配置、运行、活动、问题六类事实，不能用一个状态徽标代替。
- 新增 T-1551～T-1555 作为 T-1545～T-1550 的设置细化子任务。仍遵循登记即冻结，本轮不改 UI、文案或运行逻辑；实施前先产出字段/动作/状态矩阵和设置原型。

## D-302：思源文档/笔记本绑定统一为目标选择器方向，先登记不开发（2026-09-28）

- 现状核对确认：日记、摘要、健康、叶归、笔记推导、问卷/锚点分别使用 ID 输入、文档搜索、笔记本下拉或手动加载；目标类型、路径、所属笔记本、可读状态和读取/写入范围没有统一呈现。已有绑定体检是查看型入口，不能完成修复和换绑确认。
- 采用共享目标选择器方向：文档/块/笔记本/当日日记先选类型，再按笔记本过滤和搜索，结果显示名称+层级路径+类型+可读状态；保存稳定 ID，同时保留可展示快照。各来源仍必须说明自身的读取/写入范围和是否创建文档，不能把统一控件变成统一语义。
- 换绑、清除、目标失效均需显示旧/新目标、历史保留和重摄取风险；校验失败保留原绑定，不能静默改投。新增 T-1556～T-1560，按“规范→组件→保存/换绑→失效恢复→范围文案与测试”推进；本轮不改运行代码。

## D-303：设置页改为“总览 + 任务分区 + 详情”的原型方向，先登记不开发（2026-09-28）

- 当前设置页 9 个一级组混合了普通偏好、外部关系、文档目标、数据恢复和关于信息；内容增长后用户无法判断哪些需要处理，也无法从项目/目标回到具体字段。研究稿为 `docs/settings-page-rearchitecture-2026-09-28.md`。
- 原型采用设置首页只读总览（待处理、最近活动、快捷入口）+“外观与操作 / 联动与目标 / 数据与恢复 / 关于与兼容性”任务分区+详情卡/抽屉。首页不新增业务状态，只聚合既有状态、审计和草稿；所有联动仍遵守 T-1551～T-1560 的职责和目标分层。
- 新增 T-1561～T-1567，按字段注册表、首页投影、字段级搜索、普通偏好重组、联动入口、恢复隔离、分阶段迁移验收推进。存储键、公开 API、事件身份、文档旁路和现有配置兼容性保持不变；本轮仅原型与待办，不改 UI 代码。

## D-304：新建打卡页按创建决策重构，先登记不开发（2026-09-28）

- 当前编辑器同时放置模板、类型/目标、排期、记录方式、问卷、锚点、组织、Task Horizon 和危险操作；“高级”区混合事实规则与显示/输出设置，新用户难以判断哪些是创建必选项。研究稿为 `docs/checkin-editor-rearchitecture-2026-09-28.md`。
- 原型按“选起点 → 记录什么 → 做到多少 → 什么时候做 → 怎样产生记录 → 可选输出与组织”渐进披露；类型驱动字段和记录动作，模板/空白/组合包共用一条表单，第三方来源只显示回链状态，不复制来源配置。
- 新增 T-1568～T-1574，先做字段能力矩阵和类型驱动模型，再重排表单、排期/记录方式、高级区、预览与保存栏，最后做旧项目兼容和多表面验收。本轮不新增类型、不改 Store v3、事件/排期/问卷/锚点/外部契约。

## D-305：全页面按主任务统一原型，先登记不开发（2026-09-28）

- 统一审查确认，页面数量增长带来的问题是任务边界、状态语义、回链和辅助内容层级不一致；今日、回顾、洞察、事项、归档、设置、编辑器及快速/嵌入表面各自增加功能，用户需要在多个页面间猜入口。
- 页面原型采用“一个主任务 + 分层辅助工作区 + 可回到事实”的原则：今日是行动台，回顾拆概览/记录/分析复盘，洞察负责从数据到行动，事项列表与编辑分离，归档成为恢复中心；设置和编辑器沿用 D-303/D-304，并补齐跨页回链。
- 新增 T-1575～T-1584，按矩阵、共享页面壳、今日、回顾、洞察、事项、归档、快速表面、跨页规范、分阶段验收推进。此轮不新增打卡类型、不改存储/事件/统计/公开 API；先完成原型和入口状态梳理，再逐页实施。

## D-306：跨表面路由与状态契约独立收口，事件/统计保持单一事实（2026-09-28）

- 源码审查补充确认：当前全局页面状态和单一返回页不足以支持 dock、页签、快速弹窗、移动宿主同时工作；初始化失败、回顾/事项/归档/洞察空态也没有统一的可恢复语义。T-1603～T-1608 将 surface context、状态契约、宿主响应式、安全区、输入/焦点、性能和渲染块 teardown 单独列为工程任务。
- 每个表面需保存 `page / returnStack / date / filter / workspace / focus / scroll`，状态需区分 loading、无数据、未探测、不可用、目标缺失、失败可重试、已保存和草稿；未知宿主状态不得冒充已连接，失败不可清空草稿或重复写入。
- 跨表面改造不新增事件或 Store 字段作为捷径，Today/Review/Insights/Reminder/文档输出继续复用现有事实和统计内核；旧 DOM 钩子、书签、深链、渲染块和容器降级先做兼容映射后再逐步替换。

## D-299：轻迹 QingTrail 调研的吸收分级与「正文双向编辑」红线（T-1541~T-1544 登记，2026-09-28）

- **定位**：轻迹是叶归生态的可视化前端（读 Marker 段落做呈现），小驴是结算引擎（Marker→事件）——读同一数据源，其呈现创意可低成本移植到回顾页；自用插件成熟度低，只借鉴创意不依赖实现。
- **吸收两条**：T-1541 LifeLog 时间轴（纯渲染零写入，事件 note 字段已含 type:text）；T-1542 类型筛选与聚合（前置=note 解析口径确认）。登记观察两条：T-1543 日历徽标（冗余评估）、T-1544 段落修订检测（真实边界：源文档手改后 blockId 幂等身份挡住重结算）。
- **「正文双向编辑」不吸收（纪律红线）**：轻迹右键改记录同步文档正文的前提是没有独立事件层；小驴事件一经结算属事实层，从呈现层改写源文档会造成事件与原文不一致且绕过墓碑修正纪律。仅吸收其「快速跳转源文档编辑」的交互形态；真正的修正通道按 T-1544（指纹对比→墓碑→新事件）设计。
- **登记即冻结**：同 D-298 口径，四条待办不因「继续」类指令自动开工；T-1541 可在下一批正常排期时作为低成本首选项（与 T-1539 并列）。

## D-298：源时记调研的吸收分级与「先不开发」口径（T-1539~T-1540 登记，2026-09-28）

- **定位**：源时记（siyuan-time-spent）是被动时间量化插件，与小驴的主动打卡互补——联动面大于竞争面；其 petal/ JSON 落盘形态与叶归本地读取同构，是来源框架的潜在下一租户。
- **三条吸收候选全部带触发条件、先不开发**：T-1539（AI 复盘复制提示词，纯本地低成本，下批优先候选）；T-1538（内置计时闲置暂停/净时长，需用户拍板产品口径——番茄承诺制与净时长存在张力，且 WebView 输入事件可用性需真机验证）；T-1540（源时记数据源适配评估，需上游数据面确认；跨窗口归属与 T-1508 同款边界，不自建被动追踪）。
- **明确不吸收三项**：周期目标 Hero 卡（与低压力口径有张力，自由文本目标已被周复盘「下周一项调整」覆盖）；内置流式 AI/API 旋钮（本地优先与智能体默认只读边界，第十一轮红线延续）；看板双向直达（等价能力已有）。
- **登记即冻结**：按「登记不等于开工」惯例，三条待办不得因「继续」类指令自动开工；T-1539 可在下一批正常排期时作为低成本首选项。

## D-297：质量审计三项结论与 CSS 微重复的主动降级（T-1529，2026-09-28）

- **三条线索查清均干净**：①编辑器截图中「可疑文案」经与 i18n 全量核对为低分辨率截图误读，无缺陷字符串；②中文文案脚本审计（2330 个含 CJK 键）：ASCII 标点混排 0、重复标点 0、你/您称谓冲突 0，4 个首尾空白键均为有意格式（`\n\n` 前缀的多行确认框、尾部空格是确认文案拼接分隔符，index.ts:4558/4603 依赖）；③visual-qa harness 已有硬断言（mobileMatrix 横向溢出 scrollWidth===clientWidth、卡片动作区重叠、标题不换行、API 行为矩阵、pageErrors 深比较），无「只记录不拦截」的薄弱守门可补。
- **CSS 微重复（57 组 ~5.2KB）主动降级为护栏管理**：每组均为「同编译上下文 + 同选择器 + 同声明」的级联等价规则，摘除任意一侧理论上零行为差；但源文件中重复对分散于嵌套与平铺两种形态（如 components.scss:4718 嵌套 vs 5374 平铺），可靠定位需 SCSS 感知解析，约 45 处手工摘除的回归风险高于 ~4.5KB（占文件 0.7%）的收益。css-hygiene 已设 10000 字节重复护栏（当前 ~5007，余量近半），**维持护栏管理、不做专项摘除**；未来若护栏告警或触碰某组时顺手处理该组。
- **判定口径**：本地「实际问题驱动」探索以可证实的用户可见缺陷为先；护栏内且有客观红线的债务项不单独立项，避免为改而改（AGENTS.md「改无关代码」禁令的镜像适用）。

## D-296：T-1392 消费端切片只做参考层与夹具，不接线真实视图（T-1527，2026-09-28）

- **切片边界从严**：BLOCKERS 与路线图明示 T-1392 当前只准备「本地契约草案和夹具」。因此本任务只交付契约包内的消费端参考模块（calendar-consumer.mjs）与仓库门禁夹具；不修改 task-horizon-v1.json、不改 manifest.json、不动 api-v5.md、不在小驴日历视图接线任务图层——后者待 T-1394 双向真实宿主验收后再立项。
- **零臆造契约**：参考层的唯一依据是已发布的 v5 calendar.read 契约（manifest 事件清单、limits.calendarProjection 366/200、6 状态枚举、防御性副本与超限语义）。刷新分类的「四类」从已发布 8 事件归纳（record/structure/derived/unrelated），不发明宿主不存在的事件。
- **失败一律可诊断**：消费端九个 reasonKey（api-missing/host-outdated/capability-missing/invalid-range/range-too-long/timeout/aborted/provider-failed/projection-invalid）全部走结果对象，不抛裸异常——符合契约包准入清单第 5 条（失败隔离）。超时/中止语义由参考层自己承担（race 独立定时器与中止 promise），不依赖提供方实现 signal。
- **过期缓存不回退旧事实**：缓存只在 TTL 内命中，过期即重查；失败结果一律不写缓存。与 D-291「可信记录」口径一致：宁可多查一次，不给用户看旧事实。
- **参考层的价值定位**：Task Horizon 侧可零成本据此生成消费层常量与 CI 夹具（同 check-contract.mjs 用法）；小驴侧后续接线时复用同一模块，保证双方测试同一份语义。

## D-295：CSS 审计恒真缺陷的修复口径与死规则退役流程（T-1526，2026-09-28）

- **死类判定只看 TS**：TS 是唯一在运行时把类写进 DOM 的来源；SCSS 里出现只说明「有样式定义」，不说明「有元素挂这个类」。旧审计用 TS+SCSS 合并文本做包含判定，而 dist CSS 编译自 SCSS，任何类必命中自身定义——dead 恒为空，css-hygiene 守门自 T-1354 起形同虚设。修正后：零 TS 字面引用 → dead；is-/has- 前缀与数字后缀 → dynamicSuspect（TS 以 is-${state} 模板拼接，人工核对）；b3- → 宿主 DOM 类（插件只做覆盖，不判死）。
- **退役必须双向核查再动手**：①TS 全量字面引用（含大小写）；②动态拼接模式（`is-${}`、`lc-checkin--${}` 等）；③SCSS @extend（无则安全）；④测试守门正/反向断言（本次 6 个守门因保护死 CSS 而同步修正，均记入 TODO）。改判「死」的证据链记入台账，日后可考。
- **退役词表模式沿用 R-18.4**：删除的类加入 ui-state-ledger 退役词表（断言「不得回流」），比正向存在断言更防复活。骨架屏 skeleton 家族按此退役——加载反馈仍由 toast、recent-record、save-status 通道承担。
- **表面清单以 TS 为准**：release-assets 守门的表面类清单曾含幻影表面 summary（实为回顾页图标名，非表面类）。表面类集合 = TS 实际施加的 8 个 lc-checkin--*，守门清单与之一一对齐。
- **注释不写类名字面量**：退役注释含被删类名会触发退役词表/反向断言（正向与反向各踩过一次）。注释用家族描述（如「骨架屏 skeleton 家族」）避开完整字面量。
- **预算效果**：CSS 647610→630747 字节（-16.9KB），重回 620KB 软线以下；为后续 UI 任务释放约 24KB 硬线余量。清理只删实证零消费方规则，不做「顺手优化」，未触碰任何活规则的选择器组语义（组内剪枝只删死选择器行）。

## D-294：循证模板批次的选型与 curated 上限演化（T-1525，2026-09-28）

- **来源与调研**：习惯方法论书评要点（《掌控习惯》：四定律/两分钟法则/习惯叠加/身份认同；《福格行为模型》：B=MAP/微习惯小到不可能失败/庆祝/锚点绑定）+ [HowToLiveBetter](https://github.com/eternity4719/HowToLiveBetter)（601 条循证生活指南，只引期刊论文与官方文件，按性价比排序）。模板 note 只用双方共识强、可被一句建议承载的结论，不堆术语。
- **入选 5 条的标准**：①与既有 67 模板功能不重叠（「户外时间/无屏幕餐/即刻两分钟」等候选因与散步/跑步/读一页书边缘重叠被裁）；②证据较强或为方法论共识（服药依从/打断久坐/分散练习+自测/社交联系为指南高性价比条目，两分钟法则是《掌控习惯》核心法则）；③形状落既有 kind/schedule 语义，不引新机制。最终：读一页书、按时服药、定时起身、联系亲友、分散复习。
- **微习惯基线刻意偏小**：读一页书是二值项而非阅读时长；定时起身 6 次/工作日是「打断」语义而非运动量。与 D-291 低压力口径一致：目录默认目标应小到不可能失败，用户可自行调高。
- **curated 上限 70→75**：template-gallery 守门 `templateNames.length <= 70` 是防目录无限膨胀的精选约束，不是恒定常量；循证批次后 72 个，上限随批次演进调至 75，并在守门新增循证批次存在性断言（5 名缺一即红），防止后续清理误删来源可考的模板。
- **纯内容资产**：零新增 CSS（647610 字节不变）、零宿主接线、零新 i18n 机制，全部走既有 TEMPLATE_NAME_KEYS/tplNote 双语通道。

## D-293：外部失败待处理箱的边界与常量（T-1509，2026-09-27）

- **只收可重试存储失败**：recordExternalEvent 增加失败归因出口（lifecycle/项目不可用/非法值/身份拒绝/修订变化/单位不符/append 拒绝/storage-failed），只有 persist 抛错（storage-failed）才入箱；配置拒绝不入箱——自动重试配置被拒的写入等于绕过用户的撤销/改绑/停用，正是本任务要防的「错误复活」。
- **容量 40 条、保留期 14 天**（EXTERNAL_PENDING_CAPACITY / EXTERNAL_PENDING_RETENTION_DAYS，显式常量）：外部摄取是分钟/小时级轮询，40 条足以覆盖一次长时间存储故障的碎片；14 天后仍未恢复的记录到期剪除（故障太久远的数据补录价值低且箱有界是硬约束）。满箱显式拒绝并 toast 提示，不静默覆盖最旧数据。
- **重试唯一决策边界在纯函数 planExternalPendingRetry**：宿主只负责用当前 store/偏好组装重查输入（目标仍在映射且未改投、来源启用、无墓碑、单位一致、日期非未来），任一不满足即拒绝并给出可见原因；拒绝条目保留在箱中由用户重试或丢弃。撤销写墓碑（removeEvents 既有通道）→ 重试命中墓碑即拒绝，不错误复活。
- **启动恢复每条只自动尝试一次**，结果计入会话摘要（成功/拒绝/继续等待）并在设置页可见；不设常驻自动重试定时器——反复自动写失败数据违背低压力口径，用户显式重试不受限。
- **不承诺恢复从未收到的会话**：箱只持有「已到达写入边界但落盘失败」的片段；监听未收到、缓存前崩溃、存储完全不可用期间的数据仍是 T-1508 上游边界，不在本能力范围。
- api 来源按登记前缀区分治理（health:/notequery: 各查自身偏好；其余 api 写入方无本地启用位，仅要求项目存在）；丢弃只移除箱条目不写墓碑，带确认弹窗。

## D-292：回顾概览统计区移除 30 天迷你趋势线（T-1524，2026-09-27，用户反馈）

- 用户反馈概览统计卡下的「近 30 天」迷你线出现得突兀、不该放那里。判断成立：统计卡三格均为所选统计周期口径，迷你线是固定近 30 天口径——两种时间尺度混排；且它作为第 4 网格项落在三列网格第二行第一列，悬在「条记录」下方，无视觉归属。
- 概览统计区回归「纯数字指标」：与此前把 analytics 徽标降为屏幕外可读（不占第 4 格）的方向一致；移除后「概览无重量级图表 DOM」不变量升格为零 SVG、零豁免。
- 趋势呈现不丢失：分析工作区「趋势」折线图是趋势的唯一承载，口径与范围控制更完整；不在概览补第二处图表，也不新增替代物。
- 清理彻底不欠债：`renderSparkline` 助手、3 条 SCSS 规则与 2 对 i18n 键一并移除（零死类、零死键），守门改为断言 sparkline 全面退役；R-16.2 能力就此退役，历史记录保留在 Git 与本台账。

## D-291：产品收敛与 15 项本地可验收功能计划（2026-09-27）

- 愿景确定为“真实行动形成可信、可解释、可复盘的长期记录”；下一阶段深化记录、规则透明、复盘行动与配置复用，保留现有一级导航与低压力视觉语言。
- 当前队列改为 T-1509～T-1523，完整范围和验收见 docs/product-direction-and-local-plan-2026-09-27.md；本轮仅规划，不把计划标为实现，也不将工作区未发布内容等同于已发布版本。
- T-1508 的持久失败恢复是本地可开发工作，由 T-1509 承接；跨窗口共享身份与未收到的监听事件不能据此宣布解决，不用近似时间合并替代可靠身份。
- 15 项新增功能以纯逻辑、注入持久化和生产 UI 的浏览器交互验收，不新增宿主 API/网络契约，不依赖真实设备或对方回复；不撤销历史事实缺口，也不将这些缺口恢复成开工等待项。
- 不做新云服务、RPG、通用任务系统；复用已有搜索、模板、批量补卡、比较和联动预览，任务卡只计明确增量。无需再次批准即可按队列进入后续开发；本轮交付范围为审查与计划。

## D-289：快速录入识别与实际写入分离（T-1496，2026-09-27）

- 日期、每周排期、数值和时长可以在今日筛选区被识别并取消；识别不等于改动项目排期，也不授权未来日期补卡。
- 裸数值不猜项目。实际记录必须明确且唯一匹配项目名、当前单位一致、日期为今日、项目未完成且不属于限额/戒除；点击时重算并核对项目身份，避免旧 DOM 或输入变化导致误写。
- 关闭识别保留既有筛选行为；组合输入期间不按未完成拼音片段解析。项目名不作为记录备注持久化。

## D-288：文档摄取窗口读满不伪造截断数量（T-1505，2026-09-27）

- 三个文档来源统一给出会话内扫描与处理计数；报告只存数值和枚举，不存正文、外部身份或凭据。
- SQL 有界窗口读满只能说明可能还有未读行，不能推出确切截断数；设置页显示风险提示，不写虚假的「截断 N 条」。
- 匹配预览允许在来源关闭时检查已保存的目标配置，但在事件写入队列之前退出；手动摄取仍遵守来源启用门槛和既有幂等/墓碑边界。

## D-286：笔记推导只读查询的身份与降级边界（T-1500，2026-09-27）

- `notequery:<itemId>:<blockId>:<localDate>` 登记为 externalRef 前缀；事件继续走既有 `source: "api"`，不扩展公共 source 枚举，避免来源过滤和导出语义分叉。
- 接入只提供两个固定模板（日记字段 frontmatter、完整标签 tag），查询范围必须是用户显式绑定的单一文档或笔记本；SQL 由插件生成，配置值只作为受限 token，单轮最多 200 行。
- 同一项目同一日期已有手动事件时，手动事实优先，笔记命中跳过并提示；相同 block/date 重跑命中既有 externalRef 返回重复，墓碑继续阻止复活。
- 宿主缺失、查询失败、目标失效或解析不确定时 fail-closed 为空结果，保留历史和原始 externalRef；不猜项目、不改写笔记、不把任意 SQL/自然语言/新指标写成能力。

## D-285：快捷指令文档不伪造自定义健康指标（T-1501，2026-09-27）

- T-1501 是文档交付，不新增运行时代码；现有 `HealthInboxMetric` 与严格行解析器只接受 `steps` / `weight`。
- 因此「自定义指标」解释为自定义触发场景、取数来源和补录路径（仍生成受支持的两种行），不把 `health:sleep`、`health:heart-rate` 等任意名称写成可用配方。
- 文档必须给出不支持示例、失败排查和手动/精确记录降级路径；未来若新增指标，需另立运行时任务、来源身份、单位校验和守门测试，不能仅扩写文档。
- 真机 iPhone + 思源内核链路仍标记 `host-pending`，文档通过不等于设备验收通过。

## D-284：信任层命中原因「不冒认」——只在能确证时解释，撤销复用既有墓碑通道（T-1490，2026-09-27）

- **命中原因是解释不是事实记录**：阈值结算原因（「32 分钟 ≥ 阈值 30 分钟」）由事件值与**当前**绑定阈值只读对比派生，历史时刻的真实阈值不入库（零 schema 变更）。因此事件值低于当前阈值时一律不显示原因——那说明口径已变，继续解释就是编造；「宁可少说，不编造解释」与 D-280「失败可解释是硬验收」互为表里：可解释性约束的是不撒谎，不是必须说满。
- **来源徽标复用既有 source.\* 双语词汇**，不另造一套来源名；未知来源降级 source.api 徽标（与宿主归一化口径一致）。快捷指令（health: 前缀）在徽标层显示「接口写入」、原因层显示「快捷指令同步」——来源分类是管道事实（走公开 API），原因解释是业务语义（快捷指令上报）。
- **撤销不新增通道**：信任层的「一键撤销」就是历史行既有的 data-history-event-id 按钮——removeEvents 对带 externalRef 的事件自动写墓碑，外部来源不会重复累计；信任层只负责让用户「看得见来源、看得懂原因」，修正路径本来就存在。
- 徽标对比度教训：accent-on-accent-soft 9px 文字 2.65:1 被无障碍审计预算拦下，改 muted 文字+accent-soft 描边——小字号元数据一律走 muted 已验证口径，品牌色只作描边提示。

## D-283：提醒降噪三件套口径——全局「仅一次」偏好、窗口首日语义、横幅覆盖单一判定（T-1495，2026-09-27）

- **提前提醒「仅一次」做成全局视图偏好而非事项级字段**：降噪诉求是「提醒渠道别逐日轰炸」，与单个事项的窗口长度（remindBeforeDays）正交；全局偏好零 schema 变更（view-preferences 新增 `occasionRemindOnce`，默认关=原逐日行为，归一化只认布尔 true），事项级开关留给真实反馈后再评估，避免编辑器再增一层低频控件。
- **「仅一次」的语义取窗口首日（daysUntil === remindBeforeDays）**：「提前 7 天提醒我」的自然承诺是提前 7 天那天提醒一次，而非此后逐日重复；当天提醒（daysUntil === 0）不受影响——它是行动日本身不是提前提醒。非法输入 fail-closed 回落可见（不隐藏既有信息）。横幅「X 天后」芯片属信息呈现不是提醒，不受此偏好影响。
- **横幅覆盖单一判定**：`isBannerCoveredReminder`（occasion+today+dueDate=今天）由推送摘要与今日页优先卡/行动台共用，保证「横幅已聚合则不重复弹」三处口径一致；逾期一次性事项不在横幅（横幅只含 today/upcoming），推送与优先卡保留——逾期是需要行动的事实不是噪音。横幅只展示前 3 个芯片，但降噪优先：当日事项一律不再进优先卡，「管理」入口与回顾页提醒中心仍可达全部。
- **推送摘要只升级文案不动通道**：仍是 T-1443/T-1451 的同一条 pushMsg（守门断言全仓库恰一处推送调用，calm 禁则：不新增后台常驻、不新增推送通道）；摘要=计数+至多 3 个代表项目名+溢出「等 N 项」，零事项不消费槽位纪律不变。

## D-282：页签呈现「并存不替代」，以默认打开方式偏好收口（T-1502，2026-09-27，用户点名评估）

- **评估结论：做（小幅收口），不新造表面**。页签呈现已是完整交付能力——`addTab` 自定义类型注册（init/update/destroy 全生命周期、图表销毁、多实例幂等）、固定 tab id 复用聚焦（重复打开不新建）、visual-qa wideTab 断言与宽度走查覆盖、README 已有说明。真实缺口是可发现性与入口便利性，不是能力本身。
- **页签优点**：常驻可固定在布局、随布局重启恢复、可与文档分屏、回顾/分析等全宽页面体验优于弹窗。**缺点/边界**：占布局空间（打卡是高频短交互，部分用户偏好即用即走的弹窗）；移动端无页签语义（desktop-only）；dock 图标点击=展开面板是宿主语义不可挪用。结论：**与弹窗并存，不做默认替代**。
- **落地**：新偏好 `defaultOpenMode`（quick 缺省/tab，归一化 fail-closed 回落弹窗）；openCheckin 命令、全局热键与顶栏按钮共用 `openDefaultEntry()`，经 `resolveQuickEntryTarget` 纯函数路由（tab 仅在 supportsCustomTab 时生效）；openCheckinTab 命令保持直达页签；设置页「外观与交互」新增打开方式选择行；README 补页签入口说明。入口行为变化仅影响显式选择 tab 的用户，缺省行为零变化。

## D-281：联动预接线以「计划-保存-消费」三段实现，健康收件箱升级按项目映射（T-1486，2026-09-27）

- **建议与启用分离**：编辑器联动建议卡只产生显式确认的「保存后生效」计划（表单隐藏字段，白名单 fail-closed）；项目真实落盘后一次性消费，写入走既有偏好通道；确认可撤销、换模板即重置、保存失败零副作用。绝不静默启用任何联动。
- **亲和锚点用 zh 原名**：目录模板以 zh 名为数据锚点，联动亲和表（步数/体重/阅读/问卷日记）按 template.name 解析而非译文——语言切换不影响建议触发；卡片文案走 i18n 双语。
- **健康收件箱 schema v2**：`metricBindings[]`（metric+itemId，去重、容量 16、fail-closed）取代全局单项绑定；同指标可挂多项目（如按日与按周步数目标），每项目独立 externalRef 身份（health:<itemId>:<metric>:<date>）各自幂等可撤销，属用户显式挂载而非双重累计。旧 `stepsItemId/weightItemId` 归一化时迁移为首条映射并保留镜像字段——旧版本降级仍可读到主映射，真实内核 e2e 种入的旧形状偏好继续可用（迁移即验收）。
- **思阅改绑必须显式警示**：sireaderIntegration 仍为全局单项目映射，建议卡在已有绑定时呈现 conflictNames（「保存后将改绑并解除原绑定」）；问卷日记建议只聚焦既有绑定控件，无预设时降级提示，绝不自动挑选预设。
- **单元校验纪律不变**：启用健康收件箱仍要求步数单位「步/步数」、体重「公斤/千克/kg」；映射行变更后单元不匹配沿用「强制停用+提示」既有语义。

## D-280：第十一轮生态调研采纳口径——联动自动化三原则、新建预接线与事项页三层差距（T-1400 第十一轮，2026-09-27，用户点名）

- 用户点名四主题（联动自动化/新建模板与设置/事项页/UI 性能全面优化）+ 要求 ≥10 项任务入清单。四路并行调研（事项赛道、联动自动化、新建 UX、快速录入与性能）产出 50 候选，采纳 16（T-1486～T-1501，四批次）、延后 9、不做 7；全案与证据见 benchmark 第二十一节。登记不等于即时开工，按 D-256 拆批推进。
- **联动自动化三原则（适用于 T-1486/T-1490/T-1500/T-1501 及后续所有自动结算）**：①预接线不等于自动启用——模板只携带「建议绑定」，确认前不物化任何联动配置，沿用 `enabled` 无合法映射不物化纪律；②失败可解释是硬验收——自动完成必须呈现来源徽标、结算命中原因与一键撤销（复用既有 source/externalRef/墓碑通道，零 schema 变更），缺一不收口；③推导类来源（笔记查询等）只读 SQL、显式 opt-in、来源前缀登记、与手动来源互斥提示防双重累计。万能 webhook 写入口维持红线。
- **新建体验差距对冲**：65 条内置模板粒度已高于全部竞品，不再扩数量；差距在「模板携带数据源」（T-1486）与「智能默认」（T-1487）——默认推断必须与显式选择分离呈现且可改，不覆盖用户输入。空状态装填与连建流（T-1488）、动态推荐（T-1489）均为小改动，复用既有组合包预览确认通道与静态推荐位。
- **事项页按三层差距排批**：时间表达层（T-1491 里程碑/T-1492 多单位与进度）先行——纯本地计算零 schema 变更，里程碑为只读投影；生命周期层（T-1494 实例覆盖+错过处理）为 additive schema（Occasion 新增 overrides 走版本化 normalize，旧数据零迁移），顺延走显式动作；情感层（T-1493 历史上的今天）只读投影，隐私口径与回顾页一致。提醒聚合（T-1495）只降噪不新增后台常驻。
- **交互与性能边界**：NLP 录入（T-1496）解析器为纯函数 fail-closed、解析高亮+点击取消+设置可关，未识别文本按现状提交；批量补卡（T-1497）复用 recordEvent 幂等与 SKIP 语义、逐条独立可撤销；性能升级（T-1498）是门禁加强（单 task <50ms 断言）而非重写，虚拟滚动维持不做；WCAG 2.2 核对（T-1499）以等效控件豁免登记合规路径，不推翻 44px 基线。

## D-279：问卷日记提示词轮换按确定性周相位实现，呈现与身份分离（T-1484，2026-09-26）

- 每题可选配「提示词池」：内置模板经 `promptKeys`（i18n）解析、自建模板存 `prompts` 原文；有效候选 ≥2 条才构成池，<2 条（含解析失败、缺翻译、孤立/空白候选）整体不物化并回落基础题干——未配置池的题目与模板行为零变化。
- 轮换相位 = `journalIsoWeekKey(localDate)`（零依赖 ISO 周算法，显式 UTC 运算 + 真实日历校验，非法/不存在日期返回空串）经 djb2 hash 对池长取模；同一 ISO 周内每天同题、跨周确定轮换。`journal-templates` 保持单文件零依赖可转译（守门测试按单文件加载），不引入 date-keys 依赖。
- 弹窗取词与写入文档题干共用 `resolveJournalQuestionText` 单一实现，保证同日「所见即所写」；轮换只影响呈现——事件 note 摘要、幂等标记（模板 ID + localDate）、重填整块更新与撤销语义均不变。跨周重开旧草稿时题干可能已轮换，答案按位置提交，由用户在弹窗内可见确认。
- 池归一化 fail-closed：trim/去重/单条 200 字/容量 6，有界扫描前 18 项防损坏稀疏数组；设置文本以 `> 候选` 行配置池，序列化与解析严格往返，孤立池行按坏块拒绝（与既有 fail-closed 块纪律一致）；builder 复制/复制题目深拷贝池数组，不共享引用。

## D-278：绑定目标以独立卡片承载，写入动作与启用状态分层（T-1485，2026-09-26）

- 日报、摘要驻留、问卷日记、健康收件箱和叶归的目标输入/选择统一使用目标卡片；卡片顺序固定为目标说明、搜索/选择或 ID 输入、保存/创建，启用开关与“立即写入/刷新”继续作为来源面板的后续行。
- 卡片只改变信息层级和响应式样式，保留原有 `data-*` 选择器、共享文档存在性/类型核验、失败回滚与会话草稿。目标状态沿用 `setup / ready / enabled / rebind`，不把本地绑定误报为上游运行连通。
- 窄屏默认纵排并保证输入控件至少 44px 高；宽容器再恢复并排布局。颜色只使用插件已有双主题变量，长目标 ID、路径和翻译文案允许任意换行。

## D-269：设置页按联动边界拆分，配置状态与运行连通性分离（T-1460，2026-09-25）

- 设置页顶层分为「宿主与插件」和「外部联动」：前者只描述提供方/能力契约（Dock Tomato、思源 Agent、Task Horizon），后者只描述七个实际来源或文档写入目标（日记、摘要、思阅、健康、思播、微信读书、叶归）。自定义图标回到外观与交互，数据恢复留在数据与恢复。
- 来源卡片统一展示 `setup / ready / enabled` 三态。三态只表达本地目标与凭据是否齐全，不把“已配置”冒充上游事件到达或消费方握手；Task Horizon 的 `healthy` 保留 provider contract ready 语义，并在文案中明确未检测到消费方。
- 配置 UX 采用「绑定目标 → 保存策略 → 启用 → 验证」顺序；健康收件箱没有文档或至少一个指标映射时拒绝启用；微信读书清除 Key 必须确认，清除后停用但保留项目绑定。来源停用沿用既有纪律：只停止后续采集，已落盘事件与幂等身份不删除。
- 这轮只改变设置表面、前置校验和 Key 清除入口，不伪造思阅/思播/叶归/Task Horizon/第三方 API 的运行时连通性；真实思源设备、Android 和双插件现场证据继续按 `host-pending`/`external` 管理。

## D-263：动效引入的克制原则（2026-09-23，用户指示）

- 动效在主体开发基本收尾后作为收尾增强引入，不在功能批次中途插入；每次只做少量、克制的尝试。
- 硬前提：性能不回退（渲染门禁、帧率预算照常生效）与可用性不受损（不阻塞操作、不产生布局跳动、不遮挡内容）。
- 一律尊重 `reducedMotion` 用户偏好与插件内动效开关；首启发 Celebration（T-1410 顺带）按此口径执行。
- 该原则适用于后续所有视觉增强，不只是本条登记的动效。

## D-262：健康数据采用收件箱文档中转（T-1403，2026-09-23）

- 评估卡 4 的「快捷指令经公开 API push、插件零代码」假设经架构验证不成立：快捷指令只能 HTTP 到思源内核，无法触达渲染进程内的 `recordEvent`。
- 实际交付为「收件箱文档中转」：快捷指令经内核公开 `appendBlock` 向用户绑定文档追加严格格式行（`health:<metric>:<YYYY-MM-DD> <数值>`），插件按 5 分钟有界周期轮询、严格解析、幂等入库（source `api`，externalRef `health:<metric>:<localDate>`，registry 登记 `health` 前缀）。
- 幂等口径：同 metric+日期只入一条，同日重复 push 与多窗口轮询收敛（复用既有 source+externalRef 身份）；行保留在收件箱文档由用户归档，插件不改写用户文档；更正走历史删除后改值重发。
- 指标→项目映射（步数/体重各一）为显式 opt-in 配置，`enabled` 无合法 docId 不物化；接入文档与快捷指令模板见 docs/health-shortcuts-integration.md，真机验证归 T-1388。

## D-261：框架来源事件写入路径的可信性口径（T-1387，2026-09-23）

- **按日累计结算**：思阅（及后续时长类来源）的资格判定以「当日累计分钟」为准，而非单批片段——20+20 两段也能过 30 阈值；写入值 = 达标时点的当日累计分钟数。宿主结算输入统一用 `SireaderFocusTracker.dayTotal(localDate)`，不再用增量片段（修复 T-1384 首版缺陷）。
- **删除即永久（可撤销闭环）**：用户删除某来源当日事件产生墓碑（itemId+source+externalRef 三元组）；写入路径预检 `eventTombstones`，墓碑身份永不重写；模型层 `appendEvents` 亦拒绝墓碑身份事件（双保险）。用户删除打卡后，同日继续阅读不会复活记录。
- **失败自愈**：写入失败（指纹不匹配/持久化失败）不引入显式重试器——只要当日未写成功，下次生命周期事件会以新的当日累计值重新结算并再次尝试；结算层确定性保证重试无副作用。
- **跨窗口并发**：两窗口同日各写一条同 externalRef 事件时，合并层 `deduplicateExternalRefs` 按 `itemId+source+externalRef` 身份收敛为一条（canonical 选择器择优），配合存储通知与 `recordExternalEvent` 的存量身份去重，最终收敛有界。
- **口径不变**：上游契约（T-1395 双轨）、每来源一次/日、分钟取整、重载丢弃在飞区间等 D-260 口径全部维持。

## D-260：思阅适配器 MVP 落地口径（T-1384，2026-09-23）

- **新事件来源 `sireader`**：`CheckinEvent.source` 枚举扩展第四外部来源（manual/tomato/import/api 之上）。它是内部适配器保留来源——`recordExternalEvent` 白名单放行（含 normalize 与多窗口合并白名单，保证来源不被降级为 manual），但公开 API facade `recordEvent` 把输入中的 `source: "sireader"` 强制回落 `"api"`，外部消费方不能伪造。
- **写入身份**：`sireader:<itemId>:<localDate>`（每日一次幂等键），登记进 `EXTERNAL_REF_PREFIX_REGISTRY`；重复写入由既有 `source + externalRef` 去重兜底，删除走既有墓碑与撤销路径（可撤销）。
- **计时口径**：只消费思阅公开生命周期事件（reader:open/focus/blur/close，源码级证据），有效时长 = 有焦点区间墙上时间，分钟向下取整（宁少记不多记）；open 亦可开始焦点（阅读器打开即聚焦）；重复 focus 不重启计时；空闲 blur/close 忽略；时间倒流忽略。
- **跨日与重载**：片段按 localDate 预切分（框架接入层契约，一段一日）；重载/卸载时在飞焦点区间直接丢弃（fail-closed 少记），未写入的已累计分钟不跨会话保留。
- **写入时机**：每次焦点片段完成后结算；当日 countedValue ≥ 阈值（默认 30 分钟，1~1440 钳制）且当日未写过时写入一次（值为结算时点累计分钟数，MVP 不做日内更新，后续 T-1387 评估）。
- **opt-in 与作用面**：`sireaderIntegration {enabled, itemId, thresholdMinutes}` 偏好默认关，enabled 无有效 itemId 不物化；MVP 单项目映射，多来源/多映射治理 UX 归 T-1386。设置页三行（开关/项目/阈值）双语。
- **上游契约**：思阅生命周期事件为源码级证据未成官方契约，适配器按研究结论保持 opt-in + 可撤销；上游公开 API 提案归 T-1395/D-255。真实宿主验收（桌面/移动/重载/双插件）归 T-1388，验收前不宣传为稳定功能。

## D-259：Task Horizon 日历可见性字段与只读投影落地口径（2026-09-23）

- **字段语义（T-1390）**：`CheckinItem.taskHorizonCalendarVisible?: false`——类型上只允许 `false`；缺省/true 不写字段（旧数据零迁移、与 normalizeItem 规范字段集合逐键一致）；仅显式 false 物化。只控制外部日历投影，不删除本地数据、不复用 `archived`、不影响 `recordEvent` 任务回写（显示与写回分离，沿用 D-254）。
- **投影能力（T-1391）**：新增 v5 能力 `calendar.read`（since 5）与方法 `getCalendarProjection({startDate, endDateExclusive})`——有界项目×日期只读投影，服务端过滤隐藏与归档项目（消费方不得读全量后自行过滤）；区间 ≤366 天、项目 ≤200，超限 `truncated` 显式标注；不含备注/附件/externalRef。
- **状态单一路径**：排期/配额/SKIP/atMost/修订生效日/日期归属全部由小驴侧计算（复用 isScheduledToday/isItemAvailableOnDate/isComplete/evaluateQuotaSchedule 单一实现），状态 ∈ complete/pending/skipped/at-most-safe/at-most-breach/logged；SKIP 中性、atMost 专用状态不套百分比、quota 只投影真实贡献日 + item 级 quotaRate、非排期日不伪造计划项。
- **UX（T-1393）**：编辑器高级区开关「在任务管理器日历中显示（Task Horizon）」，缺省勾选；取消勾选仅保存 false；保存走既有冲突指纹（itemFingerprint 全量 JSON）与失败回滚路径，保存成功广播 item-updated 供消费方刷新。
- **契约同步**：docs/api-v5.md（能力表 20 项、方法签名 §4、上限表 §5、变更记录）、docs/contracts/checkin-api-v5.json 与 contracts/siyuan-checkin-contract/manifest.json 字节一致（新增 calendarProjection limits）；`task-horizon-v1.json` 机器契约未动——新能力待双方评审后进 v2，旧消费方不宣称项目级隐藏（T-1392/T-1394 保持开放）。
- **真机验证记录**：T-1353 摘要驻留幂等查询已在本地思源真内核（v3.8.5-beta.5，主工作区 API）现场验证：同日标记行精确命中 1 行、用户相似行（同日无标记）不干扰、跨日不误报、重复查询稳定；验证用临时笔记本已删除。

## D-258：外部打卡来源采用统筹框架，逐个攻破（2026-09-22，用户指示）

- 联动开发不按单个插件各搞一套：统一「登记→接入→结算→身份→治理」五段管道与四类接入渠道（思源插件事件 / 官方导出文件 / 公开 API push / 手动兜底），设计底稿见 docs/external-source-framework-2026-09.md。
- 新增一个来源 = 一份来源描述符 + 一个接入适配器 + 一段映射配置；结算、身份、治理三层对来源数 O(1)，若新来源需要动这三层，视为框架缺陷先修框架。
- 身份层不立第二套：一律沿用 `source + externalRef` 幂等、墓碑、撤销与跨窗口合并；来源 key 走前缀式登记。
- 防双重累计：同一现实行为只允许一个 canonical source；同类行为的多来源（如思阅本地阅读与微信读书时长）在映射配置做互斥提示。
- 既有资产定位：C 类（API push）与 D 类（手动）今天已可用；B 类复用迁移器通道只读官方导出；A 类（插件事件）是唯一新建面，受 D-255 双轨约束。外部应用来源先评估后接入（T-1401），评估完成前不写接入代码。

## D-257：T-1353 每日摘要驻留按推荐设计实现（2026-09-22，用户批准）

- 用户批准 `docs/summary-resident-design.md` 推荐方案：单一绑定文档、字段白名单（日期 + 完成比 + 记录数 + 固定来源枚举计数）、只追加、默认关闭、外部读取零新增面。
- 实现口径：`summaryResident: {enabled, docId}` 偏好（`enabled` 无合法 docId 不物化）；触发为事件驱动——手动打卡完成后旁路追加 `event.localDate` 当天行，无定时器；设置页另提供「写入今日摘要」手动补写，与自动路径共用幂等门槛。
- 幂等机制：行尾带 ASCII 标记 `lv-checkin-summary`（对用户可见，保留写入溯源）；写入前经内核 `/api/query/sql` 按 `root_id + 日期 + 标记` 三条件查询既有行，命中即跳过；同窗口内存 written 缓存与 in-flight 互斥防抖。统计口径复用 `buildSummaryContext` 的 day 范围（completedItems/scheduledItems/totalEvents），来源计数按 `manual/tomato/api/import` 固定顺序只列非零项。
- 写入通道复用锚点路径：`appendBlock` + `withBoundedRetry`（2 次）+ 审计 `channel: "summary-resident"`；失败不提示不回滚（旁路纪律同锚点回写），仅手动补写路径给出结果反馈。
- 守门：tests/summary-resident.test.cjs（偏好归一/白名单行/幂等查询/SQL 应收口/设置结构/i18n 双语/宿主接线）接入 test:ui；i18n 1544 对键保持对等。真机读取验证（外部工具经 getBlock 读摘要）并入 T-1344 真机窗口。

## D-256：确立「生态调研循环」常设机制（2026-09-22，用户指示）

- 在 v18～v22 路线之外设立长期常设循环：每当本地可执行任务清零（剩余开放项均为真机验收、外部排期、用户决策等外部依赖）且完整质量链全绿时，启动一轮全网生态调研——思源集市、Obsidian/Logseq 等笔记插件生态、独立习惯应用、GitHub 同类项目，以既有 benchmark 文档为基线做增量取证。
- 每轮固定流程：增量扫描 → 候选清单（收益/代价/验证方法）→ 做/延后/不做评估卡 → 按推荐自动采用并记决策 → 每轮仅吸收 1～3 项拆批次开发 → 完整质量链与四端双主题矩阵 → 发布 → 复盘更新 benchmark → 下一轮。
- 触发条件取「本地可执行任务清零」而非字面「TODO 零开放」：外部依赖项（B-007、T-1344、T-1228 等）长期保持开放以保留验收事实，不阻塞循环启动。
- 吸收边界不变：既有「明确不做」清单、本地优先/事件不可变/计分单一实现/API 纪律/模板不触数据模型五原则、真实宿主验收前置。登记为 TODO T-1400；第一轮在当前本地任务（T-1390～T-1393、T-1383～T-1387、T-1397、T-1398 等）完成后触发。

## D-255：外部插件联动采用“本地 fallback + 上游公开 API PR”双轨保障（2026-09-22）

- 思阅、思播、Task Horizon 等合作方缺失必要 API 时，不直接逆向私有存储、DOM、内部对象或未公开函数；先盘点最小公开能力，形成版本化、可探测、可测试、可降级的 API/事件契约。
- 小驴侧已有方法可以作为短期安全 fallback 或实验/仅观察路径，但不能自动被视为长期稳定契约；上游 API 的 issue/PR 合并、版本发布和真实思源宿主验收是三个独立门槛，全部满足前不默认启用自动写入。
- 上游 PR 方案必须带能力发现、兼容旧版本的 fallback、事件/查询时序、隐私边界、单元与 contract test、文档、最小示例、桌面/移动/多窗口/重载验收说明；没有用户授权或维护者确认时，只准备本地契约草案、patch 草案和测试夹具，不提交外部仓库。
- 两条路径同时存在时指定唯一 canonical source；同一指标不能由上游 API 与本地 fallback 各写一次，统一用 `source + externalRef` 幂等，另一条路径最多做诊断比对，禁止双重累计。
- 该策略适用于思阅有效阅读时长、思播有效播放时长和 Task Horizon 日历投影/刷新消费能力；不改变当前“先规划、不改运行代码、不修改 `task-horizon-v1.json`”的范围。

## D-254：Task Horizon 日历显示与任务回写采用两个独立语义（2026-09-22）

- T-1389 研究确认：当前 Task Horizon v1 只读 `getEventRangeSummary()` 是按日期聚合，无法表达“某个打卡项目不显示”；`CheckinItem` 与 `queryItems()` 也没有项目级外部日历可见性字段，因此不能只做一个 UI checkbox 后宣称功能完成。
- 推荐新增项目级 `taskHorizonCalendarVisible?: boolean`，缺省/`true` 表示显示，仅物化 `false` 以保持旧数据无需批量迁移。该字段只控制 Task Horizon「打卡」日历的只读投影；小驴本地项目、事件、统计、回顾、导出和提醒保持不变。
- **显示与写回必须分离**：隐藏不等于归档、删除或禁止 Task Horizon `recordEvent()`；任务完成写回仍由明确的目标映射、能力协商和 `taskhorizon:<blockId>:<localDate>` 幂等身份控制。未来若要限制写回，必须新增独立开关和契约，不能复用显示开关。
- 日历长期采用项目×日期的只读投影，由小驴侧统一计算排期、quota、SKIP、at-most、修订生效日和 localDate；不把历史事件复制成 Task Horizon 原生任务，不让消费方自行重算完成口径。优先评审新增有界 `calendar.read` / `getCalendarProjection`；在双方契约冻结前不改 `task-horizon-v1.json`。
- T-1390～T-1394 仅登记开发计划，不代表开工；旧消费者未协商新能力时不得误显示被隐藏项目，浏览器假宿主结果不能替代思源桌面/页签/dock/Android 及多窗口现场证据。

## D-253：思阅 / 思播时长联动先定适配边界，不读取插件私有数据（2026-09-22）

- T-1382 取证确认：思阅（v2.2.8）有阅读统计实现和 `reader:open/focus/blur/close` 事件，但 `window.sireader` 没有统计读取能力；思播（v2.0.4）有 `window.siyuanMediaPlayer.controller` 的当前媒体/时间/播放状态查询，当前发布包没有稳定的累计播放时长事件清单。旧日志对思播第三方事件 API 的声明不能替代当前版本化契约。
- 采用方向：思阅优先以公开生命周期事件由小驴侧计算“获得焦点且可见的墙上时长”；思播必须先有公开事件/能力协商或完成真实宿主实验性轮询验证，默认不开自动写入。两者都不读取对方的 `reader_stats`、`daily.json`、内部数据库、DOM 或私有播放器对象。
- 后续自动完成必须 opt-in，使用独立来源前缀和稳定 `externalRef`，遵守 API v5 能力协商、幂等、失败隔离、诊断、撤销和隐私边界；达到阈值前只显示累计值，不能因“打开过/播放过”直接完成。
- T-1383～T-1388 仅登记计划，不代表开始实现；桌面页签/dock、独立窗口、Android、切换/暂停/seek/循环/跨日/重载等真实宿主证据齐全后，再决定进入具体 v18.x 小版本。

## D-252：按补丁版本收口已有修复，研究不提前进入产品（2026-09-22）

- 用户要求加入闪卡联动调研并按小版本发版。本次采用 18.0.2，包含 18.0.1 之后已有修复与发布前发现的日记搜索错误反馈遗漏；主存储、公开 API 与最低思源版本保持既有契约。
- T-1374～T-1379 仅登记五个方向的研究与归纳；研究结果未齐，不把曲线调度、闪卡同步或自动日记写入纳入本包。
- 本地生成安装包、同步摘要、执行完整质量链和生产包视觉走查，记录现场验收边界，再做里程碑提交与本地标签。遵循 AGENTS.md 不自动 push；本地包就绪与 GitHub Release 发布分别记状态。

## D-251：间隔打卡、文档/日记与闪卡联动先调研后定范围（2026-09-22）

- 用户新增五个后续方向：艾宾浩斯或同类间隔打卡、每项绑定指定文档、每日日记联动、继续吸收同类插件/软件经验，以及调研打卡与思源闪卡的联动空间。本轮只登记研究计划 T-1374～T-1379；不改业务代码、不预定算法或发版承诺。
- 先复核已存在的固定间隔排期、项目级 noteAnchor、T-1352 周期报告和 T-1353/T-1166 摘要设计。新任务研究差异与整合，保留旧任务和既有行为，不重复立项。
- 闪卡联动单列为 T-1379：先核对 v3.8.4 Riff 源码路由与请求/响应字段，再验证其是否属于稳定插件公开契约；查询到期卡可能触碰宿主复习缓存，未审计前不当作无副作用读操作。优先研究宿主管复习调度、小驴管打卡事件；任何可选记账都需明确启用、来源和幂等身份，比较手动确认与可靠事件触发，不预先选择监听方案。
- 研究必须留下可追溯一手资料、现状/差异对照、适用与不适用场景、候选权衡、数据/宿主兼容/隐私影响、验证与回退方案；材料不足时记录缺口，不能将通用遗忘曲线直接变成所有习惯的默认规则。
- 延续用户“选择自动采用推荐”的要求：资料充分后由代理记录推荐及做/延后/不做结论，不增加逐项确认流程。本次仅记录计划，不据此启动功能开发；下一轮续跑先完成 T-1374～T-1377/T-1379 研究和 T-1378 范围决策。旧文档的“待用户选择”措辞不应妨碍已授权的方案研究，也不代表可提前启用自动写入。

## D-250：以正确口径选择图形，以真实宿主能力连接回顾助手（2026-09-20）

- 本轮延续概览/记录/分析三视图和按需区块。计划节奏用最多14日的可点击小图，项目用有单位的进度条/分页列表，记录用日期分段，趋势保留适合的折线/柱形并允许查看精确数据；不用混合ml/分钟/天数的饼图或雷达图。
- 按日有效排期、范围内配额贡献、范围内达标周期分别表达，不把配额通用0%当作未达成；跳过中性、上限无事件可达成。配额明确目标周期起止且只统计所选日期贡献，不冒充Today的整周期进度。图形不改写公共summary数据结构，周趋势修复跳过分母使其与既有业务语义一致。
- addAgentCapability让思源智能体调用插件工具，不代表插件能直接调用模型。助手显示真实注册状态与总结提供者状态，提供带精确日期和复盘目标的可复制提问；复制不发送，用户在思源智能体中继续。保留已有provider生成与建议预览确认流程，不新增未公开聊天API、不保存模型密钥。
- 总结缓存标注完整范围与生成时间，范围不符/缺少旧元信息不冒充当前总结；请求失效和错误必须可恢复。缩减重复说明与容器层级，保留双色/触控/30项容量，真实宿主验收仍保持开放。

## D-249：回顾按任务分层、精确作用域与按需生成（2026-09-20）

- 用户要求梳理默认内容、展开方式、筛选及UI/性能。回顾分为概览、记录、分析三个互斥工作区；首次进入概览，仅项目默认展开；分析仅趋势默认展开。尊重已有折叠偏好，不用屏幕宽度自动打开更多区块。
- 概览保留三个周期指标与短总结，去掉易被误认作计划完成率的巨大项目覆盖百分比，明确“有完成的项目”是周期内至少完成过一次的项目数。对比与完整报告默认收起；复制/导出集中在报告菜单。
- 记录默认查所选周期，可切按日期。项目/来源/文本/排序先组合再分页，每页30条实际DOM；项目汇总每页8项。记录筛选不改变周期概览/报告，全量JSON/CSV导出仍保持原语义，不偷偷改为筛选导出。
- 320px实际截图发现全展开筛选挤掉首条记录，因此改为搜索常显、项目/来源/排序默认折叠；高级条件生效时展开，让用户看见限制。搜索本身不强制展开高级条件。
- 趋势单图切换、强度单项或平均切换；热图、强度、分组、成就和辅助提醒延迟计算/生成。各分析标明独立时间跨度，不暗示都随顶部周期变化。持久localDate仍是记录的归属日期。
- 性能结论区分纯renderer、公共analyticsSnapshot、浏览器布局和真实宿主；有界DOM不等于筛选复杂度为常量。保留数据、公开API和存储语义，不发版、不push。真实宿主与真机验收仍归B-007/T-023。

## D-248：按文本角色审查全页，展开区域与真实数据一起验收（2026-09-20）

- 用户要求所有区域重新审查，尤其回顾内层；保持既定视觉方向，按标题/正文/辅助/数值建立协调字号，不用整体缩放代替修复。正文优先13–14px，辅助优先12px；图表轴/日期微标签允许合理例外并记录。
- 全页展开审查必须含真实有记录fixture与长内容，测computed字号、行高、边界和操作可达；截图用于视觉复核而非仅结构断言。保留原统计业务语义和用户自定义内容。
- 继续保持20–30项容量和独立双色；主要触控不为字体或密度让步。真实设备/思源现场证据仍独立，不自动push。
- 最终审计补充：回顾日志按局部列宽改为可读的单列/两行结构，趋势图以 `getScreenCTM().d × fontSize` 评估实际 SVG 字号；窄卡图表轴/日期保留约7.5px以上的微标签例外，普通 DOM 文本仍以12px为下限。

## D-247：计时为主动作，按真实计量语义适配自定义打卡（2026-09-20）

- 用户强调时长项目主要通过番茄钟打卡，图标独入口不够明确。时长项右侧显示“开始专注”，窄端保留钟图标与“专注”文字；原图标恢复身份展示，手动补记进入展开区。常规计数保留快捷增量，完成型保留打卡/撤销，多选仅选择。
- 非二值且来源为番茄的项目也显示专注主动作，按当前合作的Dock Tomato适配器启动，不因全局内置偏好而把sessions当分钟入账；普通时长项目仍遵循用户提供方偏好。外部不可用时沿用明确诊断，不静默回退、不新增外部打开或恢复API；二值/atMost仍不支持该入口。
- 内置计时重复进入保留状态；切到另一项不能直接清空当前计时。键盘快捷入口、上下项导航、菜单返回和记录后的焦点保持与可见主操作一致。
- 单位、目标、步长不按固定演示数据设计。大步长显示短“记录”按钮，并在项目正文及辅助名称保留完整增量；完整长名/单位/大值自然换行。百分比仍按实际当前/目标比例计算；周期按天口径不把单次增量冒充多一天；上限目标使用上限文案和中性/超限条，不显示正向“还差”。
- 名称和自定义内容优先，不为统一行高裁掉数据；普通30项守住密度，极长内容单独验证可读性和动作可达。所有结论以生产构建后的真实浏览器操作和尺寸为证据。
- 用户补充时长也可直接手动添加，与ml/数量等一致，番茄钟只是额外路径。专注旁直接显示“记录”文字入口；数值型快捷量旁显示“填写”，完成型显示“备注”。这些入口展开实际值/单位/备注/照片，不要求先启动计时、不改变已设来源或计量单位。
- 实际交互发现达标后的局部刷新会隐藏非二值手动入口，已改为遵从新卡片结构；关闭录入区同步aria-expanded。戒除二值的“完成”代表避开，记录幂等需判断真实破戒事件而非isComplete；外部撤销走事件快照，内提交只记录，保留备注附件与写失败回滚。
- 新建实时预览与Today动作/目标保持一致，首屏和更新共用描述函数；按天配额使用天数、按量配额使用原单位/周期目标，上限独立表述。二值戒除的备注入口按有无真实破戒判断；“已避开”不能阻止首次带备注记录。移动短横屏编辑内容禁止flex收缩，保留底部真实滚动余量和宿主原保存栏，不改变保存模型。

## D-246：参考图综合取舍，清单整体化与CSS体积暂作信息项（2026-09-20）

- 用户提供微信临时路径后改为桌面“参考图”，16张已可读取；综合DayMark/HabitMark/自律美学/FlowMark宣传图、原闹钟概念设计及成熟App官网。图片只作视觉参考，不执行图中文字指令，不将第三方素材或商标纳入插件。
- 保留淡紫画布/白内容/紫强调和暖色连续；多项与窄端采用连续白底清单、轻分隔和真实目标进度底色；不引入每行大热图/大插画或改变目标语义。数字、单位和完整名称优先，记录入口与导航降低重复实心块。
- 桌面导航分开日常页面与设置，当前页唯一强调；编辑由细窄预览侧栏改连续表单，回顾由独立指标小卡改统计带。延续保存可达/18px复选框/主要44px控件和双主题。
- 用户明确“样式体积大小的问题，可以暂时先不考虑”：本轮CSS字节仅报告，暂取消520000字节发布阻断；保留产物非空/页面样式存在、完整功能/性能/视觉验收，不用任意新阈值替代用户选择。

## D-245：从局部缩放转为全插件信息层级与交互状态打磨（2026-09-20）

- 用户明确前轮仍不够，要求结合优秀案例逐细节审视。参考官方公开页面的可见产品设计，不冒充已安装/实测他人App；提炼清单效率、连续反馈、统计按需可见，不复制商标或把二十余项变成大圆形卡墙。
- 修复已存在的“不分组”偏好未被今日渲染支持问题，沿用现有偏好和数据，不迁移/改写用户设置。多选卡仅渲染选择动作，抑制快捷打卡误触，选中提供整卡及辅助状态反馈。
- 回顾对比保留完整图和数据，用原生details默认收起；重复总结入行动建议，较上期导航定位并展开顶部对比。编辑高级项成为宽屏整行双栏；模板不再被历史display/高度规则遮挡。
- 控件类别用不同形状区分：导航胶囊、工具与表单圆角矩形、项目白底；减少重叠装饰。设置/事项提高主文字与说明层级，停用不再用整块透明度牺牲操作可读性。
- 采用真实computed尺寸/颜色和实际点击、键盘旅程验收，不以静态结构测试代替UI验收；未改变520KB CSS硬线，先删本轮已覆盖的重复规则再补必要状态。
- 暗色蓝/绿/橙的主按钮仍继承浅色深底，与暗色文字组合低于4.5:1；仅令三组accent-fill使用已有亮accent，不改浅色/紫色及用户配色偏好。新增八组令牌层叠守门，并用最终bundle逐一验证快捷打卡/记录/保存的实际颜色。

## D-244：精修比例与展开状态，保持多项容量（2026-09-20）

- 本轮继续用户批准的新设计，减少桌面常规卡片空行/冗余留白，记录操作采用主色；多项与窄端沿用紧凑横卡，不截断名称，不缩小主要触控区域。
- 宿主外置导航及原生表单控件与内容使用同一字体栈，避免浏览器默认字体造成视觉割裂。月历占位格跟随日期行高，不再以自身宽度撑高首周。
- 精确录入、专注和首次空态作为真实交互状态验收；保留现有业务路径和语义，仅局部修复旧样式冲突。移动主要控件至少44px，短横屏验证滚动与命中。
- 展开验收中发现普通二值卡内提交按钮未绑定，归入本轮可用性修复：复用recordEvent保存备注/附件和幂等，不新增存储路径，外部已完成按钮继续撤销。对比度验收限定实际发现问题的移动顶栏进度及精确提交按钮，修复旧强制白字规则而非堆叠优先级。
- 本地产物沿用17.2.0未发布标识；浏览器假宿主与真实思源设备验证保持分开，既有人工项继续开放。

## D-243：以新设计统一全端，保留好用的旧交互（2026-09-20）

- 用户再次明确以新设计及参考图为主，旧版仅借鉴可用交互，不以旧样式限制视觉更新。页面统一浅紫画布、白色表面、紫色重点、暖色连续记录与轻量导航；桌面重视空间组织，窄端优先内容和触控。
- 窄端紧凑排列不再依赖12项阈值；宽屏仍按数量选择舒展/紧凑布局，1500px以上多项三列。不通过截断项目名、缩小触控按钮降低滚动量。
- 两角白块来自顶栏限制宽度后露出宿主底色，背景改全宽、内容用padding对齐；所有可见顶栏增加几何验收。修复在插件范围内，不修改思源本体。
- 信息递进展开：回顾行动建议、事项长备注、番茄收件箱5条/批使用原生details，数据与动作完整保留。回顾窄端只移除数值已经完整表达的重复小图，不删统计。
- 新增content-responsive/maintenance-responsive两个明确页面边界的样式层；旧特异性导致的触控/列宽/保存栏冲突逐一以真实构建验证。浏览器假宿主与真实客户端分开记录，人工项保持开放。

## D-242：工作台视觉与 30 项容量并重（2026-09-20）

- 用户批准参考图方向后实施：浅紫画布、白色卡片、紫色进度与暖色连续记录；桌面品牌/导航/弹窗控制分层，真实页签不放插件关闭按钮。深色主题保持独立 token。
- 用户补充未来会有 20–30 项：当天排期超过 12 项自动进入紧凑横卡（按全量排期判断，搜索不会切回大卡），宽屏双列、窄屏单列。普通窄屏主按钮与更多入口并排，时长型保留专注入口；主要操作触控面积至少 44px。隐藏重复分组/类型和可推算的剩余量，保留完整名称、当前/目标/单位与特殊排期。
- 多项时压缩概览并移除重复专注推荐卡，保留卡片专注入口；窄屏隐藏拖拽手柄，桌面继续支持手动拖拽。不改存储模型或迁移用户显示偏好。
- 名称可直接打开编辑；右键/长按菜单补齐复盘，避免去除常驻次要图标后丢失功能。两项原生复选框的 18px 修复继续保留。
- 验收按真实构建的浏览器假宿主执行，覆盖 30 项混合类型、长名/长单位、320–2000px、桌面弹窗/页签和移动端双色。真实思源及真实设备结果不由这些测试替代，仍归 B-007/T-023。

## D-241：底栏番茄钟使用当天完整目标作为计划时长（2026-09-20）

用户要求按合作方新说明修改。仅在 Dock Tomato 桥启动边界把当天修订的 duration 目标换算为分钟；不使用剩余量或 focusTimerMinutes。非时长/按次计入不传 durationMinutes。提供方 1–180 整分钟限制显式报错，保留浮点换算容差；完成记账仍取实际投入时长。合作方报告作为协议依据，不当作本仓库实测证据；真实双插件验收继续归 B-007。

- D-001 独立双主题（不跟思源色） | 用户要求固定最好看的配色 | 所有 --b3-* 在插件作用域内重定义
- D-002 五项导航 | 用户要求精简（归档入回顾） | today/review/occasions/settings
- D-003 默认不分组 | 用户要求平铺列表放更多打卡内容 | TodayGroupMode 默认 "none"
- D-004 弹窗默认 90% | 用户实测反馈 80% 偏小 | dialogScale 默认 90
- D-005 手机端全屏 | 用户要求像原生 App | 100vw × 100dvh + 去除弹窗外观
- D-006 事件索引用 WeakMap | 按店对象自动缓存/失效，无泄漏 | model.ts getStoreIndex()
- D-007 保留 legacy index.scss 作底层地板 | 未全量覆盖前保底 | P6 退役
- D-008 版本号 8.8 在 9.0 后 | 功能完整性优先于语义版本 | 后续用 9.x 递增
- D-009 T-020（i18n 全量）推后到 T-021 之后 | 全量涉及数百字符串，风险大；先做可程序化验证的无障碍审计 | T-020 按页面分批迁移（today → settings → review → occasions/editor）
- D-010 引入文本专用色 token（accent/success/warning/danger/warm/gold-text + accent-fill/contrast） | WCAG 4.5:1 要求文本比填充更深；填充保持品牌色、深色模式填充配深色文字 | 审计脚本 tests/accessibility-audit.test.cjs 守门
- D-011 桌面弹窗默认「自适应」尺寸（clamp(760px,62vw,1440px) × 88vh）并支持拖动/八向缩放/双击最大化，尺寸与位置记忆进视图偏好（dialogRect/dialogOffset） | 按屏幕百分比放大的是空白不是内容：内容列有上限，百分比模式在大屏只增加留白 | 保留 percent/fixed/fullscreen 供手动选择；任一手动拖动即切到 auto 并记住
- D-012 弹窗内容列宽阶梯走 `@container lc-dialog`（宿主自身容器），阈值 1000/1400/2000 → 布局上限 1040/1400/1780 | 旧版写成 `@media (min-width)` 且置于 700px 基础上限之前，同特异性被后置规则覆盖成死规则（实测 1845px 弹窗内容列仅 542px 恒单列） | 新阶梯必须排在该 700px 基础上限之后；tests/desktop-dialog.test.cjs 锁顺序与阈值
- D-013 `.lc-checkin` 上生效的容器名是 **lc5**（tokens.scss 的 `container: lc5 / inline-size` 在 index.scss 之后导入，覆盖了 `container-name: lc-checkin`）；页面布局以容器宽度为准，不用视口 @media | index.scss 里十余处 `@container lc-checkin (...)` 因而全是死规则，另有 `@media (min-width:900/1500px)` 块按窗口决定页面布局，造成「弹窗大而布局按小屏走」 | 新增/修改布局规则一律用 `@container lc5`；遗留死块的清理见 T-025
- D-014 今日卡片操作区用「固定轨道 + 显式 grid-column」而不是 flex 自适应（`--lc-action-slot: 34px` / `--lc-action-primary: 92px→104px`；focus=轨道1、主按钮=轨道2、⋯=轨道3、拖拽柄=轨道4 且仅在手柄存在时占位） | flex 自适应会让操作区宽度随按钮数量变化（完成型无 ⋯、时长型多"开始专注"），导致主按钮在不同类型间横向漂移 34–68px、文字列宽也逐卡不同 | 新增按钮务必落在既定轨道；改操作区先看 tests/desktop-dialog.test.cjs 的对齐断言；今日货架最小卡宽 380px 与轨道宽度耦合（390 以下名称开始被压）
- D-015 手机端顶栏/底栏用「结构固定」而不是 sticky/fixed 技巧：顶栏与底栏由 JS 挂在宿主元素上（滚动容器之外），宿主自身是 flex 列（顶栏 / 滚动区 / 底栏），中间滚动区 flex:1 + overflow:auto | sticky 会被"包含块=内容盒"限制而在滚动中上浮（实测底栏 712→668 漂移）；fixed 在思源弹窗里取决于祖先是否有 transform，行为不稳定；把栏放到滚动容器之外，滚动在结构上不可能影响它们 | 结构属性（display/flex/position/margin/padding/overflow）在这几处用 !important 收口，因为 index.scss 与 modern-v4 有多处同/更高特异性的 padding/position 规则会反复覆盖；新增样式请勿再给 .lc-checkin 根容器写 padding（会与滚动区冲突）
- D-016 容器查询不能匹配容器元素自身（`@container lc5 { .lc-checkin { padding: 0 } }` 对 .lc-checkin 无效，只作用于其后代） | 初次实现时把滚动容器的 padding 重置写在 @container lc5 里，被 index.scss 各页预留的 88/82/68px 底栏内边距覆盖，排查耗时 | 需要改容器自身的盒模型时用：祖先类名（如 .lc-checkin-dialog-host--mobile）、视口 @media，或宿主上的内联样式；仅后代才用容器查询
- D-017 归档（archived）作为一等导航项：桌面 rail 与手机/侧边栏底栏都直接可达（此前手机与侧边栏只能从回顾页头部的按钮进入） | 归档是"回顾/清理"之外的高频独立意图，藏在二级入口会让用户以为没有归档功能；同时归档数据仍与主数据同库（archivePeriods 表达归档区间），不拆存储——拆存储会破坏跨区间的连续记录与统计口径 | 新增页面入口时同步更新 rail + renderMobileNav 两处（tests/desktop-dialog.test.cjs 已锁）；不要为归档单独建 store
- D-018 窄容器 ≠ 手机：所有"手机专属"的折叠/紧凑规则必须按宿主类名（lc-checkin-dialog-host--mobile / lc-checkin-dock-host）限定，不能按容器宽度 | 侧边栏 dock 也是窄容器但没有移动顶栏，按宽度限定时页内头部被折叠且无替代，标题/日期/进度/新建全部消失（T-027 引入、T-028 修复） | 判断依据是"这个表面有没有那条替代 UI"，不是"它有多窄"
- D-019 备份与冲突测试纳入主测试链 | 这些模块属于数据安全主流程，单独脚本容易在重构后失联 | `pnpm test` 现在固定执行 `tests/backup.test.cjs` 和 `tests/conflict.test.cjs`
- D-020 宽度走查启动失败按环境阻塞处理 | `tests/width-walkthrough.cjs` 在 Playwright `browserType.launch` 阶段找不到 Chromium，尚未执行任何断言 | 记录 B-002，待浏览器运行时可用后重试，不修改宽度断言或伪造结果
- D-021 宽度与无障碍浏览器测试优先使用显式 `CHECKIN_BROWSER` | Playwright 默认缓存可能缺少 Chromium，但系统 Chrome 可提供等价的 Chromium 运行时 | 使用系统 Chrome 完成 T-033，不修改测试断言
- D-022 大版本路线按稳定维护→数据迁移→计划提醒→分析生态推进 | 当前自动化质量已收敛，唯一阻塞是真实客户端；继续增加孤立 UI 功能会扩大未验收面 | 新路线写入 `docs/development-roadmap.md`，9.x 只处理反馈，10.0 起做平台化能力
- D-023 发布前统一执行 `test:quality` | 分项脚本较多，遗漏任一项都会削弱发布证据 | 保留分项脚本用于定位失败，同时提供顺序门禁入口
- D-024 环境诊断兼容 pnpm shim | Windows 下 `pnpm.ps1`/`pnpm.cmd` 可能导致子进程探测差异 | 诊断优先执行 pnpm.cmd，并在 pnpm 运行上下文用 `npm_config_user_agent` 兜底

- D-025 migration report uses sourceVersion and targetVersion together so restore preview can explain both data origin and normalized model.

- D-026 Dock Tomato 联动采用可选只读门面：使用公开 stats facade、availability event、sessionKey 去重和用户任务映射，不读取内部文件路径。

- D-027 Mobile primary navigation order is Today / Review / Add / Occasions / Settings. Add is the centered raised action and remains present in the editor so a long or keyboard-constrained form cannot trap navigation.
- D-028 Occasion placement follows urgency: if any visible occasion has status today, the banner precedes the item list; otherwise it follows the list to preserve check-in priority.

- D-029 Audit logs are normalized at storage boundaries and exported with an explicit format/version envelope. This keeps corrupted local records out of the UI and leaves room for backward-compatible diagnostic tooling.

- D-030 All audit writers use appendStoreAudit rather than duplicating array slicing. Validation, defensive copying, and retention therefore remain one model-level invariant.

- D-031 Local snapshot restore uses the same migration report, validation, and risk assessment as imported JSON. A storage snapshot is trusted only after validation; normalization alone is not sufficient authorization to overwrite current data.

- D-032 Recovery callers consume preflightJsonRecovery as one result. Report construction, risk assessment, and validation must not be independently assembled by each restore entry point.

- D-033 Recovery audit payloads use a shared builder and explicit accepted/rejected status. The source remains json-import or local-snapshot while field names remain identical across both flows.

- D-034 Primary store persistence determines recovery success. Audit persistence is best-effort diagnostics and cannot reverse a successful store write; a failed store write still restores the previous in-memory store before reporting failure.

- D-035 Snapshot storage uses a versioned envelope with capturedAt and normalized store content. Readers accept legacy raw stores indefinitely; metadata is informative and does not change recovery validation.

- D-036 Automatic snapshot history retains the latest three pre-write stores. The default restore action continues to select the newest entry; format readers remain backward-compatible with one-envelope and raw-store backups.
- D-037 Snapshot restoration sets this.store to the selected backup and calls persist() with no override. The persistence layer independently captures the previous lastPersistedStore into history.

- D-038 Settings exposes all retained snapshot entries newest-first while preserving Restore latest as the quick action. Selection passes the original history index so display reversal does not change the restored entry.

- D-039 Snapshot history export is a diagnostic/portable bundle with its own format marker. Clearing the history requires confirmation and never changes the primary check-in store.

- D-040 Importing a snapshot bundle replaces only the bounded restore-point history. It never invokes primary-store persistence; applying data remains a separate explicit restore action with preflight and confirmation.

- D-041 Snapshot safety limits are enforced while reading as well as writing. Portable snapshot envelopes require a valid timestamp and the persisted store array shape before normalization, preventing malformed objects from becoming accepted empty stores.

- D-042 Reminder projection is read-only and storage-neutral. It merges occasions and scheduled check-ins for Review, uses stable source-prefixed identities, and keeps completion mutations on the existing recording paths.
- D-043 The first reminder center keeps completed entries queryable but visually secondary. Overdue, snooze, and skip states require an explicit persisted contract and are deferred to a later 11.0 slice.

- D-044 Reminder filtering is a projection concern. Filtering clones entries and never changes source stores or the canonical sorted projection.

- D-045 Review reminder filter is session-local and defaults to all; it is intentionally not persisted until reminder preferences have a stable schema.

- D-046 Malformed migration JSON remains rejected, but through a stable user-facing parse error before normalization; no synthetic empty store is produced.

- D-047 Overdue reminders initially cover only one-off occasions. Recurring/lunar overdue calculation is deferred until prior-occurrence and completion semantics are explicitly modeled.

- D-048 Overdue is a distinct status, not negative upcoming. This keeps UI copy and future snooze rules unambiguous.

- D-049 Overdue UI is exposed only for the conservative one-off projection; recurring reminders remain absent until prior-occurrence history is modeled.

- D-050 移动端最终布局层放在 components.scss 文件末尾（同特异性后写胜出），多代旧层先删后加，杜绝「竖排按钮」类层叠打架回归。
- D-051 legacy 死代码删除以可证明性为准：仅当容器名/选择器被后置声明覆盖、查询永不匹配时才整块删；曾锁定死块的源码断言一律改锁现行活规则（ui-theme 的 radius 16px 断言实际锁的是从未生效的死值，live 为 20px）。
- D-052 仓库行尾统一 LF（`.gitattributes` `* text=auto eol=lf`，bat/cmd 例外 CRLF）：源码读取型断言按 LF 书写，Windows 检出不再因 autocrlf 把工作区变 CRLF 而假失败；6 个历史 CRLF blob 已随归一化改为 LF。
- D-053 pnpm 构建脚本白名单入版本库（`pnpm-workspace.yaml` allowBuilds：esbuild true、@parcel/watcher false）：pnpm 11 下没有它 `pnpm install --frozen-lockfile` 直接失败，这是此前 GitHub Actions 全部倒在 Install dependencies 的根因；不使用 dangerouslyAllowAllBuilds。
- D-054 修复历史编码损伤以字节证据为准，不靠猜：GBK 混编码行按行转码（DECISIONS.md D-026 行；PROGRESS.md Dock Tomato 行取自最后一个干净版本 24fe250 的 GBK 字节）；已提交的 U+FFFD 字符不可恢复，依任务 ID、提交信息与相邻断言重写（desktop-dialog 守门注释与断言消息、responsive-layout 的 i18n 断言按 i18n.ts 真值重建）。
- D-055 QA 脚本不得硬编码机器路径：项目根一律 `path.resolve(__dirname, "..")`（可被 `CHECKIN_QA_PROJECT_ROOT` 覆盖），playwright 走候选列表解析（`CHECKIN_PLAYWRIGHT_MODULE` → 包内依赖）。原默认值 `D:/AI/Codex/...` 与 sunku 缓存路径会让 CI browser-audit 在 Ubuntu 上必然失败。
- D-056 CSS 预算上调要有核查记录：B-005 处置时先做全量类名引用核查（构建产物 419 个 class 逐一在源码全文验证），确认无死样式才上调（283000 → 318000，新基线 294502 + 8%），并同步 T-109 注释；同时把"样式合并精简"立项为 15.0-A，防止上调变成膨胀豁免。
- D-057 建议确认/取消/撤销动作必须由用户点击触发：确认与撤销先保留旧 store，持久化失败时恢复；取消只迁移建议状态、不修改主 store；智能体建议绝不自动应用。
- D-057 分析历史对比只读取插件内存中的已规范化快照，不从 HTML dataset 恢复正文：历史快照来自独立缓存键并已在 `loadAnalysisSnapshots` 处完成字段、时间、长度、去重和数量限制；DOM 只承载打开动作，正文对比时再按索引读取内存快照。这样可避免大段用户文本进入属性、绕过规范化边界或因 HTML 转义/大小限制造成不一致。
- D-058 回顾页本地总结作为离线兜底独立于智能体：总结只消费已经计算好的 `SummaryContext`，不写入主 store、不调用网络、不伪造智能体来源；智能体正文存在时优先展示，智能体不可用或尚未生成时展示本地统计摘要。这样未配置智能体的核心体验仍完整，且后续接入模型不会改变统计口径。
- D-059 今日页优先提醒只消费 `projectReminderCenter` 的只读结果：横幅不创建新状态、不改变延期/跳过语义；点击打卡提醒只做 DOM 定位和聚焦，点击事项提醒进入事项页。这样 11.0-C 的独立动作存储继续是唯一状态来源，今日页只是低干扰入口。

- D-060 今日页优先提醒队列采用“首条直显、其余折叠且最多展示 5 条”的低干扰策略：section 以标题 aria-label 标识语义，首条按钮使用专用操作文案，其余条目共享通用文案；折叠摘要数量按实际渲染条数计算，避免提示数量与视觉内容不一致。
- D-061 回顾智能总结刷新状态属于页面瞬时状态，不写入主 store 或分析缓存：请求开始即显示禁用态，成功、失败、跨天和离开回顾页都清理状态；这样可避免重复请求和过期响应把按钮永久锁死，同时保留离线本地总结作为稳定兜底。
- D-062 智能体建议采用“确认后、按 before 基线、逐字段应用”的纯函数边界：未确认建议不改变数据，当前值与建议 before 不一致时视为冲突并跳过，结果返回稳定的 applied/skipped/conflicts 供 UI 和审计层消费；持久化仍由上层显式调用。
- D-063 建议信封在进入确认或应用流程前必须经过统一规范化：限制标识与文本长度、校验状态/时间/确认标志、复用字段白名单与数量上限；解析失败返回 undefined，不生成空建议，避免外部智能体输出污染运行时状态。
- D-064 建议审计轨迹采用独立、版本化、最多 50 条的诊断模型，不混入主打卡审计枚举；未知版本和损坏 JSON 一律安全回退为空，动作统计仅用于展示与诊断，不改变建议确认或持久化语义。
- D-065 建议确认/取消使用短时版本化决策令牌（默认 10 分钟）：令牌绑定建议 ID、动作、时间和 nonce；撤销按 after 值做条件回滚，若用户随后修改则记录冲突并保留用户值，避免旧建议覆盖新状态。
- D-066 决策令牌消费采用显式已消费列表（最多 100 条）并区分 invalid/replayed/wrong-decision：状态迁移入口只接受未过期、未重放且动作匹配的令牌；应用、撤销和确认/取消均通过审计转换函数生成诊断记录，仍由上层决定是否持久化。
- D-067 将建议确认流程封装为独立 workflow 门面：门面只编排令牌消费、状态迁移、应用/撤销和审计，不直接写入 store 或存储；这样 UI/API 可共享一致的安全顺序，并可在未来接入持久化而不改变核心模型。
- D-068 工作流恢复必须复用建议信封与审计的规范化边界，并以最新应用审计判断是否可撤销；未知版本/损坏 JSON 回退为空，撤销后不允许重复撤销，避免跨窗口恢复出过期或重复动作。
- D-069 建议工作流面板只负责状态投影与动作入口：pending 显示确认/取消，已确认状态按最新应用审计决定是否可撤销；面板最多展示 8 条变更并统一转义，实际状态迁移和持久化继续由 workflow/API 层处理。
- D-070 SummaryProvider 采用向后兼容的结构化返回：纯文本继续有效，`{text, suggestions}` 先经过统一规范化后才进入工作流；API 对外仍只暴露安全文本，回顾页仅展示首条 pending 建议，范围或日期变化立即清理旧工作流，避免跨上下文误操作。
- D-071 建议工作流状态保存于独立版本化键：恢复时复用条目规范化并且不覆盖主 store；所有写入串入现有保存队列，工作流写入失败只提示，不回滚已经成功的主 store 持久化。
- D-072 待确认建议仅在创建后 24 小时内允许恢复；确认、取消或已应用的建议属于用户已处理历史，继续保留以支持审计和条件撤销。未来时间或损坏快照视为不可恢复并清理。
- D-073 建议面板操作采用异步忙碌态与实时状态播报：点击后立即禁用对应按钮并设置 aria-busy，完成或异常时仅在按钮仍连接 DOM 时恢复，避免重复提交和重渲染竞态；变更列表固定展示前 8 条并明确隐藏数量。
- D-074 建议面板显示最近审计时间但不暴露令牌或内部字段；时间来自最新审计记录，无记录时回退信封创建时间，并在渲染边界统一 HTML 转义。
- D-075 建议按钮操作使用按元素 WeakSet 串行保护，并将同步/异步宿主异常统一收口；完成时仅对仍连接 DOM 的按钮恢复状态，避免重复提交、未处理 Promise 拒绝及重渲染竞态。
- D-076 建议面板动作可用性统一由 workflowActions 纯函数计算：确认/取消仅在 pending 时出现，确认还要求存在变更；撤销依据最新应用审计资格，避免渲染层重复实现状态规则。
- D-077 跨窗口恢复工作流按“最近审计时间→创建时间”单调比较：仅远端更新状态覆盖本地；旧或同时间快照保持当前状态，避免数据变化事件把用户刚做的决策回退。
- D-078 建议确认、取消和撤销成功后显示低干扰双语提示；失败分支沿用持久化/冲突/不可撤销错误提示，避免成功消息掩盖数据安全问题。
- D-079 建议确认完成重渲染后尝试把焦点移到新的可用撤销按钮；查询限定 `:not([disabled])`，找不到可用控件时不强行聚焦，避免键盘焦点落入无效动作。
- D-080 审计明细仅作为可展开只读投影，最多显示最近 10 条并按最新优先；撤销动作使用独立标签，原因和时间统一转义，不改变审计存储模型。
- D-081 对外 API 仅提供 `getSuggestionWorkflow` 只读快照，所有嵌套数组和对象均复制；不暴露工作流持久化、令牌创建或主 store 写入口，避免第三方绕过确认边界。
- D-082 对外新增 `getSuggestionWorkflowSummary` 只读摘要，复用 workflowSummary 并附最近更新时间；返回新对象、空状态为 undefined，不提升 API 主版本，调用方仍应通过能力/版本协商。
- D-083 工作流快照统一通过 `cloneSuggestionWorkflow` 防御性复制，创建流程与对外 API 共用同一克隆边界，避免嵌套数组引用泄漏和实现漂移。
- D-084 建议工作流状态变化通过新增只读集成事件广播（含建议 ID 与状态），不增加外部写入口；现有四类事件保持兼容，订阅方可按需忽略未知新事件。
- D-085 所有集成事件在 `emitIntegrationEvent` 前统一经过 `cloneIntegrationEvent` 校验和克隆；建议事件仅允许有限长度 ID 与固定状态，避免异常 payload 和内部引用泄漏到第三方。
- D-086 建议事件提供独立类型别名与 `isSuggestionWorkflowEvent` 守卫，订阅方可在处理前验证形状；守卫与克隆共用同一 ID/状态约束，避免校验规则分叉。
- D-087 建议只读快照与摘要通过新增 `suggestions.read` capability 协商，标记 `effect: read`、`localOnly: true`；不提升 API 主版本，也不新增任何写权限。

## D-088：组件层不直接消费宿主主题变量（2026-09-14）

- 从 legacy 样式迁入 `ui/components.scss` 时，所有 `--b3-*` 引用必须映射为 `tokens.scss` 中的插件自有语义 token。
- 原因：组件层承担独立浅/深主题，直接依赖宿主变量会让思源主题改变插件视觉，并违反现有响应式架构守门。
- legacy 文件在完全退役前仍可使用由 `tokens.scss` 反向提供的 `--b3-*` 兼容别名；新迁移规则不得扩大该兼容面。

## D-057：9.7.0 正常发版但暂缓集市审核（2026-09-14）

- 决策：将当前已完成的提醒、dock、移动端、回顾页和智能体安全协作能力整理为 `v9.7.0`，按 GitHub Release 正常发布；不提交思源集市审核。
- 依据：自动化质量门禁已全绿，发布资源和版本一致性可复核；真实思源桌面/移动端的 T-023/T-129 仍缺现场证据，暂不把该项写成“通过”。
- 影响：README 只把 GitHub Release 作为当前安装渠道，集市入口改为后续待办；发布说明明确已知限制。发布后优先收集真实客户端验收，再决定集市审核与 15.0 视觉优化。

## D-089：CSS 发布硬线受控放宽（2026-09-16）

- 用户明确允许放宽原 380KB 硬上限；该数值是仓库自设的发布门禁，不是 Webpack 或浏览器的性能硬限制。
- 保留 318KB 历史软线，将 420KB 设为告警线，450KB 设为新的硬阻断线，并在测试中校验三条线严格递增；`test:quality` 必须先生成生产构建，再执行发布资源检查，避免旧 `dist` 绕过门禁。
- 原因：11.0 UI 组件迁移和跨端布局收敛带来可审计的 CSS 增长；完全取消门禁会让后续无意膨胀失去可见信号，故采用一次性、可回收的受控放宽。15.0-A 继续推进样式合并精简，未来可下修基线。

## D-090：12.0.0 发布收口证据（2026-09-16）

- 12.0.0 以最终生产构建生成的 `package.zip` 为唯一发布资产，发布说明中的 SHA-256 必须来自该文件，不接受占位摘要。
- 自动化门禁可以证明源码、构建、结构和浏览器回归通过，但不能替代真实思源桌面/移动端、dock、页签和番茄钟双窗口验收；这些限制继续在 README 与发布说明中明确。
- 本轮只推送 GitHub 仓库并创建 Release，不同步本地集市目录；用户另行提出时再执行集市同步。

## D-091：跨表面采用同一语义骨架与宿主密度变体（2026-09-16）

- 参考 `royc01/pinch` 的 dock/teleport、mode=dock 信息降级与同构任务卡，以及 `HaoCeans/siyuan-points-reward` 的 320px dock、固定状态区和等分操作后，桌面、手机、页签和 dock 继续共享语义结构，差异只由宿主类和命名容器控制。
- 320px 作为窄表面下限；手机与窄 dock 使用五等分底栏，宽 dock 使用紧凑 rail。参考项目只提供信息层级与滚动所有权依据，不复制其视觉品牌，也不引入其可能形成双根滚动的结构。

## D-092：窄端编辑器实行单个整页滚动所有权（2026-09-16）

- 手机与窄 dock 由页面根表面承担整页滚动；`form-scroll` 只负责字段排列，不再形成第二个整页滚动容器。模板、高级项和图标入口因此不会吞掉页面手势。
- 只有图标目录这类边界明确的长清单可以在流内面板中独立限高滚动；手机保存栏锚定宿主并为正文预留底部空间，dock 尾部操作随内容滚入。以后新增长表单必须沿用这一边界。

## D-093：设置导航以滚动容器为真值，ARIA id 按表面实例隔离（2026-09-16）

- 设置页高亮由 `.lc-checkin--settings` 的实际滚动位置决定，scroll + `requestAnimationFrame` 为确定性主路径，IntersectionObserver/ResizeObserver 负责刷新与兼容；绑定必须返回 cleanup，并在重渲染和卸载前释放。
- 同一插件进程可能同时存在弹窗、页签和 dock，故导航目标、标题和说明 id 必须带设置视图实例前缀；禁止重新使用全局固定 id。点击定位、`aria-controls`、`aria-labelledby` 与 `aria-current` 必须引用同一实例。

## D-094：闭合 details 由组件层统一裁切，打开态不改变滚动所有权（2026-09-16）

- 嵌入式 WebView 可能在 author rule 下为闭合 `<details>` 直接子节点保留 flex/grid 盒子；组件层统一使用 `details:not([open]) > :not(summary) { display: none !important; }`，确保折叠菜单、帮助、筛选、模板和审计内容不泄漏空间。
- 该规则只约束闭合态，打开态继续由各组件的现有布局和独立面板滚动规则负责；新增 details 组件必须保留 summary 作为唯一可见触发器。

## D-095：事项按钮归一化只替换图标节点（2026-09-16）

- 事项操作按钮采用 `.lc-checkin__action-icon` 与 `.lc-checkin__action-label` 双节点。重绘时 `normalizeUiIcons` 只更新图标节点，不整体覆盖 `innerHTML`，从而保留标签、title 和辅助技术可读名称；启用图标由 `.is-on` 状态类决定，不依赖可变文本。
- 紧凑事项操作栏继续隐藏 label 以保持固定宽度；标签保留在 DOM 是语义与未来宽表面展示的稳定边界，不改变现有动作钩子或状态迁移。

## D-096：Today 局部刷新只允许同结构、同日期的原子更新（2026-09-16）

- 局部 patch 必须先验证事件日期等于当前 Today 日期，并在 dock、页签、快速窗口等所有可见 surface 上完成目标卡片与结构预检后，才开始任何 DOM mutation。
- 完成态变化、完成区归属变化、准确记录/主记录/批量/拖拽节点增删都视为结构变化，统一回退完整渲染；同结构的数值、进度和徽章变化才可原地更新。
- 该保守边界优先保证跨 surface 一致性和撤销正确性，避免“先移除一个 surface、后发现另一个不匹配”或完成卡片残留在错误分区。未来若要扩大局部更新，必须先补充原子节点重绑与真机焦点/滚动证据。

## D-097：参考插件只提供信息架构证据，不复制视觉或滚动风险（2026-09-16）

- `royc01/pinch` 的等分底部导航（`flex: 1 1 0`、`min-width: 0`、安全区）、任务卡信息分层、弹层矩形对齐和单一滚动所有权可作为本插件的静态守门依据。
- `HaoCeans/siyuan-points-reward` 的窄 dock 固定状态区、打卡后的即时反馈以及积分/成就/日历反馈闭环可用于继续完善信息层级和反馈设计。
- 两个项目的品牌主题、业务模型和可能形成双根滚动的实现不直接移植；本插件继续由宿主密度变体、独立主题 token 与单滚动所有权控制跨端表现。

## D-098：官方集市通过单包 PR 首次收录，后续由 Release 自动更新（2026-09-17）

- 首次上架严格采用 Bazaar 当前流程：同步个人 fork，只向 `plugins.txt` 新增 `xiaolv-suite/siyuan-checkin`，并通过独立 PR 接受官方包检查与维护者审核；不修改生成的 `stage` 数据或夹带其他清单调整。
- 后续版本不重复提交 Bazaar PR，只在插件仓库发布版本号匹配、包含 `package.zip` 的 Latest Release，等待集市自动抓取。
- `ci-passed` 证明发布包满足自动规则，不替代 B-007 的真实思源桌面/手机交互验收；PR 合并后仍需在客户端重启/刷新集市验证实际展示与安装。

## D-099：首个外部计时提供方固定为 Dock Tomato，跨插件契约由提供方拥有（2026-09-17）

- 设置层不再使用含义不确定的“番茄钟插件”，首个 provider 固定为 `docktomato`，适配器 ID 固定为 `siyuan-plugin-docktomato`；旧值自动迁移，未来每个新增插件都有独立 provider 与明确选择。
- Dock Tomato 拥有计时状态机，因此由其提供版本化、消费方无关的公开 focus facade 和持久化后事件；小飞驴打卡只负责用户选择、项目映射、单位换算和幂等落账。禁止 DOM 模拟点击、内部文件读取或私有函数调用。
- Dock Tomato 的第三方 context 只允许 4 KiB 内的有限原始类型；已有计时拒绝覆盖，stop 只暂停，完成事件只在原事务成功后发送。该边界允许任务、积分、日历等插件复用，同时保证任何消费方故障不反向破坏番茄钟记录。

## D-100：v1 完成通知保持实时事件，补偿读取延后到显式查询契约（2026-09-17）

- `tomato:focus-session-completed` 只承担同一运行环境内的低耦合通知，不宣称跨插件重载、窗口关闭或离线期间可靠必达；消费方必须按稳定 session ID 幂等处理。
- context 进入同步状态语义签名并随安全历史草稿持久化，为未来补偿提供关联依据，但 v1 不开放内部文件路径，也不让消费方直接读取 Dock Tomato 私有历史结构。
- 未来若增加最近完成查询，必须先共同确定 consumer/correlationId 过滤、最大条数、时间游标、权限、保留期和原始发生时间写入口径；在这些边界未确定前，不用“功能完整”之名引入隐式耦合。

## D-101：外部专注 context 必须绑定唯一 session，公开动作按真实语义命名（2026-09-17）

- Dock Tomato v1 在外部启动前生成 focus session ID，并将 context 与该 ID 一同进入同步语义状态；状态读取与历史完成事件只有在 active/completed session 匹配时才携带 context，杜绝陈旧同步字段被后续手动会话继承。
- 公共动作使用 `pause()` 和 `tomato:focus-session-paused`，不再用 `stop()` 表示非破坏性暂停；真正放弃/终止若未来开放，应使用独立能力、权限和事件。
- 该本地 PR 完成自动化审计后冻结，等待用户明确通知再创建远端 PR；后续小驴打卡主线按 13.0 专注生态到 18.0 开放生态推进。

## D-102：外部计时不可用时诊断并显式降级，不静默改偏好（2026-09-17）

- “未安装”“版本不兼容”“API 缺失”“能力不足”“恢复中”“已有运行/暂停会话”和“状态读取失败”具有不同恢复方式，必须分别呈现；适配器数量不能替代提供方健康状态。
- 外部提供方不可用时保留用户选择并解释原因，只提供显式“改用自带番茄钟”动作。这样插件稍后加载或恢复后仍能按原选择工作，也避免用户偏好在后台被改写。
- 外部生命周期事件可能在同一事务内连续到达，UI 刷新必须合并；插件卸载先标记 bridge disposed，再释放监听器，排队回调不得访问已销毁表面。

## D-103：完成回写使用启动口径并在漂移时拒绝，不按结束时配置猜测（2026-09-17）

- 外部专注开始时写入的 itemUnit 与 tomatoMode 是本次 session 的计量契约；完成时若项目已删除、归档或映射改变，自动回写必须拒绝并提示用户核对，不能用结束时的新配置重新解释旧会话。
- 幂等边界同时使用正在处理、当前运行期已完成和 store 中已有 externalRef；只有写接口返回真实记录后才加入完成集合，失败仍允许提供方重试。
- 拒绝与失败诊断是有界的运行期观察信息，不冒充持久可靠队列。跨重载补偿仍等待上游显式查询契约，不通过读取私有历史实现。

## D-104：诊断可持久化但不充当完成补偿队列（2026-09-17）

- completion 问题使用独立 schema v1 存储并限制为最近 20 条，只为热重载后排障和用户导出；它不重放事件、不自动补写打卡，也不改变 D-100 的实时事件边界。
- 支持包只包含 provider 健康快照、稳定原因码、时间、受限 itemId/session identity；不包含项目名称、备注、打卡正文或完整主 store。外部能力最多 32 项、单项 80 字符，关联字段继续沿用 160/240 字符边界。
- 损坏 JSON、未知 schema、未知原因和非法日期按空诊断处理；导入式恢复只接受自有数据字段，不执行 getter。跨窗口通过思源既有 `onDataChanged` 重新读取独立存储，不额外建立未经验证的广播协议。

## D-105：外部状态不可读时保持所有权并关闭新启动（2026-09-17）

- 外部插件状态读取失败属于“不确定”，不能解释为“空闲”：小飞驴打卡保留当前专注所有权并进行有限轮询，避免同一项目误启第二个计时；新启动资格同时 fail-closed。
- provider 返回对象视为不可信输入，版本、能力、方法、状态布尔值和 sessionId 均只读取自有数据属性，不执行 getter；方法调用保留原 receiver，兼容依赖 `this` 的公开 facade。
- ended/completed 既影响所有权也影响可见诊断，因此都触发合并后的后台刷新；卸载标记优先于计时器回调，任何剩余轮询不得访问已销毁表面。

## D-106：跨插件桥接必须有可执行宿主测试，不以源码守门替代行为（2026-09-17）

- 静态契约检查继续负责事件名、公开方法和文案边界，但注册、调用参数、异步完成、幂等、刷新合并与卸载清理必须在 FakeWindow + facade + consumer API 中真实执行。
- 假宿主只模拟双方已经定义的公共能力，不臆造思源 API；真实客户端加载顺序和多窗口事件仍由 B-007 验收。
- 每个新增 provider 都应复用同类行为门禁：至少验证资格关闭、唯一身份、写入失败可重试、外部 consumer 隔离和 dispose 零副作用。

## D-107：写失败保留最小关联信息，迟到异步结果服从卸载边界（2026-09-17）

- write-failed 仅保留有界 itemId 和 provider identity，帮助用户定位并由提供方重试；不保存项目名称、备注或 payload 全文。
- 空返回与抛错具有相同幂等语义：都不标记完成、不吞掉 session，后续同身份完成通知仍可重试；只有真实记录返回后才进入完成集合。
- 插件卸载是异步任务的最终边界。已发出的存储调用无法撤销，但其迟到结果不能重建 bridge 内存、诊断或 UI 刷新状态。

## D-108：in-flight 身份采用 handler 所有权，duplicate 无权释放（2026-09-17）

- `inFlightIdentities` 不只是集合，也是并发写锁。只有实际把 identity 加入集合并开始持久化的 handler 才拥有释放权；观察到 duplicate 后提前返回的 handler 不得在 finally 删除共享锁。
- 幂等验证分为写入中与写入后两阶段：前者由 owner-held in-flight identity 阻断，后者由 store 的 externalRef 阻断；运行期 completed 集合只是加速层，不是唯一正确性来源。
- duplicate 属于预期重放而非用户故障，不进入诊断列表、不产生提示；只有格式、映射或持久化问题才需要可见处理。

## D-109：历史幂等索引按不可信数据读取（2026-09-17）

- 主 store 虽由本插件维护，但可能来自旧版本、恢复包或损坏同步，因此用于幂等的 externalRef 也必须按不可信数据处理，不执行 getter、不接受非字符串、不扫描无限长度。
- 历史去重只识别 `docktomato:` 命名空间并剥离前缀后的身份；其它 provider 或手工 externalRef 不进入 Dock Tomato 判定集合。
- 已落账重放是正常恢复路径，保持安静；损坏历史字段被忽略，让当前事件继续按自身合法性处理，而不是让一条坏记录阻断所有后续回写。

## D-110：历史幂等投影保持完整性，先消除中间分配而非截断扫描（2026-09-17）

- 为保证很早以前的 session 仍不会重复记账，当前不按最近 N 条截断历史；优化采用一次循环直接构建 Set，去掉三段数组分配和重复身份。
- 若未来十万级数据证明全量扫描成为瓶颈，应在 14.0 数据内核建立可校验的 provider identity 索引，并通过迁移/重建保证正确性，不能仅靠固定窗口牺牲幂等。
- 投影函数保持纯粹、可独立测试，不缓存主 store 引用，避免跨窗口更新后使用陈旧索引。

## D-111：Provider 注册以 facade 对象身份为生命周期边界（2026-09-17）

- availability 可高频重复，若 facade 对象未变且已有 disposer，注册保持不动，仅合并 UI 刷新；避免重复 adapter、重复监听和无意义状态闪烁。
- facade 对象变化视为 provider 热重载：先调用旧 disposer，再为新健康实例注册；缺失、不兼容或不可读状态只解绑，不保留指向失效插件实例的闭包。
- 全局 provider 容器同样是不可信边界，发现过程只读取自有数据属性；访问器污染按未安装处理，不让第三方 getter 进入插件调用栈。

## D-112：结束释放采用有界确认，不把 ended 等同于立即 idle（2026-09-17）

- Dock Tomato 的结束事件与状态持久化/广播可能存在短暂顺序差，收到 ended 后先读取公开状态；仍 active 时每250ms重试，最多20次（约5秒）。
- 轮询期间不提前释放小驴打卡的 active adapter，避免用户在提供方仍活动时启动第二个计时；轮询也不重复刷新 UI，状态事件本身负责可见更新。
- 达到上限只停止观察并清理 timer 标识，不猜测 provider 已空闲；后续 lifecycle 事件可重新触发确认。

## D-113：可恢复故障在真实成功后按 session 精确解决（2026-09-17）

- write-failed 是可恢复状态，不应永久成为历史错误；只有 recordEvent 返回真实记录后，才删除同一 identity 的 write-failed 诊断。
- 解决范围不按 itemId 批量匹配，因为同一项目可能有多个独立失败 session；也不删除 invalid-duration、mapping-changed 等仍需用户理解的非写入问题。
- 诊断解决与成功回写在同一 bridge 流程中触发持久化刷新，设置页最终反映当前未解决问题，而导出的支持包不会继续携带已恢复噪音。

## D-114：诊断恢复以事件时间决定新旧，同时间保持输入稳定性（2026-09-17）

- 存储数组顺序可能因同步、旧版本或手工恢复而不可靠；恢复时以已校验的 ISO 时间排序，使 UI 的“最近一次”和20条容量窗口符合真实发生顺序。
- 相同时间戳不使用 reason、itemId 或 identity 做业务排序，而使用原输入位置保持稳定，避免无意义重排改变用户排障上下文。
- 排序只作用于最多进入内存前的诊断文件，不改变主打卡事件顺序；容量仍固定20条，避免诊断恢复扩大内存占用。

## D-115：重复诊断折叠展示，按完整问题键隔离（2026-09-17）

- 高频重发同一坏事件不应挤掉其它有价值的问题；运行期按 reason + itemId + identity 完整键折叠，更新时间并移到末尾，UI 仍能识别它是最近发生的问题。
- count 表示实际发生次数，设置页汇总 count 而非数组长度；为防损坏数据或无限增长，单行计数上限9999。
- 不仅按 reason 或 itemId 折叠，避免同一项目的不同 session、或同一 session 的不同故障互相覆盖；成功重试仍只解决对应 identity 的 write-failed。

## D-116：持久诊断在排序后按完整键归并（2026-09-17）

- 运行期折叠不能消除旧版本或多窗口已写入的重复行，因此恢复路径也执行相同的 reason + itemId + identity 完整键归并。
- 先按已校验时间稳定排序，再让重复键删除后重插，保证聚合行的时间与位置均代表最后一次发生；计数求和后仍封顶9999。
- 20条容量限制作用于归并后的唯一问题键，避免重复行在裁剪前挤掉其它故障；存储 schema 仍为 v1，旧数据无需迁移写回即可读取。

## D-117：用户触发的诊断导出仍视输入为不可信（2026-09-17）

- 即使正常入口传入内部 provider 快照，诊断序列化函数也可能被未来 API、测试工具或损坏状态直接调用，因此所有字段使用 own-data descriptor 读取，不执行 getter。
- provider 状态只接受九个稳定枚举，未知值降级为 error；版本数值转换允许失败并省略，能力数组最多扫描128项、收集32项，避免稀疏巨数组拖慢导出。
- 非法 exportedAt 不再让用户点击导出时报错，而是替换为调用时的有效 ISO 时间；该修复只影响支持包元数据，不修改主数据或问题发生时间。

## D-118：外部专注上下文必须无损往返（2026-09-17）

- completion 消费端对 itemId 和 unit 有160/80字符边界，因此启动端不能发送会被截断或 trim 后改变的字段，否则一次合法计时也无法匹配回原项目。
- canStart 与 start 共享上下文构造器：前者让 UI 提前禁用不可用入口，后者防止状态变化或直接调用绕过资格检查。
- 不自动修剪或截断项目字段，因为那会让外部 session 绑定到不同标识；非法上下文使用既有 DOCK_TOMATO_INVALID_CONTEXT 错误码和用户提示。

## D-119：幂等身份禁止规范化后使用（2026-09-17）

- sessionId、recordId 和持久 externalRef 都是身份而非展示文本；对身份执行 trim 或 slice 会让两个不同上游值碰撞成同一幂等键，因此必须原样满足边界才接受。
- sessionId 缺失或非法时仍允许使用合法 recordId，这是既有契约的降级路径；两者均非法时返回 missing-identity，不创建截断后的 externalRef。
- 历史投影只接收总长不超过 `docktomato:` 11字符加240字符身份的完整引用，并再次校验拆分后的身份，使运行期与跨重载去重语义一致。

## D-120：Provider 检测与诊断导出共享安全投影（2026-09-17）

- 实时检测和支持包导出面对的是同一个第三方 facade 边界，版本与 capabilities 不应各自维护不同的强制转换和数组读取逻辑。
- 版本通过捕获异常的有限数值投影处理，Symbol 等值降级为未知版本；能力数组只读取自有数据属性，最多检查128个索引、输出32项。
- 缺失 capabilities 继续兼容早期 provider，但只要声明了非空能力列表，就必须满足 REQUIRED_CAPABILITIES；此次加固不改变协商策略。

## D-121：状态与诊断关联字段同样遵守身份无损原则（2026-09-17）

- status.sessionId 虽然当前主要用于状态观察，未来可能进入恢复或冲突提示，因此不能保留一个与 completion 身份不同的 trim/slice 语义。
- 诊断 itemId/identity 参与重复折叠和成功解决匹配，截断会错误合并不同故障；非法字段改为省略，reason 与时间仍可用于排障。
- 容量测试使用合法的唯一240字符身份，不再依赖截断产生唯一值，确保测试分别证明“容量限制”和“身份完整性”。

## D-122：损坏诊断数组只扫描有界尾窗（2026-09-17）

- 正常诊断文件最多20行，远超该规模的数组已属于损坏或恶意输入；恢复时最多检查最后512个自有数据项，兼顾近期问题和防止百万稀疏数组阻塞 UI。
- 不使用 map/filter 直接索引，因为数组元素也可能被访问器污染；每个位置通过 ownDataValue 读取，getter 视为空项。
- count 与 provider 版本共用异常隔离的有限数值转换，Symbol 等值按兼容默认1恢复，不让单条损坏记录清空全部诊断。

## D-123：诊断文本在 JSON.parse 前设512KiB硬边界（2026-09-17）

- 正常诊断仅20个有界对象，512KiB 已远高于合法写出规模；超过该值意味着损坏或非本插件数据，应在解析前拒绝，避免先付出大字符串解析成本。
- 边界采用字符数而非磁盘字节数，因为恢复函数接收的是已加载 JavaScript 字符串；精确上限继续允许，保持明确可测试的闭区间语义。
- 超限恢复与非法 JSON 一样清空内存诊断并返回冻结空快照，不尝试截断 JSON，因为截断后内容不完整且可能产生误导记录。

## D-124：completion 项目解析不信任数组与字段访问器（2026-09-17）

- bridge 正常接收主 store 项目，但 completion 判定是独立导出的安全边界；损坏数组或对象不应执行 getter，更不应被 catch 分支误记为 write-failed。
- 项目查找通过 ownDataValue 读取数组元素和 id，未找到稳定返回 missing-item；找到后 archived、unit、tomatoMode 也只接受自有数据属性。
- 不限制项目数组长度，以免大型合法仓库找不到旧项目；13.0 先消除副作用，十万级索引和查询性能按路线归入14.0数据内核。

## D-125：Completion 回调必须原样复现启动上下文（2026-09-17）

- itemId、itemUnit、tomatoMode 是启动时签名的一部分，消费端不能通过 trim/slice 接受被修改的回调；任何不可无损往返字段均按 invalid-context 拒绝。
- durationMinutes 的公共契约是 number，不接受数值字符串或对象隐式转换；这既避免执行第三方 valueOf/toString，也避免不同 provider 对字符串格式产生歧义。
- 严格校验位于项目匹配和持久写入之前，因此异常 payload 不调用 recordEvent，也不会污染幂等身份集合。

## D-126：历史幂等扫描绕过数组迭代协议但保持全量（2026-09-17）

- `for...of` 会读取数组 Symbol.iterator 并通过迭代器访问元素，即使 entry.externalRef 使用 ownDataValue，污染数组仍可在进入边界前执行代码。
- 改用长度索引循环并以 ownDataValue 获取每个位置，访问器和空洞视为空项；externalRef 继续使用无损身份校验。
- 不设历史数量上限，因为任何被漏掉的旧 externalRef 都可能造成重复记账；大型索引优化必须由14.0可重建索引解决。

## D-127：宿主专注释放按在途操作单飞（2026-09-17）

- completed 与 ended 可能连续、重复或由上游重放；当 provider 已空闲时，两类事件都可能请求释放本插件的专注所有权。
- stopFocus 是异步生命周期操作，同一在途窗口只允许一次调用；后续事件共享该结果，不排队重复 stop，也不创建无意义的空闲轮询。
- 操作结算后解除单飞，允许未来新会话再次释放；结算回调必须复查 bridgeDisposed，防止卸载后的迟到 Promise 刷新已销毁界面。

## D-128：设备能力规则由组件层统一拥有（2026-09-17）

- coarse-pointer、reduced-motion 与 print 都描述跨页面交互能力，不应继续在 legacy 与组件层各保留一份并依赖加载顺序覆盖。
- 将 legacy 独有声明并入组件层已有的同类 media block，再删除旧块；触控目标、安全区、编辑器控件和打印隐藏语义保持不变。
- 相关移动测试改为锁定 `ui/components.scss` 的现行真值，并新增 legacy 禁止回流守门；这属于样式归属迁移，不改变业务行为。

## D-129：Legacy 样式以零生产引用方式退役（2026-09-17）

- `index.scss` 剩余主题、页面和表单规则均已有 tokens/components 后置真值；继续打包只会增加重复 CSS 与加载顺序耦合。
- 缺失的 control-height、density-scale、section-gap 正式归入 token 层；模板管理器的必要规则迁入组件层并改用插件语义色。
- 入口移除 legacy import，文件暂保留一行退役说明供历史测试和迁移审计读取；任何 active selector、media block 或 root token 回流都由 legacy audit 阻止。

## D-130：移动结构测试必须进入标准门禁（2026-09-17）

- 独立测试文件若不在任何 package script 中执行，会在布局演进后静默过期，无法提供发布保护。
- 移动编辑器当前由宿主外固定操作栏占用64px，布局只预留这一份高度；测试应锁定现行结构语义而不是旧的12px临时值。
- `mobile-editor-structure` 纳入 `test:mobile`，使本地质量链和 CI 都覆盖模板、图标、独立滚动、安全区与操作栏结构。

## D-131：测试文件必须可执行或显式退役（2026-09-17）

- 测试文件仅存在于目录中并不代表受到 CI 保护；package scripts 才是实际执行边界。
- 13个原孤立测试组成 `test:extended` 并接入完整质量链；测试资产清单逐文件验证，规模不少于50项。
- 结构测试应读取功能当前所属的 render/bind 模块，而不是继续把 `index.ts` 当作所有 UI 与交互实现的唯一位置。
- 显式退役集合仅用于迁移缓冲，不作为长期白名单；本轮已将4个旧单体结构测试全部迁移，当前退役数为0。

## D-132：事件只读索引绑定不可变 Store 身份（2026-09-17）

- 主存储写路径以新 store 对象表达变更，因此 WeakMap 可以安全地让同一快照复用索引，并在替换 store 后自然失效和回收。
- 一次遍历同时构建项目日期、日期和事件ID三路索引；回顾月历、日期明细和事件操作共享同一数据真值，避免各自建立临时 Map 或执行 find。
- 重复事件ID按数组中的首项确定性解析，与原先 `find` 行为一致；索引只优化读取，不改变规范化、冲突或持久化结构。

## D-133：范围索引按需构建并保持持久顺序（2026-09-17）

- 日期范围采用 `[start, end)` 半开语义，与现有摘要边界一致；排序投影通过二分查找缩小候选集合。
- 日期排序会改变跨日期交错写入的持久顺序，因此命中候选按原 ordinal 恢复顺序后再返回，公共 API 行为不因优化而变化。
- 排序投影仅在首次范围查询时建立并缓存到 store 索引；Today 和单日回顾不需要范围查询时不支付排序成本。

## D-134：12.0.2作为数据读取与质量治理维护版本（2026-09-17）

- 本轮不迁移持久数据 schema；事件、范围和项目索引都绑定内存中的不可变 store 快照，可随对象替换自动失效。
- Dock Tomato 消费端代码与诊断可以随维护版发布，但 README 必须明确上游兼容 API 尚未发布，不能把自动化契约描述成已经可用的真实联动。
- 发布前版本真值、README、变更记录、Release notes、完整质量链和产物摘要必须一致；真实宿主验证继续作为非阻塞限制披露。

## D-135：快捷记录增量按日期修订持久化（2026-09-17）

- “每次打卡”会直接决定快捷按钮写入的事件值，和目标、单位一样属于任务在某日期生效的记录语义，因此同时写入任务当前投影与 `CheckinItemRevision`。
- 旧数据不强制迁移：字段可选，缺失或非法时继续调用既有类型/单位默认值，确保喝水250毫升、时长5分钟等历史行为不变。
- 二元任务始终记录1且隐藏该控件；分钟与小时切换同时换算目标和增量，避免单位变化后数值含义意外放大60倍。

## D-136：纯展开折叠交互优先原地更新（2026-09-17）

- 已完成区折叠不改变数据投影，点击时直接同步 hidden、箭头与 aria-expanded，并异步保存偏好，无需重建整个 Today DOM。
- 这样保留手机端滚动位置、焦点和卡片节点，也消除多表面完整渲染时序造成的“点击后看起来没折叠”风险。

## D-137：快捷增量使用独立规范化与日期口径（2026-09-17）

- 目标值的输入粒度用于规划目标，不应限制每次记录值；快捷增量因此单独定义输入步长，次数保持整数，其余类型允许两位小数。
- 增量与目标、单位一样按日期修订读取。历史修订缺少增量表示当时使用类型默认值，不能回退到任务当前字段，否则修改今天配置会重写过去交互语义。
- 所有持久入口共享同一纯规范化函数，避免编辑保存有上限而导入/模板没有上限的口径分裂。

## D-138：用户写入前必须在同一排他锁内完成三方收敛（2026-09-17）

- 多窗口可靠性不能只比较当前内存和远端；必须以最后成功持久化快照为基线，对基线、本地、远端执行冲突检测与确定性合并。
- 远端读取、必要的合并回写以及随后的用户 mutation 保持在同一 Web Lock 临界区，避免对账完成后到实际写入前再被另一窗口插入。
- lastPersistedStore 表示最后一次成功主存储写入，不是保存提示 UI 状态；任何成功写入都必须推进它，否则后续会重复报告已经吸收的冲突。

## D-139：主存储成功以回读收敛为准（2026-09-17）

- `saveData` Promise 完成只证明宿主接受了写请求，不能证明随后读取的主 store 仍包含该快照；非协作窗口或同步回放可能在临界点覆盖内容。
- 写后回读若已经是期望值的确定性超集，直接接受并吸收额外数据；若缺失期望数据，则合并双方并仅重试一次，避免无界写入风暴。
- 两次仍无法收敛按真实保存失败处理，由现有回滚和错误反馈路径接管，不向用户宣称记录成功。

## D-140：十万级范围查询继续采用按需排序投影（2026-09-17）

- 十万级历史的主要成本应在首次需要范围分析时支付；Today、单日记录和普通项目查询不应为未使用的范围功能预先排序。
- 首次构建后由 store 身份绑定的 WeakMap 复用排序投影，后续范围通过二分缩小候选并恢复持久顺序；store 替换时自然失效。
- 性能门槛采用宽松的跨机器上限防止灾难性退化，不把单台开发机的毫秒值当作产品承诺。

## D-141：删除意图不能依赖事件仍在当前快照中（2026-09-17）

- 多窗口对账可能先让待撤销事件从当前窗口消失；若此时因为取不到完整快照而不写墓碑，旧窗口稍后重放同ID就会复活已删除记录。
- 已知事件ID本身足以建立最小墓碑，因此字符串删除始终保留ID墓碑；只有完整事件快照存在时才附带外部身份，用于阻断同externalRef但不同ID的重放。
- 手动事件没有跨ID稳定身份，不推测其业务等价性；只阻断同ID重放，避免误删用户真实的独立打卡。

## D-142：墓碑索引按操作重建而不进入存储协议（2026-09-17）

- 墓碑是长期可靠性凭据，不能为缩短数组而牺牲旧窗口重放保护；规模问题应通过可重建查询索引解决。
- normalizeStore 和 mergeStores 对一个操作只构建一次 ID Set 与 external identity Set，把事件过滤从 O(events × tombstones) 收敛到线性构建和查询。
- 索引是瞬时派生数据，不持久化、不迁移，也不跨 store 对象缓存，避免失效管理和备份协议复杂化。

## D-143：单次记录追加复用当前 store 的完整事件投影（2026-09-17）

- Today 渲染和进度查询通常已经为当前不可变 store 建立 WeakMap 索引；打卡追加应复用该投影，而不是再次扫描完整事件历史和墓碑数组。
- 投影同时维护事件ID、外部身份和墓碑双键，三类幂等规则由同一数据边界执行，避免不同入口口径漂移。
- appendEvent 仍返回带新 events 数组的新 store；不原地修改旧 store 或缓存索引，后续渲染自然为新身份建立新投影。

## D-144：事件ID查询与编辑共享首项序号语义（2026-09-17）

- 正常化 store 不应出现重复事件ID，但原始/测试输入仍可能包含；getEventById 既然确定性返回首项，备注编辑也必须更新同一首项，不能另建不同口径。
- WeakMap 事件投影在一次遍历中同时记录首项对象和首项序号，读取与定点复制共享索引，不增加持久字段。
- 备注裁剪后未变化属于真正无操作，返回原 store 可以避免无意义持久化、冲突检测和页面刷新。

## D-145：配额规则接收项目候选集但保留规则层二次过滤（2026-09-17）

- Today 同时计算多个配额项目时，不应让每个项目重复扫描全库事件；store 投影先按 itemId 缩小候选集，把复杂度从项目数乘全历史降为各自历史之和。
- evaluateQuotaSchedule 仍保留 itemId、单位和周期过滤，既维持纯函数公共契约，也防止未来调用方传入未预筛选数组时出现串项。
- byItem 是不可变 store 的瞬时索引，不改变事件顺序、不持久化，也不以缓存结果替代日期修订语义。

## D-146：UI和洞察通过store级规则入口消费项目投影（2026-09-17）

- rules.ts 继续保持仅依赖 item/events/date 的纯函数，便于独立测试和外部调用；知道完整 store 的调用方则通过 model.evaluateItemRule 自动获得按项目候选集。
- Today 卡片、批量完成和习惯洞察属于高频消费方，禁止再次直接把 store.events 传给单项目规则，以免项目数放大全历史扫描。
- 洞察仍在项目候选集上执行墓碑与日期窗口过滤，索引优化不假设调用方输入一定经过 normalizeStore。

## D-147：汇总事件选择以最终bounds为唯一真值（2026-09-17）

- buildSummaryForBounds 已同时服务预设范围和自定义范围，不能再根据 range + asOf 二次推导事件窗口；否则历史自定义区间会显示正确标签却统计今天的数据。
- 入口先按最终 elapsed bounds 读取半开事件区间，再一次按 itemId 分桶；项目摘要只消费自身事件，不重复扫描共享区间数组。
- asOf 只负责裁剪尚未结束的当前范围，不能替代用户明确选择的历史起止日期。

## D-148：严格规范化留在不可信边界，锁内可信快照使用显式快路径（2026-09-17）

- normalizeStore 继续负责 load/import/API 等 unknown 输入，不能用性能理由跳过损坏字段、墓碑和外部身份清洗；插件自己通过不可变模型产生的 store 则不应在同一事务重复规范化。
- normalized 函数名明确调用前提，只在内部事务链使用；公共 mergeStores、detectStoreConflict 和 persistStoreWithVerification 仍保留严格包装层。
- 指纹只缓存到 WeakMap，不持久化；调用约束与既有事件索引相同，生命周期内的 store 及嵌套集合必须采用不可变替换。相同指纹用于短路无变化合并和写后修复，指纹不同仍逐项生成冲突ID并执行确定性合并。

## D-149：连续记录复用事件索引中的自然日集合（2026-09-17）

- 连续记录的既有口径是“某自然日存在任意记录”，不是“当天达到目标”；索引只按 itemId/localDate 去重，不能改用完成态或计划日判断。
- Today 完整渲染和局部刷新都应复用当前不可变 store 的日期投影；store 替换时 WeakMap 身份自然失效，不把派生日期集合写入持久数据。
- 今天没有记录时允许从昨天起算；归档项目仍固定为0。同日多条只增加记录次数，不增加连续天数。

## D-150：回顾表面共享单次渲染周期的分析快照（2026-09-17）

- 统计徽标、周趋势和月趋势必须来自同一 store/asOf 快照，避免重复计算及恰逢午夜时徽标与图表截止日不一致。
- 同一 render 周期的 dock、页签和快速弹窗复用该不可变快照；不跨 render 周期缓存，因为即使 store 身份不变，周/月/日窗口仍会随本地日期推进。
- 汇总范围和历史月历仍是独立交互口径，不能用日/周/月/自定义汇总或 historyMonth 改写趋势锚点；热力图只复用快照的基准年份，不把近五年 yearly 趋势误当单年热力图。

## D-151：回顾页所有当前日期投影共享 AnalyticsSnapshot.asOf（2026-09-17）

- 一次回顾渲染中的“今天”必须是单一值；日历、摘要、成就、提醒和逾期若各自调用 new Date，恰逢午夜可能在同一页面出现两个自然日。
- YYYY-MM-DD 必须通过本地日历解析为中午，不能直接 new Date(dateKey) 触发 UTC 解析倒日；日期推进继续使用日历构造而不是固定毫秒数。
- historyMonth 和自定义摘要范围仍由用户输入控制；统一 asOf 只负责今天边界与未来裁剪，不覆盖用户明确选择的历史范围。

## D-152：成就事件派生指标共享单次遍历（2026-09-17）

- 仅依赖事件本身或项目当前时段的成就指标，应在一个事件循环中同步累计；不能为每个徽章类别重复 filter/map，也不能为每条事件线性查找项目。
- itemId Map、活跃日 Set 和来源 Set 都是一次 buildAchievements 调用内的瞬时投影，不持久化、不进入备份协议，也不跨 store 身份缓存。
- 完美日需要计划、归档、日期修订和完成规则的逐日判断，语义不同，暂不并入事件计数快路径；本轮优化不得改变历史成就解锁口径。

## D-153：完美日统计跟随自然日循环流式累计（2026-09-17）

- 完美日日期循环已经从最早项目日期单调推进到 asOf，同一循环内即可维护累计天数与连续值；为此再建立 Map 并排序既增加分配，也制造第二套日期顺序真值。
- 没有计划项目的日期不属于完美日统计样本，应跳过且不重置 streak；存在计划但完成数不足时才重置，这一既有语义必须通过矩阵测试锁定。
- 本轮只移除派生中间结构，不复制或改写 isItemAvailableOnDate、isScheduledToday、isComplete 的规则；配额、日期修订和归档边界继续由模型层统一解释。

## D-154：日期修订投影以 revisions 数组身份缓存（2026-09-17）

- 插件模型通过任务与嵌套数组不可变替换更新；因此 revisions 数组身份可作为有序投影的准确失效边界，避免每次日期查询都复制、过滤和排序。
- 规范化数据本来按 effectiveDate 有序，应直接复用；公共模型仍兼容无序原始输入，首次发现逆序才复制排序，绝不原地重排调用方数组。
- 查询采用稳定排序后的上界二分，保留“目标日期最后一条有效修订”语义；缓存只存在 WeakMap，不持久化、不进入备份或同步协议。

## D-155：共享修订解析归属无模型依赖的规则核心（2026-09-17）

- rules 只依赖 types，model 已依赖 rules；把共享修订解析放入 rules 并由 model 重新导出，可让两层复用同一实现且不形成循环依赖。
- evaluateRule 必须一次解析修订并复用到状态、计划、目标、单位与配额计算，禁止 getRuleStatus 再次查询，以免同一评估出现重复工作或口径漂移。
- 保持 model 的 getItemRevisionForDate 导出路径属于兼容契约；缓存仍以 revisions 数组身份失效，不改变持久化、备份、同步和公共规则函数签名。

## D-156：版本号连续递增，数据内核成果随 13.0.0 发布（2026-09-17）

- semver 不跳号：12.0.2 之后的下一个大版本是 13.0.0；TODO 里的"13.0 专注生态 / 14.0 数据内核"是工作流标签而非发布版本号，先例是 12.0.2 已同时搭载两个工作流的内容。
- 13.0 专注生态的剩余完成门槛（上游兼容版本可安装、真机双窗口记账）保持 B-007 开放，不阻塞数据内核成果发布；后续上游联调内容以维护版本承载。
- 发布说明与变更记录只写用户可见变化，工作流批次号保留在 TODO/PROGRESS 内部记录。

## D-157：生命周期条目必须与 normalizeStore 规范字段集合一致（2026-09-17）

- 写后校验以 JSON 指纹比较期望快照与回读快照；normalizeStore 将缺省 archived 物化为 false，插件侧构造条目若省略该字段，指纹永不等价，保存被误判失败并回滚。该缺陷随 14.0 数据内核第六批引入、v13.0.0 发布，被 CI browser-audit 的 visual-qa 双击提交步骤拦截，v13.0.1 修复。
- 新增条目/事件的构造点必须物化 normalize 的全部非 undefined 默认值；cloneItemValue 作为快照边界保留防御性物化（archived === true）。
- 浏览器 QA 宿主的存储模拟必须按存储名分槽且克隆失败时 reject，与真实思源 loadData/saveData 契约一致；单槽模拟会让偏好写入串进主存储，制造伪失败并掩盖真实缺陷。

## D-158：回顾日志宽容器双列，额外天数仅由 hidden 门控（2026-09-18）

- 打卡日志行在 1180px 限宽（或双列区块的半宽折叠体）下名称与数值之间大面积留白；日志按天分组在 lc5 ≥960px 改双列网格，日期标题跨两列，行距由网格 gap 接管，窄容器保持单列。双列只影响行排布，行内结构、缩略图与多记录 details 不变。
- `data-log-extra` 的隐藏一律由 `[hidden]` 属性承担（`.lc-checkin__log-day[data-log-extra][hidden]`）；展开按钮把 hidden 置 false 即显示。属性级 `display:none` 与 hidden 切换逻辑脱节，曾使"展开其余 N 天"在所有宽度下点击无效（探针证实后删除）。
- 新布局规则放在回顾区块容器查询层，与既有 720px/1180px 层并列；不引入第二个容器名，继续走 lc5 体系。

## D-159：回顾二级导航 JS 钉住与跳转按 fold id 定位（2026-09-18）

- 真机实测（思源界面缩放，容器有效宽 725/582px）：宿主 zoom 子树内合成器滚动不会重定位 position:sticky（Chromium 缺陷，重排后才短暂恢复），二级导航条滚动时不跟随。
- 二级导航条定位退为 relative，由 bind-page-navigation 的滚动同步（passive scroll 监听 + transform translateY）主动钉在滚动区顶部；滚动事件可能缺失的场景（跳转点击）在处理器内显式调用同步。wheel、程序化 scrollTop 与跳转三条路径均已真机验证。
- 跳转一律按 data-review-fold id 定位并同步直写 scroller.scrollTop：区块列表混有年度热力图 details，按下标取整体错位一位；scrollIntoView 的滚动落地是异步的，钉住同步会拿到旧位置。
- 桌面弹窗/页签宿主在 480-959px 档（缩放后实际容器常落此区间）范围页签与工具区并为一行；dock 与移动宿主维持原布局。

## D-160：事项行操作列可见性与弹窗遮罩兜底（2026-09-18）

- 用户真机截图：事项行右侧操作按钮整体不可见、弹窗四角透出白色文档。真机 Console 实测：按钮存在于 DOM（4×32px、SVG 齐全）但被多层网格档位交叠覆盖不可见；圆角缺口处 elementFromPoint 命中 b3-dialog__container 本身（透出背后白色文档）。
- 操作列在 480-959px 容器档（弹窗/页签宿主，排除移动）用最终层 !important 强制三列网格与可见性；不再依赖与中间档位的优先级竞争。
- 框式快速弹窗的遮罩（b3-dialog__scroller）加半透明暗色底：圆角缺口不再透白，悬浮窗口层次成立；移动端全屏宿主不受影响。
- 真机调试经验：思源 Ctrl+Shift+I 可开 DevTools，Console 跑 JS 用 document.title/clipboard 回传结果；reloadUI 后渲染器样式表可能仍是旧缓存（版本号未变），重大样式改动后必须完整重启思源验证。

## D-161：事项模板推荐分组与目录扩充（2026-09-18）

- 模板目录扩至 53 个（生日5/纪念日6/定期支出12/会员续费9/健康与车辆9/节日12），取消「全部模板」分组：模板总量增长后全量视图只会越来越长，用户没有浏览全部的诉求。
- 新增首档「推荐」分组（筛选模板的 recommended 标记，非独立 category，保证类别测试与统计口径不变），默认选中；精选 11 个覆盖高频场景（家人生日、房贷、房租、水电燃气、信用卡、发工资、视频会员、车辆年检、驾照换证、春节、中秋）。
- 节日模板沿用既有的农历锚点日期模式（2026 年锚点，用户可自行调整）；新增模板的 nameKey 必须中英双语补齐（i18n hygiene 守门）。

## D-162：优先提醒条纵向列表化（2026-09-18）

- 桌面宽容器下优先提醒条原为 flex 双列：主行占左半、展开区占右半，「定位打卡」悬在中间、两列行错位（用户真机截图反馈）。
- 统一为主行整行置顶、展开区整行在下，行内三列网格（标记/文案/操作），「定位打卡」右对齐为胶囊按钮；移动端既有紧凑规则不变。

## D-163：dock 设置页列表布局与容器断点解耦（2026-09-18）

- 真机复现：dock 侧边栏设置页的恢复点/审计卡片文字竖排、按钮裸文本。根因：恢复点与审计列表的网格布局只写在 @media ≤600px 视口断点内，桌面宽视口下 dock 窄容器（约 280-560 CSS px）落入无样式默认 flex，文案列被压缩成竖排。
- 修复：dock 宿主下恢复点/审计列表行改用容器维度常驻两列网格（文案 1fr + 按钮自适应），不再依赖视口断点；文件选择的原生 input 全局隐藏、保留胶囊标签（此前只在编辑器页隐藏，dock 设置页会同时露出原生控件与标签）。
- 教训：dock/弹窗内嵌布局一律用容器查询档位，不要用视口媒体查询（二者在缩放与宿主场景下完全脱节）。

## D-164：dock 回顾页头部紧凑化（2026-09-18）

- dock 窄面板（≤479px）下回顾页范围页签偏大、工具行（复制报告/更多）两端分散，视觉重心散乱。压缩页签与工具按钮密度（28px 高、9px 内距），工具行由两端分散改为成对右对齐；与既有的 lc-dock ≤719 紧凑层合并语义，不影响弹窗/页签/移动端。

## D-165：归档/删除语义与自动归档口径规划（2026-09-18，待实施）

- 现状：打卡项只有「归档」（archived + archivePeriods，记录全保留、可恢复）没有「删除」；归档入口仅在编辑器与批量模式；归档页只有搜索与恢复。
- 计数口径：自动归档按「达成天数」计（当天达到目标 isComplete 计 1 天，与进度模型一致）；次数型项目天然等价，多记录同日只计 1。
- 触发与回环：record/undo 提交后同步检查；撤销导致天数回落不自动恢复归档（归档是显式状态，恢复走归档页）；恢复后再次打卡达标会再次自动归档（语义一致）。
- 删除语义：移除 item + 其全部事件，并写事件墓碑（复用批次 8 基础设施，防多窗口旧数据复活）；删除前自动落恢复点，确认层展示记录条数——保证可恢复路径。
- 字段：autoArchive = { afterDays } 挂 item 级（不进日期修订），normalizeItem 显式放行，随主存储备份协议持久化。
- UI 原则：卡片零常驻空间——配置在编辑器高级区、操作在上下文菜单/批量模式、结果用 toast；归档页承担浏览与批量管理。

## D-166：Task Horizon 合作契约与扩展位规划（2026-09-18）

- 调研结论：Task Horizon 已与底栏番茄钟建立跨插件范式（globalThis.__dockTomato.stats.queryFocus + 能力检测/超时/AbortSignal + 契约测试），并有原生复选框完成触发的积分联动——打卡侧直接复用该范式。
- 显示合作（L1）：对方日历经 window.siyuanCheckin 的 analytics.read/events.read 读打卡数据 + 订阅 checkin:analytics-updated/event-recorded 刷新；未授权即降级隐藏。
- 写入合作（L2）：任务完成回写经 events.record，externalRef 契约为 "taskhorizon:<blockId>:<localDate>"（幂等防重放）；打卡项目用配额按记录数目标 N，达成即当天完成，可与自动归档（T-1161）组合。
- 责任边界：打卡侧只维护 siyuanCheckin 公共面（v4 已就绪）+ 文档 + 预设模板；日历图层与完成回写在对方侧实现；不读取对方私有文件、不做文档污染式同步。
- 外部软件通道：短期导出 JSON/CSV；中期评估每日摘要写驻留文档（经内核 API 供外部工具读取，需隐私评估，另立项）。

## D-167：小驴速切组件商店协作模式调研（2026-09-18）

- 小驴速切（siyuan-speed-switch）的组件面板已有完整的小组件商店系统（home-store-ui.ts），其中**已包含 6 个小驴打卡桥接组件**（ADR 0057）：checkin-today/streak/year-heatmap/weekly/occasions/monthly，经 `window.siyuanCheckin` API v4 读取数据，source 标注为 siyuan-checkin 使商店按来源归组。
- 桥接采用「速切侧消费」模式而非「打卡侧注册」：打卡的生态 API v4 已是稳定公开契约，速切以内建 adapter 直接消费，组件即刻可用，无需打卡发版。
- 打卡侧目前**无需任何改动**；如需新增组件类型（如成就展示、目标进度），需修改速切侧 checkin-bridge-model.js + home-external-adapters.ts。若将来打卡插件自行注册相同 moduleId，token 覆盖会让原生实现接管（桥接预留的升级路径）。
- 组件在商店中按来源归入「小驴打卡」组、功能归入「生活信息/Life」组。

## D-168：v15 以性能、功能和交互质量优先，CSS 体积不作主约束（2026-09-18）

- v15 的验收优先级调整为：数据与功能正确性、运行时性能、跨端 UI 可读性、交互连续性和真实宿主稳定性。
- CSS 体积只保留 450KB 硬阻断线及构建可用性检查；不再为了达到 360KB 目标牺牲触控反馈、布局清晰度或组件可维护性。
- 第一批从 Today 卡片上下文菜单开始：桌面右键与触屏长按共用动作菜单，菜单位置必须限制在视口内，打开后焦点进入首个动作，Escape 可关闭，移动取消长按不得误触。

## D-169：Today 多动作交互共享互斥边界并恢复焦点（2026-09-18）

- 批量工具栏的完成、归档、删除动作共享 `[data-bulk-toolbar]` 互斥边界；任一动作进入 mutation 队列时，整组按钮同时禁用，避免用户在排队期间切换语义。
- 上下文菜单使用 `role=menu/menuitem`，支持上下方向键循环移动；关闭菜单（动作完成、Escape 或外部点击）后优先把焦点还给原卡片的主操作按钮，若卡片已被删除则不强行聚焦脱离 DOM 的节点。
- 菜单动作的同步异常也必须经过 Promise rejection 边界，避免编辑器打开或宿主 API 抛错产生未处理 rejection；批量删除的 store 变更继续在 mutation 队列内执行。

## D-170：Task Horizon 日期摘要 API 采用有界本地日期投影（2026-09-18）

- 对外新增 `getEventRangeSummary`，输入使用半开区间 `[startDate, endDateExclusive)`，只信任事件 `localDate`，不从 UTC 时间戳推导日历归属。
- 默认限制为 366 天、5,000 条事件和 366 个日期点；超出事件或点数返回 `truncated`，非法范围或超长范围直接拒绝。
- 返回值仅包含按日聚合的数量/数值/单位统计，不暴露 store、备注、附件或事件对象；消费者可安全缓存并自行刷新。

## D-171：归档摘要统一使用一次性事件投影（2026-09-18）

- 归档页显示累计达成天数与最近记录时间；渲染前按 `itemId` 分桶，避免每个归档项目重复扫描全量事件。
- 达成天数继续复用 `isComplete` 口径，但只遍历有事件的日期索引；保留日期修订和 3,660 天安全上限。

## D-172：跨表面动作反馈采用结构统一守门（2026-09-18）

- 归档动作、回顾工具和设置导入/恢复统一使用 `aria-busy`、禁用/互斥和 finally 清理；重渲染导致原控件脱离 DOM 时恢复到稳定入口焦点。
- 设置导入失败除 toast 外保留页面内 `role=status` 可见反馈，避免错误只存在于瞬时通知。

## D-173：归档批量操作采用筛选集选择与单事务提交（2026-09-18）

- “全选”只作用于当前搜索结果，避免用户在看不见的筛选外项目上误操作；删除前仍汇总项目数和记录数二次确认。
- 批量恢复和批量删除各自只进入一次 mutation 队列、只持久化一次；工具栏内全部动作共享互斥边界，执行期间整组禁用并暴露 `aria-busy`。
- 窄容器下选择框/图标/信息保留首行，恢复与删除回流第二行；通用历史行网格不因归档专用选择列而改变。

## D-174：自动归档使用专用追加事件但保持通用更新兼容（2026-09-18）

- 新增 `checkin:item-archived` 作为自动归档成功后的专用通知，便于 Task Horizon 等消费者移除日历项；手动归档继续只依赖既有 `item-updated`。
- 自动归档队列执行时若项目已被其他动作归档，不广播专用事件；只有本次操作真实完成 false→true 转换才触发。
- 事件 payload 必须深克隆周期 weekdays/quota、修订、归档区间和 autoArchive，第三方修改 detail 不得污染插件 store。

## D-175：批量生命周期动作以单事务快照为一致性边界（2026-09-18）

- Today 批量归档/删除不能逐项目进入 mutation 并反复持久化；一轮用户确认对应一次当前快照变换和一次写盘，避免中间态被其他窗口观察、降低恢复点与写后校验成本。
- 保存失败必须恢复整批操作前的内存快照；确认取消或失败时保留当前选择，用户可以调整或直接重试。成功后仍逐项目发送既有集成事件，外部消费者不需要理解新的批量事件类型。
- 批量删除使用 ID Set 对 items/events 各扫描一次并集中生成墓碑；单项目删除委托同一核心，防止两套删除语义漂移。

## D-176：自动归档检查归属于所有成功记账边界（2026-09-18）

- `autoArchive.afterDays` 的含义不区分写入来源；手动打卡和公共 API 记账只要已经成功持久化，都必须进入同一 `maybeAutoArchiveAfterRecord` 检查。
- 检查仍在记录持久化与事件广播之后排入 mutation 队列，不把记录和自动归档强绑为一次不可拆事务；这样归档保存失败不会回滚已经成功的打卡记录，用户仍可从正常项目状态重试或手动归档。
- 专用 `item-archived` 事件只在实际发生未归档→已归档转换时发送，手动批量归档继续发送通用 `item-updated`，保持 D-174 的兼容边界。

## D-177：批量完成共享一次事件追加与持久化边界（2026-09-18）

- Today 批量完成应以一次用户动作对应一次 store 快照：在 mutation 锁内统一校验当前项目/日期规则，生成全部记录，再通过 `appendEvents` 一次追加和一次持久化；不能逐项目触发完整 `recordEvent` 写盘与重渲染。
- `appendEvents` 与单条入口执行完全相同的 ID、externalRef 和墓碑守门，并额外去除输入批次内部重复；单条 `appendEvent` 委托批量核心，避免幂等语义分叉。
- 外部消费者仍收到每条 `event-recorded`，但同一日期批次只需一个 `analytics-updated` 刷新信号；日期事项完成、自动归档和最近记录反馈继续在成功持久化后执行。

## D-178：Today 批量选择以当前渲染结果为授权范围（2026-09-18）

- “全选”只遍历当前表面的 `[data-bulk-check]`，不能扫描 store 后选中搜索/筛选之外的项目；重渲染后现有选择必须与新结果集求交集，防止隐藏选择继续参与归档或删除。
- 勾选只改变内存 Set、按钮 `aria-pressed`/选中态、live 计数和批量动作 disabled，不需要完整重渲染；这样保留当前焦点、滚动位置并减少移动端触控抖动。
- 空选择时完成/归档/删除按钮保持禁用；退出批量模式和成功提交仍走完整渲染，以清理模式状态并刷新业务结果。

## D-179：删除确认必须在存储锁内复核影响范围（2026-09-18）

- 确认框展示的项目数和记录数只是用户授权的精确范围；等待 mutation 锁期间若其他窗口新增/删除记录或改变批量目标的归档状态，不能沿用旧确认继续删除。
- 单项、Today 批量和归档批量路径在锁内重新计算影响；数量变化即中止并提示重新确认，不尝试静默扩大或缩小用户授权。项目已被其他窗口删除时视为幂等成功并刷新表面。
- 单项目删除也必须走 `enqueueMutation`，与批量删除共享 reconciliation、storage lock、恢复点和写后校验边界；Today 上下文删除成功后由宿主主动刷新，不能只关闭菜单留下幽灵卡片。

## D-180：多个自动归档转换共享一次后续事务（2026-09-18）

- 批量完成后可能同时有多个项目达到 `autoArchive.afterDays`；这些转换先按当前 store 预筛，进入锁后针对 reconciled store 再校验，并通过共享归档周期投影一次写盘。
- 每个真实转换仍依次发送 `item-updated` 和 `item-archived`，保证旧消费者和专用消费者兼容；只有界面提示在多项目时聚合，避免连续 toast 覆盖。
- 单条手动/API 记账继续调用单项包装器，但最终委托同一批处理入口；撤销不恢复、明日起暂停和失败不回滚已成功记录的语义保持不变。

## D-181：v15.0.0 以自动化全链发布并显式保留宿主现场边界（2026-09-18）

- v15 的发布门槛是完整 `test:quality`、宽度走查、发布资源校验、版本真值一致和远端资产摘要一致；CSS 继续执行 450,000-byte 硬线，不以压缩体积牺牲交互质量。
- 用户明确要求发版，因此不因 B-007 的真实思源现场证据缺失阻断 GitHub 正式发布；发布说明必须明确页签、dock、软键盘和多窗口仍建议目标设备复核。
- 标签只指向通过门禁的发布提交；GitHub Release 上传的 `package.zip` SHA-256 作为最终产物真值，发布后回填仓库说明并再次核对远端资产。

## D-182：Task Horizon 联调先固化打卡侧身份与删除语义（2026-09-18）

- 在对方尚未排期前，打卡侧只增加可执行契约夹具，不臆造 Task Horizon 的原生复选框监听或日历消费实现。
- 合作身份继续使用 `taskhorizon:<blockId>:<localDate>`；同一项目、来源和 externalRef 的重放由 `appendEvents`/`normalizeStore` 去重，事件墓碑优先阻止删除后的旧回调复活。
- 契约测试纳入 `test:ecosystem`，但 T-1165 仍保持未完成，直到双方对齐真实回调、刷新事件和双仓库 contract test。

## D-183：仅对 Task Horizon 前缀启用专用 externalRef 校验（2026-09-18）

- `taskhorizon:<blockId>:<localDate>` 由打卡侧提供 canonical 构造/解析；日期按本地公历严格校验，块 ID 拒绝冒号、空白和控制字符。
- 公共 `recordEvent` 写入仅在检测到 `taskhorizon:` 前缀时启用专用守门，并要求 `source: "api"`；番茄钟、快捷指令等其它 externalRef 前缀保持原有通用语义。
- malformed Task Horizon identity 返回 `undefined`，不自动修正、不截断、不把后台同步伪装为用户完成。
- 公共 API 与生态规范化都先以同一首尾空白策略识别 `taskhorizon:`，避免“规范化入口拒绝、直接 API 入口接受”的分叉。

## D-184：Task Horizon 合作用机器可读清单作为单一对齐入口（2026-09-18）

- 契约 JSON 固定协议版本、能力、方法、单位、externalRef 前缀、刷新事件白名单和摘要限制；运行时导出同形快照，测试阻止两者漂移。
- 日历消费者只对四类刷新事件重查：新记录、分析刷新、自动归档和手动更新；创建/删除等事件不直接触发聚合重算。
- 清单只描述公开 API，不承诺 Task Horizon 私有块监听、配置存储或 UI 实现。

## D-185：Task Horizon 示例只实现公开 facade 消费（2026-09-18）

- 示例负责能力协商、日期摘要读取、公开刷新事件订阅、`recordEvent` 写入和注销；块发现、原生复选框触发与日历渲染由对方插件保留。
- 示例失败时返回明确的 `unavailable` / `not-ready` / `capability-missing` / `target-missing` 状态；重试必须复用同一 blockId+localDate，不创建随机 externalRef。
- 订阅回调接收 `checkin.subscribe` 传出的事件详情对象本身，不再误读 DOM `CustomEvent.detail`。

## D-186：bridge 只为抛错保留待重试写入（2026-09-18）

- `recordEvent` 返回 `undefined` 的语义同时覆盖重复和拒绝，示例不能把它当作网络失败自动堆积；只有 Promise 抛错才进入 pending 队列。
- pending payload 保存原始 `itemId`、单位和 canonical externalRef，重试不生成新身份；重试统计与队列快照均为防御性副本。
- 刷新和诊断回调的异常不应形成未处理 rejection，也不能阻断 bridge 的注销流程。

## D-187：recordEvent 重复结果按现有运行时语义记录（2026-09-18）

- 现有实现检测到相同 `itemId + source + externalRef` 时返回已有事件的防御性副本；这不是新写入，但也不是拒绝。
- 合作消费者只在返回 `undefined` 时停止处理；重复结果沿用原 externalRef，不创建随机替代身份。
- 本轮只修正文档、机器清单、示例和测试，避免为契约文字变更破坏已有消费者。

## D-188：bridge 先验协议再协商能力（2026-09-18）

- 公开消费示例先检查 `describe().protocol === "siyuan-checkin"` 与 `version >= 4`，再等待就绪和检查能力，避免把其它 facade 当成兼容 API。
- `describe()` 抛错或协议不匹配只返回诊断状态，不订阅、不读取、不写入；缺少 `describe()` 的旧兼容 facade 仍可按既有能力检查流程工作。

## D-189：bridge 初始化失败必须撤销已注册监听（2026-09-18）

- `whenReady()` 异常返回 `ready-error`，协议版本非有限数值视为不匹配；这些失败均不进入订阅阶段。
- 摘要首读发生异常时主动调用已返回的 unsubscribe，再返回 `read-failed`，避免消费者重试后叠加重复刷新监听。

## D-190：重试统计不把明确拒绝伪装成成功（2026-09-18）

- `recordEvent` 返回 `undefined` 表示确定性拒绝：从 pending 传输队列移除，但 `retryPending()` 只增加 `rejected`，不增加 `succeeded`。
- 只有返回事件对象才计入成功；再次抛错的 payload 保留在队列，便于后续恢复后重试。

## D-191：pending 重试采用单飞而非丢弃并发请求（2026-09-18）

- 多个刷新事件可能在同一时间触发重试；bridge 复用当前 in-flight promise，让所有调用方观察同一组统计结果。
- promise settle 后释放锁；失败 payload 仍保留，因此下一次显式重试不会被永久阻断。

## D-192：bridge 启动与停止遵循同一生命周期锁（2026-09-18）

- 并发或重复 `start()` 共享一个初始化 promise，成功后直接返回已选项目，不重复订阅或首读摘要。
- `stop()` 设置终止标记；若就绪探测尚未完成，后续步骤在订阅/刷新前后再次检查并返回 `stopped`，避免迟到副作用。

## D-193：摘要刷新采用单飞合并事件风暴（2026-09-18）

- 同一 bridge 的并发 `refresh()` 调用共享进行中的 Promise，避免多个订阅事件重复读取同一日期摘要。
- 读取或回调失败时 Promise 正常 reject 并释放锁，下一次刷新仍可重新尝试，不缓存失败结果。

## D-194：摘要单飞键必须包含请求范围（2026-09-18）

- in-flight map 使用请求日期区间与 `summaryOptions` 的序列化组合键；只有完全相同的读取才共享 Promise。
- 不同区间或选项允许并行读取，避免性能优化改变调用方请求的语义范围。

## D-195：写入单飞按 canonical externalRef 隔离（2026-09-18）

- 同一 `taskhorizon:<blockId>:<localDate>` 的并发写入共享 Promise，确保重复回调不会制造多次 transport 请求。
- 不同 externalRef 使用独立 map 条目，保持多个任务完成事件的并行吞吐。

## D-196：停止优先于迟到摘要副作用（2026-09-18）

- `stop()` 与进行中的摘要读取竞态时，读取结果仍可自然完成，但不得调用 `onRefresh`，并向调用方返回 `undefined`。
- 停止后的新 `refresh()` 继续短路为空结果，避免卸载后重新建立读取活动。

## D-197：facade 探测 getter 异常转稳定启动状态（2026-09-18）

- `hasCapability()` 抛错返回 `capability-error`，`getItems()` 抛错返回 `items-error`，并通过统一 `onError` 诊断通道报告。
- 只有返回正常但能力不足时才使用 `capability-missing`；不把宿主 getter 异常伪装成用户配置缺失。

## D-198：生态 facade 返回形状先校验再消费（2026-09-18）

- `getItems()` 必须返回数组；其它形状返回 `items-invalid`，避免在消费端调用 `.find` 产生未处理异常。
- 订阅事件的字段访问也处于诊断边界内，恶意 getter 不得阻断宿主事件分发。

## D-199：目标事项字段读取纳入同一诊断边界（2026-09-18）

- `archived`、`name`、`id` 等目标选择字段由宿主对象提供，任一 getter 抛错均返回 `items-error`。
- 不改变正常目标缺失的 `target-missing` 语义，避免把数据异常误报为用户没有配置事项。

## D-200：订阅建立与事件消费分别隔离异常（2026-09-18）

- `subscribe()` 建立阶段抛错返回 `subscribe-error`，不进入首读或伪装成读取失败。
- 订阅后的单个事件 payload 异常只报告 `event`，不自动停止 bridge；后续事件仍可继续处理，卸载仍由 `stop()` 负责。

## D-201：重试结果显式区分传输失败（2026-09-18）

- `retryPending()` 返回 `succeeded`、`rejected`、`failed` 三个互斥计数；三者之和等于本轮 `attempted`。
- `failed` 仅表示 transport 抛错，payload 留在队列；`rejected` 表示 API 确定拒绝并从队列移除。

## D-202：停止只截断未开始的重试项（2026-09-18）

- 重试循环每次发起前检查 stopped；停止时当前已发起的 Promise 不强行取消，避免留下不确定的外部写入状态。
- 尚未开始的 payload 保持当前实例的 pending；宿主若要跨生命周期接管，必须先通过 `getPendingCompletions()` 导出并自行保存，再按公开写入入口恢复。

## D-203：30 项契约矩阵作为生态回归最小批次（2026-09-18）

- 本轮把输入、启动、能力、事项、订阅、停止、刷新和重试边界合并为 30 个可执行项目；测试显式断言矩阵长度，防止后续删减而不被发现。
- 矩阵只验证公开 facade 与 bridge 行为，不把真实思源宿主或对方插件联调伪装成自动化证据。

## D-204：第二批稳定性矩阵独立计数（2026-09-18）

- 第二组 30 项专门覆盖重复调用、区间键、返回值形状和停止后短路，与第一组输入/启动异常矩阵分开计数。
- 两组矩阵都保留长度断言，合计 60 项自动化契约项目；不以重复日志代替真实 API 断言。

## D-205：第三批日期矩阵覆盖真实 externalRef 结果（2026-09-18）

- 15 个合法日期必须返回精确的 `taskhorizon:<blockId>:<localDate>`，15 个非法日期必须返回 `undefined`。
- 日期矩阵独立于启动/并发矩阵计数，覆盖闰年与世纪年规则，避免只测试正则格式而遗漏日历语义。

## D-206：第四批身份矩阵尊重 trim 语义（2026-09-18）

- 合法 blockId 覆盖 Unicode、数字和常用符号；非法集合只使用契约明确拒绝的空白、冒号、控制字符与超长值。
- 首尾空白按现有 canonical 规则 trim 后再判断，不把可接受的输入误报为非法。

## D-207：第五批事件矩阵严格按刷新白名单（2026-09-18）

- 允许事件只限契约中的四类 `checkin:*` 刷新通知；重复出现仍逐项触发刷新。
- 未知、大小写污染、空值、非对象和恶意 getter 事件全部忽略或诊断，不读取私有 payload，也不产生摘要副作用。

## D-208：第六批锁定版本数值与 capability 真值语义（2026-09-18）

- 协议版本继续使用 `Number(version)` 后的有限数值比较，v4 及以上接受，NaN/Infinity/低版本拒绝。
- capability 按 facade 的真值契约判断，非布尔真值仍视为支持；矩阵记录现状，避免消费者擅自收紧公共兼容面。

## D-209：第七批锁定摘要请求透明透传（2026-09-18）

- bridge 不改写调用方传入的日期范围，也不解释或裁剪 `summaryOptions`；约束与防御性投影由公开 facade 负责。
- 30 项矩阵分别验证范围和选项原样到达 facade，避免单飞键优化造成跨请求结果串用。

## D-210：第八批锁定目标事项选择优先级（2026-09-18）

- 未指定 `options.itemId` 时只自动选择首个未归档且名称精确等于“任务打卡”的事项；不做模糊匹配或多语言猜测。
- 显式 `itemId` 优先于自动候选，并原样交给公开写入 API；bridge 示例不读取对方私有映射。

## D-211：第九批锁定最小五字段写入 payload（2026-09-18）

- bridge 写入只发送 `itemId`、`value`、`unit`、`source`、`externalRef` 五个字段；固定值为 `1`、`个`、`api`。
- 不附加 Task Horizon 私有块数据、标题或完成原因，externalRef 是双方唯一共享的任务完成身份。

## D-212：第十批按完整写入身份做单飞（2026-09-18）

- `recordInFlight` 与 pending map 使用 `[itemId, source, externalRef]` 复合键；externalRef 相同但 itemId 不同不属于同一幂等写入。
- 当前 bridge source 固定为 `api`，但仍纳入键以保持与内核幂等身份契约一致，避免未来扩展来源时再次误合并。

## D-213：300 项压力批次使用生成式而非重复手写（2026-09-18）

- 300 项由确定性循环生成：100 个合法日期/身份、100 个日期日值为 00 的非法输入、100 个含冒号的非法 blockId。
- 每项都经过真实 bridge 入口；矩阵断言总数、全量通过和实际 transport 次数，避免只扩大日志而没有覆盖证明。

## D-214：第二个 300 项批次验证 replay 透明性（2026-09-18）

- replay 矩阵只要求 bridge 两次调用保持完整身份和 pending 语义稳定，不在消费者侧缓存或假造已有事件。
- 每次调用仍进入公开 `recordEvent`，由 facade 决定新事件或已有事件，避免示例掩盖真实幂等边界。

## D-215：v16 先建立可追溯比较纯函数（2026-09-18）

- 复盘对比先消费已经构建好的 `SummaryContext`，不在比较层重新扫描 store，确保指标沿用现有日期、修订和配额口径。
- 比较结果只输出范围元数据、标量 delta 和逐项目标并集；缺失侧补零，输入对象不被修改，为后续 UI/周报/预测复用提供稳定基线。

## D-216：跳过态以可选事件字段表达，store 版本 2→3（2026-09-19）

- `CheckinEvent` 新增可选 `kind?: "checkin" | "skip"`；缺省（undefined）与 `"checkin"` 同义，历史数据零迁移、语义不变。不采用「value=0 的完成」也不复用 `source`——跳过不是完成值，来源（手动/番茄/导入/API）与记录形态正交。
- `normalizeEvent` 只接受精确的 `"skip"`/`"checkin"`，其他值一律规约为 undefined（不物化缺省值）：既满足 D-157 指纹纪律，又避免 10 万级事件每条多存 `"kind":"checkin"` 的存储膨胀。统一判断入口为 `isSkipEvent(event)`（`event.kind === "skip"`），禁止散布字符串比较。
- `STORE_VERSION` 2→3：normalizeStore 在读入时本就重打当前版本号，迁移由「加载→归一→下次持久化」自动完成，不做独立迁移器；v2 数据升级无损（全部缺省 kind 等价于 checkin）。
- 前向兼容（旧插件读 v3 数据）：旧版本 normalizeEvent 逐字段构造事件，自然丢弃 kind——旧版本回写会使跳过标记丢失，属已记录的跨版本限制，恢复点可回滚；不做双向写兼容。
- 墓碑兼容：`CheckinEventTombstone` 以 eventId 标识，skip 事件删除走同一墓碑通道，无结构变化。
- 智能体 API 边界（D-211 五字段写入 payload）不变：生态不能写入跳过（跳过是用户显式行为），`recordEvent` 返回的防御性事件副本携带 kind 只读字段。
- SKIP 的统计口径（streak 中性、完成率分母剔除、热力图中性色、配额不吃量）在计算层落地（T-1221），不改写任何历史事件。

## D-217：弹性配额自动补全（AUTO）只存在于计算层（2026-09-19）

- 仅 quota 排期（每周/月 N 次）在**当期配额已达成**时推导 AUTO 日：达成日（第 N 个贡献日）之后的期内剩余日为 AUTO；非 quota 排期不推导。
- AUTO 不落事件、不产生通知、不改写历史——与跳过同属计算层口径，指标可追溯到原始事件。
- 优先级（消费者侧约定）：真实完成 > SKIP > AUTO。`deriveQuotaAutoDays` 产出候选时不覆盖有真实事件的日期；SKIP 日由消费者按跳过处理（跳过冻结优先于自动补全）。
- `evaluateQuotaSchedule` 的调用方约定沿用 T-1221：传入事件须先剔除 skip（getProgress/insights 已过滤）；deriveQuotaAutoDays 内部再防御一次（`event.kind !== "skip"`，因 rules 不可反向依赖 model）。
- AUTO 日视同已完成机会日：计入 streak（T-1226）、计入强度分数的当日完成度（配额达成期 isComplete 本就为真）；年度热力图仍以真实事件计热度（AUTO 不制造热度）。
- 窗口与 asOf 双重裁剪：AUTO 不推导到 asOf（含）之后，避免未来日伪造连续。

## D-218：笔记锚点回写是尽力而为的旁路（2026-09-19）

- 锚点为项目级 opt-in：`CheckinItem.noteAnchor = {blockId, appendNotes?}`；只写用户明确绑定的一个块（文档 ID 亦是合法块 ID），绝不写其他位置。
- 属性键固定 `custom-lv-checkin`（小写连字符，custom- 前缀避免与思源内置属性冲突）；值为一行人类可读文本 `YYYY-MM-DD · 状态 · 连续 N 天`，属性面板直接可见。
- 回写发生在打卡持久化成功之后，是 fire-and-forget 旁路：失败不回滚、不重排打卡队列；`withBoundedRetry` 最多 2 次（间隔 1.5s），仍失败则内存挂起该锚点（本次会话不再尝试）+ 审计记录（新增审计类型 `anchor`）。
- 清理语义：`setBlockAttrs` 是合并语义，清除 = 空串覆盖本插件键，不触碰其他属性。解绑（编辑器清空保存）与 `uninstall()` 都逐块清除；卸载时块可能已删——逐个尝试、失败不中断，插件存储保留使重装后绑定关系可恢复。
- 内核调用只使用已验证端点：`/api/attr/setBlockAttrs`、`/api/block/getBlockInfo`、`/api/block/appendBlock`；统一经 `fetchSyncPost`（前端会话鉴权，无需令牌）。
- 撤销策略：取消打卡/取消跳过会重写状态属性（unskip 文案）；但 T-1232 追加的备注块属于用户文档内容，撤销不删除（尊重用户文档主权）。
- 多窗口：锚点属性写入走内核 API 天然 last-writer-wins；打卡数据本体仍由存储锁保护。挂起标志是内存态，重载即重置，避免永久禁用。

## D-219：负向习惯采用被动型 at-most 语义（2026-09-19）

- `CheckinItem.direction?: "atMost"`（缺省缺省值即 at-least，不物化；仅 daily 排期支持——normalize 时非 daily 丢弃 direction，编辑器限选每日）。
- 被动型戒除语义（uhabits AT_MOST 同源）：不记录即成功，零打卡负担。`isComplete` 反转 = 当日无真实事件（progress ≤ target）；记录事件 = 破戒日。跳过日不算成功也不算失败（isComplete=false、完成率分母剔除，与 at-least 跳过口径一致）。
- 连击：at-most 项连续 = 自今日向前的连续无破戒日（跳过日桥接、破戒日断链、回溯止于 createdDate）——与 at-least 走同一条 `computeEventStreaks` 通道，仅分支判定不同。
- 强度分数：at-most 完成日 1、破戒日 0（不按比例），冻结规则不变。
- UI：binary at-most 的主按钮语义 = 「记破戒 / 撤销破戒」（按当日是否已有破戒事件切换）；无破戒日卡片进「已完成」折叠区（被动成功的自然呈现）。仅每日排期，不与 quota 组合（语义无定义，编辑器禁用）。
- 撤销：破戒记录的撤销 = 删除当日事件（墓碑通道），与其他事件一致。

## D-220：卸载路径自带预算与写门禁（2026-09-19）

- 思源把同一插件实例的 `onload`、`onLayoutReady`、`onDataChanged`、`onunload`、`uninstall` 放进**同一份**拆除预算（`siyuan` 类型包 `siyuan.d.ts` 的 Plugin 生命周期注释；宿主实现 `app/src/plugin/lifecycle.ts`，当前 5000ms），超时强制销毁且**不代插件清理** `setInterval`/`setTimeout`/`window` 监听（`app/src/plugin/uninstall.ts` 只回收命令、顶栏、dock、状态栏、图标、样式与 eventBus）。
- 插件自计 `TEARDOWN_DRAIN_BUDGET_MS = 3600` 排空 `mutationQueue`/`saveQueue`/`focusOperation`，再用 `TEARDOWN_FLUSH_BUDGET_MS = 900` 补写，留 ~500ms 余量给宿主的 `uninstall` 与 DOM 拆除；等待结果区分 `done`/`failed`/`timeout`，未落在预算内时用 `msg.teardownTruncated` 明确告知用户，而不是静默截断。
- 拆除期写门禁（`src/teardown.ts` `createTeardownWriteGate`）：`onunload` 入口 `deferWrites()`，队列内每个变更照常读盘合并但跳过各自的 `persist()`，收尾一次写主存储。理由：单次 `persist()` 是「读备份-写备份-写主档-回读校验」四次整文件 IO，逐个落盘在预算内排不完，越靠近超时时丢的恰是最新一条打卡。
- 补写不生成快照历史（省两次 IO），快照由下一次正常写入补齐；补写用 `navigator.locks` 的 `ifAvailable` 先试，锁被其它窗口占用时退回普通排队，避免在跨窗口锁上无限等待。
- 卸载时专注进行中：先 `finishFocusTimerFor(host, true)` 把已投入分钟数入账，再 `stopFocusTimerFor(host)`，最后才置 `acceptingOperations = false`——顺序颠倒会被 `enqueueMutation` 直接丢弃（已入账的写由写门禁合并进同一次补写）。
- 庆祝提示的 6s 延时挂到宿主 `focusCelebrationTimer`，与秒级心跳一起由 `stopFocusTimerFor` 回收；两处回调都以 `disposed`/`disposing` 早退。
- 已知未修：`docs/siyuan-compatibility.md` 原声明「未直接依赖思源内部 DOM」与代码矛盾，本轮改为如实登记三处耦合点（见 T-1243 与 `tests/block-dom-compat.test.cjs` 的守门）。

## D-221：onDataChanged 的辅助存储原样重写（已知写放大，2026-09-19）

- 真实例双窗口 E2E（`tests/e2e/dual-window-data-change.spec.mjs`）实测：接收方**没有**回写主存储（合并语义正确），但一次数据变更会写两个辅助存储 `checkin-suggestion-workflow` 与 `checkin-store-audit`。
- 其中 suggestion-workflow 是「反序列化后原样再序列化写回」，属于可消除的写放大；每一轮辅助写都会再触发内核 `PushPluginStorageDataChanged`（`kernel/api/file.go:744`）向其它实例推送 dataChange，形成额外的往返。审计写回是合理的（合并冲突要留痕）。
- 本轮不改：消除它需要给这两个通道加「内容未变不写」的等值判断（并明确建议工作流状态的归属窗口），属于独立任务；已在 TODO 记 T-1246 并用该 E2E 作为验收依据。

## D-222：真实例 E2E 揭示的宿主约束与只读/移动端形态（2026-09-19）

- 只把 `dist/` 拷进 `<workspace>/data/plugins/` **不会加载插件**：启用状态在 `data/storage/petal/petals.json`（`getPetals0`），桌面端还要 `conf.json` 的 `bazaar.trust=true`（`IsPetalsEnabled`）。E2E 因此在启动后调 `/api/setting/setBazaar {trust:true}` + `/api/petal/setPetalEnabled {packageName, enabled:true}`，并用 `/api/petal/loadPetals` 反查确认内核真的下发了 `index.js`。
- `--readonly` 是 `serve` 子命令的旗标且取字符串值（`SiYuan-Kernel serve --help`），必须写在 `serve` 之后：`serve --wd=... --port=... --readonly true`；写成全局旗标会被 cobra 拒绝并打印帮助。只读角色下 `putFile` 与 `setPetalEnabled` 都会被 `CheckAdminRole`/`CheckReadonly` 拒绝，所以只读实例复用同一工作区、只做读取与「写不进去」的断言。
- 跨实例通知的真实链路已验证：前端 `saveData` → `POST /api/file/putFile` → 内核 `PushPluginStorageDataChanged`（`kernel/api/file.go:744`、`kernel/model/push_reload.go`）→ 其它前端实例收到 `reloadPlugin` 的 `dataChangePlugins` → 命中我们覆写的 `onDataChanged`（宿主规则：未覆写基类 `onDataChanged` 的插件会被整插件重载）。
- 实测数据：禁用插件到 `window.siyuanCheckin` 交出 <5s（宿主拆除预算内），注销后 2.6 秒观察窗口内该页面对内核零次 `putFile`——即 D-220 的定时器回收在真实宿主里成立。
- 断言口径：接收方允许写审计（合并冲突要留痕），但**禁止**原样重写建议工作流与主存储；插件注销后**禁止**任何写入。移动端 bundle（`/stage/build/mobile/`）下只用公开 API 与 `#lcCheckinMobileTopBarButton` 注入点断言，不依赖桌面 dock/页签。
- 存储文件路径与命名由宿主决定：`/data/storage/petal/<pluginName>/<storageName>`，**无扩展名**，内容是值的原始 JSON（`app/src/plugin/index.ts` saveData/loadData）。E2E 用 `/api/file/getFile` 直读该文件作为「真落盘」判据，而不是只看内存。

## D-221 补记（2026-09-19，T-1246 已修）

- 上条「本轮不改」已在本轮完成：`persistSuggestionWorkflow` 增加与已落盘文本的等值判断（两条读取路径都建立基线，非字符串存储清空基线以保证真写），审计改为 `scheduleAuditPersist()` 的 1.5 秒合并窗口并在 `onunload` 收尾落盘。
- 验收：`tests/e2e/dual-window-data-change.spec.mjs` 断言接收方 `checkin-suggestion-workflow` 写入数为 0、`checkin-store-audit` 至多 1；`tests/aux-write-hygiene.test.cjs` 锁定实现口径。实测辅助写入由 2 次降为 0 次。

## D-223：智能体接入状态要能自证，并与存储读取解耦（2026-09-19）

- 现象：宿主为 3.8.4、插件为 17.0.0 且智能体已开启，设置页仍显示「未检测到可用的思源智能体入口」。
- 根因：该文案只反映插件自己的 `agentCapabilityRegistered` 布尔值，而注册调用被放在 `onLayoutReady` 里存储读取 `try` 的成功分支内——数据读取失败（迁移/损坏/权限）时会整段跳过注册，于是「读数据失败」被伪装成「宿主没有智能体」；同时它也无法区分宿主不支持、还没轮到注册、注册中途抛错三种情况。
- 真实接入状态（已用 `tests/e2e/agent-capabilities.spec.mjs` 在真宿主上验证）：`addAgentCapability` 存在于 3.8.0+ 前端；注册成功后宿主把能力记在实例的 `agentCapabilities`（id 形如 `plugin/frontend/siyuan-checkin/<能力名>`），默认策略为 allow，被 `设置 - 人工智能 - 能力` 逐个拒绝才对模型不可见。
- 改法：`agentCapabilityState` 四态（`pending`/`registered`/`unsupported`/`failed`）+ `agentCapabilityIds`（回收宿主返回的 id）+ `agentCapabilityError`；注册调用移到 try/catch 之后无条件执行（读能力自带「数据尚未准备好」返回，写能力由 `canRecord()` 守卫）；设置页按状态给不同文案并附「已注册 N 项」与核对位置，旧 `set.agentOff` 键退役。
- 边界：能力注册发生在 `onLayoutReady` 末尾，改插件后要重载界面或重新启用；智能体对话沿用本轮不可变的能力快照，需新开会话。

## D-224：移动端浮层裁剪、双层胶囊与原生容器导出通道（2026-09-19）

- 现象（用户截图）：手机端回顾页工具栏控件错位；「报告设置」「更多」「自定义」点开后的下拉被遮住；点「导出报告」思源整个重启。
- 浮层裁剪根因链（全部在真实移动 bundle 里量出来，不是推断）：
  1. `src/ui/components.scss` 里移动端「Review mobile toolbar stays on one rail」块把 `.lc-checkin__header-actions` 设成 `overflow: hidden`，而下拉是绝对定位在该容器内 → 220px 高的菜单只剩约 8px 可见。改为 `overflow: visible`（横向滚动本来就由 `.lc-checkin__range-tabs` 自己的 `overflow-x: auto` 承担）。
  2. 改完仍被统计卡片压住：移动端「Final mobile review」块把 `.lc-checkin__editor-header` 设为 `position: static`，而更早的移动端规则给它的是 `position: sticky; z-index: 4`——static 之下 z-index 失效，头部失去层叠上下文。改为 `position: relative; z-index: 8`（8 高于回顾子导航的 6）。
  3. 结论：绝对定位浮层的祖先链上，任何 `overflow: hidden` 与「靠 z-index 但 position 是 static」的组合都会吃掉它。
- 工具栏错位根因：`.lc-checkin__text-button` 的全局 `margin-top: 15px` 被工具条按钮和菜单项继承（组内按钮比相邻 summary 低 7px、菜单每项多出 15px 空洞）；同时 14.0 之后工具条自身已改成容器样式，但内层 `.lc-checkin__review-tool-group` 仍保留独立胶囊（边框+底色+内边距），形成「胶囊套胶囊」并把行高撑到 46px。修法：组容器去边框去底色归零内边距、工具条内按钮与菜单项 `margin: 0`、summary 与按钮统一为方角无边框透明底、移动端 `justify-content: flex-start`（原先 space-between 把「更多」推到最右留出空洞）。
- 导出重启根因：所有导出都走 `URL.createObjectURL(blob)` + `<a download>`。桌面与浏览器没问题，但思源 Android/iOS/鸿蒙客户端的 WebView 没有下载处理，blob 导航会打到宿主自身——表现为「点导出，思源重启」。
- 修法（`src/download.ts`）：检测到容器原生桥时改为「先 `/api/file/putFile` 写 `assets/`，再把绝对 URL 交给宿主 `saveExportFile`」，宿主按前端能力拒绝（`status:"error"`）时退回容器桥，成功时不重复触发；原生路径下**任何情况都不再产生 blob**（包括失败路径，失败只报错）。桌面/浏览器保持原行为。7 处导出入口统一改走这一条通道，Loop 双文件顺序 await 避免两个保存面板叠加。
- 副作用（已在 README 与 `docs/export-formats.md` 说明）：手机端导出会在工作区 `assets/` 留下文件，与思源自身导出行为一致。
- 遗留：思源的临时提示条（`#message`）在移动端会盖住回顾页工具栏，测试里必须先移除才能点中按钮——记 T-1257。
## D-225：发布 ZIP 使用固定时间戳并由门禁核对摘要（2026-09-19）

- `package.zip` 的每个条目固定 `mtime=1980-01-01`，避免 yazl 使用当前时间导致同一源码重复构建产生不同字节。
- 发布资源测试读取当前 `package.zip` 并计算 SHA-256，必须与 `release-notes-vX.Y.Z.md` 中的摘要完全一致；非零格式检查不再视为充分证据。
- 固定时间戳只约束归档元数据，不改变插件文件内容；若将来改变打包文件集合或压缩实现，摘要必须随构建重新生成并通过门禁。
## D-226：宿主 i18n 资源与运行时字典分层（2026-09-19）

- `addCommand` 使用思源宿主识别的 `langKey`，不再提供 `langText`；对应键随包放入 `i18n/zh_CN.json` 与 `i18n/en_US.json`。
- dock 和顶栏 API 的类型不支持 `langKey`，因此继续提供必需的 `title`，但标题由插件自身 `t()` 根据当前插件语言解析；资源文件仍登记同一组宿主文案，便于宿主命令面板和未来 API 扩展复用。
- 自动化只验证资源随包和键完整性；英文思源界面的最终显示仍属于真实宿主验收，不将构建测试当作 UI 证明。
## D-227：E2E 安装插件必须复制完整发布树（2026-09-19）

- E2E 工作区安装应模拟思源收到的完整生产包，而不是假定 `dist/` 顶层只有文件；`i18n/` 等目录资源必须递归复制。
- 安装前置可以对关键嵌套资源做存在性断言，尽早区分「包内容缺失」和「宿主加载失败」。
- 旧隔离工作区的 `.lock` 不由测试自动删除或强杀；遇到残留锁时改用新的带标记工作区，避免误触用户数据。

## D-228：回顾页本地建议只执行低风险元数据变更（2026-09-19）

- 回顾英雄卡的「查看建议影响」正式接入既有建议工作流，不再保留不可点击的“即将开放”占位；确认仍必须经过一次性令牌、字段原值冲突检查、主存储写后校验、独立审计和可撤销边界。
- 本地统计只能证明“某项目完成率相对较低”，不能自行推断合理目标或排期。因此本地建议只把尚非 high 的关注项目提升为 high 优先级，不改目标、单位、频率、修订或历史事件；更复杂调整继续由智能体/用户提供明确变更。
- 建议文案必须与实际变更一致；若所有薄弱项目都已是 high，则不伪造另一项可执行变更。

## D-229：周期对比先汇总、后分批明细（2026-09-19）

- 「较上一周期」常驻区先用一张双序列汇总图表达记录数、完成项目数和安排项目数，本期与上期在每个指标内独立归一，精确数值仍并列显示。
- 逐项目变化保留在外层折叠区；首批最多显示 8 项，后续每个原生 `details` 最多再展开 8 项，摘要同时标注本批数量与剩余数量。这样 20+ 项不会一次生成视觉长墙，也不隐藏总数量。
- 项目仍按完成率变化绝对值、记录变化绝对值、名称的稳定顺序排序；分批只改变呈现密度，不改变比较口径。

## D-230：移动端宿主提示避让使用实时几何而非设备常量（2026-09-19）

- 思源 `#message` 在插件 DOM 外，提示内容和高度由宿主/系统环境决定；插件读取可见 snackbar 的真实边界，按工具栏自然位置计算额外偏移，不维护 Android/iOS/桌面模拟器高度表。
- CSS 动画可能只改变几何而不触发 DOM 属性变更，因此提示变化后连续采样约半秒；偏移以上下剩余可用空间为界，避免异常全屏壳把插件内容完全推走。
- 自定义范围是 fixed 浮层，必须锚到移动回顾工具栏的实际底边；否则工具栏避让后浮层仍停在旧坐标并拦截报告按钮。观察器、动画帧和 CSS 变量在 `onunload` 统一清理。

## D-231：打卡日志采用月 → 周 → 日的渐进展开（2026-09-19）

- 日志继续沿用「最近 14 个有记录日期」与同项目同单位聚合口径，只调整信息层级，不偷偷扩大统计范围或改变计数。
- 月份、周、日期均使用原生 `details`：首个可见月份自动展开，每个月只自动展开最新一周，每周只自动展开最新一天；打开旧月份时仍只出现一个已展开周/日，避免一次点击重新形成长墙。
- 每周先显示 4 天；单日先显示 6 个项目；同项目的逐条明细先显示 6 条。后续批次递归嵌套，每次最多增加同样数量，并在摘要中同时标明本批数量与剩余数量。
- 周按周一至周日计算。跨月周可以在相邻月份各出现一次周摘要，但日期只归属自身月份、不会重复计数；这样月份层语义清晰，也不把 9 月日期塞进 8 月分组。

## D-232：发布说明集中归档，未引用图标先保留（2026-09-19）

- 根目录只保留源码、构建入口、协议工作记录和插件发布必需资源；历史 GitHub 发布说明统一迁入 `docs/releases/`，当前版本也使用同一目录，避免发布脚本和门禁出现两套路径。
- `icon.png`、`preview.png` 由插件清单和构建门禁明确引用；`icon.svg` 当前无代码引用，但可能仍是设计源稿或外部 raw 链接，先保留并在布局文档登记，不把“未被构建引用”直接等同于“可删除”。
- `dist/`、`package.zip`、`.artifacts/`、`node_modules/` 属于被忽略的本地生成物，不做仓库内容搬运或提交。

## D-233：锚点搜索限定为插件已知绑定，创建使用公开文档接口（2026-09-19）

- 编辑器里的「搜索」只过滤插件主存储中已经绑定过的项目名称和块 ID；插件不把它包装成思源全库搜索，也不调用未登记的 SQL/全文搜索接口，避免权限、发布模式和版本差异造成误读。
- 「新建文档」采用思源公开 API：先 `POST /api/notebook/lsNotebooks` 列出未关闭笔记本，再由用户明确点击后调用 `POST /api/filetree/createDocWithMd`；返回文档 ID 后才写入表单。标题中的 `/` 和 `\` 转为全角斜杠，防止输入改变文档层级。
- 创建失败只显示错误并保留表单，不影响项目其它字段或打卡主路径；真实宿主下的按钮点击仍属于可选现场走查，不阻塞自动化开发。

## D-234：仓库整洁不以重写提交历史或删除未合并分支换取（2026-09-19）

- GitHub 的提交数量是可追溯历史，不进入插件发布包；现有版本标签和 Release 已引用这些提交，禁止为了缩小数字重写 `main` 或强推。
- 远端分支只在完全合并后进入直接删除候选；`--no-merged` 分支即使很旧，也必须先核对 patch 和文件差异。本轮 14 条已合并分支与 13 条未合并旧分支分别登记，不把两类混在一起。
- 删除远端分支属于 push。自主开发阶段只做只读审计和记录，不能绕过“不 push”协议实施远端清理。

## D-235：启动后校验与启动资格拆分，专注专用业务指纹（2026-09-19）

- 启动成功的正常结果就是计时器 active，把 `adapter.canStart()` 复用在启动后校验里必然把成功误判为失败并触发自动暂停（docktomato PR #5 评审第二节）；启动后只校验业务前提：未拆除、适配器仍为原对象、项目存在且当日可记录、专注专用指纹未变。
- `revisionFingerprint` 只比较日期修订，不含 `direction`、`tomatoMode`；专注链接入新增 `focusMappingFingerprint`（修订指纹 + 规范化 direction/tomatoMode），只用于专注启动后校验，不改写所有通用记录操作的指纹口径。
- 启动等待期间项目被删除/归档/改规则时走「只回滚本次会话」；通用适配器以 `adapter.stop()` 回滚，跨插件适配器的回滚由会话归属守门（D-236）限定在本次会话内。

## D-236：跨插件专注会话归属与纯解绑生命周期（2026-09-19）

- 底栏番茄钟适配器在实例闭包内维护 `ownedFocus`（provider 引用 + sessionId + itemId）；`facade.start()` 必须返回非空 sessionId 才登记归属，否则抛 `DOCK_TOMATO_START_UNCONFIRMED`——不猜测运行中的计时器是自己人，也不无条件暂停。
- 停止前守门：provider 引用一致、facade 未被 available:false 失效、status.active、sessionId 匹配、mode ∈ countdown/stopwatch（休息阶段可能沿用父专注 sessionId，一律不暂停）；能力含 `pause-session` 时携带 sessionId 调用原子按会话暂停，否则 getStatus 守门后调用旧 `pause()`（只能缩小误暂停窗口，跨会话原子性依赖提供方，已写入契约文档）。
- `available:false` 事件 detail 立即失效该 facade 并解绑；`available:true` 是同一对象恢复注册的唯一途径；无 detail 的旧事件保持兼容。
- 注销回调支持 `{stopActive:false}` 纯解绑（默认保持原停止行为兼容第三方）；facade 失效/替换/卸载/完成清理一律纯解绑——`releaseFocusAdapterFor` 只清本地登记，卸载路径对跨插件适配器不再调用 `stop()`（不模拟用户停止）。完成通知以 sessionId 匹配为准立即释放「正在专注」，不等待打卡入账，也不再用 5 秒全局空闲轮询 + `stopFocus()` 旁路。
- 完成事件过期：完成后番茄钟可能进入休息或新会话；`tomato:focus-ended` 仅作为重读状态提示，校验 sessionId 与阶段后再清理本地记录。

## D-237：完成回写持久收件箱与宿主侧幂等写入器（2026-09-19）

- 已接收未入账的完成通知持久化于私有存储 `checkin-docktomato-inbox`（schemaVersion 1，容量 200，满员拒绝新条目并提示，不静默丢弃）；只保存校验后的纯数据，`completedAt` 缺失或无效直接拒绝（invalid-completion-time），不回退为接收时间，完成日按首次接收的本地时区固定、重试不改写。
- 写入判定顺序固定：已入账（duplicate，检索全部事件含归档项目）→ 用户撤销墓碑（user-removed，永不补回）→ 项目可用性/映射/跳过日（blocked：missing-item / archived-item / not-scheduled / mapping-changed / at-most-item / skipped-day）→ 写入；该顺序必须先于项目检查处理幂等身份，否则自动归档后的重复完成通知会误报 missing-item。
- `atMost` 戒除类目标不参与自动专注打卡（启动资格、完成判定、写入边界三层拒绝）；完成值按完成日期的项目修订计算（单一代码路径 `dockTomatoCompletionValue`），跨午夜专注按完成日记账、不拆分。
- 跳过日策略：通知置 blocked:skipped-day 保留待处理，由用户决定是否撤销跳过后计入；不静默删除 skip、不无墓碑过滤（防同步复活）。
- 收件箱接收 → 写入 → 移除/标记在同一个 `enqueueMutation` 工作单元内完成；写入器 `recordDockTomatoCompletionUnlocked` 在已持有的存储锁内运行，禁止再经公开 `recordEvent` 重复排队（死锁边界）；跨窗口在锁内重读收件箱逐项合并 identity。
- 重试：暂时性失败按 1s/5s/30s 自动重试，之后保持 pending 等待手动/下次恢复；blocked 不自动重试；主存储成功但收件箱清理失败时，恢复后以 duplicate 收尾不再新增。恢复入口 `reconcileDockTomatoInbox` 在初始化就绪后与重试到期时驱动，仅在有待处理项时唤醒，无常驻定时器，卸载清理。
- 边界声明：收件箱只覆盖「已接收」的通知，不能弥补提供方未送达的事件；提供方仍须保证完成事件只在持久化成功后产生一次。

## D-238：minAppVersion 校准到实测基线 3.8.4（2026-09-20）

- 原 `plugin.json.minAppVersion = 3.4.2` 从未在该版本回归过,而渲染块 DOM 实测基线是 3.8.4、`addAgentCapability` 需 3.8.0+;声明一个未经测试的下限等于向用户承诺不成立的兼容性(T-1247 两条路径中,真机回归路径需用户操作、按既定策略跳过,故取「把下限提到实际验证过的最低版本」路径)。
- 代价如实告知:内核在版本不满足时会把已装插件**自动禁用**,3.4.2~3.8.3 的老用户升级后将无法继续使用,需要发布说明明确说明;兼容矩阵把 3.8.4 从「实测通过」改标为「声明最低版本」,并删除 3.4.2 的未验证阈值行。
- `block-dom-compat` 门禁新增断言:声明下限必须等于实测基线,防止未来再次出现「声明值低于实测依赖」的漂移。

## D-240：API v5 设计稿定稿为草案文档（2026-09-20,未实现）

- `docs/api-v5-design.md` 收纳 v4 生态实践暴露的四个缺口（范围读缺失/单条写入结果含糊/项目列表二分/派生指标无门面）与五项提案（events.range.read、events.record.batch、items.query、metrics.read、describe 协商补强）。
- 设计纪律沿用 D-211/D-227：有界、纯数据、显式结果、去重前置;批量写直接复用 docktomato 内部 writer 的分类骨架,单条 recordEvent 行为不变。
- 明确排除需隐私评估的摘要驻留项;实施切分为 v5-1 只读→v5-2 批量写→v5-3 指标门面三批,发布窗口待排期,本文档不构成实现承诺。

## D-241：日记集成撤销与幂等策略（2026-09-21）

- 周期报告写入用户绑定的思源文档（T-1352）是 opt-in 旁路：默认关闭，须用户保存合法文档 ID 并显式打开开关；未绑定/未启用时写入入口禁用，双条件缺一不可。
- 撤销策略与 D-218 同源：报告块属用户文档内容，打卡撤销/数据回滚不删除已写入的报告；用户在文档内自行删除。插件卸载不清空日记（区别于锚点 custom 属性清理——属性是插件命名空间，追加块是用户内容）。
- 幂等口径：不做自动去重——每次写入都是当前快照的新行；写入内容自带「## 标题 + 日期范围」，用户按日期辨识版本；设计上不提供定时自动写入，避免无人值守写用户文档（自动能力若立项须新决策）。
- 失败隔离复用锚点通道：withBoundedRetry（2 次/1.5s）+ 失败写审计（type=anchor, channel=diary-report）+ 用户可见提示；appendBlock 只追加不修改既有内容。
- 写入口径与回顾页导出完全一致（同一 buildWeeklyReportMarkdown 路径：来源筛选/区块开关/偏差解释全生效），不另造报告实现。

## D-242：CSS 预算重新收紧（2026-09-21，替代 D-246 的报告口径）

- D-246 因 UI 迭代期暂停的体积门槛自 v19 维护态起恢复：硬阻断 640KB、620KB 警告（tests/css-hygiene.test.cjs），数字按当期实测 599,941 bytes + 余量核定；此前 480/520KB 线（D-239）随功能扩容（模板/渲染块/日记集成）作废。
- 同步落盘维护态工具 scripts/css-audit.cjs：类引用审计（583 token 零死类）+ 重复规则护栏（esbuild 已合并大部分，阈值 10KB）；审计结论是历史清理（T-103~T-105 等）后已无死样式可删，后续新增样式必须同步语义 token，防止回潮。
- 门禁挂载：css-hygiene 与 checkin-block（含渲染块 1k/10k/100k 性能三档，T-1355）并入 test:extended。

## D-243：不立项自建同步，跨设备由思源同步承载（2026-09-21，T-1370 决策门）

- 结论：v22 同步决策门为「不立项」。插件数据（saveData/loadData）天然位于思源工作区，用户开启思源同步即获得跨设备；插件侧已具备跨设备配合能力——onDataChanged 重读合并、version-conflict 诊断与冲突审计、恢复点与导出备份。
- 自建同步（含端到端加密自建通道）与「不自建同步服务、无账号体系」边界冲突，且引入服务端/密钥/冲突策略三类长期成本，收益被宿主同步覆盖。
- 立三个配套改进项随常规迭代交付：跨设备冲突用户文案（诊断已落）、恢复点跨设备语义声明（恢复指南已含）、导出即迁移定位强化（不做双向同步）。
- 重启条件：用户明确跨设备需求且宿主同步被证实不足；须新决策记录含密钥/加密、服务端形态、账号边界豁免论证与迁移退路。详见 docs/sync-design-review.md。

## D-244：头像设置的单一可见来源与自定义状态（2026-09-21）

- 头像设置同时支持预设、短文字和本地照片，但界面始终只显示一个来源：照片上传后优先显示照片；清除照片后恢复已保存的预设/文字值。
- 预设下拉新增本地化的「自定义文字」占位状态；当存储值不是六个预设之一时该状态被选中，避免重渲染后错误显示为「勾选」。预设标签与自定义状态不得绕过插件 i18n 字典。
- 该轮不在选择预设时自动删除照片，用户可用显式「清除照片」恢复文字/预设；这样切换设置不会造成不可逆的本地数据丢失。

## D-245：头像图片拒绝超限，不截断 data URL（2026-09-21）

- 头像图片在 `FileReader` 前按 700 KB 文件大小拒绝，避免读取大文件后截断字符串造成损坏图片。
- 合法图片的 data URL 必须完整保存；超过内部 1,000,000 字符上限的读取结果也拒绝保存，不做静默截断。


## D-264：v18.2.1 后本地自主线与宿主现场线分离（2026-09-23）

- v18.2.1 是当前发布基线；docs/development-roadmap-v18-v22.md 降级为 v18～v22 已交付代码/设计历史基线，下一阶段以 roadmap-current、roadmap-product-strategy-2026-09.md 和 implementation-roadmap-product-strategy-2026-09.md 为真值。
- 未来工作分为两条证据线：本地线可自主做纯投影、契约、结构 UI、导入预览、性能、恢复和文档一致性；宿主线保留思源桌面、页签、dock、Android、外部插件和真实消费方现场任务。
- 隔离内核 E2E 使用仓库自建、带标记的临时工作区时属于自动证据，可以运行；它不能替代真实 Android、用户工作区或外部插件联调。
- 新增提醒/注意力、生命周期/数据治理、隐私控制面、架构准入、质量度量、时间/日历契约和可保存视图七个横切方向，总方向扩展为 23 项；不改变 Store v3，除非后续迁移评审证明必要。
- 本轮不执行真实设备、外部账号、上游 issue/PR、push、发版、积分/同步/隐私自动写入等需要用户操作或判断的工作；自动证据不能关闭 host-pending、external 或 decision 任务。


## D-265：T-1400 第三轮调研结论——戒断里程碑与一键插入采纳，Pinch 列为竞品深评（2026-09-23）

- 四路增量扫描（GitHub/Obsidian·Logseq/思源集市+官方需求/独立应用+量化自我）约 30 候选，采纳 2：T-1415 戒断里程碑投影（at-most 项目的阶梯只读投影，零存储变更）、T-1416 渲染块一键插入预设（降低笔记内嵌打卡上手门槛）；延后 6、不做 3（积分乘数、社交挑战、「数据住笔记里」哲学转向）、佐证 6，全案见 benchmark 第十二节。
- 竞品警报：royc01/pinch 与本插件功能覆盖面几乎重合且高频迭代，此前从未深评，登记 T-1417 为第四轮首位任务（发布包静态分析+迁移通道评估），方法沿用修仙打卡深评。
- 战略信号：思源 3.8.5 数据库原生日历视图稀释可视化护城河，差异化必须压在习惯算法内核、统计口径与事件语义（R-A3/R-A7 优先级互证）；3.9.0 闪卡重构批次（含 #19365 插件自定义复习顺序）是「打卡×复习」联动的未来官方接口入口，归 T-1374 观察。
- 第三轮采纳项均为 local-auto 纯投影/命令入口批次，不改 Store v3、不触公开 API 契约、不引入新事件类型；真实宿主插入体验与戒除类用户反馈归 host-pending。

## D-266：日期运算单一实现 date-keys 与边界守门准入清单（T-1418/T-1419，2026-09-24）

- `src/date-keys.ts` 是跨模块日期键运算的规范出口：新增日期计算必须复用它，禁止再引入 `Math.round((a-b)/86400000)` 毫秒差写法（由架构守门与评审共同执行）。毫秒「时长」语义（如 snooze 7 天窗口、拆除预算）不属于日期差，不在禁令范围。
- date-keys 全部纯函数不读取隐式时钟（无 Date.now/缺省 new Date），日期由调用方显式传入或经注入；非法输入 fail-closed 返回 undefined；时区只接受显式 IANA 名称。
- model.ts 内部私有 `localCalendarDayNumber` 与 date-keys 的 `calendarDayNumber` 公式一致，model 核心留待后续批次收敛，避免在守门批次触碰最关键文件。
- 架构守门（tests/architecture-boundaries.test.cjs）采用「显式准入清单」模式：宿主 API、无时钟面、来源登记均以清单管理现状，新增文件触碰边界前必须显式登记并注明理由；守门不阻止合法扩展，只阻止静默回潮。
- docktomato-inbox 的 `docktomato:<identity>` 身份无日期后缀，不属于 EXTERNAL_REF_PREFIX_REGISTRY 的日期前缀体系，在守门清单中显式登记为非前缀来源家族，不强行假登记。

## D-267：微信读书适配器为 official-pull 渠道定型（T-1402，2026-09-24）

- 出站通道固定为思源内核公开转发接口 /api/network/forwardProxy（kernel/api/network.go 官方契约：headers 为键值映射数组、payload 直接给 JSON 对象、timeout 毫秒、响应 data.body 为字符串），不走渲染进程直接 fetch——免跨域不确定性，桌面/移动同一架构；插件只对该端点发 official-pull 请求。
- 微信读书 Key 纪律：用户自助申请的 wrk- Key 只存插件本地偏好（wereadIntegration.apiKey），不入库、不入导出、不进日志/消息/渲染上下文（设置层只暴露 wereadKeySet 布尔）；公开 API 输入伪造 source weread 一律回落 api（与 sireader/siplayer 同一防伪门）。
- 载体归属互斥（与思阅）落地为「专用项目绑定」：weread 时长只写用户绑定的专用项目，思源内文档阅读归思阅项目——不同项目天然不重叠，不引入时间窗互斥或书目匹配（书目级归属待完读/划线批次再定）。
- 官方 skill 包契约已逐条核对（2026-09-24，Tencent/WeChatReading main：skills/SKILL.md + skills/readdata.md）：skill_version 钉 1.0.4（取 SKILL.md 顶部 version）；请求体 {api_name, skill_version, mode:"monthly"} 扁平同层；按日明细官方口径=readTimes（月/周模式按天分桶，key=分桶起始 unix 秒，value=秒）+ dailyReadTimes（年度模式日明细），两字段合并去重取最大；key 兼容 YYYY-MM-DD 字符串；单桶超 86400 秒（24h）视为月/年大桶误读丢弃。初版解析器按「数组行 + YYYY-MM-DD 键」猜测的形状与官方不符，已按 readdata.md 收紧——印证 skill「能力文档预检、字段解释以说明文件为准」纪律的必要性。
- 网关解析 fail-closed：/readdata/detail 响应按容错解析（data 解包、数组行/对象映射、unix 秒经注入换算器、未来日丢弃、封顶 62 天），未知形状返回 ok:false 并把 errcode/upgrade_info 原样带给用户；skill_version 固定常量，官方升级提示见到即转达不自动重试。
- 完读事件的口径（第二批次，2026-09-24）：albums（有声书）的 finish/finishStatus 是「系列完结」而非个人读完，一律不纳入完读事件；只有 /book/getprogress 的 progress=100 且带 finishTime 才算读完（官方 book.md 明确 1-99 为部分阅读）；书名只进本地事件备注，不进 externalRef（身份保持匿名 bookId）；同书一次、前缀幂等、墓碑前缀匹配；每轮拉取至多核实 10 本新书（有界 N+1，未核实书下轮继续）。
- 划线计数的口径（第三批次，2026-09-24）：只统计划线（bookmarklist 自动过滤书签后的 type=1），想法/点评后续批次另行版本化；只结算「昨天」完整日——当天进行中的计数不写入（写入即 first-wins 不可改，避免锁定半日计数造成系统性少记）；活动书筛选用 notebooks 概览的 sort（最近笔记时间），更早的书不可能有目标日划线；>10 本活动书的极端日可能少记（有界优先，说明写入设置行提示与文档）。
- 轮询节奏：30 分钟有界间隔 + 就绪 5 秒首拉，失败静默（结果记内存态供设置页状态行）；「立即拉取」走同一摄取通道，唯一差别是结果以消息反馈。

## D-268：叶归 LifeLog 联动为本地读取型来源定型（T-1457，2026-09-25）

- 通道判定：yeguif 是「读取用户自有文档」型来源（与 weread 出站拉取、health 收件箱写入均不同）——经内核 SQL 只读用户日记笔记本内当日新建段落，privacy 标记 reads-shared-doc，不触叶归私有 petal 存储（红线）。
- 语义边界：时长=同文档相邻 Marker 记录起始差（与叶归 TimeDiff 模块口径一致）；最后一条开放记录时长未知不记（宁少记）；同分钟记录跳过；只摄取当日新建块，历史不回补；BlockId 即幂等身份，用户改写记录文本不产生重复记账，删除段落已写入事件保留（断开保留纪律）。
- 防伪造：yeguif 与 sireader/siplayer/weread 同列内部适配器保留来源，公开 API 输入伪造一律回落 api。

## D-269：v18.5.0 候选发布门禁与外部联动单位守门（2026-09-25）

- 设置页信息架构固定为「文档联动」与「第三方联动」两组；每个来源独立卡片必须说明绑定目标、保存/启用顺序、数据流、隐私边界、停用/重绑历史、查询上限与宿主可用状态。来源卡状态只描述本地配置与宿主能力，不把未知宿主误报为可用。
- 思阅/思播/微信读书时长联动的事实单位是「分钟」。项目不是分钟单位时，启用与摄取均 fail-closed；E2E fixture 也必须使用分钟时长项目，不能用二值「次」项目掩盖单位错误。
- `package.zip` 保留真实构建时间以满足宿主同步的新鲜度要求，摘要每次构建可能变化。因此 `test:quality` 的 `sync:digest` 固定放在完整测试与性能链之后、`check:release` 之前；不得用固定时间戳绕开资产摘要变化。
- 已完成项折叠采用就地更新 `aria-expanded`、`hidden` 与箭头并持久化，浏览器移动矩阵可关闭/恢复；真实 Android/WebView 触摸命中、安全区与第三方账号仍是 host-pending，不能由浏览器 QA 代替。

## D-270：v18.5.0 发布收口（2026-09-25）

- 用户明确授权发版后，先同步 README 当前版本声明，再运行 `node scripts/release.cjs 18.5.0`；脚本完成构建、全量门禁、提交、push、tag 和 GitHub Release。
- v18.5.0 发布资产 SHA-256 为 `8287289257c1e84be3a20c96daca90fee16eb211a688ec79cae68766ce84a62a`，发布提交为 `5741d8a`，tag `v18.5.0` 指向该提交。
- 真实 Android/WebView 触摸命中、安全区、微信读书实际 Key、叶归实际笔记本和第三方宿主联动继续按现场证据验收，不因自动化发布成功而关闭。

## D-271：第六轮调研结论——叙事区隔「低压力记录≠零记录」与呈现规范工程化（T-1400 第六轮，2026-09-25）

- 集市新插件 Workbench（sy-tomato 作者）以「不用打卡——计划即账本」切入自我管理心智，列为叙事层竞品警报；应对是文案与呈现上区隔「低压力记录 ≠ 零记录」（不记录就没有可回看可解释的长期数据，小驴的答案是压低记录成本而非取消记录），不跟进其项目管理/全家桶形态。其配额+最低频率机制反证频次约束刚需。
- 「低压力/无罪化」已获 2026 多源外部印证（streak-optional/track-only、Calm Productivity、Bloom/Couch 无罪化追踪、Duolingo streak freeze 学术批判、66 天中位数研究），据此把低压力边界从设计原则落成可验收规范：紫罗兰单色亮度阶梯+冗余编码、calm 文案禁则、双日规则、reduced-motion 三通道冗余、44/48px 触控目标、undo 优先于确认弹窗——批次 T-1461（R-A13），并新增战略方向 24。
- 另两条采纳：数值快捷记录预设增量（WaterMinder Log Cup 范式，T-1462/R-A14）；迁移健壮性——跨午夜双日归账边界断言+导入未知字段保留+PixelHabits 合并语义参考记录（T-1463/R-A15）。宿主 3.8.6 正式版发布后跑渲染块回归（T-1464）。
- 红线重申：streak freeze/护盾若未来做必须是自动宽限而非付费修复；宠物养成、社区挑战、定位情境提醒、诱惑捆绑、独立情绪日志维持不做。延后池 13 项带触发条件记入 benchmark 第十五节，不主动排批。

## D-272：开发队列确认与发布期上游核查常设动作（2026-09-25，用户指示）

- **真机测试项全部移出开发队列**：T-1388 总窗口、微信读书真机首拉、每日提醒真机弹窗、叶归真机摄取、移动端折叠/安全区复验等保持开放，用户有空自行测试并反馈后即修；不作为任何本地批次的前置或验收门槛。现场证据口径本身不变（浏览器/隔离内核证据不冒充真机），只是不再等待现场证据才推进后续开发。
- **外部等待项继续等，但增加常设发布检查动作（R-REL-CHECK）**：每个大版本发布时（含候选冻结阶段），核查既有已提交的上游 issue/PR——当前为 sireader#55、siplayer#180，以及尚未提交的 Task Horizon 反向提案草案与 Dock Tomato PR 草案——有无回应或需要更新的内容（新交付能力、契约或版本事实变化时在原 issue/PR 追加评论更新，不重复开新帖）。消费端任务（T-1392/T-1394/T-1366/T-1165/T-1228~1230）维持等待。
- **可开发队列按 implementation roadmap 第十四节执行**：第 1 批 T-1461/T-1462/T-1463 → 第 2 批今日/回顾呈现增强（完成度环、sparkline 报告卡）→ 第 3 批洞察与可视化深化（确定性相关性洞察、超额日着色、时段分组视图、fractured/sparse 热图）→ 第 4 批治理互操作与收尾（分享图导出、诊断导出预览、台账保留词表清理、小项收口、里程碑分级庆祝按 D-263 收尾口径）。触发条件批次（T-1464、T-1413、Story Mode、CalDAV、MCP descriptor、隐藏集管理 UI 等）不主动排批，条件满足或用户点名即启。

## D-273：问卷式日记打卡定型——问卷绑打卡项目，写入走摘要驻留同款纪律（用户想法，2026-09-26）

- 用户想法（点击【感恩日记】弹问卷、写入日记或指定文档）调研结论为**高可行**：问卷引擎/弹窗表单/写入通道/目标定位/打卡联动五块拼图全部有既有资产（benchmark 第十六节）。生态先例（Obsidian Daily Prompt、格志日记）验证交互形态，但幂等/审计均为空白或被诟病；思源侧日记定位栈有成熟事实（SQL `custom-dailynote-yyyymmdd` > renderSprig(dailyNoteSavePath) > createDocWithMd 同 path 幂等）。
- 定型口径：①打卡项目绑定问卷模板为唯一入口（绑定后打卡动作=填问卷，未绑定项目零变化）；②recordEvent 先落盘（事件是事实层），文档写入为尽力而为旁路——失败不阻断打卡，审计+toast 重试，与 D-257 summary-resident 同纪律；③写入只追加插件自写块（结构化标记定位），同日同模板幂等提示「查看/重新填写」，重填走 updateBlock（lockType 保护）+事件修订；**绝不改写用户已有内容**；④答案正文只进目标文档，事件 note 只存截断摘要，进 privacy-scope 敏感审计既有口径。
- 内置 5 个只读预设模板（感恩三问/五分钟日记早晚版/九宫格晨间日记/KPT 每日复盘/深度复盘周记）+用户自建问题集；第一版问题类型 text/textarea（slider 可选），不做图片/评分落库。登记 T-1465（local-auto，含隔离内核 e2e），排期建议 R-A16 之后，等开工指令。
## D-274：设置与记录体验三批开工（2026-09-26，用户确认）

- 用户确认继续优化设置、问卷和细节体验，新增 T-1472～T-1476；此前“无直接开工项”是旧队列快照，不限制本轮授权。
- 联动检测区分请求失败与目标不存在；归档项目不报警。日记查询必须限定所选笔记本，预览不创建文档，写入必须检查内核错误码；已成功记录的打卡不因文档写入失败回滚。
- 问卷失败保留弹窗与答案；草稿只在当前插件会话内存保留，按项目/模板/日期隔离，卸载清理。设置的手动保存文本和问卷目标保留会话草稿，不增加持久化答案副本。
- 可视化编辑与文本编辑共用同一保存边界；文本格式追加可选模板 ID 和 required 字段，往返保留绑定身份和必答标记；解析部分失败拒绝整个替换，结构删除提供一次撤销。
- 本轮本地提交，不推送、不发版。真机触摸、键盘、安全区保持现场等待；浏览器和隔离内核证据独立记录。

## D-275：撤销宿主版本/真机等待，恢复本地增量开发（2026-09-26，用户指示）

- 用户要求去掉所有仍等待宿主正式版或真机反馈的内容。撤销 T-1464、T-1406、T-1408、T-1388、T-1344、T-1347、T-023、T-033、T-129、T-1256，以及 T-1346/T-1173 剩余现场等待部分和 B-001/B-007；覆盖 D-272/D-274 及其他历史条目中“保持开放、等待现场”的排期要求。
- 撤销是范围调整，不是补写验收成功。浏览器、隔离内核与用户实测的证据分类继续保持真实；开发仍需相应自动化和视觉验收。已知具体缺陷照常修复。
- “本轮外部调研没有新触发”不代表“插件没有本地改进空间”。已完成 T-1472～T-1476 后，继续深化配置闭环、设置查找、问卷编辑、UI/动效、性能与可视化方向，登记 T-1477～T-1483；T-1386 本地面板部分继续有效。
- R-17.4 热图与 R-18.3c 宽屏布局的设计/原型/验收属于可执行工作，不再等待抽象设计窗口。积分、RPG、共享排期语义等独立产品边界不自动改变；第三方未实现的公开 API 仍不能臆造。
- 同步 TODO/BLOCKERS/交接/执行路线与 PROGRESS；本轮不推送、不发版。
# D-276：LifeLog 项目映射与区间归属（2026-09-26）

- LifeLog Marker `HH:mm 项目：具体事项` 中，当前 Marker 的归属项目为时间后第一段，事项为冒号后的正文；区间为同文档上一条 Marker 到当前 Marker 的开始时间差。时长写入当前 Marker 映射的打卡项目；当天第一条因缺少前置记录不计。
- 用户配置一组项目映射（每个 LifeLog 项目唯一映射一个打卡项目）。存在映射时，未命中项目跳过，不向其它项目猜测归属；空映射仅用于兼容旧版单目标配置。目标需存在、未归档且单位为分钟。
- 同一块身份仍是 `yeguif:<blockId>:<localDate>`；块级幂等/墓碑纪律不变。读取范围仍为用户绑定笔记本当日新建日记块，不接触叶归私有数据。
- lumina README/变更记录用于佐证 LifeLog 的类型筛选、独立统计和时间轴概念；本轮不复制其视觉实现。实现说明见 `docs/lifelog-integration.md`。

# D-277：按周热图沿用周一边界（2026-09-26）

- 按周分段热图复用年度热图的周一到周日边界；年初不完整周保留为首个部分周，避免“每 7 个数组项”造成跨周错位。
- 周格的颜色取该周最活跃日的既有色阶，记录数和活跃天数只作为悬停补充；不改变完成率、排期或事件统计口径。

## D-287：外部联动按数据流分类，状态拆为四轴（2026-09-27）

- 外部联动固定分为五类：插件事件监听、官方服务拉取、用户文档摄取、外部 API 契约、文档输出。五类触发和失败语义不同，不提供含义模糊的“全部同步”按钮。
- 设置状态拆为配置、运行、活动、问题四个正交维度；本地开关只证明用户意图，不能证明外部宿主存在或通道可用。无运行探测时必须显示“未探测”，不得显示“已连接”。
- 操作按渠道提供：监听型=宿主探测/累计/阈值；拉取型=立即拉取/最近结果/凭据；文档摄取型=目标体检/立即读取/匹配报告；对外 API=协议/能力/诊断；文档输出型=目标/预览/审计重试。
- 笔记推导的非法字段、值或标签继续 fail-closed：归一为无效配置并关闭摄取，不静默改用默认 marker 执行另一条真实查询。总账与排期见 `docs/external-integrations-map.md`、T-1503～T-1507。

## D-290：监听型时长按片段入账，LifeLog 按项目路由（2026-09-27）

- 用户明确要求同一天先看 20 分钟、再看 15 分钟时产生两条独立记录。思阅按焦点片段、思播按新采样到的整分钟分别写入，取消无效的每日阈值设置；旧偏好字段仅为兼容保留。
- 新片段身份含精确开始时间的 Unix 毫秒和本地日期，旧每日及短暂使用的分钟桶身份继续可读；删除后的墓碑仍阻止相同身份复活。精确时间避免同一分钟内两次真实会话互相吞并，但没有上游共享会话 ID 时不能证明跨窗口属于同一会话；缺失的监听事件和写入失败的在途片段也不能恢复，故不得宣称可靠历史同步。
- 叶归 LifeLog 显式项目映射优先；只要存在映射，未命中的类型就跳过。完全没有映射时仅唯一同名且单位为分钟的目标可自动匹配，重名、无目标或单位不符跳过。旧单目标字段不再兜底，以免把拉伸等项目写入错误目标。
- 微信读书官方接口只有每日汇总，没有每次阅读会话的可信边界；保留每日拉取口径，不能伪造 20/15 分钟两条片段。

## D-309：备份范围与普通 CSV 契约列入下一轮审计（2026-09-29）

- 本轮只登记，不改运行代码。源码证据显示 JSON/本地快照当前以主 Store 为中心，个人模板、问卷、图标、事项、提醒动作、偏好和外部待处理箱分散在独立桶；`normalizeStore` 与 `cloneStoreValue` 也不保留 `CheckinStore.templates`。在范围未定前，不把独立桶静默塞进现有 JSON，也不继续把“主 Store 导出”当作无条件全量恢复。
- 普通 CSV 的导入与导出先作为一个契约收口：保留既有文件兼容边界，严格校验真实日历日期，支持 RFC 多行字段，复用公式前缀中和和导入预览/审计。T-1627 负责备份范围，T-1628 负责 CSV 格式与表格安全，两者不与 T-1622 的并发写入或 T-1463 的 Loop/Obsidian 迁移规则合并。
- 继续遵守本轮只审计和登记的范围；实现前需按任务验收矩阵确定备份包版本、独立配置的敏感字段策略以及旧 CSV 表头兼容方案。
# D-345：事项桶删除墓碑与并发新建（2026-10-04）

- T-1622 删除类切片只给 `OccasionStore` 增加可选 `tombstones`，旧存储无需迁移；读取归一化时先收集墓碑并过滤同 ID 事项，合并时墓碑优先，旧窗口事项不能复活。
- 有墓碑后可以安全采用没有本地墓碑遮蔽的远端独有事项，恢复事项桶并发新建能力；本地标量仍优先，共享事项的 `completedDates` 继续并集。事项 ID 不提供用户复用入口，墓碑不自动清理，避免有界清理造成陈旧窗口复活。
- 事项删除、保存、完成、改期、Agent 创建和 mutation 刷新都必须保留墓碑字段；失败箱和提醒 restore 的辅助桶删除标记另由 D-346 收口。

# D-347：专注计时有效时间与保存事实口径（2026-10-04）

- 专注有效时间只包含用户明确开始/恢复后、页面可见且时钟连续的运行区间；页面隐藏、窗口生命周期切换、休眠造成的长间隔和时钟异常均暂停并排除，恢复必须由用户明确继续。这样不会把电脑离开期间误记为专注，也不会因定时器节流少算已经确认的可见时间。
- 主动完成与到点完成共享同一结算快照。写入返回带身份的事件后才显示成功庆祝并清理会话；失败保留冻结的日期、数值、修订指纹和备注，重试不得重新计算或重复入账。
- 预设切换在已有投入时间时先确认；取消保持当前会话，确认才重置时长并保留暂停态。专注计时不在本决策中引入闲置检测或净时长双口径。

# D-348：事项改期草稿与组合包冲突处理保持 root-local、提交前重核对（2026-10-05）

- 事项单次改期的展开态与日期属于表面会话，不是事项事实；存入 `OccasionsRootContext.occurrenceMoves`，每次 toggle、输入、确认和删除清理只作用于触发 root。确认后收起但保留日期，保存失败时用户可重新展开重试；不把改期草稿持久化到事项桶。
- 组合包应用采用读取计划与一次提交分离：面板展示同名规则差异，默认新条目 create、同名条目 skip，冲突可进入现有项目编辑；用户提交时在 mutation 锁内按最新 Store 重建计划，只创建仍为新增且被勾选的条目，保存失败恢复整批内存快照，不隐式覆盖或启用联动。
- 提醒中心导航收到陈旧 root 时必须回落到当前连接 surface，禁止向 detached DOM 写入页面状态。浏览器/隔离 bundle 证据按环境记录，不把缺少 `CHECKIN_BROWSER` 的本地失败当代码回归。

# D-349：辅助历史采用锁内并集，设置搜索与图标刷新保持 root/DOM 幂等（2026-10-05）

- Settings 字段搜索的 `query`、`activeIndex`、`hadFocus` 是表面会话态，归属 `SettingsRootContext.searchSession`；模块级 WeakMap 不再作为事实存储。没有 root 会话的旧外部桩只获得一次性临时对象，不为已销毁表面保留状态。
- 分析历史是追加型诊断数据。生成摘要保存时，在共享存储锁内先重读远端缓存，再将本地与远端做确定性并集、按生成时间和稳定身份排序并保留有界尾部；写入后以内存并集为当前基线。偏好桶仍按 D-315 后写者胜处理，不把异构重置语义误套用到历史桶。
- UI 图标归一化只对已经包含目标 SVG 的节点提前返回，旧文字/兼容标记仍会被替换；该幂等边界降低 Today 大列表的重复 HTML 解析，不改变图标迁移结果。性能门禁必须以完整链或独立回归的真实结果记录，不能放宽阈值。

# D-350：诊断清理/快照替换的删除边界与 root 导航（2026-10-05）

- 专注诊断追加回调属于并集写入，清空诊断和快照清空属于用户明确删除，不能先重读再并集合并；两者均在锁内执行，失败恢复内存并反馈。诊断成功解决旧 `write-failed` 条目的跨窗口持久墓碑尚未存在，不把本轮追加并集误称为完整删除收口，另立 schema v2。
- 快照导入是用户确认后的显式替换，锁外只做解析与确认，锁内写入；写失败保持当前历史。快照清空同理不接受旧窗口数据复活。
- 文档渲染块点击项目洞察属于外部 DOM 回调，应优先导航仍连接的 active/root surface；目标 root 通过既有 `showInsights(item, root)` 生命周期处理，只有没有连接 surface 时才使用无 root 兼容入口。

# D-351：提醒删除记录与页内通知可达性（2026-10-05）

- `ReminderUserAction.restore` 是持久化删除记录，归一化、序列化和跨窗口并集合并必须保留；若按普通 `snooze` 的过期策略过滤，会让旧窗口的 skip/snooze 在重载后复活。该记录沿用有界动作桶，不改变提醒投影或事实事件。
- 页内每日提醒通知采用实例级唯一 hint id，并由通知区域通过 `aria-describedby` 关联操作说明；通知本身暴露为 `role=region`，保留独立状态 live region。该层只改善可达性，不伪造宿主原生通知交互。
- 专注计时的跨表面同步范围由宿主持有的 root 集合定义；测试禁止恢复为全局 `document.querySelector(All)`，以免多 surface 同时打开时只刷新一个面板。

# D-352：启动清理与编辑器异步回调的生命周期边界（2026-10-05）

- 外部失败箱的保留期清理属于初始化存储事务的一部分；清理结果必须在初始化锁内等待写回完成，不能用锁外 fire-and-forget，否则旧窗口快照可能覆盖新窗口写入。写失败仍由待处理箱自身状态暴露，不阻塞其它独立降级路径。
- 编辑器组合包应用完成后的导航是表面副作用，必须同时满足 root 仍连接且仍是当前编辑器会话；过期 Promise 只清理按钮 busy 状态，不切换页面、不写旧表面。
- 提醒中心宽屏密度只压缩行内留白，触控目标、窄屏换行、键盘顺序和状态投影保持原契约；密度门禁以真实多表面/多语言/双主题布局矩阵验证，不放宽阈值。

# D-353：审计显式删除与锚点回调可达性（2026-10-05）

- 审计清空是用户明确删除，先取消待合并计时器，再在存储锁内写入空桶；失败必须恢复原记录并提示。若等待锁期间产生新诊断，回滚采用原记录与新追加的并集，不能覆盖新事实。
- 编辑器锚点选择/创建是异步 DOM 操作，响应落地前必须确认 root/session 仍有效、目标节点仍连接且仍是该 root 当前节点；失效响应直接丢弃，不重新导航或写旧表面。
- 窄 dock 的提醒操作保留 44px 最小触控高度，即使紧凑布局需要减少其它留白也不得压缩动作目标。

# D-354：视觉覆层采用后置独立样式与真实事项空态（2026-10-06）

- 原型要求的卡片边界、阴影、导航激活态和移动 Today 层级通过 `src/ui/polish.scss` 后置加载实现，保持 `components.scss` 的既有功能规则不被大范围重写；所有选择器以 `.lc-checkin` 前缀隔离，并沿用现有 design token。
- 事项列表没有条目时必须渲染可解释的空态和下一步动作。渲染器直接使用 `agendaRows || agendaEmpty`，筛选为空提供清筛，未筛选为空提供新建；不改变事项存储或筛选事实。
- 视觉证据只记录本地 Playwright 亮/暗探针与已生成截图；真实宿主主题、触控和草稿冲突 harness 未通过的部分不冒充完成。

# D-355：第二轮视觉细节沿用现有宿主结构（2026-10-06）

- 桌面原型的品牌与主动作通过后置样式增强现有 topbar，保留当前 topbar/rail/dock 的宿主结构，不迁移导航 DOM；这样能对齐静态原型的品牌、选中态和主色，同时不破坏 720–959px 窄桌面与 dock。
- 移动端固定保存栏和每日提醒都必须避开底部导航，并给可滚动内容保留尾部安全空间；Reminder 仍是 body 上的独立通知，不改提醒投影和动作逻辑。
- 连续卡在移动 Today 进入独占行，避免旧 compact 规则留下半列空白；暗色阴影、边框和焦点态继续复用 tokens.scss 的双主题 token。

# D-356：移动每日提醒使用宿主流内挂载（2026-10-06）

- 移动端提醒挂到当前可见 surface 的宿主根，在顶栏与 `.lc-checkin` 滚动区之间作为普通 flex 子项；这样正文、Editor 保存栏和底部导航都不会被浮层覆盖。
- 页面重绘后由 `ensureReminderNoticePlacementFor` 将同一通知节点重新挂回，宿主销毁或无法识别时回退 `document.body` 的桌面固定样式；关闭、卸载、焦点恢复和单实例持久化语义保持不变。
- 提醒操作目标继续遵守 44px 触控下限；移动紧凑布局只压缩文字与外边距，不压缩按钮高度。

# D-361：短高提醒与宽屏 Today 密度（2026-10-06）

- 844×350 的宽 dock 仍属于短高交互表面；每日提醒必须进入宿主流内，不能用固定 toast 覆盖排序、保存和专注按钮。判定依据是实际 surface 高度 ≤480px，按钮保持原有触控尺寸。
- 2000px 宿主的内容壳最大宽度约 1320px，三列密度断点按容器宽度 1200px 生效；宽屏三列同时收窄操作轨道，保留名称和主打卡动作的可读空间，1180px 继续使用两列。

# D-362：宽屏密集卡片按视口触发（2026-10-06）

- 30 项 Today 的三列断点改用真实视口 `min-width: 1800px`，因为页面内容壳固定在约 1320px，容器查询无法区分 1180px 与 2000px 宿主的宽屏意图。
- 三列卡片把操作区移到正文下方的横向轨道，避免基础操作列规则形成隐式第三列；按钮继续可达，超窄卡片允许横向滚动，避免标题和数值区被挤成异常高卡片。

# D-363：触控宽度的 Today 概览按优先级双列（2026-10-06）

- 381–719px 的 Today 概览使用完成度/连续天数双列，保留 ≤380px 更紧凑的比例；原型中的两项摘要在中等触控宽度不应纵向堆叠，把首个习惯继续推到首屏下方。
- 声明提高 `.lc-checkin.lc-checkin--today` 选择器优先级以覆盖既有移动 `!important` 规则；不改变数据、操作顺序或触控目标尺寸。

# D-364：新增能力按辅助信息折叠（2026-10-06）

- v2 原型已经承载 Review/Archive/Focus/AI/Quick/Command 等辅助工作区；当前实现不扩展一级导航，也不删除新增能力。
- Today 的“往年同日”属于新增的证据回顾，和任务完成主路径无关。渲染为默认收起的原生 disclosure，跳转按钮与只读聚合数据保持不变；未来负荷、优先提醒、Review 高级分析、Settings 外部来源/恢复等继续沿用既有 details 或工具菜单。
- 判断依据：原型要求 Today 首屏只保留完成/下一步/任务列表主路径，辅助卡按需展开；视觉层级调整不改变存储、事件和绑定。
# D-365：提醒内嵌后的底部安全区覆盖所有挂载形态（2026-10-06）

- 移动提醒在触控表面挂到宿主流内后，底部安全区选择器必须匹配任意祖先中的通知节点，不能只匹配通知直接挂在 `body` 下的旧形态。
- 只扩大 CSS `:has()` 选择范围，不改变提醒投影、发送身份、关闭/静音和宿主挂载逻辑；Today、Review、Editor、Occasions 继续共用底部导航安全区，Editor 保留更高预留。
- “往年同日” disclosure 复用既有 review fold 的 summary/焦点/箭头视觉，避免新增 CSS 规则和破坏样式预算。
# D-366：事项空态卡按内容高度收敛（2026-10-06）

- 事项页空态属于列表内容，不应被网格的默认拉伸规则占满剩余高度；为 `.lc-checkin__occasion-empty` 设置 `align-self: start`，保持最小可读高度但不制造空白。
- 该调整只影响无事项/筛选无结果时的视觉几何，保留新建、清筛和模板入口，不改变事项筛选与存储。

# D-367：窄宿主提醒统一使用紧凑流内样式（2026-10-06）

- 桌面 dock 宽度在 719px 以下时已进入提醒流内挂载，但之前仍沿用宽桌面通知的内边距与文案间距，640px 截图中通知约占 126px，首屏标题和下一步被整体推低。
- 将现有紧凑提醒规则的容器断点从 380px 扩到 719px，覆盖 320–719px 的 dock/tab/dialog；只压缩通知文本、间距和容器高度，操作按钮仍保持 44px 触控目标。
- 该调整不改变提醒投影、发送身份、关闭/静音、挂载逻辑或底部安全区；证据是 640px 复截图无遮挡，提醒行为 17 项和真实 bundle 18 场景通过。

# D-368：窄端提醒说明保留可读的最小字号（2026-10-06）

- 320/360px 截图中流内提醒的关闭说明使用 9px，和同屏辅助信息相比已经接近噪点；该文本虽然是单行省略，但仍承担解释关闭范围的作用。
- 将说明字号提升到 10px，保留单行省略、112px 容器上限和 44px 操作按钮；不改变提醒结构、动作或垂直几何。
- 依据：320px 亮/暗、中文/英文真实 bundle 场景均通过，提醒卡在高度上限内，未产生溢出。

# D-369：Today 宽屏证据卡与任务列表首行对齐（2026-10-06）

- 2000px 截图显示任务列表只占左侧三列区域，未来七天负荷卡却被网格自动排到所有任务之后，右侧首屏出现大片空白；这是布局定位问题，不是数据缺失。
- 在已有宽屏双列规则中为同日回顾/未来负荷证据卡指定 `grid-row: 1`，让它们和任务列表第一行并排；窄端仍保持自然单列流，不改变卡片内容、展开状态或跳转动作。
- 依据：复截图中证据卡已位于任务首行右侧；2000px 三列卡片高度保持 118.8px，基础宽度、编辑器/设置/事项长内容与混合记录场景无新增失败。

# D-370：Today 双证据卡避免宽屏重叠（2026-10-06）

- `grid-row: 1` 适合单独出现的本日记录或未来负荷卡，但两者同时存在时会占据同一网格单元，造成内容覆盖。
- 保留首张证据卡在右侧首行；当本日记录存在时，将未来负荷卡放到右侧第二行。该规则只处理网格定位，不改变两张卡的内容、数据或交互。
- 依据：选择器使用既有 `.lc-checkin__this-day` / `.lc-checkin__week-load` 类，不新增状态字段；窄端不进入宽屏容器规则。

# D-371：窄宿主流内提醒解除桌面宽度上限（2026-10-06）

- 640px 截图中流内提醒仍继承桌面 `max-width: 420px`，横幅只占宿主左侧，右侧形成明显空白；这与原型的整列提示条不一致。
- 在已有 `<=719px` 流内规则中移除该宽度上限，保留 8px 外边距和 44px 操作目标，让提示条填充当前宿主列；固定桌面 toast 和提醒逻辑不变。
- 依据：只覆盖带 `--inline` 的移动挂载节点，不影响 body 直挂、桌面 dock 或提醒发送/关闭状态。

# D-372：设置新增工具区在移动端收紧层级（2026-10-06）

- 设置页新增了全局搜索和“需要处理/最近活动/配置入口”总览，原型没有这两块；删除会损失新能力，直接保持默认间距又会把第一张真实设置卡推到首屏之外。
- 移动端将搜索标签与输入排成一行、输入保持 40px 高度，并收紧总览卡的内边距/行距；总览中的入口按钮和状态文本仍全部可见，桌面布局不变。
- 依据：只改 `<=719px` 的视觉几何，不改 `data-settings-search`、`data-settings-overview`、跳转按钮或状态更新逻辑。
- 后续复核发现新增总览专用选择器会使生成 CSS 超过 640KiB hard line，因此撤回该堆叠规则；最终只复用设置基础层已有的搜索布局，把搜索标签/输入排成一行并把底部间距从 16px 收到 8px。

# D-373：超宽设置页保持可读内容轨（2026-10-07）

- 超宽截图的原型文件是 2x 导出，原型页面 content 上限约 1280 CSS px；当前 2000px 宿主内容约 1288px，已经接近原型。继续放大到 1780px 会稀释设置项密度，因此撤回该尝试，保留既有 1320px 上限。
- 移动设置搜索的实际掉分点是 flex 让输入按内容收缩；改用已有设置层的两列 grid，让标签占据首列、输入填满剩余列，不影响桌面内容轨。
- 依据：只改变窄容器搜索布局，不新增交互或改变设置分组。

# D-374：产品定位收敛为低压力个人行动台，v3 原型收拢一级导航（2026-10-07）

- 对外定位采用「思源里的低压力个人行动台」：Today 记录行动，Review 回看事实，笔记/外部来源提供上下文，回顾生成可选下一步。它不再以“习惯指标更多”作为竞争点。
- 一级导航收敛为「今天 / 回顾 / 事项 / 设置」；Insights、Editor、Archive、Focus、Suggestion workspace、Data center 通过上下文进入。此调整只改变默认发现路径，不删除已有能力或数据入口。
- 产品边界继续保持本地优先、事实可审计、来源可诊断、AI 草稿须确认；不新增社交/RPG 惩罚、账号云同步或 AI 静默写入。
- 交付 `docs/product-positioning-and-roadmap-2026-10.md`、`docs/ui-prototype-spec-v3-2026-10.md` 和 `docs/prototypes/checkin-ui-v3.html`。v3 是信息架构与视觉契约原型，未接入生产数据，也不改变现有功能逻辑。
- 依据：仓库当前功能审计、既有 benchmark/低压力基线，以及 Loop、InlitX/Streak、Habitica、Siyuan Task Assistant/Task List、Obsidian Tracker 的公开 README/文档；未把候选功能（Task Horizon 消费端、项目级 pause、Exactly、PDF、明确未达成）写成已承诺能力。

# D-375：v3 原型第二轮结构与移动行动优先（2026-10-07）

- 移动端底栏固定在拇指区域；Today 在首个下一步卡之后直接展示待处理队列，统计摘要下移，确保首屏能看到至少一个完整行动行和主按钮。
- 二级页保持来源上下文高亮：Editor/Focus 回到 Today，Insights/AI 回到 Review，Archive/Data 回到 Settings；移动“更多”在二级页保持选中，避免用户迷路。
- 密度按钮必须产生真实视觉变化；紧凑态只收紧卡片、列表和网格间距，不改变数据或动作。
- 归档候选状态、窄屏三列内容和归档行使用候选标签与可换行布局，避免原型把未来能力当成当前功能或挤压操作按钮。
- 只修改独立原型 HTML 与设计规范，没有改生产渲染、存储或 API 逻辑；示例数据继续以“原型 · 示例数据”标识。

依据：390×844 和 1440×960 Chromium 截图、10 个页面结构检查、无重复 ID、git diff --check 通过。

# D-376：移动命令面板覆盖全部页面入口（2026-10-07）

- 移动端“更多”命令 Sheet 必须覆盖 10 个页面：Today、Review、Occasions、Settings、Insights、Archive、Focus、Editor、AI、Data；快速记录是动作入口，不计入页面数量。
- 这样隐藏桌面二级导航后，移动端仍能到达每个已展示的原型页面；不新增生产 PageId 或数据能力。
- 依据：静态入口检查 pageCount=10、commandCount=11、missingCommandPages=0，随后重新通过 git diff --check。
# D-377：v3 原型交互预览与可访问状态收口（2026-10-07）

- 命令面板展示的 G T/G R/G O/G S、N、C 快捷键现在都有对应预览行为；页面切换、父级/二级导航高亮和移动“更多”状态保持一致。
- 快速记录从触发按钮读取项目、单位、默认数值和目标；喝水、阅读、冥想不会再共用“阅读 · 30 分钟”的错误示例。确认只显示预览反馈，不写入生产数据。
- 弹窗补充首控件聚焦、Tab 循环、Escape/关闭回焦；Review 标签、开关、密度按钮、Toast 补充对应 ARIA 状态。
- 未接线按钮统一给出“原型预览 · 该操作尚未接入交互”反馈，避免评审把静态图当成功能承诺；生产 PageId 和数据逻辑不变。
- 归档移动标签改为横向滚动，避免“候选”标签换行挤压。

依据：Playwright 运行时检查无 pageerror；10 个页面、11 个命令入口；初始 Today aria-current、Review tab/panel、快捷键、二级页双高亮、快速记录项目上下文、焦点回收和静态反馈均通过。
# D-378：跨页预览状态与记录模式语义（2026-10-07）

- Review 的概览/记录/分析是真正的 tab；快速记录和恢复中心的标签只是静态预览筛选，不冒充可切换数据状态。
- 快速记录按项目带入默认值和单位，确认只给预览反馈；原型不向生产存储写入。
- 主题、密度、开关、Toast、命令面板和弹窗焦点状态继续作为可见交互契约；生产接入时复用现有状态与保存边界。
- 继续保留独立原型，不改变生产 PageId、移动导航或业务逻辑。

依据：当前独立原型截图、git diff --check，以及页面结构/运行时检查范围。
# D-379：快速记录模式与命令空态收口（2026-10-07）

- 快速记录的“完成一次 / Add 数值 / Set 自定义”现在会同步 active 与 aria-pressed，明确这是预览模式切换；项目触发时继续带入单位和默认值。
- 命令面板每次打开都会清空旧搜索；无匹配时显示明确空态，避免用户看到空白面板。
- 主题按钮补齐 aria-pressed；Review tab 继续保留真实 tab 语义。
- 以上只影响独立原型预览，不新增生产数据或 PageId。
# D-380：Review 键盘切换同步内容面板（2026-10-07）

- Review tablist 使用左右键时同步激活对应内容面板，不留下“焦点在一个标签、内容仍是另一个标签”的中间状态。
- 保持 Enter/Space 与点击相同的选择结果；不改 Review 数据或生产逻辑。

# D-381：原型跨入口状态保持一致（2026-10-07）

- 命令面板的顶栏、移动“更多”和 `Ctrl/⌘K` 统一经过同一个打开流程；每次打开清空上次搜索，并在无匹配时显示明确空态，避免不同入口留下脏状态或空白列表。
- 没有项目上下文的快速记录入口（桌面/移动按钮、命令面板和 `C`）统一显示默认项目“阅读”、30 分钟目标和对应备注提示；从任务行触发时继续保留任务自己的项目、单位与目标。
- 以上只收敛独立 v3 原型的交互预览，不写入生产数据、不新增 PageId，也不改变已有生产入口。

依据：1440×960 与 390×844 截图确认桌面底部操作条、移动五项导航和首屏行动顺序；结构检查为 10 个页面、11 个命令入口、无重复 ID；`git diff --check` 无空白错误。

# D-382：示例状态不得伪装成已写入（2026-10-07）

- v3 原型没有连接生产存储，顶部“本地已保存”和底部“事实已保存·可撤销”会把示例数据误读成真实写入结果。
- 统一改成“仅预览·未写入”和“预览状态·未写入数据”；快速记录确认提示继续保留同一语义。视觉上仍保留状态槽位置，避免为了澄清语义破坏信息层级。
- 设计规范同步加入状态文案约束，生产迁移时再由真实保存/撤销状态替换。

# D-383：原型表单必须可被读屏识别（2026-10-07）

- 原型中的搜索、记录、事项、项目编辑和建议表单不能只依赖 placeholder 或视觉邻接文字；每个控件补充显式 `label` 关联或 `aria-label`，设置开关和单位选择器也有可读名称。
- `Ctrl/⌘K` 在命令面板已经打开时不重复重置/打开，避免焦点抖动；关闭后仍按统一入口清空旧查询。
- 只增强独立原型的可访问性与键盘行为，不改变生产逻辑。

# D-384：Today 双栏卡片按内容高度收敛（2026-10-07）

- 桌面 Today 的右侧“今天的证据”与左侧待处理列表共用双栏网格；默认 stretch 会把证据卡拉到左栏高度，内容结束后留下大块空白。
- v3 原型为 `.grid.two` 与 `.split` 设置 `align-items: start`，让卡片按自身内容收敛；移动单列布局和卡片内容不变。
- 依据：1440×960 复截图中右卡底部空白消失；只改独立原型布局，不改变生产渲染或数据。

# D-385：命令入口避免重复绑定（2026-10-07）

- 命令按钮已经由统一的 `[data-open]` 入口打开面板，后置脚本又绑定一次 `[data-open="command"]` 会造成一次点击触发两次打开、重复记录触发器并引发焦点抖动。
- 删除重复监听，保留命令项选择器的关闭与跳转逻辑；不改变命令面板重置和快捷键行为。

# D-386：快速记录每次打开回到默认模式（2026-10-07）

- 快速记录模式是一次弹窗会话状态；如果上次停留在“Add 数值/Set 自定义”，下一次从另一个任务打开会继承错误模式，造成上下文和字段含义不一致。
- 所有快速记录入口打开前统一回到“完成一次”，再注入项目、单位和目标；用户仍可在当前会话切换模式。

# D-387：跨页面专注迷你条补齐独立视觉层（2026-10-07）

- 生产渲染会在 Today、Review 等页面插入 `.lc-checkin__focus-mini`，它不是专注主页面，不能依赖宿主默认 div 样式；此前名称、倒计时、状态和“回到专注”按钮在窄宽下容易挤压。
- 在既有视觉覆层中补齐网格排版、项目名截断、等宽倒计时、状态层级、双主题表面和移动端 36px 触控目标；不改变计时、暂停、结束或返回逻辑。
- 依据：真实渲染类名与更新选择器均已存在，新增规则只覆盖该前缀组件。

# D-388：专注迷你条窄屏与暗色边界（2026-10-07）

- 320/360px 下迷你条必须保留项目名和状态的省略空间，倒计时使用等宽数字，返回按钮保持至少 36px 高度。
- 暗色表面、强调色和边框继续复用主题 token；Playwright CLI 在本机浏览器进程阶段卡住，本轮不把它记作截图验收，通过静态几何与构建检查确认规则范围。

# D-389：主导航页面切换只绑定一次（2026-10-07）

- v3 原型的主导航按钮同时命中 `nav.forEach(...)` 和统一 `[data-page]` 监听；点击一次会执行两次 `showPage()`，重复触发滚动归位和页面状态更新。
- 删除主导航专用监听，保留统一 `[data-page]` 入口，确保主导航、侧栏二级入口和页面内跳转共享同一事件语义。
- 只改独立原型交互绑定，不改变页面信息架构、生产逻辑或数据行为。

# D-390：生产视觉覆层遵守 CSS 硬预算（2026-10-07）

- 专注迷你条加入后触发 CSS 640 KiB 硬预算，不能用绕过门禁的方式保留冗余装饰。
- 保留网格、截断、等宽倒计时、主题表面和移动 36px 按钮这些直接影响可用性的规则；移除重复的 Tab 容器装饰和非必要阴影/字号覆写，交由共享组件样式承载。
- 通过 CSS hygiene 后，生成 CSS 为 654,961 bytes：低于 655,360 bytes 硬线，仍高于 620 KiB 软线，后续继续以减量为先。

# D-391：折叠侧栏仍需保留图标识别（2026-10-07）

- v3 原型在 560–1100px 视口会将侧栏收窄为 74px；原有媒体规则把 `.nav` 和侧栏底部按钮的所有 `span` 一并隐藏，导致主导航和快速记录/专注入口只剩空按钮，选中态只显示色块。
- 在该媒体范围显式恢复 `.nav-icon` 与底部按钮首个图标 span；文字标签继续隐藏，手机五项底栏规则不变。
- 依据：768×700 截图复现侧栏空按钮；修复只作用于独立原型的折叠导航，不改变页面路由或生产逻辑。

# D-392：平板内容宽度必须扣除折叠侧栏（2026-10-07）

- 561–800px 视口同时命中折叠侧栏与窄屏布局；原 `.content{width:calc(100vw - 32px)}` 未扣除 74px 侧栏，导致 Today 卡片和操作按钮向右溢出，底部操作条从 0 开始还会覆盖侧栏底部入口。
- 窄屏规则改为 `calc(100vw - var(--rail) - 32px)`，底部操作条保留 `left:var(--rail)`；560px 以下移动底栏和全宽内容规则继续后置覆盖。
- 依据：768×700 修复后截图确认卡片右缘收敛、底栏从折叠侧栏右侧开始；只改独立原型响应式布局。

# D-393：命令面板空结果需要保留结构反馈（2026-10-07）

- 搜索无匹配时列表按钮全部隐藏，若只依赖一行裸文本，命令面板在移动底 sheet 中会出现内容突然塌缩，用户难以判断是没有结果还是加载异常。
- 给 `commandEmpty` 增加与面板 token 一致的虚线边界、浅色层、内边距和居中文案；不改变过滤逻辑、键盘焦点或命令数量。

# D-394：移动端弹窗反馈不遮挡表单（2026-10-07）

- 快速记录在弹窗内切换模式会显示预览 toast；移动端 toast 原本固定在底部 80px，会覆盖“来源与规则”等表单内容，造成反馈层和可操作内容叠加。
- 弹窗打开时将 toast 临时移到顶栏下方，弹窗关闭后仍回到底部导航上方；只调整反馈定位，不改变确认、取消或计时逻辑。

# D-395：专注迷你条状态必须随计时状态同步（2026-10-07）

- 跨页面专注迷你条原先只在渲染时拿到状态，暂停、恢复、保存中或保存失败后若只刷新文本，状态颜色无法同步，容易把“暂停/失败”误读成普通运行中。
- 为迷你条补充 `data-focus-mini-state`，在统一的计时根节点绘制路径中同步 `running/paused/saving/failed`；样式仅消费已有主题语义色，不改变计时、持久化或完成逻辑。
- 窄屏继续保留项目名省略、等宽倒计时和 40px 返回按钮，保证状态反馈不挤压主要操作。

# D-396：专注状态展示与原型反馈层各自隔离（2026-10-07）

- 生产专注状态元数据只服务 `.lc-checkin__focus-mini` 的语义着色；原型的命令空态与移动 toast 只调整预览层结构和定位，不能反向改变生产计时或数据写入。
- 原型移动弹窗打开时把 toast 放到顶栏下方，命令无匹配时保留 token 化容器，避免反馈覆盖表单或结果区域塌缩；关闭弹窗仍回到底部导航上方。

# D-397：收件箱清理失败补写必须留在存储锁内（2026-10-07）

- Dock Tomato 主记录成功后，收件箱删除写失败会恢复一条 pending 条目；此前该恢复写使用 fire-and-forget，可能在 mutation 锁释放后用旧快照覆盖另一窗口的新状态。
- 改为在同一 `enqueueMutation` 锁内等待补写完成；不改变主记录幂等、重试或 pending 语义，只收紧收尾写入顺序。

# D-398：断开 DOM root 不得重新进入渲染路径（2026-10-07）

- 宿主可能先移除 surface DOM，再晚一步调用插件的 forget/销毁钩子；若 root registry 仍收录 detached 节点，后台重绘会重新设为 active root 并写入无效 DOM。
- `roots()`、显式 `render(root)` 和 `renderInto(root)` 三层均检查 `isConnected`，只拒绝断开节点，不清理会话状态，避免改变宿主销毁顺序。

# D-399：删除类持久化失败必须恢复内存状态（2026-10-07）

- Dock Tomato 收件箱和外部失败待处理箱的显式丢弃都先修改内存，再执行持久化；若写入失败而不恢复，界面会暂时隐藏磁盘中仍存在的条目，后续同步又会把它复活。
- 两条路径均保存 `previous` 快照，只有持久化成功才保留删除结果；失败时恢复内存并返回失败，保留原条目供用户重试。此处不吞掉失败，也不改变墓碑/合并语义。

# D-400：渲染块异步回调必须服从 Protyle 生命周期（2026-10-07）

- 锚点文档索引解析是异步操作，宿主可能先移除 Protyle 或先调用观察器 teardown；解析完成后不能再对 detached 节点强制重绘。
- `renderCheckinBlocksIn` 入口、MutationObserver 防抖回调和 `resolveAnchorDocs` 完成回调统一检查 `protyleElement.isConnected`，观察器额外通过 `isActive` 同时检查 `disposed`。连接且仍活跃的 Protyle 继续按原路径强制重绘。

# D-401：新 surface 偏好种子只随持久化成功推进（2026-10-07）

- 新 root 的 Review 折叠与洞察项目种子来自最近一次成功保存的视图偏好；保存排队/存储锁等待期间不能提前推进，保存失败也必须保留旧种子。
- `persistViewPreferences` 继续在持久化 promise 成功后更新 `initialSurfacePreferences`。事务测试 harness 需包含真实方法并覆盖成功推进、失败不推进，不能用缺少方法的夹具把生产行为误报为失败或跳过断言。

# D-402：锚点导航结果必须属于当前 Protyle 与最新请求（2026-10-07）

- 渲染块点击会异步重解析锚点；期间插件可能开始卸载、预览/root 可能被替换、目标事项可能被删除/归档/解绑，或用户发起更新的锚点导航。
- 点击回调携带来源 preview/root/observer 生命周期谓词；宿主在解析后只允许仍 active 且仍绑定该 block 的项目继续，最新请求优先。全局渲染扫描与索引缓存写入也服从插件生命周期，卸载时使未完成导航失效。

# D-403：图标归一化不得吞掉操作名称（2026-10-07）

- 生产渲染后的图标归一化会把旧版或兼容按钮内容替换为 SVG；对于原本只有图标的“添加事项”按钮，替换前必须补回本地化 `aria-label` 与 `title`，避免视觉修复反而让读屏和悬停提示失效。
- 语义属性由归一化路径兜底，已有显式标签不覆盖；图标仍保持装饰性 `aria-hidden`，按钮名称由操作语义承担。

# D-404：临时编译 harness 必须镜像新增的运行时依赖（2026-10-07）

- `view-preferences` 新增来源归一化依赖后，报告测试的临时 `src` 镜像必须同步复制对应模块。缺失依赖属于测试夹具漂移，不能通过跳过平台测试或改生产导入来绕过。

# D-405：编辑器与自定义 tab 的延迟回调必须服从宿主生命周期（2026-10-07）

- 编辑器的滚动和名称联想都由延迟任务触发；surface 可能在等待期间重绘、切页或被宿主移除。回调只有在编辑器会话仍是当前会话、root 仍连接、目标仍属于 root 时才可操作 DOM。
- 自定义 tab 打开失败可能晚于插件卸载返回；卸载中的 catch 不得再显示错误或创建快捷弹窗。正常活跃宿主仍保留原有失败提示和回退入口。
- 本轮只收紧异步 UI 回调的生命周期边界，不扩大 RootContext 或改变正常导航/编辑行为；真实宿主 race 继续作为现场验收边界。

# D-406：编辑器跨 await 回调只允许当前 root 产生反馈（2026-10-07）

- 锚点创建、图片读取/下载、图标库导入、模板保存和删除都可能在 surface 切页、重绘或卸载后完成。完成或失败回调必须先复核 `isCurrentSession()`，再提示、写 DOM 或重绘。
- 图标库和模板库属于共享数据；成功回调在当前会话复核通过后继续使用全局重绘，让其他连接的编辑器 surface 同步看到新数据。旧会话不能触发这次全局重绘；数据持久化与既有失败回滚语义保持不变。
- 这轮只收紧 UI 回调的生命周期边界，不取消用户主动发起的网络/文件操作；真实宿主 race 仍需现场证据。

# D-407：页面绑定器异步回调必须复核绑定页与 root 生命周期（2026-10-07）

- 页面绑定器的异步任务可能在用户切页、root 重绘或插件卸载后完成；统一捕获绑定时页面，并要求 root 仍连接、宿主仍活跃且 `pageForRoot(root)` 未变化，才允许写状态行、恢复按钮、移动焦点、显示提示或追加撤销条。
- 数据 mutation 与持久化失败回滚属于宿主共享状态，继续执行并保持后台刷新；生命周期守门只限制旧 surface 的 UI 副作用，避免把界面过期误处理成数据取消。
- 归档动作的 busy 清理在旧 surface 上直接结束，不再触碰 detached 控件；真实宿主切页/卸载 race 仍需现场证据。

# D-408：Today 附件 FileReader 回调只允许当前 surface 产生副作用（2026-10-07）

- 本地图片读取属于异步浏览器 API；用户可能在读取完成前切页、重绘条目或卸载插件。`onload/onerror` 必须复核绑定时页面、root 连接状态、事项仍存在以及宿主生命周期；按钮状态只写当前重绘后的条目节点。
- 过期读取结果直接丢弃，不把图片写入新会话的附件 Map，也不向旧控件显示成功/失败提示；当前 surface 仍使用同一格式、大小和 data URL 校验。
- 本轮只收紧附件 UI 回调边界，不取消底层 FileReader；真实宿主文件读取 race 仍需现场证据。

# D-409：事项页异步回调只允许当前 occasions surface 产生 UI 副作用（2026-10-07）

- 事项 mutation 可能在持久化队列、跨窗口读取或用户切页后完成；数据写入、失败回滚和共享后台刷新保持原语义，来源 root 只约束 toast、局部重绘、焦点与控件状态。
- 绑定器捕获绑定时页面，并以 root 连接、事项页归属、宿主 disposing/disposed 和 acceptingOperations 作为 UI 守门；事项存储队列的失败提示同样携带来源 root，避免无 root 的延迟 catch 污染新页面。
- 无 root 的 API/今日页/Agent 入口继续走旧兼容路径；真实宿主事项异步 race 仍需现场证据，不把静态守门当作现场验收。

# D-410：GitHub 默认浏览分支暂保留 dev，发布源固定为 main（2026-10-07）

- 远端 `dev/thispc-1002` 是当前双机开发快照，`main` 是 v18.16.0 发布基线；默认浏览分支仍暂不切回 `main`，以免 GitHub 首页展示旧 README，也避免直接保护 dev/main 与现有双机合并流程冲突。
- 因此本轮只把分支/发布边界写入 README 和 `docs/github-repository-ops.md`，CI push 覆盖 `main` 与 `dev/**`；待两机合并并完成发布后，再单独执行“默认分支切 main、保护 main、校准 Release targetCommitish”的设置变更。
- GitHub 仓库级维护设置可以先收紧：合并只保留 squash、开启自动合并与落后分支更新、合并后删除分支，并启用 Dependabot vulnerability alerts/security fixes。远端 README、新增模板和 workflow 仍需随开发分支合并后才会生效，不用 API 直接改写分支文件来绕过协议。

# D-411：工具链最低版本按直接依赖最高下限收口（2026-10-07）

- 当前直接开发依赖中 Playwright 1.63 要求 Node >=20，copy-webpack-plugin 14 要求 >=20.9，Sass 1.104 要求 >=20.19；CI 使用 Node 22。项目 `engines.node` 因此改为 `>=20.19.0`，不能继续保留会误导安装的 Node 18 声明。
- `scripts/environment-check.cjs` 现在读取项目 packageManager 与直接依赖 manifest，输出实际版本、每个依赖的 `engines.node`、推导出的 requiredNodeFloor 和满足状态；Node/pnpm 不满足时返回非零。根 `node_modules` 优先解析，兼容 pnpm workspace 的直接依赖布局。
- 新增工具链文档与契约测试；README 顶部版本/安装段仍遵守双机保护协议，待合并窗口再同步 Node 文案，避免局部改动制造冲突。

\n
# D-412：任务型帮助文档先于受保护入口落地（2026-10-07）

- README 顶部和文档入口受双机分支协议保护，本轮不改 README；先新增 `docs/user-guide.md` 与 `docs/faq.md`，让用户能从首次记录、类型选择、补记/撤销、周复盘一路走到来源核对、迁移和失败恢复。
- FAQ 每题固定“现象→检查→修复→反馈”四段，明确跳过、at-most、来源无数据、文档输出失败、移动导出、提醒中心和升级缓存边界；不把浏览器窄视口检查写成真实 Android 验收。
- `tests/help-docs.test.cjs` 校验必备任务/状态语义、FAQ 四段结构与相对链接，并纳入 `test:ui`；不新增运行时逻辑，不修改存储和版本。
# D-413：100k 性能样本只扩展观测，不改预算（2026-10-07）

- T-1650 基准增加 `T1650_EVENT_COUNT` 可选事件规模（默认 10k、最大 250k）；评审报告同步记录 event count、JS/CSS bytes、五次场景样本和 page error schema。测试只验证报告契约，不自动启动浏览器，也不进入发布硬阈值。
- Node 24.15.0 / Edge 152 / 1280×900 单次 100k 样本：Insights 399ms、Review 2,981ms、双 root 3,507ms，page error 0，最大 long task 3,849ms；只用于指出规模压力，不跨设备承诺。
- 当前 CSS 为 655,355 bytes，贴近 655,360-byte 硬线；保留既有 CSS 预算和 T-1650 状态，后续变更先减量。此浏览器内存宿主样本不能替代冷启动、真实 Android、真实宿主 I/O 或长会话验收。

# D-414：开发分支同步遵守双机保护区（2026-10-07）

- 用户授权同步当前仓库快照后，只推送 `dev/thispc-1002`；`main`、版本号、tag、Release 和集市保持不变。每次同步后以当前分支 HEAD 与 `git ls-remote` 复核，不在决策文档中固化会过期的 SHA。
- `PROGRESS.md` 是另一台电脑的持续写入区，已从远端最终快照中排除并保留在本机工作树；其它本轮代码、测试、原型和文档均已推送。
- 明天接手顺序：先保存另一台电脑的 `main` 本地改动，再回到本机 fetch 开发分支、处理合并冲突；不能用远端开发分支覆盖另一台电脑的 `PROGRESS.md` 或未推送工作。

# D-415：主档恢复先披露结构损耗，再进入确认与写入（2026-10-07）

- JSON 主档仍只包含项目、事件和墓碑；不因为用户需要“完整备份”就把偏好、模板、问卷或来源 Key 暗加进恢复包。独立配置边界继续由数据隐私文档说明。
- 导入文本在解析前限制为 8 MiB，避免异常文件先进入 `JSON.parse`；预检统计重复项目/记录/墓碑 ID、悬空记录和单位冲突，并把这些结果同时放入确认提示使用的 warnings 与恢复审计。
- 规范化仍负责既有兼容行为：重复项按模型规则合并、悬空记录被跳过、保存失败恢复内存主档；本轮只补充可解释性和拒绝上限，不改变事件、墓碑或独立配置的写入语义。

# D-416：恢复旅程先用生产序列化/预检闭环，再等待真实宿主证据（2026-10-07）

- 备份验收测试直接串接生产 `normalizeStore`、`serializeJson` 和 `preflightJsonRecovery`，验证“导出→受控增加数据→恢复预检→项目/记录/墓碑复核”的结果；测试同时确认独立配置不会进入主档 JSON。
- 这条内存旅程证明核心数据口径和审查提示，不冒充真实 `loadData/saveData`、用户取消、写入失败回滚或跨窗口竞态证据；这些仍保留在 T-1647 的宿主验收边界。

# D-417：恢复异常共享事实记录，提示只保留一个用户反馈面（2026-10-07）

- JSON 导入的超大、解析、形状和归一化异常映射为有限类别，写入 migration 审计与 `migration-rejected` 会话诊断；不把原始错误全文作为诊断 detail。
- 本地快照校验失败写 `migration-rejected`，快照持久化失败写 `save-failed`，并继续保留 restore 审计的来源、时间和失败边界。设置页使用 `settingsFeedback` 呈现结果，避免 toast 与设置页错误状态重复播报。
- 取消确认不进入这些失败路径；CSV/Loop/Obsidian 导入和真实宿主 I/O 失败仍作为 T-1648 后续矩阵，不把本轮静态/浏览器证据扩大解释为真实宿主验收。

# D-418：文件导入错误按阶段记录，整批事务语义保持不变（2026-10-07）

- CSV、Loop、Obsidian 及冲突决策确认统一调用 `recordImportFailure`：解析阶段使用 `migration-rejected`，进入持久化阶段后使用 `save-failed`；审计只保存来源和有限类别，不保存原始错误全文。

- 导入取消、空文件/无项目等用户可预期分支不记失败事实；已有整批保存失败回滚、输入清空和焦点恢复保持原样。设置页反馈作为唯一错误展示面，避免重复 toast。
- `test:ui` 通过只证明生产 bundle 的结构与浏览器场景，不等同于真实思源文件读写或 Android 容器 I/O 验收。

# D-419：诊断行提供恢复指南直达动作（2026-10-07）

- 诊断行始终显示“查看恢复指南”，点击后展开恢复说明、滚动到可视区域并把焦点放到 summary；滚动遵循现有 `reducedMotion` 偏好，动态 `aria-controls` 绑定当前设置 surface，并对旧版 WebView 保留无参滚动回退；不改变导出与诊断记录逻辑。

# D-420：成熟度进度同时保留数值与本地化读法（2026-10-07）

- 洞察成熟度条继续使用 `aria-valuemin/max/now` 表达 0–66 参考刻度，并新增 `aria-valuetext` 表达“已坚持 N 天”；数值供工具计算，本地化文本供读屏和用户理解，二者不互相替代。

# D-421：洞察筛选重绘后恢复原控件焦点（2026-10-07）

- 项目、范围和自定义日期变更仍通过既有 `host.render(root)` 重绘；绑定层只在原 activeElement 匹配对应筛选选择器时，重绘后调用 `focus({preventScroll: true})`，不复制渲染逻辑，也不改变滚动位置与筛选校验。

# D-422：洞察待记录日与未安排日分开播报（2026-10-07）

- `pending` 日格使用既有本地化“未记录”文案；`off` 继续表示未安排/无机会。只调整可访问标签和 title 的状态映射，不改报告状态、进度或统计分母。

# D-423：洞察图例显式解释待记录色标（2026-10-07）

- 图例增加 `pending`/“未记录”项，并使用主色轮廓对应的色标；与日格的 `pending` 状态一致，不引入新的状态或数据字段。

# D-424：不可用日格只补播报，不重复扩张图例（2026-10-07）

- `unavailable` 日格使用“不可用 / Unavailable”文案，与 `off` 的“未安排”分开；由于两者当前都使用低透明度且没有独立色标，图例暂不新增重复项。

# D-425：JSON 主档持久化失败进入保存诊断（2026-10-07）

- JSON 导入写入失败继续写入 migration 审计的 `persist-failed` 边界，并新增有限 `save-failed/json-import-persist-failed` 会话诊断；内存主档回滚、用户反馈和审计落盘顺序不变。

# D-426：恢复点列表导入按 restore 类型记录阶段失败（2026-10-07）

- 恢复点列表导入解析失败与确认后的持久化失败使用独立事实记录器，审计类型保持 `restore`；取消确认不记录，诊断码按阶段映射为 `migration-rejected` 或 `save-failed`，不把恢复点导入伪装成主档迁移。

# D-427：恢复入口读取失败使用 load-failed 事实（2026-10-07）

- `restoreLatestBackup` 读取恢复点桶失败时写 `local-snapshot/snapshot-load-failed` restore 审计与 `load-failed` 诊断；空桶、无匹配恢复点和用户取消仍是可预期分支，不记录失败事实。

# D-428：恢复点清空先持久化再替换内存（2026-10-07）

- `clearSnapshotHistory` 在存储锁内成功写入空历史后才清空 `snapshotHistory` 并重绘；写入失败保留旧列表，记录 `save-failed/snapshot-clear-persist-failed`，交由设置动作生命周期显示失败反馈，避免界面先空而持久化仍有恢复点。

# D-429：洞察日期格采用响应式 roving tabindex（2026-10-07）

- 洞察窗口保留原生日期 button，仅当前日或自定义窗口末日进入 Tab 序列；方向键按实际 CSS 网格行数决定左右步进，Home/End 定位边界，Enter/Space 继续既有日期钻取，不引入 grid role 或改变统计口径。

# D-430：恢复点导出只记录读取失败（2026-10-07）

- 导出恢复点桶的 `loadData` 失败记录 `load-failed/snapshot-export-load-failed`，并沿用设置动作忙碌、失败反馈和焦点回退；`downloadSnapshotHistoryFor` 当前为无返回值下载封装，因此不把浏览器/宿主文件保存结果误报为已观测失败。

# D-431：恢复点导出透传统一保存结果（2026-10-07）

- `downloadSnapshotHistoryFor` 改为返回统一 `SaveOutcome`；仅当 `/assets` 写入通道明确返回 `failed` 时记录 `save-failed/snapshot-export-save-failed`。浏览器 Blob 和移动端宿主桥的既有行为、异步宿主保存边界保持不变。

# D-432：设置诊断摘要隐藏机器细节（2026-10-07）

- 设置页最新诊断行只显示原因码对应的本地化标签和恢复建议；detail 继续保留在机器可读 API 与导出预览，避免 `snapshot-*`、宿主异常文本或路径细节进入普通用户文案。

# D-433：启动读取失败补充稳定诊断（2026-10-07）

- `onLayoutReady` 的批量存储读取异常记录 `load-failed/startup-load-failed`；若异常发生在迁移持久化阶段，`persist()` 已记录保存失败，启动层不重复追加。初始化失败屏、停止写入和就绪信号保持原语义。

# D-434：导出序列透传等待边界，批量失败只报告可观测资源写入（2026-10-07）

- 回顾页 JSON、CSV、Markdown 导出返回 `SaveOutcome` Promise，`export-all` 依次等待三份文件，避免原生保存面板并发；单份失败仍允许后续格式继续尝试，底层统一通道负责错误提示。
- Loop 与 Obsidian 多文件导出按既有顺序继续处理后续文件，并聚合 `/assets` 写入失败数；设置页在完整序列结束后释放 busy，部分失败写入稳定 `save-failed` 诊断并显示重试路径。`native` 只代表资源写入成功并已派发宿主请求，不扩张为宿主最终保存成功。
- 恢复点 FAQ/用户指南补充导入、导出、清空的阶段化排查与数据保留承诺；不把内部原因码写进用户文案，README 保护边界不变。

# D-435：语义跳转复用原生点击，组合包创建判定统一稳定计划（2026-10-08）

- 渲染块中的日期格、汇总行和锚点行已经是带 `role`/`tabindex` 的语义跳转元素；键盘 Enter/Space 委托到同一元素的 click，并阻止 Space 默认滚动。原生 `[data-block-record]` 按钮不参与该委托，避免改变打卡写入次数。
- 组合包批量创建与部分应用统一以最新 `buildTemplatePackApplicationPlan` 的 `templateAnchor`/中英文别名判定创建资格；冲突行保留查看/编辑入口但禁用 checkbox，选择计数与提交集合只包含可创建条目，防止并发或语言切换造成重复项目与错误数量反馈。真实宿主竞态和移动读屏现场仍不由本地 bundle 证据代替。

# D-436：日期网格使用分组语义，装饰节点不进入读屏导航（2026-10-08）

- 月视图与年度热图的 CSS 网格不是完整 ARIA grid，也没有 `listitem` 直系子项；将容器设为带既有本地化摘要的 `role=group`，避免读屏播报错误的列表计数。星期标题和前置空位仅负责视觉布局，标记为 `aria-hidden`；日期格继续保留完整日期 `aria-label`、Tab 停靠与跳转。

# D-437：组合包异步应用暴露忙碌状态并守住旧 surface（2026-10-08）

- 组合包部分/批量应用按钮在 mutation 等待期间使用原生 `disabled` 与 `aria-busy="true"`，保留原 `aria-disabled` 状态；完成或失败回调先检查绑定会话和按钮连接状态，再清理 busy、恢复按钮和处理反馈。旧 surface 已销毁时不再写 detached DOM。
- 保存失败或最新计划没有可创建条目时，仍在当前 surface 将焦点回到操作按钮，便于重试；成功创建继续回到 Today。生产 bundle 测试覆盖忙碌、回滚、反馈和焦点，真实宿主竞态仍需现场验收。

# D-438：导入冲突确认复用设置动作生命周期（2026-10-08）

- 冲突决策确认按钮统一通过 `runSettingsAction` 执行，持久化等待期间使用原生 `disabled` 与 `aria-busy="true"`，避免重复提交；失败保留冲突会话并恢复当前按钮焦点，成功移除面板后聚焦仍存在的设置返回入口。
- 失败路径继续使用既有整批回滚、阶段化诊断和设置反馈，不改变冲突决策、导入数据或取消零写入语义。真实宿主 I/O 结果仍需现场验收。

# D-439：导入错误反馈固定化并披露 Obsidian 无效文件数（2026-10-08）

- Obsidian 解析得到的无效文件数属于用户可见结果，随普通导入、空结果和冲突确认会话一起保留并提示；不改变有效习惯、记录或回滚语义。
- CSV、Loop、Obsidian 与冲突确认失败只显示按解析/保存阶段区分的固定文案；原始异常不进入设置反馈，既有 `recordImportFailure` 继续记录有限机器原因。

# D-440：洞察日期格方向键服从实际 CSS 网格流向（2026-10-08）

- 日期格键盘移动同时读取 `gridTemplateColumns`、`gridTemplateRows` 与 `gridAutoFlow`：默认按行填充时左右为 1、上下为列数；按列填充时左右为行数、上下为 1。
- 保留 Home/End、roving tabindex、原生 button 和既有 click 钻取语义，不把固定桌面列数套到窄屏布局。

# D-441：清空审计入口复用设置动作生命周期（2026-10-08）

- 清空审计按钮通过 `runSettingsAction` 调用既有锁内清除方法，等待期间统一暴露 `disabled`/`aria-busy` 并拦截重复点击；失败重渲染后优先恢复可用的清空入口，成功清空后回到设置返回入口。
- 保留 `clearAuditEntries` 的锁内空桶替换、失败恢复和提示语义，不把设置入口生命周期与审计数据删除边界混在一起。

# D-442：恢复点 canonical 快照先做存储形状校验（2026-10-08）

- 带 `siyuan-checkin-snapshot` 格式的恢复点必须同时含有限 `version` 与数组形状的 `items`、`events`、`eventTombstones`；缺失或错误的 `store` 标记为 invalid，不进入历史恢复点。
- 直接恢复遇到 invalid 快照时在 `preflightJsonRecovery` 之前拒绝并写入有界 `migration-rejected/snapshot-history-corrupt` 诊断，避免坏对象被归一化为空主档；旧版无格式 raw store 继续走 legacy 兼容路径。

# D-443：清空专注诊断入口复用设置动作生命周期（2026-10-08）

- 专注诊断清空按钮通过 `runSettingsAction` 调用既有锁内清除方法，等待期间统一暴露 `disabled`/`aria-busy` 并阻止重复写入；失败重渲染后回到可用清空入口，成功清空后回到设置返回入口。
- 保留 `clearFocusDiagnostics` 的远端合并、清除水位、锁内保存和失败提示语义，不改变专注完成事实或问题归档规则。

# D-444：恢复点历史 inspection 区分损坏 canonical 桶与 legacy raw store（2026-10-08）

- `inspectStoreSnapshotHistory` 返回有效条目、是否识别 canonical history 以及坏条目计数；canonical 元数据或快照条目损坏时不再回退为 legacy 空 store。
- 启动和直接恢复对坏桶记录 `migration-rejected/snapshot-history-corrupt` 与 restore 审计，并向用户说明跳过数量；旧版无格式 raw store 继续保持兼容。导出与追加路径暂不改变。

# D-445：导入冲突按来源名称聚合重复行（2026-10-08）

- 冲突计划先按来源名称聚合重复 parser 行，`dateCount` 求和后只生成一个决策；这样与现有设置 radio 分组、session 决策和 plugin-ops 的 name Map 保持同一身份口径。
- 同名来源若出现多个类型或单位，决策按不兼容处理并默认跳过，避免把不同语义静默合并；逐文件独立决策需要稳定 sourceKey 全链路改造，暂不引入。

# D-446：双机合并后的唯一稳定基线与版本升级（2026-10-08）

- `135ff336` 已同时包含主线电脑上传到 `origin/main` 的 `38843cd1` 及本机开发；后续 GitHub、本机和其他机器统一以 `main` 为同步入口，保留 `dev/thispc-1002` 作为开发历史，不删除或重写历史。
- 本轮功能范围从 v18.16.0 升为 v18.17.0：版本四元组、README 当前入口、变更记录和发布说明必须同一提交链更新，历史版本文档不批量改写。
- 发布与安装包来源固定为 `main`；tag/Release 如执行只能以 `main` 为目标。真实思源、Android、外部来源账号和集市验收仍是独立边界，不因本地质量链通过而冒充完成。

# D-447：第十轮回执、恢复点与 UI 状态边界（2026-10-09）

- 批量 API 的重复 `externalRef` 回执在首条事实写入成功后共享其 `eventId`；这保持逐输入对账能力而不重复创建事件。失败批次仍不回填事实 ID。
- 恢复点基线必须在串行保存队列内读取上一笔已提交 Store；恢复事务收到 `enqueueMutation` 的 undefined 哨兵时视为失败并进入拒绝审计。恢复对遵守锁的宿主是精确替换，旁路并发由写后校验合并以避免静默丢失。
- `reducedMotion` 的 CSS 选择器以真实 `.lc-checkin` 根及其 owning surface 为边界；所有用户可见的设置、绑定、摘要、建议、持久化、Agent、专注与编辑器错误反馈只允许有限文本经过 `sanitizeDiagnosticDetail`，未知或非文本异常使用本地化通用错误。
- 事件墓碑继续保留外部身份，不在缺少长历史证明前按时间或数量静默裁剪；多桶备份 schema 与完整生命周期测量继续作为后续任务，不以本地定向夹具冒充现场验收。

# D-448：第十二轮旁路反馈与候选校验同步边界（2026-10-09）

- 日记、日志、摘要和锚点等旁路写入的宿主失败原因，跨入普通用户反馈前必须经过 `safeUserErrorDetail` 并使用本地化通用错误兜底；机器可读诊断仍可保留结构化原因，不能把内核路径、凭据或控制字符直出到 toast。
- 叶归映射候选搜索会重绘目标列表，因此搜索完成后必须立即重算行级校验、保存按钮禁用态和 `aria-invalid`；校验的结果不依赖用户再次触发 blur 或输入。浏览器夹具的文案断言按中英文环境分别锁定，避免测试语言与产品语言脱节。
- 本地自动化链、生产 bundle 和夹具通过不替代真实思源宿主、Android/TalkBack、第三方账号、缩放与保存面板现场验收；视觉浏览器环境仍受 `CHECKIN_BROWSER` 阻塞记录约束。

# D-449：第十三轮多 root 事项动作与待处理箱耐久性（2026-10-09）

- Today、Review、Occasions 的事项完成、撤销、补记和改期动作必须把发起 surface 的 owning root 传入宿主；迟到异步结果只允许更新仍属于该 root 的 UI，不能借宿主级 current page 代理反馈到另一窗口。
- 事项表单提交状态同时由 form 和 submit button 暴露 `aria-busy`/`disabled`，重绘不会清掉读屏和键盘用户正在等待的状态；取消按钮继续只使用 `disabled`，避免把可取消动作误报为忙碌提交。
- 外部待处理箱的事实写入和箱清理必须以持久化结果共同决定成功；清理写失败时恢复旧箱、保留可重试条目并显示失败反馈，启动批量恢复同理。不能因为事实已经幂等写入就把未持久化的箱状态当作已完成。

# D-458：第十四轮公开 API 与周复盘工具反馈边界（2026-10-09）

- 公开 `completeOccasion` 的 Promise<boolean> 是稳定契约：宿主未 ready、正在卸载、参数不合法或 mutation 未执行时均返回 `false`，只有底层完成结果严格为 `true` 才返回 `true`。
- Dock Tomato 主记录与收件箱清理是一个用户动作；主记录成功不等于收件箱清理成功。清理持久化失败要恢复条目并保留幂等重试，不能显示完成 toast 后静默丢失待处理事实。
- 周复盘保存、导出、复制 AI、清除按钮共享一次性 busy 生命周期；导出结果只把 `SaveOutcome=failed` 显示为失败，其余结果表示已提交到保存通道，不扩张为宿主最终保存成功。

# D-459：全插件复核补丁发布（2026-10-09）

- 用户明确授权在梳理收口后通过 `gh` 更新版本并发版、推送；本次授权覆盖 AGENTS 的日常不 push 约定，仅用于发布本轮已验证成果。
- 多轮复核以兼容性修复为主，采用补丁版本 v18.17.1；从 `main` 创建新 tag 与正式 GitHub Release，不复用 tag、不回写 v18.17.0 历史摘要、不推送集市。
- 发布前执行完整质量链、显式 Chromium 明暗主题与宽度走查、最终 ZIP 摘要和非 CI 发布资产检查；真实思源/Android/TalkBack/第三方账号/缩放/保存面板证据缺口在说明中保留，按 D-275 不作为设备等待前置。
- 第十四轮决策编号由重复的 D-451 顺延为 D-458，保留第五轮原 D-451 身份。

# D-460：原型对照轮的异步状态与入口范围（2026-10-09）

- 所有用户可见异步动作在途时必须有单飞守卫及可感知的 busy/disabled 状态；失败后恢复当前表面上的重试入口，旧 surface 的迟到结果不得操作新页面。周复盘字段在操作期间锁定，避免异步清除覆盖新输入。
- 可见的宽屏 Tab/Dock/对话框承载提醒时，通知加入该 surface 的文流，避免固定浮层覆盖主内容；无可见 surface 时才挂到 body。已有移动端 inline 规则沿用，不改变送达、静音或提醒内容语义。
- v3 的移动/桌面导航与 Settings 健康总览属于信息架构迁移，不通过本轮局部修补冒充达标；入口迁移需保持现有深链、功能可达、返回上下文和选中态，范围登记 T-1831/T-1819/T-1822。
- disabled 控件应在同组就地说明前置条件；保存视图“删除”仅在选中一个实际保存视图时可用。Review 未来日期和未绑定文档目标使用本地化原因提示。

# D-465：Task Horizon bridge 的固定绑定与刷新代次（2026-10-10）

- Task Horizon 消费端只能使用用户明确绑定的 `itemId`；`recordTaskCompletion()` 不接受临时换绑。显式绑定可在 `start()` 前保留待写身份，但 `start()` 仍负责项目存在、归档、方向和单位校验；provider 最终拒绝时保留原 payload 待处理。
- `api.subscribe()` 的事件类型无 `checkin:` 前缀；window CustomEvent 名才带前缀。事件刷新同时推进摘要/投影代次、清空缓存和在途 Promise 索引；同步投影本身不声称可中断，但旧结果不得调用渲染回调或覆盖新数据。
- 绑定项目的单位从目标快照读取，默认仅在未提供单位时回退“个”；`externalRef` 日期只做身份去重，历史补录和跨午夜重试必须使用 v5 `recordEventsBatch + occurredAt`。普通任务回写、内部可撤销打卡循环和旧积分事件保持互斥，不共享未版本化身份。

# D-466：首次使用引导的密度与操作层级（2026-10-10）

- 新用户引导继续放在 Today 空态，不使用强制弹窗，避免阻塞首次记录；三步核心路径始终可见，功能概览使用默认收起的原生 `details`，需要了解信息架构时再展开。
- “新建第一个打卡项”是首要动作，使用主按钮并排在跳过之前；跳过仍可用但降为次级按钮，跳过后持久隐藏三步和功能概览。主按钮与跳过按钮在窄屏均保留足够触控高度，且不改变已有用户的活跃列表布局。

# D-467：全量体验复核第十六轮的状态与返回语义（2026-10-10）

- 事项统计必须复用已计算的筛选口径并提供真实按钮入口；统计按钮使用 `aria-pressed`、标题提示和统一焦点/激活样式，避免“看得到数字但点不了”的伪入口。
- 归档返回属于一次性 root 级上下文：进入归档时记录 Today/Review/Insights/More 来源，返回后恢复来源页面及其已有会话状态；任意普通导航清理过期 `returnTo`，避免 stale 跳转，多 root 不共享该状态。
- 异步创建文档属于单飞动作：按钮在请求期间必须 `disabled + aria-busy`，成功、失败和 surface 销毁都要释放；用户反馈只在仍连接的发起 surface 更新。
- 本轮本地自动化全部通过不等于真实思源、Android/TalkBack、第三方来源、缩放和保存面板现场已验收；继续保留既有阻塞边界。

# D-468：v18.17.3 独立内核 E2E 与发布口径（2026-10-11）

- 真实 E2E 使用独立 workspace 和独立内核；可写默认端口 6807，只读端口若冲突通过 `CHECKIN_E2E_READONLY_PORT` 改为空闲端口。不得附着真实用户工作区，也不以共享模式替代隔离验收。
- 思源 API 的 `Authorization: Token` 对应 `conf.api.token`；`accessAuthCode` 是锁屏访问码，E2E 不再把两者混用。靶场守门只额外承认思源自动生成的 `icons`、`themes` 和默认引导笔记本。
- 只读内核若日志已报告 `kernel booted` 但 `bootProgress` 不到 100，则用同 token 的 `system/version` 成功作为就绪信号；该回退不放宽认证、工作区和写入拒绝检查。

# D-469：恢复精确替换以三方差异投影隔离陈旧窗口（2026-10-15）

- T-1796 的交错夹具证明：恢复入口在独占锁内首次写入可以精确替换，但若另一窗口仍持有恢复前的完整 Store，随后 `enqueueMutation` 或 `teardownFinalFlush` 用整份本地快照与远端并集，会把恢复点外的旧项目、事件和旧版本重新写回。恢复点缺项不能直接当作普通墓碑；快照可能合法恢复同 ID 的旧项目，不能用时间戳把它误判为删除。
- 主 Store 三方协调改为先计算 `local - lastPersistedStore` 的真实变化（新增/修改/事件墓碑/项目墓碑），再将变化并入重读远端。未变化的陈旧本地实体随远端恢复结果消失；真正发生在恢复交错窗口中的新事件、项目修改和墓碑仍按既有并集合并。锁内重读远端同时更新 `lastPersistedStore`，使之后的恢复点基线与实际已落盘 Store 对齐。
- 该规则适用于普通 mutation 与卸载补写，不改变偏好桶后写者胜或多桶恢复范围；恢复失败仍恢复内存并保留拒绝审计。`tests/storage-transaction.test.cjs` 覆盖旧实体/旧版本不回流、新事件保留、卸载收尾、持久化失败与既有并发写入，真实思源双窗口仍需现场复测。

# D-470：先测主 Store 快照写放大，再决定存储优化（2026-10-15）

- T-1807 首轮基线采用独立观测脚本 `scripts/storage-snapshot-benchmark.cjs`，只调用模型/事务纯函数，不启动 Plugin，不把内存 host 结果写成真实思源 `saveData` 现场证据。矩阵覆盖 1k/10k/100k 事件、plain/稀疏附件/事件与项目墓碑、恢复历史 1/3 条，并记录规范化、历史追加、恢复读取、序列化、深拷贝写后校验、失败回滚和三方协调。
- 重复基线显示 100k plain 主档约 16.1 MB、三份历史约 48.2 MB，主档加三份历史约 4.0 倍；稳定轮次的历史追加约 1.51～1.54 s，100k 墓碑组约 1.58～1.59 s。脚本另注入一次读回缺失并保留并发事件，确认事务修复路径会达到 `attempts=2` 且保留竞态事件。该结果仅建立基线，不改变 Store v3、恢复 replace 语义或墓碑生命周期策略；仍需真实失败阶段和宿主 I/O 数据后，再决定分层、压缩、节流或索引化。

# D-471：T-1807 失败阶段只记录事务边界，不提前承诺宿主回滚（2026-10-16）

- 基准脚本新增两个阶段模拟：备份写失败时主档和备份均保持原值；主档写失败时主档保持原值，但备份已按 `persist()` 的“先追加恢复点、后写主档”顺序变化。这明确了当前事务边界，也说明主档失败后的恢复点保留不能直接称为整笔原子回滚。
- 读回错配场景注入一次并发事件和一次缺失快照，验证 `persistNormalizedStoreWithVerification` 使用第二次尝试收敛并保留竞态事件。所有结果仍来自纯函数和内存 host，不替代真实思源 `saveData`、配额失败、卸载预算或双窗口现场证据。
- 在真实宿主 I/O、大附件和失败后重载证据补齐前，不改 Store v3、恢复 replace 语义或墓碑生命周期，也不设置性能硬门槛。

# D-472：墓碑压缩必须先有可验证写入水位（2026-10-16）

- T-1799 设计确认：事件墓碑不仅阻止事件 ID 复活，还保留外部来源的 `source + externalRef` 去重身份；项目墓碑还要阻止旧项目及其事件从旧窗口、恢复点和迁移输入回流。按时间、数量或“当前主档没有实体”裁剪都无法证明安全。
- 当前推荐先保留墓碑逻辑语义，优化索引、分桶和序列化表示；只有引入版本化 generation/epoch、来源/窗口确认水位、恢复点最低代际和可重放守门后，才评估真正删除冷墓碑。该设计不改 Store v3，不引入 schema v4，不关闭 T-1799。
- 设计稿见 `docs/tombstone-lifecycle-design-2026-10.md`；后续依赖 T-1807 的真实宿主 I/O、失败重载和大附件证据。

# D-473：CSS 对比度先修复可复现阻塞，再做重复规则微收敛（2026-10-16）

- T-1813 首个实现切片只处理有自动化红证的 Today 首次成功主按钮：渐变背景增加 `--lc-checkin-accent-fill` 不透明回退，前景使用 `--lc-checkin-accent-contrast`，计算样式审计可得到稳定背景，同时保留视觉渐变和双主题语义。
- 删除移动 Insight 图例与基础层完全相同的规则；≤380px 的 `gap: 3px` 特殊覆盖保留。构建后 CSS 为 669,838 bytes，重复规则约 4,072 bytes，继续执行 620 KB 软提醒与 660 KiB 硬阻断，不以全库字号/`!important` 重排换取短期字节收益。
- `accessibility-audit` 的 light 主题“打卡”违规从 1 个（1.07:1）降为 0 个；本地自动化不替代真实思源、Android/TalkBack、缩放和保存面板现场。

# D-474：三方投影保留会阻止外部重放的既有身份墓碑（2026-10-16）

- T-1796 的差异投影仍按基线排除未变化普通项目、事件和普通事件 ID 墓碑，确保显式恢复不会被旧窗口整份快照污染；但当本地基线已有带 `source + externalRef` 的外部身份墓碑，且远端包含同一身份的重放事件时，必须把该墓碑带入投影。
- 该例外只保护外部身份去重屏障，不改变普通事件墓碑的精确恢复语义；`normalized-transaction`、`storage-transaction`、`item-tombstone` 和 `tombstone-concurrency` 夹具以及完整主测试/扩展链均通过。

## D-477：T-1813 Insight 圆点尺寸重复声明只做等价删除（2026-10-16）

- `@container lc5 (max-width: 600px)` 内 `.lc-checkin__insight-legend i` 的 `8×8/radius:2px` 只是在更早规则上重复声明；文件后段同选择器已按最终顺序覆盖 radius，Insights 专用规则还以更高特异性设置 9×9、flex-basis 和 margin。
- 本切片只删除尺寸声明，保留 `.is-complete/.is-partial/.is-missed/.is-off` 四条颜色状态规则；不改变窄屏图例的 gap 3px 特殊覆盖。
- 证据：`pnpm run build`、`pnpm run check`、`node scripts/css-audit.cjs --json`、`node tests/css-hygiene.test.cjs`、`git diff --check` 通过；CSS 669,472 bytes，重复规则约 3,703 bytes。

## D-478：T-1814 被后置全局规则覆盖的字号声明先清理（2026-10-16）

- `@media (max-width: 340px)` 的移动导航 `small { font-size: 7px; }` 与 `@media (max-width: 600px)` 的 `8px` 声明，选择器和后置全局 `.lc-checkin__mobile-nav button small { font-size: 9px; }` 相同，最终计算值一直是 9px。
- 本切片只删除无效的源声明，不把“全库字号统一到 12px”写成已完成；正文、辅助文字、数据徽标和紧凑控件的可读性仍需按 T-1814 分层、宽度和缩放证据逐项决定。
- 证据：`pnpm run build`、`pnpm run check`、`node scripts/css-audit.cjs --json`、`node tests/css-hygiene.test.cjs`、`git diff --check` 通过；CSS 669,403 bytes，重复规则约 3,703 bytes。

## D-479：T-1814 先完成无效来源清理，再决定真实字号提升（2026-10-16）

- 本轮只删除两个被后置全局 9px 规则覆盖的移动导航 7px/8px 声明；主测试、响应式、主题和无障碍审计均通过，实际计算字号不变。
- 剩余 7～11px 声明按真实职责保留为待审计对象，必须先用 320/390px、Dock、英文和 400% 缩放证据区分正文、辅助、徽标和紧凑控件，再逐项调整；不以全局替换 12px 作为当前策略。

## D-480：回执折叠事实面板必须显式尊重 hidden（2026-10-16）

- Chrome 英文宽度走查确认 `.lc-checkin__record-details` 的作者级 `display:grid` 会覆盖浏览器 `[hidden]` 默认样式；回执节点又被挂到 `.lc-checkin` 外层宿主，不能依赖 `.lc-checkin [hidden]` 的内部规则。
- 统一增加 `.lc-checkin__record-details[hidden] { display: none !important; }`，确保折叠事实面板不参与布局与命中测试，撤销按钮保持可点；展开态仍由现有 DOM 切换使用 grid。
- 证据：Chrome 英文浅色 width walkthrough 全矩阵通过；record-details、build、check、pnpm test、accessibility、responsive、theme 定向测试通过。

## D-483：T-1807 补测夹具必须显式隔离且诚实区分故障来源（2026-10-16）

- 双窗口并发写入和写失败重载恢复都挂在 `pnpm run benchmark:storage:host`，普通 E2E 不自动执行，避免真实内核大样本和故障注入污染常规套件。
- 并发夹具使用空的 count 项目，两个窗口分别写入不同 `externalRef`，要求主档和两个重载窗口同时保留两条事实；不能用已有完成事件的 binary 项目，否则会在存储锁前被业务完成门阻断。
- 失败夹具只替换当前插件实例的 `saveData` 并仅拒绝 `checkin-store`，辅助待处理箱继续经真实宿主存储；该结果证明插件失败回滚与重载重试语义，不证明思源内核自然 I/O 故障、断电或网络失败恢复。T-1807 在独立靶场实际重跑前不关闭宿主证据缺口，也不触发 Store v3、schema v4、压缩、分层或节流改造。

## D-485：Task Horizon 按原始来件重验、分批声明就绪（2026-10-16）

- 归档 2026-10-12 原件并保持字节与 SHA-256 不变；历史报告不能代替当前源码和测试证据。当前补 W-01/02/04/05、C-04 验收与 legacy bridge 日期保护，不将十项全部标记完成。
- 日历 C-01～C-04 先收口，再做普通任务回写 W-01～W-06；每批全部通过后才声明对应 integrationContracts。新合作统一使用 v5 batch，消费端拥有队列；single 的 undefined 不等于无事实，消费方 discard 不能撤回 provider pending。
- 保留配额累计量与六状态兼容，补字段另行验收；保持通用非排期 logged，不把 Task Horizon 专用限制扩大到其它来源。现有 v4 bridge 仅作当日参考，双插件现场另记。
- 用户既有“发版”授权用于发布本轮已验证补丁 18.17.6；回复与附件仅准备为可转发材料，不自动对外发送。

## D-484：T-1807 宿主补测完成后转入幂等契约，不因预算改存储架构（2026-10-16）

- 独立全新靶场 `D:\AI\Codex\e2e-t1807-current`、思源 3.8.7、端口 6828 的 `benchmark:storage:host` 3/3 通过：快照预算、双窗口并发 2/2 事实落盘并重载收敛、受控主 Store 写失败后重载重试单事实。
- 双窗口夹具必须使用空 count 项目，避免 binary 首条事实完成门在存储锁之前拒绝并发调用；并发报告为 `.artifacts/storage-host-concurrency.json`。
- 失败夹具只证明插件 `saveData` 入口的回滚/重试边界，不能代表思源内核自然磁盘、网络或断电故障；失败报告为 `.artifacts/storage-host-failure-reload.json`。
- T-1807 继续保留为测量/证据任务，不引入 Store v3、schema v4、压缩、分层或节流。下一开发切片转入 T-1786 的 API/Agent/快速入口幂等回执统一。

## D-488：T-1827 双主题硬编码色收口第一切片（2026-10-19）

- 全仓 20 处 `color: #fff` 硬编码（components 19 + tokens::selection 1）按背景语义收口到三对 token：accent 背景 → `var(--lc-checkin-accent-contrast)`，success 背景 → 新增 `var(--lc-checkin-success-contrast)`（light=#FFFFFF / dark=#141419），deep/暗色底 → `var(--lc-checkin-deep-text)`。
- 同步新建 `success-contrast` 在 light/dark 两组 token 中；不动现有 v3 卡片层 `card-bg / card-border / card-shadow`。
- 暗色主题下选中态在 accent 紫罗兰底上从硬白字改为 `accent-contrast #141419` 自动反转，是 T-1813 治理清单第 4 项的语义修复。
- 范围限定：不做 `color-mix(in srgb, #fff NN%, ...)` 内联白色混入的批量替换、forced-colors 适配与四调色板对比截图门禁；这些由 T-1827 的后续切片处理。

## D-489：T-1816 卡片 surface 四级统一第一切片（2026-10-19）

- 新增 4 对语义 token（light+dark 共 8 行）：`card-border-selected` / `card-shadow-raised` / `card-shadow-selected` / `card-bg-selected`。
- 把 components.scss 中 5 类高频卡面（`__item` / `__history-event` / `__history-selected` / `__insight-stats div` / `__insight-section`）从 v2 `shadow-sm` 切到 v3 `card-shadow` 语义，hover/selected 走对应 hover/selected 变体。
- 保留：表面`surface` 输入/筛选条（不下沉到 card）、focus-timer deep 块、all-done success 块、week-load 单元；这些不属于 page/card/raised/selected 四级。
- 范围限定：`__all-done`、week-load、review-compare、focus-timer、quick-dock、mobile-nav 五个高频面与 workbench/maintenance-responsive 之间的卡片收口未做，留作后续切片。

## D-490：T-1818 表单字段语义 token 收口第一切片（2026-10-19）

- 新增 8 对表单字段语义 token：`field-radius` (8px) / `field-border` / `field-border-strong` / `field-padding-x` (8px) / `field-padding-y` (4px) / `field-bg` / `field-height` (32px) / `field-height-lg` (38px)。
- 6 个高重复字段定义（custom-range / journal-notebook / icon-panel / search-field / insight-custom-range / insight-picker）切到上述 token。
- 不动 30/36/40/42/44px 等高变体字段、72/84/88/100px 文本域、移动端/设置层覆盖；这些与"分类化"标签、帮助、必填、错误原因、成功、dirty、busy、disabled 状态合并一并留作下一切片。
- 范围限定：error / success / busy / disabled 状态规则合并与 T-1788 错误态视觉矩阵按 T-1813 治理节奏逐个收口。

## D-491：T-1817 主次操作按钮层级第一切片（2026-10-19）

- 新增 5 对操作按钮语义 token：`button-height-sm` (30px) / `button-height` (34px) / `button-height-lg` (38px) / `button-radius` (8px) / `button-radius-pill` (999px)。
- `__text-button` 与 `__save-button` 的 `border-radius` 已切到 `button-radius`，基线按钮 primary/secondary/quiet 的 radius 收口。
- 不动 6 类核心按钮的 height（28/30/34/36/38/42px 实际变体），更不动 secondary/quiet/destructive/icon 四级动作的语义化命名（每张卡一个主动作、长文案可换行、桌面与移动共用语义）。
- 范围限定：先收口 token 基线（radius），再下一切片按 `button-height-sm/md/lg` 收口 height 变体，最后用 4 级动作复合类做语义化。

## D-492：T-1817 主次操作按钮层级第二切片（2026-10-19）

- 按 30/34/38 三档 button-height token 迁移 6 类核心按钮的 height 定义：record-button 默认（28→30）/ dock record 与 quick（30）/ text-button 默认 34 / settings text-button 38 等。
- 36 字符保留为字面量（与 `--lc-checkin-control-height: 36px` 主按钮基线一致）；42 字符保留为字面量（关键大主按钮基线，例如编辑器 save 按钮）。
- 范围限定：不强行压缩 36/42 字符差异，不重命名按钮类（`__text-button` / `__record-button` / `__save-button` / `__primary-button` 仍按功能命名）；4 级动作语义化与 workbench / maintenance-responsive 按钮收口留作下一切片。

## D-493：T-1820 空态/引导/加载/错误状态视觉语言第一切片（2026-10-19）

- `tokens.scss` 新增 3 对状态语义 token：`state-radius` (10px) / `state-padding` (12px) / `state-title-weight` (600) / `state-description-size` (12px)。
- `components.scss` 中 `__error` / `__empty` / `__empty-title` / `__empty-description` 与 1991 行移动端宽屏 `__empty` 全部切到 state token。
- `__error` 的 padding/radius 进一步切到 T-1818 的 field token，保持与字段一致的"基座错误"识别。
- `tests/ui-state-ledger.test.cjs` 的硬编码 `padding:10px` 断言同步更新到 token 形式——契约测试随 SCSS 演进。
- 范围限定：未动统一图标、loading/slow/error/empty 高度与反馈节奏；`__onboard-start` / `__onboard-skip` 引导按钮与主按钮的层级关系、T-1788 错误态视觉矩阵按 T-1813 治理节奏逐个收口。

## D-494：T-1813 卡片组合 shadow 收口（2026-10-19）

- `tokens.scss` 新增 2 对组合 token：`--lc-checkin-card-elevated` / `--lc-checkin-card-elevated-hover`，分别打包 `card-highlight` + `card-shadow` 与 `card-highlight` + `card-shadow-hover` 的双层组合。
- `src/ui/workbench.scss` 中 6 处显式 `box-shadow: var(--lc-checkin-card-highlight), var(--lc-checkin-card-shadow[...])` 全部切到组合 token，重复规则减少 6×N 字节。
- 范围限定：只合并阴影双层组合；不动 `card-shadow` / `card-shadow-hover` / `card-shadow-raised` / `card-shadow-selected` 单独的语义；不动 components.scss 中的单层 shadow。下一轮可继续按相同思路合并 `card-border + card-border-hover` 的组合选择子等。

## D-495：T-1816 卡片 surface 第二切片 + T-1813 热力色阶收口（2026-10-19）

- `tokens.scss` 新增 4 档 `heat-step-1..4` token（accent + surface 派生阶梯），light 9/22/42/100%，dark 14/28/52/100%。
- `components.scss` 中 3 个热力上下文切到 token：`__insight-day` 4 档、`__yearheatmap` / `__yearheatmap-legend` level-4。
- `tests/low-pressure-baseline.test.cjs` 的 `var(--lc-checkin-accent)` 契约断言更新为 `accent|heat-step` 接受形式。
- `__calendar-day` 4 档保留 lilac 偏移（暖色 vs 紫语义差异），不强行并入。
- 范围限定：未动 `__all-done`、week-load、review-compare、focus-timer、quick-dock、mobile-nav 与 workbench / maintenance-responsive 之间的卡片收口。

## D-496：T-1816 卡片 surface 第三切片：success/accent 软化收口（2026-10-19）

- `tokens.scss` 新增 3 对软化色 token：`success-bg-soft`（10/14%）/ `success-border-soft`（28/32%）/ `accent-soft-strong`（22% accent 混入 transparent）。
- `__all-done` (today 1684) 切到 `success-bg-soft` + `success-border-soft`；`__all-done` 主类 (1085) 边切到 `accent-soft-strong`。
- 范围限定：calendar-day 4 档保留 lilac 偏移；week-load-row.is-on 保留单色 accent-soft（二档语义不需 4 档）。剩余 review-compare、focus-timer、quick-dock、mobile-nav 四个高频面。

## D-497：T-1816 卡片 surface 第四切片：focus-timer 主题叠加色收口（2026-10-19）

- `tokens.scss` 新增 4 个 deep-overlay 浅层白色 token：`deep-overlay-soft` 0.10 / `deep-overlay-icon` 0.12 / `deep-overlay-track` 0.14 / `deep-overlay-border` 0.20。
- `components.scss` 中 `__focus-timer` 4 处 `rgba(255,255,255,...)` 字面量切到 token：`__focus-icon` / `__focus-progress` / focus-presets 按钮边 / `__focus-actions` hover。
- 范围限定：仅做 focus-timer 主题叠加；review-compare / quick-dock / mobile-nav 三个高频面按 T-1816 第五切片继续。

## D-498：T-1816 卡片 surface 第五切片：mobile-nav 顶部阴影收口（2026-10-19）

- `tokens.scss` 新增 `nav-shadow` token（`0 -2px 10px color-mix(text 7%, transparent)`），把 `__mobile-nav` 顶部负向阴影字面量收口为单一来源。
- 范围限定：`__dock-host` 在不同断点（mobile / dock / dialog-mobile / editor）的 min-height 散落值（46/50/52/54/58px）保留字面量——这些差异是不同 surface 容器的视觉微调意图，不强行合并。
- 剩余：review-compare 内部组件的 card shadow 收口。

## D-499：T-1813 CSS 重复规则去重与容器查询收敛（2026-10-19）

- `src/ui/review-detail.scss`：将两段 100% 镜像重复的 `@container lc-dock (max-width: 1199px)` 与 `@container lc5 (max-width: 1199px)` 统一收敛为单一 `@container (max-width: 1199px)`。
- `src/ui/components.scss`：将两段 100% 镜像重复的 `@container lc5 (min-width: 720px)` 与 `@container lc-dock (min-width: 720px)` 下文档目标卡栅格规则统一收敛为单一 `@container (min-width: 720px)`。
- `src/ui/components.scss`：提取 `@container lc-dock (min-width: 720px) and (max-width: 900px)` 与 `@container lc-dock (min-width: 901px)` 间的 4 条共有规则（item/item-action/body/name）到全局 `@container lc-dock (min-width: 720px)`。
- `src/ui/components.scss`：清理 4 处断点中与 base 样式完全冗余的 `.lc-checkin__mobile-nav button small { font-size: 9px; }`。
- 收益：`dist/index.css` 重复规则从 39 降至 22（降幅 44%），重复规则字节从 3,703 降至 1,670（降幅 55%）；产物总字节从 674,656 净减至 672,324（净减 2,332 字节 / 2.28 KiB），为 660 KiB 硬线腾出 3.43 KiB 安全缓冲。

## D-500：T-1828 长文本截断与换行策略第一切片（2026-10-19）

- 在 `tokens.scss` 增加 `--lc-checkin-line-height-tight` (1.25) / `--lc-checkin-line-height-base` (1.45) / `--lc-checkin-line-height-relaxed` (1.6) 统一排版行高语义。
- 在 `components.scss` 引入 `@mixin lc-text-truncate`、`@mixin lc-text-clamp-2`、`@mixin lc-text-break`，利用 mixin 避免无消费方的 standalone class 触发 `css-hygiene` 死类门禁。
- 表单标签 `.lc-checkin__field > span` 移除单行 `nowrap` 限制，改为 `overflow-wrap: anywhere; word-break: break-word`。
- 事项小标题与说明 `.lc-checkin__occasion-row-body small` 从单行 ellipsis 改为 2 行 clamp，保证信息完整度。
- 历史记录备注 `.lc-checkin__history-event-note` 移除窄屏强制单行截断，统一走自适应换行，确保横向无溢出。
- 范围限定：第一切片聚焦排版基础设施与高频卡片；独立展开/复制组件交互留作下一阶段。

## D-501：T-1819 顶部导航与分区导航活动态与焦点规范第一切片（2026-10-19）

- 顶部导航标签 `.lc-checkin__topnav-tabs button` 高度切到 `var(--lc-checkin-button-height-lg)`，圆角切到 `var(--lc-checkin-button-radius-pill)`，显式补齐 `:focus-visible { outline: 2px solid var(--lc-checkin-accent); outline-offset: 2px; }` 键盘焦点环；活动选中态强化字重至 650 并使用 accent-text / accent-soft。
- 设置侧栏导航 `.lc-checkin__settings-nav button` 圆角切到 `button-radius-pill`，高度切到 `button-height`，活动态保留 accent 强化指示与选中底色。
- 回顾/数据范围选择条 `.lc-checkin--review .lc-checkin__range-tabs button` 及其自定义展开钮圆角全部收口到 `button-radius-pill`，选中卡片投影切到 `card-shadow`，补齐 `:focus-visible` 焦点指示环。
- 范围限定：第一切片收口顶部与主要分区导航的高亮/圆角/高度与焦点；移动端导航栏折叠与横向滚动溢出蒙层指示留作下一切片。

## D-502：T-1823 Review/Insights 数据可视化皮肤统一第一切片（2026-10-19）

- `content-responsive.scss` 中的 `.lc-checkin__insight-stats` 统计容器及其子项分割线统一接入 v3 卡片语义 token（`card-border` / `radius` / `card-bg` / `card-shadow`），消灭跨宽屏与默认态的材质跳变。
- `components.scss` 中的 `.lc-checkin__insight-legend` 与 `.lc-checkin__insight-grid` 未达成状态统一收敛到 `color-mix(in srgb, var(--lc-checkin-danger) 70%, transparent)`，消除图例与图表网格颜色不一（原先混用 accent 52%、danger 62%、danger 70%）的表达分裂。
- 范围限定：第一切片聚焦统计卡材质与基础状态色对齐；后续切片处理热力图刻度、空态纹理和高低对比模式。

## D-503：T-1821 编辑器长表单分组与粘性操作栏第一切片（2026-10-19）

- `.lc-checkin__form-scroll` 底部安全区内边距扩展至 `calc(58px + env(safe-area-inset-bottom))`，杜绝长表单末尾字段或模板预览被 sticky footer 遮挡。
- `.lc-checkin__editor-actions` 粘性操作栏背景升级为 `color-mix(in srgb, var(--lc-checkin-bg) 92%, transparent)` + `backdrop-filter: blur(8px)`，阴影收敛至 `var(--lc-checkin-nav-shadow)`，消除明暗双主题下硬编码半透黑阴影。
- 范围限定：第一切片解决滚动遮挡与操作栏半透阴影；后续切片梳理基础字段→排期→高级的分组视觉隔离与折叠动效。

## D-504：T-1822 事项管理行卡片化与改期输入规范第一切片（2026-10-19）

- `.lc-checkin__occasion-manager-row` 彻底切换到 v3 卡片语义 token（`card-border` / `radius-sm` / `card-bg` / `card-shadow`，悬停 `card-border-hover + card-shadow-hover`），彻底抹平事项列表与历史列表、打卡项目之间的卡片质感差异。
- `.lc-checkin__occasion-manager-row.is-today` 升级为 `card-border-selected + card-bg-selected + card-shadow-selected`，双主题选中阴影与底色同源。
- `.lc-checkin__occasion-move-row input` 输入字段统一切到 `button-height-sm`、`field-border`、`field-radius`、`field-bg`。
- 范围限定：第一切片收口事项管理行与改期内联输入的卡片化与字段 token；移动端返回与设置大标题布局重排留作后续切片。

## D-505：T-1851 预览读取与正式摄取游标隔离（2026-10-19）

- `src/index.ts` 中的 `healthScanCursor`、`noteQueryScanCursor` 与 `yeguifScanCursor` 推进逻辑统一添加 `if (!preview)` 守卫，确保预览操作纯只读，绝不推进正式游标。
- 杜绝预览操作提前“吞噬”未实际持久化的增量文档，防止后续自动或手动正式扫描漏读数据。
- `tests/scan-cursor.test.cjs` 增补针对三处来源游标 `!preview` 隔离的自动化断言，保证契约永久不退化。

## D-506：T-1852 来源配置变更代际指纹与扫描游标自动复位（2026-10-19）

- 在 `health-inbox.ts`、`note-query.ts`、`yeguif-adapter.ts` 引入 `getHealthInboxFingerprint`、`getNoteQueryFingerprint`、`getYeguifFingerprint` 确定性配置指纹函数。
- 在 `src/index.ts` 会话层维护三类扫描指纹；摄取执行前对比指纹，检测到换绑（如绑定文档变动、查询范围变更、笔记本切换、映射修改或清除）时立即复位对应的会话游标为空串 `""`。
- 确保从新绑定的文档或范围从第一页完整扫描，杜绝上一文档的块 ID 游标在目标文档 SQL 中造成越界过滤或数据漏摄。
- 变更失败或预览操作保留原有指纹与游标状态；`tests/scan-cursor.test.cjs` 增补纯函数与插件接线的自动化门禁断言。

## D-507：CSS 维护态硬预算调整至 680 KiB（2026-10-19）

- 用户明确授权将 CSS 生产产物硬阻断线从 660 KiB（675,840 bytes）适度上调至 680 KiB（696,320 bytes），以容纳后续主题、状态和无障碍维护的合理样式需求；620 KB 软提醒与 0 死类硬性门禁严格保持不变。
- `tests/css-hygiene.test.cjs` 与 `tests/reminder-density-browser.cjs` 中的大小预算护栏同步调整至 680 KiB。
- 当前实际样式体积为 673,347 bytes（657.5 KiB），安全缓冲从原 2.43 KiB 扩展至 22.43 KiB。

## D-508：T-1853 同来源定时/启动/手动摄取在行 Promise 合并与代际防护（2026-10-19）

- 在 `src/index.ts` 声明 `healthInFlight`、`noteQueryInFlight`、`wereadInFlight`、`yeguifInFlight` 四个在行请求 Promise 与对应的会话代际自增计数器。
- 定时器轮询、应用启动或用户在设置面板快速连点“立刻同步”时，若已有同来源在行请求未完成，直接复用已有 Promise，杜绝重复向内核发起并发 SQL 查询与写事实数据竞争。
- 预览操作（`preview === true`）若遇在行写入任务，主动排队等待前序写入平稳落定再读取，杜绝读取半落盘脏状态。
- 摄取状态与报告回填（`sourceIngestReports` / `wereadLastPull`）绑定递增代际，旧请求的慢回执绝不覆盖最新发起的手动或定时摄取报告。
- 新增 `tests/source-inflight.test.cjs` 守门测试，纳入 `pnpm test` 与 `pnpm run test:v18` 全流程门禁。

## D-509：T-1854 内核读取与网关调用的有界超时、卸载取消与游标保持（2026-10-19）

- 底层通信 `kernelPost` 接入 10s 客户端有界超时（`DEFAULT_KERNEL_POST_TIMEOUT_MS = 10000;`）与卸载阻断（`this.disposed || this.disposing` 立即拒绝 `plugin-disposed`），超时使用 `Promise.race` 竞态兜底并在 `finally` 块中严格清理 `setTimeout` 定时器。
- 微信读书出站网关 `wereadGateway` 引入 18s 客户端兜底超时竞态（`WEREAD_CLIENT_TIMEOUT_MS = 18000;`）配合 15s 内核转发代理超时与卸载阻断，杜绝前端永久挂起。
- 游标与事实保持：健康收件箱、笔记推导与叶归三处分页扫描读取遇超时或拒绝错误时，严格保持游标不推进、不退化已有持久化事实，如实输出 `read-failed` 可诊断状态。
- 新增 `tests/bounded-timeout.test.cjs` 自动化契约断言，纳入全流程门禁。

## D-510：T-1856 渲染块锚点解析失败重试、超时与代际清理（2026-10-19）

- `src/render/block-renderer.ts` 为锚点异步解析引入 8s 有界超时竞态（`ANCHOR_RESOLVE_TIMEOUT_MS = 8000;`），并在 `finally` 中严格回收定时器。
- 解析超时或失败时，在 `.catch()` 块中从 `anchorResolveRequested` 模块级集合清除当前待解析 blockId，并渲染带 `data-block-anchor-retry="true"` 的失败重试占位。
- 预览点击监听器拦截 `[data-block-anchor-retry]` 点击，无需重载页面即可就地重触发解析渲染。
- 解析落定回调校验 `lastRenderedConfig.get(block) === configText`，用户修改代码块配置或换绑时自动丢弃陈旧结果。
- 导出 `clearAnchorResolveCache()` 并由 `src/index.ts` 的 `onunload()` 在插件卸载时统一清理；`tests/checkin-block.test.cjs` 补齐自动化守门断言。

## D-511：T-1857 渲染块记录按钮防重点、Pending 状态机与错误反馈（2026-10-20）

- 交互防重与状态机：`src/render/block-renderer.ts` 在今日打卡按钮点击时立即检查并设置 `data-record-pending="true"`，在 pending 态期间丢弃后续重入点击，杜绝连续快点造成多重入账或队列堆叠。
- 看门狗定时器：设立 6 秒自动超时安全兜底（`setTimeout(() => release(true), 6000)`），若宿主变异队列拥堵或发生未捕获异常，按钮绝不永久锁死。
- 宿主闭环与错误恢复：宿主 `src/index.ts` 中 `recordBlockToday` 返回 `Promise<boolean>`，在插件卸载/已销毁/未找到项目/变异捕获错误时返回 `false`。渲染块根据 Promise 结果解除 pending：成功直接解除；失败或拒绝则标记 `data-record-error="true"` 并在 2.5 秒后自动清除，呈现错误反馈后允许用户再次点击重试。
- 视觉样式与样式预算：`src/ui/components.scss` 通过属性选择器 `&[data-record-pending]`（`opacity: 0.6; pointer-events: none; cursor: wait`）与 `&[data-record-error]`（红色边框与文字）提供清晰无障碍视觉反馈，零新增类名，严格控制 CSS 体积在预算以内。
- 自动化契约守门：在 `tests/checkin-block.test.cjs` 建立状态机流转、防重丢弃、看门狗兜底、错误释放与样式定义的完整自动化断言。

## D-512：T-1858 特殊项目 ID 的焦点选择器安全回归（2026-10-20）

- 根因消除：核对发现 `src/index.ts` 中打卡后焦点还原处 `root.querySelector(\`.lc-checkin__item[data-item-id='${focusItemId}']\`)` 采用原生单引号插值，当项目 ID 包含单双引号、反斜杠、方括号等字符时会触发 `DOMException` 语法崩溃；将其统一升级为 `CSS.escape(focusItemId)` 双引号属性选择器。
- 选择器规范统一：`src/index.ts`、`src/render/bind-today.ts`（`targetButton` 与 `currentElement`）及 `src/render/bind-page-navigation.ts` 全部保持一致的 `CSS.escape` 严格转义规范，杜绝特殊字符引发的选择器解析失效。
- 16 种极端 ID 夹具守门：新增 `tests/special-id-selector.test.cjs` 并在真实 Chromium 容器中跑通包含单双引号、反斜杠、括号、冒号、点号、井号、空白、组合符、CJK 中日韩、Emoji、320+ 超长字符在内的全量夹具矩阵，验证 querySelector 零抛错、卡片精准命中、子打卡按钮成功获焦，以及多 root 作用域隔离与滚动位置保留。

## D-513：T-1855 扫描游标跨重载续读方案评估（不做持久化，保留会话态幂等重扫）（2026-10-20）

- 评估结论明确：**不采用（Do Not Adopt）**跨重载游标持久化方案，维持当前「会话态有界分页 + 重载幂等去重（`externalRef` + 墓碑 + 来源指纹）」基线。
- 语义完整性防线：思源笔记为大纲结构，用户可任意在文档顶部或中间前插历史块。若将游标按 `id > cursor` 固化至磁盘，重载后前插块（`id < cursor`）将被永久漏读；而会话态重扫天然全量对账，杜绝漏读。
- 性能实测验证：基准测试表明，内存对账 1,000 行扫描数据与 50,000 条历史事件去重耗时仅约 0.4ms（远低于 15ms 预算），游标持久化带来的跳读收益近乎为零，反而会引入每次推进写盘（`saveData` 单次 300~400ms I/O）的巨大磁盘开销。
- 零存储侵入与自愈：不破坏 Store v3 结构，不新增辅助存储桶，不增加多窗口读写冲突风险。换绑文档/笔记本时指纹变动即刻自动复位游标，崩溃或异常重载后天然自愈。
- 自动化契约守门：建立 `tests/cursor-persistence-assessment.test.cjs`，持续验证会话态不变量、前插块不漏读对比及 50k 事件内存对账性能基线。

## D-514：辅助存储桶跨窗口审计、合并分类与拆除生命周期（T-1860，2026-10-20）

- **辅助存储桶三分类架构（明确语义边界，杜绝盲目套用并集）**：
  1. 追加型（Append-only）：AI 分析历史（`AGENT_ANALYSIS_CACHE_KEY`）与操作审计日志（`AUDIT_STORAGE_NAME`）。多窗口并发生成时采用确定性并集合并（`mergeAnalysisSnapshots`、`mergeStoreAudits`），跨窗口互不丢失；在 `onDataChanged` 中重读远端并集合并；保存失败时严格执行内存状态回滚（`this.analysisHistory = previousHistory`），防止脏快照滞留；卸载期纳入 `onunload` 有界预算排空（`waitWithinDeadline`）。
  2. 覆盖型 / LWW（Overwrite）：视图偏好（`VIEW_PREFERENCES_NAME`）与会话草稿（`journalDrafts`、`settingsDrafts`）。严禁套用并集合并逻辑，并集会使得偏好重置操作失效（被旧磁盘快照复活）；采用最后写入者胜（LWW）或规范化全量覆盖。
  3. 显式删除与增删改型（Explicit Delete & Mutation）：用户模板（`USER_TEMPLATES_NAME`）、自定义图标库（`CUSTOM_ICON_LIBRARY_NAME`）、问卷日记独立桶（`JOURNAL_DATA_NAME`）与建议工作流。纯粹并集会导致用户主动删除的项被远端脏文件复活；`persistUserTemplates` 与 `persistCustomIconLibrary` 统一计算差集（`deletedIds` / `deletedIcons`），先剥离远端待删除项后再合并；问卷独立桶基于 `lastPersisted` 脏检查，无本地编辑时跟随远端，有本地编辑时保持本地状态。
- **守门与测试**：新增 `tests/auxiliary-buckets-lifecycle.test.cjs` 并纳入 `test:v18`，对三类桶的静态代码断言、删除防复活模拟、AI 历史回滚及覆盖型偏好隔离进行全量验证。

## D-515：版本化多桶备份 envelope 协议（T-1862，2026-10-20）

- **协议结构**：`BackupEnvelope { envelopeVersion, pluginVersion, exportedAt, buckets: Record<string, BackupBucketPayload> }`。`envelopeVersion` 作为解析守卫（当前仅接受 `1`），未来协议不兼容时通过版本号分流；`pluginVersion` 用于未来迁移决策；`exportedAt` 用于冲突报告的时间戳展示。
- **默认桶注册表 `DEFAULT_BACKUP_BUCKETS`**：主档（`checkin-store`）`defaultIncluded: true` 强包含；其余辅助桶（视图偏好、模板、图标、问卷、审计、专注诊断、提醒动作、建议工作流、提醒送达、AI 分析缓存、场合桶）`defaultIncluded: false`，用户逐桶 opt-in。
- **敏感桶遮罩**：审计日志、专注诊断、提醒动作、提醒送达、AI 分析缓存默认 `masked: true`（载荷为 `null`），导出时显式勾选才纳入。
- **默认导入决策**：`defaultResolutionForCategory` 复用 D-514 分类语义——追加型默认 `merge`（并集），覆盖/增删改/主档默认 `overwrite`（后写者胜）。`skip` 由用户显式选择。
- **守门文件**：`src/backup-envelope.ts` + `tests/backup-envelope.test.cjs`（纳入 `test:v18`）。

## D-516：空态/引导与 4 级动作按钮语义系统收口（T-1817 / T-1820，2026-10-20）

- **4 级动作语义收口（T-1817）**：
  1. Primary (`.lc-checkin__primary-button, .lc-checkin__record-button, .lc-checkin__save-button`)：紫罗兰渐变胶囊、白字、微阴影、悬浮微按压动效。
  2. Secondary (`.lc-checkin__secondary-button`)：浅底/深底背景、边框胶囊、深色字、悬浮平滑变色。
  3. Quiet / Text (`.lc-checkin__text-button, .lc-checkin__quiet-button`)：透明底、弱化字色，hover 转紫罗兰弱底。
  4. Destructive (`.lc-checkin__destructive-button, .lc-checkin__delete-button`)：低频弱化，hover 转红底红字危险色，安全不突兀。
  5. Icon (`.lc-checkin__icon-button`)：圆形 44px/hit 触达，图标居中。
  - 键盘无障碍焦点：为全级别按钮统一定制高可见度的 `:focus-visible` 环与 2px `outline-offset`，消除浏览器原生焦点框错位。
  - 高对比度自适应：在 `@media (prefers-contrast: more)` 下为全部 5 级按钮统一注入显式边框与 outline。
- **空态/引导/错误状态视觉统一（T-1820）**：
  - `tokens.scss` 补充 `--lc-checkin-state-min-height: 140px`、`--lc-checkin-state-error-min-height: 88px`、`--lc-checkin-state-icon-size: 28px`。
  - `.lc-checkin__empty` 与 `.lc-checkin__error` 全面收口为 state token 继承。
  - `.lc-checkin__onboard-skip` 告别下划线超链外观，接入 pill radius、统一字号与 quiet button 交互规范。
- **i18n 与测试基线加固**：
  - 补齐 `block.scopeLoadFailed` 与 `common.retry` 中英文词条，消除 `i18n-hygiene.test.cjs` 报告的丢失键。
  - 修复 `tests/yeguif-ingest.cjs` 模拟宿主缺少生命周期标记（`acceptingOperations` / `storageReady` / `noteQueryIntegration`）导致的误测漏洞，恢复 100% 绿灯。





