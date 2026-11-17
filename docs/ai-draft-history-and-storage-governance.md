# 结构化 AI 草案历史治理、跨窗口策略与多桶规范报告

> 任务：T-1699 结构化草案的历史、删除和跨窗口策略（P2，数据治理）  
> 版本：v1.0 · 2026-10-30  
> 关联契约：[JSON 主档备份边界（T-1627）](./export-formats.md)、[多桶版本化备份协议（T-1862）](./backup-envelope-governance.md)、[AI 事实安全与审计边界（T-1695）](./ai-draft-safety-boundary.md)

---

## 一、背景与治理目标

在小驴打卡中引入 AI 自然语言起草功能后，用户在新建打卡项目或规划日程事项时，会触发生成结构化的 `ProjectDraft` 或 `OccasionDraft`。
针对这些草案的生命周期，必须在**用户重用便利性**与**本地数据治理/隐私防护**之间确立明确的工程防线。

### 核心治理目标：
1. **零原文持久化（Zero Raw Prompt Storage）**：严禁把用户输入的自由长文本、Prompt 与对话上下文默认写入本地磁盘；
2. **有界轻量存储（Strictly Bounded Capacity）**：硬顶最多 20 条结构化历史，7 天 TTL 自动过期淘汰，单桶体积严控在 64 KB 内；
3. **跨窗口防死灰复燃（Non-Union Reconciliation）**：绝对严禁复用事实桶的无脑并集合并规则，通过墓碑（Tombstone）与清空截断点阻断僵尸数据复活；
4. **失败解耦与卸载干净（Failure Decoupling & Clean Teardown）**：辅助桶写失败静默回落至内存，卸载时 100% 物理清除；
5. **对齐主档备份口径（Backup Scope Alignment）**：严格坚守 T-1627 铁律，主档备份与普通 CSV 绝对不包含临时 AI 草案。

---

## 二、用户价值评估：查看、删除与重用策略

在日常个人习惯管理中，用户的交互频次与心智路径具有明确的聚类特征：

| 用户动作场景 | 业务需求真实性 | 系统响应与治理策略 | 存储与隐私要求 |
| :--- | :--- | :--- | :--- |
| **一键重用未采纳草案** | **高频/正向**：误触关闭弹窗、临时切换至回顾页核对后，希望找回刚刚生成的 1~3 条草案 | 在新建页或设置页提供轻量历史草案抽屉，点击草案卡片可一键回填普通编辑器表单 | 仅读取结构化字段（`target`、`unit`、`schedule` 等），不还原长文本 Prompt |
| **查看最近生成记录** | **中频/低负担**：查看最近尝试过的 3~5 个习惯备选方案（如“背单词”的时长版与计次版） | 提供最多 20 条有界列表，展示脱敏摘要与采纳状态（`pending` / `applied` / `discarded`） | 摘要严格清洗个人敏感信息并硬截断至 40 字符 |
| **一键清除全部历史** | **高频/隐私关切**：用户测试完毕后，希望彻底擦除所有 AI 痕迹 | 提供明确的「清空 AI 草案历史」操作，即时更新 `clearedBefore` 截断点并物理置空 | 彻底物理清空，跨窗口同步生效 |
| **长文本回放与会话追溯** | **无实际价值/高风险**：将打卡工具变成长期聊天记录查看器 | **明确拒绝**：不提供完整的 Prompt 回放与大模型交互日志浏览 | 从源头上杜绝隐私数据泄露隐患 |

---

## 三、脱敏、容量与 TTL 生命周期控制

在 `src/features/ai-draft-governance.ts` 中落地了辅助桶 `ai_draft_history` 的纯模型实现：

```typescript
export const MAX_AI_DRAFT_HISTORY_ENTRIES = 20;
export const AI_DRAFT_HISTORY_TTL_DAYS = 7;
export const MAX_TOMBSTONES_COUNT = 50;

export interface AiDraftHistoryEntry {
    readonly id: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly summary: string; // <= 40 字符脱敏摘要
    readonly intentType: "checkin_item" | "occasion";
    readonly source: "local" | "provider" | "manual";
    readonly draftPayload: ProjectDraft | OccasionDraft;
    readonly status: "pending" | "applied" | "discarded";
    readonly ttlExpiresAt: string; // 7 天后自动淘汰
}
```

