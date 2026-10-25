/**
 * 阶段翻页控制：首 / 上 / 指示 / 下 / 尾。
 *
 * 变成「卡片页脚」之后组件本身不再自带边框和内边距，由调用方决定放在哪；
 * 面板窄于 400px 时藏掉首尾两个按钮（与上/下重复），因为这里只是翻页，
 * 主操作是顶栏的「发送到对话」。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { TOTAL_STAGES } from "../data/stages";

interface ControlsProps {
	readonly currentStage: number;
	readonly onChange: (stage: number) => void;
}

const BASE_BTN =
	"inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border border-border bg-surface-3 px-2 text-micro font-medium text-text-2 transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export function ReaWorkflowControls({ currentStage, onChange }: ControlsProps): JSX.Element {
	const { t } = useTranslation();
	const atFirst = currentStage <= 1;
	const atLast = currentStage >= TOTAL_STAGES;

	return (
		<div className="flex shrink-0 items-center justify-between gap-1.5">
			<button
				type="button"
				className={`${BASE_BTN} @max-[399px]:hidden`}
				disabled={atFirst}
				onClick={() => onChange(1)}
				title={t("tab.controls.first.title")}
			>
				<span aria-hidden className="icon-[lucide--chevrons-left] size-3" />
				<span>{t("tab.controls.first")}</span>
			</button>
			<button
				type="button"
				className={BASE_BTN}
				disabled={atFirst}
				onClick={() => onChange(Math.max(1, currentStage - 1))}
				title={t("tab.controls.prev.title")}
			>
				<span aria-hidden className="icon-[lucide--chevron-left] size-3" />
				<span>{t("tab.controls.prev")}</span>
			</button>
			<span className="shrink-0 whitespace-nowrap font-mono text-micro tabular-nums text-text-4">
				{t("tab.controls.indicator", { current: currentStage, total: TOTAL_STAGES })}
			</span>
			<button
				type="button"
				className={BASE_BTN}
				disabled={atLast}
				onClick={() => onChange(Math.min(TOTAL_STAGES, currentStage + 1))}
				title={t("tab.controls.next.title")}
			>
				<span>{t("tab.controls.next")}</span>
				<span aria-hidden className="icon-[lucide--chevron-right] size-3" />
			</button>
			<button
				type="button"
				className={`${BASE_BTN} @max-[399px]:hidden`}
				disabled={atLast}
				onClick={() => onChange(TOTAL_STAGES)}
				title={t("tab.controls.last.title")}
			>
				<span>{t("tab.controls.last")}</span>
				<span aria-hidden className="icon-[lucide--chevrons-right] size-3" />
			</button>
		</div>
	);
}
