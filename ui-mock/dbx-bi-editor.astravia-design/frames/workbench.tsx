export const frame = { width: 1440, height: 1000, title: "BI · 工作台入口（点 BI 按钮之后）" };

import { AreaChart, Bars, Donut } from "../components/Charts";
import Btn from "../components/Btn";
import Chip from "../components/Chip";
import Icon from "../components/Icon";
import IconButton from "../components/IconButton";

const NAV = [
	{ icon: "icon-[lucide--layout-dashboard]", label: "我的看板", count: "6", on: true },
	{ icon: "icon-[lucide--monitor]", label: "数据大屏", count: "3", on: false },
	{ icon: "icon-[lucide--table-2]", label: "数据集", count: "12", on: false },
	{ icon: "icon-[lucide--folder-tree]", label: "工作树", count: "2", on: false },
	{ icon: "icon-[lucide--share-2]", label: "分享给我", count: "", on: false },
	{ icon: "icon-[lucide--trash-2]", label: "回收站", count: "", on: false },
];

const BOARDS = [
	{ name: "渠道经营看板", pages: "3 页", nodes: "6 节点", meta: "更新于 22:24", state: "2 个变更未运行", kind: "area", on: true },
	{ name: "城市分布看板", pages: "2 页", nodes: "5 节点", meta: "更新于 昨天", state: "已发布", kind: "bars", on: false },
	{ name: "投放效果看板", pages: "3 页", nodes: "8 节点", meta: "更新于 10-09", state: "已发布", kind: "donut", on: false },
	{ name: "渠道经营大屏", pages: "1 页", nodes: "8 节点", meta: "更新于 昨天", state: "已发布", kind: "area", on: false },
	{ name: "商品结构看板", pages: "2 页", nodes: "4 节点", meta: "更新于 10-07", state: "已发布", kind: "bars", on: false },
	{ name: "周会驾驶舱", pages: "4 页", nodes: "9 节点", meta: "更新于 10-02", state: "草稿", kind: "donut", on: false },
];

const RUNS = [
	{ time: "22:24", name: "渠道经营看板", detail: "6 节点 · 3 产物页面", cost: "1.2s", state: "成功" },
	{ time: "21:58", name: "渠道经营大屏", detail: "8 节点 · 1 页", cost: "2.4s", state: "成功" },
	{ time: "18:40", name: "城市分布看板", detail: "5 节点 · 2 产物页面", cost: "0.9s", state: "成功" },
	{ time: "10-09", name: "投放效果看板", detail: "8 节点 · 3 产物页面", cost: "—", state: "1 个节点失败" },
];

const START = [
	{ icon: "icon-[lucide--table-2]", title: "从数据集新建", note: "选一张表，勾字段，直接出图" },
	{ icon: "icon-[lucide--wand-sparkles]", title: "让 AI 生成", note: "说一句要什么，它去拼节点" },
	{ icon: "icon-[lucide--scroll-text]", title: "粘一条 SQL", note: "已有 SQL 的话，贴进来就是数据集" },
];

const PREVIEW: Record<string, number[]> = {
	area: [42, 48, 45, 55, 51, 61, 58, 66, 63, 72, 69, 78, 74, 83],
	bars: [36, 52, 44, 68, 58, 76, 63],
	donut: [38, 27, 19, 16],
};

function Preview({ kind }: { kind: string }) {
	if (kind === "bars") return <Bars values={PREVIEW.bars} className="h-full" tone="bg-series-2" />;
	if (kind === "donut") {
		return (
			<div className="flex h-full items-center justify-center gap-3">
				<Donut
					size={72}
					thickness={12}
					segments={PREVIEW.donut.map((v, i) => ({ value: v, color: `var(--color-series-${i + 1})` }))}
				/>
				<Bars values={PREVIEW.donut} className="h-12 w-16" tone="bg-series-3" />
			</div>
		);
	}
	return <AreaChart values={PREVIEW.area} className="h-full w-full" />;
}

/**
 * 工作台入口 —— 从数据资产点「BI」之后落到的第一屏。它回答两个问题：我有哪些看板、
 * 我现在该从哪起手。左栏是资产，中间是看板清单，右栏把「新建的三条路」和
 * 「这一版发到哪去了」并排放着，因为打开工作台的人要么在开新的，要么在收上一次的尾。
 */
