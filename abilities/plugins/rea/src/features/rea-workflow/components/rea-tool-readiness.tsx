/**
 * 「本次需要的工具」就绪面板。
 *
 * 状态来源三条，全部可指认（live/doctor-readiness.ts）：
 *   doctor  `rea doctor --json` 的逐项检查 —— REA 自己的判断；
 *   probe   宿主命令通道跑一次 `--version` —— doctor 不管的工具靠它；
 *   session 本次会话真实调用过没有。
 *
 * 缺失项必须可操作：能一键装的给按钮（REA 官方安装 / brew），装完仍然要额外
 * 配置的只给可复制命令 + 原因，绝不给「装了也没用」的假一键安装。
 */

import { useCallback, useMemo } from "react";
import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PluginCommandRunResult } from "@astravia-org/plugin-sdk";
import { StatusChip } from "../../../shared/components/status-chip";
import { copyText } from "../../../shared/services/clipboard";
import type { TargetKind } from "../data/targets";
import type { DoctorReport } from "../hooks/use-doctor-report";
import { useToolInstall } from "../hooks/use-tool-install";
import { useToolProbes } from "../hooks/use-tool-probes";
import {
	resolveReadiness,
	summarizeReadiness,
	type ReadinessSource,
	type ToolReadiness,
} from "../live/doctor-readiness";
import type { ReaLiveCall } from "../live/session-store";
import { installRecipeFor, isOneClick } from "../live/tool-install";
import { probeRecipeFor } from "../live/tool-probe";
import { requiredTools } from "../live/tool-requirements";

type ReaRunner = (args: readonly string[], options: { cwd?: string; timeoutMs: number }) => Promise<PluginCommandRunResult>;
type CommandRunner = (file: string, args: readonly string[]) => Promise<PluginCommandRunResult>;

interface ToolReadinessProps {
	readonly target: TargetKind | null;
	readonly calls: readonly ReaLiveCall[];
	readonly report: DoctorReport;
	readonly run: ReaRunner;
	readonly runCommand: CommandRunner | null;
	readonly cwd: string | null;
}

function stateTone(item: ToolReadiness): "success" | "warning" | "neutral" {
	if (item.state === "ready") return "success";
	if (item.state === "missing") return "warning";
	return "neutral";
}

function sourceKey(source: ReadinessSource | null): string {
	return source === null ? "tab.tools.source.none" : `tab.tools.source.${source}`;
}

