import type { JSX } from "react";

/**
 * The 16 px mark used by the tab strip and the composer chip.
 *
 * Why not the plugin icon: a contribution without an explicit `icon` inherits
 * `plugin.json#icon` as an `<img class="h-4 w-4 object-contain">`
 * (`plugin-icon.ts:37-43`). That file is a 512 px portrait, so at 16 px it is a
 * smudge — and because the file is a photograph with its own rounded corners, the
 * tab reads as a small rectangle rather than as an icon.
 *
 * This is drawn in `currentColor`, so it follows the tab's active/inactive state
 * and the theme, and it is built from two shapes that survive 16 px: the
 * "variations" stack (two offset canvases) and a spark. Same motif as the ability
 * card, expressed as a glyph instead of a photo.
 */
export function TabMark({ className = "size-4" }: { className?: string }): JSX.Element {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
			{/* Back canvas, lighter echo — the "several variations" idea. */}
			<rect x="3.2" y="3.2" width="10.5" height="10.5" rx="3" stroke="currentColor" strokeWidth="1.6" opacity="0.45" />
			{/* Front canvas. */}
			<rect x="10.3" y="10.3" width="10.5" height="10.5" rx="3" fill="currentColor" />
			{/* Spark: the mark being generated. */}
			<path
				d="M7.9 12.4c.18 1.5 1.02 2.34 2.52 2.52-1.5.18-2.34 1.02-2.52 2.52-.18-1.5-1.02-2.34-2.52-2.52 1.5-.18 2.34-1.02 2.52-2.52Z"
				fill="currentColor"
				opacity="0.9"
			/>
		</svg>
	);
}
