/**
 * Minimal host and service boundaries this plugin depends on.
 *
 * Only what Strix actually calls is declared here: the host surface it needs
 * from PluginContext (re-declared structurally so a missing method degrades
 * instead of throwing) and the payloads the bridge service returns.
 */

export type ServicePhase = "idle" | "installing" | "starting" | "ready" | "stopping" | "error";

export interface ServiceStatus {
	phase: ServicePhase;
	installed?: boolean;
	message?: string;
	recentOutput?: string[];
}

export interface ServiceConnection {
	baseUrl: string;
}

export interface ServiceBridgeHost {
	getStatus(serviceId: string): Promise<ServiceStatus>;
	connection(serviceId: string): Promise<ServiceConnection | undefined>;
	start(serviceId: string): Promise<ServiceStatus>;
	install(serviceId: string, files: readonly { destination: string; data: string }[]): Promise<ServiceStatus>;
	stop(serviceId: string): Promise<ServiceStatus>;
	onStatusChange(listener: (status: ServiceStatus & { serviceId?: string }) => void): { dispose(): void };
}

export interface EnvironmentProbe {
	python: { version: string; executable: string };
	engine: { installed: boolean; version: string };
	docker: { ready: boolean; detail: string; image: string };
	llm: { model: string; configured: boolean; keySource: string };
	configPath: string;
	ready: boolean;
}

export interface BridgeState {
	environment: EnvironmentProbe | { error: string };
	runs: ScanRunSummary[];
	logTail: BridgeEvent[];
}

export interface ScanTargetInfo {
	type: string;
	original?: string;
	details?: Record<string, unknown>;
}

export interface ScanRunSummary {
	runName: string;
	runId: string;
	status: string;
	startTime?: string | null;
	endTime?: string | null;
	scanMode?: string | null;
	targets?: ScanTargetInfo[];
	instruction?: string;
	findingCount: number;
	hasReport: boolean;
	hasSarif: boolean;
	exitReason?: string | null;
	path?: string;
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
	cvss?: number | string;
	cve?: string;
	cwe?: string;
	code_locations?: readonly { file?: string; start_line?: number; end_line?: number }[];
}

export type BridgeEvent =
	| { event: "bridge_ready"; pid?: number }
	| { event: "scan_queued"; runName: string; scanMode?: string }
	| { event: "scan_started"; runName: string }
	| { event: "scan_status"; runName: string; phase: string }
	| { event: "scan_event"; runName: string; record: ScanRecord }
	| { event: "scan_finished"; runName: string; status: string; summary?: ScanRunSummary | null }
	| { event: "scan_cancelled"; runName: string }
	| { event: "scan_failed"; runName: string; error: string; traceback?: string }
	| { event: "projection_error"; message: string }
	| { event: string; [key: string]: unknown };

export interface ScanRecord {
	id?: number;
	agent_id?: string;
	type?: string;
	role?: string;
	content?: string;
	tool_name?: string;
	tool_args?: unknown;
	timestamp?: string;
	[key: string]: unknown;
}
