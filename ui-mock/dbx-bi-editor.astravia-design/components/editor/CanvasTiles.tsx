import type { ReactNode } from "react";
import Chip from "../Chip";
import Icon from "../Icon";
import { AreaChart, Donut, Funnel, Gauge, HBars, Sparkline, seriesColor, ticks, yPercent } from "../Charts";

/**
 * 看板上的 12 个组件 —— adr-0009 §2.2 的仪表板编辑态。
 * 12 列网格上摆四行：指标卡 / 趋势 + 占比 / 排行 + 漏斗 + 查询控件 / 明细表 + 目标，
 * 这是 Quick BI 那类看板的典型排布。
 *
 * 同一份组件的身体同时服务两处：编辑态里它是选中框里的那一个（528 × 248 与右侧
 * 参数面板的读数同源），preview 模式下它就是产物本身 —— 没有选中框、没有尺寸标签。
 */

const GMV_14D = [42, 48, 45, 55, 51, 61, 58, 66, 63, 72, 69, 78, 74, 83];
const GMV_PREV = [38, 44, 41, 49, 47, 55, 52, 60, 57, 64, 62, 70, 67, 74];
const X_LABELS = ["09-27", "10-01", "10-05", "10-10"];
const Y_TICKS = ticks(0, 90, 4); // 90 / 60 / 30 / 0 万
const GMV_DOMAIN: [number, number] = [0, 90];

const METRICS = [
	{ label: "GMV", unit: "元", value: "2,847,300", delta: "+12.4%", up: true, spark: [42, 48, 45, 55, 51, 61, 58, 66, 74, 83] },
	{ label: "订单量", unit: "单", value: "18,472", delta: "+6.1%", up: true, spark: [18, 22, 20, 26, 24, 29, 27, 32, 30, 38] },
	{ label: "客单价", unit: "元", value: "154.2", delta: "−2.3%", up: false, spark: [168, 165, 162, 166, 160, 157, 159, 155, 152, 154] },
	{ label: "退款率", unit: "", value: "3.8%", delta: "+0.4pt", up: false, spark: [3.1, 3.2, 3.0, 3.4, 3.3, 3.5, 3.6, 3.5, 3.7, 3.8] },
];

const CHANNELS = [
	{ label: "自然流量", value: 46, color: seriesColor(0) },
	{ label: "搜索广告", value: 27, color: seriesColor(1) },
	{ label: "社交投放", value: 17, color: seriesColor(2) },
	{ label: "老客复购", value: 10, color: seriesColor(3) },
];

const CITIES = [
	{ label: "杭州", value: 228410, text: "228,410" },
	{ label: "上海", value: 176930, text: "176,930" },
	{ label: "北京", value: 144220, text: "144,220" },
	{ label: "成都", value: 99860, text: "99,860" },
	{ label: "广州", value: 77540, text: "77,540" },
];

const FUNNEL = [
	{ label: "曝光", value: 100, text: "100%" },
	{ label: "详情页", value: 42, text: "42%" },
	{ label: "加购", value: 21, text: "21%" },
	{ label: "下单", value: 12, text: "12%" },
	{ label: "支付", value: 8.6, text: "8.6%" },
];

const FILTERS = [
	{ label: "时间", value: "近 30 天" },
	{ label: "渠道", value: "3 / 6 已选" },
	{ label: "城市", value: "包含 杭州" },
	{ label: "品类", value: "全部" },
];

const ORDER_ROWS = [
	{ id: "SO-20481", city: "杭州", cat: "数码配件", amt: "¥2,480", at: "10-10 18:42" },
	{ id: "SO-20476", city: "上海", cat: "家用电器", amt: "¥1,960", at: "10-10 17:05" },
	{ id: "SO-20468", city: "北京", cat: "户外运动", amt: "¥1,348", at: "10-10 15:31" },
	{ id: "SO-20461", city: "成都", cat: "美妆个护", amt: "¥899", at: "10-10 14:12" },
	{ id: "SO-20455", city: "广州", cat: "食品生鲜", amt: "¥612", at: "10-10 11:48" },
];

