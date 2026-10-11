import Btn from "../Btn";
import Chip from "../Chip";
import Icon from "../Icon";
import IconButton from "../IconButton";

/**
 * 顶部工具条 — adr-0009 §3.2(b)：保存、预览、撤销重做、主题切换、快捷键入口。
 * 节点式之后多了一个主要动作：运行。组件成了数据流上的节点，
 * 所以「运行画布」取代了原来的「预览」，「AI 生成节点」对应 §4 的生成器。
 *
 * 自动布局与主题是**看板**属性；栅格列数已由节点布局自己决定，不再放在这里。
 */
export default function EditorToolbar() {
	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
			<IconButton icon="icon-[lucide--arrow-left]" title="返回 BI 数据资产" />
			<span className="h-5 w-px shrink-0 bg-border" />

			<span className="truncate text-[14px] font-semibold text-surface-foreground">
				渠道经营看板
			</span>
			<Chip>看板</Chip>
			<span className="flex shrink-0 items-center gap-1.5 text-[11px] whitespace-nowrap text-warning">
				<span className="size-1.5 rounded-full bg-warning" />
				未保存的更改
			</span>

			<span className="ml-1 font-mono text-[11px] tabular-nums whitespace-nowrap text-faint">
				6 节点 · 3 页 · 上次保存 10:24
			</span>

			<div className="ml-auto flex shrink-0 items-center gap-1.5">
				<div className="flex items-center gap-0.5">
					<IconButton icon="icon-[lucide--rotate-ccw]" title="撤销 ⌘Z" />
					<IconButton icon="icon-[lucide--rotate-cw]" title="重做 ⇧⌘Z" disabled />
				</div>
				<span className="h-5 w-px shrink-0 bg-border" />

				{/* 看板级：节点布局档位。列数由布局算法决定，不再手选 12 / 24 列。 */}
				<button
					type="button"
					className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2 text-[12px] text-surface-foreground"
				>
					<Icon name="icon-[lucide--layout-grid]" className="size-3.5 text-muted" />
					自动布局
					<Icon name="icon-[lucide--chevron-down]" className="size-3 text-faint" />
				</button>

				{/* 页面级：深浅主题。看板默认深色，浅色留给打印与汇报。 */}
				<div className="flex items-center rounded-control border border-border bg-surface p-0.5">
					<span className="flex h-6 items-center rounded-[4px] bg-accent-soft px-2 text-[12px] font-medium text-accent">
						深色
					</span>
					<span className="flex h-6 items-center px-2 text-[12px] text-muted">浅色</span>
				</div>

				<IconButton icon="icon-[lucide--ruler]" title="对齐辅助线：开" active />
				<span className="h-5 w-px shrink-0 bg-border" />

				<Btn variant="ai" size="sm" icon="icon-[lucide--wand-sparkles]">
					AI 生成节点
				</Btn>
				<IconButton icon="icon-[lucide--keyboard]" title="快捷键 ⌘/" />
				<Btn size="sm" icon="icon-[lucide--layout-dashboard]">
					预览产物
				</Btn>
				<Btn size="sm" variant="primary" icon="icon-[lucide--play]">
					运行画布
				</Btn>
				<Btn size="sm" icon="icon-[lucide--save]">
					保存
				</Btn>
			</div>
		</header>
	);
}
