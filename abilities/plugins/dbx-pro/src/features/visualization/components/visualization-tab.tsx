/**
 * VisualizationTab — 可视化产物标签页组件
 * 
 * 在数据库工作台的新标签页中显示可视化产物
 * 支持两种渲染模式：
 * - iframe 模式：使用工具生成的 HTML 预览
 * - 组件模式：使用 DashboardRenderer/ScreenRenderer + recharts 渲染
 * 
 * 支持：全屏、下载、外部浏览器打开、切换渲染模式
 */

import { useState, useRef, useEffect, type JSX } from "react";
import type { Visualization } from "../../../domain/visualization";
import { DASHBOARD_PRESETS, type ChartConfig } from "../presets/dashboard/presets";
import { SCREEN_PRESETS, type WidgetConfig } from "../presets/screen/presets";
import { DashboardRenderer, type RenderedChart } from "./dashboard-renderer";
import { ScreenRenderer, type RenderedWidget } from "./screen-renderer";
import { Canvas } from "./canvas";

interface Props {
	// 预览态（工具刚生成、未入库，无 id）与已保存产物共用此组件；
	// 组件本身不读 id/createdAt，故接受 Visualization 即可，StoredVisualization 是其子类型。
	viz: Visualization;
	onClose?: () => void;
}

export function VisualizationTab({ viz, onClose }: Props): JSX.Element {
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [renderMode, setRenderMode] = useState<"iframe" | "component">("component");
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement);
		};
		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
	}, []);

	const handleDownload = (): void => {
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

	const handleOpenExternal = (): void => {
		const blob = new Blob([viz.html], { type: "text/html;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		window.open(url, "_blank");
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

	// 按类型分别查找预设，保持 DashboardPreset / ScreenPreset 类型收窄。
	const dashboardPreset =
		viz.type === "dashboard"
			? DASHBOARD_PRESETS.find((p) => p.id === viz.presetId || p.id === viz.template)
			: undefined;
	const screenPreset =
		viz.type === "screen"
			? SCREEN_PRESETS.find((p) => p.id === viz.presetId || p.id === viz.template)
			: undefined;
	const preset = dashboardPreset ?? screenPreset;

	// 渲染内容
	const renderContent = (): JSX.Element | null => {
		// v0.0.94: 多数据源路径优先（语义不损坏），其次 legacy 合并宽表路径
		if (viz.dataSources?.length) {
			return (
				<Canvas
					dataSources={viz.dataSources}
					intent={viz.type === "screen" ? "bigscreen" : "dashboard"}
				/>
			);
		}
		// Canvas 渲染模式优先（ADR-0005 §5）：从 SQL 结果集直接推断布局
		if (viz.resultRows?.length && viz.resultColumns?.length) {
			return (
				<Canvas
					columns={viz.resultColumns}
					rows={viz.resultRows}
					intent={viz.type === "screen" ? "bigscreen" : "dashboard"}
				/>
			);
		}

		if (renderMode === "iframe") {
			return (
				<iframe
					srcDoc={viz.html}
					className="visualization-tab-iframe"
					title={viz.title}
					// 仅放行脚本；不授予 allow-same-origin，防止自包含 HTML 脱离沙箱访问宿主存储。
					sandbox="allow-scripts"
				/>
			);
		}

		// 组件模式
		// domain/visualization.ts 里 Visualization 用 rows，RenderedChart/RenderedWidget 用 data —— 显式映射，杜绝 `as` 掩盖的字段漂移。
		if (viz.type === "dashboard" && dashboardPreset && viz.charts) {
			const renderedCharts: RenderedChart[] = viz.charts.map((c) => ({
				id: c.id,
				type: c.type,
				title: c.title,
				data: c.rows ?? [],
				columns: c.columns ?? [],
				config: c.config as ChartConfig["config"] | undefined,
				layout: (c.layout ?? {}) as ChartConfig["layout"],
			}));
			return (
				<DashboardRenderer
					preset={dashboardPreset}
					title={viz.title}
					charts={renderedCharts}
				/>
			);
		}

		if (viz.type === "screen" && screenPreset && viz.widgets) {
			const renderedWidgets: RenderedWidget[] = viz.widgets.map((w) => ({
				id: w.id,
				type: w.type,
				title: w.title,
				data: w.rows ?? [],
				columns: w.columns ?? [],
				config: w.config as WidgetConfig["config"] | undefined,
				layout: (w.layout ?? {}) as WidgetConfig["layout"],
			}));
			return (
				<ScreenRenderer
					preset={screenPreset}
					title={viz.title}
					widgets={renderedWidgets}
				/>
			);
		}

		// 降级到 iframe
		return (
			<iframe
				srcDoc={viz.html}
				className="visualization-tab-iframe"
				title={viz.title}
				sandbox="allow-scripts"
			/>
		);
	};

	return (
		<div ref={containerRef} className={`visualization-tab ${isFullscreen ? "fullscreen" : ""}`}>
			{/* 工具栏 */}
			<div className="visualization-tab-toolbar">
				<div className="toolbar-left">
					<span className={`toolbar-icon ${viz.type === "dashboard" ? "icon-[lucide--layout-dashboard]" : "icon-[lucide--monitor]"}`} />
					<h3 className="toolbar-title">{viz.title}</h3>
					<span className="toolbar-badge">{viz.type === "dashboard" ? "看板" : "大屏"}</span>
					{preset && <span className="toolbar-badge">{preset.label}</span>}
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
						onClick={() => setRenderMode(renderMode === "iframe" ? "component" : "iframe")}
						className="toolbar-btn"
						title={renderMode === "iframe" ? "切换到组件渲染" : "切换到 iframe 渲染"}
					>
						<span className={`h-3.5 w-3.5 ${renderMode === "iframe" ? "icon-[lucide--code]" : "icon-[lucide--layout-grid]"}`} />
					</button>
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

			{/* 预览区域 */}
			<div className="visualization-tab-content">
				{renderContent()}
			</div>
		</div>
	);
}
