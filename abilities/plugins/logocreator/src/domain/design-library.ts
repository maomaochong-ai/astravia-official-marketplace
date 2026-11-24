import type { PluginFsApi } from "@astravia-org/plugin-sdk";
import { DESIGN_MANIFEST, LEGACY_MANIFEST, slugOfFolder } from "./design-folder";

/**
 * 工作区里有哪些设计稿。
 *
 * 设计稿是一份 `.astravia-log` 文件（旧版叫 `design.json`），放在
 * `<slug>.logocreator-design/` 目录里。面板要能**列出来并切换**，否则「打开画布看到已有的设计稿」
 * 只能靠宿主对话重新生成一次。
 *
 * 扫一次 `fs.listFilesRecursive` 就够了：只按文件名精确匹配，不做内容匹配 ——
 * 目录里可能有几十个 SVG，逐个读会把首屏拖慢。
 *
 * 结果按品牌目录去重（同目录里新旧两个文件名都在时优先新的），按文件时间倒序。
 * 列表本身在模块内缓存：面板每次重渲染都扫一遍文件系统是不可接受的。
 */

export const DESIGN_LOG_FILE = DESIGN_MANIFEST;
export const DESIGN_LOG_EXTENSION = "astravia-log";

export interface DesignDocumentRef {
	/** 设计稿文件路径（相对工作区）。 */
	path: string;
	/** 它所在的品牌目录；切换时用这个路径打开。 */
	folder: string;
	slug: string;
	modifiedAt: number;
}

interface CacheEntry {
	at: number;
	items: DesignDocumentRef[];
}

const cache = new Map<string, CacheEntry>();
/** 缓存有效期：用户刚在对话里生成完，切换器要能马上看到。 */
const TTL_MS = 4_000;

function folderOf(path: string): string {
	const index = path.lastIndexOf("/");
	return index === -1 ? "" : path.slice(0, index);
}

/**
 * 列出工作区里的设计稿。
 *
 * 读不到（没授权 `fs.read`、目录不存在）时返回空数组而不是抛：切换器是增强项，
 * 它的失败不该让画布打不开。
 */
export async function listDesignDocuments(fs: PluginFsApi, cwd: string | null, force = false): Promise<DesignDocumentRef[]> {
	if (!cwd) return [];
	const key = cwd.replace(/[/\\]+$/, "");
	const hit = cache.get(key);
	if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.items;

	let files: { path: string; modifiedAt?: number }[] = [];
	try {
		// `names` 精确匹配基名；旧宿主（< Plugin API 2.8.0）会忽略它并返回全部文件，
		// 所以下面的循环自己再按后缀筛一遍 —— 两边都得对。
		files = await fs.listFilesRecursive(key, { names: [DESIGN_LOG_FILE, LEGACY_MANIFEST] });
	} catch {
		return hit?.items ?? [];
	}

	const byFolder = new Map<string, DesignDocumentRef>();
	for (const file of files) {
		const path = file.path.replace(/\\/g, "/");
		const folder = folderOf(path);
		if (!folder.includes(".logocreator-design")) continue;
		const isCurrent = path.endsWith(DESIGN_LOG_FILE);
		const existing = byFolder.get(folder);
		// 新旧两个文件同目录时只留一个，且优先当前的 `design.astravia-log`。
		if (existing && (!isCurrent || existing.path.endsWith(DESIGN_LOG_FILE))) continue;
		byFolder.set(folder, {
			path,
			folder,
			slug: slugOfFolder(folder),
			modifiedAt: Number(file.modifiedAt) || 0,
		});
	}

	const items = [...byFolder.values()].sort((left, right) => right.modifiedAt - left.modifiedAt || left.slug.localeCompare(right.slug));
	cache.set(key, { at: Date.now(), items });
	return items;
}

/** 写出新的设计稿之后清掉缓存，切换器下一次立刻看到它。 */
export function invalidateDesignDocuments(cwd?: string | null): void {
	if (!cwd) {
		cache.clear();
		return;
	}
	cache.delete(cwd.replace(/[/\\]+$/, ""));
}

/** 测试 seam。 */
export function clearDesignDocumentCache(): void {
	cache.clear();
}
