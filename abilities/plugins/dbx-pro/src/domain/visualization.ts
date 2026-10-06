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
	/**
	 * Canvas 渲染模式的顶层数据（ADR-0005 §5）。
	 * 从 SQL 执行结果集直接带入，无需 preset 模板——Canvas 用 inferLayout 规则引擎自动推断布局。
	 * 同时存在 charts/widgets（preset 模式）和 resultRows（Canvas 模式）时，Canvas 优先。
	 */
	resultColumns?: string[];
	resultRows?: Array<Record<string, unknown>>;
	/**
	 * v0.0.94 多数据源路径：当预设模板包含多个独立查询时（如 kpi_overview + 趋势 + 分布），
	 * 每个查询保持各自的数据形状传给 Canvas，让 inferLayout 独立为每个数据源生成图表候选，
	 * 再统一栅格打包。dataSources 存在时 Canvas 优先走这条路；resultColumns/resultRows 保留作 legacy fallback。
	 */
	dataSources?: Array<{
		id: string;
		label: string;
		columns: string[];
		rows: Array<Record<string, unknown>>;
	}>;
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
