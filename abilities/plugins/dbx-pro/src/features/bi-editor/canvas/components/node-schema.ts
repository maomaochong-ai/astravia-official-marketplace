/**
 * node-schema.ts — 每种节点 kind 的属性字段 schema。
 *
 * PropertyInspector 按 kind 查 schema → 渲染对应表单。
 * 当前 value 层存储还未接入（NodePos 没有 per-field value），
 * 但 schema + 渲染器已就位，后续加 NodeVal schema 时只需在 Field 组件里把
 * value/onChange 接到正确的 NodePos 字段即可。
 */

export interface NodeField {
	key: string;
	label: string;
	type: "text" | "number" | "select" | "textarea";
	options?: string[];
}

export interface NodeSchema {
	label: string;
	fields: NodeField[];
}

export const NODE_SCHEMA: Record<string, NodeSchema> = {
	_default: {
		label: "默认",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "description", label: "备注", type: "textarea" },
		],
	},

	// ── 数据源 ──
	"source-sql": {
		label: "SQL 查询",
		fields: [
			{ key: "title", label: "名称", type: "text" },
			{ key: "datasourceId", label: "数据源", type: "select", options: ["生产库 MySQL", "本地 SQLite", "StarRocks"] },
			{ key: "sql", label: "SQL", type: "textarea" },
			{ key: "timeout", label: "超时(s)", type: "number" },
		],
	},
	"source-table": {
		label: "表读取",
		fields: [
			{ key: "title", label: "名称", type: "text" },
			{ key: "table", label: "表名", type: "text" },
			{ key: "datasourceId", label: "数据源", type: "select", options: ["生产库 MySQL", "本地 SQLite", "StarRocks"] },
			{ key: "limit", label: "Limit", type: "number" },
		],
	},
	"source-api": {
		label: "HTTP API",
		fields: [
			{ key: "title", label: "名称", type: "text" },
			{ key: "url", label: "URL", type: "text" },
			{ key: "method", label: "Method", type: "select", options: ["GET", "POST"] },
			{ key: "headers", label: "Headers", type: "textarea" },
		],
	},

	// ── 图表 ──
	"chart-bar": {
		label: "柱图",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "xField", label: "X 字段", type: "text" },
			{ key: "yField", label: "Y 字段", type: "text" },
			{ key: "orientation", label: "方向", type: "select", options: ["vertical", "horizontal"] },
			{ key: "stacked", label: "堆叠", type: "select", options: ["no", "yes"] },
		],
	},
	"chart-line": {
		label: "折线图",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "xField", label: "X 字段", type: "text" },
			{ key: "yField", label: "Y 字段", type: "text" },
			{ key: "smooth", label: "平滑", type: "select", options: ["no", "yes"] },
			{ key: "area", label: "面积", type: "select", options: ["no", "yes"] },
		],
	},
	"chart-pie": {
		label: "饼图",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "category", label: "分类字段", type: "text" },
			{ key: "value", label: "值字段", type: "text" },
			{ key: "donut", label: "环形", type: "select", options: ["no", "yes"] },
		],
	},
	"chart-scatter": {
		label: "散点图",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "xField", label: "X 字段", type: "text" },
			{ key: "yField", label: "Y 字段", type: "text" },
			{ key: "sizeField", label: "大小字段", type: "text" },
		],
	},
	"chart-map": {
		label: "地图",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "geoField", label: "地理字段", type: "text" },
			{ key: "valueField", label: "值字段", type: "text" },
			{ key: "mapType", label: "底图", type: "select", options: ["China", "World"] },
		],
	},
	"chart-radar": {
		label: "雷达图",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "indicatorField", label: "指标字段", type: "text" },
			{ key: "valueFields", label: "值字段(逗号分隔)", type: "text" },
		],
	},

	// ── 指标 ──
	"metric-big": {
		label: "大数字",
		fields: [
			{ key: "title", label: "标签", type: "text" },
			{ key: "valueField", label: "值字段", type: "text" },
			{ key: "prefix", label: "前缀", type: "text" },
			{ key: "suffix", label: "后缀", type: "text" },
			{ key: "decimals", label: "小数位", type: "number" },
		],
	},
	"metric-trend": {
		label: "趋势指标",
		fields: [
			{ key: "title", label: "标签", type: "text" },
			{ key: "currentField", label: "当前值", type: "text" },
			{ key: "previousField", label: "上期值", type: "text" },
			{ key: "sparklineField", label: "Sparkline 字段", type: "text" },
		],
	},
	"metric-gauge": {
		label: "仪表盘",
		fields: [
			{ key: "title", label: "标签", type: "text" },
			{ key: "valueField", label: "值字段", type: "text" },
			{ key: "min", label: "Min", type: "number" },
			{ key: "max", label: "Max", type: "number" },
		],
	},

	// ── 筛选 ──
	"filter-select": {
		label: "下拉筛选",
		fields: [
			{ key: "title", label: "标签", type: "text" },
			{ key: "field", label: "绑定字段", type: "text" },
			{ key: "multiple", label: "多选", type: "select", options: ["no", "yes"] },
			{ key: "options", label: "选项(JSON)", type: "textarea" },
		],
	},
	"filter-date": {
		label: "日期筛选",
		fields: [
			{ key: "title", label: "标签", type: "text" },
			{ key: "field", label: "绑定字段", type: "text" },
			{ key: "mode", label: "模式", type: "select", options: ["range", "single"] },
		],
	},
	"filter-input": {
		label: "输入筛选",
		fields: [
			{ key: "title", label: "标签", type: "text" },
			{ key: "field", label: "绑定字段", type: "text" },
			{ key: "placeholder", label: "Placeholder", type: "text" },
		],
	},

	// ── 产物 ──
	"output-table": {
		label: "数据表",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "columns", label: "列(JSON)", type: "textarea" },
			{ key: "pageSize", label: "每页行数", type: "number" },
		],
	},
	"output-text": {
		label: "文本块",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "content", label: "内容模板", type: "textarea" },
		],
	},
	"output-image": {
		label: "图片",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "url", label: "图片 URL", type: "text" },
		],
	},
};
