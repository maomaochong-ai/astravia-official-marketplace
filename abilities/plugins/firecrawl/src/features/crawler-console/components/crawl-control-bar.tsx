/**
 * Start/stop controls for the console.
 *
 * The console submits the same `POST /v2/crawl` body the agent tool does, so a
 * crawl started here behaves identically. Only upstream discovery options are
 * exposed — no hidden extras.
 */

import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { CrawlJobOptions } from "../../../domain/firecrawl/options";
import { DEFAULT_CRAWL_JOB_OPTIONS, clampCrawlJobOptions } from "../../../domain/firecrawl/options";
import { CRAWL_FORMAT_OPTIONS, type CrawlFormatOption } from "../../../domain/firecrawl/formats";
import type { CrawlRunSnapshot, CrawlRunStore } from "../services/crawl-run-store";
import { useTranslate } from "../hooks/use-translate";
import { getPluginContext } from "../../../runtime/plugin-context";

const STATUS_TONE: Record<CrawlRunSnapshot["status"], string> = {
	idle: "bg-muted text-muted-foreground",
	running: "bg-primary/15 text-primary",
	completed: "bg-success/15 text-success",
	stopped: "bg-warning/15 text-warning",
	failed: "bg-destructive/15 text-destructive",
};

function NumberField({
	label,
	value,
	min,
	max,
	onChange,
	suffix,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	onChange: (value: number) => void;
	suffix?: string;
}): ReactElement {
	return (
		<label className="flex min-w-0 flex-1 flex-col gap-0.5">
			<span className="text-[10px] text-muted-foreground">{label}</span>
			<span className="flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5">
				<input
					type="number"
					min={min}
					max={max}
					value={value}
					onChange={(event) => onChange(Number(event.target.value))}
					className="w-full min-w-0 bg-transparent text-[11px] outline-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
				/>
				{suffix ? <span className="text-[10px] text-muted-foreground">{suffix}</span> : null}
			</span>
		</label>
	);
}

/**
 * Format chips are not free toggles: `rawBase64` is exclusive upstream and
 * `markdown` is what the page preview reads, so the two trade places.
 */
function toggleFormat(current: CrawlFormatOption[], option: CrawlFormatOption): CrawlFormatOption[] {
	if (option === "rawBase64") return current.includes("rawBase64") ? ["markdown"] : ["rawBase64"];
	const base = current.filter((entry) => entry !== "rawBase64");
	if (option === "markdown") return base.includes("markdown") ? base : ["markdown", ...base];
	const next = base.includes(option) ? base.filter((entry) => entry !== option) : [...base, option];
	return next.length > 0 ? next : ["markdown"];
}

function Toggle({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}): ReactElement {
	return (
		<label className="flex cursor-pointer items-center gap-1.5 text-[10.5px] text-muted-foreground">
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
				className="size-3 accent-[var(--primary)]"
			/>
			{label}
		</label>
	);
}

