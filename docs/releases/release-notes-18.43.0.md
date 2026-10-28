# 小驴打卡 v18.43.0

「外部来源迟到响应代际守门、API v5 取消中断与墓碑生命周期治理」版本发布：全面闭环并核销了外部来源迟到响应配置代际守门与写前动态复核（T-1684）、API v5 批量写 AbortSignal 取消支持与宿主未就绪快速失败契约（T-1670）、以及事件墓碑生命周期治理与级联删除规范化收口（T-1799）；57 项专项、移动端、全量生态与无障碍质量链 100% 全绿通过；版本号升级至 18.43.0，本地构建打包签名完成；遵循用户指示，保持本地提交与更新，严格不向远程推送。主存储保持向前兼容，最低思源版本仍为 3.8.4。

## 核心更新

### 1. 外部来源迟到响应与配置代际守门全覆盖（T-1684）
- **六大来源全代际注入**：微信读书、叶归 LifeLog、健康收件箱、笔记推导、思播、思阅六大外部生态来源全部注入独立的代际计数器（`wereadGeneration`, `yeguifGeneration`, `healthGeneration`, `noteQueryGeneration`, `siplayerGeneration`, `sireaderGeneration`），重载、换绑与卸载时自增代际全链路阻断在飞请求；
- **写前动态复核（Dynamic Validation inside Mutation）**：在 `enqueueMutation` 锁内写事实前，动态复核来源启用状态（`enabled`）、目标项目绑定（`itemId`, `finishItemId`, `notesItemId`, `metricBindings`）、笔记本/文档有效性以及配置指纹（`fingerprint`），并在叶归中动态复核分类映射解析，迟到响应可诊断丢弃，坚决不写旧目标。

### 2. 公开生态契约强化：API v5 取消支持、异常统一与防伪造全核销（T-1670）
- **取消信号与快速失败**：`recordEventsBatch` 与 `getEventsInRange` 全面支持 `signal?: AbortSignal`，在入队前或未执行时快速退出并抛出对应取消异常；宿主未就绪、卸载中或已释放时，写操作快速失败拒绝 Promise，只读操作安全回落空结果；
- **参数校验与输入消毒**：统一参数校验异常前缀 `"checkin: "` 与 `TypeError`，`getStreaks` 增加 200 项输入消毒截断保护；
- **敏感字段脱敏与来源防伪造纪律**：外部公开写入严格限定为 `source: "api"`，严禁冒充内部适配器来源；公开诊断 `getDiagnostics()` 强化 `wrk-*` 凭据与绝对路径脱敏；所有返回对象深度防御性克隆与冻结。

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

### 7. 外部来源新鲜度、跨日切分与源时刻凭据（T-1661）
- **四类来源事实凭据**：在 `features/source-provenance.ts` 落地纯模型，统一规范“源发生时间、摄取时间、结算业务日与时间窗口”，严禁用摄取时刻冒充源事件时刻；
- **历史日汇总业务日锚定**：落地 `resolveSourceActionMoment`，当结算日早于摄取日时，事件发生时刻严格锚定在该业务日内（`23:59:59`），杜绝因几天后才拉取而将 `occurredAt` 误写为当前摄取时间；
- **段落时刻与跨午夜切段对账**：叶归 LifeLog 严格保留 Marker 段落源发生时刻；思阅与思播严格遵守跨午夜切段与源段时刻映射；
- **新鲜度评估矩阵**：落地 `evaluateSourceFreshness` 四态评估矩阵（`live` / `delayed` / `stale` / `idle`）；守门测试 `tests/source-freshness-provenance.test.cjs` 纳入 `test:v18`。

### 8. 跨表面异步生命周期、代际与销毁清理审计（T-1664）
- **统一异步生命周期管理器**：在 `features/async-lifecycle.ts` 落地 `AsyncLifecycleManager`，统一管控 timer/raf/listener/observer 与代际编号；
- **Owner 分级与精准销毁**：支持宿主、表面与弹窗分层管控，root 销毁时靶向释放关联资源并推进代际，绝不误伤其它表面；
- **慢回执代际失效阻断**：任何异步操作完成前校验 `isCurrent`，切页或新查询发起后旧回执自动静默丢弃，杜绝迟到数据覆盖新 DOM；
- **全量释放与零泄漏审计**：插件卸载（`onunload`）统一调用 `disposeAll()` 并暴露 `auditAsyncLifecycleLeaks()` 审计接口；守门测试 `tests/async-lifecycle-audit.test.cjs` 纳入 `test:v18`。

### 9. 卡片、内层表面与 elevation 层级全量收官（T-1816）
- **复盘对比与工作台组件全量 Token 化**：彻底将 `.lc-checkin__compare` 及子组件（`compare-chart`, `compare-stat`, `compare-item-batch`）收敛至 v3 card 语义 Token（`card-border` / `card-bg` / `card-shadow` / `radius` / `radius-sm`）；
- **概览与控制台圆角对齐**：在 `workbench.scss` 中将 `.lc-checkin__overview-focus` 与 `.lc-checkin__console` 的固定 12px 圆角收敛至标准 `var(--lc-checkin-radius)` 令牌，消除各表面之间的观感断层与圆角跳变；
- **硬限守护与零死类**：生产 CSS 稳定处于 680 KiB 硬预算以内（696,252 字节），0 死类。

### 10. 大规模映射选择、失效保留与批量校验（T-1660）
- **大规模目标候选集搜索与有界分页**：落地 `filterAndPaginateTargets` 纯函数，支持对 >200 项大规模候选项目进行实时模糊过滤与分页（每页 50~100 项），彻底消除全量 DOM 挂载造成的卡顿；
- **目标失效保留与换绑动作引导**：当关联的目标项目被归档、单位变更或被删除时，系统坚决保留原有映射与身份凭据，严禁静默删除或丢弃合法数据；在映射行显式呈现失效标记并提供换绑建议；
- **多维度批量校验与迁移预览**：落地 `validateMappingsBatch` 与 `planMappingMigration`，深度识别重复来源名称、缺失目标、单位不兼容与字段残缺；支持新旧映射差异比对与迁移规划预览；守门测试 `tests/mapping-management.test.cjs` 纳入 `test:v18`。

## 升级与兼容说明

- **主存储向前兼容**：数据结构向前兼容，旧版本升级无需手动数据迁移；
- **全质量门禁全绿**：全量测试套件、v18 专项测试套件（57项）、移动端测试套件（10项）、生态契约套件与 CSS 卫生门禁全部通过。

- SHA-256：`7d610691b2ed2ee317abe17cff87a369011b46ccbbb12698ccc8dddd6dc45a81`
