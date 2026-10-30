import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import type { NovelBook, ReviewDimension, ReviewReport } from "../../../domain/novel-types.js";
import { ChapterDot } from "../../shared/components/ChapterDot.js";
import { ScoreBar } from "../../shared/components/ScoreBar.js";
import { DEFAULT_READER_SCALE, dateOf, paragraphsOf, readerType } from "../bookshelf-model.js";
import { ReaderControls } from "./ReaderControls.js";

interface ReaderPaneProps {
	book: NovelBook;
	chapter: number | null;
	text: string;
	review: ReviewReport | null;
	loading: boolean;
	onBack: () => void;
	onOpenChapter: (n: number) => void;
}

/** 七维评审的固定顺序：分数条按这个顺序排，换一本也不跳位。 */
const DIMENSIONS: ReviewDimension["key"][] = [
	"plot",
	"character",
	"pacing",
	"prose",
	"dialogue",
	"continuity",
	"hook",
];

/**
 * 阅读页（ADR 0013 §2.4 / 0024 §1 / 0026 §4 / 0027 §8）。
 *
 * 版面照设计稿 `reader` 帧：顶栏是「返回 + 章号 + 章名 + 字族 + 目录」，
 * 正文是一张浮在看板上的纸（圆角 13px、细边、投影，宽 648px 居中），底栏是翻页与字号。
 * 右侧「本章评审」318px，`xl` 才出现：窄面板里正文优先，评审可以从书页的指令卡看到。
 *
 * 正文的行高、缩进、字号全部来自 `readerType(scale)` 的五档比例（ADR 0016），
 * 换档只换那三组数字，不改结构；正文只来自仓储，不经模型改写。
 */
