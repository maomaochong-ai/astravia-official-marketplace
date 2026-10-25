/**
 * 当前步骤行：一条终端式的「第几次调用 · 工具 · 参数 · 耗时」。
 *
 * 数据全部来自宿主会话事件（工具名 / 参数预览 / 起止时间 / 成败），
 * 不展示工具结果内容 —— SDK 的 tool-call-end 只给 isError，没有输出正文。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ReaLoopStep } from "../live/loop-phases";

interface LoopStepProps {
	readonly step: ReaLoopStep | null;
}

function durationLabel(step: ReaLoopStep): string {
	if (step.status === "running") return "…";
	const ms = step.durationMs ?? 0;
	return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function ordinalLabel(ordinal: number): string {
	return `#${String(ordinal).padStart(2, "0")}`;
}

export function ReaLoopStepLine({ step }: LoopStepProps): JSX.Element {
	const { t } = useTranslation();

	if (step === null) {
		return (
			<div className="flex h-[18px] min-w-0 items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground/70">
				<span aria-hidden>★</span>
				<span className="min-w-0 truncate">{t("live.idle")}</span>
			</div>
		);
	}

	const tone =
		step.status === "running"
			? "text-primary motion-safe:animate-pulse"
			: step.status === "failed"
				? "text-danger"
				: "text-muted-foreground/60";

	return (
		<div
			key={step.ordinal}
			className="flex h-[18px] min-w-0 items-center gap-1.5 font-mono text-[10.5px] motion-safe:animate-rea-row-in"
		>
			<span aria-hidden className={`shrink-0 ${tone}`}>
				★
			</span>
			<span className="shrink-0 tabular-nums text-muted-foreground">{ordinalLabel(step.ordinal)}</span>
			<span
				className={`min-w-0 shrink-0 max-w-[60%] truncate font-medium ${
					step.status === "failed" ? "text-danger" : "text-foreground"
				}`}
				title={step.toolName}
			>
				{step.toolName}
			</span>
			{step.argsPreview ? (
				<span className="min-w-0 flex-1 truncate text-muted-foreground/75" title={step.argsPreview}>
					{step.argsPreview}
				</span>
			) : (
				<span className="min-w-0 flex-1" />
			)}
			<span
				className={`shrink-0 tabular-nums ${step.status === "running" ? "text-primary" : "text-muted-foreground/80"}`}
			>
				{durationLabel(step)}
			</span>
		</div>
	);
}
