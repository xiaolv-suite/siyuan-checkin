# 小驴打卡单一事实来源待办池（Single Source of Truth Backlog）

- **更新日期**：2026-10-31（方向收敛与三件事落地后更新）
- **方向基准**：见 [`docs/DIRECTION-2026-10-31.md`](DIRECTION-2026-10-31.md)（先读方向，再取待办；停止全量排查与逐条打磨，按需取用）
- **当前版本基线**：`v18.45.0`（本轮按新规不升版本号、不打新标签）

---

## 一、 本轮已完成项（2026-10-31 方向收敛批次）

- **第 1 件（测试守行为 + 零引用模块移出 `src`）**：25 个未接入运行时的离线评估模块与 26 个对应测试移入 `archive/offline-contract-models/`（清理 `FN-08`）；新增 `tests/helpers/css-cascade.cjs`，将 17 个断裂的样式源码正则测试改为编译后有效层叠断言。
- **第 2 件（样式覆盖层收敛 + 下调 CSS 硬上限 + `UI-01`）**：清理死声明与重复规则，`dist/index.css` 从 `736,092B` 降至 `654,623B`（`-81.5KB`），硬上限从 `720KiB` 下调并锁死在 `640KiB`（`655,360B`）；修复 `UI-01` 深色专注预设按钮对比度（`1.25:1` → `8.95:1`）。
- **第 3 件（今日首屏只保留一个“下一步” + `UI-10`）**：移除 NextHero 重复副标题，无独立事项提醒时将优先提醒横幅合入 NextHero，非今日页隐藏内联每日提醒条；340×720 侧栏首张卡片完整落在首屏内（`top=494px, bottom=574px`）。
- **`FN-01`（手动同步今日打卡到日记）**：查重 SQL 支持 >500 块分页 + 实时 `/api/export/exportMdContent` 双保险去重，校验 `appendBlock` 返回状态，消除假成功提示与超长/连续点击日记重复追加。
- **`FN-06` 死分支清理**：移除 `src/render/focus-timer.ts` 中 `if (false as boolean)` 死分支。
- **真实思源内核 + 真实浏览器 E2E 全链路走查闭环（`pnpm e2e:isolated`）**：
  - **`FN-02`（手动排序联动与焦点保持）**：`reorderItems` 成功后调用 `renderBackgroundUpdate()` 同步所有打开表面并恢复被移动卡片焦点；`todaySortMode === "manual"` 时 `NextHero` 按手动顺序取首项。
  - **`FN-03`（异步异常可感知反馈）**：新建页「复制提示词」增加 `execCommand("copy")` 兜底与失败提示 `editor.aiDraftPromptCopyFailed`；回顾页逾期补记撤销、建议采纳/推迟/忽略异常时弹出明确错误提示。
  - **`UI-02` & `UI-06` & 操作行对齐**：回顾页「历史分析对比弹窗」「智能体建议预览弹窗」补齐 `.lc-checkin.lc-checkin-dialog-host` 与 `data-appearance` / `data-palette` 及 `>=32px` 按钮；事项页筛选下拉框高度统一为 `36px`；消除 `.lc-checkin__text-button` 在 Flex 操作行内的 `15px` 历史顶边距偏移并补齐洞察页 `.lc-checkin__insight-actions` Flex 间距。
  - **`FN-07`（更多页分类跳转定位）**：「更多」页点击分类卡进入设置页后使用 `scrollIntoView({block: "start", behavior: "instant"})` 并聚焦分类标题。
  - **思源文档落地五通道实测修复**：① 修复 `appendUnderMarkdownSection` 误将思源标题叶子块（`type='h'`）作为 `appendBlock(parentID)` 导致配置分节标题后无法落盘的问题（改为在下一同级/上级标题前 `insertBlock` 或文档末尾 `appendBlock`）；② 修复 `getEventsInDateRange(store, todayKey, todayKey)` 半开区间传参错误导致单日 LifeLog 手动同步、报告输出预览、专注复盘统计漏算当日事件的缺陷；③ 修复新建笔记本首次创建 Daily Note 时优先调用 `/api/filetree/createDailyNote` 消除多级路径 `document metadata is not ready` 报错；④ 修复编辑器保存/归档/删除后未清除 `root.dataset.editorDraftBaseline` 导致误弹未保存确认框；⑤ 分离专注按钮与打卡按钮的 250ms 防抖键（`focus:${itemId}`）。

---

## 二、 保留待办（当前真实影响交互的待办已清零）

当前第一批真实影响交互的待办（`FN-01`、`FN-02`、`FN-03`、`FN-07`、`UI-01`、`UI-02`、`UI-06`、`UI-10`）已全部实测闭环并通过 `pnpm e2e:isolated` 验证。

---

## 三、 推迟 / 放弃 / 冻结清单（详见 [`DIRECTION-2026-10-31.md`](DIRECTION-2026-10-31.md)）

- **推迟（等有真实用户反馈再议）**：`UI-03`、`UI-04`、`UI-05`、`UI-07`、`UI-08`、`UI-09`、`BP-009`。
- **放弃（不做）**：`FN-04`（起草第二候选）、`FN-05`（已有项目自然语言规则微调）、`FN-06`（专注闲置自动暂停）、`BP-010`（愿望积分兑换）。
- **外部冻结**：`PL-01`（宿主退出后台通知）、`PL-02`（思阅/思播跨窗口会话 ID）、`PL-03`（Task Horizon 消费端）。
