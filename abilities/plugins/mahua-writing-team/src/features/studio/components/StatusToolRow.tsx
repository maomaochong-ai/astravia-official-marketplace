import type { PluginToolCallSlotProps } from "@astravia-org/plugin-sdk";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ChapterStatus } from "../../../domain/novel-types.js";
import { StatusPill } from "../../shared/components/StatusPill.js";
import { parseToolResult } from "../tool-result.js";

interface BookStatusPayload {
	ok?: boolean;
	error?: string;
	title?: string;
	phase?: string;
	currentChapter?: number;
	committedCount?: number;
	targetChapters?: number;
	currentChapterStatus?: ChapterStatus | null;
	currentChapterWords?: number;
	pendingRewrite?: boolean;
}

/**
 * `mahua_book_status` 的行内渲染（ADR 0011 §2.1）：一条进度行，不是一屏状态。
 * 数据全部来自工具返回值——这里不读仓储，免得界面与模型看到的事实分叉。
 */
export function StatusToolRow({ toolCall }: PluginToolCallSlotProps) {
	const { t } = useTranslation();
	const payload = parseToolResult<BookStatusPayload>(toolCall.result);

	if (toolCall.status === "pending") {
		return <p className="px-1 py-1.5 text-xs text-muted-foreground">{t("row.working")}</p>;
	}
	if (!payload?.ok) {
		return <p className="px-1 py-1.5 text-xs text-muted-foreground">{t("row.failed")}</p>;
	}

	const committed = payload.committedCount ?? 0;
	const target = payload.targetChapters ?? 0;
	const ratio = target > 0 ? Math.min(1, committed / target) : 0;

	return (
		<div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card px-3 py-2.5">
			<div className="flex flex-wrap items-center gap-2">
				<span className="max-w-[18rem] truncate text-sm font-medium">{payload.title}</span>
				{payload.phase ? (
					<span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
						{t(`phase.${payload.phase}`)}
					</span>
				) : null}
				{payload.currentChapterStatus ? <StatusPill status={payload.currentChapterStatus} /> : null}
				{payload.pendingRewrite ? (
					<span className="rounded-md bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
						{t("board.pendingRewrite")}
					</span>
				) : null}
			</div>
			<div className="flex items-center gap-2">
				<div
					className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
					role="progressbar"
					aria-valuenow={committed}
					aria-valuemin={0}
					aria-valuemax={target}
				>
					<div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(ratio * 100)}%` }} />
				</div>
				<span className="text-xs tabular-nums text-muted-foreground">
					{t("studio.header.progress", { progress: `${committed}/${target}` })}
				</span>
				<span className="text-xs tabular-nums text-muted-foreground">
					{t("board.words", { count: payload.currentChapterWords ?? 0 })}
				</span>
			</div>
		</div>
	);
}
