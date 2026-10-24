/**
 * 提示词导入。
 *
 * 参考对象的 `importCurrent()` 是「把当前目标提示词文件的正文读进库」：命名带本地时间，
 * 重名追加序号，描述写明来源。插件侧没有可写的提示词文件，但用户手上有导出的 .md / .txt / .json，
 * 所以这里只做解析与命名，写库仍走 `usePromptLibrary.createPrompt`。
 */

import type { InjectMode } from "../../../domain/prompt-library";

export interface PromptDraft {
	name: string;
	description: string;
	content: string;
	mode: InjectMode;
}

const TEXT_EXTENSIONS = [".md", ".markdown", ".markdownx", ".txt", ".text", ".prompt"];

/** 文件名去掉扩展名后的基名；全空时退回 `prompt`。 */
export function baseNameOf(fileName: string): string {
	const base = fileName.split(/[\\/]+/).filter(Boolean).pop() ?? fileName;
	const dot = base.lastIndexOf(".");
	const stem = dot > 0 ? base.slice(0, dot) : base;
	return stem.trim().length > 0 ? stem.trim() : "prompt";
}

function withSuffix(base: string, index: number): string {
	return index <= 1 ? base : `${base} (${index})`;
}

/** 同名时按 ` (2)` / ` (3)` 递增，规则与参考对象的命名一致。 */
export function uniqueName(taken: readonly string[], base: string): string {
	const used = new Set(taken.map(name => name.trim()));
	if (!used.has(base)) return base;
	for (let index = 2; index < 1000; index += 1) {
		const candidate = withSuffix(base, index);
		if (!used.has(candidate)) return candidate;
	}
	return `${base} (${Date.now()})`;
}

function normalize(text: string): string {
	return text.replace(/\s+/g, "").toLowerCase();
}

/** Dice 系数（字符二元组）；CJK 与西文同一把尺子，不需要分词。 */
export function similarity(left: string, right: string): number {
	const a = normalize(left);
	const b = normalize(right);
	if (a.length === 0 || b.length === 0) return a === b ? 1 : 0;
	if (a === b) return 1;
	if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
	const bigrams = new Map<string, number>();
	for (let index = 0; index < a.length - 1; index += 1) {
		const gram = a.slice(index, index + 2);
		bigrams.set(gram, (bigrams.get(gram) ?? 0) + 1);
	}
	let hits = 0;
	for (let index = 0; index < b.length - 1; index += 1) {
		const gram = b.slice(index, index + 2);
		const remaining = bigrams.get(gram) ?? 0;
		if (remaining > 0) {
			hits += 1;
			bigrams.set(gram, remaining - 1);
		}
	}
	return (2 * hits) / (a.length - 1 + (b.length - 1));
}

export interface SimilarHit {
	name: string;
	score: number;
}

/** 导入前去重提示：返回最相似的一条，低于阈值则 null。 */
export function findSimilar(items: readonly { name: string; content: string }[], content: string, threshold = 0.9): SimilarHit | null {
	let best: SimilarHit | null = null;
	for (const item of items) {
		const score = similarity(item.content, content);
		if (score >= threshold && (!best || score > best.score)) best = { name: item.name, score };
	}
	return best;
}

function readMode(value: unknown): InjectMode {
	return value === "override" || value === "prepend" ? value : "append";
}

function draftFromRecord(record: Record<string, unknown>, fallbackName: string): PromptDraft | null {
	const content = typeof record.content === "string" ? record.content : typeof record.text === "string" ? record.text : null;
	if (content === null || content.trim().length === 0) return null;
	const name = typeof record.name === "string" && record.name.trim().length > 0 ? record.name.trim() : fallbackName;
	const description = typeof record.description === "string" ? record.description : "";
	return { name, description, content, mode: readMode(record.mode) };
}

function recordsFromJson(value: unknown): Record<string, unknown>[] {
	if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
	if (!value || typeof value !== "object") return [];
	const root = value as Record<string, unknown>;
	for (const key of ["items", "prompts"]) {
		if (Array.isArray(root[key])) return (root[key] as unknown[]).filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
	}
	if (root.library && typeof root.library === "object") {
		const nested = (root.library as Record<string, unknown>).items;
		if (Array.isArray(nested)) return nested.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
	}
	// 单条对象也接受，避免用户手写一个 {name, content} 就失败。
	return "content" in root ? [root] : [];
}

export class PromptImportError extends Error {}

/**
 * 把一个文件解析成待导入的草稿。
 *
 * - `.json`：`{items|prompts:[…]}`、数组或单条对象，逐条转成草稿（批量导入备份文件）；
 * - 其余（`.md` / `.txt` / 无扩展名）：整篇正文作为一条。
 */
export function parsePromptFile(fileName: string, text: string, source = fileName): PromptDraft[] {
	const lower = fileName.toLowerCase();
	const base = baseNameOf(fileName);
	const isJson = lower.endsWith(".json");
	if (!isJson) {
		if (text.trim().length === 0) throw new PromptImportError("empty");
		return [{ name: base, description: descriptionFor(source), content: text, mode: "append" }];
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new PromptImportError("invalid-json");
	}
	const records = recordsFromJson(parsed);
	const drafts: PromptDraft[] = [];
	for (const record of records) {
		const draft = draftFromRecord(record, base);
		if (draft) drafts.push({ ...draft, description: draft.description || descriptionFor(source) });
	}
	if (drafts.length === 0) throw new PromptImportError("empty");
	return drafts;
}

function descriptionFor(source: string): string {
	return `从 ${source} 导入`;
}

/** 批量导入时逐条改名：同名加序号，并把已用名字继续带下去。 */
export function nameDrafts(drafts: readonly PromptDraft[], taken: readonly string[]): PromptDraft[] {
	const used = [...taken];
	return drafts.map(draft => {
		const name = uniqueName(used, draft.name);
		used.push(name);
		return { ...draft, name };
	});
}

export function isTextPromptFile(name: string): boolean {
	const lower = name.toLowerCase();
	return lower.endsWith(".json") || TEXT_EXTENSIONS.some(extension => lower.endsWith(extension)) || !lower.includes(".");
}
