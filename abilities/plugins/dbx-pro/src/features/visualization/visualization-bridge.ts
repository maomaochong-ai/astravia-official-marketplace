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
	presetId?: string;
	connection: string;
	table: string;
	html: string;
	charts?: Array<{
		id: string;
		type: string;
		title: string;
		columns?: string[];
		rows?: Array<Record<string, unknown>>;
		config?: Record<string, unknown>;
		layout?: Record<string, number>;
	}>;
	widgets?: Array<{
		id: string;
		type: string;
		title: string;
		columns?: string[];
		rows?: Array<Record<string, unknown>>;
		config?: Record<string, unknown>;
		layout?: Record<string, number>;
	}>;
	createdAt?: number;
}

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
