/**
 * VisualizationTab — 可视化产物标签页组件（v0.0.103 简化版）
 * 
 * 只保留 iframe srcDoc 渲染路径 + 下载 + 外部打开 + 全屏。
 * 旧的 Canvas / DashboardRenderer / ScreenRenderer 已删除，所有产物统一 HTML 页面。
 */

import { useState, useRef, useEffect, type JSX } from "react";
import type { Visualization } from "../../../domain/chart-contract";
import { downloadHtml, openHtmlInNewTab } from "../../../shared/utils/html-export";
import { withEmbeddedChartJs } from "../../../shared/utils/chart-runtime";
import { getUi } from "../../../runtime-contract.ts";
import { resolveChartItems } from "../../../domain/chart-source";
import { resolveVisualizationHtml } from "../visualization-html";
import { ChartGrid } from "./chart-grid";

interface Props {
	// 预览态（工具刚生成、未入库，无 id）与已保存产物共用此组件；
	// 组件本身不读 id/createdAt，故接受 Visualization 即可，StoredVisualization 是其子类型。
	viz: Visualization;
	onClose?: () => void;
}

export function VisualizationTab({ viz, onClose }: Props): JSX.Element {
	const [isFullscreen, setIsFullscreen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const legacyHtml = viz.html;
	// 带数据集的产物只落库数据，图表项要在渲染 / 导出前按初始筛选解析出真实数据
	const items = resolveChartItems(viz.chartItems ?? [], viz.datasets ?? [], viz.filters ?? []);
	const isScreen = viz.type === "screen";

	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement);
		};
		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
	}, []);

	const notifyError = (message: string): void => {
		try {
			getUi()?.notify?.({ message, variant: "error" });
		} catch {
			/* 宿主不支持 notify 或运行时未就绪时静默忽略 */
		}
	};

	const handleDownload = (): void => {
		try {
			downloadHtml(resolveVisualizationHtml(viz, items), viz.title);
		} catch (error) {
			notifyError(error instanceof Error ? error.message : String(error));
		}
	};

	const handleOpenExternal = (): void => {
		try {
			openHtmlInNewTab(resolveVisualizationHtml(viz, items));
		} catch (error) {
			notifyError(error instanceof Error ? error.message : String(error));
		}
	};

	const handleFullscreen = async (): Promise<void> => {
		if (containerRef.current) {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			} else {
				await containerRef.current.requestFullscreen();
			}
		}
	};

	return (
		<div
			ref={containerRef}
			className={`visualization-tab ${isScreen ? "viz-theme-screen" : "viz-theme-dashboard"} ${isFullscreen ? "fullscreen" : ""}`}
		>
			{/* 工具栏 */}
			<div className="visualization-tab-toolbar">
				<div className="toolbar-left">
					<span className={`toolbar-icon ${viz.type === "dashboard" ? "icon-[lucide--layout-dashboard]" : "icon-[lucide--monitor]"}`} />
					<h3 className="toolbar-title">{viz.title}</h3>
					<span className="toolbar-badge">{viz.type === "dashboard" ? "看板" : "大屏"}</span>
				</div>
				<div className="toolbar-right">
					{onClose && (
						<button
							type="button"
							onClick={onClose}
							className="toolbar-btn"
							title="返回产物列表"
						>
							<span className="icon-[lucide--arrow-left] h-3.5 w-3.5" />
						</button>
					)}
					<button
						type="button"
						onClick={handleDownload}
						className="toolbar-btn"
						title="下载 HTML 文件"
					>
						<span className="icon-[lucide--download] h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						onClick={handleOpenExternal}
						className="toolbar-btn"
						title="在外部浏览器打开"
					>
						<span className="icon-[lucide--external-link] h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						onClick={handleFullscreen}
						className="toolbar-btn"
						title={isFullscreen ? "退出全屏" : "全屏"}
					>
						<span className={`h-3.5 w-3.5 ${isFullscreen ? "icon-[lucide--minimize-2]" : "icon-[lucide--maximize-2]"}`} />
					</button>
				</div>
			</div>

			{/* 内容区：老产物走 iframe（内容与当初所见一致）；带 chartItems 的产物在 UI 内直接渲染 Chart.js */}
			{legacyHtml ? (
				<div className="visualization-tab-content">
					<iframe
						srcDoc={withEmbeddedChartJs(legacyHtml)}
						className="visualization-tab-iframe"
						title={viz.title}
						sandbox="allow-scripts"
					/>
				</div>
			) : items.length > 0 ? (
				<div className="visualization-tab-content viz-embed">
					<ChartGrid items={items} isScreen={isScreen} showUnboundHint={(viz.datasets?.length ?? 0) > 0} />
				</div>
			) : (
				<div className="visualization-tab-content viz-embed">
					<p className="viz-banner viz-banner-error">该产物既没有 HTML，也没有可用的图表项。</p>
				</div>
			)}
		</div>
	);
}
