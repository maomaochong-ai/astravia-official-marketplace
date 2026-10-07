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
import { buildDashboardPrompt, buildScreenPrompt, type SelectedNodeInfo } from "../../shared/ai/send-context";
import { SendToAiDialog } from "../database-workspace/components/send-to-ai-dialog";

export function VisualizationGalleryView(): JSX.Element {
	const [previewViz, setPreviewViz] = useState<StoredVisualization | null>(null);
	const [aiDialogOpen, setAiDialogOpen] = useState(false);
	const [aiPrompt, setAiPrompt] = useState("");

	const handleEditWithAi = (viz: StoredVisualization): void => {
		// 构建 AI 修改提示词
		const nodes: SelectedNodeInfo[] = [{
			kind: "table",
			connectionName: viz.connection,
			label: viz.table,
		}];
		
		const prompt = viz.type === "dashboard"
			? buildDashboardPrompt(nodes) + `\n\n请基于当前看板进行修改：\n${viz.title}\n共 ${viz.chartItems?.length ?? 0} 个图表。`
			: buildScreenPrompt(nodes) + `\n\n请基于当前大屏进行修改：\n${viz.title}\n共 ${viz.chartItems?.length ?? 0} 个图表。`;
		
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
