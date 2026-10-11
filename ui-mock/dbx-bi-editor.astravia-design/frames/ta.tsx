export const frame = { width: 1440, height: 1000, title: "T · 节点库" };

import NodeLibrary from "../components/editor/NodeLibrary";

export default function T() {
	return (
		<div className="flex h-full w-full overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<NodeLibrary />
		</div>
	);
}
