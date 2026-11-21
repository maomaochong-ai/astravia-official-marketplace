import type { PluginContext } from "@astravia-org/plugin-sdk";
import { buildLogoPrompt } from "./logo-prompt";
import type { LogoSpec } from "../spec";

/**
 * Optional AI marks, through the **host's** media providers.
 *
 * There is no API key here and no HTTP client: the user has already configured
 * image models in Astravia, and `ctx.media` is the supported way to spend them.
 * Reaching for a provider SDK directly would mean a second credential store, a
 * second network egress path and a second billing relationship for a feature that
 * is already installed.
 *
 * Everything in this module needs the single `media.generate` permission — the
 * host gates `listProviders`, `submit`, and `artifacts.persist` on it.
 */

export interface HostImageProvider {
	/** Host-qualified provider id, used verbatim in the submit request. */
	id: string;
	displayName: string;
	/** First model that can do text-to-image, when the provider publishes a catalog. */
	modelId?: string;
}

export interface HostImageResult {
	/** Plugin blob holding the generated PNG. */
	blobId: string;
	prompt: string;
	providerId: string;
	modelId?: string;
}

export class HostMediaError extends Error {
	constructor(
		message: string,
		readonly code?: string,
	) {
		super(message);
		this.name = "HostMediaError";
	}
}

/** Human-readable text for each host error code we can actually receive. */
const ERROR_TEXT: Record<string, string> = {
	unauthenticated: "The image provider is not signed in. Sign in to it in Astravia's settings first.",
	"provider-unavailable": "No image provider is available right now. Add one in Astravia's settings.",
	"operation-unsupported": "The selected provider cannot generate images from text.",
	"invalid-request": "The image request was rejected as invalid. Try a shorter brief.",
	"not-entitled": "This account is not entitled to the selected image model.",
	"quota-exhausted": "The image quota for this account is used up.",
	"content-rejected": "The provider rejected this prompt. Reword the brief and try again.",
	"provider-timeout": "The image provider timed out. Try again, or with fewer variations.",
	"provider-failed": "The image provider failed to produce an image.",
	cancelled: "The generation was cancelled.",
};

function describeCode(code: string | undefined, fallback: string): string {
	return (code && ERROR_TEXT[code]) || fallback;
}

function hasTextToImage(provider: { capabilities: readonly { operation: string; kind?: string; modes?: readonly string[] }[] }): boolean {
	return provider.capabilities.some(
		(capability) =>
			capability.operation === "generate" &&
			capability.kind === "image" &&
			// The host's own provider advertises `modes: ["text-to-image","image-to-image"]`
			// and no `models` array (`astravia-image-provider.ts`). A capability that omits
			// `modes` entirely still means "can generate an image", so accept it too.
			((capability.modes ?? []).includes("text-to-image") || (capability.modes ?? []).length === 0),
	);
}

function firstTextToImageModel(provider: {
	capabilities: readonly { operation: string; kind?: string; models?: readonly { id: string; modes: readonly string[] }[] }[];
}): string | undefined {
	for (const capability of provider.capabilities) {
		if (capability.operation !== "generate" || capability.kind !== "image") continue;
		const model = capability.models?.find((entry) => entry.modes.includes("text-to-image"));
		if (model) return model.id;
	}
	return undefined;
}

/**
 * `media.generate` must be declared **and** granted, and an upgrade never grants a
 * permission the previous version did not have (`plugin-catalog.ts` keeps the old
 * grant list; `plugin-catalog-install.test.ts` pins that behaviour). An install that
 * updates into the version which first asked for it therefore lands here, and the
 * only useful thing to report is where to fix it.
 */
const PERMISSION_DENIED = "permission-denied";

function isPermissionDenied(cause: unknown): boolean {
	return cause instanceof Error && /permission denied/i.test(cause.message);
}

/** Providers the user has already connected that can do text-to-image. */
export async function listImageProviders(ctx: PluginContext): Promise<HostImageProvider[]> {
	let providers: Awaited<ReturnType<PluginContext["media"]["listProviders"]>>;
	try {
		providers = await ctx.media.listProviders();
	} catch (cause) {
		if (isPermissionDenied(cause)) {
			throw new HostMediaError(
				"The image permission is not granted to this plugin yet. Re-authorise it in Settings → Abilities → Plugins.",
				PERMISSION_DENIED,
			);
		}
		throw cause;
	}
	return providers
		.filter((provider) => hasTextToImage(provider))
		.map((provider) => ({
			id: provider.id,
			displayName: provider.displayName ?? provider.id,
			modelId: firstTextToImageModel(provider),
		}));
}

export interface HostGenerationRequest {
	spec: LogoSpec;
	/** 1–8; each one is a separate job so a partial failure still yields images. */
	count: number;
	/** Omit to use the first provider that can do text-to-image. */
	providerId?: string;
}

/**
 * Generate `count` marks as text-to-image jobs and persist each result into this
 * plugin's blob storage.
 *
 * Partial success is preserved on purpose: a 3-image run where the second job
 * fails returns the two that worked and names the failure, instead of throwing
 * away work the user already paid for.
 */
export async function generateMarksWithHost(ctx: PluginContext, request: HostGenerationRequest): Promise<{ images: HostImageResult[]; failures: string[] }> {
	const providers = await listImageProviders(ctx);
	if (providers.length === 0) {
		throw new HostMediaError(
			describeCode("provider-unavailable", "No image provider is available"),
			"provider-unavailable",
		);
	}
	const provider = request.providerId ? providers.find((entry) => entry.id === request.providerId) : providers[0];
	if (!provider) {
		throw new HostMediaError("The selected image provider is no longer available.", "provider-unavailable");
	}

	const prompt = buildLogoPrompt(request.spec);
	const images: HostImageResult[] = [];
	const failures: string[] = [];

	for (let index = 0; index < Math.max(1, Math.min(8, request.count)); index += 1) {
		try {
			const job = await ctx.media.submit({
				operation: "generate",
				providerId: provider.id,
				kind: "image",
				mode: "text-to-image",
				prompt,
				...(provider.modelId ? { modelId: provider.modelId } : {}),
				dimensions: { width: 1024, height: 1024 },
			});

			// A provider may refuse synchronously (bad prompt, not signed in). Waiting on a
			// job that is already failed only adds a round trip.
			if (job.status === "failed") {
				failures.push(describeCode(job.error?.code, job.error?.message ?? "The image job was rejected."));
				continue;
			}

			const settled = await ctx.jobs.wait(job);
			if (settled.status !== "succeeded") {
				failures.push(describeCode(settled.error?.code, settled.error?.message ?? "The image job did not finish."));
				continue;
			}

			const artifact = settled.artifacts[0];
			if (!artifact) {
				failures.push("The image job finished without producing a file.");
				continue;
			}

			const persisted = await ctx.artifacts.persist(artifact, { type: "plugin-blob" });
			if (persisted.type !== "plugin-blob") {
				failures.push("The generated image could not be stored on this device.");
				continue;
			}
			images.push({ blobId: persisted.blobId, prompt, providerId: provider.id, modelId: provider.modelId });
		} catch (cause) {
			failures.push(cause instanceof Error ? cause.message : String(cause));
		}
	}

	if (images.length === 0 && failures.length > 0) {
		throw new HostMediaError(failures[0]);
	}
	return { images, failures };
}
