export const frame = { width: 1440, height: 1000, title: "BI · 数据大屏（大屏节点）" };

import { AreaChart, Funnel } from "../components/Charts";
import Btn from "../components/Btn";
import Chip from "../components/Chip";
import Icon from "../components/Icon";
import IconButton from "../components/IconButton";

const RAIL = [
	{ icon: "icon-[lucide--monitor]", label: "大屏标题", count: "1", on: false },
	{ icon: "icon-[lucide--activity]", label: "大屏指标卡", count: "4", on: true },
	{ icon: "icon-[lucide--chart-line]", label: "大屏折线", count: "1", on: false },
	{ icon: "icon-[lucide--filter]", label: "大屏漏斗", count: "1", on: false },
	{ icon: "icon-[lucide--list-ordered]", label: "大屏排行榜", count: "1", on: false },
	{ icon: "icon-[lucide--layout-dashboard]", label: "大屏轮播", count: "—", on: false },
];

const KPIS = [
	{ label: "GMV · 近 14 天", value: "1 286 万", delta: "+18.4%", up: true },
	{ label: "订单量", value: "42 186", delta: "+6.2%", up: true },
	{ label: "客单价", value: "305", delta: "-1.8%", up: false },
	{ label: "新客占比", value: "34%", delta: "+4.1%", up: true },
];

const GMV = [42, 48, 45, 55, 51, 61, 58, 66, 63, 72, 69, 78, 74, 83];
const X = ["9-28", "9-30", "10-02", "10-04", "10-06", "10-08", "10-10"];

const STAGES = [
	{ label: "曝光", value: 100, text: "1 240 万" },
	{ label: "点击", value: 62, text: "768 万" },
	{ label: "加购", value: 34, text: "412 万" },
	{ label: "下单", value: 18, text: "218 万" },
];

const RANK = [
	{ name: "抖音", value: 100, text: "426 万" },
	{ name: "天猫", value: 78, text: "332 万" },
	{ name: "京东", value: 54, text: "228 万" },
	{ name: "小红书", value: 37, text: "158 万" },
	{ name: "线下门店", value: 21, text: "92 万" },
];

const PARAMS = [
	["度量", "gmv · sum"],
	["单位", "万元 · 1 位小数"],
	["阈值", "低于 60 标黄 · 高于 100 标绿"],
	["动效", "数字滚动 600 ms"],
];

const SETTINGS = [
	["分辨率", "1920 × 1080 · 16:9"],
	["背景", "深色渐变 · 内置第 2 套"],
	["自动刷新", "5 分钟"],
	["轮播", "3 页 · 间隔 15s"],
];

/**
 * 数据大屏 —— 大屏不是把看板拉大，它有自己的一套节点：标题条、超大号指标卡、
 * 排行榜、轮播容器，都按 1920 × 1080 的基准排。左边是大屏节点库，中间是等比的
 * 画布（这里缩放 42%），右边既是当前节点的参数，也是整块屏的设置。
 */
