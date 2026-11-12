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
