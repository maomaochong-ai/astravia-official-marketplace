/**
 * Media the crawler found: images, video and audio, grouped, with a real preview.
 *
 * The old ledger showed forty truncated URLs and nothing playable, so "what did it
 * actually download?" stayed unanswered. Previewing in place is also the only
 * honest way to check that a stream URL is a real source and not a `blob:` stub.
 */

import { useState } from "react";
import type { MediaRef } from "../../../domain/firecrawl/profile";
import type { CrawlRunSnapshot } from "../services/crawl-run-store";
import { copyText } from "../../../shared/text-export";
import { openExternal } from "../../../shared/open-external";
import { getPluginContext } from "../../../runtime/plugin-context";
import { useTranslate } from "../hooks/use-translate";

const KIND_ORDER: readonly MediaRef["kind"][] = ["image", "video", "audio"];

export function MediaTab({ snapshot }: { snapshot: CrawlRunSnapshot }) {
	const t = useTranslate();
	const [selected, setSelected] = useState<string | null>(null);
	const [kind, setKind] = useState<MediaRef["kind"] | "all">("all");

	const media = snapshot.elements.media;
	const visible = kind === "all" ? media : media.filter((entry) => entry.kind === kind);
	const active = selected ? media.find((entry) => entry.url === selected) : undefined;

	if (media.length === 0) {
		return <p className="px-1 py-3 text-[11px] text-muted-foreground">{t("console.elements.empty")}</p>;
	}

	if (active) {
		return <MediaPreview entry={active} onBack={() => setSelected(null)} />;
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 pb-1">
				{(["all", ...KIND_ORDER] as const).map((entry) => {
					const count = entry === "all" ? media.length : media.filter((item) => item.kind === entry).length;
					if (entry !== "all" && count === 0) return null;
					return (
						<button
							key={entry}
							type="button"
							aria-pressed={kind === entry}
							onClick={() => setKind(entry)}
							className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
								kind === entry ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
							}`}
						>
							{entry === "all" ? t("console.media.all") : t(`console.elements.kind.${entry}`)} {count}
						</button>
					);
				})}
				<span className="ml-auto text-[9.5px] text-muted-foreground">{snapshot.counts.crawled} pages</span>
			</div>
			<ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto py-1">
				{visible.map((entry) => (
					<li key={`${entry.kind}:${entry.url}`}>
						<div className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted/60">
							<span className="w-9 shrink-0 rounded bg-muted px-1 text-center text-[9px] uppercase text-muted-foreground">
								{entry.kind}
							</span>
							<button
								type="button"
								onClick={() => setSelected(entry.url)}
								className="min-w-0 flex-1 truncate text-left font-mono text-[10px] text-muted-foreground hover:text-foreground"
								title={entry.url}
							>
								{entry.url}
							</button>
							{entry.manifest ? <span className="shrink-0 rounded bg-warning/15 px-1 text-[9px] text-warning">HLS/DASH</span> : null}
							{entry.streamed ? <span className="shrink-0 rounded bg-muted px-1 text-[9px] text-muted-foreground">MSE</span> : null}
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}

function MediaPreview({ entry, onBack }: { entry: MediaRef; onBack: () => void }) {
	const t = useTranslate();
	const [flash, setFlash] = useState<string | null>(null);

	const open = () => {
		void openExternal(entry.url).catch(() =>
			getPluginContext().ui.notify({ message: t("console.preview.openFailed"), error: true }),
		);
	};

	const copy = async () => {
		const ok = await copyText(entry.url);
		if (ok) {
			setFlash(t("console.preview.copied"));
			setTimeout(() => setFlash(null), 1_800);
		} else {
			getPluginContext().ui.notify({ message: t("console.preview.copyFailed"), error: true });
		}
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 items-center gap-1.5 border-b border-border/60 pb-1">
				<button type="button" onClick={onBack} className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">
					← {t("console.preview.back")}
				</button>
				<span className="min-w-0 flex-1 truncate font-mono text-[9.5px] text-muted-foreground" title={entry.url}>
					{entry.url}
				</span>
				<button type="button" onClick={copy} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted">
					{t("console.preview.copy")}
				</button>
				<button type="button" onClick={open} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted">
					{t("console.preview.open")}
				</button>
			</div>
			{flash ? <div className="shrink-0 pt-1 text-[10px] text-emerald-600 dark:text-emerald-400">{flash}</div> : null}
			<div className="mt-1 flex min-h-0 flex-1 items-center justify-center overflow-auto rounded bg-muted/30 p-2">
				{entry.kind === "image" ? (
					<img src={entry.url} alt={entry.label ?? ""} loading="lazy" className="max-h-full max-w-full rounded object-contain" />
				) : entry.kind === "video" && !entry.manifest && !entry.streamed ? (
					<video src={entry.url} poster={entry.poster} controls preload="metadata" className="max-h-full max-w-full rounded" />
				) : entry.kind === "audio" ? (
					<audio src={entry.url} controls preload="metadata" className="w-full" />
				) : (
					<div className="text-center text-[11px] text-muted-foreground">
						<p className="font-medium text-foreground">{t(entry.manifest ? "console.media.manifest" : "console.media.streamed")}</p>
						<p className="mt-1 max-w-[36ch]">{t("console.media.explain")}</p>
						<button type="button" onClick={open} className="mt-2 rounded bg-primary/15 px-2 py-1 text-primary">
							{t("console.preview.open")}
						</button>
					</div>
				)}
			</div>
			{entry.label ? <div className="shrink-0 pt-1 text-[9.5px] text-muted-foreground">{entry.label}</div> : null}
		</div>
	);
}
