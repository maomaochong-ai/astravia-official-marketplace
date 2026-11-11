import { describe, expect, it } from "vitest";
import { createBridgeClient } from "../domain/bridge-client";

describe("bridge client", () => {
	it("surfaces the service's own error text instead of a bare status code", async () => {
		const client = createBridgeClient(async () => "http://127.0.0.1:1");
		const original = globalThis.fetch;
		globalThis.fetch = (async () =>
			new Response("bridge is still starting", { status: 503 })) as typeof fetch;
		try {
			await expect(client.state()).rejects.toThrow("bridge is still starting");
		} finally {
			globalThis.fetch = original;
		}
	});

	it("reads findings from the same state call, so the panel makes one round trip", async () => {
		const client = createBridgeClient(async () => "http://127.0.0.1:2");
		const urls: string[] = [];
		const original = globalThis.fetch;
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			urls.push(String(input));
			return new Response(
				JSON.stringify({
					environment: { ready: true },
					sandbox: { running: false },
					findings: [{ title: "XSS in search", severity: "high" }],
				}),
				{ status: 200 },
			);
		}) as typeof fetch;
		try {
			await expect(client.findings()).resolves.toEqual([{ title: "XSS in search", severity: "high" }]);
			expect(urls).toEqual(["http://127.0.0.1:2/api/state"]);
		} finally {
			globalThis.fetch = original;
		}
	});

	it("stops the sandbox through the service, not by killing anything locally", async () => {
		const client = createBridgeClient(async () => "http://127.0.0.1:3");
		const calls: string[] = [];
		const original = globalThis.fetch;
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			calls.push(`${init?.method ?? "GET"} ${String(input)}`);
			return new Response(JSON.stringify({ stopped: true }), { status: 200 });
		}) as typeof fetch;
		try {
			await expect(client.stopSandbox()).resolves.toEqual({ stopped: true });
			expect(calls).toEqual(["POST http://127.0.0.1:3/api/sandbox/stop"]);
		} finally {
			globalThis.fetch = original;
		}
	});
});
