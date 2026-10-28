# LifeLog 多项目映射与项目级时长结算优化报告（T-1614，D-661）

## 1. 概述与核心梳理目标

用户反馈叶归 LifeLog 存在以下关键体验与数据治理疑点：
1. **映射容量静默截断**：`normalizeYeguifMappings(value, max = 50)` 会在超过 50 条时直接静默切除第 51 条及以后的规则，用户毫无感知；
2. **多项目结算归集与有效性**：一个 LifeLog 记录的“活动名称”（如“跑步”、“拉伸”）需要精准映射到对应的小驴打卡习惯，存在重复来源活动、目标项被归档、非分钟单位等脏数据风险；
3. **时间轴时刻被轮询时刻污染**：叶归入账事件的 `occurredAt` 过去直接取定时器轮询时刻（如中午 12:05），导致早晨 08:30 跑步的记录在时间轴上跳跃到中午；
4. **历史事件不可变性**：映射规则修改后，严禁静默回溯修改或重算过去已落盘的事项与事件。

---

## 2. 映射集合审核与容量治理模型

### 2.1 容量上限与透明告警
- 将映射容量硬上限扩展至 **200 条**（`YEGUIF_MAPPING_CAPACITY_LIMIT = 200`）；
- 超过容量时，`auditYeguifMappingCollection` 显式标定 `isOverCapacity: true`，在界面给出透明超限告警，**绝对禁止静默截断**。

### 2.2 五大映射校验状态机
每条规则在保存与摄取前，均经状态机分类：
- `valid`：活动名唯一、目标打卡项存在且活跃、单位为“分钟”；
- `duplicate_source`：同一源活动名被配置了多条冲突规则，予以拦截并提示用户去重；
- `target_missing`：目标打卡项目不存在或已被删除；
- `target_archived`：目标打卡项目已归档；
- `unit_incompatible`：目标打卡项目单位不兼容（如单位为“页”或“次”，而 LifeLog 产出为时间）。

### 2.3 多对一映射规则（Multi-to-One）
- 允许多个不同的源活动（如“晨跑”与“夜跑”）映射到同一个小驴打卡项目（如“户外跑步”）；
- 每次结算产出携带独立唯一的 `externalRef`（格式：`yeguif:blockId:activityName`），天然实现幂等去重。

---

## 3. 双轨时间戳解耦模型

```
[源文档记录: 08:30 跑步 30 分钟] ───────────────> sourceStartMinute: "08:30" (真实活动时刻)
                                                        │
[后台定时器: 12:05 触发扫描] ──> ingestedAt: "12:05"      │
                                                        ▼
                        [resolveLifelogTimelineDisplayMoment]
                                                        │
                                                        ▼
                         时间轴排序与展示优先使用真实活动时刻 08:30!
```

- `resolveLifelogTimelineDisplayMoment` 优先消费记录本身的起始分钟（`sourceStartMinute`），即使后台拉取延迟，时间轴仍按早晨 08:30 准确锚定，彻底解决时刻被轮询时间污染的问题；
- 当源记录缺失明确起始时刻时，平滑回落至摄取时刻 `ingestedAt`。

---

## 4. 纯模型与测试契约

- 纯模型：`src/features/lifelog-settlement-governance.ts`；
- 契约测试：`tests/lifelog-settlement-governance.test.cjs`；
- 纳入 `test:v18`（102 项全量通过）。
