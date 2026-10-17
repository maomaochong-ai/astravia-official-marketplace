/**
 * 一键安装的进行中面板：命令行、已用时间、过程输出、取消。
 *
 * 数据全部来自 `useToolInstall`（宿主 spawn 的真实输出），这里不做任何推断：
 * 进度条只显示已用时间，不编造百分比——brew 不报总进度，编一个就是假信息。
 */

import { useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { InstallProgress } from "../hooks/use-tool-install";

interface InstallProgressProps {
	readonly progress: InstallProgress;
	/** 本地化的工具名；取不到时退回 id。 */
	readonly label: string;
	readonly onCancel: () => void;
	readonly onDismiss: () => void;
}

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

			<div className="mt-0.5 flex min-w-0 items-center gap-1.5 pl-[18px]">
				<code className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground" title={progress.command}>
					{progress.command}
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

			{progress.message !== null ? (
				<p className="mt-0.5 pl-[18px] text-[10px] leading-snug text-amber-600 dark:text-amber-400" title={progress.message}>
					<span className="line-clamp-2">{progress.message}</span>
				</p>
			) : null}
		</div>
	);
}
