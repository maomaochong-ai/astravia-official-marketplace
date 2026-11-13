import { describe, expect, it } from "vitest";
import {
	asProxyAction,
	parseProxyOutput,
	PROXY_ACTIONS,
	PROXY_ARGUMENTS,
	proxyCommand,
	proxyPayload,
	proxyScript,
	proxyUnavailable,
} from "../service/proxy";

/**
 * The proxy surface delegates to upstream's `caido_api` inside the container. What can
 * be asserted without a container is the contract around it: which actions exist, that
 * only their own arguments are forwarded, that the generated program survives shell
 * quoting, and that output parsing tolerates import noise.
 */
describe("proxy surface", () => {
	it("accepts only the actions upstream exposes", () => {
		expect(asProxyAction("list_requests")).toBe("list_requests");
		expect(asProxyAction("drop-table")).toBeUndefined();
		for (const action of PROXY_ACTIONS) expect(PROXY_ARGUMENTS[action].length).toBeGreaterThan(0);
	});

	it("forwards only the arguments an action declares", () => {
		expect(
			proxyPayload("view_request", {
				request_id: "r1",
				part: "response",
				// Belongs to other actions; must not reach the call.
				httpql_filter: "resp.code.eq:200",
				page: 3,
			}),
		).toEqual({ action: "view_request", request_id: "r1", part: "response" });
	});

	it("drops null and undefined instead of sending them", () => {
		expect(proxyPayload("list_sitemap", { scope_id: null, page: 2, depth: undefined })).toEqual({
			action: "list_sitemap",
			page: 2,
		});
	});

	it("never emits a bare quote that would end the shell argument early", () => {
		expect(proxyScript()).not.toContain("'");
		const command = proxyCommand("list_requests", { httpql_filter: "req.path.cont:'/api'" });
		// Escaped payload, so the wrapper quotes stay balanced.
		expect([...command].filter((character) => character === "'").length % 2).toBe(0);
	});

	it("parses the last JSON line and ignores noise before it", () => {
		const parsed = parseProxyOutput({ code: 0, stdout: "warning: something\n{\"requests\":[]}\n", stderr: "" });
		expect(parsed.ok).toBe(true);
		expect(parsed.data).toEqual({ requests: [] });
	});

	it("reports stderr as the error when the call failed", () => {
		const parsed = parseProxyOutput({ code: 1, stdout: "", stderr: "Traceback: caido not reachable" });
		expect(parsed.ok).toBe(false);
		expect(parsed.error).toContain("caido not reachable");
	});

	it("says why the surface is unavailable in each case", () => {
		expect(proxyUnavailable("no-container")).toContain("docker mode");
		expect(proxyUnavailable("not-enabled")).toContain("proxy: true");
		expect(proxyUnavailable("not-installed")).toContain("caido_api");
	});
});
