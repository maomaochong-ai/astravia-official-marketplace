import { useTranslation } from "@astravia-org/plugin-sdk";
import type { NovelBook } from "../../../domain/novel-types.js";
import { PhaseTimeline } from "./PhaseTimeline.js";

/**
 * 书头（ADR 0011 §2.2）：书名、阶段、进度一行读完，再给阶段时间线。
 * 宿主页头只留书名与「复制全稿」，其余细节都在这里——页头是导航，书头是内容。
 */
export function BookHead({ book }: { book: NovelBook }) {
	const { t } = useTranslation();
	const committed = book.progress.committedCount;
	const target = book.targetChapters;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-baseline gap-2">
				<h2 className="text-base font-medium">{book.title}</h2>
				<span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
					{t(`phase.${book.phase}`)}
				</span>
				<span className="text-xs tabular-nums text-muted-foreground">
					{t("studio.header.progress", { progress: `${committed}/${target}` })}
				</span>
				{book.progress.pendingRewrite.length > 0 ? (
					<span className="rounded-md bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
						{t("board.pendingRewrite")}
					</span>
				) : null}
			</div>
			<PhaseTimeline phase={book.phase} />
		</div>
	);
}
