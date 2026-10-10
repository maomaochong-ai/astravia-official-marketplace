/**
 * 检测插件根当前处于浅色还是深色主题。
 *
 * 判定逻辑集中在 src/shared/theme/plugin-theme.ts —— 同一份结论也会写到插件根
 * 的 data-dbx-theme 属性上供 CSS 令牌层消费。这里只把它包成 React hook，
 * 给 CodeMirror 配色、图表配色等需要 JS 侧取值的场景用。
 */

import { useSyncExternalStore } from "react";
import { getPluginTheme, subscribePluginTheme, type PluginTheme } from "../theme/plugin-theme";

export type DetectedTheme = PluginTheme;

/** 当前主题；宿主切换主题（<html data-mode>）时自动重渲染。 */
export function useDetectedTheme(): DetectedTheme {
	return useSyncExternalStore(subscribePluginTheme, getPluginTheme, getPluginTheme);
}