/**
 * 可视化产物契约 — 工具生成、UI 预览/入库共用的那一份数据形状。
 *
 * 放在 domain/ 是分层要求：领域层（会话持久化）必须能引用它，而领域层不得反向
 * 依赖 features/。工具侧与 UI 侧继续从 visualization-bridge 取该类型（bridge 再导出），
 * 因此外部引用路径不变。
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
