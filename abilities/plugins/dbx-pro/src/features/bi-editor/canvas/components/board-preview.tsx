/**
 * board-preview.tsx — 「看板预览」全屏浮层。
 *
 * 运行全部节点后，把所有图表 / 明细表节点按真实数据渲染成一整块可滚动看板，
 * 让用户在不退出编辑器的情况下整体预览各图表的效果（对应「运行所有 → 自动生成可预览看板」）。
 * 数据来自 nodeResults，复用语义层 resolveNodeChartData + buildChartOption。
 */
import { type JSX } from "react";
import { Icon } from "../../shared/components/ui/icon";
import { EChart } from "../../shared/components/echart";
import { buildChartTile } from "../lib/chart-tile";
import type { NodeResult } from "../hooks/use-canvas-execution";
import type { NodePos } from "./node-graph";

export function BoardPreview({
	nodes, nodeResults, onClose,
	caption,
}: {
	nodes: Record<string, NodePos>;
	nodeResults: Record<string, NodeResult>;
	onClose: () => void;
	caption?: string;
}): JSX.Element {
	const tiles = Object.entries(nodes)
		.map(([id, node]) => ({ id, node }))
		.filter(({ node }) => node.kind?.startsWith("chart") || node.kind === "output-table")
		.map(({ id, node }) => {
			const result = nodeResults[id] ?? null;
			const values = node.values ?? {};
			const { data, option } = buildChartTile(node.kind ?? "", values, result, null);
			return { id, node, data, option };
		});

	return (
		<div
			className="fixed inset-0 z-50 flex flex-col bg-black/60 p-6"
			onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
			onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
			tabIndex={0}
		>
			<div className="flex h-11 shrink-0 items-center gap-2">
				<span className="icon-[lucide--layout-dashboard] size-4 text-accent" />
				<span className="text-[13px] font-medium text-surface-foreground">{caption ?? "看板预览"}</span>
				<span className="font-mono text-[10px] text-faint">共 {tiles.length} 个图表 / 明细节点</span>
				<button
					type="button"
					onClick={onClose}
					className="ml-auto grid size-7 place-items-center rounded-control text-muted hover:bg-surface-raised hover:text-surface-foreground"
					title="关闭"
				>
					<Icon name="icon-[lucide--x]" className="size-4" />
				</button>
			</div>
			<div className="dbx-scroll mt-3 min-h-0 flex-1 overflow-auto rounded-card border border-border bg-surface p-4">
				{tiles.length === 0 ? (
					<div className="grid h-full place-items-center text-[12px] text-faint">
						暂无可用图表数据 —— 请先运行全部节点并确保图表已配置字段
					</div>
				) : (
					<div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
						{tiles.map((t) => (
							<div key={t.id} className="flex flex-col overflow-hidden rounded-card border border-border bg-surface-raised">
								<div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border bg-background px-2.5">
									<span className="icon-[lucide--chart-line] size-3 text-accent" />
									<span className="min-w-0 flex-1 truncate text-[11px] text-surface-foreground">
										{(t.node.values?.title as string) || t.node.kind || t.id}
									</span>
									<span className="shrink-0 font-mono text-[9px] text-faint">
										{t.data.rowCount} 行
									</span>
								</div>
								<div className="h-[220px] p-2">
									{t.option ? (
										<EChart option={t.option} className="h-full w-full" />
									) : t.data.frame ? (
										<div className="flex h-full flex-col items-center justify-center gap-1">
											<span className="font-mono text-[20px] font-bold text-surface-foreground">
												{String(Object.values(t.data.frame.series[0]?.data ?? [])[0] ?? t.data.frame.total ?? "")}
											</span>
											<span className="text-[10px] text-muted">{t.data.frame.measureLabel || "—"}</span>
										</div>
									) : (
										<div className="grid h-full place-items-center text-[11px] text-faint">无数据</div>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}