/**
 * bi-workspace.tsx — BI 工作台入口（首屏）。
 *
 * 完整功能实现：
 *   - NAV 6 项真实切换（我的看板 / 数据大屏 / 数据集 / 工作树 / 分享给我 / 回收站）
 *   - 搜索框前端实时过滤
 *   - 排序下拉（更新时间 / 名称 / 创建时间 / 修改次数）
 *   - Grid / List 视图切换
 *   - 右栏三条入口（从数据集新建 / 问数（让 AI 生成）/ 粘一条 SQL）真实对话框 + 创建 + 跳转画布预置节点
 *   - 问数面板（对齐 Quick BI 智能问数）：选数据集 → 自然语言提问 → 插件内 AI loop 自助 run_sql 取数
 *     → 展示 SQL / 数据 / 图表 → 一键落画布为 source-sql + chart 节点图
 *   - 清空全部 notify("功能开发中") 占位
 */

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { useBigscreenPages, type BigscreenPage } from "../shared/hooks/use-bigscreen-pages";
import { BigscreenEditor } from "../canvas/canvas-editor";
import { getUi } from "../../../runtime-contract";
import { engineRequest } from "../../../shared/services/engine-client";
import dbxIcon from "../../../../assets/icon.png";
import { Icon } from "../shared/components/ui/icon";
import { Chip } from "../shared/components/ui/chip";
import { IconButton } from "../shared/components/ui/icon-button";
import { Btn } from "../shared/components/ui/btn";
import { AreaChart, Bars, Donut, SERIES } from "../shared/components/charts";
import type { NodePos, Link } from "../canvas/components/node-graph";
import { fnv1aArray } from "../../../shared/utils/hash";
import { AskPanel } from "../../ask/ask-panel";
import { toCanvasKind } from "../../ask/ask-chart";
import type { AskDraft } from "../../ask/ask-types";

// ── 后端类型 ──
interface DataSource { id: string; name: string; type: string; status: string; tables?: string[]; }
interface RunLog { id: string; pageId?: string; pageName: string; detail: string; cost: string; state: string; createTime: string; }
interface ShareLink { id: string; pageId?: string; path: string; type: "permanent" | "timed"; expiresAt: string | null; password: string | null; createTime: string; }
interface WorktreeStatus { pages: { id: string; name: string; style: string; updateCount: number; publishedCount: number; publishedAt: string | null; dirty: boolean; }[]; dirtyCount: number; }

// ── hooks ──
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

// ── NAV 定义 ──
type NavId = "board" | "bigscreen" | "dataset" | "sources" | "worktree" | "shared" | "trash";

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
	/** depth0 点击后切换到哪个 NavId；depth1 留空 = 不切 activeNav */
	navKey?: NavId;
};

