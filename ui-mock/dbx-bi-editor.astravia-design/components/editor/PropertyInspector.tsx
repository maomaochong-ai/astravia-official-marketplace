import type { ReactNode } from "react";
import Icon from "../Icon";
import IconButton from "../IconButton";
import Switch from "../Switch";

/**
 * 右侧节点参数面板 —— 节点式的核心承诺之一：画布上每一个节点都能改。
 * 这里只显示当前选中的那一个（画布上那个折线图节点），三处读数必须和画布对得上：
 * 输入 = 上游结果集的 mono 名，输出 = 看板产物，画布坐标 = 选中框那条 216 × 222。
 */

const TABS = ["参数", "样式", "数据", "输出"];

const PREVIEW = [
	{ d: "10-08", gmv: "72.4 万", orders: "412" },
	{ d: "10-09", gmv: "69.1 万", orders: "398" },
	{ d: "10-10", gmv: "83.2 万", orders: "446" },
];

function Group({
	title,
	note,
	children,
}: {
	title: string;
	note?: string;
	children: ReactNode;
}) {
	return (
		<section className="flex flex-col gap-1.5">
			<div className="flex items-center gap-2">
				<span className="shrink-0 text-[11px] font-medium text-muted">{title}</span>
				{note ? <span className="ml-auto truncate text-[10px] text-faint">{note}</span> : null}
			</div>
			{children}
		</section>
	);
}

function Row({ k, v, note, plain = false }: { k: string; v: string; note?: string; plain?: boolean }) {
	return (
		<div className="flex h-7 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2">
			<span className="w-14 shrink-0 truncate text-[11px] text-muted">{k}</span>
			<span
				className={`min-w-0 flex-1 truncate text-[11px] text-surface-foreground ${plain ? "" : "font-mono"}`}
			>
				{v}
			</span>
			{note ? <span className="shrink-0 text-[10px] text-faint">{note}</span> : null}
		</div>
	);
}

function AddButton({ label }: { label: string }) {
	return (
		<button
			type="button"
			className="flex h-7 shrink-0 items-center justify-center gap-1 rounded-control border border-dashed border-border text-[11px] text-muted"
		>
			<Icon name="icon-[lucide--plus]" className="size-3 shrink-0" />
			{label}
		</button>
	);
}

export default function PropertyInspector() {
	return (
		<aside className="flex w-80 shrink-0 flex-col border-l border-border bg-surface-raised">
			<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
				<Icon name="icon-[lucide--sliders-horizontal]" className="size-3.5 shrink-0 text-muted" />
				<span className="text-[12px] font-semibold text-surface-foreground">节点参数</span>
				<span className="ml-auto font-mono text-[10px] text-faint">1 个节点已选中</span>
				<IconButton size="xs" icon="icon-[lucide--panel-right-close]" title="收起参数面板" />
			</div>

			<div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
				<span className="grid size-7 shrink-0 place-items-center rounded-control bg-accent-soft text-accent">
					<Icon name="icon-[lucide--chart-line]" className="size-3.5" />
				</span>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-[12px] font-medium text-surface-foreground">
						折线图 · GMV 趋势
					</span>
					<span className="block truncate font-mono text-[10px] text-faint">
						chartjs · line · node_7f2a
					</span>
				</span>
				<IconButton size="xs" icon="icon-[lucide--copy]" title="复制节点" />
				<IconButton size="xs" tone="danger" icon="icon-[lucide--trash-2]" title="删除节点" />
			</div>

			<div className="flex h-9 shrink-0 items-stretch border-b border-border px-1.5">
				{TABS.map((t, i) => (
					<span
						key={t}
						className={`relative flex items-center px-2.5 text-[12px] ${
							i === 0 ? "text-surface-foreground" : "text-muted"
						}`}
					>
						{t}
						{i === 0 ? (
							<span className="absolute inset-x-1.5 bottom-0 h-[2px] bg-accent" />
						) : null}
					</span>
				))}
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 py-3">
				<Group title="输入" note="上游节点提供">
					<div className="flex shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2 py-1.5">
						<Icon name="icon-[lucide--scroll-text]" className="size-3.5 shrink-0 text-ai" />
						<span className="min-w-0 flex-1">
							<span className="block truncate font-mono text-[11px] text-surface-foreground">
								gmv_14d
							</span>
							<span className="block truncate font-mono text-[10px] text-faint">
								SQL 查询 · 14 行 × 2 列 · 10:24
							</span>
						</span>
						<IconButton size="xs" icon="icon-[lucide--refresh-cw]" title="重新运行上游" />
						<IconButton size="xs" icon="icon-[lucide--x]" title="断开连接" />
					</div>
				</Group>

				<Group title="输出" note="渲染到看板">
					<div className="flex shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2 py-1.5">
						<Icon name="icon-[lucide--layout-dashboard]" className="size-3.5 shrink-0 text-series-2" />
						<span className="min-w-0 flex-1">
							<span className="block truncate text-[11px] text-surface-foreground">看板 · 概览</span>
							<span className="block truncate font-mono text-[10px] text-faint">
								自动布局 · 第 2 行 · 1 个产物
							</span>
						</span>
						<IconButton size="xs" icon="icon-[lucide--arrow-right]" title="定位到产物节点" />
					</div>
				</Group>

				<Group title="参数" note="改完立即重绘">
					<Row k="维度" v="d" note="日期" />
					<Row k="数值" v="gmv" note="求和" />
					<Row k="图形" v="面积" plain note="折线 / 面积 / 阶梯" />
					<AddButton label="添加参数" />
				</Group>

				<Group title="结果预览" note="上游结果集前 3 行">
					<div className="flex shrink-0 flex-col rounded-control border border-border bg-surface">
						<div className="flex items-center gap-2 border-b border-border px-2 py-1 font-mono text-[10px] text-faint">
							<span className="w-16 shrink-0">d</span>
							<span className="min-w-0 flex-1 text-right">gmv</span>
							<span className="w-12 shrink-0 text-right">orders</span>
						</div>
						{PREVIEW.map((r) => (
							<div key={r.d} className="flex items-center gap-2 px-2 py-1 text-[11px]">
								<span className="w-16 shrink-0 font-mono text-muted">{r.d}</span>
								<span className="min-w-0 flex-1 text-right font-mono tabular-nums text-surface-foreground">
									{r.gmv}
								</span>
								<span className="w-12 shrink-0 text-right font-mono tabular-nums text-muted">
									{r.orders}
								</span>
							</div>
						))}
					</div>
				</Group>

				<Group title="节点筛选" note="前端过滤 · 不重跑 SQL">
					<Row k="channel" v="等值多选 3 / 6" />
					<Row k="total_amount" v="≥ 100" />
					<AddButton label="添加筛选" />
				</Group>

				<Group title="布局">
					<Row k="画布坐标" v="x 436 · y 40 · 216 × 222" />
					<div className="flex h-7 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2">
						<span className="min-w-0 flex-1 text-[11px] text-surface-foreground">吸附到网格</span>
						<Switch on />
					</div>
					<div className="flex h-7 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2">
						<span className="min-w-0 flex-1 text-[11px] text-surface-foreground">锁定宽高比</span>
						<Switch on={false} />
					</div>
				</Group>
			</div>

			<div className="flex h-11 shrink-0 items-center gap-1.5 border-t border-border px-3 text-[10px] text-faint">
				<Icon name="icon-[lucide--zap]" className="size-3 shrink-0" />
				<span className="truncate">改动即时重绘 · 不回数据库</span>
			</div>
		</aside>
	);
}
