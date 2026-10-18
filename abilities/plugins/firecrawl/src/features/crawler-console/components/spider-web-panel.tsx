/**
 * The spider panel: what a page is made of, and how the crawl walks it.
 *
 * Two layers, one story:
 *
 *   anatomy  – the current page as an element stack (headings, prose, links,
 *              images, video, code, tables). The spider travels a serpentine path
 *              through every extracted element, so "crawling" is visible at the
 *              level of content, not just at the level of URLs.
 *   topology – the radial hop map underneath, kept small: depth per ring, refused
 *              links as dashed spokes. It answers "where did this page come from".
 *
 * Motion is CSS/SMIL only. Both layers freeze when the tab is not active, so a
 * warm tab costs no CPU.
 */

import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import type { ElementProfile } from "../../../domain/html/elements";
import type { CrawlCounts, CrawlNodeView, CrawlRunSnapshot } from "../services/crawl-run-store";
import { useTranslate } from "../hooks/use-translate";
import { formatBytes, truncate } from "../../../shared/formatters/format";

const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 264;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = VIEW_HEIGHT / 2;
const RING_STEP = 52;
const MAX_RENDERED = 150;
const MAX_LABELS = 44;

/** Anatomy geometry. Rows are drawn top-down; ticks are laid out in a serpentine. */
const ROW_TOP = 34;
const ROW_HEIGHT = 21;
const TRACK_START = 84;
const TRACK_END = VIEW_WIDTH - 16;
const MAX_TICKS_PER_ROW = 26;

type ElementKey = "headings" | "paragraphs" | "links" | "images" | "videos" | "audio" | "code" | "tables";

const ROWS: Array<{ key: ElementKey; label: string }> = [
	{ key: "headings", label: "spider.el.headings" },
	{ key: "paragraphs", label: "spider.el.paragraphs" },
	{ key: "links", label: "spider.el.links" },
	{ key: "images", label: "spider.el.images" },
	{ key: "videos", label: "spider.el.videos" },
	{ key: "audio", label: "spider.el.audio" },
	{ key: "code", label: "spider.el.code" },
	{ key: "tables", label: "spider.el.tables" },
];

interface PositionedNode {
	node: CrawlNodeView;
	x: number;
	y: number;
	angle: number;
}

interface Layout {
	positions: PositionedNode[];
	byId: Map<string, PositionedNode>;
	rings: number;
}

function leafCount(node: CrawlNodeView, children: Map<string, CrawlNodeView[]>): number {
	const kids = children.get(node.id) ?? [];
	if (kids.length === 0) return 1;
	return kids.reduce((total, child) => total + leafCount(child, children), 0);
}

/**
 * Radial tree: each subtree owns an angular slice proportional to its leaf count,
 * which keeps siblings together and avoids crossing spokes.
 */
function layout(nodes: CrawlNodeView[]): Layout {
	const visible = nodes.slice(0, MAX_RENDERED);
	const children = new Map<string, CrawlNodeView[]>();
	const ids = new Set(visible.map((node) => node.id));
	for (const node of visible) {
		if (!node.parentId || !ids.has(node.parentId)) continue;
		const bucket = children.get(node.parentId);
		if (bucket) bucket.push(node);
		else children.set(node.parentId, [node]);
	}
	const roots = visible.filter((node) => !node.parentId || !ids.has(node.parentId));
	const positions: PositionedNode[] = [];
	const byId = new Map<string, PositionedNode>();
	let rings = 0;

	const place = (node: CrawlNodeView, startAngle: number, endAngle: number, depth: number): void => {
		const midAngle = (startAngle + endAngle) / 2;
		const radius = depth * RING_STEP;
		const position: PositionedNode = {
			node,
			x: CENTER_X + radius * Math.cos(midAngle),
			y: CENTER_Y + radius * Math.sin(midAngle),
			angle: midAngle,
		};
		positions.push(position);
		byId.set(node.id, position);
		rings = Math.max(rings, depth);
		const kids = children.get(node.id) ?? [];
		const total = kids.reduce((sum, kid) => sum + leafCount(kid, children), 0);
		if (total === 0) return;
		let cursor = startAngle;
		for (const kid of kids) {
			const share = (leafCount(kid, children) / total) * (endAngle - startAngle);
			place(kid, cursor, cursor + share, depth + 1);
			cursor += share;
		}
	};

	if (roots.length === 0) return { positions, byId, rings };
	const root = roots[0];
	for (const extra of roots.slice(1)) children.set(root.id, [...(children.get(root.id) ?? []), extra]);
	place(root, -Math.PI / 2, (3 * Math.PI) / 2, 0);
	return { positions, byId, rings };
}

