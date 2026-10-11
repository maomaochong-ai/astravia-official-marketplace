/**
 * bigscreen-editor.tsx — BI 编辑器骨架（按设计稿 Editor.tsx 布局）。
 *
 * 布局：
 *   ┌─ Toolbar（返回/页面名/保存/运行/主题）
 *   ├─────────┬─────────────────┬─────────────┤
 *   │NodeLib. │  CanvasPage    │  Property   │
 *   │          │  (画布 mock)   │  Inspector  │
 *   ├─────────┴─────────────────┴─────────────┤
 *   │           StatusBar                       │
 *   └───────────────────────────────────────────┘
 *
 * Phase C1 交付骨架 + mock 画布。
 * Phase C2 接入 NodeGraph（真拖曳）+ ComponentPalette（真节点渲染）。
 */

import { useEffect, useState, type JSX } from "react";
import { engineRequest } from "../../shared/services/engine-client";
import type { BigscreenPage } from "./hooks/use-bigscreen-pages";
import { BigscreenToolbar } from "./components/editor-toolbar";
import { NodeLibrary } from "./components/node-library";
import { CanvasPage } from "./components/canvas-page";
import { PropertyInspector, type SelectedNodeInfo } from "./components/property-inspector";
import { EditorStatusBar } from "./components/editor-status-bar";
import { INITIAL_LINKS, INITIAL_NODES, type Link, type NodePos } from "./components/node-graph";

/** template JSON schema（持久化）。 */
interface CanvasTemplate {
	nodes: Record<string, NodePos>;
	links: Link[];
}

function parseTemplate(raw: string | null | undefined): CanvasTemplate {
	if (!raw) return { nodes: INITIAL_NODES as Record<string, NodePos>, links: INITIAL_LINKS };
	try {
		const obj = JSON.parse(raw);
		if (obj && typeof obj === "object" && "nodes" in obj) {
			return obj as CanvasTemplate;
		}
		// 兼容旧格式（数组）——忽略
		return { nodes: INITIAL_NODES as Record<string, NodePos>, links: INITIAL_LINKS };
	} catch {
		return { nodes: INITIAL_NODES as Record<string, NodePos>, links: INITIAL_LINKS };
	}
}

export function BigscreenEditor({ pageId, onClose }: { pageId: string; onClose: () => void }): JSX.Element {
	const [page, setPage] = useState<BigscreenPage | null>(null);
	const [loading, setLoading] = useState(true);
	const [dirty, setDirty] = useState(false);
	const [activeTheme, setActiveTheme] = useState<"dark" | "default">("dark");
	const [templates, setTemplates] = useState<{ id: string; name: string; template: string; createTime: string }[]>([]);

	// ── 画布状态（从 template 反序列化 / 持久化目标） ──
	const [nodes, setNodes] = useState<Record<string, NodePos>>(() => INITIAL_NODES as Record<string, NodePos>);
	const [links, setLinks] = useState<Link[]>(() => INITIAL_LINKS);

	// ── 加载模板库 ──
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

	useEffect(() => {
		let cancelled = false;
		engineRequest<BigscreenPage>(`/drag/page/queryById?id=${encodeURIComponent(pageId)}`, undefined, { method: "GET" })
			.then((p) => {
				if (cancelled) return;
				setPage(p);
				setActiveTheme((p?.theme as "dark" | "default") ?? "dark");
				const tpl = parseTemplate(p?.template ?? "");
				setNodes(tpl.nodes);
				setLinks(tpl.links);
			})
			.catch((e) => { console.error("加载页面失败", e); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [pageId]);

	// 任何画布变动都标记 dirty
	useEffect(() => { setDirty(true); }, [nodes, links]);

	// ── 当前选中节点（供 PropertyInspector 消费） ──
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

	async function handleSave() {
		if (!page) return;
		const templateJson: CanvasTemplate = { nodes, links };
		await engineRequest<{ updateCount: number }>("/drag/page/edit", {
			id: page.id,
			name: page.name,
			type: "0",
			theme: activeTheme,
			style: page.style,
			backgroundImage: page.backgroundImage,
			designType: page.designType,
			protectionCode: "",
			template: JSON.stringify(templateJson),
			updateCount: page.updateCount,
		});
		setDirty(false);
	}

	if (loading || !page) {
		return (
			<div className="flex h-full items-center justify-center bg-surface text-muted">
				加载中 {loading ? "…" : "(失败)"}
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col bg-surface text-surface-foreground">
			{/* 顶栏 Toolbar */}
			<BigscreenToolbar
				pageName={page.name}
				theme={activeTheme}
				dirty={dirty}
				onBack={onClose}
				onThemeChange={setActiveTheme}
				onSave={handleSave}
				onRename={(n: string) => { setPage({ ...page, name: n }); setDirty(true); }}
				onSaveTemplate={saveCurrentAsTemplate}
			/>

			{/* 主体三栏 */}
			<div className="flex min-h-0 flex-1">
				{/* 左栏：节点库 + 我的模板 */}
				<NodeLibrary templates={templates} onDeleteTemplate={deleteTemplate} />

				{/* 中栏：画布 */}
				<div className="flex min-w-0 flex-1 flex-col">
					<CanvasPage
						theme={activeTheme}
						nodes={nodes}
						setNodes={setNodes}
						links={links}
						setLinks={setLinks}
					/>
				</div>

				{/* 右栏：属性面板 */}
				<PropertyInspector
					page={page}
					theme={activeTheme}
					onThemeChange={setActiveTheme}
					selectedNode={selectedNodeInfo}
					onNodeUpdate={handleNodeUpdate}
				/>
			</div>

			{/* 底栏状态栏（最外层）*/}
			<EditorStatusBar dirty={dirty} nodeCount={Object.keys(nodes).length} linkCount={links.length} />
		</div>
	);
}
