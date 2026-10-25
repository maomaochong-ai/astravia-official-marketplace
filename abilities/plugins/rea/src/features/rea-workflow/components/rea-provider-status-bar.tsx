/**
 * 引擎条：REA CLI provider 的真实 phase + retry + 失败时的 doctor 提示。
 *
 * 通过 ctx.cliProviders 的订阅 API（getStatus / onStatusChanged / retry）拿到 phase。
 * 布局压缩成一行「圆点 + 标题 + 状态芯片 + 一句话 + retry」：面板顶部只留一条，
 * 主体的高度全部让给阶段内容和实时调用。失败展开与日志折叠保持在这里，
 * 因为它们是这条状态的证据，不应该散落到别的区块。
 */

import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PluginCliProviderPhase, PluginCliProviderStatus } from "@astravia-org/plugin-sdk";
import { StatusChip } from "../../../shared/components/status-chip";
import { StatusDot, type StatusDotTone } from "../../../shared/components/status-dot";
import { pillClass } from "../../../shared/components/pill";
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
	const parsedError = tryParseReaError(status?.recentOutput);

	return (
		<section className="flex shrink-0 flex-col gap-1.5 border-b border-border bg-card/30 px-4 py-2">
			<div className="flex min-w-0 items-center gap-2">
				<StatusDot tone={mapDot(phase)} pulse={busy} />
				<span className="shrink-0 text-micro font-semibold text-foreground">{t("setup.title")}</span>
				<StatusChip tone={tone}>{t(labelKey)}</StatusChip>
				<span className="min-w-0 flex-1 truncate text-micro text-faint" title={status?.message ?? undefined}>
					{status?.message ?? t("setup.subtitle")}
				</span>
				<button
					type="button"
					className={pillClass("ghost", "h-6 px-2 text-micro-up")}
					disabled={busy}
					onClick={() => {
						void props.retry();
					}}
				>
					{t("setup.action.retry")}
				</button>
			</div>

			{parsedError ? <ReaErrorExplainer error={parsedError} /> : null}

			{phase === "failed" ? (
				<div className="rounded-control border border-border-strong bg-apricot-light px-2.5 py-1.5 text-micro leading-relaxed text-ochre">
					<span className="font-medium">{t("setup.failed.hintTitle")}</span>{" "}
					<code className="font-mono text-micro-up">npx rea-agents doctor --json</code>
				</div>
			) : null}

			{recentLines.length > 0 ? (
				<div>
					<button
						type="button"
						className="inline-flex items-center gap-1 rounded-sm text-micro-up text-faint transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						onClick={() => setExpanded((v) => !v)}
						aria-expanded={expanded}
					>
						<span aria-hidden className={`icon-[lucide--chevron-down] size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
						<span>{t("setup.log.toggle", { count: recentLines.length })}</span>
					</button>
					{expanded ? (
						<pre className="mt-1 max-h-32 overflow-auto rounded-control border border-border bg-stone px-2 py-1.5 font-mono text-micro-up leading-relaxed text-foreground/85">
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

function mapDot(phase: PluginCliProviderPhase): StatusDotTone {
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
			return "primary";
		default:
			return "idle";
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
