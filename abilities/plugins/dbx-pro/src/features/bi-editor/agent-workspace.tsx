/**
 * agent-workspace.tsx — BI · 智能体会话（对齐设计稿 frames/agent.tsx）。
 *
 * 智能体对话不同于单节点 AI 生成：它管一整张看板或大屏，把计划列成人能读的步骤，
 * 每一步对应画布上真实存在的节点，做完一步勾一步。AI 生成的节点先落在草稿区，
 * 用户确认「插入画布并运行」才真正接进主链路——会话本身不直接改工作树。
 *
 * 布局：
 *   ┌─ EditorToolbar（返回/看板名/运行态）
 *   ├──────────────┬──────────────────────────────┤
 *   │ 左栏 400px   │  右栏：画布草稿区              │
 *   │ 智能体会话   │  CanvasGround + NodeCard      │
 *   │ - 消息列表   │  + 待确认占位 + 底部状态条     │
 *   │ - 计划步骤   │                                │
 *   │ - 发送输入框 │                                │
 *   └──────────────┴──────────────────────────────┘
 *
 * 数据流：
 *   · 会话消息 / 草稿节点 → 本地 state（宿主 AI 端点暂未暴露，AI 回复为占位骨架）
 *   · 插入按钮 → onInsert 回调把草稿节点交给外层编辑器合并到正式画布
 */

import { useCallback, useRef, useState, type JSX } from "react";
import { CanvasGround } from "./components/canvas-ground";
import { NodeCard, TONE } from "./components/node-card";
import { Icon } from "./components/ui/icon";
import { Chip } from "./components/ui/chip";
import { IconButton } from "./components/ui/icon-button";
import { Btn } from "./components/ui/btn";

// ── 类型 ──

type StepState = "done" | "run" | "todo";

interface PlanStep {
	id: string;
	label: string;
	note: string;
	state: StepState;
}

type ChatRole = "user" | "ai";

interface ChatMessage {
	id: string;
	role: ChatRole;
	text: string;
	plan?: PlanStep[];
	confirmCard?: { title: string; body: string };
	actions?: { primary: string; secondary: string };
}

interface DraftNodePos {
	id: string;
	title: string;
	type: string;
	icon: string;
	tone: string;
	x: number;
	y: number;
	w: number;
	h: number;
	inputs?: { row: number; tone: string }[];
	outputs?: { row: number; tone: string }[];
	rows?: { label: string; value: string }[];
}

interface DraftLink {
	x1: number; y1: number; x2: number; y2: number; tone: string;
}

interface PendingSlot {
	icon: string;
	label: string;
}

// ── 初始会话 + 草稿（设计稿骨架占位，不抄 mock 数据） ──

function makeInitialPlan(): PlanStep[] {
	return [
		{ id: "s1", label: "接上数据源 ods_orders", note: "已完成", state: "done" },
		{ id: "s2", label: "写 SQL 汇总出 ds_orders", note: "已完成", state: "done" },
		{ id: "s3", label: "生成 3 个图表节点", note: "已完成", state: "done" },
		{ id: "s4", label: "搭大屏骨架（标题 + 4 指标卡 + 排行榜）", note: "进行中", state: "run" },
		{ id: "s5", label: "绑定筛选器与日期区间", note: "待办", state: "todo" },
		{ id: "s6", label: "发布到工作树并给出链接", note: "待办", state: "todo" },
	];
}

