# 专注计时闲置暂停与净时长双口径治理研究报告

> 任务：T-1538 内置专注计时闲置暂停与净时长口径（条件批次，用户拍板，D-695）  
> 版本：v1.0 · 2026-10-30  
> 关联规范：[专注计时生命周期与同步契约](./focus-surface-consistency-and-sync-acceptance.md)、[Dock Tomato 会话所有权](./dock-tomato-lifecycle-drills.md)

---

## 一、背景与设计张力

在个人习惯与行动管理中，内置专注计时（Focus Timer）承载着用户高强度的注意力沉浸。
随着用户对时间记录精细度的要求提升，出现了一个经典的产品设计张力：
**当用户在计时期间长时间离开键盘/鼠标时，系统应当如何处理？**

### 核心张力分析：
1. **严格番茄承诺制（Strict Pomodoro Discipline）**：
   - **理论根基**：经典番茄工作法（Cirillo's Pomodoro Technique）的核心是不妥协的承诺与心理仪式——一个 25 分钟的番茄钟是原子性的，不可分割，不可挂起。
   - **设计主张**：中途离开如果被软件“悄悄暂停，等你回来继续”，番茄钟就沦为了普通的走字钟，失去了注意力锚定效应。若发生中断，应该由用户显式选择“放弃”或“继续坚持”。严禁系统私自扣除几分钟并继续运行。
2. **宽松净时长记录制（Relaxed Net Duration Tracking）**：
   - **现实需求**：在长周期的阅读、自习或漫长编码过程中，用户可能离开接水、伸展或查阅资料数分钟。用户希望打卡记录的是真实的“有效净产出时间（Net Duration）”，而不是虚高的挂钟时长（Gross Duration）。
   - **设计主张**：当检测到无操作超时（如超过 3 分钟），系统自动将计时器置入暂停状态，并在结算时明确扣除超出闲置时间。

---

## 二、双轨口径模型与决策标准

在 `src/features/focus-idle-governance.ts` 中建立了纯数学评估模型，彻底解耦业务逻辑与渲染层：

```typescript
export type FocusPolicyMode = "strict_pomodoro" | "relaxed_net_duration";

export interface FocusIdleConfig {
    readonly mode: FocusPolicyMode;
    readonly idleThresholdSec: number; // 默认 180 秒 (3分钟)
    readonly autoPauseOnIdle: boolean;
}

export interface FocusIdleEvaluation {
    readonly isIdle: boolean;
    readonly idleDeductedSec: number;
    readonly netFocusSec: number;
    readonly grossElapsedSec: number;
    readonly shouldAutoPause: boolean;
    readonly statusNoteKey: string;
}
```

### 决策机制：
| 模式对比 | 默认模式：严格番茄制 (`strict_pomodoro`) | 可选模式：宽松净时长 (`relaxed_net_duration`) |
| :--- | :--- | :--- |
| **闲置判定阈值** | 无操作超过 3 分钟 (`180s`) | 无操作超过 3 分钟 (`180s`) |
| **是否自动暂停** | **否**（保持计时器进行，不打断沉浸） | **是**（`shouldAutoPause: true`，自动切入暂停态） |
| **时长是否扣除** | **0 扣除**（`idleDeductedSec = 0`，绝不改写时长） | **扣除超额闲置**（`idleDeductedSec = delta - threshold`） |
| **用户提示反馈** | 提示“离开提示：当前番茄钟仍在运行” | 提示“已因闲置自动暂停，已扣除超出闲置时间” |
| **最终记账口径** | 完整番茄时间（需满足承诺） | 显式区分：`净专注 X 分钟（闲置扣除 Y 分钟）` |

---

## 三、核心防护原则

1. **零隐式扣除（Zero Implicit Tampering）**：
   - 严禁任何后台静默扣减用户时长的行为。所有闲置扣除均必须在结算弹窗中通过 `formatDualDurationDisplay` 显式呈现“净专注 X 分钟（闲置扣除 Y 分钟）”；
2. **默认遵守经典承诺（Default to Commitment）**：
   - 系统默认配置维持为 `strict_pomodoro`，确保不破坏既有番茄钟用户的习惯节奏；仅在用户显式开启“闲置自动暂停”时才切换为宽松净时长模式；
3. **与休眠唤醒（Sleep / Wake）解耦**：
   - 计算机系统休眠（Sleep）已被底层 `focus-clock.ts` 的 `FOCUS_MAX_VISIBLE_GAP_MS`（30秒硬上限）与单调时钟检查完全隔离，休眠时间本就 100% 自动剔除；
   - 本规范专指“电脑未休眠，但用户未发生键盘/鼠标交互”的应用层无操作闲置。

---

## 四、结论与门禁

通过纯模型 `evaluateFocusIdleStep` 与 `formatDualDurationDisplay`，小驴打卡实现了兼顾番茄钟纯正性与自由记录灵活性的双轨机制：
- 严格模式保持 0 扣除与严肃承诺；
- 宽松模式精准计算闲置差值并支持透明双口径回显；
- 专项测试 `tests/focus-idle-governance.test.cjs` 覆盖全部临界判定，**T-1538 达到规范化收官与闭环标准**。
