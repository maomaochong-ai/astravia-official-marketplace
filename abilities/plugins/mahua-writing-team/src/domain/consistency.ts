/**
 * 跨章一致性：只查"读事实就能判定"的矛盾。
 *
 * 上游把这一层做成可插拔 checker；插件里收敛成一组固定检查，每条都返回 catalog key，
 * 由调用方决定怎么展示。这里不做风格判断，也不读时钟。
 */

import type { Finding, NovelBook } from "./novel-types.js";
import { arcForChapter } from "./novel-flow.js";

export function checkConsistency(book: NovelBook): Finding[] {
	const findings: Finding[] = [];
	const arcs = book.volumes.flatMap((volume) => volume.arcs);

	for (const chapter of book.chapters) {
		if (!arcForChapter(book.volumes, chapter.n)) {
			findings.push({ code: "consistency.chapterOutsideArc", severity: "error", detail: String(chapter.n) });
		}
		if (chapter.facts) {
			const unknown = chapter.facts.characters.filter((name) => !book.cast.includes(name));
			for (const name of unknown) {
				findings.push({ code: "consistency.unknownCharacter", severity: "warning", detail: `${chapter.n}:${name}` });
			}
		}
	}

	for (let index = 1; index < arcs.length; index += 1) {
		const previous = arcs[index - 1];
		const current = arcs[index];
		if (current.from <= previous.to) {
			findings.push({ code: "consistency.arcOverlap", severity: "error", detail: `${previous.id}/${current.id}` });
		}
	}

	for (const n of book.progress.pendingRewrite) {
		const chapter = book.chapters.find((item) => item.n === n);
		if (chapter?.status === "committed") {
			findings.push({ code: "consistency.rewriteOnCommitted", severity: "error", detail: String(n) });
		}
	}

	for (const item of book.feedback) {
		if (item.status !== "open") continue;
		const chapter = book.chapters.find((candidate) => candidate.n === item.chapter);
		if (chapter?.status === "committed") {
			findings.push({ code: "consistency.feedbackOnCommitted", severity: "warning", detail: String(item.chapter) });
		}
	}

	if (book.foundation) {
		const missing = (["theme", "conflict", "protagonist", "ending"] as const).filter(
			(key) => book.foundation?.[key].trim().length === 0,
		);
		if (missing.length > 0) {
			findings.push({ code: "consistency.foundationIncomplete", severity: "info", detail: missing.join(",") });
		}
	}

	const numbered = book.chapters
		.filter((chapter) => chapter.status === "committed")
		.map((chapter) => chapter.n)
		.sort((a, b) => a - b);
	for (let index = 0; index < numbered.length; index += 1) {
		if (numbered[index] !== index + 1) {
			findings.push({ code: "consistency.committedGap", severity: "warning", detail: String(numbered[index]) });
			break;
		}
	}

	return findings;
}
