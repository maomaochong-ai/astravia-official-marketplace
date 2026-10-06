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
import type { StoredVisualization } from "../visualization-store";
import { DASHBOARD_PRESETS } from "../presets/dashboard/presets";
import { SCREEN_PRESETS } from "../presets/screen/presets";
import { DashboardRenderer, type RenderedChart } from "./dashboard-renderer";
import { ScreenRenderer, type RenderedWidget } from "./screen-renderer";

interface Props {
	viz: StoredVisualization;
}

export function VisualizationTab({ viz }: Props): JSX.Element {
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

	// 查找对应的预设模板
	const preset = viz.type === "dashboard"
		? DASHBOARD_PRESETS.find((p) => p.id === viz.presetId || p.id === viz.template)
		: SCREEN_PRESETS.find((p) => p.id === viz.presetId || p.id === viz.template);

	// 渲染内容
	const renderContent = (): JSX.Element | null => {
		if (renderMode === "iframe") {
			return (
				<iframe
					srcDoc={viz.html}
					className="visualization-tab-iframe"
					title={viz.title}
					sandbox="allow-scripts allow-same-origin"
				/>
			);
		}

		// 组件模式
		if (viz.type === "dashboard" && preset && viz.charts) {
			return (
				<DashboardRenderer
					preset={preset}
					title={viz.title}
					charts={viz.charts as RenderedChart[]}
				/>
			);
		}

		if (viz.type === "screen" && preset && viz.widgets) {
			return (
				<ScreenRenderer
					preset={preset}
					title={viz.title}
					widgets={viz.widgets as RenderedWidget[]}
				/>
			);
		}

		// 降级到 iframe
		return (
			<iframe
				srcDoc={viz.html}
				className="visualization-tab-iframe"
				title={viz.title}
				sandbox="allow-scripts allow-same-origin"
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
					<button
						type="button"
						onClick={() => setRenderMode(renderMode === "iframe" ? "component" : "iframe")}
						className="toolbar-btn"
						title={renderMode === "iframe" ? "切换到组件渲染" : "切换到 iframe 渲染"}
					>
						<span className={`h-3.5 w-3.5 ${renderMode === "iframe" ? "icon-[lucide--code]" : "icon-[lucide--layout-grid]"}`} />
						<span>{renderMode === "iframe" ? "组件" : "iframe"}</span>
					</button>
					<button
						type="button"
						onClick={handleDownload}
						className="toolbar-btn"
						title="下载 HTML 文件"
					>
						<span className="icon-[lucide--download] h-3.5 w-3.5" />
						<span>下载</span>
					</button>
					<button
						type="button"
						onClick={handleOpenExternal}
						className="toolbar-btn"
						title="在外部浏览器打开"
					>
						<span className="icon-[lucide--external-link] h-3.5 w-3.5" />
						<span>新窗口</span>
					</button>
					<button
						type="button"
						onClick={handleFullscreen}
						className="toolbar-btn"
						title={isFullscreen ? "退出全屏" : "全屏"}
					>
						<span className={`h-3.5 w-3.5 ${isFullscreen ? "icon-[lucide--minimize-2]" : "icon-[lucide--maximize-2]"}`} />
						<span>{isFullscreen ? "退出" : "全屏"}</span>
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