// ── 常量：右栏三条入口 ──
const START = [
	{ icon: "icon-[lucide--table-2]",      id: "from-dataset", title: "从数据集新建", note: "选一张表，勾字段，直接出图" },
	{ icon: "icon-[lucide--wand-sparkles]", id: "ai-generate",   title: "问数（让 AI 生成）", note: "说一句要什么，它自己去取数并拼好节点" },
	{ icon: "icon-[lucide--scroll-text]",  id: "paste-sql",     title: "粘一条 SQL",   note: "已有 SQL 的话，贴进来就是数据集" },
];

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
function formatRunTime(iso?: string): string {
	if (!iso) return "—";
	try {
		const d = new Date(iso);
		return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
	} catch { return "—"; }
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
			className="group overflow-hidden rounded-card border bg-surface-raised transition hover:border-border-strong border-border"
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
				<div className="flex gap-1">
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

// ── 预置画布节点工具（三条入口 → canvas-editor 自动预置） ──
function presetFromDataset(): { nodes: Record<string, NodePos>; links: Link[] } {
	const ns: Record<string, NodePos> = {
		n100: { x: 60,  y: 120, w: 180, h: 108, tone: "#3b82f6", kind: "source-connector", selected: true,
			values: { title: "订单表", tableName: "orders", connectionId: "生产库" } },
		n101: { x: 300, y: 80,  w: 216, h: 222, tone: "#10b981", kind: "chart-line",
			values: { title: "GMV 趋势", xField: "ts", yField: "amount" } },
	};
	return {
		nodes: ns,
		links: [{ id: "lp1", from: "n100", fromRow: 0, to: "n101", toRow: 0, tone: "#3b82f6" }],
	};
}
function presetSql(sql: string): { nodes: Record<string, NodePos>; links: Link[] } {
	const ns: Record<string, NodePos> = {
		n300: { x: 60, y: 140, w: 180, h: 118, tone: "#f59e0b", kind: "source-sql", selected: true,
			values: { title: "SQL 数据集", sql } },
	};
	return { nodes: ns, links: [] };
}

/**
 * 问数结果落画布：SQL 数据源 + 图表节点，一条连线。
 *
 * 与 presetSql 的差别：这里的 SQL 与图型是问数面板真跑过、真取到数的结果，所以必须把连接一起带上 ——
 * 节点里存连接 id（属性面板的数据源下拉写的就是 id），引擎执行时由
 * resolveConnectionName 转成连接名（见 canvas/lib/connection-ref.ts）。
 */
function presetAsk(draft: AskDraft): { nodes: Record<string, NodePos>; links: Link[] } {
	const connection = draft.connectionId || draft.connectionName;
	const ns: Record<string, NodePos> = {
		n400: { x: 60, y: 140, w: 180, h: 118, tone: "#3b82f6", kind: "source-sql",
			values: { title: draft.title, sql: draft.sql, datasourceId: connection, connectionId: connection } },
	};
	// 明细表在画布上没有对应节点（不能透传，见 toCanvasKind）：只落数据源节点。
	const canvasKind = toCanvasKind(draft.chartKind);
	if (!canvasKind) {
		ns.n400.selected = true;
		return { nodes: ns, links: [] };
	}
	ns.n401 = { x: 300, y: 90, w: 216, h: 222, tone: "#8b5cf6", kind: canvasKind, selected: true,
		values: { title: draft.title } };
	return {
		nodes: ns,
		links: [{ id: "lq1", from: "n400", fromRow: 0, to: "n401", toRow: 0, tone: "#3b82f6" }],
	};
}

export function BiWorkspace(): JSX.Element {
	const { pages, loading, error, refresh, create, remove, copy } = useBigscreenPages();
	const [editorPageId, setEditorPageId] = useState<string | null>(null);
	const [editorPreset, setEditorPreset] = useState<{ nodes: Record<string, NodePos>; links: Link[] } | undefined>(undefined);
	const [creating, setCreating] = useState(false);

	// ── 真实 hook 数据 ──
	const { items: datasources } = useDatasources();
	const { items: runlogs } = useRunlogs();
	const { items: sharelinks } = useSharelinks();
	const { status: worktree, publish } = useWorktreeStatus();

	// ── 工作台本地 state ──
	const [activeNav, setActiveNav] = useState<NavId>("board");
	const [searchQuery, setSearchQuery] = useState("");
	const [sortKey, setSortKey] = useState<"updateTime" | "name" | "createTime" | "updateCount">("updateTime");
	const [sortOpen, setSortOpen] = useState(false);
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

	// ── 工作树展开/折叠（默认 depth0 全开，回收站关） ──
	const [treeOpen, setTreeOpen] = useState<Record<string, boolean>>({
		board: true, bigscreen: false, dataset: true, sources: true, trash: false,
	});
	/** 切换 depth0 展开状态；depth1 叶子也有自己的展开状态 */
	function toggleTree(key: string) {
		setTreeOpen((prev) => ({ ...prev, [key]: !prev[key] }));
	}

	// ── 对话框状态（右栏三条入口） ──
	const [dlgDataset, setDlgDataset] = useState(false);   // 从数据集新建
	const [dlgAi, setDlgAi] = useState(false);             // 让 AI 生成
	const [dlgSql, setDlgSql] = useState(false);           // 粘一条 SQL

	const notify = (msg: string, variant: "success" | "error" | "info" = "info") => {
		try { getUi()?.notify?.({ message: msg, variant }); } catch { /* ignore */ }
	};

	// ── 临时高亮「最近运行」面板 ──
	const [runlogsFlash, setRunlogsFlash] = useState(false);
	function focusRunlogs() {
		const el = document.getElementById("runlogs-panel");
		if (!el) return;
		el.scrollIntoView({ behavior: "smooth", block: "center" });
		setRunlogsFlash(true);
		window.setTimeout(() => setRunlogsFlash(false), 1500);
	}

	// ── 派生：按 NAV + search + sort 过滤后的 pages ──
	const derivedPages = useMemo(() => {
		let arr = pages;
		if (activeNav === "board") arr = arr.filter((p) => p.style === "default");
		else if (activeNav === "bigscreen") arr = arr.filter((p) => p.style === "bigScreen");
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
	const boardPages = pages.filter((p) => p.style === "default");
	const bigscreenPages = pages.filter((p) => p.style === "bigScreen");
	const datasetCount = pages.length; // 简化：style 不同都算"数据集"

	const treeRows: TreeRow[] = useMemo(() => {
		const rows: TreeRow[] = [];

		// ① 我的看板
		const boardOpen = treeOpen.board ?? true;
		rows.push({
			key: "board", navKey: "board", label: "我的看板",
			count: String(boardPages.length),
			depth: 0, icon: "icon-[lucide--layout-dashboard]",
			open: boardOpen, on: activeNav === "board",
			alert: worktree?.pages.some((p) => p.style === "default" && p.dirty) ?? false,
		});
		if (boardOpen) {
			// depth1 叶子：暂时只按 style 分 folder 跳过，直接渲染未分组
			rows.push({ key: "board-folder-0", label: "未分组", count: String(boardPages.length), depth: 1, icon: "icon-[lucide--folder]" });
		}

		// ② 数据大屏
		const bigscreenOpen = treeOpen.bigscreen ?? false;
		rows.push({
			key: "bigscreen", navKey: "bigscreen", label: "数据大屏",
			count: String(bigscreenPages.length),
			depth: 0, icon: "icon-[lucide--monitor]",
			open: bigscreenOpen, on: activeNav === "bigscreen",
			alert: worktree?.pages.some((p) => p.style === "bigScreen" && p.dirty) ?? false,
		});
		if (bigscreenOpen) {
			rows.push({ key: "bigscreen-folder-0", label: "未分组", count: String(bigscreenPages.length), depth: 1, icon: "icon-[lucide--folder]" });
		}

		// ③ 数据集（简化：所有 pages 都算"数据集"，depth1 叶子只渲染未分组）
		const datasetOpen = treeOpen.dataset ?? true;
		rows.push({
			key: "dataset", navKey: "dataset", label: "数据集",
			count: String(datasetCount),
			depth: 0, icon: "icon-[lucide--table-2]",
			open: datasetOpen, on: activeNav === "dataset",
		});
		if (datasetOpen) {
			rows.push({ key: "dataset-folder-0", label: "未分组", count: String(datasetCount), depth: 1, icon: "icon-[lucide--folder]" });
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
					dot: ds.status === "connected" ? "bg-success" : "bg-border-strong",
				});
			});
		}

		// ⑤ 回收站
		rows.push({
			key: "trash", navKey: "trash", label: "回收站",
			count: "0",
			depth: 0, icon: "icon-[lucide--trash-2]",
			open: treeOpen.trash ?? false, on: activeNav === "trash",
		});

		return rows;
	}, [boardPages.length, bigscreenPages.length, datasetCount, datasources, worktree, activeNav, treeOpen]);

	// ── 三个入口：创建看板 page → 设置 preset → 跳转编辑器（不再创建大屏） ──
	async function handleCreateWithPreset(preset: { nodes: Record<string, NodePos>; links: Link[] }) {
		setCreating(true);
		try {
			const id = await create(`新看板 ${pages.length + 1}`, { style: "default" });
			setEditorPreset(preset);
			setEditorPageId(id);
			notify("已创建，编辑器已预置节点", "success");
		} catch (err) {
			notify(`创建失败: ${err instanceof Error ? err.message : String(err)}`, "error");
		} finally {
			setCreating(false);
		}
	}

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

	// 打开编辑器态（优先级最高）
	if (editorPageId) {
		return <BigscreenEditor pageId={editorPageId} onClose={() => { setEditorPageId(null); setEditorPreset(undefined); }} onSaved={refresh} initialPreset={editorPreset} />;
	}

	function previewKindFor(i: number): string {
		return ["area", "bars", "donut"][i % 3];
	}

	// ── NAV 主栏内容分发 ──
	function renderMainContent(): JSX.Element {
		if (activeNav === "sources") return renderDatasourceList();
		if (activeNav === "dataset") {
			// 数据集：暂不独立实现，展示"全部 pages 列表"
			if (pages.length === 0) {
				return <div className="flex h-full items-center justify-center rounded-card border border-dashed border-border bg-surface-raised text-[12px] text-muted">暂无数据集</div>;
			}
			return (
				<div className="flex shrink-0 flex-col gap-1 rounded-card border border-border bg-surface-raised p-1">
					{pages.map((p) => (
						<div key={p.id} className="flex h-10 items-center gap-3 rounded-[4px] px-2 hover:bg-surface cursor-pointer"
							onClick={() => { setEditorPreset(undefined); setEditorPageId(p.id); }}>
							<Icon name={p.style === "bigScreen" ? "icon-[lucide--monitor]" : "icon-[lucide--layout-dashboard]"} className="size-3.5 shrink-0 text-muted" />
							<span className="min-w-0 flex-1 truncate text-[12px] text-surface-foreground">{p.name}</span>
							<Chip tone="neutral" mono>{p.style === "bigScreen" ? "大屏" : "看板"}</Chip>
							<span className="font-mono text-[10px] text-faint">{p.updateCount} 次</span>
						</div>
					))}
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

		// board / bigscreen：Grid 或 List
		if (loading || (activeNav === "board" && derivedPages.filter((p) => p.style === "default").length === 0) ||
			(activeNav === "bigscreen" && derivedPages.filter((p) => p.style === "bigScreen").length === 0 && !loading)) {
			return (
				<div className="flex h-[200px] shrink-0 items-center justify-center rounded-card border border-border bg-surface-raised text-muted">
					{loading ? "加载中…" : activeNav === "bigscreen" ? "还没有大屏" : "还没有看板，点右上角「新建看板」开始"}
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
								<Icon name={p.style === "bigScreen" ? "icon-[lucide--monitor]" : "icon-[lucide--layout-dashboard]"} className="size-3" />
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
				{derivedPages.map((p, i) => (
					<PageThumb
						key={p.id}
						page={p}
						previewKind={previewKindFor(i)}
						onOpen={(pg) => { setEditorPreset(undefined); setEditorPageId(pg.id); }}
						onDelete={handleDelete}
						onClone={handleCopy}
						onCopy={handleCopy}
					/>
				))}
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
						<Icon name={p.style === "bigScreen" ? "icon-[lucide--monitor]" : "icon-[lucide--layout-dashboard]"} className="size-3.5 shrink-0 text-muted" />
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
					</div>
				))}
			</div>
		);
	}

	const NAV_LABELS: Record<NavId, string> = {
		board: "我的看板", bigscreen: "数据大屏", dataset: "数据集",
		sources: "数据源", worktree: "工作树", shared: "分享给我", trash: "回收站",
	};
	const activeLabel = NAV_LABELS[activeNav] ?? "看板";

	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			{/* 顶栏 */}
			<header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-5">
				<div className="flex shrink-0 items-center gap-2">
					<img src={dbxIcon} alt="dbx-pro" className="size-6 rounded-sm" />
					<span className="text-[13px] font-semibold text-surface-foreground">BI 工作台</span>
					<Chip tone="accent">本地工作树</Chip>
				</div>

				{/* 搜索框 — 真实 state */}
				<div className="flex h-8 w-72 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2.5">
					<Icon name="icon-[lucide--search]" className="size-3.5 shrink-0 text-faint" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="搜索看板、大屏、数据集"
						className="min-w-0 flex-1 bg-transparent text-[12px] text-surface-foreground outline-none placeholder:text-faint"
					/>
					<span className="shrink-0 font-mono text-[10px] text-faint">⌘K</span>
				</div>

				<div className="ml-auto flex shrink-0 items-center gap-1">
					<Btn size="sm" variant="ghost" icon="icon-[lucide--history]"
						onClick={focusRunlogs}>最近运行</Btn>
					<span className="h-4 w-px shrink-0 bg-border" />
					<div className="ml-1 grid size-7 shrink-0 place-items-center rounded-full border border-border bg-surface text-[11px] text-muted">诸</div>
				</div>
			</header>

			<div className="flex min-h-0 flex-1">
				{/* 左栏：工作树目录树（与设计稿 frames/workbench.tsx L67-L114 对齐） */}
				<aside className="flex w-52 shrink-0 flex-col border-r border-border bg-surface-raised px-2 py-3">
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
										}
										// depth1：只视觉高亮（不切 activeNav）—— 设计稿也没这个交互，忽略
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

									{/* depth0 看板行追加「+新建」按钮；大屏不再提供新建入口 */}
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
				<main className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6">
					{/* 主栏顶栏：标题 + 排序 + 视图切换 + 新建 */}
					<div className="flex h-8 shrink-0 items-center gap-3">
						<span className="text-[15px] font-semibold text-surface-foreground">{activeLabel}</span>
						{activeNav === "board" && <Chip>{derivedPages.length} 个</Chip>}
						{activeNav === "bigscreen" && <Chip>{derivedPages.length} 个</Chip>}
						{loading && <span className="text-[11px] text-muted">加载中…</span>}
						{error && (
							<span className="flex items-center gap-1 text-[11px] text-danger">
								<Icon name="icon-[lucide--alert-triangle]" className="size-3" />
								{error}
							</span>
						)}

						{/* 只有 board / bigscreen 显示排序和视图切换 */}
						{(activeNav === "board" || activeNav === "bigscreen") && (
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

					{/* 最近运行 */}
					{(activeNav === "board" || activeNav === "bigscreen") && (
						<div
							id="runlogs-panel"
							className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border bg-surface-raised transition-all duration-300 ${
								runlogsFlash ? "border-accent shadow-[0_0_0_3px_var(--color-accent-soft)]" : "border-border"
							}`}
						>
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
					)}
				</main>

				{/* 右栏：从哪开始 + 产物链接 + 发布 */}
				<aside className="flex w-72 shrink-0 flex-col gap-4 overflow-hidden border-l border-border bg-surface-raised p-4">
					<div className="flex flex-col gap-2">
						<span className="text-[11px] font-medium text-surface-foreground">从哪开始</span>
						{START.map((s) => (
							<div
								key={s.id}
								className="flex cursor-pointer items-center gap-2.5 rounded-card border border-border bg-surface px-3 py-2.5 hover:border-border-strong"
								onClick={() => {
									if (s.id === "from-dataset") setDlgDataset(true);
									else if (s.id === "ai-generate") setDlgAi(true);
									else if (s.id === "paste-sql") setDlgSql(true);
								}}
							>
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

			{/* ── 对话框：从数据集新建 ── */}
			{dlgDataset && <DatasetDialog datasources={datasources} onClose={() => setDlgDataset(false)}
				onConfirm={(ds, table, fields) => {
					setDlgDataset(false);
					const preset = presetFromDataset();
					// 把用户选的连接/表/字段写进预置节点
					preset.nodes.n100.values = {
						title: table, tableName: table, connectionId: ds?.name ?? "", fields: fields.join(","),
					};
					void handleCreateWithPreset(preset);
				}} />}

			{/* ── 问数面板：对齐 Quick BI 智能问数（选数据集 → 提问 → 真取数 → 落画布） ── */}
			{dlgAi && (
				<div className="fixed inset-0 z-50 grid place-items-center bg-scrim/60" onClick={() => setDlgAi(false)}>
					<div
						className="h-[min(660px,88vh)] w-[min(880px,92vw)] overflow-hidden rounded-card border border-border bg-surface-raised shadow-2xl"
						onClick={(e) => e.stopPropagation()}
					>
						<AskPanel
							onClose={() => setDlgAi(false)}
							onInsert={(draft) => {
								setDlgAi(false);
								void handleCreateWithPreset(presetAsk(draft));
							}}
						/>
					</div>
				</div>
			)}

			{/* ── 对话框：粘一条 SQL ── */}
			{dlgSql && <SqlDialog onClose={() => setDlgSql(false)}
				onConfirm={(sql) => {
					setDlgSql(false);
					void handleCreateWithPreset(presetSql(sql));
				}} />}
		</div>
	);
}

// ── 对话框组件 ──

function DatasetDialog({
	datasources, onClose, onConfirm,
}: {
	datasources: DataSource[];
	onClose: () => void;
	onConfirm: (ds: DataSource | null, table: string, fields: string[]) => void;
}): JSX.Element {
	const [dsIdx, setDsIdx] = useState(0);
	const [table, setTable] = useState("orders");
	const [fieldsText, setFieldsText] = useState("d, gmv, channel");
	const ds = datasources[dsIdx] ?? null;
	return (
		<div className="fixed inset-0 z-50 grid place-items-center bg-scrim/60" onClick={onClose}>
			<div className="w-[440px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-2xl" onClick={(e) => e.stopPropagation()}>
				<div className="flex h-10 items-center gap-2 border-b border-border bg-background px-3">
					<Icon name="icon-[lucide--table-2]" className="size-3.5 text-accent" />
					<span className="text-[12px] font-medium text-surface-foreground">从数据集新建</span>
					<button type="button" className="ml-auto grid size-5 place-items-center rounded-[2px] text-faint hover:bg-border" onClick={onClose}>
						<Icon name="icon-[lucide--x]" className="size-3" />
					</button>
				</div>
				<div className="flex flex-col gap-3 p-4">
					<label className="flex flex-col gap-1">
						<span className="text-[11px] text-muted">选择数据源</span>
						<select value={dsIdx} onChange={(e) => setDsIdx(Number(e.target.value))}
							className="h-8 rounded-control border border-border bg-surface px-2 text-[12px] text-surface-foreground">
							{datasources.length === 0 ? <option value={-1}>（暂无数据源）</option> :
								datasources.map((d, i) => <option key={d.id} value={i}>{d.name} · {d.type}</option>)}
						</select>
					</label>
					<label className="flex flex-col gap-1">
						<span className="text-[11px] text-muted">选表</span>
						<input type="text" value={table} onChange={(e) => setTable(e.target.value)}
							className="h-8 rounded-control border border-border bg-surface px-2 text-[12px] text-surface-foreground" />
					</label>
					<label className="flex flex-col gap-1">
						<span className="text-[11px] text-muted">选字段（逗号分隔）</span>
						<input type="text" value={fieldsText} onChange={(e) => setFieldsText(e.target.value)}
							className="h-8 rounded-control border border-border bg-surface px-2 font-mono text-[12px] text-surface-foreground" />
					</label>
					<span className="text-[10px] text-faint">mock：engine 未暴露 listTables，表名/字段手动填</span>
				</div>
				<div className="flex justify-end gap-2 border-t border-border bg-background px-3 py-2">
					<button type="button" className="h-7 rounded-control border border-border bg-surface px-3 text-[12px] text-muted hover:text-surface-foreground" onClick={onClose}>取消</button>
					<button type="button" className="h-7 rounded-control bg-accent px-3 text-[12px] font-medium text-accent-foreground"
						onClick={() => onConfirm(ds, table, fieldsText.split(",").map((s) => s.trim()).filter(Boolean))}>确认 → 进入画布</button>
				</div>
			</div>
		</div>
	);
}

function SqlDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (sql: string) => void }): JSX.Element {
	const [sql, setSql] = useState("SELECT d, sum(gmv) as gmv FROM orders WHERE d >= current_date - 14 GROUP BY d ORDER BY d");
	const [parsing, setParsing] = useState(false);
	const [parsed, setParsed] = useState<string | null>(null);
	function doParse() {
		setParsing(true);
		// mock 解析：等 400ms 返回第一列
		setTimeout(() => {
			const m = sql.match(/select\s+([\w,\s]+?)(?:\s+from\b|$)/i);
			const firstCol = m?.[1]?.split(",")[0]?.trim() ?? "col_1";
			setParsed(firstCol);
			setParsing(false);
		}, 400);
	}
	return (
		<div className="fixed inset-0 z-50 grid place-items-center bg-scrim/60" onClick={onClose}>
			<div className="w-[520px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-2xl" onClick={(e) => e.stopPropagation()}>
				<div className="flex h-10 items-center gap-2 border-b border-border bg-background px-3">
					<Icon name="icon-[lucide--scroll-text]" className="size-3.5 text-accent" />
					<span className="text-[12px] font-medium text-surface-foreground">粘一条 SQL</span>
					<button type="button" className="ml-auto grid size-5 place-items-center rounded-[2px] text-faint hover:bg-border" onClick={onClose}>
						<Icon name="icon-[lucide--x]" className="size-3" />
					</button>
				</div>
				<div className="flex flex-col gap-3 p-4">
					<textarea rows={6} value={sql} onChange={(e) => { setSql(e.target.value); setParsed(null); }}
						className="rounded-control border border-border bg-surface px-2 py-1 font-mono text-[11px] text-surface-foreground"
						placeholder="SELECT ... FROM ... WHERE ..." />
					<div className="flex items-center gap-2">
						<Btn size="xs" variant="ghost" icon="icon-[lucide--play]" onClick={doParse} disabled={parsing}>
							{parsing ? "解析中…" : "解析"}
						</Btn>
						{parsed ? (
							<span className="text-[10px] text-muted">解析成功：首列 <span className="font-mono text-surface-foreground">{parsed}</span></span>
						) : null}
					</div>
				</div>
				<div className="flex justify-end gap-2 border-t border-border bg-background px-3 py-2">
					<button type="button" className="h-7 rounded-control border border-border bg-surface px-3 text-[12px] text-muted hover:text-surface-foreground" onClick={onClose}>取消</button>
					<button type="button" className="h-7 rounded-control bg-accent px-3 text-[12px] font-medium text-accent-foreground disabled:opacity-50"
						disabled={!sql.trim()} onClick={() => onConfirm(sql)}>→ 进入画布（自动加 source-sql）</button>
				</div>
			</div>
		</div>
	);
}