/** 画布上的一个组件盒。选中态 = 蓝色描边 + 8 个控制点 + 一条读数（列/行/尺寸）。 */
function Tile({
	children,
	selected = false,
	label,
	className = "",
}: {
	children: ReactNode;
	selected?: boolean;
	label?: string;
	className?: string;
}) {
	const dot = "absolute size-1.5 rounded-[1px] border border-background bg-accent";
	return (
		<div
			className={`relative flex min-w-0 flex-col rounded-card border bg-surface ${
				selected ? "border-accent" : "border-border"
			} ${className}`}
		>
			{children}
			{selected ? (
				<>
					{label ? (
						<span className="absolute -top-6 left-0 flex h-5 items-center gap-1.5 rounded-chip bg-accent px-1.5 font-mono text-[10px] tabular-nums whitespace-nowrap text-accent-foreground">
							{label}
						</span>
					) : null}
					<span className={`${dot} -top-[3px] -left-[3px]`} />
					<span className={`${dot} -top-[3px] left-1/2 -ml-[3px]`} />
					<span className={`${dot} -top-[3px] -right-[3px]`} />
					<span className={`${dot} top-1/2 -left-[3px] -mt-[3px]`} />
					<span className={`${dot} top-1/2 -right-[3px] -mt-[3px]`} />
					<span className={`${dot} -bottom-[3px] -left-[3px]`} />
					<span className={`${dot} -bottom-[3px] left-1/2 -ml-[3px]`} />
					<span className={`${dot} -right-[3px] -bottom-[3px]`} />
				</>
			) : null}
		</div>
	);
}

/** 组件头：标题 + 数据集（mono）+ 图例 + 每个组件自己的菜单。 */
function TileHead({
	title,
	meta,
	legend,
	tint = false,
}: {
	title: string;
	meta?: string;
	legend?: { label: string; color: string; dash?: boolean }[];
	tint?: boolean;
}) {
	return (
		<div
			className={`flex h-8 shrink-0 items-center gap-2 border-b px-2.5 ${
				tint ? "border-accent/40 bg-accent-soft" : "border-border"
			}`}
		>
			<span className="truncate text-[12px] font-medium text-surface-foreground">{title}</span>
			{meta ? <span className="shrink-0 font-mono text-[10px] text-faint">{meta}</span> : null}
			<span className="ml-auto flex shrink-0 items-center gap-2">
				{legend?.map((l) => (
					<span key={l.label} className="flex items-center gap-1 text-[10px] text-muted">
						<span
							className={`size-2 shrink-0 rounded-[1px] ${l.dash ? "border-t-2 border-dashed" : ""}`}
							style={l.dash ? { borderColor: l.color } : { background: l.color }}
						/>
						{l.label}
					</span>
				))}
				<Icon name="icon-[lucide--ellipsis]" className="size-3.5 text-faint" />
			</span>
		</div>
	);
}

function MetricTile({ metric, className }: { metric: (typeof METRICS)[number]; className: string }) {
	return (
		<Tile className={className}>
			<div className="flex h-20 flex-col justify-between px-2.5 py-2">
				<span className="text-[11px] whitespace-nowrap text-muted">{metric.label}</span>
				<span className="flex items-end gap-1.5">
					<span className="text-[20px] leading-none font-semibold tabular-nums text-surface-foreground">
						{metric.value}
					</span>
					{metric.unit ? <span className="pb-0.5 text-[11px] text-faint">{metric.unit}</span> : null}
					<Sparkline
						values={metric.spark}
						stroke={metric.up ? seriesColor(0) : seriesColor(3)}
						className="ml-auto h-4 w-8 shrink-0"
					/>
				</span>
				<span className="flex items-center gap-1.5 text-[10px] whitespace-nowrap">
					<Chip tone={metric.up ? "primary" : "danger"} mono>
						{metric.delta}
					</Chip>
					<span className="text-faint">环比上周期</span>
				</span>
			</div>
		</Tile>
	);
}

