/**
 * REA 活动栏 tab 容器 —— 外壳 + 六个分节。
 *
 * 布局：侧栏（固定 w-56）| 顶栏（h-11）+ 可滚动主区。三层都是 flex 兄弟节点，
 * 没有绝对定位，也没有把侧栏塞进内容栅格，因此面板拖到任何宽度都不会出现
 * 「侧栏压在正文上」。侧栏在主区之外，主区拿 `min-w-0 flex-1` 自己滚动。
 *
 * 状态只在这里持有一次（分节 / 当前阶段 / 工作台 / 实时快照 / doctor / 全屏），
 * 六个分节页共用同一批数据，切页不重跑探测、不丢安装进度。
 *
 * 职责边界：执行逆向的是 Agent。插件只做三件事 —— 看清目标、看清进度、看清缺什么工具。
 * doctor 自动检测与一键安装都走只读 / 官方通道，不手工跑分析命令。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useActivityTab, useTranslation } from "@astravia-org/plugin-sdk";
import type {
	PluginCliProviderStatus,
	PluginCommandRunResult,
	PluginCommandSpawnHandle,
	SendPromptResult,
} from "@astravia-org/plugin-sdk";
import { STAGES, TOTAL_STAGES } from "../data/stages";
import { useDoctorReport } from "../hooks/use-doctor-report";
import { usePanelFullscreen } from "../hooks/use-panel-fullscreen";
import { useProviderStatus, providerEngineTone, providerLabelKey } from "../hooks/use-provider-status";
import { useWorkbench } from "../hooks/use-workbench";
import { useReaLiveSnapshot } from "../live/use-live-snapshot";
import { scopeLiveCalls, type ReaLiveStore } from "../live/session-store";
import { buildStageDigest, bypassedStageIds } from "../live/diagram-live";
import { STAGE_INDEX } from "../live/tool-taxonomy";
import { ReaAppShell } from "./rea-app-shell";
import { ReaSidebar } from "./rea-sidebar";
import { ReaTopbar } from "./rea-topbar";
import { sectionDefinition, type ReaSection } from "./rea-sections";
import { WorkbenchPage } from "./rea-page-workbench";
import { GuidePage } from "./rea-page-guide";
import { TargetsPage } from "./rea-page-targets";
import { CallsPage } from "./rea-page-calls";
import { ToolchainPage } from "./rea-page-toolchain";
import { EnginePage } from "./rea-page-engine";

export interface ReaProviderBridge {
	getStatus(): Promise<PluginCliProviderStatus>;
	onStatusChanged(listener: (status: PluginCliProviderStatus) => void): { dispose: () => void };
	retry(): Promise<void>;
	/** 运行 `npx -y rea-agents@latest <args>`；args 不含包名前缀。 */
	run(args: readonly string[], options: { cwd?: string; timeoutMs: number }): Promise<PluginCommandRunResult>;
	/** 同一个 provider 的长驻进程（安装用；可看输出、可停止）。 */
	spawn: ((args: readonly string[], options?: { cwd?: string }) => Promise<PluginCommandSpawnHandle>) | null;
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
	const [section, setSection] = useState<ReaSection>("workbench");
	const [currentStage, setCurrentStage] = useState<number>(1);
	const snapshot = useReaLiveSnapshot(store);
	const providerStatus = useProviderStatus(provider);

	const liveStage = snapshot.activeStage ? STAGE_INDEX[snapshot.activeStage] : null;
	// 会话里推进到新阶段时自动翻页；用户手动点选后就停在那，直到下一次真实推进。
	const followedStage = useRef<number | null>(null);
	useEffect(() => {
		if (liveStage === null || liveStage === followedStage.current) return;
		followedStage.current = liveStage;
		setCurrentStage(liveStage);
	}, [liveStage]);

	const stage = useMemo(() => STAGES.find((item) => item.index === currentStage) ?? STAGES[0]!, [currentStage]);

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
	// 被流程越过的阶段（自身没有调用、下游已有调用）：进度条要如实区分「没开始」和「跳过」。
	const bypassed = useMemo(() => bypassedStageIds(calls).map((id) => STAGE_INDEX[id]), [calls]);
	const stageLive = useMemo(
		() => ({
			calls,
			running: snapshot.runningToolNames,
			digest: buildStageDigest(currentStage, calls, snapshot.runningToolNames),
		}),
		[calls, currentStage, snapshot.runningToolNames],
	);

	const checks = report.checks ?? [];
	const definition = sectionDefinition(section);
	const activeTarget = workbench.active ?? snapshot.detectedTarget;
	const canSend = workbench.blockReason === null;

	const handleUseTarget = useCallback(
		(path: string): void => {
			// 同时落到插件侧输入框和宿主对话草稿：用户点「填入对话」就该在对话框里看到它。
			workbench.setTarget(path);
			workbench.insertToChat(path);
			setCurrentStage(2);
			setSection("workbench");
		},
		[workbench],
	);

	const animateClass = active ? "motion-safe:animate-in motion-safe:fade-in-0" : "";

	return (
		<div
			ref={panelRef}
			className={`rea-root @container flex h-full w-full flex-col overflow-hidden bg-surface text-text ${animateClass}`}
		>
			<ReaAppShell
				sidebar={
					<ReaSidebar
						section={section}
						onSelect={setSection}
						engineTone={providerEngineTone(providerStatus.phase)}
						engineLabel={t("ui.sidebar.engine")}
						engineDetail={t(providerLabelKey(providerStatus.phase))}
						enginePulse={providerStatus.busy}
					/>
				}
				topbar={
					<ReaTopbar
						sectionLabel={t(definition.labelKey)}
						cwd={cwd ?? null}
						canSend={canSend}
						sending={workbench.handoff === "sending"}
						onSend={() => workbench.handoffToAgent()}
						sendHint={canSend ? t("tab.workbench.handoffHint") : t("tab.workbench.targetRequired")}
						fullscreenAvailable={panelFullscreen.available}
						fullscreen={panelFullscreen.fullscreen}
						onToggleFullscreen={panelFullscreen.toggle}
					/>
				}
			>
				<WorkbenchPage
					active={section === "workbench"}
					workbench={workbench}
					snapshot={snapshot}
					stage={stage}
					currentStage={currentStage}
					calls={calls}
					bypassed={bypassed}
					stageLive={stageLive}
					doctor={report.status}
					onSelectStage={handleSelect}
					onGoTo={setSection}
					onUseTarget={handleUseTarget}
				/>

				<GuidePage
					active={section === "guide"}
					currentStage={currentStage}
					onSelectStage={handleSelect}
					stage={stage}
					stageLive={stageLive}
					doctor={report.status}
					target={activeTarget}
					targetPath={snapshot.lastTargetPath ?? workbench.target ?? null}
				/>

				<TargetsPage
					active={section === "targets"}
					current={workbench.active}
					picked={workbench.picked}
					detected={snapshot.detectedTarget}
					detectedPath={snapshot.lastTargetPath}
					onPick={workbench.pick}
					onClear={workbench.clearPick}
					onFollowDetected={workbench.clearPick}
					onUseTarget={handleUseTarget}
				/>

				<CallsPage
					active={section === "calls"}
					calls={calls}
					errors={snapshot.errors}
					callCount={snapshot.callCount}
					onSelectStage={handleSelect}
				/>

				<ToolchainPage
					active={section === "toolchain"}
					target={activeTarget}
					calls={calls}
					running={snapshot.runningToolNames}
					report={report}
					run={provider.run}
					runCommand={runCommand}
					spawnRea={provider.spawn}
					spawnCommand={spawnCommand}
					cwd={cwd ?? null}
					checks={checks}
				/>

				<EnginePage
					active={section === "engine"}
					provider={providerStatus}
					checks={checks}
					doctorStatus={report.status}
					doctorMessage={report.message}
					lastRunAt={report.lastRunAt}
					onRecheck={report.recheck}
					rechecking={report.status === "checking"}
					blocked={runCommand === null}
				/>
			</ReaAppShell>
		</div>
	);
}
