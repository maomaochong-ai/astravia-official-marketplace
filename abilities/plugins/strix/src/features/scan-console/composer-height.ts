/**
 * The composer's height, and which way dragging it goes.
 *
 * Two things live here and nowhere else:
 *
 *  - **direction.** Dragging the top edge *up* must make the box *taller*. That is one
 *    subtraction (`start - dy`), written once so no surface can get it backwards. The
 *    screen used to have no handle at all — the box only grew with its content, while the
 *    launch column was vertically centred, so enlarging the panel slid the composer down
 *    and the gesture read as inverted.
 *  - **bounds.** At least three lines, never more than 45% of the viewport: past that the
 *    transcript it is supposed to sit under has nowhere left to be.
 *
 * Pure: the drag itself lives in `useComposerHeight`, so the rule can be asserted without
 * a pointer.
 */

/** Three lines plus the box's padding — the smallest a composer should ever be. */
export const COMPOSER_MIN_PX = 64;

/** Where the height is remembered across mounts (per plugin, not per conversation). */
export const COMPOSER_STORAGE_KEY = "strix.composerHeight";

export interface ComposerBounds {
	readonly min: number;
	readonly max: number;
}

/** The clamp for a viewport this tall. A short panel still gets a usable box. */
export function composerHeightBounds(viewportHeight: number): ComposerBounds {
	const min = COMPOSER_MIN_PX;
	const max = Math.max(min, Math.round(viewportHeight * 0.45));
	return { min, max };
}

/**
 * The height after a drag moved `dy` pixels.
 *
 * `dy` is the pointer's movement in screen coordinates, so it is negative when the pointer
 * goes up. Subtracting it is what makes "up = taller" true for every caller.
 */
export function nextComposerHeight(input: {
	readonly start: number;
	readonly dy: number;
	readonly min: number;
	readonly max: number;
}): number {
	const raw = input.start - input.dy;
	return Math.min(input.max, Math.max(input.min, Math.round(raw)));
}

/** The same rule for a keyboard nudge, where the sign is already "grow" or "shrink". */
export function nudgeComposerHeight(input: {
	readonly start: number;
	readonly delta: number;
	readonly min: number;
	readonly max: number;
}): number {
	return Math.min(input.max, Math.max(input.min, Math.round(input.start + input.delta)));
}

/** A remembered height, clamped into the current viewport; `undefined` means "use CSS". */
export function readStoredComposerHeight(viewportHeight: number): number | undefined {
	let stored: string | null = null;
	try {
		stored = globalThis.localStorage?.getItem(COMPOSER_STORAGE_KEY) ?? null;
	} catch {
		// Private mode / quota: no memory is better than a crash, and the default is fine.
		return undefined;
	}
	if (!stored) return undefined;
	const parsed = Number.parseInt(stored, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
	const { min, max } = composerHeightBounds(viewportHeight);
	return Math.min(max, Math.max(min, parsed));
}

export function writeStoredComposerHeight(height: number): void {
	try {
		globalThis.localStorage?.setItem(COMPOSER_STORAGE_KEY, String(Math.round(height)));
	} catch {
		// Same reasoning: the height is a convenience, never a requirement.
	}
}
