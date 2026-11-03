/**
 * The two payloads the agent reads back: how far a batch got, and what the page
 * looks like. They are plain data — the tool result layer turns them into text.
 *
 * ADR: docs/adr/<slug>/craft-0013-nothing-runs-in-the-background.md
 */

export interface CraftProgress {
	index: number;
	total: number;
	label: string;
}

export interface CraftProbe {
	region: string;
	columns: number;
	rows: number;
	/** One letter per cell, `\n` between rows. */
	cells: string;
	/** Mean luma, 0–255. */
	mean: number;
	meanRgb: [number, number, number];
	/** 0–1: luminance spread across the sampled cells. */
	contrast: number;
	width: number;
	height: number;
}

export interface CraftChange {
	changed: boolean;
	distance: number;
}

/** RGB distance between two probes, 0–441. Anything above 6 is a visible change. */
export function changedSince(before: CraftProbe | null, after: CraftProbe | null): CraftChange {
	if (!before || !after) return { changed: false, distance: 0 };
	const [r1, g1, b1] = before.meanRgb;
	const [r2, g2, b2] = after.meanRgb;
	const distance = Math.round(Math.hypot(r1 - r2, g1 - g2, b1 - b2));
	const cellsDiffer = before.cells !== after.cells;
	return { changed: distance > 6 || cellsDiffer, distance };
}
