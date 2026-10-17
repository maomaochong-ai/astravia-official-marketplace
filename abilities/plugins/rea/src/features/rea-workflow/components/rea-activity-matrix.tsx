/**
 * 调用热力条：把最近若干次真实调用压成一条 3px 高的色带。
 *
 * 借鉴 agent-bay 的 activity map：单条调用列表看不出「节奏」，一条热力带可以——
 * 连续绿点表示顺畅，中间红点表示哪次失败，末尾脉动表示此刻正在跑。
 *
 * 只表达可证实的事实：颜色来自调用记录里的 isError / endedAt，没有任何推断。
 * 每格都挂 title，命中数量超出宽度时也不丢信息。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { STAGES } from "../data/stages";
import type { ReaLiveCall } from "../live/session-store";
import { stageIdForIndex } from "../live/tool-taxonomy";

const WINDOW = 32;

interface ActivityMatrixProps {
	readonly calls: readonly ReaLiveCall[];
}

type CellState = "running" | "error" | "done";

function cellState(call: ReaLiveCall): CellState {
	if (call.endedAt === null) return "running";
	return call.isError === true ? "error" : "done";
}

const CELL_CLASS: Record<CellState, string> = {
	running: "bg-primary motion-safe:animate-pulse",
	error: "bg-red-500",
	done: "bg-primary/40",
};

/** 阶段短名：用已存在的 tab.stage.<id>.label，避免再造一套文案。 */
function stageLabelKey(stage: ReaLiveCall["stage"]): string {
	const found = STAGES.find((definition) => stageIdForIndex(definition.index) === stage);
	return found?.labelKey ?? "tab.strip.aria";
}

export function ReaActivityMatrix({ calls }: ActivityMatrixProps): JSX.Element {
	const { t } = useTranslation();
	const window = calls.slice(-WINDOW);
	return (
		<div
			className="flex h-1.5 min-w-0 items-stretch gap-px overflow-hidden rounded-full bg-muted"
			role="img"
			aria-label={t("live.matrix.aria", { count: window.length })}
		>
			{window.length === 0 ? (
				<span className="flex-1 bg-transparent" aria-hidden />
			) : (
				window.map((call) => {
					const state = cellState(call);
					const stage = t(stageLabelKey(call.stage));
					const suffix = state === "running" ? ` · ${t("live.calls.running")}` : state === "error" ? ` · ${t("live.calls.failed")}` : "";
					return (
						<span
							key={call.id}
							className={`min-w-0 flex-1 rounded-[1px] ${CELL_CLASS[state]}`}
							title={`${stage} · ${call.toolName}${suffix}`}
							aria-hidden
						/>
					);
				})
			)}
		</div>
	);
}
