/**
 * VisualizationGallery — 可视化产物管理视图（对齐设计帧 bi-assets.tsx 的三栏工作台）。
 *
 * 结构（自上而下、自左向右）：
 * - 头部：标题 + 计数 + 搜索 + 类型 chip + 清空
 * - 左栏：产物引用的数据集一览（只读聚合，数据全部来自产物自身的快照）
 * - 中栏：产物卡片网格（缩略图是**图表类型占位**，刻意不加载 iframe）
 * - 右栏：详情列（VisualizationDetailDrawer 现在是内联列，不再是遮罩抽屉）
 *
 * 样式一律使用 visualization.css 里的 .viz-assets-* 自定义类：该文件不参与 @layer，
 * 会盖过 Tailwind 的原子类（border-color 之类的覆盖会失效），所以这里刻意不混用原子类。
 */

import { useState, useMemo, useRef, type JSX } from "react";
import { useVisualizationStore, type StoredVisualization } from "../visualization-store";
import { downloadHtml, openHtmlInNewTab } from "../services/html-export";
import { resolveChartItems } from "../../../domain/chart-source";
import { getUi } from "../../../runtime-contract.ts";
import { resolveVisualizationHtml } from "../visualization-html";
import { VisualizationDetailDrawer } from "./visualization-detail-drawer";

type TypeFilter = "all" | "dashboard" | "screen";

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
	{ key: "all", label: "全部" },
	{ key: "dashboard", label: "看板" },
	{ key: "screen", label: "大屏" },
];

interface Props {
	onPreview: (viz: StoredVisualization) => void;
	onEditWithAi: (viz: StoredVisualization) => void;
}

/** 左栏一行：一个数据集（同名同来源的产物快照合并成一行）。 */
interface RailDataset {
	key: string;
	title: string;
	table: string;
	loaded: number;
	total: number;
	fetchedAt: number;
	vizId: string;
	vizCount: number;
}

