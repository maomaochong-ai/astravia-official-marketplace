/**
 * The tool catalogue, in one place.
 *
 * One agent sees these tools: the host conversation, over this plugin's MCP server. The
 * console tab does not have a model of its own — it renders what that agent does — so the
 * catalogue describes the MCP surface and nothing else. Names, descriptions and JSON
 * schemas are shared with the service, which attaches a handler to each by name; the two
 * lists used to be written twice, which is how a description drifts from its tool.
 *
 * Grouping follows upstream `strix/tools/`: sandbox, skills, findings and report, then
 * the working surfaces a pentester needs (notes, todos, coverage, threat model, browser).
 */

import type { PluginAiChatTool } from "@astravia-org/plugin-sdk";

const OBJECT = { type: "object", additionalProperties: false } as const;

export const SEVERITY_ENUM = ["critical", "high", "medium", "low", "info"] as const;
export const TODO_STATUSES = ["pending", "in_progress", "done"] as const;
export const TODO_PRIORITIES = ["low", "normal", "high", "critical"] as const;

export interface StrixToolSpec extends PluginAiChatTool {
	/** Tools the sandbox service answers; everything else is handled in the plugin. */
	handler: "service" | "plugin";
}

export const STRIX_TOOL_SPECS: readonly StrixToolSpec[] = [
	// ---- sandbox -------------------------------------------------------------
	{
		handler: "service",
		name: "strix_environment",
		description:
			"Check whether this machine can run Strix tooling: the execution environment (docker or the user's session), the skill library, and in host mode which of the tools are actually installed. Call it when a sandbox call failed and you want to know why, or before planning a step that needs a specific tool.",
		parameters: { ...OBJECT, properties: {} },
	},
	{
		handler: "service",
		name: "strix_mcp",
		description:
			"The MCP connections this run has: one row per server with provider, tool count and whether it is dead. Check it when a tool you expect is missing — a dead connection looks exactly like the model forgetting its tools.",
		parameters: { ...OBJECT, properties: {} },
	},
	{
		handler: "service",
		name: "strix_sandbox_start",
		description:
			"Start the Strix sandbox container for this assessment. It carries the pentest toolchain: nmap, nuclei, ffuf, sqlmap, subfinder, naabu, Caido, agent-browser + chromium, trivy, gitleaks, trufflehog, jwt_tool. Local directories are mounted at /workspace/<name>. Start one session and keep using it.",
		parameters: {
			type: "object",
			properties: {
				mode: {
					type: "string",
					enum: ["quick", "standard", "deep", "diff"],
					description:
						"How deep to go. quick: bounded first pass, short timeouts, breadth over depth. " +
						"standard: the default full sweep. deep: standard plus a coverage gate before finishing. " +
						"diff: only the changes in the mounted repository. Fixed for the life of the session.",
				},
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
			},
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_exec",
		description:
			"Run a shell command inside the sandbox and return stdout, stderr and the exit code. Use it to drive the bundled toolchain, write scripts under /workspace and read their output. Commands are capped at 10 minutes. Pass background: true for anything long-running (a full nmap sweep, a fuzzer, msfconsole): it returns a sessionId immediately and you read or talk to it with strix_shell_sessions / strix_write_stdin. Pass tty: true when the program is interactive and needs a terminal.",
		parameters: {
			type: "object",
			properties: {
				command: { type: "string", description: "Shell command, run with `sh -c`." },
				workdir: { type: "string", description: "Working directory inside the sandbox, e.g. /workspace/repo." },
				timeoutSec: { type: "number" },
				background: {
					type: "boolean",
					description: "Leave the command running and return its sessionId instead of waiting for the exit code.",
				},
				tty: {
					type: "boolean",
					description: "Allocate a terminal (background sessions only). Needed for REPLs, ssh, nc and Ctrl-C.",
				},
			},
			required: ["command"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_sandbox_status",
		description: "Current sandbox session: running, its targets, image and uptime.",
		parameters: { ...OBJECT, properties: {} },
	},
	{
		handler: "service",
		name: "strix_sandbox_stop",
		description: "Stop and remove the sandbox container. Call it when the assessment is finished.",
		parameters: { ...OBJECT, properties: {} },
	},
	{
		handler: "service",
		name: "strix_proxy",
		description:
			"Query the assessment's Caido proxy: captured requests, one request in full, its sitemap, scope rules, or replay a request with modifications. Only available in a docker session that was started with proxy: true; it can make requests to any URL, so it stays off until the user enables it.",
		parameters: {
			type: "object",
			properties: {
				action: {
					type: "string",
					enum: ["list_requests", "view_request", "repeat_request", "list_sitemap", "view_sitemap_entry", "scope_rules"],
					description:
						"list_requests: what the proxy captured (filter with httpql_filter). view_request: one request/response by id. " +
						"repeat_request: resend with optional modifications. list_sitemap / view_sitemap_entry: the discovered tree. scope_rules: the in-scope rules.",
				},
				httpql_filter: { type: "string", description: "HTTPQL expression, e.g. `resp.code.eq:200 AND req.path.cont:\"/api\"`." },
				request_id: { type: "string", description: "Request id for view_request / repeat_request." },
				entry_id: { type: "string", description: "Sitemap entry id for view_sitemap_entry." },
				scope_id: { type: "string", description: "Restrict to one scope." },
				parent_id: { type: "string", description: "Sitemap parent node id." },
				depth: { type: "string", enum: ["DIRECT", "ALL"], description: "Sitemap depth. Defaults to DIRECT." },
				page: { type: "number", description: "Sitemap page, 1-based." },
				first: { type: "number", description: "How many requests to return (list_requests)." },
				part: { type: "string", enum: ["request", "response"], description: "Which side of view_request to read." },
				modifications: { type: "object", description: "repeat_request changes: method, path, headers, body." },
				scope: { type: "object", description: "scope_rules payload for create / update." },
			},
			required: ["action"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_browser",
		description:
			"Drive the sandbox's headless browser (agent-browser + chromium) with one command: open a URL, click or type on a selector, read the page text, take a screenshot, or run a script. Use it for pages that need a real browser - SPA routes, authenticated flows, canvas UIs - instead of curl.",
		parameters: {
			type: "object",
			properties: {
				action: {
					type: "string",
					enum: ["open", "click", "type", "text", "html", "screenshot", "eval", "back", "close"],
					description: "What to do. `open` navigates, the rest act on the current page.",
				},
				target: { type: "string", description: "URL for `open`, CSS/text selector for `click`/`type`." },
				text: { type: "string", description: "Text for `type`; JavaScript source for `eval`." },
				timeoutSec: { type: "number" },
			},
			required: ["action"],
			additionalProperties: false,
		},
	},

	// ---- skills --------------------------------------------------------------
	{
		handler: "service",
		name: "strix_list_skills",
		description:
			"List Strix's security knowledge packs, from the installed engine. Each entry has a name, a category and a one-line description.",
		parameters: { ...OBJECT, properties: {} },
	},
	{
		handler: "service",
		name: "strix_load_skills",
		description:
			"Load the full Markdown of one or more skills, by name or category/name. Load the packs that match the target before testing: they carry the technique, the payloads and the false-positive rules for that class of issue.",
		parameters: {
			type: "object",
			properties: { names: { type: "array", items: { type: "string" }, minItems: 1 } },
			required: ["names"],
			additionalProperties: false,
		},
	},

	// ---- findings and report -------------------------------------------------
	{
		handler: "service",
		name: "strix_file_finding",
		description:
			"Record a confirmed vulnerability. File one only with evidence you actually produced - a request/response, a payload and its effect, or a code path. Include cvss and cwe when you know them, and put the reproduction in `poc`.",
		parameters: {
			type: "object",
			properties: {
				title: { type: "string" },
				severity: { type: "string", enum: [...SEVERITY_ENUM] },
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
				codeLocations: {
					type: "array",
					description: "Files and line ranges that carry the defect, for a white-box finding.",
					items: {
						type: "object",
						properties: { file: { type: "string" }, startLine: { type: "number" }, endLine: { type: "number" } },
						required: ["file"],
						additionalProperties: false,
					},
				},
			},
			required: ["title", "severity"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_update_finding",
		description:
			"Revise a finding you filed: raise or lower the severity after further proof, correct the analysis, or add the evidence that confirmed it. Match it by id from strix_list_findings, or by exact title.",
		parameters: {
			type: "object",
			properties: {
				id: { type: "string" },
				title: { type: "string", description: "Exact title, when the id is unknown." },
				severity: { type: "string", enum: [...SEVERITY_ENUM] },
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
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_list_findings",
		description: "Findings filed so far, ordered by severity, with a per-severity tally.",
		parameters: {
			type: "object",
			properties: { severity: { type: "string", enum: [...SEVERITY_ENUM] } },
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_merge_findings",
		description:
			"Collapse one finding into another when they are the same root cause at the same sink. The duplicate disappears; its evidence, and the higher severity, are kept on the survivor. Report the reason in one line.",
		parameters: {
			type: "object",
			properties: {
				id: { type: "string", description: "Id of the duplicate to fold away." },
				into: { type: "string", description: "Id of the finding to keep." },
				reason: { type: "string", description: "Why they are the same issue, e.g. same sink, different payload." },
			},
			required: ["id", "into"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_report",
		description:
			"Render the penetration-test report from the findings filed so far. `format: sarif` writes the same findings as SARIF 2.1.0 for a CI pipeline; the Markdown report is the default.",
		parameters: {
			type: "object",
			properties: {
				targets: { type: "array", items: { type: "string" } },
				executiveSummary: { type: "string", description: "Optional opening paragraph for the Markdown report." },
				format: { type: "string", enum: ["markdown", "sarif"] },
			},
			additionalProperties: false,
		},
	},

	// ---- working surfaces ----------------------------------------------------
	{
		handler: "service",
		name: "strix_note_create",
		description:
			"Keep a note for this assessment: a payload that worked, an endpoint map, a lead you have not finished. Notes survive turns and are visible to every agent in the assessment.",
		parameters: {
			type: "object",
			properties: {
				title: { type: "string" },
				content: { type: "string" },
				category: { type: "string", description: "e.g. recon, auth, payload, lead." },
			},
			required: ["title", "content"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_note_list",
		description: "List the assessment's notes: id, title, category and a one-line preview.",
		parameters: {
			type: "object",
			properties: { category: { type: "string" } },
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_note_get",
		description: "Read one note in full by its id.",
		parameters: {
			type: "object",
			properties: { id: { type: "string" } },
			required: ["id"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_note_update",
		description: "Append to or rewrite a note by id.",
		parameters: {
			type: "object",
			properties: { id: { type: "string" }, title: { type: "string" }, content: { type: "string" } },
			required: ["id"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_note_delete",
		description: "Delete a note by id.",
		parameters: {
			type: "object",
			properties: { id: { type: "string" } },
			required: ["id"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_todo_create",
		description:
			"Plan the assessment as todos. One todo per test you intend to run; keep them short and check them off as you go, so a long scan stays legible.",
		parameters: {
			type: "object",
			properties: {
				todos: {
					type: "array",
					minItems: 1,
					items: {
						type: "object",
						properties: {
							title: { type: "string" },
							priority: { type: "string", enum: [...TODO_PRIORITIES] },
						},
						required: ["title"],
						additionalProperties: false,
					},
				},
			},
			required: ["todos"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_todo_update",
		description: "Move one or more todos to a status (pending, in_progress, done).",
		parameters: {
			type: "object",
			properties: {
				ids: { type: "array", items: { type: "string" }, minItems: 1 },
				status: { type: "string", enum: [...TODO_STATUSES] },
			},
			required: ["ids", "status"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_todo_list",
		description: "The current todo list, grouped the way the panel shows it.",
		parameters: { ...OBJECT, properties: {} },
	},
	{
		handler: "service",
		name: "strix_todo_remove",
		description:
			"Drop plan items that no longer apply (a route turned out unreachable, a hypothesis was wrong). Deleting is honest; marking it done would claim work that never happened. Pair with strix_todo_list to get ids.",
		parameters: {
			type: "object",
			properties: { ids: { type: "array", items: { type: "string" } } },
			required: ["ids"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_coverage_record",
		description:
			"Record an attack surface you tested and what came of it. Honest coverage matters more than a long list: `clean` for tested-and-nothing, `vulnerable` when a finding came out of it, `skipped` with a reason when you could not test it.",
		parameters: {
			type: "object",
			properties: {
				surface: { type: "string", description: "e.g. GET /api/orders, auth flow, file upload, admin UI." },
				outcome: { type: "string", enum: ["vulnerable", "clean", "skipped"] },
				technique: { type: "string", description: "What you did: the class of test and the tool." },
				evidence: { type: "string" },
				note: { type: "string" },
			},
			required: ["surface", "outcome"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_coverage_list",
		description: "Everything recorded so far, with counts by outcome.",
		parameters: {
			type: "object",
			properties: { outcome: { type: "string", enum: ["vulnerable", "clean", "skipped"] } },
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_coverage_update",
		description:
			"Correct an existing coverage entry. An outcome written before you knew better (`clean`, then an IDOR turns up on that surface) must be replaced, not duplicated — two contradicting rows make the report unreadable. Get ids from strix_coverage_list.",
		parameters: {
			type: "object",
			properties: {
				id: { type: "string" },
				outcome: { type: "string", enum: ["vulnerable", "clean", "skipped"] },
				surface: { type: "string" },
				technique: { type: "string" },
				evidence: { type: "string" },
				note: { type: "string" },
			},
			required: ["id"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_threat_model",
		description:
			"Write or read this assessment's threat model: assets, entry points, trust boundaries and the scenarios you mean to test. Call it with no arguments to read the current one, or with `content` to replace it.",
		parameters: {
			type: "object",
			properties: {
				content: { type: "string", description: "Full Markdown threat model." },
				targets: { type: "array", items: { type: "string" } },
			},
			additionalProperties: false,
		},
	},

	// ---- kept shell sessions (upstream: exec_command background/tty + write_stdin) ----
	{
		handler: "service",
		name: "strix_shell_sessions",
		description:
			"List the shell sessions you left running (started with strix_exec background: true): id, command, uptime, whether it is still alive and its recent output. Read this before starting another long scan so you do not end up with three nmap runs on one target.",
		parameters: {
			type: "object",
			properties: { sessionId: { type: "string", description: "Return one session instead of all of them." } },
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_write_stdin",
		description:
			"Send input to a running session. Use it to answer an interactive prompt, drive a REPL (python3, msfconsole), or send Ctrl-C as \"\\u0003\" to stop a scan without killing the session. Only works while the process is alive.",
		parameters: {
			type: "object",
			properties: {
				sessionId: { type: "string" },
				chars: { type: "string", description: "Exact characters, e.g. \"n\\n\" or \"\\u0003\" for Ctrl-C." },
			},
			required: ["sessionId", "chars"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_kill_session",
		description: "Stop a running session (SIGTERM, then SIGKILL). Output up to that point stays readable.",
		parameters: {
			type: "object",
			properties: { sessionId: { type: "string" } },
			required: ["sessionId"],
			additionalProperties: false,
		},
	},

	// ---- files (upstream: patch + view_image) -------------------------------
	{
		handler: "service",
		name: "strix_patch",
		description:
			"Edit files in the sandbox with a patch instead of a shell heredoc: quotes, backslashes and $ signs survive verbatim, and the change is reviewable. Format: *** Begin Patch / *** Add File: path (+lines) / *** Update File: path (@@ optional anchor, -old, +new) / *** Delete File: path / *** End Patch. Prefer this over strix_exec for writing exploits, PoCs and notes to /workspace.",
		parameters: {
			type: "object",
			properties: { patch: { type: "string", description: "The whole patch document, including *** Begin Patch and *** End Patch." } },
			required: ["patch"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_view_image",
		description:
			"Look at an image file in the sandbox — typically a screenshot from agent-browser (/workspace/.agent-browser-screenshots/…) or a rendered chart. Returns the picture itself for a vision-capable model; over MCP it comes back as an image content block. Use it to verify what a page actually shows instead of inferring from HTML.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Absolute path inside the sandbox, e.g. /workspace/.agent-browser-screenshots/shot.png" },
			},
			required: ["path"],
			additionalProperties: false,
		},
	},

	// ---- reasoning + scope --------------------------------------------------
	{
		handler: "service",
		name: "strix_think",
		description:
			"Record a reasoning note with no side effects: what you know, what you suspect, what you will try next. It lands in the panel's trace so the operator can follow a decision that was not obvious. Not an output channel — write conclusions as plain text.",
		parameters: {
			type: "object",
			properties: { thought: { type: "string" } },
			required: ["thought"],
			additionalProperties: false,
		},
	},
	{
		handler: "service",
		name: "strix_scope",
		description:
			"Declare, read or change what this assessment is allowed to touch. Call with no action to read the current scope; action=add with targets to declare hosts; action=remove to drop them; action=rules to record agreed boundaries (ports, hours, forbidden techniques). The scope is printed in the report, and strix_exec warns when a command names a host outside it — the warning is advisory, the boundary is still yours to hold.",
		parameters: {
			type: "object",
			properties: {
				action: { type: "string", enum: ["add", "remove", "rules"] },
				targets: { type: "array", items: { type: "string" }, description: "Hosts, URLs, IPs or CIDRs to declare." },
				kind: { type: "string", enum: ["domain", "ip", "cidr", "url"] },
				note: { type: "string" },
				ids: { type: "array", items: { type: "string" }, description: "Scope entry ids to remove." },
				ports: { type: "array", items: { type: "string" } },
				notes: { type: "array", items: { type: "string" }, description: "Agreed boundaries: rate limits, windows, off-limits techniques." },
			},
			additionalProperties: false,
		},
	},
];

/**
 * The service-side subset, by name, for the MCP and `/api/tool` surfaces.
 *
 * There is no plugin-side subset any more: the loop that used to answer `strix_think`,
 * `strix_ask_user` and `strix_finish` was this plugin hosting a second agent, and it was
 * removed in favour of the host conversation calling these tools over MCP.
 */

/** The service-side subset, by name, for the MCP and `/api/tool` surfaces. */
export const SERVICE_TOOL_NAMES: readonly string[] = STRIX_TOOL_SPECS.filter((tool) => tool.handler === "service").map(
	(tool) => tool.name,
);

