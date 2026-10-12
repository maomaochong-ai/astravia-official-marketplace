/**
 * bigscreen-workspace.tsx — BI 工作台入口（点 BI 按钮之后落到的第一屏）。
 *
 * 按设计稿 workbench.tsx 4 栏结构重写：
 *   ┌─ 面包屑 + 搜索 + 工具 ────────────────────────────────────────┐
 *   │ 左栏 NAV  │ 主栏：看板网格 + 最近运行 │ 右栏：入口 + 链接 + 发布 │
 *   └───────────┴────────────────────────────┴─────────────────────┘
 *
 * 数据策略：
 *   · BOARDS / RUNS / 数据源 / 产物链接 / 发布状态 → 真实后端
 *     Phase B 新增端点：/drag/datasource/list /drag/runlog/list /drag/sharelink/* /drag/worktree/*
 *   · START（三条入口）/ PREVIEW chart 值 → 静态（暂无后端）
 *   · Preview 缩略图 → charts.tsx 的 AreaChart / Bars / Donut
 */

import { useCallback, useEffect, useState, type JSX } from "react";
import { useBigscreenPages, type BigscreenPage } from "./hooks/use-bigscreen-pages";
import { BigscreenEditor } from "./bigscreen-editor";
import { getUi } from "../../runtime-contract";
import { engineRequest } from "../../shared/services/engine-client";
import { Icon } from "./components/ui/icon";
import { Chip } from "./components/ui/chip";
import { IconButton } from "./components/ui/icon-button";
import { Btn } from "./components/ui/btn";
import { AreaChart, Bars, Donut, SERIES } from "./components/charts";

// ── 后端类型（Phase B 新增端点返回值） ──
interface DataSource { id: string; name: string; type: string; status: string; }
interface RunLog { id: string; pageId?: string; pageName: string; detail: string; cost: string; state: string; createTime: string; }
interface ShareLink { id: string; pageId?: string; path: string; type: "permanent" | "timed"; expiresAt: string | null; password: string | null; createTime: string; }
interface WorktreeStatus { pages: { id: string; name: string; style: string; updateCount: number; publishedCount: number; publishedAt: string | null; dirty: boolean; }[]; dirtyCount: number; }

// ── 真实数据 hooks ──
function useDatasources(): { items: DataSource[]; refresh: () => void } {
	const [items, setItems] = useState<DataSource[]>([]);
	const refresh = useCallback(() => {
		engineRequest<DataSource[]>("/drag/datasource/list", undefined, { method: "GET" })
			.then((r) => setItems(r ?? []))
			.catch(() => { /* 后端没跑时静默 */ });
	}, []);
	useEffect(() => { refresh(); }, [refresh]);
	return { items, refresh };
}
function useRunlogs(): { items: RunLog[] } {
	const [items, setItems] = useState<RunLog[]>([]);
	useEffect(() => {
		engineRequest<{ records: RunLog[] }>("/drag/runlog/list?limit=4", undefined, { method: "GET" })
			.then((r) => setItems(r?.records ?? []))
			.catch(() => { /* 后端没跑时静默 */ });
	}, []);
	return { items };
}
function useSharelinks(): { items: ShareLink[] } {
	const [items, setItems] = useState<ShareLink[]>([]);
	useEffect(() => {
		engineRequest<ShareLink[]>("/drag/sharelink/list", undefined, { method: "GET" })
			.then((r) => setItems(r ?? []))
			.catch(() => { /* 后端没跑时静默 */ });
	}, []);
	return { items };
}
function useWorktreeStatus(): { status: WorktreeStatus | null; publish: (pageIds: string[]) => Promise<void> } {
	const [status, setStatus] = useState<WorktreeStatus | null>(null);
	const load = useCallback(() => {
		engineRequest<WorktreeStatus>("/drag/worktree/status", undefined, { method: "GET" })
			.then((r) => setStatus(r))
			.catch(() => { /* 静默 */ });
	}, []);
	const publish = useCallback(async (pageIds: string[]) => {
		await engineRequest<{ published: number }>("/drag/worktree/publish", { pageIds });
		load();
	}, [load]);
	useEffect(() => { load(); }, [load]);
	return { status, publish };
}

// ── 设计稿常量（静态，暂无后端） ──
const START = [
	{ icon: "icon-[lucide--table-2]", title: "从数据集新建", note: "选一张表，勾字段，直接出图" },
	{ icon: "icon-[lucide--wand-sparkles]", title: "让 AI 生成", note: "说一句要什么，它去拼节点" },
	{ icon: "icon-[lucide--scroll-text]", title: "粘一条 SQL", note: "已有 SQL 的话，贴进来就是数据集" },
];

