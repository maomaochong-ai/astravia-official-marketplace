/**
 * Strix bridge service (host-node runtime).
 *
 * The host starts this file, gives it a port, and the agent reaches Strix's
 * capabilities over POST /mcp while the panel reads state over /api/* and
 * subscribes to /api/events. All Python work happens in one child process
 * (`python -m bridge`) that speaks JSON lines, so engine changes never touch
 * this file and this file never imports strix.
 *
 * There is no model handling here. The agent that calls these tools is the
 * host's, running on the user's configured model - this side only supplies the
 * sandbox, the skill library and the findings ledger.
 *
 * Readiness contract: the host probes /api/health/ready and treats any non-2xx
 * as "process is broken" (restart or kill). This file answers 200 as soon as its
 * HTTP server listens and reports the Python side in the body, because a missing
 * interpreter is a setting the user fixes, not a crash loop.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.ASTRAVIA_SERVICE_PORT || 0);
const HOST = process.env.STRIX_BRIDGE_HOST || "127.0.0.1";
const DATA_DIR = process.env.ASTRAVIA_SERVICE_DATA_DIR || join(HERE, "..", ".data");

/** @type {import("node:child_process").ChildProcessWithoutNullStreams | null} */
let child = null;
let childReady = false;
let pythonCommand = null;
let pythonError = "";
const pending = new Map();
const subscribers = new Set();
const log = [];
/** Mirror of the last state each side reported, so /api/state is cheap. */
const state = { sandbox: { running: false, targets: [] } };

function record(line) {
	log.push(line);
	if (log.length > 500) log.shift();
	for (const send of subscribers) send(line);
}

/** Candidates in preference order; `py -3` covers Windows installs without python.exe on PATH. */
function pythonCandidates() {
	const explicit = process.env.STRIX_PYTHON || process.env.ASTRAVIA_PYTHON;
	const list = explicit ? [[explicit]] : [];
	list.push(["python"], ["python3"]);
	if (process.platform === "win32") list.push(["py", "-3"]);
	return list;
}

function probePython([command, ...prefix]) {
	try {
		execFileSync(command, [...prefix, "-c", "import sys;print(sys.version)"], {
			encoding: "utf8",
			timeout: 15000,
			windowsHide: true,
			stdio: ["ignore", "pipe", "pipe"],
		});
		return { command, args: prefix };
	} catch (error) {
		return { command, args: prefix, error: error instanceof Error ? error.message : String(error) };
	}
}

function resolvePython() {
	if (pythonCommand) return pythonCommand;
	const failures = [];
	for (const candidate of pythonCandidates()) {
		const probed = probePython(candidate);
		if (!probed.error) {
			pythonCommand = { command: probed.command, args: probed.args };
			record({ event: "python_resolved", command: probed.command });
			return pythonCommand;
		}
		failures.push(`${probed.command}: ${probed.error.split("\n")[0]}`);
	}
	pythonError = `no usable Python found (${failures.join("; ")}). Set STRIX_PYTHON to a Python 3.12+ interpreter that has strix-agent installed.`;
	record({ event: "python_missing", detail: pythonError });
	return null;
}

function startChild() {
	if (child) return;
	const python = resolvePython();
	if (!python) return;

	child = spawn(python.command, [...python.args, "-m", "bridge"], {
		cwd: HERE,
		env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
		windowsHide: true,
	});

	let buffer = "";
	child.stdout.setEncoding("utf8");
	child.stdout.on("data", (chunk) => {
		buffer += chunk;
		let index = buffer.indexOf("\n");
		while (index >= 0) {
			const line = buffer.slice(0, index).trim();
			buffer = buffer.slice(index + 1);
			index = buffer.indexOf("\n");
			if (!line) continue;
			let payload;
			try {
				payload = JSON.parse(line);
			} catch {
				record({ event: "bridge_stdout", line });
				continue;
			}
			if (payload.id && pending.has(payload.id)) {
				const { resolve, reject } = pending.get(payload.id);
				pending.delete(payload.id);
				if (payload.ok) resolve(payload.result);
				else reject(new Error(payload.error || "bridge error"));
				continue;
			}
			if (payload.event === "sandbox_ready" && payload.status) state.sandbox = payload.status;
			if (payload.event === "sandbox_stopped") state.sandbox = { running: false, targets: [] };
			record(payload);
		}
	});

	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk) => {
		pythonError = chunk.trim().slice(-2000);
		record({ event: "bridge_stderr", line: chunk.trim() });
	});

	child.on("error", (error) => {
		pythonError = error instanceof Error ? error.message : String(error);
		childReady = false;
		child = null;
		record({ event: "bridge_spawn_failed", detail: pythonError });
	});

	child.on("exit", (code) => {
		childReady = false;
		child = null;
		record({ event: "bridge_exit", code });
		for (const { reject } of pending.values()) reject(new Error("bridge process exited"));
		pending.clear();
	});
}

