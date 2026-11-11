/**
 * Strix bridge service (host-node runtime).
 *
 * The host starts this file, hands it a port, and talks to it two ways: the
 * agent reaches the tools over POST /mcp, and the plugin panel reads state and
 * subscribes to the event stream over /api/*. All Python work happens in one
 * child process (`python -m bridge`) that speaks JSON lines, so scan engine
 * changes never touch this file and this file never imports strix.
 *
 * Readiness contract: the host probes /api/health/ready and treats any non-2xx
 * as "process is broken" (it restarts or kills the service). This file therefore
 * answers 200 as soon as its HTTP server is up and reports the Python side
 * separately in the body - a missing interpreter is a setting to fix in the
 * panel, not a reason to restart the process forever.
 */
import { execFileSync, spawn } from "node:child_process";
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

/** Resolve the interpreter once per service process; the panel shows the reason when none works. */
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

const TOOLS = [
	{
		name: "strix_probe_environment",
		description:
			"Report whether this machine can run a Strix scan: engine installed, Docker ready, model credential configured.",
		inputSchema: { type: "object", properties: {}, additionalProperties: false },
		handler: async () => call("probe"),
	},
	{
		name: "strix_start_scan",
		description:
			"Start a Strix security scan in the background. Returns a run name; poll strix_get_findings or read the panel for progress.",
		inputSchema: {
			type: "object",
			properties: {
				targets: {
					type: "array",
					items: { type: "string" },
					minItems: 1,
					description: "URLs, repository URLs, local paths, IPs or API specs to assess.",
				},
				instruction: { type: "string", description: "Free-form focus, scope notes or credentials." },
				scanMode: { type: "string", enum: ["quick", "standard", "deep"] },
				workspace: { type: "string", description: "Absolute path whose strix_runs/ holds the run." },
				maxTurns: { type: "number", description: "Per-agent turn limit." },
				maxBudgetUsd: { type: "number", description: "Hard LLM spend ceiling for the run." },
			},
			required: ["targets"],
			additionalProperties: false,
		},
		handler: async (args) => call("start_scan", args, 300000),
	},
	{
		name: "strix_cancel_scan",
		description: "Cancel the scan that is currently running.",
		inputSchema: { type: "object", properties: {}, additionalProperties: false },
		handler: async () => call("cancel_scan", {}, 60000),
	},
	{
		name: "strix_list_runs",
		description: "List Strix runs found in a workspace, newest first.",
		inputSchema: {
			type: "object",
			properties: { workspace: { type: "string" }, limit: { type: "number" } },
			additionalProperties: false,
		},
		handler: async (args) => call("list_runs", args),
	},
	{
		name: "strix_get_findings",
		description: "Return the findings of one run as Strix wrote them (severity, CVSS, PoC, remediation).",
		inputSchema: {
			type: "object",
			properties: { runName: { type: "string" }, workspace: { type: "string" } },
			required: ["runName"],
			additionalProperties: false,
		},
		handler: async (args) => call("findings", args),
	},
	{
		name: "strix_get_report",
		description: "Return the Markdown penetration-test report of one run.",
		inputSchema: {
			type: "object",
			properties: { runName: { type: "string" }, workspace: { type: "string" } },
			required: ["runName"],
			additionalProperties: false,
		},
		handler: async (args) => call("report", args),
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

/**
 * Version reported over MCP. The installer writes `.runtime.json` beside this
 * file with the version the host recorded; fall back to reading it, and to a
 * placeholder when the service runs straight from a source checkout.
 */
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
			// Always 200 once listening: whether Python works is state for the panel, not a
			// process failure the host should answer with a restart loop. The probe still
			// verifies the child once, so `ready` means something on later calls.
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
			const workspace = url.searchParams.get("workspace") || "";
			const [environment, runs] = await Promise.all([
				call("probe").catch((error) => ({ error: String(error) })),
				childReady ? call("list_runs", { workspace }).catch(() => []) : Promise.resolve([]),
			]);
			return json(res, 200, { environment, runs, logTail: log.slice(-40) });
		}
		if (url.pathname === "/api/scan" && req.method === "POST") {
			const body = await readBody(req);
			const result = await call("start_scan", body, 300000);
			return json(res, 200, result);
		}
		if (url.pathname === "/api/scan/cancel" && req.method === "POST") {
			return json(res, 200, await call("cancel_scan", {}, 60000));
		}
		if (url.pathname === "/api/model" && req.method === "POST") {
			const body = await readBody(req);
			return json(res, 200, await call("configure_model", body, 30000));
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
		if (url.pathname.startsWith("/api/runs/")) {
			const [, , , runName, leaf] = url.pathname.split("/");
			const workspace = url.searchParams.get("workspace") || "";
			if (leaf === "findings") return json(res, 200, await call("findings", { runName, workspace }));
			if (leaf === "report") return json(res, 200, await call("report", { runName, workspace }));
			return json(res, 404, { error: "unknown run resource" });
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
