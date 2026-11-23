import { useCallback, useEffect, useRef, useState, type CSSProperties, type JSX, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { CanvasNote, NoteScope } from "../../../domain/notes";
import { partAt } from "../../../domain/note-parts";
import type { LogoSpec } from "../../../domain/spec";
import { BUTTON_PRIMARY, FOCUS_RING, NOTE_DOT, NOTE_RING, TEXTAREA } from "../../../shared/styles/tokens";
import { IconReset } from "../../../shared/components/icons";
import { CanvasPlaceholder } from "./canvas-placeholder";

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
	/**
	 * Nothing has been made yet: draw the cover instead of a real render.
	 *
	 * The stage used to render `renderLogo({brandName:"Untitled"})` when empty — a
	 * wordmark for a brand that does not exist, which reads as "you already have a
	 * logo". The cover says the opposite: pick a structure, or type a name.
	 */
	empty?: boolean;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
/** Screen pixels before a press counts as a drag rather than a click. */
/** Screen pixels before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 4;
/** 气泡宽度：与 class 里的 w-56 一致，用来在右/下边缘向内收。 */
const POPOVER_WIDTH = 224;
const POPOVER_HEIGHT = 176;
/**
 * 气泡定位：贴在点击点上，左右不越界。
 *
 * 只做水平钳位与竖向翻转（点击位置靠下时翻到上方），不做完整碰撞检测 ——
 * 画布本身可平移，一个被推到边上的气泡反而更难看得懂它指的是哪个点。
 */
function popoverStyle(point: { x: number; y: number }): CSSProperties {
	const half = (POPOVER_WIDTH / 2 / 100) * 100;
	const left = Math.min(96, Math.max(4, point.x * 100));
	const flipUp = point.y * 100 > 58;
	return {
		left: `calc(${left}% - ${half}px)`,
		...(flipUp ? { bottom: `calc(${(1 - point.y) * 100}% + 12px)` } : { top: `calc(${point.y * 100}% + 12px)` }),
		maxWidth: `calc(100% - 8px)`,
	};
}

/**
 * The canvas itself: artwork, pins, pan/zoom, and the one-line note you drop on it.
 *
 * Panning was missing entirely — a logo at 100% in a 400 px stage leaves no room to
 * inspect a corner, and the only way to see one was to export it. The gesture rules
 * follow the host's own canvas so the two feel the same:
 *
 *   drag (with the mouse or one finger)  → pan
 *   wheel                                → zoom about the centre, 1…4×
 *   click without moving                 → drop a note pin
 *   double-click                         → back to 100%
 *
 * The click/drag distinction is a 4 px threshold rather than "pointerup on the same
 * element": a note pin that fires at the end of a pan is worse than a missed pin.
 */
export function CanvasSurface({
	previewUrl,
	alt,
	notes,
	dark,
	onPlace,
	spec,
	rasterUrl,
	empty = false,
}: CanvasSurfaceProps): JSX.Element {
	const { t } = useTranslation();
	const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
	const [text, setText] = useState("");
	const [saving, setSaving] = useState(false);
	const [scope, setScope] = useState<NoteScope>("design");
	const [zoom, setZoom] = useState(1);
	const [offset, setOffset] = useState({ x: 0, y: 0 });

	const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
	const surfaceRef = useRef<HTMLDivElement | null>(null);

	const resetView = useCallback(() => {
		setZoom(1);
		setOffset({ x: 0, y: 0 });
		setDraft(null);
	}, []);

	// A different design deserves a fresh view: keeping a 3× pan from the previous mark
	// shows the new one's corner and reads as "the canvas broke".
	useEffect(() => {
		resetView();
	}, [previewUrl, rasterUrl, resetView]);

	const place = (event: { clientX: number; clientY: number }) => {
		const box = surfaceRef.current?.getBoundingClientRect();
		if (!box || box.width === 0 || box.height === 0) return;
		setDraft({
			x: Math.min(0.98, Math.max(0.02, (event.clientX - box.left) / box.width)),
			y: Math.min(0.98, Math.max(0.02, (event.clientY - box.top) / box.height)),
		});
		setText("");
	};

	const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.button !== 0 && event.pointerType === "mouse") return;
		dragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originX: offset.x,
			originY: offset.y,
			moved: false,
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const dx = event.clientX - drag.startX;
		const dy = event.clientY - drag.startY;
		if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
		drag.moved = true;
		// Zoomed art pans freely; at 1× it stays centred so the frame cannot be lost.
		setOffset(zoom === 1 ? { x: 0, y: 0 } : { x: drag.originX + dx, y: drag.originY + dy });
	};

	const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		dragRef.current = null;
		if (!drag) return;
		// A press that never moved is a click: that is the note gesture.
		if (!drag.moved) place({ clientX: event.clientX, clientY: event.clientY });
	};

	const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
		if (empty) return;
		// Zoom only with a modifier or a trackpad pinch: a plain wheel inside a panel is
		// the panel's scroll, and stealing it traps the user.
		if (!event.ctrlKey && !event.metaKey) return;
		event.preventDefault();
		setZoom((current) => {
			const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current * (event.deltaY < 0 ? 1.12 : 0.89)));
			if (next === 1) setOffset({ x: 0, y: 0 });
			return next;
		});
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
				ref={surfaceRef}
				className={`relative w-full select-none overflow-hidden rounded-xl border border-border/60 ${
					empty ? "" : zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"
				}`}
				style={dark ? { background: "#121210" } : { background: "#ffffff" }}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={() => {
					dragRef.current = null;
				}}
				onWheel={onWheel}
				onDoubleClick={resetView}
				role="button"
				tabIndex={0}
				aria-label={t("notes.surface")}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") setDraft({ x: 0.5, y: 0.5 });
				}}
			>
				{empty ? (
					<CanvasPlaceholder />
				) : (
					<div
						className="origin-center transition-transform duration-75"
						style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
					>
						<img src={rasterUrl ?? previewUrl} alt={alt} className="block w-full" draggable={false} />
					</div>
				)}
				{pins.map((note, index) => (
					<span
						key={note.id}
						className={`pointer-events-none absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${NOTE_DOT} text-[10px] font-semibold text-white shadow ring-2 ring-white/70`}
						style={{ left: `${note.x * 100}%`, top: `${note.y * 100}%` }}
						title={note.text}
					>
						{index + 1}
					</span>
				))}

				{/*
				 * 备注气泡：点哪里就在哪里出现。
				 *
				 * 上一版把编辑器放在画布**下面**：点一下图，下方才出现一个输入框，中间还能拖动画布 ——
				 * 用户得在两个地方之间来回看，而且气泡会被底部 dock 遮住。现在编辑器沿点击点弹出，
				 * 贴着图、带箭头、不遮 dock：所见即所指。
				 */}
				{draft ? (
					<div
						key="note-popover"
						role="dialog"
						aria-label={t("notes.add")}
						data-testid="note-popover"
						style={popoverStyle(draft)}
						className="absolute z-50 w-56 rounded-xl border border-border/80 bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-black/5"
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => event.stopPropagation()}
					>
						<div className="pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
							{t(`notes.part.${partAt({ type: spec.type }, draft.y)}`)}
						</div>
						{/* 作用域：两个选项的差别要说在选项里，不能只依赖两行小字说明。 */}
						<div role="radiogroup" aria-label={t("notes.scope")} className="flex items-center gap-1 pb-1.5">
							{(
								[
									{ id: "design" as const, label: t("notes.scopeDesign"), hint: t("notes.scopeDesignHint") },
									{ id: "global" as const, label: t("notes.scopeGlobal"), hint: t("notes.scopeGlobalHint") },
								]
							).map((option) => (
								<button
									key={option.id}
									type="button"
									role="radio"
									aria-checked={scope === option.id}
									title={option.hint}
									onClick={() => setScope(option.id)}
									className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
										scope === option.id
											? "border-primary bg-primary/10 text-foreground"
											: "border-border text-muted-foreground hover:text-foreground"
									}`}
								>
									{option.label}
								</button>
							))}
						</div>
						<textarea
							className="min-h-14 w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-[12px] text-foreground outline-none focus:border-primary"
							rows={2}
							autoFocus
							value={text}
							onChange={(event) => setText(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submit();
								if (event.key === "Escape") {
									setDraft(null);
									setText("");
								}
							}}
							placeholder={t("notes.placeholder")}
							aria-label={t("notes.placeholder")}
							maxLength={600}
						/>
						<div className="flex items-center gap-1.5 pt-1.5">
							<button
								type="button"
								onClick={() => void submit()}
								disabled={saving || !text.trim()}
								className={`${BUTTON_PRIMARY} ${FOCUS_RING} h-7 px-2.5 text-[11.5px]`}
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
						</div>
					</div>
				) : null}

				{/* Zoom readout doubles as the reset control, like the host's canvas. */}
				{!empty ? (
					<button
						type="button"
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.stopPropagation();
							resetView();
						}}
						title={t("canvas.resetView")}
						className={`${FOCUS_RING} absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-md bg-popover/90 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground shadow-sm ring-1 ring-border/60 hover:text-foreground`}
					>
						<IconReset className="size-3" />
						{Math.round(zoom * 100)}%
					</button>
				) : null}
			</div>
		</div>
	);
}
