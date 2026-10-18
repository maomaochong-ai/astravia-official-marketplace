import { describe, expect, it } from "vitest";
import {
	MAX_ARTIFACTS,
	MAX_IMAGE_ITEMS,
	MAX_LINK_ITEMS,
	MAX_MEDIA_ITEMS,
	MAX_TEXT_CHARS,
	artifactExtension,
	artifactText,
	artifactTotals,
	documentArtifact,
	pageArtifacts,
} from "../src/domain/firecrawl/artifacts";
import type { ElementProfile } from "../src/domain/firecrawl/profile";
import type { FirecrawlDocument } from "../src/domain/firecrawl/types";

const SOURCE = "https://example.com/docs/";

function elements(media: Array<{ url: string; kind?: "image" | "video" | "audio" }> = []): ElementProfile {
	return { media: media.map((entry) => ({ kind: "video", ...entry })) } as unknown as ElementProfile;
}

function page(document: Partial<FirecrawlDocument>): FirecrawlDocument {
	return { url: SOURCE, metadata: { statusCode: 200 }, ...document } as FirecrawlDocument;
}

function derive(
	document: Partial<FirecrawlDocument>,
	media: Array<{ url: string; kind?: "image" | "video" | "audio" }> = [],
) {
	return pageArtifacts(page(document), {
		source: SOURCE,
		title: "Docs home",
		elements: elements(media),
		at: 1_000,
	});
}

describe("pageArtifacts", () => {
	it("splits one page into the products a user re-uses", () => {
		const artifacts = derive(
			{
				markdown: "Read [the guide](/guide) and ![shot](/shot.png), then [elsewhere](https://other.test/x).",
				json: { title: "Docs" },
			},
			[
				{ url: "https://cdn.test/clip.mp4" },
				{ url: "https://cdn.test/episode.mp3", kind: "audio" },
			],
		);

		expect(artifacts.map((entry) => entry.kind)).toEqual(["markdown", "links", "images", "video", "audio", "json"]);

		const links = artifacts.find((entry) => entry.kind === "links");
		expect(links?.items).toContain("https://example.com/guide");
		expect(links?.items).toContain("https://other.test/x");

		const images = artifacts.find((entry) => entry.kind === "images");
		expect(images?.items).toEqual(["https://example.com/shot.png"]);

		expect(artifacts.find((entry) => entry.kind === "video")?.items).toEqual(["https://cdn.test/clip.mp4"]);
		expect(artifacts.find((entry) => entry.kind === "audio")?.items).toEqual(["https://cdn.test/episode.mp3"]);

		const structured = artifacts.find((entry) => entry.kind === "json");
		expect(structured?.text).toContain("\"title\": \"Docs\"");
	});

	it("shelves a format that returns records instead of prose as JSON", () => {
		const artifacts = derive({
			markdown: "Pricing",
			branding: { colorScheme: "dark", primaryColor: "#111111" },
			product: { name: "Widget", price: "9.99" },
		});

		const structured = artifacts.find((entry) => entry.kind === "json");
		expect(structured?.text).toContain("colorScheme");
		expect(structured?.text).toContain("Widget");
	});

	it("keeps an image out of the link list", () => {
		const artifacts = derive({ markdown: "![only](/pic.png)" });

		expect(artifacts.some((entry) => entry.kind === "links")).toBe(false);
		expect(artifacts.find((entry) => entry.kind === "images")?.items).toEqual(["https://example.com/pic.png"]);
	});

	it("drops products that would carry nothing", () => {
		const artifacts = derive({ markdown: "   " });

		expect(artifacts).toEqual([]);
	});

	it("caps what one page may contribute", () => {
		const links = Array.from({ length: MAX_LINK_ITEMS + 20 }, (_, index) => `[l${index}](/p${index})`).join(" ");
		const images = Array.from({ length: MAX_IMAGE_ITEMS + 10 }, (_, index) => `![i${index}](/i${index}.png)`).join(" ");
		const media = Array.from({ length: 40 }, (_, index) => ({ url: `https://cdn.test/${index}.mp4` }));
		const artifacts = derive({ markdown: "x".repeat(MAX_TEXT_CHARS + 500) + links + images }, media);

		expect(artifacts.find((entry) => entry.kind === "markdown")?.text).toHaveLength(MAX_TEXT_CHARS);
		expect(artifacts.find((entry) => entry.kind === "links")?.items).toHaveLength(MAX_LINK_ITEMS);
		expect(artifacts.find((entry) => entry.kind === "images")?.items).toHaveLength(MAX_IMAGE_ITEMS);
		expect(artifacts.find((entry) => entry.kind === "video")?.items).toHaveLength(MAX_MEDIA_ITEMS);
	});

	it("measures real bytes so the archive stays honest", () => {
		const artifacts = derive({ markdown: "héllo" });
		const prose = artifacts[0]!;

		expect(prose.bytes).toBe(new TextEncoder().encode("héllo").length);
	});
});

describe("documentArtifact", () => {
	it("turns a parsed upload into one artifact named after the file", () => {
		const artifact = documentArtifact("report.pdf", page({ markdown: "# Report" }), 42);

		expect(artifact?.kind).toBe("document");
		expect(artifact?.title).toBe("report.pdf");
		expect(artifact?.text).toBe("# Report");
	});

	it("falls back to HTML and refuses an empty parse", () => {
		expect(documentArtifact("a.html", page({ html: "<h1>Hi</h1>" }), 1)?.text).toBe("<h1>Hi</h1>");
		expect(documentArtifact("a.pdf", page({}), 1)).toBeNull();
	});
});

describe("artifactTotals", () => {
	it("counts artifacts, list entries and bytes separately", () => {
		const artifacts = derive({ markdown: "[a](/a) [b](/b)" });
		const totals = artifactTotals(artifacts);

		expect(totals.total).toBe(artifacts.length);
		expect(totals.byKind.markdown).toBe(1);
		expect(totals.byKind.links).toBe(1);
		expect(totals.items.links).toBe(2);
		expect(totals.items.markdown).toBe(1);
		expect(totals.bytes).toBe(artifacts.reduce((sum, entry) => sum + entry.bytes, 0));
	});

	it("starts empty for every kind", () => {
		expect(artifactTotals([]).byKind.media).toBe(0);
		expect(artifactTotals([]).total).toBe(0);
	});
});

describe("artifact helpers", () => {
	it("exports lists as text and keeps the extension predictable", () => {
		const [prose, links] = derive({ markdown: "[a](/a)" });

		expect(artifactText(prose!)).toContain("[a](/a)");
		expect(artifactText(links!)).toBe("https://example.com/a");
		expect(artifactExtension("json")).toBe("json");
		expect(artifactExtension("markdown")).toBe("md");
		expect(artifactExtension("links")).toBe("txt");
	});
});

describe("caps", () => {
	it("bounds one run so a 500 page crawl cannot become a 50 MB file", () => {
		expect(MAX_ARTIFACTS).toBe(400);
	});
});
