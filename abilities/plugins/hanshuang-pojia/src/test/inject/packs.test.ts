import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PACKS, hasPack, packById, packTemplate } from "../../domain/inject/packs";
import { stripFrontMatter } from "../../features/workbench/services/packs";

/** 这个文件在 src/test/inject/，插件根是上三级。 */
const root = join(__dirname, "..", "..", "..");
const read = (name: string) => readFileSync(join(root, "src/content/packs", `${name}.md`), "utf8");

describe("prompt pack index", () => {
	it("lists the four packs the ADR commits to, with bodies on disk", () => {
		expect(PACKS.map(pack => pack.id)).toEqual(["execution-kernel", "inject-ladder", "jailbreak-research", "persona-redteam"]);
		for (const pack of PACKS) {
			expect(() => read(pack.id), pack.id).not.toThrow();
		}
	});

	it("records a sha256 that matches the file, so a stale index fails here first", () => {
		for (const pack of PACKS) {
			const digest = createHash("sha256").update(Buffer.from(read(pack.id), "utf8")).digest("hex");
			expect(digest, pack.id).toBe(pack.sha256);
		}
	});

	it("keeps the body out of the index: only metadata ships in the JS chunk", () => {
		for (const pack of PACKS) {
			expect(pack.chars, pack.id).toBeGreaterThan(200);
			// 索引项里除了 summary / provenance 这两行元数据，不该出现正文段落。
			expect(pack.summary.length).toBeLessThan(200);
			expect(Object.keys(pack).sort()).toEqual(["chars", "id", "mode", "provenance", "sha256", "summary", "title"]);
		}
	});

	it("每一条都注明出处：这些包是结构重写，不是原文搬运", () => {
		for (const pack of PACKS) {
			expect(pack.provenance, pack.id).toMatch(/hanshuang-mac|dsh-jailbreak-workflow|deva/);
		}
	});
});

describe("packTemplate", () => {
	it("strips front matter so only the body is injected", () => {
		const entry = packById("execution-kernel")!;
		const body = stripFrontMatter(read("execution-kernel"));
		expect(body.startsWith("---")).toBe(false);
		expect(body).toContain("输出契约");
		const template = packTemplate(entry, body);
		expect(template.id).toBe("pack:execution-kernel");
		expect(template.mode).toBe("prepend");
		expect(template.content).not.toContain("provenance:");
	});

	it("recognises an already-installed pack by body, not by the name the user may edit", () => {
		const body = stripFrontMatter(read("inject-ladder"));
		expect(hasPack([{ content: body }], body)).toBe(true);
		expect(hasPack([{ content: "别的正文" }], body)).toBe(false);
	});
});
