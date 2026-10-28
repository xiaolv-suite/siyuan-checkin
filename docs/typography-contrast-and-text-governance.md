# 字体层级下限、状态对比度叠加防护与长文本折行截断规范（T-1814, T-1815 & T-1828 / D-643）

> **研究与门禁性质**：全站样式与排版系统的**可读性下限、对比度防护与文本折行总成报告**。
> 统一收敛字体最小尺寸底线、杜绝父子透明度复合折损，并固化三大标准文本 mixin。

---

## 一、字体层级下限与窄屏可读性（T-1814）

1. **绝对底线保障（Absolute Lower Bound）**：
   - 全库严禁出现 `< 8px` 的极小字号声明（清除历史上偶发的 7px/6px 幽灵声明）；
   - 正文与主要控件文字保持在 12px～14px 标准范围；
   - 辅助文字（如时间戳、副标题、帮助提示）保持在 11px～12px；
   - 徽标、标签、紧凑日历标记保持在 9px～10.5px，保证在 320px/360px 移动屏及 400% 缩放下依旧清晰可辨。
2. **标题与加粗规范**：
   - 大标题统一基于 `--lc-checkin-settings-title-weight: 720`；
   - 小标题与标签使用 `650` 字重，次级辅助文字使用 `400`，字阶层次分明。

---

## 二、状态对比度与透明度叠加防护（T-1815）

1. **透明度叠加防护（Compound Opacity Elimination）**：
   - 问题：过去完成态容器设置 `opacity: 0.6`，子元素再设置 `opacity: 0.6` 时，文字实际透明度急剧下降到 0.36，在弱光环境下对比度严重不达标；
   - 规约：完成态卡片在处于 `:active` 或 `:focus-within` 态时，强制重置自身 `opacity: 1`，将对比度全权交由语义色彩 Token 管理，杜绝透明度层层衰减。
2. **`[hidden]` 原生行为强制守卫**：
   - 在高优先级样式表中，若为某元素声明了 `display: grid` 或 `display: flex`，可能会无意中覆盖浏览器的原生 `[hidden]` 行为，导致隐藏元素虽不可见但依然占据点击区域或拦截交互；
   - 规约：强制声明 `.lc-checkin__record-details[hidden] { display: none !important; }`，杜绝任何假隐藏现象。

---

## 三、长文本折行与截断策略（T-1828）

1. **三大标准排版 Mixin**：
   - `@mixin lc-text-truncate`：单行超长文本打点省略（`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`）；
   - `@mixin lc-text-clamp-2`：多行（两行）文本自适应折叠（`-webkit-line-clamp: 2; overflow-wrap: anywhere; word-break: break-word;`）；
   - `@mixin lc-text-break`：无空格连续长英文字符串自适应全词换行（`overflow-wrap: anywhere; word-break: break-word;`）。
2. **400% 缩放与极端 URL 保护**：
   - 表单字段标签、事项行次级信息、以及历史记录备注全面采用 `overflow-wrap: anywhere`；
   - 即使遇到长达 100 字符的无空格链接或长 ID，在 400% 缩放或 320px 窄屏视口下均能自然折行，彻底消除横向滚动条撕裂与内容越界。

---

## 四、门禁与守门

- 专项测试：`tests/typography-contrast-text.test.cjs` 严格断言全库无 `< 8px` 字号、透明度复合防护生效、三大 mixin 在位以及 `overflow-wrap: anywhere` 覆盖；
- 纳入 `package.json` 的 `test:v18`（84 项全绿）；
- 质量门禁：`test:quality` 100% 验证通过。
