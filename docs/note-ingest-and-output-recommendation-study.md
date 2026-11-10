# 笔记推导、叶归映射、文档输出与模板联动推荐治理报告（T-1746, T-1747, T-1750, T-1751，D-657 & D-658）

## 1. 概述与核心治理目标

本专项针对笔记内容摄取、外部生活日志映射、文档持久化输出以及编辑器模板联动的复杂推荐场景，建立统一的真实性、安全性与单一事实源防线：
1. **笔记推导与叶归映射真实性（T-1746 & T-1747）**：
   - 笔记推导：无客观可验证的匹配块样例时，严禁宣称“推荐已就绪”；必须提供扫描、匹配与忽略块数量的透明预览；整体 7 字段保存边界沿用 D-313；
   - 叶归 LifeLog 映射：按活动名与分钟单位推荐映射，但绝对禁止以同名启发式直接静默套用，强制要求用户逐行确认；
2. **文档输出与模板联动安全（T-1750 & T-1751）**：
   - 日记报告、常驻摘要与问卷文档输出：针对“写什么、何时写、写到哪里、最近是否成功”四维安全审阅；空目标仅给可选候选，绝对禁止擅自创建外部文档；推荐草案**绝对禁止私自打开自动写入开关**；
   - 模板联动收敛：统一编辑器模板建议与设置侧推荐的指标过滤规则，防止两套真值。

---

## 2. 笔记推导与叶归映射模型（T-1746 & T-1747）

### 2.1 笔记推导样例验证原则（`evaluateNoteQueryRecommendation`）
- 缺少笔记本、目标文档或属性/标签名称时，`isReadyForPreview = false`；
- **零样例拒止**：若在目标文档中未扫描到任何具备该属性且可提取数值的块（`sampleMatches.length === 0`），系统给出 `set.notequery.noVerifiableSamples` 阻断，绝不引导用户保存盲目推导；
- **匹配与忽略透明度**：展示预估匹配块数与忽略块数，保障用户对写入影响范围有清晰认知。

### 2.2 叶归多项目映射（`deriveLifeLogMappingProposals`）
- 活动名完全一致 -> 高置信度（`high`）；
- 活动名部分重合 -> 中置信度（`medium`）；
- 核心守门：所有提议的 `requiresConfirmation` 恒为 `true`，坚守 `source + externalRef` 幂等与断连保留纪律。

---

## 3. 文档输出与模板联动收敛（T-1750 & T-1751）

### 3.1 文档输出安全四问（`evaluateDocumentOutputRecommendation`）
- **目标空缺**：状态标为 `needs_target_selection`，列出已加载笔记候选供用户挑选，严禁私自新建文档；
- **最近失败**：状态标为 `recent_failed`，提示用户检查权限或只读属性；
- **开关私开禁则**：`canRecommendAutoEnable` 恒为 `false`，即使用户采纳推荐方案，自动追加写入的总开关必须由用户手动拨动确认。

### 3.2 模板联动与设置一致性（`validateTemplateAndSettingsLinkageParity`）
- 模板联动与设置推荐共用底层的 `wereadCandidates` 与 `projectTargetCandidates` 过滤算法；
- 针对需要“分钟”的模板或来源，若目标项目单位被修改为其他指标，校验器立即返回 `unit_conflict_template_requires_minutes`，消除双向串台。

---

## 4. 纯模型与测试契约

- 纯模型：`src/features/note-query-and-lifelog-recommendation.ts` 与 `src/features/document-output-and-template-linkage.ts`；
- 契约测试：`tests/note-query-and-lifelog-recommendation.test.cjs` 与 `tests/document-output-and-template-linkage.test.cjs`；
- 纳入 `test:v18`（99 项全量通过）。
