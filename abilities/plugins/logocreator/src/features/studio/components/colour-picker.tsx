import { useRef, useState, type JSX } from "react";
import { extractPalette } from "../../../domain/color-plan";
import { MAX_REFERENCE_BYTES, BRAND_IMPORT_ACCEPTED_MIME } from "../../../domain/catalog";
import { readImagePixels } from "../../../domain/render-png";
import { isHexColor, normalizeHex } from "../../../domain/palette";
import { AUTO } from "../../../domain/spec";
import { reportError } from "../../../plugin-context";
import { FOCUS_RING } from "../../../shared/styles/tokens";

export interface ColourPickerProps {
	value: string;
	/** The colour the engine would pick for this brief, shown on the Auto chip. */
	autoHex: string;
	onChange: (hex: string) => void;
	/** Brand colours offered as one-tap picks. */
	swatches: readonly { hex: string; label: string }[];
	labels: { auto: string; custom: string; fromImage: string; imageFailed: string; tooLarge: string };
}

/**
 * Colour control with three ways in: the palette, a custom picker, or pulling the
 * palette out of an existing logo. The last one is what makes switching an
 * established brand over feel possible — nobody wants to type a hex they don't
 * know.
 */
export function ColourPicker({ value, autoHex, onChange, swatches, labels }: ColourPickerProps): JSX.Element {
	const fileRef = useRef<HTMLInputElement | null>(null);
	const [busy, setBusy] = useState(false);
	const isAuto = value === AUTO;

	const handleFile = async (file: File) => {
		if (file.size > MAX_REFERENCE_BYTES) {
			reportError(labels.tooLarge, new Error(`${file.name} is ${Math.round(file.size / 1024)} KB`));
			return;
		}
		if (!BRAND_IMPORT_ACCEPTED_MIME.includes(file.type as (typeof BRAND_IMPORT_ACCEPTED_MIME)[number])) {
			reportError(labels.imageFailed, new Error(`Unsupported type ${file.type || "unknown"}`));
			return;
		}
		setBusy(true);
		try {
			const pixels = await readImagePixels(file);
			const palette = extractPalette(pixels);
			if (palette.length === 0) {
				reportError(labels.imageFailed, new Error("No saturated colours were found in that image"));
				return;
			}
			onChange(palette[0]);
		} catch (cause) {
			reportError(labels.imageFailed, cause);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<button
				type="button"
				onClick={() => onChange(AUTO)}
				aria-pressed={isAuto}
				title={labels.auto}
				className={`${FOCUS_RING} flex h-7 items-center gap-1.5 rounded-full border px-2 text-[10.5px] font-medium transition-colors ${
					isAuto ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
				}`}
			>
				<span
					className="size-3.5 rounded-full ring-1 ring-inset ring-black/10"
					style={{ background: autoHex }}
					aria-hidden
				/>
				{labels.auto}
			</button>

			{swatches.map((swatch) => {
				const active = !isAuto && normalizeHex(value) === normalizeHex(swatch.hex);
				return (
					<button
						key={swatch.hex}
						type="button"
						onClick={() => onChange(swatch.hex)}
						aria-pressed={active}
						aria-label={swatch.label}
						title={swatch.label}
						className={`${FOCUS_RING} size-7 rounded-full border transition-transform ${
							active ? "scale-110 border-foreground/60" : "border-transparent hover:scale-105"
						}`}
						style={{ background: swatch.hex }}
					/>
				);
			})}

			<label
				className="relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:text-foreground"
				title={labels.custom}
			>
				<input
					type="color"
					value={isAuto ? autoHex : value}
					onChange={(event) => {
						if (isHexColor(event.target.value)) onChange(event.target.value);
					}}
					className="absolute inset-0 cursor-pointer opacity-0"
					aria-label={labels.custom}
				/>
				<svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
					<path d="M12 5v14M5 12h14" strokeLinecap="round" />
				</svg>
			</label>

			<button
				type="button"
				onClick={() => fileRef.current?.click()}
				disabled={busy}
				className={`${FOCUS_RING} flex h-7 items-center gap-1 rounded-full border border-border px-2 text-[10.5px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50`}
				title={labels.fromImage}
			>
				{busy ? "…" : labels.fromImage}
			</button>
			<input
				ref={fileRef}
				type="file"
				accept={BRAND_IMPORT_ACCEPTED_MIME.join(",")}
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void handleFile(file);
				}}
			/>
		</div>
	);
}
