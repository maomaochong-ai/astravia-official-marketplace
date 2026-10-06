/**
 * VisualizationTemplateDialog — 可视化模板选择对话框
 * 
 * 提供预设模板选择和自定义选项
 */

import { useState, type JSX } from "react";

export type VisualizationType = "dashboard" | "screen";

export interface TemplateOption {
	id: string;
	label: string;
	description: string;
	icon: string;
}

export const DASHBOARD_TEMPLATES: TemplateOption[] = [
	{
		id: "kpi_overview",
		label: "KPI 总览",
		description: "核心指标卡片 + 趋势图 + 分布图，适合业务概览",
		icon: "icon-[lucide--layout-dashboard]",
	},
	{
		id: "trend_analysis",
		label: "趋势分析",
		description: "多维度时间序列 + 同比环比，适合业务趋势洞察",
		icon: "icon-[lucide--trending-up]",
	},
	{
		id: "data_profile",
		label: "数据画像",
		description: "统计摘要 + 分布分析 + 数据质量，适合数据探索",
		icon: "icon-[lucide--bar-chart-3]",
	},
];

export const SCREEN_TEMPLATES: TemplateOption[] = [
	{
		id: "data_command",
		label: "数据指挥中心",
		description: "核心指标 + 趋势 + 实时滚动，60 秒自动刷新",
		icon: "icon-[lucide--monitor]",
	},
	{
		id: "business_intel",
		label: "商业智能大屏",
		description: "多图表组合 + 排行榜 + 趋势对比，120 秒自动刷新",
		icon: "icon-[lucide--briefcase]",
	},
	{
		id: "monitoring",
		label: "系统监控大屏",
		description: "性能指标 + 告警统计 + 健康度仪表盘，30 秒自动刷新",
		icon: "icon-[lucide--activity]",
	},
];

interface Props {
	type: VisualizationType;
	connectionName: string;
	tableName: string;
	schema?: string;
	onSelect: (template: string) => void;
	onCustom: () => void;
	onClose: () => void;
}

export function VisualizationTemplateDialog({
	type,
	connectionName,
	tableName,
	schema,
	onSelect,
	onCustom,
	onClose,
}: Props): JSX.Element {
	const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
	const templates = type === "dashboard" ? DASHBOARD_TEMPLATES : SCREEN_TEMPLATES;

	const qualifiedName = schema ? `${schema}.${tableName}` : tableName;

	return (
		<>
			<div className="dbx-modal-backdrop" onClick={onClose} style={{ zIndex: 200 }} />
			<div className="dbx-modal" style={{ zIndex: 201, maxWidth: 560 }}>
				<div className="dbx-modal-header">
					<h3 className="dbx-modal-title">
						<span className={`icon-[${type === "dashboard" ? "lucide--layout-dashboard" : "lucide--monitor"}] mr-2 h-4 w-4`} />
						生成{type === "dashboard" ? "看板" : "大屏"}
					</h3>
					<button type="button" onClick={onClose} className="dbx-iconbtn">
						<span className="icon-[lucide--x] h-4 w-4" />
					</button>
				</div>

				<div className="dbx-modal-body">
					<div className="mb-4 rounded-md bg-[var(--dbx-surface)] p-3 text-xs">
						<div className="mb-1 text-muted-foreground">数据源</div>
						<div className="font-medium text-foreground">
							连接：{connectionName} · 表：{qualifiedName}
						</div>
					</div>

					<div className="mb-3 text-sm font-medium text-foreground">选择预设模板</div>
					<div className="grid gap-2" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
						{templates.map((template) => (
							<button
								key={template.id}
								type="button"
								className={`template-card ${selectedTemplate === template.id ? "selected" : ""}`}
								onClick={() => setSelectedTemplate(template.id)}
							>
								<div className="template-card-header">
									<span className={`template-icon ${template.icon}`} />
									<span className="template-label">{template.label}</span>
								</div>
								<div className="template-desc">{template.description}</div>
							</button>
						))}
					</div>

					<div className="mt-4 flex items-center gap-2">
						<div className="h-px flex-1 bg-[var(--dbx-line)]" />
						<span className="text-xs text-muted-foreground">或</span>
						<div className="h-px flex-1 bg-[var(--dbx-line)]" />
					</div>

					<button
						type="button"
						className="custom-template-btn"
						onClick={onCustom}
					>
						<span className="icon-[lucide--sparkles] h-4 w-4" />
						<span>自定义生成（让 AI 根据数据特征自动选择）</span>
					</button>
				</div>

				<div className="dbx-modal-footer">
					<button type="button" className="dbx-btn ghost" onClick={onClose}>
						取消
					</button>
					<button
						type="button"
						className="dbx-btn primary"
						disabled={!selectedTemplate}
						onClick={() => selectedTemplate && onSelect(selectedTemplate)}
					>
						<span className="icon-[lucide--play] mr-1 h-3 w-3" />
						生成
					</button>
				</div>
			</div>
		</>
	);
}
