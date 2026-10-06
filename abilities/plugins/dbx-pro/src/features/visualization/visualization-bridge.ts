/**
 * visualization-bridge — 工具与 UI 的桥接层。
 * 
 * 工具生成可视化后，通过此模块通知 UI 显示预览。
 * UI 通过注册回调来接收通知。
 */

export interface Visualization {
	id?: string;
	title: string;
	type: "dashboard" | "screen";
	template: string;
	connection: string;
	table: string;
	html: string;
	createdAt?: number;
}

type PreviewCallback = (viz: Visualization) => void;
let previewCallback: PreviewCallback | null = null;

export function setPreviewCallback(callback: PreviewCallback | null): void {
	previewCallback = callback;
}

export function showVisualizationPreview(viz: Visualization): void {
	if (previewCallback) {
		previewCallback(viz);
	}
}
