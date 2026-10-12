/**
 * bigscreen-editor.tsx — BI 编辑器主容器。
 *
 * 布局：
 *   ┌─ Toolbar（返回/页面名/保存/运行/AI 生成/主题）
 *   ├─────────┬─────────────────┬─────────────┤
 *   │NodeLib. │  NodeGraph      │  Property   │
 *   │ (折叠)  │  + CanvasStrip  │  Inspector  │
 *   ├─────────┴─────────────────┴─────────────┤
 *   │           StatusBar                       │
 *   └───────────────────────────────────────────┘
 *
 * 运行浮层（RunPanel / NodePreviewCard）叠加在 NodeGraph 之上，
 * 由 Toolbar 的「运行」按钮或快捷键 ⌘R 触发。
 */

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { engineRequest } from "../../../shared/services/engine-client";
import { getUi } from "../../runtime-contract";
import type { BigscreenPage } from "../shared/hooks/use-bigscreen-pages";
import { useCanvasExecution } from "./hooks/use-canvas-execution";
import { BigscreenToolbar } from "./components/editor-toolbar";
import { NodeLibrary } from "./components/node-library";
import { CanvasStrip } from "./components/canvas-strip";
import { NodeGraph, type Link, type NodePos } from "./components/node-graph";
import { PropertyInspector, type SelectedNodeInfo } from "./components/property-inspector";
import { EditorStatusBar } from "./components/editor-status-bar";
import { RunPanel, NodePreviewCard, type RunNode } from "./components/run-overlay";
import { AiGenerateDialog, ParamSuggest, type ParamRow } from "./components/ai-node-panel";
import { BigscreenScreenEditor } from "./screen-editor";

/** template JSON schema（持久化）。 */
interface CanvasTemplate {
	nodes: Record<string, NodePos>;
	links: Link[];
}

/** 空画布 —— 服务端新建页面的默认 template 是字符串 "[]"，里面没有任何画布内容。 */
function emptyTemplate(): CanvasTemplate {
	return { nodes: {}, links: [] };
}

/**
 * 解析持久化的 template。
 * 只认 { nodes: {...}, links: [...] }；空串、"[]"、解析失败、结构不符一律返回空画布 ——
 * 以前这里回退到演示布局，结果新建的页面一进去就是一堆别人的示例节点。
 */
function parseTemplate(raw: string | null | undefined): CanvasTemplate {
	if (!raw) return emptyTemplate();
	try {
		const obj: unknown = JSON.parse(raw);
		if (!obj || typeof obj !== "object" || Array.isArray(obj)) return emptyTemplate();
		const record = obj as { nodes?: unknown; links?: unknown };
		const nodes =
			record.nodes && typeof record.nodes === "object" && !Array.isArray(record.nodes)
				? (record.nodes as Record<string, NodePos>)
				: {};
		const links = Array.isArray(record.links) ? (record.links as Link[]) : [];
		return { nodes, links };
	} catch {
		return emptyTemplate();
	}
}

/**
 * 画布内容序列化 —— 既当保存载荷也当「有没被改过」的指纹。
 * 排除 selected 这类临时交互字段：点一下节点不该把页面变成「未保存」。
 */
function serializeCanvas(nodes: Record<string, NodePos>, links: Link[]): string {
	const clean: Record<string, NodePos> = {};
	for (const [id, node] of Object.entries(nodes)) {
		const { selected: _selected, ...rest } = node;
		clean[id] = rest;
	}
	return JSON.stringify({ nodes: clean, links });
}

