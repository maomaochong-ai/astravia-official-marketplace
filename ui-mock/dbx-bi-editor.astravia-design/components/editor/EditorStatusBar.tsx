import Icon from "../Icon";
import IconButton from "../IconButton";

/**
 * 底部状态栏 —— 从「多页签」变成「一次运行的账」：左边是这次运行的状态，
 * 中间是图的规模（节点 / 连接 / 产物页），右边才是产物本身。
 * 节点式之后页签不再是编辑面的导航，而是运行之后长出来的产物页面。
 */

const PAGES = [
	{ name: "概览", active: true, dirty: true },
	{ name: "渠道明细", active: false, dirty: false },
	{ name: "城市分布", active: false, dirty: false },
];

export default function EditorStatusBar() {
	return (
		<footer className="flex h-11 shrink-0 items-center gap-3 border-t border-border bg-surface-raised px-3">
			<div className="flex shrink-0 items-center gap-1.5">
				<span className="flex h-6 shrink-0 items-center gap-1.5 rounded-chip bg-success-soft px-2 text-[11px] whitespace-nowrap text-success">
					<span className="size-1.5 shrink-0 rounded-full bg-success" />
					已运行 · 10:24 · 1.2s
				</span>
				<span className="flex h-6 shrink-0 items-center gap-1.5 rounded-chip bg-warning-soft px-2 text-[11px] whitespace-nowrap text-warning">
					<span className="size-1.5 shrink-0 rounded-full bg-warning" />1 个变更未运行
				</span>
			</div>

			<span className="h-5 w-px shrink-0 bg-border" />

			<span className="font-mono text-[11px] tabular-nums whitespace-nowrap text-faint">
				节点 6 · 连接 5 · 产物 3 页
			</span>

			<div className="ml-auto flex shrink-0 items-center gap-2">
				<span className="shrink-0 text-[10px] text-faint">产物页面</span>
				<div className="flex shrink-0 items-center gap-1">
					{PAGES.map((p) => (
						<span
							key={p.name}
							className={`flex h-7 shrink-0 items-center gap-1.5 rounded-control border px-2.5 text-[11px] whitespace-nowrap ${
								p.active
									? "border-border bg-surface font-medium text-surface-foreground"
									: "border-transparent text-muted"
							}`}
						>
							{p.name}
							{p.dirty ? <span className="size-1.5 shrink-0 rounded-full bg-warning" /> : null}
							{p.active ? (
								<Icon name="icon-[lucide--x]" className="size-3 shrink-0 text-faint" />
							) : null}
						</span>
					))}
					<IconButton size="sm" icon="icon-[lucide--plus]" title="新建产物页面" />
				</div>
				<span className="h-5 w-px shrink-0 bg-border" />
				<span className="font-mono text-[11px] tabular-nums whitespace-nowrap text-faint">
					自动保存已开启 · 10:24
				</span>
				<IconButton size="sm" icon="icon-[lucide--layers]" title="产物图层顺序" />
			</div>
		</footer>
	);
}
