import type { JSX } from "react";
import type { EditorStrings } from "../strings.ts";

/**
 * The tab's two controls, floating over the canvas instead of taking a row above it.
 *
 * A 28-px bar costs a canvas app real estate permanently for two things a user needs
 * rarely, and the row was the only part of this plugin the upstream page never asked
 * for. So the controls sit in the top-right corner of the frame area as an overlay:
 * no layout, no reserved space, and the editor gets the whole panel.
 *
 * They are not hidden until hover — an invisible button is a button nobody finds. The
 * pill rests at 45 % opacity and comes to full strength under the pointer, which is
 * how it stays findable without competing with the artwork behind it.
 *
 * The host's own tab context menu cannot be extended by a plugin (see the ADR), so
 * these two actions also have `mod+shift+r` / `mod+shift+f`, registered in the editor
 * hook as a `surface` shortcut scope.
 *
 * ADR: docs/adr/<slug>/craft-0018-the-header-became-a-corner.md
 */
const DOCK =
	"absolute right-2 top-2 z-20 flex items-center gap-px rounded-md border border-white/10 bg-[#0b0d10]/85 p-0.5 text-neutral-400 opacity-45 shadow-lg backdrop-blur-sm transition-opacity duration-150 hover:opacity-100 focus-within:opacity-100";

const BUTTON =
	"flex size-6 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-white/10 hover:text-neutral-100 disabled:opacity-35 disabled:hover:bg-transparent";

const ICON = {
	viewBox: "0 0 16 16",
	className: "size-3.5",
	"aria-hidden": true,
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.4,
	strokeLinecap: "round",
	strokeLinejoin: "round",
} as const;

/** The shortcut the host actually binds: `mod` is ⌘ on macOS and Ctrl elsewhere. */
function combo(letter: string): string {
	const mac = typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent || "");
	return mac ? `⇧⌘${letter}` : `Ctrl+Shift+${letter}`;
}

export function EditorDock({
	strings,
	disabled,
	isFullscreen,
	onReload,
	onToggleFullscreen,
	onAskAgent,
}: {
	strings: EditorStrings;
	disabled: boolean;
	isFullscreen: boolean;
	onReload: () => void;
	onToggleFullscreen: () => void;
	/** Puts this panel's state into the message box; the user still presses Enter. */
	onAskAgent: () => void;
}): JSX.Element {
	const fullscreenLabel = isFullscreen ? strings.exitFullscreen : strings.fullscreen;

	return (
		<div className={DOCK} role="toolbar" aria-label={strings.controls}>
			<button
				type="button"
				title={`${fullscreenLabel} · ${combo("F")}`}
				aria-label={fullscreenLabel}
				disabled={disabled && !isFullscreen}
				onClick={onToggleFullscreen}
				className={BUTTON}
			>
				{isFullscreen ? (
					<svg {...ICON}>
						<path d="M6 2v3a1 1 0 0 1-1 1H2" />
						<path d="M10 2v3a1 1 0 0 0 1 1h3" />
						<path d="M6 14v-3a1 1 0 0 0-1-1H2" />
						<path d="M10 14v-3a1 1 0 0 1 1-1h3" />
					</svg>
				) : (
					<svg {...ICON}>
						<path d="M9 2h5v5" />
						<path d="M14 2 9.5 6.5" />
						<path d="M7 14H2V9" />
						<path d="M2 14l4.5-4.5" />
					</svg>
				)}
			</button>

			<button
				type="button"
				title={`${strings.reload} · ${combo("R")}`}
				aria-label={strings.reload}
				disabled={disabled}
				onClick={onReload}
				className={BUTTON}
			>
				<svg {...ICON}>
					<path d="M13.5 8a5.5 5.5 0 1 1-1.9-4.2" />
					<path d="M13.5 2.5V6H10" />
				</svg>
			</button>

			<button
				type="button"
				title={strings.askAgent}
				aria-label={strings.askAgent}
				disabled={disabled}
				onClick={onAskAgent}
				className={BUTTON}
			>
				<svg {...ICON}>
					<path d="M3 3.5h10v6H7.5L5 12v-2.5H3z" />
					<path d="M5.5 6.2h5" />
				</svg>
			</button>
		</div>
	);
}
