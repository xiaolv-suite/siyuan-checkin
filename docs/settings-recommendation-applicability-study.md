# 设置字段推荐适用性总表与先行研究报告（T-1733，D-645）

## 1. 研究背景与核心原则

在设置页信息架构向用户任务引导演进的过程中，为了降低新用户和进阶用户的配置心智负担，系统需要识别哪些设置项可以提供智能方案或推荐值。然而，若缺乏严密的语义边界控制，盲目将高风险凭据、特定笔记绑定、只读状态或破坏性动作硬编码为“推荐配置”，将引发严重的用户数据损坏与隐私泄露。

本研究依据 `docs/settings-field-registry-2026-09-28.md` 的 A 显式保存、B 即时异步持久化、C 动作类、D 只读状态行四类语义，确立了四大适用性分级模型与严格的红线禁则。

---

## 2. 推荐适用性四级模型

| 适用性等级 | 标识符 | 适用范围与特征 | 典型字段示例 |
| --- | --- | --- | --- |
| **可给通用默认** | `universal_default` | 具备无偏向的普适最佳实践，对绝大多数用户自然成立 | 主题 `auto`、语言 `auto`、自然语言速记 `true`、安静时段 `23:00~07:00` |
| **可按本地证据推荐** | `evidence_based` | 无绝对通用值，但可通过用户本地客观证据（打卡峰值时刻、已安装插件、打卡项数量规模）自适应推导 | 提醒时刻槽（根据打卡峰值小时）、专注提供方（根据 Dock Tomato 探测）、今日分组模式（根据项目规模） |
| **必须人工选择** | `manual_required` | 涉及用户个人隐私、私有账密、不可逆笔记资产绑定或定制内容，算法无法也绝不能擅自替用户决策 | 微信读书 API Key、日记目标笔记本与文档、问卷自定义模板、个人头像 |
| **不可推荐（红线）** | `not_applicable` | 严禁强塞推荐值！所有执行操作、数据破坏动作、重置与只读状态行 | 导入/导出、恢复快照、重置所有偏好、API v5 契约状态、存储空间统计 |

---

## 3. 设置分区覆盖与字段规范总表

### 3.1 外观与操作 (`appearance_nav`)
- **主题 (`theme`)**：`B_immediate` / `universal_default` / 默认 `auto` / 风险 `low` / 确认 `none`
- **语言 (`language`)**：`B_immediate` / `universal_default` / 默认 `auto` / 风险 `low` / 确认 `none`
- **打开方式 (`open_mode`)**：`B_immediate` / `universal_default` / 默认 `dialog` / 风险 `low` / 确认 `none`
- **NLP 速记 (`quick_entry_nlp`)**：`B_immediate` / `universal_default` / 默认 `true` / 风险 `low` / 确认 `none`
- **减弱动效 (`motion`)**：`B_immediate` / `universal_default` / 默认 `auto` / 风险 `low` / 确认 `none`
- **触感振动 (`haptic`)**：`B_immediate` / `universal_default` / 默认 `true` / 风险 `low` / 确认 `none`
- **调色板强调色 (`palette`)**：`B_immediate` / `universal_default` / 默认 `violet` / 风险 `low` / 确认 `none`
- **头像 (`avatar`)**：`B_immediate` / `manual_required` / 默认 `""` / 风险 `medium` / 确认 `single_field`
- **弹窗尺寸模式 (`dialog_mode`)**：`B_immediate` / `universal_default` / 默认 `auto` / 风险 `low` / 确认 `none`
- **快捷键指南 (`shortcuts_doc`)**：`D_readonly` / `not_applicable` / 默认 `null` / 风险 `low` / 确认 `none`

