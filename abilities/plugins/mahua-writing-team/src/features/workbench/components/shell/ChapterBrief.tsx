import { useTranslator } from "../../hooks/use-translator";

/**
 * 当前章的简报：只把「这一章要干什么」摊开。
 *
 * 没有任何派活按钮——章纲齐了之后，写作者在宿主侧栏里自己接活，正文落盘后这里跟着改。
 * 唯一可点的是「去侧栏看它写」，它只把视线送过去，不携带指令。
 */
export function ChapterBrief({
	number,
	arc,
	title,
	state,
	goal,
	conflict,
	hook,
	writing,
	elapsed,
	onRevealTeam,
}: {
	number: number;
	arc: string;
	title: string;
	state: string;
	goal: string;
	conflict: string;
	hook: string;
	/** 侧栏团队是否正在写这一章；false 时右上角不假装有人在写。 */
	writing: boolean;
	elapsed: string;
	onRevealTeam(): void;
}) {
	const t = useTranslator();
	const empty = t("brief.empty");

	return (
		<section className="overflow-hidden rounded-sheet bg-raised shadow-raise">
			<div className="flex items-start gap-4 px-4 pb-3.5 pt-4">
				<div className="w-12 shrink-0 text-right">
					<div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
						{t("brief.chapterLabel")}
					</div>
					<div className="font-display text-title font-semibold leading-none text-ink">{number}</div>
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="truncate text-[10px] tracking-wide text-ink-faint">{arc}</span>
						<span className="shrink-0 rounded-tile bg-cinnabar-soft px-1.5 text-[10px] leading-[17px] font-medium text-cinnabar-ink">
							{state}
						</span>
					</div>
					<h2 className="mt-0.5 truncate font-display text-heading font-semibold text-ink">{title}</h2>
				</div>
				<div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
					{writing ? (
						<span className="flex items-center gap-1.5 text-micro text-ink">
							<span className="size-1.5 rounded-pill bg-cinnabar" />
							{t("brief.writing")}
						</span>
					) : (
						<span className="flex items-center gap-1.5 text-micro text-ink-soft">
							<span className="size-1.5 rounded-pill border border-line-strong" />
							{t("brief.idle")}
						</span>
					)}
					{elapsed && <span className="font-mono text-[10px] text-ink-faint">{elapsed}</span>}
				</div>
			</div>

			<dl className="grid grid-cols-[52px_1fr] gap-y-1.5 border-t border-line-soft px-4 py-3 text-micro leading-5">
				<dt className="text-ink-faint">{t("brief.goal")}</dt>
				<dd className="text-ink">{goal || empty}</dd>
				<dt className="text-ink-faint">{t("brief.conflict")}</dt>
				<dd className="text-ink">{conflict || empty}</dd>
				<dt className="text-ink-faint">{t("brief.hook")}</dt>
				<dd className="text-ink">{hook || empty}</dd>
			</dl>

			<div className="flex items-center gap-2 border-t border-line-soft bg-inset px-4 py-2.5">
				<span className="icon-[lucide--eye] size-3 shrink-0 text-ink-faint" />
				<span className="min-w-0 flex-1 truncate text-[10px] text-ink-soft">{t("brief.readonlyNote")}</span>
				<button
					type="button"
					onClick={onRevealTeam}
					className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-ink transition-colors hover:text-cinnabar-ink"
				>
					{t("brief.revealTeam")}
					<span className="icon-[lucide--arrow-up-right] size-3" />
				</button>
			</div>
		</section>
	);
}
