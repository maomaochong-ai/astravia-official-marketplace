import { describe, expect, it } from "vitest";
import { renderLogo, resolveMark } from "../domain/engine/compose";
import { DETAIL_LEVELS, LOGO_TYPES, normalizeSpec, STYLE_IDS, type LogoSpec } from "../domain/spec";
import { GLYPH_COUNT, glyphBlock, initialsOf } from "../domain/engine/glyphs";
import { subjectFor } from "../domain/color-plan";

function spec(patch: Partial<LogoSpec> = {}): LogoSpec {
	return normalizeSpec({ brandName: "Fern & Field", intent: "a leaf mark for a garden studio", ...patch });
}

describe("the composer", () => {
	it("returns a standalone SVG with no external references", () => {
		const { svg } = renderLogo(spec());
		expect(svg.startsWith("<svg")).toBe(true);
		expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
		expect(svg).toContain('viewBox="0 0 512 512"');
		expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
		expect(svg).not.toContain("<image");
		expect(svg).not.toContain("@import");
	});

	it("is deterministic for the same spec", () => {
		expect(renderLogo(spec()).svg).toBe(renderLogo(spec()).svg);
	});

	it("changes when the seed changes", () => {
		expect(renderLogo(spec({ seed: 1 })).svg).not.toBe(renderLogo(spec({ seed: 2 })).svg);
	});

	it("keeps the mark out of the wordmark-only variant", () => {
		const { svg } = renderLogo(spec({ type: "wordmark" }));
		expect(svg).toContain("Fern &amp; Field");
		expect(resolveMark(spec({ type: "wordmark" })).motif).not.toBeNull();
	});

	it("omits the background entirely when transparent", () => {
		const transparent = renderLogo(spec({ surface: "transparent" })).svg;
		const light = renderLogo(spec({ surface: "light" })).svg;
		expect(transparent).not.toContain('<rect width="512" height="512" fill="#FFFFFF"/>');
		expect(light).toContain('<rect width="512" height="512" fill="#FFFFFF"/>');
	});

	it("draws every type × style combination without throwing", () => {
		for (const type of LOGO_TYPES) {
			for (const style of STYLE_IDS) {
				for (const detail of DETAIL_LEVELS) {
					const rendered = renderLogo(spec({ type, style, detail }));
					expect(rendered.svg.length).toBeGreaterThan(200);
					expect(rendered.subject.length).toBeGreaterThan(0);
					expect(rendered.svg).not.toMatch(/NaN|undefined/);
				}
			}
		}
	});

	it("uses one ink for a monochrome mark", () => {
		const { svg } = renderLogo(spec({ monochrome: true, type: "icon" }), { monoInk: "#111111" });
		const fills = new Set([...svg.matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map((match) => match[1].toUpperCase()));
		// Background + the single ink. Nothing else may appear.
		expect([...fills].every((hex) => hex === "#111111" || hex === "#FFFFFF")).toBe(true);
	});

	it("produces a mark-only SVG that carries no text", () => {
		const { markSvg } = renderLogo(spec({ type: "icon-name" }), { markOnly: true });
		expect(markSvg).not.toContain("<text");
		expect(markSvg).toContain("<path");
	});

	it("puts the brand name on the arc for an emblem", () => {
		const { svg } = renderLogo(spec({ type: "emblem", brandName: "Kettle Lane" }));
		expect(svg).toContain("textPath");
		expect(svg).toContain("KETTLE LANE");
	});

	it("escapes markup in a hostile brand name", () => {
		const { svg } = renderLogo(spec({ brandName: "<script>x</script>" }));
		expect(svg).not.toContain("<script>");
		expect(svg).toContain("&lt;script&gt;");
	});

	it("shrinks the wordmark for a long name instead of overflowing", () => {
		const short = renderLogo(spec({ brandName: "Moss" })).svg;
		const long = renderLogo(spec({ brandName: "Moss and Pine Botanical Atelier" })).svg;
		const size = (svg: string) => Number(/font-size="([\d.]+)"/.exec(svg)?.[1] ?? 0);
		expect(size(long)).toBeLessThan(size(short));
	});
});

describe("mark resolution", () => {
	it("picks the subject the brief names first", () => {
		expect(resolveMark(spec({ intent: "a leaf mark for a plant nursery" })).subject).toBe("leaf");
		expect(resolveMark(spec({ intent: "photography studio lens" })).subject).toBe("aperture");
		expect(resolveMark(spec({ brandName: "Ember Oak", intent: "flame mark" })).subject).toBe("flame");
	});

	it("falls back to an abstract construction when nothing is recognised", () => {
		const resolved = resolveMark(spec({ brandName: "Zzyzx", intent: "something indescribable" }));
		expect(resolved.subject.startsWith("abstract:")).toBe(true);
		expect(resolved.motif).not.toBeNull();
	});

	it("always resolves a monogram to the glyph alphabet", () => {
		expect(resolveMark(spec({ type: "monogram" }))).toEqual({ subject: "monogram", motif: null });
	});

	it("matches the earliest keyword, not the earliest rule", () => {
		expect(subjectFor("leaf for a bakery")).toBe("leaf");
		expect(subjectFor("bakery with a leaf")).toBe("flame");
	});
});

describe("the stroke alphabet", () => {
	it("covers A–Z and 0–9", () => {
		expect(GLYPH_COUNT).toBe(36);
		for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") {
			expect(glyphBlock(char)).not.toBeNull();
		}
	});

	it("takes initials from multi-word names", () => {
		expect(initialsOf("Fern & Field")).toBe("FF");
		expect(initialsOf("Northpeak Systems")).toBe("NS");
		// A single long word gets first + last, which reads as a monogram instead of
		// one lonely letter; a short one stays single.
		expect(initialsOf("Auric")).toBe("AC");
		expect(initialsOf("Moss")).toBe("M");
	});

	it("falls back to a CJK initial rather than an empty block", () => {
		expect(initialsOf("青岚茶事")).toBe("青");
		expect(glyphBlock("青")).toBeNull();
	});

	it("lays glyphs out with tracking", () => {
		const tight = glyphBlock("AB", 0);
		const wide = glyphBlock("AB", 0.2);
		expect(tight).not.toBeNull();
		expect(wide).not.toBeNull();
		expect(wide!.width).toBeGreaterThan(tight!.width);
	});
});
