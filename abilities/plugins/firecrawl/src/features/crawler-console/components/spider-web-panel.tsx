/**
 * The web: crawl topology drawn as a real orb web, with a spider that rides it.
 *
 * Straight spokes read as a diagram, not a web. Here the threads sag between
 * spokes, the capture spiral is a continuous curve, and the spider walks the
 * edge the crawler is currently fetching. Nodes are clickable, and the view is
 * zoomable, because a 150-node web is unreadable at one fixed scale.
 *
 * Motion stays CSS/SMIL and is gated on `active && running`, so a warm tab that
 * is not on screen costs no CPU.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CrawlNodeView, CrawlRunSnapshot } from "../services/crawl-run-store";
import { openExternal } from "../../../shared/open-external";
import { getPluginContext } from "../../../runtime/plugin-context";
import { formatCount, formatDuration } from "../../../shared/formatters/format";
import { copyText } from "../../../shared/text-export";
import { artifactTotals } from "../../../domain/firecrawl/artifacts";
import { useTranslate } from "../hooks/use-translate";
import { ARTIFACT_DOT, ARTIFACT_KIND_ORDER, ARTIFACT_LABEL_KEY, ARTIFACT_STROKE } from "../artifact-kinds";

const VIEW = { width: 480, height: 300 };
const CENTER = { x: 240, y: 150 };
const SQUASH = 0.72;
const SPOKES = 18;
const RINGS = 7;
const FIRST_RING = 26;
const RING_GAP = 31;
/** Keeps the outer ring inside the view: radii are squashed vertically by SQUASH. */
const MAX_RADIUS = 186;
const MAX_ZOOM = 6;
const MAX_RENDERED = 140;
const MAX_LABELS = 26;
/** Twelve travelling packets already read as "busy"; more becomes confetti. */
const MAX_PACKETS = 12;

const STATE_COLOR: Record<CrawlNodeView["state"], string> = {
	queued: "var(--color-muted-foreground)",
	fetching: "var(--color-primary)",
	crawled: "var(--color-emerald-500, #10b981)",
	denied: "var(--color-amber-500, #f59e0b)",
	failed: "var(--color-destructive, #ef4444)",
};

interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

const BASE_BOX: Box = { x: 0, y: 0, w: VIEW.width, h: VIEW.height };

interface Placed {
	node: CrawlNodeView;
	x: number;
	y: number;
	parent: Placed | null;
}

function webPoint(angle: number, radius: number): { x: number; y: number } {
	return { x: CENTER.x + Math.cos(angle) * radius, y: CENTER.y + Math.sin(angle) * radius * SQUASH };
}

function clampBox(box: Box): Box {
	const w = Math.min(VIEW.width, Math.max(VIEW.width / MAX_ZOOM, box.w));
	const h = Math.min(VIEW.height, Math.max(VIEW.height / MAX_ZOOM, box.h));
	return {
		w,
		h,
		x: Math.min(Math.max(0, box.x), VIEW.width - w),
		y: Math.min(Math.max(0, box.y), VIEW.height - h),
	};
}

function prng(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
}

/** Rings by hop count, each ring spread evenly so the web stays legible. */
function placeNodes(nodes: CrawlNodeView[]): Placed[] {
	const visible = nodes.slice(0, MAX_RENDERED);
	if (visible.length === 0) return [];
	const root = visible.find((node) => node.depth === 0) ?? visible[0];
	const rootPlaced: Placed = { node: root, x: CENTER.x, y: CENTER.y, parent: null };
	const byId = new Map<string, Placed>([[root.id, rootPlaced]]);
	const placed: Placed[] = [rootPlaced];

	const rings = new Map<number, CrawlNodeView[]>();
	for (const node of visible) {
		if (node === root) continue;
		const depth = Math.max(1, node.depth);
		const bucket = rings.get(depth);
		if (bucket) bucket.push(node);
		else rings.set(depth, [node]);
	}

	for (const depth of [...rings.keys()].sort((a, b) => a - b)) {
		const bucket = rings.get(depth) ?? [];
		const radius = Math.min(FIRST_RING + (depth - 1) * RING_GAP, MAX_RADIUS);
		const offset = depth * 0.55;
		bucket.forEach((node, index) => {
			const angle = offset + (index / bucket.length) * Math.PI * 2;
			const point = webPoint(angle, radius);
			const entry: Placed = { node, x: point.x, y: point.y, parent: byId.get(node.parentId ?? "") ?? rootPlaced };
			byId.set(node.id, entry);
			placed.push(entry);
		});
	}

	return placed;
}

