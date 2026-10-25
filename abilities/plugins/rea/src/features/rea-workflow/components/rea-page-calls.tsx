/**
 * 实时调用分节：这个会话里 Agent 真的调过什么。
 *
 * 只呈现事实：工具名、阶段、耗时、参数、错误原文。不推断「是否成功」——
 * 退出码与错误消息都在原始输出里，面板不替用户下结论。
 *
 * 顶部六个阶段计数是同一份 calls 的聚合，点一下就把列表过滤到那个阶段；
 * 计数与列表共用一份数据，不会出现「标了 3 条却只列出 1 条」。
 */

import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { STAGES } from "../data/stages";
import { STAGE_INDEX } from "../live/tool-taxonomy";
import type { ReaLiveCall, ReaLiveError } from "../live/session-store";
import { Panel, PanelHeader } from "../../../shared/components/panel";
import { ReaPage, ReaPageHeader } from "./rea-app-shell";
import { ReaLiveCallLog } from "./rea-live-call-log";

interface CallsPageProps {
	readonly active: boolean;
	readonly calls: readonly ReaLiveCall[];
	readonly errors: readonly ReaLiveError[];
	readonly callCount: number;
	readonly onSelectStage: (stage: number) => void;
}

export function CallsPage({ active, calls, errors, callCount, onSelectStage }: CallsPageProps): JSX.Element {
	const { t } = useTranslation();
	const [stageFilter, setStageFilter] = useState<number | null>(null);

	const counts = useMemo(() => {
		const map = new Map<number, number>();
		for (const call of calls) {
			if (call.stage === null) continue;
			const index = STAGE_INDEX[call.stage];
			map.set(index, (map.get(index) ?? 0) + 1);
		}
		return map;
	}, [calls]);

	const visible = useMemo(
		() =>
			stageFilter === null ? calls : calls.filter((call) => call.stage !== null && STAGE_INDEX[call.stage] === stageFilter),
		[calls, stageFilter],
	);

	return (
		<ReaPage active={active}>
			<ReaPageHeader title={t("ui.page.calls.title")} subtitle={t("ui.page.calls.subtitle")} />

			<div className="flex flex-wrap items-center gap-1.5">
				<button
					type="button"
					onClick={() => setStageFilter(null)}
					aria-pressed={stageFilter === null}
					className={`inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-micro transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
						stageFilter === null
							? "border-border-strong bg-surface-active text-text"
							: "border-border bg-surface-2 text-text-3 hover:bg-surface-hover hover:text-text"
					}`}
				>
					{t("ui.page.calls.filterAll")}
					<span className="tabular-nums text-text-4">{callCount}</span>
				</button>
				{STAGES.map((stage) => {
					const count = counts.get(stage.index) ?? 0;
					const isActive = stageFilter === stage.index;
					return (
						<button
							key={stage.index}
							type="button"
							onClick={() => setStageFilter(isActive ? null : stage.index)}
							aria-pressed={isActive}
							className={`inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-micro transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
								isActive
									? "border-border-strong bg-surface-active text-text"
									: "border-border bg-surface-2 text-text-3 hover:bg-surface-hover hover:text-text"
							}`}
						>
							<span className={`size-1.5 rounded-full ${count === 0 ? "bg-text-4/40" : "bg-purple"}`} aria-hidden />
							{t(stage.labelKey)}
							<span className="tabular-nums text-text-4">{count}</span>
						</button>
					);
				})}
			</div>

			<Panel>
				<PanelHeader
					title={t("ui.page.calls.title")}
					badge={visible.length}
					hint={t("tab.tools.sourceHint")}
					actions={
						<button
							type="button"
							onClick={() => onSelectStage(stageFilter ?? 1)}
							className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-micro text-text-3 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							{t("ui.page.calls.jump")}
							<span aria-hidden className="icon-[lucide--arrow-up-right] size-3" />
						</button>
					}
				/>
				<ReaLiveCallLog calls={visible} errors={errors} onSelectStage={onSelectStage} />
			</Panel>
		</ReaPage>
	);
}
