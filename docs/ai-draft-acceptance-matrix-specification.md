# 新建页问 AI 全景验收矩阵规范报告

> 任务：T-1700 新建页问 AI 验收矩阵（P1，实施后门禁设计）  
> 版本：v1.0 · 2026-10-30  
> 关联任务：T-1685～T-1699 自然语言建项全生命周期  
> 验收铁律：**严禁将模拟响应伪称为 AI 已接通；在取得公开模型契约前，严格以本地规则推断、复制自足提示词降级与普通原生编辑器为验收基线。**

---

## 一、验收矩阵架构总览

新建页问 AI（自然语言建项）不是孤立的代码块，而是一个贯穿用户输入、隐私过滤、规则推断、状态机转换、多表面隔离与底层原子保存的严密系统。
为了实现工程闭环，本规范设立了覆盖八大维度的完整验收矩阵：

```
┌────────────────────────────────────────────────────────────────────────┐
│                        T-1700 全景验收矩阵架构                          │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ 1. 国际化与本地化   │ 2. 解析与抗逆载荷   │ 3. 无模型与离线双降级         │
│ (中英双语 100% 覆盖)│ (JSON/围栏/防注入)  │ (复制自足提示词 + 本地推断)   │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ 4. 异步生命周期     │ 5. 事实安全与回滚   │ 6. 意图边界与至多双候选       │
│ (自增代际/防抖/丢弃)│ (0副作/失败原子还原)│ (习惯 vs 事项消歧/禁追问)     │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ 7. 多表面与多Root   │ 8. 无障碍与IME输入  │                              │
│ (Dock/Tab/Dialog/移动)│ (中文打字防触/Chips)│                              │
└────────────────────┴────────────────────┴──────────────────────────────┘
```

---

## 二、八大维度详细验收基线与断言标准

### 维度 1：双语与本地化对齐（i18n & Localization）
- **验收标准**：
  - 中文（zh_CN）与英文（en_US）所有 AI 交互词条 100% 对齐；
  - 核心词条清单：`ai.draftInputPlaceholder`、`ai.draftSubmit`、`ai.draftPrivacyBadge`、`ai.draftCostFree`、`ai.copyPrompt`、`ai.ready`、`ai.notConfigured`、`ai.sensitiveWarning`；
  - 切换语言时界面文案即时更新，零硬编码中文残留。

### 维度 2：输入净化与抗对抗载荷（Input Sanitization & Parsing）
- **验收标准**：
  - 输入字符硬截断：超过 500 字符自动安全截断，防止长文本缓冲区溢出与 token 滥用；
  - 敏感模式探测：对输入的 Email、手机号、Bearer Token 进行非阻塞温和告警，并打上 `containsSensitivePattern: true` 标记；
  - 输出格式抵抗：兼容标准 JSON、带 ` ```json ... ``` ` 代码块的 Markdown，以及模型自带客套话（如“好的，为您生成如下草案：...”）；
  - 恶意代码与 XSS 防护：在项目名称与备注中注入 `<script>` 或恶意 SVG 标签时，表单安全转义，零执行风险。

### 维度 3：无模型与离线双降级（Fallback & Zero Mock Pretence）
- **铁律原则**：绝不通过随机数或固定假接口假装大模型已接通。
- **验收标准**：
  - 在未配置外部模型 Key 或处于离线断网状态时：
    1. **降级 A（复制自足提示词）**：`buildProjectCreatePrompt` 产出包含完整角色要求、用户描述与标准 JSON Schema 样例的提示词，用户可一键复制并粘贴至外部大模型；
    2. **降级 B（本地确定性规则推断）**：`generateLocalFallbackDraft` 纯函数秒级识别名称、计量单位（分钟/毫升/公里/次）、目标数值与周期，产出合法 `ProjectDraft`；
  - 状态标记：显式展示 `externalApiRequired: false`，明确告知用户零额外网络开销。

### 维度 4：异步生命周期与跨代际防线（Async Lifecycle & Generation Guard）
- **验收标准**：
  - 状态机流转：`idle` → `inferring` → `ready` / `failed`；
  - 连续快速提交：分配单调自增 `generation`，触发新请求时自动 `abort()` 旧的 `AbortController`，旧请求被标记为 `superseded`；
  - 迟到响应拦截：迟于最新代际到达的旧推断结果，一律被 `settleSession` 丢弃（`applied: false, reason: "superseded"`），绝不倒灌覆盖最新输入；
  - 按钮防抖：执行推断时挂载 `aria-busy="true"` 与 `data-action-busy="true"`。

### 维度 5：事实安全与持久化原子回滚（Zero Side-Effect & Save Rollback）
- **铁律原则**：AI 起草、修改、选择与放弃过程绝对零 Store 直写。
- **验收标准**：
  - `verifyZeroStoreSideEffect` 静态与动态断言：在用户最终点击普通编辑器的「保存项目」按钮之前，主 Store 的 `items` 长度、`events` 长度严格保持 0 增长；
  - 模拟物理写盘失败：`saveEditorForm` 在 `persist()` 抛出异常时，触发原子回滚（`host.store = prevStore`），主 Store 立即还原为保存前快照，且当前表单内容与草稿完好保留供用户重试。

### 维度 6：复杂语义意图与至多双候选（Intent Boundary & Max 2 Candidates）
- **验收标准**：
  - 意图自动分类：精准辨识打卡习惯（`checkin_item`）、单次事项（`occasion`）与两可文本（`ambiguous`）；
  - 认知负担控制：严格禁止多轮会话式追问（`followUpDisallowed: true`）；
  - 候选硬上限：针对多模态习惯或两可文本（如“10月28日跑步”），提供至多 2 个结构化候选卡片（Primary + Secondary），绝不展示第 3 个候选；
  - 歧义消歧：两可输入显式输出 `disambiguation` 选项，绝不静默擅自建项。

### 维度 7：多表面与多 Root 隔离（Multi-Surface Isolation）
- **验收标准**：
  - 支持在四个宿主入口独立挂载：
    1. 侧边栏 Dock 面板；
    2. 独立标签页 Tab；
    3. 快捷录入弹窗 Quick Dialog；
    4. 移动端全屏弹窗 Mobile Dialog；
  - 各 Root 的 `EditorRootContext.aiDraftState` 完全相互隔离，在 Root A 里的推断中途绝不干扰 Root B；
  - 在 Root 销毁时调用 `cleanupEditorFor(root)`，彻底释放内部状态，零内存泄漏。

### 维度 8：无障碍、键盘交互与输入法防护（A11y, Keyboard & IME Guard）
- **验收标准**：
  - 中文 IME 拼写保护：在输入框内打中文拼音选择汉字期间（`event.isComposing || event.keyCode === 229`），按下 Enter 键严格拦截，绝不提前发起推断；
  - 快捷 Chips：提供 4 个典型习惯快捷标签（晨跑、阅读、喝水、冥想），点击一键填入并触发推断；
  - 动态清空：输入框有内容时展示清空按钮，点击一键清空并重置状态；
  - 焦点恢复：推断失败时，焦点自动归还输入框并维持光标。
