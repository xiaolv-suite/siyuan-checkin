# 小驴打卡 v18.33.0

「测试套件全链路深度自愈与质量守门加固」小版本发布：深度排查并修复测试套件中的三处隐蔽缺陷，包括 `lifelog-timeline` 测试在沙箱中缺失 `../shared` 依赖注入的异常中断、`today-context-menu` 测试事件派发夹具中缺少 `stopPropagation` 造成的运行时 TypeError、以及 `report-deviations` 测试中陈旧的来源白名单字面断言与现行 `REPORT_SOURCE_VALUES` 单一来源常量的契约对齐，全量 UI 与自动化测试链恢复 100% 畅通通过。主存储保持向前兼容，最低思源版本仍为 3.8.4。

## 核心更新

### 1. 质量工程：测试套件沙箱依赖与事件模型加固
- **LifeLog 时间轴投影测试依赖补齐**：在 `tests/lifelog-timeline.test.cjs` 补齐 `../shared` 的 `escapeHtml` 依赖注入，彻底根治沙箱加载模块失败；
- **今日上下文菜单事件模型补齐**：在 `tests/today-context-menu.test.cjs` mock 事件对象中补齐 `stopPropagation()` 声明，确保键盘 Escape 防击穿逻辑在测试中安全运行；
- **报告来源偏好断言契约对齐**：在 `tests/report-deviations.test.cjs` 同步最新 `REPORT_SOURCE_VALUES` 常量定义，确保测试断言与生产白名单严格同源。

## 升级与兼容说明

- **主存储向前兼容**：数据结构向前兼容，旧版本升级无需手动数据迁移；
- **全质量门禁全绿**：全量测试套件、v18 专项测试套件（53项）、移动端测试套件（10项）、生态契约套件与 CSS 卫生门禁全部通过。

- SHA-256：`87730f7fa48b1a2145188931f7de5fc3a76350a81629c47a40e81c09a7358bac`
