# 跨窗口持久化原子合并、并发写入与收尾防丢研究报告（T-1622 收官）

## 1. 任务背景与核心挑战

在思源笔记多窗口环境（主页签、侧边栏 Dock、快捷打卡弹窗、文档嵌入渲染块等）下，插件实例可能在多个独立渲染上下文或进程中并存。各窗口拥有独立的内存状态与界面生命周期。在旧架构中，存在以下并发持久化隐患：
1. **陈旧快照覆盖（Lost Updates）**：窗口 A 和窗口 B 同时产生打卡事件，先写者的成果容易被后写者的全量 JSON 快照冲刷覆盖；
2. **已删事项与动作复活（Resurrection Anomaly）**：窗口 A 删除了事项或恢复了提醒，窗口 B 仍持有旧内存对象，窗口 B 触发保存时将已删事项重新写入主存储；
3. **Agent 接口假成功与内存污染**：Agent 调用 `createItem` 或 `createOccasion` 时先改内存再异步持久化，一旦写盘失败，调用方收到异常但内存残留未持久化数据，或未能向调用方正确报错；
4. **批量导入与日常记录竞态**：用户在大批量导入 CSV/Loop 数据的同时，后台可能发生外部来源拉取或用户在弹窗中打卡，若导入未走独占队列，会导致日常打卡事件被导入快照擦除；
5. **卸载收尾冲刷活跃数据**：窗口 A 正在关闭（触发 `teardownFinalFlush`），此时窗口 B 刚刚完成了一笔打卡，窗口 A 若直接把内存中的旧快照写盘，会把窗口 B 的新事件覆盖。

为此，本专项系统化攻坚 **T-1622 跨窗口持久化原子合并与收尾防丢**，构建了涵盖 9 大维度的跨窗口数据一致性与原子协调架构，并落地全链路仿真演练守门测试。

---

## 2. 九维跨窗口并发协调体系

### 2.1 主 Store 锁内重读与确定性合并（CheckinStore）
- **独占锁与版本基线**：所有主 Store 变更必须通过 `enqueueMutation` 串行化，在 `withStorageLock` 锁内执行；
- **锁内刷新与重读**：每次入锁后，首先执行 `reconcileNormalizedStoreSnapshots(this.lastPersistedStore, this.store, normalizeStore(stored))`；
- **双向增量投影**：
  - `projectLocalStoreChanges` 提取本地相较于基线的增量变更；
  - `mergeNormalizedStores` 将远端权威快照与本地增量融合；
- **零事件丢失保证**：双窗口并发或交错打卡，无论执行先后顺序，两窗口产生的全部合法事件 100% 存活，基线平滑推进。

### 2.2 事项桶完成并集与删除墓碑机制（OccasionStore）
- **完成日期取并集**：`mergeOccasionCompletions` 对共享 ID 的事项，将其 `completedDates` 按时间字符串排序并去重合并；
- **删除墓碑优先（Tombstone Precedence）**：事项删除时产生带时间戳的 `tombstones: [{occasionId, deletedAt}]`；
- **抑制旧窗口复活**：旧窗口在触发写盘或重载时，`normalizeOccasionStore` 与 `mergeOccasionCompletions` 均以墓碑为高优先级，绝不复活已删事项；同时无本地墓碑遮蔽的远端新建事项可安全保留。

### 2.3 提醒动作桶三元组并集与恢复抑制（ReminderUserActions）
- **三元组唯一身份**：提醒动作按 `(id, action, at)` 三元组判重，两窗口动作互不覆盖；
- **时间戳绝对保序**：所有动作在序列化前严格按时间升序排列；
- **恢复抑制（Restore Suppression）**：`restore` 动作时间戳晚于旧的 `snooze` 或 `skip` 时，`applyReminderActions` 确保打卡项在今日恢复为可提醒状态，杜绝状态倒退。

### 2.4 Agent 创建接口原子回滚与同名互斥
- **入队串行化**：Agent 的 `createItem` 与 `createOccasion` 必须进入 `enqueueMutation` 队列，不再绕过主锁；
- **写前快照与失败原子回滚**：进入写操作前留存 `previousStore`，底层 `persist()` 或 `persistOccasions()` 失败时，内存立即回滚至 `previousStore`，并向调用方抛出异常，绝不谎报成功；
- **锁内二次判重**：在锁内重新复核同名未归档项目，杜绝并发双击或重放导致的数据重复。

### 2.5 批量导入与日常打卡交错共存
- **同一队列治理**：CSV、Loop、Obsidian 与 JSON 恢复等批量导入操作全面接入 `enqueueMutation`；
- **并发打卡保护**：导入前锁内重读远端主 Store，并发产生的日常打卡事件与导入产生的批量事件安全合并，互不覆盖；
- **整批原子回滚**：若导入落盘阶段发生 IO 错误，内存立刻完整回滚至导入前状态，不残留半截数据。

