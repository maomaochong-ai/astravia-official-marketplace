import { useTranslation } from "@astravia-org/plugin-sdk";
import { getStudioRuntime } from "../../../plugin-context.js";
import { InstructionSummary } from "../../shared/components/InstructionSummary.js";
import { newBookPrompt, nextStepPrompt } from "../handoff-prompts.js";
import { useNextStep } from "../hooks/use-next-step.js";

interface NextStepContextCardProps {
	/** 宿主给的草稿写入口：只插入，不发送（宿主刻意不提供发送）。 */
	insert(text: string): void;
}

/**
 * 新会话页输入框下方那块内容（ADR 0011 §2.1）。
 *
 * 用户在输入框里选了 Novelwright 的团队或成员时出现。它只做一件事：把「下一步是什么」
 * 摆到眼前，并允许一句话插进草稿。发送仍然由用户按回车——那是这台宿主的规矩，
 * 也是 ainovel-cli「一步一令」的习惯。
 */
export function NextStepContextCard({ insert }: NextStepContextCardProps) {
	const { t } = useTranslation();
	const { loading, book, instruction } = useNextStep();
	const runtime = getStudioRuntime();

	if (loading) {
		return <p className="px-1 text-xs text-muted-foreground">{t("composer.loading")}</p>;
	}

	if (!book) {
		return (
			<div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3">
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">{t("composer.empty.title")}</p>
					<p className="text-xs text-muted-foreground">{t("composer.empty.body")}</p>
				</div>
				<button
					type="button"
					onClick={() => insert(newBookPrompt(runtime.ctx.i18n.t))}
					className="self-start rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/60"
				>
					{t("composer.insert")}
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3">
			<div className="flex flex-wrap items-center gap-2">
				<span className="max-w-[20rem] truncate text-sm font-medium">{book.title}</span>
				<span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
					{t(`phase.${book.phase}`)}
				</span>
				<span className="text-xs tabular-nums text-muted-foreground">
					{t("studio.header.progress", {
						progress: `${book.progress.committedCount}/${book.targetChapters}`,
					})}
				</span>
			</div>

			{instruction ? (
				<InstructionSummary
					worker={instruction.worker}
					task={instruction.task}
					detail={t(instruction.reasonKey, instruction.reasonParams)}
					chapter={instruction.chapter}
				/>
			) : (
				<p className="text-xs text-muted-foreground">{t("instruction.none")}</p>
			)}

			<button
				type="button"
				onClick={() => insert(nextStepPrompt(runtime.ctx.i18n.t, book, instruction))}
				className="self-start rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
			>
				{t("composer.insert")}
			</button>
		</div>
	);
}