export function CrawlControlBar({
	store,
	snapshot,
}: {
	store: CrawlRunStore;
	snapshot: CrawlRunSnapshot;
}): ReactElement {
	const t = useTranslate();
	const [target, setTarget] = useState(snapshot.target || "");
	const [options, setOptions] = useState<CrawlJobOptions>(snapshot.options ?? DEFAULT_CRAWL_JOB_OPTIONS);
	const [showAdvanced, setShowAdvanced] = useState(false);
	const running = snapshot.status === "running";

	// A crawl started by the agent updates the store, not this form: follow the run
	// so the URL and options shown always match what is actually being executed.
	useEffect(() => {
		if (snapshot.target) setTarget(snapshot.target);
		if (snapshot.options) setOptions(snapshot.options);
	}, [snapshot.runId]);

	const patch = (partial: Partial<CrawlJobOptions>): void => {
		setOptions((current) => clampCrawlJobOptions({ ...current, ...partial }));
	};

	const start = (): void => {
		const trimmed = target.trim();
		if (!/^https?:\/\//i.test(trimmed)) {
			getPluginContext().ui.notify({ message: t("console.error.badUrl"), error: true });
			return;
		}
		void store.start(trimmed, clampCrawlJobOptions(options)).catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			// The switch is enterprise-only, so a rejected run under it can never
			// succeed: turn it back off and say so, rather than leaving the trap armed
			// for the next attempt.
			if (options.ignoreRobotsTxt && /enterprise/i.test(message)) {
				patch({ ignoreRobotsTxt: false });
				setShowAdvanced(true);
				getPluginContext().ui.notify({ message: t("console.error.robotsReset"), error: true });
				return;
			}
			getPluginContext().ui.notify({ message, error: true });
		});
	};

	return (
		<section className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5">
			<div className="flex items-center gap-1.5">
				<input
					value={target}
					onChange={(event) => setTarget(event.target.value)}
					onBlur={() => {
						const trimmed = target.trim();
						if (/^https?:\/\//i.test(trimmed)) store.setTarget(trimmed, "manual");
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !running) start();
					}}
					placeholder={t("console.target.placeholder")}
					spellCheck={false}
					className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-[11px] outline-none focus:border-primary"
				/>
				{running ? (
					<button
						type="button"
						onClick={() => store.stop()}
						className="shrink-0 rounded bg-destructive px-2.5 py-1 text-[11px] font-medium text-destructive-foreground"
					>
						{t("console.stop")}
					</button>
				) : (
					<button
						type="button"
						onClick={start}
						className="shrink-0 rounded bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
					>
						{t("console.start")}
					</button>
				)}
			</div>

			<div className="flex items-end gap-1.5">
				<NumberField
					label={t("console.limit")}
					value={options.limit}
					min={1}
					max={500}
					onChange={(limit) => patch({ limit })}
					suffix={t("console.unit.pages")}
				/>
				<NumberField
					label={t("console.depth")}
					value={options.maxDiscoveryDepth}
					min={0}
					max={5}
					onChange={(maxDiscoveryDepth) => patch({ maxDiscoveryDepth })}
					suffix={t("console.unit.hops")}
				/>
				<NumberField
					label={t("console.concurrency")}
					value={options.maxConcurrency}
					min={1}
					max={10}
					onChange={(maxConcurrency) => patch({ maxConcurrency })}
				/>
				<NumberField
					label={t("console.delay")}
					value={options.delay}
					min={0}
					max={5_000}
					onChange={(delay) => patch({ delay })}
					suffix="ms"
				/>
				{snapshot.targetSource === "conversation" || snapshot.targetSource === "tool" ? (
					<span className="shrink-0 rounded bg-accent px-1.5 py-1 font-mono text-[9.5px] text-accent-foreground">
						{snapshot.targetSource === "tool" ? t("console.target.fromTool") : t("console.target.fromChat")}
					</span>
				) : null}
				<span
					className={`shrink-0 rounded px-1.5 py-1 text-[10px] font-medium ${STATUS_TONE[snapshot.status]}`}
					title={snapshot.lastError ?? undefined}
				>
					{t(`console.status.${snapshot.status}`)}
				</span>
			</div>

			<div className="flex flex-wrap items-center gap-1">
				<span className="shrink-0 text-[10px] text-muted-foreground">{t("console.formats.label")}</span>
				{CRAWL_FORMAT_OPTIONS.map((option) => {
					const active = options.formats.includes(option);
					// `attributes` needs a selector before it can produce anything, so it is
					// greyed out rather than sent upstream as an empty request.
					const needsSelectors = option === "attributes" && !(options.attributeSelectors ?? "").trim();
					const reason =
						option === "rawBase64"
							? t("console.formats.binary")
							: needsSelectors
								? t("console.formats.needSelectors")
								: option === "markdown"
									? t("console.formats.hint")
									: undefined;
					return (
						<button
							key={option}
							type="button"
							disabled={needsSelectors}
							aria-pressed={active}
							title={reason}
							onClick={() => patch({ formats: toggleFormat(options.formats, option) as CrawlFormatOption[] })}
							className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
								active
									? "border-primary/40 bg-primary/15 text-primary"
									: "border-border text-muted-foreground hover:bg-muted"
							} ${needsSelectors ? "cursor-not-allowed opacity-50" : ""}`}
						>
							{t(`console.format.${option}`)}
						</button>
					);
				})}
			</div>

			{options.formats.includes("attributes") ? (
				<label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
					<span className="shrink-0">{t("console.formats.selectors")}</span>
					<input
						value={options.attributeSelectors ?? ""}
						onChange={(event) => patch({ attributeSelectors: event.target.value })}
						placeholder={t("console.formats.selectorsPlaceholder")}
						className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]"
					/>
				</label>
			) : null}

			{options.formats.includes("json") ? (
				<label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
					<span className="shrink-0">{t("console.formats.jsonPrompt")}</span>
					<input
						value={options.jsonPrompt ?? ""}
						onChange={(event) => patch({ jsonPrompt: event.target.value })}
						placeholder={t("console.formats.jsonPromptPlaceholder")}
						className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"
					/>
				</label>
			) : null}

			{options.formats.includes("rawBase64") ? (
				<p className="text-[10px] text-amber-600 dark:text-amber-400">{t("console.formats.binary")}</p>
			) : null}

			<div className="flex items-center gap-1.5 self-start">
				<button
					type="button"
					onClick={() => setShowAdvanced((value) => !value)}
					className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
				>
					{showAdvanced ? t("console.advanced.hide") : t("console.advanced.show")}
				</button>
				{/* Collapsed options can still be off their defaults; say so, otherwise a
				    hidden toggle explaining a rejected run is invisible. */}
				{!showAdvanced && options.ignoreRobotsTxt ? (
					<span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
						{t("console.advanced.robotsBadge")}
					</span>
				) : null}
			</div>

			{showAdvanced ? (
				<div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/60 pt-1.5">
					<Toggle
						label={t("console.opt.sitemap")}
						checked={options.sitemap !== "skip"}
						onChange={(enabled) => patch({ sitemap: enabled ? "include" : "skip" })}
					/>
					<Toggle
						label={t("console.opt.mainContent")}
						checked={options.onlyMainContent}
						onChange={(onlyMainContent) => patch({ onlyMainContent })}
					/>
					<Toggle
						label={t("console.opt.external")}
						checked={options.allowExternalLinks}
						onChange={(allowExternalLinks) => patch({ allowExternalLinks })}
					/>
					<Toggle
						label={t("console.opt.subdomains")}
						checked={options.allowSubdomains}
						onChange={(allowSubdomains) => patch({ allowSubdomains })}
					/>
					<Toggle
						label={t("console.opt.queryParams")}
						checked={options.ignoreQueryParameters}
						onChange={(ignoreQueryParameters) => patch({ ignoreQueryParameters })}
					/>
					<Toggle
						label={t("console.opt.entireDomain")}
						checked={options.crawlEntireDomain}
						onChange={(crawlEntireDomain) => patch({ crawlEntireDomain })}
					/>
					<Toggle
						label={t("console.opt.ignoreRobots")}
						checked={options.ignoreRobotsTxt}
						onChange={(ignoreRobotsTxt) => patch({ ignoreRobotsTxt })}
					/>
					{options.ignoreRobotsTxt ? (
						<p className="col-span-2 text-[10px] text-amber-600 dark:text-amber-400">
							{t("console.advanced.robotsEnterprise")}
						</p>
					) : null}
				</div>
			) : null}
		</section>
	);
}
