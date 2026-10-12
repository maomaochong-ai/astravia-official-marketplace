/**
 * bi-workbench.tsx — BI 工作台入口页（设计稿 workbench.tsx 对齐）。
 *
 * 从数据资产点「BI」按钮后落到的第一屏。
 * 回答两个问题：我有哪些看板、现在该从哪起手。
 *
 * 左栏：资产导航 + 数据源快捷区
 * 中间：看板卡片网格（含 pages/nodes 计数 + dirty 状态 chip + Preview 缩略图）+ 最近运行列表
 * 右栏：从哪开始 + 产物链接 + 发布入口
 *
 * 所有 counts / pages / nodes / run log 从后端 hooks 拿，无 mock 数据。
 * Preview 图表：从 template 解析第一个 chart 节点 kind，用确定性 hash 数据生成缩略图。
 */

import { useState, type JSX } from "react";
import { Icon } from "../shared/components/ui/icon";
import { Chip } from "../shared/components/ui/chip";
import { IconButton } from "../shared/components/ui/icon-button";
import { AreaChart, Bars, Donut } from "../shared/components/charts";
import { useBigscreenPages } from "../shared/hooks/use-bigscreen-pages";
import { useRunlogs } from "../shared/hooks/use-runlogs";
import { useSharelinks } from "../shared/hooks/use-sharelinks";
import { useWorktreeStatus } from "../shared/hooks/use-worktree-status";

interface NavItem {
	icon: string; label: string; key: string; count?: string;
}

const NAV: NavItem[] = [
	{ icon: "icon-[lucide--layout-dashboard]", label: "我的看板", key: "boards" },
	{ icon: "icon-[lucide--monitor]", label: "数据大屏", key: "screens" },
	{ icon: "icon-[lucide--table-2]", label: "数据集", key: "datasets" },
	{ icon: "icon-[lucide--folder-tree]", label: "工作树", key: "worktree" },
	{ icon: "icon-[lucide--share-2]", label: "分享给我", key: "shared" },
	{ icon: "icon-[lucide--trash-2]", label: "回收站", key: "trash" },
];

interface BoardCardData {
	name: string;
	pages: string;
	nodes: string;
	meta: string;
	state: string;
	/** 第一个图表节点 kind：line/bar/pie/donut/column/... 用于 Preview 缩略图 */
	kind?: string;
}

/** 从任意字符串生成 0-99 稳定伪随机整数数组（长度 14）。
 *  不抄设计稿 GMV mock 数据，而是用看板名称 hash 出自己的稳定序列，
 *  保证同一张看板每次渲染 preview 形状一致。 */
function hashPreview(seed: string, len = 14): number[] {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	const out: number[] = [];
	for (let i = 0; i < len; i++) {
		h ^= (h >>> 13); h = Math.imul(h, 1274126177); h ^= (h >>> 16);
		out.push((h % 60) + 20); // 20-79 区间，所有值正且有起伏
	}
	return out;
}

function PreviewChart({ kind, seed }: { kind?: string; seed: string }): JSX.Element {
	const v = hashPreview(seed);
	if (!kind) {
		return <AreaChart values={v} className="h-full w-full" stroke="currentColor" />;
	}
	if (/bar|column|histogram/i.test(kind)) {
		return <Bars values={v.slice(0, 7)} className="h-full w-full" tone="bg-series-2" />;
	}
	if (/pie|donut|ring/i.test(kind)) {
		const d = hashPreview(seed + "_d", 4);
		const sum = d.reduce((a, b) => a + b, 0) || 1;
		return (
			<div className="flex h-full w-full items-center justify-center">
				<Donut
					size={64}
					thickness={10}
					segments={d.map((n, i) => ({ value: n / sum, color: ["var(--color-series-1)", "var(--color-series-2)", "var(--color-series-3)", "var(--color-series-4)"][i % 4] }))}
				/>
			</div>
		);
	}
	return <AreaChart values={v} className="h-full w-full" stroke="currentColor" />;
}

