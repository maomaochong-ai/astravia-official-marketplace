import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { DETAIL_ENTRIES } from "../../../domain/catalog";
import type { LogoSpec } from "../../../domain/spec";
import { INPUT, SECTION_LABEL, TEXTAREA, FOCUS_RING } from "../../../shared/styles/tokens";
import { Segmented } from "../../../shared/components/segmented";

export interface DetailControlsProps {
	spec: LogoSpec;
	onPatch: (patch: Partial<LogoSpec>) => void;
	variations: number;
	onVariations: (value: number) => void;
	/** The subject the engine picked, shown as a confirmation of the brief. */
	subject: string;
	/** Set when the design will come from a host image provider instead of the engine. */
	aiMode: boolean;
}

/**
 * 细节档、单色、变体数与自由描述。
 *
 * - 描述框 `resize-y`：长 brief 是常态，固定两行时用户看不到自己刚写的那半句；
 * - 「单色」与「变体数」两枚控件都窄，标签一律 `whitespace-nowrap`，数字框只留三位宽 ——
 *   上一版换行时「变体数」被拆成竖排两个字。
 * - subject 回显不是装饰：它让用户看到「温暖的烘焙店」被读成了杯子而不是叶子。
 */
export function DetailControls({ spec, onPatch, variations, onVariations, subject, aiMode }: DetailControlsProps): JSX.Element {
	const { t } = useTranslation();

	return (
		<div className="space-y-3">
			<div>
				<span className={SECTION_LABEL}>{t("label.detail")}</span>
				<Segmented
					ariaLabel={t("label.detail")}
					value={spec.detail}
					onChange={(detail) => onPatch({ detail })}
					options={DETAIL_ENTRIES.map((entry) => ({ value: entry.id, label: t(entry.labelKey) }))}
				/>
			</div>

			<div>
				<span className={SECTION_LABEL}>{t("label.intent")}</span>
				<textarea
					className={`${TEXTAREA} min-h-14 resize-y`}
					rows={2}
					value={spec.intent}
					onChange={(event) => onPatch({ intent: event.target.value })}
					placeholder={t("placeholder.intent")}
					aria-label={t("label.intent")}
				/>
				<p className="mt-1 text-[11px] text-muted-foreground">
					{t("label.subject")}{" "}
					<span className="font-medium text-foreground">{subject.replace("abstract:", t("label.abstractShort"))}</span>
				</p>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-2">
				<label className="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-[12px] text-foreground">
					<input
						type="checkbox"
						checked={spec.monochrome}
						onChange={(event) => onPatch({ monochrome: event.target.checked })}
						className={`size-3.5 rounded border-border accent-[var(--primary)] ${FOCUS_RING}`}
					/>
					{t("label.monochrome")}
				</label>

				<label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] text-muted-foreground">
					{/* 两个引擎的数量语义不同：矢量引擎是“出几版”，AI 是“同一稿生成几张变体”。 */}
					{aiMode ? t("label.variationsAi") : t("label.variations")}
					<input
						type="number"
						min={1}
						max={8}
						value={variations}
						onChange={(event) => onVariations(Number(event.target.value) || 1)}
						className={`${INPUT} h-7 w-12 px-1 text-center tabular-nums text-[12px]`}
						aria-label={aiMode ? t("label.variationsAi") : t("label.variations")}
					/>
				</label>
			</div>
		</div>
	);
}
