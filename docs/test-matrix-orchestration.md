# 测试编排、覆盖清单与视觉脚本发现性矩阵（T-1674，D-624）

本文档固化小驴打卡（`siyuan-checkin`）全量测试架构、分层编排模型、脚本调用映射与 Flaky 治理规范。

---

## 一、 五级测试分层架构 (5-Tier Test Architecture)

| 分层 | 覆盖目标 | 依赖环境 | 核心文件与脚本 | 质量门禁与准入 |
| --- | --- | --- | --- | --- |
| **Tier 1: 单元与规则纯模型** | 规则引擎、历法计算、模型归一化、算法饱和曲线、墓碑修剪 | 纯 Node.js (无时钟) | `model.test.cjs`, `rules.test.cjs`, `habit-score.test.cjs`, `date-keys.test.cjs`, `tombstone-lifecycle.test.cjs` | 100% 离线确定性，无隐式时钟，毫秒级运行 |
| **Tier 2: 协议与生态契约** | API v5、Task Horizon、Dock Tomato、微信读书、叶归 LifeLog、集成信封 | Node.js + Mock 桩 | `api-v5.test.cjs`, `task-horizon-contract.test.cjs`, `dock-tomato-bridge.test.cjs`, `source-lifecycle-matrix.test.cjs` | 严格校验入参边界、取消信号与防伪造纪律 |
| **Tier 3: 表面会话与多 Root** | SurfaceContext 全量恢复、多 Root 隔离、滚动复合键、无障碍焦点与键盘流 | Node.js + VM 沙箱 | `surface-context-restore.test.cjs`, `multi-root-today.test.cjs`, `cross-root-navigation.test.cjs`, `a11y-keyboard-focus.test.cjs` | 验证多表面状态互不串台、无障碍属性完备 |
| **Tier 4: 规模与性能基准** | 1k/10k/100k 冷启动、多桶加载、弱引用索引查询、内存占用 | Node.js (可选 --expose-gc) | `cold-start-baseline.test.cjs`, `performance.test.cjs`, `batch-lifecycle-performance.test.cjs` | 10k 冷启动 < 200ms，索引查找 O(1) < 2ms |
| **Tier 5: 真实浏览器与视觉走查** | 双主题 (明/暗)、多视口 (320px~1280px)、触摸手势、高对比度与截断检查 | Chromium (Playwright) | `visual-qa.cjs`, `width-walkthrough.cjs`, `surface-session-browser.cjs`, `avatar-editor-browser.cjs`, `a11y-visual-extended.test.cjs` | 真实渲染 DOM，0 页面级横向溢出，对比度 ≥ 4.5:1 |

---

## 二、 测试脚本与 NPM 命令发现性映射

### 1. 核心质量链与门禁命令
- `pnpm run check`: 运行 TypeScript `tsc --noEmit` 全仓类型检查；
- `pnpm test`: 运行核心基础单元测试与模型守门主链；
- `pnpm run test:ui`: 运行界面渲染、无障碍与表面会话测试；
- `pnpm run test:mobile`: 运行移动端几何结构、触控手势与旋转测试；
- `pnpm run test:ecosystem`: 运行外部生态与第三方集成契约测试；
- `pnpm run test:extended`: 运行扩展索引、事务审计与 CSS 卫生检查；
- `pnpm run test:v18`: 运行 v18 阶段全部 69 项增量专项测试（含墓碑生命周期、SurfaceContext 恢复、冷启动基线、前端兼容矩阵、Dock Tomato 演练等）；
- `pnpm run test:quality`: 生产发布前全量门禁流水线（环境预检 → 类型检查 → 生产构建 → 全部测试链 → 性能基准 → 资产签名与回滚演练）。

### 2. 视觉与浏览器专项走查命令（T-1674 显式化）
- `pnpm run test:visual`: 运行 `node tests/visual-qa.cjs`，自动走查双主题与各页面渲染快照；
- `pnpm run test:walkthrough`: 运行 `node tests/width-walkthrough.cjs`，覆盖 320/360/390/430/640/720/980/1280px 宽度走查；
- `pnpm run test:browser:extended`: 运行第一成旅程、智能体建议点击、模板组合包选择、设置搜索、敌意内容防御与提醒密度等 6 大深度浏览器场景；
- `pnpm run benchmark:cold-start`: 运行 `scripts/cold-start-benchmark.cjs` 输出 1k/10k/100k 详细性能分析工件至 `.artifacts/cold-start-benchmark.json`。

---

## 三、 测试清单完整性守护机制 (Zero Orphan Invariant)

在 `tests/test-suite-coverage.test.cjs` 中建立自动化审计约束：
1. **测试文件全纳管**：目录下全部 338+ 项 `tests/*.test.cjs` 必须被 `package.json` 的某一测试脚本显式包含，禁止存在未被 CI 或本地运行的遗留测试；
2. **Harness 脚本全清点**：全部 26 项非 `.test.cjs` 辅助脚本（`.cjs`）必须满足以下三者之一：
   - 由 `package.json` 脚本直接驱动；
   - 由上层自动化测试模块（如 `render-boundary.test.cjs`, `portable-paths.test.cjs`, `width-walkthrough.cjs`）显式导入调用；
   - 在已登记的浏览器走查套件白名单中显式声明。
3. **退役治理**：任何废弃测试必须显式登记在 `retired` 集合并注明原因，禁止静默删除或绕过断言。

---

## 四、 Flaky 假失败与时钟竞态治理准则

1. **绝对禁止隐式时钟**：模型计算与结算逻辑一律由外部注入 `currentDate` 或 `occurredAt`，严格受 `tests/architecture-boundaries.test.cjs` 的 `CLOCK_FREE_MODULES` 守门；
2. **防抖等待规范**：对于带物理防抖（如 250ms 防连击）的用户动作，测试必须显式等待防抖时钟（`setTimeout` 或 `sleep`），不得依靠脆弱的无等待连续触发；
3. **DOM 与事件生命周期**：异步事件测试统一使用 `setImmediate` 或 `flushPromises` 排空微任务，绝不依赖随意写死的硬等待毫秒数；
4. **沙箱隔离**：测试环境模拟宿主时，必须完整提供规范化桩（如 `fetchSyncPost`、`saveData`、`loadData`、`showMessage`），避免抛出未捕获 `TypeError`。
