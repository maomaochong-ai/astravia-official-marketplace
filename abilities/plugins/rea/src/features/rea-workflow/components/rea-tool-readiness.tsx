/**
 * 「本次需要的工具」就绪面板。
 *
 * 状态来源三条，全部可指认（live/doctor-readiness.ts）：
 *   doctor  `rea doctor --json` 的逐项检查 —— REA 自己的判断；
 *   probe   宿主命令通道跑一次 `--version` —— doctor 不管的工具靠它；
 *   session 本次会话真实调用过没有。
 *
 * 清单是**该目标类型的完整需求**，不是「这次碰巧出现过的」。分组显示：
 * 缺失（可操作）→ 未确认（给探测/安装入口）→ 已就绪（默认收起，可展开核对）。
 *
 * 缺失项必须可操作：能一键装的给按钮（REA 官方安装 / brew），装完仍然要额外
 * 配置的只给可复制命令 + 原因，绝不给「装了也没用」的假一键安装。
 */

import { useCallback, useMemo, useState } from "react";
import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PluginCommandRunResult, PluginCommandSpawnHandle } from "@astravia-org/plugin-sdk";
import { StatusChip } from "../../../shared/components/status-chip";
import { copyText } from "../../../shared/services/clipboard";
import type { TargetKind } from "../data/targets";
import type { DoctorReport } from "../hooks/use-doctor-report";
import { useToolInstall } from "../hooks/use-tool-install";
import { ReaInstallProgress } from "./rea-install-progress";
import { useToolProbes } from "../hooks/use-tool-probes";
import {
	resolveReadiness,
	summarizeReadiness,
	type ReadinessSource,
	type ToolReadiness,
} from "../live/doctor-readiness";
import type { ReaLiveCall } from "../live/session-store";
import { describeRecipe, firstChannel, installRecipeFor, isRunnable, needsConfigAfterInstall } from "../live/tool-install";
import { probeRecipeFor } from "../live/tool-probe";
import { requiredTools, runningRequirementIds } from "../live/tool-requirements";

type ReaRunner = (args: readonly string[], options: { cwd?: string; timeoutMs: number }) => Promise<PluginCommandRunResult>;
type CommandRunner = (file: string, args: readonly string[]) => Promise<PluginCommandRunResult>;
type ReaSpawner = (args: readonly string[], options: { cwd?: string }) => Promise<PluginCommandSpawnHandle>;
type CommandSpawner = (file: string, args: readonly string[]) => Promise<PluginCommandSpawnHandle>;

interface ToolReadinessProps {
	readonly target: TargetKind | null;
	readonly calls: readonly ReaLiveCall[];
	/** 此刻正在跑的工具名：命中的那一行改成「运行中」。 */
	readonly running: readonly string[];
	readonly report: DoctorReport;
	readonly run: ReaRunner;
	readonly runCommand: CommandRunner | null;
	/** 长驻进程通道：安装要能看过程、能中途取消，run 做不到。 */
	readonly spawnRea: ReaSpawner | null;
	readonly spawnCommand: CommandSpawner | null;
	readonly cwd: string | null;
}

