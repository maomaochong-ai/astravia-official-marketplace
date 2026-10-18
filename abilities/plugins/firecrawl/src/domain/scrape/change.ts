/**
 * `changeTracking`: what changed on a page since the stored copy.
 *
 * firecrawl diffs against its own stored snapshot; the plugin stores the copy
 * itself (see `cache.ts`), so the same report can be produced offline.
 *
 * The diff is a line-level multiset difference, not a sequence alignment: it is
 * O(n) instead of O(n·m), which matters because a page's Markdown routinely runs
 * to thousands of lines inside a 300 s tool budget. The trade-off is honest and
 * reported in the output: moved lines count as unchanged, order is not tracked.
 */

export type ChangeStatus = "new" | "same" | "changed";

export interface ChangeReport {
	changeStatus: ChangeStatus;
	/** ISO timestamp of the stored copy this was compared against, if any. */
	previousScrapeAt: string | null;
	addedLines: number;
	removedLines: number;
	/** `+`/`-` prefixed excerpt, first `maxLines` differing lines. */
	diff: string;
}

const MAX_DIFF_LINES = 40;
const MAX_LINE_LENGTH = 300;

export function describeChanges(
	previousMarkdown: string | null,
	previousStoredAt: number | null,
	currentMarkdown: string,
	maxLines = MAX_DIFF_LINES,
): ChangeReport {
	if (previousMarkdown === null) {
		return { changeStatus: "new", previousScrapeAt: null, addedLines: 0, removedLines: 0, diff: "" };
	}

	const previousCounts = countLines(previousMarkdown);
	const currentCounts = countLines(currentMarkdown);

	const lines: string[] = [];
	let added = 0;
	let removed = 0;

	for (const [line, count] of currentCounts) {
		const before = previousCounts.get(line) ?? 0;
		if (count <= before) continue;
		const extra = count - before;
		added += extra;
		pushLines(lines, "+", line, extra, maxLines);
	}
	for (const [line, count] of previousCounts) {
		const after = currentCounts.get(line) ?? 0;
		if (count <= after) continue;
		const extra = count - after;
		removed += extra;
		pushLines(lines, "-", line, extra, maxLines);
	}

	return {
		changeStatus: added === 0 && removed === 0 ? "same" : "changed",
		previousScrapeAt: previousStoredAt === null ? null : new Date(previousStoredAt).toISOString(),
		addedLines: added,
		removedLines: removed,
		diff: lines.slice(0, maxLines).join("\n"),
	};
}

function countLines(markdown: string): Map<string, number> {
	const counts = new Map<string, number>();
	for (const raw of markdown.split("\n")) {
		const line = raw.trim();
		if (!line) continue;
		counts.set(line, (counts.get(line) ?? 0) + 1);
	}
	return counts;
}

function pushLines(target: string[], marker: "+" | "-", line: string, repeat: number, maxLines: number): void {
	for (let index = 0; index < repeat; index += 1) {
		if (target.length >= maxLines) return;
		const text = line.length > MAX_LINE_LENGTH ? `${line.slice(0, MAX_LINE_LENGTH)}…` : line;
		target.push(`${marker} ${text}`);
	}
}
