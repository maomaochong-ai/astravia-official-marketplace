/**
 * shortcuts-dialog.tsx — 画布快捷键速查表（顶栏 ⌘/ 打开）。
 *
 * 这里只列**已经实现**的按键：node-graph.tsx 的 window keydown（框选/删除/复制粘贴/
 * 停用/网格/适配视图/取消选中）+ editor-toolbar.tsx 的 ⌘S / ⌘R / ⌘[ / 撤销重做。
 * 不给规划中的功能占位，免得用户按了没反应。
 *
 * 对齐设计稿 frames/editor.tsx 的浮层形态：scrim + 居中卡片，Esc / 点遮罩关闭。
 */

import { useEffect, type JSX } from "react";
import { Icon } from "../../shared/components/ui/icon";

interface ShortcutRow {
	keys: string[];
	label: string;
}

interface ShortcutGroup {
	title: string;
	icon: string;
	rows: ShortcutRow[];
}

const GROUPS: ShortcutGroup[] = [
	{
		title: "画布",
		icon: "icon-[lucide--move]",
		rows: [
			{ keys: ["拖拽节点"], label: "移动节点（按网格步长吸附）" },
			{ keys: ["Alt", "拖拽"], label: "从原节点克隆一份新的" },
			{ keys: ["拖拽插槽"], label: "从输出圆点连到输入圆点" },
			{ keys: ["空白拖拽"], label: "框选多个节点" },
			{ keys: ["滚轮"], label: "平移画布" },
			{ keys: ["⌘", "滚轮"], label: "以指针为中心缩放（25%–250%）" },
			{ keys: ["双击空白"], label: "在落点添加节点" },
		],
	},
	{
		title: "编辑",
		icon: "icon-[lucide--copy]",
		rows: [
			{ keys: ["⌘", "Z"], label: "撤销" },
			{ keys: ["⇧⌘", "Z"], label: "重做（Windows 也可用 ⌘Y）" },
			{ keys: ["⌘", "C"], label: "复制选中节点（含两者之间的连线）" },
			{ keys: ["⌘", "V"], label: "粘贴到原位偏移 24px 处" },
			{ keys: ["⌘", "D"], label: "原地复制选中节点" },
			{ keys: ["⌘", "M"], label: "停用 / 启用选中节点" },
			{ keys: ["⌘", "A"], label: "全选节点" },
			{ keys: ["Delete"], label: "删除选中节点及其连线" },
		],
	},
	{
		title: "运行与视图",
		icon: "icon-[lucide--circle-play]",
		rows: [
			{ keys: ["⌘", "R"], label: "运行全部节点（跳过节）" },
			{ keys: ["⌘", "S"], label: "保存画布" },
			{ keys: ["G"], label: "网格吸附开 / 关" },
			{ keys: ["Home"], label: "适配视图（有选中则聚焦选中节点）" },
			{ keys: ["Esc"], label: "取消选中 / 关闭右键菜单与浮层" },
			{ keys: ["⌘", "["], label: "返回 BI 数据资产" },
		],
	},
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }): JSX.Element {
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<div className="fixed inset-0 z-50 grid place-items-center bg-scrim/60" onClick={onClose}>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="画布快捷键"
				className="w-[660px] max-w-[calc(100vw-48px)] overflow-hidden rounded-card border border-border bg-surface-raised shadow-2xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex h-10 items-center gap-2 border-b border-border bg-background px-3">
					<Icon name="icon-[lucide--keyboard]" className="size-3.5 text-accent" />
					<span className="text-[12px] font-medium text-surface-foreground">画布快捷键</span>
					<button
						type="button"
						className="ml-auto grid size-5 place-items-center rounded-[2px] text-faint hover:bg-border"
						onClick={onClose}
					>
						<Icon name="icon-[lucide--x]" className="size-3" />
					</button>
				</div>

				<div className="grid max-h-[70vh] grid-cols-3 gap-4 overflow-y-auto p-4">
					{GROUPS.map((group) => (
						<div key={group.title} className="flex flex-col gap-1.5">
							<div className="flex items-center gap-1.5">
								<Icon name={group.icon} className="size-3 text-muted" />
								<span className="text-[11px] font-medium text-muted">{group.title}</span>
							</div>
							{group.rows.map((row) => (
								<div key={row.label} className="flex flex-col gap-0.5">
									<span className="flex flex-wrap items-center gap-0.5">
										{row.keys.map((k, i) => (
											<span key={`${k}-${i}`} className="flex items-center gap-0.5">
												<span className="rounded-[4px] border border-border bg-surface px-1 py-px font-mono text-[10px] leading-4 text-surface-foreground">
													{k}
												</span>
												{i < row.keys.length - 1 ? (
													<span className="font-mono text-[10px] text-faint">+</span>
												) : null}
											</span>
										))}
									</span>
									<span className="text-[11px] text-faint">{row.label}</span>
								</div>
							))}
						</div>
					))}
				</div>

				<div className="flex items-center gap-1 border-t border-border bg-background px-3 py-2">
					<Icon name="icon-[lucide--keyboard]" className="size-3 shrink-0 text-faint" />
					<span className="text-[10px] text-faint">
						Windows / Linux 上 ⌘ 即 Ctrl；文本框聚焦时 ⌘Z 交给输入框自己处理。
					</span>
				</div>
			</div>
		</div>
	);
}
