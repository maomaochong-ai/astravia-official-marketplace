export const frame = { width: 1440, height: 200, title: "T · 画布头与状态栏" };

import CanvasStrip from "../components/editor/CanvasStrip";
import EditorStatusBar from "../components/editor/EditorStatusBar";

export default function T() {
	return (
		<div className="flex h-full w-full flex-col bg-background font-sans text-[14px] text-surface-foreground">
			<CanvasStrip />
			<div className="flex-1" />
			<EditorStatusBar />
		</div>
	);
}
