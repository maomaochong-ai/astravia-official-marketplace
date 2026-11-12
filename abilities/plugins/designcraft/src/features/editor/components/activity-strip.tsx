import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { CraftIntent } from "../session-registry.ts";
import type { CraftNote } from "../../../domain/link-protocol.ts";
import type { EditorStrings } from "../strings.ts";

/**
 * What the page just did, in the corner of the frame it did it in.
 *
 * The transcript and the prompt attachment carry the same history for the Agent; this
 * is the half the *user* reads while a batch runs — "passed over the canvas", "applied
 * the poster.png drop", "step 2/5 rejected". Without it the panel jumps between two
 * pictures and nothing says which of them is the one that worked.
 *
 * The page has no locale, so a note is `{ kind, detail }` and never a sentence: the
 * kind is a short latin tag (`STAGE`, `KEY`, `STEP`) and the detail is the raw subject
 * the caller already wrote in the user's language.
 */
const ROWS = 2;
// An intent is cleared by `tool-call-end`. If that event never arrives (the turn was
// aborted mid-stream), the hint must not sit there claiming work is queued.
const INTENT_TTL_MS = 120_000;
const TONE: Record<string, string> = {
	notice: "text-amber-300",
	step: "text-sky-300",
	done: "text-sky-300",
	open: "text-emerald-300",
	drop: "text-emerald-300",
	stage: "text-emerald-300",
};

export function ActivityStrip({
	strings,
	progress,
	notes,
	intent,
}: {
	strings: EditorStrings;
	progress: string | null;
	notes: CraftNote[];
	/** The call the model is still writing. Drawn only while nothing is running yet. */
	intent: CraftIntent | null;
}): JSX.Element | null {
	const [now, setNow] = useState(() => Date.now());

	// The queued hint is the only thing on screen before a batch starts, so its expiry has
	// to wake the component or it never fades.
	useEffect(() => {
		if (!intent) return;
		const wait = Math.max(0, intent.at + INTENT_TTL_MS - Date.now()) + 20;
		const timer = setTimeout(() => setNow(Date.now()), wait);
		return () => clearTimeout(timer);
	}, [intent]);

	// Hidden by default, on purpose. The strip used to hold the last note for six seconds
	// and a notice for twenty, so while someone was working it was never actually gone: a
	// block of text sitting on the bottom-left corner of the canvas they were trying to
	// look at. It is a progress indicator, so it exists while something is running and not
	// one tick longer. The same history reaches the Agent through the prompt attachment,
	// which costs no pixels.
	const queued = intent !== null && intent.at + INTENT_TTL_MS > now;
	const visible = progress !== null || queued;
	if (!visible) return null;

	const pending = progress === null && queued;

	const rows = notes.slice(-ROWS);

	return (
		<div
			className="pointer-events-none absolute bottom-2 left-2 z-20 flex max-w-[75%] flex-col gap-0.5 text-[11px] leading-4"
			role="status"
			aria-live="polite"
			title={strings.activity}
		>
			{progress ? (
				<span className="truncate rounded bg-black/60 px-1.5 py-0.5 text-amber-300">
					{strings.acting} {progress}
				</span>
			) : null}
			{pending ? (
				<span className="truncate rounded bg-black/60 px-1.5 py-0.5 text-sky-300">
					{strings.agentQueued}
					{intent && intent.steps > 0 ? ` · ${strings.agentSteps.replace("{n}", String(intent.steps))}` : ""}
					{intent?.label ? ` · ${intent.label}` : ""}
				</span>
			) : null}
			{rows.map((note) => (
				<span
					key={`${note.at}-${note.kind}-${note.detail}`}
					className="truncate rounded bg-black/45 px-1.5 py-0.5 text-neutral-300"
				>
					<span className={note.ok ? TONE[note.kind] ?? "text-neutral-500" : "text-rose-400"}>
						{note.ok ? "✓" : "✗"} {note.kind}
					</span>
					{note.detail ? <span className="text-neutral-300"> {note.detail}</span> : null}
				</span>
			))}
		</div>
	);
}
