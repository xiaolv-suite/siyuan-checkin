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

## 升级与兼容说明

- **主存储向前兼容**：数据结构向前兼容，旧版本升级无需手动数据迁移；
- **全质量门禁全绿**：全量测试套件、v18 专项测试套件（57项）、移动端测试套件（10项）、生态契约套件与 CSS 卫生门禁全部通过。

- SHA-256：`83d607b7e6ceb2c35e5d099df58ec4e20080de87311fd748342ee74a61e3bf4d`
