export const frame = { width: 1440, height: 1000, title: "BI · 仪表板编辑态（节点式）" };

import CanvasStrip from "../components/editor/CanvasStrip";
import EditorStatusBar from "../components/editor/EditorStatusBar";
import EditorToolbar from "../components/editor/EditorToolbar";
import NodeGraph from "../components/editor/NodeGraph";
import NodeLibrary from "../components/editor/NodeLibrary";
import PropertyInspector from "../components/editor/PropertyInspector";

/**
 * adr-0009 §2.2「仪表板编辑态」的节点式布局，仍然一屏交代四件事，但主语换了：
 * 顶部工具条（返回 / 自动布局 / 主题 / AI 生成节点 / 预览产物 / 运行画布 / 保存）、
 * 左侧节点库（数据源·图表·控件·输出，顶部一行「从数据集生成」）、中间节点画布
 * （6 个节点 + 5 条连线 + 浮动的 AI 写 SQL 面板）、右侧节点参数面板，底栏是一次运行的账。
 *
 * 与 Quick BI 的差别就在这里：那边是「往空白网格里摆组件」，这边是「把数据集、SQL、
 * 图表、产物连成一条数据流」。相同的三栏骨架，中间那一屏从摆盒子变成了搭管子。
 */
export default function Editor() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
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
		</div>
	);
}
