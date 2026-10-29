/**
 * 章级事实抽取：从正文里确定性地取出「谁出场、怎么开、怎么收」。
 *
 * 上游用 LLM 抽 chapterfacts；插件里这一层必须是纯函数，否则每次读章都要花一次模型调用。
 * 因此只做四件事：演员表匹配、首句、末句、去重。抽不到就返回空，不猜。
 */

import type { ChapterFacts } from "./novel-types.js";

function firstSentence(text: string): string {
	const trimmed = text.trim();
	const match = trimmed.match(/^[^\n]{0,200}?(?:[\u3002\uff01\uff1f!?\u2026]|\.(?=\s|$))/);
	return (match?.[0] ?? trimmed.split("\n")[0] ?? "").trim();
}

function lastLine(text: string): string {
	const lines = text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	return lines[lines.length - 1] ?? "";
}

export function extractChapterFacts(text: string, cast: readonly string[]): ChapterFacts {
	const seen: string[] = [];
	for (const name of cast) {
		const trimmed = name.trim();
		if (trimmed.length > 0 && text.includes(trimmed) && !seen.includes(trimmed)) seen.push(trimmed);
	}
	return { characters: seen, opening: firstSentence(text), closing: lastLine(text) };
}
