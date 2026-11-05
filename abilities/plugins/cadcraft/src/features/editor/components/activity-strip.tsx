import type { JSX } from "react";
import { useEffect, useState } from "react";
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
 *
 * ADR: docs/adr/<slug>/craft-0018-the-header-became-a-corner.md
 */
const HOLD_MS = 6000;
const ROWS = 3;

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
}: {
	strings: EditorStrings;
	progress: string | null;
	notes: CraftNote[];
}): JSX.Element | null {
	const last = notes.length ? notes[notes.length - 1] : null;
	const [now, setNow] = useState(() => Date.now());

	// Re-render once the hold expires, so a finished batch fades instead of leaving a
	// permanent strip on a canvas the user is trying to look at.
	useEffect(() => {
		if (!last) return;
		const wait = Math.max(0, last.at + HOLD_MS - Date.now()) + 20;
		const timer = setTimeout(() => setNow(Date.now()), wait);
		return () => clearTimeout(timer);
	}, [last]);

	// A notice is an instruction ("use File › Open; your selection is waiting"), not a
	// transient event, so it stays until the page does something else.
	const pinned = last?.kind === "notice";
	const visible = progress !== null || (last !== null && (pinned || last.at + HOLD_MS > now));
	if (!visible) return null;

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
