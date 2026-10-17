/**
 * Host-mediated HTTP client.
 *
 * `ctx.network.request` executes in the main process: no renderer CORS, per-hop
 * redirect validation, 32 MiB cap, 300 s ceiling. The domain layer only sees the
 * small `HttpClient` contract, which keeps the crawl engine testable.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import { HttpTransportError, type HttpClient, type HttpRequestInit, type HttpResponse } from "../domain/scrape/http";

const encoder = new TextEncoder();

export function createHostHttpClient(ctx: PluginContext): HttpClient {
	return async (init: HttpRequestInit): Promise<HttpResponse> => {
		const startedAt = Date.now();
		try {
			const response = await ctx.network.request<unknown>({
				url: init.url,
				method: "GET",
				headers: init.headers,
				timeoutMs: init.timeoutMs,
				responseType: "text",
			});
			const body = typeof response.body === "string" ? response.body : JSON.stringify(response.body ?? "");
			return {
				url: init.url,
				status: response.status,
				ok: response.ok,
				headers: response.headers ?? {},
				body,
				durationMs: Date.now() - startedAt,
				bytes: encoder.encode(body).length,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const reason = /timed out|timeout/i.test(message)
				? "timed-out"
				: /not allowed|host/i.test(message)
					? "host-not-allowed"
					: /too large|32 ?MiB/i.test(message)
						? "response-too-large"
						: "transport-failed";
			throw new HttpTransportError(message, reason);
		}
	};
}
