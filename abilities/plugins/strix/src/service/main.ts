/**
 * The host-node service: MCP tool surface plus the panel's API.
 *
 * One process, one language. The tools hand a driver Strix's sandbox, its skill
 * library and a findings ledger. Two drivers exist and they share this registry:
 * the host agent (over MCP) and the plugin's own console, which runs the loop on
 * the host's model and calls the same tools over `/api/tool`.
 *
 * Readiness: /api/health/ready answers 200 as soon as the server listens and puts
 * the detail in the body. The host treats a non-2xx probe as a broken process and
 * restarts it, and a missing Docker daemon is something the user fixes, not a
 * crash loop.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dockerReady, imagePresent } from "./docker";
import * as findings from "./findings";
import { locateSkills, loadBodies, loadIndex } from "./skills";
import { Sandbox, sandboxImage } from "./sandbox";

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
	const [docker, image] = await Promise.all([dockerReady(), imagePresent(sandboxImage())]);
	const skills = await locateSkills();
	return {
		docker: { ready: docker.ready, detail: docker.detail, image: sandboxImage(), imagePresent: image },
		engine: {
			// "installed" here means the skill library is reachable, which is all the
			// plugin needs now: the container carries the tools.
			installed: Boolean(skills),
			detail: skills ? skills.root : "strix-agent is not installed in any Python on PATH",
		},
		skills: skills ? { root: skills.root, source: skills.source } : null,
		ready: docker.ready && Boolean(skills),
	};
}

const TOOLS: {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	handler: (args: Record<string, unknown>) => Promise<unknown>;
}[] = [
	{
		name: "strix_environment",
		description:
			"Check whether this machine can run Strix tooling: the Docker sandbox and the Strix skill library. Call this before your first sandbox command.",
		inputSchema: { type: "object", properties: {}, additionalProperties: false },
		handler: () => environment(),
	},
	{
		name: "strix_sandbox_start",
		description:
			"Start a Strix sandbox container for this assessment. It carries the full pentest toolchain: nmap, nuclei, ffuf, sqlmap, subfinder, naabu, Caido, agent-browser + chromium, trivy, gitleaks, trufflehog, jwt_tool. Local directories are mounted at /workspace/<name>. Start one session per assessment and keep using it.",
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
							path: { type: "string" },
							subdir: { type: "string" },
							readOnly: { type: "boolean" },
						},
						required: ["path"],
						additionalProperties: false,
					},
				},
				sessionId: { type: "string" },
			},
			additionalProperties: false,
		},
		handler: (args) => sandbox.start(args),
	},
	{
		name: "strix_exec",
		description:
			"Run a shell command inside the Strix sandbox and return stdout, stderr and the exit code. Use it to drive the bundled toolchain, write scripts under /workspace and read their output. Commands are capped at 10 minutes: for anything longer, launch it in the background and poll with another call.",
		inputSchema: {
			type: "object",
			properties: {
				command: { type: "string", description: "Shell command, run with `sh -c`." },
				workdir: { type: "string", description: "Working directory inside the sandbox, e.g. /workspace/repo." },
				timeoutSec: { type: "number" },
			},
			required: ["command"],
			additionalProperties: false,
		},
		handler: (args) => sandbox.exec(args),
	},
	{
		name: "strix_sandbox_status",
		description: "Current sandbox session: running, its targets, image and uptime.",
		inputSchema: { type: "object", properties: {}, additionalProperties: false },
		handler: async () => sandbox.status(),
	},
	{
		name: "strix_sandbox_stop",
		description: "Stop and remove the sandbox container. Call it when the assessment is finished.",
		inputSchema: { type: "object", properties: {}, additionalProperties: false },
		handler: () => sandbox.stop(),
	},
	{
		name: "strix_list_skills",
		description:
			"List Strix's security knowledge packs, from the installed engine. Each entry has a name, a category and a one-line description.",
		inputSchema: { type: "object", properties: {}, additionalProperties: false },
		handler: async () => {
			const skills = await locateSkills();
			if (!skills) throw new Error("strix-agent is not installed; the skill library lives inside it");
			const { entries, categories } = await loadIndex(skills);
			return {
				root: skills.root,
				categories,
				total: entries.length,
				skills: entries.map(({ name, category, description, internal }) => ({
					name,
					category,
					description,
					internal,
				})),
			};
		},
	},
	{
		name: "strix_load_skills",
		description:
			"Load the full Markdown of one or more skills, by name or category/name. Load the skills that match the target before testing: they carry the technique, the payloads and the false-positive rules for that class of issue.",
		inputSchema: {
			type: "object",
			properties: { names: { type: "array", items: { type: "string" }, minItems: 1 } },
			required: ["names"],
			additionalProperties: false,
		},
		handler: async (args) => {
			const skills = await locateSkills();
			if (!skills) throw new Error("strix-agent is not installed; the skill library lives inside it");
			return loadBodies(skills, (args.names as string[] | undefined) ?? []);
		},
	},
	{
		name: "strix_file_finding",
		description:
			"Record a confirmed vulnerability. File one only with evidence you actually produced - a request/response, a payload and its effect, or a code path. Include cvss and cwe when you know them, and put the reproduction in `poc`.",
		inputSchema: {
			type: "object",
			properties: {
				title: { type: "string" },
				severity: { type: "string", enum: [...findings.SEVERITIES] },
				target: { type: "string" },
				description: { type: "string" },
				impact: { type: "string" },
				technicalAnalysis: { type: "string" },
				poc: { type: "string" },
				evidence: { type: "string" },
				remediation: { type: "string" },
				cvss: { type: "number" },
				cwe: { type: "string" },
				cve: { type: "string" },
				confidence: { type: "string", enum: ["high", "medium", "low"] },
			},
			required: ["title", "severity"],
			additionalProperties: false,
		},
		handler: (args) => findings.add(sessionId(), args),
	},
	{
		name: "strix_list_findings",
		description: "Findings filed so far, ordered by severity, with a per-severity tally.",
		inputSchema: {
			type: "object",
			properties: { severity: { type: "string", enum: [...findings.SEVERITIES] } },
			additionalProperties: false,
		},
		handler: (args) => findings.list(sessionId(), args),
	},
	{
		name: "strix_report",
		description: "Render the Markdown penetration-test report from the findings filed so far.",
		inputSchema: {
			type: "object",
			properties: { targets: { type: "array", items: { type: "string" } } },
			additionalProperties: false,
		},
		handler: (args) => findings.report(sessionId(), args),
	},
];

/** Findings are keyed by the sandbox session, so one assessment has one ledger. */
function sessionId(): string {
	return sandbox.status().sessionId ?? "default";
}

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
			const [env, list] = await Promise.all([
				environment().catch((error) => ({ error: String(error) })),
				findings.list(sessionId()).catch(() => ({ count: 0, bySeverity: {}, findings: [] })),
			]);
			return json(res, 200, {
				environment: env,
				sandbox: sandbox.status(),
				findings: (list as { findings?: unknown }).findings ?? [],
				logTail: log.slice(-40),
			});
		}
		if (url.pathname === "/api/report") {
			return json(res, 200, await findings.report(sessionId(), {}));
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
