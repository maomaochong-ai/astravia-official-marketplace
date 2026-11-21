// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The ability page's demo conversation must not clip its own text.
 *
 * `chat-thread` renders inside a fixed `h-44` (176 px) card:
 *   header ≈ 40 px  ·  footer (input placeholder) ≈ 44 px  ·  bubble padding 20 px
 * leaving ≈ 72 px for the two bubbles. One compact bubble is ≈ 29 px (one line of
 * 11 px at line-height 1.375 plus 12 px padding and a 2 px border); two of them
 * plus the 6 px gap is ≈ 64 px. A second line in either bubble overflows, and
 * because the column is `justify-end` the overflow is cut off the TOP — which is
 * exactly what "text hidden behind a rounded container" looks like.
 *
 * So: both strings must fit on one line. The bubble is ≈ 330 px of usable width;
 * the assistant bubble gives up ≈ 32 px to the avatar.
 */

const ROOT = process.cwd();
const readJson = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

const FONT_PX = 11;
const BUBBLE_WIDTH = 330;
const ASSISTANT_WIDTH = BUBBLE_WIDTH - 32;
const BODY_HEIGHT = 72;
const ONE_LINE_BUBBLE = FONT_PX * 1.375 + 12 + 2;
const GAP = 6;

function estimateWidth(text: string): number {
	let width = 0;
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		if (code >= 0x2e80) width += FONT_PX; // CJK, full-width punctuation
		else if (/[A-Z0-9]/.test(char)) width += FONT_PX * 0.62;
		else if (/[a-z]/.test(char)) width += FONT_PX * 0.52;
		else width += FONT_PX * 0.34; // spaces and thin punctuation
	}
	return width;
}

const files = ["detail.json", "detail.zh.json"];

describe("ability page demo conversation", () => {
	for (const file of files) {
		const detail = readJson(file);
		const showcase = detail.blocks.find((block: { type: string }) => block.type === "showcase")?.showcase;

		it(`${file} uses the thread template, so no canvas sits over the chat`, () => {
			expect(showcase).toBeTruthy();
			expect(showcase.template).toBe("chat-thread");
		});

		it(`${file} fits both bubbles on one line`, () => {
			expect(estimateWidth(showcase.user_prompt)).toBeLessThanOrEqual(BUBBLE_WIDTH);
			expect(estimateWidth(showcase.assistant_reply)).toBeLessThanOrEqual(ASSISTANT_WIDTH);
		});

		it(`${file} leaves vertical slack in the bubble column`, () => {
			expect(2 * ONE_LINE_BUBBLE + GAP).toBeLessThanOrEqual(BODY_HEIGHT);
		});

		it(`${file} says something specific, not filler`, () => {
			expect(showcase.user_prompt.length).toBeGreaterThan(8);
			expect(showcase.assistant_reply.length).toBeGreaterThan(8);
			expect(showcase.user_prompt).not.toMatch(/\?$|？$/);
		});
	}

	it("keeps both languages equally brief", () => {
		const en = readJson("detail.json").blocks.find((b: { type: string }) => b.type === "showcase").showcase;
		const zh = readJson("detail.zh.json").blocks.find((b: { type: string }) => b.type === "showcase").showcase;
		expect(Math.abs(en.user_prompt.length - zh.user_prompt.length)).toBeLessThan(24);
		expect(Math.abs(en.assistant_reply.length - zh.assistant_reply.length)).toBeLessThan(24);
	});
});
