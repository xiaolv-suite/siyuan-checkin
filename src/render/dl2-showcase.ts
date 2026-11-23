/**
 * 小驴打卡 · DL2 组件样板间 (DL2 Showcase)
 * DL2 阶段 1（DL2-PLAN §五）：打卡仓作为全生态视觉迁移样板间。
 *
 * 本屏用 lv-ui v1 组件工厂完整展示 DL2 设计语言五要素：
 * 一底两色一锚（雾紫米白画布 / 柔雾紫交互 / 暖橘能量 / 近黑墨色 hero）、
 * 胶囊大圆角、大数字主角、吉祥物插画、偏好可控动效。
 * 其他仓在阶段 2 按 docs/ui/MIGRATION.md 迁移，勿在仓内私改 lv-kit。
 */

import {
    setupLvUiRoot,
    lvxCard,
    lvxHeroNum,
    lvxChip,
    lvxTag,
    lvxSegmented,
    lvxSwitch,
    lvxProgress,
    lvxButton,
    lvxField,
    lvxInput,
    lvxSkeleton,
    lvxErrorState,
    lvxAlert,
    lvxDivider,
    lvxTabs,
    lvxPagination,
    lvxBreadcrumb,
    lvxResult,
    lvxDrawer,
    lvxPopover,
    lvxSlider,
    lvxMenu,
    lvxTimeline,
    lvxList,
    lvxListItem,
    lvxTable,
    lvxCombobox,
    lvxTree,
    lvxCalendar,
    lvxTimePicker,
    lvxKbd,
    lvxRate,
    lvxStepper,
    lvxSteps,
    lvxSparkline,
    lvxCommandPalette,
    lvxTour,
    lvxDragSort,
    lvxConfetti,
    triggerLvConfetti,
    lvxSwipeAction,
} from "./ui/lv-ui";
import { lvMascot } from "./ui/mascots";

