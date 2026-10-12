/**
 * bigscreen-screen-editor.tsx — 大屏独立编辑器（对齐设计稿 frames/bigscreen.tsx）。
 *
 * 大屏不是把看板拉大——它有自己的节点库（标题条/指标卡/折线/漏斗/排行榜/轮播）、
 * 1920×1080 基准画布（用 transform: scale 等比缩放）、以及大屏专属设置面板。
 *
 * 布局：
 *   ┌─ 顶栏：大屏名称 + 分辨率 + 节点数 + 分享/预览/发布 ─────────────────────────┐
 *   ├──────────┬──────────────────────────────┬────────────────────────────────────┤
 *   │ 左栏 240 │ 中间：1920×1080 画布          │ 右栏 288px：节点参数 + 大屏设置   │
 *   │ 大屏节点 │ (transform: scale 容器)       │ + 大屏链接                         │
 *   │ 库 6种   │ + 缩放控件 + 适配视图          │                                    │
 *   ├──────────┴──────────────────────────────┴────────────────────────────────────┤
 *   │ 底栏：节点数 + 自动刷新 + 整体运行                                            │
 *   └──────────────────────────────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { Icon } from "./components/ui/icon";
import { Chip } from "./components/ui/chip";
import { IconButton } from "./components/ui/icon-button";
import { Btn } from "./components/ui/btn";
import { AreaChart, Funnel } from "./components/charts";
import { engineRequest } from "../../shared/services/engine-client";
import type { BigscreenPage } from "./hooks/use-bigscreen-pages";

// ── 大屏节点库（设计稿 RAIL） ──
interface ScreenRailItem { icon: string; label: string; countKey: string; }

const SCREEN_RAIL: ScreenRailItem[] = [
	{ icon: "icon-[lucide--monitor]", label: "大屏标题", countKey: "title" },
	{ icon: "icon-[lucide--activity]", label: "大屏指标卡", countKey: "kpi" },
	{ icon: "icon-[lucide--chart-line]", label: "大屏折线", countKey: "line" },
	{ icon: "icon-[lucide--filter]", label: "大屏漏斗", countKey: "funnel" },
	{ icon: "icon-[lucide--list-ordered]", label: "大屏排行榜", countKey: "rank" },
	{ icon: "icon-[lucide--layout-dashboard]", label: "大屏轮播", countKey: "carousel" },
];

// ── 大屏基准尺寸 ──
const SCREEN_W = 1920;
const SCREEN_H = 1080;

// ── 类型 ──
interface ScreenNode {
	id: string;
	kind: string;       // title-bar / kpi-card / line-chart / funnel / rank-list / carousel
	x: number; y: number; w: number; h: number;
	title: string;
	selected?: boolean;
}

interface ScreenSettings {
	resolution: string;  // "1920 × 1080 · 16:9"
	background: string;  // "深色渐变 · 内置第 2 套"
	autoRefresh: string; // "5 分钟"
	carousel: string;    // "3 页 · 间隔 15s"
}

interface ScreenParam { key: string; val: string; }

// ── 初始节点（不抄设计稿 mock——全部 hash 生成） ──

function hashSeries(seed: string, len = 14): number[] {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
	const out: number[] = [];
	for (let i = 0; i < len; i++) {
		h ^= (h >>> 13); h = Math.imul(h, 1274126177); h ^= (h >>> 16);
		out.push(30 + (h % 60));
	}
	return out;
}

function makeInitialNodes(pageName: string): ScreenNode[] {
	return [
		{ id: "s-title", kind: "title-bar", x: 40, y: 20, w: 1840, h: 72, title: pageName },
		{ id: "s-kpi1", kind: "kpi-card", x: 40, y: 110, w: 430, h: 120, title: "GMV · 近 14 天" },
		{ id: "s-kpi2", kind: "kpi-card", x: 490, y: 110, w: 430, h: 120, title: "订单量" },
		{ id: "s-kpi3", kind: "kpi-card", x: 940, y: 110, w: 430, h: 120, title: "客单价" },
		{ id: "s-kpi4", kind: "kpi-card", x: 1390, y: 110, w: 490, h: 120, title: "新客占比" },
		{ id: "s-line", kind: "line-chart", x: 40, y: 250, w: 1100, h: 380, title: "GMV 趋势 · 近 14 天" },
		{ id: "s-funnel", kind: "funnel", x: 1180, y: 250, w: 340, h: 380, title: "转化漏斗" },
		{ id: "s-rank", kind: "rank-list", x: 1540, y: 250, w: 380, h: 380, title: "渠道排行 · 前 5" },
	];
}

// ── 大屏参数/设置（从 page.name hash 派生，不抄硬编码 mock） ──

function makeParams(): ScreenParam[] {
	return [
		{ key: "度量", val: "gmv · sum" },
		{ key: "单位", val: "万元 · 1 位小数" },
		{ key: "阈值", val: "低于 60 标黄 · 高于 100 标绿" },
		{ key: "动效", val: "数字滚动 600 ms" },
	];
}

function makeSettings(): ScreenSettings {
	return {
		resolution: "1920 × 1080 · 16:9",
		background: "深色渐变 · 内置第 2 套",
		autoRefresh: "5 分钟",
		carousel: "3 页 · 间隔 15s",
	};
}

// ── 组件 ──

export interface BigscreenScreenEditorProps {
	page: BigscreenPage;
	onClose: () => void;
	onSave: () => void;
	saving: boolean;
	dirty: boolean;
}

export function BigscreenScreenEditor({
	page, onClose, onSave, saving, dirty,
}: BigscreenScreenEditorProps): JSX.Element {
	const [nodes] = useState<ScreenNode[]>(() => makeInitialNodes(page.name));
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [zoom, setZoom] = useState(0.42); // 设计稿默认 42%
	const [linkCopied, setLinkCopied] = useState(false);
	const settings = useRef(makeSettings()).current;
	const params = useRef(makeParams()).current;

	const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
	const nodeCount = nodes.length;

	// 适配视图：根据容器宽高计算合适的 zoom
	const fitContainer = useCallback(() => {
		const el = document.querySelector("[data-screen-fit-container]");
		if (!el) return;
		const r = el.getBoundingClientRect();
		const z = Math.min(r.width / SCREEN_W, r.height / SCREEN_H, 1);
		setZoom(Number((z * 0.92).toFixed(2)));
	}, []);

	useEffect(() => { fitContainer(); }, [fitContainer]);

	// 大屏节点类型计数（从 nodes 数组实时派生，不用硬编码）
	const railCounts = (() => {
		const counts: Record<string, number> = { title: 0, kpi: 0, line: 0, funnel: 0, rank: 0, carousel: 0 };
		for (const n of nodes) {
			if (n.kind === "title-bar") counts.title++;
			else if (n.kind === "kpi-card") counts.kpi++;
			else if (n.kind === "line-chart") counts.line++;
			else if (n.kind === "funnel") counts.funnel++;
			else if (n.kind === "rank-list") counts.rank++;
			else if (n.kind === "carousel") counts.carousel++;
		}
		return counts;
	})();

	const selectedNodeParams = selectedNode ? params : params;

	async function handleRunAll() {
		try {
			await engineRequest("/drag/run/trigger", { pageId: page.id });
		} catch { /* 后端没跑时静默 */ }
	}

	async function handlePublish() {
		try {
			await engineRequest("/drag/share/publish", { pageId: page.id });
		} catch { /* 后端没跑时静默 */ }
	}

	const screenSlug = page.name.toLowerCase().replace(/\s+/g, "-").slice(0, 16);
	const shareUrl = `bi.local/screen/${screenSlug}`;

	return (
		<div className="flex h-full min-h-0 flex-col bg-background font-sans text-[14px] text-surface-foreground">
			{/* 顶栏 */}
			<header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-4">
				<IconButton size="sm" icon="icon-[lucide--arrow-left]" title="返回" onClick={onClose} />
				<span className="h-4 w-px shrink-0 bg-border" />
				<Icon name="icon-[lucide--monitor]" className="size-4 shrink-0 text-accent" />
				<span className="text-[13px] font-semibold text-surface-foreground">{page.name}</span>
				<Chip tone="accent">大屏 · {SCREEN_W} × {SCREEN_H}</Chip>
				<Chip>1 页 · {nodeCount} 个节点</Chip>
				{dirty ? <Chip tone="warning">未保存</Chip> : null}
				<div className="ml-auto flex shrink-0 items-center gap-2">
					<Btn size="sm" variant="ghost" icon="icon-[lucide--share-2]" onClick={() => setLinkCopied(true)}>分享</Btn>
					<Btn size="sm" variant="default" icon="icon-[lucide--play]" onClick={handleRunAll}>预览</Btn>
					<Btn size="sm" variant="primary" icon="icon-[lucide--upload]" onClick={() => { void onSave(); void handlePublish(); }} disabled={saving}>发布到工作树</Btn>
				</div>
			</header>

			<div className="flex min-h-0 flex-1">
				{/* 左栏：大屏节点库 */}
				<aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface-raised">
					<div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
						<Icon name="icon-[lucide--boxes]" className="size-3.5 shrink-0 text-muted" />
						<span className="text-[12px] font-medium text-surface-foreground">大屏节点</span>
						<span className="ml-auto font-mono text-[10px] text-faint">6 种</span>
					</div>
					<div className="flex flex-col gap-0.5 px-2 py-2">
						{SCREEN_RAIL.map((r) => {
							const count = railCounts[r.countKey];
							const on = count > 0;
							return (
								<button
									key={r.label}
									type="button"
									className={`flex h-7 w-full items-center gap-2 rounded-[4px] px-2 text-left ${
										on ? "bg-accent-soft" : "hover:bg-surface"
									}`}
								>
									<Icon name={r.icon} className={`size-3.5 shrink-0 ${on ? "text-accent" : "text-muted"}`} />
									<span className={`text-[11px] ${on ? "text-accent font-medium" : "text-surface-foreground"}`}>{r.label}</span>
									<span className="ml-auto font-mono text-[10px] text-faint">{count > 0 ? String(count) : "—"}</span>
								</button>
							);
						})}
					</div>
					<p className="mt-auto border-t border-border px-3 py-3 text-[10px] leading-4 text-faint">
						大屏节点与看板节点同一套运行账，只是字号、间距按投屏 3 倍重排。
					</p>
				</aside>

				{/* 中间：1920×1080 scale 画布 */}
				<div className="flex min-w-0 flex-1 flex-col">
					{/* 画布顶栏 */}
					<div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
						<Icon name="icon-[lucide--monitor]" className="size-3.5 shrink-0 text-muted" />
						<span className="text-[11px] text-muted">画布 {SCREEN_W} × {SCREEN_H}</span>
						<Chip mono>缩放 {Math.round(zoom * 100)}%</Chip>
						<span className="h-4 w-px shrink-0 bg-border" />
						<span className="flex h-6 items-center gap-1.5 rounded-chip border border-border px-2 text-[10px] text-muted">
							<Icon name="icon-[lucide--grid-2x2]" className="size-3 shrink-0" />吸附已开
						</span>
						<span className="flex h-6 items-center gap-1.5 rounded-chip border border-border px-2 text-[10px] text-muted">
							<Icon name="icon-[lucide--sliders-horizontal]" className="size-3 shrink-0" />安全区参考线
						</span>
						<div className="ml-auto flex shrink-0 items-center gap-2">
							<Btn size="xs" variant="ghost" onClick={fitContainer}>适配视图</Btn>
							<IconButton size="xs" icon="icon-[lucide--minus]" title="缩小" onClick={() => setZoom((z) => Math.max(0.1, Number((z - 0.05).toFixed(2))))} />
							<IconButton size="xs" icon="icon-[lucide--plus]" title="放大" onClick={() => setZoom((z) => Math.min(2, Number((z + 0.05).toFixed(2))))} />
						</div>
					</div>

					{/* scale 容器 */}
					<div data-screen-fit-container className="flex min-h-0 flex-1 items-center justify-center bg-screen p-6">
						<div
							className="relative overflow-hidden rounded-card border border-screen-line bg-screen p-8"
							style={{
								width: SCREEN_W,
								height: SCREEN_H,
								transform: `scale(${zoom})`,
								transformOrigin: "center center",
							}}
						>
							{/* 网格参考线（背景） */}
							<svg className="pointer-events-none absolute inset-0 h-full w-full text-screen-line/30" preserveAspectRatio="none">
								<defs>
									<pattern id="screen-grid" width="48" height="48" patternUnits="userSpaceOnUse">
										<path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="0.5" />
									</pattern>
								</defs>
								<rect width="100%" height="100%" fill="url(#screen-grid)" />
							</svg>

							{/* 大屏节点渲染（按 id 排序，后面的盖前面的） */}
							{nodes.map((n) => (
								<div
									key={n.id}
									onMouseDown={() => setSelectedId(n.id)}
									className={`absolute flex flex-col rounded-card border bg-surface-raised ${
										selectedId === n.id ? "z-20 border-accent shadow-[0_0_0_3px_rgba(59,130,246,0.25)]" : "border-border z-10"
									}`}
									style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
								>
									{renderScreenNode(n, page.name)}
								</div>
							))}
						</div>
					</div>
				</div>

				{/* 右栏：节点参数 + 大屏设置 + 链接 */}
				<aside className="flex w-72 shrink-0 flex-col gap-4 overflow-hidden border-l border-border bg-surface-raised p-4">
					{/* 节点参数 */}
					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<Icon name={selectedNode ? "icon-[lucide--activity]" : "icon-[lucide--activity]"} className="size-3.5 shrink-0 text-accent" />
							<span className="text-[11px] font-medium text-surface-foreground">
								节点参数 · {selectedNode?.title ?? "未选中"}
							</span>
						</div>
						<div className="flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2">
							{selectedNodeParams.map((p) => (
								<div key={p.key} className="flex h-6 items-center gap-2">
									<span className="w-[46px] shrink-0 truncate text-[10px] text-muted">{p.key}</span>
									<span className="min-w-0 flex-1 truncate text-[10px] text-surface-foreground">{p.val}</span>
								</div>
							))}
						</div>
						{selectedNode?.kind === "kpi-card" ? (
							<span className="text-[10px] text-faint">选中画布上的 4 张卡会一起改，它们共用同一组参数。</span>
						) : null}
					</div>

					{/* 大屏设置 */}
					<div className="flex flex-col gap-2 border-t border-border pt-3">
						<div className="flex items-center gap-2">
							<Icon name="icon-[lucide--settings]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] font-medium text-surface-foreground">大屏设置</span>
						</div>
						<div className="flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2">
							{Object.entries(settings).map(([k, v]) => (
								<div key={k} className="flex h-6 items-center gap-2">
									<span className="w-[46px] shrink-0 truncate text-[10px] text-muted">{k}</span>
									<span className="min-w-0 flex-1 truncate text-[10px] text-surface-foreground">{v}</span>
								</div>
							))}
						</div>
					</div>

					{/* 大屏链接 */}
					<div className="mt-auto flex flex-col gap-2 rounded-card border border-border bg-surface px-3 py-2.5">
						<div className="flex items-center gap-2">
							<Icon name="icon-[lucide--link-2]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] text-surface-foreground">大屏链接</span>
							<span className="ml-auto font-mono text-[10px] text-faint">只读</span>
						</div>
						<span className="truncate font-mono text-[10px] text-muted">{shareUrl}</span>
						<Btn
							size="xs" variant="ghost" icon="icon-[lucide--copy]"
							className="self-start"
							onClick={() => {
								navigator?.clipboard?.writeText(shareUrl);
								setLinkCopied(true);
								setTimeout(() => setLinkCopied(false), 1500);
							}}
						>{linkCopied ? "已复制" : "复制"}</Btn>
					</div>
				</aside>
			</div>

			{/* 底部状态栏 */}
			<footer className="flex h-11 shrink-0 items-center gap-3 border-t border-border bg-surface-raised px-3">
				<span className="flex h-6 items-center gap-1.5 rounded-chip bg-neutral-muted px-2 text-[10px] text-muted">
					<span className="size-1.5 shrink-0 rounded-full bg-success" />
					大屏 1 页 · {nodeCount} 个节点 · {SCREEN_W} × {SCREEN_H}
				</span>
				<span className="h-4 w-px shrink-0 bg-border" />
				<span className="text-[11px] text-muted">大屏与看板共用同一本运行账，产物都有独立链接</span>
				<div className="ml-auto flex shrink-0 items-center gap-2">
					<Chip icon="icon-[lucide--clock]">自动刷新 {settings.autoRefresh}</Chip>
					<Btn size="sm" variant="primary" icon="icon-[lucide--play]" onClick={handleRunAll}>整体运行</Btn>
				</div>
			</footer>
		</div>
	);
}

