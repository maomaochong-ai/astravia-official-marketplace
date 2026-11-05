import { describe, expect, it, vi } from "vitest";
import { missingPrimitives, primitivesOf } from "./boardmix-primitive";

function fakeWebview(overrides: Record<string, unknown> = {}) {
	return {
		executeJavaScript: vi.fn(async (code: string) => ({ echoed: code })),
		capturePage: vi.fn(async () => ({ toPNG: () => Buffer.from([1, 2, 3]) })),
		sendInputEvent: vi.fn(),
		...overrides,
	};
}

describe("missingPrimitives", () => {
	it("names every absent primitive instead of assuming one", () => {
		expect(missingPrimitives(null)).toEqual([
			"execute-javascript",
			"capture-page",
			"send-input-event",
		]);
		expect(missingPrimitives({ executeJavaScript: () => {} })).toEqual(["capture-page", "send-input-event"]);
		expect(missingPrimitives(fakeWebview())).toEqual([]);
	});
});

describe("primitivesOf", () => {
	it("returns nothing when even one primitive is absent", () => {
		expect(primitivesOf({ executeJavaScript: () => {}, capturePage: () => {} })).toBeNull();
	});

	it("runs code in the guest page", async () => {
		const element = fakeWebview();
		const primitives = primitivesOf(element);
		await primitives?.run("1 + 1");
		expect(element.executeJavaScript).toHaveBeenCalledWith("1 + 1");
	});

	it("returns PNG bytes as base64", async () => {
		const primitives = primitivesOf(fakeWebview());
		const base64 = await primitives?.shot();
		expect(base64).toBe(Buffer.from([1, 2, 3]).toString("base64"));
	});

	it("treats a capture with no image as no screenshot", async () => {
		const primitives = primitivesOf(fakeWebview({ capturePage: async () => null }));
		expect(await primitives?.shot()).toBeNull();
	});

	it("reports a refused input channel instead of pretending it clicked", () => {
		const primitives = primitivesOf(
			fakeWebview({
				sendInputEvent: () => {
					throw new Error("guest is gone");
				},
			}),
		);
		expect(primitives?.input([{ type: "mouseMove", x: 1, y: 1 }])).toBe(false);
	});

	it("reads the viewport in whole pixels", async () => {
		const primitives = primitivesOf(
			fakeWebview({
				executeJavaScript: async () => ({ width: 1024.6, height: 700.2 }),
			}),
		);
		expect(await primitives?.viewport()).toEqual({ width: 1025, height: 700 });
	});
});