export function SpiderWebPanel({ snapshot, active }: { snapshot: CrawlRunSnapshot; active: boolean }) {
	const t = useTranslate();
	const [view, setView] = useState<Box>(BASE_BOX);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const svgRef = useRef<SVGSVGElement | null>(null);
	const viewRef = useRef(view);
	const dragRef = useRef<{ clientX: number; clientY: number; box: Box; scale: number } | null>(null);

	useEffect(() => {
		viewRef.current = view;
	}, [view]);

	const animate = active && snapshot.status === "running";
	const placed = useMemo(() => placeNodes(snapshot.nodes), [snapshot.nodes]);
	const selected = placed.find((entry) => entry.node.id === selectedId) ?? null;
	const fetching = placed.find((entry) => entry.node.state === "fetching");
	const arrivals = animate ? snapshot.arrivals.slice(-MAX_PACKETS) : [];
	const kinds = useMemo(() => artifactTotals(snapshot.artifacts).byKind, [snapshot.artifacts]);

	const zoomAround = useCallback((factor: number, point: { x: number; y: number }) => {
		const box = viewRef.current;
		const next = clampBox({
			...box,
			w: box.w / factor,
			h: box.h / factor,
		});
		const anchorX = (point.x - box.x) / box.w;
		const anchorY = (point.y - box.y) / box.h;
		setView(clampBox({ ...next, x: point.x - anchorX * next.w, y: point.y - anchorY * next.h }));
	}, []);

	// React attaches wheel listeners passively, so preventDefault needs a native one.
	useEffect(() => {
		const svg = svgRef.current;
		if (!svg) return;
		const onWheel = (event: WheelEvent) => {
			const point = toUser(svg, viewRef.current, event.clientX, event.clientY);
			if (!point) return;
			event.preventDefault();
			zoomAround(Math.exp(-event.deltaY * 0.0016), point);
		};
		svg.addEventListener("wheel", onWheel, { passive: false });
		return () => svg.removeEventListener("wheel", onWheel);
	}, [zoomAround]);

	const onPointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
		if (event.button !== 0) return;
		const rect = svgRef.current?.getBoundingClientRect();
		if (!rect) return;
		const box = viewRef.current;
		const scale = Math.min(rect.width / box.w, rect.height / box.h);
		dragRef.current = { clientX: event.clientX, clientY: event.clientY, box, scale };
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const onPointerMove = (event: ReactPointerEvent<SVGRectElement>) => {
		const drag = dragRef.current;
		if (!drag) return;
		setView(
			clampBox({
				...drag.box,
				x: drag.box.x - (event.clientX - drag.clientX) / drag.scale,
				y: drag.box.y - (event.clientY - drag.clientY) / drag.scale,
			}),
		);
	};

	const onPointerUp = (event: ReactPointerEvent<SVGRectElement>) => {
		dragRef.current = null;
		event.currentTarget.releasePointerCapture(event.pointerId);
	};

	const locate = (entry: Placed) => {
		const w = VIEW.width / 2.6;
		const h = VIEW.height / 2.6;
		setView(clampBox({ x: entry.x - w / 2, y: entry.y - h / 2, w, h }));
	};

	const zoomed = view.w < VIEW.width - 0.5;

	return (
		<div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border/60 bg-gradient-to-b from-muted/25 to-background">
			<div className="flex shrink-0 items-center gap-1.5 px-2 pt-1 text-[10px] text-muted-foreground">
				<span className="font-medium text-foreground">{t("spider.title")}</span>
				{snapshot.status === "running" ? (
					<span className="flex items-center gap-1 text-primary">
						<span className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
						{t("spider.state.live")}
					</span>
				) : null}
				<span className="truncate">
					{snapshot.counts.crawled}/{snapshot.counts.discovered} {t("console.unit.pages")} · d≤{snapshot.options?.maxDiscoveryDepth ?? 0}
				</span>
				<span className="flex shrink-0 items-center gap-1">
					{ARTIFACT_KIND_ORDER.filter((kind) => (kinds[kind] ?? 0) > 0).map((kind) => (
						<span
							key={kind}
							title={`${t(ARTIFACT_LABEL_KEY[kind])} · ${kinds[kind] ?? 0}`}
							className={`h-1.5 w-1.5 rounded-full ${ARTIFACT_DOT[kind]}`}
						/>
					))}
				</span>
				<div className="ml-auto flex items-center gap-0.5">
					{toolbarButton(t("spider.zoom.out"), () => zoomAround(1 / 1.35, { x: view.x + view.w / 2, y: view.y + view.h / 2 }), "−")}
					{toolbarButton(t("spider.zoom.reset"), () => setView(BASE_BOX), "⌂")}
					{toolbarButton(t("spider.zoom.in"), () => zoomAround(1.35, { x: view.x + view.w / 2, y: view.y + view.h / 2 }), "+")}
				</div>
			</div>

			<div className="relative min-h-0 flex-1">
				<svg
					ref={svgRef}
					viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
					className="h-full w-full touch-none select-none"
					role="img"
					aria-label={t("spider.aria")}
				>
					<defs>
						<radialGradient id="fc-web-fade" cx="50%" cy="50%" r="55%">
							<stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
							<stop offset="65%" stopColor="var(--color-primary)" stopOpacity="0.08" />
							<stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
						</radialGradient>
						<radialGradient id="fc-spider-body" cx="40%" cy="30%" r="70%">
							<stop offset="0%" stopColor="var(--color-foreground)" stopOpacity="0.95" />
							<stop offset="60%" stopColor="var(--color-foreground)" stopOpacity="0.75" />
							<stop offset="100%" stopColor="var(--color-foreground)" stopOpacity="0.55" />
						</radialGradient>
					</defs>

					<rect
						x={0}
						y={0}
						width={VIEW.width}
						height={VIEW.height}
						fill="transparent"
						className="cursor-grab active:cursor-grabbing"
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
						onPointerCancel={onPointerUp}
					/>

					<circle cx={CENTER.x} cy={CENTER.y} r={MAX_RADIUS + 10} fill="url(#fc-web-fade)" />
					<Web shimmer={animate} />

					{placed.map((entry) =>
						entry.parent ? (
							<path
								key={`e-${entry.node.id}`}
								d={edgePath(entry.parent, entry)}
								fill="none"
								stroke={STATE_COLOR[entry.node.state]}
								strokeWidth={entry.node.state === "fetching" ? 1.1 : 0.65}
								strokeDasharray={entry.node.state === "denied" ? "3 3" : undefined}
								opacity={entry.node.state === "queued" ? 0.3 : 0.6}
								className="motion-safe:animate-fc-line-in"
							/>
						) : null,
					)}

					{/* Packets ride each new arrival back to the hub: the web grabs, it does not just light up. */}
					{arrivals.map((arrival, index) => {
						const node = placed.find((entry) => entry.node.url === arrival.url);
						if (!node) return null;
						const stroke = ARTIFACT_STROKE[arrival.kinds[0] ?? "markdown"];
						return (
							<g key={`packet-${arrival.url}-${arrival.at}`}>
								<circle
									r={3.2}
									fill={stroke}
									fillOpacity={0.3}
									stroke="none"
									className="motion-safe:animate-fc-packet [transform-box:fill-box]"
								/>
								<circle r={1.4} fill={stroke} stroke="none" opacity={0.9} />
								<animateMotion
									path={edgePath(node, CENTER)}
									dur="2.4s"
									begin={`${(index * 0.3).toFixed(1)}s`}
									repeatCount="indefinite"
								/>
							</g>
						);
					})}

					{placed.map((entry, index) => (
						<NodeMark
							key={entry.node.id}
							entry={entry}
							animate={animate}
							showLabel={index < MAX_LABELS || entry.node.id === selectedId || entry.node.state === "fetching"}
							selected={entry.node.id === selectedId}
							onSelect={() => setSelectedId((current) => (current === entry.node.id ? null : entry.node.id))}
							label={entry.node.label}
						/>
					))}

					{fetching ? (
						<g key={`spider-${fetching.node.id}`}>
							<g
								key={`pose-${fetching.node.id}-${snapshot.arrivals.length}`}
								className="motion-safe:animate-fc-lunge [transform-box:fill-box]"
							>
								<SpiderGlyph animate={animate} />
							</g>
							<animateMotion
								path={edgePath({ x: CENTER.x, y: CENTER.y }, fetching)}
								dur="2.6s"
								repeatCount="indefinite"
							/>
						</g>
					) : (
						<g transform={`translate(${CENTER.x} ${CENTER.y + 1})`}>
							{/* Re-keyed on each arrival, so every grab replays the lunge. */}
							<g
								key={`pose-idle-${snapshot.arrivals.length}`}
								className="motion-safe:animate-fc-lunge [transform-box:fill-box]"
							>
								<SpiderGlyph animate={animate && snapshot.status === "running"} />
							</g>
						</g>
					)}
				</svg>

				{snapshot.nodes.length === 0 ? (
					<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
						<span className="text-[11px] font-medium text-muted-foreground">{t("spider.empty")}</span>
						<span className="text-[10px] text-muted-foreground/70">{t("spider.hint")}</span>
					</div>
				) : (
					<span className="pointer-events-none absolute bottom-0.5 left-1 text-[9px] text-muted-foreground/70">{t("spider.hint")}</span>
				)}

				{selected ? (
					<NodeDetail
						entry={selected}
						onClose={() => setSelectedId(null)}
						onLocate={() => locate(selected)}
						zoomed={zoomed}
					/>
				) : null}
			</div>
		</div>
	);
}

