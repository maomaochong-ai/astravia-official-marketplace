/**
 * Links: every outbound URL the run captured, grouped by host.
 *
 * The shelf lists links per page, which is right when you are inspecting one
 * document and useless when the question is "which domains did this site point
 * at?". Here they are pooled, deduplicated and grouped, with the host a one-click
 * next crawl target — the loop a crawl is usually part of.
 */

import { useMemo, useState } from "react";
import type { CrawlRunSnapshot, CrawlRunStore } from "../services/crawl-run-store";
import { openExternal } from "../../../shared/open-external";
import { getPluginContext } from "../../../runtime/plugin-context";
import { useTranslate } from "../hooks/use-translate";

interface LinkGroup {
	host: string;
	urls: string[];
}

function collect(snapshot: CrawlRunSnapshot): LinkGroup[] {
	const seen = new Set<string>();
	const groups = new Map<string, string[]>();
	for (const artifact of snapshot.artifacts) {
		if (artifact.kind !== "links" || !artifact.items) continue;
		for (const raw of artifact.items) {
			const url = raw.trim();
			if (!url || seen.has(url)) continue;
			let host: string;
			try {
				host = new URL(url).host;
			} catch {
				continue;
			}
			seen.add(url);
			const bucket = groups.get(host);
			if (bucket) bucket.push(url);
			else groups.set(host, [url]);
		}
	}
	return [...groups.entries()]
		.map(([host, urls]) => ({ host, urls: urls.sort() }))
		.sort((a, b) => b.urls.length - a.urls.length || a.host.localeCompare(b.host));
}

export function LinksTab({ snapshot, store }: { snapshot: CrawlRunSnapshot; store: CrawlRunStore }) {
	const t = useTranslate();
	const [query, setQuery] = useState("");

	const groups = useMemo(() => collect(snapshot), [snapshot.artifacts]);
	const total = groups.reduce((sum, group) => sum + group.urls.length, 0);

	const filtered = query.trim()
		? groups
				.map((group) => ({ host: group.host, urls: group.urls.filter((url) => url.toLowerCase().includes(query.trim().toLowerCase())) }))
				.filter((group) => group.urls.length > 0)
		: groups;

	if (total === 0) {
		return <p className="px-1 py-3 text-[11px] text-muted-foreground">{t("console.links.empty")}</p>;
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 items-center gap-2 border-b border-border/60 pb-1">
				<span className="text-[10px] text-muted-foreground">
					{t("console.links.count", { count: total })} · {t("console.links.domains", { count: groups.length })}
				</span>
				<input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={t("console.links.search")}
					spellCheck={false}
					className="ml-auto w-40 min-w-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] outline-none focus:border-primary"
				/>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto py-1">
				{filtered.map((group) => (
					<section key={group.host} className="mb-1.5">
						<header className="flex items-center gap-1.5 px-1">
							<span className="truncate font-mono text-[10px] font-medium text-foreground" title={group.host}>
								{group.host}
							</span>
							<span className="rounded-full bg-muted px-1 text-[9px] tabular-nums text-muted-foreground">{group.urls.length}</span>
							<button
								type="button"
								onClick={() => store.setTarget(`https://${group.host}`, "manual")}
								className="ml-auto shrink-0 rounded px-1 text-[9.5px] text-muted-foreground hover:bg-muted hover:text-foreground"
							>
								{t("console.links.use")}
							</button>
						</header>
						<ul className="mt-0.5 space-y-px">
							{group.urls.map((url) => (
								<li key={url} className="flex items-center gap-1 rounded px-1 hover:bg-muted/60">
									<button
										type="button"
										onClick={() => {
											void openExternal(url).catch(() =>
												getPluginContext().ui.notify({ message: t("console.preview.openFailed"), error: true }),
											);
										}}
										className="min-w-0 flex-1 truncate text-left font-mono text-[9.5px] text-muted-foreground hover:text-foreground"
										title={url}
									>
										{url.slice(url.indexOf(group.host) + group.host.length) || "/"}
									</button>
									<button
										type="button"
										onClick={() => store.setTarget(url, "manual")}
										className="shrink-0 rounded px-1 text-[9px] text-muted-foreground hover:bg-muted hover:text-foreground"
										title={url}
									>
										{t("console.links.use")}
									</button>
								</li>
							))}
						</ul>
					</section>
				))}
				{filtered.length === 0 ? <p className="px-1 py-2 text-[10px] text-muted-foreground">{t("console.artifacts.empty")}</p> : null}
			</div>
		</div>
	);
}
