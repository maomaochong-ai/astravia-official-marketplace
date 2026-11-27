import { useCallback, useEffect, useRef, useState, type CSSProperties, type JSX, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { CanvasNote, NoteScope } from "../../../domain/notes";
import { partAt } from "../../../domain/note-parts";
import type { LogoSpec } from "../../../domain/spec";
import { BUTTON_PRIMARY, FOCUS_RING, NOTE_DOT, NOTE_RING, TEXTAREA } from "../../../shared/styles/tokens";
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
	/** 受控缩放（dock 的缩放按钮也改它）。 */
	zoom: number;
	onZoomChange: (next: number) => void;
	/** 手型工具：任何缩放级别下拖动都是平移，单点仍然落备注。 */
	handMode: boolean;
}

const MIN_ZOOM = 0.4;
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
	// 用 clamp 在 CSS 里做双向钳位：气泡宽高固定，四边各留 8px。
	// 上一版只用百分比居中，靠左/靠右/靠下点击时仍会有半截超出画布（截图里的遮挡）。
	const xPercent = Math.min(100, Math.max(0, point.x * 100));
	const yPercent = Math.min(100, Math.max(0, point.y * 100));
	const flipUp = yPercent > 58;
	return {
		left: `clamp(0.5rem, calc(${xPercent}% - ${POPOVER_WIDTH / 2}px), calc(100% - ${POPOVER_WIDTH}px - 0.5rem))`,
		...(flipUp
			? { bottom: `clamp(0.5rem, calc(${100 - yPercent}% + 12px), calc(100% - ${POPOVER_HEIGHT}px - 0.5rem))` }
			: { top: `clamp(0.5rem, calc(${yPercent}% + 12px), calc(100% - ${POPOVER_HEIGHT}px - 0.5rem))` }),
		maxWidth: `calc(100% - 1rem)`,
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
	zoom,
	onZoomChange,
	handMode,
}: CanvasSurfaceProps): JSX.Element {
	const { t } = useTranslation();
	const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
	const [text, setText] = useState("");
	const [saving, setSaving] = useState(false);
	const [scope, setScope] = useState<NoteScope>("design");
	const [offset, setOffset] = useState({ x: 0, y: 0 });

	const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
	const surfaceRef = useRef<HTMLDivElement | null>(null);

	const resetView = useCallback(() => {
		onZoomChange(1);
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
		// 手型工具下 1× 也能平移（放大前想挪一挪画布是很自然的事）。
		setOffset(zoom === 1 && !handMode ? { x: 0, y: 0 } : { x: drag.originX + dx, y: drag.originY + dy });
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
		const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (event.deltaY < 0 ? 1.12 : 0.89)));
		if (next === 1) setOffset({ x: 0, y: 0 });
		onZoomChange(next);
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
			{/*
			 * 不再 overall overflow-hidden：备注气泡贴在边缘时会被整个裁掉（就是截图里的遮挡）。
			 * 裁剪下放给内层 art 层，缩放/平移仍然不会溢出圆角。
			 */}
			<div
				ref={surfaceRef}
				className={`relative w-full select-none rounded-xl border border-border/60 ${
					empty ? "" : handMode || zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"
				}`}
				style={dark ? { background: "#121210" } : { background: "#ffffff" }}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={() => {
					dragRef.current = null;
				}}
				onWheel={onWheel}
				// 双击不再兼「复位」：一次双击会先落一枚备注（pointerup），再被当成复位，
				// 两个行为抢同一个手势。复位移到画布右上角的显式按钮。
				role="button"
				tabIndex={0}
				aria-label={t("notes.surface")}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") setDraft({ x: 0.5, y: 0.5 });
				}}
			>
				{/*
				 * 图形层：只有它需要裁剪（缩放/平移时不能溢出圆角）。
				 * 空态时不绝对定位 —— 父级没有高度，absolute 子元素会把整块塌成一条边框线
				 * （用户截图里那条横线）。给它 aspect-square 撑出画布面积。
				 */}
				<div
					className={
						empty
							? "relative aspect-square w-full overflow-hidden rounded-xl"
							: "absolute inset-0 overflow-hidden rounded-xl"
					}
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
				</div>
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
			</div>
		</div>
	);
}
