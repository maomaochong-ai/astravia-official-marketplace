/**
 * 提示词库的数据模型与纯逻辑。
 *
 * 寒霜注入工具的提示词库是核心功能：用户可以创建多套提示词、激活其中一套、
 * 在不同场景（CTF、报告、教学等）之间切换。这里实现等价的数据模型，
 * 持久化由 features 层负责（宿主私有存储），这里只做纯函数。
 */

/** 注入模式：参考寒霜注入工具的角色卡模式。 */
export type InjectMode = "override" | "append" | "prepend";

export interface PromptItem {
	id: string;
	name: string;
	description: string;
	/** 提示词正文。 */
	content: string;
	/** 注入模式：override 覆盖、append 追加、prepend 前置。 */
	mode: InjectMode;
	/** 是否激活。同一时刻最多一个激活。 */
	active: boolean;
	createdAt: number;
	updatedAt: number;
}

export interface PromptLibrary {
	items: PromptItem[];
	/** 当前激活的 prompt id，无激活时为 null。 */
	activeId: string | null;
}

export const EMPTY_LIBRARY: PromptLibrary = { items: [], activeId: null };

/** 粗略估算 token：CJK 按 1 字 ≈ 1 token，其余按 4 字符 ≈ 1 token。 */
export function estimateTokens(text: string): number {
	if (!text) return 0;
	const cjk = (text.match(/[㐀-鿿぀-ヿ가-힯]/g) ?? []).length;
	return cjk + Math.ceil((text.length - cjk) / 4);
}

export function createPrompt(input: {
	name: string;
	description?: string;
	content: string;
	mode?: InjectMode;
	now?: number;
}): PromptItem {
	const now = input.now ?? Date.now();
	return {
		id: `prompt-${now}-${Math.random().toString(36).slice(2, 8)}`,
		name: input.name.trim(),
		description: (input.description ?? "").trim(),
		content: input.content,
		mode: input.mode ?? "append",
		active: false,
		createdAt: now,
		updatedAt: now,
	};
}

export function updatePrompt(library: PromptLibrary, id: string, patch: Partial<Omit<PromptItem, "id" | "createdAt">>): PromptLibrary {
	const now = Date.now();
	return {
		...library,
		items: library.items.map(item =>
			item.id === id ? { ...item, ...patch, updatedAt: now } : item,
		),
	};
}

export function deletePrompt(library: PromptLibrary, id: string): PromptLibrary {
	const items = library.items.filter(item => item.id !== id);
	return {
		items,
		activeId: library.activeId === id ? null : library.activeId,
	};
}

/**
 * 激活指定 prompt，同时取消其他 prompt 的激活状态。
 * 同一时刻最多一个激活。
 */
export function activatePrompt(library: PromptLibrary, id: string): PromptLibrary {
	return {
		activeId: id,
		items: library.items.map(item => ({
			...item,
			active: item.id === id,
		})),
	};
}

export function deactivateAll(library: PromptLibrary): PromptLibrary {
	return {
		activeId: null,
		items: library.items.map(item => ({ ...item, active: false })),
	};
}

export function getActivePrompt(library: PromptLibrary): PromptItem | null {
	if (!library.activeId) return null;
	return library.items.find(item => item.id === library.activeId) ?? null;
}

/**
 * 让 `activeId` 成为唯一真相。
 *
 * `PromptItem.active` 曾经是第二份真相：它和 `activeId` 各自持久化、加载时各自归一化。
 * 一旦两者分叉（旧版本写入、导入别人的备份文件），卡片会显示「已激活」而注入块
 * 已经回落到默认契约 —— 界面无法把这个组合读出来。所以加载后统一走这里校正：
 * 以 `activeId` 为准；它丢了但有条目自称激活，就采信那一条；指向不存在的条目就清空。
 */
export function reconcileActive(library: PromptLibrary): PromptLibrary {
	const declared = library.activeId && library.items.some(item => item.id === library.activeId) ? library.activeId : null;
	const activeId = declared ?? library.items.find(item => item.active)?.id ?? null;
	return {
		activeId,
		items: library.items.map(item => ({ ...item, active: item.id === activeId })),
	};
}

/** 搜索命中：提示词本身 + 一段可展示的上下文。 */
export interface PromptHit {
	prompt: PromptItem;
	/** 只在正文命中时非空：名称/描述里已经写着关键词，不必再截一段。 */
	snippet: string | null;
}

/** 卡片上 snippet 的长度：够看清上下文，又不至于把卡片撑成一段文章。 */
const SNIPPET_RADIUS = 42;

function snippetAround(content: string, needle: string): string {
	const flat = content.replace(/\s+/g, " ").trim();
	const index = flat.toLowerCase().indexOf(needle);
	if (index < 0) return flat.slice(0, SNIPPET_RADIUS * 2);
	const start = Math.max(0, index - SNIPPET_RADIUS);
	const end = Math.min(flat.length, index + needle.length + SNIPPET_RADIUS);
	return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

/**
 * 搜索提示词并说明「为什么它被列出来」。
 *
 * `searchPrompts` 同时匹配正文，但卡片只展示名称与描述：只命中正文时，用户看到的是一张
 * 没有关键词的卡，会以为搜索坏了。这里补上命中位置，命中在名称/描述时为 null。
 */
export function searchPromptHits(library: PromptLibrary, query: string): PromptHit[] {
	const q = query.trim().toLowerCase();
	if (!q) return library.items.map(prompt => ({ prompt, snippet: null }));
	const hits: PromptHit[] = [];
	for (const prompt of library.items) {
		const named = prompt.name.toLowerCase().includes(q) || prompt.description.toLowerCase().includes(q);
		const inBody = prompt.content.toLowerCase().includes(q);
		if (!named && !inBody) continue;
		hits.push({ prompt, snippet: named ? null : snippetAround(prompt.content, q) });
	}
	return hits;
}

/** 搜索提示词：名称、描述、正文都匹配（只要 id 列表，用 searchPromptHits 拿命中位置）。 */
export function searchPrompts(library: PromptLibrary, query: string): PromptItem[] {
	return searchPromptHits(library, query).map(hit => hit.prompt);
}

/** 排序：激活的排最前，其余按更新时间倒序。 */
export function sortPrompts(items: PromptItem[]): PromptItem[] {
	return [...items].sort((a, b) => {
		if (a.active !== b.active) return a.active ? -1 : 1;
		return b.updatedAt - a.updatedAt;
	});
}