function toolbarButton(label: string, onClick: () => void, glyph: string) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={label}
			aria-label={label}
			className="rounded px-1 leading-none text-muted-foreground hover:bg-muted hover:text-foreground"
		>
			{glyph}
		</button>
	);
}

function edgePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
	const midX = (from.x + to.x) / 2;
	const midY = (from.y + to.y) / 2;
	// Bow every thread toward the hub: links are spun outward, not dropped straight.
	const ctrlX = midX + (CENTER.x - midX) * 0.16;
	const ctrlY = midY + (CENTER.y - midY) * 0.16;
	return `M ${from.x} ${from.y} Q ${ctrlX} ${ctrlY} ${to.x} ${to.y}`;
}

function Web({ shimmer }: { shimmer: boolean }) {
	const geometry = useMemo(() => {
		const spokes: string[] = [];
		for (let index = 0; index < SPOKES; index += 1) {
			const angle = (index / SPOKES) * Math.PI * 2 - Math.PI / 2;
			const end = webPoint(angle, MAX_RADIUS + 18);
			const ctrl = webPoint(angle + 0.05, (MAX_RADIUS + 18) / 2);
			spokes.push(`M ${CENTER.x} ${CENTER.y} Q ${ctrl.x} ${ctrl.y} ${end.x} ${end.y}`);
		}

		const rings: string[] = [];
		for (let ring = 0; ring < RINGS; ring += 1) {
			const radius = 16 + (ring * (MAX_RADIUS - 16)) / (RINGS - 1);
			const steps = 168;
			let path = "";
			for (let step = 0; step <= steps; step += 1) {
				const angle = (step / steps) * Math.PI * 2;
				const scallop = 0.94 + 0.06 * Math.cos(angle * SPOKES);
				const point = webPoint(angle, radius * scallop);
				path += `${step === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)} `;
			}
			rings.push(path.trim());
		}

		const random = prng(0x5eed);
		const dew = Array.from({ length: 14 }, () => {
			const angle = random() * Math.PI * 2;
			const radius = 20 + random() * (MAX_RADIUS - 20);
			const point = webPoint(angle, radius);
			return { x: point.x, y: point.y, r: 0.5 + random() * 0.9 };
		});

		return { spokes, rings, dew };
	}, []);

	return (
		<g className="text-primary" fill="none" stroke="currentColor">
			{geometry.spokes.map((path) => (
				<path key={path} d={path} strokeWidth={0.45} opacity={0.28} />
			))}
			{geometry.rings.map((path, index) => (
				<path
					key={path}
					d={path}
					strokeWidth={index === 0 ? 0.6 : 0.4}
					opacity={index === 0 ? 0.5 : 0.26}
					className={shimmer && index % 2 === 0 ? "motion-safe:animate-fc-web-shimmer" : undefined}
					style={shimmer ? { animationDelay: `${index * 240}ms` } : undefined}
				/>
			))}
			{geometry.dew.map((drop) => (
				<circle key={`${drop.x}-${drop.y}`} cx={drop.x} cy={drop.y} r={drop.r} fill="currentColor" opacity={0.35} stroke="none" />
			))}
		</g>
	);
}

