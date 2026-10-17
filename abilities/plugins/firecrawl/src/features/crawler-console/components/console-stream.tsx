/**
 * Live console + page list for one run.
 *
 * The lines are already produced by the store (one line per decision), so this
 * component only formats them: no timers, no polling. Auto-follow stops as soon
 * as the user scrolls up, and resumes when they scroll back to the bottom.
 */

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { CrawlRunSnapshot, ConsoleLevel } from "../services/crawl-run-store";
import { useTranslate } from "../hooks/use-translate";
import { formatClock, formatCount, formatDuration, truncate } from "../../../shared/formatters/format";

const LEVEL_CLASS: Record<ConsoleLevel, string> = {
	info: "text-muted-foreground",
	ok: "text-foreground",
	warn: "text-warning",
	error: "text-destructive",
	deny: "text-muted-foreground/80",
};

export function ConsoleStream({
	snapshot,
	active,
}: {
	snapshot: CrawlRunSnapshot;
	active: boolean;
}): ReactElement {
	const t = useTranslate();
	const [view, setView] = useState<"console" | "pages">("console");
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const followRef = useRef(true);

	useEffect(() => {
		if (view !== "console" || !followRef.current) return;
		const node = scrollRef.current;
		if (node) node.scrollTop = node.scrollHeight;
	}, [snapshot.lines.length, view, active]);

	const onScroll = (): void => {
		const node = scrollRef.current;
		if (!node) return;
		followRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
	};

	return (
		<section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
			<div className="flex items-center gap-1 border-b border-border/60 px-1.5 py-1">
				{(["console", "pages"] as const).map((key) => (
					<button
						key={key}
						type="button"
						onClick={() => setView(key)}
						className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
							view === key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
						}`}
					>
						{t(`console.tab.${key}`)}
						{key === "pages" && snapshot.pages.length > 0 ? (
							<span className="ml-1 font-mono text-[10px] opacity-70">{snapshot.pages.length}</span>
						) : null}
					</button>
				))}
				<span className="ml-auto pr-1 font-mono text-[10px] text-muted-foreground">
					{snapshot.startedAt > 0 ? formatDuration((snapshot.endedAt ?? Date.now()) - snapshot.startedAt) : ""}
				</span>
			</div>

			{view === "console" ? (
				<div
					ref={scrollRef}
					onScroll={onScroll}
					className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5 font-mono text-[10.5px] leading-relaxed"
				>
					{snapshot.lines.length === 0 ? (
						<p className="text-muted-foreground">{t("console.empty")}</p>
					) : (
						snapshot.lines.map((line) => (
							<div key={line.id} className={`flex gap-2 ${LEVEL_CLASS[line.level]}`}>
								<span className="shrink-0 opacity-45">{formatClock(line.at)}</span>
								<span className="break-all whitespace-pre-wrap">{line.text}</span>
							</div>
						))
					)}
					{snapshot.status === "running" ? (
						<span className="motion-safe:animate-fc-blink inline-block h-3 w-1.5 bg-primary align-middle" />
					) : null}
				</div>
			) : (
				<div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5 text-[11px]">
					{snapshot.pages.length === 0 ? (
						<p className="text-muted-foreground">{t("console.pages.empty")}</p>
					) : (
						<ul className="flex flex-col gap-1">
							{snapshot.pages.map((page) => (
								<li key={page.url} className="flex items-baseline gap-2">
									<span className="shrink-0 font-mono text-[10px] text-muted-foreground">d{page.depth}</span>
									<span className="min-w-0 flex-1 truncate" title={page.url}>
										{page.title || truncate(page.url, 60)}
									</span>
									<span className="shrink-0 font-mono text-[10px] text-muted-foreground">
										{formatCount(page.chars)}
									</span>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</section>
	);
}
