/**
 * 提示词包正文的按需读取。
 *
 * 索引在 `domain/inject/packs.generated.ts`（几行元数据，进分块），
 * 正文在 `dist/assets/packs/<id>.md`（不进分块，点开才读）。
 * 与文档库同一个读资源实现，避免第二套 URL 改写逻辑各自漂移。
 */

import { packById, type PromptPackTemplate, packTemplate } from "../../../domain/inject/packs";
import { readPackageAsset } from "./package-asset";

const PACK_PREFIX = "src/content/packs/";

const bodyCache = new Map<string, string>();


/** 读一个包的正文；未知 id 抛错（调用方拿到的是工具参数，不该静默）。 */
export async function loadPackBody(id: string): Promise<string> {
	const cached = bodyCache.get(id);
	if (cached !== undefined) return cached;
	if (!packById(id)) throw new Error(`unknown prompt pack: ${id}`);
	const text = await readPackageAsset(`${id}.md`, { sourcePrefix: PACK_PREFIX, assetDir: "packs" });
	// 正文进缓存时不带 front matter：注入时放进去的应当是正文，不是元数据。
	const body = stripFrontMatter(text);
	bodyCache.set(id, body);
	return body;
}

/** 取一个能直接进提示词库的模板。 */
export async function loadPackTemplate(id: string): Promise<PromptPackTemplate> {
	const entry = packById(id);
	if (!entry) throw new Error(`unknown prompt pack: ${id}`);
	return packTemplate(entry, await loadPackBody(id));
}

export function stripFrontMatter(text: string): string {
	const normalized = text.replace(/\r\n/g, "\n");
	const match = /^---\n([\s\S]*?)\n---\n/.exec(normalized);
	return match ? normalized.slice(match[0].length) : normalized;
}
