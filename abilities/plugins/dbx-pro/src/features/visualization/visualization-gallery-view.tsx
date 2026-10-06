/**
 * VisualizationGalleryView — 可视化产物管理工作区视图。
 * 
 * 作为侧边栏视图注册，展示所有生成的看板和大屏。
 */

import { useState, type JSX } from "react";
import { VisualizationGallery } from "./components/visualization-gallery";
import { VisualizationPreview } from "./components/visualization-preview";
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
			? buildDashboardPrompt(nodes) + `\n\n请基于当前看板配置进行修改：\n${viz.title}\n模板：${viz.template}`
			: buildScreenPrompt(nodes) + `\n\n请基于当前大屏配置进行修改：\n${viz.title}\n模板：${viz.template}`;
		
		setAiPrompt(prompt);
		setAiDialogOpen(true);
	};

	return (
		<>
			<VisualizationGallery
				onPreview={setPreviewViz}
				onEditWithAi={handleEditWithAi}
			/>

			{previewViz && (
				<VisualizationPreview
					html={previewViz.html}
					title={previewViz.title}
					type={previewViz.type}
					onClose={() => setPreviewViz(null)}
				/>
			)}

			<SendToAiDialog
				open={aiDialogOpen}
				prompt={aiPrompt}
				onClose={() => setAiDialogOpen(false)}
			/>
		</>
	);
}
