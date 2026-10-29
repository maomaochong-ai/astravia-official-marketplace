import { useTranslation } from "@astravia-org/plugin-sdk";
import { DEFAULT_READER_SCALE, READER_SCALES } from "../bookshelf-model.js";

interface ReaderControlsProps {
	scale: number;
	canPrev: boolean;
	canNext: boolean;
	onScale: (next: number) => void;
	onPrev: () => void;
	onNext: () => void;
}

/**
 * 阅读页底栏（ADR 0013 §2.4）：上一章 · 字号 · 下一章。
 * 番茄的夜间开关不复刻——明暗归宿主主题管（ADR 0006）。
 */
export function ReaderControls({ scale, canPrev, canNext, onScale, onPrev, onNext }: ReaderControlsProps) {
	const { t } = useTranslation();

	const stepClass =
		"rounded-md border border-border/60 px-2 py-0.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40";

	return (
		<div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 px-4 py-2">
			<button type="button" onClick={onPrev} disabled={!canPrev} className={stepClass}>
				{t("reader.prev")}
			</button>

			<div className="flex items-center gap-2" role="group" aria-label={t("reader.font")}>
				<span className="text-xs text-muted-foreground">{t("reader.font")}</span>
				<button
					type="button"
					onClick={() => onScale(scale - 1)}
					disabled={scale <= 0}
					className={stepClass}
					aria-label={t("reader.fontSmaller")}
				>
					A−
				</button>
				<span className="flex items-center gap-1" aria-hidden="true">
					{READER_SCALES.map((_, index) => (
						<span
							key={index}
							className={`h-1 w-1 rounded-full ${
								index === scale ? "bg-foreground/70" : "bg-foreground/20"
							}`}
						/>
					))}
				</span>
				<button
					type="button"
					onClick={() => onScale(scale + 1)}
					disabled={scale >= READER_SCALES.length - 1}
					className={stepClass}
					aria-label={t("reader.fontLarger")}
				>
					A+
				</button>
				<button
					type="button"
					onClick={() => onScale(DEFAULT_READER_SCALE)}
					disabled={scale === DEFAULT_READER_SCALE}
					className={stepClass}
				>
					{t("reader.fontReset")}
				</button>
			</div>

			<button type="button" onClick={onNext} disabled={!canNext} className={stepClass}>
				{t("reader.next")}
			</button>
		</div>
	);
}
