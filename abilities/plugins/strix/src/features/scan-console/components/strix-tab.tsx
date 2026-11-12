/**
 * The tab: one screen, two phases.
 *
 * Upstream's setup screen becomes a launch column, and starting a scan replaces it
 * with the trace - the same transition `strix` makes when you press enter. The tab
 * never renders both, so the launch column can own the whole height the way it does
 * in a terminal.
 */

import type { ModelChoice } from "../../../domain/model-label";
import type { EnvironmentProbe, SandboxStatus, StrixFinding, TraceEntry } from "../../../runtime-contract";
import type { LogLine, SessionPhase } from "../hooks/use-strix-session";
import { ConsoleBoundary } from "./console-boundary";
import { LaunchScreen } from "./launch-screen";
import { ScanScreen } from "./scan-screen";

export interface StrixTabProps {
	t: (key: string) => string;
	version: string;
	phase: SessionPhase;
	log: readonly LogLine[];
	model?: ModelChoice;
	/** Folder name of the conversation workspace. */
	workspace?: string;
	/** The host conversation is generating right now. */
	hostStreaming: boolean;
	environment?: EnvironmentProbe;
	sandbox: SandboxStatus;
	findings: readonly StrixFinding[];
	trace: readonly TraceEntry[];
	busy: boolean;
	start: (prompt: string) => Promise<void>;
	send: (text: string) => Promise<void>;
	stop: () => Promise<void>;
	onQuit: () => void;
}

/** Why Enter cannot launch yet, in the order the user would fix them. */
function blockedReason(t: (key: string) => string, model: ModelChoice | undefined, environment: EnvironmentProbe | undefined): string | undefined {
	if (!model) return t("launch.blocked.model");
	if (environment && !environment.docker.ready) return t("launch.blocked.docker");
	return undefined;
}

export function StrixTab(props: StrixTabProps): React.ReactElement {
	const { t, phase } = props;
	const scanning = phase === "scanning" || phase === "done";

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
					trace={props.trace}
					busy={props.busy}
					onSend={(value) => void props.send(value)}
					onStop={() => void props.stop()}
				/>
			) : (
				<LaunchScreen
					t={t}
					model={props.model}
					log={props.log}
					version={props.version}
					blocked={blockedReason(t, props.model, props.environment)}
					busy={props.busy}
					onSubmit={(value) => void props.start(value)}
					onQuit={props.onQuit}
				/>
			)}
		</ConsoleBoundary>
	);
}
