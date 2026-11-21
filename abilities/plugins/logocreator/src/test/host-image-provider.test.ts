// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { generateMarksWithHost } from "../domain/ai/host-media";
import { normalizeSpec } from "../domain/spec";

/**
 * The host's own image provider, as it really advertises itself.
 *
 * `apps/desktop/src/main/media-generation/astravia-image-provider.ts` registers
 * `desktop-app:astravia` with `capabilities: [{ operation: "generate", kind: "image",
 * modes: ["text-to-image","image-to-image"], aspectRatios }]` and **no `models`
 * array**. An earlier filter required a model list and rejected it, which read as
 * "no image provider" in a host that had one working.
 */

const HOST_DESCRIPTOR = {
	id: "desktop-app:astravia",
	ownerId: "desktop-app",
	protocolVersion: 1,
	capabilities: [
		{ operation: "generate", kind: "image", modes: ["text-to-image", "image-to-image"], aspectRatios: ["1:1", "2:3", "3:2"] },
	],
};

function context(overrides: { listProviders?: () => Promise<unknown[]>; submit?: () => Promise<unknown> } = {}) {
	const submit = vi.fn(overrides.submit ?? (async (_request: Record<string, unknown>) => ({ id: "job-1" })));
	const wait = vi.fn(async () => ({
		id: "job-1",
		domain: "media",
		operation: "generate",
		status: "succeeded",
		artifacts: [{ id: "a1", mimeType: "image/png", sizeBytes: 1024, lifetime: "temporary" }],
	}));
	const persist = vi.fn(async () => ({ type: "plugin-blob", blobId: "blob-7" }));
	return {
		ctx: {
			media: { listProviders: vi.fn(overrides.listProviders ?? (async () => [HOST_DESCRIPTOR])), submit },
			jobs: { wait },
			artifacts: { persist, release: vi.fn() },
		} as unknown as PluginContext,
		submit,
		persist,
	};
}

describe("the host image provider is usable", () => {
	it("accepts a descriptor that carries modes but no model list", async () => {
		const { ctx, submit } = context();
		const result = await generateMarksWithHost(ctx, { spec: normalizeSpec({ brandName: "Hootly" }), count: 1 });

		expect(result.images).toHaveLength(1);
		expect(result.images[0].blobId).toBe("blob-7");
		expect(submit).toHaveBeenCalledTimes(1);
		// No modelId is invented for a provider that does not publish models.
		const sent = submit.mock.calls[0]?.[0];
		expect(sent?.modelId).toBeUndefined();
	});

	it("accepts a capability that omits modes entirely", async () => {
		const { ctx } = context({
			listProviders: async () => [
				{ ...HOST_DESCRIPTOR, capabilities: [{ operation: "generate", kind: "image" }] },
			],
		});
		const result = await generateMarksWithHost(ctx, { spec: normalizeSpec({ brandName: "Hootly" }), count: 1 });
		expect(result.images).toHaveLength(1);
	});

	it("reports a gateway refusal as a code, not as 'no provider'", async () => {
		const { ctx, submit } = context();
		submit.mockImplementation(async () => ({
			id: "job-2",
			status: "failed",
			error: { code: "unauthorized", message: "The model service is not signed in", retryable: false },
		}));

		const failure = await generateMarksWithHost(ctx, { spec: normalizeSpec({ brandName: "X" }), count: 1 }).catch(
			(cause: unknown) => cause,
		);
		expect(failure).toBeInstanceOf(Error);
		expect((failure as Error).message).toMatch(/signed in/i);
	});
});
