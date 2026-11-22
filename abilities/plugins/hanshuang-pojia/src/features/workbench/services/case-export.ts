import { readPrecedentDoc, type ShippedPrecedent } from "../../../domain/case/precedents";

/**
 * 先例与案例的导出正文。
 *
 * 放在 service 里而不是页面里：它是「导出什么」的合同，页面只负责把它交给下载。
 * 三种粒度对应三种真实诉求：
 *   · 单篇 —— 我正在读的这一页，带走给同事看；
 *   · 整包 —— 这份先例的全部方法文档，照着做的人需要上下文；
 *   · 清单 —— 这一屏有哪些可用的，几十条时先看目录再决定读哪份。
 *
 * 读不到正文时不静默跳过：少一篇而没有任何提示，读者会以为那份本来就是空的。
 */

export interface CaseListItem {
	name: string;
	path: string;
	inScope: number;
	evidenceCount: number;
}

function stamp(at: Date): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

export function headingLine(heading: string, count: number, at = new Date()): string {
	return `# ${heading}\n\n_${count} 项 · ${stamp(at)}_\n`;
}

/** 一份先例的索引条目：标题、包路径、分类、信号、文档清单。 */
export function precedentEntry(precedent: ShippedPrecedent): string {
	return [
		`## ${precedent.title}`,
		"",
		`- package: \`cases/${precedent.slug}/\``,
		`- category: ${precedent.category} · completeness: ${precedent.completeness}`,
		`- preset: \`${precedent.preset}\``,
		`- summary: ${precedent.summary}`,
		`- signals: ${precedent.signals.join(", ") || "—"}`,
		`- docs: ${precedent.docs.map(doc => doc.id).join(", ") || "—"}`,
		...(precedent.caseDocs.length > 0 ? [`- case study: ${precedent.caseDocs.join(", ")}`] : []),
		"- scope: `auth.status=pending` — copy it, then re-declare scope with init_task",
	].join("\n");
}

export function precedentIndexMarkdown(items: readonly ShippedPrecedent[], heading: string): string {
	const body = items.map(precedentEntry).join("\n\n---\n\n");
	return `${headingLine(heading, items.length)}\n${body}\n`;
}

/** 我的案例清单：只有元信息。正文在 workspace 里，导出清单是为了「知道有哪几份」。 */
export function caseIndexMarkdown(items: readonly CaseListItem[], heading: string): string {
	const body = items
		.map(item =>
			[
				`## ${item.name}`,
				"",
				`- path: \`${item.path}\``,
				`- in scope: ${item.inScope} · evidence: ${item.evidenceCount}`,
			].join("\n"),
		)
		.join("\n\n---\n\n");
	return `${headingLine(heading, items.length)}\n${body}\n`;
}

/** 整包正文：按包内 docs 的顺序读，读不到的那一篇留一行标记。 */
export async function precedentPackageMarkdown(precedent: ShippedPrecedent): Promise<string> {
	const parts: string[] = [
		`# ${precedent.title}`,
		"",
		`> ${precedent.summary}`,
		"",
		`- package: \`cases/${precedent.slug}/\``,
		`- category: ${precedent.category} · completeness: ${precedent.completeness} · preset: \`${precedent.preset}\``,
		`- signals: ${precedent.signals.join(", ") || "—"}`,
		`- tools: ${precedent.tools.tools.map(tool => `${tool.id} (${tool.entry})`).join(", ") || "—"} · runtime: ${precedent.tools.runtime}`,
		"",
		`> scope: \`auth.status=pending\` — 这是方法先例，不是授权。复制成自己的案例后用 init_task 重新声明范围。`,
	];

	if (precedent.docs.length === 0) {
		parts.push("", "_这份先例没有方法文档。_");
		return `${parts.join("\n")}\n`;
	}

	for (const doc of precedent.docs) {
		const text = await readPrecedentDoc(precedent, doc.id).catch(() => undefined);
		parts.push("", "---", "", `<!-- ${doc.id} -->`, "", text ?? `\`${doc.id}\` 读不到（包内缺这一份，或在项目外）。`, "");
	}
	return `${parts.join("\n")}\n`;
}

/** 单篇：带上包路径与文档 id，脱离面板也知道它来自哪里。 */
export async function precedentDocMarkdown(precedent: ShippedPrecedent, id: string): Promise<string | null> {
	const text = await readPrecedentDoc(precedent, id).catch(() => undefined);
	if (text === undefined) return null;
	return [
		`# ${precedent.title} · ${id}`,
		"",
		`> 来自 \`cases/${precedent.slug}/\` · 随包先例 · 范围待定（auth.status=pending）`,
		"",
		text,
	].join("\n");
}
