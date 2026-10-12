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

import { useCallback, useEffect, useRef, useState, type JSX, type PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "../../shared/components/ui/icon";
import { Chip } from "../../shared/components/ui/chip";
import { IconButton } from "../../shared/components/ui/icon-button";
import { Btn } from "../../shared/components/ui/btn";
import { AreaChart, Funnel } from "../../shared/components/charts";
import { engineRequest } from "../../../shared/services/engine-client";
import type { BigscreenPage } from "../shared/hooks/use-bigscreen-pages";

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

// ── 大屏模板：持久化到 page.template ──

interface ScreenTemplate {
	nodes: ScreenNode[];
	settings: ScreenSettings;
}

function defaultScreenSettings(): ScreenSettings {
	return {
		resolution: "1920 × 1080 · 16:9",
		background: "深色渐变 · 内置第 2 套",
		autoRefresh: "5 分钟",
		carousel: "3 页 · 间隔 15s",
	};
}

const SCREEN_NODE_KINDS = ["title-bar", "kpi-card", "line-chart", "funnel", "rank-list", "carousel"];

function isScreenNode(value: unknown): value is ScreenNode {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const node = value as Record<string, unknown>;
	if (typeof node.id !== "string" || !node.id) return false;
	if (typeof node.kind !== "string" || !SCREEN_NODE_KINDS.includes(node.kind)) return false;
	for (const key of ["x", "y", "w", "h"]) {
		if (typeof node[key] !== "number" || !Number.isFinite(node[key] as number)) return false;
	}
	return typeof node.title === "string";
}

/** 只收认识的大屏设置字段，不把历史残留字段原样带回去 */
function pickSettings(source: Record<string, unknown>): Partial<ScreenSettings> {
	const out: Partial<ScreenSettings> = {};
	for (const key of ["resolution", "background", "autoRefresh", "carousel"] as const) {
		if (typeof source[key] === "string") out[key] = source[key] as string;
	}
	return out;
}

/**
 * 解析 page.template。
 * 只有 { nodes: ScreenNode[] } 算大屏内容；空串、"[]"、看板画布的 { nodes: {...}, links: [...] }、
 * 解析失败一律当空大屏 —— 以前这里直接铺一套演示节点，新建的大屏一进去全是假的。
 */
function parseScreenTemplate(raw: string | null | undefined): ScreenTemplate {
	const empty = (): ScreenTemplate => ({ nodes: [], settings: defaultScreenSettings() });
	if (!raw) return empty();
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return empty();
		const record = parsed as { nodes?: unknown; settings?: unknown };
		if (!Array.isArray(record.nodes)) return empty();
		const nodes = record.nodes.filter(isScreenNode).map((n) => ({ ...n, selected: false }));
		const settings =
			record.settings && typeof record.settings === "object" && !Array.isArray(record.settings)
				? { ...defaultScreenSettings(), ...pickSettings(record.settings as Record<string, unknown>) }
				: defaultScreenSettings();
		return { nodes, settings };
	} catch {
		return empty();
	}
}

/** 序列化大屏内容；selected 是临时选中态，不落盘 */
function serializeScreenTemplate(nodes: ScreenNode[], settings: ScreenSettings): string {
	return JSON.stringify({
		nodes: nodes.map((n) => ({ id: n.id, kind: n.kind, x: n.x, y: n.y, w: n.w, h: n.h, title: n.title })),
		settings,
	});
}

/** 新节点序号从已加载内容之后开始，避开 page.template 里已有的 id */
function nextNodeSeq(nodes: ScreenNode[]): number {
	let max = 9;
	for (const n of nodes) {
		const m = /-(\d+)$/.exec(n.id);
		if (m) max = Math.max(max, Number(m[1]));
	}
	return max + 1;
}

// ── 组件 ──

export interface BigscreenScreenEditorProps {
	page: BigscreenPage;
	onClose: () => void;
	/** 保存成功回调（回传最新 updateCount，父级据此刷新列表） */
	onSaved?: (updateCount: number) => void;
}

