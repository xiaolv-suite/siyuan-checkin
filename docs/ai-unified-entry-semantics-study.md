# 小驴打卡 AI 入口统一语义与降级规范报告

> 版本：v1.0 · 2026-10-29
> 任务：T-1694 AI 与既有入口的统一语义
> 关联规范：[AI 双轨能力规划](./ai-integration-plan.md)、[UI 原型规范 v3](./ui-prototype-spec-v3-2026-10.md)

---

## 1. 核心目标与原则

小驴打卡的核心价值是**本地优先、零私密外发、可信习惯行动台**。
大模型能力（LLM）属于**可选的辅助解释、规划与起草工具**。
在任何环境下（无论思源宿主是否支持 AI、用户是否配置外部大模型 API、抑或网络离线），小驴打卡的所有基础业务页面（打卡、周复盘、编辑器、历史统计、数据导出）必须 **100% 独立可用**，绝不允许任何表面出现“正在向云端提交…”或“已完成智能分析”的伪造假状态。

---

## 2. 既有四大 AI 入口全景盘点

| 入口标识 (`entryKind`) | 业务宿主位置 | 本地确定性基线 | 提示词复制（Copy Prompt）降级 | 外部 API 依赖 | 数据外发范围 (`privacyEgressScope`) | 零数据损失保障 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`editor_draft`**<br>(新建项目起草) | 新建打卡项顶部折叠栏 `[data-ai-draft-disclosure]` | `generateLocalFallbackDraft`<br>纯本地规则秒级生成（名称/类型/单位/目标/排期/图标） | `buildProjectCreatePrompt`<br>复制包含完整 Schema 约束的自足 Prompt | 否（0 私有 API） | `user_text_only`<br>仅用户输入的自然语言描述（<=500字截断） | 严格保障：普通表单随时手填手改，模型输出绝不直写 Store |
| **`weekly_review_prompt`**<br>(周复盘提示词) | 周复盘向导底部「复制 AI 提示词」按钮 | `buildWeeklyReportMarkdown`<br>本地统计聚合（完成率、事件数、阻碍反思草稿） | `buildAiReviewPrompt`<br>自包含统计事实与用户手写的阻碍/调整草稿 | 否（0 私有 API） | `summary_facts_and_notes`<br>仅当前周期的聚合事实行与用户手填两段反思 | 严格保障：不依赖 AI，用户可随时导出 Markdown 或手动保存 |
| **`review_assistant`**<br>(回顾页助手指令) | 回顾页侧栏/工具栏「向思源智能体提问」 | 本地多维图表、趋势与周期变化比较看板 | `buildReviewPrompt`<br>生成给思源 Agent 的只读指引词 `checkin-summary-context(...)` | 否（思源内部通信） | `date_range_only`<br>仅开始与结束日期，不主动推送任何明细事件 | 严格保障：无智能体时，用户直接阅读多维图表与趋势看板 |
| **`habit_coaching`**<br>(习惯建议与工作台) | 单项洞察与复盘页「教练建议」卡片 | `buildCoachingSuggestions`<br>基于 14 天达成率、连续天数与破戒分析纯算法推断 | 无需复制，本地结构化卡片与依据直接呈现 | 否（纯本地计算） | `none`<br>0 数据外发，纯本地内存运行 | 严格保障：建议仅生成草案，必须由用户审阅确认后才写入表单 |

---

## 3. 统一交互规范与状态反馈契约

1. **统一剪贴板反馈**：
   - 当用户点击任一入口的「复制提示词」时：
     - 调用系统剪贴板并弹出气泡通知：`t("editor.aiDraftPromptCopied")` 或 `t("review.aiCopied")`；
     - 对应页面就地更新状态文本（如 `[data-weekly-status]` 或 `[data-ai-draft-status]`），在系统通知被屏蔽或桌面全屏模式下依然保持可见反馈。
2. **统一隐私说明（Privacy Disclosure）**：
   - 界面统一标明：`🔒 本地优先：仅发送当前输入文本/统计摘要，绝不外发笔记正文、全部打卡历史或密钥凭据`；
   - 保证成本透明：本地规则 100% 免费，复制提示词到外部模型无任何插件附加费用。
3. **输入法安全与防抖**：
   - 所有输入区域在监听 Enter 键时，必须增加 `isComposing || keyCode === 229` 拦截，杜绝拼音选词与输入法上屏时意外提前提交；
   - 执行中按钮必须挂载 `data-action-busy="true"` 与 `aria-busy="true"` 阻断连击。

---

## 4. 结论与架构守门

通过在 `src/features/natural-language-draft.ts` 集中收敛 `AiSurfaceCapabilityDescriptor` 与 `getAllAiSurfaceSpecs()`，确保了：
- 四大入口遵循同一套无模型降级架构（双降级：复制提示词 + 本地确定性规则）；
- 严格杜绝在各个界面散落各异的假状态或未经审计的数据外发逻辑；
- 100% 维持小驴打卡纯本地持久化与可信安全边界。
