/**
 * VisualizationTab — 可视化产物标签页组件（v0.0.103）
 *
 * 渲染路径：
 *   ① viz.spec 存在（JimuBI 紧凑格式）→ 调 compile API → 渲染 JimuBI 组件 JSON
 *      → 附带 spec 微调面板（JSON 编辑器 + 重新编译按钮）
 *   ② viz.chartItems 存在（旧 Chart.js 格式）→ 直接 ChartGrid 渲染
 *   ③ viz.html 存在 → iframe 渲染（最老产物）
 *
 * 工具栏：下载 / 外部打开 / 全屏 / Spec 微调（仅 spec 格式产物显示）
 */

import { useState, useRef, useEffect, type JSX } from "react";
import type { Visualization } from "../../../domain/chart-contract";
import { downloadHtml, openHtmlInNewTab } from "../services/html-export";
import { withEmbeddedChartJs } from "../services/chart-runtime";
import { getUi } from "../../../runtime-contract.ts";
import { resolveChartItems } from "../../../domain/chart-source";
import { resolveVisualizationHtml } from "../visualization-html";
import { ChartGrid } from "./chart-grid";
import { compileJimuBigscreen, type JimuCompiledComponent, type JimuSpec } from "../services/jimu-compiler-service";

interface Props {
	viz: Visualization;
	onClose?: () => void;
}

/** 把 JimuBI compile 输出转成 ChartItem 格式（带 cfg 字段），ChartGrid/ChartItemRenderer 能识别。 */
function jimuComponentsToChartItems(comps: JimuCompiledComponent[]): Visualization["chartItems"] {
	return comps.map((c) => ({
		type: c.type,
		title: c.title,
		// data 给空（JimuBI 格式跳过 normalize/validate），渲染时用 cfg.option
		data: [],
		// cfg 是 compile 输出的完整 JimuBI JSON
		cfg: c.cfg,
	} as unknown as Visualization["chartItems"][number] & { cfg: unknown }));
}

/** 判断产物是否带 JimuBI spec（可微调）。 */
function hasJimuSpec(viz: Visualization): viz is Visualization & { spec: JimuSpec } {
	const s = (viz as { spec?: unknown }).spec;
	return !!s && typeof s === "object" && Array.isArray((s as { components?: unknown }).components);
}

