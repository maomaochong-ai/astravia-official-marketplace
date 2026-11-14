/**
 * HTTP client for the bridge service.
 *
 * Three things the plugin asks of it: what this machine can do, what the sandbox
 * is doing now, and which findings exist. `callTool` is the one write path: the
 * agent loop lives in the plugin (its model is the host's), so it needs the same
 * tools the MCP surface exposes, over the same registry.
 *
 * The live feed is Server-Sent Events, because the bridge already streams
 * line-delimited JSON and ordering is what makes a run readable.
 */

import type { BridgeEvent, BridgeState, StrixFinding } from "../runtime-contract";

export interface BridgeClient {
	state(): Promise<BridgeState>;
	findings(): Promise<StrixFinding[]>;
	report(): Promise<{ markdown: string; count: number }>;
	stopSandbox(): Promise<{ stopped: boolean }>;
	/** 面板选择的执行环境（host/docker/auto）与上次安装尝试（ADR 0013）。 */
	preferences(): Promise<{ environmentMode: "auto" | "host" | "docker"; lastInstall?: { command: string; at: string; ok: boolean; detail?: string } }>;
	setPreferences(patch: { environmentMode?: "auto" | "host" | "docker" }): Promise<{ environmentMode: "auto" | "host" | "docker" }>;
	/** 让服务代跑 docker 安装命令；返回是否成功与它跑的是哪条。 */
	installDocker(): Promise<{ installed: boolean; lastInstall?: { command: string; at: string; ok: boolean; detail?: string }; error?: string }>;
	/** 环境检测：docker 是否可用、沙箱镜像是否已在本地（ADR 0013）。 */
	probeEnvironment(): Promise<{
		mode: "host" | "docker";
		ready: boolean;
		detail: string;
		docker: { ready: boolean; detail?: string; imagePresent: boolean | null };
		preference: "auto" | "host" | "docker";
	}>;
	/** 让宿主执行 docker pull，返回结果与最新环境探测。 */
	pullImage(): Promise<{ ok: boolean; image?: string; tail?: string[]; error?: string }>;
	/** Run one bridge tool by name; throws on an unknown name or a tool failure. */
	callTool(name: string, args?: Record<string, unknown>): Promise<unknown>;
	events(onEvent: (event: BridgeEvent) => void): () => void;
}

async function readJson<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		throw new Error(detail || `bridge responded ${response.status}`);
	}
	return (await response.json()) as T;
}

async function getJson(url: string): Promise<unknown> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${response.status} ${url}`);
	return await response.json();
}

async function postJson(url: string, body: unknown): Promise<never> {
	const response = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	return (await response.json()) as never;
}

export function createBridgeClient(baseUrl: () => Promise<string>): BridgeClient {
	return {
		async state() {
			const base = await baseUrl();
			return readJson<BridgeState>(await fetch(`${base}/api/state`, { cache: "no-store" }));
		},
		async findings() {
			const base = await baseUrl();
			const state = await readJson<BridgeState>(await fetch(`${base}/api/state`, { cache: "no-store" }));
			return state.findings ?? [];
		},
		async report() {
			const base = await baseUrl();
			return readJson(await fetch(`${base}/api/report`));
		},
		async preferences() {
			const base = await baseUrl();
			return readJson<{ environmentMode: "auto" | "host" | "docker" }>(await fetch(`${base}/api/preferences`, { cache: "no-store" }));
		},
		async probeEnvironment() {
			const base = await baseUrl();
			return readJson(await fetch(`${base}/api/environment`, { cache: "no-store" }));
		},
		async pullImage() {
			const base = await baseUrl();
			return readJson(
				await fetch(`${base}/api/environment/pull`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
			);
		},
		async setPreferences(patch: { environmentMode?: "auto" | "host" | "docker" }) {
			const base = await baseUrl();
			return readJson<{ environmentMode: "auto" | "host" | "docker" }>(
				await fetch(`${base}/api/preferences`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(patch),
				}),
			);
		},
		async installDocker() {
			const base = await baseUrl();
			return readJson<{ installed: boolean; lastInstall?: { command: string; at: string; ok: boolean } }>(
				await fetch(`${base}/api/preferences`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ install: true }),
				}),
			);
		},
	async stopSandbox() {
			const base = await baseUrl();
			return readJson(await fetch(`${base}/api/sandbox/stop`, { method: "POST" }));
		},
		async callTool(name, args = {}) {
			const base = await baseUrl();
			// The bridge answers 200 for a tool that ran and failed (the failure is the
			// tool's result), so `ok` in the body - not the HTTP status - decides.
			const body = await readJson<{ ok?: boolean; result?: unknown; error?: string }>(
				await fetch(`${base}/api/tool`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ name, arguments: args }),
				}),
			);
			if (body.ok === false) throw new Error(body.error || `${name} failed`);
			return body.result;
		},
		events(onEvent) {
			let source: EventSource | undefined;
			let closed = false;
			void (async () => {
				const base = await baseUrl();
				if (closed) return;
				source = new EventSource(`${base}/api/events`);
				source.onmessage = (message) => {
					try {
						onEvent(JSON.parse(message.data) as BridgeEvent);
					} catch {
						/* a partial line is not worth surfacing */
					}
				};
			})().catch(() => undefined);
			return () => {
				closed = true;
				source?.close();
			};
		},
	};
}
