import Btn from "../Btn";
import Chip from "../Chip";
import Icon from "../Icon";
import IconButton from "../IconButton";

/**
 * 用自然语言和数据源直接长出节点的面板。它浮在画布之上而不是占掉第四栏：
 * 画布需要横向空间，而这个面板是「要用的时候才出现」的东西。
 * 面板里把三件事按同一条线摆清楚：连的是哪个数据源 → 要什么 → 生成的 SQL。
 */

type Props = { x: number; y: number; w: number; h: number };

export default function AiNodePanel({ x, y, w, h }: Props) {
	return (
		<div
			className="absolute z-30 flex flex-col rounded-card border border-border bg-surface-raised shadow-popover"
			style={{ left: x, top: y, width: w, height: h }}
		>
			<header className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
				<Icon name="icon-[lucide--wand-sparkles]" className="size-3.5 shrink-0 text-ai" />
				<span className="text-[12px] font-medium text-surface-foreground">AI 生成节点</span>
				<Chip tone="ai">写 SQL</Chip>
				<div className="ml-auto flex shrink-0 items-center">
					<IconButton size="xs" icon="icon-[lucide--panel-right-close]" title="收起面板" />
				</div>
			</header>

			<div className="flex min-h-0 flex-1 flex-col gap-2.5 px-3 py-2.5">
				<div className="flex h-[34px] shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2">
					<Icon name="icon-[lucide--database]" className="size-3.5 shrink-0 text-series-1" />
					<span className="min-w-0 flex-1 truncate text-[11px] text-surface-foreground">
						插件工作台 · MySQL
					</span>
					<span className="shrink-0 font-mono text-[10px] text-faint">orders_daily</span>
					<Icon name="icon-[lucide--chevron-down]" className="size-3 shrink-0 text-faint" />
				</div>

				<div className="shrink-0 rounded-control bg-neutral-muted px-2 py-1 text-[11px] text-surface-foreground">
					近 14 天 GMV 折线图，渠道用环形图
				</div>

				<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-control border border-border bg-background p-1.5">
					<div className="font-mono text-[10px] leading-[13px] text-muted">
						<div>
							<span className="text-accent">select</span> d, sum(gmv) as gmv
						</div>
						<div>
							<span className="text-accent">from</span> public.orders
						</div>
						<div>
							<span className="text-accent">where</span> d &gt;= current_date - 14
						</div>
					</div>
					<div className="mt-auto flex shrink-0 items-center gap-1.5 pt-1 text-[9px] text-faint">
						<Icon name="icon-[lucide--info]" className="size-2.5" />
						只读 · 仅 SELECT · 不改动源库
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-1.5">
					<Btn variant="ai" size="sm" icon="icon-[lucide--wand-sparkles]">
						生成节点
					</Btn>
					<Btn size="sm" icon="icon-[lucide--plus]">
						插入画布
					</Btn>
				</div>
			</div>
		</div>
	);
}
