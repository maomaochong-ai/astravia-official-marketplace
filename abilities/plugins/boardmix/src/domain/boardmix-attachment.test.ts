import { describe, expect, it } from "vitest";
import { ATTACHMENT_ID, ATTACHMENT_SCHEMA, boardmixAttachmentFor } from "./boardmix-attachment";

const panel = (over: Partial<{ active: boolean; ready: boolean; landedUrl: string | null }> = {}) => ({
	active: false,
	ready: false,
	landedUrl: null,
	...over,
});

describe("boardmixAttachmentFor", () => {
	it("hangs nothing when neither the toggle nor the tab says we are on this board", () => {
		expect(boardmixAttachmentFor({ engaged: false, panel: panel(), label: "白板" })).toBeNull();
	});

	it("hangs the chip as soon as the tab is the one the user is looking at", () => {
		const attachment = boardmixAttachmentFor({
			engaged: false,
			panel: panel({ active: true, ready: true, landedUrl: "https://boardmix.cn/app/" }),
			label: "Boardmix 白板",
		});
		expect(attachment?.id).toBe(ATTACHMENT_ID);
		expect(attachment?.label).toBe("Boardmix 白板");
		expect(attachment?.context.payload).toMatchObject({
			panel: "boardmix",
			phase: "ready",
			landedUrl: "https://boardmix.cn/app/",
			engaged: false,
			canRead: false,
		});
	});

	it("hangs it for the toggle alone, so clicking the button puts the plugin in the composer", () => {
		const attachment = boardmixAttachmentFor({ engaged: true, panel: panel(), label: "白板" });
		expect(attachment).not.toBeNull();
		expect(attachment?.context.payload.phase).toBe("loading");
		expect(attachment?.context.payload.engaged).toBe(true);
	});

	it("never claims the canvas is readable", () => {
		for (const engaged of [true, false]) {
			for (const active of [true, false]) {
				const attachment = boardmixAttachmentFor({ engaged, panel: panel({ active }), label: "白板" });
				if (attachment) expect(attachment.context.payload.canRead).toBe(false);
			}
		}
	});

	it("falls back to a readable label instead of an empty chip", () => {
		expect(boardmixAttachmentFor({ engaged: true, panel: panel(), label: "   " })?.label).toBe("Boardmix");
	});

	it("keeps a stable id and schema so the host can replace its own copy", () => {
		const first = boardmixAttachmentFor({ engaged: true, panel: panel(), label: "白板" });
		const again = boardmixAttachmentFor({ engaged: true, panel: panel({ active: true }), label: "白板" });
		expect(again?.id).toBe(first?.id);
		expect(again?.context.schema).toBe(ATTACHMENT_SCHEMA);
	});
});
