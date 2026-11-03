import type { SurfaceMode } from "../../../domain/kernel-document.ts";

/**
 * What each surface offers first.
 *
 * The document model is one model — this table only decides which tools sit in the
 * rail, which swatches are one click away, and what the surface calls itself. A
 * spreadsheet and a storyboard really are the same rectangle-with-guides editor at
 * this level, and pretending otherwise would mean sixteen editors to keep in step
 * instead of one.
 *
 * ADR: docs/adr/<slug>/craft-0011-the-engine-is-ours.md
 */

export type ToolId = "select" | "text" | "rect" | "ellipse" | "line" | "image";

export interface SurfacePreset {
	mode: SurfaceMode;
	label: string;
	tools: ToolId[];
	palette: string[];
	/** Page size when a saved document does not say otherwise. */
	size: { width: number; height: number };
	background: string;
}

const INK = ["#111827", "#475569", "#94a3b8", "#ffffff"];

export function surfacePreset(mode: SurfaceMode): SurfacePreset {
	switch (mode) {
		case "sheet":
			return {
				mode,
				label: "表格",
				tools: ["select", "text", "rect", "line"],
				palette: ["#e8f0fe", "#dbeafe", "#bbf7d0", "#fef3c7", "#fee2e2", ...INK],
				size: { width: 1440, height: 900 },
				background: "#ffffff",
			};
		case "doc":
			return {
				mode,
				label: "文档",
				tools: ["select", "text", "image", "rect"],
				palette: ["#111827", "#334155", "#64748b", "#e2e8f0", "#ffffff", "#fef3c7", "#fee2e2"],
				size: { width: 1000, height: 1414 },
				background: "#ffffff",
			};
		case "stage":
			return {
				mode,
				label: "舞台",
				tools: ["select", "text", "rect", "image", "line"],
				palette: ["#1e293b", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#ffffff"],
				size: { width: 1600, height: 900 },
				background: "#0f172a",
			};
		default:
			return {
				mode: "canvas",
				label: "画布",
				tools: ["select", "rect", "ellipse", "line", "text", "image"],
				palette: ["#2f6df6", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", ...INK],
				size: { width: 1280, height: 800 },
				background: "#ffffff",
			};
	}
}

export const TOOL_LABELS: Record<ToolId, string> = {
	select: "选择",
	text: "文字",
	rect: "矩形",
	ellipse: "椭圆",
	line: "直线",
	image: "图片",
};

export const TOOL_CURSORS: Record<ToolId, string> = {
	select: "default",
	text: "text",
	rect: "crosshair",
	ellipse: "crosshair",
	line: "crosshair",
	image: "copy",
};
