/**
 * 连接树收起态图标列 —— 设计稿 ConnectionTree.tsx 的 `collapsed` 分支。
 *
 * 收起后左栏只剩 36px，放不下连接树的工具栏。这里只保留**有真实行为**的控件：
 *   展开连接树 / 多选库表 / 导入连接。
 *
 * 设计稿的收起分支里还有「连接」「表」两个分区图标（database / table-2）。它们在收起态
 * 没有任何可以滚动或选中的目标 —— 保留下来就是「看着像按钮、点了没反应」的死图标
 * （用户实测反馈），故删除；收起态本来就不显示树，分区语义由展开后的连接树承担。
 *
 * 展开 / 多选 / 导入 三个动作全部接在真实路径上：多选走 WorkbenchProvider 的
 * toggleSelectionMode，导入用 hooks/use-connection-transfer（与工具栏同一份实现，
 * 导入成功后刷新连接列表）。
 *
 * 这里是纯展示组件：异步流程与提示都在上面那个 hook 里。
 */

import type { JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";
import { useConnectionTransfer } from "../hooks/use-connection-transfer";

/** 收起态图标按钮的公共几何（24/28px 区间取 28px，与设计稿 IconButton 默认一致）。 */
const RAIL_ITEM = "flex size-7 shrink-0 items-center justify-center rounded-control transition-colors";
const RAIL_ITEM_IDLE = "text-muted hover:bg-neutral-muted hover:text-surface-foreground";

export function ConnectionTreeRail({ onExpand }: { onExpand?: () => void }): JSX.Element {
	const { selectionMode, toggleSelectionMode, refreshConnections } = useWorkbench();
	const { importing, fileInputRef, triggerImport, handleImportFile } = useConnectionTransfer({
		onImported: () => refreshConnections(),
	});

	return (
		<div className="flex h-full w-full flex-col items-center gap-1 bg-surface-raised py-1.5">
			<button type="button" onClick={() => onExpand?.()} title="展开连接树" className={`${RAIL_ITEM} ${RAIL_ITEM_IDLE}`}>
				<span className="icon-[lucide--panel-left-open] size-3.5" />
			</button>
			<span className="my-1 h-px w-5 shrink-0 bg-border" />
			<button
				type="button"
				onClick={() => toggleSelectionMode()}
				title={selectionMode ? "退出多选" : "多选库 / 表"}
				aria-pressed={selectionMode}
				className={`${RAIL_ITEM} ${selectionMode ? "bg-accent-soft text-accent" : RAIL_ITEM_IDLE}`}
			>
				<span className="icon-[lucide--square-check-big] size-3.5" />
			</button>
			<button
				type="button"
				onClick={triggerImport}
				disabled={importing}
				title="导入连接"
				className={`${RAIL_ITEM} ${RAIL_ITEM_IDLE} disabled:opacity-40`}
			>
				<span className="icon-[lucide--folder-input] size-3.5" />
			</button>
			<input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void handleImportFile(e)} />
		</div>
	);
}
