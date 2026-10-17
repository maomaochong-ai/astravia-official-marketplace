/**
 * 逆向工作台（展示层）：目标类型 → 目标路径/URL → 可运行命令 → 结果 → 交给 Agent。
 *
 * 状态全部来自 useWorkbench；这个组件只负责排版，方便阶段详情复用同一台命令运行器。
 * 命令清单来自 data/commands.ts，参数与上游 docs/cli.md 对齐，不写上游没有的命令。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { TargetKind } from "../data/targets";
import type { Workbench } from "../hooks/use-workbench";
import { ReaCommandList } from "./rea-command-list";
import { ReaCommandOutput } from "./rea-command-output";
import { ReaWorkflowTargetRouting } from "./rea-workflow-target-routing";

interface WorkbenchProps {
	readonly workbench: Workbench;
	readonly detected: TargetKind | null;
}

export function ReaWorkbench({ workbench, detected }: WorkbenchProps): JSX.Element {
	const { t } = useTranslation();
	const canHandoff = workbench.active !== null && workbench.target.trim().length > 0;
	const { runner } = workbench;

	return (
		<section className="border-b border-border bg-card/25 px-3 py-2.5">
			<header className="mb-2 flex items-baseline justify-between gap-2">
				<h2 className="text-[12px] font-semibold leading-tight text-foreground">{t("tab.workbench.title")}</h2>
				<span className="truncate text-[10px] text-muted-foreground">{t("tab.workbench.subtitle")}</span>
			</header>

			<ReaWorkflowTargetRouting
				active={workbench.active}
				picked={workbench.picked}
				detected={detected}
				onPick={workbench.pick}
				onClear={workbench.clearPick}
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
					placeholder={t("tab.workbench.targetPlaceholder")}
					spellCheck={false}
					autoComplete="off"
					className="h-7 min-w-0 flex-1 rounded-[min(var(--radius-md),8px)] border border-border bg-background px-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
				/>
				<button
					type="button"
					onClick={workbench.handoffToAgent}
					disabled={!canHandoff}
					title={canHandoff ? t("tab.workbench.handoffHint") : t("tab.workbench.targetRequired")}
					className="inline-flex h-7 shrink-0 items-center rounded-[min(var(--radius-md),8px)] border border-primary/40 bg-primary/10 px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground"
				>
					{t("tab.workbench.handoff")}
				</button>
			</div>

			{workbench.handoff !== "idle" ? (
				<p
					className={`mt-1 text-[10.5px] leading-relaxed ${
						workbench.handoff === "done" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
					}`}
				>
					{workbench.handoff === "done" ? t("tab.workbench.handoffDone") : t("tab.workbench.handoffFailed")}
				</p>
			) : null}

			<div className="mt-2.5">
				<h3 className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
					{t("tab.workbench.commandsTitle")}
				</h3>
				<ReaCommandList
					commands={workbench.commands}
					target={workbench.target}
					busy={runner.busy}
					activeCommandId={runner.state?.commandId ?? null}
					onRun={workbench.runCommand}
				/>
			</div>

			{runner.state ? <ReaCommandOutput state={runner.state} onClear={runner.clear} /> : null}
		</section>
	);
}
