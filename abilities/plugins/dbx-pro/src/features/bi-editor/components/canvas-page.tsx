/**
 * canvas-page.tsx — BI 编辑器中间画布（Phase C1 mock 骨架）。
 *
 * 按设计稿 CanvasPage.tsx 布局：
 *   ┌─ PageStrip（标签条）
 *   ├─────────────────────┤
 *   │                     │
 *   │   画布 + 辅助线     │  ← Phase C2 接入 CanvasTiles / NodeGraph
 *   │                     │
 *   └─────────────────────┘
 *
 * Phase C1 只渲染容器 + 网格辅助线 + 空白页签。
 */

import { type JSX } from "react";

export function CanvasPage({ theme }: { theme: "dark" | "default" }): JSX.Element {
	const isDark = theme === "dark";
	const pageBg = isDark ? "bg-[#0b1424]" : "bg-[#f8fafc]";
	const gridColor = isDark ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.06)";
	const ruleColor = isDark ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.15)";

	return (
		<div className="flex min-w-0 flex-1 flex-col bg-surface">
			{/* Page strip */}
			<div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-surface-raised px-2">
				<div className="flex h-7 items-center gap-1 rounded-control border border-border bg-surface px-2 text-[12px] text-surface-foreground">
					<span>📄</span>
					<span>页面 1</span>
				</div>
				<button
					type="button"
					className="flex h-7 w-7 items-center justify-center rounded-control border border-dashed border-border text-muted hover:border-border-strong hover:text-surface-foreground"
					title="新建页面"
				>+</button>

				<div className="ml-auto flex items-center gap-3 text-[11px] text-faint">
					<span>1920 × 1080</span>
					<span>100%</span>
				</div>
			</div>

			{/* 画布主体 — 可滚动容器 */}
			<div className="dbx-scroll min-h-0 flex-1 overflow-auto bg-background">
				<div className="flex min-h-full items-start justify-center p-6">
					{/* 画布容器（固定比例 + 居中 + 阴影）*/}
					<div
						className={`relative rounded-card border border-border shadow-lg ${pageBg}`}
						style={{ width: "min(100%, 1200px)", aspectRatio: "16/9" }}
					>
						{/* 网格辅助线（背景层） */}
						<div
							className="pointer-events-none absolute inset-0"
							style={{
								backgroundImage:
									`linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
								backgroundSize: "20px 20px",
							}}
						/>
						{/* 12 列辅助线（淡色）*/}
						<div className="pointer-events-none absolute inset-0 flex">
							{Array.from({ length: 12 }).map((_, i) => (
								<div key={i} className="flex-1 border-l" style={{ borderColor: ruleColor }}>
									{i === 11 && <div className="h-full border-r" style={{ borderColor: ruleColor }} />}
								</div>
							))}
						</div>

						{/* 空白占位提示 */}
						<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted">
							<span className={`font-mono text-[40px] ${isDark ? "text-accent/30" : "text-accent/40"}`}>◈</span>
							<span className="text-[13px]">从左侧节点库拖入组件</span>
							<span className="text-[11px] text-faint">或按 ⚡ AI 生成节点</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
