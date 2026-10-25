/**
 * 底部翻页控制：首 / 上 / 指示 / 下 / 尾。
 *
 * 面板窄到 400px 以下时藏掉首尾两个按钮（它们与上/下重复），
 * 因为这里只是「翻页面」，不是主操作；主操作是底部作曲器里的「交给 Agent」。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { TOTAL_STAGES } from "../data/stages";

interface ControlsProps {
	readonly currentStage: number;
	readonly onChange: (stage: number) => void;
}

const BASE_BTN =
	"inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-control border border-border bg-transparent px-2.5 text-micro-up font-medium text-foreground/85 transition-colors hover:border-border-strong hover:bg-mist hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export function ReaWorkflowControls({ currentStage, onChange }: ControlsProps): JSX.Element {
	const { t } = useTranslation();
	const atFirst = currentStage <= 1;
	const atLast = currentStage >= TOTAL_STAGES;

	return (
		<div className="flex shrink-0 items-center justify-between gap-1.5 border-t border-border px-3 py-1.5">
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
			<button type="button" className={BASE_BTN} disabled={atFirst} onClick={() => onChange(Math.max(1, currentStage - 1))}>
				<span aria-hidden className="icon-[lucide--chevron-left] size-3" />
				<span>{t("tab.controls.prev")}</span>
			</button>
			<span className="shrink-0 whitespace-nowrap font-mono text-micro-up tabular-nums text-faint">
				{t("tab.controls.indicator", { current: currentStage, total: TOTAL_STAGES })}
			</span>
			<button
				type="button"
				className={BASE_BTN}
				disabled={atLast}
				onClick={() => onChange(Math.min(TOTAL_STAGES, currentStage + 1))}
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
