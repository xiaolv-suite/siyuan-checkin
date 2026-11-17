# 快速弹窗、专注计时与嵌入表面一致性验收报告（T-1582，D-663）

## 1. 概述与核心治理目标

本专项针对多表面（Dock、主页签 Tab、快速弹窗 Quick Dialog、嵌入渲染块 Checkin Block）共存时的专注计时与记录一致性：
1. **多 Root 计时器同步刷新（T-1582）**：彻底消除原单一 `document.querySelector` 仅刷新首个 DOM 节点的旧缺陷；`paintFocusRoots` 枚举宿主下所有已连接根节点（`[host.focusTimerRoot, host.dockElement, host.tabElement, host.quickDialogElement]`），通过 `querySelectorAll` 同步刷新全部可见的 `[data-focus-timer]` 面板、`[data-focus-mini-remaining]` 小条、`[data-focus-mini-status]` 状态与进度条；
2. **防重复入账不变量**：计时器会话与状态机由单一 `FocusSession` 管理，虽然同屏多个表面同步展示相同倒计时，但在完成或放弃时仅触发单次写入与变异入账，杜绝多 surface 导致的多重记账；
3. **休眠与失焦保护**：页面隐藏、窗口失焦或系统休眠时自动进入暂停态并记录单调时间戳补偿真实流逝时间，重载后会话明确失效并通知用户，杜绝虚假时长累加。

---

## 2. 核心架构与同步实现

### 2.1 宿主根节点枚举与连接守卫
```ts
function focusRootsFor(host: FocusTimerHost): HTMLElement[] {
    if (host.focusTimerRoot?.isConnected === false) host.focusTimerRoot = undefined;
    return [...new Set([host.focusTimerRoot, host.dockElement, host.tabElement, host.quickDialogElement])]
        .filter((root): root is HTMLElement => root !== undefined && root.isConnected !== false);
}
```

### 2.2 多面板与多小条全局广播同步
```ts
function paintFocusRoots(host: FocusTimerHost, state: FocusTimerState): void {
    for (const root of focusRootsFor(host)) {
        root.querySelectorAll?.<HTMLElement>("[data-focus-timer]").forEach((panel) => paintFocusTimer(panel, state));
        root.querySelectorAll?.<HTMLElement>("[data-focus-mini-remaining]").forEach((remaining) => {
            remaining.textContent = focusTimeText(state.remainingSec);
        });
        root.querySelectorAll?.<HTMLElement>("[data-focus-mini-status]").forEach((status) => {
            status.textContent = focusStatusText(state, true);
            status.hidden = !status.textContent;
        });
        root.querySelectorAll?.<HTMLElement>("[data-focus-mini]").forEach((mini) => {
            mini.dataset.focusMiniState = focusMiniState(state);
        });
    }
}
```

---

## 3. 验收断言与守门测试清单

- 守门测试 1：`tests/focus-timer-accuracy.test.cjs`（单调时间戳计算、预设切换确认、多 surface 广播）；
- 守门测试 2：`tests/focus-lifecycle.test.cjs`（29 项生命周期全量断言，包含跨窗口隔离、休眠暂停、失焦保护、卸载清空与重载明确失效）；
- 纳入 `test:v18` 与全量质量链，保持 100% 绿灯。
