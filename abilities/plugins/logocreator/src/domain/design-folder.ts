import type { PluginFsApi } from "@astravia-org/plugin-sdk";
import { kitSlug } from "./brand-kit";
import { normalizeSpec, type LogoSpec } from "./spec";

/**
 * 一次设计 = 一个目录，目录里有一份 `design.json`。
 *
 * 这是对宿主内置设计插件的对齐：它把一份设计写成一个 `*.astravia-design/` 目录，
 * 里面有 `design.json` 与源码，画布读目录而不是读一堆散落的文件。上一版这里写的是
 * `<cwd>/logos/<slug>/<slug>.svg`、`<slug>-2.svg`、`<slug>-3.svg`，品牌套件又写到
 * 兄弟目录 `<cwd>/logos/<slug>-brand-kit/` —— 一次对话下来项目里多了两个平级目录、
 * 十几二十个散文件，而且再跑一次同名设计会覆盖混杂。用户看到的就是「很零乱的目录」。
 *
 * 现在的形状（一个品牌一个目录，所有产物都在里面）：
 *
 * ```
 * logo-designs/<slug>/
 *   design.json          机器可读的真相：spec、调色板、各变体、套件清单
 *   mark.svg             主变体（= variants/1.svg，便于直接取用）
 *   variants/1.svg …     这次生成的每个变体，各自带 seed / style
 *   kit/…                品牌套件的全部产物（只有在跑过 brand_kit 之后出现）
 * ```
 *
 * `design.json` 是合并写：同一个品牌再跑一次，只更新 spec/variants/kit，不删已有文件，
 * 也不把上几次的变体列表丢掉（最多保留 `MANIFEST_VARIANTS_CAP` 条，防止无限长）。
 */

export const DESIGN_MANIFEST = "design.json";
export const DESIGN_MANIFEST_SCHEMA = 1;
export const DESIGN_ROOT = "logo-designs";
/** 清单里最多记多少条历史变体；文件本身不删，只是不再列出。 */
export const MANIFEST_VARIANTS_CAP = 24;

export interface ManifestVariant {
	/** 相对品牌目录的路径，如 `variants/2.svg`。 */
	file: string;
	subject: string;
	seed: number;
	style: string;
	/** 生成它的引擎；AI 产物没有 SVG，所以这条只出现在 vector 上。 */
	engine: "local" | "ai";
	at: string;
}

export interface DesignManifest {
	schemaVersion: number;
	brand: string;
	slug: string;
	/** 主变体路径；空串表示这次没有写出 SVG（例如纯 AI 生图）。 */
	primary: string;
	/** 最近一次的起稿参数，面板与后续工具可以直接复用。 */
	spec: LogoSpec;
	palette: Record<string, string>;
	variants: ManifestVariant[];
	kit?: { folder: string; files: string[]; palette: Record<string, string>; engine: string };
	createdAt: string;
	updatedAt: string;
}

export function designRoot(cwd: string, directory?: string): string {
	const base = cwd.replace(/[/\\]+$/, "");
	const trimmed = (directory ?? DESIGN_ROOT).replace(/^[/\\]+/, "").replace(/[/\\]+$/, "");
	return trimmed.length > 0 ? `${base}/${trimmed}` : base;
}

/** 一个品牌一个目录：同一品牌反复迭代落在同一处，不再生成 `-2`、`-brand-kit` 兄弟目录。 */
export function designFolder(cwd: string, directory: string | undefined, brand: string): string {
	return `${designRoot(cwd, directory)}/${kitSlug({ brandName: brand })}`;
}

export function variantPath(index: number): string {
	return `variants/${index + 1}.svg`;
}

