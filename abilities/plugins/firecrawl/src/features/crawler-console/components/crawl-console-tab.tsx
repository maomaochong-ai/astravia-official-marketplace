/**
 * Activity-tab root.
 *
 * Zero props by contract, so the store arrives through a closure created in
 * activate(). The tab stays inside the panel rectangle: no portal, no
 * position:fixed, no viewport-height math.
 */

import type { ReactElement } from "react";
import { useActivityTab } from "@astravia-org/plugin-sdk";
import type { CrawlRunStore } from "../services/crawl-run-store";
import { useCrawlRun } from "../hooks/use-crawl-run";
import { useTranslate } from "../hooks/use-translate";
import { CrawlControlBar } from "./crawl-control-bar";
import { ConsoleStream } from "./console-stream";
import { SpiderWebPanel } from "./spider-web-panel";
import { formatBytes, formatCount, formatDuration } from "../../../shared/formatters/format";

export function CrawlConsoleTab({ store }: { store: CrawlRunStore }): ReactElement {
	const { active } = useActivityTab();
	const t = useTranslate();
	const snapshot = useCrawlRun(store);

	return (
		<div className="flex h-full min-h-0 flex-col gap-1.5 overflow-hidden bg-background p-2 text-foreground">
			<header className="flex shrink-0 items-baseline gap-2">
				<h2 className="text-[13px] font-semibold tracking-tight">{t("console.title")}</h2>
				<span className="truncate font-mono text-[10px] text-muted-foreground">
					{snapshot.target || t("console.subtitle")}
				</span>
				{snapshot.counts.discovered > 0 ? (
					<span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
						{t("console.discovered", { count: formatCount(snapshot.counts.discovered) })}
					</span>
				) : null}
			</header>

			<div className="shrink-0">
				<CrawlControlBar store={store} snapshot={snapshot} />
			</div>

			<div className="flex min-h-[168px] flex-1 flex-col">
				<SpiderWebPanel snapshot={snapshot} active={active} />
			</div>

			<div className="flex h-[34%] min-h-[104px] flex-col">
				<ConsoleStream snapshot={snapshot} active={active} />
			</div>

			<footer className="flex shrink-0 items-center gap-3 overflow-hidden text-[10px] text-muted-foreground">
				<span className="shrink-0">
					{t("footer.text")} <span className="font-mono text-foreground">{formatCount(snapshot.chars)}</span>
				</span>
				<span className="shrink-0">
					{t("metric.downloaded")} <span className="font-mono text-foreground">{formatBytes(snapshot.bytes)}</span>
				</span>
				{snapshot.robots ? (
					<span className="truncate" title={`status ${snapshot.robots.status}`}>
						robots{" "}
						{snapshot.robots.present
							? `${snapshot.robots.rules} rules${snapshot.robots.failedOpen ? " (failed open)" : ""}`
							: "not found"}
					</span>
				) : null}
				{snapshot.sitemap ? (
					<span className="truncate">
						sitemap {snapshot.sitemap.fetched} / {formatCount(snapshot.sitemap.urls)} urls
					</span>
				) : null}
				{snapshot.endedAt ? (
					<span className="ml-auto shrink-0 font-mono">
						{formatDuration(snapshot.endedAt - snapshot.startedAt)}
					</span>
				) : null}
			</footer>
		</div>
	);
}
