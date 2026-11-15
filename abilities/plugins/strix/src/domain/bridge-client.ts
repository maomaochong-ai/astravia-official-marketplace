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

import type { BridgeEvent, BridgeInstallPaths, BridgeState, StrixFinding } from "../runtime-contract";

export interface BridgeClient {
	state(): Promise<BridgeState>;
	/**
	 * 告诉服务“现在活跃的是哪个会话”（1.0.7）。
	 *
	 * 一个服务进程只有一个沙箱，而台账 / 状态需要按会话读：宿主的工具调用不带会话 id，
	 * 面板是唯一知道的人。宿主同一时刻只有一个活动轮次，所以这是诚实的归属依据。
	 */
	setConversation(conversationId: string | null): Promise<{ conversation: string | null }>;
	findings(): Promise<StrixFinding[]>;
	/** `key` 给了就读那条历史评估的留档（`?key=`），否则读当前会话。 */
	report(key?: string): Promise<{ markdown: string; count: number }>;
	stopSandbox(): Promise<{ stopped: boolean }>;
	/** 面板选择的执行环境（host/docker/auto）与上次安装尝试。 */
	preferences(): Promise<{ environmentMode: "auto" | "host" | "docker"; lastInstall?: { command: string; at: string; ok: boolean; detail?: string } }>;
	setPreferences(patch: { environmentMode?: "auto" | "host" | "docker" }): Promise<{ environmentMode: "auto" | "host" | "docker" }>;
	/** 让服务代跑 docker 安装命令；返回是否成功与它跑的是哪条。 */
	installDocker(): Promise<{ installed: boolean; lastInstall?: { command: string; at: string; ok: boolean; detail?: string }; error?: string }>;
	/** 环境检测：docker 是否可用、沙箱镜像是否已在本地。 */
	probeEnvironment(): Promise<{
		mode: "host" | "docker";
		ready: boolean;
		detail: string;
		docker: { ready: boolean; detail?: string; imagePresent: boolean | null };
		preference: "auto" | "host" | "docker";
	}>;
	/** 「装在哪」：当前系统的 docker 位置、容器内落点、工具链与数据目录（服务已探过存在性）。 */
	installPaths(): Promise<BridgeInstallPaths>;
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
		async setConversation(conversationId) {
			const base = await baseUrl();
			return readJson<{ conversation: string | null }>(
				await fetch(`${base}/api/conversation`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ conversationId }),
				}),
			);
		},
		async state() {
			const base = await baseUrl();
			return readJson<BridgeState>(await fetch(`${base}/api/state`, { cache: "no-store" }));
		},
		async findings() {
			const base = await baseUrl();
			const state = await readJson<BridgeState>(await fetch(`${base}/api/state`, { cache: "no-store" }));
			return state.findings ?? [];
		},
		async report(key?: string) {
			const base = await baseUrl();
			const suffix = key ? `?key=${encodeURIComponent(key)}` : "";
			return readJson(await fetch(`${base}/api/report${suffix}`));
		},
		async preferences() {
			const base = await baseUrl();
			return readJson<{ environmentMode: "auto" | "host" | "docker" }>(await fetch(`${base}/api/preferences`, { cache: "no-store" }));
		},
		async probeEnvironment() {
			const base = await baseUrl();
			return readJson(await fetch(`${base}/api/environment`, { cache: "no-store" }));
		},
		async installPaths() {
			const base = await baseUrl();
			return readJson(await fetch(`${base}/api/paths`, { cache: "no-store" }));
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
			let retry: ReturnType<typeof setTimeout> | undefined;
			let attempt = 0;

			/**
			 * 连一次；断了就带**最新的** baseUrl 重连。
			 *
			 * 不能只靠 EventSource 自带的自动重连：它记的是创建时那个 URL。服务被宿主重启
			 * （装新版本、崩溃拉起）之后端口可能变，旧 URL 永远连不上，而面板看起来还活着——
			 * 只是运行记录不再更新。那是一条静默故障。
			 */
			const connect = async (): Promise<void> => {
				const base = await baseUrl();
				if (closed) return;
				const next = new EventSource(`${base}/api/events`);
				source = next;
				next.onopen = () => {
					attempt = 0;
				};
				next.onmessage = (message) => {
					try {
						onEvent(JSON.parse(message.data) as BridgeEvent);
					} catch {
						/* a partial line is not worth surfacing */
					}
				};
				next.onerror = () => {
					if (closed || source !== next) return;
					next.close();
					source = undefined;
					// 退避 0.5s → 1 → 2 → 4 → 8，封顶 10s：不做快速无限重试。
					attempt += 1;
					const delay = Math.min(10_000, 500 * 2 ** Math.min(attempt - 1, 5));
					retry = setTimeout(() => {
						void connect().catch(() => undefined);
					}, delay);
				};
			};

			void connect().catch(() => undefined);
			return () => {
				closed = true;
				if (retry) clearTimeout(retry);
				source?.close();
			};
		},
	};
}
