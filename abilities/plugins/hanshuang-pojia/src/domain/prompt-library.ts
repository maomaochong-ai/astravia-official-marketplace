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

/** 搜索提示词：名称、描述、正文都匹配。 */
export function searchPrompts(library: PromptLibrary, query: string): PromptItem[] {
	const q = query.trim().toLowerCase();
	if (!q) return library.items;
	return library.items.filter(item =>
		item.name.toLowerCase().includes(q) ||
		item.description.toLowerCase().includes(q) ||
		item.content.toLowerCase().includes(q),
	);
}

/** 排序：激活的排最前，其余按更新时间倒序。 */
export function sortPrompts(items: PromptItem[]): PromptItem[] {
	return [...items].sort((a, b) => {
		if (a.active !== b.active) return a.active ? -1 : 1;
		return b.updatedAt - a.updatedAt;
	});
}
