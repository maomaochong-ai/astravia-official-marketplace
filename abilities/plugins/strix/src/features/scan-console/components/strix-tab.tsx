/**
 * The tab: one screen, two phases.
 *
 * Upstream's setup screen becomes a launch column, and starting a scan replaces it
 * with the trace - the same transition `strix` makes when you press enter. The tab
 * never renders both, so the launch column can own the whole height the way it does
 * in a terminal.
 *
 * What both phases show is the host conversation's run: the launch column hands its
 * prompt to that conversation, and the scan screen renders what the host agent (and the
 * bridge's own event feed) reports. The plugin has no model of its own to drive.
 */

import type { ModelChoice } from "../../../domain/model-label";
import type { DerivedTarget } from "../../../domain/target-extraction";
import type {
	BridgeCapabilities,
	BridgeInstallPaths,
	BridgeScope,
	CoverageOutcome,
	ShellSessionSummary,
	EnvironmentProbe,
	NoteSummary,
	SandboxStatus,
	StrixFinding,
	TodoItem,
	TraceEntry,
} from "../../../runtime-contract";
import type { LogLine, SessionPhase } from "../hooks/use-strix-session";
import { ConsoleBoundary } from "./console-boundary";
import { LaunchScreen } from "./launch-screen";
import type { BridgeBudget, BridgeHistoryEntry, BridgeTeam, BridgeTelemetry } from "../../../runtime-contract";
import { ScanScreen } from "./scan-screen";
import type { McpConnection } from "../../../domain/mcp-roster";

export interface StrixTabProps {
	t: (key: string) => string;
	version: string;
	phase: SessionPhase;
	log: readonly LogLine[];
	/** Bridge boot state; a live line on the launch screen. */
	boot: { state: "connecting" | "ready" | "failed"; detail?: string };
	model?: ModelChoice;
	/** Folder name of the conversation workspace. */
	workspace?: string;
	/** The host conversation is generating right now. */
	hostStreaming: boolean;
	/** 停止可用：这一轮是本面板发起的。 */
	canStop: boolean;
	/** 团队会话：面板只读，发送与停止都在团队输入框。 */
	readOnly: boolean;
	/** 已声明的范围（目标区把声明与候选分两组画）。 */
	scope?: BridgeScope;
	/** 从对话里认出的候选目标。 */
	candidates?: readonly DerivedTarget[];
	/** 配置页的能力面：工具面与技能库的数量与来源。 */
	capabilities?: BridgeCapabilities;
	/** 「装在哪」。 */
	installPaths?: BridgeInstallPaths;
	/** 服务解析出来的真实落点（把「自动」说对）。 */
	resolvedMode?: "host" | "docker";
	/** 打开一条宿主路径。 */
	onOpenPath?: (path: string) => void;
	environment?: EnvironmentProbe;
	sandbox: SandboxStatus;
	findings: readonly StrixFinding[];
	trace: readonly TraceEntry[];
	todos: readonly TodoItem[];
	notes: readonly NoteSummary[];
	coverage: readonly CoverageOutcome[];
	sessions: readonly ShellSessionSummary[];
	mcp: readonly McpConnection[];
	busy: boolean;
	/** Reads a note's body for the panel's expander (`strix_note_get`). */
	onOpenNote: (id: string) => Promise<string>;
	/** 会话与状态四个面，由 useStrixSession 从服务读回。 */
	budget?: BridgeBudget;
	telemetry?: BridgeTelemetry | null;
	history?: readonly BridgeHistoryEntry[];
	team?: BridgeTeam | null;
	/** Counts by outcome from the service, for the coverage panel's title. */
	coverageTally?: Record<string, number>;
	stop: () => Promise<void>;
	/** 把面板输入框里的话交给宿主对话。 */
	send: (text: string) => Promise<boolean>;
	onQuit: () => void;
	/** 面板选的执行环境。 */
	environmentMode: "auto" | "host" | "docker";
	environmentReady: boolean;
	/** 环境检测结果（docker / 镜像）。 */
	docker: { ready: boolean; detail?: string; imagePresent: boolean | null } | null;
	onPullImage: () => Promise<void>;
	onEnvironmentMode: (mode: "auto" | "host" | "docker") => void;
	onInstallDocker: () => void;
	onRefreshEnvironment: () => void;
	/** 用户按了「返回首屏」：即使有评估在进行也先显示首屏。 */
	forceLaunch: boolean;
	onOpenLaunch: () => void;
	onNewSession: () => void;
	/** 首屏「进入工作台」：不发送消息，直接看现场（1.0.13）。 */
	onOpenWorkbench?: () => void;
}
export function StrixTab(props: StrixTabProps): React.ReactElement {
	const { t, phase } = props;
	const scanning = !props.forceLaunch && (phase === "scanning" || phase === "done");
	return (
		<ConsoleBoundary t={t}>
			{scanning ? (
				<ScanScreen
					t={t}
					phase={phase}
					model={props.model}
					workspace={props.workspace}
					hostStreaming={props.hostStreaming}
					scope={props.scope}
					candidates={props.candidates}
					canStop={props.canStop}
					environment={props.environment}
					sandbox={props.sandbox}
					findings={props.findings}
					todos={props.todos}
					notes={props.notes}
					coverage={props.coverage}
					sessions={props.sessions}
					mcp={props.mcp}
					trace={props.trace}
					onOpenNote={props.onOpenNote}
					{...(props.coverageTally ? { coverageTally: props.coverageTally } : {})}
					{...(props.budget ? { budget: props.budget } : {})}
					{...(props.telemetry ? { telemetry: props.telemetry } : {})}
					{...(props.history ? { history: props.history } : {})}
					{...(props.team ? { team: props.team } : {})}
					onStop={() => void props.stop()}
					onSend={(value) => void props.send(value)}
					{...(props.readOnly ? { readOnly: true } : {})}
					busy={props.busy}
					onOpenLaunch={props.onOpenLaunch}
					onNewSession={props.onNewSession}
				/>
			) : (
				<LaunchScreen
					t={t}
					model={props.model}
					{...(props.workspace ? { workspace: props.workspace } : {})}
					{...(props.team ? { team: props.team } : {})}
					log={props.log}
					version={props.version}
					scope={props.scope}
					mcp={props.mcp}
					onSend={(value) => void props.send(value)}
					{...(props.readOnly ? { readOnly: true } : {})}
					boot={props.boot}
					{...(props.onOpenWorkbench ? { onOpenWorkbench: props.onOpenWorkbench } : {})}
					{...(props.capabilities ? { capabilities: props.capabilities } : {})}
					{...(props.installPaths ? { installPaths: props.installPaths } : {})}
					{...(props.resolvedMode ? { resolvedMode: props.resolvedMode } : {})}
					{...(props.onOpenPath ? { onOpenPath: props.onOpenPath } : {})}
					onQuit={props.onQuit}
					environmentMode={props.environmentMode}
					environmentReady={props.environmentReady}
					docker={props.docker}
					onPullImage={props.onPullImage}
					onEnvironmentMode={props.onEnvironmentMode}
					onInstallDocker={props.onInstallDocker}
					onRefreshEnvironment={props.onRefreshEnvironment}
				/>
			)}
		</ConsoleBoundary>
	);
}