export default function BigScreen() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-4">
				<Icon name="icon-[lucide--monitor]" className="size-4 shrink-0 text-accent" />
				<span className="text-[13px] font-semibold text-surface-foreground">渠道经营大屏</span>
				<Chip tone="accent">大屏 · 1920 × 1080</Chip>
				<Chip>1 页 · 8 个节点</Chip>
				<div className="ml-auto flex shrink-0 items-center gap-2">
					<Btn size="sm" variant="ghost" icon="icon-[lucide--share-2]">
						分享
					</Btn>
					<Btn size="sm" variant="default" icon="icon-[lucide--play]">
						预览
					</Btn>
					<Btn size="sm" variant="primary" icon="icon-[lucide--upload]">
						发布到工作树
					</Btn>
				</div>
			</header>

			<div className="flex min-h-0 flex-1">
				<aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface-raised">
					<div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
						<Icon name="icon-[lucide--boxes]" className="size-3.5 shrink-0 text-muted" />
						<span className="text-[12px] font-medium text-surface-foreground">大屏节点</span>
						<span className="ml-auto font-mono text-[10px] text-faint">6 种</span>
					</div>
					<div className="flex flex-col gap-0.5 px-2 py-2">
						{RAIL.map((r) => (
							<div
								key={r.label}
								className={`flex h-7 items-center gap-2 rounded-[4px] px-2 ${r.on ? "bg-accent-soft" : ""}`}
							>
								<Icon name={r.icon} className={`size-3.5 shrink-0 ${r.on ? "text-accent" : "text-muted"}`} />
								<span className={`text-[11px] ${r.on ? "text-accent" : "text-surface-foreground"}`}>{r.label}</span>
								<span className="ml-auto font-mono text-[10px] text-faint">{r.count}</span>
							</div>
						))}
					</div>
					<p className="mt-auto border-t border-border px-3 py-3 text-[10px] leading-4 text-faint">
						大屏节点与看板节点同一套运行账，只是字号、间距按投屏 3 倍重排。
					</p>
				</aside>

				<div className="flex min-w-0 flex-1 flex-col">
					<div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
						<Icon name="icon-[lucide--monitor]" className="size-3.5 shrink-0 text-muted" />
						<span className="text-[11px] text-muted">画布 1920 × 1080</span>
						<Chip mono>缩放 42%</Chip>
						<span className="h-4 w-px shrink-0 bg-border" />
						<span className="flex h-6 items-center gap-1.5 rounded-chip border border-border px-2 text-[10px] text-muted">
							<Icon name="icon-[lucide--grid-2x2]" className="size-3 shrink-0" />
							吸附已开
						</span>
						<span className="flex h-6 items-center gap-1.5 rounded-chip border border-border px-2 text-[10px] text-muted">
							<Icon name="icon-[lucide--sliders-horizontal]" className="size-3 shrink-0" />
							安全区参考线
						</span>
						<div className="ml-auto flex shrink-0 items-center gap-2">
							<Btn size="xs" variant="ghost">
								适配视图
							</Btn>
							<IconButton size="xs" icon="icon-[lucide--minus]" title="缩小" />
							<IconButton size="xs" icon="icon-[lucide--plus]" title="放大" />
						</div>
					</div>

					<div className="flex min-h-0 flex-1 items-center justify-center bg-screen p-6">
						<div className="aspect-[16/9] w-[864px] max-w-full overflow-hidden rounded-card border border-screen-line bg-screen p-4">
							<div className="grid h-full grid-cols-12 grid-rows-[52px_120px_1fr] gap-3">
								<div className="col-span-12 flex items-center gap-4 border-b border-screen-line">
									<span className="h-px flex-1 bg-screen-line" />
									<span className="text-[24px] font-semibold tracking-wide text-screen-foreground">
										渠道经营大屏
									</span>
									<span className="h-px flex-1 bg-screen-line" />
								</div>

								{KPIS.map((k) => (
									<div
										key={k.label}
										className="col-span-3 flex flex-col justify-center rounded-card border border-screen-line px-3"
									>
										<span className="text-[11px] text-screen-foreground/70">{k.label}</span>
										<span className="font-mono text-[32px] leading-tight tabular-nums text-screen-foreground">
											{k.value}
										</span>
										<span className={`text-[11px] ${k.up ? "text-success" : "text-danger"}`}>
											{k.delta} 环比上期
										</span>
									</div>
								))}

								<div className="col-span-5 flex flex-col rounded-card border border-screen-line px-3 py-2">
									<div className="flex shrink-0 items-center gap-2">
										<span className="size-2 shrink-0 rounded-full bg-series-1" />
										<span className="text-[11px] text-screen-foreground/70">GMV 趋势 · 近 14 天</span>
										<span className="ml-auto font-mono text-[10px] text-screen-foreground/50">华东 · 抖音</span>
									</div>
									<div className="min-h-0 flex-1 pt-1">
										<AreaChart values={GMV} className="h-full w-full" />
									</div>
									<div className="flex shrink-0 items-center justify-between pt-1">
										{X.map((t) => (
											<span key={t} className="font-mono text-[9px] text-screen-foreground/50">
												{t}
											</span>
										))}
									</div>
								</div>

								<div className="col-span-3 flex flex-col rounded-card border border-screen-line px-3 py-2">
									<span className="shrink-0 text-[11px] text-screen-foreground/70">转化漏斗</span>
									<div className="min-h-0 flex-1 pt-1">
										<Funnel stages={STAGES} className="h-full w-full" />
									</div>
								</div>

								<div className="col-span-4 flex flex-col rounded-card border border-screen-line px-3 py-2">
									<span className="shrink-0 text-[11px] text-screen-foreground/70">渠道排行 · 前 5</span>
									<div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 pt-1">
										{RANK.map((r, i) => (
											<div key={r.name} className="flex items-center gap-2">
												<span className="w-3 shrink-0 font-mono text-[10px] text-screen-foreground/50">
													{i + 1}
												</span>
												<span className="w-12 shrink-0 text-[11px] text-screen-foreground">{r.name}</span>
												<span className="h-2 min-w-0 flex-1 overflow-hidden rounded-[2px] bg-screen-line">
													<span
														className="block h-full rounded-[2px] bg-series-1"
														style={{ width: `${r.value}%` }}
													/>
												</span>
												<span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-screen-foreground/70">
													{r.text}
												</span>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<aside className="flex w-72 shrink-0 flex-col gap-4 overflow-hidden border-l border-border bg-surface-raised p-4">
					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<Icon name="icon-[lucide--activity]" className="size-3.5 shrink-0 text-accent" />
							<span className="text-[11px] font-medium text-surface-foreground">节点参数 · 大屏指标卡</span>
						</div>
						<div className="flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2">
							{PARAMS.map(([k, v]) => (
								<div key={k} className="flex h-6 items-center gap-2">
									<span className="w-[46px] shrink-0 truncate text-[10px] text-muted">{k}</span>
									<span className="min-w-0 flex-1 truncate text-[10px] text-surface-foreground">{v}</span>
								</div>
							))}
						</div>
						<span className="text-[10px] text-faint">选中画布上的 4 张卡会一起改，它们共用同一组参数。</span>
					</div>

					<div className="flex flex-col gap-2 border-t border-border pt-3">
						<div className="flex items-center gap-2">
							<Icon name="icon-[lucide--settings]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] font-medium text-surface-foreground">大屏设置</span>
						</div>
						<div className="flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2">
							{SETTINGS.map(([k, v]) => (
								<div key={k} className="flex h-6 items-center gap-2">
									<span className="w-[46px] shrink-0 truncate text-[10px] text-muted">{k}</span>
									<span className="min-w-0 flex-1 truncate text-[10px] text-surface-foreground">{v}</span>
								</div>
							))}
						</div>
					</div>

					<div className="mt-auto flex flex-col gap-2 rounded-card border border-border bg-surface px-3 py-2.5">
						<div className="flex items-center gap-2">
							<Icon name="icon-[lucide--link-2]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] text-surface-foreground">大屏链接</span>
							<span className="ml-auto font-mono text-[10px] text-faint">只读</span>
						</div>
						<span className="truncate font-mono text-[10px] text-muted">bi.local/screen/chan-ops-8c41</span>
						<Btn size="xs" variant="ghost" icon="icon-[lucide--copy]" className="self-start">
							复制
						</Btn>
					</div>
				</aside>
			</div>

			<footer className="flex h-11 shrink-0 items-center gap-3 border-t border-border bg-surface-raised px-3">
				<span className="flex h-6 items-center gap-1.5 rounded-chip bg-neutral-muted px-2 text-[10px] text-muted">
					<span className="size-1.5 shrink-0 rounded-full bg-success" />
					大屏 1 页 · 8 个节点 · 1920 × 1080
				</span>
				<span className="h-4 w-px shrink-0 bg-border" />
				<span className="text-[11px] text-muted">大屏与看板共用同一本运行账，产物都有独立链接</span>
				<div className="ml-auto flex shrink-0 items-center gap-2">
					<Chip icon="icon-[lucide--clock]">自动刷新 5 分钟</Chip>
					<Btn size="sm" variant="primary" icon="icon-[lucide--play]">
						整体运行
					</Btn>
				</div>
			</footer>
		</div>
	);
}
