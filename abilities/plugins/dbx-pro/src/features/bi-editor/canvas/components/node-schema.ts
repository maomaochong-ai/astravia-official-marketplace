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
	type: "text" | "number" | "select" | "textarea" | "dimensions" | "measures" | "filters";
	options?: string[];
	/** select 选项的显示名（与 options 一一对应）；省略时直接显示原值。 */
	optionLabels?: string[];
	hint?: string;
}

export interface NodeSchema {
	label: string;
	fields: NodeField[];
}

/**
 * 图表节点共享字段。
 *
 * 维度 / 度量分开是 BI 语义的基础：维度决定分组，度量决定聚合口径。
 * 两者都以 JSON 存在节点 values 里，由 chart-spec.ts 解析。
 */
function chartFields(extra: NodeField[] = [], hint?: string): NodeField[] {
	return [
		{ key: "title", label: "标题", type: "text" },
		{ key: "dimensions", label: "维度", type: "dimensions", hint: hint ?? "按维度分组，不配则整表算一个值" },
		{ key: "measures", label: "度量", type: "measures" },
		{ key: "filters", label: "筛选条件", type: "filters" },
		...extra,
		{ key: "sort", label: "排序", type: "select", options: ["none", "asc", "desc"], optionLabels: ["不排序", "升序", "降序"] },
		{ key: "limit", label: "TopN", type: "number", hint: "留空则不截断" },
		{ key: "legend", label: "图例", type: "select", options: ["no", "yes"], optionLabels: ["隐藏", "显示"] },
		{ key: "labels", label: "数值标签", type: "select", options: ["no", "yes"], optionLabels: ["隐藏", "显示"] },
		{ key: "valueFormat", label: "数值格式", type: "select", options: ["auto", "plain", "thousand", "compact", "percent", "currency"], optionLabels: ["自动", "整数", "千分位", "万 / 亿", "百分比", "金额"] },
	];
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
			{ key: "datasourceId", label: "数据源", type: "select" },
			{ key: "sql", label: "SQL", type: "textarea" },
			{ key: "timeout", label: "超时(s)", type: "number" },
		],
	},
	"source-connector": {
		label: "直连数据源",
		fields: [
			{ key: "title", label: "名称", type: "text" },
			{ key: "connectionId", label: "连接", type: "select" },   // 从 engine connections 动态填充
			{ key: "tableName", label: "选表", type: "text" },
			{ key: "fields", label: "选字段", type: "textarea", hint: "JSON 数组，如 [\"id\", \"amount\"]；留空取全部列" },
			{ key: "limit", label: "最多行数", type: "number" },
		],
	},
	"source-extract": {
		label: "抽取任务",
		fields: [
			{ key: "title", label: "名称", type: "text" },
			{ key: "datasourceId", label: "数据源", type: "select" },
			{ key: "schedule", label: "调度", type: "select", options: ["手动", "每小时", "每天 02:00", "每周一"] },
			{ key: "table", label: "目标表", type: "text" },
		],
	},
	"source-csv": {
		label: "本地 CSV",
		fields: [
			{ key: "title", label: "名称", type: "text" },
			{ key: "content", label: "CSV 内容", type: "textarea", hint: "直接粘贴，逗号 / 制表符分隔均可，首行默认作为表头" },
			{ key: "hasHeader", label: "首行表头", type: "select", options: ["yes", "no"], optionLabels: ["是", "否"] },
		],
	},
	"source-table": {
		label: "表读取",
		fields: [
			{ key: "title", label: "名称", type: "text" },
			{ key: "table", label: "表名", type: "text" },
			{ key: "datasourceId", label: "数据源", type: "select" },
			{ key: "limit", label: "Limit", type: "number" },
		],
	},
	"source-api": {
		label: "HTTP API",
		fields: [
			{ key: "title", label: "名称", type: "text" },
			{ key: "url", label: "URL", type: "text", hint: "返回 JSON；数组或 { data: [...] } 均可" },
			{ key: "method", label: "Method", type: "select", options: ["GET", "POST"] },
			{ key: "headers", label: "Headers", type: "textarea", hint: "JSON 对象，如 {\"Authorization\": \"Bearer …\"}" },
			{ key: "body", label: "Body", type: "textarea", hint: "仅 POST 使用" },
			{ key: "limit", label: "最多行数", type: "number" },
		],
	},

	// ── 图表 ──
	// 所有图表节点共享同一套语义字段：维度 → 分组，度量 → 系列，筛选/排序/TopN → 后处理。
	// 旧页面里只有 xField / yField 时仍按旧路径渲染（见 node-chart-data.ts）。
	"chart-bar": {
		label: "柱状图",
		fields: chartFields([
			{ key: "orientation", label: "方向", type: "select", options: ["vertical", "horizontal"], optionLabels: ["纵向", "横向"] },
			{ key: "stack", label: "堆叠", type: "select", options: ["none", "normal", "percent"], optionLabels: ["不堆叠", "堆叠", "百分比"] },
		]),
	},
	"chart-line": {
		label: "折线图",
		fields: chartFields([
			{ key: "smooth", label: "平滑", type: "select", options: ["no", "yes"], optionLabels: ["关闭", "开启"] },
			{ key: "area", label: "面积", type: "select", options: ["no", "yes"], optionLabels: ["关闭", "开启"] },
		]),
	},
	"chart-area": {
		label: "面积图",
		fields: chartFields([
			{ key: "smooth", label: "平滑", type: "select", options: ["no", "yes"], optionLabels: ["关闭", "开启"] },
			{ key: "stack", label: "堆叠", type: "select", options: ["none", "normal", "percent"], optionLabels: ["不堆叠", "堆叠", "百分比"] },
		]),
	},
	"chart-combo": {
		label: "双轴图",
		fields: chartFields([
			{ key: "smooth", label: "平滑", type: "select", options: ["no", "yes"], optionLabels: ["关闭", "开启"] },
		], "第一个度量画柱、第二个画线"),
	},
	"chart-pie": { label: "饼图", fields: chartFields([]) },
	"chart-donut": {
		label: "环形图",
		fields: chartFields([
			{ key: "innerRadius", label: "内半径(%)", type: "number" },
		]),
	},
	"chart-scatter": {
		label: "散点图",
		fields: chartFields([], "两个度量分别作为横轴与纵轴"),
	},
	"chart-radar": {
		label: "雷达图",
		fields: chartFields([], "维度作为指标轴，每个度量一条包络线"),
	},
	"chart-funnel": { label: "漏斗图", fields: chartFields([]) },
	"chart-gauge": {
		label: "仪表盘",
		fields: chartFields([
			{ key: "yMin", label: "最小值", type: "number" },
			{ key: "yMax", label: "最大值", type: "number" },
		], "度量总计作为指针值"),
	},
	"chart-heatmap": {
		label: "热力图",
		fields: chartFields([], "配置两个维度：第二个维度作为横向分类"),
	},
	"chart-treemap": { label: "矩形树图", fields: chartFields([]) },
	"chart-sankey": {
		label: "桑基图",
		fields: chartFields([], "配置两个维度：第一个作为来源、第二个作为去向"),
	},
	"chart-waterfall": {
		label: "瀑布图",
		fields: chartFields([], "最后一项按总计渲染"),
	},
	"chart-boxplot": {
		label: "箱线图",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "xField", label: "分组字段", type: "text" },
			{ key: "yField", label: "数值字段", type: "text" },
		],
	},
	"chart-kpi": {
		label: "KPI 指标卡",
		fields: [
			{ key: "title", label: "标签", type: "text" },
			{ key: "valueField", label: "值字段（未配度量时的降级字段）", type: "text" },
			{ key: "measures", label: "度量", type: "measures" },
			{ key: "filters", label: "筛选", type: "filters" },
			{ key: "compareField", label: "对比字段", type: "text" },
			{ key: "prefix", label: "前缀", type: "text" },
			{ key: "valueFormat", label: "数值格式", type: "select", options: ["auto", "plain", "thousand", "compact", "percent", "currency"], optionLabels: ["自动", "整数", "千分位", "万 / 亿", "百分比", "金额"] },
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

	// ── 大屏节点 ──
	"screen-page": {
		label: "大屏页面",
		fields: [
			{ key: "title", label: "页面名", type: "text" },
			{ key: "pageCount", label: "页数", type: "number" },
			{ key: "interval", label: "轮播间隔(s)", type: "number" },
		],
	},
	"screen-title": {
		label: "大屏标题",
		fields: [
			{ key: "title", label: "标题文字", type: "text" },
			{ key: "fontSize", label: "字号", type: "number" },
			{ key: "align", label: "对齐", type: "select", options: ["left", "center", "right"] },
		],
	},
	"screen-metric": {
		label: "大屏指标",
		fields: [
			{ key: "title", label: "标签", type: "text" },
			{ key: "valueField", label: "值字段", type: "text" },
			{ key: "unit", label: "单位", type: "text" },
			{ key: "decimals", label: "小数位", type: "number" },
		],
	},
	"screen-rank": {
		label: "大屏排行榜",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "nameField", label: "名称字段", type: "text" },
			{ key: "valueField", label: "值字段", type: "text" },
			{ key: "limit", label: "Top N", type: "number" },
		],
	},
	"screen-carousel": {
		label: "大屏轮播",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "interval", label: "间隔(秒)", type: "number" },
			{ key: "direction", label: "方向", type: "select", options: ["horizontal", "vertical"] },
		],
	},
	"screen-map": {
		label: "大屏地图",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "geoField", label: "地理字段", type: "text" },
			{ key: "valueField", label: "值字段", type: "text" },
			{ key: "layers", label: "图层(JSON)", type: "textarea" },
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
	"filter-text": {
		label: "文本筛选",
		fields: [
			{ key: "title", label: "标签", type: "text" },
			{ key: "field", label: "绑定字段", type: "text" },
			{ key: "placeholder", label: "Placeholder", type: "text" },
		],
	},

	// ── 高级组件 ──
	"adv-summary": {
		label: "统计摘要",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "metric", label: "指标", type: "text" },
			{ key: "source", label: "数据源", type: "select", options: ["无", "选择中..."] },
			{ key: "suffix", label: "后缀", type: "text" },
		],
	},
	"adv-tabs": {
		label: "页签容器",
		fields: [
			{ key: "title", label: "容器名", type: "text" },
			{ key: "tabs", label: "页签(JSON)", type: "textarea" },
			{ key: "defaultTab", label: "默认页", type: "text" },
		],
	},
	"adv-table": {
		label: "明细表格",
		fields: [
			{ key: "title", label: "标题", type: "text" },
			{ key: "columns", label: "列定义(JSON)", type: "textarea" },
			{ key: "pageSize", label: "每页行数", type: "number" },
			{ key: "source", label: "数据源", type: "select", options: ["无", "选择中..."] },
		],
	},
	"adv-calendar": {
		label: "日期选择",
		fields: [
			{ key: "title", label: "标签", type: "text" },
			{ key: "field", label: "绑定字段", type: "text" },
			{ key: "mode", label: "模式", type: "select", options: ["range", "single", "quarter"] },
			{ key: "quickRanges", label: "快捷项", type: "select", options: ["是", "否"] },
		],
	},

	// ── 产物 ──
	"output-page": {
		label: "产物页",
		fields: [
			{ key: "title", label: "页面名称", type: "text" },
			{ key: "layout", label: "布局", type: "select", options: ["grid", "stack", "tabs"] },
			{ key: "description", label: "描述", type: "textarea" },
		],
	},
	"output-publish": {
		label: "发布节点",
		fields: [
			{ key: "title", label: "名称", type: "text" },
			{ key: "channel", label: "渠道", type: "select", options: ["内部链接", "公开链接", "定时邮件"] },
			{ key: "permission", label: "权限", type: "select", options: ["private", "team", "public"] },
		],
	},
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
