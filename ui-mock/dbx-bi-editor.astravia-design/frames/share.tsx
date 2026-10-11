export const frame = { width: 1440, height: 1000, title: "BI · 发布到工作树与分享" };

import CanvasStrip from "../components/editor/CanvasStrip";
import EditorStatusBar from "../components/editor/EditorStatusBar";
import EditorToolbar from "../components/editor/EditorToolbar";
import NodeGraph from "../components/editor/NodeGraph";
import NodeLibrary from "../components/editor/NodeLibrary";
import PropertyInspector from "../components/editor/PropertyInspector";
import PublishDialog from "../components/editor/PublishDialog";

/**
 * 发布与分享 —— 画布跑通之后，把这一版存进 BI 工作树，再决定给谁看。
 * 遮住整个编辑器而不是只遮画布：发布是一次对外承诺，用户在按下之前不该再摸画布。
 */
export default function PublishAndShare() {
	return (
		<div className="relative flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<EditorToolbar />
			<div className="flex min-h-0 flex-1">
				<NodeLibrary />
				<div className="flex min-w-0 flex-1 flex-col">
					<CanvasStrip />
					<NodeGraph />
				</div>
				<PropertyInspector />
			</div>
			<EditorStatusBar />
			<PublishDialog />
		</div>
	);
}
