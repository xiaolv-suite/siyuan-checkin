# 来源卡四轴状态去重、动作词消歧与设置元数据搜索规范（T-1757 & T-1758，D-653）

## 1. 概述与主诉解决

在原有设置页面中：
1. **来源卡状态徽标混淆（T-1757）**：来源卡片将“未配置”、“已保存”、“待启用”、“运行中”、“无数据”、“错误”多个层级的概念混在一起展示，导致未启用的数据源显示出类似故障的警示状态，徽标堆叠杂乱；
2. **动作词模糊**：多个不同摄取机制的来源统一标注为“立即刷新”，掩盖了从远端拉取与从本地探测的巨大本质差异；
3. **设置搜索体验粗糙（T-1758）**：基于 DOM 行全文的文本遍历容易被大段解释长文污染，无法直接按字段元数据检索，且缺乏清晰的“分区 > 卡片 > 字段”路径指引。

本规范确立了**来源状态四轴正交解耦与专属动词模型（T-1757）**以及**基于字段元数据的精准搜索与路径定位系统（T-1758）**。

---

## 2. 来源状态四轴正交模型（T-1757）

每个第三方数据来源独立维护四轴正交状态槽位：

```
                    ┌── 配置态 (configState): unconfigured (未配置) | configured (已配置)
                    ├── 运行态 (runtimeState): disabled (已停用) | running (活跃运行) | idle (空闲等待)
来源状态四轴 ───────┼── 今日活动 (activityOutcome): has_records_today (今日有入账) | no_records_today (今日无数据)
                    └── 故障状态 (problemState): healthy (正常) | read_failed (读取失败) | write_failed (写入失败) | credential_invalid (密钥失效)
```

### 2.1 状态去重与首屏三行原则
- **未配置 ≠ 故障**：当 `hasKeyOrBinding: false` 且 `enabled: false` 时，`problemState` 严格判定为 `healthy`，绝不渲染黄色/红色报警；
- **首屏事实三行**：卡片首屏收敛为简洁事实三行（产生什么事实、写入哪个打卡项、何时触发），其余详细配置步骤与边界说明收入 `<details data-source-advanced>`；
- **专属动作动词消歧**：
  - **微信读书 (`weread`)**：`weread_pull`（立即拉取）
  - **思阅 (`sireader`)**：`sireader_read`（立即读取）
  - **思播 (`siplayer`)**：`siplayer_sample`（立即采样）
  - **健康收件箱 (`health`)**：`health_probe`（立即探测）
  - **叶归 LifeLog (`yeguif`)**：`yeguif_sync`（立即同步）
  - **笔记推导 (`notequery`)**：`notequery_derive`（立即推导）

---

## 3. 设置元数据精准搜索系统（T-1758）

### 3.1 搜索索引构建与打分机制
`searchSettingsRegistry` 消费 `T-1733` 注册表元数据（字段 Key、DOM 属性、卡片所属、影响范围、设计理由）：
- 字段名精确匹配（Score = 100）；
- 字段名包含（Score = 40）；
- DOM 属性命中（Score = 30）；
- 所属卡片命中（Score = 20）；
- 影响范围命中（Score = 15）；
- 结构化面包屑路径格式：`section > card > field`。

### 3.2 交互与定位保障
- 键盘操作优化：在搜索框按下 `Enter` 键时，焦点直接穿透并聚焦至目标设置项的可操作输入框或按钮；
- 保持既有输入法（IME）组合态保护与 RootContext 隔离机制。

---

## 4. 纯模型与测试契约

- 纯模型：`src/features/settings-search-and-source-layering.ts`；
- 契约测试：`tests/settings-search-and-source-layering.test.cjs`；
- 纳入 `test:v18`（94 项全量通过）。
