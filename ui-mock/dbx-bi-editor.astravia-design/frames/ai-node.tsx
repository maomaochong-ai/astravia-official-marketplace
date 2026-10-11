export const frame = { width: 1440, height: 1000, title: "BI · 节点参数与 AI 填参" };

import { AiGenerateDialog, ParamSuggest } from "../components/editor/AiNodeOverlays";
import CanvasStrip from "../components/editor/CanvasStrip";
import EditorStatusBar from "../components/editor/EditorStatusBar";
import EditorToolbar from "../components/editor/EditorToolbar";
import NodeGraph from "../components/editor/NodeGraph";
import NodeLibrary from "../components/editor/NodeLibrary";
import PropertyInspector from "../components/editor/PropertyInspector";

/**
 * 节点参数与 AI 填参 —— 同一个节点上的两种改法：一句话把整个节点生成出来，
 * 或者只让 AI 动其中一格。两者都只改参数、不写入数据库；改完立刻重绘，
 * 输入输出插座上的连线和产物页面跟着一起变。
 */
export default function NodeParamsWithAi() {
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
						<AiGenerateDialog x={22} y={60} />
						<ParamSuggest x={556} y={226} />
					</div>
				</div>
				<PropertyInspector />
			</div>
			<EditorStatusBar />
		</div>
	);
}
