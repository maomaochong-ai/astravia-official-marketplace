// Smoke-test the host-node service the way the host uses it: start the built
// entry with node, wait on the readiness endpoint, then exercise MCP and state.
import { spawn } from "node:child_process";
import { join } from "node:path";

// The service is a build artifact: `npm run build` produces dist/service/main.mjs.
const SERVICE = join(import.meta.dirname, "..", "dist", "service", "main.mjs");
const PORT = 18777;
const BASE = `http://127.0.0.1:${PORT}`;

const child = spawn(process.execPath, [SERVICE], {
	env: { ...process.env, ASTRAVIA_SERVICE_PORT: String(PORT) },
	stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", (chunk) => {
	stderr += chunk;
});

async function waitForReady(attempts = 80) {
	for (let i = 0; i < attempts; i += 1) {
		try {
			const response = await fetch(`${BASE}/api/health/ready`);
			if (response.ok) return await response.json();
		} catch {
			/* not listening yet */
		}
		await new Promise((resolve) => setTimeout(resolve, 300));
	}
	throw new Error(`service never became ready; stderr:\n${stderr.slice(-800)}`);
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

const rpc = async (method, params) =>
	(
		await fetch(`${BASE}/mcp`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
		})
	).json();

try {
	const ready = await waitForReady();
	assert(ready.ready === true, "health did not report ready");

	const init = await rpc("initialize");
	assert(init.result?.serverInfo?.name === "strix", `bad initialize: ${JSON.stringify(init)}`);

	const list = await rpc("tools/list");
	const names = list.result.tools.map((tool) => tool.name);
	for (const expected of [
		"strix_environment",
		"strix_sandbox_start",
		"strix_exec",
		"strix_load_skills",
		"strix_file_finding",
		"strix_report",
	]) {
		assert(names.includes(expected), `missing tool ${expected}: ${names.join(",")}`);
	}

	const env = await rpc("tools/call", { name: "strix_environment", arguments: {} });
	const probe = JSON.parse(env.result.content[0].text);
	assert("docker" in probe && "engine" in probe, `probe payload wrong: ${JSON.stringify(probe)}`);

	const unknown = await rpc("tools/call", { name: "nope", arguments: {} });
	assert(unknown.error?.code === -32601, "unknown tool did not fail cleanly");

	const state = await (await fetch(`${BASE}/api/state`)).json();
	assert(state.environment && state.sandbox, "state is incomplete");
	assert(Array.isArray(state.findings), "state has no findings array");

	console.log(
		`service ok: tools=${names.length} docker=${probe.docker.ready} skills=${Boolean(probe.skills)}`,
	);
} finally {
	child.kill();
}
