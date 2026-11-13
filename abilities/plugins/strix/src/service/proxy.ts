/**
 * The Caido proxy surface, driven through the container's own Python module.
 *
 * Upstream ships `caido_api` inside the sandbox image and its tools are thin wrappers
 * over it (`strix/tools/proxy`). Re-implementing Caido's GraphQL client here would be
 * a second client to keep in sync with a product that changes often, so this module
 * does the opposite: it builds a short Python program that imports upstream's module
 * and calls the same function, then reads back JSON.
 *
 * Two rules come from ADR strix-0002:
 *  - it only works in `docker` mode (Caido runs in the image), and
 *  - it is **off unless the session enabled it**: a tool that can make the model
 *    request any URL is an attack surface, so enabling it is a deliberate act.
 */

import type { DockerResult } from "./docker";

export const PROXY_ACTIONS = [
	"list_requests",
	"view_request",
	"repeat_request",
	"list_sitemap",
	"view_sitemap_entry",
	"scope_rules",
] as const;

export type ProxyAction = (typeof PROXY_ACTIONS)[number];

export function asProxyAction(value: unknown): ProxyAction | undefined {
	return PROXY_ACTIONS.includes(value as ProxyAction) ? (value as ProxyAction) : undefined;
}

/** Which arguments each action forwards; anything else in the call is dropped. */
export const PROXY_ARGUMENTS: Record<ProxyAction, readonly string[]> = {
	list_requests: ["httpql_filter", "first", "after", "sort_by", "sort_order", "scope_id"],
	view_request: ["request_id", "part"],
	repeat_request: ["request_id", "modifications"],
	list_sitemap: ["scope_id", "parent_id", "depth", "page", "page_size"],
	view_sitemap_entry: ["entry_id"],
	scope_rules: ["action", "scope_id", "scope"],
};

/**
 * The Python program. Single-quoted shell wrapping is why it contains no `'` at all —
 * a quote would end the `python -c '…'` argument early and silently run a fragment.
 */
export function proxyScript(): string {
	return [
		"import asyncio, json, sys",
		"import caido_api as c",
		"params = json.loads(sys.argv[1])",
		"action = params.pop(\"action\")",
		"async def main():",
		"    return await getattr(c, action)(**params)",
		"print(json.dumps(asyncio.run(main()), default=str))",
	].join("\n");
}

/**
 * The payload handed to the Python program: the action plus only the arguments that
 * action declares. Exported so the filtering can be asserted without a shell.
 */
export function proxyPayload(action: ProxyAction, args: Record<string, unknown>): Record<string, unknown> {
	const picked: Record<string, unknown> = { action };
	for (const key of PROXY_ARGUMENTS[action]) {
		const value = args[key];
		if (value === undefined || value === null) continue;
		picked[key] = value;
	}
	return picked;
}

/** The argv the container's shell sees: program, then the JSON payload. */
export function proxyCommand(action: ProxyAction, args: Record<string, unknown>): string {
	const payload = JSON.stringify(proxyPayload(action, args)).replace(/'/g, "'\\''");
	return `python -c '${proxyScript()}' '${payload}'`;
}

/**
 * Container output is the module's own JSON on the last line; anything before it is
 * import noise or warnings, which must not break parsing.
 */
export function parseProxyOutput(result: DockerResult): { ok: boolean; data?: unknown; error?: string } {
	const text = `${result.stdout || ""}`.trim();
	const lastLine = text.split(/\r?\n/).filter((line) => line.trim().length > 0).pop() ?? "";
	if (result.code === 0 && lastLine) {
		try {
			return { ok: true, data: JSON.parse(lastLine) as unknown };
		} catch {
			return { ok: true, data: lastLine };
		}
	}
	const detail = `${result.stderr || text}`.trim().split(/\r?\n/).slice(-6).join("\n");
	return {
		ok: false,
		error: detail || `proxy call exited with code ${result.code}`,
	};
}

/** Why the proxy surface is unavailable, phrased for the model to relay. */
export function proxyUnavailable(reason: "no-container" | "not-enabled" | "not-installed"): string {
	switch (reason) {
		case "no-container":
			return "the Caido proxy lives in the sandbox container: start the session in docker mode (strix_sandbox_start with proxy: true) before using proxy tools";
		case "not-enabled":
			return "proxy tools are off for this session: start the session with strix_sandbox_start({ proxy: true }) to enable them";
		default:
			return "caido_api is not importable inside this image, so the proxy surface cannot run";
	}
}
