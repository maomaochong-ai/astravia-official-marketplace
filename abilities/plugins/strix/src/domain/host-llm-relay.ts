/**
 * Answers the bridge's model requests with the host's own models.
 *
 * The bridge serves an OpenAI-compatible endpoint that Strix talks to; each call
 * arrives here as a job, is fulfilled with `ctx.ai.chat()` - which uses the model
 * and credential the user already configured in Astravia - and the reply is posted
 * back. Nothing about a provider key ever enters this module.
 *
 * Runs from plugin activation, not from the panel, so closing the tab while a scan
 * is going does not cut its model off.
 */

export interface RelayJob {
	id: string;
	request: {
		systemPrompt?: string;
		messages: unknown[];
		tools?: { name: string; description: string; parameters: Record<string, unknown> }[];
		temperature?: number;
		maxTokens?: number;
	};
}

export interface RelayCredentials {
	baseUrl: string;
	token: string;
	models: string[];
	default: string | null;
}

interface HostAi {
	listModels(): Promise<{ defaultModel: string | null; models: { modelKey: string; name?: string }[] }>;
	chat(request: Record<string, unknown>): Promise<unknown>;
}

function hostAi(ctx: unknown): Partial<HostAi> {
	return (ctx as { ai?: Partial<HostAi> }).ai ?? {};
}

/** Where the bridge listens and which token it expects, so the scan can reach it. */
export async function readRelayCredentials(baseUrl: string): Promise<RelayCredentials | undefined> {
	try {
		const response = await fetch(`${baseUrl}/api/relay`);
		if (!response.ok) return undefined;
		return (await response.json()) as RelayCredentials;
	} catch {
		return undefined;
	}
}

/** Tell the bridge which models the user has which one to run on. */
export async function publishHostModels(ctx: unknown, baseUrl: string): Promise<void> {
	const ai = hostAi(ctx);
	if (typeof ai.listModels !== "function") return;
	try {
		const { defaultModel, models } = await ai.listModels();
		await fetch(`${baseUrl}/api/relay/models`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				default: defaultModel ?? models[0]?.modelKey ?? null,
				models: models.map(({ modelKey, name }) => ({ modelKey, name })),
			}),
		});
	} catch (error) {
		console.warn("[strix] cannot publish host models", error);
	}
}

/**
 * Long-poll for jobs until `signal` aborts.
 *
 * Errors are reported per job: one failed call returns an error to Strix instead of
 * ending the loop, so a single provider hiccup does not strand a running scan.
 */
export async function serveModelRequests(
	ctx: unknown,
	baseUrl: string,
	signal: AbortSignal,
): Promise<void> {
	const ai = hostAi(ctx);
	if (typeof ai.chat !== "function") {
		console.warn("[strix] host does not expose ctx.ai.chat; scans cannot use host models");
		return;
	}

	while (!signal.aborted) {
		let job: RelayJob | undefined;
		try {
			const response = await fetch(`${baseUrl}/api/relay/job`, { signal });
			if (!response.ok) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				continue;
			}
			const payload = (await response.json()) as RelayJob & { idle?: boolean };
			if (payload.idle || !payload.id) continue;
			job = payload;
		} catch {
			if (signal.aborted) return;
			await new Promise((resolve) => setTimeout(resolve, 1000));
			continue;
		}

		try {
			const result = await ai.chat(job.request as Record<string, unknown>);
			await fetch(`${baseUrl}/api/relay/result`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ id: job.id, result }),
				signal,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await fetch(`${baseUrl}/api/relay/result`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ id: job.id, error: message }),
				signal,
			}).catch(() => undefined);
		}
	}
}
