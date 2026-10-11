/**
 * dashboard-view.tsx — 看板运行产物预览态（设计稿 dashboard.tsx 对齐）。
 *
 * 与编辑态共用 CanvasTiles（preview=true → 去掉选中框/控制点），
 * 顶栏换成看的人需要的东西：这是哪一页、什么时候跑的、要不要重跑。
 *
 * 从 workbench 点缩略图进来时先停在这里（预览），再点"编辑"才进 NodeGraph。
 */

import { type JSX } from "react";
import type { BigscreenPage } from "./hooks/use-bigscreen-pages";
import { CanvasTiles } from "./components/canvas-tiles";
import { Icon } from "./components/ui/icon";
import { Chip } from "./components/ui/chip";
import { IconButton } from "./components/ui/icon-button";

const PAGES = [
	{ name: "概览", active: true },
	{ name: "渠道明细", active: false },
	{ name: "城市分布", active: false },
];

export function DashboardView({ page, onBack, onEdit }: {
	page: BigscreenPage; onBack: () => void; onEdit?: () => void;
}): JSX.Element {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			{/* 顶栏 */}
			<header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-6">
				<button type="button" onClick={onBack}
					className="flex h-7 items-center gap-1 rounded-control px-2 text-[12px] text-muted hover:border-border hover:bg-surface hover:text-surface-foreground"
					title="返回工作台">
					← 返回
				</button>
				<span className="h-5 w-px shrink-0 bg-border" />
				<span className="truncate text-[15px] font-semibold text-surface-foreground">{page.name}</span>
				<Chip tone="accent">产物</Chip>
				<span className="font-mono text-[11px] tabular-nums whitespace-nowrap text-faint">
					运行中 · 本页 · 近实时
				</span>

				<div className="ml-auto flex shrink-0 items-center gap-2">
					<div className="flex shrink-0 items-center gap-1">
						{PAGES.map((p) => (
							<span key={p.name}
								className={`flex h-7 shrink-0 items-center rounded-control border px-2.5 text-[12px] whitespace-nowrap ${
									p.active ? "border-border bg-surface font-medium text-surface-foreground" : "border-transparent text-muted"
								}`}>
								{p.name}
							</span>
						))}
					</div>
					<span className="h-5 w-px shrink-0 bg-border" />
					<IconButton size="sm" icon="icon-[lucide--refresh-cw]" title="重新运行" />
					{onEdit ? (
						<button type="button" onClick={onEdit}
							className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-[12px] text-muted hover:border-border-strong hover:text-surface-foreground">
							<Icon name="icon-[lucide--settings]" className="size-3.5" />编辑节点
						</button>
					) : null}
				</div>
			</header>

			{/* 预览画布 */}
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background p-6">
				<div className="relative min-h-0 w-full flex-1 rounded-card border border-border-strong bg-surface">
					<div className="relative grid h-full grid-cols-12 grid-rows-[80px_248px_216px_1fr] gap-3 p-4">
						<CanvasTiles preview />
					</div>
				</div>
			</div>
		</div>
	);
}
