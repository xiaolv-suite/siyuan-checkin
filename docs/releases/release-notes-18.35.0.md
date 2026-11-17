# 小驴打卡 v18.35.0

「思源多维数据库自动化收集块属性自动注入与日记 LifeLog 深度升级」小版本发布：深度贯彻思源笔记 3.8.8+ 内核多维数据库自动化收集（Database Block Collection）机制，在打卡或批量同步向当日日记追加 LifeLog 段落时，自动调用 `/api/attr/setBlockAttrs` 为新段落块注入标准元数据属性（`custom-lv-checkin-item`, `custom-lv-checkin-val`, `custom-lv-checkin-date` 等），用户在思源中建立习惯数据库即可实现打卡记录自动汇入看板、画廊与日历视图；属性前缀严格对齐全生态 `custom-lv-checkin-*` 命名空间规范，旁路尽力而为安全降级不阻断主流程。主存储保持向前兼容，最低思源版本仍为 3.8.4。

## 核心更新

### 1. 宿主协同：思源多维数据库自动收集属性注入（Issue #39）
- **多维属性自动注入**：实时追加及一键批量同步日记 LifeLog 时，自动为对应段落块设置 `custom-lv-checkin-item`（习惯名称）、`custom-lv-checkin-item-id`（习惯ID）、`custom-lv-checkin-val`（打卡数值）、`custom-lv-checkin-date`（发生日期）、`custom-lv-checkin-unit` 与 `custom-lv-checkin-kind` 属性；
- **官方多维数据库开箱即用**：支持用户在思源中通过属性过滤规则零门槛搭建打卡多维表格、画廊或日历视图；
- **异常安全降级**：属性注入为异步旁路操作，遇内核异常自动静默捕获，绝不影响打卡主事务落盘。

## 升级与兼容说明

- **主存储向前兼容**：数据结构向前兼容，旧版本升级无需手动数据迁移；
- **全质量门禁全绿**：全量测试套件、v18 专项测试套件（53项）、移动端测试套件（10项）、生态契约套件与 CSS 卫生门禁全部通过。

- SHA-256：`bda5391bc6145eb08ca2bba487b031e5bdb10447e4ed21e5fe4f89aedd94f248`