### 2.6 卸载收尾（teardownFinalFlush）增量合流
- **收尾锁内重读**：窗口卸载时，`teardownFinalFlush` 必须在独占锁内执行；
- **增量借项保护**：针对本地仅新增打卡事件、未修改项目定义的场景，`persistStoreWithReconciliation` 智能结合远端项目定义进行事件合法性校验，保证收尾写入不丢失末次打卡；
- **防冲刷活跃对端**：先重读远端最新数据再合并写入，绝不将旧内存快照直接覆盖另一活跃窗口的新增记录。

### 2.7 外部失败箱（ExternalPendingBox）容量与回滚
- **跨窗口并集同步**：两窗口产生的外部记录失败项按 `(source, externalRef)` 身份并集同步；
- **40 条容量硬限**：`mergeExternalPendingBoxes` 强制遵循 40 条容量上限与保留策略，杜绝内存膨胀；
- **丢弃与重试回滚**：丢弃（discard）或重试（retry）写盘失败时，内存中的失败项原路恢复，界面如实报告失败。

### 2.8 偏好桶后写者胜与快照回滚（ViewPreferences）
- **明确边界（D-315）**：偏好桶属于本机 UI 呈现偏好，明确采用后写者胜策略，不做字段级模糊并集，防止重置语义失效；
- **快照原子回滚**：持久化失败时，通过 `applyPreference` 快照原路恢复内存值与 UI 状态，杜绝界面与存储分叉。

### 2.9 外部变更通知（onDataChanged）与会话草稿隔离
- **权威外部同步**：收到思源官方 `onDataChanged` 广播时，在锁内重新载入并重读各辅助存储桶；
- **会话态草稿保护**：`settingsDrafts` 与 `journalDrafts` 属于会话内存态，远端重新载入不得冲刷用户正在编辑的未保存草稿。

---

## 3. 验收矩阵与实战演练证据

新建专项守门测试 `tests/cross-window-storage-drills.test.cjs`，通过虚拟共享存储（`sharedStorage`）与高仿真 Web Locks 锁管理器（`SharedLockManager`），对双窗口并发场景进行了端到端演练，9 大场景全部一次性全绿通过：

| 演练编号 | 测试场景 | 核心验证点 | 实测结果 |
| :--- | :--- | :--- | :--- |
| **Drill 1** | 主 Store 双窗口交错并发记录 | A/B 窗口同时产生打卡，锁内重读合并，连续两轮 4 笔打卡 0 丢失 | **PASS** (4 events survive) |
| **Drill 2** | 事项桶并发增删改与墓碑优先 | 共享事项完成日期并集保留；删除事项生成墓碑，旧窗口写盘无法复活已删事项 | **PASS** (Tombstone precedence verified) |
| **Drill 3** | 提醒动作跨窗口并集与恢复保序 | Snooze/Skip/Defer/Restore 四类动作安全并集，Restore 准确抑制过期 Snooze | **PASS** (All 4 actions merged, status today) |
| **Drill 4** | Agent 创建失败回滚与同名互斥 | `createItem` / `createOccasion` 写盘失败内存 100% 回滚；锁内重名请求精确拒绝 | **PASS** (Rollback clean, duplicate rejected) |
| **Drill 5** | 批量导入与日常打卡并发交错 | 批量导入与日常打卡同时发起，最终主 Store 包含全部 10 笔导入事件与 1 笔日常事件 | **PASS** (11 events coexisted) |
| **Drill 6** | 卸载收尾防覆盖活跃窗口新数据 | 活跃窗口产生新事件后，另一窗口执行 `teardownFinalFlush`，远端新事件完好保留 | **PASS** (Active event + flush event kept) |
| **Drill 7** | 外部失败箱跨窗口并集与容量 | 远端失败箱并入，相同身份优先保留本地载荷，40 容量硬限严格生效 | **PASS** (Box merged deterministically) |
| **Drill 8** | 偏好桶后写者胜与失败快照回滚 | 正常保存更新基线；持久化失败时基线不推进，内存与界面原路回滚 | **PASS** (LWW & snapshot rollback verified) |
| **Drill 9** | onDataChanged 远端同步与草稿保护 | 远端数据变更自动更新事项与提醒动作，本地正在编辑的设置与问卷草稿完好无损 | **PASS** (Remote synced, drafts protected) |

---

## 4. 结论与工程收口

至此，**T-1622 跨窗口持久化原子合并与收尾防丢** 正式全量闭环核销：
- 生产源码在 `src/storage-transaction.ts` 中补强了 `persistStoreWithReconciliation` 的增量合并与借项防护能力；
- 建立了完备的跨窗口实战演练守门 `tests/cross-window-storage-drills.test.cjs`，并将其纳入 `test:v18` 测试链（104 项全绿通过）；
- 全量质量链（TypeScript 0 错误、生产 Webpack 构建成功、CSS 卫生达标、全仓 372+ 单测全通、发布资产 SHA-256 签名一致）持续 100% 保持绿灯。
