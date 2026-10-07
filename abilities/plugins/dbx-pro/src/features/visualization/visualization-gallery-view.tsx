/**
 * VisualizationGalleryView — 可视化产物管理工作区视图。
 *
 * 在数据库工作台中栏以内部标签页（tab-gallery）打开，展示所有生成的看板和大屏；
 * 不使用遮罩层/独立窗口，避免遮挡宿主或与活动栏冲突。
 */

import { useState, type JSX } from "react";
import { VisualizationGallery } from "./components/visualization-gallery";
import { VisualizationTab } from "./components/visualization-tab";
import type { StoredVisualization } from "./visualization-store";
import { buildResultVizPrompt } from "../../shared/ai/send-context";
import { SendToAiDialog } from "../database-workspace/components/send-to-ai-dialog";

export function VisualizationGalleryView(): JSX.Element {
	const [previewViz, setPreviewViz] = useState<StoredVisualization | null>(null);
	const [aiDialogOpen, setAiDialogOpen] = useState(false);
	const [aiPrompt, setAiPrompt] = useState("");

	const handleEditWithAi = (viz: StoredVisualization): void => {
		// AI 修改 prompt：给出当前看板的完整上下文（connection + sql + chartItems）
		const themeName = viz.type === "dashboard" ? "看板" : "大屏";
		const chartSummaries = (viz.chartItems ?? [])
			.map((c, i) => `  ${i + 1}. [${c.type}] ${c.title ?? "(无标题)"}`)
			.join("\n");

		let prompt = `请帮我修改已生成的${themeName}「${viz.title}」。\n\n`;
		prompt += `连接：@\`${viz.connection}\`\n`;
		if (viz.table) prompt += `关联表：@\`${viz.table}\`\n`;
		if (viz.sql) {
			prompt += `\n源 SQL：\n\`\`\`sql\n${viz.sql}\n\`\`\`\n`;
		}
		prompt += `\n当前有 ${viz.chartItems?.length ?? 0} 个图表：\n${chartSummaries || "（空）"}\n`;
		prompt += `\n请用 dbx_query_full 重新查询（或基于现有 SQL 调整聚合维度），`;
		prompt += `然后用 render_chart 生成新图表，最后用 dbx_chart_collection 打包（type=${viz.type}）。\n`;
		prompt += `可以自由调整图表类型、增加/删除图表、修改聚合维度——根据数据特点决定。`;

		setAiPrompt(prompt);
		setAiDialogOpen(true);
	};

	if (previewViz) {
		return <VisualizationTab viz={previewViz} onClose={() => setPreviewViz(null)} />;
	}

	return (
		<>
			<VisualizationGallery
				onPreview={setPreviewViz}
				onEditWithAi={handleEditWithAi}
			/>

			<SendToAiDialog
				open={aiDialogOpen}
				prompt={aiPrompt}
				onClose={() => setAiDialogOpen(false)}
			/>
		</>
	);
}