function makeInitialDraftNodes(): DraftNodePos[] {
	return [
		{ id: "n1", title: "ods_orders", type: "数据源", icon: "icon-[lucide--database]", tone: TONE.table,
			x: 24, y: 40, w: 190, h: 104,
			outputs: [{ row: 0, tone: TONE.table }],
			rows: [{ label: "连接", value: "prod-mysql" }, { label: "模式", value: "直连 · 不落库" }] },
		{ id: "n2", title: "ds_orders", type: "数据集", icon: "icon-[lucide--scroll-text]", tone: TONE.table,
			x: 240, y: 40, w: 190, h: 104,
			inputs: [{ row: 0, tone: TONE.table }], outputs: [{ row: 1, tone: TONE.table }],
			rows: [{ label: "字段", value: "8 列" }, { label: "来源", value: "AI 写的 SQL" }] },
		{ id: "n3", title: "line_gmv_14d", type: "折线图", icon: "icon-[lucide--chart-line]", tone: TONE.chart,
			x: 456, y: 24, w: 196, h: 120,
			inputs: [{ row: 0, tone: TONE.table }], outputs: [{ row: 2, tone: TONE.chart }],
			rows: [{ label: "X 轴", value: "date" }, { label: "Y 轴", value: "gmv" }, { label: "对比", value: "去年同期" }] },
		{ id: "n4", title: "donut_channel", type: "环图", icon: "icon-[lucide--chart-pie]", tone: TONE.chart,
			x: 456, y: 172, w: 196, h: 120,
			inputs: [{ row: 0, tone: TONE.table }], outputs: [{ row: 2, tone: TONE.chart }],
			rows: [{ label: "维度", value: "channel" }, { label: "高亮", value: "抖音 · 华东" }, { label: "调色板", value: "科技" }] },
	];
}

const INITIAL_DRAFT_LINKS: DraftLink[] = [
	{ x1: 214, y1: 92, x2: 240, y2: 92, tone: TONE.table },
	{ x1: 430, y1: 92, x2: 456, y2: 84, tone: TONE.table },
	{ x1: 430, y1: 92, x2: 456, y2: 228, tone: TONE.table },
];

const PENDING_SLOTS: PendingSlot[] = [
	{ icon: "icon-[lucide--monitor]", label: "大屏标题" },
	{ icon: "icon-[lucide--activity]", label: "大屏指标卡 ×2" },
	{ icon: "icon-[lucide--list-ordered]", label: "大屏排行榜" },
];

// ── Step 图标按状态切换 ──
const STEP_ICON: Record<StepState, string> = {
	done: "icon-[lucide--circle-check]",
	run: "icon-[lucide--loader]",
	todo: "icon-[lucide--circle]",
};

const STEP_CLS: Record<StepState, string> = {
	done: "text-success",
	run: "text-accent animate-spin",
	todo: "text-faint",
};

// ── 组件 ──

export interface AgentWorkspaceProps {
	pageName?: string;
	onBack?: () => void;
	/** 插入画布并运行 → 把草稿节点交给外层编辑器合并 */
	onInsert?: (draft: { nodes: DraftNodePos[]; links: DraftLink[] }) => void;
}

