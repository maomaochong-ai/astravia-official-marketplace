/**
 * Canvas — ADR-0005 §5 画布容器
 *
 * 从 SQL 执行结果集自动推断布局 + 渲染 Canvas（Dashboard / BigScreen）。
 *
 * 使用方式：
 *   <Canvas columns={cols} rows={rows} connectionName="pg-dev" sql="..." intent="auto" />
 *
 * 内部流程：
 *   1. inferLayout(columns, rows, intent) → LayoutSpec
 *   2. 渲染 12 列 CSS Grid 容器（按 intent 选 dashboard / bigscreen token）
 *   3. 逐个 FrameWidget 渲染 chart（按 col/row/colSpan 定位）
 */

import { useCallback, useEffect, useState, type JSX } from "react";
import type { LayoutSpec, VizIntent } from "./types";
import { inferLayout } from "./infer-layout";
import { FrameWidget } from "./FrameWidget";

export interface CanvasProps {
	columns: string[];
	rows: Record<string, unknown>[];
	connectionName?: string;
	sql?: string;
	/** auto = 启发式判断 */
	intent?: VizIntent | "auto";
}

export function Canvas({ columns, rows, intent: initialIntent = "auto" }: CanvasProps): JSX.Element {
	const [currentIntent, setCurrentIntent] = useState<VizIntent>(() =>
		initialIntent === "auto" ? inferDefaultIntent(columns, rows) : initialIntent,
	);
	const [spec, setSpec] = useState<LayoutSpec | null>(null);
	const [loading, setLoading] = useState(true);

	// 首次 / intent 切换时重新生成布局
	const regenerate = useCallback(() => {
		setLoading(true);
		// 模拟 AI 流水线异步：100ms 后产出 spec，给 skeleton 展示机会
		const t = setTimeout(() => {
			const layout = inferLayout(
				{ columns, rows },
				{ intent: currentIntent },
			);
			setSpec(layout);
			setLoading(false);
		}, 100);
		return () => clearTimeout(t);
	}, [columns, rows, currentIntent]);

	useEffect(() => {
		void regenerate();
	}, [regenerate]);

	const classRoot = currentIntent === "dashboard" ? "viz-root viz-theme-dashboard" : "viz-root viz-theme-bigscreen";
	const classGrid = currentIntent === "dashboard" ? "viz-grid-dashboard" : "viz-grid-bigscreen";

	return (
		<div className={classRoot}>
			<CanvasToolbar
				intent={currentIntent}
				onToggleIntent={() => {
					setCurrentIntent((v) => (v === "dashboard" ? "bigscreen" : "dashboard"));
				}}
				onRegenerate={regenerate}
				widgetCount={spec?.widgets.length ?? 0}
				loading={loading}
			/>
			<div className={classGrid}>
				{spec?.widgets.map((w) => (
					<FrameWidget
						key={w.id}
						spec={w}
						intent={currentIntent}
						data={rows}
						columns={columns}
					/>
				))}
				{loading && <SkeletonHint intent={currentIntent} />}
			</div>
		</div>
	);
}

function CanvasToolbar({
	intent,
	onToggleIntent,
	onRegenerate,
	widgetCount,
	loading,
}: {
	intent: VizIntent;
	onToggleIntent: () => void;
	onRegenerate: () => void;
	widgetCount: number;
	loading: boolean;
}): JSX.Element {
	return (
		<div className="viz-canvas-toolbar">
			<span className="viz-canvas-title">
				{intent === "dashboard" ? "📊 看板" : "🖥 大屏"}
				{loading ? " 生成中…" : ` · ${widgetCount} 组件`}
			</span>
			<div className="viz-canvas-actions">
				<button type="button" onClick={onRegenerate} className="viz-btn viz-btn--ghost" title="重新生成">
					↻ 重新生成
				</button>
				<button type="button" onClick={onToggleIntent} className="viz-btn viz-btn--primary" title="切换形态">
					{intent === "dashboard" ? "→ 大屏模式" : "→ 看板模式"}
				</button>
			</div>
		</div>
	);
}

function SkeletonHint({ intent }: { intent: VizIntent }): JSX.Element {
	return (
		<div className={`viz-skeleton-hint viz-skeleton-hint--${intent}`}>
			<svg className="viz-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none">
				<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" />
			</svg>
			AI 正在分析数据语义、推断图表类型、打包栅格布局…
		</div>
	);
}

function inferDefaultIntent(columns: string[], rows: Record<string, unknown>[]): VizIntent {
	const rowCount = rows.length;
	const timeLike = columns.some((c) => /(date|time|dt|_at$|created|updated)/i.test(c));
	if (rowCount > 100 && timeLike) return "bigscreen";
	return "dashboard";
}
