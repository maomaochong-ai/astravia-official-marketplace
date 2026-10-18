/**
 * The console rail: one line per crawl action, classified.
 *
 * Lines used to be undifferentiated text, so a refusal, a robots.txt probe and a
 * successful page fetch all looked the same. The badge column makes the category
 * scannable without changing the message itself.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConsoleKind, CrawlRunSnapshot } from "../services/crawl-run-store";
import { formatClock, formatDuration } from "../../../shared/formatters/format";
import { useTranslate } from "../hooks/use-translate";

const LEVEL_CLASS: Record<string, string> = {
	info: "text-muted-foreground",
	ok: "text-foreground",
	warn: "text-warning",
	error: "text-destructive",
	deny: "text-muted-foreground/80",
};

const KIND_CLASS: Record<ConsoleKind, string> = {
	run: "bg-primary/15 text-primary",
	queue: "bg-muted text-muted-foreground",
	get: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
	deny: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
	fail: "bg-destructive/15 text-destructive",
	note: "bg-muted text-muted-foreground",
};

const ISSUE_LEVELS = new Set(["warn", "error", "deny"]);

export function ConsoleLog({ snapshot }: { snapshot: CrawlRunSnapshot }) {
	const t = useTranslate();
	const [issuesOnly, setIssuesOnly] = useState(false);
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const followRef = useRef(true);

	const lines = useMemo(
		() => (issuesOnly ? snapshot.lines.filter((line) => ISSUE_LEVELS.has(line.level)) : snapshot.lines),
		[snapshot.lines, issuesOnly],
	);

	const onScroll = useCallback(() => {
		const node = scrollRef.current;
		if (!node) return;
		followRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
	}, []);

	useEffect(() => {
		if (!followRef.current) return;
		const node = scrollRef.current;
		if (node) node.scrollTop = node.scrollHeight;
	}, [lines.length, issuesOnly]);

	const duration = formatDuration((snapshot.endedAt ?? Date.now()) - snapshot.startedAt);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 items-center gap-2 border-b border-border/60 pb-1">
				<button
					type="button"
					aria-pressed={issuesOnly}
					onClick={() => setIssuesOnly((value) => !value)}
					className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
						issuesOnly ? "bg-warning/20 text-warning" : "text-muted-foreground hover:bg-muted"
					}`}
				>
					{t("console.filter.issues")}
				</button>
				<span className="text-[10px] text-muted-foreground">
					{lines.length} / {snapshot.lines.length}
				</span>
				<span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">{duration}</span>
			</div>

			<div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto py-1">
				{lines.length === 0 ? (
					<p className="px-1 py-3 text-[11px] text-muted-foreground">
						{issuesOnly ? t("console.filter.empty") : t("console.empty")}
					</p>
				) : (
					<ul className="space-y-0.5">
						{lines.map((line) => (
							<li
								key={line.id}
								className={`flex items-start gap-1.5 rounded px-1 py-0.5 font-mono text-[11px] leading-snug ${
									LEVEL_CLASS[line.level] ?? "text-foreground"
								}`}
							>
								<span className="w-[46px] shrink-0 pt-px opacity-45">{formatClock(line.at)}</span>
								<span
									className={`w-[52px] shrink-0 truncate rounded px-1 text-center text-[9px] font-semibold uppercase tracking-wide ${
										KIND_CLASS[line.kind] ?? KIND_CLASS.note
									}`}
									title={line.kind}
								>
									{t(`console.kind.${line.kind}`)}
								</span>
								<span className="min-w-0 break-all whitespace-pre-wrap">{line.text}</span>
							</li>
						))}
					</ul>
				)}
				{snapshot.status === "running" ? (
					<span className="ml-1 inline-block h-3 w-1.5 bg-primary align-middle motion-safe:animate-fc-blink" />
				) : null}
			</div>
		</div>
	);
}
