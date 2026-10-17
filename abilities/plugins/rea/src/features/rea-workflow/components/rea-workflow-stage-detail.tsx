/**
 * 单阶段详情卡：标题 + 副标题 + 流程示意图 + 4 个要点 + 可运行命令 + 关联 reference + 失败兜底。
 *
 * 容器：bg-card / border-border / rounded-[min(var(--radius-md),10px)]。
 * 段落标题：text-[10px] uppercase tracking-wider text-muted-foreground。
 *
 * 命令不再写死文本：阶段只声明命令 id，由工作台用同一份命令目录渲染成可点击执行的行，
 * 输入框里的目标路径会对 `{target}` 做替换。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { commandsForTarget, findCommand, type ReaCommandDefinition } from "../data/commands";
import { ReaCommandList } from "./rea-command-list";
import type { TargetKind } from "../data/targets";
import type { StageDefinition } from "../data/stages";
import { ReaWorkflowStageDiagram } from "./rea-workflow-stage-diagram";

interface DetailProps {
	readonly stage: StageDefinition;
	/** 总阶段数，用于 "Stage n of N"。 */
	readonly total: number;
	/** 工作台输入框里的目标路径/URL，用于替换命令里的 `{target}`。 */
	readonly target: string;
	readonly busy: boolean;
	readonly activeCommandId: string | null;
	readonly onRun: (command: ReaCommandDefinition) => void;
	/** 工作台当前目标类型；用来把阶段命令限定在该目标的入口命令上。 */
	readonly activeTarget: TargetKind | null;
}

export function ReaWorkflowStageDetail({
	stage,
	total,
	target,
	busy,
	activeCommandId,
	activeTarget,
	onRun,
}: DetailProps): JSX.Element {
	const { t } = useTranslation();
	const declared = stage.commandIds
		.map((id) => findCommand(id))
		.filter((command): command is ReaCommandDefinition => command !== null);
	// 已选定目标时只留该目标的入口命令，避免 .NET 用户看到 APK 命令；未选目标时全列（这正是选路由的时候）。
	const scoped = activeTarget
		? declared.filter((command) => commandsForTarget(activeTarget).some((candidate) => candidate.id === command.id))
		: declared;
	const commands = scoped.length > 0 ? scoped : declared;
	return (
		<div className="flex flex-col bg-card text-card-foreground">
			<header className="border-b border-border px-4 py-3">
				<div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
					<span>{t("tab.detail.stageOf", { current: stage.index, total })}</span>
				</div>
				<h2 className="mt-1 text-sm font-semibold leading-tight text-foreground">{t(stage.headingKey)}</h2>
				<p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t(stage.subtitleKey)}</p>
			</header>

			<section className="border-b border-border px-4 py-3">
				<h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
					{t("tab.detail.section.flow")}
				</h3>
				<div className="overflow-hidden rounded-[min(var(--radius-md),10px)] border border-border bg-background/40 p-2">
					<ReaWorkflowStageDiagram kind={stage.diagram} />
				</div>
			</section>

			<section className="border-b border-border px-4 py-3">
				<h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
					{t("tab.detail.section.bullets")}
				</h3>
				<ul className="space-y-1.5 text-xs leading-relaxed">
					{stage.bullets.map((b, i) => (
						<li key={i} className="flex gap-2 text-foreground/90">
							<span className="mt-1 inline-block size-1 shrink-0 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
							<span>{t(b.i18nKey)}</span>
						</li>
					))}
				</ul>
			</section>

			<section className="border-b border-border px-4 py-3">
				{commands.length > 0 ? (
					<>
						<h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
							{t("tab.detail.section.command")}
						</h3>
						<ReaCommandList
							commands={commands}
							target={target}
							busy={busy}
							activeCommandId={activeCommandId}
							onRun={onRun}
						/>
					</>
				) : (
					<p className="text-xs leading-relaxed text-muted-foreground">{t("tab.detail.agentDriven")}</p>
				)}
			</section>

			{stage.referencePath ? (
				<section className="border-b border-border px-4 py-3">
					<h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
						{t("tab.detail.section.reference")}
					</h3>
					<code className="block truncate rounded-[min(var(--radius-md),8px)] border border-border bg-background/50 px-2 py-1 font-mono text-[11px] text-foreground/80">
						{stage.referencePath}
					</code>
				</section>
			) : null}

			<section className="px-4 py-3">
				<h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
					{t("tab.detail.section.fallback")}
				</h3>
				<p className="rounded-[min(var(--radius-md),10px)] border border-warning/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
					{t(stage.fallbackKey)}
				</p>
			</section>
		</div>
	);
}
