export const frame = { width: 1440, height: 900, title: "T · 磁贴" };

import CanvasTiles from "../components/editor/CanvasTiles";

export default function T() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background p-6 font-sans text-[14px] text-surface-foreground">
			<div className="relative grid min-h-0 flex-1 grid-cols-12 grid-rows-[80px_248px_216px_1fr] gap-3 rounded-card border border-border-strong bg-surface p-4">
				<CanvasTiles preview />
			</div>
		</div>
	);
}
