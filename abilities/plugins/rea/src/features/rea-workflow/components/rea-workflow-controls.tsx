/**
 * 底部控制条：上一阶段 / 下一阶段 / 跳到首尾。
 *
 * 按钮风格：border-border + bg-background/40 + text-foreground；
 * 禁用态 opacity-50 cursor-not-allowed。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { TOTAL_STAGES } from "../data/stages";

interface ControlsProps {
	readonly currentStage: number;
	readonly onChange: (stage: number) => void;
}

export function ReaWorkflowControls({ currentStage, onChange }: ControlsProps): JSX.Element {
	const { t } = useTranslation();
	const atFirst = currentStage <= 1;
	const atLast = currentStage >= TOTAL_STAGES;
	const baseBtn =
		"inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background/40 px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
	return (
		<div className="flex items-center justify-between gap-2 border-t border-border bg-card/30 px-3 py-2">
			<button
				type="button"
				className={baseBtn}
				disabled={atFirst}
				onClick={() => onChange(1)}
				title={t("tab.controls.first.title")}
			>
				<span aria-hidden>«</span>
				<span>{t("tab.controls.first")}</span>
			</button>
			<button
				type="button"
				className={baseBtn}
				disabled={atFirst}
				onClick={() => onChange(Math.max(1, currentStage - 1))}
			>
				<span aria-hidden>‹</span>
				<span>{t("tab.controls.prev")}</span>
			</button>
			<span className="text-[11px] tabular-nums text-muted-foreground">
				{t("tab.controls.indicator", { current: currentStage, total: TOTAL_STAGES })}
			</span>
			<button
				type="button"
				className={baseBtn}
				disabled={atLast}
				onClick={() => onChange(Math.min(TOTAL_STAGES, currentStage + 1))}
			>
				<span>{t("tab.controls.next")}</span>
				<span aria-hidden>›</span>
			</button>
			<button
				type="button"
				className={baseBtn}
				disabled={atLast}
				onClick={() => onChange(TOTAL_STAGES)}
				title={t("tab.controls.last.title")}
			>
				<span>{t("tab.controls.last")}</span>
				<span aria-hidden>»</span>
			</button>
		</div>
	);
}
