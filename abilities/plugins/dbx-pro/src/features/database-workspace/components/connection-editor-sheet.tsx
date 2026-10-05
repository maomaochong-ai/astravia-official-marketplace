/**
 * 连接管理模态弹窗 — 工作台内打开的遮罩 + 居中面板。
 *
 * 三步流程（管理连接 → 选择数据库类型 → 填写配置）由 ConnectionEditorFlow
 * 提供，宿主侧边栏的整页视图复用同一流程，保证两边功能完全一致。
 */

import type { JSX } from "react";
import { ConnectionEditorFlow } from "./connection-editor-flow";

export interface ConnectionEditorSheetProps {
	/** 连接增 / 删 / 改后通知外层重载工作台（回传受影响连接名）。 */
	onChange?: (name?: string) => void;
	onCancel: () => void;
}

export function ConnectionEditorSheet({ onChange, onCancel }: ConnectionEditorSheetProps): JSX.Element {
	return (
		<>
			{/* 遮罩层 */}
			<div
				className="dbx-connection-backdrop"
				onClick={onCancel}
			/>

			{/* 主面板 */}
			<div className="dbx-connection-dialog">
				<ConnectionEditorFlow onChange={onChange} onClose={onCancel} />
			</div>
		</>
	);
}