function coerceManifest(raw: unknown, fallback: { brand: string; slug: string }): DesignManifest | null {
	if (!raw || typeof raw !== "object") return null;
	const value = raw as Partial<DesignManifest>;
	if (value.schemaVersion !== DESIGN_MANIFEST_SCHEMA) return null;
	const at = new Date().toISOString();
	return {
		schemaVersion: DESIGN_MANIFEST_SCHEMA,
		brand: typeof value.brand === "string" && value.brand ? value.brand : fallback.brand,
		slug: typeof value.slug === "string" && value.slug ? value.slug : fallback.slug,
		primary: typeof value.primary === "string" ? value.primary : "",
		spec: normalizeSpec(value.spec),
		palette: isStringMap(value.palette) ? value.palette : {},
		variants: Array.isArray(value.variants) ? value.variants.filter(isVariant) : [],
		...(value.kit && typeof value.kit === "object"
			? {
					kit: {
						folder: typeof value.kit.folder === "string" ? value.kit.folder : "kit",
						files: Array.isArray(value.kit.files) ? value.kit.files.filter((item): item is string => typeof item === "string") : [],
						palette: isStringMap(value.kit.palette) ? value.kit.palette : {},
						engine: typeof value.kit.engine === "string" ? value.kit.engine : "local",
					},
				}
			: {}),
		createdAt: typeof value.createdAt === "string" ? value.createdAt : at,
		updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : at,
	};
}

function isStringMap(value: unknown): value is Record<string, string> {
	if (!value || typeof value !== "object") return false;
	return Object.values(value).every(item => typeof item === "string");
}

function isVariant(value: unknown): value is ManifestVariant {
	if (!value || typeof value !== "object") return false;
	const item = value as Partial<ManifestVariant>;
	return typeof item.file === "string" && typeof item.subject === "string" && typeof item.seed === "number";
}

/** 读不到、坏了、版本不认识 —— 一律返回 null，让调用方按「新建」处理，不让它抛。 */
export async function readManifest(fs: PluginFsApi, folder: string, brand: string): Promise<DesignManifest | null> {
	try {
		const result = await fs.readFile(`${folder}/${DESIGN_MANIFEST}`);
		return coerceManifest(JSON.parse(result.content), { brand, slug: folder.split("/").pop() ?? "" });
	} catch {
		return null;
	}
}

export interface ManifestPatch {
	brand: string;
	slug: string;
	primary?: string;
	spec?: LogoSpec;
	palette?: Record<string, string>;
	/** 追加到已有变体列表之后；更旧的在超过上限时被丢掉（文件仍在磁盘上）。 */
	variants?: readonly Omit<ManifestVariant, "at">[];
	kit?: DesignManifest["kit"];
}

/**
 * 读-合并-写。合并而不是覆盖，是因为同一个品牌的第二次生成不该抹掉第一次的记录，
 * 而 kit 与 design 两个工具都会写这份文件。
 */
export async function writeManifest(fs: PluginFsApi, folder: string, patch: ManifestPatch): Promise<DesignManifest> {
	const now = new Date().toISOString();
	const existing = await readManifest(fs, folder, patch.brand);
	const variants = [...(existing?.variants ?? []), ...(patch.variants ?? []).map(item => ({ ...item, at: now }))].slice(
		-MANIFEST_VARIANTS_CAP,
	);
	const manifest: DesignManifest = {
		schemaVersion: DESIGN_MANIFEST_SCHEMA,
		brand: patch.brand,
		slug: patch.slug,
		primary: patch.primary ?? existing?.primary ?? "",
		spec: patch.spec ?? existing?.spec ?? normalizeSpec({ brandName: patch.brand }),
		palette: patch.palette ?? existing?.palette ?? {},
		variants,
		// kit 只在这次真的产出了套件时替换；否则保留上一次的。
		...(patch.kit ?? existing?.kit ? { kit: patch.kit ?? existing?.kit } : {}),
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
	};
	await fs.createDirectory(folder).catch(() => undefined);
	await fs.writeFile(`${folder}/${DESIGN_MANIFEST}`, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
	return manifest;
}
