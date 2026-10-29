# 渲染块 Today 时段统计的本地日期与时区契约规范（T-1802 收官）

## 1. 背景与核心问题

思源笔记嵌入式渲染块（Checkin Block）在 Today 视图中支持呈现习惯打卡的“早/午/晚”时段分布统计（`R-17.3`），辅助用户了解一天内在不同时段的执行节奏。

在跨时区旅行、跨设备同步以及外部第三方数据导入（如微信读书、思阅、API 等）场景中，事件的 `occurredAt` 时间戳可能具有不同的表示形态（带时区偏移的 ISO 字符串如 `+08:00`，或 UTC 形式如 `Z`）。如果系统盲目采用运行宿主环境当前的 `date.getHours()` 换算，会导致以下体验问题：
1. **时段记忆漂移**：用户在东八区北京时间早上 8:30 完成跑步并记录（`+08:00`），出差至西五区纽约后打开笔记本，若按纽约时区重新计算，该事件变成了前一晚 19:30，时段统计从“早”漂移到了“晚”，严重违背用户真实生活事实；
2. **跨日边界错位**：换算后的本地时刻与打卡落盘的 `localDate` 日期脱节，导致时段统计与当日事实不一致；
3. **单条记录视觉噪音**：对于一天只打卡一次的项目，显示“早 1 · 午 0 · 晚 0”增加了视觉认知负担，缺乏实际价值。

为此，本规范正式确立 **T-1802 渲染块 Today 时段统计的本地日期与时区换算契约**。

---

## 2. 三阶时区换算体系（getEventLocalHour）

时段归属计算的核心纯函数为 `getEventLocalHour(event, timeZone?)`，遵循三阶确定性决策：

```ts
export function getEventLocalHour(event: {occurredAt: string}, timeZone?: string): number {
    if (!event?.occurredAt) return 0;
    const match = /T(\d{2}):\d{2}/.exec(event.occurredAt);
    if (match && !timeZone && /(?:[+-]\d{2}(?::?\d{2})?|Z)$/.test(event.occurredAt) && !event.occurredAt.endsWith("Z")) {
        return Number(match[1]);
    }
    const date = new Date(event.occurredAt);
    if (!Number.isFinite(date.getTime())) return 0;
    if (timeZone) {
        try {
            const formatted = new Intl.DateTimeFormat("en-US", {timeZone, hour: "numeric", hourCycle: "h23"}).format(date);
            return Number(formatted) || 0;
        } catch {
            // fallback
        }
    }
    return date.getHours();
}
```

### 2.1 第一阶：字面偏移优先（Literal Offset Preservation）
- **触发条件**：`occurredAt` 包含显式非零时区偏移（例如 `+08:00`、`-05:00`、`+05:30` 等）且调用方未指定全局投影时区；
- **计算逻辑**：直接提取 ISO 字符串中 `T(\d{2}):\d{2}` 的字面小时数；
- **业务价值**：用户在何处记录，就忠实呈现记录发生时的当地钟点，跨时区漫游时绝不破坏生活事实记忆。

### 2.2 第二阶：目标投影时区换算（Target TimeZone Projection）
- **触发条件**：调用方或渲染块配置提供了显式 `timeZone` 参数（如 `"Asia/Shanghai"`、`"America/New_York"`）；
- **计算逻辑**：通过 `Intl.DateTimeFormat` 针对目标时区执行标准物理换算；
- **业务价值**：支持团队协同或用户指定固定时区汇总打卡分布的需求。

### 2.3 第三阶：宿主本地环境回退（Host Local Fallback）
- **触发条件**：事件时间戳为纯 UTC 格式（`Z` 结尾）且未指定目标时区；
- **计算逻辑**：通过 `new Date(event.occurredAt).getHours()` 换算为当前宿主本地时区小时数；
- **业务价值**：保证历史兼容性与零配置开箱即用。

---

## 3. 时段划分与单条降噪机制

### 3.1 时段划分标准
- **早（Morning）**：$0 \le \text{hour} < 12$（00:00 ~ 11:59）；
- **午（Afternoon）**：$12 \le \text{hour} < 18$（12:00 ~ 17:59）；
- **晚（Evening）**：$18 \le \text{hour} \le 23$（18:00 ~ 23:59）。

### 3.2 降噪门禁（Noise Gating）
- **过滤条件**：当日有效记录数（排除 `isSkipEvent(event) === true` 的请假记录）小于 2 条时，`buildTodaySlotCounts` 明确返回 `undefined`；
- **视觉收益**：仅在项目在一天内发生多次执行（如多次喝水、多次番茄专注、多段阅读）时才展示时段卡片，彻底消除单次打卡的视觉噪点。

### 3.3 无障碍与界面呈现
- HTML 结构包含规范的 ARIA 读屏描述：
```html
<span class="lc-checkin__renderblock-today-slots" aria-label="时段分布：早 1 · 午 2 · 晚 1">
    早 1 · 午 2 · 晚 1
</span>
```

---

## 4. 门禁验证与工程落地

- **专项测试**：`tests/checkin-block-timezone-slot.test.cjs` 固化了字面时刻提取、Intl 时区换算、早午晚边界划分、单条降噪与 HTML ARIA 属性四大验证；
- **测试覆盖**：纳入 `test:v18`（106 项通过）及全量 `test:quality` 门禁；
- **决策编号**：正式归档记录为 **D-666**。
