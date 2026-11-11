/**
 * Minimal host and service boundaries this plugin depends on.
 *
 * Only what Strix actually calls is declared here: the host surface it needs
 * from PluginContext (re-declared structurally so a missing method degrades
 * instead of throwing) and the payloads the bridge service returns.
 */

export type ServicePhase = "idle" | "installing" | "starting" | "ready" | "stopping" | "error" | "failed" | "stopped";

export interface ServiceStatus {
	phase: ServicePhase;
	installed?: boolean;
	message?: string;
	recentOutput?: string[];
}

export interface ServiceConnection {
	baseUrl: string;
}

export interface ServicePlatform {
	tag: string;
}

export interface ServiceRuntimeArtifact {
	sha256: string;
	archive: "file" | "zip" | "tar.gz";
	destination: string;
}

export interface ServiceBridgeHost {
	/** `win32-x64` style tag; selects which artifacts the host will accept. */
	getPlatform(): Promise<ServicePlatform>;
	getStatus(serviceId: string): Promise<ServiceStatus>;
	connection(serviceId: string): Promise<ServiceConnection | undefined>;
	start(serviceId: string): Promise<ServiceStatus>;
	stop(serviceId: string): Promise<ServiceStatus>;
	/** Writes the plugin's own runtime bytes; the host refuses to start without this. */
	install(
		serviceId: string,
		artifacts: readonly { destination: string; data: string }[],
	): Promise<ServiceStatus>;
	onStatusChange(listener: (status: ServiceStatus & { serviceId?: string }) => void): { dispose(): void };
}

export interface EnvironmentProbe {
	python: { version: string; executable: string; found: boolean };
	engine: { installed: boolean; version: string };
	docker: { ready: boolean; detail: string; image: string; imagePresent?: boolean | null };
	ready: boolean;
}

export interface SandboxStatus {
	running: boolean;
	sessionId?: string | null;
	targets?: string[];
	image?: string | null;
	uptimeSec?: number;
}

export interface StrixFinding {
	id?: string;
	title?: string;
	severity?: string;
	description?: string;
	impact?: string;
	target?: string;
	technical_analysis?: string;
	remediation_steps?: string;
	poc_description?: string;
	evidence?: string;
	cvss?: number | string;
	cve?: string;
	cwe?: string;
	confidence?: string;
	created_at?: string;
	code_locations?: readonly { file?: string; start_line?: number; end_line?: number }[];
}

export interface BridgeState {
	environment: EnvironmentProbe | { error: string };
	sandbox: SandboxStatus;
	findings: StrixFinding[];
	logTail: BridgeEvent[];
}

export type BridgeEvent =
	| { event: "bridge_ready"; pid?: number }
	| { event: "sandbox_starting"; sessionId?: string; targets?: string[] }
	| { event: "sandbox_status"; phase: string }
	| { event: "sandbox_ready"; sessionId?: string; status?: SandboxStatus }
	| { event: "sandbox_stopped"; sessionId?: string }
	| { event: "tool_start"; tool: string; command?: string; workdir?: string | null }
	| { event: "tool_end"; tool: string; command?: string; ok?: boolean; exitCode?: number | null }
	| { event: string; [key: string]: unknown };

/** One row of the panel's trace, derived from the bridge's event stream. */
export interface TraceEntry {
	id: string;
	kind: "command" | "note";
	label: string;
	detail?: string;
	ok?: boolean;
	at: number;
}
