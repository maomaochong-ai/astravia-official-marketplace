/**
 * REA 活动栏 tab 容器。
 *
 * 结构自上而下三层，中间一层在三档宽度下重排：
 *   1. 标题条（品牌 + 一句话定位 + 铺满面板）
 *   2. 引擎条（真实 CLI phase + retry）与实时摘要条（目标 / 计数 / 最近目标）
 *   3. 内容网格
 *        < 880px   单列：阶段条 → 目标选择 → 阶段详情 → 工具就绪 → 执行环 → 调用日志
 *        880-1179  两列：左栏阶段轨道 + 主列；右栏内容落到主列下方
 *        ≥ 1180px  三列：左栏阶段轨道 + 主列 + 右栏（工具就绪 / 执行环 / 调用日志）
 *   底部：翻页控制条；主列底部的 sticky 作曲器负责「交给 Agent」。
 *
 * 为什么用 grid 显式定位而不是按宽度渲染两套 DOM：
 * 每块内容都挂了 hook（订阅、探测、安装状态），重复挂载会让同一份事实跑两遍，
 * 也会在切换宽度时丢掉展开状态。所以每块只渲染一次，位置交给栅格。
 *
 * 职责边界：执行逆向的是 Agent。插件只做三件事 —— 看清目标、看清进度、看清缺什么工具。
 * doctor 自动检测与「一键安装」都在插件侧只读/官方通道里完成，不手工跑分析命令。
 *
 * Tab chrome（标签条 / 关闭按钮 / resize handle）由宿主 ActivityPanel 提供。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useActivityTab, useTranslation } from "@astravia-org/plugin-sdk";
import type {
	PluginCliProviderStatus,
	PluginCommandRunResult,
	PluginCommandSpawnHandle,
	SendPromptResult,
} from "@astravia-org/plugin-sdk";
import { ReaProviderStatusBar } from "./rea-provider-status-bar";
import { ReaLiveStatus } from "./rea-live-status";
import { ReaLiveCallLog } from "./rea-live-call-log";
import { ReaWorkbench } from "./rea-workbench";
import { ReaWorkflowStageStrip } from "./rea-workflow-strip";
import { ReaWorkflowStageDetail } from "./rea-workflow-stage-detail";
import { ReaWorkflowControls } from "./rea-workflow-controls";
import { ReaWorkflowHeader } from "./rea-workflow-header";
import { ReaWorkflowRail } from "./rea-workflow-rail";
import { ReaWorkflowTargetRouting } from "./rea-workflow-target-routing";
import { ReaToolReadiness } from "./rea-tool-readiness";
import { ReaLoopConsole } from "./rea-loop-console";
import { STAGES, TOTAL_STAGES } from "../data/stages";
import { useDoctorReport } from "../hooks/use-doctor-report";
import { usePanelFullscreen } from "../hooks/use-panel-fullscreen";
import { useWorkbench } from "../hooks/use-workbench";
import { useStageRail } from "../hooks/use-stage-rail";
import { useReaLiveSnapshot } from "../live/use-live-snapshot";
import { scopeLiveCalls, type ReaLiveStore } from "../live/session-store";
import { buildStageDigest, bypassedStageIds } from "../live/diagram-live";
import { STAGE_INDEX } from "../live/tool-taxonomy";
import { Eyebrow } from "../../../shared/components/eyebrow";

export interface ReaProviderBridge {
	getStatus(): Promise<PluginCliProviderStatus>;
	onStatusChanged(listener: (status: PluginCliProviderStatus) => void): { dispose: () => void };
	retry(): Promise<void>;
	/** 运行 `npx -y rea-agents@latest <args>`；args 不含包名前缀。 */
	run(args: readonly string[], options: { cwd?: string; timeoutMs: number }): Promise<PluginCommandRunResult>;
	/** 同一个 provider 的长驻进程（安装用；可看输出、可停止）。 */
	spawn: ((args: readonly string[], options: { cwd?: string }) => Promise<PluginCommandSpawnHandle>) | null;
}

