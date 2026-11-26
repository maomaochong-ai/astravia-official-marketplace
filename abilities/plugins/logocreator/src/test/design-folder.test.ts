// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { PluginFsApi } from "@astravia-org/plugin-sdk";
import { kitSlug } from "../domain/brand-kit";
import {
	DESIGN_FOLDER_SUFFIX,
	DESIGN_MANIFEST,
	MANIFEST_VARIANTS_CAP,
	designFolder,
	designFolderForSlug,
	isDesignFolder,
	readManifest,
	slugOfFolder,
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
	it("names the folder after the design, like the host's own design document", () => {
		// 一个品牌一个目录，目录名带后缀：文件树与右键菜单按后缀认领它。
		expect(designFolder("C:/repo", undefined, "Acme")).toBe(`C:/repo/acme${DESIGN_FOLDER_SUFFIX}`);
		expect(designFolder("C:/repo", undefined, "ACME")).toBe(`C:/repo/acme${DESIGN_FOLDER_SUFFIX}`);
		// 后缀与内置设计插件同一套读法：带点，扩展名不给点。
		expect(DESIGN_FOLDER_SUFFIX).toBe(".logocreator-design");
	});

	it("recognises its own folders and reads the slug back out", () => {
		expect(isDesignFolder(`C:/repo/acme${DESIGN_FOLDER_SUFFIX}`)).toBe(true);
		expect(isDesignFolder("C:/repo/acme")).toBe(false);
		expect(slugOfFolder(`C:/repo/acme${DESIGN_FOLDER_SUFFIX}/`)).toBe("acme");
	});

	it("always lands at the project root, keeping the package suffix", () => {
		// 容器目录会让同一份设计散在多处（logos/brand…、tmp/brand…），切换器里出现一堆
		// 同名包。现在传入 directory 也一律落在项目根。
		expect(designFolder("C:/repo/", "/brand/", "Acme")).toBe("C:/repo/acme.logocreator-design");
		expect(designFolderForSlug("C:/repo", "brand", "acme")).toBe("C:/repo/acme.logocreator-design");
		expect(isDesignFolder(designFolderForSlug("C:/repo", "brand", "acme"))).toBe(true);
	});

	it("refuses to build a package for an unnamed brand", () => {
		// 上一版回退成 "brand"，磁盘上因此出现过 brand.logocreator-design 这种占位包。
		expect(() => designFolderForSlug("C:/repo", undefined, "  ")).toThrow(/brand name/);
		expect(kitSlug({ brandName: "" })).toBe("untitled");
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
