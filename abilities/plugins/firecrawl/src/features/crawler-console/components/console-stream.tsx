/**
 * Live console, page list and element ledger for one run.
 *
 * The lines are already produced by the store (one line per decision), so this
 * component only formats them: no timers, no polling. Auto-follow stops as soon
 * as the user scrolls up, and resumes when they scroll back to the bottom.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { CrawlRunSnapshot, ConsoleLevel, ElementTotals } from "../services/crawl-run-store";
import type { MediaRef } from "../../../domain/html/elements";
import { useTranslate } from "../hooks/use-translate";
import { formatClock, formatCount, formatDuration, truncate } from "../../../shared/formatters/format";

const LEVEL_CLASS: Record<ConsoleLevel, string> = {
	info: "text-muted-foreground",
	ok: "text-foreground",
	warn: "text-warning",
	error: "text-destructive",
	deny: "text-muted-foreground/80",
};

const ISSUE_LEVELS: readonly ConsoleLevel[] = ["warn", "error", "deny"];

type Tab = "console" | "pages" | "elements";

export function ConsoleStream({
	snapshot,
	active,
}: {
	snapshot: CrawlRunSnapshot;
	active: boolean;
}): ReactElement {
	const t = useTranslate();
	const [view, setView] = useState<Tab>("console");
	const [issuesOnly, setIssuesOnly] = useState(false);
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const followRef = useRef(true);

	const lines = useMemo(
		() => (issuesOnly ? snapshot.lines.filter((line) => ISSUE_LEVELS.includes(line.level)) : snapshot.lines),
		[issuesOnly, snapshot.lines],
	);

	useEffect(() => {
		if (view !== "console" || !followRef.current) return;
		const node = scrollRef.current;
		if (node) node.scrollTop = node.scrollHeight;
	}, [snapshot.lines.length, view, active, issuesOnly]);

	const onScroll = (): void => {
		const node = scrollRef.current;
		if (!node) return;
		followRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
	};

	const tabs: Tab[] = ["console", "pages", "elements"];
	const counts: Record<Tab, number> = {
		console: lines.length,
		pages: snapshot.pages.length,
		elements: snapshot.elements.media.length,
	};

	return (
		<section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
			<div className="flex items-center gap-1 border-b border-border/60 px-1.5 py-1">
				{tabs.map((key) => (
					<button
						key={key}
						type="button"
						onClick={() => setView(key)}
						className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
							view === key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
						}`}
					>
						{t(`console.tab.${key}`)}
						{counts[key] > 0 ? <span className="ml-1 font-mono text-[10px] opacity-70">{counts[key]}</span> : null}
					</button>
				))}
				{view === "console" ? (
					<button
						type="button"
						onClick={() => setIssuesOnly((value) => !value)}
						aria-pressed={issuesOnly}
						className={`ml-2 rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
							issuesOnly
								? "border-warning/50 bg-warning/10 text-warning"
								: "border-border/60 text-muted-foreground hover:text-foreground"
						}`}
					>
						{t("console.filter.issues")}
					</button>
				) : null}
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
					{lines.length === 0 ? (
						<p className="text-muted-foreground">{t(issuesOnly ? "console.filter.empty" : "console.empty")}</p>
					) : (
						lines.map((line) => (
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
			) : view === "pages" ? (
				<div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5 text-[11px]">
					{snapshot.pages.length === 0 ? (
						<p className="text-muted-foreground">{t("console.pages.empty")}</p>
					) : (
						<ul className="flex flex-col gap-1">
							{snapshot.pages.map((page) => (
								<li key={page.url} className="flex items-baseline gap-2">
									<span className="shrink-0 font-mono text-[10px] text-muted-foreground">d{page.depth}</span>
									<span className="shrink-0 font-mono text-[9.5px] text-muted-foreground/80">{page.engine}</span>
									<span className="min-w-0 flex-1 truncate" title={page.url}>
										{page.title || truncate(page.url, 60)}
									</span>
									{page.elements?.videos || page.elements?.audio ? (
										<span className="shrink-0 font-mono text-[9.5px] text-primary">
											{`v${page.elements?.videos ?? 0}/a${page.elements?.audio ?? 0}`}
										</span>
									) : null}
									<span className="shrink-0 font-mono text-[10px] text-muted-foreground">
										{formatCount(page.chars)}
									</span>
								</li>
							))}
						</ul>
					)}
				</div>
			) : (
				<ElementLedger snapshot={snapshot} />
			)}
		</section>
	);
}

function ElementLedger({ snapshot }: { snapshot: CrawlRunSnapshot }): ReactElement {
	const t = useTranslate();
	const totals = snapshot.elements;
	const rows: Array<{ key: Exclude<keyof ElementTotals, "media" | "streamed">; label: string }> = [
		{ key: "headings", label: "spider.el.headings" },
		{ key: "paragraphs", label: "spider.el.paragraphs" },
		{ key: "links", label: "spider.el.links" },
		{ key: "images", label: "spider.el.images" },
		{ key: "videos", label: "spider.el.videos" },
		{ key: "audio", label: "spider.el.audio" },
		{ key: "code", label: "spider.el.code" },
		{ key: "tables", label: "spider.el.tables" },
	];

	const byKind = useMemo(() => {
		const groups: Record<MediaRef["kind"], MediaRef[]> = { image: [], video: [], audio: [] };
		for (const entry of totals.media) groups[entry.kind].push(entry);
		return groups;
	}, [totals.media]);

	return (
		<div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5 text-[11px]">
			<div className="flex flex-wrap gap-x-3 gap-y-1 pb-1">
				{rows.map((row) => (
					<span key={row.key} className="font-mono text-[10px] text-muted-foreground">
						{t(row.label)}
						<span className="ml-1 text-foreground">{totals[row.key]}</span>
					</span>
				))}
				{totals.streamed > 0 ? (
					<span className="font-mono text-[10px] text-warning">
						{t("console.elements.streamed", { count: totals.streamed })}
					</span>
				) : null}
			</div>
			{totals.media.length === 0 ? (
				<p className="text-muted-foreground">{t("console.elements.empty")}</p>
			) : (
				(["video", "audio", "image"] as const).map((kind) =>
					byKind[kind].length === 0 ? null : (
						<div key={kind} className="pb-1.5">
							<p className="pb-0.5 font-mono text-[9.5px] tracking-wide text-muted-foreground uppercase">
								{t(`console.elements.kind.${kind}`)} {byKind[kind].length}
							</p>
							<ul className="flex flex-col gap-0.5">
								{byKind[kind].slice(0, 40).map((entry) => (
									<li key={`${kind}-${entry.url}`} className="flex items-baseline gap-1.5">
										<span className="min-w-0 flex-1 truncate font-mono text-[10px]" title={entry.url}>
											{truncate(entry.url, 96)}
										</span>
										{entry.manifest ? (
											<span className="shrink-0 rounded border border-primary/40 px-1 font-mono text-[9px] text-primary">
												{t("console.elements.playlist")}
											</span>
										) : null}
										{entry.label ? (
											<span className="shrink-0 font-mono text-[9px] text-muted-foreground">{entry.label}</span>
										) : null}
									</li>
								))}
							</ul>
						</div>
					),
				)
			)}
		</div>
	);
}
