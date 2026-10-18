/**
 * Host-mediated HTTP transport.
 *
 * Requests run in the main process (`ctx.network.request`), so there is no CORS
 * and the plugin never sees raw sockets. Two body kinds are supported: JSON for
 * the REST calls, multipart for `/v2/parse` uploads.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import { TransportError, type Transport, type TransportFailure } from "../domain/firecrawl/transport";

function classify(message: string): TransportFailure {
	const lower = message.toLowerCase();
	if (lower.includes("timed out") || lower.includes("timeout")) return "timed-out";
	if (lower.includes("too large") || lower.includes("size limit") || lower.includes("payload")) return "response-too-large";
	if (lower.includes("not allowed") || lower.includes("allowlist") || lower.includes("allowedhosts") || lower.includes("host")) {
		return "host-not-allowed";
	}
	return "transport-failed";
}

function explain(reason: TransportFailure, url: string, message: string): string {
	if (reason === "host-not-allowed") {
		return `The host refused ${new URL(url).host}: add it to network.allowedHosts in plugin.json (${message}).`;
	}
	if (reason === "response-too-large") {
		return `The response from ${url} exceeded the host transfer limit: ${message}`;
	}
	return message;
}

export function createHostTransport(ctx: PluginContext): Transport {
	return async (request) => {
		try {
			const response = await ctx.network.request<string>({
				url: request.url,
				method: request.method,
				headers: request.headers,
				body: request.body,
				responseType: "text",
				timeoutMs: request.timeoutMs,
			});
			const body = typeof response.body === "string" ? response.body : JSON.stringify(response.body ?? "");
			return { status: response.status, ok: response.ok, body };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const reason = classify(message);
			throw new TransportError(explain(reason, request.url, message), reason);
		}
	};
}