function NodeMark({
	entry,
	animate,
	showLabel,
	selected,
	onSelect,
	label,
}: {
	entry: Placed;
	animate: boolean;
	showLabel: boolean;
	selected: boolean;
	onSelect: () => void;
	label: string;
}) {
	const { node } = entry;
	const radius = node.depth === 0 ? 5.4 : node.state === "crawled" ? 3.6 : 3;
	const color = STATE_COLOR[node.state];

	return (
		<g
			role="button"
			tabIndex={0}
			aria-label={`${node.label} · ${node.state}`}
			onClick={onSelect}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onSelect();
				}
			}}
			className="cursor-pointer outline-none"
		>
			<circle cx={entry.x} cy={entry.y} r={9} fill="transparent" />
			{node.state === "fetching" ? (
				<circle cx={entry.x} cy={entry.y} r={7} fill="none" stroke={color} strokeWidth={0.7} className={animate ? "motion-safe:animate-fc-pulse" : undefined} />
			) : null}
			<circle
				cx={entry.x}
				cy={entry.y}
				r={selected ? radius + 1.4 : radius}
				fill={node.state === "queued" ? "none" : color}
				stroke={selected ? "var(--color-foreground)" : color}
				strokeWidth={node.state === "queued" ? 0.9 : selected ? 0.9 : 0.4}
			/>
			{node.state === "failed" ? (
				<path
					d={`M ${entry.x - 2} ${entry.y - 2} L ${entry.x + 2} ${entry.y + 2} M ${entry.x + 2} ${entry.y - 2} L ${entry.x - 2} ${entry.y + 2}`}
					stroke="var(--color-background)"
					strokeWidth={0.8}
					strokeLinecap="round"
				/>
			) : null}
			{showLabel ? (
				<text
					x={entry.x}
					y={entry.y - radius - 2.6}
					textAnchor="middle"
					fontSize={8}
					className="fill-foreground"
					style={{ paintOrder: "stroke", stroke: "var(--color-background)", strokeWidth: 2.4, strokeLinejoin: "round" }}
				>
					{label.length > 22 ? `${label.slice(0, 21)}…` : label}
				</text>
			) : null}
		</g>
	);
}