export default function BiWorkbench() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-5">
				<div className="flex shrink-0 items-center gap-2">
					<Icon name="icon-[lucide--database]" className="size-4 text-muted" />
					<span className="text-[13px] text-muted">数据资产</span>
					<Icon name="icon-[lucide--chevron-right]" className="size-3.5 text-faint" />
					<span className="text-[13px] font-semibold text-surface-foreground">BI 工作台</span>
					<Chip tone="accent">本地工作树</Chip>
				</div>
				<div className="flex h-8 w-72 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2.5">
					<Icon name="icon-[lucide--search]" className="size-3.5 shrink-0 text-faint" />
					<span className="text-[12px] text-faint">搜索看板、大屏、数据集</span>
					<span className="ml-auto shrink-0 font-mono text-[10px] text-faint">⌘K</span>
				</div>
				<div className="ml-auto flex shrink-0 items-center gap-1">
					<Btn size="sm" variant="ghost" icon="icon-[lucide--table-2]">
						数据集
					</Btn>
					<Btn size="sm" variant="ghost" icon="icon-[lucide--folder-tree]">
						工作树
					</Btn>
					<span className="h-4 w-px shrink-0 bg-border" />
					<IconButton size="sm" icon="icon-[lucide--clock-3]" title="最近打开" />
					<div className="ml-1 grid size-7 shrink-0 place-items-center rounded-full border border-border bg-surface text-[11px] text-muted">
						诸
					</div>
				</div>
			</header>

			<div className="flex min-h-0 flex-1">
				<aside className="flex w-52 shrink-0 flex-col border-r border-border bg-surface-raised px-2 py-3">
					<div className="flex flex-col gap-0.5">
						{NAV.map((n) => (
							<div
								key={n.label}
								className={`flex h-8 items-center gap-2 rounded-control px-2 ${
									n.on ? "bg-accent-soft" : ""
								}`}
							>
								<Icon name={n.icon} className={`size-3.5 shrink-0 ${n.on ? "text-accent" : "text-muted"}`} />
								<span className={`text-[12px] ${n.on ? "font-medium text-accent" : "text-surface-foreground"}`}>
									{n.label}
								</span>
								{n.count ? <span className="ml-auto font-mono text-[10px] text-faint">{n.count}</span> : null}
							</div>
						))}
					</div>

					<div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
						<span className="px-2 text-[10px] text-faint">数据源</span>
						<div className="flex h-7 items-center gap-2 px-2">
							<Icon name="icon-[lucide--database]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] text-surface-foreground">生产库 MySQL</span>
							<span className="ml-auto size-1.5 shrink-0 rounded-full bg-success" />
						</div>
						<div className="flex h-7 items-center gap-2 px-2">
							<Icon name="icon-[lucide--upload]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] text-surface-foreground">本地文件</span>
							<span className="ml-auto font-mono text-[10px] text-faint">3</span>
						</div>
						<Btn size="xs" variant="ghost" icon="icon-[lucide--settings]" className="self-start">
							管理数据源
						</Btn>
					</div>
				</aside>

				<main className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6">
					<div className="flex h-8 shrink-0 items-center gap-3">
						<span className="text-[15px] font-semibold text-surface-foreground">我的看板</span>
						<Chip>6 个</Chip>
						<div className="ml-auto flex shrink-0 items-center gap-2">
							<div className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2 text-[11px] text-muted">
								<Icon name="icon-[lucide--clock-3]" className="size-3.5 shrink-0" />
								最近更新
								<Icon name="icon-[lucide--chevron-down]" className="size-3 text-faint" />
							</div>
							<div className="flex h-7 items-center gap-0.5 rounded-control border border-border bg-surface p-0.5">
								<span className="grid size-[22px] place-items-center rounded-[4px] bg-accent-soft text-accent">
									<Icon name="icon-[lucide--grid-2x2]" className="size-3.5" />
								</span>
								<span className="grid size-[22px] place-items-center rounded-[4px] text-muted">
									<Icon name="icon-[lucide--list-ordered]" className="size-3.5" />
								</span>
							</div>
							<Btn size="sm" variant="primary" icon="icon-[lucide--plus]">
								新建看板
							</Btn>
						</div>
					</div>

					<div className="grid shrink-0 grid-cols-3 gap-4">
						{BOARDS.map((b) => (
							<div
								key={b.name}
								className={`overflow-hidden rounded-card border bg-surface-raised ${
									b.on ? "border-accent shadow-[0_0_0_3px_var(--color-accent-soft)]" : "border-border"
								}`}
							>
								<div className="relative h-[112px] border-b border-border bg-background px-3 py-3">
									<Preview kind={b.kind} />
									<span className="absolute right-2 top-2 flex h-5 items-center gap-1 rounded-chip bg-surface-raised px-1.5 font-mono text-[10px] text-muted">
										{b.nodes}
									</span>
								</div>
								<div className="flex flex-col gap-1.5 px-3 py-2.5">
									<div className="flex items-center gap-2">
										<span className="truncate text-[13px] font-medium text-surface-foreground">{b.name}</span>
										{b.state === "2 个变更未运行" ? <Chip tone="warning">未运行</Chip> : null}
										<IconButton size="xs" icon="icon-[lucide--x]" title="更多" className="ml-auto" />
									</div>
									<div className="flex items-center gap-2 text-[10px] text-faint">
										<span>{b.pages}</span>
										<span className="h-3 w-px bg-border" />
										<span>{b.meta}</span>
										<span className="ml-auto">{b.state}</span>
									</div>
								</div>
							</div>
						))}
					</div>

					<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface-raised">
						<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
							<Icon name="icon-[lucide--play]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] font-medium text-surface-foreground">最近运行</span>
							<span className="ml-auto text-[10px] text-faint">看板与大屏共用同一本账</span>
						</div>
						<div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1.5 py-1.5">
							{RUNS.map((r) => (
								<div key={r.time + r.name} className="flex h-8 items-center gap-3 rounded-[4px] px-2">
									<span className="w-10 shrink-0 font-mono text-[10px] tabular-nums text-faint">{r.time}</span>
									<span className="w-40 shrink-0 truncate text-[11px] text-surface-foreground">{r.name}</span>
									<span className="min-w-0 flex-1 truncate text-[10px] text-faint">{r.detail}</span>
									<span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted">{r.cost}</span>
									<span
										className={`flex h-[18px] shrink-0 items-center rounded-chip px-1.5 text-[10px] ${
											r.state === "成功" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
										}`}
									>
										{r.state}
									</span>
								</div>
							))}
						</div>
					</div>
				</main>

				<aside className="flex w-72 shrink-0 flex-col gap-4 overflow-hidden border-l border-border bg-surface-raised p-4">
					<div className="flex flex-col gap-2">
						<span className="text-[11px] font-medium text-surface-foreground">从哪开始</span>
						{START.map((s) => (
							<div key={s.title} className="flex items-center gap-2.5 rounded-card border border-border bg-surface px-3 py-2.5">
								<Icon name={s.icon} className="size-4 shrink-0 text-accent" />
								<div className="flex min-w-0 flex-col">
									<span className="text-[12px] text-surface-foreground">{s.title}</span>
									<span className="truncate text-[10px] text-faint">{s.note}</span>
								</div>
								<Icon name="icon-[lucide--chevron-right]" className="ml-auto size-3.5 shrink-0 text-faint" />
							</div>
						))}
					</div>

					<div className="flex flex-col gap-2 border-t border-border pt-3">
						<span className="text-[11px] font-medium text-surface-foreground">产物链接</span>
						<div className="flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2">
							<div className="flex items-center gap-2">
								<Icon name="icon-[lucide--link-2]" className="size-3.5 shrink-0 text-muted" />
								<span className="text-[11px] text-surface-foreground">永久链接</span>
								<span className="ml-auto font-mono text-[10px] text-faint">不过期</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted">bi.local/d/chan-ops-6f2a</span>
								<IconButton size="xs" icon="icon-[lucide--copy]" title="复制永久链接" />
							</div>
						</div>
						<div className="flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2">
							<div className="flex items-center gap-2">
								<Icon name="icon-[lucide--calendar-clock]" className="size-3.5 shrink-0 text-muted" />
								<span className="text-[11px] text-surface-foreground">限期分享</span>
								<span className="ml-auto font-mono text-[10px] text-warning">剩 6 天</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted">bi.local/s/9k3p-7d</span>
								<Icon name="icon-[lucide--lock]" className="size-3 shrink-0 text-faint" />
								<IconButton size="xs" icon="icon-[lucide--copy]" title="复制分享链接" />
							</div>
						</div>
					</div>

					<div className="mt-auto flex flex-col gap-2 rounded-card border border-border bg-surface px-3 py-2.5">
						<div className="flex items-center gap-2">
							<Icon name="icon-[lucide--folder-tree]" className="size-3.5 shrink-0 text-warning" />
							<span className="text-[11px] text-surface-foreground">工作树有 2 个变更待发布</span>
						</div>
						<Btn size="sm" variant="primary" icon="icon-[lucide--upload]">
							发布并复制链接
						</Btn>
					</div>
				</aside>
			</div>
		</div>
	);
}
