// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { PluginFsApi } from "@astravia-org/plugin-sdk";
import {
	DESIGN_MANIFEST,
	MANIFEST_VARIANTS_CAP,
	designFolder,
	designRoot,
	readManifest,
	variantPath,
	writeManifest,
} from "../domain/design-folder";
import { normalizeSpec } from "../domain/spec";

/**
 * 一次设计 = 一个目录 = 一份 `design.json`。
 *
 * 上一版把 SVG 平铺成 `<cwd>/logos/<slug>/<slug>.svg`、`-2.svg`、`-3.svg`，套件又写到兄弟目录
 * `<cwd>/logos/<slug>-brand-kit/`：一次对话下来项目根多出两个平级目录、十几个散文件，
 * 用户看到的就是「很零乱的目录」。这里钉住新的形状与合并语义。
 */
function memoryFs() {
	const files = new Map<string, string>();
	const dirs = new Set<string>();
	const fs = {
		createDirectory: async (path: string) => {
			dirs.add(path);
		},
		writeFile: async (path: string, content: string) => {
			files.set(path, content);
		},
		readFile: async (path: string) => {
			const content = files.get(path);
			if (content === undefined) throw new Error("ENOENT");
			return { content, encoding: "utf8" as const };
		},
	} as unknown as PluginFsApi;
	return { fs, files, dirs };
}

const spec = normalizeSpec({ brandName: "Acme", intent: "a leaf mark", primary: "#2F6FF5" });

describe("the design folder layout", () => {
	it("puts every brand in one root and one folder per brand", () => {
		expect(designRoot("C:/repo")).toBe("C:/repo/logo-designs");
		expect(designFolder("C:/repo", undefined, "Acme")).toBe("C:/repo/logo-designs/acme");
		// 同一个品牌再跑一次落在同一处：不再有 `-2`、`-brand-kit` 兄弟目录。
		expect(designFolder("C:/repo", undefined, "Acme")).toBe(designFolder("C:/repo", undefined, "ACME"));
	});

	it("honours a caller-supplied directory and strips separators", () => {
		expect(designRoot("C:/repo/", "/brand/")).toBe("C:/repo/brand");
		expect(designFolder("C:/repo", "brand", "Acme")).toBe("C:/repo/brand/acme");
	});

	it("numbers variants inside a variants/ subfolder", () => {
		expect(variantPath(0)).toBe("variants/1.svg");
		expect(variantPath(2)).toBe("variants/3.svg");
	});

	it("writes a manifest the other tool can read back", async () => {
		const { fs, files } = memoryFs();
		const folder = designFolder("C:/repo", undefined, "Acme");
		await writeManifest(fs, folder, {
			brand: "Acme",
			slug: "acme",
			primary: "mark.svg",
			spec,
			palette: { ink: "#2F6FF5" },
			variants: [
				{ file: "variants/1.svg", subject: "leaf", seed: 1, style: "minimal", engine: "local" },
				{ file: "variants/2.svg", subject: "leaf", seed: 2, style: "geometric", engine: "local" },
			],
		});

		expect(files.has(`${folder}/${DESIGN_MANIFEST}`)).toBe(true);
		const back = await readManifest(fs, folder, "Acme");
		expect(back?.primary).toBe("mark.svg");
		expect(back?.variants.map(item => item.file)).toEqual(["variants/1.svg", "variants/2.svg"]);
		expect(back?.palette.ink).toBe("#2F6FF5");
	});

	it("merges a second run instead of replacing the first", async () => {
		const { fs } = memoryFs();
		const folder = designFolder("C:/repo", undefined, "Acme");
		await writeManifest(fs, folder, {
			brand: "Acme",
			slug: "acme",
			spec,
			variants: [{ file: "variants/1.svg", subject: "leaf", seed: 1, style: "minimal", engine: "local" }],
		});
		await writeManifest(fs, folder, {
			brand: "Acme",
			slug: "acme",
			kit: { folder: "kit", files: ["kit/logo.svg"], palette: {}, engine: "local" },
		});

		const back = await readManifest(fs, folder, "Acme");
		expect(back?.variants).toHaveLength(1); // 第二次没写变体，第一次的仍在
		expect(back?.kit?.files).toEqual(["kit/logo.svg"]);
	});

	it("caps the variant ledger so the manifest cannot grow forever", async () => {
		const { fs } = memoryFs();
		const folder = designFolder("C:/repo", undefined, "Acme");
		await writeManifest(fs, folder, {
			brand: "Acme",
			slug: "acme",
			variants: Array.from({ length: MANIFEST_VARIANTS_CAP + 10 }, (_, index) => ({
				file: `variants/${index + 1}.svg`,
				subject: "leaf",
				seed: index,
				style: "minimal",
				engine: "local" as const,
			})),
		});
		expect((await readManifest(fs, folder, "Acme"))?.variants).toHaveLength(MANIFEST_VARIANTS_CAP);
	});

	it("treats a corrupt or unknown manifest as absent rather than throwing", async () => {
		const { fs, files } = memoryFs();
		const folder = designFolder("C:/repo", undefined, "Acme");
		files.set(`${folder}/${DESIGN_MANIFEST}`, "{ this is not json");
		expect(await readManifest(fs, folder, "Acme")).toBeNull();

		files.set(`${folder}/${DESIGN_MANIFEST}`, JSON.stringify({ schemaVersion: 99 }));
		expect(await readManifest(fs, folder, "Acme")).toBeNull();
	});

	it("creates the folder before writing", async () => {
		const { fs, dirs } = memoryFs();
		const folder = designFolder("C:/repo", undefined, "Acme");
		await writeManifest(fs, folder, { brand: "Acme", slug: "acme" });
		expect(dirs.has(folder)).toBe(true);
	});
});

describe("the tools write into that folder", () => {
	const read = (path: string) => {
		const { readFileSync } = require("node:fs") as typeof import("node:fs");
		return readFileSync(require("node:path").resolve(process.cwd(), path), "utf8");
	};

	it("design writes variants/ and a manifest, not flat files beside the folder", () => {
		const design = read("src/tools/design-logo.ts");
		expect(design).toContain("designFolder(");
		expect(design).toContain("variantPath(index)");
		expect(design).toContain("writeManifest(");
		expect(design).not.toContain("${kitSlug(spec)}${suffix}.svg");
	});

	it("brand kit writes into kit/ and records itself in the same manifest", () => {
		const kit = read("src/tools/brand-kit.ts");
		expect(kit).toContain("const kitFolder = `${base}/kit`");
		expect(kit).toContain("writeManifest(");
		expect(kit).not.toContain("-brand-kit");
	});
});