export function VisualizationTab({ viz, onClose }: Props): JSX.Element {
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [showSpecEditor, setShowSpecEditor] = useState(false);
	const [specText, setSpecText] = useState<string>("");
	const [compiling, setCompiling] = useState(false);
	const [compileError, setCompileError] = useState<string | null>(null);
	const [liveItems, setLiveItems] = useState<Visualization["chartItems"] | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const legacyHtml = viz.html;
	const baseItems = resolveChartItems(viz.chartItems ?? [], viz.datasets ?? [], viz.filters ?? []);
	const isScreen = viz.type === "screen";
	const jimuSpecAvailable = hasJimuSpec(viz);

	// 初始化：如果有 spec，自动 compile 一次
	useEffect(() => {
		if (jimuSpecAvailable && !liveItems) {
			setSpecText(JSON.stringify(viz.spec, null, 2));
			triggerCompile(viz.spec as JimuSpec);
		}
	}, [viz, jimuSpecAvailable]);

	useEffect(() => {
		const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
	}, []);

	const notifyError = (message: string): void => {
		try { getUi()?.notify?.({ message, variant: "error" }); } catch { /* ignore */ }
	};

	async function triggerCompile(spec: JimuSpec): Promise<void> {
		setCompiling(true);
		setCompileError(null);
		const result = await compileJimuBigscreen(spec);
		setCompiling(false);
		if (!result.ok) {
			setCompileError(result.error.message);
			return;
		}
		if (result.data.warnings.length > 0) {
			console.warn("[JimuBI compile warnings]", result.data.warnings);
		}
		setLiveItems(jimuComponentsToChartItems(result.data.components));
	}

	function handleRecompile(): void {
		try {
			const parsed = JSON.parse(specText) as JimuSpec;
			triggerCompile(parsed);
		} catch (e) {
			setCompileError(`Spec JSON 解析失败: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	const handleDownload = (): void => {
		try { downloadHtml(resolveVisualizationHtml(viz, liveItems ?? baseItems), viz.title); }
		catch (error) { notifyError(error instanceof Error ? error.message : String(error)); }
	};

	const handleOpenExternal = (): void => {
		try { openHtmlInNewTab(resolveVisualizationHtml(viz, liveItems ?? baseItems)); }
		catch (error) { notifyError(error instanceof Error ? error.message : String(error)); }
	};

	const handleFullscreen = async (): Promise<void> => {
		if (containerRef.current) {
			if (document.fullscreenElement) { await document.exitFullscreen(); }
			else { await containerRef.current.requestFullscreen(); }
		}
	};

	// 决定渲染哪些 items：liveItems（spec 编译结果）优先，其次 baseItems，最后 legacyHtml
	const renderItems = liveItems ?? baseItems;
	const shouldRenderChartGrid = (renderItems?.length ?? 0) > 0;
	const shouldRenderIframe = !shouldRenderChartGrid && !!legacyHtml;

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
					{jimuSpecAvailable && <span className="toolbar-badge viz-badge-jimu">JimuBI</span>}
				</div>
				<div className="toolbar-right">
					{jimuSpecAvailable && (
						<button
							type="button"
							onClick={() => setShowSpecEditor((v) => !v)}
							className={`toolbar-btn ${showSpecEditor ? "toolbar-btn-active" : ""}`}
							title="Spec 微调（AI 生成的组件 JSON）"
						>
							<span className="icon-[lucide--settings-2] h-3.5 w-3.5" />
							<span className="toolbar-btn-label">Spec</span>
						</button>
					)}
					<button type="button" onClick={handleDownload} className="toolbar-btn" title="下载 HTML">
						<span className="icon-[lucide--download] h-3.5 w-3.5" />
					</button>
					<button type="button" onClick={handleOpenExternal} className="toolbar-btn" title="外部打开">
						<span className="icon-[lucide--external-link] h-3.5 w-3.5" />
					</button>
					<button type="button" onClick={handleFullscreen} className="toolbar-btn" title={isFullscreen ? "退出全屏" : "全屏"}>
						<span className={`h-3.5 w-3.5 ${isFullscreen ? "icon-[lucide--minimize-2]" : "icon-[lucide--maximize-2]"}`} />
					</button>
					{onClose && (
						<button type="button" onClick={onClose} className="toolbar-btn" title="返回列表">
							<span className="icon-[lucide--arrow-left] h-3.5 w-3.5" />
						</button>
					)}
				</div>
			</div>

			{/* Spec 微调面板（条件展开） */}
			{showSpecEditor && jimuSpecAvailable && (
				<div className="viz-spec-editor">
					<div className="viz-spec-editor-header">
						<span>JimuBI Spec（组件紧凑格式）</span>
						<div className="viz-spec-editor-actions">
							<button type="button" onClick={() => setSpecText(JSON.stringify(viz.spec, null, 2))} className="viz-btn-ghost">重置</button>
							<button
								type="button"
								onClick={handleRecompile}
								className="viz-btn-primary"
								disabled={compiling}
							>
								{compiling ? "编译中..." : "🔄 重新编译预览"}
							</button>
						</div>
					</div>
					<textarea
						className="viz-spec-editor-textarea"
						value={specText}
						onChange={(e) => setSpecText(e.target.value)}
						spellCheck={false}
						placeholder='{"page":{"name":"预览"},"palette":"biz","components":[{"type":"JBar","title":"...","data":[...]}]}'
					/>
					{compileError && <p className="viz-spec-editor-error">❌ {compileError}</p>}
				</div>
			)}

			{/* 内容区：三条路径 */}
			{shouldRenderChartGrid ? (
				<div className="visualization-tab-content viz-embed">
					<ChartGrid items={renderItems} isScreen={isScreen} showUnboundHint={(viz.datasets?.length ?? 0) > 0} />
				</div>
			) : shouldRenderIframe ? (
				<div className="visualization-tab-content">
					<iframe
						srcDoc={withEmbeddedChartJs(legacyHtml!)}
						className="visualization-tab-iframe"
						title={viz.title}
						sandbox="allow-scripts"
					/>
				</div>
			) : (
				<div className="visualization-tab-content viz-embed">
					<p className="viz-banner viz-banner-error">该产物既没有 HTML，也没有可用的图表项。</p>
				</div>
			)}
		</div>
	);
}