const LEG_PATHS = [
	"M -1.5 -2.1 L -3.6 -4.4 L -6.0 -3.4",
	"M -1.7 -1.5 L -4.3 -3.1 L -6.7 -1.6",
	"M -1.8 -0.9 L -4.5 -1.1 L -6.9 0.5",
	"M -1.7 -0.3 L -4.1 1.4 L -6.1 3.3",
];

function Leg({ path, index, animate }: { path: string; index: number; animate: boolean }) {
	return (
		<path
			d={path}
			fill="none"
			stroke="var(--color-foreground)"
			strokeWidth={0.5}
			strokeLinecap="round"
			opacity={0.8}
			className={animate ? "motion-safe:animate-fc-leg" : undefined}
			style={{ transformOrigin: "0px 0px", animationDelay: `${index * 70}ms` }}
		/>
	);
}

/** Eight jointed legs, two body segments, four eyes — a spider, not an icon. */
function SpiderGlyph({ animate }: { animate: boolean }) {
	return (
		<g>
			<line x1={0} y1={-16} x2={0} y2={-3.6} stroke="var(--color-foreground)" strokeWidth={0.22} opacity={0.3} />
			{LEG_PATHS.map((path, index) => (
				<Leg key={`l-${path}`} path={path} index={index} animate={animate} />
			))}
			<g transform="scale(-1 1)">
				{LEG_PATHS.map((path, index) => (
					<Leg key={`r-${path}`} path={path} index={index} animate={animate} />
				))}
			</g>
			<ellipse cx={0} cy={2.7} rx={3.2} ry={3.1} fill="url(#fc-spider-body)" stroke="var(--color-foreground)" strokeWidth={0.25} />
			<path d="M -1.6 0.9 L 0 2.9 L 1.6 0.9" fill="none" stroke="var(--color-background)" strokeWidth={0.45} opacity={0.6} />
			<path d="M -1.8 3.4 L 0 4.9 L 1.8 3.4" fill="none" stroke="var(--color-background)" strokeWidth={0.45} opacity={0.45} />
			<ellipse cx={0} cy={-1.1} rx={2.0} ry={1.6} fill="var(--color-foreground)" opacity={0.92} />
			<circle cx={-1.0} cy={-2.5} r={0.3} fill="var(--color-foreground)" />
			<circle cx={-0.35} cy={-2.8} r={0.26} fill="var(--color-foreground)" />
			<circle cx={0.35} cy={-2.8} r={0.26} fill="var(--color-foreground)" />
			<circle cx={1.0} cy={-2.5} r={0.3} fill="var(--color-foreground)" />
		</g>
	);
}

