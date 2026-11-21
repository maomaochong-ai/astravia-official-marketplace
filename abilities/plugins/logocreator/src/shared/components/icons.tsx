import type { JSX } from "react";

/**
 * The plugin's own icon set, drawn inline.
 *
 * Why inline and not a font or an Iconify runtime: the panel has to render with the
 * host's theme and no network, and a sibling plugin (`build-apple-apps`) already
 * establishes this convention — `viewBox="0 0 24 24"`, `stroke="currentColor"`,
 * one consistent weight, so icons follow light/dark and active states for free.
 *
 * The set is deliberately small and semantic: one glyph per verb the panel offers.
 * Six earlier dock glyphs were raw path soup with mismatched weights, which is why
 * the dock read as "ugly" rather than as a toolbar.
 */

export interface IconProps {
	className?: string;
}

const SIZE = "size-4";

function Glyph({ className = SIZE, children }: IconProps & { children: JSX.Element }): JSX.Element {
	return (
		<svg
			viewBox="0 0 24 24"
			className={className}
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			{children}
		</svg>
	);
}

/**
 * A four-point spark — the "make something" gesture, and the only glyph that still
 * reads at 14 px. Filled, because an outlined star at this size turns into a smudge
 * with the stroke weight we use everywhere else.
 */
function sparkPath(cx: number, cy: number, r: number): string {
	const k = r * 0.28;
	return `M${cx} ${cy - r}C${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy}C${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r}C${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy}C${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
}

/** Generate: one large spark plus a smaller echo. Two weights of the same idea. */
export function IconGenerate({ className = SIZE }: IconProps): JSX.Element {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden>
			<path d={sparkPath(10, 10.5, 7)} fill="currentColor" />
			<path d={sparkPath(18, 17.5, 3.4)} fill="currentColor" opacity="0.55" />
		</svg>
	);
}

/** The spark on its own, for inline use beside a label. */
export function IconSpark({ className = SIZE }: IconProps): JSX.Element {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden>
			<path d={sparkPath(12, 12, 8)} fill="currentColor" />
		</svg>
	);
}

/** The stage itself: a frame, a mark in it, two lines of wordmark below. */
export function IconCanvas({ className = SIZE }: IconProps): JSX.Element {
	return (
		<Glyph className={className}>
			<>
				<rect x="3.5" y="3" width="17" height="12" rx="2.6" />
				<circle cx="8.6" cy="8" r="1.7" />
				<path d="M4.5 13.2l3.6-3.4 2.6 2.4 2.4-2.2 2.6 2.6" />
				<path d="M7.5 19h9" />
			</>
		</Glyph>
	);
}

/** Surprise: shuffle a deck of variations. */
export function IconShuffle(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<>
				<path d="M4 7h3.5l2.5 3M4 17h3.5l9-10H20" />
				<path d="M17 4l3 3-3 3" />
				<path d="M13.5 14.5 16.5 17H20" />
				<path d="M17 14l3 3-3 3" />
			</>
		</Glyph>
	);
}

/** Design settings: two sliders. */
export function IconSliders(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<>
				<path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
				<circle cx="15" cy="7" r="2" />
				<circle cx="9" cy="17" r="2" />
			</>
		</Glyph>
	);
}

/** Notes: pinned annotation. */
export function IconNote(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<>
				<path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
				<circle cx="12" cy="11" r="2.2" />
			</>
		</Glyph>
	);
}

/** Export: tray with an arrow out. */
export function IconExport(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<>
				<path d="M12 3v11" />
				<path d="M8.5 10.5 12 14l3.5-3.5" />
				<path d="M4 16v3.5A1.5 1.5 0 0 0 5.5 21h13A1.5 1.5 0 0 0 20 19.5V16" />
			</>
		</Glyph>
	);
}

/** History: clock. */
export function IconHistory(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<>
				<circle cx="12" cy="12" r="8.5" />
				<path d="M12 7.5V12l3 2" />
			</>
		</Glyph>
	);
}

/** Reset: counter-clockwise arrow. */
export function IconReset(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<>
				<path d="M4 12a8 8 0 1 0 2.4-5.7" />
				<path d="M4 4.5V9h4.5" />
			</>
		</Glyph>
	);
}

/** Rename: pencil. */
export function IconRename(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<>
				<path d="M4 20h4l10-10a2.1 2.1 0 0 0-3-3L5 17v3Z" />
				<path d="M13.5 6.5 17 10" />
			</>
		</Glyph>
	);
}

/** Delete: bin. */
export function IconTrash(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<>
				<path d="M5 7h14" />
				<path d="M9.5 7V5.5h5V7" />
				<path d="M7.5 7l.8 12.2h7.4L16.5 7" />
			</>
		</Glyph>
	);
}

/** Favourite: star. */
export function IconStar(props: IconProps & { filled?: boolean }): JSX.Element {
	return (
		<svg
			viewBox="0 0 24 24"
			className={props.className ?? SIZE}
			fill={props.filled ? "currentColor" : "none"}
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinejoin="round"
			aria-hidden
		>
			<path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8L12 4Z" />
		</svg>
	);
}

/** Image formats: picture with a size badge. */
export function IconImageSize(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<>
				<rect x="3.5" y="4.5" width="13" height="11" rx="2" />
				<path d="M4.5 13.5l3.4-3.2 2.6 2.4 2.2-2 2.3 2.2" />
				<circle cx="12" cy="8.5" r="1.1" />
				<path d="M11 20h8.5" />
				<path d="M17 15.5V20" />
			</>
		</Glyph>
	);
}

/** Vector file. */
export function IconVector(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<>
				<path d="M5 19 19 5" />
				<path d="M5 5h5v5H5zM14 14h5v5h-5z" />
			</>
		</Glyph>
	);
}

/** Copy to clipboard. */
export function IconCopy(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<>
				<rect x="9" y="9" width="11" height="11" rx="2" />
				<path d="M15 6.5A2.5 2.5 0 0 0 12.5 4H6.5A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15" />
			</>
		</Glyph>
	);
}

/** Close. */
export function IconClose(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<path d="M6 6l12 12M18 6L6 18" />
		</Glyph>
	);
}

/** Check. */
export function IconCheck(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<path d="M5 12.5 9.5 17 19 7" />
		</Glyph>
	);
}

/** Palette / colour. */
export function IconPalette(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<>
				<path d="M12 20.5a8.5 8.5 0 1 1 8.5-8.5c0 2.2-1.8 3.2-3.5 3.2h-1.6a2 2 0 0 0-1.4 3.4c.5.6.2 1.9-2 1.9Z" />
				<circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none" />
				<circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
				<circle cx="16" cy="10" r="1.1" fill="currentColor" stroke="none" />
			</>
		</Glyph>
	);
}

/** Preview / eye. */
export function IconEye(props: IconProps): JSX.Element {
	return (
		<Glyph {...props}>
			<>
				<path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
				<circle cx="12" cy="12" r="2.6" />
			</>
		</Glyph>
	);
}
