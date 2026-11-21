import { useState, type JSX, type MouseEvent } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { CanvasNote, NoteScope } from "../../../domain/notes";
import { partAt } from "../../../domain/note-parts";
import type { LogoSpec } from "../../../domain/spec";
import { BUTTON_PRIMARY, FOCUS_RING, TEXTAREA } from "../../../shared/styles/tokens";

export interface CanvasSurfaceProps {
	previewUrl: string;
	alt: string;
	/** Pending notes to pin on the art. */
	notes: CanvasNote[];
	/** Dark spec surfaces need the art on a dark stage. */
	dark: boolean;
	onPlace: (point: { x: number; y: number }, text: string, scope: NoteScope, part: ReturnType<typeof partAt>) => Promise<boolean>;
	/** Needed to resolve a pin to a structural part (mark / wordmark / tagline). */
	spec: LogoSpec;
	/**
	 * When the open design came from the image path, this is its PNG. The stage has to
	 * draw *that*: re-rendering the spec as vectors would show a different mark.
	 */
	rasterUrl?: string | null;
}

/**
 * Two kinds of note, matching the reference plugin's free-vs-anchored distinction:
 * a **design** note is about this mark ("this leaf is too thin"); a **global** note is
 * a standing rule for the brand ("always keep 24 px legible"). A note list that
 * mixes them without saying which is which is the reason the feature feels imprecise.
 */

/**
 * The canvas itself: artwork, pins, and the one-line note you drop on it.
 *
 * Split from the note list on purpose. This is the part that must stay on screen
 * while the form scrolls (it is what you are editing); the list is a checklist and
 * can live below the fold with the other panels.
 */
export function CanvasSurface({ previewUrl, alt, notes, dark, onPlace, spec, rasterUrl }: CanvasSurfaceProps): JSX.Element {
	const { t } = useTranslation();
	const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
	const [text, setText] = useState("");
	const [saving, setSaving] = useState(false);
	const [scope, setScope] = useState<NoteScope>("design");

	const place = (event: MouseEvent<HTMLDivElement>) => {
		const box = event.currentTarget.getBoundingClientRect();
		if (box.width === 0 || box.height === 0) return;
		setDraft({
			x: Math.min(0.98, Math.max(0.02, (event.clientX - box.left) / box.width)),
			y: Math.min(0.98, Math.max(0.02, (event.clientY - box.top) / box.height)),
		});
		setText("");
	};

	const submit = async () => {
		if (!draft || !text.trim()) return;
		setSaving(true);
		// Resolve the pin to a structural part: "the wordmark", not "y=0.74".
		const ok = await onPlace(draft, text.trim(), scope, partAt({ type: spec.type }, draft.y));
		setSaving(false);
		if (ok) {
			setDraft(null);
			setText("");
		}
	};

	const pins = notes.filter((note) => note.status === "pending");

	return (
		<div className="space-y-2">
			<div
				className="relative w-full cursor-crosshair select-none overflow-hidden rounded-xl border border-border/60"
				style={dark ? { background: "#121210" } : { background: "#ffffff" }}
				onClick={place}
				role="button"
				tabIndex={0}
				aria-label={t("notes.surface")}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") setDraft({ x: 0.5, y: 0.5 });
				}}
			>
				<img src={rasterUrl ?? previewUrl} alt={alt} className="block w-full" draggable={false} />
				{pins.map((note, index) => (
					<span
						key={note.id}
						className="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber-500 text-[10px] font-semibold text-white shadow ring-2 ring-white/70"
						style={{ left: `${note.x * 100}%`, top: `${note.y * 100}%` }}
						title={note.text}
					>
						{index + 1}
					</span>
				))}
				{draft ? (
					<span
						className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-amber-500"
						style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}
					/>
				) : null}
			</div>

			{draft ? (
				<div className="space-y-1.5">
					<div role="radiogroup" aria-label={t("notes.scope")} className="flex items-center gap-1">
						{(
							[
								{ id: "design" as const, label: t("notes.scopeDesign") },
								{ id: "global" as const, label: t("notes.scopeGlobal") },
							]
						).map((option) => (
							<button
								key={option.id}
								type="button"
								role="radio"
								aria-checked={scope === option.id}
								onClick={() => setScope(option.id)}
								className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors ${
									scope === option.id
										? "border-primary bg-primary/10 text-foreground"
										: "border-border text-muted-foreground hover:text-foreground"
								}`}
							>
								{option.label}
							</button>
						))}
						<span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
							{t(`notes.part.${partAt({ type: spec.type }, draft.y)}`)}
						</span>
					</div>
					<textarea
						className={TEXTAREA}
						rows={2}
						autoFocus
						value={text}
						onChange={(event) => setText(event.target.value)}
						placeholder={t("notes.placeholder")}
						aria-label={t("notes.placeholder")}
						maxLength={600}
					/>
					<div className="flex items-center gap-1.5">
						<button
							type="button"
							onClick={() => void submit()}
							disabled={saving || !text.trim()}
							className={`${BUTTON_PRIMARY} ${FOCUS_RING} h-8 px-3 text-[12px]`}
						>
							{t("notes.add")}
						</button>
						<button
							type="button"
							onClick={() => {
								setDraft(null);
								setText("");
							}}
							className="text-[11px] text-muted-foreground hover:text-foreground"
						>
							{t("notes.cancel")}
						</button>
						<span className="flex-1" />
						<span className="text-[10px] text-muted-foreground">{t("notes.hint")}</span>
					</div>
				</div>
			) : null}
		</div>
	);
}
