/**
 * 中栏装配 — 标签页 + 上编辑器 / 下结果的可拖拽布局。
 * 支持 SQL 查询标签页和可视化产物标签页。
 */

import type { JSX } from "react";
import { HorizontalSplit } from "./horizontal-split";
import { ResultPanel } from "./result-panel";
import { SqlEditor } from "./sql-editor";
import { TabBar } from "./tab-bar";
import { useWorkbench } from "../hooks/use-workbench";
import { VisualizationTab } from "../../visualization/components/VisualizationTab";
import { useVisualizationStore } from "../../visualization/visualization-store";

export function SqlEditorWorkspace(): JSX.Element {
	const { state } = useWorkbench();
	const { visualizations } = useVisualizationStore();

	// 查找当前激活的可视化标签页
	const activeViz = state.activeTabId?.startsWith("viz-")
		? visualizations.find((v) => `viz-${v.id}` === state.activeTabId)
		: null;

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
			<TabBar />
			{activeViz ? (
				<VisualizationTab viz={activeViz} />
			) : (
				<HorizontalSplit top={<SqlEditor />} bottom={<ResultPanel />} />
			)}
		</div>
	);
}
