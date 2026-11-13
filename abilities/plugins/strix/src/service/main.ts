/**
 * The host-node service: MCP tool surface plus the panel's API.
 *
 * One process, one language. The tools hand a driver Strix's sandbox, its skill
 * library, a findings ledger and the working artefacts around it (notes, todos,
 * coverage, threat model). Two drivers exist and they share this registry: the host
 * agent (over MCP) and the plugin's own console, which runs the loop on the host's
 * model and calls the same tools over `/api/tool`.
 *
 * Names, descriptions and schemas come from `agent/strix-tools`: one catalogue, so a
 * tool cannot be described one way to the console's model and another way to MCP.
 *
 * Readiness: /api/health/ready answers 200 as soon as the server listens and puts
 * the detail in the body. The host treats a non-2xx probe as a broken process and
 * restarts it, and a missing Docker daemon is something the user fixes, not a
 * crash loop.
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { SERVICE_TOOL_NAMES, STRIX_TOOL_SPECS } from "../agent/strix-tools";
import { CoverageStore } from "./coverage";
import { resolveEnvironment } from "./environment";
import { finishGate } from "../domain/scan-mode";
import * as findings from "./findings";
import { NoteStore } from "./notes";
import { Sandbox, sandboxImage } from "./sandbox";
import { locateSkills, loadBodies, loadIndex } from "./skills";
import { installHint, missingTools, probeToolchain } from "./toolchain";
import { describeRoster, mergeRoster, normalizeRoster } from "./mcp-roster";
import { TodoStore } from "./todo";

const PORT = Number(process.env.ASTRAVIA_SERVICE_PORT || 0);
const HOST = process.env.STRIX_BRIDGE_HOST || "127.0.0.1";
const DATA_DIR = process.env.ASTRAVIA_SERVICE_DATA_DIR || "";

const log: Record<string, unknown>[] = [];
const subscribers = new Set<(payload: Record<string, unknown>) => void>();

function record(payload: Record<string, unknown>): void {
	log.push(payload);
	if (log.length > 400) log.shift();
	for (const send of subscribers) send(payload);
}

const sandbox = new Sandbox(record, DATA_DIR);
const notes = new NoteStore(DATA_DIR);
const todos = new TodoStore(DATA_DIR);
const coverage = new CoverageStore(DATA_DIR);

/** The installer writes `.runtime.json` beside the entry; absent in a source checkout. */
function readVersion(): string {
	try {
		const marker = JSON.parse(readFileSync(new URL("../.runtime.json", import.meta.url), "utf8")) as {
			version?: string;
		};
		return typeof marker.version === "string" ? marker.version : "0.0.0";
	} catch {
		return "0.0.0";
	}
}
const version = readVersion();

async function environment() {
	const resolved = await resolveEnvironment(sandboxImage());
	const docker = resolved.docker;
	const skills = await locateSkills();
	// Only meaningful in `host` mode: in a container the toolchain is the image's.
	const tools = resolved.mode === "host" ? await probeToolchain() : [];
	return {
		mode: resolved.mode,
		docker: { ready: docker.ready, detail: docker.detail, image: sandboxImage(), imagePresent: docker.imagePresent },
		engine: {
			// "installed" here means the skill library is reachable, which is all the
			// plugin needs now: the container carries the tools.
			installed: Boolean(skills),
			detail: skills ? skills.root : "strix-agent is not installed in any Python on PATH",
		},
		skills: skills ? { root: skills.root, source: skills.source } : null,
		tools,
		missingTools: missingTools(tools).map((name) => ({ name, install: installHint(name) })),
		// Ready means "a scan can start here": with a daemon the container carries the
		// tools; without one the user's session does, so only the skill library has to
		// be there (ADR strix-0001).
		ready: Boolean(skills) && (resolved.mode === "host" || docker.ready),
	};
}

/** Findings are keyed by the sandbox session, so one assessment has one ledger. */
function sessionId(): string {
	return sandbox.status().sessionId ?? "default";
}

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

/**
 * One handler per service tool, keyed by the name in the shared catalogue.
 *
 * Anything the plugin handles itself (`strix_think`, `strix_ask_user`, the agent
 * graph) is absent here on purpose: those need the model or the UI, which the
 * renderer owns.
 */
