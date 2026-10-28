/* T-1754：今日视图、弹窗与专注提供方建议纯模型（纯逻辑、无时钟、确定性）。
   依据真实打卡项目数量、排期与宿主设备环境给出无侵入预览与建议；
   专注提供方严格按照真实可用性推荐；
   Task Horizon / Agent 严守对外能力状态，绝不作为“打开开关”候选。 */

export interface ViewAndFocusRecommendationContext {
    readonly totalActiveItems: number;
    readonly itemsWithScheduleCount: number;
    readonly isDockHost: boolean;
    readonly isMobileHost: boolean;
    readonly isDockTomatoAvailable: boolean;
}

export interface ViewAndFocusRecommendation {
    readonly key: "group_mode" | "open_mode" | "focus_provider";
    readonly proposedValue: string;
    readonly rationaleKey: string;
    readonly previewSummary: string;
}

/** 基于真实环境推导今日视图与专注建议（T-1754）。 */
export function deriveViewAndFocusRecommendations(
    context: ViewAndFocusRecommendationContext
): readonly ViewAndFocusRecommendation[] {
    const recommendations: ViewAndFocusRecommendation[] = [];

    // 1. 今日分组模式建议
    if (context.totalActiveItems > 8 && context.itemsWithScheduleCount >= 3) {
        recommendations.push({
            key: "group_mode",
            proposedValue: "time",
            rationaleKey: "set.rec.view.groupScheduleRationale",
            previewSummary: "Group cards into Morning / Afternoon / Evening slots",
        });
    } else if (context.totalActiveItems > 5) {
        recommendations.push({
            key: "group_mode",
            proposedValue: "group",
            rationaleKey: "set.rec.view.groupCustomRationale",
            previewSummary: "Group cards by custom item folders",
        });
    }

    // 2. 打开方式与设备适配建议
    if (context.isDockHost) {
        recommendations.push({
            key: "open_mode",
            proposedValue: "quick",
            rationaleKey: "set.rec.view.openModeDockRationale",
            previewSummary: "Quick dialog recommended for sidebar dock environments",
        });
    } else if (context.isMobileHost) {
        recommendations.push({
            key: "open_mode",
            proposedValue: "tab",
            rationaleKey: "set.rec.view.openModeMobileRationale",
            previewSummary: "Full tab view recommended for mobile screens",
        });
    }

    // 3. 专注提供方建议（按真实可用性）
    if (context.isDockTomatoAvailable) {
        recommendations.push({
            key: "focus_provider",
            proposedValue: "docktomato",
            rationaleKey: "set.rec.focus.dockTomatoAvailable",
            previewSummary: "Bridge with installed Dock Tomato plugin",
        });
    } else {
        recommendations.push({
            key: "focus_provider",
            proposedValue: "builtin",
            rationaleKey: "set.rec.focus.builtinReliable",
            previewSummary: "Use stable native built-in timer",
        });
    }

    return Object.freeze(recommendations);
}
