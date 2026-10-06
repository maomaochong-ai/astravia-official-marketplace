/**
 * VisualizationTemplateDialog — 可视化模板选择对话框
 * 
 * 提供预设模板选择和自定义选项
 * 预设模板从 presets 目录导入
 */

import { useState, type JSX } from "react";
import { DASHBOARD_PRESETS } from "../presets/dashboard/presets";
import { SCREEN_PRESETS } from "../presets/screen/presets";

export type VisualizationType = "dashboard" | "screen";

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
	const presets = type === "dashboard" ? DASHBOARD_PRESETS : SCREEN_PRESETS;

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
						{presets.map((preset) => (
							<button
								key={preset.id}
								type="button"
								className={`template-card ${selectedTemplate === preset.id ? "selected" : ""}`}
								onClick={() => setSelectedTemplate(preset.id)}
							>
								<div className="template-card-header">
									<span className={`template-icon ${preset.icon}`} />
									<span className="template-label">{preset.label}</span>
								</div>
								<div className="template-desc">{preset.description}</div>
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
