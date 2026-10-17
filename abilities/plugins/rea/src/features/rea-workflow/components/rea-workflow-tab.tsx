/**
 * REA 活动栏 tab 容器：
 *   1. 顶部固定条：CLI provider 状态 + retry
 *   2. 实时总览：引擎 / 目标 / 阶段计数 + 当前动作 + 最近目标（固定行高，不抖）
 *   3. 可滚动主体：逆向工作台（选目标 → 给路径 → 交给 Agent）+ 6 阶段条 + 阶段详情
 *   4. 调用日志抽屉 + 底部 first / prev / indicator / next / last 控制器
 *
 * 职责边界：执行逆向的是 Agent。插件只做三件事——看清目标、看清进度、看清缺什么工具。
 * doctor 自动检测与「一键安装」都在插件侧只读/官方通道里完成，不手工跑分析命令。
 *
 * Tab chrome（标签条 / 关闭按钮 / resize handle）由宿主 ActivityPanel 提供。
 */

import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useActivityTab, useTranslation } from "@astravia-org/plugin-sdk";
import type { PluginCliProviderStatus, PluginCommandRunResult, SendPromptResult } from "@astravia-org/plugin-sdk";
import { ReaProviderStatusBar } from "./rea-provider-status-bar";
import { ReaLiveStatus } from "./rea-live-status";
import { ReaLiveCallLog } from "./rea-live-call-log";
import { ReaWorkbench } from "./rea-workbench";
import { ReaWorkflowStageStrip } from "./rea-workflow-strip";
import { ReaWorkflowStageDetail } from "./rea-workflow-stage-detail";
import { ReaWorkflowControls } from "./rea-workflow-controls";
import { STAGES, TOTAL_STAGES } from "../data/stages";
import { useDoctorReport } from "../hooks/use-doctor-report";
import { useWorkbench } from "../hooks/use-workbench";
import { useReaLiveSnapshot } from "../live/use-live-snapshot";
import { scopeLiveCalls, type ReaLiveStore } from "../live/session-store";
import { buildStageDigest } from "../live/diagram-live";
import { STAGE_INDEX } from "../live/tool-taxonomy";

export interface ReaProviderBridge {
	getStatus(): Promise<PluginCliProviderStatus>;
	onStatusChanged(listener: (status: PluginCliProviderStatus) => void): { dispose: () => void };
	retry(): Promise<void>;
	/** 运行 `npx -y rea-agents@latest <args>`；args 不含包名前缀。 */
	run(args: readonly string[], options: { cwd?: string; timeoutMs: number }): Promise<PluginCommandRunResult>;
}

export interface ReaWorkflowTabProps {
	readonly provider: ReaProviderBridge;
	/** 实时状态源；插件装配完成前可能为 null。 */
	readonly store: ReaLiveStore | null;
	/** 把结构化逆向任务发进当前对话（主路径）。 */
	readonly sendPrompt: (prompt: string) => Promise<SendPromptResult>;
	/** 只填入输入框；不可用时返回 false。 */
	readonly insertPrompt: (prompt: string) => boolean;
}

export function ReaWorkflowTab({ provider, store, sendPrompt, insertPrompt }: ReaWorkflowTabProps): JSX.Element {
	const { t } = useTranslation();
	const { active, cwd } = useActivityTab();
	const [currentStage, setCurrentStage] = useState<number>(1);
	const [showLog, setShowLog] = useState<boolean>(false);
	const snapshot = useReaLiveSnapshot(store);
	// 会话里推进到新阶段时自动翻页；用户手动点选后就停在那，直到下一次真实推进。
	const liveStage = snapshot.activeStage ? STAGE_INDEX[snapshot.activeStage] : null;
	const followedStage = useRef<number | null>(null);
	useEffect(() => {
		if (liveStage === null || liveStage === followedStage.current) return;
		followedStage.current = liveStage;
		setCurrentStage(liveStage);
	}, [liveStage]);

	const stage = useMemo(() => STAGES.find((s) => s.index === currentStage) ?? STAGES[0]!, [currentStage]);

	const handleSelect = (next: number): void => {
		const clamped = Math.max(1, Math.min(TOTAL_STAGES, next));
		setCurrentStage(clamped);
	};

	const workbench = useWorkbench({
		sendPrompt,
		insertPrompt,
		cwd: cwd ?? null,
		detected: snapshot.detectedTarget,
		detectedPath: snapshot.lastTargetPath,
		onRoute: handleSelect,
	});

	// doctor 只在引擎就绪且已有目标类型时跑：这时「缺什么工具」才有意义。
	const report = useDoctorReport({
		run: provider.run,
		cwd: cwd ?? null,
		target: workbench.active,
		providerPhase: snapshot.providerPhase,
	});

	const calls = useMemo(() => scopeLiveCalls(snapshot, cwd), [snapshot, cwd]);
	// 示意图与阶段标题用的是同一份真实信号：当前阶段的调用数 / 正在跑的工具。
	const stageLive = useMemo(
		() => ({ calls, running: snapshot.runningToolNames, digest: buildStageDigest(currentStage, calls, snapshot.runningToolNames) }),
		[calls, currentStage, snapshot.runningToolNames],
	);
	const animateClass = active ? "motion-safe:animate-in motion-safe:fade-in-0" : "";

	return (
		<div className={`@container flex h-full w-full flex-col overflow-hidden bg-background text-foreground ${animateClass}`}>
			<ReaProviderStatusBar
				getStatus={provider.getStatus}
				onStatusChanged={provider.onStatusChanged}
				retry={provider.retry}
			/>
			<ReaLiveStatus
				snapshot={snapshot}
				onSelectStage={handleSelect}
				onUseTarget={(path) => {
					// 同时落到插件侧输入框和宿主对话草稿：用户点「填入对话」就该在对话框里看到它。
					workbench.setTarget(path);
					workbench.insertToChat(path);
					handleSelect(2);
				}}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<ReaWorkbench
					workbench={workbench}
					detected={snapshot.detectedTarget}
					calls={calls}
					report={report}
					run={provider.run}
					cwd={cwd ?? null}
				/>
				<div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
					<ReaWorkflowStageStrip
						currentStage={currentStage}
						onSelect={handleSelect}
						completedStages={snapshot.visitedStages.map((id) => STAGE_INDEX[id])}
						liveStage={liveStage}
					/>
				</div>
				<ReaWorkflowStageDetail stage={stage} total={TOTAL_STAGES} live={stageLive} doctor={report.status} />
			</div>
			{showLog ? (
				<div className="max-h-56 shrink-0 overflow-auto border-t border-border">
					<ReaLiveCallLog calls={calls} errors={snapshot.errors} onSelectStage={handleSelect} />
				</div>
			) : null}
			<div className="flex items-center gap-2 border-t border-border bg-card/20 px-3 py-1">
				<button
					type="button"
					className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					aria-expanded={showLog}
					onClick={() => setShowLog((prev) => !prev)}
				>
					{showLog ? t("live.calls.hide") : t("live.calls.show")}
				</button>
				<span className="min-w-0 truncate text-[10px] text-muted-foreground">
					{t("live.calls.count", { count: calls.length })}
				</span>
			</div>
			<ReaWorkflowControls currentStage={currentStage} onChange={handleSelect} />
		</div>
	);
}
