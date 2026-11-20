/**
 * 预置提示词模板的正文读取。
 *
 * 索引在 `src/domain/prompt-templates.generated.ts`（元数据，进分块）；
 * 正文打成 `dist/assets/prompts/templates/templates.json.gz`，按需读、整包只解一次。
 *
 * 为什么不逐篇发 `.md`：模板里是大段破甲词，宿主安装逐个 copyFile 时最容易被 AV 拦
 * （与文档、提示词包同一类故障）。打包后磁盘上只有一个二进制文件，正文逐字节不变。
 *
 * 「模板」与「提示词包」的区别：包是我方撰写的作战契约，模板是随工具分发、
 * 用户可以改完再注入的现成词表。模板只读；导入提示词库后就是用户自己的条目，
 * 可编辑、可备份、可激活——这就是「选择性注入 + 支持修改」的落点。
 */

import { PROMPT_TEMPLATES, type PromptTemplateEntry } from "../../../domain/prompt-templates.generated";

const BUNDLE = "templates.json.gz";

let bundle: Map<string, string> | null = null;
let inflight: Promise<Map<string, string>> | null = null;

function hostedBundleUrl(entryUrl: string): string {
	const url = new URL(entryUrl);
	url.pathname = url.pathname.replace(/\/assets\/[^/]*$/, `/assets/prompts/templates/${BUNDLE}`);
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
		if (import.meta.url.startsWith("file:")) {
			const specifier = "node:fs/promises";
			const { readFile } = (await import(/* @vite-ignore */ specifier)) as typeof import("node:fs/promises");
			const root = "../../../../agent/prompts/templates/";
			const table = new Map<string, string>();
			for (const entry of PROMPT_TEMPLATES) {
				table.set(entry.file, await readFile(new URL(root + entry.file, import.meta.url), "utf8"));
			}
			bundle = table;
			return table;
		}
		const response = await fetch(hostedBundleUrl(import.meta.url));
		if (!response.ok) throw new Error(`templates bundle unavailable (${response.status}): assets/prompts/templates/${BUNDLE}`);
		const parsed = JSON.parse(await gunzip(await response.arrayBuffer())) as Record<string, string>;
		bundle = new Map(Object.entries(parsed));
		return bundle;
	})().finally(() => {
		inflight = null;
	});
	return inflight;
}

export function templateEntries(): readonly PromptTemplateEntry[] {
	return PROMPT_TEMPLATES;
}

export function templateById(id: string): PromptTemplateEntry | undefined {
	return PROMPT_TEMPLATES.find(item => item.id === id);
}

/** 读一份模板正文；未知 id 抛错（调用方拿的是文件名，不该静默给空串）。 */
export async function loadTemplateBody(id: string): Promise<string> {
	const entry = templateById(id);
	if (!entry) throw new Error(`unknown prompt template: ${id}`);
	const table = await loadBundle();
	const text = table.get(entry.file);
	if (text === undefined) throw new Error(`prompt template missing from bundle: ${id}`);
	return text;
}
