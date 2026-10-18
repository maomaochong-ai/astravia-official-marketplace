/**
 * What an agent-issued crawl looks like inside the transcript.
 *
 * Without this the user reads a wall of text and never finds the console, which is
 * where the crawl is actually visible. The card keeps the tool's own result, adds
 * the live page counts while the run is going, and opens the console anchored on
 * the same conversation directory.
 */

import { useActiveConversation, type PluginToolCallSlotProps } from "@astravia-org/plugin-sdk";
import { FIRECRAWL_TAB_ID } from "../../../tab-id";
import { useCrawlRun } from "../hooks/use-crawl-run";
import { useTranslate } from "../hooks/use-translate";
import { getConsoleDeps } from "../deps";
import type { CrawlRunStore } from "../services/crawl-run-store";

export function CrawlToolCall({ toolCall }: PluginToolCallSlotProps) {
	const deps = getConsoleDeps();
	if (!deps) return <Fallback toolCall={toolCall} />;
	return <Live toolCall={toolCall} store={deps.store} />;
}

function Live({ toolCall, store }: PluginToolCallSlotProps & { store: CrawlRunStore }) {
	const t = useTranslate();
	const snapshot = useCrawlRun(store);
	const deps = getConsoleDeps();
	const conversation = useActiveConversation();
	const url = typeof toolCall.args.url === "string" ? toolCall.args.url : "";
	const live = snapshot.status === "running" && (!url || snapshot.target === url || snapshot.target === "");

	const openConsole = () => {
		try {
			deps?.ctx.ui.openActivityTab(FIRECRAWL_TAB_ID, {
				width: "max",
				cwd: conversation.cwd ?? undefined,
			});
		} catch (error) {
			deps?.ctx.ui.notify({
				message: error instanceof Error ? error.message : String(error),
				error: true,
			});
		}
	};

	return (
		<div className="rounded-md border border-border/70 bg-background">
			<div className="flex items-center gap-2 border-b border-border/60 px-2 py-1">
				<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotFor(toolCall.status)}`} />
				<span className="shrink-0 text-[11px] font-medium text-foreground">{t("toolCall.title")}</span>
				<span className="min-w-0 flex-1 truncate font-mono text-[9.5px] text-muted-foreground">{url}</span>
				{live ? (
					<span className="shrink-0 font-mono text-[9.5px] tabular-nums text-muted-foreground">
						{snapshot.counts.crawled} / {snapshot.counts.discovered || "?"}
					</span>
				) : null}
				<button
					type="button"
					onClick={openConsole}
					className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-primary hover:bg-muted"
				>
					{t("toolCall.openConsole")}
				</button>
			</div>
			<div className="px-2 py-1.5">
				{toolCall.status === "pending" ? (
					<p className="motion-safe:animate-fc-pulse text-[10.5px] text-muted-foreground">
						{live
							? t("toolCall.progress", {
									pages: snapshot.counts.crawled,
									artifacts: snapshot.artifacts.length,
								})
							: t("toolCall.pending")}
					</p>
				) : toolCall.result ? (
					<pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-1.5 font-mono text-[10px] leading-relaxed text-foreground">
						{toolCall.result}
					</pre>
				) : (
					<p className="text-[10.5px] text-muted-foreground">{t("toolCall.empty")}</p>
				)}
			</div>
		</div>
	);
}

/** Without a plugin runtime there is no store, but the tool call still happened. */
function Fallback({ toolCall }: PluginToolCallSlotProps) {
	const url = typeof toolCall.args.url === "string" ? toolCall.args.url : "";
	return (
		<div className="rounded-md border border-border/70 bg-background px-2 py-1">
			<div className="flex items-center gap-2">
				<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotFor(toolCall.status)}`} />
				<span className="min-w-0 flex-1 truncate font-mono text-[9.5px] text-muted-foreground">{url}</span>
			</div>
			{toolCall.result ? (
				<pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-foreground">
					{toolCall.result}
				</pre>
			) : null}
		</div>
	);
}

function dotFor(status: PluginToolCallSlotProps["toolCall"]["status"]): string {
	if (status === "pending") return "bg-primary motion-safe:animate-fc-blink";
	if (status === "error") return "bg-destructive";
	if (status === "cancelled") return "bg-warning";
	return "bg-emerald-500";
}