const PREVIEW = (() => {
	function hv(seed: string, len: number, min: number, max: number): number[] {
		let h = 2166136261 >>> 0;
		for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
		const out: number[] = [];
		for (let i = 0; i < len; i++) { h ^= (h >>> 13); h = Math.imul(h, 1274126177); h ^= (h >>> 16); out.push(min + (h % (max - min))); }
		return out;
	}
	const _area = hv("bigscreen-preview-area", 14, 28, 88);
	const _bars = hv("bigscreen-preview-bars", 7, 30, 82);
	const _donutRaw = hv("bigscreen-preview-donut", 4, 10, 50);
	const _donutSum = _donutRaw.reduce((a, b) => a + b, 0);
	const _donut = _donutRaw.map((v) => Math.round((v / _donutSum) * 100));
	return { area: _area, bars: _bars, donut: _donut };
})();

function Preview({ kind }: { kind: string }) {
	if (kind === "bars") return <Bars values={PREVIEW.bars} className="h-full" tone="bg-[#10b981]" />;
	if (kind === "donut") {
		return (
			<div className="flex h-full items-center justify-center gap-3">
				<Donut
					size={72}
					thickness={12}
					segments={PREVIEW.donut.map((v, i) => ({ value: v, color: SERIES[i] }))}
				/>
				<Bars values={PREVIEW.donut} className="h-12 w-16" tone="bg-[#f59e0b]" />
			</div>
		);
	}
	return <AreaChart values={PREVIEW.area} className="h-full w-full" />;
}

function formatDate(iso?: string): string {
	if (!iso) return "";
	try {
		const d = new Date(iso);
		return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
	} catch {
		return "";
	}
}

function formatRunTime(iso?: string): string {
	if (!iso) return "—";
	try {
		const d = new Date(iso);
		return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
	} catch {
		return "—";
	}
}

function formatShareExpires(iso: string | null): string {
	if (!iso) return "不过期";
	try {
		const now = Date.now();
		const exp = new Date(iso).getTime();
		const days = Math.ceil((exp - now) / (24 * 3600 * 1000));
		if (days <= 0) return "已过期";
		return `剩 ${days} 天`;
	} catch {
		return "—";
	}
}

function PageThumb({
	page, previewKind, onOpen, onDelete, onCopy, onClone,
}: {
	page: BigscreenPage;
	previewKind: string;
	onOpen: (p: BigscreenPage) => void;
	onDelete: (p: BigscreenPage) => void;
	onCopy: (p: BigscreenPage) => void;
	onClone: (p: BigscreenPage) => void;
}) {
	const isScreen = page.style === "bigScreen";
	const kind = isScreen ? "大屏" : "看板";
	return (
		<div
			className={`group overflow-hidden rounded-card border bg-surface-raised transition hover:border-border-strong ${
				false ? "border-accent shadow-[0_0_0_3px_var(--color-accent-soft)]" : "border-border"
			}`}
			onClick={() => onOpen(page)}
		>
			<div className="relative h-[112px] border-b border-border bg-background px-3 py-3">
				<Preview kind={previewKind} />
				<span className="absolute right-2 top-2 flex h-5 items-center gap-1 rounded-chip bg-surface-raised px-1.5 font-mono text-[10px] text-muted">
					{page.updateCount} 次
				</span>
				<div className="absolute left-2 top-2 flex h-5 items-center gap-1 rounded-chip bg-surface-raised px-1.5">
					<span className={`size-1.5 rounded-full ${isScreen ? "bg-accent" : "bg-success"}`} />
					<span className="text-[10px] font-medium text-muted">{kind}</span>
				</div>
			</div>
			<div className="flex flex-col gap-1.5 px-3 py-2.5">
				<div className="flex items-center gap-2">
					<span className="truncate text-[13px] font-medium text-surface-foreground">{page.name}</span>
					{page.visits > 0 ? (
						<Chip tone="neutral" mono icon="icon-[lucide--eye]">{page.visits}</Chip>
					) : null}
					<IconButton size="xs" icon="icon-[lucide--more-horizontal]" title="更多" className="ml-auto" />
				</div>
				<div className="flex items-center gap-2 text-[10px] text-faint">
					<span>{formatDate(page.updateTime)}</span>
					<span className="h-3 w-px bg-border" />
					<span>更新 {page.updateCount} 次</span>
				</div>
				{/* hover 操作按钮 — 设计稿没有但功能需要 */}
				<div className="flex gap-1">
					<button
						type="button"
						className="rounded-control border border-border bg-surface px-2 py-0.5 text-[10px] text-muted hover:border-border-strong hover:text-surface-foreground"
						onClick={(e) => { e.stopPropagation(); onClone(page); }}
						title="复制"
					>复制</button>
					<button
						type="button"
						className="rounded-control border border-border bg-surface px-2 py-0.5 text-[10px] text-danger hover:border-danger/50"
						onClick={(e) => { e.stopPropagation(); onDelete(page); }}
						title="删除"
					>删除</button>
				</div>
			</div>
		</div>
	);
}

