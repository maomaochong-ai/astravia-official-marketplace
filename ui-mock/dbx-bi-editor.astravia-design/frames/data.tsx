export const frame = { width: 1440, height: 1000, title: "BI · 数据源节点（三种来源）" };

import Chip from "../components/Chip";
import Icon from "../components/Icon";
import IconButton from "../components/IconButton";
import CanvasGround from "../components/editor/CanvasGround";
import EditorToolbar from "../components/editor/EditorToolbar";
import NodeCard, { NodeRow, NodeSeg, NodeSelect, NodeValue, TONE } from "../components/editor/NodeCard";

const CONNECTED = [
	{ icon: "icon-[lucide--database]", name: "生产库 MySQL", note: "14 表 · 直连", on: true },
	{ icon: "icon-[lucide--upload]", name: "本地文件", note: "3 个 · 会话级", on: false },
];

const DATASETS = [
	{ name: "ds_orders", note: "12 486 行" },
	{ name: "ds_channels", note: "6 行" },
	{ name: "ds_city", note: "312 行" },
	{ name: "ds_campaign", note: "拖入 CSV 生成" },
];

const CONSUMERS = [
	{ name: "line_gmv_14d", note: "图表 · 折线" },
	{ name: "donut_channel", note: "图表 · 环图" },
	{ name: "kpi_row", note: "图表 · 指标卡" },
	{ name: "看板产物 · 概览", note: "产物页面" },
];

const CHAIN = ["MySQL 直连取数", "SQL 聚合出 ds_orders", "图表节点消费 table 输出"];

/**
 * 数据源节点 —— 一条数从哪来，就是一个节点。三种来源摆在同一张画布上比较：
 * 直连的数据源、一键套用或手写的 SQL 数据集、拖进来的本地文件。它们输出同一种
 * table 插座，所以下游的图表节点不关心自己是接在数据库还是接在一个 CSV 上。
 */
