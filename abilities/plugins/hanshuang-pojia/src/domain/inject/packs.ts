/**
 * 提示词包的领域访问：索引来自生成物，正文由调用方按需加载后传进来。
 *
 * 拆成「索引」与「正文」两步不是洁癖：索引进 JS 分块（几十行元数据），
 * 正文留在 `assets/packs/`。领域层因此不认识 fetch、不认识文件系统 ——
 * 它只负责把「一个包 + 一段正文」变成一个能进提示词库的模板。
 */

import { PACKS, type PackMode, type PromptPackEntry } from "./packs.generated";

export { PACKS };
export type { PackMode, PromptPackEntry };

export function packById(id: string): PromptPackEntry | undefined {
	return PACKS.find(pack => pack.id === id);
}

/** 能进提示词库的模板形态；字段与 `prompt-template.ts` 的 `PromptTemplate` 一一对应。 */
export interface PromptPackTemplate {
	id: string;
	name: string;
	description: string;
	content: string;
	mode: PackMode;
	/** 出处单独带出来，注入前能看见它是从哪儿来的。 */
	provenance: string;
}

export function packTemplate(entry: PromptPackEntry, body: string): PromptPackTemplate {
	return {
		id: `pack:${entry.id}`,
		name: entry.title,
		description: entry.summary,
		content: body.trim(),
		mode: entry.mode,
		provenance: entry.provenance,
	};
}

/** 库里是否已经有这一包：按正文比对，用户改过名称也算「已有」。 */
export function hasPack(items: readonly { content: string }[], body: string): boolean {
	const target = body.trim();
	return items.some(item => item.content.trim() === target);
}
