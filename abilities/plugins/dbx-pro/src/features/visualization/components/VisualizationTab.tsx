/**
 * VisualizationTab — 可视化产物标签页组件
 * 
 * 在数据库工作台的新标签页中显示可视化产物
 * 支持：全屏、下载、外部浏览器打开
 */

import { useState, useRef, useEffect, type JSX } from "react";
import type { StoredVisualization } from "../visualization-store";

interface Props {
	viz: StoredVisualization;
}

export function VisualizationTab({ viz }: Props): JSX.Element {
	const [isFullscreen, setIsFullscreen] = useState(false);
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

	return (
		<div ref={containerRef} className={`visualization-tab ${isFullscreen ? "fullscreen" : ""}`}>
			{/* 工具栏 */}
			<div className="visualization-tab-toolbar">
				<div className="toolbar-left">
					<span className={`toolbar-icon ${viz.type === "dashboard" ? "icon-[lucide--layout-dashboard]" : "icon-[lucide--monitor]"}`} />
					<h3 className="toolbar-title">{viz.title}</h3>
					<span className="toolbar-badge">{viz.type === "dashboard" ? "看板" : "大屏"}</span>
				</div>
				<div className="toolbar-right">
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
				<iframe
					srcDoc={viz.html}
					className="visualization-tab-iframe"
					title={viz.title}
					sandbox="allow-scripts allow-same-origin"
				/>
			</div>
		</div>
	);
}
