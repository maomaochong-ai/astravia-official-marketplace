export const frame = { width: 1440, height: 1000, title: "BI · 画布右键添加节点" };

import AddNodeMenu from "../components/editor/AddNodeMenu";
import CanvasStrip from "../components/editor/CanvasStrip";
import EditorStatusBar from "../components/editor/EditorStatusBar";
import EditorToolbar from "../components/editor/EditorToolbar";
import NodeGraph from "../components/editor/NodeGraph";
import NodeLibrary from "../components/editor/NodeLibrary";
import PropertyInspector from "../components/editor/PropertyInspector";

/**
 * 右键加节点 —— 把组件加进画布的那一下。菜单从光标处长出来，画布退到后面去，
 * 因为这一刻用户只做一件事：选一种节点。菜单里带变体、带「双击直接插上次用的」，
 * 是为了让常用的那一次不用真的走完菜单。
 */
export default function CanvasContextMenu() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<EditorToolbar />
			<div className="flex min-h-0 flex-1">
				<NodeLibrary />
				<div className="flex min-w-0 flex-1 flex-col">
					<CanvasStrip />
					<div className="relative flex min-h-0 flex-1">
						<NodeGraph />
						<div className="absolute inset-0 z-20 bg-background/55" />
						<AddNodeMenu x={300} y={236} />
					</div>
				</div>
				<PropertyInspector />
			</div>
			<EditorStatusBar />
		</div>
	);
}
