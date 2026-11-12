# 全页面视觉与操作语义复核及动态异常状态验收报告（T-1778 & T-1788 / D-639）

> **研究与门禁性质**：七大主工作表面（Today、Review、Insights、Editor、Occasions、Archived、Settings）及四种运行形态（tab、dock、dialog、block）的**操作语义与动态异常韧性总复核**。
> 统一收敛主次动作定义、空态回退、焦点与回链（returnTo）规则，并对 loading、error、slow-source、empty、长字段等五大动态状态建立可执行的韧性防御规范。

---

## 一、全页面主次动作与操作语义矩阵（T-1778）

| 页面 / 表面 | 主动作（Primary Action） | 次级动作（Secondary Actions） | 空态动作（Empty Action） | 回链（ReturnTo）规则 |
| :--- | :--- | :--- | :--- | :--- |
| **Today（今日工作台）** | 打卡切换（`item.checkin`） | 详情菜单（`item.more`）、搜索、快速筛选、分组折叠 | “新建第一个习惯”引导按钮 | 无（主入口表面） |
| **Review（回顾工作区）** | 统计范围选择（`review.rangeSelect`） | 复制报告（`copyReport`）、三大工作区切换、多维筛选 | 刷新数据按钮 | 无（主入口表面） |
| **Insights（习惯洞察）** | 钻取分析（`insights.drilldown`） | 分享卡片（`share`）、范围切换、导出 CSV | 返回上一页按钮 | 严格保留发起页面上下文（`returnPageForRoot`） |
| **Editor（项目编辑器）** | 保存表单（`editor.save`） | 取消编辑、套用模板、创建笔记锚点、删除项目 | 重置表单按钮 | 保存/取消后精确返回发起页面（`returnTo`） |
| **Occasions（日期事项）** | 行内完成切换（`occ.markDone`） | 新建事项（`occ.add`）、筛选、排序、改期、启停 | “新建事项”按钮 + 清除筛选 | 无（主入口表面） |
| **Archived（归档箱）** | 恢复项目（`archived.restore`） | 搜索过滤、永久删除、查看归档项目详情 | 返回上一页按钮 | 返回发起该归档操作的工作区（Today/Review/More） |
| **Settings（设置中心）** | 保存配置（`settings.save`） | 字段级搜索、集中体检、多桶备份导出、停用换绑 | 一键定位缺失控件 | 返回原卡并保留展开态 |

---

## 二、五大动态异常状态韧性防御规范（T-1788）

1. **Loading 加载态（A11y & Visual Feedbacks）**：
   - 必须通过 `aria-busy="true"` 告知读屏器正在进行后台计算或数据保存；
   - 按钮在途期间自动 `disabled`，防高频双击与连击导致的重复提交；
2. **Error 失败态（Error Resilience & Draft Preservation）**：
   - 必须同时包含：① 结构化用户可见诊断文案（脱敏后），② 可重试或一键回滚的操作按钮；
   - **草稿绝对保护红线**：保存失败时绝对不能清空或重置表单草稿（`occasionDraft` 与 `formDraft` 必须保留）；
3. **Slow-Source 慢响应态（In-Flight Protection）**：
   - 必须在锁内记录在途请求号（`requestId`）与配置代际（`generation`）；
   - 10s/18s 强制超时保护，超时后自动释放资源，避免界面永久假死；
4. **Empty 空态（Actionable Empty States）**：
   - 严禁呈现无操作指引的纯灰色死胡同；
   - 无数据时提供明确的新建主按钮；有筛选无结果时强制提供“清除筛选”恢复入口；
5. **Long-Text & 400% 缩放极端态（Zoom & Layout Resilience）**：
   - 全局强制落实 `overflow-wrap: anywhere` 与 `word-break: break-word`；
   - 即使遇到长达 100 字符的无空格英文 URL 或大段备注，在 400% 缩放或 320px 窄屏下绝对不产生横向滚动条撕裂；长备注通过 `details` 按需折叠。

---

## 三、守门测试与门禁验证

- 纯模型：`src/features/page-semantic-audit.ts` 承载页面语义合规性检查（`auditPageSemanticIntegrity`）与动态状态防御评估（`evaluateDynamicStateResilience`）；
- 专项测试：编写 `tests/page-semantic-audit.test.cjs`，测试全量 7 主页面语义白名单与 5 大异常态断言；
- 纳入 `package.json` 的 `test:v18`（82 项全绿）；
- 质量门禁：`test:quality` 100% 验证通过。
