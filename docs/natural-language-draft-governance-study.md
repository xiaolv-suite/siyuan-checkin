# 自然语言项目草案 Envelope 契约、输出解析与审阅差异治理规范（T-1688, T-1689, T-1690 收官）

## 1. 背景与核心设计原则

在新建打卡项的自然语言交互与“问 AI 建项”场景中，用户通过简短语句描述打卡意图（例如“我想每天早上慢跑30分钟”、“睡前喝一杯温水，500毫升”）。引入模型辅助时，必须坚守以下安全与架构红线：

1. **草案隔离红线（Draft Isolation）**：AI 模型只能产出“待审阅的结构化项目草案（ProjectDraft）”，**绝对禁止直接创建、归档或修改主 Store 中的打卡项目，更绝对禁止私自伪造打卡事实**；
2. **单一保存事实源（Single Save Path）**：模型产出的草案必须回填至普通新建编辑器，最终落盘必须由用户显式点击“保存”，严格经过 `saveEditorForm` 的规则校验、修订指纹与失败回滚机制；
3. **不可信内容防线（Untrusted Boundary）**：模型输出的文本、代码块及错误提示均按不可信外部输入处理，必须进行 XSS 净化、长度钳制与格式校验，绝不直接注入 HTML/ARIA 或执行上下文；
4. **用户显式填写优先（Preserve Explicit Edits）**：若用户已经在编辑器中手动输入了目标数值或特定单位，应用草案时默认保护用户已填字段，杜绝模型草案强行冲刷手填成果。

为此，本规范系统化落地 **T-1688 数据信封契约**、**T-1689 模型输出安全解析** 与 **T-1690 草案审阅差异治理**。

---

## 2. T-1688 自然语言项目草案 Envelope 规范

确立统一的数据载荷信封结构 `ProjectDraftEnvelope`：

```ts
export interface ProjectDraftEnvelope {
    readonly schemaVersion: 1;
    readonly source: "local" | "provider" | "manual";
    readonly capturedAt: string;
    readonly modelSummary: string;
    readonly candidates: readonly ProjectDraft[];
    readonly missingFields: readonly string[];
    readonly confidence: "high" | "medium" | "low";
    readonly diagnosticCode?: string;
}
```

### 核心约束
- **双候选硬上限（Max 2 Candidates）**：自然语言建项最多只呈现 2 个精简候选，严禁模型输出海量候选项造成用户选择瘫痪；
- **排期与目标严格校验**：复用 `normalizeProjectDraft` 与 `normalizeSuggestionSchedule` 单一实现；未知字段一律 fail-closed；
- **置信度自适应评价**：当草案缺少核心量纲（如目标数值或单位）时，自动降级为 `confidence: "medium"` 或 `"low"`，并在信封中记录 `missingFields` 提示用户手工补齐。

---

## 3. T-1689 模型输出文本安全解析与防线

### 3.1 宽容提取与代码围栏兼容
`extractJsonFromModelOutput` 支持三种提取形态：
1. **Markdown 代码围栏**：识别 ```json ... ``` 及 ``` ... ```；
2. **前后夹杂闲聊文本**：提取第一个 `{` 到最后一个 `}` 之间的完整 JSON 块；
3. **纯 JSON 字符串**：直接解析。

### 3.2 注入防御与严格限制
- **载荷上限**：限制模型输出文本不超过 4,096 字符（`MAX_MODEL_PAYLOAD_LENGTH = 4096`），拦截异常超长生成；
- **脚本协议与注入拦截**：严格拦截 `<script>`、`javascript:`、`data:text/html` 等 XSS 载荷，直接判定为 `untrusted_content`；
- **确定性诊断码**：解析失败时返回结构化诊断码（`empty_payload`、`payload_too_large`、`invalid_json`、`schema_mismatch`、`untrusted_content`、`no_valid_candidates`），**绝不把用户的敏感输入或报错堆栈直接回显到界面**。

---

## 4. T-1690 草案审阅、同名冲突与表单保护

`evaluateDraftApplicationDiff` 负责草案应用前的全景审阅计算：

```ts
export interface DraftApplicationReview {
    readonly hasNameConflict: boolean;
    readonly conflictingItemName?: string;
    readonly diffs: readonly DraftFieldDiff[];
    readonly preservedUserFields: readonly (keyof ProjectDraft)[];
    readonly mergedDraft: ProjectDraft;
    readonly canApplyDirectly: boolean;
}
```

### 4.1 同名冲突拦截
- 自动遍历工作区内所有未归档打卡项；
- 若草案名称与既有活跃项目重名（忽略大小写与首尾空格），标定 `hasNameConflict: true`，禁止直接静默覆盖，要求用户重命名或进入已有项目编辑。

### 4.2 字段级差异比对与手填保护
- 逐字段（名称、图标、类型、目标、单位、分组、优先级、时段、备注）比对用户当前表单与草案内容；
- **保护策略**：若用户已在当前表单中输入了非空值（例如用户手填了 `target: 45` 或个性化备注），合并结果默认保留用户手填值（`mergedDraft.target = 45`），仅补齐未填写的空白字段（如 `timeSlot: "morning"`、`unit: "分钟"`），实现极其人性化的智能补全体验。

---

## 5. 门禁验证与交付记录

- **核心纯模型实现**：`src/features/natural-language-draft.ts`；
- **专项守门测试**：`tests/natural-language-draft.test.cjs` 固化了信封契约、双候选上限、Markdown 提取、XSS 防御、超长拦截、同名冲突以及手填字段保护等全维度断言；
- **全链验证**：纳入 `test:v18`（108 项通过）及全量 `test:quality` 质量链；
- **决策归档**：正式固化为 **D-668**。
