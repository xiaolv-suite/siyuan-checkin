<div align="center">

<img src="icon.png" width="96" alt="小驴打卡图标" />

# 小驴打卡

**思源笔记里的本地优先习惯、打卡与复盘工作台**

把一次行动记录下来，再用同一份可追溯数据完成统计、提醒、复盘和笔记联动。

**当前版本：18.43.0**

18.43.0 达成「外部来源迟到响应代际守门、API v5 取消中断与墓碑生命周期治理」版本发布：全面闭环并核销了外部来源迟到响应配置代际守门与写前动态复核（T-1684）、API v5 批量写 AbortSignal 取消支持与宿主未就绪快速失败契约（T-1670）、以及事件墓碑生命周期治理与级联删除规范化收口（T-1799）；57 项专项、移动端、全量生态与无障碍质量链 100% 全绿通过；版本号升级至 18.43.0，本地构建打包签名完成；遵循用户指示，保持本地提交与更新，严格不向远程推送。这里介绍本次更新与已实现功能，后续开发进展见 [PROGRESS](PROGRESS.md)。

> **内测说明**：小驴考试、小驴管家、小驴闪卡和小驴常用目前仍处于内测阶段，部分功能和思源宿主兼容性正在验证中。欢迎通过交流 QQ 群 **871707735** 反馈问题、提交需求；对稳定性有较高要求时，请等待对应插件发布正式版。