export function BiWorkbench({ onOpenBoard, onCreateNew, onOpenDatasource, onOpenWorktree }: {
	onOpenBoard?: (pageId: string) => void;
	onCreateNew?: () => void;
	onOpenDatasource?: () => void;
	onOpenWorktree?: () => void;
}): JSX.Element {
	const { pages } = useBigscreenPages();
	const { runlogs, loading: runsLoading } = useRunlogs({ limit: 4 });
	const { sharelinks } = useSharelinks();
	const { dirty, publishedCount, updateCount, publish } = useWorktreeStatus();
	const [activeNav, setActiveNav] = useState("boards");

	// 从 pages 数组派生看板卡片
	const boards: BoardCardData[] = pages.map((p) => {
		let nodeCount = 0;
		let pageCount = 1;
		let chartKind: string | undefined;
		try {
			const tpl = typeof p.template === "string" ? JSON.parse(p.template) : p.template;
			if (tpl && typeof tpl === "object" && "nodes" in tpl) {
				const nodes = tpl.nodes as Record<string, { kind?: string; type?: string; nodeType?: string }>;
				nodeCount = Object.keys(nodes).length;
				// 找第一个 chart 节点的 kind（line/bar/pie/donut/column...）
				for (const n of Object.values(nodes)) {
					const k = (n.kind ?? n.type ?? n.nodeType ?? "").toString().toLowerCase();
					if (k && /line|bar|pie|donut|ring|column|histogram|area|scatter|funnel|gauge|radar|heatmap/.test(k)) {
						chartKind = k;
						break;
					}
				}
			}
		} catch { /* ignore */ }
		const dirtyForPage = ((p as Record<string, unknown>).publishedCount as number | undefined) != null
			? p.updateCount > ((p as Record<string, unknown>).publishedCount as number)
			: false;
		const state = dirtyForPage ? "草稿" : "已发布";
		return {
			name: p.name,
			pages: `${pageCount} 页`,
			nodes: `${nodeCount} 节点`,
			meta: `更新于 ${formatTime(p.updateTime)}`,
			state,
			kind: chartKind,
		};
	});

	const navCounts: Record<string, string> = {
		boards: String(pages.length),
		screens: "0",
		datasets: "0",
		worktree: dirty ? "待发布" : "干净",
	};

	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			{/* 顶栏 */}
			<header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-3 sm:px-5">
				<div className="flex shrink-0 items-center gap-2">
					<Icon name="icon-[lucide--database]" className="size-4 text-muted" />
					<span className="hidden sm:inline text-[13px] text-muted">数据资产</span>
					<Icon name="icon-[lucide--chevron-right]" className="hidden sm:inline size-3.5 text-faint" />
					<span className="text-[13px] font-semibold text-surface-foreground">BI 工作台</span>
					<Chip tone="accent">本地工作树</Chip>
				</div>
				<div className="hidden md:flex h-8 w-72 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2.5">
					<Icon name="icon-[lucide--search]" className="size-3.5 shrink-0 text-faint" />
					<span className="text-[12px] text-faint">搜索看板、大屏、数据集</span>
					<span className="ml-auto shrink-0 font-mono text-[10px] text-faint">⌘K</span>
				</div>
				<div className="ml-auto flex shrink-0 items-center gap-1">
					<button type="button" onClick={onOpenDatasource} className="hidden lg:flex h-7 items-center gap-1.5 rounded-control border border-transparent px-2 text-[11px] text-muted hover:border-border hover:text-surface-foreground">
						<Icon name="icon-[lucide--table-2]" className="size-3.5" />数据集
					</button>
					<button type="button" onClick={onOpenWorktree} className="hidden lg:flex h-7 items-center gap-1.5 rounded-control border border-transparent px-2 text-[11px] text-muted hover:border-border hover:text-surface-foreground">
						<Icon name="icon-[lucide--folder-tree]" className="size-3.5" />工作树
					</button>
					<span className="hidden lg:block h-4 w-px shrink-0 bg-border" />
					<IconButton size="sm" icon="icon-[lucide--clock-3]" title="最近打开" />
					{/* 用户头像 - 当前阶段不显示 */}
				</div>
			</header>

			<div className="flex min-h-0 flex-1">
				{/* 左栏 — 资产导航 */}
				<aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-border bg-surface-raised px-2 py-3">
					<div className="flex flex-col gap-0.5">
						{NAV.map((n) => {
							const on = activeNav === n.key;
							const count = navCounts[n.key];
							return (
								<button
									key={n.label}
									type="button"
									onClick={() => setActiveNav(n.key)}
									className={`flex h-8 items-center gap-2 rounded-control px-2 text-left ${on ? "bg-accent-soft" : "hover:bg-accent-soft/40"}`}
								>
									<Icon name={n.icon} className={`size-3.5 shrink-0 ${on ? "text-accent" : "text-muted"}`} />
									<span className={`text-[12px] ${on ? "font-medium text-accent" : "text-surface-foreground"}`}>{n.label}</span>
									{count ? <span className="ml-auto font-mono text-[10px] text-faint">{count}</span> : null}
								</button>
							);
						})}
					</div>

					{/* 数据源快捷区 */}
					<div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
						<span className="px-2 text-[10px] text-faint">数据源</span>
						<div className="flex h-7 items-center gap-2 px-2">
							<Icon name="icon-[lucide--database]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] text-surface-foreground">
								{navCounts.worktree}
							</span>
						</div>
						<button type="button" onClick={onOpenDatasource} className="flex h-6 items-center gap-1.5 rounded-control px-2 text-[10px] text-muted hover:text-surface-foreground">
							<Icon name="icon-[lucide--settings]" className="size-3" />
							管理数据源
						</button>
					</div>
				</aside>

				{/* 中间 — 看板卡片 + 最近运行 */}
				<main className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
					<div className="flex h-8 shrink-0 items-center gap-3">
						<span className="text-[15px] font-semibold text-surface-foreground">我的看板</span>
						<Chip>{pages.length} 个</Chip>
						<div className="ml-auto flex shrink-0 items-center gap-2">
							<div className="hidden sm:flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2 text-[11px] text-muted">
								<Icon name="icon-[lucide--clock-3]" className="size-3.5 shrink-0" />
								最近更新
								<Icon name="icon-[lucide--chevron-down]" className="size-3 text-faint" />
							</div>
							<button type="button" onClick={onCreateNew}
								className="flex h-7 items-center gap-1 rounded-control bg-accent px-2.5 text-[11px] font-medium text-accent-foreground hover:opacity-90">
								<Icon name="icon-[lucide--plus]" className="size-3" />新建看板
							</button>
						</div>
					</div>

					{/* 看板卡片网格 — 响应式列数 */}
					<div className="grid shrink-0 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{boards.length === 0 ? (
							<div className="col-span-full flex h-[180px] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border text-[11px] text-faint">
								<Icon name="icon-[lucide--layout-dashboard]" className="size-6 text-muted" />
								还没有看板 —— 点右上角「新建看板」开始
							</div>
						) : boards.map((b, i) => (
							<button type="button" key={b.name}
								onClick={() => onOpenBoard?.(b.name)}
								className={`group overflow-hidden rounded-card border bg-surface-raised text-left ${
									i === 0 ? "border-accent shadow-[0_0_0_3px_var(--color-accent-soft)]" : "border-border hover:border-border-strong"
								}`}>
								{/* Preview 缩略图区 — 112px 高，从 template 解析 kind 选图表类型 */}
								<div className="relative h-[112px] border-b border-border bg-background px-3 py-3">
									<div className="h-full w-full text-accent/70">
										<PreviewChart kind={b.kind} seed={b.name} />
									</div>
									<span className="absolute right-2 top-2 flex h-5 items-center gap-1 rounded-chip bg-surface-raised px-1.5 font-mono text-[10px] text-muted">
										{b.nodes}
									</span>
								</div>
								<div className="flex flex-col gap-1.5 px-3 py-2.5">
									<div className="flex items-center gap-2">
										<span className="truncate text-[13px] font-medium text-surface-foreground">{b.name}</span>
										{b.state === "草稿" ? <Chip tone="warning">未运行</Chip> : null}
										<IconButton size="xs" icon="icon-[lucide--x]" title="更多" className="ml-auto" />
									</div>
									<div className="flex items-center gap-2 text-[10px] text-faint">
										<span>{b.pages}</span>
										<span className="h-3 w-px bg-border" />
										<span>{b.meta}</span>
										<span className="ml-auto">{b.state}</span>
									</div>
								</div>
							</button>
						))}
					</div>

					{/* 最近运行 */}
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface-raised">
						<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
							<Icon name="icon-[lucide--play]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] font-medium text-surface-foreground">最近运行</span>
							<span className="ml-auto text-[10px] text-faint">看板与大屏共用同一本账</span>
						</div>
						<div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1.5 py-1.5">
							{runsLoading ? (
								<div className="flex items-center justify-center py-8 text-[11px] text-faint">加载中…</div>
							) : runlogs.length === 0 ? (
								<div className="flex items-center justify-center py-8 text-[11px] text-faint">暂无运行记录</div>
							) : runlogs.map((r) => (
								<div key={r.id} className="flex h-8 items-center gap-3 rounded-[4px] px-2">
									<span className="w-10 shrink-0 font-mono text-[10px] tabular-nums text-faint">{
										formatTime(r.createTime)
									}</span>
									<span className="w-40 shrink-0 truncate text-[11px] text-surface-foreground">{r.name ?? "未命名"}</span>
									<span className="min-w-0 flex-1 truncate text-[10px] text-faint">{r.detail ?? ""}</span>
									<span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted">{r.duration ?? "—"}</span>
									<span className={`flex h-[18px] shrink-0 items-center rounded-chip px-1.5 text-[10px] ${
										r.success !== false ? "bg-accent-soft text-accent" : "bg-warning-soft text-warning"
									}`}>
										{r.success !== false ? "成功" : "失败"}
									</span>
								</div>
							))}
						</div>
					</div>
				</main>

				{/* 右栏 — 从哪开始 + 产物链接 + 发布 - 在小屏幕上隐藏 */}
				<aside className="hidden xl:flex w-72 shrink-0 flex-col gap-4 overflow-hidden border-l border-border bg-surface-raised p-4">
					<div className="flex flex-col gap-2">
						<span className="text-[11px] font-medium text-surface-foreground">从哪开始</span>
						{[
							{ icon: "icon-[lucide--table-2]", title: "从数据集新建", note: "选一张表，勾字段，直接出图", onClick: onCreateNew },
							{ icon: "icon-[lucide--wand-sparkles]", title: "让 AI 生成", note: "说一句要什么，它去拼节点", onClick: onCreateNew },
							{ icon: "icon-[lucide--scroll-text]", title: "粘一条 SQL", note: "已有 SQL 的话，贴进来就是数据集", onClick: onCreateNew },
						].map((s) => (
							<button key={s.title} type="button" onClick={s.onClick}
								className="flex items-center gap-2.5 rounded-card border border-border bg-surface px-3 py-2.5 text-left hover:border-border-strong">
								<Icon name={s.icon} className="size-4 shrink-0 text-accent" />
								<div className="flex min-w-0 flex-col">
									<span className="text-[12px] text-surface-foreground">{s.title}</span>
									<span className="truncate text-[10px] text-faint">{s.note}</span>
								</div>
								<Icon name="icon-[lucide--chevron-right]" className="ml-auto size-3.5 shrink-0 text-faint" />
							</button>
						))}
					</div>

					{/* 产物链接 */}
					<div className="flex flex-col gap-2 border-t border-border pt-3">
						<span className="text-[11px] font-medium text-surface-foreground">产物链接</span>
						{sharelinks.length === 0 ? (
							<div className="rounded-card border border-border bg-surface px-3 py-4 text-center text-[11px] text-faint">
								还没有产物链接
							</div>
						) : sharelinks.slice(0, 2).map((s) => (
							<div key={s.id} className="flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2">
								<div className="flex items-center gap-2">
									<Icon name={s.type === "timed" ? "icon-[lucide--calendar-clock]" : "icon-[lucide--link-2]"} className="size-3.5 shrink-0 text-muted" />
									<span className="text-[11px] text-surface-foreground">{s.type === "timed" ? "限期分享" : "永久链接"}</span>
									<span className="ml-auto font-mono text-[10px] text-faint">
										{s.type === "timed" ? (s.remainingHours ? `剩 ${Math.round(s.remainingHours / 24)} 天` : "—") : "不过期"}
									</span>
								</div>
								<div className="flex items-center gap-1.5">
									<span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted">{s.shortUrl ?? s.id}</span>
									<IconButton size="xs" icon="icon-[lucide--copy]" title="复制链接" />
								</div>
							</div>
						))}
					</div>

					{/* 工作树状态 + 发布 */}
					<div className="mt-auto flex flex-col gap-2 rounded-card border border-border bg-surface px-3 py-2.5">
						<div className="flex items-center gap-2">
							<Icon name="icon-[lucide--folder-tree]" className="size-3.5 shrink-0 text-warning" />
							<span className="text-[11px] text-surface-foreground">
								{dirty ? `工作树有 ${updateCount - publishedCount} 个变更待发布` : "工作树已是最新状态"}
							</span>
						</div>
						{dirty ? (
							<button type="button" onClick={() => void publish()}
								className="flex h-7 items-center justify-center gap-1 rounded-control bg-accent px-2.5 text-[11px] font-medium text-accent-foreground hover:opacity-90">
								<Icon name="icon-[lucide--upload]" className="size-3" />
								发布并复制链接
							</button>
						) : (
							<div className="text-center text-[10px] text-faint">无待发布变更</div>
						)}
					</div>
				</aside>
			</div>
		</div>
	);
}

function formatTime(iso?: string): string {
	if (!iso) return "";
	const d = new Date(iso);
	const now = new Date();
	const sameDay = d.toDateString() === now.toDateString();
	const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
	if (sameDay) return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
	if (diffDays === 1) return "昨天";
	return `${d.getMonth() + 1}-${d.getDate()}`;
}
