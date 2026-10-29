import type { BundledReference, ReferenceKind } from "./reference-types.js";

/** 一次读取的默认上限，够读完一篇指南而不会把整个上下文塞满。 */
export const DEFAULT_REFERENCE_BUDGET = 6000;

export interface ReferenceEntry {
	readonly id: string;
	readonly kind: ReferenceKind;
	readonly title: string;
	/** 正文开头的一段，用来让人在目录里认出这篇讲什么。 */
	readonly excerpt: string;
}

export interface ReferencePage {
	readonly id: string;
	readonly kind: ReferenceKind;
	readonly title: string;
	readonly body: string;
	readonly truncated: boolean;
}

function excerptOf(body: string): string {
	const paragraph = body
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("|") && !line.startsWith("---"))
		.find((line) => !line.startsWith(">"));
	return (paragraph ?? "").slice(0, 120);
}

/** 目录：按 kind 过滤，缺省列全部。给「先看看有哪些」用，不带正文。 */
export function listReferences(
	library: readonly BundledReference[],
	options: { readonly kind?: ReferenceKind } = {},
): readonly ReferenceEntry[] {
	return library
		.filter((entry) => (options.kind ? entry.kind === options.kind : true))
		.map((entry) => ({
			id: entry.id,
			kind: entry.kind,
			title: entry.title,
			excerpt: excerptOf(entry.body),
		}));
}

/**
 * 读一篇。预算按字符算，截断处补齐到行尾并标 `truncated`——半句话比没有更误导人，
 * 所以宁可少一行。找不到时返回 null，由工具层翻成 reason key。
 */
export function readReference(
	library: readonly BundledReference[],
	id: string,
	budget: number = DEFAULT_REFERENCE_BUDGET,
): ReferencePage | null {
	const entry = library.find((candidate) => candidate.id === id);
	if (!entry) return null;
	if (budget <= 0 || entry.body.length <= budget) {
		return { id: entry.id, kind: entry.kind, title: entry.title, body: entry.body, truncated: false };
	}
	const slice = entry.body.slice(0, budget);
	const lastBreak = slice.lastIndexOf("\n");
	const body = lastBreak > 0 ? slice.slice(0, lastBreak) : slice;
	return { id: entry.id, kind: entry.kind, title: entry.title, body, truncated: true };
}