export function BigscreenEditor({ pageId, onClose, onSaved }: { pageId: string; onClose: () => void; onSaved?: () => void }): JSX.Element {
	const [page, setPage] = useState<BigscreenPage | null>(null);
	const [loading, setLoading] = useState(true);
	const [dirty, setDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const [activeTheme, setActiveTheme] = useState<"dark" | "default">("dark");
	const [templates, setTemplates] = useState<{ id: string; name: string; template: string; createTime: string }[]>([]);
	const [leftCollapsed, setLeftCollapsed] = useState(false);
	const [rightCollapsed, setRightCollapsed] = useState(false);

	// 画布执行引擎
	const { nodeResults, connections, running: execRunning, runAll, getUpstreamData, refreshConnections, extractSeries } = useCanvasExecution();

	// 加载连接列表
	useEffect(() => { refreshConnections(); }, [refreshConnections]);

	// 画布状态 —— 初值与服务端还没返回时保持一致：空画布，不预置演示节点
	const [nodes, setNodes] = useState<Record<string, NodePos>>({});
	const [links, setLinks] = useState<Link[]>([]);
	// 「已保存内容」指纹；挂载和刚加载完都不该是脏的
	const baselineRef = useRef<string>(serializeCanvas({}, []));

	// ── 运行状态 ──
	const [runNodes, setRunNodes] = useState<RunNode[]>([]);
	const [running, setRunning] = useState(false);
	const [showRunPanel, setShowRunPanel] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const runTimerRef = useRef<number | null>(null);

	// ── AI 生成节点状态 ──
	const [showAiDialog, setShowAiDialog] = useState(false);
	const [aiDialogPos, setAiDialogPos] = useState({ x: 240, y: 120 });

	// ── 模板库 ──
	function loadTemplates() {
		engineRequest<{ id: string; name: string; template: string; createTime: string }[]>("/drag/template/list", undefined, { method: "GET" })
			.then((list) => setTemplates(list ?? []))
			.catch(() => { /* 静默 */ });
	}
	function saveCurrentAsTemplate() {
		const name = prompt("模板名称？", `${page?.name ?? "未命名"} 模板`);
		if (!name) return;
		const tpl = JSON.stringify({ nodes, links });
		engineRequest<{ id: string }>("/drag/template/save", { name, template: tpl })
			.then(() => { loadTemplates(); })
			.catch((e) => { console.error("保存模板失败", e); });
	}
	function deleteTemplate(id: string) {
		engineRequest<boolean>(`/drag/template/delete?id=${encodeURIComponent(id)}`, undefined, { method: "DELETE" })
			.then(() => { loadTemplates(); })
			.catch(() => { /* 静默 */ });
	}
	useEffect(() => { loadTemplates(); }, []);

	// ── 加载页面 ──
	useEffect(() => {
		let cancelled = false;
		engineRequest<BigscreenPage>(`/drag/page/queryById?id=${encodeURIComponent(pageId)}`, undefined, { method: "GET" })
			.then((p) => {
				if (cancelled) return;
				setPage(p);
				setActiveTheme((p?.theme as "dark" | "default") ?? "dark");
				const tpl = parseTemplate(p?.template ?? "");
				baselineRef.current = serializeCanvas(tpl.nodes, tpl.links);
				setNodes(tpl.nodes);
				setLinks(tpl.links);
			})
			.catch((e) => { console.error("加载页面失败", e); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [pageId]);

	useEffect(() => {
		setDirty(serializeCanvas(nodes, links) !== baselineRef.current);
	}, [nodes, links]);

	const selectedNodeInfo: SelectedNodeInfo | null = (() => {
		for (const [id, n] of Object.entries(nodes)) {
			if (n.selected) return { id, node: n };
		}
		return null;
	})();

	function handleNodeUpdate(id: string, patch: Partial<NodePos>) {
		setNodes((prev) => {
			const n = prev[id];
			if (!n) return prev;
			return { ...prev, [id]: { ...n, ...patch } };
		});
	}

	// ── 保存 ──
	async function handleSave() {
		if (!page || saving) return;
		setSaving(true);
		try {
			const template = serializeCanvas(nodes, links);
			await engineRequest<{ updateCount: number }>("/drag/page/edit", {
				id: page.id,
				name: page.name,
				type: "0",
				theme: activeTheme,
				style: page.style,
				backgroundImage: page.backgroundImage,
				designType: page.designType,
				protectionCode: "",
				template,
				updateCount: page.updateCount,
			});
			baselineRef.current = template;
			setDirty(false);
			onSaved?.();
		} catch (e) {
			console.error("保存失败", e);
		} finally {
			setSaving(false);
		}
	}

	// ── 运行全部节点（真实执行数据源，下游从上游结果取数据） ──
	const handleRunAll = useCallback(async () => {
		if (execRunning) return;
		const entries = Object.entries(nodes);
		if (entries.length === 0) return;

		// 初始化运行状态
		const initial: RunNode[] = entries.map(([id, n]) => ({
			id,
			label: (n.values?.title as string) ?? n.kind ?? id,
			icon: n.kind?.startsWith("chart") ? "icon-[lucide--chart-bar]" :
				n.kind?.startsWith("source") ? "icon-[lucide--database]" :
				"icon-[lucide--circle]",
			status: "wait",
		}));
		setRunNodes(initial);
		setRunning(true);
		setShowRunPanel(true);
		setShowPreview(true);

		// 标记所有节点为运行中
		setRunNodes(initial.map((rn) => ({ ...rn, status: "running" })));

		// 执行全部节点
		await runAll(nodes, links);

		// 根据执行结果更新状态
		setRunNodes(initial.map((rn) => {
			const result = nodeResults[rn.id];
			if (result?.error) {
				return { ...rn, status: "error", note: result.error.slice(0, 30) };
			}
			if (result) {
				return { ...rn, status: "done", duration: result.durationMs, note: `${result.rowCount} 行` };
			}
			// 非数据源节点：检查是否有上游数据
			const upstream = getUpstreamData(rn.id, links, nodes);
			if (upstream) {
				return { ...rn, status: "done", note: `${upstream.rowCount} 行（上游）` };
			}
			return { ...rn, status: "done", note: "无数据" };
		}));

		setRunning(false);
	}, [nodes, links, execRunning, runAll, nodeResults, getUpstreamData]);

	const handleRunSelected = useCallback(async () => {
		if (!selectedNodeInfo) return;
		const sel = selectedNodeInfo;
		const n = nodes[sel.id];
		const initial: RunNode[] = [{
			id: sel.id,
			label: (n.values?.title as string) ?? n.kind ?? sel.id,
			status: "running",
			icon: "icon-[lucide--play]",
		}];
		setRunNodes(initial);
		setRunning(true);
		setShowRunPanel(true);
		setShowPreview(true);

		// 执行选中的节点
		const kind = n.kind;
		if (kind === "source-sql" || kind === "source-table" || kind === "source-api") {
			// 数据源节点：只执行这个节点
			await runAll({ [sel.id]: n }, []);
			const result = nodeResults[sel.id];
			if (result?.error) {
				setRunNodes([{ ...initial[0], status: "error", note: result.error.slice(0, 30) }]);
			} else if (result) {
				setRunNodes([{ ...initial[0], status: "done", duration: result.durationMs, note: `${result.rowCount} 行` }]);
			} else {
				setRunNodes([{ ...initial[0], status: "done", note: "无数据" }]);
			}
		} else {
			// 非数据源节点：从上游获取数据
			const upstream = getUpstreamData(sel.id, links, nodes);
			if (upstream) {
				setRunNodes([{ ...initial[0], status: "done", duration: 0, note: `${upstream.rowCount} 行（上游）` }]);
			} else {
				setRunNodes([{ ...initial[0], status: "done", note: "无上游数据" }]);
			}
		}

		setRunning(false);
	}, [selectedNodeInfo, nodes, links, runAll, nodeResults, getUpstreamData]);

	useEffect(() => () => {
		if (runTimerRef.current) window.clearTimeout(runTimerRef.current);
	}, []);

	if (loading || !page) {
		return (
			<div className="flex h-full items-center justify-center bg-surface text-muted">
				加载中 {loading ? "…" : "(失败)"}
			</div>
		);
	}

	// 大屏模式 → 独立编辑器（frames/bigscreen.tsx 对齐）
	if (page.style === "bigScreen") {
		return (
			<BigscreenScreenEditor
				key={page.id}
				page={page}
				onClose={onClose}
				onSaved={onSaved}
			/>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col bg-surface text-surface-foreground">
			{/* 顶栏 Toolbar */}
			<BigscreenToolbar
				pageName={page.name}
				theme={activeTheme}
				dirty={dirty}
				saving={saving}
				onBack={onClose}
				onThemeChange={setActiveTheme}
				onSave={handleSave}
				onRename={(n: string) => { setPage({ ...page, name: n }); setDirty(true); }}
				onSaveTemplate={saveCurrentAsTemplate}
				onRunAll={handleRunAll}
				onRunSelected={handleRunSelected}
				onAiGenerate={() => setShowAiDialog((v) => !v)}
			/>

			{/* 主体三栏 */}
			<div className="flex min-h-0 flex-1">
				{/* 左栏：节点库 */}
				<NodeLibrary
					collapsed={leftCollapsed}
					onToggleCollapsed={() => setLeftCollapsed((v) => !v)}
					templates={templates}
					onDeleteTemplate={deleteTemplate}
				/>

				{/* 中栏：CanvasStrip + NodeGraph + 运行浮层 */}
				<div className="relative flex min-w-0 flex-1 flex-col">
					<CanvasStrip />
					<NodeGraph
						nodes={nodes}
						setNodes={setNodes}
						links={links}
						setLinks={setLinks}
						nodeResults={nodeResults}
					/>

					{/* 空态引导 —— 真空白画布，不再插手演示节点 */}
					{Object.keys(nodes).length === 0 && links.length === 0 ? (
						<div
							data-testid="canvas-empty-guide"
							className="pointer-events-none absolute inset-x-0 bottom-0 top-11 z-10 grid place-items-center px-6"
						>
							<div className="flex max-w-[360px] flex-col items-center gap-1.5 rounded-card border border-dashed border-border bg-surface-raised/85 px-6 py-5 text-center">
								<span className="icon-[lucide--boxes] size-5 text-faint" />
								<span className="text-[13px] font-medium text-surface-foreground">空白画布</span>
								<span className="text-[11px] leading-5 text-muted">
									从左侧节点库点击节点添加；连好线后点右上角「保存」。保存写入的就是你放的节点，页面不会再自带演示数据。
								</span>
							</div>
						</div>
					) : null}

					{/* 运行浮层（设计稿 frames/run.tsx 的 RunPanel + NodePreviewCard） */}
					{showRunPanel && runNodes.length > 0 ? (
						<RunPanel
							nodes={runNodes}
							running={running}
							x={560}
							y={420}
							onRunAll={handleRunAll}
							onRunSelected={handleRunSelected}
						/>
					) : null}

					{showPreview && selectedNodeInfo ? (
						<NodePreviewCard
							nodeLabel={(nodes[selectedNodeInfo.id]?.values?.title as string) ?? selectedNodeInfo.id}
							x={selectedNodeInfo.node.x}
							y={selectedNodeInfo.node.y + selectedNodeInfo.node.h + 12}
							onCopy={() => {
								const el = document.querySelector(`[data-node-id="${selectedNodeInfo.id}"]`) as HTMLElement | null;
								if (!el) return;
								el.scrollIntoView({ behavior: "smooth", block: "center" });
							}}
							onLocate={() => { setShowRunPanel(false); setShowPreview(false); }}
						/>
					) : null}

					{/* AI 生成节点对话框（设计稿 frames/ai-node.tsx 对齐） */}
					{showAiDialog ? (
						<AiGenerateDialog
							x={aiDialogPos.x}
							y={aiDialogPos.y}
							prompt="把当前节点上的折线图按周聚合，补去年同期虚线对比"
							rows={[
								{ field: "图表类型", value: "折线图 · 面积", from: "ai" },
								{ field: "聚合粒度", value: "按周（ISO 周）", from: "ai" },
								{ field: "对比", value: "去年同期 · 虚线", from: "ai" },
								{ field: "调色板", value: "科技（沿用）", from: "user" },
							]}
							resultName="line_gmv_weekly"
							paramCount={4}
							pendingCount={1}
							onClose={() => setShowAiDialog(false)}
							onRegenerate={() => {
								getUi()?.notify?.({ message: "AI 生成节点功能需要配置后端 AI 服务", variant: "info" });
							}}
							onInsert={() => {
								setShowAiDialog(false);
								getUi()?.notify?.({ message: "AI 生成节点功能需要配置后端 AI 服务", variant: "info" });
							}}
						/>
					) : null}
				</div>

				{/* 右栏：属性面板 */}
				<PropertyInspector
					page={page}
					theme={activeTheme}
					onThemeChange={setActiveTheme}
					selectedNode={selectedNodeInfo}
					onNodeUpdate={handleNodeUpdate}
					nodes={nodes}
					links={links}
					collapsed={rightCollapsed}
					onToggleCollapsed={() => setRightCollapsed((v) => !v)}
					connections={connections}
					nodeResults={nodeResults}
				/>
			</div>

			{/* 底栏状态栏 */}
			<EditorStatusBar dirty={dirty} nodeCount={Object.keys(nodes).length} linkCount={links.length} />
		</div>
	);
}
