/**
 * 提示词包正文的读取：与文档同一套思路 —— **打包时合成一份 gzip，运行时整包解压后按 id 取**。
 *
 * 为什么不再逐篇发 `assets/packs/<id>.md`：宿主安装是逐个 `copyFile`，而破甲研究语料
 * 是安全软件最敏感的那类文本；单文件被拦一次，整次安装就失败（与文档侧同一故障）。
 * 打包后磁盘上只有一个二进制文件，正文逐字节不变。
 *
 * 三条运行形态与 `docs-bodies.ts` 一致：
 *   - `file:`（vitest）：直接读源目录，测试看的就是要发布的那份字节；
 *   - `astravia-plugin:`（装进宿主）：读 `assets/packs/packs.json.gz`；
 *   - dev server：读源目录。
 */

import { packById, type PromptPackTemplate, packTemplate } from "../../../domain/inject/packs";

const PACK_PREFIX = "src/content/packs/";
const BUNDLE = "packs.json.gz";

/** 解压后的正文表：文件名 → 全文（含 front matter）。整包只解一次。 */
let bundle: Map<string, string> | null = null;
let inflight: Promise<Map<string, string>> | null = null;

function hostedBundleUrl(entryUrl: string): string {
	const url = new URL(entryUrl);
	url.pathname = url.pathname.replace(/\/assets\/[^/]*$/, `/assets/packs/${BUNDLE}`);
	return url.toString();
}

async function gunzip(bytes: ArrayBuffer): Promise<string> {
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
	return new Response(stream).text();
}

function loadBundle(): Promise<Map<string, string>> {
	if (bundle) return Promise.resolve(bundle);
	if (inflight) return inflight;
	inflight = (async () => {
		const response = await fetch(hostedBundleUrl(import.meta.url));
		if (!response.ok) throw new Error(`packs bundle unavailable (${response.status}): assets/packs/${BUNDLE}`);
		const parsed = JSON.parse(await gunzip(await response.arrayBuffer())) as Record<string, string>;
		bundle = new Map(Object.entries(parsed));
		return bundle;
	})().finally(() => {
		inflight = null;
	});
	return inflight;
}

/** 读一个包的原文（带 front matter）；缺条目抛错而不是返回空串。 */
export async function loadPackBody(id: string): Promise<string> {
	if (!packById(id)) throw new Error(`unknown prompt pack: ${id}`);

	if (import.meta.url.startsWith("file:")) {
		const specifier = "node:fs/promises";
		const { readFile } = (await import(/* @vite-ignore */ specifier)) as typeof import("node:fs/promises");
		const text = await readFile(new URL(`../../../../${PACK_PREFIX}${id}.md`, import.meta.url), "utf8");
		return stripFrontMatter(text);
	}
	if (!import.meta.url.startsWith("astravia-plugin:")) {
		const response = await fetch(new URL(`/${PACK_PREFIX}${id}.md`, import.meta.url).toString());
		if (!response.ok) throw new Error(`prompt pack unavailable (${response.status}): ${id}`);
		return stripFrontMatter(await response.text());
	}

	const table = await loadBundle();
	const text = table.get(`${id}.md`);
	if (text === undefined) throw new Error(`prompt pack missing from bundle: ${id}`);
	return stripFrontMatter(text);
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
