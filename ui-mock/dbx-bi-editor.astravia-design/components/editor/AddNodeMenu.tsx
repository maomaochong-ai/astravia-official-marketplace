import Icon from "../Icon";

type Item = { icon: string; label: string; hint?: string; active?: boolean };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
	{
		label: "数据",
		items: [
			{ icon: "icon-[lucide--database]", label: "数据源", hint: "MySQL" },
			{ icon: "icon-[lucide--table-2]", label: "SQL 数据集", hint: "一键套用" },
			{ icon: "icon-[lucide--scroll-text]", label: "手写 SQL" },
			{ icon: "icon-[lucide--upload]", label: "本地文件", hint: "CSV" },
		],
	},
	{
		label: "图表",
		items: [
			{ icon: "icon-[lucide--chart-line]", label: "折线图", hint: "6 变体", active: true },
			{ icon: "icon-[lucide--chart-column]", label: "柱状图", hint: "5 变体" },
			{ icon: "icon-[lucide--chart-pie]", label: "饼图 / 环图" },
			{ icon: "icon-[lucide--gauge]", label: "指标卡" },
		],
	},
	{
		label: "大屏",
		items: [
			{ icon: "icon-[lucide--monitor]", label: "大屏标题" },
			{ icon: "icon-[lucide--activity]", label: "大屏指标卡" },
			{ icon: "icon-[lucide--list-ordered]", label: "大屏排行榜" },
		],
	},
	{
		label: "控件与产物",
		items: [
			{ icon: "icon-[lucide--list-filter]", label: "筛选器" },
			{ icon: "icon-[lucide--layout-dashboard]", label: "看板产物页面" },
			{ icon: "icon-[lucide--share-2]", label: "发布与分享" },
		],
	},
];

const VARIANTS = ["基础折线", "面积", "堆叠", "双轴", "平滑", "阶梯"];

/**
 * 画布右键菜单 —— 「添加节点」这件事的入口。菜单只做一件事：把节点类型摆成人能认的
 * 分组，并在右侧展开所选类型的变体。光标位置是这条菜单的坐标，节点就落在那里。
 */
export default function AddNodeMenu({ x, y }: { x: number; y: number }) {
	return (
		<>
			<div
				className="absolute z-30 w-[248px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]"
				style={{ left: x, top: y }}
			>
				<div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-background px-2.5">
					<Icon name="icon-[lucide--square-plus]" className="size-3.5 shrink-0 text-accent" />
					<span className="text-[11px] font-medium text-surface-foreground">添加节点</span>
					<span className="ml-auto font-mono text-[10px] tabular-nums text-faint">X 528 · Y 296</span>
				</div>

				<div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-2.5">
					<Icon name="icon-[lucide--search]" className="size-3.5 shrink-0 text-faint" />
					<span className="text-[11px] text-faint">搜索节点类型…</span>
					<span className="ml-auto rounded-[3px] border border-border px-1 font-mono text-[9px] text-faint">/</span>
				</div>

				<div className="py-1">
					{GROUPS.map((g) => (
						<div key={g.label} className="px-1 py-0.5">
							<div className="px-2 py-1 text-[10px] text-faint">{g.label}</div>
							{g.items.map((it) => (
								<div
									key={it.label}
									className={`flex h-7 items-center gap-2 rounded-[4px] px-2 ${
										it.active ? "bg-accent-soft text-accent" : "text-surface-foreground"
									}`}
								>
									<Icon name={it.icon} className="size-3.5 shrink-0" />
									<span className="min-w-0 flex-1 truncate text-[11px]">{it.label}</span>
									{it.hint ? <span className="shrink-0 font-mono text-[9px] text-faint">{it.hint}</span> : null}
									{it.active ? <Icon name="icon-[lucide--chevron-right]" className="size-3 shrink-0" /> : null}
								</div>
							))}
						</div>
					))}
				</div>

				<div className="flex h-7 shrink-0 items-center gap-1.5 border-t border-border bg-background px-2.5 text-[10px] text-faint">
					<Icon name="icon-[lucide--mouse-pointer-click]" className="size-3 shrink-0" />
					<span>画布空白处双击 = 直接插入上一次的类型</span>
				</div>
			</div>

			<div
				className="absolute z-30 w-[176px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]"
				style={{ left: x + 248, top: y + 152 }}
			>
				<div className="flex h-8 items-center gap-2 border-b border-border bg-background px-2.5">
					<Icon name="icon-[lucide--chart-line]" className="size-3.5 shrink-0 text-series-2" />
					<span className="text-[11px] font-medium text-surface-foreground">折线图</span>
				</div>
				<div className="py-1">
					{VARIANTS.map((v) => (
						<span key={v} className="flex h-6 items-center px-2.5 text-[11px] text-muted">
							{v}
						</span>
					))}
				</div>
				<div className="flex h-7 items-center border-t border-border bg-background px-2.5 text-[10px] text-faint">
					插入后可用 AI 改参数
				</div>
			</div>
		</>
	);
}
