/**
 * firecrawl_interact — drive a live browser session the caller owns.
 *
 * The session lives in Firecrawl's sandbox: `execute` runs code *there*, not on
 * this machine. There is no hidden state in the tool — `create` returns the id
 * and every later call has to pass it, so a conversation can hold several
 * sessions without the connector guessing which one is current.
 */

import { clip } from "../domain/firecrawl/documents";
import type { ToolDeps } from "./deps";
import { ToolArgumentError, readBoolean, readEnum, readNumber, readOptionalString, readString } from "./tool-arguments";

const ACTIONS = ["create", "execute", "stop"] as const;
const LANGUAGES = ["node", "python", "bash"] as const;
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_CODE_CHARS = 100_000;

function requireSessionId(input: unknown): string {
	const id = readString(input, "sessionId") ?? "";
	if (!id) throw new ToolArgumentError('"sessionId" is required (the id returned by action: "create")');
	if (!SESSION_ID.test(id)) throw new ToolArgumentError(`"sessionId" is not a valid session id: ${id}`);
	return id;
}

export function createInteractTool({ config, store }: ToolDeps) {
	return {
		id: "firecrawl_interact",
		name: "firecrawl_interact",
		label: "%tool.interact.label%",
		description: [
			"Open a browser session in Firecrawl's sandbox, run code inside it, and close it. Unlike",
			"firecrawl_scrape this keeps state across calls: log in once, then keep navigating, clicking and",
			"reading. The code runs on Firecrawl's infrastructure — never on the user's machine — and talks to",
			"the page through Playwright-style globals.",
			"",
			`action: "create" starts a session and returns its id. action: "execute" needs that sessionId plus`,
			'"code" (language node | python | bash). action: "stop" destroys it. Sessions also expire on their',
			"own TTL, so stop one when you are done rather than leaving a browser running.",
			"",
			"Use it when the page cannot be read without interaction: signing in, dismissing a modal, filling a",
			"search box, paginating a table. Do NOT use it for a plain read (firecrawl_scrape), for several",
			"pages at once (firecrawl_crawl) or for extraction (firecrawl_extract).",
			"",
			"Two limits worth stating to the user: the session is billed for its lifetime, and any credential",
			"the code types into a page leaves this conversation for Firecrawl's sandbox.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				action: {
					type: "string",
					enum: [...ACTIONS],
					description: "create a session, execute code in it, or stop it. Default create.",
				},
				sessionId: { type: "string", description: "Session id from a previous create call. Required for execute and stop." },
				code: {
					type: "string",
					description: "Code to run inside the session (execute). Node: `await page.goto(url)`. Max 100000 characters.",
				},
				language: { type: "string", enum: [...LANGUAGES], description: "Sandbox language for `code`. Default node." },
				timeoutSeconds: { type: "number", description: "Execution timeout in seconds (1-300)." },
				ttl: { type: "number", description: "Session lifetime in seconds (30-3600). Default 300." },
				activityTtl: { type: "number", description: "Destroy the session after this many idle seconds (10-3600)." },
				streamWebView: { type: "boolean", description: "Stream a live view of the browser. Default true." },
				blockAds: { type: "boolean", description: "Block ads and cookie popups. Default true." },
				profile: { type: "string", description: "Named browser profile, shared with scrapes that use the same name." },
				saveProfile: { type: "boolean", description: "Persist cookies and storage into `profile` on stop. Default true." },
				location: { type: "string", description: "Two-letter country code the session browses from." },
			},
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 360_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			const action = readEnum(input, "action", ACTIONS, "create");
			const client = await config.require();

			if (action === "create") {
				const body: Record<string, unknown> = {};
				const ttl = readNumber(input, "ttl", { min: 30, max: 3_600, def: 0 });
				if (ttl > 0) body.ttl = ttl;
				const activityTtl = readNumber(input, "activityTtl", { min: 10, max: 3_600, def: 0 });
				if (activityTtl > 0) body.activityTtl = activityTtl;
				body.streamWebView = readBoolean(input, "streamWebView", true);
				body.blockAds = readBoolean(input, "blockAds", true);
				const profile = readOptionalString(input, "profile");
				if (profile) body.profile = { name: profile, saveChanges: readBoolean(input, "saveProfile", true) };
				const location = readOptionalString(input, "location");
				if (location) body.location = { country: location.toUpperCase() };

				const session = await client.interact.create(body);
				store.note("ok", `interact  session=${session.id}`);
				return [
					`Session ready: ${session.id}`,
					session.expiresAt ? `Expires: ${session.expiresAt}` : "",
					session.liveViewUrl ? `Live view: ${session.liveViewUrl}` : "",
					session.interactiveLiveViewUrl ? `Interactive view: ${session.interactiveLiveViewUrl}` : "",
					"",
					`Call firecrawl_interact with {"action":"execute","sessionId":"${session.id}","code":"…"} to drive it.`,
					`Stop it with {"action":"stop","sessionId":"${session.id}"} when you are done.`,
				]
					.filter(Boolean)
					.join("\n");
			}

			const sessionId = requireSessionId(input);

			if (action === "stop") {
				await client.interact.stop(sessionId);
				store.note("ok", `interact  stop ${sessionId}`);
				return `Session ${sessionId} stopped.`;
			}

			const code = readString(input, "code");
			if (!code) throw new ToolArgumentError('"code" is required for action: "execute"');
			if (code.length > MAX_CODE_CHARS) throw new ToolArgumentError(`"code" is longer than ${MAX_CODE_CHARS} characters`);
			const language = readEnum(input, "language", LANGUAGES, "node");
			const body: Record<string, unknown> = { code, language };
			const timeout = readNumber(input, "timeoutSeconds", { min: 1, max: 300, def: 0 });
			if (timeout > 0) body.timeout = timeout;

			const result = await client.interact.execute(sessionId, body);
			const lines = [`session=${sessionId}  ${language}  exit=${result.exitCode ?? "n/a"}${result.killed ? "  (killed on timeout)" : ""}`];
			if (result.error) lines.push(`Error: ${result.error}`);
			if (result.stderr) lines.push("", "stderr:", clip(result.stderr, 8_000));
			if (result.stdout) lines.push("", "stdout:", clip(result.stdout, 20_000));
			if (!result.stdout && !result.stderr && !result.error) lines.push("", "(no output)");
			store.note(result.error ? "error" : "ok", `interact  execute ${sessionId}`);
			return lines.join("\n");
		},
	};
}