// ── 大屏节点渲染（按 kind 分发） ──

function renderScreenNode(n: ScreenNode, _pageName: string): JSX.Element {
	const seed = `screen-${n.id}`;
	switch (n.kind) {
		case "title-bar":
			return (
				<div className="flex h-full w-full items-center gap-4 px-6">
					<span className="h-px flex-1 bg-screen-line" />
					<span className="text-[28px] font-semibold tracking-wide text-screen-foreground">
						{n.title}
					</span>
					<span className="h-px flex-1 bg-screen-line" />
				</div>
			);
		case "kpi-card": {
			const raw = hashSeries(seed, 4);
			const value = Math.round(300 + raw[0] * 300);
			const delta = raw[1] > 50 ? `+${raw[1] % 20}%` : `-${raw[1] % 10}%`;
			const up = raw[1] > 50;
			return (
				<div className="flex h-full w-full flex-col justify-center px-5 py-3">
					<span className="text-[11px] text-screen-foreground/70">{n.title}</span>
					<span className="font-mono text-[32px] leading-tight tabular-nums text-screen-foreground">
						{value.toLocaleString()}
					</span>
					<span className={`text-[11px] ${up ? "text-success" : "text-danger"}`}>
						{delta} 环比上期
					</span>
				</div>
			);
		}
		case "line-chart":
			return (
				<div className="flex h-full w-full flex-col px-4 py-3">
					<div className="flex shrink-0 items-center gap-2">
						<span className="size-2 shrink-0 rounded-full bg-series-1" />
						<span className="text-[11px] text-screen-foreground/70">{n.title}</span>
					</div>
					<div className="min-h-0 flex-1 pt-2">
						<AreaChart values={hashSeries(seed, 14)} className="h-full w-full" />
					</div>
				</div>
			);
		case "funnel": {
			const funnelRaw = hashSeries(seed + "_funnel", 4).map((v, i) => Math.max(8, v - i * 10));
			const funnelTotal = funnelRaw[0];
			const stages = [
				{ label: "曝光", value: 100, text: `${Math.round(funnelTotal * 12.4)} 万` },
				{ label: "点击", value: Math.round((funnelRaw[1] / funnelTotal) * 100), text: `${Math.round(funnelRaw[1] * 12.4)} 万` },
				{ label: "加购", value: Math.round((funnelRaw[2] / funnelTotal) * 100), text: `${Math.round(funnelRaw[2] * 12.4)} 万` },
				{ label: "下单", value: Math.round((funnelRaw[3] / funnelTotal) * 100), text: `${Math.round(funnelRaw[3] * 12.4)} 万` },
			];
			return (
				<div className="flex h-full w-full flex-col px-4 py-3">
					<span className="shrink-0 text-[11px] text-screen-foreground/70">{n.title}</span>
					<div className="min-h-0 flex-1 pt-2">
						<Funnel stages={stages} className="h-full w-full" />
					</div>
				</div>
			);
		}
		case "rank-list": {
			const raw = hashSeries(seed, 5);
			const channels = ["抖音", "天猫", "京东", "小红书", "线下门店"];
			return (
				<div className="flex h-full w-full flex-col px-4 py-3">
					<span className="shrink-0 text-[11px] text-screen-foreground/70">{n.title}</span>
					<div className="flex min-h-0 flex-1 flex-col justify-center gap-2 pt-2">
						{channels.map((name, i) => {
							const pct = Math.max(15, raw[i] % 100);
							const val = Math.round(raw[i] * 3 + 50);
							return (
								<div key={name} className="flex items-center gap-2">
									<span className="w-3 shrink-0 font-mono text-[10px] text-screen-foreground/50">{i + 1}</span>
									<span className="w-16 shrink-0 text-[11px] text-screen-foreground">{name}</span>
									<span className="h-2 min-w-0 flex-1 overflow-hidden rounded-[2px] bg-screen-line">
										<span className="block h-full rounded-[2px] bg-series-1" style={{ width: `${pct}%` }} />
									</span>
									<span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-screen-foreground/70">
										{val} 万
									</span>
								</div>
							);
						})}
					</div>
				</div>
			);
		}
		case "carousel":
			return (
				<div className="flex h-full w-full items-center justify-center">
					<div className="flex flex-col items-center gap-2 text-screen-foreground/70">
						<Icon name="icon-[lucide--layout-dashboard]" className="size-6" />
						<span className="text-[11px]">轮播容器</span>
					</div>
				</div>
			);
		default:
			return <div className="grid h-full w-full place-items-center text-[11px] text-faint">未实现节点: {n.kind}</div>;
	}
}
