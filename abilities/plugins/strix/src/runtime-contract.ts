/**
 * Minimal host and service boundaries this plugin depends on.
 *
 * Only what Strix actually calls is declared here: the host surface it needs
 * from PluginContext (re-declared structurally so a missing method degrades
 * instead of throwing) and the payloads the bridge service returns.
 */

export type ServicePhase =
	| "idle"
	| "installing"
	| "starting"
	| "ready"
	| "stopping"
	| "error"
	| "failed"
	| "stopped";

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
	/** Which environment a scan will run in; `host` means no container (ADR strix-0001). */
	mode?: "docker" | "host";
	ready: boolean;
}

export interface SandboxStatus {
	running: boolean;
	sessionId?: string | null;
	targets?: string[];
	image?: string | null;
	uptimeSec?: number;
	/** Which environment this session runs in (ADR strix-0001). */
	mode?: "docker" | "host";
	/** Scan depth chosen at start (ADR strix-0002). */
	scanMode?: string;
	/** Caido proxy tools were enabled for this session. */
	proxy?: boolean;
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
	/** Artefacts the assessment accumulates alongside its findings. */
	notes?: NoteSummary[];
	todos?: TodoItem[];
	coverage?: CoverageOutcome[];
	logTail: BridgeEvent[];
}

export type BridgeEvent =
	| { event: "bridge_ready"; pid?: number }
	| { event: "sandbox_starting"; sessionId?: string; targets?: string[] }
	| { event: "sandbox_status"; phase: string }
	| { event: "sandbox_ready"; sessionId?: string; status?: SandboxStatus }
	| { event: "sandbox_stopped"; sessionId?: string }
	| { event: "tool_start"; tool: string; command?: string; workdir?: string | null }
	| {
			event: "tool_end";
			tool: string;
			command?: string;
			ok?: boolean;
			exitCode?: number | null;
			output?: string;
			durationMs?: number;
	  }
	| { event: string; [key: string]: unknown };
/** A todo from the assessment plan (service `todo`). */
export interface TodoItem {
	id: string;
	title: string;
	status: string;
	priority: string;
}

/** A note's summary: the body is fetched only when the model asks for it. */
export interface NoteSummary {
	id: string;
	title: string;
	category: string;
	updatedAt: string;
	/** 前 120 字符，由服务截断（`notes.list` 的 preview）。折叠时就能读一眼。 */
	preview?: string;
}

/** One attack surface and what testing it produced. */
export interface CoverageOutcome {
	surface: string;
	outcome: "vulnerable" | "clean" | "skipped";
	note?: string;
}

/**
 * One row of the trace. The three kinds mirror what upstream draws in its
 * viewport: a tool block (`→ Using tool …`), a chat line from the agent, and a
 * dim status note from the backend.
 */
export interface TraceEntry {
	id: string;
	/**
	 * 只有三种：工具（命令与结果）、agent 的说明（`note`）、它自己写的结论（`say`）。
	 *
	 * 曾经还有 `host` / `host-say` / `user`：把宿主对话里的用户发言与 agent 回复抄进面板。
	 * 那正是“两处回复一模一样”的来源，0.7.1 删除（ADR strix-0007）。现在即使想抄也
	 * 抄不了：类型里没有这几个名字。
	 */
	kind: "tool" | "say" | "note";
	/** For tools: the tool name. For chat: the message body. For notes: the line. */
	label: string;
	/** 相邻同文 note 被合并了几次（≥2 时面板显示 ×N）。 */
	count?: number;
	/** Arguments, exit code and duration, rendered under a tool name. */
	detail?: string;
	/** Undefined while a tool call is still in flight. */
	ok?: boolean;
	at: number;
	/** Tail of a command's output, folded away until the row is opened. */
	output?: string;
}
