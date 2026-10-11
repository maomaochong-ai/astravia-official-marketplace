export const frame = { width: 1440, height: 1000, title: "BI · 智能体对话生成看板与大屏" };

import Btn from "../components/Btn";
import Chip from "../components/Chip";
import Icon from "../components/Icon";
import IconButton from "../components/IconButton";
import CanvasGround, { type NodeLink } from "../components/editor/CanvasGround";
import EditorToolbar from "../components/editor/EditorToolbar";
import NodeCard, { NodeValue, NodeRow, TONE } from "../components/editor/NodeCard";

const STEPS = [
	{ icon: "icon-[lucide--circle-check]", label: "接上数据源 ods_orders", note: "已完成", on: "done" },
	{ icon: "icon-[lucide--circle-check]", label: "写 SQL 汇总出 ds_orders", note: "已完成", on: "done" },
	{ icon: "icon-[lucide--circle-check]", label: "生成 3 个图表节点", note: "已完成", on: "done" },
	{ icon: "icon-[lucide--loader]", label: "搭大屏骨架（标题 + 4 指标卡 + 排行榜）", note: "进行中", on: "run" },
	{ icon: "icon-[lucide--clock]", label: "绑定筛选器与日期区间", note: "待办", on: "todo" },
	{ icon: "icon-[lucide--clock]", label: "发布到工作树并给出链接", note: "待办", on: "todo" },
];

const STEP_CLS: Record<string, string> = {
	done: "text-success",
	run: "text-accent animate-spin",
	todo: "text-faint",
};

const GROUPS = [{ x: 16, y: 348, w: 992, h: 148, label: "AI 待插入 · 大屏 4 个节点", count: 4 }];

const LINKS: NodeLink[] = [
	{ x1: 214, y1: 92, x2: 240, y2: 92, tone: TONE.table },
	{ x1: 430, y1: 92, x2: 456, y2: 84, tone: TONE.table },
	{ x1: 430, y1: 92, x2: 456, y2: 228, tone: TONE.table },
];

const PENDING = [
	{ icon: "icon-[lucide--monitor]", label: "大屏标题" },
	{ icon: "icon-[lucide--activity]", label: "大屏指标卡 ×2" },
	{ icon: "icon-[lucide--list-ordered]", label: "大屏排行榜" },
];

/**
 * 智能体对话 —— 单节点 AI 管一个节点，智能体会话管一整张看板。它先把计划写成人能读的
 * 六步，每一步都对应画布上真实存在的节点，做完一步勾一步；大屏的节点也一样按这个流程
 * 生成，生成完先落在草稿区，等用户按「插入画布并运行」才真正接进主链路。
 */
