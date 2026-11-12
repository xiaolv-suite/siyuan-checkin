# 事项与提醒动作的多桶备份迁移与 ICS 导出研究报告（T-1726 / D-634）

> **研究背景**：承接 T-1647 备份治理专项与事项扩展需求。系统厘清主档 JSON 与多桶备份 Envelope 的边界，明确 `checkin-occasion-store` 与 `checkin-reminder-actions` 两桶的勾选、合并策略与回滚机制；同时评估 RFC 5545 iCalendar (ICS) 单向日历导出的可行性、农历损耗降级与双向同步红线。

---

## 一、主档 JSON 与多桶备份 Envelope 边界厘清

1. **不可回避的事实**：
   - 现有的“单文件主档导出”（`checkin-store`）只包含习惯项目定义（`items`）与打卡日志（`events`）；
   - 日期事项（`occasions`）、提醒动作偏好（`reminderUserActions`）、自定义图标与日记模板存储在独立的辅助存储桶中；
   - **宣传与文档禁则**：绝不能把单档 `checkin-store` 包装宣传为“包含全部事项和提醒的完整备份”，必须向用户明确说明主档与全量多桶备份的边界。
2. **多桶备份 Envelope（BackupEnvelope）中的两桶治理**：
   - **事项桶（`checkin-occasion-store`）**：
     - 分类：`mutation`（增删改型）；
     - 包含数据：`version`、`occasions`（全部事项实体）与 `tombstones`（删除墓碑）；
     - 敏感性：非敏感（不含个人 Token、路径或系统 Key），默认随备份打包；
     - 导入策略：支持覆盖（`overwrite`）或合并（`merge`），合并时基于 `updatedAt` 胜者决断并执行墓碑压制；
     - 回滚机制：导入前自动拍摄内存快照，任一桶失败即刻全量原子回滚。
   - **提醒动作桶（`checkin-reminder-actions`）**：
     - 分类：`overwrite`（覆盖/偏好型）；
     - 包含数据：按 `(id, action, at)` 记录的提醒跳过（skip）、推迟（snooze）与恢复（restore）历史；
     - 敏感性：`sensitive: true`（涉及用户微观生活习惯轨迹，默认遮罩或需用户显式确认 opt-in）；
     - 导入策略：默认采用 `merge`（基于三元组身份取并集去重，保留各端时间戳最新动作）。

---

## 二、RFC 5545 iCalendar (ICS) 导出可行性与损耗评估

很多用户希望将生日、纪念日、信用卡还款与定期缴费同步到系统日历（如 Apple Calendar、Google Calendar 或 Outlook）。

### 1. 字段映射标准（RFC 5545 兼容）

| 事项字段 | iCalendar (ICS) 属性 | 映射规则与示例 |
| :--- | :--- | :--- |
| `id` | `UID` | `occasion-<id>@siyuan-checkin`，保证跨端全局唯一与幂等 |
| `name` | `SUMMARY` | 文本转义（逗号、分号、反斜杠按 §3.3.11 转义） |
| `note` | `DESCRIPTION` | 备注说明转义 |
| `date` | `DTSTART;VALUE=DATE` | 全天事件，格式 `YYYYMMDD`（如 `20261015`） |
| `recurrence: "annual"` | `RRULE:FREQ=YEARLY` | 公历年度重复 |
| `annualSubtype: "nthweek"` | `RRULE:FREQ=YEARLY;BYMONTH=...;BYDAY=...` | 如每年 5 月第 2 个周日（母亲节）：`BYMONTH=5;BYDAY=2SU` |
| `recurrence: "monthly"` | `RRULE:FREQ=MONTHLY` | 每月固定日（`BYMONTHDAY=-1` 表示月末） |
| `recurrence: "weekly"` | `RRULE:FREQ=WEEKLY;BYDAY=...` | 每周固定星期几 |
| `recurrence: "interval"` | `RRULE:FREQ=...;INTERVAL=N` | 间隔循环（天/月/年） |

### 2. 农历固有损耗（Lunar Calendar Limitation）
- **客观物理限制**：RFC 5545 规范原生只支持公历循环（Gregorian Calendar），国际主流日历系统无法理解中国农历闰月与平闰转换规则；
- **降级与展开方案**：
  - 导出农历事项时，系统在纯函数层预先通过 `lunarToSolar` 将未来 3~5 年的公历对应日期计算完毕；
  - 展开为多条独立的公历 `VEVENT`，并在 `SUMMARY` 标注 `(农历)`，在扩展字段输出 `X-LUNAR-ORIGIN`；
  - 并在界面如实告知用户：“农历事项在外部日历中以未来 3 年独立事件呈现，超出年份需重新导出”。

### 3. 单向导出 vs 双向同步红线（Unidirectional Export Redline）
- **裁决**：
  - **采用单向导出**：支持生成标准的 `.ics` 文件下载或保存；
  - **坚决不做双向 CalDAV / ICS 导入回写**：外部日历的编辑、删除若反向写入思源，会破坏事项本地数据库的纯洁性，且存在极其复杂的时区与冲突灾难。

---

## 三、工程落地与测试守门

1. **纯逻辑转换模型**：落地 `src/features/occasion-ics.ts`，实现文本转义、RFC 5545 VCALENDAR 装配、农历展开与 Envelope 决断模型；
2. **专项测试**：编写 `tests/occasion-ics-migration.test.cjs`，覆盖单次、公历年、农历展开、月第 N 周、月末、转义与多桶策略；
3. **纳入质量链**：挂载至 `package.json` 的 `test:v18`，统一受 `test:quality` 门禁约束。