export default function DataSourceNodes() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<EditorToolbar />
			<div className="flex min-h-0 flex-1">
				<aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface-raised">
					<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
						<Icon name="icon-[lucide--database]" className="size-3.5 shrink-0 text-muted" />
						<span className="text-[13px] font-semibold text-surface-foreground">数据源</span>
						<span className="ml-auto font-mono text-[10px] tabular-nums text-faint">2</span>
					</div>

					<div className="flex flex-col gap-0.5 px-2 py-2">
						{CONNECTED.map((c) => (
							<div
								key={c.name}
								className={`flex h-7 items-center gap-2 rounded-[4px] px-2 ${
									c.on ? "border border-accent bg-accent-soft" : "border border-transparent"
								}`}
							>
								<Icon name={c.icon} className={`size-3.5 shrink-0 ${c.on ? "text-accent" : "text-muted"}`} />
								<span className={`text-[11px] ${c.on ? "text-accent" : "text-surface-foreground"}`}>{c.name}</span>
								<span className="ml-auto shrink-0 font-mono text-[9px] text-faint">{c.note}</span>
							</div>
						))}
					</div>

					<div className="flex h-6 shrink-0 items-center gap-2 px-3">
						<span className="text-[10px] text-faint">可用数据集</span>
						<span className="ml-auto font-mono text-[10px] text-faint">4</span>
					</div>
					<div className="flex flex-col gap-0.5 px-2">
						{DATASETS.map((d) => (
							<div key={d.name} className="flex h-7 items-center gap-2 rounded-[4px] px-2">
								<Icon name="icon-[lucide--table-2]" className="size-3.5 shrink-0 text-muted" />
								<span className="font-mono text-[11px] text-surface-foreground">{d.name}</span>
								<span className="ml-auto shrink-0 text-[9px] text-faint">{d.note}</span>
							</div>
						))}
					</div>

					<div className="mt-auto flex flex-col gap-2 border-t border-border px-2 py-2">
						<button
							type="button"
							className="flex h-7 items-center gap-2 rounded-control border border-border bg-surface px-2 text-[11px] text-surface-foreground"
						>
							<Icon name="icon-[lucide--rotate-cw]" className="size-3.5 shrink-0 text-muted" />
							从插件工作台同步 schema
						</button>
						<p className="px-1 text-[10px] leading-4 text-faint">
							本地文件与直连数据源都只读出内存，不写回 ods_orders。
						</p>
					</div>
				</aside>

				<div className="flex min-w-0 flex-1 flex-col">
					<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
						<Icon name="icon-[lucide--database]" className="size-3.5 shrink-0 text-muted" />
						<span className="text-[13px] font-semibold text-surface-foreground">数据源节点</span>
						<Chip tone="accent">3 个节点 · 0 连接</Chip>
						<div className="ml-auto flex shrink-0 items-center gap-2">
							<Chip icon="icon-[lucide--square-check]">已连插件工作台</Chip>
							<span className="h-4 w-px shrink-0 bg-border" />
							<IconButton size="xs" icon="icon-[lucide--minus]" title="缩小" />
							<span className="w-9 shrink-0 text-center font-mono text-[11px] tabular-nums text-muted">100%</span>
							<IconButton size="xs" icon="icon-[lucide--plus]" title="放大" />
						</div>
					</div>

					<CanvasGround
						links={[
							{ x1: 352, y1: 130, x2: 372, y2: 130, tone: "var(--color-series-1)" },
							{ x1: 692, y1: 130, x2: 712, y2: 130, tone: "var(--color-series-1)", dashed: true },
						]}
					>
						<NodeCard
							title="ods_orders · MySQL"
							type="数据源"
							icon="icon-[lucide--database]"
							tone={TONE.table}
							x={32}
							y={64}
							w={320}
							h={196}
							selected
							outputs={[{ row: 0, tone: TONE.table }]}
						>
							<NodeRow label="连接">
								<NodeValue mono>prod-mysql:3306 / bi</NodeValue>
							</NodeRow>
							<NodeRow label="表">
								<NodeSelect>ods_orders</NodeSelect>
							</NodeRow>
							<NodeRow label="模式">
								<NodeSeg options={["直连", "抽取"]} active="直连" />
							</NodeRow>
							<NodeRow label="延迟">
								<NodeValue mono>200 ms · 12 486 行</NodeValue>
							</NodeRow>
							<NodeRow label="引用">
								<NodeValue>画布内 4 处</NodeValue>
							</NodeRow>
						</NodeCard>

						<NodeCard
							title="ds_orders"
							type="SQL 数据集"
							icon="icon-[lucide--scroll-text]"
							tone={TONE.table}
							x={372}
							y={64}
							w={320}
							h={212}
							inputs={[{ row: 0, tone: TONE.table }]}
							outputs={[{ row: 1, tone: TONE.table }]}
						>
							<NodeRow label="来源">
								<NodeSeg options={["一键套用", "手写"]} active="一键套用" />
							</NodeRow>
							<div className="mt-1 rounded-[4px] border border-border bg-background px-1.5 py-1 font-mono text-[10px] leading-4 text-muted">
								<div>select channel, date, sum(gmv)</div>
								<div>from ods_orders where date &gt; now() - 14</div>
								<div>group by 1, 2</div>
							</div>
							<NodeRow label="字段">
								<NodeValue mono>8 列 · 5 维 3 度量</NodeValue>
							</NodeRow>
							<NodeRow label="刷新">
								<NodeValue>10 分钟 · 缓存命中</NodeValue>
							</NodeRow>
						</NodeCard>

						<NodeCard
							title="2024Q3 渠道明细.csv"
							type="本地文件"
							icon="icon-[lucide--upload]"
							tone={TONE.table}
							x={712}
							y={64}
							w={320}
							h={212}
							outputs={[{ row: 0, tone: TONE.table }]}
						>
							<NodeRow label="上传">
								<NodeValue mono>9.6 / 12.3 MB · 78%</NodeValue>
							</NodeRow>
							<div className="my-1 h-1 w-full overflow-hidden rounded-[2px] bg-neutral-muted">
								<span className="block h-full w-[78%] rounded-[2px] bg-accent" />
							</div>
							<NodeRow label="表头">
								<NodeValue mono>8 列 · 已识别 6 列</NodeValue>
							</NodeRow>
							<NodeRow label="用途">
								<NodeSeg options={["临时", "转数据集"]} active="临时" />
							</NodeRow>
							<div className="mt-1 flex h-8 items-center justify-center gap-1.5 rounded-[4px] border border-dashed border-border text-[10px] text-faint">
								<Icon name="icon-[lucide--upload]" className="size-3 shrink-0" />
								拖 CSV / Excel / Parquet 到这里
							</div>
						</NodeCard>

						<span className="absolute left-[32px] top-[300px] text-[10px] text-faint">输出 table → 可连任意图表节点</span>
						<span className="absolute left-[372px] top-[300px] text-[10px] text-faint">输出 table → 1 对多</span>
						<span className="absolute left-[712px] top-[300px] text-[10px] text-faint">输出 table → 先转数据集才持久</span>

						<div className="absolute left-[32px] top-[344px] w-[1000px] overflow-hidden rounded-card border border-border bg-surface-raised">
							<div className="flex h-9 items-center gap-2 border-b border-border px-3">
								<Icon name="icon-[lucide--git-branch]" className="size-3.5 shrink-0 text-muted" />
								<span className="text-[11px] font-medium text-surface-foreground">这台节点的取数链路</span>
								<span className="ml-auto font-mono text-[10px] text-faint">只读</span>
							</div>
							<div className="flex items-center gap-2 px-3 py-3">
								{CHAIN.map((c, i) => (
									<span key={c} className="flex items-center gap-2">
										{i > 0 ? <Icon name="icon-[lucide--arrow-right]" className="size-3.5 shrink-0 text-faint" /> : null}
										<span className="flex h-7 items-center gap-1.5 rounded-chip border border-border bg-surface px-2 text-[11px] text-surface-foreground">
											<span className="size-1.5 shrink-0 rounded-full bg-series-1" />
											{c}
										</span>
									</span>
								))}
								<span className="ml-auto flex h-7 items-center gap-1.5 rounded-chip bg-warning-soft px-2 text-[11px] text-warning">
									<Icon name="icon-[lucide--circle-alert]" className="size-3 shrink-0" />
									本地文件仅本次会话有效，长期用请先转成数据集
								</span>
							</div>
						</div>

						<div className="absolute left-[32px] top-[472px] w-[480px] overflow-hidden rounded-card border border-border bg-surface-raised">
							<div className="flex h-9 items-center gap-2 border-b border-border px-3">
								<Icon name="icon-[lucide--network]" className="size-3.5 shrink-0 text-muted" />
								<span className="text-[11px] font-medium text-surface-foreground">谁在用这个数据源</span>
								<span className="ml-auto font-mono text-[10px] text-faint">4</span>
							</div>
							{CONSUMERS.map((c) => (
								<div key={c.name} className="flex h-7 items-center gap-2 px-3">
									<Icon name="icon-[lucide--corner-down-left]" className="size-3 shrink-0 text-faint" />
									<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-surface-foreground">{c.name}</span>
									<span className="shrink-0 text-[10px] text-faint">{c.note}</span>
								</div>
							))}
							<div className="flex h-9 items-center gap-2 border-t border-border px-3">
								<span className="text-[10px] text-faint">选中数据源节点时，这条链路会显示在右侧参数面板的「输出」里</span>
							</div>
						</div>
					</CanvasGround>
				</div>
			</div>

			<footer className="flex h-11 shrink-0 items-center gap-3 border-t border-border bg-surface-raised px-3">
				<span className="flex h-6 items-center gap-1.5 rounded-chip bg-neutral-muted px-2 text-[10px] text-muted">
					<span className="size-1.5 shrink-0 rounded-full bg-muted" />
					3 个数据源节点 · 0 个已运行
				</span>
				<span className="h-4 w-px shrink-0 bg-border" />
				<span className="text-[11px] text-muted">数据源节点只声明从哪取数，运行与否由下游图表节点决定</span>
				<span className="ml-auto flex h-6 items-center gap-1.5 rounded-chip border border-border px-2 text-[10px] text-muted">
					<Icon name="icon-[lucide--lock]" className="size-3 shrink-0" />
					取数只在内存里
				</span>
			</footer>
		</div>
	);
}