export default function AgentConversation() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<EditorToolbar />
			<div className="flex min-h-0 flex-1">
				<section className="flex w-[400px] shrink-0 flex-col border-r border-border bg-surface-raised">
					<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
						<Icon name="icon-[lucide--bot]" className="size-3.5 shrink-0 text-ai" />
						<span className="text-[13px] font-semibold text-surface-foreground">智能体会话</span>
						<Chip tone="ai">宿主模型</Chip>
						<span className="ml-auto font-mono text-[10px] text-faint">工作树 · 只读</span>
					</div>

					<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 py-3">
						<div className="flex justify-end">
							<p className="max-w-[300px] rounded-card rounded-br-[4px] border border-border bg-surface px-2.5 py-2 text-[12px] leading-5 text-surface-foreground">
								上一季度的渠道经营做一个大屏，重点看华东和抖音，深色底，数字要大。
							</p>
						</div>

						<div className="flex gap-2">
							<span className="grid h-5 shrink-0 place-items-center">
								<Icon name="icon-[lucide--bot]" className="size-4 text-ai" />
							</span>
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								<p className="text-[12px] leading-5 text-surface-foreground">
									先把计划列出来，每一步都落在画布上真实存在的节点上：
								</p>
								<div className="flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2">
									{STEPS.map((s) => (
										<div key={s.label} className="flex h-6 items-center gap-2">
											<Icon name={s.icon} className={`size-3.5 shrink-0 ${STEP_CLS[s.on]}`} />
											<span className="min-w-0 flex-1 truncate text-[11px] text-surface-foreground">{s.label}</span>
											<span className="shrink-0 text-[10px] text-faint">{s.note}</span>
										</div>
									))}
								</div>
								<div className="rounded-card border border-ai bg-surface px-2.5 py-2">
									<div className="flex items-center gap-2">
										<Icon name="icon-[lucide--wand-sparkles]" className="size-3.5 shrink-0 text-ai" />
										<span className="text-[11px] font-medium text-surface-foreground">需要你确认</span>
									</div>
									<p className="mt-1 text-[11px] leading-5 text-muted">
										大屏放 8 个节点：标题条 + 4 张指标卡 + 折线 + 漏斗 + 排行榜。主色沿用科技色，
										阈值：GMV 低于 60 万标黄。
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Btn size="sm" variant="primary" icon="icon-[lucide--square-plus]">
										插入画布并运行
									</Btn>
									<Btn size="sm" variant="ghost">
										先看草稿
									</Btn>
									<span className="ml-auto text-[10px] text-faint">不写库</span>
								</div>
							</div>
						</div>
					</div>

					<div className="flex shrink-0 flex-col gap-2 border-t border-border px-3 py-3">
						<div className="flex h-14 items-start gap-2 rounded-card border border-border bg-surface px-2.5 py-2">
							<span className="mt-0.5 text-[12px] text-faint">还可以说：把华东换成西南，指标卡留两张…</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-[10px] text-faint">Enter 发送 · ⇧Enter 换行</span>
							<Btn size="sm" variant="primary" icon="icon-[lucide--send]" className="ml-auto">
								发送
							</Btn>
						</div>
					</div>
				</section>

				<div className="flex min-w-0 flex-1 flex-col">
					<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
						<Icon name="icon-[lucide--layout-dashboard]" className="size-3.5 shrink-0 text-muted" />
						<span className="text-[13px] font-semibold text-surface-foreground">画布 · 草稿区</span>
						<Chip tone="accent">AI 已插入 3 个节点</Chip>
						<Chip tone="warning">4 个待确认</Chip>
						<div className="ml-auto flex shrink-0 items-center gap-2">
							<IconButton size="xs" icon="icon-[lucide--minus]" title="缩小" />
							<span className="w-9 shrink-0 text-center font-mono text-[11px] tabular-nums text-muted">100%</span>
							<IconButton size="xs" icon="icon-[lucide--plus]" title="放大" />
						</div>
					</div>

					<CanvasGround groups={GROUPS} links={LINKS}>
						<NodeCard
							title="ods_orders"
							type="数据源"
							icon="icon-[lucide--database]"
							tone={TONE.table}
							x={24}
							y={40}
							w={190}
							h={104}
							outputs={[{ row: 0, tone: TONE.table }]}
						>
							<NodeRow label="连接">
								<NodeValue mono>prod-mysql</NodeValue>
							</NodeRow>
							<NodeRow label="模式">
								<NodeValue>直连 · 不落库</NodeValue>
							</NodeRow>
						</NodeCard>

						<NodeCard
							title="ds_orders"
							type="数据集"
							icon="icon-[lucide--scroll-text]"
							tone={TONE.table}
							x={240}
							y={40}
							w={190}
							h={104}
							inputs={[{ row: 0, tone: TONE.table }]}
							outputs={[{ row: 1, tone: TONE.table }]}
						>
							<NodeRow label="字段">
								<NodeValue mono>8 列</NodeValue>
							</NodeRow>
							<NodeRow label="来源">
								<NodeValue>AI 写的 SQL</NodeValue>
							</NodeRow>
						</NodeCard>

						<NodeCard
							title="line_gmv_14d"
							type="折线图"
							icon="icon-[lucide--chart-line]"
							tone={TONE.chart}
							x={456}
							y={24}
							w={196}
							h={120}
							inputs={[{ row: 0, tone: TONE.table }]}
							outputs={[{ row: 2, tone: TONE.chart }]}
						>
							<NodeRow label="X 轴">
								<NodeValue mono>date</NodeValue>
							</NodeRow>
							<NodeRow label="Y 轴">
								<NodeValue mono>gmv</NodeValue>
							</NodeRow>
							<NodeRow label="对比">
								<NodeValue>去年同期</NodeValue>
							</NodeRow>
						</NodeCard>

						<NodeCard
							title="donut_channel"
							type="环图"
							icon="icon-[lucide--chart-pie]"
							tone={TONE.chart}
							x={456}
							y={172}
							w={196}
							h={120}
							inputs={[{ row: 0, tone: TONE.table }]}
							outputs={[{ row: 2, tone: TONE.chart }]}
						>
							<NodeRow label="维度">
								<NodeValue mono>channel</NodeValue>
							</NodeRow>
							<NodeRow label="高亮">
								<NodeValue>抖音 · 华东</NodeValue>
							</NodeRow>
							<NodeRow label="调色板">
								<NodeValue>科技</NodeValue>
							</NodeRow>
						</NodeCard>

						<div className="absolute left-[32px] top-[368px] flex items-center gap-3">
							{PENDING.map((p) => (
								<div
									key={p.label}
									className="flex h-[46px] w-[228px] items-center gap-2 rounded-card border border-dashed border-border-strong bg-surface/60 px-3"
								>
									<Icon name={p.icon} className="size-4 shrink-0 text-muted" />
									<span className="text-[11px] text-muted">{p.label}</span>
									<Icon name="icon-[lucide--clock]" className="ml-auto size-3.5 shrink-0 text-faint" />
								</div>
							))}
						</div>

						<div className="absolute bottom-4 left-6 right-6 flex h-9 items-center gap-3 rounded-card border border-border bg-surface-raised px-3">
							<Icon name="icon-[lucide--lock]" className="size-3.5 shrink-0 text-faint" />
							<span className="text-[10px] text-faint">
								会话不直接改工作树；AI 生成的节点先落在草稿区，确认后才接进主链路
							</span>
							<span className="ml-auto font-mono text-[10px] text-faint">本次会话 #7f2a</span>
						</div>
					</CanvasGround>
				</div>
			</div>
		</div>
	);
}
