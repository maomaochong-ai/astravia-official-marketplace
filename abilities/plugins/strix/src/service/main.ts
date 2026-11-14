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
import { applyPatch, parsePatch } from "./patch";
import { toImagePayload } from "./images";
import { describeScope, outOfScopeHosts, ScopeStore } from "./scope";
import { ShellSessions } from "./shell-sessions";
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
const scope = new ScopeStore(DATA_DIR);
/** Long-running shells the agent chose not to wait for (service/shell-sessions.ts). */
const sessions = new ShellSessions(record);

/**
 * `exec`, plus the two shapes a long command needs.
 *
 * `background: true` hands the command to a kept session and returns immediately; that is
 * how upstream's `exec_command` behaves, and it is the only way to run a full nmap sweep or
 * an interactive tool without losing it to a timeout. Without the flag this is exactly the
 * old blocking call, so nothing that already worked changes.
 *
 * 附带一条范围提示：命令里出现声明范围之外的主机时，结果里会多一个 `outOfScope`
 * 字段并写进轨迹。它不拦命令（拦不住，也不该由正则拦），但让漂移可见。
 */
async function execWithSessions(args: Record<string, unknown>): Promise<Record<string, unknown>> {
	const command = String(args.command ?? "").trim();
	if (!command) throw new Error("command is required");

	const advisory = await scopeAdvisory(command);
	if (args.background === true) {
		if (!sandbox.canHostSession()) throw new Error("no sandbox session; call strix_sandbox_start first");
		const workdir = String(args.workdir ?? "").trim() || undefined;
		const tty = args.tty === true;
		const view = sessions.start({
			command,
			commandDisplay: command,
			argv: sandbox.sessionArgv(command, workdir, tty),
			tty,
			...(sandbox.sessionCwd() ? { cwd: sandbox.sessionCwd() } : {}),
		});
		return { background: true, sessionId: view.id, command, tty, ...advisory };
	}

	const result = await sandbox.exec(args);
	return { ...result, ...advisory };
}

/** Hosts mentioned by a command that the declared scope does not cover. */
async function scopeAdvisory(command: string): Promise<{ outOfScope?: string[] }> {
	const snapshot = await scope.snapshot().catch(() => undefined);
	if (!snapshot || snapshot.entries.length === 0) return {};
	const outside = outOfScopeHosts(command, snapshot.entries);
	if (outside.length === 0) return {};
	record({ event: "scope_advisory", hosts: outside, command });
	return { outOfScope: outside };
}

