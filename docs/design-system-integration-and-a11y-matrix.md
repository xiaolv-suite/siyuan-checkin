# 小驴打卡设计系统集成与无障碍全景守门报告（T-1822～T-1827，D-644）

## 1. 概述与设计系统集成目标

本报告总结并固化「小驴打卡」在设计系统收拢阶段（T-1822～T-1827）所确立的跨宿主密度几何、矢量图标系统、主题对比度矩阵与无障碍动效降级规范，确保全站 7 大主表面在思源各宿主端（桌面宽屏、左右 Dock、移动端 Tab、快速打卡弹窗）中保持极致统一的触控与视觉质感。

---

## 2. 六大专项治理规范

### 2.1 矢量图标系统（T-1825）
- 确立 `UI_ICON_PATHS`（`src/ui/icons.ts`）为全局矢量图标的单一事实源（Single Source of Truth）；
- 严格提供 24 基础核心图标：
  `home`, `calendar`, `history`, `summary`, `insight`, `archive`, `settings`, `add`, `back`, `forward`, `search`, `external`, `focus`, `more`, `edit`, `trash`, `timer`, `expand`, `close`, `check`, `circle`, `pause`, `play`, `camera`；
- 所有 SVG 统一具备 `viewBox="0 0 24 24"`、`aria-hidden="true"` 与 `focusable="false"`，杜绝屏幕阅读器误读冗余节点。

### 2.2 宿主三档密度几何与触控保护（T-1824）
- `tokens.scss` 规范三档交互几何标准：
  - **Touch**：`--lc-checkin-touch-min-target: 44px`（用于移动端及高频手势区域）；
  - **Normal**：`--lc-checkin-normal-min-target: 34px`（用于桌面标准表面与导航）；
  - **Compact**：`--lc-checkin-compact-min-target: 30px`（用于密集列表、表单微调与 Dock 工具栏）；
- 移动端输入安全：`:focus` 注入 `scroll-margin-bottom: 96px` 虚拟键盘防遮挡外边距，杜绝输入时被软键盘顶出视口。

### 2.3 强制颜色与高对比度模式适配（T-1827）
- `@media (forced-colors: active)` 适配 Windows 高对比度模式：
  - 文本与边框映射至系统原生关键字：`CanvasText`、`Highlight`、`ButtonText`；
  - 为所有卡片、输入框与交互按钮增加实体边框 `outline: 1px solid CanvasText`，防止背景被系统剔除后结构散架；
- `@media (prefers-contrast: more)` 增强轮廓清晰度。

### 2.4 减弱动效双闸压制（T-1826）
- `@media (prefers-reduced-motion: reduce)` 实施双闸安全锁：
  - 动画持续时间强制压缩至微帧：`transition-duration: 0.01ms !important; animation-duration: 0.01ms !important`；
  - 彻底规避前庭功能障碍用户的眩晕风险，同时保留状态变更的 DOM 事件监听与流程完整性。

### 2.5 数据可视化皮肤与色阶（T-1823）
- 统一 Review 与 Insights 图表容器、统计指标小格与图例的调色板标准；
- 未达成/漏打状态统一由 `color-mix(in srgb, var(--lc-checkin-danger) 70%, transparent)` 渲染，消除全站状态色割裂。

### 2.6 设置与事项信息架构视觉重排（T-1822）
- 事项列表项全面迁移至 v3 卡片语义 token（`card-border` / `radius-sm` / `card-bg` / `card-shadow`）；
- 今日事项高亮通过 `card-border-selected` 与 `card-bg-selected` 突出展示；
- 宽屏主从布局（`data-form-open`）实现表单收起与展开时的最优空间利用率。

---

## 3. 守门与自动化验证

- 新增专项契约测试：`tests/design-system-integration.test.cjs`；
- 纳入 `pnpm run test:v18`（85 项全量通过）；
- 保持 CSS 维护硬限 680 KiB 内（实测 696,010 字节，0 死类，0 重复规则）。
