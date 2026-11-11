/**
 * The Strix sandbox as one reusable session.
 *
 * A container per assessment, started from Strix's own image (so the toolchain is
 * upstream's), with the user's directories mounted under /workspace. Commands go
 * through `docker exec`, which is what upstream's session.exec ends up doing.
 */

import { join } from "node:path";
import { dockerApi, imagePresent, pullImage, runArgs, type SandboxSpec } from "./docker";

const NAME_PREFIX = "astravia-strix-";
const DEFAULT_IMAGE = "ghcr.io/usestrix/strix-sandbox:1.4.0";

export interface SandboxStatus {
	running: boolean;
	sessionId?: string | null;
	container?: string | null;
	targets: string[];
	image?: string | null;
	uptimeSec?: number;
	startedAt?: string | null;
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

	constructor(
		private readonly emit: (payload: Record<string, unknown>) => void,
		private readonly dataDir: string,
	) {}

	status(): SandboxStatus {
		return {
			running: Boolean(this.container),
			sessionId: this.sessionId,
			container: this.container,
			targets: this.targets,
			image: this.image,
			uptimeSec: this.container ? Math.round((Date.now() - this.startedAt) / 1000) : 0,
			startedAt: this.container ? new Date(this.startedAt).toISOString() : null,
		};
	}

	async start(params: Record<string, unknown>): Promise<SandboxStatus> {
		if (this.container) return this.status();

		const sessionId = String(params.sessionId ?? "").trim() || `s${Date.now().toString(36)}`;
		const container = containerName(sessionId);
		const image = sandboxImage();
		const targets = Array.isArray(params.targets) ? params.targets.map(String).filter(Boolean) : [];
		const mounts = mountsFrom(Array.isArray(params.localSources) ? (params.localSources as MountInput[]) : []);

		// A container left behind by a previous run under the same id would block the name.
		await dockerApi.remove(container);

		this.emit({ event: "sandbox_status", phase: "preparing image" });
		if ((await imagePresent(image)) === false) {
			this.emit({ event: "sandbox_status", phase: "pulling image" });
			const pulled = await pullImage(image);
			if (pulled.code !== 0) throw new Error(`pulling ${image} failed: ${pulled.stderr.trim().slice(-500)}`);
		}

		this.emit({ event: "sandbox_status", phase: "starting container" });
		const spec: SandboxSpec = { name: container, image, mounts };
		const started = await dockerApi.run(runArgs(spec), 300_000);
		if (started.code !== 0) throw new Error(`docker run failed: ${started.stderr.trim().slice(-500)}`);

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

	async exec(params: Record<string, unknown>): Promise<Record<string, unknown>> {
		if (!this.container) throw new Error("no sandbox session; call strix_sandbox_start first");
		const command = String(params.command ?? "").trim();
		if (!command) throw new Error("command is required");
		const workdir = String(params.workdir ?? "").trim();
		const timeoutSec = Math.min(Number(params.timeoutSec) || 300, 600);
		const script = workdir ? `cd ${quote(workdir)} && ${command}` : command;

		this.emit({ event: "tool_start", tool: "exec_command", command, workdir: workdir || null });
		const started = Date.now();
		const result = await dockerApi.exec(this.container, script, timeoutSec * 1000);
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
