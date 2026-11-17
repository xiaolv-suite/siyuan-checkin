# 性能、包体积与低端设备预算总成报告（T-1650 / D-641）

> **研究与门禁性质**：小驴打卡全链路**性能、产物体积与设备预算（Performance & Budget Capstone）**。
> 汇编 T-1650、T-1667（大数据集冷启动）、T-1807（存储写放大）、T-1829（UI 样式大列表渲染预算）与 `scripts/t1650-browser-benchmark.cjs` 的实测数据，确立多端性能边界。

---

## 一、产物体积基线与硬预算约束（Bundle Size Budgets）

| 资产名称 | 当前构建体积（Bytes） | 预算阈值与护栏 | 状态 |
| :--- | :--- | :--- | :--- |
| **`dist/index.css`** | **696,010 字节**（~679.7 KiB） | 620 KB 软警告线 / 680 KiB（696,320 字节）刚性硬限 | **达标（安全余量 310 字节）** |
| **`dist/index.js`** | **1.64 MiB**（生产 Minified） | 单文件完整全功能（零外部运行时依赖） | **达标** |
| **`package.zip`** | **956 KiB** | < 1.0 MiB 安装包轻量分发预算 | **达标** |
| **CSS 卫生度** | 855 个 class tokens | **0 死类（Zero Dead Classes），~0 字节重复规则** | **100% 极净** |

---

## 二、多阶梯冷启动与大数据集性能实测（Cold-Start & Scale Baseline）

基于 `scripts/cold-start-benchmark.cjs` 与 `scripts/t1650-browser-benchmark.cjs` 真实测试：

1. **项目与事件反序列化冷启动**：
   - 1k 事件：**6.8 ms**（预算 < 25 ms）；
   - 10k 事件：**29.1 ms**（预算 < 70 ms）；
   - 100k 事件：**237.5 ms**（预算 < 500 ms）；
2. **多表面渲染与索引弱引用查询**：
   - Today 今日有界扫描：**0.001 ms**；
   - Review 范围投影扫描（10k 事件）：**7.7 ms**（浏览器实测：43.1 ms）；
   - Insights 366 天单项钻取（10k 事件）：**16.3 ms**；
   - 弱引用索引 O(1) 单条 ID 查找：**0.005 ms**；
   - 双 Root 同屏渲染耗时：**54.3 ms**；
3. **UI 样式复杂度与列表渲染**：
   - 100 项习惯卡片 DOM 模板渲染：**0.06 ms**（预算 < 50 ms）；
   - 1,000 项大列表 DOM 模板渲染：**1.08 ms**（预算 < 350 ms）。

---

## 三、低端设备与移动端平滑保障原则（Low-End Devices Invariants）

1. **16.6ms 帧预算与 50ms 长任务压制（Render Budget Invariant）**：
   - 后台刷新与外部事件入账严格遵循 `evaluateRenderBudget`；
   - 超过 50ms 的重型操作拆分至宏任务队列（`setTimeout(..., 0)` 或 idle 调度），杜绝移动端掉帧与触控卡顿；
2. **焦点与重排隔离（Layout Containment）**：
   - 核心列表与卡片面板强制使用 `contain: layout` 与 `min-width: 0`；
   - 用户处于活动输入聚焦态时挂起后台重绘（`deferred-input`），失焦后自愈刷新，保护低性能设备输入顺滑度；
3. **低功耗定时器策略**：
   - 外部来源调度根据空闲周期自适应指数退避（从 5min 阶梯退避至 30min），降低常驻功耗与发热。

---

## 四、门禁与守门

- 离线浏览器基准：`scripts/t1650-browser-benchmark.cjs` 输出 `.artifacts/t1650-browser-benchmark.json`；
- 契约守门：`tests/t1650-report-contract.test.cjs` 纳入 `test:ui` 与 `test:quality` 持续集成。