export function VisualizationGallery({ onPreview, onEditWithAi }: Props): JSX.Element {
	const { visualizations, removeVisualization, clearAll } = useVisualizationStore();
	const [searchQuery, setSearchQuery] = useState("");
	const [filterType, setFilterType] = useState<TypeFilter>("all");
	// 清空为不可逆操作：宿主 webview 中 confirm() 是静默 no-op，改用两次点击内联确认。
	const [confirmClear, setConfirmClear] = useState(false);
	const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	// 详情只存 id，对象从 store 现取：重新取数 / 改筛选会替换 store 里的对象，存快照会让详情看着「没反应」
	const [detailId, setDetailId] = useState<string | null>(null);

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

	function notifyError(error: unknown): void {
		try {
			getUi()?.notify?.({ message: error instanceof Error ? error.message : String(error), variant: "error" });
		} catch {
			/* 宿主不支持 notify 或运行时未就绪时静默忽略 */
		}
	}

	const countByType = useMemo(() => {
		const counts = { all: visualizations.length, dashboard: 0, screen: 0 };
		for (const viz of visualizations) {
			if (viz.type === "screen") counts.screen += 1;
			else counts.dashboard += 1;
		}
		return counts;
	}, [visualizations]);

	/** 左栏数据：把各产物快照里的数据集按「id / 标题」合并，只读展示，不新增任何取数路径。 */
	const railDatasets = useMemo<RailDataset[]>(() => {
		const byKey = new Map<string, RailDataset>();
		for (const viz of visualizations) {
			for (const dataset of viz.datasets ?? []) {
				const key = dataset.id || dataset.title;
				const existing = byKey.get(key);
				if (existing) {
					existing.loaded = Math.max(existing.loaded, dataset.rows.length);
					existing.total = Math.max(existing.total, dataset.rowCount);
					if (dataset.fetchedAt > existing.fetchedAt) existing.fetchedAt = dataset.fetchedAt;
					existing.vizCount += 1;
					continue;
				}
				byKey.set(key, {
					key,
					title: dataset.title,
					table: dataset.table,
					loaded: dataset.rows.length,
					total: dataset.rowCount,
					fetchedAt: dataset.fetchedAt,
					vizId: viz.id,
					vizCount: 1,
				});
			}
		}
		return [...byKey.values()].sort((a, b) => b.loaded - a.loaded || a.title.localeCompare(b.title));
	}, [visualizations]);

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

	/** 卡片上的下载 / 新标签打开：带数据集的产物按初始筛选把图表项解析成真实数据后再导出。 */
	const exportableItems = (viz: StoredVisualization) => resolveChartItems(viz.chartItems ?? [], viz.datasets ?? [], viz.filters ?? []);

	const detailViz = detailId ? (visualizations.find((viz) => viz.id === detailId) ?? null) : null;
	const chartTotal = visualizations.reduce((sum, viz) => sum + (viz.chartItems?.length ?? 0), 0);

	const handleDownload = (viz: StoredVisualization): void => {
		try {
			downloadHtml(resolveVisualizationHtml(viz, exportableItems(viz)), viz.title);
		} catch (error) {
			notifyError(error);
		}
	};
	const handleOpenInNewTab = (viz: StoredVisualization): void => {
		try {
			openHtmlInNewTab(resolveVisualizationHtml(viz, exportableItems(viz)));
		} catch (error) {
			notifyError(error);
		}
	};

	return (
		<div className="viz-assets">
			<header className="viz-assets-head">
				<h1 className="viz-assets-title">BI</h1>
				<span className="viz-assets-count">共 {visualizations.length} 个产物</span>
				<div className="viz-assets-head-right">
					<label className="viz-assets-search">
						<span className="icon-[lucide--search] viz-assets-search-icon" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="搜索标题、表名、连接…"
							aria-label="搜索产物"
						/>
					</label>
					{TYPE_FILTERS.map((tab) => (
						<button
							key={tab.key}
							type="button"
							onClick={() => setFilterType(tab.key)}
							className={`viz-assets-chip${filterType === tab.key ? " is-active" : ""}`}
						>
							{tab.label} {countByType[tab.key]}
						</button>
					))}
					<button
						type="button"
						onClick={handleClearClick}
						disabled={visualizations.length === 0}
						className={`viz-assets-btn${confirmClear ? " is-danger" : ""}`}
						title={confirmClear ? "再次点击确认清空" : "清空所有"}
					>
						<span className="icon-[lucide--trash-2]" />
						{confirmClear ? "确认清空？" : "清空"}
					</button>
				</div>
			</header>

			<div className="viz-assets-body">
				<aside className="viz-assets-rail">
					<div className="viz-assets-rail-head">
						<span className="icon-[lucide--layers] viz-assets-rail-icon" />
						<span className="viz-assets-rail-title">数据集</span>
						<span className="viz-assets-rail-count">{railDatasets.length}</span>
					</div>
					<div className="viz-assets-rail-list">
						{railDatasets.length === 0 ? (
							<p className="viz-assets-rail-empty">产物还没有数据集快照</p>
						) : (
							railDatasets.map((dataset) => (
								<button
									key={dataset.key}
									type="button"
									onClick={() => setDetailId(dataset.vizId)}
									className={`viz-rail-row${dataset.vizId === detailId ? " is-active" : ""}`}
									title={`打开引用「${dataset.title}」的产物`}
								>
									<span className="viz-rail-row-top">
										<span className="icon-[lucide--table-2] viz-rail-row-icon" />
										<span className="viz-rail-row-name">{dataset.title}</span>
										{dataset.loaded === 0 && dataset.total > 0 ? (
											<span className="viz-chip is-warning">只读快照</span>
										) : null}
									</span>
									<span className="viz-rail-row-meta">
										<span className="viz-rail-row-table">{dataset.table}</span>
										<span className="viz-rail-sep">·</span>
										<span className="viz-rail-num">
											{dataset.total > dataset.loaded ? `${dataset.loaded} / ${dataset.total} 行` : `${dataset.loaded} 行`}
										</span>
										<span className="viz-rail-sep">·</span>
										<span className="viz-rail-num">取数 {formatClock(dataset.fetchedAt)}</span>
									</span>
								</button>
							))
						)}
					</div>
					<div className="viz-assets-rail-foot">
						<span className="icon-[lucide--info]" />
						数据集来自产物快照 · 重新取数在右栏详情里
					</div>
				</aside>

				<section className="viz-assets-center">
					<div className="viz-assets-center-head">
						<span>按最近修改排序</span>
						<span className="viz-rail-num">
							{filteredVisualizations.length} / {visualizations.length}
						</span>
						<span className="viz-assets-center-hint">
							<span className="icon-[lucide--database]" />
							{railDatasets.length} 个数据集
						</span>
					</div>

					<div className="viz-assets-grid">
						{filteredVisualizations.length === 0 ? (
							<div className="viz-assets-empty">
								<span className="icon-[lucide--layout-dashboard] viz-assets-empty-icon" />
								<p className="viz-assets-empty-title">
									{visualizations.length === 0 ? "还没有生成可视化产物" : "没有匹配的产物"}
								</p>
								<p className="viz-assets-empty-hint">在连接树右键表 → 可视化 → 生成看板/大屏</p>
							</div>
						) : (
							filteredVisualizations.map((viz) => (
								<VisualizationCard
									key={viz.id}
									viz={viz}
									open={viz.id === detailId}
									onPreview={() => onPreview(viz)}
									onOpenDetail={() => setDetailId(viz.id)}
									onDownload={() => handleDownload(viz)}
									onOpenInNewTab={() => handleOpenInNewTab(viz)}
									onEditWithAi={() => onEditWithAi(viz)}
									onDelete={() => removeVisualization(viz.id)}
								/>
							))
						)}
					</div>

					<div className="viz-assets-center-foot">
						<span className="icon-[lucide--hard-drive] viz-assets-foot-icon" />
						<span>产物以单文件 HTML 保存在本机 · html 只在导出时生成，不再是事实源</span>
						<span className="viz-assets-foot-stat viz-rail-num">图表 {chartTotal} 个</span>
					</div>
				</section>

				{detailViz ? (
					<VisualizationDetailDrawer
						key={detailViz.id}
						viz={detailViz}
						onClose={() => setDetailId(null)}
						onPreview={() => {
							setDetailId(null);
							onPreview(detailViz);
						}}
					/>
				) : null}
			</div>
		</div>
	);
}

