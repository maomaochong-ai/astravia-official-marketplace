/**
 * VisualizationTab — 可视化产物标签页组件（v0.0.103 简化版）
 * 
 * 只保留 iframe srcDoc 渲染路径 + 下载 + 外部打开 + 全屏。
 * 旧的 Canvas / DashboardRenderer / ScreenRenderer 已删除，所有产物统一 HTML 页面。
 */

import { useState, useRef, useEffect, type JSX } from "react";
import type { Visualization } from "../../../domain/visualization";

interface Props {
	// 预览态（工具刚生成、未入库，无 id）与已保存产物共用此组件；
	// 组件本身不读 id/createdAt，故接受 Visualization 即可，StoredVisualization 是其子类型。
	viz: Visualization;
	onClose?: () => void;
}

export function VisualizationTab({ viz, onClose }: Props): JSX.Element {
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

			{/* 预览区域：统一 iframe srcDoc */}
			<div className="visualization-tab-content">
				<iframe
					srcDoc={viz.html}
					className="visualization-tab-iframe"
					title={viz.title}
					sandbox="allow-scripts"
				/>
			</div>
		</div>
	);
}
