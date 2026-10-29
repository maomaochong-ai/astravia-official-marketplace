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
 * 阅读页底栏（ADR 0013 §2.4，样式按 ADR 0024 §1 收紧）：上一章 · 字号 · 下一章。
 *
 * 翻页按钮做成番茄那种「贴着正文列两侧的宽按钮」，字号组留在中间：
 * A− / 五个档位圆点 / A+ / 复位。圆点数跟着 `READER_SCALES` 走，改档不用改这里。
 * 番茄的夜间开关不复刻——明暗归宿主主题管（ADR 0006）。
 */
export function ReaderControls({ scale, canPrev, canNext, onScale, onPrev, onNext }: ReaderControlsProps) {
	const { t } = useTranslation();

	const moveClass =
		"flex-1 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40";
	const stepClass =
		"rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40";

	return (
		<div className="flex shrink-0 items-center gap-3 border-t border-border/60 bg-background px-3 py-2">
			<button type="button" onClick={onPrev} disabled={!canPrev} className={moveClass}>
				{t("reader.prev")}
			</button>

			<div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={t("reader.font")}>
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
							className={`h-1 w-1 rounded-full ${index === scale ? "bg-foreground/70" : "bg-foreground/20"}`}
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

			<button type="button" onClick={onNext} disabled={!canNext} className={moveClass}>
				{t("reader.next")}
			</button>
		</div>
	);
}
