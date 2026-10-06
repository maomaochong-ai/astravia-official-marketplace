/**
 * VisualizationPreview — 看板/大屏可视化预览组件。
 * 
 * 在插件内直接渲染 HTML 内容，支持：
 * - iframe 预览（隔离样式）
 * - 下载 HTML 文件
 * - 全屏模式
 * - 响应式布局
 */

import { useState, useRef, type JSX } from "react";

interface Props {
	html: string;
	title: string;
	type: "dashboard" | "screen";
	onClose: () => void;
}

export function VisualizationPreview({ html, title, type, onClose }: Props): JSX.Element {
	const [isFullscreen, setIsFullscreen] = useState(false);
	const iframeRef = useRef<HTMLIFrameElement>(null);

	const handleDownload = (): void => {
		const blob = new Blob([html], { type: "text/html;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_")}.html`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleOpenExternal = (): void => {
		const blob = new Blob([html], { type: "text/html;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		window.open(url, "_blank");
	};

	const handleFullscreen = (): void => {
		if (iframeRef.current) {
			if (iframeRef.current.requestFullscreen) {
				iframeRef.current.requestFullscreen();
			}
		}
		setIsFullscreen(true);
	};

	return (
		<div className={`fixed inset-0 z-[1000] flex flex-col bg-background ${isFullscreen ? "" : "p-4"}`}>
			{/* 工具栏 */}
			<div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2">
				<div className="flex items-center gap-2">
					<span className={`icon-[lucide--${type === "dashboard" ? "layout-dashboard" : "monitor"}] h-4 w-4 text-primary`} />
					<h3 className="text-sm font-medium text-foreground">{title}</h3>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handleDownload}
						className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
						title="下载 HTML 文件"
					>
						<span className="icon-[lucide--download] h-3.5 w-3.5" />
						下载
					</button>
					<button
						type="button"
						onClick={handleOpenExternal}
						className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
						title="在新窗口打开"
					>
						<span className="icon-[lucide--external-link] h-3.5 w-3.5" />
						新窗口
					</button>
					<button
						type="button"
						onClick={handleFullscreen}
						className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
						title="全屏预览"
					>
						<span className="icon-[lucide--maximize] h-3.5 w-3.5" />
						全屏
					</button>
					<button
						type="button"
						onClick={onClose}
						className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
					>
						<span className="icon-[lucide--x] h-3.5 w-3.5" />
						关闭
					</button>
				</div>
			</div>

			{/* 预览区域 */}
			<div className="flex-1 overflow-hidden">
				<iframe
					ref={iframeRef}
					srcDoc={html}
					className="h-full w-full border-0"
					title={title}
					sandbox="allow-scripts allow-same-origin"
				/>
			</div>
		</div>
	);
}
