/**
 * VisualizationTemplateDialog — 可视化模板选择对话框
 *
 * 提供预设模板选择和自定义选项
 * 预设模板从 presets 目录导入
 */

import { useEffect, useState, type JSX } from "react";
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
	const kindLabel = type === "dashboard" ? "看板" : "大屏";

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<div className="dbx-modal-backdrop" style={{ zIndex: 200 }} onClick={onClose}>
			<div
				className="flex max-h-[85vh] w-[560px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-2xl shadow-black/50"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
			>
				<div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
					<span
						className={`h-4 w-4 text-muted-foreground ${
							type === "dashboard" ? "icon-[lucide--layout-dashboard]" : "icon-[lucide--monitor]"
						}`}
					/>
					<h3 className="flex-1 text-[12.5px] font-semibold text-foreground">生成{kindLabel}</h3>
					<button
						type="button"
						onClick={onClose}
						title="关闭"
						className="flex h-6 w-6 items-center justify-center rounded text-foreground/70 hover:bg-[var(--dbx-hover)] hover:text-foreground"
					>
						<span className="icon-[lucide--x] h-3.5 w-3.5" />
					</button>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto bg-[var(--dbx-surface)] p-3">
					<div className="mb-3 rounded-md border border-border bg-popover px-3 py-2 text-[11px]">
						<div className="text-muted-foreground">数据源</div>
						<div className="mt-0.5 font-medium text-foreground">
							连接：{connectionName} · 表：{qualifiedName}
						</div>
					</div>

					<div className="mb-2 text-[12px] font-medium text-foreground">选择预设模板</div>
					<div className="grid grid-cols-2 gap-2">
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

					<div className="my-3 flex items-center gap-2">
						<div className="h-px flex-1 bg-[var(--dbx-line)]" />
						<span className="text-[11px] text-muted-foreground">或</span>
						<div className="h-px flex-1 bg-[var(--dbx-line)]" />
					</div>

					<button type="button" className="custom-template-btn" onClick={onCustom}>
						<span className="icon-[lucide--sparkles] h-4 w-4" />
						<span>自定义生成（让 AI 根据数据特征自动选择）</span>
					</button>
				</div>

				<div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-3 py-2.5">
					<button type="button" className="dbx-btn ghost" onClick={onClose}>
						取消
					</button>
					<button
						type="button"
						className="dbx-btn primary"
						disabled={!selectedTemplate}
						onClick={() => selectedTemplate && onSelect(selectedTemplate)}
					>
						<span className="icon-[lucide--play] h-3 w-3" />
						生成
					</button>
				</div>
			</div>
		</div>
	);
}
