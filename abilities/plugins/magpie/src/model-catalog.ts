import type { PluginModelDefinition } from "@astravia-org/plugin-sdk";

/** 宿主适配器名字：magpie 的 /v1/chat/completions 是 OpenAI 兼容形态。 */
export const API_KIND = "openai-completions";

/** /v1/models 的一行，按 magpie 实际返回的字段归一化后的形态。 */
export interface MagpieModelRow {
	id: string;
	name: string;
	/** magpie 里的提供方 id（上游字段 owned_by）。 */
	provider: string;
	contextWindow?: number;
	maxOutputTokens?: number;
	reasoning: boolean;
	reasoningLevels: string[];
	images: boolean;
}

function asPositiveNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * 推理档位在 magpie 里有两份表达：`reasoning_levels`（扁平字符串数组，Catwalk 系客户端读它）
 * 与 `supported_reasoning_levels`（`[{ effort }]`）。两份都接受，先扁平后对象。
 */
function readReasoningLevels(item: Record<string, unknown>): string[] {
	const levels: string[] = [];
	const push = (value: unknown): void => {
		const text = asNonEmptyString(value);
		if (text && !levels.includes(text)) levels.push(text);
	};
	const flat = item.reasoning_levels;
	if (Array.isArray(flat)) for (const entry of flat) push(entry);
	const structured = item.supported_reasoning_levels;
	if (Array.isArray(structured)) {
		for (const entry of structured) {
			if (typeof entry === "string") push(entry);
			else if (entry && typeof entry === "object") push((entry as { effort?: unknown }).effort);
		}
	}
	return levels;
}

function readImages(item: Record<string, unknown>): boolean {
	const modalities = item.modalities;
	if (!modalities || typeof modalities !== "object") return false;
	const input = (modalities as { input?: unknown }).input;
	return Array.isArray(input) && input.some((value) => value === "image");
}

/**
 * 解析 /v1/models：OpenAI 形状 `{ object: "list", data: [{ id, owned_by, … }] }`。
 * fail-closed：形状不对的行直接丢弃，绝不猜；同一 id 只保留第一行（先到的字段更完整）。
 */
export function parseModelRows(body: unknown): MagpieModelRow[] {
	const data = (body as { data?: unknown } | null)?.data;
	if (!Array.isArray(data)) return [];
	const seen = new Set<string>();
	const rows: MagpieModelRow[] = [];
	for (const entry of data) {
		if (!entry || typeof entry !== "object") continue;
		const item = entry as Record<string, unknown>;
		const id = asNonEmptyString(item.id);
		if (!id || seen.has(id)) continue;
		seen.add(id);
		const levels = readReasoningLevels(item);
		rows.push({
			id,
			name: asNonEmptyString(item.display_name) ?? id,
			provider: asNonEmptyString(item.owned_by) ?? "",
			contextWindow:
				asPositiveNumber(item.context_window) ??
				asPositiveNumber(item.context_length) ??
				asPositiveNumber(item.max_input_tokens),
			maxOutputTokens: asPositiveNumber(item.max_output_tokens),
			reasoning: item.reasoning === true || levels.length > 0,
			reasoningLevels: levels,
			images: readImages(item),
		});
	}
	return rows.sort((a, b) => a.provider.localeCompare(b.provider, "en") || a.id.localeCompare(b.id, "en"));
}

/** 行 → 宿主模型定义；只带宿主认得的字段，没值的字段不写。 */
export function toModelDefinitions(rows: readonly MagpieModelRow[]): PluginModelDefinition[] {
	return rows.map((row) => {
		const definition: PluginModelDefinition = { id: row.id, name: row.name, api: API_KIND };
		if (row.contextWindow !== undefined) definition.contextWindow = row.contextWindow;
		if (row.maxOutputTokens !== undefined) definition.maxTokens = row.maxOutputTokens;
		if (row.reasoning) definition.reasoning = true;
		if (row.reasoningLevels.length > 0) definition.reasoningLevels = [...row.reasoningLevels];
		// `input` 在当前的 `PluginModelDefinition` 里已不存在（宿主改成了只声明 id/name/api/
		// reasoning*/context/maxTokens）。吃不吃图仍由面板自己展示（`row.images`），不能写进
		// 一个宿主不认的字段——那只是把一个无效字段名发给注册表。
		return definition;
	});
}

export interface CatalogSummary {
	total: number;
	providers: Array<{ id: string; count: number }>;
	imageCount: number;
	reasoningCount: number;
}

/** 视图顶部的一行统计：多少模型、来自几个提供方、其中多少吃图 / 支持推理。 */
export function summarizeCatalog(rows: readonly MagpieModelRow[]): CatalogSummary {
	const counts = new Map<string, number>();
	let imageCount = 0;
	let reasoningCount = 0;
	for (const row of rows) {
		const key = row.provider || "—";
		counts.set(key, (counts.get(key) ?? 0) + 1);
		if (row.images) imageCount += 1;
		if (row.reasoning) reasoningCount += 1;
	}
	return {
		total: rows.length,
		providers: [...counts.entries()]
			.map(([id, count]) => ({ id, count }))
			.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id, "en")),
		imageCount,
		reasoningCount,
	};
}

/** 视图/工具里的过滤：id、显示名、提供方任一命中即可，大小写不敏感。 */
export function filterModels(rows: readonly MagpieModelRow[], query: string): MagpieModelRow[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [...rows];
	return rows.filter(
		(row) =>
			row.id.toLowerCase().includes(needle) ||
			row.name.toLowerCase().includes(needle) ||
			row.provider.toLowerCase().includes(needle),
	);
}

/** 上下文窗口的紧凑写法：131072 → "128K"。未知返回 undefined，由调用方渲染占位。 */
export function formatContextWindow(value: number | undefined): string | undefined {
	if (value === undefined || !Number.isFinite(value) || value <= 0) return undefined;
	if (value >= 1_000_000) {
		const millions = value / 1_000_000;
		return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
	}
	if (value >= 1000) {
		const thousands = value / 1000;
		return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
	}
	return String(value);
}
