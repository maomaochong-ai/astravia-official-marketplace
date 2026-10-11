/**
 * bigscreen-workspace.tsx — BI 工作台（画廊网格）。
 *
 * 打开 GALLERY_TAB_ID 标签页时渲染本组件。
 * 顶栏 3 个入口：新建大屏 / 新建看板 / 刷新列表。
 * 主体是大屏/看板缩略图网格（从 /drag/page/list 拉）。
 * 点击缩略图 → 进入 bigscreen-editor（编辑器骨架）。
 */

import { useState, type JSX } from "react";
import { useBigscreenPages, type BigscreenPage } from "./hooks/use-bigscreen-pages";
import { BigscreenEditor } from "./bigscreen-editor";
import { getUi } from "../../runtime-contract";

function formatDate(iso?: string): string {
	if (!iso) return "";
	try {
		const d = new Date(iso);
		return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
	} catch {
		return "";
	}
}

function PageThumb({
	page,
	onOpen,
	onDelete,
	onCopy,
}: {
	page: BigscreenPage;
	onOpen: (p: BigscreenPage) => void;
	onDelete: (p: BigscreenPage) => void;
	onCopy: (p: BigscreenPage) => void;
}) {
	const isScreen = page.style === "bigScreen";
	const palette = page.theme === "dark" ? "from-[#0b1e3a] to-[#1a3a5a]" : "from-[#f8fafc] to-[#e2e8f0]";
	return (
		<div
			className="group relative flex cursor-pointer flex-col overflow-hidden rounded-card border border-border bg-surface transition hover:border-border-strong hover:shadow-sm"
			onClick={() => onOpen(page)}
		>
			<div className={`relative aspect-[16/9] bg-gradient-to-br ${palette}`}>
				{/* 缩略图预览占位 — Phase C2 接入真实渲染 */}
				<div className="absolute inset-0 flex items-center justify-center">
					<span className="font-mono text-[12px] text-faint">{page.id.slice(0, 8)}</span>
				</div>
				{/* 装饰边框（大屏深色才显示）*/}
				{isScreen && (
					<div className="pointer-events-none absolute inset-1 border border-dashed border-accent/30 rounded-md" />
				)}
				<div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-control border border-border bg-surface/80 px-1.5 py-0.5 text-[10px] font-medium text-muted backdrop-blur">
					<span className={`size-1.5 rounded-full ${isScreen ? "bg-accent" : "bg-success"}`} />
					{isScreen ? "大屏" : "看板"}
				</div>
				<div className="absolute right-1.5 top-1.5 rounded-control border border-border bg-surface/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-faint backdrop-blur">
					{page.updateCount} 次
				</div>
				{page.visits > 0 && (
					<div className="absolute bottom-1.5 left-1.5 rounded-control border border-border bg-surface/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-faint backdrop-blur">
						👁 {page.visits}
					</div>
				)}
				{/* hover 操作按钮 */}
				<div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
					<button
						type="button"
						className="rounded-control border border-border bg-surface/90 px-1.5 py-0.5 text-[10px] text-muted backdrop-blur hover:border-border-strong hover:text-surface-foreground"
						onClick={(e) => { e.stopPropagation(); onCopy(page); }}
						title="复制"
					>复制</button>
					<button
						type="button"
						className="rounded-control border border-border bg-surface/90 px-1.5 py-0.5 text-[10px] text-danger backdrop-blur hover:border-danger/50"
						onClick={(e) => { e.stopPropagation(); onDelete(page); }}
						title="删除"
					>删除</button>
				</div>
			</div>
			<div className="flex h-12 shrink-0 flex-col justify-center gap-0.5 border-t border-border px-3">
				<div className="truncate text-[12px] font-medium text-surface-foreground">{page.name}</div>
				<div className="flex items-center gap-2 font-mono text-[10px] tabular-nums text-faint">
					<span>{formatDate(page.updateTime)}</span>
					<span>·</span>
					<span>{page.theme}</span>
				</div>
			</div>
		</div>
	);
}

export function BigscreenWorkspace(): JSX.Element {
	const { pages, loading, error, refresh, create, remove, copy } = useBigscreenPages();
	const [editorPageId, setEditorPageId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);

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
		try {
			await remove(page.id);
			notify("已删除", "success");
		} catch (err) {
			notify(`删除失败: ${err instanceof Error ? err.message : String(err)}`, "error");
		}
	}

	async function handleCopy(page: BigscreenPage) {
		try {
			await copy(page.id);
			notify("已复制", "success");
		} catch (err) {
			notify(`复制失败: ${err instanceof Error ? err.message : String(err)}`, "error");
		}
	}

	// 打开编辑器态（点击缩略图或新建）
	if (editorPageId) {
		return <BigscreenEditor pageId={editorPageId} onClose={() => setEditorPageId(null)} />;
	}

	// 画廊网格态
	return (
		<div className="flex h-full min-h-0 flex-col bg-surface text-surface-foreground">
			{/* 顶栏 */}
			<div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
				<span className="text-[14px] font-semibold tracking-tight whitespace-nowrap">BI 工作台</span>
				<span className="font-mono text-[11px] tabular-nums text-faint">{pages.length} 个产物</span>
				{loading && <span className="text-[11px] text-muted">加载中…</span>}
				{error && <span className="text-[11px] text-danger">⚠ {error}</span>}

				<div className="ml-auto flex items-center gap-1.5">
					<button
						type="button"
						className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-[12px] text-surface-foreground hover:border-border-strong"
						onClick={() => void refresh()}
						title="刷新"
					>
						<span className="text-muted">⟳</span>
						刷新
					</button>
					<button
						type="button"
						className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-[12px] text-surface-foreground hover:border-border-strong disabled:opacity-50"
						onClick={() => void handleCreate("default")}
						disabled={creating}
					>
						<span className="text-accent">+</span>
						新建看板
					</button>
					<button
						type="button"
						className="flex h-7 items-center gap-1.5 rounded-control border border-accent/40 bg-accent-soft px-2.5 text-[12px] font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
						onClick={() => void handleCreate("bigScreen")}
						disabled={creating}
					>
						<span>＋</span>
						新建大屏
					</button>
				</div>
			</div>

			{/* 主体网格 */}
			<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto bg-background p-4">
				{pages.length === 0 && !loading ? (
					<div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-muted">
						<span className="font-mono text-[48px] text-faint">◇</span>
						<span className="text-[14px]">还没有产物</span>
						<span className="text-[12px] text-faint">点右上角「新建大屏」或「新建看板」开始</span>
					</div>
				) : (
					<div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
						{pages.map((p) => (
							<PageThumb key={p.id} page={p} onOpen={(pg) => setEditorPageId(pg.id)} onDelete={handleDelete} onCopy={handleCopy} />
						))}
					</div>
				)}
			</div>
		</div>
	);
}
