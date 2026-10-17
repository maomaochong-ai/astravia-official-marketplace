/**
 * 「本次需要的工具」就绪面板。
 *
 * 与旧的静态「推荐工具栈」的区别：
 *   - 清单由目标类型 + 本次会话真实调用过的工具推导（live/tool-requirements.ts）；
 *   - 状态来自自动跑的 `rea doctor --json`（live/doctor-readiness.ts），不是我猜的；
 *   - 缺失项直接给 doctor 自带的 remediation；只有 REA 官方支持无人值守安装的
 *     （Hopper）才显示「一键安装」，其余明确写「需手动安装」，不给假承诺。
 */

import { useMemo } from "react";
import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PluginCommandRunResult } from "@astravia-org/plugin-sdk";
import { StatusChip } from "../../../shared/components/status-chip";
import { copyText } from "../../../shared/services/clipboard";
import type { TargetKind } from "../data/targets";
import type { DoctorReport } from "../hooks/use-doctor-report";
import { useToolInstall } from "../hooks/use-tool-install";
import { installableRequirement, resolveReadiness, summarizeReadiness, type ToolReadiness } from "../live/doctor-readiness";
import type { ReaLiveCall } from "../live/session-store";
import { requiredTools } from "../live/tool-requirements";

interface ToolReadinessProps {
	readonly target: TargetKind | null;
	readonly calls: readonly ReaLiveCall[];
	readonly report: DoctorReport;
	readonly run: (args: readonly string[], options: { cwd?: string; timeoutMs: number }) => Promise<PluginCommandRunResult>;
	readonly cwd: string | null;
}

function stateTone(item: ToolReadiness): "success" | "warning" | "neutral" {
	if (item.state === "ready") return "success";
	if (item.state === "missing") return "warning";
	return "neutral";
}

export function ReaToolReadiness({ target, calls, report, run, cwd }: ToolReadinessProps): JSX.Element {
	const { t } = useTranslation();
	const install = useToolInstall({ run, cwd, onFinished: report.recheck });
	const items = useMemo(
		() => requiredTools(target, calls).map((requirement) => resolveReadiness(requirement, report.checks, calls)),
		[target, calls, report.checks],
	);
	const summary = summarizeReadiness(items);
	const missing = items.filter((item) => item.state === "missing");
	const installable = installableRequirement(items);
	const visible = missing.length > 0 ? missing : items.filter((item) => item.state !== "ready").slice(0, 4);

	return (
		<div className="mt-1.5 rounded-[min(var(--radius-md),8px)] border border-border bg-background/50 px-2.5 py-1.5">
			<div className="flex min-w-0 items-center justify-between gap-2">
				<span className="min-w-0 truncate text-[10.5px] uppercase tracking-wide text-muted-foreground">
					{t("tab.tools.title")}
				</span>
				{report.status === "checking" ? (
					<StatusChip tone="progress">
						<span aria-hidden className="icon-[lucide--loader-circle] size-3 motion-safe:animate-spin" />
						{t("tab.tools.checking")}
					</StatusChip>
				) : report.status === "failed" ? (
					<StatusChip tone="warning" title={report.message ?? undefined}>
						{t("tab.tools.checkFailed")}
					</StatusChip>
				) : summary.total === 0 ? (
					<span className="shrink-0 text-[10.5px] text-muted-foreground">{t("tab.tools.empty")}</span>
				) : (
					<StatusChip tone={summary.missing > 0 ? "warning" : "success"}>
						{t("tab.tools.summary", { ready: summary.ready, total: summary.total })}
					</StatusChip>
				)}
			</div>

			{visible.length > 0 ? (
				<ul className="mt-1.5 flex flex-col gap-1">
					{visible.map((item) => (
						<li
							key={item.requirement.id}
							className="rounded-[min(var(--radius-md),6px)] border border-border/70 bg-card/40 px-2 py-1"
						>
							<div className="flex min-w-0 items-center gap-1.5">
								<span
									aria-hidden
									className={`size-1.5 shrink-0 rounded-full ${
										item.state === "ready" ? "bg-emerald-500" : item.state === "missing" ? "bg-amber-500" : "bg-muted-foreground/50"
									}`}
								/>
								<span className="shrink-0 text-[11px] font-medium text-foreground/90">{item.requirement.label}</span>
								<span
									className="min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground"
									title={t(item.requirement.purposeKey)}
								>
									{item.detail ?? t(item.requirement.purposeKey)}
								</span>
								<StatusChip tone={stateTone(item)} className="shrink-0" title={item.remediation ?? undefined}>
									{t(`tab.tools.state.${item.state}`)}
								</StatusChip>
								{item.requirement.autoInstallArgs ? (
									<button
										type="button"
										onClick={() => install.install(item.requirement.autoInstallArgs ?? [])}
										disabled={install.installing}
										title={t("tab.tools.installHint")}
										className="inline-flex h-5 shrink-0 items-center gap-1 rounded border border-primary/40 bg-primary/10 px-1.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
									>
										{install.installing ? (
											<span aria-hidden className="icon-[lucide--loader-circle] size-2.5 motion-safe:animate-spin" />
										) : (
											<span aria-hidden className="icon-[lucide--download] size-2.5" />
										)}
										{t(install.installing ? "tab.tools.installing" : "tab.tools.install")}
									</button>
								) : item.remediation ? (
									<button
										type="button"
										onClick={() => void copyText(item.remediation ?? "")}
										title={item.remediation}
										className="inline-flex h-5 shrink-0 items-center gap-1 rounded border border-border px-1.5 text-[10px] text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
									>
										<span aria-hidden className="icon-[lucide--copy] size-2.5" />
										{t("tab.tools.copy")}
									</button>
								) : null}
							</div>
							{item.remediation ? (
								<p className="mt-0.5 pl-3 text-[10px] leading-snug text-muted-foreground" title={item.remediation}>
									<span className="line-clamp-2">{item.remediation}</span>
								</p>
							) : null}
						</li>
					))}
				</ul>
			) : null}

			<div className="mt-1 flex min-w-0 items-center justify-between gap-2">
				<span className="min-w-0 truncate text-[10px] text-muted-foreground" title={report.message ?? undefined}>
					{install.tone === "success"
						? t("tab.tools.installSuccess")
						: install.tone === "danger"
							? t("tab.tools.installFailed", { message: install.message ?? "" })
							: installable && report.status === "ready"
								? t("tab.tools.installableHint", { tool: installable.requirement.label })
								: t("tab.tools.sourceHint")}
				</span>
				{report.status === "ready" || report.status === "failed" ? (
					<button
						type="button"
						onClick={report.recheck}
						className="inline-flex h-5 shrink-0 items-center gap-1 rounded px-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						<span aria-hidden className="icon-[lucide--refresh-cw] size-2.5" />
						{t("tab.tools.recheck")}
					</button>
				) : null}
			</div>
		</div>
	);
}
