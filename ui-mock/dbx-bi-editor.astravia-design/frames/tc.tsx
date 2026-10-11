export const frame = { width: 360, height: 1000, title: "T · 节点参数" };

import PropertyInspector from "../components/editor/PropertyInspector";

export default function T() {
	return (
		<div className="flex h-full w-full justify-end overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<PropertyInspector />
		</div>
	);
}
