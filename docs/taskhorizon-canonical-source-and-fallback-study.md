# Task Horizon Canonical Source 与过期 Fallback 规范研究报告（T-1671，D-626）

本文档收敛小驴打卡与 Task Horizon（思源任务管理器）合作中的单一事实源边界、缓存生命周期、离线降级与用户可解释性研究结论。

---

## 一、 核心痛点与架构矛盾

1. **追加事实与物理删除的冲突**：
   - 小驴打卡是**不可变追加事实（Append-only facts）与墓碑保活体系**，任何已发生的打卡事实只能通过显式负向事件或带 `deletedAt` 的墓碑进行抵消或软删除；
   - Task Horizon 原生“打卡循环”支持用户随时反选复选框并直接从内部 `checkinHistory` 中**物理删除**该记录；
   - 若直接套用外部回写通道，Task Horizon 的反选取消无法在小驴中安全镜像，极易在两端产生幽灵数据或重复计数。

2. **多写入源并发竞争**：
   - 若用户将同一个小驴打卡项目（如“每日运动”）同时绑定给 Task Horizon 的普通复选框任务和 Task Horizon 的打卡循环，任务勾选与循环打卡将造成重复记账（双倍甚至多倍入账）。

---

## 二、 单一事实源原则（Canonical Source Invariant）

在 `src/features/taskhorizon-cooperation.ts` 中明确固化规则：
1. **单项单源独占**：
   - 每个小驴打卡项目在任意时刻只能绑定至多一种外部回写通道（`checkbox-task` 或 `checkin-history` 或 `none`）；
   - 若已配置为接收普通复选框任务完成，严禁再将其选作打卡循环同步目标；
   - 若已配置为打卡循环目标，严禁接收普通任务复选框回写。
2. **写权限责任归属**：
   - 绑定后，Task Horizon 负责派发带有显式 `occurredAt`、`unit` 与标准幂等键（`taskhorizon:<blockId>:<localDate>`）的事实，小驴打卡作为不可篡改的事实仓库负责落账、统计与墓碑去重。

---

## 三、 连接生命周期与用户可解释性矩阵

| 状态标识 | 触发条件 | 用户界面回显与可解释说明 | 图层展示策略 |
| --- | --- | --- | --- |
| `waiting` | 检测到 `window.siyuanCheckin` 存在，但 `isReady()` 为 false | “等待小驴打卡服务初始化就绪...” | 占位等待，不渲染脏数据 |
| `experimental-ready` | API v5 就绪，`calendar.read` 与 `events.record` 协商成功 | “小驴打卡服务已连接（实验性只读日历图层就绪）” | 正常渲染日历图层与完成状态 |
| `disconnected-fallback` | 未检测到小驴打卡插件，或插件已卸载/已释放 | “打卡插件未运行或服务已断开，日历图层已安全隐藏” | **物理隐藏图层，禁止展示过期缓存** |
| `incompatible-version` | 协议不符或 API 版本低于 5 | “打卡插件版本不兼容（要求 API v5 且支持 calendar.read）” | 隐藏图层并提示用户升级小驴打卡 |

---

## 四、 缓存 TTL 与过期严禁复活准则 (Stale-Forbidden Invariant)

1. **5 分钟安全 TTL 上限**：
   - Task Horizon 侧对 `getCalendarProjection()` 的日历数据缓存不得超过 5 分钟（`TASK_HORIZON_PROJECTION_TTL_MS = 300,000ms`）；
2. **事件驱动即时失效**：
   - 小驴打卡发生任何数据变异（打卡、撤销、归档、远端 Store 合并）时，会广播 `checkin:analytics-updated` 自增版本序列号；
   - 消费端监听到版本号变动时，必须立即丢弃旧投影缓存并重新请求最新数据；
3. **断开连接即刻清理缓存**：
   - 当小驴打卡进入卸载（`onunload`）或不可用状态时，消费端必须清空本地投影内存，**坚决杜绝把断开前的历史旧数据误充作实时数据展示给用户**。
