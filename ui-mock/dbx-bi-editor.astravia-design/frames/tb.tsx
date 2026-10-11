export const frame = { width: 880, height: 900, title: "T · 节点画布" };

import NodeGraph from "../components/editor/NodeGraph";

export default function T() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<NodeGraph />
		</div>
	);
}