/** 构建样板间展示屏（返回已挂 data-lv-ui 根的容器） */
export function mountDl2Showcase(host: HTMLElement): HTMLElement {
    const root = setupLvUiRoot(document.createElement("div"));
    root.className = "lc-dl2-showcase";
    root.setAttribute("data-lv-theme", "light");

    /* —— 一、墨色锚 hero 卡：大数字主角 + 能量 chip + 吉祥物（每屏至多一块） —— */
    const hero = lvxCard({
        hero: true,
        children: [
            (() => {
                const head = document.createElement("div");
                head.style.cssText = "display:flex;align-items:flex-start;justify-content:space-between;gap:12px;";
                const num = lvxHeroNum({ value: "21", label: "连续打卡 · Streak", tone: "brand" });
                num.querySelector?.(".lvx-herton")?.setAttribute("style", "color:var(--lvx-ink-text);");
                head.appendChild(num);
                const mascotWrap = document.createElement("span");
                mascotWrap.innerHTML = lvMascot("celebrate");
                mascotWrap.style.flexShrink = "0";
                head.appendChild(mascotWrap);
                return head;
            })(),
            (() => {
                const chips = document.createElement("div");
                chips.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;";
                chips.appendChild(lvxChip({ text: "🔥 全勤 7 天", tone: "energy" }));
                chips.appendChild(lvxChip({ text: "本周 5/7", tone: "neutral" }));
                chips.appendChild(lvxTag("DL2 样板"));
                return chips;
            })(),
        ],
    });
    root.appendChild(hero);

    /* —— 二、控件组卡：分段控件 / 开关 / 进度（进度域不受动效偏好关闭） —— */
    const controls = lvxCard({
        children: [
            lvxSegmented({
                ariaLabel: "视图档位演示",
                options: [{value: "day", label: "日"}, {value: "week", label: "周"}, {value: "month", label: "月"}],
                value: "week",
            }),
            (() => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;";
                const label = document.createElement("span");
                label.style.fontSize = "13px";
                label.textContent = "庆祝效果（生态偏好联动）";
                row.appendChild(label);
                row.appendChild(lvxSwitch({
                    ariaLabel: "庆祝效果演示",
                    checked: true,
                    onChange: () => { /* 演示件：真实偏好由设置分组管理 */ },
                }));
                return row;
            })(),
            (() => {
                const wrap = document.createElement("div");
                wrap.style.marginTop = "12px";
                const caption = document.createElement("div");
                caption.style.cssText = "font-size:12px;color:var(--lvx-text-muted,#26262E);margin-bottom:6px;";
                caption.textContent = "本周完成度 72%";
                wrap.appendChild(caption);
                wrap.appendChild(lvxProgress({ value: 0.72, tone: "energy", ariaLabel: "本周完成度" }));
                return wrap;
            })(),
        ],
    });
    root.appendChild(controls);

    /* —— 三、表单组卡：Field + Input + 按钮对齐铁律（居中默认 / --row 左对齐） —— */
    const form = lvxCard({
        children: [
            lvxField({
                label: "快速记录",
                hint: "lvx-input 演示",
                control: lvxInput({ placeholder: "今天完成了什么？", ariaLabel: "快速记录演示" }),
            }),
            (() => {
                const btns = document.createElement("div");
                btns.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-top:12px;";
                btns.appendChild(lvxButton({ label: "保存打卡（默认居中）", variant: "primary" }));
                btns.appendChild(lvxButton({ label: "查看历史记录（--row 左对齐行）", row: true }));
                return btns;
            })(),
        ],
    });
    root.appendChild(form);

    /* —— 四、骨架屏演示（加载指示域白名单：永不因外观偏好关闭，仅系统减弱动效静态化） —— */
    const skeletonCard = lvxCard({
        children: [
            lvxSkeleton({ variant: "title", ariaLabel: "骨架屏演示" }),
            lvxSkeleton({ variant: "text", lines: 3, ariaLabel: "骨架屏演示" }),
            (() => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;gap:10px;align-items:center;";
                row.appendChild(lvxSkeleton({ variant: "circle", width: 36, height: 36 }));
                row.appendChild(lvxSkeleton({ variant: "rect", width: 160, height: 36 }));
                return row;
            })(),
        ],
    });
    root.appendChild(skeletonCard);

    /* —— 五、错误态演示（错误警示域：静态无装饰动画，role=alert） —— */
    const errorCard = lvxCard({
        children: [
            lvxErrorState({
                icon: "⚠️",
                title: "演示：数据加载失败",
                desc: "lvx ErrorState 组件——标题/描述/操作行三段式，语义色随深浅主题。",
                actions: [lvxButton({ label: "重试", variant: "primary", sm: true }), lvxButton({ label: "复制诊断", sm: true })],
            }),
        ],
    });
    root.appendChild(errorCard);

    /* —— 六、v2 第一批组件演示（Alert/Divider/Tabs/Pagination/Breadcrumb） —— */
    const v2Card = lvxCard({
        children: [
            lvxAlert({ title: "已同步到思源云端", desc: "全部打卡记录与复盘已写入", tone: "success" }),
            lvxDivider({ text: "导航演示" }),
            lvxTabs({ ariaLabel: "v2 页签演示", options: [{ id: "d", label: "日" }, { id: "w", label: "周" }, { id: "m", label: "月" }], value: "w" }),
            (() => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap;";
                row.appendChild(lvxBreadcrumb({ items: [{ label: "回顾", onClick: () => {} }, { label: "洞察", current: true }] }));
                row.appendChild(lvxPagination({ ariaLabel: "v2 分页演示", pages: [{ label: "‹", page: 1, disabled: true }, { label: "1", page: 1, current: true }, { label: "2", page: 2 }, { label: "›", page: 2 }] }));
                return row;
            })(),
        ],
    });
    root.appendChild(v2Card);

    /* —— 七、v2 第二批交互组件演示（Result/Drawer/Popover/Slider/Menu） —— */
    const drawer = lvxDrawer({
        title: "打卡详情抽屉演示",
        body: [
            (() => {
                const content = document.createElement("div");
                content.style.fontSize = "13px";
                content.textContent = "抽屉组件支持自右侧/左侧滑入，适合承载复杂配置、长列表或打卡历史详情。";
                return content;
            })(),
        ],
        footer: [
            lvxButton({
                label: "关闭抽屉",
                sm: true,
                onClick: () => drawer.setAttribute("data-open", "false"),
            }),
        ],
        onClose: () => drawer.setAttribute("data-open", "false"),
    });
    root.appendChild(drawer);

    const v2Batch2Card = lvxCard({
        children: [
            lvxResult({
                tone: "success",
                icon: "🎉",
                title: "打卡周期圆满达成",
                desc: "已连续打卡 21 天，达成率 100%，恭喜获得「坚韧小驴」勋章！",
                actions: [lvxButton({ label: "分享成就", variant: "primary", sm: true })],
            }),
            lvxDivider({ text: "交互与菜单演示" }),
            (() => {
                const sliderRow = document.createElement("div");
                sliderRow.style.cssText = "display:flex;flex-direction:column;gap:6px;";
                const sliderLabel = document.createElement("span");
                sliderLabel.style.fontSize = "12px";
                sliderLabel.style.color = "var(--lvx-text-muted,#26262E)";
                sliderLabel.textContent = "目标达成度滑杆：80%";
                const slider = lvxSlider({
                    value: 80,
                    min: 0,
                    max: 100,
                    step: 5,
                    ariaLabel: "达成度滑杆演示",
                    onInput: (v) => { sliderLabel.textContent = `目标达成度滑杆：${v}%`; },
                });
                sliderRow.appendChild(sliderLabel);
                sliderRow.appendChild(slider);
                return sliderRow;
            })(),
            (() => {
                const interactiveRow = document.createElement("div");
                interactiveRow.style.cssText = "display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-top:12px;";

                const popoverWrap = document.createElement("div");
                popoverWrap.style.cssText = "position:relative;display:inline-block;";
                const popoverBtn = lvxButton({ label: "气泡浮层 (Popover)", sm: true });
                const popover = lvxPopover({
                    ariaLabel: "气泡提示内容",
                    content: [
                        (() => {
                            const p = document.createElement("div");
                            p.style.cssText = "font-size:12px;line-height:1.4;";
                            p.textContent = "基于 DL2 纯 CSS/DOM 构建的气泡浮层，支持无依赖轻量弹出。";
                            return p;
                        })(),
                    ],
                });
                popoverBtn.onclick = () => {
                    const cur = popover.getAttribute("data-open") === "true";
                    popover.setAttribute("data-open", cur ? "false" : "true");
                };
                popoverWrap.appendChild(popoverBtn);
                popoverWrap.appendChild(popover);
                interactiveRow.appendChild(popoverWrap);

                const openDrawerBtn = lvxButton({
                    label: "侧边抽屉 (Drawer)",
                    sm: true,
                    onClick: () => drawer.setAttribute("data-open", "true"),
                });
                interactiveRow.appendChild(openDrawerBtn);

                return interactiveRow;
            })(),
            (() => {
                const menuWrap = document.createElement("div");
                menuWrap.style.marginTop = "12px";
                const menuDemo = lvxMenu({
                    ariaLabel: "快捷操作菜单",
                    items: [
                        { groupLabel: "快捷操作" },
                        { label: "导出打卡数据", icon: "📥" },
                        { label: "补卡申请", icon: "📝" },
                        { divider: true },
                        { label: "重置本周进度", icon: "🗑️", danger: true },
                    ],
                });
                menuWrap.appendChild(menuDemo);
                return menuWrap;
            })(),
        ],
    });
    root.appendChild(v2Batch2Card);

    /* —— 八、v2 第三批结构组件演示（Timeline/List/Table/Combobox） —— */
    const v2Batch3Card = lvxCard({
        children: [
            (() => {
                const cbWrap = document.createElement("div");
                cbWrap.style.marginBottom = "14px";
                const cb = lvxCombobox({
                    ariaLabel: "习惯分类筛选",
                    placeholder: "搜索/选择分类...",
                    options: [
                        { value: "all", label: "全部习惯 (6)" },
                        { value: "study", label: "研习精进 (3)" },
                        { value: "health", label: "健康作息 (2)" },
                        { value: "life", label: "生活整理 (1)" },
                    ],
                    value: "all",
                });
                cbWrap.appendChild(cb);
                return cbWrap;
            })(),
            lvxDivider({ text: "打卡列表 (List & ListItem)" }),
            lvxList({
                ariaLabel: "习惯列表演示",
                items: [
                    lvxListItem({
                        prefix: "📚",
                        title: "深度阅读计划",
                        desc: "今日目标 45 分钟 · 已完成 30 分钟",
                        suffix: lvxChip({ text: "进行中", tone: "brand" }),
                        interactive: true,
                    }),
                    lvxListItem({
                        prefix: "🏃",
                        title: "每日慢跑 3km",
                        desc: "连续达成 12 天 · 心流稳固",
                        suffix: lvxChip({ text: "已达成", tone: "energy" }),
                        interactive: true,
                    }),
                ],
            }),
            lvxDivider({ text: "今日节点 (Timeline)" }),
            lvxTimeline({
                ariaLabel: "打卡时间线演示",
                items: [
                    { title: "晨间阅读打卡", time: "08:15", content: "完成《认知天性》第二章摘录与闪卡制作", tone: "success" },
                    { title: "午间专注打卡", time: "13:30", content: "番茄钟 45 分钟无打扰编码", tone: "brand" },
                    { title: "晚间复盘待办", time: "21:00", content: "回顾全天完成度并归档台账", tone: "energy" },
                ],
            }),
            lvxDivider({ text: "周期报表 (Table)" }),
            lvxTable({
                ariaLabel: "打卡报表演示",
                compact: true,
                columns: [
                    { key: "habit", title: "习惯名称", width: 140 },
                    { key: "streak", title: "连续天数", align: "center" },
                    { key: "rate", title: "达成率", align: "right" },
                ],
                rows: [
                    { habit: "深度阅读", streak: "21 天", rate: "100%" },
                    { habit: "早睡早起", streak: "14 天", rate: "92%" },
                    { habit: "每日慢跑", streak: "7 天", rate: "85%" },
                ],
            }),
        ],
    });
    root.appendChild(v2Batch3Card);

    /* —— 九、v2 第四批收尾组件演示（Tree/Calendar/TimePicker） —— */
    const v2Batch4Card = lvxCard({
        children: [
            lvxDivider({ text: "习惯树形层级 (Tree)" }),
            lvxTree({
                ariaLabel: "习惯分组树",
                nodes: [
                    {
                        id: "core",
                        label: "核心日常习惯",
                        icon: "⭐",
                        badge: "2",
                        expanded: true,
                        children: [
                            { id: "c1", label: "晨间阅读 30m", icon: "📖", badge: "21d" },
                            { id: "c2", label: "晚间复盘 15m", icon: "🌙", badge: "14d" },
                        ],
                    },
                    {
                        id: "growth",
                        label: "进阶精进项目",
                        icon: "🚀",
                        badge: "1",
                        children: [
                            { id: "g1", label: "算法刷题 2 道", icon: "💻" },
                        ],
                    },
                ],
            }),
            lvxDivider({ text: "日期与时间选择 (Calendar & TimePicker)" }),
            (() => {
                const pickerRow = document.createElement("div");
                pickerRow.style.cssText = "display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;justify-content:space-between;";

                const cal = lvxCalendar({
                    year: 2026,
                    month: 11,
                    selectedDate: "2026-11-18",
                    ariaLabel: "打卡日历选择",
                });
                pickerRow.appendChild(cal);

                const timeSection = document.createElement("div");
                timeSection.style.cssText = "display:flex;flex-direction:column;gap:8px;";
                const timeLabel = document.createElement("span");
                timeLabel.style.fontSize = "12px";
                timeLabel.style.color = "var(--lvx-text-muted,#26262E)";
                timeLabel.textContent = "提醒时间设置 (TimePicker)";
                timeSection.appendChild(timeLabel);
                timeSection.appendChild(lvxTimePicker({ value: "08:30", ariaLabel: "提醒时间设置" }));

                pickerRow.appendChild(timeSection);
                return pickerRow;
            })(),
        ],
    });
    root.appendChild(v2Batch4Card);

    /* —— 十、v3 生态专项高阶组件演示（Sparkline/CommandPalette/Tour/DragSort/Kbd/Rate/Stepper/Confetti/SwipeAction） —— */
    const v3SpecialCard = lvxCard({
        children: [
            lvxDivider({ text: "DL2 虚线网格柔和曲线图 (Sparkline)" }),
            lvxSparkline({
                data: [18, 26, 22, 35, 31, 44, 48],
                labels: ["周一", "周二", "周三", "周四", "周五", "周六", "今日"],
                tone: "energy",
                currentIndex: 6,
                ariaLabel: "本周打卡心流趋势",
            }),
            lvxDivider({ text: "步进器 · 星级评分 · 机械键帽 (Stepper / Rate / Kbd)" }),
            (() => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:space-between;";
                row.appendChild(lvxStepper({ value: 25, min: 5, max: 60, step: 5, unit: "m" }));
                row.appendChild(lvxRate({ value: 4, max: 5 }));
                row.appendChild(lvxKbd(["Ctrl", "Shift", "K"]));
                return row;
            })(),
            (() => {
                const stepsWrap = document.createElement("div");
                stepsWrap.style.marginTop = "12px";
                stepsWrap.appendChild(lvxSteps({
                    steps: [{ title: "计划" }, { title: "执行" }, { title: "复盘" }],
                    current: 1,
                }));
                return stepsWrap;
            })(),
            lvxDivider({ text: "手势左滑行与拖拽重排 (SwipeAction / DragSort)" }),
            lvxSwipeAction({
                prefix: "📖",
                title: "晨间深读 30 分钟",
                desc: "左滑或点右侧「操作 ◂」露出胶囊按钮",
                actions: [
                    { label: "🔥 打卡", tone: "energy" },
                    { label: "归档", tone: "danger" },
                ],
            }),
            (() => {
                const dsWrap = document.createElement("div");
                dsWrap.style.marginTop = "10px";
                dsWrap.appendChild(lvxDragSort({
                    items: [
                        { id: "s1", label: "1. 晨间深读 30m", meta: "P0" },
                        { id: "s2", label: "2. 晚间微复盘", meta: "P1" },
                    ],
                }));
                return dsWrap;
            })(),
            lvxDivider({ text: "命令面板 · 引导卡 · 庆祝撒花 (CommandPalette / Tour / Confetti)" }),
            lvxCommandPalette({
                items: [
                    { id: "cmd1", label: "立即完成今日打卡", group: "快捷命令", icon: "✅", shortcut: ["Ctrl", "Enter"] },
                    { id: "cmd2", label: "使用自律免死金牌", group: "快捷命令", icon: "🛡️", shortcut: ["Alt", "F"] },
                ],
            }),
            (() => {
                const tourWrap = document.createElement("div");
                tourWrap.style.marginTop = "10px";
                tourWrap.appendChild(lvxTour({
                    mascot: lvMascot("wave"),
                    steps: [
                        { title: "欢迎体验 DL2 组件全集", desc: "49 个组件全部零第三方依赖，深浅双主题与 390×844 移动端原生自适应。" },
                        { title: "动效与庆祝完全可控", desc: "受外观偏好总闸实时门控，关闭后零装饰动画残留。" },
                    ],
                }));
                return tourWrap;
            })(),
            (() => {
                const confRow = document.createElement("div");
                confRow.style.cssText = "display:flex;align-items:center;justify-content:center;gap:12px;margin-top:12px;";
                const confStage = lvxConfetti({ count: 14 });
                const confBtn = lvxButton({
                    label: "🎉 点击触发庆祝撒花 (Confetti)",
                    variant: "energy",
                    sm: true,
                    onClick: () => { triggerLvConfetti(confStage, 16); },
                });
                confRow.appendChild(confStage);
                confRow.appendChild(confBtn);
                return confRow;
            })(),
        ],
    });
    root.appendChild(v3SpecialCard);

    const caption = document.createElement("p");
    caption.style.cssText = "font-size:11px;color:var(--lvx-text-muted,#26262E);margin:8px 4px 0;text-align:center;";
    caption.textContent = "小驴 Design Language 2.0 · 组件样板间（阶段 1）— 全部元素可在深浅主题与 390×844 移动端下自适应";
    root.appendChild(caption);

    try {
        host.appendChild(root);
    } catch {
        // ignore
    }
    return root;
}
