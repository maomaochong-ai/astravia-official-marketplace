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
import type {
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
import { ScanScreen } from "./scan-screen";
import type { McpConnection } from "../../../service/mcp-roster";

export interface StrixTabProps {
	t: (key: string) => string;
	version: string;
	phase: SessionPhase;
	log: readonly LogLine[];
	/** Bridge boot state; a live line on the launch screen (ADR strix-0004). */
	boot: { state: "connecting" | "ready" | "failed"; detail?: string };
	model?: ModelChoice;
	/** Folder name of the conversation workspace. */
	workspace?: string;
	/** The host conversation is generating right now. */
	hostStreaming: boolean;
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
	start: (prompt: string) => Promise<void>;
	send: (text: string) => Promise<void>;
	/** Reads a note's body for the panel's expander (`strix_note_get`). */
	onOpenNote: (id: string) => Promise<string>;
	/** Counts by outcome from the service, for the coverage panel's title. */
	coverageTally?: Record<string, number>;
	stop: () => Promise<void>;
	onQuit: () => void;
	/** 面板选的执行环境（ADR 0013）。 */
	environmentMode: "auto" | "host" | "docker";
	environmentReady: boolean;
	onEnvironmentMode: (mode: "auto" | "host" | "docker") => void;
	onInstallDocker: () => void;
	onRefreshEnvironment: () => void;
	/** 用户按了「返回首屏」：即使有评估在进行也先显示首屏（ADR 0014）。 */
	forceLaunch: boolean;
	onOpenLaunch: () => void;
	onNewSession: () => void;
}
/** Why Enter cannot launch yet, in the order the user would fix them. */
function blockedReason(t: (key: string) => string, model: ModelChoice | undefined, environment: EnvironmentProbe | undefined): string | undefined {
	if (!model) return t("launch.blocked.model");
	// No daemon is no longer a gate: the tools run in the user's session instead
	// (ADR strix-0001), with weaker isolation and a label that says so. The only real
	// block is an environment that reports itself unusable.
	if (environment && environment.ready === false) return t("launch.blocked.docker");
	return undefined;
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
					environment={props.environment}
					sandbox={props.sandbox}
					findings={props.findings}
					todos={props.todos}
					notes={props.notes}
					coverage={props.coverage}
					sessions={props.sessions}
					mcp={props.mcp}
					trace={props.trace}
					busy={props.busy}
					onSend={(value) => void props.send(value)}
					onOpenNote={props.onOpenNote}
					{...(props.coverageTally ? { coverageTally: props.coverageTally } : {})}
					onStop={() => void props.stop()}
					onOpenLaunch={props.onOpenLaunch}
					onNewSession={props.onNewSession}
				/>
			) : (
				<LaunchScreen
					t={t}
					model={props.model}
					log={props.log}
					version={props.version}
					blocked={blockedReason(t, props.model, props.environment)}
					busy={props.busy}
					boot={props.boot}
					onSubmit={(value) => void props.start(value)}
					onQuit={props.onQuit}
					environmentMode={props.environmentMode}
					environmentReady={props.environmentReady}
					onEnvironmentMode={props.onEnvironmentMode}
					onInstallDocker={props.onInstallDocker}
					onRefreshEnvironment={props.onRefreshEnvironment}
				/>
			)}
		</ConsoleBoundary>
	);
}