function stateColor(state: CrawlNodeView["state"]): string {
	switch (state) {
		case "crawled":
			return "var(--primary)";
		case "fetching":
			return "var(--warning, #d97706)";
		case "denied":
			return "var(--muted-foreground)";
		case "failed":
			return "var(--destructive)";
		default:
			return "var(--border)";
	}
}

/** Eight animated legs; `translate` is applied by the caller. */
function SpiderGlyph({ animate }: { animate: boolean }): ReactElement {
	return (
		<g className="pointer-events-none">
			<ellipse cx="0" cy="1.2" rx="2.6" ry="2.1" fill="var(--foreground)" opacity="0.9" />
			<circle cx="0" cy="-2" r="1.7" fill="var(--foreground)" opacity="0.9" />
			<g stroke="var(--foreground)" strokeWidth="0.7" strokeLinecap="round" fill="none" opacity="0.85">
				{[-1, 1].map((side) =>
					[0, 1, 2, 3].map((index) => (
						<path
							key={`${side}-${index}`}
							d={`M ${side * 1.6} ${-1 + index * 1.1} Q ${side * 4} ${-2 + index * 1.4} ${side * 6.2} ${
								index * 1.7 - 1
							}`}
							className={animate ? "motion-safe:animate-fc-leg" : undefined}
							style={animate ? { animationDelay: `${index * 90}ms`, transformOrigin: "0px 0px" } : undefined}
						/>
					)),
				)}
			</g>
		</g>
	);
}

function Spider({ x, y, animate }: { x: number; y: number; animate: boolean }): ReactElement {
	return (
		<g transform={`translate(${x} ${y})`}>
			<SpiderGlyph animate={animate} />
		</g>
	);
}

interface Tick {
	x: number;
	y: number;
	row: number;
}

/** Serpentine path through the extracted elements, and the order the spider meets them. */
function anatomyPath(elements: ElementProfile): { ticks: Tick[]; path: string; durationMs: number } {
	const ticks: Tick[] = [];
	let y = ROW_TOP;
	for (const [index, row] of ROWS.entries()) {
		const count = Math.min(elements[row.key], MAX_TICKS_PER_ROW);
		if (count > 0) {
			const span = TRACK_END - TRACK_START;
			const step = count > 1 ? span / (count - 1) : 0;
			for (let i = 0; i < count; i += 1) {
				const offset = index % 2 === 0 ? i : count - 1 - i;
				ticks.push({ x: TRACK_START + step * offset, y, row: index });
			}
		}
		y += ROW_HEIGHT;
	}
	if (ticks.length === 0) return { ticks, path: "", durationMs: 0 };
	const path = ticks.map((tick, index) => `${index === 0 ? "M" : "L"} ${tick.x.toFixed(1)} ${tick.y}`).join(" ");
	return { ticks, path, durationMs: Math.min(9000, Math.max(2200, ticks.length * 220)) };
}

function currentPage(snapshot: CrawlRunSnapshot): {
	elements: ElementProfile | null;
	title: string;
	url: string;
	state: string;
} {
	const page = [...snapshot.pages].reverse().find((entry) => entry.elements);
	if (page?.elements) {
		return { elements: page.elements, title: page.title, url: page.url, state: "crawled" };
	}
	const fetched = [...snapshot.nodes].reverse().find((node) => node.state === "crawled" && node.elements);
	if (fetched?.elements) {
		return { elements: fetched.elements, title: fetched.title ?? "", url: fetched.url, state: fetched.state };
	}
	const fetching = snapshot.nodes.find((node) => node.state === "fetching");
	if (fetching) return { elements: null, title: fetching.label, url: fetching.url, state: "fetching" };
	return { elements: null, title: "", url: snapshot.target, state: snapshot.status };
}

