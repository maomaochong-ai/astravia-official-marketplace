/**
 * The shelf: everything this run captured, sorted by type instead of by page.
 *
 * The Pages tab answers "what did the crawler read?"; this tab answers "what did
 * it bring back, and what can I do with it now?". Each artifact can be previewed,
 * copied, downloaded, opened at its source, or handed to the agent with its own
 * contents inlined — which is the point of keeping them around after the run.
 */

import { useState } from "react";
import {
	artifactExtension,
	artifactText,
	artifactTotals,
	type ArtifactKind,
	type CrawlArtifact,
} from "../../../domain/firecrawl/artifacts";
import { formatBytes, formatCount } from "../../../shared/formatters/format";
import { openExternal } from "../../../shared/open-external";
import { copyText, filenameFor, saveText } from "../../../shared/text-export";
import { getPluginContext } from "../../../runtime/plugin-context";
import { askAgent, excerptOf } from "../../../runtime/ai-bridge";
import { useTranslate } from "../hooks/use-translate";
import { ARTIFACT_DOT, ARTIFACT_KIND_ORDER, ARTIFACT_LABEL_KEY } from "../artifact-kinds";
import type { CrawlRunSnapshot } from "../services/crawl-run-store";

type Filter = ArtifactKind | "all";

export function ArtifactsTab({ snapshot }: { snapshot: CrawlRunSnapshot }) {
	const t = useTranslate();
	const [filter, setFilter] = useState<Filter>("all");
	const [selected, setSelected] = useState<string | null>(null);
	const [flash, setFlash] = useState<string | null>(null);

	const totals = artifactTotals(snapshot.artifacts);
	const present = ARTIFACT_KIND_ORDER.filter((kind) => (totals.byKind[kind] ?? 0) > 0);
	const shown = filter === "all" ? snapshot.artifacts : snapshot.artifacts.filter((entry) => entry.kind === filter);

	const announce = (message: string) => {
		setFlash(message);
		setTimeout(() => setFlash(null), 1_800);
	};

	const fail = (message: string) => getPluginContext().ui.notify({ message, error: true });

	const copy = async (artifact: CrawlArtifact) => {
		if (await copyText(artifactText(artifact))) announce(t("console.preview.copied"));
		else fail(t("console.preview.copyFailed"));
	};

	const download = (artifact: CrawlArtifact) => {
		const name = `${artifact.kind}-${filenameFor(artifact.source || "artifact", artifactExtension(artifact.kind))}`;
		if (saveText(name, artifactText(artifact))) announce(t("console.preview.saved"));
		else fail(t("console.preview.saveFailed"));
	};

	const ask = (artifact: CrawlArtifact) => {
		const prompt = t("ai.ask.prompt", {
			kind: t(ARTIFACT_LABEL_KEY[artifact.kind]),
			title: artifact.title,
			source: artifact.source,
			excerpt: excerptOf(artifact),
		});
		void askAgent(prompt)
			.then((outcome) => announce(t(`ai.ask.${outcome.status}`)))
			.catch(() => fail(t("ai.ask.failed")));
	};

	if (snapshot.artifacts.length === 0) {
		// An empty shelf after a failed run reads as "nothing happened"; the reason
		// lives on the console tab, so at least name it here.
		if (snapshot.status === "failed") {
			return (
				<div className="flex flex-col gap-1 px-1 py-3 text-[11px]">
					<p className="text-destructive">{t("console.artifacts.failed")}</p>
					{snapshot.lastError ? (
						<p className="break-words text-muted-foreground">{snapshot.lastError}</p>
					) : null}
					<p className="text-muted-foreground">{t("console.artifacts.failedHint")}</p>
				</div>
			);
		}
		return <p className="px-1 py-3 text-[11px] text-muted-foreground">{t("console.artifacts.empty")}</p>;
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 pb-1">
				<Chip
					active={filter === "all"}
					label={t("console.artifacts.all")}
					count={totals.total}
					onClick={() => setFilter("all")}
				/>
				{present.map((kind) => (
					<Chip
						key={kind}
						active={filter === kind}
						dot={ARTIFACT_DOT[kind]}
						label={t(ARTIFACT_LABEL_KEY[kind])}
						count={totals.byKind[kind] ?? 0}
						onClick={() => setFilter(kind)}
					/>
				))}
				<span className="ml-auto shrink-0 pr-1 font-mono text-[9.5px] text-muted-foreground">
					{formatBytes(totals.bytes)}
				</span>
			</div>

			{flash ? <div className="shrink-0 px-1 pt-1 text-[10px] text-emerald-600 dark:text-emerald-400">{flash}</div> : null}

			<ul aria-label={t("console.tab.artifacts")} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto py-1">
				{shown.map((artifact) => {
					const open = selected === artifact.id;
					return (
						<li key={artifact.id} className="rounded">
							<button
								type="button"
								onClick={() => setSelected(open ? null : artifact.id)}
								aria-expanded={open}
								className="flex w-full items-start gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-muted/60"
							>
								<span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${ARTIFACT_DOT[artifact.kind]}`} />
								<span className="min-w-0 flex-1">
									<span className="flex items-baseline gap-1.5">
										<span className="shrink-0 font-mono text-[8.5px] uppercase tracking-wide text-muted-foreground">
											{t(ARTIFACT_LABEL_KEY[artifact.kind])}
										</span>
										<span className="min-w-0 truncate text-[11.5px] font-medium text-foreground">{artifact.title}</span>
									</span>
									<span className="mt-0.5 block truncate font-mono text-[9px] text-muted-foreground">{artifact.source}</span>
								</span>
								<span className="mt-0.5 shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">
									{artifact.items ? formatCount(artifact.items.length) : formatBytes(artifact.bytes)}
								</span>
							</button>

							{open ? (
								<div className="space-y-1 px-1.5 pb-2">
									<div className="flex flex-wrap items-center gap-1">
										<Action label={t("console.artifacts.ask")} onClick={() => ask(artifact)} primary />
										<Action label={t("console.preview.copy")} onClick={() => void copy(artifact)} />
										<Action label={t("console.preview.download")} onClick={() => download(artifact)} />
										<Action
											label={t("console.preview.open")}
											onClick={() => {
												void openExternal(artifact.source).catch(() => fail(t("console.preview.openFailed")));
											}}
										/>
									</div>
									{artifact.items ? (
										<ul className="max-h-48 space-y-0.5 overflow-y-auto rounded bg-muted/30 p-1.5">
											{artifact.items.map((item) => (
												<li key={item} className="break-all font-mono text-[9.5px] leading-snug text-muted-foreground">
													{item}
												</li>
											))}
										</ul>
									) : (
										<pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-1.5 font-mono text-[10px] leading-relaxed text-foreground">
											{artifact.text ?? ""}
										</pre>
									)}
								</div>
							) : null}
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function Chip({
	active,
	dot,
	label,
	count,
	onClick,
}: {
	active: boolean;
	dot?: string;
	label: string;
	count: number;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
				active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
			}`}
		>
			{dot ? <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> : null}
			<span>{label}</span>
			<span className="tabular-nums text-muted-foreground">{count}</span>
		</button>
	);
}

function Action({ label, primary, onClick }: { label: string; primary?: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`rounded px-1.5 py-0.5 text-[10px] transition-colors hover:bg-muted ${
				primary ? "text-primary" : "text-muted-foreground"
			}`}
		>
			{label}
		</button>
	);
}
