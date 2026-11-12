# 模板与组合包变体自然语言定制规范报告

> 版本：v1.0 · 2026-10-30
> 任务：T-1697 模板/组合包变体的自然语言入口（P2，后续扩展）
> 关联规范：[AI 双轨能力规划](./ai-integration-plan.md)、[循证模板治理](./template-catalog-governance.md)

---

## 一、背景与设计动机

小驴打卡在 `catalog.ts` 中内置了 72 个经过循证与行为心理学检验的经典习惯模板（`CHECKIN_TEMPLATES`），以及按生活场景划分的组合包（`TEMPLATE_PACKS`）。
在实际使用中，用户经常希望**基于某个标准模板做个性化微调**，例如：
- “参考喝水模板，但我每天喝 1500 毫升就够了”；
- “按晨跑模板，改成工作日早晨跑 3 公里”；
- “按背单词模板，每天背 30 个”。

### 核心设计原则
1. **身份与来源传承（Template Identity Inheritance）**：
   - 变体并不是凭空创造的未知项目，必须保留其基准模板的 `templateAnchor`（如 `tpl-喝水`）；
   - 保留原模板的专业分组、默认图标与科学指引文案；
2. **覆写字段清晰透明（Transparent Overrides）**：
   - 明确追踪并向用户展示被自然语言覆写的字段列表（`overriddenFields`），如 `["target", "schedule"]`；
   - 未提及的字段保持原模板的高质量配置，不出现缺失或被未知参数篡改；
3. **零独立协议与零副作用**：
   - 不额外造第二套模板分享或保存协议，变体直接输出为规范的 `ProjectDraft`，最终回填至普通编辑器表单供用户核验确认；
   - 在用户点击「保存项目」前，绝不向 Store 写盘，绝不产生打卡事件。

---

## 二、架构实现与数据流

在 `src/features/natural-language-draft.ts` 中落地了纯函数算法：
- `findBestMatchingTemplate(userDescription, templates)`：纯模糊匹配，支持精确名称与生活关键词同义推断；
- `generateTemplateVariantDraft(userDescription, baseTemplate?, options?)`：
  - 提取基准模板；
  - 提取自然语言中的变动量（数值、单位、工作日/每天排期、早晨/晚间时段）；
  - 组装包含 `baseTemplateName`、`templateAnchor`、`overriddenFields` 与 `diffSummary` 的结构化结果。

---

## 三、门禁与测试验收

在 `tests/template-ai-variant.test.cjs` 建立了专项自动化门禁，覆盖了：
- 基于模板名称的自动匹配与数值覆写；
- 排期与时段偏好的精准覆写；
- `templateAnchor` 身份溯源保留；
- 被覆写字段列表透明度；
- 未匹配模板时的安全回落。
