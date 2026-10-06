/**
 * VisualizationGallery — 可视化产物管理视图。
 * 
 * 展示所有生成的看板和大屏，支持：
 * - 预览（iframe）
 * - 下载 HTML
 * - 全屏查看
 * - 删除
 * - 交给 AI 修改
 */

import { useState, useMemo, type JSX } from "react";
import { useVisualizationStore, type StoredVisualization } from "../visualization-store";

interface Props {
	onPreview: (viz: StoredVisualization) => void;
	onEditWithAi: (viz: StoredVisualization) => void;
}

export function VisualizationGallery({ onPreview, onEditWithAi }: Props): JSX.Element {
	const { visualizations, removeVisualization, clearAll } = useVisualizationStore();
	const [searchQuery, setSearchQuery] = useState("");
	const [filterType, setFilterType] = useState<"all" | "dashboard" | "screen">("all");

	const filteredVisualizations = useMemo(() => {
		return visualizations.filter((viz) => {
			const matchesSearch = !searchQuery || 
				viz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				viz.table.toLowerCase().includes(searchQuery.toLowerCase()) ||
				viz.connection.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesType = filterType === "all" || viz.type === filterType;
			return matchesSearch && matchesType;
		});
	}, [visualizations, searchQuery, filterType]);

	const handleDownload = (viz: StoredVisualization): void => {
		const blob = new Blob([viz.html], { type: "text/html;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${viz.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_")}.html`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleOpenInNewTab = (viz: StoredVisualization): void => {
		const blob = new Blob([viz.html], { type: "text/html;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		window.open(url, "_blank");
	};

	return (
		<div className="flex h-full flex-col bg-background">
			{/* 顶部工具栏 */}
			<div className="flex items-center justify-between border-b border-border px-4 py-3">
				<div className="flex items-center gap-3">
					<h2 className="text-sm font-semibold text-foreground">可视化产物</h2>
					<span className="text-xs text-muted-foreground">
						共 {visualizations.length} 个
					</span>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => {
							if (confirm("确定要清空所有可视化产物吗？")) {
								clearAll();
							}
						}}
						disabled={visualizations.length === 0}
						className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-40"
						title="清空所有"
					>
						<span className="icon-[lucide--trash-2] h-3.5 w-3.5" />
						清空
					</button>
				</div>
			</div>

			{/* 搜索和过滤 */}
			<div className="flex items-center gap-2 border-b border-border px-4 py-2">
				<div className="relative flex-1">
					<span className="icon-[lucide--search] absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="搜索标题、表名、连接..."
						className="h-7 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
					/>
				</div>
				<div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
					<button
						type="button"
						onClick={() => setFilterType("all")}
						className={`rounded px-2 py-1 text-xs transition-colors ${
							filterType === "all"
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						全部
					</button>
					<button
						type="button"
						onClick={() => setFilterType("dashboard")}
						className={`rounded px-2 py-1 text-xs transition-colors ${
							filterType === "dashboard"
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						看板
					</button>
					<button
						type="button"
						onClick={() => setFilterType("screen")}
						className={`rounded px-2 py-1 text-xs transition-colors ${
							filterType === "screen"
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						大屏
					</button>
				</div>
			</div>

			{/* 产物列表 */}
			<div className="flex-1 overflow-y-auto p-4">
				{filteredVisualizations.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center gap-3 text-center">
						<span className="icon-[lucide--layout-dashboard] h-12 w-12 text-muted-foreground/40" />
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">
								{visualizations.length === 0 ? "还没有生成可视化产物" : "没有匹配的产物"}
							</p>
							<p className="text-xs text-muted-foreground/60">
								在连接树右键表 → 可视化 → 生成看板/大屏
							</p>
						</div>
					</div>
				) : (
					<div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
						{filteredVisualizations.map((viz) => (
							<VisualizationCard
								key={viz.id}
								viz={viz}
								onPreview={() => onPreview(viz)}
								onDownload={() => handleDownload(viz)}
								onOpenInNewTab={() => handleOpenInNewTab(viz)}
								onEditWithAi={() => onEditWithAi(viz)}
								onDelete={() => removeVisualization(viz.id)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

interface CardProps {
	viz: StoredVisualization;
	onPreview: () => void;
	onDownload: () => void;
	onOpenInNewTab: () => void;
	onEditWithAi: () => void;
	onDelete: () => void;
}

function VisualizationCard({ viz, onPreview, onDownload, onOpenInNewTab, onEditWithAi, onDelete }: CardProps): JSX.Element {
	const [showMenu, setShowMenu] = useState(false);

	const typeIcon = viz.type === "dashboard" ? "icon-[lucide--layout-dashboard]" : "icon-[lucide--monitor]";
	const typeLabel = viz.type === "dashboard" ? "看板" : "大屏";
	const timeAgo = getTimeAgo(viz.createdAt);

	return (
		<div className="group relative overflow-hidden rounded-lg border border-border bg-[var(--dbx-surface)] transition-all hover:border-primary/50 hover:shadow-md">
			{/* 预览区域 */}
			<button
				type="button"
				onClick={onPreview}
				className="relative block aspect-video w-full overflow-hidden bg-[var(--dbx-surface-2)]"
			>
				<iframe
					srcDoc={viz.html}
					className="h-full w-full border-0 pointer-events-none"
					title={viz.title}
					sandbox="allow-scripts"
				/>
				<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
				<div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100">
					<span className="rounded bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm">
						点击预览
					</span>
				</div>
			</button>

			{/* 信息区域 */}
			<div className="p-3">
				<div className="mb-2 flex items-start justify-between gap-2">
					<div className="min-w-0 flex-1">
						<h3 className="truncate text-sm font-medium text-foreground" title={viz.title}>
							{viz.title}
						</h3>
						<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
							<span className={`flex items-center gap-1 ${typeIcon}`} />
							<span>{typeLabel}</span>
							<span>·</span>
							<span>{viz.table}</span>
							<span>·</span>
							<span>{timeAgo}</span>
						</div>
					</div>
					<div className="relative">
						<button
							type="button"
							onClick={() => setShowMenu(!showMenu)}
							className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground"
						>
							<span className="icon-[lucide--more-vertical] h-3.5 w-3.5" />
						</button>
						{showMenu && (
							<>
								<div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
								<div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-md border border-border bg-popover py-1 shadow-lg">
									<button
										type="button"
										onClick={() => { onOpenInNewTab(); setShowMenu(false); }}
										className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent"
									>
										<span className="icon-[lucide--external-link] h-3.5 w-3.5" />
										新窗口打开
									</button>
									<button
										type="button"
										onClick={() => { onDownload(); setShowMenu(false); }}
										className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent"
									>
										<span className="icon-[lucide--download] h-3.5 w-3.5" />
										下载 HTML
									</button>
									<button
										type="button"
										onClick={() => { onEditWithAi(); setShowMenu(false); }}
										className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent"
									>
										<span className="icon-[lucide--sparkles] h-3.5 w-3.5" />
										交给 AI 修改
									</button>
									<div className="my-1 h-px bg-border" />
									<button
										type="button"
										onClick={() => { onDelete(); setShowMenu(false); }}
										className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-500/10"
									>
										<span className="icon-[lucide--trash-2] h-3.5 w-3.5" />
										删除
									</button>
								</div>
							</>
						)}
					</div>
				</div>

				{/* 快捷操作 */}
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={onPreview}
						className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
					>
						<span className="icon-[lucide--eye] h-3 w-3" />
						预览
					</button>
					<button
						type="button"
						onClick={onDownload}
						className="flex flex-1 items-center justify-center gap-1 rounded-md bg-[var(--dbx-surface-2)] px-2 py-1.5 text-xs font-medium text-foreground hover:bg-[var(--dbx-hover)]"
					>
						<span className="icon-[lucide--download] h-3 w-3" />
						下载
					</button>
					<button
						type="button"
						onClick={onEditWithAi}
						className="flex flex-1 items-center justify-center gap-1 rounded-md bg-[var(--dbx-surface-2)] px-2 py-1.5 text-xs font-medium text-foreground hover:bg-[var(--dbx-hover)]"
					>
						<span className="icon-[lucide--sparkles] h-3 w-3" />
						AI 修改
					</button>
				</div>
			</div>
		</div>
	);
}

function getTimeAgo(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return "刚刚";
	if (minutes < 60) return `${minutes} 分钟前`;
	if (hours < 24) return `${hours} 小时前`;
	if (days < 7) return `${days} 天前`;
	return new Date(timestamp).toLocaleDateString();
}
