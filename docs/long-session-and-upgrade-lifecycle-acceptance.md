# 长会话与升级生命周期验收报告（T-1651 / D-642）

> **研究与门禁性质**：插件长生命周期运行、热重载（Plugin Reload）、多表面销毁、前后台切换及版本平滑升级的**生命周期总验收报告**。
> 汇编 T-1664（异步生命周期总审计）、T-1672（Dock Tomato 失败演练）、T-1668（增量失效决策）与 T-1621/T-1663（SurfaceContext 全量恢复）的工程规约。

---

## 一、生命周期销毁与零泄漏规约（Zero Leak Invariant）

在思源笔记桌面端长达数周不关机、或用户频繁切换页签/停用重载插件的场景下，小驴打卡确立严格的卸载与销毁标准：

1. **`onunload` 彻底注销（Teardown Budget & Cleanup）**：
   - **定时器清理**：微信读书 5s 延迟补拉 timer、宿主主题跟随 50ms 防抖 timer、统一来源调度器 timer、每日提醒心跳 timer 必须在卸载入口处 100% `clearTimeout` / `clearInterval`；
   - **动画帧清理**：合并渲染的 `requestAnimationFrame` 句柄在卸载时立即取消并重置为 0，防止已卸载实例在下一帧错误执行；
   - **事件监听解绑**：焦点计时器生命周期监听器（`visibilitychange`, `pagehide`, `pageshow`, `blur`）、Dock Tomato 桥梁监听、以及 Today 拖拽委托监听全部移除；
   - **外部桥梁反注册**：Dock Tomato 聚焦适配器在 `onunload` 时通过 `unregisterFocusAdapter` 物理注销，绝对不留下僵尸回调。
2. **多表面与 Detached Root 隔离**：
   - 表面关闭或页签销毁时，立即触发 `releaseRootContext(root)`，清理 `pendingFocusByRoot`、滚动复合键（`scrollTops`）与搜索会话；
   - 任何后台异步回调返回时，强制执行 `root.isConnected` 检查；若根节点已从 DOM 树脱离（detached），坚决拒绝渲染并安全释放内存。

---

## 二、配置代际与迟到响应防御（Configuration Generation Guard）

1. **代际计数器自增**：
   - 每次用户保存偏好设置、停用外部来源、或插件重载时，来源代际计数器（`sourceGenerations`）自增；
2. **写前动态复核**：
   - 无论微信读书、叶归 LifeLog、健康收件箱还是思播，在 `enqueueMutation` 锁内执行持久化前，必须复核发起请求时的代际号与当前全局代际号；
   - 若代际号不匹配，判定为“迟到响应”，记录可诊断日志并直接丢弃，严禁把历史旧目标或已停用配置写入主 Store。

---

## 三、表单草稿与会话态平滑恢复（Draft Resilience Across LifeCycle）

1. **输入即快照**：
   - 编辑器（`formDraft`）与事项表单（`occasionDraft`）在用户键入时实时捕获 dirty 状态快照；
   - 遇到后台数据变更或协同重绘时，系统自动挂起（`skip-editor-draft`），或者在重绑阶段无损将快照值回填至新 DOM 元素，杜绝用户输入被意外抹平；
2. **条目级滚动复合键（getScrollTopKey）**：
   - 采用 `page:itemId` 复合键记忆滚动位置；
   - 用户在 Today 与特定项目之间切换时，滚动位置彼此独立隔离，消除滚动高度污染。

---

## 四、主 Store 数据向前兼容（Schema Evolution & Upgrade Safety）

1. **数据模型版本升级原则**：
   - 历史版本（v1, v2）在加载时通过 `normalizeStore` 纯函数执行无损规范化升级至 v3，无需用户手动迁移；
   - 未知字段（如未来版本新增属性）在读入与导出时严格保留，不被粗暴抹除；
2. **多桶恢复点双保险**：
   - 每次关键写操作前均自动生成快照恢复点；
   - 恢复操作在锁内执行，若校验失败或写入异常，立即执行原子级内存与磁盘双重回滚。

---

## 五、门禁与守门

- 异步生命周期审计：`tests/async-lifecycle-audit.test.cjs`（T-1664，零泄漏守门）；
- 会话所有权演练：`tests/dock-tomato-lifecycle-drills.test.cjs`（T-1672，9态状态机守门）；
- 跨表面会话恢复：`tests/surface-context-restore.test.cjs`（T-1621/T-1663，复合键与隔离守门）；
- 统一纳入 `package.json` 的 `test:v18` 与 `test:quality` 持续集成。
