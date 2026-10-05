/**
 * 连接管理工作区视图 — 从宿主侧边栏直接打开的独立面板（对齐小红书账号管理）。
 *
 * 与工作台内的弹窗共用同一套 useConnectionEditor / ConnectionList /
 * ConnectionFields，只是这里没有模态遮罩、占满整个工作区视图。
 * 增 / 删 / 改后编辑器内部自行刷新；回到主工作台时会重新加载连接。
 */

import type { JSX } from "react";
import { ConnectionFields } from "./connection-fields";
import { ConnectionList } from "./connection-list";
import { useConnectionEditor } from "../hooks/use-connection-editor";

export function ConnectionManagerView(): JSX.Element {
	const editor = useConnectionEditor();
	const { editing, view } = editor;

	return (
		<div data-astravia-plugin-root="dbx-pro" className="dbx-root relative flex h-full w-full min-h-0 flex-col bg-background text-foreground">
			<div
				className="flex h-9 shrink-0 items-center justify-between px-3 text-[13px] font-semibold"
				style={{ borderBottom: "1px solid var(--dbx-line-soft)" }}
			>
				<span className="flex items-center gap-2">
					<span className="icon-[lucide--database] h-4 w-4" />
					{view === "form" ? (editing?.name ? "编辑连接" : "新建连接") : "连接管理"}
				</span>
			</div>

			<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto p-4">
				{view === "list" ? (
					<ConnectionList
						connections={editor.connections}
						testing={editor.testing}
						testResult={editor.testResult}
						onEdit={editor.startEdit}
						onTest={(c) => void editor.test(c)}
						onDelete={(c) => void editor.remove(c)}
						onCreate={editor.startNew}
					/>
				) : (
					editing && (
						<ConnectionFields
							conn={editing}
							onChange={(c) => editor.setEditing(c)}
							onTypeChange={editor.setDbType}
							groupedManifest={editor.groupedManifest}
							availableSchemas={editor.availableSchemas}
							loadingSchemas={editor.loadingSchemas}
							onLoadSchemas={editor.loadSchemas}
						/>
					)
				)}
			</div>

			{view === "form" && editing && (
				<div className="flex shrink-0 items-center justify-end gap-2 px-4 py-2" style={{ borderTop: "1px solid var(--dbx-line-soft)" }}>
					<button type="button" className="dbx-btn ghost" onClick={editor.back}>取消</button>
					<button type="button" className="dbx-btn primary" onClick={() => void editor.save()}>保存</button>
				</div>
			)}
		</div>
	);
}
