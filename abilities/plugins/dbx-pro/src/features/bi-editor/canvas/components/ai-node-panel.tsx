/**
 * ai-node-panel.tsx — AI 生成节点浮动面板族。
 *
 * 三个组件（设计稿 frames/ai-node.tsx 对齐）：
 *   - AiGenerateDialog  一句话生成整套节点参数
 *   - ParamSuggest       AI 调整单个参数（从属性面板某一格旁边长出）
 *   - AiNodePanel        旧版大面板（保留兼容）
 */

import { type JSX } from "react";
import { Icon } from "../../shared/components/ui/icon";
import { Chip } from "../../shared/components/ui/chip";

export interface ParamRow { field: string; value: string; from: "ai" | "user" | "dataset" }

const FROM_CHIP_LABEL: Record<ParamRow["from"], string> = {
	ai: "AI 推断", user: "手动", dataset: "取自数据集",
};

/** AI 生成节点对话框 — 设计稿 AiGenerateDialog 对齐。 */
export function AiGenerateDialog({
	x, y, prompt, rows = [], resultName, paramCount, pendingCount,
	onRegenerate, onInsert, onClose,
}: {
	x: number; y: number;
	prompt?: string;
	rows?: ParamRow[];
	resultName?: string;
	paramCount?: number;
	pendingCount?: number;
	onRegenerate?: () => void;
	onInsert?: () => void;
	onClose?: () => void;
}): JSX.Element {
	return (
		<div
			className="absolute z-30 w-[336px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]"
			style={{ left: x, top: y }}
		>
			<header className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
				<Icon name="icon-[lucide--wand-sparkles]" className="size-3.5 shrink-0 text-ai" />
				<span className="text-[11px] font-medium text-surface-foreground">AI 生成节点</span>
				<div className="ml-auto flex shrink-0 items-center gap-1.5">
					<Chip tone="ai">宿主模型</Chip>
					{onClose ? (
						<button type="button" aria-label="关闭" onClick={onClose}
							className="grid size-5 place-items-center rounded-[2px] text-faint hover:bg-border hover:text-surface-foreground">
							<Icon name="icon-[lucide--x]" className="size-3" />
						</button>
					) : null}
				</div>
			</header>

			{/* 用户描述 */}
			{prompt ? (
				<div className="flex items-start gap-2 border-b border-border px-3 py-2.5">
					<span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft">
						<Icon name="icon-[lucide--bot]" className="size-3 text-accent" />
					</span>
					<p className="text-[11px] leading-4 text-surface-foreground">{prompt}</p>
				</div>
			) : null}

			{/* 生成结果 */}
			<div className="px-3 py-2">
				<div className="flex h-6 items-center gap-2">
					<span className="text-[10px] text-faint">生成结果</span>
					<span className="font-mono text-[10px] text-surface-foreground">{resultName ?? "—"}</span>
					<span className="ml-auto text-[10px] text-muted">
						{paramCount != null ? `${paramCount} 项参数` : ""}
						{pendingCount != null && pendingCount > 0 ? ` · ${pendingCount} 项待确认` : ""}
					</span>
				</div>
				{rows.length === 0 ? (
					<div className="py-3 text-center text-[10px] text-faint">AI 正在生成参数…</div>
				) : rows.map((r) => (
					<div key={r.field} className="flex h-6 items-center gap-2">
						<span className="w-[52px] shrink-0 truncate text-[10px] text-muted">{r.field}</span>
						<span className="min-w-0 flex-1 truncate text-[10px] text-surface-foreground">{r.value}</span>
						<span
							className={`shrink-0 rounded-chip px-1.5 text-[9px] ${
								r.from === "ai" ? "bg-ai-soft text-ai" : "bg-neutral-muted text-muted"
							}`}
						>{FROM_CHIP_LABEL[r.from]}</span>
					</div>
				))}
			</div>

			{/* footer */}
			<footer className="flex h-11 shrink-0 items-center gap-2 border-t border-border bg-background px-3">
				<span className="flex h-6 items-center gap-1.5 rounded-chip bg-success-soft px-2 text-[10px] text-success">
					<span className="size-1.5 shrink-0 rounded-full bg-success" />
					未写入数据库
				</span>
				<div className="ml-auto flex shrink-0 items-center gap-2">
					{onRegenerate ? (
						<button type="button" onClick={onRegenerate}
							className="flex h-6 items-center rounded-control border border-transparent px-2 text-[10px] text-muted hover:border-border hover:text-surface-foreground">
							重新生成
						</button>
					) : null}
					{onInsert ? (
						<button type="button" onClick={onInsert}
							className="flex h-6 items-center gap-1 rounded-control bg-accent px-2 text-[10px] font-medium text-accent-foreground hover:opacity-90">
							<Icon name="icon-[lucide--plus]" className="size-3" />
							插入画布
						</button>
					) : null}
				</div>
			</footer>
		</div>
	);
}