export function ReaToolReadiness({
	target,
	calls,
	report,
	run,
	runCommand,
	cwd,
}: ToolReadinessProps): JSX.Element {
	const { t } = useTranslation();
	const requirements = useMemo(() => requiredTools(target, calls), [target, calls]);
	const probeIds = useMemo(
		() => requirements.filter((requirement) => probeRecipeFor(requirement.id) !== null).map((requirement) => requirement.id),
		[requirements],
	);
	const probeState = useToolProbes({ run: runCommand, ids: probeIds, enabled: true });

	const recheckAll = useCallback(() => {
		probeState.reprobe();
		report.recheck();
	}, [probeState, report]);

	const install = useToolInstall({ runRea: run, runCommand, cwd, onFinished: recheckAll });

	const items = useMemo(
		() =>
			requirements.map((requirement) =>
				resolveReadiness(requirement, { checks: report.checks, probes: probeState.probes, calls }),
			),
		[requirements, report.checks, probeState.probes, calls],
	);

	const summary = summarizeReadiness(items);
	const missing = items.filter((item) => item.state === "missing");
	const visible = missing.length > 0 ? missing : items.filter((item) => item.state !== "ready").slice(0, 4);
	const oneClick = items.find((item) => item.state !== "ready" && isOneClick(installRecipeFor(item.requirement.id)));
	const commandOnly = items.find((item) => item.state !== "ready" && installRecipeFor(item.requirement.id)?.kind === "manual");

	const hintFor = (item: ToolReadiness): string | null => {
		if (item.remediation !== null) return item.remediation;
		const recipe = installRecipeFor(item.requirement.id);
		if (recipe?.kind === "manual" && recipe.command) return recipe.command;
		if (item.probeBlocked) return t("tab.tools.blockedHint");
		if (item.state === "unknown") return t("tab.tools.unknownHint", { tool: item.requirement.label });
		return null;
	};

	return (
		<div className="mt-1.5 rounded-[min(var(--radius-md),8px)] border border-border bg-background/50 px-2.5 py-1.5">
			<div className="flex min-w-0 items-center justify-between gap-2">
				<span className="min-w-0 truncate text-[10.5px] uppercase tracking-wide text-muted-foreground">
					{t("tab.tools.title")}
				</span>
				{report.status === "checking" || probeState.probing ? (
					<StatusChip tone="progress">
						<span aria-hidden className="icon-[lucide--loader-circle] size-3 motion-safe:animate-spin" />
						{t("tab.tools.checking")}
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
					{visible.map((item) => {
						const hint = hintFor(item);
						const installable = install.canInstall(item.requirement.id);
						return (
							<li
								key={item.requirement.id}
								className="rounded-[min(var(--radius-md),6px)] border border-border/70 bg-card/40 px-2 py-1"
							>
								<div className="flex min-w-0 items-center gap-1.5">
									<span
										aria-hidden
										className={`size-1.5 shrink-0 rounded-full ${
											item.state === "ready"
												? "bg-emerald-500"
												: item.state === "missing"
													? "bg-amber-500"
													: "bg-muted-foreground/50"
										}`}
									/>
									<span className="shrink-0 text-[11px] font-medium text-foreground/90">{item.requirement.label}</span>
									<span
										className="min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground"
										title={item.detail ?? t(item.requirement.purposeKey)}
									>
										{item.detail ?? t(item.requirement.purposeKey)}
									</span>
									<StatusChip
										tone={stateTone(item)}
										className="shrink-0"
										title={`${t(`tab.tools.state.${item.state}`)} · ${t(sourceKey(item.source))}`}
									>
										{t(`tab.tools.state.${item.state}`)}
									</StatusChip>
									{installable ? (
										<button
											type="button"
											onClick={() => install.install(item.requirement.id)}
											disabled={install.installingId !== null}
											title={t(
												installRecipeFor(item.requirement.id)?.kind === "brew"
													? "tab.tools.brewHint"
													: "tab.tools.installHint",
											)}
											className="inline-flex h-5 shrink-0 items-center gap-1 rounded border border-primary/40 bg-primary/10 px-1.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
										>
											{install.installingId === item.requirement.id ? (
												<span aria-hidden className="icon-[lucide--loader-circle] size-2.5 motion-safe:animate-spin" />
											) : (
												<span aria-hidden className="icon-[lucide--download] size-2.5" />
											)}
											{t(install.installingId === item.requirement.id ? "tab.tools.installing" : "tab.tools.install")}
										</button>
									) : hint !== null ? (
										<button
											type="button"
											onClick={() => void copyText(hint)}
											title={hint}
											className="inline-flex h-5 shrink-0 items-center gap-1 rounded border border-border px-1.5 text-[10px] text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
										>
											<span aria-hidden className="icon-[lucide--copy] size-2.5" />
											{t("tab.tools.copy")}
										</button>
									) : null}
								</div>
								{hint !== null && !installable ? (
									<p className="mt-0.5 pl-3 text-[10px] leading-snug text-muted-foreground" title={hint}>
										<span className="line-clamp-2">{hint}</span>
									</p>
								) : null}
							</li>
						);
					})}
				</ul>
			) : null}

			<div className="mt-1 flex min-w-0 items-center justify-between gap-2">
				<span className="min-w-0 truncate text-[10px] text-muted-foreground" title={report.message ?? undefined}>
					{install.tone === "success"
						? t("tab.tools.installSuccess")
						: install.tone === "danger"
							? t("tab.tools.installFailed", { message: install.message ?? "" })
							: oneClick !== undefined
								? t("tab.tools.installableHint", { tool: oneClick.requirement.label })
								: commandOnly !== undefined
									? t("tab.tools.commandOnlyHint", { tool: commandOnly.requirement.label })
									: t("tab.tools.sourceHint")}
				</span>
				<button
					type="button"
					onClick={recheckAll}
					className="inline-flex h-5 shrink-0 items-center gap-1 rounded px-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
				>
					<span aria-hidden className="icon-[lucide--refresh-cw] size-2.5" />
					{t("tab.tools.recheck")}
				</button>
			</div>
		</div>
	);
}