/** `strix_patch`: parse → read → apply → write, in that order, refusing on any doubt. */
async function applyPatchInSandbox(document: string): Promise<Record<string, unknown>> {
	const parsed = parsePatch(document);
	if (parsed.errors.length) return { ok: false, errors: parsed.errors };

	const contents = new Map<string, string | undefined>();
	for (const operation of parsed.operations) {
		if (contents.has(operation.path)) continue;
		const file = await sandbox.readFile(operation.path, 8 * 1024 * 1024).catch(() => ({ exists: false, bytes: new Uint8Array() }));
		contents.set(operation.path, file.exists ? Buffer.from(file.bytes).toString("utf8") : undefined);
	}

	const applied = applyPatch(parsed, (path) => contents.get(path));
	if (applied.errors.length) return { ok: false, errors: applied.errors };

	const written: Array<{ path: string; action: "added" | "updated" | "deleted" }> = [];
	for (const file of applied.files) {
		if (file.content === null) {
			await sandbox.deleteFile(file.path);
			written.push({ path: file.path, action: "deleted" });
			continue;
		}
		const result = await sandbox.writeFile(file.path, file.content);
		if (!result.ok) return { ok: false, errors: [`${file.path}: write failed`], written };
		written.push({ path: file.path, action: contents.get(file.path) === undefined ? "added" : "updated" });
	}

	record({ event: "patch_applied", files: written });
	return { ok: true, written };
}

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
	// 一条命令的两种形态：等它跑完（默认），或留下一个会话（background）。
	strix_exec: (args) => execWithSessions(args),
	strix_shell_sessions: async (args) => {
		const id = typeof args.sessionId === "string" ? args.sessionId.trim() : "";
		if (id) {
			const one = sessions.find(id);
			if (!one) throw new Error(`no session ${id}`);
			return one;
		}
		return { sessions: sessions.list() };
	},
	strix_write_stdin: async (args) => sessions.write(String(args.sessionId ?? ""), String(args.chars ?? "")),
	strix_kill_session: async (args) => sessions.kill(String(args.sessionId ?? "")),

	// 文件：上游用 SDK 的 patch / view_image，这里用同一份协议对同一个沙箱动手。
	strix_patch: async (args) => applyPatchInSandbox(String(args.patch ?? "")),
	strix_view_image: async (args) => {
		const path = String(args.path ?? "").trim();
		if (!path) throw new Error("path is required");
		const file = await sandbox.readFile(path);
		if (!file.exists) return { ok: false, path, error: "no such file in the sandbox" };
		return toImagePayload(path, file.bytes);
	},

	strix_think: async (args) => {
		const thought = String(args.thought ?? "").trim();
		if (!thought) throw new Error("thought is required");
		// 无副作用：只进日志流，面板的轨迹会把它当一行说明显示。
		record({ event: "think", thought });
		return { ok: true, recorded: thought.length };
	},

	strix_scope: async (args) => {
		const action = typeof args.action === "string" ? args.action : "";
		if (action === "add") return scope.add(args);
		if (action === "remove") return scope.remove(args);
		if (action === "rules") return scope.setRules(args);
		return scope.snapshot();
	},
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
	strix_delete_finding: (args) => findings.remove(sessionId(), args),
	strix_report: async (args) => {
		// `deep` promises more than a breadth pass; without a coverage gate the report
		// would read the same as `standard` while the user waited longer (ADR strix-0002).
		// Only the human summary form is gated: the SARIF export is a format, not a close-out.
		if (!args.format) {
			const recorded = await coverage.list(sessionId());
			const gate = finishGate(sandbox.status().scanMode ?? "standard", recorded.entries);
			if (!gate.allowed) return { ok: false, blocked: "coverage", reason: gate.reason };
		}
		// 范围写进报告：读者要能判断证据是否在约定边界内取得（上游 finish_scan 的结构）。
		const snapshot = await scope.snapshot();
		return findings.report(sessionId(), { ...args, scope: describeScope(snapshot) }, { version });
	},

	strix_note_create: (args) => notes.create(sessionId(), args),
	strix_note_list: (args) => notes.list(sessionId(), args),
	strix_note_get: (args) => notes.get(sessionId(), args),
	strix_note_update: (args) => notes.update(sessionId(), args),
	strix_note_delete: (args) => notes.delete(sessionId(), args),

	strix_todo_create: (args) => todos.create(sessionId(), args),
	strix_todo_update: (args) => todos.update(sessionId(), args),
	strix_todo_list: () => todos.list(sessionId()),
	strix_todo_remove: (args) => todos.remove(sessionId(), args),

	strix_coverage_record: (args) => coverage.record(sessionId(), args),
	strix_coverage_list: (args) => coverage.list(sessionId(), args),
	strix_coverage_update: (args) => coverage.update(sessionId(), args),
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

/** An image payload from `strix_view_image`, if that is what the handler returned. */
function asImageContent(
	result: unknown,
): { path: string; base64: string; mimeType: string; bytes: number } | undefined {
	if (!result || typeof result !== "object") return undefined;
	const value = result as Record<string, unknown>;
	if (value.ok !== true) return undefined;
	if (typeof value.dataUri !== "string" || typeof value.base64 !== "string" || typeof value.mimeType !== "string") {
		return undefined;
	}
	return {
		path: typeof value.path === "string" ? value.path : "image",
		base64: value.base64,
		mimeType: value.mimeType,
		bytes: typeof value.bytes === "number" ? value.bytes : 0,
	};
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
				// `strix_view_image` 的载荷带着 dataUri：把它换成真正的 image content block，
				// 否则宿主模型只拿到一串 base64 文本，等于白调。其余工具仍是文本。
				const image = asImageContent(result);
				if (image) {
					return reply({
						content: [
							{ type: "image", data: image.base64, mimeType: image.mimeType },
							{ type: "text", text: `image ${image.path} · ${image.mimeType} · ${image.bytes} bytes` },
						],
					});
				}
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
				// 工作单元：保留的 shell 会话（上游 agents 面板在本插件的诚实等价物，ADR 0010）。
				sessions: sessions.list().map(({ id, command, running, uptimeSec, tty }) => ({ id, command, running, uptimeSec, tty })),
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
	// 先收掉会话：一个被遗留的 nmap 比一个没退干净的进程更难处理。
	void sessions.dispose().finally(() => {
		server.close(() => process.exit(0));
	});
	setTimeout(() => process.exit(0), 2000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
