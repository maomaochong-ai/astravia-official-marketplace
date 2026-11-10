import { describe, expect, it } from "vitest";
import { createBridgeClient, mergeRun } from "../domain/bridge-client";
import type { ScanRunSummary } from "../runtime-contract";

const run = (name: string, findingCount = 0): ScanRunSummary => ({
	runName: name,
	runId: name,
	status: "completed",
	findingCount,
	hasReport: true,
	hasSarif: true,
});

describe("bridge client", () => {
	it("reports the service's own error text instead of a bare status code", async () => {
		const client = createBridgeClient(async () => "http://127.0.0.1:1");
		const original = globalThis.fetch;
		globalThis.fetch = (async () => new Response("bridge is still starting", { status: 503 })) as typeof fetch;
		try {
			await expect(client.state()).rejects.toThrow("bridge is still starting");
		} finally {
			globalThis.fetch = original;
		}
	});

	it("keeps the newest run first and does not duplicate it on refresh", () => {
		const merged = mergeRun([run("a"), run("b")], run("b", 3));
		expect(merged.map((item) => item.runName)).toEqual(["b", "a"]);
		expect(merged[0].findingCount).toBe(3);
	});

	it("passes the workspace through so runs resolve against the open project", async () => {
		const client = createBridgeClient(async () => "http://127.0.0.1:2");
		const calls: string[] = [];
		const original = globalThis.fetch;
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			calls.push(String(input));
			return new Response(JSON.stringify({ environment: { ready: false }, runs: [] }), { status: 200 });
		}) as typeof fetch;
		try {
			await client.state("D:/work/app");
			expect(calls[0]).toContain("workspace=D%3A%2Fwork%2Fapp");
		} finally {
			globalThis.fetch = original;
		}
	});
});
