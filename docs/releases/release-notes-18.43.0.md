# 小驴打卡 v18.43.0

「外部来源迟到响应代际守门、API v5 取消中断与墓碑生命周期治理」版本发布：全面闭环并核销了外部来源迟到响应配置代际守门与写前动态复核（T-1684）、API v5 批量写 AbortSignal 取消支持与宿主未就绪快速失败契约（T-1670）、以及事件墓碑生命周期治理与级联删除规范化收口（T-1799）；57 项专项、移动端、全量生态与无障碍质量链 100% 全绿通过；版本号升级至 18.43.0，本地构建打包签名完成；遵循用户指示，保持本地提交与更新，严格不向远程推送。主存储保持向前兼容，最低思源版本仍为 3.8.4。

## 核心更新

### 1. 外部来源迟到响应与配置代际守门全覆盖（T-1684）
- **六大来源全代际注入**：微信读书、叶归 LifeLog、健康收件箱、笔记推导、思播、思阅六大外部生态来源全部注入独立的代际计数器（`wereadGeneration`, `yeguifGeneration`, `healthGeneration`, `noteQueryGeneration`, `siplayerGeneration`, `sireaderGeneration`），重载、换绑与卸载时自增代际全链路阻断在飞请求；
- **写前动态复核（Dynamic Validation inside Mutation）**：在 `enqueueMutation` 锁内写事实前，动态复核来源启用状态（`enabled`）、目标项目绑定（`itemId`, `finishItemId`, `notesItemId`, `metricBindings`）、笔记本/文档有效性以及配置指纹（`fingerprint`），并在叶归中动态复核分类映射解析，迟到响应可诊断丢弃，坚决不写旧目标。

### 2. 公开生态契约强化：API v5 取消支持与快速失败（T-1670）
- **批量写取消与中断信号（AbortSignal）**：`recordEventsBatch` 正式支持 `options?: {signal?: AbortSignal}`，在入队前与未执行时提前退出，拒绝并抛出 `Error("checkin: batch recording was aborted")`；
- **宿主未就绪快速失败**：在 `src/api.ts` 的 `recordEventsBatch` 中，统一在宿主未就绪、卸载中或已释放时快速失败（返回 Promise.reject），杜绝进入队列挂起。

### 3. 数据层规范性：墓碑级联删除规范化与测试自愈（T-1799）
- **级联删除规范化收口**：在 `deleteItemsCascade` 中统一调用 `normalizeEventTombstones` 规范化，消除脏墓碑未去重未排序隐患；固化 50k 事件与 25k 墓碑级规范化与检索性能；
- **单测沙箱与防抖窗口加固**：自愈修复 `recording-history-structure`、`share-card`、`desktop-dialog` 和 `storage-transaction` 单测夹具。

### 4. 提醒调度演进：排期计划预览与恢复提醒闭环（T-1662）
- **计划预览状态矩阵**：落地 `unmuteReminderDeliveryToday` 与 `buildReminderPlanPreview`，全面覆盖 `delivered`、`quiet`、`muted`、`due`、`upcoming`、`disabled` 六大槽位状态；
- **恢复今日提醒自愈**：设置页直观呈现今日静音提示与计划预览，并提供“恢复今日提醒”（`unmuteDailyReminderTodayFor`）操作；
- **环境韧性与幂等性**：严格验证 22:00~07:00 跨午夜安静时段、夏令时/冬令时（DST）本地挂钟时间与修改槽位多窗口强幂等；守门测试 `tests/reminder-schedule-preview.test.cjs` 纳入 `test:v18`。

### 5. 提醒方案推荐草案与实际触发预演（T-1752）
- **四大典型方案推荐**：落地 `REMINDER_PRESET_SCHEMES`（minimal 低打扰、morning 晨间规划、review 早晚复盘、frequent 全天四段），设置页提供一键填入草案胶囊；
- **触发预演与真实影响解释**：落地纯函数 `simulateReminderTimeline`，区分“默认启用且无 slots＝启动后一条”和定时槽提醒两大模式，精准展示当天与次日未来触发本地时刻序列；
- **安静时段与事项仅一次真实影响**：对 22:00~07:00 跨午夜安静时段与事项提前提醒仅一次（`occasionRemindOnce`）选项做出直观影响解释；
- **严格用户确认**：具体时刻和启用权严格由用户点击“保存时刻”确认生效，不私自静默改写或隐式持久化；守门测试 `tests/reminder-preset-simulation.test.cjs` 纳入 `test:v18`。

### 6. 外部来源统一调度、退避与省电策略矩阵（T-1659）
- **六大外部来源统一调度**：在 `features/source-scheduler.ts` 落地纯模型，收拢微信读书、叶归 LifeLog、健康收件箱、笔记推导、思播、思阅六大外部来源生命周期；
- **失败指数退避与自动自愈**：各外部来源异常或失败时自动进入指数退避（微信读书 base 30s / max 30min，叶归/健康 base 15s / max 5min），杜绝故障期密集循环轮询；成功后自动清零自愈；
- **回前台防抖节流**：不可见期间跳过轮询省电省流，窗口回焦（`handleWindowFocus`）统一防抖节流（微信读书 60s，其余 30s），保障“回前台只补一次”；
- **可解释性状态查询**：暴露 `getSourceSchedulerSummary()` 只读状态矩阵；守门测试 `tests/source-unified-scheduler.test.cjs` 纳入 `test:v18`。

## 升级与兼容说明

- **主存储向前兼容**：数据结构向前兼容，旧版本升级无需手动数据迁移；
- **全质量门禁全绿**：全量测试套件、v18 专项测试套件（57项）、移动端测试套件（10项）、生态契约套件与 CSS 卫生门禁全部通过。

- SHA-256：`5efa52abc4e34f61bd0772e4cb9628e6b3d04bae1b09cf7a9a275ed099ddbcb4`
