import Btn from "../Btn";
import Chip from "../Chip";
import Icon from "../Icon";
import { AreaChart } from "../Charts";

const GMV = [42, 48, 45, 55, 51, 61, 58, 66, 63, 72, 69, 78, 74, 83];

type State = "done" | "running" | "wait";

const RUN: { label: string; icon: string; state: State; t: string; note: string }[] = [
	{ label: "ods_orders", icon: "icon-[lucide--database]", state: "done", t: "0.2s", note: "12 486 行" },
	{ label: "ds_orders", icon: "icon-[lucide--scroll-text]", state: "done", t: "0.4s", note: "缓存命中" },
	{ label: "line_gmv_14d", icon: "icon-[lucide--chart-line]", state: "running", t: "0.6s", note: "取数中" },
	{ label: "donut_channel", icon: "icon-[lucide--chart-pie]", state: "wait", t: "—", note: "等上游" },
	{ label: "kpi_row", icon: "icon-[lucide--gauge]", state: "wait", t: "—", note: "等上游" },
	{ label: "看板产物 · 概览", icon: "icon-[lucide--layout-dashboard]", state: "wait", t: "—", note: "等上游" },
];

const STATE = {
	done: { icon: "icon-[lucide--circle-check]", cls: "text-success" },
	running: { icon: "icon-[lucide--loader]", cls: "text-accent animate-spin" },
	wait: { icon: "icon-[lucide--clock]", cls: "text-faint" },
} as const;

/**
 * 运行面板 —— 一次运行就是一张账。谁跑完了、谁在跑、谁还在等上游，各自花了多久，
 * 全写在同一列里。单节点运行和全部运行走的是同一套账，只是入账的行数不同。
 */
export function RunPanel({ x, y }: { x: number; y: number }) {
	return (
		<div
			className="absolute z-30 w-[296px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]"
			style={{ left: x, top: y }}
		>
			<header className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
				<Icon name="icon-[lucide--play]" className="size-3.5 shrink-0 text-accent" />
				<span className="text-[11px] font-medium text-surface-foreground">本次运行</span>
				<span className="ml-auto font-mono text-[10px] tabular-nums text-muted">3 / 6 · 1.2s</span>
			</header>

			<div className="px-2 py-1.5">
				{RUN.map((r) => (
					<div key={r.label} className="flex h-7 items-center gap-2 rounded-[4px] px-1.5">
						<Icon name={r.icon} className="size-3.5 shrink-0 text-muted" />
						<span className="min-w-0 flex-1 truncate text-[11px] text-surface-foreground">{r.label}</span>
						<span className="shrink-0 text-[10px] text-faint">{r.note}</span>
						<span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted">{r.t}</span>
						<Icon name={STATE[r.state].icon} className={`size-3.5 shrink-0 ${STATE[r.state].cls}`} />
					</div>
				))}
			</div>

			<footer className="flex h-11 shrink-0 items-center gap-2 border-t border-border bg-background px-2.5">
				<Btn size="sm" variant="ghost">
					仅运行选中
				</Btn>
				<span className="ml-auto font-mono text-[10px] text-faint">⌘R 全部</span>
				<Btn size="sm" variant="primary" icon="icon-[lucide--play]">
					运行全部
				</Btn>
			</footer>
		</div>
	);
}

/**
 * 节点预览 —— 图表组件节点跑完之后，产物先回到节点自己身上，不用等整张看板。
 * 卡片顶部写明它是谁、什么时候跑的、拿了几行；关掉它，画布上那个节点还在。
 */
export function NodePreviewCard({ x, y }: { x: number; y: number }) {
	return (
		<div
			className="absolute z-30 w-[272px] overflow-hidden rounded-card border border-accent bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]"
			style={{ left: x, top: y }}
		>
			<header className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-background px-2.5">
				<Icon name="icon-[lucide--chart-line]" className="size-3.5 shrink-0 text-series-2" />
				<span className="text-[11px] font-medium text-surface-foreground">预览 · line_gmv_14d</span>
				<span className="ml-auto shrink-0 font-mono text-[10px] text-faint">1.2s</span>
			</header>

			<div className="px-2.5 py-2">
				<AreaChart values={GMV} domain={[0, 90]} className="h-[92px] w-full" />
				<div className="mt-1.5 flex items-center gap-1.5">
					<Chip tone="accent">14 个点</Chip>
					<Chip mono>2026-10-11 22:40</Chip>
					<span className="ml-auto text-[10px] text-faint">不回写数据库</span>
				</div>
			</div>

			<footer className="flex h-10 shrink-0 items-center gap-2 border-t border-border bg-background px-2.5">
				<Btn size="xs" variant="ghost" icon="icon-[lucide--copy]">
					复制为图片
				</Btn>
				<Btn size="xs" variant="ghost" className="ml-auto">
					在产物里定位
				</Btn>
			</footer>
		</div>
	);
}
