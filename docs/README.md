# 小驴打卡（`siyuan-checkin`）开发与技术文档全景索引

本文档是小驴打卡技术文档库的统一入口。为了方便查阅与维护，文档分为「核心活跃规范」、「生态联动契约」、「质量与运维演练」以及「版本说明与历史归档」四大类别。

---

## 一、 核心活跃规范（Active Standards）

本类文档为插件的核心业务领域、存储事务、身份模型与设计系统，处于持续维护状态：

- **系统架构与模块拓扑**：[`architecture.md`](architecture.md)
  系统顶层架构、模块职责切分、数据流向与多 Root 上下文代理模型。
- **记录身份与多端合并台账**：[`identity-and-merge.md`](identity-and-merge.md)
  事件稳定 ID、externalRef 幂等凭据、跨窗口快进合并（Fast-Forward Merge）与冲突消除策略。
- **导入导出格式总览**：[`export-formats.md`](export-formats.md)
  JSON 主档、多桶 BackupEnvelope（v1）、CSV、Loop Habit Tracker 与 Obsidian H21 格式规范。
- **公开接入协议 API v5**：[`api-v5.md`](api-v5.md)
  `window.siyuanCheckin` 全套能力协商、只读快照、原子批量写入与安全边界。
- **低压力呈现基线**：[`low-pressure-baseline.md`](low-pressure-baseline.md)
  拒绝内疚感与社交焦虑的心理学基线：弹性跳过、暂守状态、中性统计与 Sigmoid 成长曲线。
- **思源版本兼容性矩阵**：[`siyuan-compatibility.md`](siyuan-compatibility.md)
  思源内核最低版本（v3.8.4）、推荐版本（v3.8.8+）及桌面/移动/分屏适配记录。
- **数据隐私与卸载策略**：[`data-privacy-and-uninstall.md`](data-privacy-and-uninstall.md)
  无云端依赖、本地脱敏、敏感字段审计与插件卸载清理契约。

---

## 二、 外部联动与生态契约（Ecosystem Linkage）

本类文档定义与思源笔记内部其他插件或生态模块的协议契约：

- **跨插件联邦集成契约**：[`ecosystem-integration.md`](ecosystem-integration.md)
  Epoch 6 统一事件信封广播、四别名首实例独占（First-Instance-Wins）挂载与雷切工作台小组件协同。
- **叶归 LifeLog 深度联动**：[`lifelog-integration.md`](lifelog-integration.md)
  打卡实时以 LifeLog 规范追加到当日日记、撤销打卡联动物理删除日记段落、一键批量同步。
- **微信读书阅读接入**：[`weread-integration.md`](weread-integration.md)
  三链路独立状态回显（阅读时长、完本书籍、划线笔记）与一键创建绑定。
- **笔记推导与块查询**：[`note-query-integration.md`](note-query-integration.md)
  基于只读 SQL 的日记内容推导打卡事实与沙箱试算。
- **健康收件箱接入**：[`health-shortcuts-integration.md`](health-shortcuts-integration.md)
  快捷指令（Shortcuts）步数与体重指标接入与双向映射。
- **Task Horizon 合作契约**：[`checkin-taskhorizon-cooperation.md`](checkin-taskhorizon-cooperation.md)
  日历投影、普通任务回写与 API v5 提供端规范。

---

## 三、 质量保障、运维与工具链（Ops & QA）

本类文档定义代码质量守门、自动化测试、发版与回滚标准：

- **仓库运维与发布说明**：[`github-repository-ops.md`](github-repository-ops.md)
  GitHub Releases 流程、自动化资产打包与集市单调递增合规。
- **版本回滚与演练规程**：[`release-rollback.md`](release-rollback.md)
  四步回滚演练、资产损坏自愈与历史快照提取。
- **工具链兼容性指南**：[`toolchain-compatibility.md`](toolchain-compatibility.md)
  Node.js (>=20.19.0) 与 pnpm (12.5.1) 环境锁定要求。
- **真机验收与冒烟清单**：[`integration-smoke-checklist.md`](integration-smoke-checklist.md)
  真实客户端多表面、软键盘、安全区与物理动效验收清单。

---

## 四、 版本发布记录与历史归档（Releases & Archives）

- **最新发版说明目录**：[`releases/`](releases/)
  包含从 v12.0.0 到当前最新版本的官方完整发布说明与 SHA-256 签名。
- **历史路线图与设计归档**：[`archive/`](archive/)
  早期阶段路线图（v1.0～v2.0、2026 早期设计提案）的历史追溯材料。