interface CardProps {
	viz: StoredVisualization;
	open: boolean;
	onPreview: () => void;
	onOpenDetail: () => void;
	onDownload: () => void;
	onOpenInNewTab: () => void;
	onEditWithAi: () => void;
	onDelete: () => void;
}

function VisualizationCard({ viz, open, onPreview, onOpenDetail, onDownload, onOpenInNewTab, onEditWithAi, onDelete }: CardProps): JSX.Element {
	const [showMenu, setShowMenu] = useState(false);

	const isScreen = viz.type === "screen";
	const typeLabel = isScreen ? "大屏" : "看板";
	const timeAgo = getTimeAgo(viz.createdAt);
	const datasetCount = viz.datasets?.length ?? 0;
	const filterCount = viz.filters?.length ?? 0;

	const menuItems: { key: string; icon: string; label: string; run: () => void; danger?: boolean }[] = [
		{ key: "new-tab", icon: "external-link", label: "新窗口打开", run: onOpenInNewTab },
		{ key: "download", icon: "download", label: "下载 HTML", run: onDownload },
		{ key: "ai", icon: "sparkles", label: "交给 AI 修改", run: onEditWithAi },
		{ key: "delete", icon: "trash-2", label: "删除", run: onDelete, danger: true },
	];

	return (
		<article className={`viz-asset-card${open ? " is-open" : ""}`}>
			{/* 缩略图：图表类型占位（div / 内联 SVG 几何），刻意不加载 iframe */}
			<button
				type="button"
				onClick={onOpenDetail}
				className={`viz-asset-thumb${isScreen ? " is-screen" : ""}`}
				title="打开详情"
			>
				<AssetThumb viz={viz} />
				<span className="viz-asset-thumb-badge">占位 · 不加载 iframe</span>
			</button>

			<div className="viz-asset-head">
				<span className="viz-asset-name" title={viz.title}>
					{viz.title}
				</span>
				<span className={`viz-chip${isScreen ? " is-screen" : ""}`}>{typeLabel}</span>
				<div className="viz-menu-anchor">
					<button
						type="button"
						onClick={() => setShowMenu(!showMenu)}
						className={`viz-icon-btn${showMenu ? " is-active" : ""}`}
						title="更多操作"
						aria-label="更多操作"
					>
						<span className="icon-[lucide--more-vertical]" />
					</button>
					{showMenu ? (
						<>
							<div className="viz-menu-backdrop" onClick={() => setShowMenu(false)} />
							<div className="viz-menu">
								{menuItems.map((item) => (
									<button
										key={item.key}
										type="button"
										onClick={() => { item.run(); setShowMenu(false); }}
										className={`viz-menu-item${item.danger ? " is-danger" : ""}`}
									>
										<span className={`icon-[lucide--${item.icon}]`} />
										{item.label}
									</button>
								))}
							</div>
						</>
					) : null}
				</div>
			</div>

			<div className="viz-asset-meta">
				<span className="viz-asset-meta-item">
					<span className="icon-[lucide--database]" />
					数据集 {datasetCount}
				</span>
				<span className="viz-asset-meta-item">
					<span className="icon-[lucide--sliders-horizontal]" />
					筛选 {filterCount}
				</span>
				<span className="viz-asset-time viz-rail-num">{timeAgo}</span>
			</div>

			{/* 快捷操作：设计帧的卡片没有这一行，但它承载既有的预览 / 下载 / AI 入口，不删功能 */}
			<div className="viz-asset-actions">
				<button type="button" onClick={onPreview} className="viz-ghost-btn is-primary">
					<span className="icon-[lucide--eye]" />
					预览
				</button>
				<button type="button" onClick={onDownload} className="viz-ghost-btn">
					<span className="icon-[lucide--download]" />
					下载
				</button>
				<button type="button" onClick={onEditWithAi} className="viz-ghost-btn">
					<span className="icon-[lucide--sparkles]" />
					AI 修改
				</button>
			</div>
		</article>
	);
}

