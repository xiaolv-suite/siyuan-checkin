# 事项管理全链路专项验收矩阵与实施门禁报告（T-1732 / D-637）

> **门禁性质**：事项管理（Occasions）体系的**总验收门禁报告（Capstone Acceptance Matrix）**。
> 汇总 T-1701～T-1732 全部 32 项事项任务的实现事实，以真实缺陷夹具、全生命周期链条、极端日期矩阵、并发冲突与多端无障碍表现为依据，逐项标注验证结论与产品边界。

---

## 一、全生命周期链条验收结果（Lifecycle Acceptance Chain）

| 生命周期阶段 | 关联任务与规约 | 核心验收断言 | 验收结论 |
| :--- | :--- | :--- | :--- |
| **1. 创建与防重** | T-1703 (防连击提交)<br>T-1716 (内联规则预览)<br>T-1717 (同名与相似项查重) | ① 提交时启用 `occasionSubmitBusy` 门控，连击回车或快速双击仅触发一次保存；<br>② `buildOccurrencePreview` 实时推演未来 N 次发生日与提前提醒日；<br>③ `findSimilarOccasions` 模糊包含查重，同名强制二次确认，不破坏合法重名。 | **通过（Verified）** |
| **2. 极端日期换算** | T-1704 (闰日/第5周/农历)<br>T-1706 (ID 去重与 120 条截断) | ① 闰年 02-29 事项在平年自动顺延至 02-28，闰年保留 02-29；<br>② 农历事项经 `lunarToSolar` 准确转换为公历发生日；<br>③ 月末 31 号与第 5 周在不足月份自动平滑 clamp。 | **通过（Verified）** |
| **3. 单次改期与跟随** | T-1705 (错过与单次改期)<br>T-1718 (改期预览与撤销) | ① 单次改期（`overrides`）在时间线新日期呈现，原基点自动跳过；<br>② 逆推链式改期（`resolveOverrideTarget`）至多 8 步防环；<br>③ `findOverrideOriginFor` 精确解析撤销目标，撤销仅清除本次覆盖。 | **通过（Verified）** |
| **4. 完成与撤销** | T-1712 (行内完成切换)<br>T-1719 (120 日截断透明化)<br>T-1722 (提醒状态分离) | ① 当前可处理发生日提供完成/撤销切换，复用 `setOccasionCompleted` 单一通道；<br>② `completedDates` 保持唯一升序，达 120 条时行内明示“仅保留最近 120 条”；<br>③ 提醒动作（跳过/延期）与事项完成徽章严格语义分离。 | **通过（Verified）** |
| **5. 停用与删除墓碑** | T-1711 (操作图标消歧)<br>T-1721 (墓碑防复活) | ① 启停图标采用 play/pause，与事项完成语义彻底分离；<br>② 停用（`enabled: false`）完整保留历史与改期，不生成墓碑；<br>③ 删除原子生成带有 ISO 时间戳的 `OccasionTombstone`，硬预算 240 条；<br>④ 跨窗口合并（`mergeOccasionCompletions`）由墓碑绝对压制旧快照。 | **通过（Verified）** |
| **6. 跨端备份与迁移** | T-1724 (公开 API 快照隔离)<br>T-1726 (多桶 Envelope 与 ICS) | ① `getOccasions()` / `getTodayOccasions()` 深度防御性克隆；<br>② `BackupEnvelope` 中事项桶（mutation）与提醒动作桶（overwrite）策略分离，支持原子快照回滚；<br>③ RFC 5545 ICS 单向导出，农历展开未来 3 年并标注 `X-LUNAR-ORIGIN`。 | **通过（Verified）** |
| **7. 布局与无障碍** | T-1709 (宽屏主从布局)<br>T-1710 (信息层级优化)<br>T-1723 (双语与触控基线) | ① `data-form-open="false"` 时宽屏单列吃满（`1fr`），展开时两栏自适应（`minmax(0, 1fr) minmax(340px, 420px)`）；<br>② 次级元信息点号分隔弱化，长备注按需展开折叠项；<br>③ 移动端主要打卡与操作按钮满足 44px 触控基线；无写死伪元素。 | **通过（Verified）** |

---

## 二、真实宿主走查与待产品决策项（Host-Pending & Product-Decisions）

1. **真实思源多窗口现场走查（Host-Pending）**：
   - 跨窗口物理写入：主窗口删除事项 A，副窗口同时修改事项 A 备注并保存；在下一次数据同步时，墓碑成功过滤掉副窗口写回的事项 A（单元测试 `cross-window-merge.test.cjs` 与 `occasion-delete-tombstone.test.cjs` 均已通过，待真实多桌面进程走查）；
   - Android / 移动触屏走查：窄屏折叠态与底部软键盘弹出时表单草稿不丢失（`tests/width-walkthrough.cjs` 与 `mobile-dialog.test.cjs` 均通过）。
2. **挂起产品决策（保持挂起）**：
   - T-1774 戒除类今日暂守口径（待用户拍板）；
   - T-1836 Task Horizon 消费端联调（待对方排期）；
   - T-1802 渲染块时区显示（待产品决策）；
   - T-1685～T-1695 问 AI 建项（待用户明确指示“开始开发”后再排期）。

---

## 三、门禁与守门脚本

- 专项测试：`tests/occasion-lifecycle-acceptance.test.cjs` 承接 9 大端到端章节，纳入 `package.json` 的 `test:v18`（80 项全绿）；
- 质量门禁：`test:quality` 全链通过。
