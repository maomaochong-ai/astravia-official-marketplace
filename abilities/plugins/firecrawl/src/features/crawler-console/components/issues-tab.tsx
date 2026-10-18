/**
 * Issues: what the crawl could not get, and why.
 *
 * A finished run reports `completed` even when a third of it was refused, so the
 * failures were previously only visible by scrolling the log for red lines. This
 * tab lifts them out: refused URLs with the upstream denial code, pages that
 * errored, and the warnings the log recorded — each one a link, because the usual
 * next step is opening the page that refused us.
 */

import { useMemo } from "react";
import type { ConsoleLine, CrawlRunSnapshot } from "../services/crawl-run-store";
import { openExternal } from "../../../shared/open-external";
import { getPluginContext } from "../../../runtime/plugin-context";
import { useTranslate } from "../hooks/use-translate";

const WARNING_LEVELS = new Set<ConsoleLine["level"]>(["warn", "error", "deny"]);

export function IssuesTab({ snapshot }: { snapshot: CrawlRunSnapshot }) {
	const t = useTranslate();

	const blocked = useMemo(() => snapshot.nodes.filter((node) => node.state === "denied" || node.state === "failed"), [snapshot.nodes]);
	const warnings = useMemo(() => snapshot.lines.filter((line) => WARNING_LEVELS.has(line.level)), [snapshot.lines]);
	const codes = Object.entries(snapshot.denialsByCode).sort((a, b) => b[1] - a[1]);

	if (blocked.length === 0 && warnings.length === 0 && codes.length === 0) {
		return <p className="px-1 py-3 text-[11px] text-muted-foreground">{t("console.issues.empty")}</p>;
	}

	const open = (url: string) => {
		void openExternal(url).catch(() => getPluginContext().ui.notify({ message: t("console.preview.openFailed"), error: true }));
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 pb-1 text-[9.5px] text-muted-foreground">
				<span>
					{snapshot.counts.denied} {t("console.issues.denied")}
				</span>
				<span>·</span>
				<span>
					{snapshot.counts.failed} {t("console.issues.failed")}
				</span>
				{codes.length > 0 ? (
					<>
						<span>·</span>
						<span className="flex flex-wrap gap-1">
							{codes.map(([code, count]) => (
								<span key={code} className="rounded bg-destructive/10 px-1 font-mono text-[9px] text-destructive">
									{code} × {count}
								</span>
							))}
						</span>
					</>
				) : null}
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto py-1">
				{/* A run that produced nothing but refusals needs the reason spelled out,
				    otherwise the tab only lists URLs and reads like a plugin failure. */}
				{snapshot.counts.crawled === 0 && snapshot.counts.denied > 0 ? (
					<p className="mb-1.5 rounded border border-destructive/30 bg-destructive/5 px-1.5 py-1 text-[9.5px] leading-snug text-destructive">
						{t("console.issues.nothingCrawled")}
					</p>
				) : null}
				{blocked.length > 0 ? (
					<section className="mb-1.5">
						<h3 className="px-1 text-[10px] font-medium text-foreground">
							{t("console.issues.denied")} / {t("console.issues.failed")}
						</h3>
						<ul className="mt-0.5 space-y-px">
							{blocked.map((node) => (
								<li key={node.id} className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted/60">
									<span
										className={`w-11 shrink-0 rounded px-1 text-center text-[9px] ${
											node.state === "denied" ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning"
										}`}
									>
										{node.code ?? node.state}
									</span>
									<button
										type="button"
										onClick={() => open(node.url)}
										className="min-w-0 flex-1 truncate text-left font-mono text-[9.5px] text-muted-foreground hover:text-foreground"
										title={node.url}
									>
										{node.url}
									</button>
								</li>
							))}
						</ul>
					</section>
				) : null}
				{warnings.length > 0 ? (
					<section>
						<h3 className="px-1 text-[10px] font-medium text-foreground">{t("console.issues.warning")}</h3>
						<ul className="mt-0.5 space-y-px">
							{warnings.map((line) => (
								<li key={line.id} className="flex items-start gap-1.5 rounded px-1 py-0.5 text-[9.5px] text-muted-foreground">
									<span className="w-11 shrink-0 font-mono text-[9px] uppercase">{line.level}</span>
									<span className="min-w-0 flex-1 break-words">{line.text}</span>
								</li>
							))}
						</ul>
					</section>
				) : null}
			</div>
		</div>
	);
}
