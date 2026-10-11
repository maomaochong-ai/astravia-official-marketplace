import Btn from "../Btn";
import Chip from "../Chip";
import Icon from "../Icon";
import IconButton from "../IconButton";

export type ParamRow = { field: string; value: string; from: "ai" | "user" | "dataset" };

const FROM_CHIP = {
	ai: { text: "AI 推断", tone: "ai" },
	user: { text: "手动", tone: "default" },
	dataset: { text: "取自数据集", tone: "default" },
} as const;

/**
 * AI 生成节点 —— 一句话到一整套参数。左边是对话，右边是它填进去的东西：
 * 每一行都标出这个值是谁给的（AI 推断 / 手动 / 取自数据集），因为「能不能改」
 * 取决于「知不知道它是哪来的」。用户在对话里改、在节点上改，都是改同一份参数。
 */
export function AiGenerateDialog({ x, y }: { x: number; y: number }) {
	const rows: ParamRow[] = [
		{ field: "图表类型", value: "折线图 · 面积", from: "ai" },
		{ field: "数据集", value: "SQL ds_orders · 一键套用", from: "dataset" },
		{ field: "X 轴", value: "日期 · 近 14 天", from: "ai" },
		{ field: "Y 轴", value: "GMV(元) · 求和", from: "ai" },
		{ field: "对比", value: "去年同期 · 虚线", from: "ai" },
		{ field: "调色板", value: "科技", from: "user" },
	];

	return (
		<div
			className="absolute z-30 w-[336px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]"
			style={{ left: x, top: y }}
		>
			<header className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
				<Icon name="icon-[lucide--wand-sparkles]" className="size-3.5 shrink-0 text-ai" />
				<span className="text-[11px] font-medium text-surface-foreground">AI 生成节点</span>
				<span className="ml-auto flex shrink-0 items-center gap-1.5">
					<Chip>宿主模型</Chip>
					<IconButton size="xs" icon="icon-[lucide--x]" title="关闭" />
				</span>
			</header>

			<div className="flex items-start gap-2 border-b border-border px-3 py-2.5">
				<span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft">
					<Icon name="icon-[lucide--bot]" className="size-3 text-accent" />
				</span>
				<p className="text-[11px] leading-4 text-surface-foreground">
					把 ods_orders 按渠道做近 14 天 GMV 趋势，标出去年同期，颜色用科技色。
				</p>
			</div>

			<div className="px-3 py-2">
				<div className="flex h-6 items-center gap-2">
					<span className="text-[10px] text-faint">生成结果</span>
					<span className="font-mono text-[10px] text-surface-foreground">line_gmv_14d</span>
					<span className="ml-auto text-[10px] text-muted">6 项参数 · 4 项待确认</span>
				</div>
				{rows.map((r) => (
					<div key={r.field} className="flex h-6 items-center gap-2">
						<span className="w-[52px] shrink-0 truncate text-[10px] text-muted">{r.field}</span>
						<span className="min-w-0 flex-1 truncate text-[10px] text-surface-foreground">{r.value}</span>
						<span
							className={`shrink-0 rounded-chip px-1.5 text-[9px] ${
								r.from === "ai" ? "bg-ai-soft text-ai" : "bg-neutral-muted text-muted"
							}`}
						>
							{FROM_CHIP[r.from].text}
						</span>
					</div>
				))}
			</div>

			<footer className="flex h-11 shrink-0 items-center gap-2 border-t border-border bg-background px-3">
				<span className="flex h-6 items-center gap-1.5 rounded-chip bg-success-soft px-2 text-[10px] text-success">
					<span className="size-1.5 shrink-0 rounded-full bg-success" />
					未写入数据库
				</span>
				<div className="ml-auto flex shrink-0 items-center gap-2">
					<Btn variant="ghost">重新生成</Btn>
					<Btn variant="primary">插入画布</Btn>
				</div>
			</footer>
		</div>
	);
}

/**
 * AI 调整单个参数 —— 从节点上的某一项参数旁边长出来的小卡片。它不重写整张图，
 * 只改这一格，并把「改之前 / 改之后」摆在一起，让人一眼看出 AI 动了什么。
 */
export function ParamSuggest({ x, y }: { x: number; y: number }) {
	const chips = ["改为按周聚合", "换成堆叠", "加去年同期对比"];
	return (
		<div
			className="absolute z-30 w-[264px] overflow-hidden rounded-card border border-ai bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]"
			style={{ left: x, top: y }}
		>
			<header className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-background px-2.5">
				<Icon name="icon-[lucide--wand-sparkles]" className="size-3.5 shrink-0 text-ai" />
				<span className="text-[11px] font-medium text-surface-foreground">AI 调整 · 这一格</span>
			</header>

			<div className="px-2.5 py-2">
				<span className="text-[10px] text-faint">聚合方式</span>
				<div className="mt-1 flex h-6 items-center gap-2">
					<span className="text-[10px] text-muted line-through">按日求和</span>
					<Icon name="icon-[lucide--arrow-right]" className="size-3 shrink-0 text-faint" />
					<span className="rounded-[4px] bg-ai-soft px-1.5 py-0.5 text-[10px] font-medium text-ai">
						按周求和（ISO 周）
					</span>
				</div>
				<p className="mt-2 text-[10px] leading-4 text-muted">
					近 14 天拆成 3 个整周，趋势节点更少但更稳；同比列会跟着对齐到周。
				</p>
				<div className="mt-2 flex flex-wrap gap-1">
					{chips.map((c) => (
						<span
							key={c}
							className="flex h-6 items-center rounded-chip border border-border bg-surface px-2 text-[10px] text-surface-foreground"
						>
							{c}
						</span>
					))}
				</div>
			</div>

			<footer className="flex h-10 shrink-0 items-center gap-2 border-t border-border bg-background px-2.5">
				<span className="text-[10px] text-faint">只改这一格</span>
				<div className="ml-auto flex shrink-0 items-center gap-2">
					<Btn variant="ghost">忽略</Btn>
					<Btn variant="primary" icon="icon-[lucide--check]">
						应用
					</Btn>
				</div>
			</footer>
		</div>
	);
}
