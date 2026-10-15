/**
 * REA Workflow 活动栏 tab 容器：
 *   1. 顶部固定条：CLI provider 状态 + retry
 *   2. 中部：6 阶段条 + 阶段详情
 *   3. 底部：first / prev / indicator / next / last 控制器
 *
 * Tab chrome（标签条 / 关闭按钮 / resize handle）由宿主 ActivityPanel 提供。
 * 主题色走 src/style.css 的 @theme inline，从宿主 :root 读取。
 */

import { useEffect, useMemo, useState, type JSX } from "react";
import { useActivityTab } from "@astravia-org/plugin-sdk";
import { ReaProviderStatusBar } from "./rea-provider-status-bar";
import { ReaWorkflowTargetRouting } from "./rea-workflow-target-routing";
import { ReaWorkflowStageStrip } from "./rea-workflow-strip";
import { ReaWorkflowStageDetail } from "./rea-workflow-stage-detail";
import { ReaWorkflowControls } from "./rea-workflow-controls";
import { STAGES, TOTAL_STAGES } from "../data/stages";
import type { PluginCliProviderStatus } from "@astravia-org/plugin-sdk";

export interface ReaProviderBridge {
	getStatus(): Promise<PluginCliProviderStatus>;
	onStatusChanged(listener: (status: PluginCliProviderStatus) => void): { dispose: () => void };
	retry(): Promise<void>;
}

export interface ReaWorkflowTabProps {
	provider: ReaProviderBridge;
}

export function ReaWorkflowTab({ provider }: ReaWorkflowTabProps): JSX.Element {
	const { active } = useActivityTab();
	const [currentStage, setCurrentStage] = useState<number>(1);
	const [mounted, setMounted] = useState<boolean>(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const stage = useMemo(
		() => STAGES.find((s) => s.index === currentStage) ?? STAGES[0]!,
		[currentStage],
	);

	const handleSelect = (next: number): void => {
		const clamped = Math.max(1, Math.min(TOTAL_STAGES, next));
		setCurrentStage(clamped);
	};

	const atFirst = currentStage <= 1;
	const atLast = currentStage >= TOTAL_STAGES;

	const animateClass = active && mounted ? "motion-safe:animate-in motion-safe:fade-in-0" : "";

	return (
		<div className={`flex h-full w-full flex-col overflow-hidden bg-background text-foreground ${animateClass}`}>
			<ReaProviderStatusBar
				getStatus={provider.getStatus}
				onStatusChanged={provider.onStatusChanged}
				retry={provider.retry}
			/>
			<ReaWorkflowTargetRouting onRoute={handleSelect} />
			<ReaWorkflowStageStrip currentStage={currentStage} onSelect={handleSelect} />
			<div className="flex-1 overflow-auto">
				<ReaWorkflowStageDetail stage={stage} total={TOTAL_STAGES} />
			</div>
			<ReaWorkflowControls
				current={currentStage}
				total={TOTAL_STAGES}
				atFirst={atFirst}
				atLast={atLast}
				onSelect={handleSelect}
			/>
		</div>
	);
}
