# 小驴打卡 v18.28.0

「全功能 E2E 真实内核走查、快进合并排雷与回顾渲染安全兜底」小版本发布：使用独立隔离的思源真实内核环境与 Google Chrome 浏览器执行全功能全链路端到端走查（覆盖 Today、Editor、Review、Insights、Settings、Occasions、Focus、LifeLog 以及全部外部联动）；排查并修复双窗口同步中纯快进合并阶段被误判为版本冲突引起的写放大与多余审计日志缺陷；排查并彻底根治 Review 回顾页执行建议决策时因快照缺失抛出 `TypeError: Cannot read properties of undefined (reading 'split')` 运行时崩溃；浏览器测试链路全面剔除 Microsoft Edge，锁定纯净 Google Chrome 与 Playwright Chromium 执行。主存储保持向前兼容，最低思源版本仍为 3.8.4。

## 核心更新

### 1. 架构与同步：跨窗口快进合并（Fast-Forward Merge）伪冲突排雷（T-1921，D-572）
- **真冲突精准识别**：重构 `enqueueMutation` 锁内合并逻辑，引入 `hasLocalChanges` 双向校验；当接收方本地无未提交修改时，判定为纯快进同步，不再向事实审计台账追加伪冲突日志，彻底消除双窗口同步时的多余写放大与磁盘 IO 浪费。

### 2. 交互与容错：回顾渲染分析快照安全兜底修复崩溃（T-1922，D-573）
- **根治未定义时间键切分异常**：排查并彻底消除了 `renderReview` 在 `analyticsSnapshot` 为空时错误回退到 `(root as unknown as AnalyticsSnapshot)` 触发的 `asOf.split("-")` 运行时报错；自动以当前日期生成实时有效分析快照，确保建议采纳后界面即时重绘流畅无感。

### 3. 工程与工具链：E2E 与浏览器走查环境 Google Chrome 纯净化锁定（T-1923，D-574）
- **彻底禁用 Edge**：所有 Playwright E2E 配置、性能测试、宽度走查、恶意代码测试与视觉测试，强制仅使用系统安装的 Google Chrome 或 Playwright Chromium 实例，全面剔除对 Edge 的任何调用。

## 升级与兼容说明

- **主存储向前兼容**：数据结构向前兼容，旧版本升级无需手动数据迁移；
- **全质量门禁全绿**：全量测试套件、v18 专项测试套件（53项）、真实思源内核 E2E 驱动套件、CSS 卫生门禁（0死类，严格维持在680KiB预算内）全部通过。

- SHA-256：`6046c34addd7193b8af0b74dcd98ccbdf1a36a3f0c3afdceb3ea65393780fa57`
