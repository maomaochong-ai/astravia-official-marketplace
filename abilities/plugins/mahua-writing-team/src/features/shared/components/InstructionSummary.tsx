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
 *
 * 取色跟设计稿一致：`worker` 是一枚**朱砂浅底**的小签（宿主 `primary` 是朱砂，
 * `accent` 只是 hover 面，不能当品牌色用），任务名与章号走正文色，
 * 理由是唯一的正文段落，读起来最重。
 */
export function InstructionSummary({ worker, task, detail, chapter }: InstructionSummaryProps) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex flex-wrap items-center gap-1.5">
				<span className="rounded-[6px] bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.06em] text-primary">
					{t(`worker.${worker}`)}
				</span>
				<span className="text-[11px] font-medium text-foreground">{t(`task.${task}`)}</span>
				{chapter ? (
					<span className="font-mono text-[10px] tabular-nums text-muted-foreground">
						{t("board.chapterLabel", { chapter })}
					</span>
				) : null}
			</div>
			<p className="text-[12px] leading-5 text-muted-foreground">{detail}</p>
		</div>
	);
}
