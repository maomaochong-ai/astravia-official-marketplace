import { useTranslation } from "@astravia-org/plugin-sdk";
import type { NovelBook } from "../../../domain/novel-types.js";
import { PhaseBadge } from "../../shared/components/PhaseBadge.js";
import { PhaseTimeline } from "./PhaseTimeline.js";

/**
 * 书头（ADR 0011 §2.2，版面对齐设计稿 `book` 帧的 `PageHeader`）。
 *
 * 书名是这一页唯一的大字（26–30px 衬线），阶段徽章与「已提交 N/M」跟在书名后面同一基线；
 * 阶段时间线单独占一行压在下面。宿主页头只留返回与操作，其余细节都在书头。
 */
export function BookHead({ book }: { book: NovelBook }) {
	const { t } = useTranslation();
	const committed = book.progress.committedCount;
	const target = book.targetChapters;

	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
				<h2 className="min-w-0 font-serif text-[24px] font-semibold leading-tight tracking-tight text-foreground sm:text-[28px]">
					{book.title}
				</h2>
				<PhaseBadge phase={book.phase} />
				<span className="font-mono text-[10px] tabular-nums text-muted-foreground">
					{t("studio.header.progress", { progress: `${committed}/${target}` })}
				</span>
				{book.progress.pendingRewrite.length > 0 ? (
					<span className="rounded-[6px] bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">
						{t("board.pendingRewrite")}
					</span>
				) : null}
			</div>
			<PhaseTimeline phase={book.phase} />
		</div>
	);
}
