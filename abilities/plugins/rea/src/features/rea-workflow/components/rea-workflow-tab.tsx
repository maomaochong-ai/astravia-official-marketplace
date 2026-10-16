/**
 * REA Workflow 活动栏 tab 容器：
 *   1. 顶部固定条：CLI provider 状态 + retry
 *   2. 实时总览：引擎 / 目标 / 阶段计数 + 正在跑的工具（来自会话事件）
 *   3. 中部：目标路由 + 6 阶段条 + 阶段详情（右侧为实时调用日志）
 *   4. 底部：first / prev / indicator / next / last 控制器
 *
 * Tab chrome（标签条 / 关闭按钮 / resize handle）由宿主 ActivityPanel 提供。
 * 主题色走 src/style.css 的 @theme inline，从宿主 :root 读取。
 */

import { useMemo, useState, type JSX } from "react";
import { useActivityTab, useTranslation } from "@astravia-org/plugin-sdk";
import type { PluginCliProviderStatus } from "@astravia-org/plugin-sdk";
import { ReaProviderStatusBar } from "./rea-provider-status-bar";
import { ReaLiveStatus } from "./rea-live-status";
import { ReaLiveCallLog } from "./rea-live-call-log";
import { ReaWorkflowTargetRouting } from "./rea-workflow-target-routing";
import { ReaWorkflowStageStrip } from "./rea-workflow-strip";
import { ReaWorkflowStageDetail } from "./rea-workflow-stage-detail";
import { ReaWorkflowControls } from "./rea-workflow-controls";
import { STAGES, TOTAL_STAGES } from "../data/stages";
import { useReaLiveSnapshot } from "../live/use-live-snapshot";
import { scopeLiveCalls, type ReaLiveStore } from "../live/session-store";
import { STAGE_INDEX } from "../live/tool-taxonomy";

export interface ReaProviderBridge {
	getStatus(): Promise<PluginCliProviderStatus>;
	onStatusChanged(listener: (status: PluginCliProviderStatus) => void): { dispose: () => void };
	retry(): Promise<void>;
}

export interface ReaWorkflowTabProps {
	readonly provider: ReaProviderBridge;
	/** 实时状态源；插件装配完成前可能为 null。 */
	readonly store: ReaLiveStore | null;
}

export function ReaWorkflowTab({ provider, store }: ReaWorkflowTabProps): JSX.Element {
	const { t } = useTranslation();
	const { active, cwd } = useActivityTab();
	const [currentStage, setCurrentStage] = useState<number>(1);
	const [showLog, setShowLog] = useState<boolean>(false);
	const snapshot = useReaLiveSnapshot(store);

	const stage = useMemo(
		() => STAGES.find((s) => s.index === currentStage) ?? STAGES[0]!,
		[currentStage],
	);

	const handleSelect = (next: number): void => {
		const clamped = Math.max(1, Math.min(TOTAL_STAGES, next));
		setCurrentStage(clamped);
	};

	const calls = useMemo(() => scopeLiveCalls(snapshot, cwd), [snapshot, cwd]);
	const animateClass = active ? "motion-safe:animate-in motion-safe:fade-in-0" : "";

	return (
		<div className={`flex h-full w-full flex-col overflow-hidden bg-background text-foreground ${animateClass}`}>
			<ReaProviderStatusBar
				getStatus={provider.getStatus}
				onStatusChanged={provider.onStatusChanged}
				retry={provider.retry}
			/>
			<ReaLiveStatus snapshot={snapshot} onSelectStage={handleSelect} />
			<ReaWorkflowTargetRouting onRoute={handleSelect} detected={snapshot.detectedTarget} />
			<ReaWorkflowStageStrip
				currentStage={currentStage}
				onSelect={handleSelect}
				completedStages={snapshot.visitedStages.map((id) => STAGE_INDEX[id])}
			/>
			<div className="flex min-h-0 flex-1 flex-col">
				<div className="flex-1 overflow-auto">
					<ReaWorkflowStageDetail stage={stage} total={TOTAL_STAGES} />
				</div>
				{showLog ? (
					<div className="max-h-56 shrink-0 overflow-auto border-t border-border">
						<ReaLiveCallLog calls={calls} errors={snapshot.errors} onSelectStage={handleSelect} />
					</div>
				) : null}
			</div>
			<div className="flex items-center gap-2 border-t border-border bg-card/20 px-3 py-1">
				<button
					type="button"
					className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					aria-expanded={showLog}
					onClick={() => setShowLog((prev) => !prev)}
				>
					{showLog ? t("live.calls.hide") : t("live.calls.show")}
				</button>
				<span className="truncate text-[10px] text-muted-foreground">
					{t("live.calls.count", { count: calls.length })}
				</span>
			</div>
			<ReaWorkflowControls currentStage={currentStage} onChange={handleSelect} />
		</div>
	);
}
