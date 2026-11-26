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

/**
 * "Can this host make images right now?" — answerable without throwing.
 *
 * The panel asks on mount (to decide whether to offer the image path) and the
 * catalogue tool asks before it advises the agent. Both need three outcomes, not an
 * exception: available / permission refused / no provider connected.
 */
export interface ImageAvailability {
	available: boolean;
	/** `media.generate` was refused (usually an upgrade that was never re-authorised). */
	denied: boolean;
	providers: HostImageProvider[];
	/** Sentence for the UI when nothing is usable. */
	reason?: string;
}

export async function probeImageProviders(ctx: PluginContext): Promise<ImageAvailability> {
	try {
		const providers = await listImageProviders(ctx);
		return { available: providers.length > 0, denied: false, providers };
	} catch (cause) {
		if (cause instanceof HostMediaError && cause.code === PERMISSION_DENIED) {
			return { available: false, denied: true, providers: [], reason: cause.message };
		}
		return {
			available: false,
			denied: false,
			providers: [],
			reason: cause instanceof Error ? cause.message : String(cause),
		};
	}
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
	/**
	 * Existing blob to edit instead of generating from text. This makes the card's
	 * "reuse as edit target" real: the provider runs image-to-image with the user's own
	 * image as the source, so the result stays recognisably the same mark.
	 */
	referenceBlobId?: string;
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

	// 并发跑，但不当刷屏：8 张一起打给同一个 provider 容易被限流。
	// 3 路并发把「串行 8 次往返」压到约 1/3 的墙钟时间，同时保留单张失败不影响其它张。
	const PARALLEL = 3;
	const total = Math.max(1, Math.min(8, request.count));
	const runOne = async (): Promise<void> => {
		try {
			/*
			 * `inputs` 是**必填数组**，即使文生图没有输入图。
			 *
			 * SDK 的 TS 类型写的是 `inputs?`，但宿主运行时的校验 schema 把
			 * `inputs: Type.Array(mediaInputType)` 放在 generate 分支的必填项里（与 ownerId 并列）。
			 * 省掉它就同时不匹配 generate / compose / transcode 三个分支，于是报
			 * 「Capability input validation failed: / Expected union value」—— 光看类型是看不出来的。
			 */
			const job = await ctx.media.submit({
				operation: "generate",
				providerId: provider.id,
				kind: "image",
				mode: request.referenceBlobId ? "image-to-image" : "text-to-image",
				prompt,
				...(provider.modelId ? { modelId: provider.modelId } : {}),
				dimensions: { width: 1024, height: 1024 },
				inputs: request.referenceBlobId
					? [
							{
								kind: "image" as const,
								mimeType: "image/png",
								source: { type: "plugin-blob" as const, blobId: request.referenceBlobId },
							},
						]
					: [],
			});

			// A provider may refuse synchronously (bad prompt, not signed in). Waiting on a
			// job that is already failed only adds a round trip.
			if (job.status === "failed") {
				failures.push(describeCode(job.error?.code, job.error?.message ?? "The image job was rejected."));
				return;
			}

			const settled = await ctx.jobs.wait(job);
			if (settled.status !== "succeeded") {
				failures.push(describeCode(settled.error?.code, settled.error?.message ?? "The image job did not finish."));
				return;
			}

			const artifact = settled.artifacts[0];
			if (!artifact) {
				failures.push("The image job finished without producing a file.");
				return;
			}

			const persisted = await ctx.artifacts.persist(artifact, { type: "plugin-blob" });
			if (persisted.type !== "plugin-blob") {
				failures.push("The generated image could not be stored on this device.");
				return;
			}
			images.push({ blobId: persisted.blobId, prompt, providerId: provider.id, modelId: provider.modelId });
		} catch (cause) {
			failures.push(cause instanceof Error ? cause.message : String(cause));
		}
	};

	let cursor = 0;
	const workerCount = Math.min(PARALLEL, total);
	await Promise.all(
		Array.from({ length: workerCount }, async () => {
			while (cursor < total) {
				cursor += 1;
				await runOne();
			}
		}),
	);

	if (images.length === 0 && failures.length > 0) {
		throw new HostMediaError(failures[0], "provider-failed");
	}
	return { images, failures };
}
