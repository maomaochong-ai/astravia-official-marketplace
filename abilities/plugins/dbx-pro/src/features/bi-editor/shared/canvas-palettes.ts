/**
 * canvas-palettes.ts — 画布调色板。
 *
 * BI 场景里“换配色”指的是换数据系列色，不是换界面主题（那是编辑器顶栏的明暗切换）。
 * 作用点是覆盖 `--dbx-series-1..4`：`src/style.css` 的 `@theme inline` 已经把
 * `--color-series-N` 映射到它们，所以一次覆盖同时改到：
 *   - Tailwind 的 `bg-series-N` / `text-series-N`（看板瓦片、工具条取色点）；
 *   - charts.tsx 里用 `var(--color-series-N)` 的 SVG 描边/填充。
 *
 * `series: null` 表示「跟随主题」——不写内联变量，交给明暗主题自己决定。
 */

import type { CSSProperties } from "react";

export interface CanvasPalette {
	id: string;
	label: string;
	description: string;
	/** null = 跟随主题（不覆盖 CSS 变量）。 */
	series: readonly [string, string, string, string] | null;
}

export const CANVAS_PALETTES: CanvasPalette[] = [
	{
		id: "theme",
		label: "跟随主题",
		description: "使用当前明暗主题的官方系列色",
		series: null,
	},
	{
		id: "tech",
		label: "科技",
		description: "蓝青紫橙，适合互联网与增长看板",
		series: ["#3b82f6", "#06b6d4", "#8b5cf6", "#f59e0b"],
	},
	{
		id: "gov",
		label: "政务",
		description: "红金蓝绿，适合政务与监管报送",
		series: ["#c0392b", "#b7791f", "#1e40af", "#0f766e"],
	},
	{
		id: "biz",
		label: "商务",
		description: "藏蓝墨绿醇紫古铜，适合财务与经营分析",
		series: ["#1e3a8a", "#0f766e", "#7c3aed", "#a16207"],
	},
];

export const DEFAULT_PALETTE_ID = "theme";

export function paletteById(id: string | undefined): CanvasPalette {
	if (!id) return CANVAS_PALETTES[0];
	return CANVAS_PALETTES.find((p) => p.id === id) ?? CANVAS_PALETTES[0];
}

/** 调色板第 i 个色的 CSS 值，用于渲染取色点（跟随主题时回落到主题变量）。 */
export function paletteSwatch(palette: CanvasPalette, index: number): string {
	const explicit = palette.series?.[index % 4];
	return explicit ?? `var(--color-series-${(index % 4) + 1})`;
}

/**
 * 生成要挂到编辑器根节点的内联 CSS 变量。
 * 内联声明的优先级高于 `.dbx-root[data-dbx-theme=...]` 这类作者样式，
 * 所以整棵子树（顶栏 + 画布 + 底栏）都会用新配色。
 */
export function paletteStyle(palette: CanvasPalette): CSSProperties | undefined {
	if (!palette.series) return undefined;
	return {
		"--dbx-series-1": palette.series[0],
		"--dbx-series-2": palette.series[1],
		"--dbx-series-3": palette.series[2],
		"--dbx-series-4": palette.series[3],
	} as CSSProperties;
}