export function SpiderWebPanel({
	snapshot,
	active,
}: {
	snapshot: CrawlRunSnapshot;
	active: boolean;
}): ReactElement {
	const t = useTranslate();
	const running = snapshot.status === "running";
	const animate = active && running;
	const page = useMemo(() => currentPage(snapshot), [snapshot]);
	const anatomy = useMemo(() => (page.elements ? anatomyPath(page.elements) : null), [page.elements]);
	const [view, setView] = useState<"anatomy" | "topology" | null>(null);
	const mode = view ?? (anatomy ? "anatomy" : "topology");

	return (
		<div className="relative flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
			<div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5">
				<span className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
					{mode === "anatomy" ? t("spider.anatomy.title") : t("spider.title")}
				</span>
				<div className="flex items-center gap-2">
					<span className="max-w-[190px] truncate font-mono text-[10.5px] text-muted-foreground">
						{page.url.replace(/^https?:\/\//, "")}
					</span>
					<div className="flex overflow-hidden rounded border border-border/70">
						{(["anatomy", "topology"] as const).map((option) => (
							<button
								key={option}
								type="button"
								onClick={() => setView(option)}
								className={`px-1.5 py-0.5 text-[10px] transition-colors ${
									mode === option
										? "bg-primary/12 text-foreground"
										: "text-muted-foreground hover:bg-muted/60"
								}`}
							>
								{t(option === "anatomy" ? "spider.view.anatomy" : "spider.view.topology")}
							</button>
						))}
					</div>
					<span className="font-mono text-[11px] text-muted-foreground">
						{running ? t("spider.state.live") : t(`console.status.${snapshot.status}`)}
					</span>
				</div>
			</div>

			{mode === "anatomy" ? (
				<AnatomyView
					elements={page.elements}
					anatomy={anatomy}
					title={page.title}
					animate={animate}
					media={snapshot.elements.media.length}
					streamed={snapshot.elements.streamed}
				/>
			) : (
				<TopologyView snapshot={snapshot} animate={animate} />
			)}

			<Legend counts={snapshot.counts} bytes={snapshot.bytes} media={snapshot.elements.media.length} />
		</div>
	);
}

function AnatomyView({
	elements,
	anatomy,
	title,
	animate,
	media,
	streamed,
}: {
	elements: ElementProfile | null;
	anatomy: { ticks: Tick[]; path: string; durationMs: number } | null;
	title: string;
	animate: boolean;
	media: number;
	streamed: number;
}): ReactElement {
	const t = useTranslate();

	if (!elements || !anatomy) {
		return (
			<div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-[11px] text-muted-foreground">
				{t("spider.waiting")}
			</div>
		);
	}

	const duration = `${(anatomy.durationMs / 1000).toFixed(2)}s`;
	const total = anatomy.ticks.length;

	return (
		<svg
			viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
			width="100%"
			className="min-h-0 flex-1 select-none"
			role="img"
			aria-label={t("spider.aria.elements", { title: title || t("spider.aria.untitled") })}
		>
			<defs>
				<linearGradient id="fc-scan-glow" x1="0" y1="0" x2="1" y2="0">
					<stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
					<stop offset="50%" stopColor="var(--primary)" stopOpacity="0.35" />
					<stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
				</linearGradient>
			</defs>

			{ROWS.map((row, index) => {
				const y = ROW_TOP + index * ROW_HEIGHT;
				const count = elements[row.key];
				return (
					<g key={row.key}>
						<line
							x1="12"
							y1={y}
							x2={VIEW_WIDTH - 10}
							y2={y}
							stroke="var(--foreground)"
							strokeOpacity="0.07"
						/>
						<text x="12" y={y - 3.4} fontSize="6.6" fill="var(--muted-foreground)">
							{t(row.label)}
						</text>
						<text x={VIEW_WIDTH - 10} y={y - 3.4} fontSize="6.6" textAnchor="end" fill="var(--muted-foreground)">
							{count}
						</text>
					</g>
				);
			})}

			{/* Extracted elements: one tick each, up to the per-row cap. */}
			<g>
				{anatomy.ticks.map((tick, index) => (
					<circle
						key={`${tick.row}-${index}`}
						cx={tick.x}
						cy={tick.y}
						r="1.9"
						fill="var(--primary)"
						opacity="0.45"
						className={animate ? "motion-safe:animate-fc-extract" : undefined}
						style={
							animate
								? {
										animationDuration: duration,
										animationDelay: `${((index / Math.max(total, 1)) * anatomy.durationMs).toFixed(0)}ms`,
									}
								: undefined
						}
					/>
				))}
			</g>

			{/* The trail the spider has already walked. */}
			<path
				d={anatomy.path}
				fill="none"
				stroke="url(#fc-scan-glow)"
				strokeWidth="5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>

			{animate ? (
				<>
					<g opacity="0.55">
						<SpiderGlyph animate={false} />
						<animateMotion path={anatomy.path} dur={duration} repeatCount="indefinite" rotate="auto" />
					</g>
					<g>
						<SpiderGlyph animate />
						<animateMotion path={anatomy.path} dur={duration} repeatCount="indefinite" rotate="auto" />
					</g>
					{/* Fade the trail in and out so the path reads as a surface being scanned. */}
					<circle r="3.4" fill="var(--warning, #d97706)" opacity="0.6">
						<animateMotion path={anatomy.path} dur={duration} repeatCount="indefinite" />
					</circle>
				</>
			) : (
				<Spider x={anatomy.ticks[0]?.x ?? 20} y={anatomy.ticks[0]?.y ?? ROW_TOP} animate={false} />
			)}

			<text x="12" y={VIEW_HEIGHT - 8} fontSize="6.4" fill="var(--muted-foreground)">
				{t("spider.anatomy.summary", {
					chars: elements.chars,
					media,
					streamed,
				})}
			</text>
		</svg>
	);
}

function TopologyView({ snapshot, animate }: { snapshot: CrawlRunSnapshot; animate: boolean }): ReactElement {
	const t = useTranslate();
	const { positions, byId, rings } = useMemo(() => layout(snapshot.nodes), [snapshot.nodes]);
	const labelBudget = positions.length > 24 ? 16 : MAX_LABELS;
	const fetching = positions.filter((position) => position.node.state === "fetching");
	const ringRadii = Array.from({ length: Math.min(rings + 1, 4) }, (_, index) => (index + 1) * RING_STEP);

	return (
		<svg
			viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
			width="100%"
			className="min-h-0 flex-1 select-none"
			role="img"
			aria-label={t("spider.aria")}
		>
			<defs>
				<radialGradient id="fc-web-fade" cx="50%" cy="50%" r="50%">
					<stop offset="55%" stopColor="var(--foreground)" stopOpacity="0" />
					<stop offset="100%" stopColor="var(--foreground)" stopOpacity="0.06" />
				</radialGradient>
			</defs>

			<g stroke="var(--foreground)" strokeOpacity="0.07" fill="none">
				{ringRadii.map((radius) => (
					<circle key={radius} cx={CENTER_X} cy={CENTER_Y} r={radius} />
				))}
				{Array.from({ length: 12 }, (_, index) => {
					const angle = (index / 12) * Math.PI * 2;
					return (
						<line
							key={index}
							x1={CENTER_X}
							y1={CENTER_Y}
							x2={CENTER_X + Math.cos(angle) * (VIEW_WIDTH / 1.6)}
							y2={CENTER_Y + Math.sin(angle) * (VIEW_WIDTH / 1.6)}
						/>
					);
				})}
			</g>
			<rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="url(#fc-web-fade)" />

			{positions.length === 0 ? (
				<text x={CENTER_X} y={CENTER_Y + 4} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
					{t("spider.empty")}
				</text>
			) : null}

			<g fill="none" strokeLinecap="round">
				{positions.map((position) => {
					const parent = position.node.parentId ? byId.get(position.node.parentId) : undefined;
					if (!parent) return null;
					const denied = position.node.state === "denied";
					const failed = position.node.state === "failed";
					return (
						<line
							key={`edge-${position.node.id}`}
							x1={parent.x}
							y1={parent.y}
							x2={position.x}
							y2={position.y}
							stroke={failed ? "var(--destructive)" : denied ? "var(--muted-foreground)" : "var(--primary)"}
							strokeOpacity={denied ? 0.35 : failed ? 0.6 : 0.5}
							strokeWidth={position.node.state === "fetching" ? 1.6 : 1}
							strokeDasharray={denied ? "3 3" : undefined}
							className="motion-safe:animate-fc-line-in"
						/>
					);
				})}
			</g>

			{animate
				? fetching.map((position) => {
						const parent = position.node.parentId ? byId.get(position.node.parentId) : undefined;
						if (!parent) return null;
						const path = `M ${parent.x} ${parent.y} L ${position.x} ${position.y}`;
						return (
							<circle key={`packet-${position.node.id}`} r="1.9" fill="var(--warning, #d97706)">
								<animateMotion path={path} dur="1.1s" repeatCount="indefinite" />
							</circle>
						);
					})
				: null}

			<g>
				{positions.map((position, index) => {
					const { node } = position;
					const color = stateColor(node.state);
					const showLabel = node.depth <= 1 || index < labelBudget;
					const isFetching = node.state === "fetching";
					return (
						<g key={`node-${node.id}`}>
							{isFetching && animate ? (
								<circle
									cx={position.x}
									cy={position.y}
									r="7"
									fill="none"
									stroke="var(--warning, #d97706)"
									strokeWidth="1.2"
									className="motion-safe:animate-fc-pulse"
								/>
							) : null}
							<circle
								cx={position.x}
								cy={position.y}
								r={node.depth === 0 ? 6 : node.state === "crawled" ? 4.2 : 3.4}
								fill={node.state === "denied" ? "var(--card)" : color}
								stroke={color}
								strokeWidth={node.state === "denied" ? 1.2 : 0}
								strokeDasharray={node.state === "denied" ? "2 1.5" : undefined}
								opacity={node.state === "queued" ? 0.65 : 1}
							/>
							{node.state === "failed" ? (
								<text x={position.x} y={position.y + 2.6} textAnchor="middle" fontSize="6" fill="var(--destructive-foreground, #fff)">
									×
								</text>
							) : null}
							{showLabel ? (
								<text
									x={position.x + (node.depth === 0 ? 0 : 7)}
									y={position.y + (node.depth === 0 ? -10 : 2.6)}
									textAnchor={node.depth === 0 ? "middle" : "start"}
									fontSize={node.depth === 0 ? 7.5 : 6.2}
									fill={node.state === "denied" ? "var(--muted-foreground)" : "var(--foreground)"}
									opacity={node.state === "denied" ? 0.6 : 0.9}
								>
									{truncate(node.label, node.depth === 0 ? 26 : 18)}
								</text>
							) : null}
						</g>
					);
				})}
			</g>

			{animate ? fetching.map((position) => <Spider key={`spider-${position.node.id}`} x={position.x} y={position.y} animate />) : null}
		</svg>
	);
}

function Legend({
	counts,
	bytes,
	media,
}: {
	counts: CrawlCounts;
	bytes: number;
	media: number;
}): ReactElement {
	const t = useTranslate();
	const items: Array<{ key: keyof CrawlCounts | "bytes" | "media"; label: string; value: string; color: string }> = [
		{ key: "crawled", label: t("metric.crawled"), value: `${counts.crawled}`, color: "var(--primary)" },
		{ key: "fetching", label: t("metric.fetching"), value: `${counts.fetching}`, color: "var(--warning, #d97706)" },
		{ key: "queued", label: t("metric.queued"), value: `${counts.queued}`, color: "var(--border)" },
		{ key: "denied", label: t("metric.denied"), value: `${counts.denied}`, color: "var(--muted-foreground)" },
		{ key: "failed", label: t("metric.failed"), value: `${counts.failed}`, color: "var(--destructive)" },
		{ key: "bytes", label: t("metric.downloaded"), value: formatBytes(bytes), color: "var(--foreground)" },
		{ key: "media", label: t("metric.media"), value: `${media}`, color: "var(--primary)" },
	];
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 px-3 py-1.5">
			{items.map((item) => (
				<span key={item.key} className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
					<span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: item.color }} />
					{item.label}
					<span className="font-mono text-foreground">{item.value}</span>
				</span>
			))}
		</div>
	);
}