function NodeDetail({
	entry,
	onClose,
	onLocate,
	zoomed,
}: {
	entry: Placed;
	onClose: () => void;
	onLocate: () => void;
	zoomed: boolean;
}) {
	const t = useTranslate();
	const { node } = entry;
	const [flash, setFlash] = useState<string | null>(null);

	const open = () => {
		void openExternal(node.url).catch(() => getPluginContext().ui.notify({ message: t("console.preview.openFailed"), error: true }));
	};

	const copy = async () => {
		const ok = await copyText(node.url);
		if (ok) {
			setFlash(t("console.preview.copied"));
			setTimeout(() => setFlash(null), 1_600);
		} else {
			getPluginContext().ui.notify({ message: t("console.preview.copyFailed"), error: true });
		}
	};

	return (
		<div className="absolute inset-x-1 bottom-1 rounded-md border border-border bg-background/95 p-1.5 shadow-sm backdrop-blur">
			<div className="flex items-start gap-1">
				<span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: STATE_COLOR[node.state] }} />
				<span className="min-w-0 flex-1 break-words text-[11px] font-medium leading-snug">{node.title || node.label}</span>
				<button type="button" onClick={onClose} className="shrink-0 rounded px-1 text-[11px] text-muted-foreground hover:bg-muted" aria-label={t("spider.detail.close")}>
					✕
				</button>
			</div>
			<div className="mt-0.5 break-all font-mono text-[9px] leading-tight text-muted-foreground">{node.url}</div>
			<div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[9.5px] text-muted-foreground">
				<span>{t(`metric.${node.state}`)}</span>
				<span>
					{t("console.depth")} {node.depth}
				</span>
				{typeof node.code === "number" ? <span>HTTP {node.code}</span> : null}
				{typeof node.chars === "number" ? <span>{formatCount(node.chars)} chars</span> : null}
				{typeof node.durationMs === "number" ? <span>{formatDuration(node.durationMs)}</span> : null}
			</div>
			<div className="mt-1 flex items-center gap-1">
				<button type="button" onClick={copy} className="rounded bg-muted px-1.5 py-0.5 text-[10px] hover:bg-muted/70">
					{t("spider.detail.copy")}
				</button>
				<button type="button" onClick={open} className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/25">
					{t("spider.detail.open")}
				</button>
				{zoomed ? (
					<button type="button" onClick={onLocate} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted">
						{t("spider.detail.locate")}
					</button>
				) : null}
				{flash ? <span className="ml-auto text-[9.5px] text-emerald-600 dark:text-emerald-400">{flash}</span> : null}
			</div>
		</div>
	);
}

function toUser(svg: SVGSVGElement, box: Box, clientX: number, clientY: number): { x: number; y: number } | null {
	const rect = svg.getBoundingClientRect();
	if (!rect.width || !rect.height) return null;
	const scale = Math.min(rect.width / box.w, rect.height / box.h);
	const offsetX = (rect.width - box.w * scale) / 2;
	const offsetY = (rect.height - box.h * scale) / 2;
	return { x: box.x + (clientX - rect.left - offsetX) / scale, y: box.y + (clientY - rect.top - offsetY) / scale };
}