export function AgentWorkspace({ pageName = "未命名看板", onBack, onInsert }: AgentWorkspaceProps): JSX.Element {
	// 会话状态
	const [messages, setMessages] = useState<ChatMessage[]>(() => [
		{ id: "m1", role: "user", text: "上一季度的渠道经营做一个大屏，重点看华东和抖音，深色底，数字要大。" },
		{
			id: "m2", role: "ai",
			text: "先把计划列出来，每一步都落在画布上真实存在的节点上：",
			plan: makeInitialPlan(),
			confirmCard: {
				title: "需要你确认",
				body: "大屏放 8 个节点：标题条 + 4 张指标卡 + 折线 + 漏斗 + 排行榜。主色沿用科技色，阈值：GMV 低于 60 万标黄。",
			},
			actions: { primary: "插入画布并运行", secondary: "先看草稿" },
		},
	]);
	const [input, setInput] = useState("");

	// 草稿画布状态
	const [draftNodes] = useState<DraftNodePos[]>(() => makeInitialDraftNodes());
	const [draftLinks] = useState<DraftLink[]>(() => INITIAL_DRAFT_LINKS);
	const [pendingCount] = useState(3);
	const [insertedCount] = useState(4);
	const [zoom, setZoom] = useState(1);

	// 会话 ID（不抄设计稿硬编码）
	const sessionRef = useRef<string>(`#${Math.random().toString(16).slice(2, 6)}`);

	const handleSend = useCallback(() => {
		const text = input.trim();
		if (!text) return;
		const userMsg: ChatMessage = { id: `u${Date.now()}`, role: "user", text };
		// AI 回复占位骨架（宿主没 AI 端点时）
		const aiMsg: ChatMessage = {
			id: `a${Date.now()}`, role: "ai",
			text: "收到，让我调整一下计划：",
			plan: makeInitialPlan().map((s) => ({ ...s })),
		};
		setMessages((prev) => [...prev, userMsg, aiMsg]);
		setInput("");
	}, [input]);

	const handleInsert = useCallback(() => {
		onInsert?.({ nodes: draftNodes, links: draftLinks });
	}, [onInsert, draftNodes, draftLinks]);

	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			{/* 顶栏：沿用编辑器 Toolbar 骨架但更紧凑 */}
			<header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
				<IconButton size="sm" icon="icon-[lucide--arrow-left]" title="返回" onClick={onBack} />
				<span className="h-4 w-px shrink-0 bg-border" />
				<Icon name="icon-[lucide--bot]" className="size-3.5 shrink-0 text-ai" />
				<span className="text-[13px] font-semibold text-surface-foreground">{pageName}</span>
				<Chip tone="ai">智能体</Chip>
				<span className="ml-auto font-mono text-[10px] text-faint">会话 {sessionRef.current} · 只读</span>
			</header>

			<div className="flex min-h-0 flex-1">
				{/* 左栏：智能体会话 */}
				<section className="flex w-[400px] shrink-0 flex-col border-r border-border bg-surface-raised">
					{/* 消息流 */}
					<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
						{messages.map((m) => (
							<div key={m.id}>
								{m.role === "user" ? (
									<div className="flex justify-end">
										<p className="max-w-[300px] rounded-card rounded-br-[4px] border border-border bg-surface px-2.5 py-2 text-[12px] leading-5 text-surface-foreground">
											{m.text}
										</p>
									</div>
								) : (
									<div className="flex gap-2">
										<span className="grid h-5 shrink-0 place-items-center">
											<Icon name="icon-[lucide--bot]" className="size-4 text-ai" />
										</span>
										<div className="flex min-w-0 flex-1 flex-col gap-2">
											<p className="text-[12px] leading-5 text-surface-foreground">{m.text}</p>

											{/* 计划步骤列表 */}
											{m.plan ? (
												<div className="flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2">
													{m.plan.map((s) => (
														<div key={s.id} className="flex h-6 items-center gap-2">
															<Icon name={STEP_ICON[s.state]} className={`size-3.5 shrink-0 ${STEP_CLS[s.state]}`} />
															<span className="min-w-0 flex-1 truncate text-[11px] text-surface-foreground">{s.label}</span>
															<span className="shrink-0 text-[10px] text-faint">{s.note}</span>
														</div>
													))}
												</div>
											) : null}

											{/* 需要你确认卡片 */}
											{m.confirmCard ? (
												<div className="rounded-card border border-ai bg-surface px-2.5 py-2">
													<div className="flex items-center gap-2">
														<Icon name="icon-[lucide--wand-sparkles]" className="size-3.5 shrink-0 text-ai" />
														<span className="text-[11px] font-medium text-surface-foreground">{m.confirmCard.title}</span>
													</div>
													<p className="mt-1 text-[11px] leading-5 text-muted">{m.confirmCard.body}</p>
												</div>
											) : null}

											{/* 操作按钮 */}
											{m.actions ? (
												<div className="flex items-center gap-2">
													<Btn size="sm" variant="primary" icon="icon-[lucide--square-plus]" onClick={handleInsert}>
														{m.actions.primary}
													</Btn>
													<Btn size="sm" variant="ghost">
														{m.actions.secondary}
													</Btn>
													<span className="ml-auto text-[10px] text-faint">不写库</span>
												</div>
											) : null}
										</div>
									</div>
								)}
							</div>
						))}
					</div>

					{/* 发送输入框 */}
					<div className="flex shrink-0 flex-col gap-2 border-t border-border px-3 py-3">
						<div className="flex h-14 items-start gap-2 rounded-card border border-border bg-surface px-2.5 py-2">
							<input
								type="text"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										handleSend();
									}
								}}
								placeholder="还可以说：把华东换成西南，指标卡留两张…"
								className="h-full w-full bg-transparent text-[12px] text-surface-foreground placeholder:text-faint focus:outline-none"
							/>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-[10px] text-faint">Enter 发送 · ⇧Enter 换行</span>
							<Btn size="sm" variant="primary" icon="icon-[lucide--send]" className="ml-auto" onClick={handleSend}>
								发送
							</Btn>
						</div>
					</div>
				</section>

				{/* 右栏：画布草稿区 */}
				<div className="flex min-w-0 flex-1 flex-col">
					{/* 画布顶栏 */}
					<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
						<Icon name="icon-[lucide--layout-dashboard]" className="size-3.5 shrink-0 text-muted" />
						<span className="text-[13px] font-semibold text-surface-foreground">画布 · 草稿区</span>
						<Chip tone="accent">AI 已插入 {insertedCount} 个节点</Chip>
						<Chip tone="warning">{pendingCount} 个待确认</Chip>
						<div className="ml-auto flex shrink-0 items-center gap-2">
							<IconButton size="xs" icon="icon-[lucide--minus]" title="缩小" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} />
							<span className="w-9 shrink-0 text-center font-mono text-[11px] tabular-nums text-muted">
								{Math.round(zoom * 100)}%
							</span>
							<IconButton size="xs" icon="icon-[lucide--plus]" title="放大" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} />
						</div>
					</div>

					{/* 画布（transform: scale 等比缩放容器） */}
					<div className="flex min-h-0 flex-1 items-center justify-center bg-screen p-6">
						<div
							className="relative aspect-[16/9] w-[960px] max-w-full overflow-hidden rounded-card border border-screen-line bg-background"
							style={{
								transform: `scale(${zoom})`,
								transformOrigin: "center center",
							}}
						>
							<CanvasGround links={draftLinks}>
								{draftNodes.map((n) => (
									<NodeCard
										key={n.id}
										title={n.title}
										type={n.type}
										icon={n.icon}
										tone={n.tone}
										x={n.x}
										y={n.y}
										w={n.w}
										h={n.h}
										inputs={n.inputs}
										outputs={n.outputs}
									>
										{n.rows?.map((r) => (
											<div key={r.label} className="flex h-5 items-center gap-2 px-2">
												<span className="w-[46px] shrink-0 text-[10px] text-muted">{r.label}</span>
												<span className="truncate font-mono text-[10px] text-surface-foreground">{r.value}</span>
											</div>
										))}
									</NodeCard>
								))}

								{/* 待确认占位（设计稿虚线框） */}
								<div className="absolute left-[32px] top-[368px] flex items-center gap-3">
									{PENDING_SLOTS.map((p) => (
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

								{/* 底部状态条 */}
								<div className="absolute bottom-4 left-6 right-6 flex h-9 items-center gap-3 rounded-card border border-border bg-surface-raised px-3">
									<Icon name="icon-[lucide--lock]" className="size-3.5 shrink-0 text-faint" />
									<span className="text-[10px] text-faint">
										会话不直接改工作树；AI 生成的节点先落在草稿区，确认后才接进主链路
									</span>
									<span className="ml-auto font-mono text-[10px] text-faint">本次会话 {sessionRef.current}</span>
								</div>
							</CanvasGround>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
