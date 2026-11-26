import type { PluginFsApi } from "@astravia-org/plugin-sdk";
import { readManifest, type DesignManifest, type ManifestVariant } from "./design-folder";
import { listDesignDocuments } from "./design-library";
import type { LogoSpec } from "./spec";

/**
 * 设计包的版本清单。
 *
 * 历史面板原先列的是「生成过的图片」（history-store 里一条生成记录一张图）。那与磁盘上的
 * 事实是两套东西：包才是可交付的产物，一代设计包的版本 = 它的 `design.astravia-log` 里
 * 记录的变体（`variants[]`，每次生成追加一批）。
 *
 * 所以列表改成「包 → 版本」，点击某个版本把画布切到那一版：
 *
 *   - 矢量版本：`{...manifest.spec, seed, style}` 就能复现（引擎是纯函数，seed+style 决定几何）；
 *   - 位图版本：没有可复现的 spec，画布只能显示清单里记的最近一次参数，因此行上明确标注
 *     `AI`，点开后仍会切到该包（图片本身在 `variants/N.png`）。
 *
 * 只读，不改文件；读不到的包直接跳过，不让一个坏包拖垮整个列表。
 */

export interface DesignVersionRef {
	/** 在 `variants[]` 里的序号，1 起，与 `variants/N.svg|png` 对齐。 */
	index: number;
	file: string;
	subject: string;
	seed: number;
	style: string;
	engine: "local" | "ai";
	/** ISO 时间；旧清单可能没有。 */
	at: string | null;
}

export interface DesignPackageRef {
	folder: string;
	slug: string;
	brand: string;
	/** 清单里的起稿参数；点击版本时与 seed/style 合并。 */
	spec: LogoSpec;
	updatedAt: string;
	/** 新的在前。 */
	versions: DesignVersionRef[];
}

function toVersion(variant: ManifestVariant, index: number): DesignVersionRef {
	return {
		index: index + 1,
		file: variant.file,
		subject: variant.subject,
		seed: variant.seed,
		style: variant.style,
		engine: variant.engine === "ai" ? "ai" : "local",
		at: variant.at ?? null,
	};
}

function toPackage(doc: { folder: string; slug: string }, manifest: DesignManifest): DesignPackageRef {
	const versions = [...(manifest.variants ?? [])]
		.reverse()
		.map((variant, offset, list) => toVersion(variant, list.length - 1 - offset));
	return {
		folder: doc.folder,
		slug: manifest.slug || doc.slug,
		brand: manifest.brand,
		spec: manifest.spec,
		updatedAt: manifest.updatedAt,
		versions,
	};
}

/**
 * 列出工作区里每个设计包及其版本。
 *
 * 先列包再逐个读清单：`listDesignDocuments` 已经有缓存与后缀过滤，这里不重复扫盘。
 * 读失败（清单损坏、权限不足）时跳过该包——面板显示剩下的，比整块报错有用。
 */
export async function listDesignVersions(fs: PluginFsApi, cwd: string | null, force = false): Promise<DesignPackageRef[]> {
	const docs = await listDesignDocuments(fs, cwd, force);
	// 并发读清单：串行 await 在包多时会把面板打开拖成秒级。
	const loaded = await Promise.all(
		docs.map(async (doc) => {
			const manifest = await readManifest(fs, doc.folder, doc.slug).catch(() => null);
			if (!manifest) return null;
			const pkg = toPackage(doc, manifest);
			// 清单只记最近 24 条（历史裁剪），但文件还在：以目录里的实际文件补全版本列表。
			// 这样「版本」的事实源是磁盘，不是清单里还剩多少。
			const files = await listVariantFiles(fs, doc.folder).catch(() => []);
			const known = new Set(pkg.versions.map((version) => version.file));
			const extra = files
				.filter((file) => !known.has(file))
				.map((file, offset) => ({
					index: pkg.versions.length + offset + 1,
					file,
					subject: pkg.spec.intent || pkg.brand,
					seed: pkg.spec.seed,
					style: pkg.spec.style,
					engine: file.endsWith("-ai.png") ? ("ai" as const) : ("local" as const),
					at: null,
				}));
			if (extra.length > 0) pkg.versions = [...extra.reverse(), ...pkg.versions];
			return pkg;
		}),
	);
	// 最近改过的包在前；同一时间按品牌名排，顺序稳定。
	return loaded
		.filter((pkg): pkg is DesignPackageRef => pkg !== null)
		.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.brand.localeCompare(right.brand));
}

/** `variants/` 里实际存在的文件（相对路径），用来补全清单裁剪掉的那些版本。 */
async function listVariantFiles(fs: PluginFsApi, folder: string): Promise<string[]> {
	// SDK 只有一个列文件的入口（递归），这里按前缀筛出 `variants/` 下的那一层。
	const prefix = `${folder.replace(/\/+$/u, "")}/variants/`;
	const entries = await fs.listFilesRecursive(folder);
	return entries
		.map((entry) => entry.path.replace(/\\/gu, "/"))
		.filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
		.filter((path) => /\.(svg|png)$/u.test(path))
		.map((path) => `variants/${path.slice(prefix.length)}`)
		.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

/** 把某一版还原成可渲染的 spec：引擎是纯函数，seed + style 就能复现同一份几何。 */
export function specForVersion(pkg: DesignPackageRef, version: DesignVersionRef): LogoSpec {
	return { ...pkg.spec, seed: version.seed, style: version.style as LogoSpec["style"] };
}
