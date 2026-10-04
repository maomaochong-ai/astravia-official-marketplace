/**
 * 中栏装配 — 标签页 + 上编辑器 / 下结果的可拖拽布局。
 */

import type { JSX } from "react";
import { HorizontalSplit } from "./horizontal-split";
import { ResultPanel } from "./result-panel";
import { SqlEditor } from "./sql-editor";
import { TabBar } from "./tab-bar";

export function SqlEditorWorkspace(): JSX.Element {
	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
			<TabBar />
			<HorizontalSplit top={<SqlEditor />} bottom={<ResultPanel />} />
		</div>
	);
}
