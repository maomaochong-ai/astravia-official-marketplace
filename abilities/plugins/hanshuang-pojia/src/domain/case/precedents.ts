import { readCaseText } from "./scaffold";
import { SHIPPED_PRECEDENTS, shippedPrecedentSlugs, type ShippedPrecedent } from "./precedents.generated";

export { SHIPPED_PRECEDENTS, shippedPrecedentSlugs };
export type { ShippedPrecedent };

/**
 * 随包先例：`cases/` 下已归档的案例形状，索引在编译期内联，正文按需读取
 * （见 scripts/sync-precedents.mjs）。
 *
 * 它们是方法级先例，不是授权、不含样本字节。匹配只看先例自己写下的信号与摘要，
 * 与操作者 cases/ 下的真实案例分开排名，避免「没打过这个目标」被先例命中读成「打过」。
 */
export interface PrecedentHit {
	precedent: ShippedPrecedent;
	/** 排序分。 */
	score: number;
	/** 只由查询词贡献的分；过滤用它。 */
	matched: number;
	reasons: string[];
}

const SIGNAL_WEIGHT = 6;
const TITLE_WEIGHT = 3;
const SUMMARY_WEIGHT = 1;

export function findPrecedent(slug: string): ShippedPrecedent | undefined {
	return SHIPPED_PRECEDENTS.find(precedent => precedent.slug === slug);
}

/** 会话内正文缓存：同一篇在面板里来回切不该反复抓包。键是 `slug/id`，一篇几 KB。 */
const docCache = new Map<string, string>();

/**
 * 读一份先例正文。正文不在分块里，按包相对路径从 assets/cases/<slug>/ 取；
 * 不在该包 docs 清单里的 id 直接是 undefined —— 不靠字符串拼出一个不存在的路径。
 */
export async function readPrecedentDoc(precedent: ShippedPrecedent, id: string): Promise<string | undefined> {
	if (!precedent.docs.some(doc => doc.id === id)) return undefined;
	const key = `${precedent.slug}/${id}`;
	const cached = docCache.get(key);
	if (cached !== undefined) return cached;
	const text = await readCaseText(`cases/${precedent.slug}/${id}`);
	docCache.set(key, text);
	return text;
}

export function rankPrecedents(query: string | undefined, limit = 5): PrecedentHit[] {
	const tokens = (query ?? "")
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean);

	const hits: PrecedentHit[] = SHIPPED_PRECEDENTS.map(precedent => {
		const reasons: string[] = [];
		let matched = 0;
		const headline = `${precedent.title} ${precedent.summary}`.toLowerCase();
		const summary = precedent.summary.toLowerCase();

		for (const token of tokens) {
			if (precedent.signals.some(signal => signal.toLowerCase().includes(token))) {
				matched += SIGNAL_WEIGHT;
				reasons.push(`signal matches "${token}"`);
				continue;
			}
			if (precedent.title.toLowerCase().includes(token)) {
				matched += TITLE_WEIGHT;
				reasons.push(`title matches "${token}"`);
				continue;
			}
			if (summary.includes(token) || headline.includes(token)) {
				matched += SUMMARY_WEIGHT;
				reasons.push(`summary mentions "${token}"`);
			}
		}

		if (tokens.length === 0) {
			reasons.push("no query: listing every shipped precedent");
			// 无查询时按 id 稳定排序，不让「谁先写」决定顺序。
			matched = 1;
		}
		return { precedent, score: matched, matched, reasons };
	});

	const filtered = tokens.length > 0 ? hits.filter(hit => hit.matched > 0) : hits;
	filtered.sort((a, b) => b.score - a.score || a.precedent.slug.localeCompare(b.precedent.slug));
	return filtered.slice(0, Math.max(0, limit));
}

export function renderPrecedentHit(hit: PrecedentHit): string {
	const { precedent } = hit;
	return [
		`### ${precedent.title} — shipped precedent (${precedent.slug})`,
		"",
		`- ${precedent.summary}`,
		`- signals: ${precedent.signals.join(", ")}`,
		`- start from preset: ${precedent.preset}`,
		`- package: cases/${precedent.slug}/ (${precedent.docs.map(doc => doc.id).join(", ")})`,
		`- field notes: ${precedent.fieldNotes.join(", ")}`,
		...(precedent.caseDocs.length > 0
			? [`- full case study: ${precedent.caseDocs.map(id => `${id} (read_doc)`).join(", ")}`]
			: []),
		...renderToolLine(precedent),
		`- why: ${hit.reasons.join("; ")}`,
		`- scope: the shipped copy declares auth.status=pending — copy it, then re-declare scope with init_task`,
	].join("\n");
}

export function renderPrecedentIndex(hits: readonly PrecedentHit[], query?: string): string {
	const trimmed = query?.trim() ?? "";
	if (hits.length === 0) {
		return [
			`No shipped precedent matches "${trimmed}".`,
			"",
			`Available: ${SHIPPED_PRECEDENTS.map(precedent => precedent.slug).join(", ")}.`,
		].join("\n");
	}
	const head = `Shipped precedents — ${hits.length} of ${SHIPPED_PRECEDENTS.length}`;
	return [head, "", ...hits.flatMap(hit => [renderPrecedentHit(hit), ""])].join("\n");
}

/**
 * 整包正文：`search_cases` 的 `precedent` 入参用它把一份方法级先例完整交回对话。
 * 只在这一处输出正文——列表接口仍然只给路径与理由，正文按包内文件逐个读取，
 * 所以这个函数是异步的。
 */
export async function renderPrecedentPackage(precedent: ShippedPrecedent): Promise<string> {
	const head = [...renderPrecedentHit({ precedent, score: 0, matched: 0, reasons: ["requested by slug"] })];
	const bodies: string[] = [];
	for (const doc of precedent.docs) {
		bodies.push(`#### ${doc.id}`, "", (await readPrecedentDoc(precedent, doc.id)) ?? "", "");
	}
	return [head, "", ...bodies].join("\n");
}

/**
 * 工具行：先例包里能直接跑的东西。这一行是「方法摘要」与「工程现场」的分界，
 * 没有它，读到先例的 Agent 只会照着写字，不会去跑。
 */
function renderToolLine(precedent: ShippedPrecedent): string[] {
	const toolList = precedent.tools?.tools ?? [];
	if (toolList.length === 0) return [];
	const entries = toolList.map(tool => `${tool.id} (${tool.entry})`).join(", ");
	return [`- tools: ${entries} — write them with scaffold_case, then run \`--self-test\` before trusting them`];
}
