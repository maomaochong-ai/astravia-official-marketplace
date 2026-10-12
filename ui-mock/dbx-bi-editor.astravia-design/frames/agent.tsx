export const frame = { width: 1440, height: 1000, title: "BI · 画布与宿主会话协作生成看板" };

import Btn from "../components/Btn";
import Chip from "../components/Chip";
import Icon from "../components/Icon";
import IconButton from "../components/IconButton";
import Switch from "../components/Switch";
import CanvasGround, { type NodeLink } from "../components/editor/CanvasGround";
import EditorToolbar from "../components/editor/EditorToolbar";
import NodeCard, { NodeValue, NodeRow, TONE } from "../components/editor/NodeCard";

const GROUPS = [{ x: 740, y: 316, w: 676, h: 184, label: "宿主 AI 计划写入 · 等你在会话里确认", count: 3 }];

const LINKS: NodeLink[] = [
	{ x1: 214, y1: 212, x2: 240, y2: 212, tone: TONE.table },
	{ x1: 430, y1: 212, x2: 456, y2: 204, tone: TONE.table },
	{ x1: 430, y1: 212, x2: 456, y2: 348, tone: TONE.table },
];

const PENDING = [
	{ icon: "icon-[lucide--activity]", label: "大屏指标卡 ×2" },
	{ icon: "icon-[lucide--list-ordered]", label: "大屏排行榜" },
	{ icon: "icon-[lucide--filter]", label: "筛选器与日期区间" },
];

/**
 * 画布借用宿主会话生成 —— 画布这一侧没有对话面板，也没有输入框：会话说到底发生在宿主
 * （open-astravia）里，画布只做两件事——把「我现在是什么、选中了什么」递过去当上下文胶囊，
 * 再把宿主会话调用的画布工具写回来的结果，按节点状态摊在画布上（已写入 / 写入中 / 待确认）。
 * 于是这一帧要能回答的三个问题是：这批节点是谁写的、正在写哪一个、还差哪几个以及谁来点头。
 */
