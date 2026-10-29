import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import type { NovelBook, ReviewReport } from "../../../domain/novel-types.js";
import { DEFAULT_READER_SCALE, dateOf, paragraphsOf, scaleClass } from "../bookshelf-model.js";
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

/**
 * 阅读页（ADR 0013 §2.4）：顶栏书名导航 → 章头（字数/更新时间）→ 一段一 `<p>` → 底栏翻页与字号。
 * 正文只来自仓储，不经模型改写；评审块有才显示。
 */
export function ReaderPane({
	book,
	chapter,
	text,
	review,
	loading,
	onBack,
	onOpenChapter,
}: ReaderPaneProps) {
	const { t } = useTranslation();
	const [scale, setScale] = useState(DEFAULT_READER_SCALE);

	const meta = chapter === null ? null : book.chapters.find((item) => item.n === chapter) ?? null;
	const chapters = book.chapters;
	const index = chapter === null ? -1 : chapters.findIndex((item) => item.n === chapter);
	const previous = index > 0 ? chapters[index - 1] ?? null : null;
	const next = index >= 0 ? chapters[index + 1] ?? null : null;
	const paragraphs = paragraphsOf(text);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-2">
				<button
					type="button"
					onClick={onBack}
					aria-label={t("reader.back")}
					className="rounded-md border border-border/60 px-2 py-0.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
				>
					← {t("reader.back")}
				</button>
				<span className="min-w-0 truncate text-sm font-medium">{book.title}</span>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				<article className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-8">
					<header className="flex flex-col gap-1">
						<h1 className="text-lg font-medium">
							{chapter === null
								? t("reader.empty")
								: meta && meta.title
									? `${t("board.chapterLabel", { chapter })} · ${meta.title}`
									: t("reader.title", { chapter })}
						</h1>
						<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
							{meta && meta.words > 0 ? (
								<span className="tabular-nums">{t("board.words", { count: meta.words })}</span>
							) : null}
							{meta ? (
								<span className="tabular-nums">
									{t("reader.updatedAt", { date: dateOf(meta.updatedAt) })}
								</span>
							) : null}
						</div>
					</header>

					{review ? (
						<div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
							<span className="font-medium text-foreground">
								{t("reader.score", { score: review.score })}
							</span>
							{review.mustFix.length > 0 ? (
								<ul className="mt-1 list-disc pl-4">
									{review.mustFix.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
							) : (
								<span className="ml-2">{t("reader.noMustFix")}</span>
							)}
						</div>
					) : null}

					{loading ? (
						<p className="text-sm text-muted-foreground">{t("studio.loading")}</p>
					) : paragraphs.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t("reader.blank")}</p>
					) : (
						<div className={`mahua-prose flex flex-col gap-4 leading-[1.9] ${scaleClass(scale)}`}>
							{paragraphs.map((paragraph, position) => (
								<p key={position}>{paragraph}</p>
							))}
						</div>
					)}
				</article>
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