export function BigscreenWorkspace(): JSX.Element {
	const { pages, loading, error, refresh, create, remove, copy } = useBigscreenPages();
	const [editorPageId, setEditorPageId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);

	// ── Phase B 真实数据 ──
	const { items: datasources } = useDatasources();
	const { items: runlogs } = useRunlogs();
	const { items: sharelinks } = useSharelinks();
	const { status: worktree, publish } = useWorktreeStatus();

	// NAV 静态骨架（计数从真实 pages.length 来）
	const NAV_ITEMS = [
		{ icon: "icon-[lucide--layout-dashboard]", label: "我的看板", on: true },
		{ icon: "icon-[lucide--monitor]", label: "数据大屏", on: false },
		{ icon: "icon-[lucide--table-2]", label: "数据集", on: false },
		{ icon: "icon-[lucide--folder-tree]", label: "工作树", on: false },
		{ icon: "icon-[lucide--share-2]", label: "分享给我", on: false },
		{ icon: "icon-[lucide--trash-2]", label: "回收站", on: false },
	];

	const notify = (msg: string, variant: "success" | "error" | "info" = "info") => {
		try { getUi()?.notify?.({ message: msg, variant }); } catch { /* ignore */ }
	};

	async function handleCreate(style: "bigScreen" | "default") {
		setCreating(true);
		try {
			const name = style === "bigScreen" ? `新大屏 ${pages.length + 1}` : `新看板 ${pages.length + 1}`;
			const id = await create(name, { style });
			notify(`${style === "bigScreen" ? "大屏" : "看板"} 创建成功`, "success");
			setEditorPageId(id);
		} catch (err) {
			notify(`创建失败: ${err instanceof Error ? err.message : String(err)}`, "error");
		} finally {
			setCreating(false);
		}
	}

	async function handleDelete(page: BigscreenPage) {
		if (!confirm(`确认删除「${page.name}」？此操作不可恢复。`)) return;
		try { await remove(page.id); notify("已删除", "success"); }
		catch (err) { notify(`删除失败: ${err instanceof Error ? err.message : String(err)}`, "error"); }
	}

	async function handleCopy(page: BigscreenPage) {
		try { await copy(page.id); notify("已复制", "success"); }
		catch (err) { notify(`复制失败: ${err instanceof Error ? err.message : String(err)}`, "error"); }
	}

	// 打开编辑器态（优先级最高）
	if (editorPageId) {
		return <BigscreenEditor pageId={editorPageId} onClose={() => setEditorPageId(null)} />;
	}

	// Preview kind 轮换（让每个缩略图长得不一样）
	function previewKindFor(i: number): string {
		return ["area", "bars", "donut"][i % 3];
	}

	const screenPages = pages.filter((p) => p.style === "bigScreen");
	const boardPages = pages.filter((p) => p.style === "default");

	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			{/* 顶栏 */}
			<header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-5">
				<div className="flex shrink-0 items-center gap-2">
					<Icon name="icon-[lucide--database]" className="size-4 text-muted" />
					<span className="text-[13px] text-muted">数据资产</span>
					<Icon name="icon-[lucide--chevron-right]" className="size-3.5 text-faint" />
					<span className="text-[13px] font-semibold text-surface-foreground">BI 工作台</span>
					<Chip tone="accent">本地工作树</Chip>
				</div>

				<div className="flex h-8 w-72 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2.5">
					<Icon name="icon-[lucide--search]" className="size-3.5 shrink-0 text-faint" />
					<span className="text-[12px] text-faint">搜索看板、大屏、数据集</span>
					<span className="ml-auto shrink-0 font-mono text-[10px] text-faint">⌘K</span>
				</div>

				<div className="ml-auto flex shrink-0 items-center gap-1">
					<Btn size="sm" variant="ghost" icon="icon-[lucide--table-2]">数据集</Btn>
					<Btn size="sm" variant="ghost" icon="icon-[lucide--folder-tree]">工作树</Btn>
					<span className="h-4 w-px shrink-0 bg-border" />
					<IconButton size="sm" icon="icon-[lucide--history]" title="最近打开" />
					<div className="ml-1 grid size-7 shrink-0 place-items-center rounded-full border border-border bg-surface text-[11px] text-muted">诸</div>
				</div>
			</header>

			<div className="flex min-h-0 flex-1">
				{/* 左栏：资产导航 */}
				<aside className="flex w-52 shrink-0 flex-col border-r border-border bg-surface-raised px-2 py-3">
					<div className="flex flex-col gap-0.5">
						{NAV_ITEMS.map((n) => {
							// 真实计数从 pages 算
							const realCount = n.label === "我的看板" ? String(boardPages.length) :
							                  n.label === "数据大屏" ? String(screenPages.length) :
							                  "";
							return (
								<div key={n.label} className={`flex h-8 cursor-pointer items-center gap-2 rounded-control px-2 ${n.on ? "bg-accent-soft" : "hover:bg-surface"}`}>
									<Icon name={n.icon} className={`size-3.5 shrink-0 ${n.on ? "text-accent" : "text-muted"}`} />
									<span className={`text-[12px] ${n.on ? "font-medium text-accent" : "text-surface-foreground"}`}>{n.label}</span>
									{realCount ? <span className="ml-auto font-mono text-[10px] text-faint">{realCount}</span> : null}
								</div>
							);
						})}
					</div>

					<div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
						<span className="px-2 text-[10px] text-faint">数据源</span>
						{datasources.length === 0 ? (
							<div className="px-2 text-[10px] text-faint">（暂无）</div>
						) : datasources.map((ds) => (
							<div key={ds.id} className="flex h-7 items-center gap-2 px-2">
								<Icon name="icon-[lucide--database]" className="size-3.5 shrink-0 text-muted" />
								<span className="truncate text-[11px] text-surface-foreground">{ds.name}</span>
								<span className={`ml-auto size-1.5 shrink-0 rounded-full ${ds.status === "connected" ? "bg-success" : "bg-warning"}`} />
							</div>
						))}
						<Btn size="xs" variant="ghost" icon="icon-[lucide--settings]" className="self-start">管理数据源</Btn>
					</div>
				</aside>

				{/* 主栏：看板清单 + 最近运行 */}
				<main className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6">
					{/* 看板清单 */}
					<div className="flex h-8 shrink-0 items-center gap-3">
						<span className="text-[15px] font-semibold text-surface-foreground">我的看板</span>
						<Chip>{pages.length} 个</Chip>
						{loading && <span className="text-[11px] text-muted">加载中…</span>}
						{error && (
							<span className="flex items-center gap-1 text-[11px] text-danger">
								<Icon name="icon-[lucide--alert-triangle]" className="size-3" />
								{error}
							</span>
						)}
						<div className="ml-auto flex shrink-0 items-center gap-2">
							<div className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2 text-[11px] text-muted">
								<Icon name="icon-[lucide--history]" className="size-3.5 shrink-0" />最近更新
								<Icon name="icon-[lucide--chevron-down]" className="size-3 text-faint" />
							</div>
							<div className="flex h-7 items-center gap-0.5 rounded-control border border-border bg-surface p-0.5">
								<span className="grid size-[22px] place-items-center rounded-[4px] bg-accent-soft text-accent">
									<Icon name="icon-[lucide--grid-2x2]" className="size-3.5" />
								</span>
								<span className="grid size-[22px] place-items-center rounded-[4px] text-muted">
									<Icon name="icon-[lucide--list-ordered]" className="size-3.5" />
								</span>
							</div>
							<Btn size="sm" variant="default" icon="icon-[lucide--refresh-cw]" onClick={() => void refresh()}>刷新</Btn>
							<Btn size="sm" variant="primary" icon="icon-[lucide--plus]" disabled={creating} onClick={() => void handleCreate("default")}>新建看板</Btn>
							<Btn size="sm" variant="ai" icon="icon-[lucide--monitor]" disabled={creating} onClick={() => void handleCreate("bigScreen")}>新建大屏</Btn>
						</div>
					</div>

					{loading || pages.length === 0 ? (
						<div className="flex h-[200px] shrink-0 items-center justify-center rounded-card border border-border bg-surface-raised text-muted">
							{loading ? "加载中…" : "还没有看板，点右上角「新建看板」开始"}
						</div>
					) : (
						<div className="grid shrink-0 grid-cols-3 gap-4">
							{pages.map((p, i) => (
								<PageThumb
									key={p.id}
									page={p}
									previewKind={previewKindFor(i)}
									onOpen={(pg) => setEditorPageId(pg.id)}
									onDelete={handleDelete}
									onClone={handleCopy}
									onCopy={handleCopy}
								/>
							))}
						</div>
					)}

					{/* 最近运行 */}
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface-raised">
						<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
							<Icon name="icon-[lucide--play]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] font-medium text-surface-foreground">最近运行</span>
							<span className="ml-auto text-[10px] text-faint">看板与大屏共用同一本账</span>
						</div>
						<div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1.5 py-1.5">
							{runlogs.length === 0 ? (
								<div className="flex h-full items-center justify-center text-[11px] text-faint">暂无运行记录</div>
							) : runlogs.map((r) => (
								<div key={r.id} className="flex h-8 items-center gap-3 rounded-[4px] px-2 hover:bg-surface">
									<span className="w-10 shrink-0 font-mono text-[10px] tabular-nums text-faint">{formatRunTime(r.createTime)}</span>
									<span className="w-40 shrink-0 truncate text-[11px] text-surface-foreground">{r.pageName}</span>
									<span className="min-w-0 flex-1 truncate text-[10px] text-faint">{r.detail}</span>
									<span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted">{r.cost}</span>
									<span className={`flex h-[18px] shrink-0 items-center rounded-chip px-1.5 text-[10px] ${
										r.state === "成功" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
									}`}>{r.state}</span>
								</div>
							))}
						</div>
					</div>
				</main>

				{/* 右栏：从哪开始 + 产物链接 + 发布 */}
				<aside className="flex w-72 shrink-0 flex-col gap-4 overflow-hidden border-l border-border bg-surface-raised p-4">
					<div className="flex flex-col gap-2">
						<span className="text-[11px] font-medium text-surface-foreground">从哪开始</span>
						{START.map((s) => (
							<div key={s.title} className="flex items-center gap-2.5 rounded-card border border-border bg-surface px-3 py-2.5">
								<Icon name={s.icon} className="size-4 shrink-0 text-accent" />
								<div className="flex min-w-0 flex-col">
									<span className="text-[12px] text-surface-foreground">{s.title}</span>
									<span className="truncate text-[10px] text-faint">{s.note}</span>
								</div>
								<Icon name="icon-[lucide--chevron-right]" className="ml-auto size-3.5 shrink-0 text-faint" />
							</div>
						))}
					</div>

					<div className="flex flex-col gap-2 border-t border-border pt-3">
						<span className="text-[11px] font-medium text-surface-foreground">产物链接</span>
						{sharelinks.length === 0 ? (
							<div className="rounded-card border border-dashed border-border px-3 py-2 text-center text-[10px] text-faint">暂无分享链接</div>
						) : sharelinks.map((l) => (
							<div key={l.id} className="flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2">
								<div className="flex items-center gap-2">
									<Icon name={l.type === "permanent" ? "icon-[lucide--link-2]" : "icon-[lucide--calendar-clock]"} className="size-3.5 shrink-0 text-muted" />
									<span className="text-[11px] text-surface-foreground">{l.type === "permanent" ? "永久链接" : "限期分享"}</span>
									<span className={`ml-auto font-mono text-[10px] ${l.type === "permanent" ? "text-faint" : "text-warning"}`}>
										{l.type === "permanent" ? "不过期" : formatShareExpires(l.expiresAt)}
									</span>
								</div>
								<div className="flex items-center gap-1.5">
									<span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted">{l.path}</span>
									{l.password ? <Icon name="icon-[lucide--lock]" className="size-3 shrink-0 text-faint" /> : null}
									<IconButton size="xs" icon="icon-[lucide--copy]" title="复制链接" onClick={() => {
										navigator?.clipboard?.writeText(`https://${l.path}`);
										notify("已复制链接", "success");
									}} />
								</div>
							</div>
						))}
					</div>

					<div className="mt-auto flex flex-col gap-2 rounded-card border border-border bg-surface px-3 py-2.5">
						<div className="flex items-center gap-2">
							<Icon name="icon-[lucide--folder-tree]" className={`size-3.5 shrink-0 ${worktree?.dirtyCount ? "text-warning" : "text-success"}`} />
							<span className="text-[11px] text-surface-foreground">
								工作树 {worktree?.dirtyCount ?? 0} 个变更待发布
							</span>
						</div>
						<Btn
							size="sm"
							variant="primary"
							icon="icon-[lucide--upload]"
							disabled={!worktree?.dirtyCount}
							onClick={async () => {
								if (!worktree) return;
								const dirtyIds = worktree.pages.filter((p) => p.dirty).map((p) => p.id);
								await publish(dirtyIds);
								notify(`已发布 ${dirtyIds.length} 个页面`, "success");
							}}
						>发布并复制链接</Btn>
					</div>
				</aside>
			</div>
		</div>
	);
}
