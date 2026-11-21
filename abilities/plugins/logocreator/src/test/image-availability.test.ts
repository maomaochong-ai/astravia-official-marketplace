// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { probeImageProviders } from "../domain/ai/host-media";

/**
 * Auto-detection, in the three states a real host can be in.
 *
 * The panel offers the image path only when this says yes, and the catalogue tool
 * uses the same answer to tell the agent where a brief may go. Both therefore depend
 * on one function: it must never throw, and it must keep "not authorised" apart from
 * "not connected".
 */

const HOST_PROVIDER = {
	id: "desktop-app:astravia",
	ownerId: "desktop-app",
	protocolVersion: 1,
	capabilities: [{ operation: "generate", kind: "image", modes: ["text-to-image", "image-to-image"] }],
};

function ctx(listProviders: () => Promise<unknown>): PluginContext {
	return { media: { listProviders: vi.fn(listProviders) } } as unknown as PluginContext;
}

describe("probing for an image provider", () => {
	it("reports the host's own provider as available", async () => {
		const availability = await probeImageProviders(ctx(async () => [HOST_PROVIDER]));
		expect(availability).toMatchObject({ available: true, denied: false });
		expect(availability.providers[0]).toMatchObject({ id: "desktop-app:astravia" });
	});

	it("keeps a refused permission separate from a missing provider", async () => {
		// The host throws this exact wording from `createPluginPermissionApi(...).require`.
		const availability = await probeImageProviders(
			ctx(async () => {
				throw new Error("Plugin permission denied: media.generate");
			}),
		);
		expect(availability).toMatchObject({ available: false, denied: true });
		expect(String(availability.reason)).toMatch(/permission/i);
	});

	it("says 'not connected' when the host lists nothing usable", async () => {
		const availability = await probeImageProviders(ctx(async () => []));
		expect(availability).toMatchObject({ available: false, denied: false, providers: [] });
	});

	it("does not throw when the provider registry itself fails", async () => {
		const availability = await probeImageProviders(
			ctx(async () => {
				throw new Error("registry offline");
			}),
		);
		expect(availability.available).toBe(false);
		expect(String(availability.reason)).toContain("registry offline");
	});
});
