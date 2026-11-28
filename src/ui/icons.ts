/* 共享矢量图标路径与渲染。
 * DL2 阶段3 图标 5→1：事实源已上收 packages/lv-kit/ui/icons.ts，
 * 本文件仅为仓内 API 兼容转发层（uiIcon/UiIconName 签名不变）。 */
import { LV_ICON_PATHS, lvIcon, type LvIconName, type LvIconOptions } from "../render/ui/icons";

export const UI_ICON_PATHS: Record<string, string> = LV_ICON_PATHS;
export type UiIconName = Extract<keyof typeof UI_ICON_PATHS, string>;

export function uiIcon(name: UiIconName, className = "", opts?: Omit<LvIconOptions, "className">): string {
    const merged = className ? `lc-checkin__glyph ${className}` : "lc-checkin__glyph";
    return lvIcon(name as LvIconName, { className: merged, ...opts });
}
