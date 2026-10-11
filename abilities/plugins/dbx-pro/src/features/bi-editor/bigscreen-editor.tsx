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
import { PropertyInspector } from "./components/property-inspector";

export function BigscreenEditor({ pageId, onClose }: { pageId: string; onClose: () => void }): JSX.Element {
	const [page, setPage] = useState<BigscreenPage | null>(null);
	const [loading, setLoading] = useState(true);
	const [dirty, setDirty] = useState(false);
	const [activeTheme, setActiveTheme] = useState<"dark" | "default">("dark");

	useEffect(() => {
		let cancelled = false;
		engineRequest<BigscreenPage>(`/drag/page/queryById?id=${encodeURIComponent(pageId)}`, undefined, { method: "GET" })
			.then((p) => {
				if (cancelled) return;
				setPage(p);
				setActiveTheme((p?.theme as "dark" | "default") ?? "dark");
			})
			.catch((e) => { console.error("加载页面失败", e); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [pageId]);

	async function handleSave() {
		if (!page) return;
		// Phase C1: 只保存名字/主题等 meta，template 空
		await engineRequest<{ updateCount: number }>("/drag/page/edit", {
			id: page.id,
			name: page.name,
			type: "0",
			theme: activeTheme,
			style: page.style,
			backgroundImage: page.backgroundImage,
			designType: page.designType,
			protectionCode: "",
			template: JSON.stringify([]), // Phase C2 填充真实组件数组
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
			/>

			{/* 主体三栏 */}
			<div className="flex min-h-0 flex-1">
				{/* 左栏：节点库 */}
				<NodeLibrary />

				{/* 中栏：画布 + 状态栏 */}
				<div className="flex min-w-0 flex-1 flex-col">
					<CanvasPage theme={activeTheme} />
					{/* 底栏状态栏 */}
					<div className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-surface-raised px-3 text-[11px] text-muted">
						<span className="font-mono text-faint">{page.id.slice(0, 8)}</span>
						<span>·</span>
						<span>{page.style === "bigScreen" ? "大屏" : "看板"}</span>
						<span className="ml-auto font-mono tabular-nums text-faint">
							{dirty ? "● 未保存" : "✓ 已同步"}
						</span>
					</div>
				</div>

				{/* 右栏：属性面板 */}
				<PropertyInspector page={page} theme={activeTheme} onThemeChange={setActiveTheme} />
			</div>
		</div>
	);
}
