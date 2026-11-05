import type { EditorSession } from "../hooks/use-craft-editor.ts";

/**
 * The single 28 px line above the frame. Three controls and nothing else: whether
 * the editor is ready, full screen, reload — icons only, each with the platform
 * tooltip (`title`) and an accessible name. Readiness is a glyph rather than a word
 * so the row keeps the same width whatever the state; the backend the page reported
 * rides in that glyph's tooltip, where it is diagnostic rather than decoration.
 *
 * The palette is the frame's own: the bar and the boot cover share `#0b0d10`, and the
 * only colours in the row are the three state tones. Nothing here is a brand accent.
 *
 * ADR: docs/adr/<slug>/craft-0010-icons-only-and-a-fullscreen-that-returns.md
 * ADR: docs/adr/<slug>/craft-0016-three-controls-and-a-status-icon.md
 */
const BAR = "flex h-7 shrink-0 items-center gap-1.5 border-b border-white/[0.07] bg-[#0b0d10] px-2 text-[11px] text-neutral-400";

const BUTTON =
	"flex size-6 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-neutral-100 disabled:opacity-35 disabled:hover:bg-transparent";

/** One 16-px circle glyph per state: a check, a clock, an exclamation. */
function StateIcon({ phase }: { phase: EditorSession["phase"] }): React.ReactElement {
	const shared = {
		viewBox: "0 0 16 16",
		className: "size-4",
		"aria-hidden": true,
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.4,
		strokeLinecap: "round",
		strokeLinejoin: "round",
	} as const;
	return (
		<svg {...shared}>
			<circle cx="8" cy="8" r="6" />
			{phase === "ready" ? (
				<path d="M5.4 8.3 7.2 10l3.4-3.7" />
			) : phase === "failed" ? (
				<path d="M8 4.9v3.6" />
			) : (
				<path d="M8 4.7V8l2.2 1.5" />
			)}
			{phase === "failed" ? <path d="M8 11.2h.01" /> : null}
		</svg>
	);
}

export function EditorStatusBar({ session }: { session: EditorSession }): React.ReactElement {
	const { strings, phase, backend, binding, candidate, savedAt, notice, isFullscreen, progress } = session;
	const status = phase === "failed" ? strings.failed : phase === "ready" ? strings.ready : strings.preparing;
	const tone =
		phase === "failed" ? "text-rose-400" : phase === "ready" ? "text-emerald-400" : "text-amber-300";
	const hint = backend ? `${status} · ${backend}` : status;
	const disabled = session.iframeDoc === null;

	return (
		<div className={BAR}>
			<span
				className={`flex size-6 items-center justify-center ${tone}`}
				title={hint}
				aria-label={hint}
				role="status"
			>
				<StateIcon phase={phase} />
			</span>
			<span className="truncate text-neutral-300">
				{binding
					? binding.name
					: candidate
						? `${strings.open}: ${candidate.name}`
						: strings.noFile}
			</span>
			{savedAt ? <span className="text-neutral-600">{new Date(savedAt).toLocaleTimeString()}</span> : null}
			<span className="flex-1" />
			{progress ? (
				<span className="max-w-[38%] truncate text-amber-300/90" role="status">
					{strings.acting} {progress}
				</span>
			) : notice ? (
				<span className="max-w-[40%] truncate text-neutral-500">{notice}</span>
			) : null}

			<button
				type="button"
				title={isFullscreen ? strings.exitFullscreen : strings.fullscreen}
				aria-label={isFullscreen ? strings.exitFullscreen : strings.fullscreen}
				disabled={disabled && !isFullscreen}
				onClick={() => session.toggleFullscreen()}
				className={BUTTON}
			>
				{isFullscreen ? (
					<svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
						<path d="M6 2v3a1 1 0 0 1-1 1H2" />
						<path d="M10 2v3a1 1 0 0 0 1 1h3" />
						<path d="M6 14v-3a1 1 0 0 0-1-1H2" />
						<path d="M10 14v-3a1 1 0 0 1 1-1h3" />
					</svg>
				) : (
					<svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
						<path d="M9 2h5v5" />
						<path d="M14 2 9.5 6.5" />
						<path d="M7 14H2V9" />
						<path d="M2 14l4.5-4.5" />
					</svg>
				)}
			</button>

			<button
				type="button"
				title={strings.reload}
				aria-label={strings.reload}
				disabled={disabled}
				onClick={() => session.reload()}
				className={BUTTON}
			>
				<svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
					<path d="M13.5 8a5.5 5.5 0 1 1-1.9-4.2" />
					<path d="M13.5 2.5V6H10" />
				</svg>
			</button>
		</div>
	);
}
