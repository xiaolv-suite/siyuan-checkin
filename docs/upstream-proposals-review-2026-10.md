# 合作插件上游提案与发布事实定期复核报告（2026-10-29，T-1680 / D-630）

> **复核依据**：按 `docs/HANDOFF-2026-09-28.md`、`docs/upstream-api-proposals-2026-09.md` 与双轨纪律（D-255 / R-REL-CHECK），定期核实思阅（SiReader）、思播（SiPlayer）、Task Horizon、Dock Tomato 的上游 issue、PR、release 页面及公开契约演进状态。
> **核心原则**：只有**上游合并**、**版本化正式发布**与**本地真机集成验收**同时满足（三重门槛不变量），才改变来源就绪度级别；严禁因上游无回应而重复催办/发帖，严禁私自侵入第三方插件私有存储。

---

## 一、复核对象状态与事实审计（截至 2026-10-29）

### 1. 思阅（SiReader）：公开阅读生命周期与结算 API

- **提案标识**：`sireader-lifecycle-api`
- **对应草案**：`docs/contracts/upstream-proposals/sireader-lifecycle-api-v1.json`
- **外部提案追踪**：GitHub issue #55（2026-09 提交）
- **事实复核结果**：
  - 截至 2026-10-29，思阅上游仓库未合并公开 API 提案，尚未发布包含版本化 CustomEvent（`reader:open/focus/blur/close` 带 payload）的新版本；
  - 思阅内部仍使用 `reader_stats` 私有存储落盘，未暴露只读 getter。
- **本地就绪度裁决**：
  - **维持 `experimental` 观察级别**，坚决不提升为 `stable`；
  - 本地继续保持 opt-in 默认关闭的 fallback 监听机制；
  - 保持 `externalRef: sireader:<itemId>:<startUnixMs>:<localDate>` 唯一身份，墓碑与单日去重绝对有效；
  - **红线遵守**：严格不读取其 `daily.json` 或 `reader_stats` 私有文件；不因无回复重复在 issue #55 发帖。

---

### 2. 思播（SiPlayer）：播放采样与结算 API

- **提案标识**：`siplayer-playback-api`
- **对应草案**：`docs/contracts/upstream-proposals/siplayer-playback-api-v1.json`
- **外部提案追踪**：GitHub issue #180（2026-09 提交）
- **事实复核结果**：
  - 截至 2026-10-29，思播上游仍未发布带版本化能力的公开事件协议；
  - 当前多窗口与跨会话播放时长口径仍无正式契约保证。
- **本地就绪度裁决**：
  - **维持 `experimental` 观察级别**；
  - 本地沿用 `src/features/siplayer-adapter.ts` 的事件采样器与跨午夜切分（D-368）；
  - 维持 opt-in 显式开启与每日阈值封顶机制；
  - 坚决杜绝把未发布的草案当成正式依赖。

---

### 3. Task Horizon（任务地平线）：日历消费与待办任务联动

- **提案标识**：`taskhorizon-calendar-consumer`
- **对应草案**：`docs/contracts/upstream-proposals/taskhorizon-calendar-consumer-v1.json`
- **对应契约**：`src/ecosystem.ts` 中的 `TASK_HORIZON_CONTRACT`、`api-v5.ts`、`src/features/taskhorizon-cooperation.ts`
- **事实复核结果**：
  - 小驴打卡侧：T-1527 已交付 `calendar-consumer.mjs` 参考层，T-1671（D-626）已收敛单一 Canonical Source 互斥原则与 5 分钟安全 TTL Fallback 机制；
  - 对方侧：消费端联动排期（T-1836）仍在对方计划中，未进入正式生产联调；
  - 思源集市上 Task Horizon 正式版目前尚未集成对小驴 API v5 的日历直接消费。
- **本地就绪度裁决**：
  - **维持 `experimental` 实验级**；
  - 状态机保持 `waiting` / `experimental-ready` / `disconnected-fallback` / `incompatible-version`；
  - 严格执行“单一项目在同一时刻只能绑定一种写入通道”的互斥原则，防止物理删除任务与不可变打卡事件的架构冲突；
  - 保持 T-1836 挂起状态，待对方正式发版后启动真机双向联调。

---

### 4. Dock Tomato（番茄钟）：会话完成与收件箱机制

- **提案标识**：`docktomato-focus-inbox`
- **对应契约**：`docs/contracts/docktomato-integration-contract.json`、`src/features/docktomato-inbox.ts`
- **事实复核结果**：
  - T-1672（D-622）已完成 Dock Tomato 9 态会话所有权、收件箱隔离与多窗口失败演练；
  - 小驴打卡绝不侵入对方私有存储（不偷读私有属性或数据库），通过全局公开焦点适配器与收件箱中间件解耦；
  - `installDockTomatoBridge` 在 `onunload` 时 100% 注销，杜绝事件与内存泄漏。
- **本地就绪度裁决**：
  - **维持 `experimental` 状态**；
  - 采用收件箱机制（Inbox）提供人工重试与丢弃通道，防旧快照复活已处理条目。

---

## 二、三重门槛不变量（Three-Tier Gate Invariant）

```
       [ 门槛 1: 上游正式合并 ] (Merged upstream)
                  &&
       [ 门槛 2: 上游版本化正式发版 ] (Versioned release shipped)
                  &&
       [ 门槛 3: 本地真实宿主双向集成验收通过 ] (Real host E2E verified)
                  ||
                  ▼
         [ 允许提升为 stable ] (Otherwise: MUST stay experimental/planned)
```

1. **绝对禁止早产晋升**：即便对方在 issue 中口头同意，只要没有发布包含正式版本号（semver）与稳定 API 的 release 包，就绝不将其在 `SourceDescriptor.status` 中标记为 `stable`；
2. **唯一 Canonical Source 互斥**：上游事件源与本地监听 fallback 并存时，必须指派唯一生效方，杜绝双写造成数据翻倍；
3. **零骚扰纪律**：外部开源维护者拥有自主排期节奏，小驴打卡不因长期无合并而连续发帖催促，守住礼貌与健康的开源协同边界。

---

## 三、守门模型与测试落地

1. **纯逻辑模型**：`src/features/upstream-governance.ts` 承载 `evaluateUpstreamSourceReadiness` 与 `auditUpstreamProposalSnapshots`；
2. **专项测试**：`tests/upstream-governance.test.cjs` 守门全量 4 个外部提案的快照状态，确保无越权提级，纳管至 `test:v18`（76 项全绿）；
3. **持续集成**：受 `test:quality` 统一门禁保护。
