# 推荐草稿多 Root 所有权、跨表面隔离与隐私凭据治理规范（T-1759 & T-1760，D-652）

## 1. 概述与设计目标

在思源笔记的多表面（Multi-surface）交互体系中，用户可能同时在：
- 主页签（Tab）、
- 侧边栏停靠窗（Dock）、
- 快捷弹窗（Quick Dialog）

中打开设置或推荐应用面板。
如果所有表面共享单槽未隔离的草稿变量，一个表面上的输入或远端（另一窗口）通过 `onDataChanged` 推送的偏好快照，将不可预测地冲掉用户在当前表面正在编辑的表单。

同时，设置中涉及微信读书 API Key 等私有账密凭据，推荐系统的分析、日志、导出与诊断**坚决不能将明文凭据外发或持久化到非隔离区域**。

本规范确立了**按 Root 隔离的推荐草稿状态机（T-1759）**与**零凭据泄露的隐私防护防线（T-1760）**。

---

## 2. 推荐草稿多 Root 隔离与远端刷新保护（T-1759）

```
[Window A: Desktop Tab (root-tab)]      [Window B: Dock (root-dock)]
   └── dirtyFieldValues: { threshold: 25 }     └── dirtyFieldValues: { quiet: true }
             │                                           │
             └─────────────── [独立的内存草稿] ────────────┘
                                     ▲
                                     │
                        [远端 onDataChanged 广播]
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
   [检测到 dirty: true]                                [检测到 dirty: false]
   保留当前编辑输入，仅标记 stale 警告                      安全重置，同步最新磁盘事实
```

### 2.1 核心状态流转与所有权纪律
1. **Root 作用域隔离**：每个 DOM root 对应独立的 `RootRecommendationDraft` 实例，互不串台；
2. **Dirty 状态检测**：当用户修改任意推荐输入项时标记 `isDirty = true`；
3. **远端并发保护**：宿主收到 `onDataChanged` 时，遍历检查各 root 草稿：
   - 若 `isDirty === true`：**严格禁止覆写**，仅打上 `hasStaleRemoteWarning: true` 标记，提醒用户远端存在并发更新；
   - 若 `isDirty === false`：重置并跟随最新远端数据；
4. **生命周期清理**：表面关闭时通过 `clearDraft(rootId)` 释放上下文，杜绝内存泄漏。

---

## 3. 推荐所需隐私与凭据脱敏治理（T-1760）

### 3.1 凭据绝不进入建议载荷原则
- **零凭据建议（Zero-Credential Suggestion）**：推荐方案可以建议“绑定到阅读习惯”或“配置 15 分钟阈值”，但**绝对禁止将实际 API Key 或 Token 包含在建议载荷或导出包中**；
- **展示脱敏**：任何在设置总览、活动日志、审计记录中涉及密钥的字段，必须调用 `sanitizeRecommendationPayload` 强制格式化为 `••••••••`；
- **审计防线**：`auditRecommendationPrivacy` 在导出前进行白名单扫描，若检测到明文敏感字段立即阻断导出。

---

## 4. 纯模型与测试契约

- 纯模型：`src/features/settings-recommendation-ownership-and-privacy.ts`；
- 契约守门：`tests/settings-recommendation-ownership-and-privacy.test.cjs`；
- 纳入 `test:v18`（93 项全量通过）。
