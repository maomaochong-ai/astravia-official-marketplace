/**
 * Captured pages: the list, and a readable preview of what the crawler actually got.
 *
 * The list used to be a dead end — a row said "Docs home" and nothing else. Each
 * row now opens in place, with the markdown, the element counts the crawler saw,
 * copy / download, and a way into the host browser.
 */

import { useState } from "react";
import type { CrawlPageView, CrawlRunSnapshot } from "../services/crawl-run-store";
import { formatBytes, formatCount, formatDuration } from "../../../shared/formatters/format";
import { copyText, filenameFor, saveText } from "../../../shared/text-export";
import { openExternal } from "../../../shared/open-external";
import { getPluginContext } from "../../../runtime/plugin-context";
import { useTranslate } from "../hooks/use-translate";

export function PagesTab({ snapshot }: { snapshot: CrawlRunSnapshot }) {
	const t = useTranslate();
	const [selected, setSelected] = useState<string | null>(null);
	const [flash, setFlash] = useState<string | null>(null);

	const page = selected ? snapshot.pages.find((entry) => entry.url === selected) : undefined;

	const announce = async (pending: boolean | Promise<boolean>, success: string, failure: string) => {
		if (await pending) {
			setFlash(success);
			setTimeout(() => setFlash(null), 1_800);
			return;
		}
		getPluginContext().ui.notify({ message: failure, error: true });
	};

	if (page) {
		return (
			<PagePreview
				page={page}
				flash={flash}
				onBack={() => setSelected(null)}
				onCopy={() => void announce(copyText(page.markdown ?? ""), t("console.preview.copied"), t("console.preview.copyFailed"))}
				onDownload={() => void announce(saveText(filenameFor(page.url), page.markdown ?? ""), t("console.preview.saved"), t("console.preview.saveFailed"))}
				onOpen={() => {
					void openExternal(page.url).catch(() => getPluginContext().ui.notify({ message: t("console.preview.openFailed"), error: true }));
				}}
			/>
		);
	}

	if (snapshot.pages.length === 0) {
		return <p className="px-1 py-3 text-[11px] text-muted-foreground">{t("console.pages.empty")}</p>;
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 items-center gap-2 border-b border-border/60 pb-1 text-[10px] text-muted-foreground">
				<span>
					{snapshot.pages.length} {t("console.unit.pages")}
					{snapshot.counts.denied > 0 ? ` · ${snapshot.counts.denied} ${t("metric.denied")}` : ""}
				</span>
				<button
					type="button"
					className="ml-auto rounded px-1.5 py-0.5 hover:bg-muted disabled:opacity-40"
					disabled={!snapshot.pages.some((entry) => entry.markdown)}
					onClick={() => {
						const bundle = snapshot.pages
							.filter((entry) => entry.markdown)
							.map((entry) => `# ${entry.title || entry.url}\n\n${entry.url}\n\n${entry.markdown}`)
							.join("\n\n---\n\n");
						announce(saveText(`crawl-${filenameFor(snapshot.target || "run", "md")}`, bundle), t("console.preview.saved"), t("console.preview.saveFailed"));
					}}
				>
					{t("console.preview.exportAll")}
				</button>
			</div>
			<ul aria-label={t("console.tab.pages")} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto py-1">
				{snapshot.pages.map((entry) => (
					<li key={entry.url}>
						<button
							type="button"
							onClick={() => setSelected(entry.url)}
							className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-muted/60"
						>
							<span className="mt-px w-7 shrink-0 rounded bg-muted px-1 text-center font-mono text-[9px] text-muted-foreground">
								d{entry.depth}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block break-words text-[11.5px] font-medium leading-snug text-foreground">
									{entry.title || entry.url}
								</span>
								<span className="mt-0.5 block break-all font-mono text-[9.5px] leading-tight text-muted-foreground">
									{entry.url}
								</span>
								<span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9.5px] text-muted-foreground">
									<span>{formatCount(entry.chars)} chars</span>
									{typeof entry.bytes === "number" ? <span>{formatBytes(entry.bytes)}</span> : null}
									{typeof entry.durationMs === "number" ? <span>{formatDuration(entry.durationMs)}</span> : null}
									{entry.linkCount ? <span>{entry.linkCount} links</span> : null}
									{entry.markdown ? null : <span className="text-warning">{t("console.preview.pending")}</span>}
								</span>
							</span>
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

function PagePreview({
	page,
	flash,
	onBack,
	onCopy,
	onDownload,
	onOpen,
}: {
	page: CrawlPageView;
	flash: string | null;
	onBack: () => void;
	onCopy: () => void;
	onDownload: () => void;
	onOpen: () => void;
}) {
	const t = useTranslate();
	const elements = page.elements;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 items-center gap-1.5 border-b border-border/60 pb-1">
				<button type="button" onClick={onBack} className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">
					← {t("console.preview.back")}
				</button>
				<span className="min-w-0 flex-1 truncate text-[11.5px] font-medium" title={page.title || page.url}>
					{page.title || page.url}
				</span>
				<button type="button" onClick={onCopy} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted">
					{t("console.preview.copy")}
				</button>
				<button type="button" onClick={onDownload} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted">
					{t("console.preview.download")}
				</button>
				<button type="button" onClick={onOpen} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted">
					{t("console.preview.open")}
				</button>
			</div>
			<div className="shrink-0 pt-1 font-mono text-[9.5px] break-all text-muted-foreground">{page.finalUrl ?? page.url}</div>
			{elements ? (
				<div className="shrink-0 pt-1 text-[9.5px] text-muted-foreground">
					{t("console.preview.structure")}: {t("spider.el.headings")} {elements.headings} ·{" "}
					{t("spider.el.paragraphs")} {elements.paragraphs} · {t("spider.el.links")} {elements.links} ·{" "}
					{t("spider.el.images")} {elements.images} · {t("spider.el.videos")} {elements.videos} ·{" "}
					{t("spider.el.tables")} {elements.tables}
				</div>
			) : null}
			{flash ? <div className="shrink-0 pt-1 text-[10px] text-emerald-600 dark:text-emerald-400">{flash}</div> : null}
			<div className="mt-1 min-h-0 flex-1 overflow-y-auto rounded bg-muted/30 p-2">
				{page.markdown ? (
					<pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground">{page.markdown}</pre>
				) : (
					<p className="text-[11px] text-muted-foreground">{t("console.preview.pending")}</p>
				)}
			</div>
		</div>
	);
}