### 3.2 今日与提醒 (`today_reminders`)
- **今日待办分组 (`group_mode`)**：`B_immediate` / `evidence_based` / 默认 `schedule` / 风险 `low` / 确认 `none`（项目 > 8 个时推荐按时段分组）
- **排序顺序 (`sort_mode`)**：`B_immediate` / `universal_default` / 默认 `order` / 风险 `low` / 确认 `none`
- **已完成项折叠 (`completed_folded`)**：`B_immediate` / `universal_default` / 默认 `false` / 风险 `low` / 确认 `none`
- **周历快捷条 (`week_strip`)**：`B_immediate` / `universal_default` / 默认 `true` / 风险 `low` / 确认 `none`
- **夜间安静时段开关 (`quiet_hours_enabled`)**：`B_immediate` / `universal_default` / 默认 `true` / 风险 `medium` / 确认 `none`
- **安静时段范围 (`quiet_hours_range`)**：`B_immediate` / `universal_default` / 默认 `23:00~07:00` / 风险 `medium` / 确认 `none`
- **每日提醒总开关 (`reminder_daily_toggle`)**：`B_immediate` / `universal_default` / 默认 `true` / 风险 `medium` / 确认 `none`
- **每日提醒槽 (`reminder_slots`)**：`A_explicit` / `evidence_based` / 默认 `["09:00", "20:00"]` / 风险 `medium` / 确认 `section_batch`（根据用户历史打卡峰值小时自适应生成）
- **事项提前提醒仅一次 (`occasion_remind_once`)**：`B_immediate` / `universal_default` / 默认 `true` / 风险 `low` / 确认 `none`

### 3.3 联动与目标 (`integrations`)
- **专注计时提供方 (`focus_provider`)**：`B_immediate` / `evidence_based` / 默认 `builtin` / 风险 `medium` / 确认 `none`（根据 Dock Tomato 插件健康状态智能推荐）
- **日记模式 (`journal_integration_mode`)**：`A_explicit` / `evidence_based` / 默认 `daily-append` / 风险 `medium` / 确认 `section_batch`
- **日记目标笔记本 (`journal_notebook_id`)**：`A_explicit` / `manual_required` / 默认 `""` / 风险 `high` / 确认 `section_batch`（严禁算法推测）
- **打卡汇总目标文档 (`journal_target_doc`)**：`A_explicit` / `manual_required` / 默认 `""` / 风险 `high` / 确认 `section_batch`（严禁算法推测）
- **微信读书凭据 (`weread_api_key`)**：`A_explicit` / `manual_required` / 默认 `""` / 风险 `high` / 确认 `section_batch`（严禁自动推测）
- **微信读书达标时长 (`weread_threshold_minutes`)**：`A_explicit` / `universal_default` / 默认 `15` / 风险 `medium` / 确认 `section_batch`
- **思阅拉取动作 (`sireader_pull_action`)**：`C_action` / `not_applicable` / 默认 `null` / 风险 `medium` / 确认 `single_field`
- **API v5 契约状态 (`api_v5_contract_status`)**：`D_readonly` / `not_applicable` / 默认 `null` / 风险 `low` / 确认 `none`

### 3.4 数据与恢复 (`data_recovery`)
- **备份导出 (`backup_export_action`)**：`C_action` / `not_applicable` / 默认 `null` / 风险 `low` / 确认 `single_field`
- **备份导入 (`backup_import_action`)**：`C_action` / `not_applicable` / 默认 `null` / 风险 `high` / 确认 `danger_modal`
- **重置所有偏好 (`reset_all_preferences_action`)**：`C_action` / `not_applicable` / 默认 `null` / 风险 `high` / 确认 `danger_modal`
- **物理存储统计 (`storage_statistics`)**：`D_readonly` / `not_applicable` / 默认 `null` / 风险 `low` / 确认 `none`

---

## 4. 实施防线与契约守门

1. **防篡改过滤**：`evaluateFieldRecommendationEligibility` 在推荐应用前强制校验，若目标字段为 C 动作类、D 只读类或 `manual_required` 属性，立即拒止并返回显式诊断码。
2. **纯函数推导**：`deriveEvidenceBasedRecommendations` 仅依赖传入的上下文快照，无 I/O、无时钟、无网络，输出纯不可变数据。
3. **自动化守门**：`tests/settings-recommendation-governance.test.cjs` 确保全字段覆盖与适用性分类严格受控。
