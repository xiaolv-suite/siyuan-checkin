# LifeLog 类型聚合、日历徽标投影与段落修订检测报告（T-1542, T-1543, T-1544，D-662）

## 1. 概述与核心研究背景

本专项聚焦轻迹 QingTrail / 叶归 LifeLog 在回顾分析、日历视图与文本修订重摄取中的三项数据表现与完整性规范：
1. **类型筛选与区间聚合（T-1542）**：Marker 格式支持多语言别名归一（如 `work` 与 `工作`），在复盘区间内按类型统计分钟数与总占比；
2. **日历 LifeLog 徽标叠加与视觉冗余评估（T-1543）**：在月历和周历上呈现每日生活日志统计时，评估其与习惯完成进度环（Completion Rings）的视觉冲突；
3. **段落修订检测与事实不可变红线（T-1544）**：用户在日记正文中修改了段落备注或时长时，如何在不破坏事件不可变性（Append-Only）的前提下完成重结算。

---

## 2. 类型筛选与区间聚合模型（T-1542）

- `filterAndAggregateLifelogEntries`：
  - 自动识别别名并映射至规范类型（Canonical Type）；
  - 支持筛选特定类型集、时长下限（`minMinutes`）与起止日期半开区间；
  - 输出规范化类型占比分解（`typeBreakdown`）。

---

## 3. 日历徽标与视觉冗余降级防线（T-1543）

- **视觉冲突评估**：当用户在某一天的习惯完成率超过 80% 或拥有完整的紫罗兰圆环时，过大的文字徽标（如 `4h 30m`）会遮挡日期数字或产生强烈视觉干扰；
- **自适应降级模式（Adaptive Visual Mode）**：
  - `completionRate > 0.8`：降级为紧凑微圆点指示器（`dot_indicator`），表明当日有生活日志，悬停展示详情；
  - `completionRate <= 0.8`：允许展示文字徽标（`badge_text`）；
  - `count === 0`：不展示任何标记（`none`）。

---

## 4. 段落修订与事实不可变性决策（T-1544）

```
[用户在日记中修改原段落: "写作 60m" ──> "写作 60m 并完成第一章"]
                              │
                              ▼
           [evaluateParagraphRevisionSettlement]
                              │
            ┌─────────────────┴─────────────────┐
    [指纹未变 (相同哈希)]                [指纹变动 (哈希不匹配)]
            ▼                                   ▼
      retain_existing                     tombstone_and_append
      (保持原事件不变)                 1. 为旧事件生成注销墓碑 (Tombstone)
                                      2. 追加携带新指纹的新事实事件
```

- **单向不可变红线**：打卡系统对笔记正文单向只读，绝不反向覆写；
- 重复扫描同一段落时，通过 `computeParagraphFingerprint` 计算内容哈希，若内容改动，必须通过**“注销旧事件 + 追加新事件”**的方式更新，坚决禁止原地篡改数据库历史记录。

---

## 5. 纯模型与测试契约

- 纯模型：`src/features/lifelog-calendar-and-revision-projection.ts`；
- 契约测试：`tests/lifelog-calendar-and-revision-projection.test.cjs`；
- 纳入 `test:v18`（103 项全量通过）。
