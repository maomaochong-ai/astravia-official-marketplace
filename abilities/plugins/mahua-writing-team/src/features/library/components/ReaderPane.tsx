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
 * 阅读页（ADR 0013 §2.4 / 0024 §1，版面见 ADR 0026 §4）：顶栏导航 → 白纸正文列 → 底栏翻页与字号。
 *
 * 版面照番茄阅读器：正文列压在看板底色上，章头、元信息、正文的行高缩进全部来自
 * `readerType(scale)` 的五档比例（ADR 0016），换档只换那三组数字，不改结构。
 * 设计稿把字族切换与目录放在顶栏，这里照办；字号仍留在底栏——它是阅读时最常碰的控件，
 * 放在拇指够得着的位置比放在顶栏更合适，也不与 `ReaderControls` 的既有键盘路径打架。
 *
 * 设计稿右侧那块「本章评审」在 `xl` 才出现：窄面板里正文优先，评审可以从书页的指令卡看到。
 * 正文只来自仓储，不经模型改写；评审块有才显示。
 */
export function ReaderPane({ book, chapter, text, review, loading, onBack, onOpenChapter }: ReaderPaneProps) {
	const { t } = useTranslation();
	const [scale, setScale] = useState(DEFAULT_READER_SCALE);
	const [serif, setSerif] = useState(true);
	const type = readerType(scale);

	const meta = chapter === null ? null : book.chapters.find((item) => item.n === chapter) ?? null;
	const chapters = book.chapters;
	const index = chapter === null ? -1 : chapters.findIndex((item) => item.n === chapter);
	const previous = index > 0 ? chapters[index - 1] ?? null : null;
	const next = index >= 0 ? chapters[index + 1] ?? null : null;
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
			<div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border/40 px-4 py-2">
				<button
					type="button"
					onClick={onBack}
					aria-label={t("reader.book")}
					className="shrink-0 rounded-lg px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					← {t("reader.book")}
				</button>

				<span className="flex min-w-0 flex-1 items-baseline gap-2">
					{kicker ? (
						<span className="shrink-0 text-xs tabular-nums text-muted-foreground">{kicker}</span>
					) : null}
					<span className="min-w-0 truncate text-sm font-medium text-foreground">{heading}</span>
					{meta && meta.words > 0 ? (
						<span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">
							{t("board.words", { count: meta.words })}
						</span>
					) : null}
				</span>

				<span
					role="group"
					aria-label={t("reader.family")}
					className="flex shrink-0 items-center rounded-lg border border-border/60 p-0.5"
				>
					<button
						type="button"
						aria-pressed={serif}
						onClick={() => setSerif(true)}
						className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
							serif ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
						}`}
					>
						{t("reader.serif")}
					</button>
					<button
						type="button"
						aria-pressed={!serif}
						onClick={() => setSerif(false)}
						className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
							serif ? "text-muted-foreground hover:bg-muted" : "bg-primary text-primary-foreground"
						}`}
					>
						{t("reader.sans")}
					</button>
				</span>

				<details className="relative shrink-0">
					<summary className="cursor-pointer list-none rounded-lg border border-border/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
						{t("book.index")}
					</summary>
					<div className="absolute right-0 z-10 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1.5 shadow-lg">
						<ul className="flex flex-col">
							{chapters.map((item) => (
								<li key={item.n}>
									<button
										type="button"
										onClick={() => onOpenChapter(item.n)}
										aria-current={item.n === chapter ? "page" : undefined}
										className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition-colors hover:bg-muted ${
											item.n === chapter ? "bg-muted text-foreground" : "text-muted-foreground"
										}`}
									>
										<ChapterDot status={item.status} />
										<span className="w-8 shrink-0 tabular-nums">{item.n}</span>
										<span className="min-w-0 flex-1 truncate">
											{item.title || t("board.untitled")}
										</span>
									</button>
								</li>
							))}
						</ul>
					</div>
				</details>
			</div>

			<div className="flex min-h-0 flex-1">
				<div className="min-h-0 flex-1 overflow-y-auto bg-muted/30">
					<article
						className={`mx-auto w-full max-w-[672px] bg-card px-5 pb-12 pt-8 sm:px-9 sm:pt-10 ${
							serif ? "font-serif" : ""
						}`}
					>
						<h1
							className="font-medium tracking-tight text-foreground [overflow-wrap:anywhere]"
							style={{
								fontSize: `${type.title}px`,
								lineHeight: `${type.titleLine}px`,
								marginBottom: `${type.titleGap}px`,
							}}
						>
							{heading}
						</h1>

						<div
							className="flex flex-wrap items-center gap-x-6 gap-y-1 text-muted-foreground"
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
								<span className="tabular-nums">
									{t("reader.updatedAt", { date: dateOf(meta.updatedAt) })}
								</span>
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
					<aside className="hidden w-[300px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border/40 bg-card px-4 py-4 xl:flex">
						<div className="flex items-baseline justify-between gap-2">
							<h2 className="text-sm font-medium text-foreground">{t("reader.review")}</h2>
							<span className="text-2xl font-medium tabular-nums text-foreground">{review.score}</span>
						</div>

						<div className="flex flex-col gap-1.5">
							{DIMENSIONS.map((key) => {
								const dimension = review.dimensions.find((item) => item.key === key);
								return (
									<ScoreBar
										key={key}
										label={t(`dimension.${key}`)}
										value={dimension ? dimension.score : 0}
									/>
								);
							})}
						</div>

						<div className="flex flex-col gap-1.5 border-t border-border/40 pt-3">
							<h3 className="text-xs font-medium text-muted-foreground">{t("reader.mustFix")}</h3>
							{review.mustFix.length > 0 ? (
								<ul className="flex list-none flex-col gap-1.5">
									{review.mustFix.map((item) => (
										<li key={item} className="text-xs leading-relaxed text-foreground [overflow-wrap:anywhere]">
											{item}
										</li>
									))}
								</ul>
							) : (
								<p className="text-xs text-muted-foreground">{t("reader.noMustFix")}</p>
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
