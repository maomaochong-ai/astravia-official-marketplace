import { useState, type JSX, type MouseEvent } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { CanvasNote } from "../../../domain/notes";
import { BUTTON_PRIMARY, FOCUS_RING, TEXTAREA } from "../../../shared/styles/tokens";

export interface CanvasNotesLayerProps {
	/** Svg preview (data URL) the notes sit on. */
	previewUrl: string;
	alt: string;
	notes: CanvasNote[];
	/** Dark surface needs light pins, or they disappear into the art. */
	dark: boolean;
	onPlace: (point: { x: number; y: number }, text: string) => Promise<boolean>;
	onRemove: (id: string) => void;
}

/**
 * The canvas surface the user annotates.
 *
 * Clicking the artwork drops a pin and opens one line of input; the pin keeps the
 * fractional position, so the same note lands on the same part of the mark at any
 * preview size. Pending pins are numbered because the agent reads them in order.
 */
export function CanvasNotesLayer({
	previewUrl,
	alt,
	notes,
	dark,
	onPlace,
	onRemove,
}: CanvasNotesLayerProps): JSX.Element {
	const { t } = useTranslation();
	const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
	const [text, setText] = useState("");
	const [saving, setSaving] = useState(false);

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
		const ok = await onPlace(draft, text.trim());
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
				<img src={previewUrl} alt={alt} className="block w-full" draggable={false} />
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
						<button type="button" onClick={() => void submit()} disabled={saving || !text.trim()} className={`${BUTTON_PRIMARY} ${FOCUS_RING} h-8 px-3 text-[12px]`}>
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

			{pins.length > 0 ? (
				<ul className="space-y-1">
					{pins.map((note, index) => (
						<li key={note.id} className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1">
							<span className="mt-[1px] flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[9px] font-semibold text-white">
								{index + 1}
							</span>
							<span className="min-w-0 flex-1 text-[11px] leading-snug text-foreground">{note.text}</span>
							<button
								type="button"
								onClick={() => onRemove(note.id)}
								aria-label={t("notes.remove")}
								className="shrink-0 text-[10px] text-muted-foreground hover:text-destructive"
							>
								×
							</button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