export function ReaderPane({ book, chapter, text, review, loading, onBack, onOpenChapter }: ReaderPaneProps) {
	const { t } = useTranslation();
	const [scale, setScale] = useState(DEFAULT_READER_SCALE);
	const [serif, setSerif] = useState(true);
	const type = readerType(scale);

	const meta = chapter === null ? null : (book.chapters.find((item) => item.n === chapter) ?? null);
	const chapters = book.chapters;
	const index = chapter === null ? -1 : chapters.findIndex((item) => item.n === chapter);
	const previous = index > 0 ? (chapters[index - 1] ?? null) : null;
	const next = index >= 0 ? (chapters[index + 1] ?? null) : null;
	const paragraphs = paragraphsOf(text);

	const heading =
		chapter === null
			? t("reader.empty")
			: meta && meta.title
				? meta.title
				: t("reader.title", { chapter });
	const kicker = chapter === null ? "" : t("board.chapterLabel", { chapter });

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border/50 px-4 py-2 sm:px-6">
				<button
					type="button"
					onClick={onBack}
					aria-label={t("reader.book")}
					className="flex shrink-0 items-center gap-1 rounded-[9px] px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					<span aria-hidden="true" className="icon-[solar--alt-arrow-left-linear] size-3.5" />
					{t("reader.book")}
				</button>

				<span className="flex min-w-0 flex-1 items-baseline gap-2">
					{kicker ? (
						<span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{kicker}</span>
					) : null}
					<span className="min-w-0 truncate font-serif text-[15px] font-semibold text-foreground">{heading}</span>
					{meta && meta.words > 0 ? (
						<span className="hidden shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground sm:inline">
							{t("board.words", { count: meta.words })}
						</span>
					) : null}
				</span>

				<span
					role="group"
					aria-label={t("reader.family")}
					className="flex shrink-0 items-center rounded-[9px] border border-border p-0.5"
				>
					<button
						type="button"
						aria-pressed={serif}
						onClick={() => setSerif(true)}
						className={`rounded-[7px] px-2 py-0.5 text-[10px] transition-colors ${
							serif ? "bg-foreground font-medium text-background" : "text-muted-foreground hover:bg-muted"
						}`}
					>
						{t("reader.serif")}
					</button>
					<button
						type="button"
						aria-pressed={!serif}
						onClick={() => setSerif(false)}
						className={`rounded-[7px] px-2 py-0.5 text-[10px] transition-colors ${
							serif ? "text-muted-foreground hover:bg-muted" : "bg-foreground font-medium text-background"
						}`}
					>
						{t("reader.sans")}
					</button>
				</span>

				<details className="relative shrink-0">
					<summary className="cursor-pointer list-none rounded-[9px] border border-border px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
						{t("book.index")}
					</summary>
					<div className="absolute right-0 z-10 mt-1 max-h-72 w-64 overflow-y-auto rounded-[13px] border border-border bg-popover p-1.5 shadow-lg">
						<ul className="flex flex-col">
							{chapters.map((item) => (
								<li key={item.n}>
									<button
										type="button"
										onClick={() => onOpenChapter(item.n)}
										aria-current={item.n === chapter ? "page" : undefined}
										className={`flex w-full min-w-0 items-center gap-2 rounded-[7px] px-2 py-1 text-left text-[11px] transition-colors hover:bg-muted ${
											item.n === chapter ? "bg-muted text-foreground" : "text-muted-foreground"
										}`}
									>
										<ChapterDot status={item.status} />
										<span className="w-6 shrink-0 font-mono tabular-nums">{item.n}</span>
										<span className="min-w-0 flex-1 truncate">{item.title || t("board.untitled")}</span>
									</button>
								</li>
							))}
						</ul>
					</div>
				</details>
			</div>

			<div className="flex min-h-0 flex-1">
				<div className="min-h-0 flex-1 overflow-y-auto bg-muted/40 px-3 py-4 sm:px-6 sm:py-6">
					<article
						className={`mx-auto w-full max-w-[648px] rounded-[13px] bg-card px-5 pb-12 pt-7 shadow-xs sm:px-10 sm:pt-9 ${
							serif ? "font-serif" : ""
						}`}
					>
						<p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/70">
							{book.title}
						</p>
						<h1
							className="mt-1.5 font-medium tracking-tight text-foreground [overflow-wrap:anywhere]"
							style={{
								fontSize: `${type.title}px`,
								lineHeight: `${type.titleLine}px`,
								marginBottom: `${type.titleGap}px`,
							}}
						>
							{heading}
						</h1>

						<div
							className="flex flex-wrap items-center gap-x-5 gap-y-1 text-muted-foreground"
							style={{
								fontSize: `${type.meta}px`,
								lineHeight: `${type.metaLine}px`,
								marginBottom: `${type.metaGap}px`,
							}}
						>
							{meta && meta.words > 0 ? (
								<span className="tabular-nums">{t("board.words", { count: meta.words })}</span>
							) : null}
							{meta ? (
								<span className="tabular-nums">{t("reader.updatedAt", { date: dateOf(meta.updatedAt) })}</span>
							) : null}
							{review ? <span className="tabular-nums">{t("reader.score", { score: review.score })}</span> : null}
						</div>

						{loading ? (
							<p className="text-sm text-muted-foreground">{t("studio.loading")}</p>
						) : paragraphs.length === 0 ? (
							<p className="text-sm text-muted-foreground">{t("reader.blank")}</p>
						) : (
							<div className="mahua-prose text-justify [word-break:break-word]">
								{paragraphs.map((paragraph, position) => (
									<p
										key={position}
										style={{
											fontSize: `${type.body}px`,
											lineHeight: `${type.bodyLine}px`,
											textIndent: `${type.bodyIndent}px`,
											marginBottom: `${type.bodyGap}px`,
										}}
									>
										{paragraph}
									</p>
								))}
							</div>
						)}
					</article>
				</div>

				{review ? (
					<aside className="hidden w-[318px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border/50 bg-card px-4 py-4 xl:flex">
						<div className="flex items-baseline justify-between gap-2">
							<h2 className="font-serif text-[15px] font-semibold text-foreground">{t("reader.review")}</h2>
							<span className="font-mono text-[22px] font-medium tabular-nums text-foreground">{review.score}</span>
						</div>

						<div className="flex flex-col gap-1.5">
							{DIMENSIONS.map((key) => {
								const dimension = review.dimensions.find((item) => item.key === key);
								return (
									<ScoreBar key={key} label={t(`dimension.${key}`)} value={dimension ? dimension.score : 0} />
								);
							})}
						</div>

						<div className="flex flex-col gap-1.5 border-t border-border/50 pt-3">
							<h3 className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
								{t("reader.mustFix")}
							</h3>
							{review.mustFix.length > 0 ? (
								<ul className="flex list-none flex-col gap-1.5">
									{review.mustFix.map((item) => (
										<li key={item} className="text-[11px] leading-relaxed text-foreground [overflow-wrap:anywhere]">
											{item}
										</li>
									))}
								</ul>
							) : (
								<p className="text-[11px] text-muted-foreground">{t("reader.noMustFix")}</p>
							)}
						</div>
					</aside>
				) : null}
			</div>

			<ReaderControls
				scale={scale}
				canPrev={previous !== null}
				canNext={next !== null}
				onScale={setScale}
				onPrev={() => previous && onOpenChapter(previous.n)}
				onNext={() => next && onOpenChapter(next.n)}
			/>
		</div>
	);
}