export default function CanvasTiles({ preview = false }: { preview?: boolean }) {
	return (
		<>
			<MetricTile metric={METRICS[0]} className="col-span-3 col-start-1 row-start-1" />
			<MetricTile metric={METRICS[1]} className="col-span-3 col-start-4 row-start-1" />
			<MetricTile metric={METRICS[2]} className="col-span-3 col-start-7 row-start-1" />
			<MetricTile metric={METRICS[3]} className="col-span-3 col-start-10 row-start-1" />

			{/* 被选中的第一个组件：8 列 × 1 行 */}
			<Tile
				selected={!preview}
				label={preview ? undefined : "GMV 趋势 · 第 1–8 列 · 第 2 行 · 528 × 248"}
				className="col-span-8 col-start-1 row-start-2"
			>
				<TileHead
					title="GMV 趋势"
					meta="orders_daily"
					tint
					legend={[
						{ label: "本期", color: seriesColor(0) },
						{ label: "上周期", color: seriesColor(2), dash: true },
					]}
				/>
				<div className="flex min-h-0 flex-1 gap-1.5 px-2.5 pt-3 pb-1.5">
					<div className="relative w-7 shrink-0">
						{Y_TICKS.map((t) => (
							<span
								key={t}
								className="absolute right-0 -translate-y-1/2 font-mono text-[10px] tabular-nums text-faint"
								style={{ top: `${yPercent(t, GMV_DOMAIN[0], GMV_DOMAIN[1])}%` }}
							>
								{t}万
							</span>
						))}
					</div>
					<div className="relative min-w-0 flex-1">
						<AreaChart
							values={GMV_14D}
							domain={GMV_DOMAIN}
							gridLines={Y_TICKS.map((t) => yPercent(t, GMV_DOMAIN[0], GMV_DOMAIN[1]))}
							className="absolute inset-0 h-full w-full"
						/>
						<AreaChart
							values={GMV_PREV}
							domain={GMV_DOMAIN}
							grid={false}
							fill="transparent"
							stroke={seriesColor(2)}
							dash
							className="absolute inset-0 h-full w-full"
						/>
					</div>
				</div>
				<div className="flex shrink-0 items-center justify-between border-t border-border pt-1 pr-2.5 pb-1.5 pl-[44px] font-mono text-[10px] text-faint">
					{X_LABELS.map((l) => (
						<span key={l}>{l}</span>
					))}
				</div>
			</Tile>

			<Tile className="col-span-4 col-start-9 row-start-2">
				<TileHead title="渠道构成" meta="channel_share" />
				<div className="flex min-h-0 flex-1 items-center gap-3 px-3 pt-2">
					<Donut segments={CHANNELS} size={92} thickness={13} />
					<div className="flex min-w-0 flex-1 flex-col gap-1.5">
						{CHANNELS.map((c) => (
							<span key={c.label} className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
								<span className="size-2 shrink-0 rounded-[1px]" style={{ background: c.color }} />
								<span className="truncate text-muted">{c.label}</span>
								<span className="ml-auto font-mono tabular-nums text-surface-foreground">
									{c.value}%
								</span>
							</span>
						))}
					</div>
				</div>
				<div className="flex h-6 shrink-0 items-center gap-1.5 border-t border-border px-2.5 text-[10px] text-faint">
					<Icon name="icon-[lucide--filter]" className="size-3 shrink-0" />
					<span className="truncate">口径：已支付订单金额占比 · 去重客户</span>
				</div>
			</Tile>

			<Tile className="col-span-5 col-start-1 row-start-3">
				<TileHead title="城市 Top 5" meta="city_top20" />
				<div className="flex min-h-0 flex-1 flex-col justify-center px-2.5">
					<HBars rows={CITIES} />
				</div>
				<div className="flex h-6 shrink-0 items-center gap-1.5 border-t border-border px-2.5 text-[10px] text-faint">
					<Icon name="icon-[lucide--trending-up]" className="size-3 shrink-0" />
					<span className="truncate">口径：近 30 天已支付金额 · 单位元</span>
				</div>
			</Tile>

			<Tile className="col-span-4 col-start-6 row-start-3">
				<TileHead title="转化漏斗" meta="orders_daily" />
				<div className="flex min-h-0 flex-1 flex-col justify-center gap-1 px-2.5">
					<Funnel stages={FUNNEL} />
				</div>
				<div className="flex h-6 shrink-0 items-center gap-1.5 border-t border-border px-2.5 text-[10px] text-faint">
					<Icon name="icon-[lucide--info]" className="size-3 shrink-0" />
					<span className="truncate">人数口径，与订单口径不通用</span>
				</div>
			</Tile>

			<Tile className="col-span-3 col-start-10 row-start-3">
				<TileHead title="查询控件" meta="增强" />
				<div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-2.5">
					{FILTERS.map((f) => (
						<span key={f.label} className="flex items-center gap-1.5">
							<span className="w-7 shrink-0 text-[10px] text-muted">{f.label}</span>
							<span className="flex h-6 min-w-0 flex-1 items-center gap-1 rounded-control border border-border bg-surface px-1.5 text-[10px] text-surface-foreground">
								<span className="truncate">{f.value}</span>
								<Icon name="icon-[lucide--chevron-down]" className="ml-auto size-3 shrink-0 text-faint" />
							</span>
						</span>
					))}
				</div>
				<div className="flex h-6 shrink-0 items-center gap-1.5 border-t border-border px-2.5 text-[10px] text-faint">
					<Icon name="icon-[lucide--zap]" className="size-3 shrink-0" />
					<span className="truncate">改动即时生效 · 不重跑 SQL</span>
				</div>
			</Tile>

			<Tile className="col-span-8 col-start-1 row-start-4">
				<TileHead title="订单明细" meta="orders_daily" />
				<div className="flex min-h-0 flex-1 flex-col px-2.5 py-2">
					<div className="grid shrink-0 grid-cols-[76px_1fr_1fr_64px_1fr] gap-2 border-b border-border pb-1.5 text-[10px] text-faint">
						<span>订单号</span>
						<span>城市</span>
						<span>品类</span>
						<span className="text-right">金额</span>
						<span className="text-right">支付时间</span>
					</div>
					{ORDER_ROWS.map((r) => (
						<div
							key={r.id}
							className="grid min-h-0 flex-1 grid-cols-[76px_1fr_1fr_64px_1fr] items-center gap-2 text-[11px]"
						>
							<span className="truncate font-mono text-muted">{r.id}</span>
							<span className="truncate text-surface-foreground">{r.city}</span>
							<span className="truncate text-muted">{r.cat}</span>
							<span className="text-right font-mono tabular-nums text-surface-foreground">
								{r.amt}
							</span>
							<span className="text-right font-mono tabular-nums text-faint">{r.at}</span>
						</div>
					))}
				</div>
			</Tile>

			<Tile className="col-span-4 col-start-9 row-start-4">
				<TileHead title="目标完成度" meta="增强" />
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-2.5">
					<span className="relative">
						<Gauge value={82} />
						<span className="absolute inset-x-0 bottom-0 text-center text-[16px] font-semibold tabular-nums text-surface-foreground">
							82%
						</span>
					</span>
					<span className="flex w-full flex-col gap-1.5">
						<span className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-muted">
							<span className="h-1.5 rounded-full bg-series-1" style={{ width: "82%" }} />
						</span>
						<span className="flex items-center gap-1.5 text-[10px] whitespace-nowrap text-faint">
							<span className="truncate">月度目标 ¥3.5M</span>
							<span className="ml-auto font-mono tabular-nums text-muted">已完成 ¥2.87M</span>
						</span>
					</span>
				</div>
			</Tile>
		</>
	);
}