const HANDLERS: Record<string, Handler> = {
	strix_environment: () => environment(),

	// The MCP roster upstream docks as its own panel. Declared servers come from the
	// manifest, reported ones from the run; the merge keeps both and never invents a
	// "dead" state for a server that simply has not connected yet (service/mcp-roster.ts).
	strix_mcp: async () => {
		const declared = [{ name: "strix" }];
		const reported = normalizeRoster(await sandbox.mcpRoster().catch(() => null));
		const connections = mergeRoster(declared, reported);
		return { connections, summary: describeRoster(connections) };
	},

	strix_sandbox_start: (args) => sandbox.start(args),
	strix_exec: (args) => sandbox.exec(args),
	strix_sandbox_status: async () => sandbox.status(),
	strix_sandbox_stop: () => sandbox.stop(),
	strix_browser: (args) => sandbox.browser(args),
	strix_proxy: (args) => sandbox.proxy(args),

	strix_list_skills: async () => {
		const skills = await locateSkills();
		if (!skills) throw new Error("strix-agent is not installed; the skill library lives inside it");
		const { entries, categories } = await loadIndex(skills);
		return {
			root: skills.root,
			categories,
			total: entries.length,
			skills: entries.map(({ name, category, description, internal }) => ({ name, category, description, internal })),
		};
	},
	strix_load_skills: async (args) => {
		const skills = await locateSkills();
		if (!skills) throw new Error("strix-agent is not installed; the skill library lives inside it");
		return loadBodies(skills, (args.names as string[] | undefined) ?? []);
	},

	strix_file_finding: (args) => findings.add(sessionId(), args),
	strix_update_finding: (args) => findings.update(sessionId(), args),
	strix_list_findings: (args) => findings.list(sessionId(), args),
	strix_merge_findings: (args) => findings.merge(sessionId(), args),
	strix_report: async (args) => {
		// `deep` promises more than a breadth pass; without a coverage gate the report
		// would read the same as `standard` while the user waited longer (ADR strix-0002).
		// Only the human summary form is gated: the SARIF export is a format, not a close-out.
		if (!args.format) {
			const recorded = await coverage.list(sessionId());
			const gate = finishGate(sandbox.status().scanMode ?? "standard", recorded.entries);
			if (!gate.allowed) return { ok: false, blocked: "coverage", reason: gate.reason };
		}
		return findings.report(sessionId(), args, { version });
	},

	strix_note_create: (args) => notes.create(sessionId(), args),
	strix_note_list: (args) => notes.list(sessionId(), args),
	strix_note_get: (args) => notes.get(sessionId(), args),
	strix_note_update: (args) => notes.update(sessionId(), args),
	strix_note_delete: (args) => notes.delete(sessionId(), args),

	strix_todo_create: (args) => todos.create(sessionId(), args),
	strix_todo_update: (args) => todos.update(sessionId(), args),
	strix_todo_list: () => todos.list(sessionId()),

	strix_coverage_record: (args) => coverage.record(sessionId(), args),
	strix_coverage_list: (args) => coverage.list(sessionId(), args),
	strix_threat_model: (args) => coverage.threatModel(sessionId(), args),
};

/** The catalogue, narrowed to the tools this process answers - specs and handlers agree. */
const TOOLS = STRIX_TOOL_SPECS.filter((spec) => spec.handler === "service").map((spec) => {
	const handler = HANDLERS[spec.name];
	if (!handler) throw new Error(`service tool ${spec.name} has no handler`);
	return { name: spec.name, description: spec.description, inputSchema: spec.parameters, handler };
});

// A spec added without a handler (or the reverse) is a build-time defect, not a
// runtime surprise: fail fast instead of serving a tool that 500s on first call.
const missing = SERVICE_TOOL_NAMES.filter((name) => !TOOLS.some((tool) => tool.name === name));
if (missing.length) throw new Error(`service tools declared but not wired: ${missing.join(", ")}`);

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(chunk as Buffer);
	if (!chunks.length) return {};
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
	} catch {
		return {};
	}
}

function json(res: ServerResponse, status: number, payload: unknown): void {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(payload));
}