export interface ReaWorkflowTabProps {
	readonly provider: ReaProviderBridge;
	/** 实时状态源；插件装配完成前可能为 null。 */
	readonly store: ReaLiveStore | null;
	/** 把结构化逆向任务发进当前对话（主路径）。 */
	readonly sendPrompt: (prompt: string) => Promise<SendPromptResult>;
	/** 只填入输入框；不可用时返回 false。 */
	readonly insertPrompt: (prompt: string) => boolean;
	/** 直接执行外部命令（工具探测 / brew 安装）；无 `agent.command.run` 时为 null。 */
	readonly runCommand: ((file: string, args: readonly string[]) => Promise<PluginCommandRunResult>) | null;
	/** 长驻进程：brew 安装要能看过程、能中途取消；无 `agent.command.spawn` 时为 null。 */
	readonly spawnCommand: ((file: string, args: readonly string[]) => Promise<PluginCommandSpawnHandle>) | null;
	/** 把活动面板宽度拉满 / 还原（宿主没有 tab 级 fullscreen，只能改面板宽度）。 */
	readonly setPanelWidth: ((width: number | "max") => void) | null;
}

export function ReaWorkflowTab({
	provider,
	store,
	sendPrompt,
	insertPrompt,
	runCommand,
	spawnCommand,
	setPanelWidth,
}: ReaWorkflowTabProps): JSX.Element {
	const { t } = useTranslation();
	const { active, cwd } = useActivityTab();
	const [currentStage, setCurrentStage] = useState<number>(1);
	const [showLog, setShowLog] = useState<boolean>(true);
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

	const handleSelect = useCallback((next: number): void => {
		setCurrentStage(Math.max(1, Math.min(TOTAL_STAGES, next)));
	}, []);

	const workbench = useWorkbench({
		sendPrompt,
		insertPrompt,
		cwd: cwd ?? null,
		detected: snapshot.detectedTarget,
		detectedPath: snapshot.lastTargetPath,
		hinted: snapshot.hintedTarget,
		hintedPath: snapshot.hintedPath,
		onRoute: handleSelect,
	});

	// doctor 不接收目标参数：引擎一就绪就跑，否则 Host 等行会永远停在「未确认」。
	const report = useDoctorReport({
		run: provider.run,
		cwd: cwd ?? null,
		providerPhase: snapshot.providerPhase,
	});
	const panelRef = useRef<HTMLDivElement | null>(null);
	const panelFullscreen = usePanelFullscreen(panelRef, setPanelWidth);

	const calls = useMemo(() => scopeLiveCalls(snapshot, cwd), [snapshot, cwd]);
	// 被流程越过的阶段（自身没有调用、下游已有调用）：流程条要如实区分「没开始」和「跳过」。
	const bypassed = useMemo(() => bypassedStageIds(calls).map((id) => STAGE_INDEX[id]), [calls]);
	// 示意图与阶段标题用的是同一份真实信号：当前阶段的调用数 / 正在跑的工具。
	const stageLive = useMemo(
		() => ({ calls, running: snapshot.runningToolNames, digest: buildStageDigest(currentStage, calls, snapshot.runningToolNames) }),
		[calls, currentStage, snapshot.runningToolNames],
	);
	const activeTarget = workbench.active ?? snapshot.detectedTarget;
	// 左栏轨道与执行环摘要：阶段怎么画、覆盖到哪，都由这个 hook 一次算清。
	const stageRail = useStageRail({ currentStage, snapshot, bypassedStages: bypassed });

	const animateClass = active ? "motion-safe:animate-in motion-safe:fade-in-0" : "";

	return (
		<div
			ref={panelRef}
			className={`rea-root @container flex h-full w-full flex-col overflow-hidden bg-background text-foreground ${animateClass}`}
		>
			<ReaWorkflowHeader>
				{panelFullscreen.available ? (
					<button
						type="button"
						onClick={panelFullscreen.toggle}
						aria-pressed={panelFullscreen.fullscreen}
						title={t(panelFullscreen.fullscreen ? "tab.panel.restoreHint" : "tab.panel.fullscreenHint")}
						className="inline-flex size-7 items-center justify-center rounded-control text-faint transition-colors hover:bg-mist hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						<span
							aria-hidden
							className={`size-3.5 ${panelFullscreen.fullscreen ? "icon-[lucide--minimize]" : "icon-[lucide--maximize]"}`}
						/>
						<span className="sr-only">
							{t(panelFullscreen.fullscreen ? "tab.panel.restore" : "tab.panel.fullscreen")}
						</span>
					</button>
				) : null}
			</ReaWorkflowHeader>

			<ReaProviderStatusBar getStatus={provider.getStatus} onStatusChanged={provider.onStatusChanged} retry={provider.retry} />
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

			{/* 三档宽度：窄屏整页滚动；880 起左栏轨道 + 主列（轨道 sticky）；1180 起三列各自滚动。 */}
			<div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto @min-[880px]:grid-cols-[13.5rem_minmax(0,1fr)] @min-[1180px]:grid-cols-[13.5rem_minmax(0,1fr)_20rem] @min-[1180px]:grid-rows-[minmax(0,1fr)] @min-[1180px]:overflow-hidden">
				<ReaWorkflowRail
					currentStage={currentStage}
					total={TOTAL_STAGES}
					heading={t(stage.headingKey)}
					subtitle={t(stage.subtitleKey)}
					items={stageRail.items}
					onSelect={handleSelect}
					ariaLabel={t("tab.strip.aria")}
					passPercent={stageRail.passPercent}

				/>

				<main className="flex min-w-0 flex-col @min-[1180px]:min-h-0 @min-[1180px]:overflow-y-auto">
					{/* 窄面板用顶部横向阶段条；宽面板由左栏轨道接管，避免两套导航并存。 */}
					<div className="@min-[880px]:hidden">
						<ReaWorkflowStageStrip
							currentStage={currentStage}
							onSelect={handleSelect}
							completedStages={snapshot.visitedStages.map((id) => STAGE_INDEX[id])}
							liveStage={liveStage}
							bypassedStages={bypassed}
						/>
					</div>
					<div className="border-b border-border">
						<ReaWorkflowTargetRouting
							active={workbench.active}
							picked={workbench.picked}
							detected={snapshot.detectedTarget}
							onPick={workbench.pick}
							onClear={workbench.clearPick}
							onFollowDetected={workbench.clearPick}
						/>
					</div>
					<ReaWorkflowStageDetail
						stage={stage}
						total={TOTAL_STAGES}
						live={stageLive}
						doctor={report.status}
						target={activeTarget}
					/>
					<ReaWorkbench workbench={workbench} detected={snapshot.detectedTarget ?? snapshot.hintedTarget} />
				</main>

				<aside className="col-span-full flex min-w-0 flex-col gap-3 border-t border-border px-3 py-3 @min-[880px]:col-span-2 @min-[880px]:border-t @min-[1180px]:col-span-1 @min-[1180px]:col-start-3 @min-[1180px]:row-start-1 @min-[1180px]:min-h-0 @min-[1180px]:overflow-y-auto @min-[1180px]:border-l @min-[1180px]:border-t-0 @min-[1180px]:py-0 @min-[1180px]:pr-0">
					<section className="flex flex-col gap-2">
						<ReaToolReadiness
							target={activeTarget}
							calls={calls}
							running={snapshot.runningToolNames}
							report={report}
							run={provider.run}
							runCommand={runCommand}
							spawnRea={provider.spawn}
							spawnCommand={spawnCommand}
							cwd={cwd ?? null}
						/>
					</section>

					<section className="flex flex-col">
						<ReaLoopConsole snapshot={snapshot} />
					</section>

					<section className="flex min-h-0 flex-col">
						<div className="flex items-center justify-between gap-2">
							<Eyebrow tone="strong">{t("live.calls.title")}</Eyebrow>
							<div className="flex items-center gap-1.5">
								<span className="truncate text-micro text-faint">{t("live.calls.count", { count: calls.length })}</span>
								<button
									type="button"
									className="inline-flex h-5 items-center rounded-control px-1 text-micro-up font-medium text-faint transition-colors hover:bg-mist hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
									aria-expanded={showLog}
									onClick={() => setShowLog((prev) => !prev)}
								>
									{showLog ? t("live.calls.hide") : t("live.calls.show")}
								</button>
							</div>
						</div>
						{showLog ? (
							<div className="min-h-0">
								<ReaLiveCallLog calls={calls} errors={snapshot.errors} onSelectStage={handleSelect} />
							</div>
						) : null}
					</section>
				</aside>
			</div>

			<ReaWorkflowControls currentStage={currentStage} onChange={handleSelect} />
		</div>
	);
}
