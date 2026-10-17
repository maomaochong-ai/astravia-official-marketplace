/**
 * 逆向工作台（展示层）：目标类型 → 目标路径/URL → 交给 Agent。
 *
 * 不再手工跑 CLI：阶段详情会说明 Agent 会自动执行哪些 REA 工具，这里只负责
 * 「选定目标并把任务真正发进对话」。发送回执占一行固定高度，避免按钮下方内容上下跳。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PluginCommandRunResult } from "@astravia-org/plugin-sdk";
import type { TargetKind } from "../data/targets";
import type { DoctorReport } from "../hooks/use-doctor-report";
import type { Workbench } from "../hooks/use-workbench";
import type { ReaLiveCall } from "../live/session-store";
import { copyText } from "../../../shared/services/clipboard";
import { ReaWorkflowTargetRouting } from "./rea-workflow-target-routing";

interface WorkbenchProps {
	readonly workbench: Workbench;
	readonly detected: TargetKind | null;
	readonly calls: readonly ReaLiveCall[];
	readonly running: readonly string[];
	readonly report: DoctorReport;
	readonly run: (args: readonly string[], options: { cwd?: string; timeoutMs: number }) => Promise<PluginCommandRunResult>;
	readonly runCommand: ((file: string, args: readonly string[]) => Promise<PluginCommandRunResult>) | null;
	readonly cwd: string | null;
}

const FEEDBACK_TEXT: Record<Exclude<Workbench["handoff"], "idle">, string> = {
	sending: "tab.workbench.sending",
	sent: "tab.workbench.sent",
	queued: "tab.workbench.queued",
	inserted: "tab.workbench.inserted",
	failed: "tab.workbench.handoffFailed",
};

const BLOCK_TEXT: Record<Exclude<NonNullable<Workbench["blockReason"]>, "sending">, string> = {
	empty: "tab.workbench.targetRequired",
	noKind: "tab.workbench.kindUnknown",
};

export function ReaWorkbench({
	workbench,
	detected,
	calls,
	running,
	report,
	run,
	runCommand,
	cwd,
}: WorkbenchProps): JSX.Element {
	const { t } = useTranslation();
	const canHandoff = workbench.blockReason === null;
	const blockReason = workbench.blockReason;
	const feedback = workbench.handoff;
	const tone =
		feedback === "sent" || feedback === "inserted"
			? "text-emerald-600 dark:text-emerald-400"
			: feedback === "queued"
				? "text-primary"
				: feedback === "failed"
					? "text-amber-600 dark:text-amber-400"
					: "text-muted-foreground";

	return (
		<section className="border-b border-border bg-card/25 px-3 py-2.5">
			<header className="mb-2 flex min-w-0 items-baseline justify-between gap-2">
				<h2 className="shrink-0 whitespace-nowrap text-[12px] font-semibold leading-tight text-foreground">
					{t("tab.workbench.title")}
				</h2>
				<span className="min-w-0 truncate text-[10px] text-muted-foreground @max-[340px]:hidden">
					{t("tab.workbench.subtitle")}
				</span>
			</header>

			<ReaWorkflowTargetRouting
				active={workbench.active}
				picked={workbench.picked}
				detected={detected}
				calls={calls}
				running={running}
				report={report}
				run={run}
				runCommand={runCommand}
				cwd={cwd}
				onPick={workbench.pick}
				onClear={workbench.clearPick}
				onFollowDetected={workbench.clearPick}
			/>

			<div className="mt-2 flex items-center gap-1.5">
				<label className="sr-only" htmlFor="rea-target-input">
					{t("tab.workbench.targetLabel")}
				</label>
				<input
					id="rea-target-input"
					type="text"
					value={workbench.target}
					onChange={(event) => workbench.setTarget(event.target.value)}
					onKeyDown={(event) => {
						if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
						event.preventDefault();
						if (canHandoff) workbench.handoffToAgent();
					}}
					placeholder={t("tab.workbench.targetPlaceholder")}
					spellCheck={false}
					autoComplete="off"
					title={workbench.target}
					className="h-7 min-w-0 flex-1 rounded-[min(var(--radius-md),8px)] border border-border bg-background px-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
				/>
				<button
					type="button"
					onClick={() => workbench.insertToChat()}
					disabled={!canHandoff}
					title={t("tab.workbench.insertHint")}
					className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[min(var(--radius-md),8px)] border border-border px-2 text-[11px] font-medium text-foreground/85 transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<span aria-hidden className="icon-[lucide--text-cursor-input] size-3" />
					{t("tab.workbench.insert")}
				</button>
				<button
					type="button"
					onClick={() => workbench.handoffToAgent()}
					disabled={!canHandoff || feedback === "sending"}
					title={
						blockReason === "noKind"
							? t("tab.workbench.kindUnknown")
							: blockReason === "empty"
								? t("tab.workbench.targetRequired")
								: t("tab.workbench.handoffHint")
					}
					className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[min(var(--radius-md),8px)] border border-primary/40 bg-primary/10 px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground"
				>
					{feedback === "sending" ? (
						<span aria-hidden className="icon-[lucide--loader-circle] size-3 motion-safe:animate-spin" />
					) : (
						<span aria-hidden className="icon-[lucide--send] size-3" />
					)}
					{t("tab.workbench.handoff")}
				</button>
			</div>

			{/* 固定高度：回执出现/消失不再顶走下面的阶段条。 */}
			<div className="mt-1 flex h-4 min-w-0 items-center gap-1.5">
				{feedback !== "idle" ? (
					<span className={`min-w-0 truncate text-[10.5px] leading-none ${tone}`} title={t(FEEDBACK_TEXT[feedback])}>
						{t(FEEDBACK_TEXT[feedback])}
					</span>
				) : (
					<span
						className={`min-w-0 truncate text-[10.5px] leading-none ${blockReason === null ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"}`}
						title={blockReason === null ? undefined : t(BLOCK_TEXT[blockReason as keyof typeof BLOCK_TEXT])}
					>
						{blockReason === null ? t("tab.workbench.ready") : t(BLOCK_TEXT[blockReason as keyof typeof BLOCK_TEXT])}
					</span>
				)}
				{feedback === "failed" && workbench.promptText.length > 0 ? (
					<button
						type="button"
						onClick={() => void copyText(workbench.promptText)}
						className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-1 text-[10px] text-foreground/85 transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						<span aria-hidden className="icon-[lucide--copy] size-2.5" />
						{t("tab.workbench.copyPrompt")}
					</button>
				) : null}
			</div>
		</section>
	);
}
