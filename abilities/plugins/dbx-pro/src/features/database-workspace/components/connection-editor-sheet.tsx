/**
 * 连接管理侧栏 — 列表页与表单页的抽屉壳。
 *
 * 只做两件事：切换「列表 / 表单」两页，以及渲染连接字段表单。
 * 所有请求与状态在 useConnectionEditor 里，保存 / 测试 / 删除的流程不在本文件。
 */

import { ConnectionFields } from "./connection-fields";
import { ConnectionList } from "./connection-list";
import { useConnectionEditor } from "../hooks/use-connection-editor";

export interface ConnectionEditorSheetProps {
	/** 连接增 / 删 / 改后通知外层重载工作台（回传受影响连接名）。 */
	onChange?: (name?: string) => void;
	onCancel: () => void;
}

export function ConnectionEditorSheet({ onChange, onCancel }: ConnectionEditorSheetProps) {
	const editor = useConnectionEditor({ onChange });
	const { editing, view } = editor;

	return (
		<>
			<div className="dbx-modal-backdrop" onClick={onCancel} style={{ zIndex: 100 }} />
			<div
				className="absolute left-1/2 top-1/2 z-[101] flex w-[min(560px,calc(100%-2rem))] max-h-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
			>
				<div className="dbx-sheet-header">
					<div style={{ fontWeight: 600, fontSize: 14 }}>
						{view === "form" ? (editing?.name ? "编辑连接" : "新建连接") : "管理连接"}
					</div>
					<button type="button" className="dbx-iconbtn" onClick={onCancel} title="关闭" style={{ height: 26, minWidth: 26, padding: 0 }}>
						<span className="icon-[lucide--x] h-4 w-4" />
					</button>
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
					<div className="dbx-sheet-footer">
						<button className="dbx-btn ghost" onClick={editor.back}>取消</button>
						<button className="dbx-btn primary" onClick={() => void editor.save()}>保存</button>
					</div>
				)}
			</div>
		</>
	);
}