import { SHIPPED_PRECEDENTS, shippedPrecedentSlugs, type ShippedPrecedent } from "./precedents.generated";

export { SHIPPED_PRECEDENTS, shippedPrecedentSlugs };
export type { ShippedPrecedent };

/**
 * 随包先例：`cases/` 下已归档的案例形状，编译期内联成文本（见 scripts/sync-precedents.mjs）。
 *
 * 它们是方法级先例，不是授权、不含样本字节。匹配只看先例自己写下的信号与正文，
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
const BODY_WEIGHT = 1;

/** 正文小写缓存：同一进程里先例不会变，重复查询不该反复拼 20 KB 字符串。 */
const bodyCache = new Map<string, string>();

function bodyOf(precedent: ShippedPrecedent): string {
	const cached = bodyCache.get(precedent.slug);
	if (cached !== undefined) return cached;
	const body = precedent.docs.map(doc => doc.text).join("\n").toLowerCase();
	bodyCache.set(precedent.slug, body);
	return body;
}

export function findPrecedent(slug: string): ShippedPrecedent | undefined {
	return SHIPPED_PRECEDENTS.find(precedent => precedent.slug === slug);
}

export function precedentDoc(precedent: ShippedPrecedent, id: string): string | undefined {
	return precedent.docs.find(doc => doc.id === id)?.text;
}

export function rankPrecedents(query: string | undefined, limit = 5): PrecedentHit[] {
	const tokens = (query ?? "")
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean);

	const hits: PrecedentHit[] = SHIPPED_PRECEDENTS.map(precedent => {
		const reasons: string[] = [];
		let matched = 0;
		const title = `${precedent.title} ${precedent.summary}`.toLowerCase();
		const body = tokens.length > 0 ? bodyOf(precedent) : "";

		for (const token of tokens) {
			if (precedent.signals.some(signal => signal.toLowerCase().includes(token))) {
				matched += SIGNAL_WEIGHT;
				reasons.push(`signal matches "${token}"`);
				continue;
			}
			if (title.includes(token)) {
				matched += TITLE_WEIGHT;
				reasons.push(`title matches "${token}"`);
				continue;
			}
			if (body.includes(token)) {
				matched += BODY_WEIGHT;
				reasons.push(`method text mentions "${token}"`);
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
 * 只在这一处输出正文——列表接口仍然只给路径与理由，不把 2 KB 正文塞进每一次查询。
 */
export function renderPrecedentPackage(precedent: ShippedPrecedent): string {
	const head = [...renderPrecedentHit({ precedent, score: 0, matched: 0, reasons: ["requested by slug"] })];
	return [head, "", ...precedent.docs.flatMap(doc => [`#### ${doc.id}`, "", doc.text, ""])].join("\n");
}
