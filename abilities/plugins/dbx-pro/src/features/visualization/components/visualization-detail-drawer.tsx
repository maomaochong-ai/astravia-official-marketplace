/**
 * VisualizationDetailDrawer — 「BI 数据资产」详情抽屉。
 *
 * 一个产物的全部事实都在这里：数据来源（SQL / 列 / 行数）、筛选、图表。
 * 三条不能含糊的语义：
 *   1. 改筛选只重算前端图表，不重跑 SQL —— 所以拖动筛选是即时的；
 *   2. 数据在库时被裁过行（rowCount > rows.length），就如实说「点重新取数载入前 2000 行」，
 *      不假装筛选口径等于 SQL 口径；
 *   3. 旧产物（只有 html 的只读快照）没有数据集信息，禁用筛选并说明原因，而不是给个空面板。
 *
 * 导出用的是**当前筛选后**的图表项：导出的应该是用户此刻看到的那张图（ADR-0009 §10 验收 ⑤）。
 */

import { useEffect, useState, type JSX } from "react";
import type { ChartFilter } from "../../../domain/chart-contract";
import { applyFilters, filtersForDataset } from "../../../domain/dataset-filter";
import { resolveChartItems } from "../../../domain/chart-source";
import type { StoredVisualization } from "../../../domain/visualization-doc";
import { collectLineageSources, collectLineageTables, findArtifactsByTable } from "../../../domain/visualization-lineage";
import { getUi } from "../../../runtime-contract.ts";
import { downloadHtml, openHtmlInNewTab } from "../../../shared/utils/html-export";
import { resolveVisualizationHtml } from "../visualization-html";
import { useVisualizationStore } from "../visualization-store";
import { useDatasetRefetch } from "../hooks/use-dataset-refetch";
import { ChartGrid } from "./chart-grid";
import { DatasetFilterPanel } from "./dataset-filter-panel";
import { DatasetSummaryList } from "./dataset-summary-list";
import { VisualizationLineagePanel } from "./visualization-lineage-panel";

interface Props {
	viz: StoredVisualization;
	onClose: () => void;
	onPreview: () => void;
}

export function VisualizationDetailDrawer({ viz, onClose, onPreview }: Props): JSX.Element {
	const { updateVisualization, visualizations } = useVisualizationStore();
	const [filters, setFilters] = useState<ChartFilter[]>(viz.filters ?? []);
	const refetch = useDatasetRefetch(viz, (datasets) => updateVisualization(viz.id, { datasets }));

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [onClose]);

	const datasets = viz.datasets ?? [];
	const isScreen = viz.type === "screen";
	const hasDatasets = datasets.length > 0;
	const filterable = datasets.some((dataset) => dataset.rows.length > 0);
	// 2000 行 × 几个列的过滤与重映射是毫秒级，刻意不引入 memo
	const items = resolveChartItems(viz.chartItems ?? [], datasets, filters);
	const loaded = datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0);
	const afterFilter = datasets.reduce(
		(sum, dataset) => sum + applyFilters(dataset.rows, dataset.columns, filtersForDataset(filters, dataset.id)).length,
		0,
	);
	const sqlTotal = datasets.reduce((sum, dataset) => sum + dataset.rowCount, 0);
	// 血缘：来源清单（含取数 SQL）+ 反查引用了同一张表、且不是自己的其他产物
	const lineageSources = collectLineageSources(viz);
	const lineageReferences = collectLineageTables(viz).map((table) => ({
		table,
		entries: findArtifactsByTable(visualizations, table, viz.id),
	}));

	function notifyError(message: string): void {
		try {
			getUi()?.notify?.({ message, variant: "error" });
		} catch {
			/* 宿主不支持 notify 或运行时未就绪时静默忽略 */
		}
	}

	function handleFilters(next: ChartFilter[]): void {
		setFilters(next);
		updateVisualization(viz.id, { filters: next });
	}

	function handleExport(): void {
		try {
			downloadHtml(resolveVisualizationHtml(viz, items), viz.title);
		} catch (error) {
			notifyError(error instanceof Error ? error.message : String(error));
		}
	}

	function handleOpenExternal(): void {
		try {
			openHtmlInNewTab(resolveVisualizationHtml(viz, items));
		} catch (error) {
			notifyError(error instanceof Error ? error.message : String(error));
		}
	}

	return (
		<div className="viz-drawer-mask" onClick={onClose}>
			<div
				className={`viz-drawer viz-theme-${isScreen ? "screen" : "dashboard"}`}
				onClick={(event) => event.stopPropagation()}
			>
				<div className="visualization-tab-toolbar">
					<div className="toolbar-left">
						<h3 className="toolbar-title">{viz.title}</h3>
						<span className="toolbar-badge">{isScreen ? "大屏" : "看板"}</span>
						{hasDatasets ? (
							<span className="toolbar-badge">
								筛选后 {afterFilter} 行 / 已载入 {loaded} 行
							</span>
						) : null}
					</div>
					<div className="viz-drawer-actions">
						<button
							type="button"
							className="viz-action-btn"
							onClick={refetch.refetch}
							disabled={refetch.status === "running" || !hasDatasets}
							title="按数据集记录的 SQL 重新取数"
						>
							{refetch.status === "running" ? "取数中…" : "重新取数"}
						</button>
						<button type="button" className="viz-action-btn" onClick={handleExport}>
							导出 HTML
						</button>
						<button type="button" className="viz-action-btn" onClick={handleOpenExternal}>
							新标签打开
						</button>
						<button type="button" className="viz-action-btn" onClick={onPreview}>
							全屏预览
						</button>
						<button type="button" className="viz-action-btn" onClick={onClose}>
							关闭
						</button>
					</div>
				</div>

				<div className="viz-drawer-body">
					{refetch.status !== "idle" && refetch.message ? (
						<p className={`viz-banner ${refetch.status === "error" ? "viz-banner-error" : "viz-banner-ok"}`}>
							{refetch.message}
						</p>
					) : null}

					{!hasDatasets ? (
						<p className="viz-banner viz-banner-info">
							该产物没有数据集信息（旧格式快照），仅可查看与导出，无法筛选或重新取数。
						</p>
					) : null}

					{hasDatasets && !filterable ? (
						<p className="viz-banner viz-banner-info">数据已被裁剪（体积超限），点「重新取数」载入数据后才能筛选。</p>
					) : null}

					{hasDatasets && filterable && sqlTotal > loaded ? (
						<p className="viz-banner viz-banner-info">
							SQL 共 {sqlTotal} 行，单条产物只载入前 {loaded} 行，点「重新取数」刷新。
						</p>
					) : null}

					{hasDatasets ? <DatasetSummaryList datasets={datasets} /> : null}

					<VisualizationLineagePanel
						sources={lineageSources}
						createdAt={viz.createdAt}
						references={lineageReferences}
					/>

					{filterable ? (
						<DatasetFilterPanel datasets={datasets} filters={filters} onChange={handleFilters} />
					) : null}

					<ChartGrid items={items} isScreen={isScreen} showUnboundHint={hasDatasets} />
				</div>
			</div>
		</div>
	);
}
