/**
 * The Strix sandbox as one reusable session.
 *
 * A container per assessment, started from Strix's own image (so the toolchain is
 * upstream's), with the user's directories mounted under /workspace. Commands go
 * through `docker exec`, which is what upstream's session.exec ends up doing.
 *
 * Without a Docker daemon the same class runs commands in the user's own session
 * (`mode === "host"`): no container, no mount translation, weaker isolation. That
 * path exists so a scan can start at all — see ADR strix-0001.
 */

import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { dockerApi, imagePresent, pullImage, runArgs, type SandboxSpec } from "./docker";
import { asScanMode, commandCapSeconds, type ScanMode } from "../domain/scan-mode";
import { resolveEnvironment, type EnvironmentMode } from "./environment";
import { managedToolchainDir } from "./paths";
import { asProxyAction, parseProxyOutput, PROXY_ACTIONS, proxyCommand, proxyUnavailable } from "./proxy";

const run = promisify(execFile);

const NAME_PREFIX = "astravia-strix-";
const DEFAULT_IMAGE = "ghcr.io/usestrix/strix-sandbox:1.4.0";


/**
 * Run one command in the user's own session. Same shape as the docker result so the
 * tool surface does not need to know which environment it got.
 */

/**
 * Process env for a host-mode command: the managed toolchain directory first.
 *
 * Prepend, not replace: a tool the user installed themselves still resolves if the
 * shipped bundle does not carry it (ADR strix-0005: bundled wins, user's PATH remains).
 */
function withManagedToolchain(): NodeJS.ProcessEnv {
	const managed = managedToolchainDir();
	if (!managed) return process.env;
	const key = Object.keys(process.env).find((name) => name.toUpperCase() === "PATH") ?? "PATH";
	const current = process.env[key] ?? "";
	return { ...process.env, [key]: current ? `${managed}${delimiter}${current}` : managed };
}

const delimiter = process.platform === "win32" ? ";" : ":";

async function runLocal(
	command: string,
	cwd: string,
	timeoutMs: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
	const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
	const flag = process.platform === "win32" ? "/c" : "-c";
	try {
		const { stdout, stderr } = await run(shell, [flag, command], {
			cwd,
			timeout: timeoutMs,
			maxBuffer: 16 * 1024 * 1024,
			windowsHide: true,
			// The toolchain shipped with the plugin comes first (ADR strix-0005): a machine
			// with no package manager still runs the tools this build was tested against.
			env: withManagedToolchain(),
		});
		return { code: 0, stdout: String(stdout), stderr: String(stderr) };
	} catch (error) {
		const failure = error as { code?: number; stdout?: string; stderr?: string; message?: string };
		return {
			code: typeof failure.code === "number" ? failure.code : 1,
			stdout: String(failure.stdout ?? ""),
			stderr: String(failure.stderr ?? failure.message ?? error),
		};
	}
}

export interface SandboxStatus {
	running: boolean;
	sessionId?: string | null;
	container?: string | null;
	targets: string[];
	image?: string | null;
	uptimeSec?: number;
	startedAt?: string | null;
	/** Which environment this session runs in; `host` means no container. */
	mode?: EnvironmentMode;
	/** Scan depth chosen when the session started (ADR strix-0002). */
	scanMode?: ScanMode;
	/** Caido proxy tools were enabled for this session. */
	proxy?: boolean;
}

export interface MountInput {
	path: string;
	subdir?: string;
	readOnly?: boolean;
}

export function containerName(sessionId: string): string {
	return `${NAME_PREFIX}${dockerSafe(sessionId).slice(0, 40) || "session"}`;
}

/** Docker allows letters, digits, `_`, `.` and `-`, but not a leading dot or `..`. */
export function dockerSafe(value: string): string {
	return value
		.replace(/[^A-Za-z0-9_.-]/g, "")
		.replace(/\.{2,}/g, ".")
		.replace(/^[._-]+/, "");
}

/** Mount list from the tool call, with a basename fallback for the workspace subdir. */
export function mountsFrom(inputs: readonly MountInput[]): SandboxSpec["mounts"] {
	return inputs
		.filter((item) => Boolean(item.path?.trim()))
		.map((item) => ({
			host: item.path.trim(),
			name: (item.subdir?.trim() || item.path.trim().split(/[\\/]/).filter(Boolean).pop() || "workspace").replace(
				/[^A-Za-z0-9_.-]/g,
				"-",
			),
			readOnly: Boolean(item.readOnly),
		}));
}

