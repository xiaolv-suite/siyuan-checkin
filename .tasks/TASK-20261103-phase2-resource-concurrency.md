# [TASK-20261103-phase2-resource-concurrency] 小驴打卡 · 第二阶段：系统资源与并发加固落地工单

- **任务状态**: `completed`
- **目标插件**: `小驴打卡 (siyuan-checkin)`
- **核心库源**: `src/libs/lv-notice-kit.ts` (或 `src/render/lv-notice-kit.ts`)，已升级至 Protocol v1.1.0 标准
- **标准协议**: Epoch 7 Phase 2 · 资源节约与并发排队

---

## 一、 第二阶段核心改造目标

1. **消除定时器风暴 (lvTicker)**：
   - 彻底拔除本插件内原本散乱的 `setInterval`；
   - 接入统一后台主时钟，由单例主时钟按周期或每分钟统一对齐触发；
   - 思源窗口最小化时自动享受 60 秒降频节电（Low Power Mode），降低 75% CPU 唤醒耗电；
   - 接入 `lvTicker.onDateCross`，零点精准触发跨日，不再自行反复轮询算日期。
2. **消除内核写锁死 (withDocLock)**：
   - 思源内核文档写入是非线程安全的，并发写入会抛出 `document is locked`；
   - 向思源文档（特别是当天同一篇 Daily Note 或大纲）执行 `appendBlock` / `putFile` 等异步写操作时，使用 `withDocLock(docId, async () => { ... })` 排队串行执行。
3. **统一 Esc 键浮层栈 (lvSurfaceStack)**：
   - 菜单、抽屉、自定义弹窗打开时压栈 `lvSurfaceStack.push({ id, dismiss })`；
   - 捕获阶段拦截 Esc，只关栈顶，绝不穿透误关底层窗口。

---

## 二、 本插件专属改造重点

1. **拔除零散定时器 (消灭耗电)**：将 src/index.ts 中的 siplayerTimer (15s)、healthInboxTimer、wereadTimer 改为通过 lvTicker.subscribe("siyuan-checkin", ...) 订阅主时钟；
2. **零点精准跨日**：接入 lvTicker.onDateCross("siyuan-checkin", (today) => { ... })，跨日时自动重置今日完成度并派发提醒，不再自行计算日期跳变；
3. **Daily Note 内核防锁死**：在向今日日记文档写入打卡记录时，调用 withDocLock(this.diaryBoundDocId, async () => { ... }) 排队串行写入。

---

## 三、 质量门禁与验收标准

1. **类型检查**：运行 `pnpm run check` 或 `tsc --noEmit`，确保 0 报错；
2. **测试门禁**：运行 `pnpm test` 确保全量测试 100% 通过；
3. **任务状态回写**：完成后将本文首行 `- **任务状态**: `pending`` 改为 `completed`；
4. **严格本地提交**：使用 Conventional Commit 规范（如 `feat(core): integrate lvTicker and withDocLock for phase 2 resource hardening`），**严禁 git push**。