const UNKNOWN_PREVIEW = 3;

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
	running,
	report,
	run,
	runCommand,
	spawnRea,
	spawnCommand,
	cwd,
}: ToolReadinessProps): JSX.Element {
	const { t } = useTranslation();
	const [expanded, setExpanded] = useState(false);
	const requirements = useMemo(() => requiredTools(target), [target]);
	const probeIds = useMemo(
		() => requirements.filter((requirement) => probeRecipeFor(requirement.id) !== null).map((requirement) => requirement.id),
		[requirements],
	);
	const probeState = useToolProbes({ run: runCommand, ids: probeIds, enabled: true });

	const recheckAll = useCallback(() => {
		probeState.reprobe();
		report.recheck();
	}, [probeState, report]);

	const install = useToolInstall({ spawnRea, spawnCommand, cwd, onFinished: recheckAll });

	const items = useMemo(
		() =>
			requirements.map((requirement) =>
				resolveReadiness(requirement, { checks: report.checks, probes: probeState.probes, calls }),
			),
		[requirements, report.checks, probeState.probes, calls],
	);

	const runningIds = runningRequirementIds(running);
	const summary = summarizeReadiness(items);
	// 失败原因翻译成可操作的中文/英文；宿主原文留在 title 里供搜索。
	const failureText = install.progress?.failure
		? t(install.progress.failure.key, { detail: install.progress.failure.detail })
		: null;
	// 运行中的工具单独置顶，不再重复出现在三组里。
	const rest = items.filter((item) => !runningIds.has(item.requirement.id));
	const missing = rest.filter((item) => item.state === "missing");
	const unknown = rest.filter((item) => item.state === "unknown");
	const ready = rest.filter((item) => item.state === "ready");

	// 运行中的工具永远显示，即使已经就绪——用户要看到「现在在跑哪个」。
	const runningItems = items.filter((item) => runningIds.has(item.requirement.id));
	const unknownVisible = expanded ? unknown : unknown.slice(0, UNKNOWN_PREVIEW);
	const showReady = expanded && ready.length > 0;
	const hintCount = !expanded && unknown.length > UNKNOWN_PREVIEW ? unknown.length - UNKNOWN_PREVIEW : 0;

	const hintFor = (item: ToolReadiness): string | null => {
		if (item.remediation !== null) return item.remediation;
		const recipe = installRecipeFor(item.requirement.id);
		// 有可复制命令就始终能复制：即使给了安装按钮，用户也可能想自己装。
		if (recipe) return describeRecipe(recipe);
		if (item.probeBlocked) return t("tab.tools.blockedHint");
		if (item.state === "unknown") return t("tab.tools.unknownHint", { tool: item.requirement.label });
		return null;
	};

	const renderRow = (item: ToolReadiness): JSX.Element => {
		const hint = hintFor(item);
		// 已经就绪的工具再给一个安装按钮只是噪声（用户本轮反馈的就是这个）。
		// 未确认仍保留安装入口：没有证据不等于装好了，装完才能真的用。
		const installable = item.state !== "ready" && install.canInstall(item.requirement.id);
		const isRunning = runningIds.has(item.requirement.id);
		return (
			<li key={item.requirement.id} className="rounded-md border border-border-subtle bg-surface-3/60 px-2.5 py-1.5">
				<div className="flex min-w-0 items-center gap-1.5">
					<span
						aria-hidden
						className={`size-1.5 shrink-0 rounded-full ${
							isRunning
								? "bg-purple motion-safe:animate-pulse"
								: item.state === "ready"
									? "bg-risk-low"
									: item.state === "missing"
										? "bg-risk-medium"
										: "bg-text-4/40"
						}`}
					/>
					<span className="shrink-0 text-micro font-medium text-text">{item.requirement.label}</span>
					<span
						className="min-w-0 flex-1 truncate text-micro-up text-text-3"
						title={item.detail ?? t(item.requirement.purposeKey)}
					>
						{item.detail ?? t(item.requirement.purposeKey)}
					</span>
					{isRunning ? (
						<StatusChip tone="progress" className="shrink-0" title={t("tab.tools.runningHint")}>
							{t("tab.tools.running")}
						</StatusChip>
					) : null}
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
								firstChannel(installRecipeFor(item.requirement.id)) === "rea"
									? "tab.tools.installHint"
									: "tab.tools.commandHint",
							)}
							className="inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border border-purple/40 bg-purple/10 px-1.5 text-micro-up font-medium text-purple-ink transition-colors hover:bg-purple/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{install.installingId === item.requirement.id ? (
								<span aria-hidden className="icon-[lucide--loader-circle] size-2.5 motion-safe:animate-spin" />
							) : (
								<span aria-hidden className="icon-[lucide--download] size-2.5" />
							)}
							{t(install.installingId === item.requirement.id ? "tab.tools.installing" : "tab.tools.install")}
						</button>
					) : null}
					{hint !== null ? (
						<button
							type="button"
							onClick={() => void copyText(hint)}
							title={hint}
							className="inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border border-border px-1.5 text-micro-up text-text-2 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<span aria-hidden className="icon-[lucide--copy] size-2.5" />
							{t("tab.tools.copy")}
						</button>
					) : null}
				</div>
				{hint !== null && !installable ? (
					<p className="mt-1 pl-3 text-micro-up leading-snug text-text-4" title={hint}>
						<span className="line-clamp-2">{hint}</span>
					</p>
				) : null}
				{needsConfigAfterInstall(installRecipeFor(item.requirement.id)) ? (
					<p className="mt-1 pl-3 text-micro-up leading-snug text-risk-medium">
						<span className="line-clamp-2">{t(installRecipeFor(item.requirement.id)?.noteKey ?? "tab.tools.note.generic")}</span>
					</p>
				) : null}
			</li>
		);
	};

	const section = (labelKey: string, list: readonly ToolReadiness[]): JSX.Element | null =>
		list.length === 0 ? null : (
			<div className="mt-2 flex flex-col gap-1">
				<span className="text-micro-up font-medium uppercase tracking-[0.08em] text-text-4">
					{t(labelKey, { count: list.length })}
				</span>
				<ul className="flex flex-col gap-1">{list.map(renderRow)}</ul>
			</div>
		);

	return (
		<div className="flex flex-col gap-1">
			<div className="flex min-w-0 items-center justify-between gap-2">
				{report.status === "checking" || probeState.probing ? (
					<StatusChip tone="progress">
						<span aria-hidden className="icon-[lucide--loader-circle] size-3 motion-safe:animate-spin" />
						{t("tab.tools.checking")}
					</StatusChip>
				) : summary.total === 0 ? (
					<span className="shrink-0 text-micro-up text-text-4">{t("tab.tools.empty")}</span>
				) : (
					<StatusChip
						tone={summary.missing > 0 ? "warning" : "success"}
						title={t("tab.tools.sourceHint")}
					>
						{t("tab.tools.summaryFull", { ready: summary.ready, total: summary.total, missing: summary.missing })}
					</StatusChip>
				)}
			</div>

			{install.progress !== null ? (
				<ReaInstallProgress
					progress={install.progress}
					label={
						items.find((item) => item.requirement.id === install.progress?.toolId)?.requirement.label ??
						install.progress.toolId
					}
					onCancel={install.cancel}
					onDismiss={install.dismiss}
				/>
			) : null}

			{runningItems.length > 0 ? section("tab.tools.section.running", runningItems) : null}
			{section("tab.tools.section.missing", missing)}
			{section("tab.tools.section.unknown", unknownVisible)}

			{showReady ? section("tab.tools.section.ready", ready) : null}

			{unknown.length > UNKNOWN_PREVIEW || ready.length > 0 ? (
				<button
					type="button"
					onClick={() => setExpanded((prev) => !prev)}
					title={t(expanded ? "tab.tools.collapseAll" : "tab.tools.expandAll")}
					className="mt-1 inline-flex h-5 w-fit items-center gap-1 rounded-sm text-micro-up text-text-4 transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
				>
					<span aria-hidden className={`icon-[lucide--chevron-down] size-3 ${expanded ? "rotate-180" : ""}`} />
					{expanded
						? t("tab.tools.collapseAll")
						: hintCount > 0
							? t("tab.tools.moreUnknown", { count: hintCount })
							: t("tab.tools.showAll", { count: ready.length })}
				</button>
			) : null}

			<div className="mt-1 flex min-w-0 items-center justify-between gap-2">
				<span className="min-w-0 truncate text-micro-up text-text-4" title={failureText ?? report.message ?? undefined}>
					{install.tone === "success"
						? t("tab.tools.installSuccess")
						: install.tone === "danger"
							? t("tab.tools.installFailed", { message: failureText ?? "" })
							: missing.length > 0 && isRunnable(installRecipeFor(missing[0]?.requirement.id ?? ""))
								? t("tab.tools.installableHint", { tool: missing[0]?.requirement.label ?? "" })
								: missing.length > 0
									? t("tab.tools.copyHint", { tool: missing[0]?.requirement.label ?? "" })
									: t("tab.tools.sourceHint")}
				</span>
				<button
					type="button"
					onClick={recheckAll}
					className="inline-flex h-6 shrink-0 items-center gap-1 rounded-sm border border-border bg-surface-3 px-2 text-micro text-text-2 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
				>
					<span aria-hidden className="icon-[lucide--refresh-cw] size-2.5" />
					{t("tab.tools.recheck")}
				</button>
			</div>
		</div>
	);
}
