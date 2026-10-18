/**
 * Finished runs, kept across restarts.
 *
 * A crawl costs credits and the artifacts are the part worth coming back for, so
 * the last few runs stay on disk. Opening one does not re-run anything: it puts
 * that run's artifacts back on the shelf, where they can be copied, downloaded or
 * handed to the agent exactly like a fresh crawl's.
 */

import { formatCount } from "../../../shared/formatters/format";
import { useTranslate } from "../hooks/use-translate";
import { ARTIFACT_DOT, ARTIFACT_KIND_ORDER } from "../artifact-kinds";
import type { CrawlRunSnapshot } from "../services/crawl-run-store";
import type { RunSummary } from "../services/run-archive";

export function HistoryTab({
	snapshot,
	onRestore,
	onDelete,
}: {
	snapshot: CrawlRunSnapshot;
	onRestore: (id: string) => void;
	onDelete: (id: string) => void;
}) {
	const t = useTranslate();

	if (snapshot.history.length === 0) {
		return <p className="px-1 py-3 text-[11px] text-muted-foreground">{t("console.history.empty")}</p>;
	}

	return (
		<ul className="h-full min-h-0 space-y-0.5 overflow-y-auto py-1">
			{snapshot.history.map((run) => {
				const open = snapshot.archived && snapshot.runId === run.id;
				return (
					<li key={run.id} className={`rounded px-1.5 py-1 ${open ? "bg-muted/60" : "hover:bg-muted/40"}`}>
						<div className="flex items-baseline gap-1.5">
							<span className={`shrink-0 text-[9.5px] uppercase tracking-wide ${statusTone(run.status)}`}>
								{t(`console.history.status.${run.status}`)}
							</span>
							<span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-foreground" title={run.target}>
								{hostOf(run.target)}
							</span>
							<span className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">{when(run.endedAt)}</span>
						</div>
						<div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9.5px] text-muted-foreground">
							<span>
								{formatCount(run.counts.crawled)} {t("console.unit.pages")}
							</span>
							<span>
								{formatCount(run.artifacts)} {t("console.artifacts.unit")}
							</span>
							<span className="flex items-center gap-0.5">
								{ARTIFACT_KIND_ORDER.filter((kind) => (run.kinds[kind] ?? 0) > 0).map((kind) => (
									<span key={kind} className={`h-1 w-1 rounded-full ${ARTIFACT_DOT[kind]}`} title={t(`artifact.kind.${kind}`)} />
								))}
							</span>
							<span className="ml-auto flex items-center gap-0.5">
								<button
									type="button"
									onClick={() => onRestore(run.id)}
									className="rounded px-1.5 py-0.5 text-[10px] text-primary hover:bg-muted disabled:opacity-40"
									disabled={open}
								>
									{t("console.history.restore")}
								</button>
								<button
									type="button"
									onClick={() => onDelete(run.id)}
									className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-destructive"
								>
									{t("console.history.delete")}
								</button>
							</span>
						</div>
					</li>
				);
			})}
		</ul>
	);
}

function statusTone(status: RunSummary["status"]): string {
	if (status === "failed") return "text-destructive";
	if (status === "stopped") return "text-warning";
	return "text-success";
}

function hostOf(target: string): string {
	try {
		const url = new URL(target);
		return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
	} catch {
		return target || "—";
	}
}

function when(at: number): string {
	if (!at) return "";
	const date = new Date(at);
	return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date
		.getMinutes()
		.toString()
		.padStart(2, "0")}`;
}