function call(op, params = {}, timeoutMs = 30000) {
	startChild();
	if (!child) return Promise.reject(new Error(pythonError || "bridge process is not running"));
	const id = randomUUID();
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			pending.delete(id);
			reject(new Error(`bridge did not answer ${op} within ${timeoutMs}ms`));
		}, timeoutMs);
		pending.set(id, {
			resolve: (value) => {
				clearTimeout(timer);
				if (op === "ping") childReady = true;
				resolve(value);
			},
			reject: (error) => {
				clearTimeout(timer);
				reject(error);
			},
		});
		child.stdin.write(`${JSON.stringify({ id, op, params })}\n`);
	});
}

async function ensureReady() {
	if (childReady) return;
	await call("ping", {}, 60000);
	childReady = true;
}

/**
 * The tool surface. Descriptions carry the working method, because that is what
 * the host agent reads before choosing a tool - the same guidance Strix gives its
 * own agents, minus the orchestration it no longer owns.
 */
const TOOLS = [
	{
		name: "strix_environment",
		description:
			"Check whether this machine can run Strix tooling: the Python engine and the Docker sandbox. Call this before your first sandbox command.",
		inputSchema: { type: "object", properties: {}, additionalProperties: false },
		handler: () => call("probe"),
	},
	{
		name: "strix_sandbox_start",
		description:
			"Start (or reuse) the Strix sandbox container. It carries the full pentest toolchain: nmap, nuclei, ffuf, sqlmap, subfinder, naabu, Caido proxy, agent-browser + chromium, trivy, gitleaks, trufflehog, jwt_tool. Local directories you pass are mounted at /workspace/<name> inside the container. Call this once per assessment and keep using the same session.",
		inputSchema: {
			type: "object",
			properties: {
				targets: {
					type: "array",
					items: { type: "string" },
					description: "URLs, domains, IPs or repository URLs you are authorised to test.",
				},
				localSources: {
					type: "array",
					description: "Host directories to expose inside the sandbox workspace.",
					items: {
						type: "object",
						properties: {
							path: { type: "string", description: "Absolute host path." },
							subdir: { type: "string", description: "Directory name inside /workspace." },
							readOnly: { type: "boolean" },
						},
						required: ["path"],
						additionalProperties: false,
					},
				},
				sessionId: { type: "string", description: "Reuse an existing sandbox by id." },
			},
			additionalProperties: false,
		},
		handler: (args) => call("sandbox_start", args, 600000),
	},
	{
		name: "strix_exec",
		description:
			"Run a shell command inside the Strix sandbox and return stdout, stderr and the exit code. Use it to drive the bundled toolchain, write scripts under /workspace, and read their output. Commands are capped at 10 minutes: for anything longer, launch it in the background and poll with another call.",
		inputSchema: {
			type: "object",
			properties: {
				command: { type: "string", description: "Shell command, run with `sh -c`." },
				workdir: { type: "string", description: "Working directory inside the sandbox, e.g. /workspace/repo." },
				timeoutSec: { type: "number", description: "Seconds to wait; default 300, max 600." },
			},
			required: ["command"],
			additionalProperties: false,
		},
		handler: (args) => call("sandbox_exec", args, 660000),
	},
	{
		name: "strix_sandbox_status",
		description: "Current sandbox session: whether it is running, its targets, image and uptime.",
		inputSchema: { type: "object", properties: {}, additionalProperties: false },
		handler: () => call("sandbox_status", {}),
	},
	{
		name: "strix_sandbox_stop",
		description: "Stop and remove the sandbox container. Call it when the assessment is finished.",
		inputSchema: { type: "object", properties: {}, additionalProperties: false },
		handler: () => call("sandbox_stop", {}, 120000),
	},
	{
		name: "strix_list_skills",
		description:
			"List Strix's own security knowledge packs (78 skills across vulnerabilities, tooling, technologies, analysis and cloud). Each entry has a name and one-line description.",
		inputSchema: { type: "object", properties: {}, additionalProperties: false },
		handler: () => call("skills_list", {}),
	},
	{
		name: "strix_load_skills",
		description:
			"Load the full Markdown of one or more skills, by name or category/name. Load the skills that match the target before testing: they carry the technique, the payloads and the false-positive rules for that class of issue.",
		inputSchema: {
			type: "object",
			properties: {
				names: { type: "array", items: { type: "string" }, minItems: 1 },
			},
			required: ["names"],
			additionalProperties: false,
		},
		handler: (args) => call("skills_load", args, 60000),
	},
	{
		name: "strix_file_finding",
		description:
			"Record a confirmed vulnerability. File one only with evidence you actually produced - a request/response, a payload and its effect, or a code path. `severity` must be critical, high, medium, low or info; include cvss and cwe when you know them, and put the reproduction in `poc`.",
		inputSchema: {
			type: "object",
			properties: {
				title: { type: "string" },
				severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"] },
				target: { type: "string" },
				description: { type: "string" },
				impact: { type: "string" },
				technicalAnalysis: { type: "string" },
				poc: { type: "string", description: "Exact steps, payloads or the request that proved it." },
				evidence: { type: "string", description: "Raw output, HTTP exchange or code excerpt." },
				remediation: { type: "string" },
				cvss: { type: "number" },
				cwe: { type: "string" },
				cve: { type: "string" },
				confidence: { type: "string", enum: ["high", "medium", "low"] },
			},
			required: ["title", "severity"],
			additionalProperties: false,
		},
		handler: (args) => call("findings_add", args),
	},
	{
		name: "strix_list_findings",
		description: "Findings filed so far, ordered by severity, with a per-severity tally.",
		inputSchema: {
			type: "object",
			properties: { severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"] } },
			additionalProperties: false,
		},
		handler: (args) => call("findings_list", args),
	},
	{
		name: "strix_report",
		description: "Render the Markdown penetration-test report from the findings filed so far.",
		inputSchema: {
			type: "object",
			properties: { targets: { type: "array", items: { type: "string" } } },
			additionalProperties: false,
		},
		handler: (args) => call("report", args, 60000),
	},
];

async function readBody(req) {
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	if (!chunks.length) return {};
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(res, status, payload) {
	const body = JSON.stringify(payload);
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(body);
}

async function handleMcp(req, res) {
	const payload = await readBody(req);
	const reply = (result) => json(res, 200, { jsonrpc: "2.0", id: payload.id ?? null, result });
	const fail = (code, message) =>
		json(res, 200, { jsonrpc: "2.0", id: payload.id ?? null, error: { code, message } });

	switch (payload.method) {
		case "initialize":
			return reply({
				protocolVersion: "2024-11-05",
				capabilities: { tools: {} },
				serverInfo: { name: "strix", version: runtimeVersion() },
			});
		case "notifications/initialized":
			return json(res, 202, {});
		case "tools/list":
			return reply({
				tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
			});
		case "tools/call": {
			const name = payload.params?.name;
			const tool = TOOLS.find((item) => item.name === name);
			if (!tool) return fail(-32601, `unknown tool: ${name}`);
			try {
				const result = await tool.handler(payload.params?.arguments || {});
				return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
			} catch (error) {
				return reply({
					isError: true,
					content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
				});
			}
		}
		default:
			return fail(-32601, `unsupported method: ${payload.method}`);
	}
}

function runtimeVersion() {
	try {
		const marker = JSON.parse(readFileSync(join(HERE, "..", ".runtime.json"), "utf8"));
		return typeof marker.version === "string" ? marker.version : "0.0.0";
	} catch {
		return "0.0.0";
	}
}

const server = createServer(async (req, res) => {
	const url = new URL(req.url || "/", `http://${HOST}:${PORT || 80}`);
	try {
		if (url.pathname === "/api/health/ready") {
			// Always 200 once listening; whether Python works is state for the panel,
			// not a process failure the host should answer with a restart loop.
			if (!childReady && child) {
				await call("ping", {}, 4000).then(
					() => {
						childReady = true;
					},
					() => undefined,
				);
			}
			return json(res, 200, {
				ready: childReady,
				python: pythonCommand?.command ?? null,
				...(pythonError ? { detail: pythonError } : {}),
			});
		}
		if (url.pathname === "/mcp" && req.method === "POST") return await handleMcp(req, res);

		if (url.pathname === "/api/state") {
			const [environment, sandbox, findings] = await Promise.all([
				call("probe").catch((error) => ({ error: String(error) })),
				call("sandbox_status", {}).catch(() => state.sandbox),
				call("findings_list", {}).catch(() => ({ count: 0, findings: [] })),
			]);
			state.sandbox = sandbox;
			return json(res, 200, {
				environment,
				sandbox,
				findings: findings.findings ?? [],
				logTail: log.slice(-40),
			});
		}
		if (url.pathname === "/api/report") {
			return json(res, 200, await call("report", {}, 60000));
		}
		if (url.pathname === "/api/sandbox/stop" && req.method === "POST") {
			return json(res, 200, await call("sandbox_stop", {}, 120000));
		}
		if (url.pathname === "/api/events") {
			res.writeHead(200, {
				"content-type": "text/event-stream",
				"cache-control": "no-cache",
				connection: "keep-alive",
			});
			const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
			for (const line of log) send(line);
			subscribers.add(send);
			const heartbeat = setInterval(() => res.write(": ping\n\n"), 15000);
			req.on("close", () => {
				clearInterval(heartbeat);
				subscribers.delete(send);
			});
			return undefined;
		}
		return json(res, 404, { error: `no route for ${url.pathname}` });
	} catch (error) {
		return json(res, 500, { error: error instanceof Error ? error.message : String(error), stderr: pythonError });
	}
});

if (!existsSync(join(HERE, "bridge", "__main__.py"))) {
	record({ event: "bridge_missing", hint: "service/bridge must ship with the plugin archive" });
}

startChild();
server.listen(PORT, HOST, () => {
	record({ event: "service_listening", host: HOST, port: PORT });
});

const shutdown = () => {
	try {
		child?.stdin.write(`${JSON.stringify({ id: "bye", op: "shutdown", params: {} })}\n`);
	} catch {
		/* the child may already be gone */
	}
	server.close(() => process.exit(0));
	setTimeout(() => process.exit(0), 1500).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
