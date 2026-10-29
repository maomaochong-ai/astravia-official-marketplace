/**
 * 故事前提的结构化解析（对齐上游 `internal/tools/premise_structure.go`）。
 *
 * 作者交来的是一段带小标题的长文，`Foundation` 要的是六个字段。这里只做两件事：
 * 按标题切节、把能归位的节填进字段名。**不做语义判断**——抽不到就说抽不到，
 * 不猜"这段大概是在讲冲突"。所有结论都是 code，不出自然语言（领域层纪律）。
 */

import type { Finding, Foundation } from "./novel-types.js";
import { keyOf, type PremiseSectionKey } from "./premise-vocabulary.js";

export type { PremiseSectionKey };

export interface PremiseSection {
	/** null 表示标题没被任何别名认领（或无标题的散行），内容照样保留在 body 里。 */
	key: PremiseSectionKey | null;
	heading: string;
	body: string;
}

export interface PremiseParse {
	/** 按出现顺序排列的全部小节。 */
	sections: PremiseSection[];
	/** 抽到的设定字段。没抽到的键不存在，不是空串——空串会让人以为"作者写了但是空的"。 */
	foundation: Partial<Foundation>;
	cast: string[];
	/** 未归位的标题，原样返回给作者自己判断。 */
	unknownHeadings: string[];
}

/** 体检必填项：与 `auditFoundation` 同一条判据，只是输入从"已存的书"换成"一段文本"。 */
const REQUIRED: readonly (keyof Foundation)[] = ["theme", "conflict", "protagonist", "ending"];

const MARKDOWN_HEADING = /^#{1,6}\s+(.+?)\s*#*$/;
const BOLD_HEADING = /^\*\*(.+?)\*\*\s*[:\uFF1A]?\s*(.*)$/;
/** 冒号式只认"冒号前是已知别名"的行，否则「他说：走吧」也会被当成标题。 */
const COLON_HEADING = /^([^:\uFF1A]{1,24})[:\uFF1A]\s*(.*)$/;

interface HeadingMark {
	/** 标题所在行号。 */
	line: number;
	heading: string;
	key: PremiseSectionKey | null;
	/** `**标题**内容` 这种把正文写在同一行的写法。 */
	inline: string;
}

function markAt(line: string): { heading: string; inline: string } | null {
	const markdown = MARKDOWN_HEADING.exec(line);
	if (markdown) return { heading: markdown[1]!, inline: "" };

	const bold = BOLD_HEADING.exec(line.trim());
	if (bold) return { heading: bold[1]!, inline: bold[2] ?? "" };

	const colon = COLON_HEADING.exec(line.trim());
	if (colon && keyOf(colon[1]!) !== null) return { heading: colon[1]!, inline: colon[2] ?? "" };

	return null;
}

/**
 * 解析一段前提。
 *
 * 认三种标题写法：Markdown 的 `#`–`######`、整行加粗 `**标题**`、以及冒号式 `标题：内容`。
 * 其余行一律算上一节的内容；第一个标题之前的散行归入一个无标题的小节。
 */
export function parsePremise(text: string): PremiseParse {
	const lines = text.split(/\r?\n/);
	const marks: HeadingMark[] = [];

	lines.forEach((line, index) => {
		const found = markAt(line);
		if (found) marks.push({ line: index, heading: found.heading.trim(), key: keyOf(found.heading), inline: found.inline });
	});

	const sections: PremiseSection[] = [];
	const prefaceEnd = marks[0]?.line ?? lines.length;
	const preface = lines.slice(0, prefaceEnd).join("\n").trim();
	if (preface) sections.push({ key: null, heading: "", body: preface });

	marks.forEach((mark, index) => {
		const end = marks[index + 1]?.line ?? lines.length;
		const body = [mark.inline, ...lines.slice(mark.line + 1, end)].join("\n").trim();
		sections.push({ key: mark.key, heading: mark.heading, body });
	});

	const foundation: Partial<Foundation> = {};
	let cast: string[] = [];
	for (const section of sections) {
		if (!section.key || !section.body) continue;
		if (section.key === "cast") {
			if (cast.length === 0) cast = splitCast(section.body);
			continue;
		}
		if (section.key === "plan") continue;
		if (foundation[section.key]) continue;
		foundation[section.key] = collapse(section.body);
	}

	return {
		sections,
		foundation,
		cast,
		unknownHeadings: sections.filter((section) => !section.key && section.heading).map((section) => section.heading),
	};
}

/** 体检：三个 code，严重度沿用 `Finding`。 */
export function auditPremise(text: string): Finding[] {
	const parsed = parsePremise(text);
	// 一个标题都没认出来时不接着报四五条 missing：真正的问题在更前面，
	// 报一堆缺项只会让作者去补字段，而不是去补小标题。
	if (!parsed.sections.some((section) => section.key !== null)) {
		return [{ code: "premise.noSections", severity: "error" }];
	}

	const findings: Finding[] = [];
	for (const field of REQUIRED) {
		if (!parsed.foundation[field]) findings.push({ code: "premise.missing", severity: "error", detail: field });
	}
	if (parsed.cast.length === 0) findings.push({ code: "premise.noCast", severity: "warning" });
	return findings;
}

/** 多行正文压成一行：设定字段是一句话的位置，不保留排版。 */
function collapse(body: string): string {
	return body.replace(/\s+/g, " ").trim();
}

/** 演员表按标点与换行切，去重保序。 */
function splitCast(body: string): string[] {
	const names = body
		.split(/[\n\u3001,\uFF0C;\uFF1B/\uFF0F|]+/)
		.map((name) => name.replace(/^[-*·\s]+/, "").trim())
		.filter((name) => name.length > 0 && name.length <= 24);
	return [...new Set(names)].slice(0, 40);
}
