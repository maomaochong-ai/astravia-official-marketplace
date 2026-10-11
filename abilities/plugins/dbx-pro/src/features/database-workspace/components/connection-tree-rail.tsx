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
 * toggleSelectionMode，导入复用 services/connection-transfer 的
 * importConnectionsFromText（与工具栏同一个导入实现，导入后刷新连接列表）。
 */

import { useRef, useState, type ChangeEvent, type JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";
import { importConnectionsFromText } from "../services/connection-transfer";

/** 收起态图标按钮的公共几何（24/28px 区间取 28px，与设计稿 IconButton 默认一致）。 */
const RAIL_ITEM = "flex size-7 shrink-0 items-center justify-center rounded-control transition-colors";
const RAIL_ITEM_IDLE = "text-muted hover:bg-neutral-muted hover:text-surface-foreground";

export function ConnectionTreeRail({ onExpand }: { onExpand?: () => void }): JSX.Element {
	const { selectionMode, toggleSelectionMode, refreshConnections } = useWorkbench();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [importing, setImporting] = useState(false);

	async function handleImportFile(e: ChangeEvent<HTMLInputElement>): Promise<void> {
		const file = e.target.files?.[0];
		// 清空 value：否则第二次选同一个文件不会再触发 change。
		e.target.value = "";
		if (!file) return;
		setImporting(true);
		try {
			const text = await file.text();
			const result = await importConnectionsFromText(text);
			if (result.total === 0) {
				alert("文件中没有可导入的连接（每条连接至少需要 name / db_type / host）");
			} else {
				alert(`导入完成：新增 ${result.imported} 个，更新 ${result.updated} 个，失败 ${result.failed} 个`);
			}
			await refreshConnections();
		} catch (err) {
			alert(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setImporting(false);
		}
	}

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
				onClick={() => fileInputRef.current?.click()}
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
