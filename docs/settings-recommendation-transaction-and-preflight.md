# 设置推荐应用事务、保存边界与前置检查规范报告（T-1737 & T-1738，D-647）

## 1. 概述与设计原则

在设置推荐方案中，一套综合推荐往往包含：
- **A 类显式草稿字段**（如 `reminder_slots`、`weread_threshold`）；
- **B 类即时持久化偏好**（如 `theme`、`group_mode`、`quiet_hours`）；
- **高风险文档或笔记本目标**（如 `journal_notebook_id`）。

传统做法若采用盲目的“多字段并发乱序写入”，在遭遇存储失败时将导致部分字段已改、部分字段未存、草稿不一致且无法回滚的灾难性脏状态。

本规范确立了严密的**多桶原子事务协调机制（T-1737）**与**七大前置状态预检防线（T-1738）**。

---

## 2. 推荐事务提交与保存边界（T-1737）

### 2.1 事务编排流程
1. **快照捕获（Snapshot Capture）**：事务启动前捕获涉及全部字段的内存原始值，生成回滚备用快照；
2. **按桶聚合（Coalesce by Bucket）**：将变更按存储桶聚合成单一批次（如 `checkin-view-preferences`），杜绝 N 次离散无反馈的单字段写盘；
3. **逐桶执行与持久化（Bucket-by-Bucket Execution）**：调用对应的存储桶写入器；
4. **失败回滚（Failure Rollback）**：若任何存储桶写入拒绝或抛错，立即调用 `rollbackInMemoryFn` 恢复内存数据并同步还原 UI 输入控件；
5. **诚实披露（Honest Reporting）**：
   - 全成功：报告 `full_success`；
   - 部分成功：报告 `partial_success`，向用户明确说明“偏好已保存，但笔记本绑定未落盘：[原因]”，**绝不暗示全局原子性已具备**；
   - 全失败：报告 `rolled_back`，提示已安全撤销全部草稿改动。

---

## 3. 推荐前置检查与人工补齐（T-1738）

### 3.1 七大前置就绪度状态机
推荐草案在呈现给用户前，必须经过纯逻辑预检函数 `evaluateRecommendationPreflight`：

| 检查状态码 | 含义 | 是否可执行 | 推荐补齐动作路径 |
| --- | --- | --- | --- |
| `ready` | 全部前置已就绪 | 是 (`true`) | `apply_directly`（直接一键应用） |
| `missing_credential` | 缺少私有密钥或凭据 | 否 (`false`) | `input_credential`（聚焦密钥输入框，提示补齐） |
| `host_undetected` | 外部宿主/插件未探测到 | 否 (`false`) | `verify_host_status`（检查外部插件是否安装并运行） |
| `target_unreachable` | 目标笔记文档/笔记本不存在或无权访问 | 否 (`false`) | `choose_target_item`（重新选择有效目标） |
| `unit_conflict` | 既有打卡项单位不兼容（如二值 vs 分钟） | 否 (`false`) | `create_matching_item`（新建符合单位规范的项目） |
| `no_matching_item` | 库中完全没有符合条件的打卡项 | 否 (`false`) | `create_matching_item`（新建对应打卡习惯） |
| `multiple_candidates` | 命中多个候选打卡项 | 否 (`false`) | `choose_target_item`（提供下拉列表供用户定夺） |

### 3.2 核心守门纪律
1. **严禁提前启用**：推荐草案在未通过用户显式确认前，**绝对禁止预先开启外部来源开关或触发网络拉取**；
2. **严禁状态误报**：前置失败绝不抹杀已有有效配置，也绝不允许把“未配置”曲解成“连接失败”。
