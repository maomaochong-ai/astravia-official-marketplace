/**
 * Start/stop controls for the console.
 *
 * The console runs the same code path as the agent tool, so a crawl started here
 * behaves identically (same robots/sitemap/scope rules, same event stream). Only
 * the option set the agent may request is exposed — no hidden extras.
 */

import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { CrawlOptions } from "../../../domain/events";
import type { RenderMode } from "../../../domain/render/types";
import { DEFAULT_CRAWL_OPTIONS } from "../../../domain/events";
import { clampCrawlOptions } from "../../../tab-id";
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
	const [options, setOptions] = useState<CrawlOptions>(snapshot.options ?? DEFAULT_CRAWL_OPTIONS);
	const [showAdvanced, setShowAdvanced] = useState(false);
	const running = snapshot.status === "running";

	// A crawl started by the agent updates the store, not this form: follow the run
	// so the URL and options shown always match what is actually being executed.
	useEffect(() => {
		if (snapshot.target) setTarget(snapshot.target);
		if (snapshot.options) setOptions(snapshot.options);
	}, [snapshot.runId]);

	const patch = (partial: Partial<CrawlOptions>): void => {
		setOptions((current) => clampCrawlOptions({ ...current, ...partial }));
	};

	const start = (): void => {
		const trimmed = target.trim();
		if (!/^https?:\/\//i.test(trimmed)) {
			getPluginContext().ui.notify({ message: t("console.error.badUrl"), error: true });
			return;
		}
		void store.start(trimmed, clampCrawlOptions(options)).catch((error: unknown) => {
			getPluginContext().ui.notify({
				message: error instanceof Error ? error.message : String(error),
				error: true,
			});
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
					max={50}
					onChange={(limit) => patch({ limit })}
					suffix={t("console.unit.pages")}
				/>
				<NumberField
					label={t("console.depth")}
					value={options.maxDepth}
					min={0}
					max={5}
					onChange={(maxDepth) => patch({ maxDepth })}
					suffix={t("console.unit.hops")}
				/>
				<NumberField
					label={t("console.concurrency")}
					value={options.concurrency}
					min={1}
					max={8}
					onChange={(concurrency) => patch({ concurrency })}
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

			<button
				type="button"
				onClick={() => setShowAdvanced((value) => !value)}
				className="self-start text-[10px] text-muted-foreground underline-offset-2 hover:underline"
			>
				{showAdvanced ? t("console.advanced.hide") : t("console.advanced.show")}
			</button>

			{showAdvanced ? (
				<div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/60 pt-1.5">
					<div className="col-span-2 flex items-center gap-1.5">
						<span className="text-[10.5px] text-muted-foreground">{t("console.opt.render")}</span>
						<div className="flex overflow-hidden rounded border border-border/70">
							{(["auto", "static", "browser"] as const).map((mode) => (
								<button
									key={mode}
									type="button"
									onClick={() => patch({ render: mode as RenderMode })}
									className={`px-1.5 py-0.5 text-[10px] transition-colors ${
										options.render === mode
											? "bg-primary/12 text-foreground"
											: "text-muted-foreground hover:bg-muted/60"
									}`}
								>
									{t(`console.render.${mode}`)}
								</button>
							))}
						</div>
					</div>
					<Toggle label={t("console.opt.sitemap")} checked={options.useSitemap} onChange={(useSitemap) => patch({ useSitemap })} />
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
						label={t("console.opt.backward")}
						checked={options.allowBackwardCrawling}
						onChange={(allowBackwardCrawling) => patch({ allowBackwardCrawling })}
					/>
					<Toggle
						label={t("console.opt.ignoreRobots")}
						checked={options.ignoreRobotsTxt}
						onChange={(ignoreRobotsTxt) => patch({ ignoreRobotsTxt })}
					/>
				</div>
			) : null}
		</section>
	);
}