/** 缩略图变体：由产物类型与首个图表类型决定（对齐设计帧的 Thumb 取舍）。 */
type ThumbVariant = "line" | "donut" | "bars";

function thumbVariant(viz: StoredVisualization): ThumbVariant {
	if (viz.type === "screen") return "line";
	const first = viz.chartItems?.[0]?.type;
	if (first === "pie" || first === "doughnut" || first === "polarArea") return "donut";
	if (first === "line") return "line";
	return "bars";
}

/**
 * 缩略图几何：只画图表形状，不用图标字体（设计约定：Charts 一律由 div / 内联 SVG 几何构成）。
 * 颜色全部走 --dbx-series-* 令牌，不写死色值。
 */
const THUMB_LINE = [42, 48, 45, 56, 52, 61, 58, 66, 63, 71, 68, 76];
const THUMB_BARS = [38, 52, 44, 61, 57, 72, 66, 81];
const THUMB_DONUT = [
	{ value: 46, series: 1 },
	{ value: 27, series: 2 },
	{ value: 17, series: 3 },
	{ value: 10, series: 4 },
];

function AssetThumb({ viz }: { viz: StoredVisualization }): JSX.Element {
	const variant = thumbVariant(viz);
	if (variant === "donut") return <ThumbDonut />;
	if (variant === "bars") return <ThumbBars />;
	return <ThumbLine />;
}

function ThumbLine(): JSX.Element {
	const max = Math.max(...THUMB_LINE);
	const min = Math.min(...THUMB_LINE);
	const span = max - min || 1;
	const step = 100 / (THUMB_LINE.length - 1);
	const points = THUMB_LINE.map((value, index) => `${(index * step).toFixed(2)},${(100 - ((value - min) / span) * 100).toFixed(2)}`);
	const line = points.join(" ");
	return (
		<svg className="viz-thumb-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
			<polygon className="viz-thumb-area" points={`0,100 ${line} 100,100`} />
			<polyline className="viz-thumb-line" points={line} />
		</svg>
	);
}

function ThumbDonut(): JSX.Element {
	const radius = 30;
	const circumference = 2 * Math.PI * radius;
	const gap = 3;
	let offset = 0;
	return (
		<svg className="viz-thumb-donut" viewBox="0 0 80 80" aria-hidden="true">
			{THUMB_DONUT.map((segment) => {
				const length = (segment.value / 100) * circumference;
				const circle = (
					<circle
						key={segment.series}
						cx="40"
						cy="40"
						r={radius}
						fill="none"
						className={`viz-thumb-seg-${segment.series}`}
						strokeWidth="11"
						strokeDasharray={`${Math.max(length - gap, 0.5).toFixed(2)} ${(circumference - Math.max(length - gap, 0.5)).toFixed(2)}`}
						strokeDashoffset={(-offset).toFixed(2)}
						transform="rotate(-90 40 40)"
					/>
				);
				offset += length;
				return circle;
			})}
		</svg>
	);
}

function ThumbBars(): JSX.Element {
	const max = Math.max(...THUMB_BARS);
	return (
		<div className="viz-thumb-bars" aria-hidden="true">
			{THUMB_BARS.map((value, index) => (
				<span
					key={index}
					className={`viz-thumb-bar viz-thumb-bar-${(index % 4) + 1}`}
					style={{ height: `${Math.round((value / max) * 100)}%` }}
				/>
			))}
		</div>
	);
}

function formatClock(timestamp: number): string {
	const date = new Date(timestamp);
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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