async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
	const body = await readBody(req);
	const id = body.id ?? null;
	const reply = (result: unknown) => json(res, 200, { jsonrpc: "2.0", id, result });
	const fail = (code: number, message: string) => json(res, 200, { jsonrpc: "2.0", id, error: { code, message } });

	switch (body.method) {
		case "initialize":
			return reply({
				protocolVersion: "2024-11-05",
				capabilities: { tools: {} },
				serverInfo: { name: "strix", version },
			});
		case "notifications/initialized":
			res.writeHead(202).end();
			return;
		case "tools/list":
			return reply({
				tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
			});
		case "tools/call": {
			const params = (body.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
			const tool = TOOLS.find((item) => item.name === params.name);
			if (!tool) return fail(-32601, `unknown tool: ${params.name}`);
			try {
				const result = await tool.handler(params.arguments ?? {});
				return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
			} catch (error) {
				return reply({
					isError: true,
					content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
				});
			}
		}
		default:
			return fail(-32601, `unsupported method: ${String(body.method)}`);
	}
}

const server = createServer(async (req, res) => {
	const url = new URL(req.url ?? "/", `http://${HOST}:${PORT || 80}`);
	try {
		if (url.pathname === "/api/health/ready") {
			return json(res, 200, { ready: true, version });
		}
		if (url.pathname === "/mcp" && req.method === "POST") return await handleMcp(req, res);
		if (url.pathname === "/api/tool" && req.method === "POST") {
			// One HTTP call per tool, through the same handler the MCP surface uses: the
			// console drives the loop, this process owns the container.
			const body = await readBody(req);
			const name = typeof body.name === "string" ? body.name : "";
			const tool = TOOLS.find((item) => item.name === name);
			if (!tool) return json(res, 404, { ok: false, error: `unknown tool: ${name}` });
			const args =
				body.arguments && typeof body.arguments === "object"
					? (body.arguments as Record<string, unknown>)
					: {};
			try {
				return json(res, 200, { ok: true, result: await tool.handler(args) });
			} catch (error) {
				// A failed tool is still an answer the loop must see, not a transport error.
				return json(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
			}
		}
		if (url.pathname === "/api/state") {
			const [env, list, noteList, todoList, cover, threat] = await Promise.all([
				environment().catch((error) => ({ error: String(error) })),
				findings.list(sessionId()).catch(() => ({ count: 0, bySeverity: {}, findings: [] })),
				notes.list(sessionId()).catch(() => ({ count: 0, notes: [] })),
				todos.list(sessionId()).catch(() => ({ count: 0, todos: [] })),
				coverage.list(sessionId()).catch(() => ({ count: 0, byOutcome: {}, entries: [] })),
				coverage.threatModel(sessionId()).catch(() => ({ content: "", targets: [], updated_at: null })),
			]);
			return json(res, 200, {
				environment: env,
				sandbox: sandbox.status(),
				findings: (list as { findings?: unknown }).findings ?? [],
				notes: (noteList as { notes?: unknown }).notes ?? [],
				todos: (todoList as { todos?: unknown }).todos ?? [],
				coverage: (cover as { entries?: unknown }).entries ?? [],
				coverageTally: (cover as { byOutcome?: unknown }).byOutcome ?? {},
				threatModel: threat,
				logTail: log.slice(-40),
			});
		}
		if (url.pathname === "/api/report") {
			return json(res, 200, await findings.report(sessionId(), {}, { version }));
		}
		if (url.pathname === "/api/sandbox/stop" && req.method === "POST") {
			return json(res, 200, await sandbox.stop());
		}
		if (url.pathname === "/api/log") {
			return json(res, 200, { log });
		}
		if (url.pathname === "/api/events") {
			res.writeHead(200, {
				"content-type": "text/event-stream",
				"cache-control": "no-cache",
				connection: "keep-alive",
			});
			const send = (payload: Record<string, unknown>) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
			for (const line of log) send(line);
			subscribers.add(send);
			const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);
			req.on("close", () => {
				clearInterval(heartbeat);
				subscribers.delete(send);
			});
			return;
		}
		return json(res, 404, { error: `no route for ${url.pathname}` });
	} catch (error) {
		return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
	}
});

server.listen(PORT, HOST, () => {
	record({ event: "service_listening", host: HOST, port: PORT, id: randomUUID() });
});

const shutdown = () => {
	server.close(() => process.exit(0));
	setTimeout(() => process.exit(0), 1500).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