export default function CanvasHostHandoff() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<EditorToolbar />

			<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
				<Icon name="icon-[lucide--layout-dashboard]" className="size-3.5 shrink-0 text-muted" />
				<span className="truncate text-[13px] font-semibold text-surface-foreground">画布 · 草稿区</span>
				<Chip tone="accent">已写入 4 个节点</Chip>
				<Chip tone="ai">1 个写入中</Chip>
				<Chip tone="warning">3 个待确认</Chip>
				<div className="ml-auto flex shrink-0 items-center gap-2">
					<span className="font-mono text-[11px] tabular-nums whitespace-nowrap text-faint">会话 #7f2a</span>
					<Btn size="sm" icon="icon-[lucide--external-link]">
						打开宿主会话
					</Btn>
					<span className="h-5 w-px shrink-0 bg-border" />
					<IconButton size="xs" icon="icon-[lucide--minus]" title="缩小" />
					<span className="w-9 shrink-0 text-center font-mono text-[11px] tabular-nums text-muted">100%</span>
					<IconButton size="xs" icon="icon-[lucide--plus]" title="放大" />
				</div>
			</div>

			<CanvasGround groups={GROUPS} links={LINKS}>
				{/* 溯源：这四个节点是宿主会话写进来的，不是手拖的 */}
				<div className="absolute left-[24px] top-[122px] flex h-[18px] items-center gap-2">
					<Icon name="icon-[lucide--bot]" className="size-3 shrink-0 text-ai" />
					<span className="text-[10px] whitespace-nowrap text-muted">宿主 AI 写入</span>
					<span className="font-mono text-[10px] whitespace-nowrap text-faint">会话 #7f2a</span>
				</div>

				<NodeCard
					title="ods_orders"
					type="数据源"
					icon="icon-[lucide--database]"
					tone={TONE.table}
					x={24}
					y={160}
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
					y={160}
					w={190}
					h={104}
					selected
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
					y={144}
					w={196}
					h={120}
					selected
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
					y={292}
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

				{/* 选中即上下文：画布递给宿主会话的就是这么一小袋东西 */}
				<div className="absolute left-[24px] top-[426px] flex h-7 items-center gap-2 rounded-control border border-border bg-surface-raised px-2">
					<Icon name="icon-[lucide--box-select]" className="size-3 shrink-0 text-muted" />
					<span className="text-[11px] whitespace-nowrap text-surface-foreground">已选 2 个节点</span>
					<span className="h-4 w-px shrink-0 bg-border" />
					<Btn size="xs" variant="ai" icon="icon-[lucide--sparkles]">
						交给宿主 AI
					</Btn>
				</div>

				{/* 宿主会话此刻正在写的那一个：它是真实节点，只是内容还没落地 */}
				<NodeCard
					title="screen_title"
					type="标题条"
					icon="icon-[lucide--monitor]"
					tone={TONE.result}
					x={760}
					y={160}
					w={210}
					h={120}
				>
					<NodeRow label="来源">
						<NodeValue>宿主 AI</NodeValue>
					</NodeRow>
					<NodeRow label="会话">
						<NodeValue mono>#7f2a</NodeValue>
					</NodeRow>
					<NodeRow label="状态">
						<span className="flex min-w-0 flex-1 items-center gap-1.5">
							<Icon name="icon-[lucide--loader]" className="size-3 shrink-0 animate-spin text-ai" />
							<span className="truncate text-[10px] text-ai">写入中…</span>
						</span>
					</NodeRow>
				</NodeCard>

				{/* 计划里还没写的三块：虚线等着，点不点头在宿主会话里 */}
				<div className="absolute left-[760px] top-[336px] flex flex-col gap-2">
					{PENDING.map((p) => (
						<div
							key={p.label}
							className="flex h-[48px] w-[636px] items-center gap-2 rounded-card border border-dashed border-border-strong bg-surface/60 px-3"
						>
							<Icon name={p.icon} className="size-4 shrink-0 text-muted" />
							<span className="text-[11px] whitespace-nowrap text-muted">{p.label}</span>
							<span className="ml-auto flex shrink-0 items-center gap-1.5">
								<Icon name="icon-[lucide--clock]" className="size-3 shrink-0 text-faint" />
								<span className="text-[10px] whitespace-nowrap text-faint">待生成 · 等确认</span>
							</span>
						</div>
					))}
				</div>
			</CanvasGround>

			{/* 宿主那一侧：对话、计划、审批都在这里，画布只贡献上下文与画布工具 */}
			<section className="flex shrink-0 flex-col border-t border-border bg-surface">
				<div className="flex h-8 items-center gap-2 border-b border-border px-3">
					<Icon name="icon-[lucide--message-square]" className="size-3 shrink-0 text-faint" />
					<span className="shrink-0 text-[10px] whitespace-nowrap text-faint">宿主对话 · open-astravia</span>
					<span className="min-w-0 flex-1 truncate text-[10px] text-faint">
						画布不内嵌对话：只递一个上下文胶囊与画布工具；写回先落草稿区，确认后才接主链路
					</span>
					<span className="flex shrink-0 items-center gap-2">
						<Chip tone="ai" icon="icon-[lucide--bot]">
							宿主模型
						</Chip>
						<span className="font-mono text-[10px] tabular-nums whitespace-nowrap text-faint">会话 #7f2a · 生成中</span>
					</span>
				</div>

				<div className="flex items-center gap-3 px-3 py-2.5">
					<div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-control border border-border bg-surface-raised px-2">
						<span className="flex h-[18px] shrink-0 items-center gap-1 rounded-chip bg-ai-soft px-1.5 text-[10px] whitespace-nowrap text-ai">
							<Icon name="icon-[lucide--layout-dashboard]" className="size-2.5" />
							渠道经营看板 · 已选 2 个节点
							<Icon name="icon-[lucide--x]" className="size-2.5" />
						</span>
						<span className="min-w-0 flex-1 truncate text-[12px] text-surface-foreground">
							把大屏剩下 3 个节点补全，阈值照旧
						</span>
						<span className="h-4 w-px shrink-0 animate-pulse bg-accent" />
					</div>

					<div className="flex shrink-0 items-center gap-2">
						<Switch on />
						<span className="text-[11px] whitespace-nowrap text-surface-foreground">画布上下文</span>
						<span className="text-[10px] whitespace-nowrap text-faint">随本轮生效一次</span>
					</div>

					<Btn size="sm" variant="primary" icon="icon-[lucide--send]">
						发送
					</Btn>
				</div>
			</section>
		</div>
	);
}