### 关键控制机制：
1. **摘要脱敏（Sanitization）**：
   - 自动移除换行控制符；
   - 自动匹配并遮蔽个人凭据（`[TOKEN]`、`[EMAIL]`）；
   - 强制截断至 40 个字符，绝不保留未净化长文本；
2. **容量硬顶（FIFO Capping）**：
   - 当草案数量达到 20 条时，最老创建的草案在下一次写入时自动被丢弃；
3. **TTL 自动修剪（Auto Expiry）**：
   - 默认有效期为 7 天（`ttlExpiresAt`），任何读取、写入或合并操作均会过滤已过期的物理条目。

---

## 四、跨窗口并发与非并集合并铁律（No-Union Reconciliation）

### 为什么事实桶用并集，而 AI 辅助桶绝对禁止并集？
- **主事实桶（Event/Item Store）**：
  - 核心资产是不可逆的用户行为事实（如 8:00 晨跑 3 公里、12:00 喝水 500ml）；
  - 窗口 A 和窗口 B 分别记录了不同打卡，必须采用并集合并（Union），否则任何一方的打卡事实都会永久丢失。
- **AI 草案辅助桶（AI Draft Bucket）**：
  - 本质是**临时状态与可丢弃缓存**；
  - 若复用并集合并，会产生严重灾难：
    1. **已删除数据死灰复燃（Zombie Resurrection）**：窗口 A 执行了“删除草案 X”，窗口 B 本地保留着草案 X，一旦触发并集合并，草案 X 将被再次复活注入；
    2. **清空操作被逆向覆盖**：窗口 A 点击了“清空所有 AI 历史”，窗口 B 保存旧快照，并集将瞬间把被清空的历史全量恢复；
    3. **容量无限膨胀**：多个窗口各自产生临时草案，并集合并会直接击穿 20 条硬上限。

### 非并集合并纯函数算法：
在 `reconcileCrossWindowAiDraftBuckets(localBucket, remoteBucket)` 中实现了确定性收敛：
1. **全局清空截断点（`clearedBefore`）优先级最高**：
   - 取两端最大的清空时间戳 `effectiveClearedBefore = Math.max(local.clearedBefore, remote.clearedBefore)`；
   - 任何 `createdAt <= effectiveClearedBefore` 的条目一律直接物理丢弃；
2. **墓碑联合过滤（Tombstone Filter）**：
   - 合并两端墓碑集合 `combinedTombstones = Union(local.tombstones, remote.tombstones)`；
   - 任何命中墓碑的草案一律物理过滤，彻底杜绝死灰复燃；
3. **状态层级与 LWW（Last-Write-Wins）消解冲突**：
   - 相同 ID 条目，终态（`applied` / `discarded`）优先于 `pending`；
   - 相同状态级别，更新时间戳 `updatedAt` 晚者胜出；
4. **硬上限与 TTL 强制收敛**：
   - 合并完成后按 `createdAt` 降序排列，严格截取前 20 条，剔除过期条目。

---

## 五、失败回滚、卸载收尾与备份范围契约

1. **失败回滚（Failure Decoupling）**：
   - 辅助桶写盘发生 IO 异常或磁盘满时，系统严格将错误隔离在辅助层，自动回落为会话内存存储（In-Memory Fallback）；
   - 绝不阻断用户当前编辑器的正常打卡项目保存流程，绝不弹出导致恐慌的全局报错；
2. **卸载收尾（Teardown）**：
   - 在用户卸载插件或选择“重置所有数据”时，调度清除 `ai-draft-history.json`，确保工作区无任何隐蔽缓存残留；
3. **多备份协议对齐（Backup Scope Alignment）**：
   - **JSON 主档备份（T-1627）**：返回 `isIncluded: false`，主档备份仅收录主 Store（项目、事件与墓碑），AI 辅助桶绝不在主档中露头；
   - **普通打卡 CSV（T-1628）**：返回 `isIncluded: false`，仅导出打卡完成度与事实；
   - **多桶版本化备份（T-1862）**：默认标记为可选辅助桶，必须经脱敏后导出，恢复时默认使用覆写而非并集。
