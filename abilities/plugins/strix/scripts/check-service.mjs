// Smoke-test the host-node service the way the host uses it: start the process,
// wait on the readiness endpoint, then talk to help/state and the MCP endpoint.
import { spawn } from "node:child_process";
import { join } from "node:path";

const SERVICE = join(import.meta.dirname, "..", "service", "main.mjs");
const PORT = 18777;
const BASE = `http://127.0.0.1:${PORT}`;

const child = spawn(process.execPath, [SERVICE], {
	env: { ...process.env, ASTRAVIA_SERVICE_PORT: String(PORT), STRIX_PYTHON: process.env.STRIX_PYTHON || "python" },
	stdio: ["pipe", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", (chunk) => {
	stderr += chunk;
});

async function waitForReady(attempts = 60) {
	for (let i = 0; i < attempts; i += 1) {
		try {
			const response = await fetch(`${BASE}/api/health/ready`);
			if (response.ok) return await response.json();
		} catch {
			/* not listening yet */
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	throw new Error(`service never became ready; stderr:\n${stderr.slice(-800)}`);
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

try {
	const ready = await waitForReady();
	assert(ready.ready === true, "health did not report ready");

	const init = await (
		await fetch(`${BASE}/mcp`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
		})
	).json();
	assert(init.result?.serverInfo?.name === "strix", `bad initialize: ${JSON.stringify(init)}`);

	const list = await (
		await fetch(`${BASE}/mcp`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
		})
	).json();
	const names = list.result.tools.map((tool) => tool.name);
	assert(names.includes("strix_start_scan"), `missing tools: ${names.join(",")}`);

	const probe = await (
		await fetch(`${BASE}/mcp`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: { name: "strix_probe_environment", arguments: {} },
			}),
		})
	).json();
	assert(probe.result?.content?.[0]?.text?.includes('"engine"'), `probe tool failed: ${JSON.stringify(probe)}`);

	const state = await (await fetch(`${BASE}/api/state`)).json();
	assert(Array.isArray(state.runs), "state has no runs array");
	assert(state.environment && "ready" in state.environment, "state has no environment");

	const bad = await (
		await fetch(`${BASE}/mcp`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "nope" } }),
		})
	).json();
	assert(bad.error?.code === -32601, "unknown tool did not fail cleanly");

	console.log(`service ok: tools=${names.length} ready=${probe.result.content[0].text.includes('"ready": true')}`);
} finally {
	child.kill();
}