export function sandboxImage(env: NodeJS.ProcessEnv = process.env): string {
	return env.STRIX_IMAGE?.trim() || DEFAULT_IMAGE;
}

export class Sandbox {
	private container: string | null = null;
	private image: string | null = null;
	private targets: string[] = [];
	private startedAt = 0;
	private sessionId: string | null = null;
	/** `host` means no container: commands run in the user's session (ADR strix-0001). */
	private mode: EnvironmentMode = "docker";
	private hostRoot: string | null = null;
	/** Scan depth for this session; fixed at start (ADR strix-0002). */
	private scanMode: ScanMode = "standard";
	/** Caido proxy tools are off unless the session asked for them. */
	private proxyEnabled = false;
	/** Why the container was not used, when a start fell back to this machine. */

	constructor(
		private readonly emit: (payload: Record<string, unknown>) => void,
		private readonly dataDir: string,
	) {}

	status(): SandboxStatus {
		return {
			running: Boolean(this.container) || this.hostRoot !== null,
			sessionId: this.sessionId,
			container: this.container,
			targets: this.targets,
			image: this.image,
			uptimeSec: this.container !== null || this.hostRoot !== null ? Math.round((Date.now() - this.startedAt) / 1000) : 0,
			startedAt:
				this.container !== null || this.hostRoot !== null ? new Date(this.startedAt).toISOString() : null,
			mode: this.mode,
			scanMode: this.scanMode,
			/** Whether the Caido proxy surface was enabled for this session (ADR strix-0002). */
			proxy: this.proxyEnabled,
		};
	}

