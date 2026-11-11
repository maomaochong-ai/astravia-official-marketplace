/**
 * HTTP client for the bridge service.
 *
 * Answers three questions the panel asks: what machine am I on, what runs exist,
 * and what is happening right now. The live feed is Server-Sent Events because
 * the bridge already streams line-delimited JSON; buffering it into polls would
 * lose the ordering that makes a scan readable.
 */

import type { BridgeEvent, BridgeState, ScanRunSummary, StrixFinding } from "./runtime-contract";

export interface StartScanRequest {
	targets: readonly string[];
	instruction?: string;
	scanMode?: "quick" | "standard" | "deep";
	workspace?: string;
	maxTurns?: number;
	maxBudgetUsd?: number;
}

export interface BridgeClient {
	state(workspace?: string): Promise<BridgeState>;
	start(request: StartScanRequest): Promise<{ runName: string; runDir: string }>;
	cancel(): Promise<{ cancelled: boolean }>;
	/** Write the model choice into strix's own config and return the new path. */
	configureModel(request: { model: string; apiBase?: string; apiKey?: string }): Promise<{ model: string }>;
	findings(runName: string, workspace?: string): Promise<StrixFinding[]>;
	report(runName: string, workspace?: string): Promise<string>;
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
	const query = (workspace?: string) =>
		workspace ? `?workspace=${encodeURIComponent(workspace)}` : "";

	return {
		async state(workspace) {
			const base = await baseUrl();
			return readJson<BridgeState>(await fetch(`${base}/api/state${query(workspace)}`, { cache: "no-store" }));
		},
		async start(request) {
			const base = await baseUrl();
			return readJson(await fetch(`${base}/api/scan`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(request),
			}));
		},
		async cancel() {
			const base = await baseUrl();
			return readJson(await fetch(`${base}/api/scan/cancel`, { method: "POST" }));
		},
		async configureModel(request) {
			const base = await baseUrl();
			return readJson(
				await fetch(`${base}/api/model`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(request),
				}),
			);
		},
		async findings(runName, workspace) {
			const base = await baseUrl();
			return readJson<StrixFinding[]>(
				await fetch(`${base}/api/runs/${encodeURIComponent(runName)}/findings${query(workspace)}`),
			);
		},
		async report(runName, workspace) {
			const base = await baseUrl();
			const payload = await readJson<{ markdown: string }>(
				await fetch(`${base}/api/runs/${encodeURIComponent(runName)}/report${query(workspace)}`),
			);
			return payload.markdown;
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

export function mergeRun(list: readonly ScanRunSummary[], next: ScanRunSummary): ScanRunSummary[] {
	const without = list.filter((run) => run.runName !== next.runName);
	return [next, ...without];
}
