import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginCardProps, PluginContext } from "@astravia-org/plugin-sdk";
import { __PluginI18nContext, __setPluginHostBridge } from "@astravia-org/plugin-sdk";
import { LogoImageCard } from "../features/message/logo-image-card";
import { setPluginContext } from "../plugin-context";
import { claimPendingDesignId } from "../features/canvas/pending-design";

/**
 * The card is what closes the loop the reference image plugin already closed:
 * a result appears *in the thread*, and the thread can hand it to the canvas or back
 * to the agent. Three behaviours, each of which used to be missing.
 */

const ROOT = process.cwd();
const locales = {
	en: JSON.parse(readFileSync(join(ROOT, "locales/en.json"), "utf8")),
	zh: JSON.parse(readFileSync(join(ROOT, "locales/zh.json"), "utf8")),
};
const en = locales.en as Record<string, string>;
const CWD = "C:/repo/demo";

const refs = [
	{ id: "blob-1", url: "blob:host/blob-1", mimeType: "image/png", rootId: "root-1" },
	{ id: "blob-2", url: "blob:host/blob-2", mimeType: "image/png", rootId: "root-1" },
];

function host() {
	const notify = vi.fn();
	const openActivityTab = vi.fn();
	const setActivityTabVisible = vi.fn();
	const setPromptAttachment = vi.fn();
	const previewImage = vi.fn();
	const copyImage = vi.fn(async () => undefined);
	const ctx = {
		ui: { notify, openActivityTab, setActivityTabVisible, setPromptAttachment, previewImage, copyImage },
		storage: { getBlobRef: async (id: string) => ({ id, url: `blob:host/${id}`, mimeType: "image/png" }) },
	} as unknown as PluginContext;
	return { ctx, notify, openActivityTab, setActivityTabVisible, setPromptAttachment, previewImage };
}

function props(descriptor: PluginCardProps["descriptor"], pending = false): PluginCardProps {
	return { descriptor, pending, message: { id: "m1", role: "assistant", text: "" } };
}

function renderCard(p: PluginCardProps) {
	return render(
		<__PluginI18nContext.Provider value={{ locales, defaultLocale: "en" }}>
			<LogoImageCard {...p} />
		</__PluginI18nContext.Provider>,
	);
}

beforeEach(() => {
	__setPluginHostBridge({
		useLocale: () => "en",
		useActiveConversation: () => ({ id: "s1", cwd: CWD, sessionPath: null, model: null, isStreaming: false }) as never,
		useConversationMessages: () => [],
		usePromptAttachment: () => null,
		useSidebarState: () => ({ visible: true, collapsed: false, narrow: false }),
		conversation: {} as never,
	});
});

afterEach(cleanup);

describe("the image card", () => {
	it("renders a skeleton while the tool is in flight", () => {
		const { ctx } = host();
		setPluginContext(ctx);
		const { container } = renderCard(props({ type: "logocreator:image", payload: {} }, true));
		expect(container.querySelector("[aria-busy]")).toBeTruthy();
		expect(screen.getByText(en["card.processing"])).toBeTruthy();
	});

	it("shows every returned image", () => {
		const { ctx } = host();
		setPluginContext(ctx);
		renderCard(props({ type: "logocreator:image", payload: { images: refs, designIds: ["d1", "d2"] } }));
		expect(document.querySelectorAll("img")).toHaveLength(2);
	});

	it("hands the design to the canvas when asked", async () => {
		const { ctx, openActivityTab, setActivityTabVisible } = host();
		setPluginContext(ctx);
		renderCard(props({ type: "logocreator:image", payload: { images: refs, designIds: ["d1", "d2"] } }));

		fireEvent.click(screen.getAllByLabelText(en["card.openCanvas"])[1]!);

		// The panel claims exactly the design this image came from, not "the newest".
		expect(claimPendingDesignId(CWD)).toBe("d2");
		await waitFor(() => expect(setActivityTabVisible).toHaveBeenCalled());
		expect(openActivityTab).toHaveBeenCalledWith("logocreator-canvas", expect.objectContaining({ cwd: CWD }));
	});

	it("attaches the image as the next edit target, naming the tool", () => {
		const { ctx, setPromptAttachment } = host();
		setPluginContext(ctx);
		renderCard(props({ type: "logocreator:image", payload: { images: refs, designIds: ["d1", "d2"] } }));

		fireEvent.click(screen.getAllByLabelText(en["card.editTarget"])[0]!);

		const attachment = setPromptAttachment.mock.calls[0]?.[0];
		expect(attachment).toMatchObject({ id: "blob-1", label: en["card.editTarget"] });
		// The instruction has to name the tool and the reference, or the agent starts over.
		expect(String(attachment.instructions)).toContain("logocreator_image");
		expect(String(attachment.instructions)).toContain("referenceImageId");
	});

	it("opens the host lightbox with the whole group", () => {
		const { ctx, previewImage } = host();
		setPluginContext(ctx);
		renderCard(props({ type: "logocreator:image", payload: { images: refs, designIds: ["d1", "d2"] } }));
		fireEvent.click(document.querySelectorAll("button")[0]!);
		expect(previewImage).toHaveBeenCalledWith(refs[0], refs);
	});
});
