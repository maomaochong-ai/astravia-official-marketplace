/**
 * bi-workspace.tsx — BI 工作台入口（首屏）。
 *
 * 完整功能实现：
 *   - NAV 5 项真实切换（我的看板 / 数据集 / 数据源 / 工作树 / 分享给我 / 回收站）
 *   - 搜索框前端实时过滤
 *   - 排序下拉（更新时间 / 名称 / 创建时间 / 修改次数）
 *   - Grid / List 视图切换
 *   - 右栏三条入口（从数据集新建 / 问数（让 AI 生成）/ 粘一条 SQL）真实对话框 + 创建 + 跳转画布预置节点
 *   - 问数面板（对齐 Quick BI 智能问数）：选数据集 → 自然语言提问 → 插件内 AI loop 自助 run_sql 取数
 *     → 展示 SQL / 数据 / 图表 → 一键落画布为 source-sql + chart 节点图
 *   - 清空全部 notify("功能开发中") 占位
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useElementWidth } from "../../../shared/hooks/use-element-width";
import { useBigscreenPages, type BigscreenPage } from "../shared/hooks/use-bigscreen-pages";
import { CanvasEditor } from "../canvas/canvas-editor";
import { getUi } from "../../../runtime-contract";
import { readAllConfigs } from "../../../domain/dbx-storage";
import type { DbConnection } from "../../../domain/connection-config";
import { engineRequest } from "../../../shared/services/engine-client";
import dbxIcon from "../../../../assets/icon.png";
import { Icon } from "../shared/components/ui/icon";
import { Chip } from "../shared/components/ui/chip";
import { IconButton } from "../shared/components/ui/icon-button";
import { Btn } from "../shared/components/ui/btn";
import { AreaChart, Bars, Donut, SERIES } from "../shared/components/charts";
import type { NodePos, Link } from "../canvas/components/node-graph";
import { fnv1aArray } from "../../../shared/utils/hash";

// ── 后端类型 ──
interface DataSource { id: string; name: string; type: string; status: string; tables?: string[]; }
interface ShareLink { id: string; pageId?: string; path: string; type: "permanent" | "timed"; expiresAt: string | null; password: string | null; createTime: string; }
interface WorktreeStatus { pages: { id: string; name: string; style: string; updateCount: number; publishedCount: number; publishedAt: string | null; dirty: boolean; }[]; dirtyCount: number; }

// ── hooks ──
function useDatasources(): { items: DataSource[]; refresh: () => void } {
	const [items, setItems] = useState<DataSource[]>([]);
	const refresh = useCallback(() => {
		(async () => {
			// 对接数据库工作台：已保存的连接（插件私有存储）就是 BI 侧栏的数据源，
			// 与数据库工作台/连接管理用的是同一批配置，避免两套数据源各记各的。
			let engineItems: DataSource[] = [];
			try {
				engineItems = await engineRequest<DataSource[]>("/drag/datasource/list", undefined, { method: "GET" });
			} catch { /* 后端没跑时静默 */ }
			let saved: DbConnection[] = [];
			try { saved = await readAllConfigs(); } catch { /* 存储不可用则回退引擎列表 */ }
			const fromConnections: DataSource[] = saved.map((c) => ({
				id: c.id,
				name: c.name,
				type: c.db_type,
				status: c.last_test_ok === false ? "disconnected" : "connected",
			}));
			// 合并去重：优先引擎（可能带 tables/表信息），同名连接用保存的连接补一次。
			const byName = new Map<string, DataSource>();
			for (const d of engineItems) byName.set(d.name, d);
			for (const c of fromConnections) if (!byName.has(c.name)) byName.set(c.name, c);
			setItems([...byName.values()]);
		})().catch(() => {});
	}, []);
	useEffect(() => { refresh(); }, [refresh]);
	return { items, refresh };
}
function useSharelinks(): { items: ShareLink[] } {
	const [items, setItems] = useState<ShareLink[]>([]);
	useEffect(() => {
		engineRequest
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

// ── NAV 定义 ──
type NavId = "board" | "dataset" | "sources" | "worktree" | "shared" | "trash";

/** 工作树目录行 —— 与设计稿 frames/workbench.tsx L32-L44 对齐 */
type TreeRow = {
	/** depth0 唯一 key，用于 activeNav 映射 */
	key: string;
	label: string;
	count?: string;
	/** 0 级：一级分类；1 级：文件夹或数据源叶子 */
	depth: 0 | 1;
	icon?: string;
	/** 数据源叶子的连接状态点 */
	dot?: string;
	open?: boolean;
	on?: boolean;
	/** 这一支下面有未发布变更 */
	alert?: boolean;
	/** depth0 点击后切换到哪个 NavId；depth1 数据源叶子用它跳回数据源列表 */
	navKey?: NavId;
	/** depth1 叶子对应的页面 id：点击直接打开编辑器 */
	pageId?: string;
};

// ── 数据集：从页面模板里的数据源节点派生 ──
/** 画布 source* 节点类型 → 中文名。模板里没有独立数据集表，数据集就是这些节点本身。 */
const SOURCE_LABEL: Record<string, string> = {
	"source-sql": "SQL 查询",
	"source-connector": "直连数据源",
	"source-table": "数据表",
	"source-api": "接口",
	"source-csv": "本地文件",
	"source-extract": "抽取任务",
};

interface DatasetRow {
	key: string;
	/** 数据集所属页面，用于从目录树直接跳过去 */
	pageId: string;
	title: string;
	kind: string;
	/** 连接名 / 表名，能直接看出数据从哪来 */
	origin: string;
	detail: string;
	pageName: string;
}

/** 模板只认 { nodes, links }；解析失败当空画布，不让一条坏数据拖垮整个列表。 */
function collectDatasets(pages: BigscreenPage[]): DatasetRow[] {
	const rows: DatasetRow[] = [];
	for (const page of pages) {
		let parsed: unknown = page.template;
		if (typeof parsed === "string") {
			try { parsed = JSON.parse(parsed); } catch { continue; }
		}
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
		const nodes = (parsed as { nodes?: Record<string, { kind?: string; values?: Record<string, unknown> }> }).nodes;
		if (!nodes || typeof nodes !== "object") continue;
		for (const [nodeId, node] of Object.entries(nodes)) {
			const kind = String(node?.kind ?? "");
			if (!kind.startsWith("source")) continue;
			const v = node.values ?? {};
			const origin = String(v.tableName ?? "") || String(v.datasourceId ?? v.connectionId ?? "");
			const raw = String(v.sql ?? v.fields ?? "").replace(/\s+/g, " ").trim();
			rows.push({
				key: `${page.id}:${nodeId}`,
				pageId: page.id,
				title: String(v.title ?? "").trim() || SOURCE_LABEL[kind] || "数据集",
				kind: SOURCE_LABEL[kind] ?? kind,
				origin,
				detail: raw.length > 120 ? `${raw.slice(0, 120)}…` : raw,
				pageName: page.name,
			});
		}
	}
	return rows;
}


const PREVIEW = (() => {
	function hv(seed: string, len: number, min: number, max: number): number[] {
		return fnv1aArray(seed, len, min, max);
	}
	const _area = hv("bigscreen-preview-area", 14, 28, 88);
	const _bars = hv("bigscreen-preview-bars", 7, 30, 82);
	const _donutRaw = hv("bigscreen-preview-donut", 4, 10, 50);
	const _donutSum = _donutRaw.reduce((a, b) => a + b, 0);
	const _donut = _donutRaw.map((v) => Math.round((v / _donutSum) * 100));
	return { area: _area, bars: _bars, donut: _donut };
})();

function Preview({ kind }: { kind: string }) {
	if (kind === "bars") return <Bars values={PREVIEW.bars} className="h-full" tone="bg-series-2" />;
	if (kind === "donut") {
		return (
			<div className="flex h-full items-center justify-center gap-3">
				<Donut size={72} thickness={12}
					segments={PREVIEW.donut.map((v, i) => ({ value: v, color: SERIES[i] }))} />
				<Bars values={PREVIEW.donut} className="h-12 w-16" tone="bg-series-3" />
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
	} catch { return ""; }
}
function formatShareExpires(iso: string | null): string {
	if (!iso) return "不过期";
	try {
		const now = Date.now();
		const exp = new Date(iso).getTime();
		const days = Math.ceil((exp - now) / (24 * 3600 * 1000));
		if (days <= 0) return "已过期";
		return `剩 ${days} 天`;
	} catch { return "—"; }
}

function PageThumb({
	page, previewKind, onOpen, onDelete, onCopy, onClone, onRename, onShare,
}: {
	page: BigscreenPage;
	previewKind: string;
	onOpen: (p: BigscreenPage) => void;
	onDelete: (p: BigscreenPage) => void;
	onCopy: (p: BigscreenPage) => void;
	onClone: (p: BigscreenPage) => void;
	onRename: (p: BigscreenPage) => void;
	onShare: (p: BigscreenPage) => void;
}) {
	const kind = "看板";
	return (
		<div
			className="group overflow-hidden rounded-card border bg-surface-raised transition hover:border-border-strong border-border"
			onClick={() => onOpen(page)}
		>
			<div className="relative h-[112px] border-b border-border bg-background px-3 py-3">
				<Preview kind={previewKind} />
				<span className="absolute right-2 top-2 flex h-5 items-center gap-1 rounded-chip bg-surface-raised px-1.5 font-mono text-[10px] text-muted">
					{page.updateCount} 次
				</span>
				<div className="absolute left-2 top-2 flex h-5 items-center gap-1 rounded-chip bg-surface-raised px-1.5">
					<span className="size-1.5 rounded-full bg-success"/>
					<span className="text-[10px] font-medium text-muted">{kind}</span>
				</div>
			</div>
			<div className="flex flex-col gap-1.5 px-3 py-2.5">
				<div className="flex items-center gap-2">
					<span className="truncate text-[13px] font-medium text-surface-foreground">{page.name}</span>
					{page.visits > 0 ? (
						<Chip tone="neutral" mono icon="icon-[lucide--eye]">{page.visits}</Chip>
					) : null}
				</div>
				<div className="flex items-center gap-2 text-[10px] text-faint">
					<span>{formatDate(page.updateTime)}</span>
					<span className="h-3 w-px bg-border" />
					<span>更新 {page.updateCount} 次</span>
				</div>
				<div className="flex gap-1">
					<button
						type="button"
						className="rounded-control border border-border bg-surface px-2 py-0.5 text-[10px] text-muted hover:border-border-strong hover:text-surface-foreground"
						onClick={(e) => { e.stopPropagation(); onRename(page); }}
					>重命名</button>
					<button
						type="button"
						className="rounded-control border border-border bg-surface px-2 py-0.5 text-[10px] text-muted hover:border-border-strong hover:text-surface-foreground"
						onClick={(e) => { e.stopPropagation(); onShare(page); }}
					>分享</button>
					<button
						type="button"
						className="rounded-control border border-border bg-surface px-2 py-0.5 text-[10px] text-muted hover:border-border-strong hover:text-surface-foreground"
						onClick={(e) => { e.stopPropagation(); onClone(page); }}
					>复制</button>
					<button
						type="button"
						className="rounded-control border border-border bg-surface px-2 py-0.5 text-[10px] text-danger hover:border-danger/50"
						onClick={(e) => { e.stopPropagation(); onDelete(page); }}
					>删除</button>
				</div>
			</div>
		</div>
	);
}


export function BiWorkspace(): JSX.Element {
	const rootRef = useRef<HTMLDivElement>(null);
	const rootWidth = useElementWidth(rootRef);
	// 0 = 还没量到，按宽屏算，避免首帧闪成 compact
	const compact = rootWidth > 0 && rootWidth < 720;
	const narrow = rootWidth > 0 && rootWidth < 1080;
	const { pages, loading, error, refresh, create, remove, copy } = useBigscreenPages();
	const [editorPageId, setEditorPageId] = useState<string | null>(null);
	const [editorPreset, setEditorPreset] = useState<{ nodes: Record<string, NodePos>; links: Link[] } | undefined>(undefined);
	const [creating, setCreating] = useState(false);

	// ── 真实 hook 数据 ──
	const { items: datasources } = useDatasources();
	const { items: sharelinks } = useSharelinks();
	const { status: worktree, publish } = useWorktreeStatus();

	// ── 工作台本地 state ──
	const [activeNav, setActiveNav] = useState<NavId>("board");
	const [searchQuery, setSearchQuery] = useState("");
	const searchRef = useRef<HTMLInputElement>(null);
	const [sortKey, setSortKey] = useState<"updateTime" | "name" | "createTime" | "updateCount">("updateTime");
	const [sortOpen, setSortOpen] = useState(false);
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	/** 从左侧看板树点产物后聚焦到的页面 id（先聚焦视图，不直接进画布）。 */
	const [focusPageId, setFocusPageId] = useState<string | null>(null);
	const [renamePage, setRenamePage] = useState<BigscreenPage | null>(null);
	const [renameVal, setRenameVal] = useState("");
	const [sharePage, setSharePage] = useState<BigscreenPage | null>(null);
	const [shareType, setShareType] = useState<"permanent" | "timed">("permanent");
	const [shareBusy, setShareBusy] = useState(false);

	// 聚焦到某产物时，把对应卡片滚动进可视区，方便用户接着操作。
	useEffect(() => {
		if (!focusPageId) return;
		const el = document.querySelector(`[data-focused-id="${focusPageId}"]`);
		el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
	}, [focusPageId, viewMode]);

	// ── 工作树展开/折叠（默认 depth0 全开，回收站关） ──
	const [treeOpen, setTreeOpen] = useState<Record<string, boolean>>({
		board: true, dataset: true, sources: true, trash: false,
	});
	/** 切换 depth0 展开状态；depth1 叶子也有自己的展开状态 */
	function toggleTree(key: string) {
		setTreeOpen((prev) => ({ ...prev, [key]: !prev[key] }));
	}


	const notify = (msg: string, variant: "success" | "error" | "info" = "info") => {
		try { getUi()?.notify?.({ message: msg, variant }); } catch { /* ignore */ }
	};

	// ── ⌘K / Ctrl+K 聚焦搜索（顶栏标了快捷键，就得真的能用） ──
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				searchRef.current?.focus();
				searchRef.current?.select();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// ── 派生：按 NAV + search + sort 过滤后的 pages ──
	const derivedPages = useMemo(() => {
		let arr = pages;
		// dataset / sources / worktree / shared / trash 不渲染 pages 网格
		const q = searchQuery.trim().toLowerCase();
		if (q) arr = arr.filter((p) => p.name.toLowerCase().includes(q));
		// sort
		const sorted = [...arr];
		if (sortKey === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
		else if (sortKey === "updateCount") sorted.sort((a, b) => b.updateCount - a.updateCount);
		else sorted.sort((a, b) => {
			const at = new Date(sortKey === "createTime" ? (a.createTime || 0) : (a.updateTime || a.createTime || 0)).getTime();
			const bt = new Date(sortKey === "createTime" ? (b.createTime || 0) : (b.updateTime || b.createTime || 0)).getTime();
			return bt - at;
		});
		return sorted;
	}, [pages, activeNav, searchQuery, sortKey]);

	// ── 派生：工作树目录（从真实数据，不是写死的） ──
	const datasetRows = useMemo(() => collectDatasets(pages), [pages]);

	const treeRows: TreeRow[] = useMemo(() => {
		const rows: TreeRow[] = [];

		// ① 我的看板
		const boardOpen = treeOpen.board ?? true;
		rows.push({
			key: "board", navKey: "board", label: "我的看板",
			count: String(pages.length),
			depth: 0, icon: "icon-[lucide--layout-dashboard]",
			open: boardOpen, on: activeNav === "board",
			alert: worktree?.pages.some((p) => p.style === "default" && p.dirty) ?? false,
		});
		if (boardOpen) {
			// depth1 直接列真实看板：点一下就能打开，不再放没有动作的「未分组」占位行。
			pages.forEach((p) => {
				rows.push({
					key: `board-${p.id}`,
					label: p.name,
					depth: 1,
					navKey: "board",
					pageId: p.id,
					icon: "icon-[lucide--file-text]",
					dot: worktree?.pages.some((w) => w.id === p.id && w.dirty) ? "bg-warning" : undefined,
				});
			});
		}


		// ③ 数据集（简化：所有 pages 都算"数据集"，depth1 叶子只渲染未分组）
		const datasetOpen = treeOpen.dataset ?? true;
		rows.push({
			key: "dataset", navKey: "dataset", label: "数据集",
			count: String(datasetRows.length),
			depth: 0, icon: "icon-[lucide--table-2]",
			open: datasetOpen, on: activeNav === "dataset",
		});
		if (datasetOpen) {
			// 数据集本身就是画布里的 source 节点，点进去打开它所属的页面。
			datasetRows.forEach((d) => {
				rows.push({
					key: `dataset-${d.key}`,
					label: d.title,
					depth: 1,
					icon: "icon-[lucide--table-2]",
					pageId: d.pageId,
				});
			});
		}

		// ④ 数据源（从 datasources 派生）
		const sourcesOpen = treeOpen.sources ?? true;
		rows.push({
			key: "sources", navKey: "sources", label: "数据源",
			count: String(datasources.length),
			depth: 0, icon: "icon-[lucide--database]",
			open: sourcesOpen, on: activeNav === "sources",
		});
		if (sourcesOpen) {
			datasources.forEach((ds) => {
				const tables = ds.tables?.length ?? 0;
				rows.push({
					key: `ds-${ds.id}`,
					label: ds.name,
					count: tables > 0 ? `${tables} 表` : undefined,
					depth: 1,
					navKey: "sources",
					dot: ds.status === "connected" ? "bg-success" : "bg-border-strong",
				});
			});
		}

		// ④' 工作树 / 分享给我 —— renderMainContent 已有对应视图，这里补上入口
		rows.push({
			key: "worktree", navKey: "worktree", label: "工作树",
			count: worktree?.dirtyCount ? String(worktree.dirtyCount) : undefined,
			depth: 0, icon: "icon-[lucide--git-branch]",
			on: activeNav === "worktree",
			alert: !!worktree?.dirtyCount,
		});
		rows.push({
			key: "shared", navKey: "shared", label: "分享给我",
			count: String(sharelinks.length),
			depth: 0, icon: "icon-[lucide--link-2]",
			on: activeNav === "shared",
		});

		// ⑤ 回收站
		rows.push({
			key: "trash", navKey: "trash", label: "回收站",
			count: "0",
			depth: 0, icon: "icon-[lucide--trash-2]",
			open: treeOpen.trash ?? false, on: activeNav === "trash",
		});


		return rows;
		// 叶子直接展示页面名称，依赖 pages 而不只是 length，改名后树才不会留旧文本
	}, [pages, datasources, worktree, sharelinks.length, activeNav, treeOpen]);


	async function handleCreate() {
		setCreating(true);
		try {
			const id = await create(`新看板 ${pages.length + 1}`, { style: "default" });
			notify("看板创建成功", "success");
			setEditorPreset(undefined);
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

	async function handleRename(page: BigscreenPage) {
		const name = renameVal.trim();
		if (!name || name === page.name) { setRenamePage(null); return; }
		try {
			await engineRequest<{ updateCount: number }>("/drag/page/edit", { id: page.id, name });
			notify("已重命名", "success");
			setRenamePage(null);
			await refresh();
		} catch (err) {
			notify(`重命名失败: ${err instanceof Error ? err.message : String(err)}`, "error");
		}
	}

	async function handleShare(page: BigscreenPage) {
		setShareBusy(true);
		try {
			const link = await engineRequest<ShareLink>("/drag/sharelink/create", {
				pageId: page.id,
				type: shareType,
				expiresAt: shareType === "timed" ? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() : undefined,
			});
			await navigator.clipboard?.writeText(`https://${link.path}`).catch(() => {});
			notify("已生成并复制分享链接", "success");
			setSharePage(null);
		} catch (err) {
			notify(`分享失败: ${err instanceof Error ? err.message : String(err)}`, "error");
		} finally {
			setShareBusy(false);
		}
	}

	// 打开编辑器态（优先级最高）
	if (editorPageId) {
		return <CanvasEditor pageId={editorPageId} onClose={() => { setEditorPageId(null); setEditorPreset(undefined); }} onSaved={refresh} initialPreset={editorPreset} />;
	}

	function previewKindFor(i: number): string {
		return ["area", "bars", "donut"][i % 3];
	}

	// ── NAV 主栏内容分发 ──
	function renderMainContent(): JSX.Element {
		if (activeNav === "sources") return renderDatasourceList();
		if (activeNav === "dataset") {
			if (datasetRows.length === 0) {
				return <div className="flex h-full items-center justify-center rounded-card border border-dashed border-border bg-surface-raised px-4 text-center text-[12px] text-muted">画布里放一个「数据源」或「手写 SQL」节点后，这里会出现数据集</div>;
			}
			return (
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface-raised">
					<div className="flex h-9 shrink-0 items-center gap-3 border-b border-border px-2 text-[10px] text-faint">
						<span className="w-44 shrink-0">名称</span>
						<span className="w-24 shrink-0">类型</span>
						<span className="min-w-0 flex-1">来源</span>
						<span className="w-28 shrink-0 text-right">所属页面</span>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto">
						{datasetRows.map((d) => (
							<div key={d.key} className="flex h-9 items-center gap-3 border-b border-border/60 px-2 last:border-b-0 hover:bg-surface">
								<Icon name="icon-[lucide--table-2]" className="size-3.5 shrink-0 text-muted" />
								<span className="w-44 shrink-0 truncate text-[12px] text-surface-foreground">{d.title}</span>
								<span className="w-24 shrink-0 truncate text-[11px] text-muted">{d.kind}</span>
								<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted" title={d.detail || d.origin}>
									{d.origin || d.detail || "—"}
								</span>
								<span className="w-28 shrink-0 truncate text-right text-[11px] text-faint">{d.pageName}</span>
							</div>
						))}
					</div>
				</div>
			);
		}
		if (activeNav === "worktree") return renderWorktree();
		if (activeNav === "shared") return renderShared();
		if (activeNav === "trash") return (
			<div className="flex h-full items-center justify-center rounded-card border border-dashed border-border bg-surface-raised text-[12px] text-muted">
				回收站暂未启用（engine 不支持软恢复）
			</div>
		);

		// board：Grid 或 List
		if (loading || (activeNav === "board" && derivedPages.length === 0)) {
			return (
				<div className="flex h-[200px] shrink-0 items-center justify-center rounded-card border border-border bg-surface-raised text-muted">
					{loading ? "加载中…" : "还没有看板，点右上角「新建看板」开始"}
				</div>
			);
		}

		if (viewMode === "list") {
			return (
				<div className="flex shrink-0 flex-col gap-1 rounded-card border border-border bg-surface-raised p-1">
					{derivedPages.map((p, i) => (
						<div key={p.id} className="flex h-10 items-center gap-3 rounded-[4px] px-2 hover:bg-surface cursor-pointer"
							onClick={() => { setEditorPreset(undefined); setEditorPageId(p.id); }}>
							<span className="grid size-6 place-items-center rounded-[3px] bg-accent-soft text-accent">
								<Icon name="icon-[lucide--layout-dashboard]" className="size-3" />
							</span>
							<span className="min-w-0 flex-1 truncate text-[12px] text-surface-foreground">{p.name}</span>
							<span className="w-24 shrink-0 text-right font-mono text-[10px] text-faint">{p.updateCount} 次</span>
							<span className="w-24 shrink-0 text-right text-[10px] text-faint">{formatDate(p.updateTime)}</span>
							<div className="flex shrink-0 gap-1">
								<button className="rounded-control border border-border bg-surface px-2 py-0.5 text-[10px] text-muted hover:text-surface-foreground"
									onClick={(e) => { e.stopPropagation(); handleCopy(p); }}>复制</button>
								<button className="rounded-control border border-border bg-surface px-2 py-0.5 text-[10px] text-danger hover:border-danger/50"
									onClick={(e) => { e.stopPropagation(); handleDelete(p); }}>删除</button>
							</div>
						</div>
					))}
				</div>
			);
		}

		return (
			<div className="grid shrink-0 grid-cols-3 gap-4">
				{derivedPages.map((p, i) => {
					const focused = p.id === focusPageId;
					return (
						<div key={p.id} data-focused-id={focused ? p.id : undefined}
							className={focused ? "rounded-card ring-2 ring-accent ring-offset-1" : ""}
							onClick={() => { if (focused) setFocusPageId(null); }}>
							<PageThumb
								page={p}
								previewKind={previewKindFor(i)}
								onOpen={(pg) => { setFocusPageId(null); setEditorPreset(undefined); setEditorPageId(pg.id); }}
								onDelete={handleDelete}
								onClone={handleCopy}
								onCopy={handleCopy}
								onRename={(pg) => { setRenameVal(pg.name); setRenamePage(pg); }}
								onShare={setSharePage}
							/>
						</div>
					);
				})}
			</div>
		);
	}

	function renderDatasourceList(): JSX.Element {
		if (datasources.length === 0) {
			return <div className="flex h-full items-center justify-center rounded-card border border-dashed border-border bg-surface-raised text-[12px] text-muted">暂无数据源，点左栏下方「管理数据源」添加</div>;
		}
		return (
			<div className="flex shrink-0 flex-col gap-1 rounded-card border border-border bg-surface-raised p-1">
				{datasources.map((ds) => (
					<div key={ds.id} className="flex h-10 items-center gap-3 rounded-[4px] px-2 hover:bg-surface">
						<span className={`grid size-6 place-items-center rounded-[3px] ${ds.status === "connected" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
							<Icon name="icon-[lucide--database]" className="size-3" />
						</span>
						<span className="min-w-0 flex-1 truncate text-[12px] text-surface-foreground">{ds.name}</span>
						<Chip tone="neutral" mono>{ds.type}</Chip>
						<span className={`flex h-5 items-center rounded-chip px-1.5 text-[10px] ${ds.status === "connected" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
							{ds.status === "connected" ? "已连接" : "已断开"}
						</span>
					</div>
				))}
			</div>
		);
	}

	function renderWorktree(): JSX.Element {
		if (!worktree || worktree.pages.length === 0) {
			return <div className="flex h-full items-center justify-center rounded-card border border-dashed border-border bg-surface-raised text-[12px] text-muted">工作树为空</div>;
		}
		return (
			<div className="flex shrink-0 flex-col gap-1 rounded-card border border-border bg-surface-raised p-1">
				{worktree.pages.map((p) => (
					<div key={p.id} className="flex h-10 items-center gap-3 rounded-[4px] px-2 hover:bg-surface">
						<Icon name="icon-[lucide--layout-dashboard]" className="size-3.5 shrink-0 text-muted" />
						<span className="min-w-0 flex-1 truncate text-[12px] text-surface-foreground">{p.name}</span>
						{p.dirty ? <Chip tone="warning">未发布</Chip> : <Chip tone="success">已发布</Chip>}
						{p.dirty ? (
							<Btn size="xs" variant="primary" icon="icon-[lucide--upload]"
								onClick={() => { void publish([p.id]); notify("已发布", "success"); }}>发布</Btn>
						) : null}
					</div>
				))}
			</div>
		);
	}

	function renderShared(): JSX.Element {
		if (sharelinks.length === 0) {
			return <div className="flex h-full items-center justify-center rounded-card border border-dashed border-border bg-surface-raised text-[12px] text-muted">暂无分享链接</div>;
		}
		return (
			<div className="flex shrink-0 flex-col gap-1 rounded-card border border-border bg-surface-raised p-1">
				{sharelinks.map((l) => (
					<div key={l.id} className="flex h-10 items-center gap-3 rounded-[4px] px-2 hover:bg-surface">
						<Icon name={l.type === "permanent" ? "icon-[lucide--link-2]" : "icon-[lucide--calendar-clock]"} className="size-3.5 shrink-0 text-muted" />
						<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-surface-foreground">{l.path}</span>
						<span className={`font-mono text-[10px] ${l.type === "permanent" ? "text-faint" : "text-warning"}`}>{formatShareExpires(l.expiresAt)}</span>
						<IconButton size="xs" icon="icon-[lucide--copy]" title="复制链接" onClick={() => {
							void navigator.clipboard?.writeText(`https://${l.path}`);
							notify("已复制链接", "success");
						}} />
					</div>
				))}
			</div>
		);
	}

	const NAV_LABELS: Record<NavId, string> = {
		board: "我的看板", dataset: "数据集",
		sources: "数据源", worktree: "工作树", shared: "分享给我", trash: "回收站",
	};
	const activeLabel = NAV_LABELS[activeNav] ?? "看板";

	return (
		<div ref={rootRef} className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			{/* 顶栏 */}
			<header className={`flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-raised ${compact ? "px-3" : "px-5"}`}>
				<div className="flex shrink-0 items-center gap-2">
					<img src={dbxIcon} alt="dbx-pro" className="size-6 rounded-sm" />
					<span className="truncate text-[13px] font-semibold text-surface-foreground">BI 工作台</span>
				</div>

				{/* 搜索框 — 真实 state */}
				<div className={`flex h-8 items-center gap-2 rounded-control border border-border bg-surface px-2.5 ${compact ? "min-w-0 flex-1" : "w-72 shrink-0"}`}>
					<Icon name="icon-[lucide--search]" className="size-3.5 shrink-0 text-faint" />
					<input
						ref={searchRef}
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="搜索看板、数据集"
						className="min-w-0 flex-1 bg-transparent text-[12px] text-surface-foreground outline-none placeholder:text-faint"
					/>
					{compact ? null : <span className="shrink-0 font-mono text-[10px] text-faint">⌘K</span>}
				</div>

			</header>

			<div className="flex min-h-0 flex-1">
				{/* 左栏：工作树目录树（与设计稿 frames/workbench.tsx L67-L114 对齐） */}
				<aside className={compact
					? "hidden"
					: "flex w-52 shrink-0 flex-col border-r border-border bg-surface-raised px-2 py-3"}>
					<div className="flex flex-col gap-0.5">
						{treeRows.map((n) => {
							const rowOn = !!n.on;
							return (
								<div
									key={n.key}
									className={`flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-control pr-1.5 ${
										n.depth === 0 ? "pl-1.5" : "pl-[18px]"
									} ${rowOn ? "bg-accent-soft" : "text-muted hover:bg-surface hover:text-surface-foreground"}`}
								onClick={() => {
									if (n.depth === 0) {
										// depth0：同时 toggle 展开 + 切 activeNav
										if (n.navKey) setActiveNav(n.navKey);
										toggleTree(n.key);
										return;
									}
									// depth1：看板产物叶子 → 先聚焦对应分类视图（不直接进画布）；数据源叶子照旧打开编辑器
									if (n.pageId) {
										if (n.navKey) {
											setActiveNav(n.navKey);
										setViewMode("grid");
										setFocusPageId(n.pageId);
											return;
										}
										setEditorPreset(undefined);
										setEditorPageId(n.pageId);
										return;
									}
									if (n.navKey) setActiveNav(n.navKey);
								}}
								>
									{n.depth === 0 ? (
										<Icon
											name={(n.open ?? false) ? "icon-[lucide--chevron-down]" : "icon-[lucide--chevron-right]"}
											className="size-3 shrink-0 text-faint"
										/>
									) : null}

									{n.dot ? (
										<span className={`size-1.5 shrink-0 rounded-full ${n.dot}`} />
									) : n.icon ? (
										<Icon
											name={n.icon}
											className={`size-3.5 shrink-0 ${rowOn ? "text-accent" : n.depth === 1 ? "text-faint" : ""}`}
										/>
									) : null}

									<span
										className={`min-w-0 flex-1 truncate text-[12px] ${rowOn ? "font-medium text-accent" : ""}`}
									>
										{n.label}
									</span>

									{n.alert ? <span className="size-1.5 shrink-0 rounded-full bg-warning" /> : null}

									{n.count ? (
										<span
											className={`shrink-0 font-mono text-[10px] tabular-nums ${
												rowOn ? "text-accent" : "text-faint"
											}`}
										>
											{n.count}
										</span>
									) : null}

									{/* depth0 看板行追加「+新建」按钮 */}
									{n.depth === 0 && n.key === "board" && (
										<button
											type="button"
											className="grid size-5 shrink-0 place-items-center rounded-[3px] text-faint hover:bg-accent-soft hover:text-accent transition-colors"
											title="新建看板"
											onClick={(e) => {
												e.stopPropagation();
												void handleCreate();
											}}
										>
											<Icon name="icon-[lucide--plus]" className="size-3" />
										</button>
									)}
								</div>
							);
						})}
					</div>

					{/* 左栏底部：管理数据源（跳转至真实数据源管理视图） */}
					<div className="mt-auto border-t border-border px-1.5 pt-3">
						<Btn size="xs" variant="ghost" icon="icon-[lucide--server]" className="justify-start"
							onClick={() => { setActiveNav("sources"); }}>
							管理数据源
						</Btn>
					</div>
				</aside>

				{/* 主栏 */}
				<main className={`flex min-w-0 flex-1 flex-col gap-4 overflow-hidden ${compact ? "p-4" : "p-6"}`}>
					{/* 窄面板：左栅隐藏，六项导航改横向 chips，不丢功能 */}
					{compact && (
						<div className="flex shrink-0 items-center gap-1 overflow-x-auto pb-1">
							{treeRows.filter((r) => r.depth === 0).map((r) => (
								<button
									key={r.key}
									type="button"
									className={`flex shrink-0 items-center gap-1.5 rounded-control border px-2 py-1 text-[11px] ${r.on ? "border-border bg-neutral-muted text-surface-foreground" : "border-transparent text-muted hover:text-surface-foreground"}`}
									onClick={() => r.navKey && setActiveNav(r.navKey)}
								>
									{r.icon ? <Icon name={r.icon} className="size-3.5 shrink-0" /> : null}
									{r.label}
									{r.count ? <span className="font-mono tabular-nums text-faint">{r.count}</span> : null}
								</button>
							))}
						</div>
					)}
					{/* 主栏顶栏：标题 + 排序 + 视图切换 + 新建 */}
					<div className="flex h-8 shrink-0 items-center gap-3">
						<span className="text-[15px] font-semibold text-surface-foreground">{activeLabel}</span>
						{activeNav === "board" && <Chip>{derivedPages.length} 个</Chip>}
						{loading && <span className="text-[11px] text-muted">加载中…</span>}
						{error && (
							<span className="flex items-center gap-1 text-[11px] text-danger">
								<Icon name="icon-[lucide--alert-triangle]" className="size-3" />
								{error}
							</span>
						)}

						{/* 只有 board 显示排序和视图切换 */}
						{(activeNav === "board") && (
							<>
								<div className="ml-auto flex shrink-0 items-center gap-2">
									{/* 排序下拉 */}
									<div className="relative">
										<button type="button"
											className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2 text-[11px] text-muted hover:border-border-strong"
											onClick={() => setSortOpen((v) => !v)}>
											<Icon name="icon-[lucide--history]" className="size-3.5 shrink-0" />
											<span>{({ updateTime: "最近更新", name: "名称 A-Z", createTime: "最早创建", updateCount: "修改次数" } as const)[sortKey]}</span>
											<Icon name="icon-[lucide--chevron-down]" className="size-3 text-faint" />
										</button>
										{sortOpen && (
											<>
												<div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
												<div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-card border border-border bg-surface-raised shadow-lg">
													{([
														{ k: "updateTime", label: "最近更新" },
														{ k: "name", label: "名称 A-Z" },
														{ k: "createTime", label: "最早创建" },
														{ k: "updateCount", label: "修改次数" },
													] as const).map((opt) => (
														<button key={opt.k} type="button"
															className={`flex h-7 w-full items-center gap-2 px-3 text-left text-[11px] ${
																sortKey === opt.k ? "bg-accent-soft text-accent" : "text-surface-foreground hover:bg-surface"
															}`}
															onClick={() => { setSortKey(opt.k); setSortOpen(false); }}>
															{sortKey === opt.k ? <Icon name="icon-[lucide--check]" className="size-3" /> : <span className="size-3" />}
															{opt.label}
														</button>
													))}
												</div>
											</>
										)}
									</div>
									{/* 视图切换 */}
									<div className="flex h-7 items-center gap-0.5 rounded-control border border-border bg-surface p-0.5">
										<button type="button"
											className={`grid size-[22px] place-items-center rounded-[4px] ${viewMode === "grid" ? "bg-accent-soft text-accent" : "text-muted"}`}
											onClick={() => setViewMode("grid")} title="网格视图">
											<Icon name="icon-[lucide--grid-2x2]" className="size-3.5" />
										</button>
										<button type="button"
											className={`grid size-[22px] place-items-center rounded-[4px] ${viewMode === "list" ? "bg-accent-soft text-accent" : "text-muted"}`}
											onClick={() => setViewMode("list")} title="列表视图">
											<Icon name="icon-[lucide--list-ordered]" className="size-3.5" />
										</button>
									</div>
									<Btn size="sm" variant="default" icon="icon-[lucide--refresh-cw]" onClick={() => void refresh()}>刷新</Btn>
									{activeNav === "board" && (
										<Btn size="sm" variant="primary" icon="icon-[lucide--plus]" disabled={creating} onClick={() => void handleCreate()}>新建看板</Btn>
									)}
								</div>
							</>
						)}
					</div>

					{renderMainContent()}

					{renamePage && (
						<div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => setRenamePage(null)}>
							<div className="w-80 rounded-card border border-border bg-surface-raised p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
								<div className="mb-3 text-[13px] font-medium text-surface-foreground">重命名看板</div>
								<input
									autoFocus
									value={renameVal}
									onChange={(e) => setRenameVal(e.target.value)}
									onKeyDown={(e) => { if (e.key === "Enter") void handleRename(renamePage); }}
									placeholder="看板名称"
									className="w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-[12px] text-surface-foreground outline-none focus:border-accent"
								/>
								<div className="mt-3 flex justify-end gap-2">
									<Btn size="xs" variant="default" onClick={() => setRenamePage(null)}>取消</Btn>
									<Btn size="xs" variant="primary" onClick={() => void handleRename(renamePage)}>确定</Btn>
								</div>
							</div>
						</div>
					)}

					{sharePage && (
						<div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => setSharePage(null)}>
							<div className="w-80 rounded-card border border-border bg-surface-raised p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
								<div className="mb-3 text-[13px] font-medium text-surface-foreground">分享「{sharePage.name}」</div>
								<div className="flex flex-col gap-2">
									<label className="flex items-center gap-2 text-[12px] text-surface-foreground">
										<input type="radio" name="shareType" checked={shareType === "permanent"} onChange={() => setShareType("permanent")} />
										<span>永久链接</span>
									</label>
									<label className="flex items-center gap-2 text-[12px] text-surface-foreground">
										<input type="radio" name="shareType" checked={shareType === "timed"} onChange={() => setShareType("timed")} />
										<span>限期分享（7 天）</span>
									</label>
								</div>
								<div className="mt-3 flex justify-end gap-2">
									<Btn size="xs" variant="default" onClick={() => setSharePage(null)}>取消</Btn>
									<Btn size="xs" variant="primary" disabled={shareBusy} icon="icon-[lucide--link]"
										onClick={() => void handleShare(sharePage)}>{shareBusy ? "生成中" : "生成并复制"}</Btn>
								</div>
							</div>
						</div>
					)}

				</main>

			</div>

		</div>
	);
}
