export const frame = { width: 1440, height: 1000, title: "BI · 单节点与全部运行" };

import CanvasStrip from "../components/editor/CanvasStrip";
import EditorStatusBar from "../components/editor/EditorStatusBar";
import EditorToolbar from "../components/editor/EditorToolbar";
import NodeGraph from "../components/editor/NodeGraph";
import NodeLibrary from "../components/editor/NodeLibrary";
import PropertyInspector from "../components/editor/PropertyInspector";
import { NodePreviewCard, RunPanel } from "../components/editor/RunOverlay";

/**
 * 运行 —— 单节点和全部节点走同一套账。图表节点跑完先把图回放到节点自己身上，
 * 不用等整屏看板；谁在等上游、谁花了多久，都落在右下角那一列里。画布此时不调暗，
 * 因为运行期间用户还要在画布上继续改。
 */
export default function RunCanvas() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<EditorToolbar />
			<div className="flex min-h-0 flex-1">
				<NodeLibrary />
				<div className="flex min-w-0 flex-1 flex-col">
					<CanvasStrip />
					<div className="relative flex min-h-0 flex-1">
						<NodeGraph />
						<NodePreviewCard x={296} y={252} />
						<RunPanel x={560} y={520} />
					</div>
				</div>
				<PropertyInspector />
			</div>
			<EditorStatusBar />
		</div>
	);
}
