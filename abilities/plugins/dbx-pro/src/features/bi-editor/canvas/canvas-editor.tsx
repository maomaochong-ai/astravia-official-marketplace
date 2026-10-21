/**
 * canvas-editor.tsx — BI 编辑器主容器。
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
import { getUi } from "../../../runtime-contract";
import type { BigscreenPage } from "../shared/hooks/use-bigscreen-pages";
import { useCanvasExecution } from "./hooks/use-canvas-execution";
import { useCanvasHistory } from "./hooks/use-canvas-history";
import { useDetectedTheme } from "../../../shared/hooks/use-detected-theme";
import { BigscreenToolbar } from "./components/editor-toolbar";
import { NodeLibrary } from "./components/node-library";
import { CanvasStrip, type GridStep } from "./components/canvas-strip";
import { NodeGraph, type Link, type NodeGraphApi, type NodePos } from "./components/node-graph";
import { PropertyInspector, type SelectedNodeInfo } from "./components/property-inspector";
import { EditorStatusBar, type RunSummary } from "./components/editor-status-bar";
import { RunPanel, type RunNode } from "./components/run-overlay";
import { AiGenerateDialog, TemplateSaveDialog, type ParamRow } from "./components/ai-node-panel";
import { DEFAULT_PALETTE_ID, paletteById, paletteStyle } from "../shared/canvas-palettes";
import { BoardPreview } from "./components/board-preview";

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

export function CanvasEditor({ pageId, onClose, onSaved, initialPreset }: {
	pageId: string;
	onClose: () => void;
	onSaved?: () => void;
	/** 可选：首次加载时如果 page.template 为空，用这个 preset 代替空画布（三条入口场景）。 */
	initialPreset?: { nodes: Record<string, NodePos>; links?: Link[] };
}): JSX.Element {
	const [page, setPage] = useState<BigscreenPage | null>(null);
	const [loading, setLoading] = useState(true);
	const [dirty, setDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const [activeTheme, setActiveTheme] = useState<"dark" | "default">("dark");
	const [templates, setTemplates] = useState<{ id: string; name: string; template: string; createTime: string }[]>([]);
	const [leftCollapsed, setLeftCollapsed] = useState(false);
	const [rightCollapsed, setRightCollapsed] = useState(true);

	// ── 侧边栏可拖拽 resize ──
	const [leftWidth, setLeftWidth] = useState(240);
	const [rightWidth, setRightWidth] = useState(280);
	const resizingRef = useRef<{ side: "left" | "right"; startX: number; startW: number } | null>(null);

	useEffect(() => {
		function onMove(e: PointerEvent) {
			const r = resizingRef.current;
			if (!r) return;
			const delta = e.clientX - r.startX;
			if (r.side === "left") {
				setLeftWidth(Math.max(160, Math.min(400, r.startW + delta)));
			} else {
				setRightWidth(Math.max(220, Math.min(480, r.startW - delta)));
			}
		}
		function onUp() { resizingRef.current = null; document.body.style.cursor = ""; }
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
	}, []);

	// 画布执行引擎
	const { nodeResults, connections, running: execRunning, runAll, getUpstreamData, refreshConnections } = useCanvasExecution();

	// 加载连接列表
	useEffect(() => { refreshConnections(); }, [refreshConnections]);

	// 画布状态 —— 初值与服务端还没返回时保持一致：空画布，不预置演示节点
	const [nodes, setNodes] = useState<Record<string, NodePos>>({});
	const [links, setLinks] = useState<Link[]>([]);

	// 图表节点的取数入口：拿不到自身结果时从上游数据源结果里取。
	const getUpstreamResult = useCallback(
		(id: string) => getUpstreamData(id, links, nodes),
		[getUpstreamData, links, nodes],
	);
	// 「已保存内容」指纹；挂载和刚加载完都不该是脏的
	const baselineRef = useRef<string>(serializeCanvas({}, []));

	// ── 画布视图状态（顶栏工具簇与画布头共享） ──
	const [paletteId, setPaletteId] = useState<string>(DEFAULT_PALETTE_ID);
	const [gridStep, setGridStep] = useState<GridStep>(8);
	const [guidesOn, setGuidesOn] = useState(true);
	const [canvasScale, setCanvasScale] = useState(1);
	const graphApiRef = useRef<NodeGraphApi | null>(null);

	// ── 运行汇总（底栏状态栏用） ──
	const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
	// 最近一次运行时的画布指纹；与当前指纹不同即表示结果已过期
	const [runFingerprint, setRunFingerprint] = useState<string | null>(null);

	// 画布内容的稳定指纹：既做「有没有被改过」的判断，也做撤销历史的去重键
	const fingerprint = serializeCanvas(nodes, links);
	const runStale = runFingerprint !== null && runFingerprint !== fingerprint;
	const palette = paletteById(paletteId);

	// 撤销/重做：快照栈以「空闲提交」为单位，一次拖拽只落一个历史点
	const {
		canUndo,
		canRedo,
		undo: undoCanvas,
		redo: redoCanvas,
		reset: resetHistory,
	} = useCanvasHistory({
		snapshot: { nodes, links } satisfies CanvasTemplate,
		fingerprint,
		onApply: (snap: CanvasTemplate) => {
			setNodes(snap.nodes);
			setLinks(snap.links);
		},
	});

	// 平移也会回抛 viewport：倍率没变就把原值还回去，React 会跳过重渲染
	const handleViewportChange = useCallback((v: { scale: number; tx: number; ty: number }) => {
		setCanvasScale((prev) => (prev === v.scale ? prev : v.scale));
	}, []);

	// ── 运行状态 ──
	const [runNodes, setRunNodes] = useState<RunNode[]>([]);
	const [running, setRunning] = useState(false);
	const [showRunPanel, setShowRunPanel] = useState(false);
	const [showBoardPreview, setShowBoardPreview] = useState(false);

	// ── AI 生成节点状态 ──
	const [showAiDialog, setShowAiDialog] = useState(false);
	const [aiDialogPos] = useState({ x: 240, y: 120 });
	const [aiResult, setAiResult] = useState<{
		prompt: string; rows: ParamRow[]; resultName: string; paramCount: number; pendingCount: number; kindHint?: string;
	} | null>(null);
	const [aiLoading, setAiLoading] = useState(false);

	// ── 模板保存 Dialog ──
	const [showSaveDialog, setShowSaveDialog] = useState(false);
	const [savingTemplate, setSavingTemplate] = useState(false);

	/** 调 engine /drag/ai/generate 真实端点（宿主 AI 未暴露时 engine mock） */
	const fetchAiResult = useCallback(async (prompt: string) => {
		setAiLoading(true);
		try {
			const r = await engineRequest<{
				prompt: string; rows: ParamRow[]; resultName: string; paramCount: number; pendingCount: number; kindHint?: string;
			}>("/drag/ai/generate", { prompt, canvasContext: { nodes: Object.keys(nodes).length } }, { method: "POST" });
			setAiResult(r ?? { prompt, rows: [], resultName: "—", paramCount: 0, pendingCount: 0 });
		} catch (e) {
			getUi()?.notify?.({ message: `AI 生成失败: ${(e as Error).message}`, variant: "error" });
		} finally {
			setAiLoading(false);
		}
	}, [nodes, getUi]);

	// ── 模板库 ──
	function loadTemplates() {
		engineRequest<{ id: string; name: string; template: string; createTime: string }[]>("/drag/template/list", undefined, { method: "GET" })
			.then((list) => setTemplates(list ?? []))
			.catch(() => { /* 静默 */ });
	}
	function saveCurrentAsTemplate() {
		// 只有画布有内容才允许保存空模板（空模板没意义）
		if (Object.keys(nodes).length === 0 && links.length === 0) {
			getUi()?.notify?.({ message: "画布为空，没什么可保存的", variant: "info" });
			return;
		}
		setShowSaveDialog(true);
	}
	async function confirmSaveTemplate(name: string) {
		if (savingTemplate) return;
		setSavingTemplate(true);
		try {
			const tpl = serializeCanvas(nodes, links);
			await engineRequest<{ id: string; name: string; template: string; createTime: string }>(
				"/drag/template/save",
				{ name, template: tpl },
				{ method: "POST" },
			);
			getUi()?.notify?.({ message: `已保存模板「${name}」`, variant: "success" });
			setShowSaveDialog(false);
			loadTemplates();
		} catch (e) {
			getUi()?.notify?.({ message: `保存模板失败: ${(e as Error).message}`, variant: "error" });
		} finally {
			setSavingTemplate(false);
		}
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
				const parsed = parseTemplate(p?.template ?? "");
				// 空模板 + 有 initialPreset → 用 preset（三条入口场景）
				const hasAnyNodes = Object.keys(parsed.nodes).length > 0 || parsed.links.length > 0;
				const tpl = (!hasAnyNodes && initialPreset)
					? { nodes: initialPreset.nodes, links: initialPreset.links ?? [] }
					: parsed;
				baselineRef.current = serializeCanvas(tpl.nodes, tpl.links);
				setNodes(tpl.nodes);
				setLinks(tpl.links);
				// 换页等于换画布：历史基线跟着重置，上一页的运行结果也不再适用
				resetHistory({ nodes: tpl.nodes, links: tpl.links }, baselineRef.current);
				setRunSummary(null);
				setRunFingerprint(null);
			})
			.catch((e) => { getUi()?.notify?.({ message: `加载页面失败: ${(e as Error).message}`, variant: "error" }); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [pageId, initialPreset]);

	useEffect(() => {
		setDirty(fingerprint !== baselineRef.current);
	}, [fingerprint]);

	const selectedNodeInfo: SelectedNodeInfo | null = (() => {
		for (const [id, n] of Object.entries(nodes)) {
			if (n.selected) return { id, node: n };
		}
		return null;
	})();

	// 选中节点即展开属性面板：选中的意图就是配置它，收起态下不展开等于无从配置。
	// 只在选中的节点发生变化时展开，用户手动收起后不会被反复弹开。
	const selectedId = selectedNodeInfo?.id ?? null;
	const lastAutoExpandedRef = useRef<string | null>(null);
	useEffect(() => {
		if (selectedId && selectedId !== lastAutoExpandedRef.current) setRightCollapsed(false);
		lastAutoExpandedRef.current = selectedId;
	}, [selectedId]);

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
			getUi()?.notify?.({ message: `保存失败: ${(e as Error).message}`, variant: "error" });
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

		// 标记所有节点为运行中
		setRunNodes(initial.map((rn) => ({ ...rn, status: "running" })));

		// 执行全部节点
		const outcome = await runAll(nodes, links);

		// 根据执行结果更新状态
		setRunNodes(initial.map((rn) => {
			const result = outcome.results[rn.id];
			if (result?.error) {
				return { ...rn, status: "error", note: result.error.slice(0, 30) };
			}
			if (result) {
				return { ...rn, status: "done", duration: result.durationMs, note: `${result.rowCount} 行` };
			}
			// 停用节点在「运行全部」里被跳过：保持等待态并注明原因，不谎报「无数据」
			if (nodes[rn.id]?.muted) {
				return { ...rn, status: "wait", note: "已停用" };
			}
			// 非数据源节点：检查是否有上游数据
			const upstream = getUpstreamData(rn.id, links, nodes);
			if (upstream) {
				return { ...rn, status: "done", note: `${upstream.rowCount} 行（上游）` };
			}
			return { ...rn, status: "done", note: "无数据" };
		}));

		setRunning(false);
		if (outcome.skippedMuted > 0) {
			getUi()?.notify?.({ message: `已跳过 ${outcome.skippedMuted} 个停用节点`, variant: "info" });
		}
		setRunSummary({
			at: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
			durationMs: outcome.durationMs,
			nodeCount: outcome.nodeCount,
		});
		setRunFingerprint(fingerprint);

		// 运行完后若有成功节点，自动弹出可预览看板
		const anyDone = entries.some(([id]) => outcome.results[id] && !outcome.results[id].error);
		if (anyDone) {
			setShowBoardPreview(true);
		}
	}, [nodes, links, execRunning, runAll, getUpstreamData]);

	// ── 画布级全局键盘快捷键 ──
	// NodeGraph 内部已有：⌘A/⌘C/⌘V/⌘D/⌘M/Delete/G/Home/Esc
	// 此处补：⌘Z 撤销 / ⌘⇧Z + ⌘Y 重做 / ⌘F 搜索 / ⌘S 保存 / ⌘Enter 运行全部
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			const t = e.target as HTMLElement | null;
			const isEditing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

			const mod = e.ctrlKey || e.metaKey;
			const key = e.key.toLowerCase();

			if (mod && !e.shiftKey && key === "z") {
				if (isEditing) return; // 输入框里让浏览器自己 undo
				e.preventDefault();
				undoCanvas();
				return;
			}
			if (mod && (key === "y" || (e.shiftKey && key === "z"))) {
				if (isEditing) return;
				e.preventDefault();
				redoCanvas();
				return;
			}
			if (mod && key === "f") {
				e.preventDefault();
				const el = document.getElementById("node-library-search") as HTMLInputElement | null;
				if (el) { el.focus(); el.select(); }
				return;
			}
			if (mod && key === "s") {
				e.preventDefault();
				void handleSave();
				return;
			}
			if (mod && key === "enter") {
				if (isEditing) return;
				e.preventDefault();
				void handleRunAll();
				return;
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [undoCanvas, redoCanvas, handleSave, handleRunAll]);

	const handleRunNode = useCallback(async (targetId: string) => {
		const n = nodes[targetId];
		if (!n || execRunning) return;
		const initial: RunNode[] = [{
			id: targetId,
			label: (n.values?.title as string) ?? n.kind ?? targetId,
			status: "running",
			icon: "icon-[lucide--play]",
		}];
		setRunNodes(initial);
		setRunning(true);
		setShowRunPanel(true);

		// 执行选中的节点
		const kind = n.kind;
		if (kind === "source-sql" || kind === "source-table" || kind === "source-api") {
			// 数据源节点：只执行这个节点
			// 点名运行单个节点时不看「停用」——用户在节点上明确要求跑它
			const outcome = await runAll({ [targetId]: { ...n, muted: false } }, []);
			setRunSummary({
				at: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
				durationMs: outcome.durationMs,
				nodeCount: outcome.nodeCount,
			});
			setRunFingerprint(fingerprint);
			const result = outcome.results[targetId];
			if (result?.error) {
				setRunNodes([{ ...initial[0], status: "error", note: result.error.slice(0, 30) }]);
			} else if (result) {
				setRunNodes([{ ...initial[0], status: "done", duration: result.durationMs, note: `${result.rowCount} 行` }]);
			} else {
				setRunNodes([{ ...initial[0], status: "done", note: "无数据" }]);
			}
		} else {
			// 非数据源节点：从上游获取数据
			const upstream = getUpstreamData(targetId, links, nodes);
			if (upstream) {
				setRunNodes([{ ...initial[0], status: "done", duration: 0, note: `${upstream.rowCount} 行（上游）` }]);
			} else {
				setRunNodes([{ ...initial[0], status: "done", note: "无上游数据" }]);
			}
		}

		setRunning(false);
	}, [nodes, links, execRunning, runAll, getUpstreamData]);
	// 编辑器皮肤主题必须无条件调用（hook）：但若放在下方大屏/看板两处条件 return 之后，
	// 切换页面样式（board ↔ bigScreen）或 loading 翻转时 hook 数量漂移，触发 Rendered fewer hooks (#310)。
	const dbxTheme = useDetectedTheme();

	if (loading || !page) {
		return (
			<div className="flex h-full items-center justify-center bg-surface text-muted">
				加载中 {loading ? "…" : "(失败)"}
			</div>
		);
	}


	// dbxTheme 在组件顶部无条件解析（见上方 hook 位置的注释）；此处直接使用。
	// activeTheme 仍是页面内容明暗（深色大屏/浅色看板），但皮肤壳统一随宿主。

	return (
		<div className="dbx-root flex h-full min-h-0 flex-col" data-dbx-theme={dbxTheme} style={paletteStyle(palette)}>
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
				onRunSelected={() => { if (selectedNodeInfo) void handleRunNode(selectedNodeInfo.id); }}
				canUndo={canUndo}
				canRedo={canRedo}
				onUndo={undoCanvas}
				onRedo={redoCanvas}
				guidesOn={guidesOn}
				onGuidesToggle={() => setGuidesOn((v) => !v)}
				onArrange={(layout) => graphApiRef.current?.arrange(layout, "all")}
				onAlign={(mode) => graphApiRef.current?.alignSelection(mode)}
				onDistribute={(axis) => graphApiRef.current?.distributeSelection(axis)}
				onAiGenerate={() => {
					setAiResult(null);  // 清上次残留结果
					setShowAiDialog(true);
				}}
			/>

			{/* 主体三栏（可拖拽 resize）- 响应式布局 */}
			<div className="flex min-h-0 flex-1">
				{/* 左栏：节点库（宽度可拖拽，collapsed 时 w-10 折叠态）- 在小屏幕上可隐藏 */}
				<div style={{ width: leftCollapsed ? 40 : leftWidth }} className="hidden md:flex h-full shrink-0 overflow-hidden transition-[width] duration-150">
					<NodeLibrary
						collapsed={leftCollapsed}
						onToggleCollapsed={() => setLeftCollapsed((v) => !v)}
						onDeleteTemplate={deleteTemplate}
						onInsertItem={(key) => graphApiRef.current?.insertAtCenter(key)}
					/>
				</div>

				{/* 左 resize handle */}
				{!leftCollapsed ? (
					<div
						onPointerDown={(e) => {
							e.preventDefault();
							resizingRef.current = { side: "left", startX: e.clientX, startW: leftWidth };
							document.body.style.cursor = "col-resize";
						}}
						className="w-[3px] shrink-0 cursor-col-resize bg-border hover:bg-accent/60 active:bg-accent transition-colors"
						title="拖拽调整节点库宽度"
					/>
				) : null}

				{/* 中栏：CanvasStrip + NodeGraph + 运行浮层
				    flex-1 min-w-0 overflow-x-auto: 极窄窗口下 mid 栏横向滚动而非被挤压到负值 */}
				<div className="relative flex min-w-0 flex-1 flex-col overflow-x-auto">
					<CanvasStrip
						nodeCount={Object.keys(nodes).length}
						linkCount={links.length}
						palette={palette}
						onPaletteChange={setPaletteId}
						gridStep={gridStep}
						onGridStepChange={setGridStep}
						scale={canvasScale}
						onFitView={() => graphApiRef.current?.fitView("all")}
						onZoomIn={() => graphApiRef.current?.zoomBy(1)}
						onZoomOut={() => graphApiRef.current?.zoomBy(-1)}
						onZoomReset={() => graphApiRef.current?.zoomTo(1)}
					/>
					<NodeGraph
						nodes={nodes}
						setNodes={setNodes}
						links={links}
						setLinks={setLinks}
						nodeResults={nodeResults}
						getUpstreamResult={getUpstreamResult}
						gridStep={gridStep}
						onGridStepChange={setGridStep}
						guidesOn={guidesOn}
						onViewportChange={handleViewportChange}
						api={graphApiRef}
						onRunNode={(id) => { void handleRunNode(id); }}
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

					{/* 运行浮层：RunPanel 用 fixed 视口相对定位（右下角），不受 mid 栏 overflow-x-auto 裁剪 */}
					{showRunPanel && runNodes.length > 0 ? (
						<RunPanel
							nodes={runNodes}
							running={running}
							onRunAll={handleRunAll}
							onRunSelected={() => { if (selectedNodeInfo) void handleRunNode(selectedNodeInfo.id); }}
							onPreview={() => setShowBoardPreview(true)}
							onClose={() => setShowRunPanel(false)}
						/>
					) : null}

					{showBoardPreview ? (
						<BoardPreview
							nodes={nodes}
							nodeResults={nodeResults}
							caption={`${page.name} · 看板预览`}
							onClose={() => setShowBoardPreview(false)}
						/>
					) : null}

					{/* 节点预览收敛到右栏 PropertyInspector，不再单独渲染 NodePreviewCard 遮罩节点 */}

				{/* AI 生成节点对话框 — 真实调 engine /drag/ai/generate */}
					{showAiDialog ? (
						<AiGenerateDialog
							x={aiDialogPos.x}
							y={aiDialogPos.y}
							aiLoading={aiLoading}
							prompt={aiResult?.prompt}
							rows={aiResult?.rows ?? []}
							resultName={aiResult?.resultName}
							paramCount={aiResult?.paramCount}
							pendingCount={aiResult?.pendingCount}
							onClose={() => { setShowAiDialog(false); setAiResult(null); }}
							onGenerate={(p) => { void fetchAiResult(p); }}
							onRegenerate={() => {
								if (aiResult?.prompt) void fetchAiResult(aiResult.prompt);
							}}
							onInsert={() => {
								if (!aiResult) return;
								// 关掉对话框 → 创建图表节点（用 engine 返回的 kindHint）→ 执行数据源
								setShowAiDialog(false);
								const hintKind = aiResult.kindHint ? `chart-${aiResult.kindHint}` : null;
								const chartId = hintKind
									? Object.keys(nodes).find((k) => nodes[k]?.kind === hintKind)
									: (Object.keys(nodes) as (keyof typeof nodes & string)[]).find(
										(k) => (nodes[k as string]?.kind ?? "").startsWith("chart-"),
									);
								if (chartId) {
									setNodes((prev) => {
										const n = prev[chartId as string];
										if (!n) return prev;
										return {
											...prev,
											[chartId as string]: {
												...n,
												selected: true,
												values: { ...(n.values ?? {}), title: aiResult.resultName },
											},
										};
									});
									void handleRunAll();
									getUi()?.notify?.({ message: `已根据 AI 建议更新 ${aiResult.resultName}`, variant: "success" });
								} else {
									getUi()?.notify?.({ message: "画布上没有图表节点，AI 无法写入", variant: "info" });
								}
							}}
						/>
					) : null}

					{/* 模板保存 Dialog — 替换原先的 notify 占位 */}
					{showSaveDialog ? (
						<TemplateSaveDialog
							x={aiDialogPos.x}
							y={aiDialogPos.y}
							defaultName={page?.name ?? ""}
							saving={savingTemplate}
							onClose={() => setShowSaveDialog(false)}
							onConfirm={(name) => { void confirmSaveTemplate(name); }}
						/>
					) : null}
				</div>

				{/* 右 resize handle */}
				{!rightCollapsed ? (
					<div
						onPointerDown={(e) => {
							e.preventDefault();
							resizingRef.current = { side: "right", startX: e.clientX, startW: rightWidth };
							document.body.style.cursor = "col-resize";
						}}
						className="w-[3px] shrink-0 cursor-col-resize bg-border hover:bg-accent/60 active:bg-accent transition-colors"
						title="拖拽调整属性面板宽度"
					/>
				) : null}

				{/* 右栏：属性面板（宽度可拖拽）- 在小屏幕上可隐藏 */}
				<div style={{ width: rightCollapsed ? 40 : rightWidth }} className="hidden lg:flex h-full shrink-0 overflow-hidden transition-[width] duration-150">
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
			</div>

			{/* 底栏状态栏 */}
			<EditorStatusBar
				dirty={dirty}
				nodeCount={Object.keys(nodes).length}
				linkCount={links.length}
				run={runSummary}
				running={running}
				stale={runStale}
			/>
		</div>
	);
}
