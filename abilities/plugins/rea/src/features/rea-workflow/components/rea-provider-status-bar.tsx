/**
 * 活动面板顶部固定条：REA CLI provider 状态、retry 按钮、失败 doctor hint。
 *
 * 通过 ctx.cliProviders 的真实订阅 API（getStatus / onStatusChanged / retry）拿到 phase。
 * 状态色按 as-ocr 风格（emerald/amber/red 语义独立，不跟主题）。
 */

import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PluginCliProviderPhase, PluginCliProviderStatus } from "@astravia-org/plugin-sdk";
import { StatusChip } from "../../../shared/components/status-chip";
import { ReaErrorExplainer, tryParseReaError } from "./rea-error-explainer";

interface ReaProviderStatusBarProps {
	getStatus: () => Promise<PluginCliProviderStatus>;
	onStatusChanged: (listener: (status: PluginCliProviderStatus) => void) => { dispose: () => void };
	retry: () => Promise<void>;
}

export function ReaProviderStatusBar(props: ReaProviderStatusBarProps): JSX.Element {
	const { t } = useTranslation();
	const [status, setStatus] = useState<PluginCliProviderStatus | null>(null);
	const [expanded, setExpanded] = useState<boolean>(false);

	useEffect(() => {
		let cancelled = false;
		void props.getStatus().then((s) => {
			if (!cancelled) setStatus(s);
		});
		const sub = props.onStatusChanged((s) => setStatus(s));
		return () => {
			cancelled = true;
			sub.dispose();
		};
	}, [props]);

	const phase: PluginCliProviderPhase = status?.phase ?? "checking";
	const tone = mapTone(phase);
	const labelKey = phaseLabelKey(phase);
	const busy = phase === "checking" || phase === "installing" || phase === "verifying";
	const recentLines = (status?.recentOutput ?? "")
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0)
		.slice(-8);

	return (
		<section className="border-b border-border bg-card/40 px-3 py-2 text-card-foreground">
			<header className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<h2 className="truncate text-sm font-semibold leading-tight text-foreground">{t("setup.title")}</h2>
					{status?.message ? (
						<p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={status.message}>
							{status.message}
						</p>
					) : (
						<p className="mt-0.5 text-[11px] text-muted-foreground">{t("setup.subtitle")}</p>
					)}
				</div>
				<div className="flex items-center gap-1.5">
					<StatusChip tone={tone}>{t(labelKey)}</StatusChip>
					<button
						type="button"
						className="inline-flex h-6 items-center rounded-md border border-border bg-background/40 px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={busy}
						onClick={() => {
							void props.retry();
						}}
					>
						{t("setup.action.retry")}
					</button>
				</div>
			</header>

			{(() => {
				const err = tryParseReaError(status?.recentOutput);
				return err ? <ReaErrorExplainer error={err} /> : null;
			})()}
			{phase === "failed" ? (
				<div className="mt-2 rounded-[min(var(--radius-md),8px)] border border-warning/30 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
					<span className="font-medium">{t("setup.failed.hintTitle")}</span>{" "}
					<code className="font-mono text-[10.5px] text-amber-800 dark:text-amber-300">npx rea-agents doctor --json</code>
				</div>
			) : null}

			{recentLines.length > 0 ? (
				<div className="mt-2">
					<button
						type="button"
						className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
						onClick={() => setExpanded((v) => !v)}
						aria-expanded={expanded}
					>
						<span aria-hidden>{expanded ? "▾" : "▸"}</span>
						<span>{t("setup.log.toggle", { count: recentLines.length })}</span>
					</button>
					{expanded ? (
						<pre className="mt-1 max-h-32 overflow-auto rounded-[min(var(--radius-md),6px)] border border-border bg-muted/40 px-2 py-1 font-mono text-[10px] leading-relaxed text-foreground/85">
{recentLines.join("\n")}
						</pre>
					) : null}
				</div>
			) : null}
		</section>
	);
}

function mapTone(phase: PluginCliProviderPhase): "neutral" | "progress" | "success" | "warning" | "danger" {
	switch (phase) {
		case "ready":
			return "success";
		case "failed":
			return "danger";
		case "disabled":
			return "warning";
		case "checking":
		case "installing":
		case "verifying":
			return "progress";
		default:
			return "neutral";
	}
}

function phaseLabelKey(phase: PluginCliProviderPhase): string {
	switch (phase) {
		case "ready":
			return "setup.status.ready";
		case "failed":
			return "setup.status.failed";
		case "installing":
			return "setup.status.installing";
		case "verifying":
			return "setup.status.probing";
		case "checking":
			return "setup.status.pending";
		case "disabled":
			return "setup.status.idle";
		default:
			return "setup.status.idle";
	}
}
