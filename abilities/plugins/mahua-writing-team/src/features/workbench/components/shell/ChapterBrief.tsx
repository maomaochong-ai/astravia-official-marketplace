import { useTranslator } from "../../hooks/use-translator";

/**
 * 当前章的简报：只把「这一章要干什么」摊开。
 *
 * 没有任何派活按钮——章纲齐了之后，写作者在宿主侧栏里自己接活，正文落盘后这里跟着改。
 * 页脚那句「这里只读」从前旁边还挂着一枚「跳到侧栏对话」，现在没了：宿主没有「聚焦侧栏
 * 对话」的 API，那枚键只能扫 DOM 找输入框，宿主换一次实现就静默失灵（而且侧栏本来就在
 * 旁边，用户不需要一个新按钮告诉他哪里是侧栏）。
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
						<span className="min-w-0 truncate text-[10px] tracking-wide text-ink-faint">{arc}</span>
						<span className="shrink-0 rounded-tile bg-cinnabar-soft px-1.5 text-[10px] leading-[17px] font-medium text-cinnabar-ink">
							{state}
						</span>
					</div>
					<h2 className="mt-0.5 min-w-0 truncate font-display text-heading font-semibold text-ink">{title}</h2>
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

			<dl className="grid grid-cols-[52px_1fr] gap-y-1.5 px-4 py-3 text-micro leading-5">
				<dt className="text-ink-faint">{t("brief.goal")}</dt>
				<dd className="text-ink">{goal || empty}</dd>
				<dt className="text-ink-faint">{t("brief.conflict")}</dt>
				<dd className="text-ink">{conflict || empty}</dd>
				<dt className="text-ink-faint">{t("brief.hook")}</dt>
				<dd className="text-ink">{hook || empty}</dd>
			</dl>

			<div className="flex items-center gap-2 bg-well px-4 py-2.5">
				<span className="icon-[solar--eye-linear] size-3 shrink-0 text-ink-faint" />
				<span className="min-w-0 flex-1 truncate text-[10px] text-ink-soft">{t("brief.readonlyNote")}</span>
			</div>
		</section>
	);
}
