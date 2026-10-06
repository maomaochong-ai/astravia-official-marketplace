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
import { VisualizationTab } from "../../visualization/components/visualization-tab";

export function SqlEditorWorkspace(): JSX.Element {
	const { state } = useWorkbench();

	// 查找当前激活的标签页
	const activeTab = state.tabs.find((t) => t.id === state.activeTabId);

	// 如果是可视化标签页，显示可视化内容
	if (activeTab?.visualization) {
		return (
			<div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
				<TabBar />
				<VisualizationTab viz={activeTab.visualization} />
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
			<TabBar />
			<HorizontalSplit top={<SqlEditor />} bottom={<ResultPanel />} />
		</div>
	);
}
