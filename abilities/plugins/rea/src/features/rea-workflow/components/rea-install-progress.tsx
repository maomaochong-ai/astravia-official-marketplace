/**
 * 一键安装的进行中面板：进度条、阶段、命令行、已用时间、过程输出、取消。
 *
 * 数据全部来自 `useToolInstall`（宿主 spawn 的真实输出），这里不做任何推断：
 *
 *   进度条长度 = 已完成的计划步骤 / 总步骤数。多步配方（先装 pipx 再 pipx install X）
 *   才能给出确定位置；单步配方没有可数的子进度，只显示扫动的「进行中」条纹。
 *   某个步骤内部只显示 brew / pipx 真实打印的阶段（下载 / 安装 / 收尾）、已用时间与
 *   输出行数——brew 不报总百分比，编一个就是假信息。
 */

import { useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { InstallProgress } from "../hooks/use-tool-install";
import type { InstallStage } from "../live/tool-install";

interface InstallProgressProps {
	readonly progress: InstallProgress;
	/** 本地化的工具名；取不到时退回 id。 */
	readonly label: string;
	readonly onCancel: () => void;
	readonly onDismiss: () => void;
}

const STAGE_KEY: Record<InstallStage, string> = {
	starting: "tab.install.stage.starting",
	downloading: "tab.install.stage.downloading",
	installing: "tab.install.stage.installing",
	finishing: "tab.install.stage.finishing",
	unknown: "tab.install.stage.unknown",
};

function formatElapsed(ms: number): string {
	const seconds = Math.max(0, Math.round(ms / 1000));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	return `${minutes}m${String(seconds % 60).padStart(2, "0")}s`;
}

export function ReaInstallProgress({ progress, label, onCancel, onDismiss }: InstallProgressProps): JSX.Element {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const running = progress.phase === "running";
	const elapsed = formatElapsed((progress.endedAt ?? Date.now()) - progress.startedAt);
	const lines = progress.log.length === 0 ? 0 : progress.log.split(/\r?\n/).length;
	const tone =
		progress.phase === "success"
			? "border-emerald-500/40 bg-emerald-500/5"
			: progress.phase === "failed"
				? "border-amber-500/40 bg-amber-500/5"
				: "border-primary/30 bg-primary/5";
	const statusText = running
		? progress.cancelling
			? t("tab.install.cancelling")
			: t("tab.install.running", { tool: label })
		: progress.phase === "success"
			? t("tab.install.success")
			: progress.phase === "cancelled"
				? t("tab.install.cancelled", { tool: label })
				: t("tab.install.failed", { tool: label });

	// 已完成的步骤数：成功时全部算完成；进行中只算前面若干步。
	const done = progress.phase === "success" ? progress.stepCount : progress.stepIndex;
	const determinate = progress.stepCount > 1;
	const fill = determinate ? Math.round((done / progress.stepCount) * 100) : 0;
	const stageText = t(STAGE_KEY[progress.stage]);

	return (
		<div className={`mt-1.5 rounded-[min(var(--radius-md),8px)] border px-2 py-1.5 ${tone}`}>
			<div className="flex min-w-0 items-center gap-1.5">
				<span
					aria-hidden
					className={
						running
							? "icon-[lucide--loader-circle] size-3 shrink-0 text-primary motion-safe:animate-spin"
							: progress.phase === "success"
								? "icon-[lucide--circle-check] size-3 shrink-0 text-emerald-600 dark:text-emerald-400"
								: "icon-[lucide--circle-slash] size-3 shrink-0 text-amber-600 dark:text-amber-400"
					}
				/>
				<span className="min-w-0 flex-1 truncate text-[10.5px] font-medium text-foreground/90" title={statusText}>
					{statusText}
				</span>
				<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{elapsed}</span>
				{running ? (
					<button
						type="button"
						onClick={onCancel}
						disabled={progress.cancelling}
						title={t("tab.install.cancelHint")}
						className="inline-flex h-5 shrink-0 items-center gap-1 rounded border border-border px-1.5 text-[10px] text-foreground/85 transition-colors hover:border-amber-500/50 hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
					>
						<span aria-hidden className="icon-[lucide--square] size-2.5" />
						{t("tab.install.cancel")}
					</button>
				) : (
					<button
						type="button"
						onClick={onDismiss}
						title={t("tab.install.dismiss")}
						className="inline-flex h-5 shrink-0 items-center rounded px-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						<span aria-hidden className="icon-[lucide--x] size-3" />
					</button>
				)}
			</div>

			<div className="mt-1 flex min-w-0 items-center gap-1.5 pl-[18px]">
				<div
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={progress.stepCount}
					aria-valuenow={done}
					aria-valuetext={t("tab.install.step", { index: Math.min(done + 1, progress.stepCount), total: progress.stepCount })}
					aria-busy={running}
					title={t("tab.install.barHint")}
					className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
				>
					<span
						aria-hidden
						className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300 ease-out"
						style={{ width: `${fill}%` }}
					/>
					{running && determinate ? (
						<span
							aria-hidden
							className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary/45 motion-safe:animate-rea-sweep"
						/>
					) : null}
					{running && !determinate ? (
						<span aria-hidden className="absolute inset-0 rounded-full bg-primary/25 motion-safe:animate-pulse" />
					) : null}
				</div>
				<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
					{t("tab.install.step", { index: Math.min(done + 1, progress.stepCount), total: progress.stepCount })}
				</span>
			</div>

			<div className="mt-0.5 flex min-w-0 items-center gap-1.5 pl-[18px]">
				<span className="shrink-0 text-[10px] text-muted-foreground" title={t(STAGE_KEY[progress.stage])}>
					{stageText}
				</span>
				<code className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground" title={progress.stepCommand}>
					{progress.stepCommand}
				</code>
				<button
					type="button"
					onClick={() => setOpen((prev) => !prev)}
					aria-expanded={open}
					className="inline-flex h-5 shrink-0 items-center gap-0.5 rounded px-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
				>
					<span aria-hidden className={`icon-[lucide--chevron-down] size-2.5 ${open ? "rotate-180" : ""}`} />
					{open ? t("tab.install.hideLog") : t("tab.install.showLog")}
					{lines > 0 ? <span className="tabular-nums">{` ${lines}`}</span> : null}
				</button>
			</div>

			{open ? (
				<pre className="mt-1 max-h-32 overflow-auto overscroll-contain rounded border border-border/70 bg-background/70 p-1.5 font-mono text-[10px] leading-snug text-foreground/85 whitespace-pre-wrap break-all">
					{progress.log.length > 0 ? progress.log : t("tab.install.logEmpty")}
				</pre>
			) : null}

			{progress.failure !== null ? (
				<p
					className="mt-0.5 pl-[18px] text-[10px] leading-snug text-amber-600 dark:text-amber-400"
					title={progress.failure.detail.length > 0 ? progress.failure.detail : undefined}
				>
					<span className="line-clamp-2">
						{t(progress.failure.key, { detail: progress.failure.detail })}
					</span>
				</p>
			) : null}
		</div>
	);
}
