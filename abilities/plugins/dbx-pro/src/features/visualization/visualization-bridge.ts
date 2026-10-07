/**
 * visualization-bridge — 工具与 UI 的桥接层。
 *
 * 工具生成可视化后，通过此模块通知 UI 显示预览。
 * UI 通过注册回调来接收通知。
 *
 * 数据形状定义在 domain/visualization；此处再导出，工具与 UI 的引用路径保持不变。
 */

import type { Visualization } from "../../domain/chart-contract";

export type { Visualization };

type PreviewCallback = (viz: Visualization) => void;
type SaveCallback = (viz: Visualization) => void;

let previewCallback: PreviewCallback | null = null;
let saveCallback: SaveCallback | null = null;

export function setPreviewCallback(callback: PreviewCallback | null): void {
	previewCallback = callback;
}

export function setSaveCallback(callback: SaveCallback | null): void {
	saveCallback = callback;
}

export function showVisualizationPreview(viz: Visualization): void {
	if (previewCallback) {
		previewCallback(viz);
	}
}

export function saveVisualizationToStore(viz: Visualization): void {
	if (saveCallback) {
		saveCallback(viz);
	}
}
