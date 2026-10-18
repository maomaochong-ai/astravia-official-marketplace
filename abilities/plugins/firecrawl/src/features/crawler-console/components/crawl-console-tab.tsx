/**
 * Activity-tab root.
 *
 * Zero props by contract, so the store and the connection config arrive through
 * a closure created in activate(). The tab stays inside the panel rectangle: no
 * portal, no position:fixed, no viewport-height math.
 *
 * The web and the inspector share the body through flexGrow rather than a
 * percentage height: percentages inside a flex column resolve against a
 * container whose height is itself content-driven, which is what used to clip
 * the console. A draggable rail lets the user trade one for the other, and
 * double-clicking it gives the inspector the whole rectangle.
 */

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactElement } from "react";
import { useActivityTab } from "@astravia-org/plugin-sdk";
import type { CrawlRunStore } from "../services/crawl-run-store";
import { useCrawlRun } from "../hooks/use-crawl-run";
import { useTranslate } from "../hooks/use-translate";
import { CrawlControlBar } from "./crawl-control-bar";
import { ConnectionBar } from "./connection-bar";
import { InspectorPanel } from "./inspector-panel";
import { SpiderWebPanel } from "./spider-web-panel";
import { formatBytes, formatCount, formatDuration } from "../../../shared/formatters/format";
import type { FirecrawlConfig } from "../../../runtime/config";

const MIN_SPLIT = 0.18;
const MAX_SPLIT = 0.8;
const DEFAULT_SPLIT = 0.46;

export function CrawlConsoleTab({ store, config }: { store: CrawlRunStore; config: FirecrawlConfig }): ReactElement {
	const { active } = useActivityTab();
	const t = useTranslate();
	const snapshot = useCrawlRun(store);
	const [split, setSplit] = useState(DEFAULT_SPLIT);
	const [expanded, setExpanded] = useState(false);
	const bodyRef = useRef<HTMLDivElement | null>(null);
	const dragRef = useRef<{ clientY: number; height: number; split: number } | null>(null);

	const onRailDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		const height = bodyRef.current?.getBoundingClientRect().height ?? 0;
		if (height <= 0) return;
		dragRef.current = { clientY: event.clientY, height, split };
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const onRailMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag) return;
		// The rail sits above the inspector: dragging it down grows the web.
		const next = drag.split - (event.clientY - drag.clientY) / drag.height;
		setSplit(Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, next)));
	};

	const onRailUp = (event: ReactPointerEvent<HTMLDivElement>) => {
		dragRef.current = null;
		event.currentTarget.releasePointerCapture(event.pointerId);
	};

	return (
		<div className="flex h-full min-h-0 flex-col gap-1.5 overflow-hidden bg-background p-2 text-foreground">
			<header className="flex shrink-0 items-baseline gap-2">
				<h2 className="text-[13px] font-semibold tracking-tight">{t("console.title")}</h2>
				<span className="truncate font-mono text-[10px] text-muted-foreground">
					{snapshot.target || t("console.subtitle")}
				</span>
				{snapshot.counts.discovered > 0 ? (
					<span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
						{t("console.discovered", { count: formatCount(snapshot.counts.discovered) })}
					</span>
				) : null}
			</header>

			<div className="shrink-0">
				<ConnectionBar config={config} />
			</div>

			<div className="shrink-0">
				<CrawlControlBar store={store} snapshot={snapshot} />
			</div>

			<div ref={bodyRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<div
					className="flex min-h-[140px] flex-col overflow-hidden"
					style={expanded ? { display: "none" } : { flexGrow: 1 - split, flexBasis: 0 }}
				>
					<SpiderWebPanel snapshot={snapshot} active={active} />
				</div>

				{expanded ? null : (
					<div
						role="separator"
						aria-orientation="horizontal"
						title={t("console.split.hint")}
						onPointerDown={onRailDown}
						onPointerMove={onRailMove}
						onPointerUp={onRailUp}
						onPointerCancel={onRailUp}
						onDoubleClick={() => setExpanded(true)}
						className="group flex h-1.5 shrink-0 cursor-row-resize touch-none items-center justify-center"
					>
						<span className="h-0.5 w-8 rounded-full bg-border transition-colors group-hover:bg-primary/60" />
					</div>
				)}

				<div
					className="flex min-h-[150px] flex-col overflow-hidden"
					style={{ flexGrow: expanded ? 1 : split, flexBasis: 0 }}
				>
					<InspectorPanel
						snapshot={snapshot}
						store={store}
						expanded={expanded}
						onToggleExpand={() => setExpanded((open) => !open)}
					/>
				</div>
			</div>

			<footer className="flex shrink-0 items-center gap-3 overflow-hidden text-[10px] text-muted-foreground">
				<span className="shrink-0">
					{t("footer.text")} <span className="font-mono text-foreground">{formatCount(snapshot.chars)}</span>
				</span>
				<span className="shrink-0">
					{t("metric.downloaded")} <span className="font-mono text-foreground">{formatBytes(snapshot.bytes)}</span>
				</span>
				{snapshot.creditsUsed !== null ? (
					<span className="truncate">
						{t("metric.credits")} <span className="font-mono text-foreground">{formatCount(snapshot.creditsUsed)}</span>
					</span>
				) : null}
				{snapshot.endedAt ? (
					<span className="ml-auto shrink-0 font-mono">
						{formatDuration(snapshot.endedAt - snapshot.startedAt)}
					</span>
				) : null}
			</footer>
		</div>
	);
}
