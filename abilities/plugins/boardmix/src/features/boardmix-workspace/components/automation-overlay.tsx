import { useEffect, useState } from "react";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { useAutomationRun } from "../hooks/use-automation-run";
import { AutomationTimeline } from "./automation-timeline";

/** 跑完后再停留一会儿：太快消失等于没显示给用户看。 */
const LINGER_MS = 6000;

export interface AutomationOverlayProps {
	ctx: PluginContext;
	translate(key: string): string;
}

/**
 * 面板右上角的实时进度。它是**覆盖层**，不挤压 webview，也不拦截点击——
 * 用户随时可以直接在下面的白板上操作。
 */
export function AutomationOverlay(props: AutomationOverlayProps) {
	const run = useAutomationRun(props.ctx);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (!run) return;
		setVisible(true);
		if (run.status === "running") return;
		const endedAt = run.endedAt ? Date.parse(run.endedAt) : Date.now();
		const remaining = Number.isNaN(endedAt) ? 0 : endedAt + LINGER_MS - Date.now();
		const timer = window.setTimeout(() => setVisible(false), Math.max(0, remaining));
		return () => window.clearTimeout(timer);
	}, [run]);

	if (!visible || !run) return null;

	return (
		<div className="pointer-events-none absolute right-3 top-3 z-20 w-64 rounded-lg border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
			<AutomationTimeline run={run} translate={props.translate} />
		</div>
	);
}
