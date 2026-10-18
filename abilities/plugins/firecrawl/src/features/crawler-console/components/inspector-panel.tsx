/**
 * The bottom half of the console: one rail, eight ways to read the same crawl.
 *
 * It owns only the tab strip and the sizing contract. The console, artifact shelf,
 * pages and media rails stay mounted behind `hidden`, so a preview selection and a
 * scrolled log survive a trip to another tab. The conversation is the exception: it
 * mounts on first selection and stays, because its hooks require an active session.
 *
 * When a run ends the panel moves the user to the shelf — but only from the log,
 * never away from a tab they picked themselves.
 */

import { useEffect, useRef, useState } from "react";
import type { CrawlRunSnapshot, CrawlRunStore } from "../services/crawl-run-store";
import { useTranslate } from "../hooks/use-translate";
import { ConsoleLog } from "./console-log";
import { ArtifactsTab } from "./artifacts-tab";
import { PagesTab } from "./pages-tab";
import { MediaTab } from "./media-tab";
import { LinksTab } from "./links-tab";
import { IssuesTab } from "./issues-tab";
import { HistoryTab } from "./history-tab";
import { ConversationTab } from "./conversation-tab";

type InspectorTab = "artifacts" | "pages" | "links" | "media" | "issues" | "console" | "chat" | "history";

function linkCount(snapshot: CrawlRunSnapshot): number {
	let total = 0;
	for (const artifact of snapshot.artifacts) if (artifact.kind === "links") total += artifact.items?.length ?? 0;
	return total;
}

export function InspectorPanel({
	snapshot,
	store,
	expanded,
	onToggleExpand,
}: {
	snapshot: CrawlRunSnapshot;
	store: CrawlRunStore;
	expanded: boolean;
	onToggleExpand: () => void;
}) {
	const t = useTranslate();
	// The console stays the landing tab: it is the only rail that is useful before
	// the first page arrives, and the conversation hooks must not mount unasked.
	const [tab, setTab] = useState<InspectorTab>("console");
	const [chatMounted, setChatMounted] = useState(false);
	const previous = useRef(snapshot.status);

	useEffect(() => {
		const was = previous.current;
		previous.current = snapshot.status;
		if (was === "running" && snapshot.status !== "running" && tab === "console") setTab("artifacts");
	}, [snapshot.status, tab]);

	const select = (next: InspectorTab) => {
		if (next === "chat") setChatMounted(true);
		setTab(next);
	};

	const tabs: { id: InspectorTab; label: string; count?: number; tone?: string }[] = [
		{ id: "artifacts", label: t("console.tab.artifacts"), count: snapshot.artifacts.length },
		{ id: "pages", label: t("console.tab.pages"), count: snapshot.pages.length },
		{ id: "links", label: t("console.tab.links"), count: linkCount(snapshot) },
		{ id: "media", label: t("console.tab.media"), count: snapshot.elements.media.length },
		{
			id: "issues",
			label: t("console.tab.issues"),
			count: snapshot.counts.denied + snapshot.counts.failed,
			tone: snapshot.counts.denied + snapshot.counts.failed > 0 ? "text-destructive" : undefined,
		},
		{
			id: "console",
			label: t("console.tab.console"),
			count: snapshot.lines.length,
			tone: snapshot.status === "failed" ? "text-destructive" : undefined,
		},
		{ id: "chat", label: t("console.tab.chat") },
		{ id: "history", label: t("console.tab.history"), count: snapshot.history.length },
	];

	return (
		<section className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border/70 bg-background">
			<div className="flex shrink-0 items-center gap-0.5 border-b border-border/70 px-1">
				<div role="tablist" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto py-1">
					{tabs.map((entry) => (
						<button
							key={entry.id}
							type="button"
							aria-selected={tab === entry.id}
							role="tab"
							onClick={() => select(entry.id)}
							className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors ${
								tab === entry.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
							}`}
						>
							<span className={entry.tone}>{entry.label}</span>
							{typeof entry.count === "number" && entry.count > 0 ? (
								<span className="rounded-full bg-background px-1 text-[9px] tabular-nums text-muted-foreground">{entry.count}</span>
							) : null}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={onToggleExpand}
					title={expanded ? t("console.panel.restore") : t("console.panel.expand")}
					aria-label={expanded ? t("console.panel.restore") : t("console.panel.expand")}
					className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					{expanded ? "⤡" : "⤢"}
				</button>
			</div>

			<div className="min-h-0 flex-1 overflow-hidden px-1.5 py-1">
				<div hidden={tab !== "artifacts"} className="h-full min-h-0">
					<ArtifactsTab snapshot={snapshot} />
				</div>
				<div hidden={tab !== "pages"} className="h-full min-h-0">
					<PagesTab snapshot={snapshot} />
				</div>
				<div hidden={tab !== "links"} className="h-full min-h-0">
					<LinksTab snapshot={snapshot} store={store} />
				</div>
				<div hidden={tab !== "media"} className="h-full min-h-0">
					<MediaTab snapshot={snapshot} />
				</div>
				<div hidden={tab !== "issues"} className="h-full min-h-0">
					<IssuesTab snapshot={snapshot} />
				</div>
				<div hidden={tab !== "console"} className="h-full min-h-0">
					<ConsoleLog snapshot={snapshot} />
				</div>
				<div hidden={tab !== "history"} className="h-full min-h-0">
					<HistoryTab
						snapshot={snapshot}
						onRestore={(id) => void store.restore(id)}
						onDelete={(id) => void store.removeArchived(id)}
					/>
				</div>
				{chatMounted ? (
					<div hidden={tab !== "chat"} className="h-full min-h-0">
						<ConversationTab snapshot={snapshot} />
					</div>
				) : null}
			</div>
		</section>
	);
}
