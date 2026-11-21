import type { PluginNetworkApi } from "@astravia-org/plugin-sdk";
import { buildLogoPrompt } from "./logo-prompt";
import type { LogoSpec } from "../spec";

/**
 * Optional AI engine: Together AI's image endpoint with the user's own key.
 *
 * Optional matters. The plugin is fully usable with the built-in engine, so this
 * path never gates the studio; it is an extra button that needs a key, a network
 * permission and a host allow-list entry. Every failure here is translated into
 * something a person can act on rather than a status code.
 */

export const TOGETHER_ENDPOINT = "https://api.together.xyz/v1/images/generations";
export const TOGETHER_KEY_NAME = "together-api-key";

export interface AiImage {
	/** base64 PNG, no data-url prefix. */
	base64: string;
	prompt: string;
	model: string;
}

export interface AiRequest {
	apiKey: string;
	model: string;
	spec: LogoSpec;
	/** 1–8; the endpoint bills per image. */
	count: number;
	seed?: number;
}

export class AiGenerationError extends Error {
	constructor(
		message: string,
		readonly status?: number,
	) {
		super(message);
		this.name = "AiGenerationError";
	}
}

function messageFor(status: number): string {
	if (status === 401) return "Together rejected the API key. Check it, then paste it again.";
	if (status === 402) return "This Together account is out of credit.";
	if (status === 403) return "This Together account cannot use the selected image model yet.";
	if (status === 429) return "Together is rate limiting this key. Wait a moment and try again.";
	if (status >= 500) return "Together's image service is having trouble. Try again in a moment.";
	return `Together returned an unexpected response (HTTP ${status}).`;
}

interface TogetherResponse {
	data?: { b64_json?: string; url?: string }[];
	error?: { message?: string } | string;
}

export async function generateWithTogether(network: PluginNetworkApi, request: AiRequest): Promise<AiImage[]> {
	const prompt = buildLogoPrompt(request.spec);
	const response = await network.request<TogetherResponse>({
		url: TOGETHER_ENDPOINT,
		method: "POST",
		headers: {
			Authorization: `Bearer ${request.apiKey}`,
			"Content-Type": "application/json",
		},
		body: {
			type: "json",
			value: {
				model: request.model,
				prompt,
				width: 1024,
				height: 1024,
				steps: 4,
				n: Math.max(1, Math.min(8, request.count)),
				response_format: "b64_json",
				...(request.seed !== undefined ? { seed: request.seed } : {}),
			},
		},
		responseType: "json",
		timeoutMs: 120_000,
	});

	if (!response.ok) {
		const detail =
			typeof response.body?.error === "string"
				? response.body.error
				: response.body?.error?.message;
		throw new AiGenerationError(detail ? `${messageFor(response.status)} (${detail})` : messageFor(response.status), response.status);
	}

	const items = response.body?.data ?? [];
	const images = items
		.map((item) => item.b64_json)
		.filter((value): value is string => typeof value === "string" && value.length > 0)
		.map((base64) => ({ base64, prompt, model: request.model }));

	if (images.length === 0) {
		throw new AiGenerationError("Together returned no images. Try a different style or a shorter brief.");
	}
	return images;
}

/** Free-form question for the studio's "what should I ask for?" hint. */
export function promptPreview(spec: LogoSpec): string {
	return buildLogoPrompt(spec);
}
