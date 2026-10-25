/**
 * 把实时信号翻译成左栏轨道要的两件事：每个阶段怎么画、执行环覆盖到哪。
 *
 * 单独成 hook 而不是留在 tab 里，是因为这两项都不是布局问题 —— 它们要把
 * 「调用落在哪个阶段」「哪些阶段被越过」「哪些环节被观测到」三次判断收在一处，
 * tab 只该决定这些东西摆在哪。
 *
 * 三条原则：
 *   - 阶段状态只由真实调用与访问记录决定，没有「预计进度」这种编造值；
 *   - 被越过（自身没有调用、下游已有调用）画成虚线，不混进「已完成」；
 *   - 一次调用都没有时 passPercent 给 null，界面显示「未开始」而不是假的 0%。
 *
 * 执行环的明细（环节轨道、当前步骤）由 ReaLoopConsole 自己算，这里只取百分比：
 * 同一份纯函数在摘要位与明细位各算一次，比跨三层传状态便宜也更不容易错位。
 */

import { useMemo } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { STAGES } from "../data/stages";
import { buildLoopLive } from "../live/loop-phases";
import { stageIdForIndex, type ReaStageId } from "../live/tool-taxonomy";
import type { ReaLiveState } from "../live/session-store";
import type { StageRailItem } from "../components/rea-stage-rail";

interface StageRailOptions {
	readonly currentStage: number;
	readonly snapshot: ReaLiveState;
	/** 被流程越过的阶段序号（1 基），由 bypassedStageIds 得出。 */
	readonly bypassedStages: readonly number[];
}

interface StageRailView {
	readonly items: readonly StageRailItem[];
	readonly passPercent: number | null;
}

export function useStageRail({ currentStage, snapshot, bypassedStages }: StageRailOptions): StageRailView {
	const { t } = useTranslation();
	const { stageCallCounts, visitedStages, calls, callCount } = snapshot;

	const items = useMemo<readonly StageRailItem[]>(
		() =>
			STAGES.map((stage) => {
				const id: ReaStageId | null = stageIdForIndex(stage.index);
				const callCountOfStage = id === null ? 0 : (stageCallCounts[id] ?? 0);
				const visited = id !== null && visitedStages.includes(id);
				const isBypassed = bypassedStages.includes(stage.index);
				const state: StageRailItem["state"] =
					stage.index === currentStage
						? "active"
						: callCountOfStage > 0 || visited
							? "done"
							: isBypassed
								? "bypassed"
								: "idle";
				const meta =
					callCountOfStage > 0
						? t("live.stage.toolCount", { count: callCountOfStage })
						: isBypassed
							? t("tab.strip.bypassedHint")
							: undefined;
				return { index: stage.index, label: t(stage.labelKey), meta, state };
			}),
		[currentStage, bypassedStages, stageCallCounts, visitedStages, t],
	);

	const passPercent = useMemo(
		() => (calls.length === 0 ? null : buildLoopLive(calls, callCount).passPercent),
		[calls, callCount],
	);

	return { items, passPercent };
}
