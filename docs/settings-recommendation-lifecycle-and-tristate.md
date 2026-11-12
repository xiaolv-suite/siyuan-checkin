# 设置推荐版本生命周期、过期判定与总览三态规范报告（T-1739 & T-1740，D-648）

## 1. 概述与核心治理目标

在长周期使用与多端跨窗口环境中，设置推荐方案面临以下动态演变挑战：
1. **环境变动导致的旧建议过期**：用户可能在其它窗口修改了习惯名称、修订了单位（如将“分钟”改成“页”）、归档了项目、或移动/删除了笔记文档；此时继续提示旧推荐将导致写入故障；
2. **用户自主修改与升级保护**：用户已手动填写的草稿必须绝对优先保护；版本升级绝不能静默覆盖用户个性化配置；
3. **设置总览状态误报**：旧版本总览易将“未配置/未启用”的中性状态误报为“连接失败/需修复”，给用户造成强烈的心理焦虑。

本规范确立了**推荐版本化生命周期与过期决策器（T-1739）**以及**设置总览“建议 / 待确认 / 需修复”三态精准分流模型（T-1740）**。

---

## 2. 推荐版本化生命周期与新鲜度判定（T-1739）

### 2.1 五大生命周期状态
- `active`：当前有效，待用户审阅采纳；
- `stale`：已过期，因底层依赖项变更需要重新计算或作废；
- `dismissed`：用户本次会话关闭，不再重复弹窗打扰；
- `opted_out`：用户显式标记“不再推荐”；
- `applied`：用户已显式确认并持久化落盘。

### 2.2 自动过期触发规则
当满足以下任一客观条件时，`evaluateRecommendationStaleness` 立即将推荐标记为 `stale` 并输出确定性原因：
1. **项目删除或归档**：关联的 `boundItemId` 在当前活跃项目中不存在（`item_deleted`）或处于归档态（`item_archived`）；
2. **单位修订（Unit Revision）**：项目单位发生变更（如原分钟项目被修订为次数或页码），导致与来源指标不兼容（`item_unit_revised`）；
3. **目标文档不可达**：日记或汇总目标文档在当前笔记库中不存在或已被移出范围（`target_doc_unreachable`）；
4. **草稿绝对保护红线**：若检测到用户在当前输入框中已进行手动输入（`userDraftValue` 非空），强制声明 `preserveUserDraft: true`，绝不因推荐刷新冲掉用户未保存的输入。

---

## 3. 设置总览“建议 / 待确认 / 需修复”三态模型（T-1740）

为了消除假阳性报警，设置总览严格遵循三态正交分流：

```
                    ┌──> requires_fix (需修复: 真实故障/写入失败/密钥被拒, isBlocking=true)
所有诊断与活动输入 ──┼──> pending_confirmation (待确认: 未保存草稿/导入重名冲突, isBlocking=false)
                    └──> suggested (可选改善: 推荐时段/安静时段/专注适配, isBlocking=false)
                    
  [特殊红线]: unconfiguredSources (未启用的外部来源) -> 严格归入中性，绝不进入 requires_fix!
```

### 3.1 三态行为与语义规范
1. **需修复 (`requires_fix`)**：
   - 包含：真实网络写入失败、凭据被网关拒绝、目标文档丢失、硬件/系统不可达；
   - 表现：红色告警、`isBlocking: true`，提供一键“重试”（`common.retry`）或“定位”（`bind.locate`）动作；
2. **待确认 (`pending_confirmation`)**：
   - 包含：有未保存的显式配置草稿、导入文件同名冲突待定夺；
   - 表现：黄色提醒、`isBlocking: false`，提供“全部保存”（`set.changeSaveAll`）或“确认处理”（`set.importConflictConfirm`）；
3. **可选改善 (`suggested`)**：
   - 包含：夜间安静时段建议、峰值打卡提醒槽建议、Dock Tomato 专注联动建议；
   - 表现：蓝色/紫色温和提示、`isBlocking: false`，提供“一键采纳”（`set.recApply`）。

### 3.2 守门测试与实施验证
- 纯模型：`src/features/settings-recommendation-lifecycle.ts`；
- 契约守门：`tests/settings-recommendation-lifecycle.test.cjs`；
- 纳入 `test:v18`（89 项全量通过）。
