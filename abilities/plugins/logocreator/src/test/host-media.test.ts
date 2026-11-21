// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { generateMarksWithHost, HostMediaError, listImageProviders } from "../domain/ai/host-media";
import { normalizeSpec } from "../domain/spec";

/**
 * The AI path talks to the host's media providers, not to an HTTP endpoint.
 *
 * These fakes mirror `plugin-host-apis.ts` / `media.ts` / `jobs.ts` / `artifacts.ts`
 * closely enough to pin the contract we depend on: the permission error shape, the
 * provider filter, the job status vocabulary, and artifact persistence. They cannot
 * prove a real provider behaves — that needs a connected account — but they do
 * prove this plugin fails legibly when it does not.
 */

const spec = normalizeSpec({ brandName: "Kettle Lane", intent: "a cup for a coffee roastery" });

interface FakeOptions {
	listProviders?: () => Promise<unknown[]>;
	status?: "succeeded" | "failed";
	errorCode?: string;
	artifacts?: unknown[];
	persistType?: "plugin-blob" | "workspace-file";
	submitThrows?: unknown;
}

/** The subset of `PluginMediaGenerateRequest` this plugin actually sends. */
interface SubmittedRequest {
	operation: string;
	kind: string;
	mode: string;
	providerId: string;
	prompt: string;
	modelId?: string;
	dimensions?: { width: number; height: number };
}

function fakeContext(options: FakeOptions = {}) {
	const submit = vi.fn(async (_request: SubmittedRequest) => {
		if (options.submitThrows) throw options.submitThrows;
		return { id: "job-1" };
	});
	const wait = vi.fn(async () => ({
		id: "job-1",
		domain: "media",
		operation: "generate",
		status: options.status ?? "succeeded",
		artifacts: options.artifacts ?? [{ id: "art-1", mimeType: "image/png", sizeBytes: 1024, lifetime: "temporary" }],
		...(options.status === "failed"
			? { error: { code: options.errorCode ?? "provider-failed", message: "boom", retryable: true } }
			: {}),
	}));
	const persist = vi.fn(async () => ({ type: options.persistType ?? "plugin-blob", blobId: "blob-9" }));
	const listProviders = vi.fn(
		options.listProviders ??
			(async () => [
				{
					id: "together",
					displayName: "Together",
					ownerId: "together",
					protocolVersion: 1,
					capabilities: [
						{ operation: "generate", kind: "image", modes: ["text-to-image"], models: [{ id: "flux-schnell", modes: ["text-to-image"] }] },
					],
				},
			]),
	);
	const ctx = {
		media: { listProviders, submit },
		jobs: { wait },
		artifacts: { persist, release: vi.fn() },
	} as unknown as PluginContext;
	return { ctx, submit, wait, persist, listProviders };
}

describe("host media providers", () => {
	it("keeps only providers that can do text-to-image", async () => {
		const { ctx } = fakeContext({
			listProviders: async () => [
				{ id: "video-only", displayName: "V", ownerId: "v", protocolVersion: 1, capabilities: [{ operation: "generate", kind: "video", modes: ["text-to-video"] }] },
				{ id: "compose-only", displayName: "C", ownerId: "c", protocolVersion: 1, capabilities: [{ operation: "compose", documentMimeTypes: [], outputMimeTypes: [] }] },
				{
					id: "image",
					displayName: "I",
					ownerId: "i",
					protocolVersion: 1,
					capabilities: [{ operation: "generate", kind: "image", modes: ["text-to-image"], models: [{ id: "m1", modes: ["text-to-image"] }] }],
				},
			],
		});
		const providers = await listImageProviders(ctx);
		expect(providers.map((p) => p.id)).toEqual(["image"]);
		expect(providers[0].modelId).toBe("m1");
	});

	it("reports a missing permission as its own code, not as 'no provider'", async () => {
		// The host throws this exact string from `createPluginPermissionApi(plugin).require`.
		const { ctx } = fakeContext({
			listProviders: async () => {
				throw new Error("Plugin permission denied: media.generate");
			},
		});
		await expect(listImageProviders(ctx)).rejects.toMatchObject({
			name: "HostMediaError",
			code: "permission-denied",
		});
	});

	it("refuses early when the host has no image provider", async () => {
		const { ctx } = fakeContext({ listProviders: async () => [] });
		await expect(generateMarksWithHost(ctx, { spec, count: 3 })).rejects.toBeInstanceOf(HostMediaError);
	});

	it("submits one job per variation and persists each result", async () => {
		const { ctx, submit, persist } = fakeContext();
		const { images, failures } = await generateMarksWithHost(ctx, { spec, count: 2 });

		expect(failures).toEqual([]);
		expect(images).toHaveLength(2);
		expect(images[0]).toMatchObject({ blobId: "blob-9", providerId: "together", modelId: "flux-schnell" });
		expect(submit).toHaveBeenCalledTimes(2);
		expect(persist).toHaveBeenCalledTimes(2);
		// The prompt is the shared builder's output, and it names the brand.
		const firstRequest = submit.mock.calls[0][0];
		expect(firstRequest).toMatchObject({ operation: "generate", kind: "image", mode: "text-to-image" });
		expect(firstRequest.prompt).toContain("Kettle Lane");
	});

	it("keeps the successes when one variation fails, instead of discarding both", async () => {
		let call = 0;
		const { ctx } = fakeContext();
		// First job succeeds, second fails, third succeeds.
		(ctx.jobs.wait as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => {
			call += 1;
			return call === 2
				? { id: "job", domain: "media", operation: "generate", status: "failed", artifacts: [], error: { code: "quota-exhausted", message: "quota", retryable: false } }
				: { id: "job", domain: "media", operation: "generate", status: "succeeded", artifacts: [{ id: "a", mimeType: "image/png", sizeBytes: 1, lifetime: "temporary" }] };
		});

		const { images, failures } = await generateMarksWithHost(ctx, { spec, count: 3 });
		expect(images).toHaveLength(2);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toMatch(/quota/i);
	});

	it("surfaces the host's own message for a rejected job", async () => {
		const { ctx } = fakeContext({ status: "failed", errorCode: "content-rejected" });
		// A single failed variation becomes a thrown error (nothing was produced), and
		// the text is the mapped host code rather than a bare "provider-failed".
		const failure = await generateMarksWithHost(ctx, { spec, count: 1 }).catch((cause: unknown) => cause);
		expect(failure).toBeInstanceOf(HostMediaError);
		expect((failure as Error).message).toMatch(/rejected/i);
	});

	it("fails loudly when a job produced no artifact", async () => {
		const { ctx } = fakeContext({ artifacts: [] });
		await expect(generateMarksWithHost(ctx, { spec, count: 1 })).rejects.toThrow(/without producing a file/i);
	});

	it("fails loudly when the artifact could not be stored", async () => {
		const { ctx } = fakeContext({ persistType: "workspace-file" });
		await expect(generateMarksWithHost(ctx, { spec, count: 1 })).rejects.toThrow(/could not be stored/i);
	});

	it("never exceeds the host's per-request ceiling", async () => {
		const { ctx, submit } = fakeContext();
		await generateMarksWithHost(ctx, { spec, count: 99 });
		expect(submit).toHaveBeenCalledTimes(8);
	});
});
