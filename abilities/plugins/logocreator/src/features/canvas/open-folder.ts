import type { PluginContext } from "@astravia-org/plugin-sdk";
import { newDesignId } from "../../domain/history-store";
import { isDesignFolder, readManifest, slugOfFolder } from "../../domain/design-folder";
import { getHistoryStore } from "../../plugin-context";
import { revealInCanvas } from "./reveal";

/**
 * 从磁盘打开一份设计目录。
 *
 * 这是「在文件树里点开 `acme.logocreator-design` → 画布打开并载入它」的那条路，
 * 也是与内置设计插件对齐的关键一步：设计文档在磁盘上，画布读它，而不是只能从对话里产生。
 *
 * 设计已经存在面板历史里（同一份 spec）时直接开那一份，不重复入库；
 * 只有磁盘上有、面板没见过时才新建一条记录 —— 否则每次打开都在历史里堆一条同款。
 */
export interface OpenFolderResult {
	opened: boolean;
	/** 面板里那条记录的 id；没读到 manifest 时为 null。 */
	designId: string | null;
	error?: string;
}

export async function openDesignFolder(ctx: PluginContext, folder: string): Promise<OpenFolderResult> {
	if (!isDesignFolder(folder)) {
		return { opened: false, designId: null, error: "not-a-design-folder" };
	}
	const manifest = await readManifest(ctx.fs, folder, slugOfFolder(folder));
	if (!manifest) {
		return { opened: false, designId: null, error: "manifest-unreadable" };
	}

	const store = getHistoryStore();
	await store.hydrate().catch(() => undefined);
	const known = store.list().find(record => sameDesign(record.spec, manifest.spec));
	const designId = known?.id ?? newDesignId();
	if (!known) {
		await store
			.add({ id: designId, spec: manifest.spec, engine: "local", subject: manifest.variants.at(-1)?.subject ?? manifest.slug })
			.catch(() => undefined);
	}

	const reveal = revealInCanvas(ctx, null, designId);
	return { opened: reveal.opened, designId, ...(reveal.error ? { error: reveal.error } : {}) };
}

/**
 * 判断「磁盘上这份」与「历史里那条」是不是同一份设计。
 *
 * 比全部字段太脆（面板会来回改 nonce 一类的默认值），比 seed + 品牌 + 类型 + 风格
 * 足够区分「同一份」与「同品牌另一次起稿」，而后者本来就应该是一条新记录。
 */
function sameDesign(left: { brandName: string; seed: number; type: string; style: string }, right: { brandName: string; seed: number; type: string; style: string }): boolean {
	return left.seed === right.seed && left.brandName === right.brandName && left.type === right.type && left.style === right.style;
}
