import { useTranslation } from "@astravia-org/plugin-sdk";
import type { FeedEvent, FeedStatus } from "../live-feed/feed-types.js";

interface FeedStreamProps {
	events: readonly FeedEvent[];
}

/** 事件流里只出现时刻，不出现日期：跨天的那几条看落盘时间线就知道了。 */
function clockOf(at: string): string {
	const parsed = new Date(at);
	if (Number.isNaN(parsed.getTime())) return "--:--:--";
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
}

const DOT: Record<FeedStatus, string> = {
	start: "bg-primary/70",
	done: "bg-muted-foreground/40",
	failed: "bg-destructive",
};

const STATUS_KEY: Record<FeedStatus, string> = {
	start: "feed.status.start",
	done: "feed.status.done",
	failed: "feed.status.failed",
};

/**
 * 运行台的活动流（ADR 0027 §1 修订版）。
 *
 * 每一行都是一次真实发生过的工具事件：宿主 hook 把工具名、入参、返回与错误交过来，
 * `describeToolEvent` 决定它值不值得进流。**不在这里补任何推测**——没有模型名、
 * 没有上下文占用、没有「预计还需 3 分钟」。
 */
export function FeedStream({ events }: FeedStreamProps) {
	const { t } = useTranslation();

	return (
		<ol className="flex min-h-0 flex-1 flex-col overflow-y-auto">
			{events.map((event) => (
				<li
					key={event.id}
					className="flex min-w-0 flex-col gap-0.5 border-b border-border/30 px-4 py-1.5 last:border-b-0"
				>
					<div className="flex min-w-0 items-baseline gap-2">
						<span className="w-[54px] shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground/70">
							{clockOf(event.at)}
						</span>
						<span
							aria-hidden="true"
							className={`mt-[3px] size-1.5 shrink-0 self-start rounded-full ${DOT[event.status]}`}
						/>
						<span className="min-w-0 flex-1 text-[10.5px] leading-[16px] text-foreground [overflow-wrap:anywhere]">
							{t(event.textKey, event.textParams)}
						</span>
						{event.chapter === undefined ? null : (
							<span className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">
								{t("board.chapterLabel", { chapter: event.chapter })}
							</span>
						)}
						<span className="shrink-0 font-mono text-[9px] text-muted-foreground/60">
							{t(STATUS_KEY[event.status])}
						</span>
					</div>
					{event.detail ? (
						<p className="pl-[62px] font-mono text-[9px] leading-[14px] text-muted-foreground/70 [overflow-wrap:anywhere]">
							{event.detail}
						</p>
					) : null}
				</li>
			))}
		</ol>
	);
}
