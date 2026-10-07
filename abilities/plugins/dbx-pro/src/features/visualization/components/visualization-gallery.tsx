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

import { useState, useMemo, useRef, type JSX } from "react";
import { useVisualizationStore, type StoredVisualization } from "../visualization-store";

/** Chart.js type → lucide icon。用于卡片网格占位（轻量缩略图，不加载 iframe）。 */
const CHART_ICON_MAP: Record<string, string> = {
	line: "chart-line",
	bar: "bar-chart-3",
	pie: "pie-chart",
	doughnut: "donut",
	polarArea: "radar",
	radar: "radar",
	scatter: "scatter-chart",
	bubble: "circle",
};

interface Props {
	onPreview: (viz: StoredVisualization) => void;
	onEditWithAi: (viz: StoredVisualization) => void;
}

export function VisualizationGallery({ onPreview, onEditWithAi }: Props): JSX.Element {
	const { visualizations, removeVisualization, clearAll } = useVisualizationStore();
	const [searchQuery, setSearchQuery] = useState("");
	const [filterType, setFilterType] = useState<"all" | "dashboard" | "screen">("all");
	// 清空为不可逆操作：宿主 webview 中 confirm() 是静默 no-op，改用两次点击内联确认。
	const [confirmClear, setConfirmClear] = useState(false);
	const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	function handleClearClick(): void {
		if (!confirmClear) {
			setConfirmClear(true);
			if (confirmTimer.current) clearTimeout(confirmTimer.current);
			confirmTimer.current = setTimeout(() => setConfirmClear(false), 3000);
			return;
		}
		if (confirmTimer.current) clearTimeout(confirmTimer.current);
		setConfirmClear(false);
		clearAll();
	}

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
		const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(viz.html);
		const a = document.createElement("a");
		a.href = dataUrl;
		a.download = `${viz.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_")}.html`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	};

	const handleOpenInNewTab = (viz: StoredVisualization): void => {
		const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(viz.html);
		window.open(dataUrl, "_blank", "noopener,noreferrer");
	};

	return (
		<div className="flex h-full flex-col bg-background">
			{/* 顶部工具栏 */}
			<div className="flex items-center justify-between border-b border-border px-4 py-3">
				<div className="flex items-center gap-3">
					<h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
						<span className="icon-[lucide--chart-bar] h-4 w-4 text-violet-500" />
						BI 数据资产
					</h2>
					<span className="text-xs text-muted-foreground">
						共 {visualizations.length} 个
					</span>
				</div>
				<div className="flex items-center gap-2">
					<button
					type="button"
					onClick={handleClearClick}
					disabled={visualizations.length === 0}
					className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors disabled:opacity-40 ${
						confirmClear
							? "bg-red-500/15 text-red-500"
							: "text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground"
					}`}
					title={confirmClear ? "再次点击确认清空" : "清空所有"}
				>
					<span className="icon-[lucide--trash-2] h-3.5 w-3.5" />
					{confirmClear ? "确认清空？" : "清空"}
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
	const chartCount = viz.chartItems?.length ?? 0;

	return (
		<div className="group relative overflow-hidden rounded-lg border border-border bg-[var(--dbx-surface)] transition-all hover:border-primary/50 hover:shadow-md">
			{/* 预览区域：图表类型网格占位 —— 轻量（无 iframe） */}
			<button
				type="button"
				onClick={onPreview}
				className={`relative block aspect-video w-full overflow-hidden transition-colors ${
					viz.type === "screen"
						? "bg-gradient-to-br from-cyan-500/10 via-slate-900/20 to-slate-900/40 hover:from-cyan-500/20 hover:via-slate-900/30 hover:to-slate-900/50"
						: "bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent hover:from-primary/20 hover:via-violet-500/10"
				}`}
			>
				{chartCount > 0 ? (
					<div
						className="absolute inset-0 grid gap-1.5 p-3"
						style={{
							gridTemplateColumns: chartCount <= 2 ? "1fr" : chartCount <= 4 ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
						}}
					>
						{viz.chartItems!.slice(0, Math.min(chartCount, 9)).map((chart, i) => {
							const icon = CHART_ICON_MAP[chart.type] ?? "chart-line";
							return (
								<div
									key={i}
									className="flex flex-col items-center justify-center gap-0.5 rounded border border-border/50 bg-background/70 text-muted-foreground backdrop-blur-sm"
								>
									<span className={`icon-[lucide--${icon}] h-4 w-4 ${viz.type === "screen" ? "text-cyan-400" : "text-violet-500"}`} />
									<span className="text-[9px] leading-none text-muted-foreground/80">{chart.type}</span>
								</div>
							);
						})}
					</div>
				) : (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/60">
						<span className={`${typeIcon} h-10 w-10 ${viz.type === "screen" ? "text-cyan-500" : "text-violet-500"}`} />
						<span className="text-xs">{typeLabel}</span>
					</div>
				)}
				{/* hover 操作蒙层 */}
				<div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
					<span className="ml-auto mr-2 mt-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
						{chartCount} 图
					</span>
					<div className="flex items-center justify-between p-2">
						<span className="rounded bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
							点击查看 →
						</span>
					</div>
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
