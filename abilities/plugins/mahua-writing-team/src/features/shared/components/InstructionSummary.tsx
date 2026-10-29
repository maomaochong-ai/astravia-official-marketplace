import { useTranslation } from "@astravia-org/plugin-sdk";

interface InstructionSummaryProps {
	worker: string;
	task: string;
	/** 已经本地化过的理由：工作台从 key 取，工具行内渲染直接用工具返回的那句。 */
	detail: string;
	chapter?: number | null;
}

/**
 * 「谁 / 做什么 / 为什么」这三行的唯一实现（ADR 0011 §2.1）。
 * 工作台的指令卡与对话里的工具行内渲染都用它，两处不会各写一套措辞。
 */
export function InstructionSummary({ worker, task, detail, chapter }: InstructionSummaryProps) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex flex-wrap items-center gap-2">
				<span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
					{t(`worker.${worker}`)}
				</span>
				<span className="text-xs text-muted-foreground">{t(`task.${task}`)}</span>
				{chapter ? (
					<span className="text-xs tabular-nums text-muted-foreground">
						{t("board.chapterLabel", { chapter })}
					</span>
				) : null}
			</div>
			<p className="text-sm text-muted-foreground">{detail}</p>
		</div>
	);
}