export function BigscreenScreenEditor({ page, onClose, onSaved }: BigscreenScreenEditorProps): JSX.Element {
	// 初值只认 page.template：新建的大屏就是空画布，不铺演示节点
	const [initial] = useState<ScreenTemplate>(() => parseScreenTemplate(page.template));
	const [nodes, setNodes] = useState<ScreenNode[]>(initial.nodes);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [zoom, setZoom] = useState(0.42); // 设计稿默认 42%
	const zoomRef = useRef(0.42); // 给 event handler 读，避免 useEffect 依赖 zoom
	const [linkCopied, setLinkCopied] = useState(false);
	const nodeSeqRef = useRef(nextNodeSeq(initial.nodes));
	const canvasWrapRef = useRef<HTMLDivElement>(null);
	const [canvasOffset, setCanvasOffset] = useState({ tx: 0, ty: 0 }); // translate 补偿
	const [settings, setSettings] = useState<ScreenSettings>(initial.settings);
	// 保存由本组件自己负责：已落盘指纹 + 保存中/未保存/错误
	const persistedRef = useRef<string>(serializeScreenTemplate(initial.nodes, initial.settings));
	const [saving, setSaving] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// zoom → zoomRef 同步（每次 zoom setState 后同步）
	useEffect(() => { zoomRef.current = zoom; }, [zoom]);

	// 内容真的变了才算脏：挂载和刚加载完都不该是「未保存」
	useEffect(() => {
		setDirty(serializeScreenTemplate(nodes, settings) !== persistedRef.current);
	}, [nodes, settings]);

	const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
	const nodeCount = nodes.length;

	// 更新选中节点的某个属性（右栏表单 onChange 回调）
	function patchSelectedNode(patch: Partial<ScreenNode>) {
		if (!selectedId) return;
		setNodes((prev) => prev.map((n) => n.id === selectedId ? { ...n, ...patch } : n));
	}

	// 大屏节点类型 → 默认尺寸
	const KIND_DEFAULTS: Record<string, { w: number; h: number; kind: string; title: string }> = {
		"title-bar": { w: 1840, h: 72, kind: "title-bar", title: "大屏标题" },
		"kpi-card": { w: 430, h: 120, kind: "kpi-card", title: "指标卡" },
		"line-chart": { w: 1100, h: 380, kind: "line-chart", title: "折线图" },
		"funnel": { w: 340, h: 380, kind: "funnel", title: "漏斗" },
		"rank-list": { w: 380, h: 380, kind: "rank-list", title: "排行榜" },
		"carousel": { w: 1100, h: 380, kind: "carousel", title: "轮播" },
	};

	const handleRailClick = useCallback((kindKey: string) => {
		const def = KIND_DEFAULTS[kindKey];
		if (!def) return;
		const newNode: ScreenNode = {
			id: `s-${kindKey}-${nodeSeqRef.current++}`,
			kind: def.kind,
			title: `${def.title} ${nodeSeqRef.current}`,
			x: 60 + ((nodes.length * 24) % 300),
			y: 400 + ((nodes.length * 24) % 200),
			w: def.w,
			h: def.h,
			selected: true,
		};
		setNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), newNode]);
		setSelectedId(newNode.id);
	}, [nodes.length]);

	// ── 节点拖拽（scale 容器坐标逆映射）──
	const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);

	function startDrag(id: string, e: ReactPointerEvent<HTMLDivElement>) {
		e.stopPropagation();
		const n = nodes.find((x) => x.id === id);
		if (!n) return;
		// 用 canvasWrapRef（scale 容器自身）的 rect + zoomRef 做逆映射
		// transformOrigin: "top left" → canvas 左上角对齐容器左上角
		const rect = canvasWrapRef.current?.getBoundingClientRect();
		if (!rect) return;
		const z = zoomRef.current;
		const canvasX = (e.clientX - rect.left) / z;
		const canvasY = (e.clientY - rect.top) / z;
		dragRef.current = { id, ox: canvasX - n.x, oy: canvasY - n.y };
		setSelectedId(id);
	}

	// window pointermove/up — 不依赖 zoom state（读 zoomRef），避免重注册
	useEffect(() => {
		function onMove(e: PointerEvent) {
			const d = dragRef.current;
			if (!d) return;
			const rect = canvasWrapRef.current?.getBoundingClientRect();
			if (!rect) return;
			const z = zoomRef.current;
			const canvasX = (e.clientX - rect.left) / z;
			const canvasY = (e.clientY - rect.top) / z;
			setNodes((prev) => prev.map((n) => n.id === d.id ? { ...n, x: canvasX - d.ox, y: canvasY - d.oy } : n));
		}
		function onUp() { dragRef.current = null; }
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
	}, []); // 空依赖 — 用 ref 读 zoom，listener 永远不重注册

	// Delete / Backspace 删除选中节点
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (!selectedId) return;
			if (e.key === "Delete" || e.key === "Backspace") {
				const tag = (e.target as HTMLElement | null)?.tagName;
				if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
				setNodes((prev) => prev.filter((n) => n.id !== selectedId));
				setSelectedId(null);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [selectedId]);

	// 画布点击空白区 → 取消选中
	const handleCanvasBgClick = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
		if (e.target === e.currentTarget) setSelectedId(null);
	}, []);

	// 适配视图 + 计算 translate 补偿 —— 统一在 useEffect 里做（DOM 就绪后）
	const fitContainer = useCallback(() => {
		const el = document.querySelector("[data-screen-fit-container]") as HTMLElement | null;
		if (!el) return;
		const r = el.getBoundingClientRect();
		if (r.width < 20 || r.height < 20) return; // 容器还没布局好
		const availW = r.width - 48;
		const availH = r.height - 48;
		const z = Math.min(availW / SCREEN_W, availH / SCREEN_H, 1);
		const newZoom = Number(Math.max(0.1, Math.min(2, z * 0.9)).toFixed(2));
		setZoom((cur) => (cur === newZoom ? cur : newZoom));
		const scaledW = SCREEN_W * newZoom;
		const scaledH = SCREEN_H * newZoom;
		setCanvasOffset({ tx: Math.max(0, (availW - scaledW) / 2), ty: Math.max(0, (availH - scaledH) / 2) });
	}, []);

	useEffect(() => {
		fitContainer();
		const onResize = () => fitContainer();
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [fitContainer]);

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

	async function handleRunAll() {
		try {
			await engineRequest("/drag/run/trigger", { pageId: page.id });
		} catch { /* 后端没跑时静默 */ }
	}

	// ── 保存：写的就是本画布自己的 { nodes, settings } ──
	async function handleSave(): Promise<boolean> {
		if (saving) return false;
		setSaving(true);
		setError(null);
		const template = serializeScreenTemplate(nodes, settings);
		try {
			const res = await engineRequest<{ updateCount?: number }>("/drag/page/edit", {
				id: page.id,
				name: page.name,
				type: "0",
				theme: page.theme,
				style: page.style,
				backgroundImage: page.backgroundImage,
				designType: page.designType,
				protectionCode: "",
				template,
				updateCount: page.updateCount,
			});
			persistedRef.current = template;
			setDirty(false);
			onSaved?.(res?.updateCount ?? page.updateCount);
			return true;
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
			return false;
		} finally {
			setSaving(false);
		}
	}

	async function handlePublish() {
		// 先保存再发布：保存失败就不发
		const saved = await handleSave();
		if (!saved) return;
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
				{error ? <Chip tone="danger">保存失败：{error}</Chip> : null}
				<div className="ml-auto flex shrink-0 items-center gap-2">
					<Btn size="sm" variant="ghost" icon="icon-[lucide--share-2]" onClick={() => {
						navigator?.clipboard?.writeText(shareUrl);
						setLinkCopied(true);
						setTimeout(() => setLinkCopied(false), 1500);
					}}>{linkCopied ? "已复制" : "分享"}</Btn>
					<Btn size="sm" variant="default" icon="icon-[lucide--play]" onClick={handleRunAll}>预览</Btn>
					<Btn size="sm" variant="primary" icon="icon-[lucide--upload]" onClick={() => { void handlePublish(); }} disabled={saving}>发布到工作树</Btn>
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
							// countKey → kindKey（KIND_DEFAULTS 的 key）
							const kindKeyMap: Record<string, string> = {
								title: "title-bar", kpi: "kpi-card", line: "line-chart",
								funnel: "funnel", rank: "rank-list", carousel: "carousel",
							};
							const kindKey = kindKeyMap[r.countKey] ?? r.countKey;
							return (
								<button
									key={r.label}
									type="button"
									onClick={() => handleRailClick(kindKey)}
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

					{/* scale 容器 — transform-origin top-left + translate 补偿居中
						  坐标映射：canvasX = (clientX - rect.left) / zoom
						  因为 top-left + translate 补偿后，scale 容器的渲染 rect.left/top 就是 translate 后的位置 */}
					<div data-screen-fit-container className="relative flex min-h-0 flex-1 bg-screen p-6">
						<div
							ref={canvasWrapRef}
							onPointerDown={handleCanvasBgClick}
							className="relative overflow-hidden rounded-card border border-screen-line bg-screen p-8 cursor-default"
							style={{
								width: SCREEN_W,
								height: SCREEN_H,
								transform: `translate(${canvasOffset.tx}px, ${canvasOffset.ty}px) scale(${zoom})`,
								transformOrigin: "top left",
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

							{/* 空态引导 —— 真·空白大屏，不预铺节点 */}
							{nodes.length === 0 ? (
								<div
									data-testid="screen-empty-guide"
									className="pointer-events-none absolute inset-0 grid place-items-center"
								>
									<div className="flex w-[460px] flex-col items-center gap-2 rounded-card border border-dashed border-border bg-surface-raised px-8 py-7 text-center">
										<Icon name="icon-[lucide--boxes]" className="size-6 text-faint" />
										<span className="text-[20px] font-semibold text-surface-foreground">空白大屏</span>
										<span className="text-[13px] leading-6 text-muted">
											从左侧「大屏节点」点击任意类型添加，例如「大屏标题」「大屏折线」「大屏指标卡」；保存后这里留下的就是你放的内容。
										</span>
									</div>
								</div>
							) : null}

							{/* 大屏节点渲染（按 id 排序，后面的盖前面的） */}
							{nodes.map((n) => (
								<div
									key={n.id}
									onPointerDown={(e) => startDrag(n.id, e)}
									className={`absolute flex flex-col rounded-card border bg-surface-raised cursor-grab ${
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

				{/* 右栏：节点属性可编辑 + 大屏设置 + 链接 */}
				<aside className="flex w-72 shrink-0 flex-col gap-4 overflow-hidden border-l border-border bg-surface-raised p-4">
					{/* 节点属性（有选中时显示可编辑表单） */}
					{selectedNode ? (
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<Icon name="icon-[lucide--activity]" className="size-3.5 shrink-0 text-accent" />
								<span className="text-[11px] font-medium text-surface-foreground">
									节点属性 · {selectedNode.kind}
								</span>
								<button
									type="button"
									onClick={() => {
										setNodes((prev) => prev.filter((n) => n.id !== selectedId));
										setSelectedId(null);
									}}
									className="ml-auto grid size-5 place-items-center rounded-control text-danger hover:bg-danger/10"
									title="删除节点（Delete / Backspace）"
								><Icon name="icon-[lucide--trash-2]" className="size-3" /></button>
							</div>
							<div className="flex flex-col gap-2 rounded-card border border-border bg-surface px-2.5 py-2">
								{/* title 编辑 */}
								<EditRow label="标题">
									<input
										type="text"
										value={selectedNode.title}
										onChange={(e) => patchSelectedNode({ title: e.target.value })}
										className="h-7 w-full rounded-control border border-border bg-background px-2 text-[11px] text-surface-foreground"
									/>
								</EditRow>
								{/* kind（只读显示） */}
								<EditRow label="类型">
									<span className="font-mono text-[10px] text-muted">{selectedNode.kind}</span>
								</EditRow>
								{/* 位置 × 尺寸 */}
								<div className="grid grid-cols-2 gap-1.5">
									<EditRow label="X">
										<input
											type="number"
											value={Math.round(selectedNode.x)}
											onChange={(e) => patchSelectedNode({ x: Number(e.target.value) })}
											className="h-7 w-full rounded-control border border-border bg-background px-2 font-mono text-[11px] text-surface-foreground"
										/>
									</EditRow>
									<EditRow label="Y">
										<input
											type="number"
											value={Math.round(selectedNode.y)}
											onChange={(e) => patchSelectedNode({ y: Number(e.target.value) })}
											className="h-7 w-full rounded-control border border-border bg-background px-2 font-mono text-[11px] text-surface-foreground"
										/>
									</EditRow>
									<EditRow label="宽">
										<input
											type="number"
											value={Math.round(selectedNode.w)}
											onChange={(e) => patchSelectedNode({ w: Number(e.target.value) })}
											className="h-7 w-full rounded-control border border-border bg-background px-2 font-mono text-[11px] text-surface-foreground"
										/>
									</EditRow>
									<EditRow label="高">
										<input
											type="number"
											value={Math.round(selectedNode.h)}
											onChange={(e) => patchSelectedNode({ h: Number(e.target.value) })}
											className="h-7 w-full rounded-control border border-border bg-background px-2 font-mono text-[11px] text-surface-foreground"
										/>
									</EditRow>
								</div>
							</div>
							<span className="text-[10px] text-faint">提示：画布中直接拖动节点也可改变位置</span>
						</div>
					) : (
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<Icon name="icon-[lucide--activity]" className="size-3.5 shrink-0 text-muted" />
								<span className="text-[11px] font-medium text-surface-foreground">节点属性</span>
							</div>
							<div className="rounded-card border border-dashed border-border p-3 text-center text-[11px] text-muted">
								<span className="font-mono text-faint">◈</span>
								<p className="mt-1">未选中任何节点</p>
								<p className="mt-0.5 text-faint">点击画布中的节点编辑属性</p>
							</div>
						</div>
					)}

					{/* 大屏设置（可编辑） */}
					<div className="flex flex-col gap-2 border-t border-border pt-3">
						<div className="flex items-center gap-2">
							<Icon name="icon-[lucide--settings]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] font-medium text-surface-foreground">大屏设置</span>
						</div>
						<div className="flex flex-col gap-2 rounded-card border border-border bg-surface px-2.5 py-2">
							<EditRow label="分辨率">
								<select
									value={settings.resolution}
									onChange={(e) => setSettings((s) => ({ ...s, resolution: e.target.value }))}
									className="h-7 w-full rounded-control border border-border bg-background px-2 text-[11px] text-surface-foreground"
								>
									<option value="1920 × 1080 · 16:9">1920 × 1080 · 16:9</option>
									<option value="3840 × 2160 · 4K">3840 × 2160 · 4K</option>
									<option value="1366 × 768 · 标准">1366 × 768 · 标准</option>
								</select>
							</EditRow>
							<EditRow label="背景">
								<input
									type="text"
									value={settings.background}
									onChange={(e) => setSettings((s) => ({ ...s, background: e.target.value }))}
									className="h-7 w-full rounded-control border border-border bg-background px-2 text-[11px] text-surface-foreground"
								/>
							</EditRow>
							<EditRow label="自动刷新">
								<select
									value={settings.autoRefresh}
									onChange={(e) => setSettings((s) => ({ ...s, autoRefresh: e.target.value }))}
									className="h-7 w-full rounded-control border border-border bg-background px-2 text-[11px] text-surface-foreground"
								>
									<option value="1 分钟">1 分钟</option>
									<option value="5 分钟">5 分钟</option>
									<option value="15 分钟">15 分钟</option>
									<option value="关闭">关闭</option>
								</select>
							</EditRow>
							<EditRow label="轮播">
								<input
									type="text"
									value={settings.carousel}
									onChange={(e) => setSettings((s) => ({ ...s, carousel: e.target.value }))}
									className="h-7 w-full rounded-control border border-border bg-background px-2 text-[11px] text-surface-foreground"
								/>
							</EditRow>
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

// ── 辅助组件 ──
function EditRow({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
	return (
		<label className="flex items-center gap-2">
			<span className="w-[46px] shrink-0 truncate text-[10px] text-muted">{label}</span>
			<span className="min-w-0 flex-1">{children}</span>
		</label>
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
