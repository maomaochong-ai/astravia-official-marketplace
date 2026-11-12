// Smoke-test the host-node service the way the host uses it: start the built
// entry with node, wait on the readiness endpoint, then exercise MCP and state.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The service is a build artifact: `npm run build` produces dist/service/main.mjs.
const SERVICE = join(import.meta.dirname, "..", "dist", "service", "main.mjs");
const PORT = 18777;
const BASE = `http://127.0.0.1:${PORT}`;

// Never write into the user's plugin data: the smoke test files real notes and
// todos, and those would show up in their next assessment.
const DATA_DIR = mkdtempSync(join(tmpdir(), "strix-service-check-"));

const child = spawn(process.execPath, [SERVICE], {
	env: { ...process.env, ASTRAVIA_SERVICE_PORT: String(PORT), ASTRAVIA_SERVICE_DATA_DIR: DATA_DIR },
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
		"strix_browser",
		"strix_load_skills",
		"strix_file_finding",
		"strix_update_finding",
		"strix_report",
		"strix_note_create",
		"strix_todo_create",
		"strix_coverage_record",
		"strix_threat_model",
	]) {
		assert(names.includes(expected), `missing tool ${expected}: ${names.join(",")}`);
	}
	// Plugin-side tools (think, ask, spawn, finish) must NOT appear here: the service
	// cannot answer them, and advertising them over MCP would produce dead calls.
	assert(!names.includes("strix_finish"), "service must not advertise plugin-side tools");

	const env = await rpc("tools/call", { name: "strix_environment", arguments: {} });
	const probe = JSON.parse(env.result.content[0].text);
	assert("docker" in probe && "engine" in probe, `probe payload wrong: ${JSON.stringify(probe)}`);

	const unknown = await rpc("tools/call", { name: "nope", arguments: {} });
	assert(unknown.error?.code === -32601, "unknown tool did not fail cleanly");

	// The console's loop reaches the same registry over HTTP rather than MCP. Both
	// a real answer and a failure must come back as 200-with-a-body: the loop turns
	// `ok: false` into a tool result and keeps going.
	const toolCall = await (
		await fetch(`${BASE}/api/tool`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "strix_environment", arguments: {} }),
		})
	).json();
	assert(toolCall.ok === true && toolCall.result?.docker, `api/tool did not run: ${JSON.stringify(toolCall)}`);
	const toolFail = await (
		await fetch(`${BASE}/api/tool`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "nope", arguments: {} }),
		})
	).json();
	assert(toolFail.ok === false, "api/tool accepted an unknown tool");

	// The working artefacts have to survive a round trip: the panel draws them from
	// /api/state, and a broken store would leave the boxes permanently empty.
	const call = async (name, args) =>
		(await (await fetch(`${BASE}/api/tool`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name, arguments: args }),
		})).json());
	const note = await call("strix_note_create", { title: "probe", content: "round trip" });
	assert(note.ok === true && note.result.note.id, "note was not stored");
	const todo = await call("strix_todo_create", { todos: [{ title: "probe todo" }] });
	assert(todo.ok === true && todo.result.todos.length === 1, `todo was not stored: ${JSON.stringify(todo)}`);
	const coverage = await call("strix_coverage_record", { surface: "GET /probe", outcome: "clean" });
	assert(coverage.ok === true && coverage.result.byOutcome.clean === 1, "coverage was not stored");
	const sarif = await call("strix_report", { format: "sarif" });
	assert(sarif.ok === true && sarif.result.sarif.version === "2.1.0", "sarif export failed");

	const state = await (await fetch(`${BASE}/api/state`)).json();
	assert(state.environment && state.sandbox, "state is incomplete");
	assert(Array.isArray(state.findings), "state has no findings array");
	assert(state.notes.length === 1 && state.todos.length === 1 && state.coverage.length === 1, "state is missing artefacts");

	console.log(
		`service ok: tools=${names.length} docker=${probe.docker.ready} skills=${Boolean(probe.skills)}`,
	);
} finally {
	child.kill();
	rmSync(DATA_DIR, { recursive: true, force: true });
}