[![最新 Release](https://img.shields.io/github/v/release/ai68298100/siyuan-checkin?display_name=tag&sort=semver)](https://github.com/ai68298100/siyuan-checkin/releases/latest) [![CI](https://github.com/ai68298100/siyuan-checkin/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ai68298100/siyuan-checkin/actions/workflows/ci.yml) [![License](https://img.shields.io/github/license/ai68298100/siyuan-checkin)](LICENSE)

[最新 Release](https://github.com/ai68298100/siyuan-checkin/releases/latest) · [18.43.0 发布说明](docs/releases/release-notes-18.43.0.md) · [问题反馈](https://github.com/ai68298100/siyuan-checkin/issues) · [开发文档](docs/)

</div>

### 本次更新（18.43.0）

本次为「外部来源迟到响应代际守门、API v5 取消中断与墓碑生命周期治理」版本，提供全外部生态安全摄取守门与公开契约强化。

新增：外部来源代际守门与写前复核

- **外部来源请求代际守门全覆盖（T-1684）**：为微信读书、叶归 LifeLog、健康收件箱、笔记推导、思播、思阅六大外部来源建立全面的请求与会话代际守门（`wereadGeneration`, `yeguifGeneration`, `healthGeneration`, `noteQueryGeneration`, `siplayerGeneration`, `sireaderGeneration`），偏好重载与插件卸载时自增代际全链路阻断在飞请求。
- **写前动态复核机制（T-1684）**：在 `enqueueMutation` 锁内写事实前，动态复核来源启用状态（`enabled`）、目标项目绑定（`itemId`, `finishItemId`, `notesItemId`, `metricBindings`）、笔记本/文档有效性以及配置指纹（`fingerprint`），并在叶归中动态复核分类映射解析，迟到响应可诊断丢弃，坚决不写旧目标。
- **API v5 批量写 AbortSignal 取消支持（T-1670）**：`recordEventsBatch` 正式支持 `options?: {signal?: AbortSignal}`，在入队前与未执行时提前退出，拒绝并抛出 `Error("checkin: batch recording was aborted")`。

优化：公开契约与墓碑生命周期治理

- **API v5 宿主未就绪快速失败（T-1670）**：在 `src/api.ts` 的 `recordEventsBatch` 中，统一在宿主未就绪、卸载中或已释放时快速失败（返回 Promise.reject），杜绝进入队列挂起。
- **墓碑级联删除规范化（T-1799）**：在 `deleteItemsCascade` 中统一调用 `normalizeEventTombstones` 规范化，消除脏墓碑未去重未排序隐患；固化 50k 事件与 25k 墓碑级规范化与检索性能。
- **多窗口原子持久化与防丢（T-1622 / T-1807）**：完成主 Store、事项桶、提醒动作、失败箱和卸载收尾九维原子合并体系，写放大严格锁定 3:1，守护数据绝对安全。

修复：测试沙箱与防抖窗口断言对齐

- **物理防抖单测对齐**：修复 `tests/recording-history-structure.test.cjs` 在单测环境下连续点击未等待 250ms 物理防抖导致的假失败，并为 mock host 补齐 `appendLifelogToJournal` 与 `lifelogJournal` 桩；
- **设计令牌规范引用**：修复 `tests/share-card.test.cjs` 里对 `.is-milestone[data-reduced-motion="true"]` 设计令牌 `var(--lc-checkin-gold-text)` 的规范引用；
- **桌面弹窗与事务环境对齐**：修复 `tests/desktop-dialog.test.cjs` 单行规则匹配与 `tests/storage-transaction.test.cjs` VM 环境缺少 `clearAnchorResolveCache` 导致的中断。

<details>
<summary>历史版本更新（点击展开）</summary>

### 18.42.0

品牌矢量图标体系、CI/CD 自动化门禁与样式可维护性核心台账核销：全面核销 32×32 单色矢量图标 `iconLvCheckin` 与 256×256 经典长春花紫高清头像规范（T-1640）、GitHub Actions CI/CD 最小权限与并发取消自动化工作流（T-1652）、以及 SCSS 结构化瘦身与单一来源治理（T-1653）；全量 851 个 class tokens 零死类、重复样式规则削减 94%，样式体积稳定处于 680 KiB 预算之内。详见 [18.42.0 发布说明](docs/releases/release-notes-18.42.0.md)。

### 18.18.0

「可信行动事实层与生态连接里程碑」大版本：收口 Task Horizon 合作提供端协议（C-01~03、W-03），彻底消除跨时区与夏令时跨度漂移，全面落地多 root 跨表面交互隔离与表单草稿保护，统一写入幂等与隐私脱敏矩阵。详见 [18.18.0 发布说明](docs/releases/release-notes-18.18.0.md)。

### 18.17.6

完善恢复、跨窗口与外部批量写入的可靠性，并修正回执折叠和状态对比度。详见 [18.17.6 发布说明](docs/releases/release-notes-18.17.6.md)。

### 18.17.5

现代桌面质感与 UI 原型 v3 对齐：Today Hero 下一步行动卡、Settings Bento 健康总览、卡片高光与阴影、等宽数字、减少动效适配及部分图标与字号治理。详见 [18.17.5 发布说明](docs/releases/release-notes-18.17.5.md)。

### 18.17.4

- **滚动更顺畅**：Today 长列表启用延迟绘制，短横屏保持按钮可命中。
- **布局更稳定**：头像、日志附件和历史缩略图声明尺寸，加载时减少跳动。
- **安全不变**：图片仍经过安全 URL 校验，现有数据和交互协议保持兼容。详见 [18.17.4 发布说明](docs/releases/release-notes-18.17.4.md)。

### 18.17.2

- **提醒不遮挡**：可见 surface 使用页面文流，Today、编辑器和事项内容保持可见。
- **负荷位置**：未来七天负荷放在主任务区域下方，宽屏信息层级更清晰。
- **短屏可操作**：提醒收敛为 64px，预览、长文本和保存操作仍可到达。
- **入口一致**：More、设置健康卡和快速弹窗记录入口保持统一返回上下文。详见 [18.17.2 发布说明](docs/releases/release-notes-18.17.2.md)。

### 18.17.1

全插件功能与 UI 复核后的可靠性和体验补丁：失败可恢复（偏好、来源待处理、恢复点）、页面隔离（多窗口同屏独立焦点与排序）、双语反馈与严格日期校验。详见 [18.17.1 发布说明](docs/releases/release-notes-18.17.1.md)。

### 18.17.0

「双机合并后的事项工作台、微信读书推荐与跨表面可靠性收口」版本：支持微信读书推荐、事项工作台（改期/补标/里程碑）、跨表面状态隔离与无障碍优化。详见 [18.17.0 发布说明](docs/releases/release-notes-18.17.0.md)。

### 18.16.0 历史重点

- **事项页表单**：移动端打开表单直接定位，桌面端保留当前位置。
- **文档与笔记本选择**：问卷和叶归配置使用统一的搜索与候选列表，目标卡在宽窄容器均保持单列。
- **CSV 导入错误明细**：导入时无效行返回行号与原因（名称缺失/日期无效/数值无效），上限前 10 条。
- **设置页字体**：统一标题、分组和说明的层级，减少视觉噪声。

历史版本重点见 [发布说明目录](docs/releases/) 与 [18.14.0 变更记录](docs/v18.14.0-change-log.md)。

</details>

<div align="center">
<img src="preview.png" alt="小驴打卡今日、回顾、新建和深色主题界面" width="920" />
</div>

## 仓库与版本状态

- **稳定安装包**来自 `main` 分支上的发布 tag；普通用户请从 [Releases](https://github.com/ai68298100/siyuan-checkin/releases) 下载，不要直接下载开发分支源码。
- **当前开发**以 `main` 为统一基线；`dev/thispc-1002` 是已合入 `main` 的历史双机开发分支，不作为当前开发线。真实思源客户端验收以兼容矩阵中的现场证据为准。
- **问题反馈**请优先使用 [Issue 模板](https://github.com/ai68298100/siyuan-checkin/issues/new/choose)，安全漏洞请看 [安全报告说明](SECURITY.md)；不要在公开 Issue 中粘贴 Key、Token、笔记内容或完整诊断导出。

[安装与开始](#安装与兼容性) · [核心功能全景](#核心功能与作用全景) · [笔记联动与外部来源](#笔记联动与外部来源) · [接入 API](#api) · [开发与验证](#开发与验证) · [交流](#小驴系列与交流)

## 适合什么场景

小驴打卡适合想在思源笔记里维护习惯追踪、行动记录和复盘反思的人：
- **多样化目标体系**：二值完成（做/没做）、累计次数、专注时长、数值指标、自定义物理单位、周期配额以及被动戒除目标；
- **纯本地优先与隐私保护**：所有打卡事实与偏好均保存在思源本地存储，统计与导出完全离线进行，零网络外发、零第三方遥测；
- **全端与多表面形态**：支持固定在布局中的独立工作台页签、侧边栏常驻 Dock、全局快捷记录弹窗、嵌入式笔记渲染块以及移动端。

## 安装与兼容性

1. 打开 [GitHub Releases](https://github.com/ai68298100/siyuan-checkin/releases)，下载对应版本的 `package.zip`。
2. 在思源中打开“设置 → 集市 → 下载安装包”，选择压缩包安装。
3. 重载插件，从顶栏按钮、命令面板、dock 或移动端入口打开。

插件清单声明的最低兼容版本：思源 v3.8.4。既有自动化真实内核验证基线为思源 v3.8.5；浏览器视觉走查覆盖桌面、移动、窄宽度和双主题，真实客户端证据见[思源兼容矩阵](docs/siyuan-compatibility.md)。

升级前建议从设置页导出 JSON，并核对[备份范围](docs/export-formats.md)。插件不会修改思源内核，也不包含 `kernel.js`、`kernels` 或 `publish.data` 声明。

### 第一次使用（30 秒快速上手）

1. **新建**：在「新建」选一个模板，或填写名称、目标、单位和排期，保存项目。
2. **记录**：回到「今日」完成一次打卡；数值或时长项目可使用 `+1` / `+10` 等快捷增量，也可输入精确数值。
3. **复盘**：在「回顾」核对记录与多维图表，查看日/周/月度趋势。需要连接日记或外部应用时，前往「设置」启用对应联动。

---

## 核心功能与作用全景

小驴打卡围绕「行动记录 → 多维统计 → 深度洞察 → 习惯复盘 → 笔记联动」构建了完整的本地习惯养成闭环：

### 1. 今日打卡工作台（Today）
- **功能**：展示今日应完成的全部计划习惯，支持一键完成、`+1` 增量微调、精确数值录入、主动请假（Skip）、撤销打卡与卡片拖拽排序。
- **作用与价值**：
  - **Hero 下一步行动卡**：智能计算并置顶突出当前最该完成的下一步行动，提供即时开始专注与打卡通道，降低启动阻力；
  - **完成区分组折叠**：已完成卡片自动收拢至底部，保持首屏清爽，聚焦未完成事项；
  - **「那年今天」时光机**：自动回顾往年今日的打卡与历史日记，建立长期坚持的情感连接；
  - **未来 7 天排期负荷**：直观预演未来一周打卡强度，防止负荷过载。

### 2. 回顾与多维统计中心（Review）
- **功能**：日/周/月/年度/自定义区间的全方位数据聚合看板，支持事实日志流水、连续打卡天数（Streaks）、四色热力图、强度趋势与周期对比。
- **作用与价值**：
  - **周复盘三段式工作台**：引导用户以「事实回顾 → 阻碍与摩擦 → 行动调整」三步完成结构化周复盘，草稿本地持久化防丢，可一键导出 Markdown；
  - **习惯相关性与饱和度分析**：通过 Sigmoid 饱和曲线与习惯相关性矩阵，揭示多习惯之间的相互促进或挤占规律；
  - **年度成就墙与精美分享卡**：自动颁发里程碑成就徽章，生成可导出的精美年度/月度分享图片。

### 3. 单项深度洞察与教练建议（Insights）
- **功能**：单个打卡项的全生命周期健康诊断台，提供 84 日全景日历格、成熟度阶段评估与趋势对比。
- **作用与价值**：
  - **格子下钻与证据溯源**：点击日历格直接下钻至当日记录详情，点击教练建议可直接跳转调整排期规则；
  - **成熟度模型（66 天习惯养成）**：基于行为科学量化习惯从「脆弱期」到「自动化」的进阶轨迹。

### 4. 日期事项与纪念日里程碑（Occasions）
- **功能**：管理生日、节日、账单、纪念日、续费等一次性、周期性或公农历事项。
- **作用与价值**：
  - **自动派生里程碑**：纪念日自动计算「在一起满 100 天 / 结婚 5 周年」等自然历跨度与大整数天里程碑；
  - **错过补标与单次改期**：事项错过后支持补标记完成，遇到临时变动可灵活改期而不破坏原有长期重复规则；
  - **全表面统一提醒中枢**：与今日横幅、页内通知及回顾提醒中心一体化联动，支持临时关闭与今日不再打扰（Mute Today）。

### 5. 新建、模板库与智能推荐（New & Templates）
- **功能**：项目类型涵盖二值、计数、时长、自定义量词、周期配额以及被动戒除目标。
- **作用与价值**：
  - **79 款开箱即用内置模板**：涵盖健康运动、深度学习、工作提效、日常生活等全领域循证习惯模板；
  - **智能名称联想与推荐**：输入习惯名称自动联想匹配图标、单位与达标建议；根据已有项目动态生成互补场景组合包（如极简低打扰、阅读自动记账）；
  - **个人模板库沉淀**：支持将自定义习惯规则一键保存为个人模板，支持脱敏导出与分享。

### 6. 专注计时与嵌入式表面（Focus & Surfaces）
- **功能**：内置番茄钟与正向专注计时器，支持预设时长、声音提示与休息节奏。
- **作用与价值**：
  - **单调时钟防休眠跳跃**：页面隐藏、窗口失焦或系统休眠时，采用单调时钟严格扣除无效闲置时间，绝不伪造有效专注时长；
  - **多 Root 广播同步与跨页小条**：多窗口同时打开时，计时器状态与倒计时秒级同步刷新；切换到其他页面时展示底部迷你小条，单点控制会话，杜绝重复记账。

### 7. 笔记联动与知识库互动（Note Integration）
- **功能**：思源笔记生态深度双向连接，让打卡真正融入双链笔记系统。
- **作用与价值**：
  - **日记报告与生活日志（LifeLog）**：打卡事实自动以标准时间戳格式追加至当日日记文档中；
  - **摘要驻留卡片**：在指定总览文档中实时更新习惯打卡汇总区块；
  - **问卷日记（Journaling）**：打卡触发结构化问卷模板，答题内容直接写入目标笔记文档；
  - **笔记块双向锚点**：打卡项绑定思源块 ID，打卡后自动回写属性与备注，支持一键在思源中定位源文档。

### 8. 外部数据源可信摄取（Ecosystem Federation）
- **功能**：连接微信读书、叶归 LifeLog、健康收件箱、思阅、思播、笔记推导等 6 大外部来源。
- **作用与价值**：
  - **请求代际守门与写前复核**：配置变更或卸载时全局自增代际，入锁写盘前严格复核目标有效性，迟到响应可诊断丢弃，杜绝污染旧目标；
  - **LifeLog 200 条映射容量与双轨时刻**：彻底废除静默截断，时间轴优先消费源活动起始时间，防止被后台轮询时刻污染；
  - **冲突探测与单向安全红线**：跨来源同项目重复计量精准预警，坚决坚守零数据修改、零静默关闭、零历史篡改三大红线。

### 9. 数据安全、灾难恢复与多格式互通（Data & Export）
- **功能**：提供主 Store、多桶备份 Envelope、CSV、Markdown、Loop 与 Obsidian 等多通道出入。
- **作用与价值**：
  - **九维原子合并与并发协调**：多窗口交错打卡 100% 留存，事项删除墓碑优先防复活，偏好桶后写者胜（D-315），卸载收尾锁内合流防覆盖；
  - **有界写放大与快照防膨胀**：快照历史严格锁定为 3 份 FIFO 环形淘汰，写放大稳定 3:1，灾难故障一键无损自愈；
  - **全格式互通**：支持与 Loop Habit Tracker、Obsidian Habit Tracker 21 双向迁移，严格日历校验与公式注入中和保护。

---

## 记录、统计与导出

支持的项目类型：

- 完成一次：点击即可记录一次二值完成；
- 按次数、时长、数量或自定义单位：支持手动精确值、快捷增量和可选专注计时；
- 戒除类目标：不记录即成功，记录即破戒，连续无破戒日按同一模型计算。

计划支持每天、工作日、指定星期、间隔天数和周期配额。跳过日、自动完成日、配额和 at-most 目标各有独立统计口径。

回顾页提供原始事件日志、统计摘要、连续记录、热力图、强度趋势、周期对比、相关性洞察、成就和建议。导出前会披露可能包含的备注、图片或来源信息；导出的文件由用户自行保存和传输。

可用的迁移与备份通道包括 JSON、CSV、Markdown 报告、Loop Habit Tracker 和 Obsidian Habit Tracker 21。格式和身份规则见[导出与导入格式总览](docs/export-formats.md)及[记录身份与多端合并规则](docs/identity-and-merge.md)。

## 笔记联动与外部来源

日记报告、摘要驻留、问卷日记、笔记锚点、叶归 LifeLog、思阅、思播、健康和微信读书均为可选联动。设置 → 外部联动中的“笔记联动总览”集中列出绑定目标类型、目标 ID、启用状态和本次会话的健康检查结果，并提供打开目标或跳到配置的入口。

所有外部来源默认关闭；Key、目标 ID 和映射只保存在本地偏好。断开来源不会删除已经落盘的事件，重新连接仍按 `source + externalRef` 幂等去重。提醒中心是插件内呈现，不承诺系统级后台通知；插件不提供云同步、社交排行榜或付费补签。

## API

插件通过 `window.siyuanCheckin` 公开协议 `siyuan-checkin`，API 版本为 5。接入方应先等待就绪，再按能力协商：

```js
const checkin = window.siyuanCheckin;
await checkin.whenReady();

if (checkin.hasCapability("events.record")) {
  await checkin.recordEvent({
    itemId: "item-id",
    value: 25,
    unit: "分钟",
    source: "api",
    externalRef: "my-plugin-session-2026-001",
  });
}
```

主要能力包括 `items.read`、`items.query`、`events.read`、`events.range.read`、`events.record`、`events.record.batch`、`summary.read`、`analytics.read`、`metrics.read`、`diagnostics.read`、`export.json`、`export.csv`、`focus.adapters` 和 `summary.providers`。写入必须由用户明确触发；批量写入、外部身份和日期范围均有上限与校验；范围读与批量写均支持 `AbortSignal` 取消；公开写入严格限定 `source: "api"` 防伪造；所有返回值提供防御性副本；诊断信息严格脱敏。

完整字段、能力版本和安全边界见 [API v5 参考](docs/api-v5.md)、[生态集成契约](docs/ecosystem-integration.md) 和 [Task Horizon 合作契约](docs/checkin-taskhorizon-cooperation.md)。第三方可以先运行[契约自测包](contracts/siyuan-checkin-contract/)。

## 数据安全、主题与无障碍

- 主存储、恢复点、审计、事项、模板、图标、提醒动作和分析历史分开保存；事件使用稳定 ID，外部事件使用幂等身份。
- 导入先预检和迁移校验，恢复失败会回滚内存状态并保留诊断信息；删除、批量删除和来源断开会说明影响范围。
- 设置提供跟随思源/浅色/深色三种主题、弹窗尺寸、减少动效和显示偏好重置。插件使用独立的淡紫蓝画布、白卡和紫罗兰强调色。
- 主要按钮、输入和移动导航遵循 44px 触控基线；焦点、`aria` 状态、`hidden` 状态和颜色之外的冗余编码一起维护。

## 开发与验证

环境要求：Node.js 20.19.0+、pnpm 12.5.1（`package.json` 已固定版本）。

```bash
corepack pnpm install
corepack pnpm run check          # TypeScript 类型检查
corepack pnpm test               # 领域、迁移、生态和交互测试
corepack pnpm run test:ui        # UI、响应式、文档和稳定性守门
corepack pnpm run test:mobile    # 移动端布局、键盘、旋转和触控守门
corepack pnpm run test:ecosystem # API、事件和外部联动守门
corepack pnpm run test:perf      # 大量事件和投影性能基线
corepack pnpm run benchmark:storage # 主 Store 快照写放大观测（不设发布门槛）
corepack pnpm run benchmark:storage:host # 显式真实思源宿主快照/并发/失败重载观测
corepack pnpm run build          # 生产构建，输出 dist/ 与 package.zip
corepack pnpm run test:quality   # 发布前完整质量链
```

视觉和宽度走查默认使用 Playwright 安装的 Chromium。需要指定本机浏览器时可设置 `CHECKIN_BROWSER`；下面是 PowerShell 示例：

```powershell
$env:CHECKIN_BROWSER = "C:\path\to\chrome.exe"
node tests/visual-qa.cjs
$env:CHECKIN_QA_THEME = "dark"
node tests/visual-qa.cjs
node tests/width-walkthrough.cjs
```

真实思源内核 E2E 会创建带 `checkin-e2e.json` 标记的隔离工作区，不接触用户笔记本：

```bash
corepack pnpm run test:e2e
corepack pnpm run test:e2e:readonly
```

真实宿主快照基准必须另外提供独立的 `CHECKIN_E2E_WORKSPACE`、`SIYUAN_TOKEN` 和可用端口（可用 `CHECKIN_E2E_PORT` 覆盖默认端口）；它会运行 1k/10k/100k 样本、双窗口并发和受控写失败重载夹具，结果写入 `.artifacts/storage-host-benchmark*.json`，不属于发布硬门槛。

完整路线见[当前开发状态](docs/development-roadmap-current.md)和[自动化证据报告](docs/automation-evidence-report-2026-09.md)。

## 已知边界

- 浏览器和隔离内核可以发现结构、样式和数据回归，但不能替代真实思源客户端的宿主生命周期、系统键盘、安全区、页签/dock 和多窗口验收。
- 「那年今天」的往年日记跳转依赖思源自动写入的 dailynote 属性；由其他工具创建且缺少该属性的日记会提示未找到，不会误建文档。
- 思阅、思播、健康、微信读书和叶归的真实账号、Key、笔记本及上游版本需要用户在目标环境中实测；插件会在来源不可用时保持手动路径可用。
- 底栏番茄钟联动依赖上游公开兼容 API；兼容版本未安装时请使用内置计时或手动记录。
- 智能体能力依赖思源宿主公开 API，默认只读；没有模型时本地记录、统计、导入导出仍可用。

## 文档入口

- [技术文档全景索引](docs/README.md) · [发布说明目录](docs/releases/) · [发布与回滚](docs/release-rollback.md) · [思源兼容矩阵](docs/siyuan-compatibility.md)
- [API v5](docs/api-v5.md) · [生态集成契约](docs/ecosystem-integration.md) · [契约自测包](contracts/siyuan-checkin-contract/) · [真机验收清单](docs/integration-smoke-checklist.md)
- [贡献指南](CONTRIBUTING.md) · [安全报告](SECURITY.md) · [仓库运维说明](docs/github-repository-ops.md)
- [架构与模块地图](docs/architecture.md) · [仓库布局规则](docs/repository-layout.md) · [导入导出格式](docs/export-formats.md)
- [低压力呈现基线](docs/low-pressure-baseline.md) · [笔记绑定盘点](docs/note-bindings-inventory.md) · [生态调研记录](docs/benchmark-habit-apps-2026-09.md)
- [当前路线](docs/implementation-roadmap-product-strategy-2026-09.md) · [UI 内容审查记录](docs/ui-full-content-audit-2026-09-20.md) · [UI 变更记录](docs/v4.0-ui-change-log.md) · [UI 路线归档](docs/archive/ui-product-roadmap.md)
- [产品定位与下一阶段路线](docs/product-positioning-and-roadmap-2026-10.md) · [UI 原型 v3](docs/prototypes/checkin-ui-v3.html) · [v3 完整设计规范](docs/ui-prototype-spec-v3-2026-10.md)
- [v2.0 变更记录](docs/v2.0-change-log.md) · [v2.0 迁移说明](docs/v2.0-migration-notes.md) · [旧版 UI 路线](docs/archive/ui-redesign-roadmap.md)

## 小驴系列与交流

小驴系列插件各自独立，可按需安装和组合使用：

| 插件名称 | 一句话简介 | GitHub 仓库 |
| --- | --- | --- |
| [小驴雷切](https://github.com/ai68298100/siyuan-speed-switch) | 思源中的统一导航与工作上下文平台，连接页签、工作台、片段和快捷入口。 | [ai68298100/siyuan-speed-switch](https://github.com/ai68298100/siyuan-speed-switch) |
| [小驴打卡](https://github.com/ai68298100/siyuan-checkin) | 本地优先的习惯、目标打卡与复盘工作台。 | [ai68298100/siyuan-checkin](https://github.com/ai68298100/siyuan-checkin) |
| [小驴人脉](https://github.com/ai68298100/siyuan-contacts) | 在思源中管理联系人、人际关系、组织归属和重要日期。 | [ai68298100/siyuan-contacts](https://github.com/ai68298100/siyuan-contacts) |
| [小驴拾遗](https://github.com/ai68298100/siyuan-glean) | 整理思源剪藏和导入文章，支持状态分拣、阅读管理与日后回顾。 | [ai68298100/siyuan-glean](https://github.com/ai68298100/siyuan-glean) |
| [小驴考试（内测版）](https://github.com/ai68298100/siyuan-exam) | 本地题库备考工作台，支持多格式导入、刷题、模考、错题复盘与 AI 辅助。 | [ai68298100/siyuan-exam](https://github.com/ai68298100/siyuan-exam) |
| [小驴管家（内测版）](https://github.com/ai68298100/siyuan-home) | 管理家庭与生活资料、成员档案、台账、到期提醒和事务跟进。 | [ai68298100/siyuan-home](https://github.com/ai68298100/siyuan-home) |
| [小驴闪卡（内测版）](https://github.com/ai68298100/siyuan-lv-cards) | 思源中的知识捕获、制卡、练习与复习平台，使用内核原生 FSRS 排期。 | [ai68298100/siyuan-lv-cards](https://github.com/ai68298100/siyuan-lv-cards) |
| [小驴常用（内测版）](https://github.com/ai68298100/xiaolv-common) | 基于思源块保存、搜索并快速调用常用语、模板、代码和链接，支持变量填充。 | [ai68298100/xiaolv-common](https://github.com/ai68298100/xiaolv-common) |

交流 QQ 群：**871707735**（反馈问题、提交需求、交流使用体验）。反馈问题时请附上插件版本、思源版本、操作步骤和出现问题的页面。

## License

[MIT](LICENSE)
