import { useState } from "react";
import type { StudioState } from "../../hooks/use-studio-state";
import { useTranslator } from "../../hooks/use-translator";
import type { WorkbenchPage } from "../../workbench-pages";
import { arcOf, paragraphsOf, READER_SIZES, readerLineHeight } from "../../workbench-model";
import { EmptySheet } from "../shell/EmptySheet";
import { PageHeader } from "../shell/PageHeader";
import { ScoreBar } from "../shell/ScoreBar";

const DEFAULT_STEP = 2;
const PASS = 72;

/**
 * 阅读页：正文可缩放，评审并排。
 *
 * 正文与评审都是落盘之后才有的东西，所以这一页整页只读——字号与字体是读者的偏好，
 * 翻章是局部导航，两者都不写任何文件。
 */
export function ReaderPage({
	data,
	onNavigate,
}: {
	data: StudioState;
	onNavigate: (page: WorkbenchPage, chapter?: number) => void;
}) {
	const t = useTranslator();
	const [step, setStep] = useState(DEFAULT_STEP);
	const [serif, setSerif] = useState(true);
	const book = data.book;
	const review = data.review;
	const chapter = data.selectedChapter ?? book?.progress.currentChapter ?? 1;
	const record = book?.chapters.find((item) => item.n === chapter);
	const arc = book ? arcOf(book, chapter) : null;
	const total = book?.chapters.length ?? 0;
	const size = READER_SIZES[step] ?? 20;
	const paragraphs = paragraphsOf(data.chapterText);
	const pass = review ? review.score >= PASS : false;

	if (!book) {
		return (
			<div className="flex min-h-0 flex-1 flex-col px-7 pb-6 pt-6">
				<PageHeader title={t("page.reader.title")} back={{ label: t("book.back"), onBack: () => onNavigate("shelf") }} />
				<EmptySheet icon="icon-[lucide--scroll-text]" title={t("reader.empty")} />
			</div>
		);
	}

	const go = (n: number) => {
		if (n < 1 || n > Math.max(total, 1)) return;
		data.selectChapter(n);
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col px-7 pb-6 pt-6">
			<PageHeader
				back={{ label: t("reader.back"), onBack: () => onNavigate("book") }}
				title={t("reader.title", { chapter })}
				meta={
					<span className="truncate text-body-sm text-ink-soft">
						{record?.title ?? t("book.briefNoTitle")}
						{arc ? ` · ${arc.title}` : ""}
					</span>
				}
				right={
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={() => setStep(Math.max(0, step - 1))}
							disabled={step === 0}
							aria-label={t("reader.fontSmaller")}
							className="flex size-7 items-center justify-center rounded-control border border-line text-ink-soft disabled:opacity-40"
						>
							<span className="icon-[lucide--minus] size-3" />
						</button>
						<span className="w-8 text-center font-mono text-[10px] text-ink-faint">{size}</span>
						<button
							type="button"
							onClick={() => setStep(Math.min(READER_SIZES.length - 1, step + 1))}
							disabled={step >= READER_SIZES.length - 1}
							aria-label={t("reader.fontLarger")}
							className="flex size-7 items-center justify-center rounded-control border border-line text-ink-soft disabled:opacity-40"
						>
							<span className="icon-[lucide--plus] size-3" />
						</button>
						<button
							type="button"
							onClick={() => setSerif((value) => !value)}
							className="ml-1 flex h-7 items-center gap-1 rounded-control border border-line px-2 text-[10px] text-ink-soft"
						>
							{serif ? t("reader.serif") : t("reader.sans")}
						</button>
					</div>
				}
			/>

			<div className="mt-1 flex min-h-0 flex-1 gap-5">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					<div className="min-h-0 flex-1 overflow-y-auto">
						{paragraphs.length === 0 ? (
							<EmptySheet icon="icon-[lucide--pencil-line]" title={t("reader.empty")} note={t("reader.blank")} />
						) : (
							<article
								className={`mahua-prose mx-auto max-w-[648px] ${serif ? "font-display" : "font-sans"}`}
								style={{ fontSize: size, lineHeight: `${readerLineHeight(size)}px` }}
							>
								{paragraphs.map((paragraph, index) => (
									<p key={index} className="text-ink">
										{paragraph}
									</p>
								))}
							</article>
						)}
					</div>

					<div className="mt-3 flex shrink-0 items-center gap-2 border-t border-line-soft pt-2.5 text-[10px] text-ink-faint">
						<button
							type="button"
							onClick={() => go(chapter - 1)}
							disabled={chapter <= 1}
							className="flex h-6 items-center gap-1 rounded-control border border-line px-2 disabled:opacity-40"
						>
							<span className="icon-[lucide--chevron-left] size-3" />
							{t("reader.prev")}
						</button>
						<span className="font-mono">
							{chapter} / {total}
						</span>
						<button
							type="button"
							onClick={() => go(chapter + 1)}
							disabled={chapter >= total}
							className="flex h-6 items-center gap-1 rounded-control border border-line px-2 disabled:opacity-40"
						>
							{t("reader.next")}
							<span className="icon-[lucide--chevron-right] size-3" />
						</button>
						<span className="ml-auto">{t("reader.readonlyNote")}</span>
					</div>
				</div>

				<aside className="flex w-[318px] shrink-0 flex-col overflow-hidden rounded-sheet bg-raised shadow-raise">
					<div className="flex items-baseline gap-2 border-b border-line-soft px-4 pb-2.5 pt-3">
						<span className="text-micro-up font-semibold uppercase text-ink-faint">
							{t("reader.review")}
						</span>
						{review && (
							<span className="ml-auto font-mono text-[10px] text-ink-soft">{t("reader.pass", { pass: PASS })}</span>
						)}
					</div>

					{review === null ? (
						<div className="px-4 py-4 text-[11px] leading-5 text-ink-soft">{t("console.reviewEmpty")}</div>
					) : (
						<div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
							<div className="flex items-baseline gap-2">
								<span
									className={`font-mono text-title tabular-nums leading-none ${pass ? "text-ink" : "text-fail"}`}
								>
									{review.score}
								</span>
								<span className="text-[10px] text-ink-faint">
									{t(pass ? "reader.passed" : "reader.belowPass", { pass: PASS })}
								</span>
							</div>

							<div className="mt-3 space-y-1.5">
								{review.dimensions.map((dimension) => (
									<ScoreBar
										key={dimension.key}
										label={t(`dimension.${dimension.key}`)}
										value={dimension.score}
										pass={PASS}
									/>
								))}
							</div>

							<div className="mt-4 border-t border-line-soft pt-2.5">
								<div className="text-micro-up font-semibold uppercase text-ink-faint">
									{t("reader.mustFix")}
								</div>
								{review.mustFix.length === 0 ? (
									<p className="mt-1.5 text-[11px] text-ink-soft">{t("reader.noMustFix")}</p>
								) : (
									<ul className="mt-1.5 space-y-1.5">
										{review.mustFix.map((item, index) => (
											<li key={index} className="flex gap-2 text-[11px] leading-5 text-ink">
												<span className="font-mono text-[10px] text-cinnabar-ink">{index + 1}</span>
												<span className="min-w-0 flex-1">{item}</span>
											</li>
										))}
									</ul>
								)}
							</div>
						</div>
					)}

					<div className="border-t border-line-soft bg-inset px-4 py-2.5 text-[10px] text-ink-soft">
						{t("reader.readonlyNote")}
					</div>
				</aside>
			</div>
		</div>
	);
}