/** AI 调整单个参数 — 从属性面板某一格旁边长出的小卡片。 */
export function ParamSuggest({
	x, y, field, before, after, rationale, alternatives = [],
	onApply, onDismiss,
}: {
	x: number; y: number;
	field: string;
	before: string;
	after: string;
	rationale?: string;
	alternatives?: string[];
	onApply?: () => void;
	onDismiss?: () => void;
}): JSX.Element {
	return (
		<div
			className="absolute z-30 w-[264px] overflow-hidden rounded-card border border-ai bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]"
			style={{ left: x, top: y }}
		>
			<header className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-background px-2.5">
				<Icon name="icon-[lucide--wand-sparkles]" className="size-3.5 shrink-0 text-ai" />
				<span className="text-[11px] font-medium text-surface-foreground">AI 调整 · {field}</span>
			</header>

			<div className="px-2.5 py-2">
				<div className="text-[10px] text-faint">{field}</div>
				<div className="mt-1 flex h-6 items-center gap-2">
					<span className="text-[10px] text-muted line-through">{before}</span>
					<Icon name="icon-[lucide--arrow-right]" className="size-3 shrink-0 text-faint" />
					<span className="rounded-[4px] bg-ai-soft px-1.5 py-0.5 text-[10px] font-medium text-ai">{after}</span>
				</div>
				{rationale ? <p className="mt-2 text-[10px] leading-4 text-muted">{rationale}</p> : null}
				{alternatives.length > 0 ? (
					<div className="mt-2 flex flex-wrap gap-1">
						{alternatives.map((c) => (
							<span key={c}
								className="flex h-6 items-center rounded-chip border border-border bg-surface px-2 text-[10px] text-surface-foreground">
								{c}
							</span>
						))}
					</div>
				) : null}
			</div>

			<footer className="flex h-10 shrink-0 items-center gap-2 border-t border-border bg-background px-2.5">
				<span className="text-[10px] text-faint">只改这一格</span>
				<div className="ml-auto flex shrink-0 items-center gap-2">
					{onDismiss ? (
						<button type="button" onClick={onDismiss}
							className="flex h-6 items-center rounded-control border border-transparent px-2 text-[10px] text-muted hover:border-border hover:text-surface-foreground">
							忽略
						</button>
					) : null}
					{onApply ? (
						<button type="button" onClick={onApply}
							className="flex h-6 items-center gap-1 rounded-control bg-accent px-2 text-[10px] font-medium text-accent-foreground hover:opacity-90">
							<Icon name="icon-[lucide--check]" className="size-3" />
							应用
						</button>
					) : null}
				</div>
			</footer>
		</div>
	);
}

/** 旧版大面板 — 保留兼容，后续可删。 */
export function AiNodePanel({ x, y, w, h }: { x: number; y: number; w: number; h: number }): JSX.Element {
	return (
		<div className="absolute z-30 flex flex-col rounded-card border border-border bg-surface-raised shadow"
			style={{ left: x, top: y, width: w, height: h }}
		>
			<header className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
				<Icon name="icon-[lucide--wand-sparkles]" className="size-3.5 shrink-0 text-ai" />
				<span className="text-[12px] font-medium text-surface-foreground">AI 生成节点</span>
				<Chip tone="ai">写 SQL</Chip>
			</header>
			<div className="flex min-h-0 flex-1 flex-col gap-2.5 px-3 py-2.5">
				<div className="flex h-[34px] shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2">
					<Icon name="icon-[lucide--database]" className="size-3.5 shrink-0 text-accent" />
					<span className="min-w-0 flex-1 truncate text-[11px] text-surface-foreground">插件工作台 · MySQL</span>
					<span className="shrink-0 font-mono text-[10px] text-faint">orders_daily</span>
				</div>
				<div className="shrink-0 rounded-control bg-neutral-muted px-2 py-1 text-[11px] text-surface-foreground">
					近 14 天 GMV 折线图，渠道用环形图
				</div>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-control border border-border bg-surface p-1.5">
					<div className="font-mono text-[10px] leading-[13px] text-muted">
						<div><span className="text-accent">select</span> d, sum(gmv) as gmv</div>
						<div><span className="text-accent">from</span> public.orders</div>
						<div><span className="text-accent">where</span> d &gt;= current_date - 14</div>
						<div><span className="text-accent">group by</span> d order by d</div>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					<button type="button" className="flex h-7 items-center gap-1.5 rounded-control bg-accent-soft px-2.5 text-[11px] font-medium text-accent"
						onClick={() => alert("AI 生成节点（占位：宿主端点未暴露）")}>
						<Icon name="icon-[lucide--wand-sparkles]" className="size-3" />生成节点
					</button>
					<button type="button" className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-[11px] text-muted"
						onClick={() => alert("插入画布（占位：宿主端点未暴露）")}>
						<Icon name="icon-[lucide--plus]" className="size-3" />插入画布
					</button>
				</div>
			</div>
		</div>
	);
}
