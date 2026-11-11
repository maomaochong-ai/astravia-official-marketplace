/**
 * HTTP client for the bridge service.
 *
 * Three things the panel asks of it: what this machine can do, what the sandbox
 * is doing now, and which findings exist. The live feed is Server-Sent Events,
 * because the bridge already streams line-delimited JSON and ordering is what
 * makes a run readable.
 *
 * No scanning happens here: the agent calls the plugin's MCP tools, and this
 * client only reads what those calls produced.
 */

import type { BridgeEvent, BridgeState, StrixFinding } from "./runtime-contract";

export interface BridgeClient {
	state(): Promise<BridgeState>;
	findings(): Promise<StrixFinding[]>;
	report(): Promise<{ markdown: string; count: number }>;
	stopSandbox(): Promise<{ stopped: boolean }>;
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