	async start(params: Record<string, unknown>): Promise<SandboxStatus> {
		if (this.container || this.hostRoot) return this.status();

		// Decided per start, not at process boot: a daemon that came up between two
		// scans should be used by the second one (ADR strix-0001).
		this.mode = (await resolveEnvironment(sandboxImage())).mode;
		// Scan depth is snapshot here too: a step that changed the ceiling half-way
		// through would make the report unexplainable (ADR strix-0002).
		this.scanMode = asScanMode(params.mode);
		// Opt-in: a tool that can make the model request any URL is an attack surface.
		this.proxyEnabled = params.proxy === true;

		const sessionId = String(params.sessionId ?? "").trim() || `s${Date.now().toString(36)}`;
		const container = containerName(sessionId);
		const image = sandboxImage();
		const targets = Array.isArray(params.targets) ? params.targets.map(String).filter(Boolean) : [];
		const mounts = mountsFrom(Array.isArray(params.localSources) ? (params.localSources as MountInput[]) : []);

		// Host path (ADR strix-0001): no container, so there is no /workspace to mount. The
		// first mount becomes the working root and `exec` runs commands there.
		if (this.mode === "host") return this.beginHost({ sessionId, targets, mounts });

		// A container left behind by a previous run under the same id would block the name.
		await dockerApi.remove(container);

		// The image is not guaranteed to be reachable: ghcr.io can be blocked, rate limited, or
		// simply not published for this tag. A pull failure used to end the session even though
		// the same tools run fine on the host (ADR strix-0001: Docker is an accelerator, not a
		// prerequisite). So a failure here **degrades to host mode** and says why, instead of
		const degraded = (reason: string): SandboxStatus => {
			this.emit({ event: "sandbox_degraded", reason });
			// `beginHost` rather than a second copy of the host path: one place decides what
			// "run on this machine" means, and it cannot drift from the normal host start.
			return this.beginHost({ sessionId, targets, mounts });
		};

		try {
			this.emit({ event: "sandbox_status", phase: "preparing image" });
			if ((await imagePresent(image)) === false) {
				// The image is the toolchain (ADR strix-0002), so it is worth one bounded attempt
				// before falling back: on a network that can reach ghcr this is what makes the
				// panel useful, and on one that cannot, the fallback below still runs the scan.
				this.emit({ event: "sandbox_status", phase: "pulling image" });
				const pulled = await pullImage(image);
				if (pulled.code !== 0) {
					return degraded(`image ${image} could not be pulled: ${pulled.stderr.trim().slice(-400)}`);
				}
				this.emit({ event: "sandbox_status", phase: "image ready" });
			}

			this.emit({ event: "sandbox_status", phase: "starting container" });
			const spec: SandboxSpec = { name: container, image, mounts };
			const started = await dockerApi.run(runArgs(spec), 300_000);
			if (started.code !== 0) {
				return degraded(`docker run failed: ${started.stderr.trim().slice(-400)}`);
			}
		} catch (cause) {
			return degraded(`docker unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
		}

		this.container = container;
		this.image = image;
		this.targets = targets;
		this.sessionId = sessionId;
		this.startedAt = Date.now();

		// Tell the agent where things are without it having to poke around.
		const listing = await dockerApi.exec(container, "printf 'workspace:%s\\n' \"$(ls -A /workspace | tr '\\n' ' ')\"", 30_000);
		this.emit({ event: "sandbox_ready", sessionId, status: this.status() });
		return { ...this.status(), ...(listing.code === 0 ? {} : {}) };
	}

	/** The single definition of "run in the user's own session". */
	private beginHost(input: {
		sessionId: string;
		targets: string[];
		mounts: readonly { host: string }[];
	}): SandboxStatus {
		this.mode = "host";
		this.hostRoot = input.mounts[0]?.host ?? this.dataDir ?? process.cwd();
		this.targets = input.targets;
		this.sessionId = input.sessionId;
		this.startedAt = Date.now();
		this.image = null;
		this.emit({ event: "sandbox_ready", sessionId: input.sessionId, status: this.status() });
		return this.status();
	}

	async exec(params: Record<string, unknown>): Promise<Record<string, unknown>> {
		if (!this.container && !this.hostRoot) throw new Error("no sandbox session; call strix_sandbox_start first");
		const command = String(params.command ?? "").trim();
		if (!command) throw new Error("command is required");
		const workdir = String(params.workdir ?? "").trim();
		const timeoutSec = Math.min(Number(params.timeoutSec) || 300, commandCapSeconds(this.scanMode));
		const script = workdir ? `cd ${quote(workdir)} && ${command}` : command;

		this.emit({ event: "tool_start", tool: "exec_command", command, workdir: workdir || null });
		const started = Date.now();
		const result =
			this.mode === "host"
				? await runLocal(command, workdir ? join(this.hostRoot ?? "", workdir.replace(/^\/+/, "")) : (this.hostRoot ?? ""), timeoutSec * 1000)
				: await dockerApi.exec(this.container as string, script, timeoutSec * 1000);
		const durationMs = Date.now() - started;
		const ok = result.code === 0;

		this.emit({
			event: "tool_end",
			tool: "exec_command",
			command,
			ok,
			exitCode: result.code,
			durationMs,
			output: tail(result.stdout || result.stderr),
		});

		return {
			command,
			workdir: workdir || null,
			exitCode: result.code,
			ok,
			durationMs,
			stdout: clip(result.stdout),
			stderr: clip(result.stderr),
		};
	}

	/**
	 * What MCP servers the current run has, as the report state records them.
	 *
	 * Read from the run's own record file inside the container: that is where upstream
	 * writes `mcp_connections` as soon as a run connects, precisely so an interface can
	 * attribute a tool call mid-run. In host mode there is no container and therefore no
	 * roster — the caller merges the declared servers and says so.
	 */
	async mcpRoster(): Promise<unknown> {
		if (!this.container) return null;
		const script =
			"python -c \"import json,glob,os;" +
			"fs=sorted(glob.glob('/root/.strix/**/run.json',recursive=True),key=os.path.getmtime);" +
			"d=json.load(open(fs[-1])) if fs else {};" +
			"print(json.dumps(d.get('mcp_connection_status') or d.get('mcp_connections') or []))\"";
		const result = await dockerApi.exec(this.container, script, 30_000);
		if (result.code !== 0) return null;
		const last = result.stdout.trim().split(/\r?\n/).filter(Boolean).pop() ?? "";
		try {
			return JSON.parse(last) as unknown;
		} catch {
			return null;
		}
	}

	/**
	 * The Caido proxy, driven through the container's own Python module.
	 *
	 * Off unless the session enabled it, and only in a container — see `service/proxy.ts`
	 * for why this delegates to upstream's `caido_api` instead of re-implementing it.
	 */
	async proxy(params: Record<string, unknown>): Promise<Record<string, unknown>> {
		const action = asProxyAction(params.action);
		if (!action) {
			return { ok: false, error: `action must be one of ${PROXY_ACTIONS.join(", ")}` };
		}
		if (!this.container) return { ok: false, error: proxyUnavailable("no-container") };
		if (!this.proxyEnabled) return { ok: false, error: proxyUnavailable("not-enabled") };

		this.emit({ event: "tool_start", tool: "proxy", command: action });
		const started = Date.now();
		const result = await dockerApi.exec(this.container, proxyCommand(action, params), 120_000);
		const parsed = parseProxyOutput(result);
		this.emit({
			event: "tool_end",
			tool: "proxy",
			command: action,
			ok: parsed.ok,
			durationMs: Date.now() - started,
			output: parsed.ok ? "" : (parsed.error ?? ""),
		});
		if (!parsed.ok) return { ok: false, error: parsed.error ?? proxyUnavailable("not-installed") };
		return { ok: true, action, data: parsed.data };
	}

	/**
	 * The sandbox browser, through upstream's own CLI (`agent-browser`).
	 *
	 * Upstream exposes browser control as structured tools; the container ships the CLI
	 * that does the same job, so one `strix_browser` call is a thin, predictable wrapper
	 * over it instead of a second implementation of page state. Every action runs in the
	 * container, so the session (cookies, tabs) is the assessment's.
	 */
	async browser(params: Record<string, unknown>): Promise<Record<string, unknown>> {
		if (!this.container && !this.hostRoot) throw new Error("no sandbox session; call strix_sandbox_start first");
		// 浏览器的会话状态跟着容器走；没有容器时不自建一套（会与用户自己的浏览器打架）。
		if (!this.container) {
			throw new Error("strix_browser needs the container: no Docker daemon, so browser actions are unavailable in host mode");
		}
		const action = String(params.action ?? "").trim();
		const target = String(params.target ?? "").trim();
		const text = String(params.text ?? "");
		const timeoutSec = Math.min(Number(params.timeoutSec) || 120, 600);

		const argv: Record<string, string[]> = {
			open: ["open", target],
			click: ["click", target],
			type: ["type", target, text],
			text: ["text"],
			html: ["html"],
			screenshot: ["screenshot", target || "/tmp/strix-shot.png"],
			eval: ["eval", text],
			back: ["back"],
			close: ["close"],
		};
		const args = argv[action];
		if (!args) throw new Error(`action must be one of ${Object.keys(argv).join(", ")}`);
		if ((action === "open" || action === "click") && !target) throw new Error(`${action} needs a target`);
		if (action === "type" && !target) throw new Error("type needs a target selector");
		if ((action === "eval" || action === "type") && !text) throw new Error(`${action} needs text`);

		const command = `agent-browser ${args.map((part) => quote(part)).join(" ")}`;
		this.emit({ event: "tool_start", tool: "browser", command, workdir: null });
		const started = Date.now();
		const result = await dockerApi.exec(this.container, command, timeoutSec * 1000);
		const ok = result.code === 0;
		this.emit({
			event: "tool_end",
			tool: "browser",
			command,
			ok,
			exitCode: result.code,
			durationMs: Date.now() - started,
			output: tail(result.stdout || result.stderr),
		});
		return {
			action,
			target: target || null,
			exitCode: result.code,
			ok,
			durationMs: Date.now() - started,
			stdout: clip(result.stdout),
			stderr: clip(result.stderr),
		};
	}

	async stop(): Promise<{ stopped: boolean; sessionId?: string }> {
		if (!this.container) return { stopped: false };
		const sessionId = this.sessionId ?? undefined;
		await dockerApi.remove(this.container);
		this.container = null;
		this.startedAt = 0;
		this.emit({ event: "sandbox_stopped", sessionId });
		return { stopped: true, sessionId };
	}
}

export function quote(value: string): string {
	return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

const MAX_TEXT = 40_000;

/** Whole output up to a cap, with a marker so the agent knows it was cut. */
export function clip(text: string): string {
	if (text.length <= MAX_TEXT) return text;
	return `${text.slice(0, MAX_TEXT)}\n[... ${text.length - MAX_TEXT} chars truncated; write output to a file and read it in pieces ...]`;
}

/** Last lines, for the panel's one-glance summary. */
export function tail(text: string, lines = 8, chars = 600): string {
	const kept = text
		.trim()
		.split(/\r?\n/)
		.filter((line) => line.trim());
	return kept.slice(-lines).join("\n").slice(-chars);
}
