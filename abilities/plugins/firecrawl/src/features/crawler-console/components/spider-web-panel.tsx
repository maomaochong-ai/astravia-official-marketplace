/**
 * The spider web.
 *
 * Layout: the start page sits in the middle and every crawl hop moves outward by
 * one ring, so the picture is a radial tree rather than a random cloud — depth is
 * readable at a glance, and a link that was refused stays visible as a dashed
 * spoke instead of disappearing.
 *
 * Motion is CSS/SMIL only (no rAF): legs animate while a spider is on a fetching
 * node, a pulse ring marks the page being fetched, and a packet travels down each
 * active spoke. Everything is suppressed when the tab is inactive or the system
 * asks for reduced motion, so a warm tab costs no CPU.
 */

import { useMemo } from "react";
import type { ReactElement } from "react";
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

function Spider({ x, y, animate }: { x: number; y: number; animate: boolean }): ReactElement {
	return (
		<g transform={`translate(${x} ${y})`} className="pointer-events-none">
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

export function SpiderWebPanel({
	snapshot,
	active,
}: {
	snapshot: CrawlRunSnapshot;
	active: boolean;
}): ReactElement {
	const t = useTranslate();
	const { positions, byId, rings } = useMemo(() => layout(snapshot.nodes), [snapshot.nodes]);
	const running = snapshot.status === "running";
	const animate = active && running;
	const labelBudget = positions.length > 24 ? 16 : MAX_LABELS;

	const fetching = positions.filter((position) => position.node.state === "fetching");
	const ringRadii = Array.from({ length: Math.min(rings + 1, 4) }, (_, index) => (index + 1) * RING_STEP);

	return (
		<div className="relative flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
			<div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5">
				<span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
					{t("spider.title")}
				</span>
				<span className="font-mono text-[11px] text-muted-foreground">
					{running ? t("spider.state.live") : t(`console.status.${snapshot.status}`)}
				</span>
			</div>

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

				{/* Decorative web: rings + spokes, always faint so data stays dominant. */}
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
					<text
						x={CENTER_X}
						y={CENTER_Y + 4}
						textAnchor="middle"
						fontSize="11"
						fill="var(--muted-foreground)"
					>
						{t("spider.empty")}
					</text>
				) : null}

				{/* Spokes. */}
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
								stroke={
									failed ? "var(--destructive)" : denied ? "var(--muted-foreground)" : "var(--primary)"
								}
								strokeOpacity={denied ? 0.35 : failed ? 0.6 : 0.5}
								strokeWidth={position.node.state === "fetching" ? 1.6 : 1}
								strokeDasharray={denied ? "3 3" : undefined}
								className="motion-safe:animate-fc-line-in"
							/>
						);
					})}
				</g>

				{/* Packets travelling toward the pages being fetched. */}
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

				{/* Nodes. */}
				<g>
					{positions.map((position, index) => {
						const { node } = position;
						const color = stateColor(node.state);
						const showLabel = position.node.depth <= 1 || index < labelBudget;
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
									<text
										x={position.x}
										y={position.y + 2.6}
										textAnchor="middle"
										fontSize="6"
										fill="var(--destructive-foreground, #fff)"
									>
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

			<Legend counts={snapshot.counts} bytes={snapshot.bytes} />
		</div>
	);
}

function Legend({ counts, bytes }: { counts: CrawlCounts; bytes: number }): ReactElement {
	const t = useTranslate();
	const items: Array<{ key: keyof CrawlCounts | "bytes"; label: string; value: string; color: string }> = [
		{ key: "crawled", label: t("metric.crawled"), value: `${counts.crawled}`, color: "var(--primary)" },
		{ key: "fetching", label: t("metric.fetching"), value: `${counts.fetching}`, color: "var(--warning, #d97706)" },
		{ key: "queued", label: t("metric.queued"), value: `${counts.queued}`, color: "var(--border)" },
		{ key: "denied", label: t("metric.denied"), value: `${counts.denied}`, color: "var(--muted-foreground)" },
		{ key: "failed", label: t("metric.failed"), value: `${counts.failed}`, color: "var(--destructive)" },
		{ key: "bytes", label: t("metric.downloaded"), value: formatBytes(bytes), color: "var(--foreground)" },
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
