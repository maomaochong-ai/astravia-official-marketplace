/**
 * 连接管理工作区视图 — 从宿主侧边栏直接打开的整页面板。
 *
 * 直接挂载 ConnectionEditorFlow，与工作台内的新建连接模态弹窗走完全相同的
 * 三步流程（管理连接 → 选择数据库类型 → 填写配置），只是这里没有遮罩与
 * 居中弹窗，而是占满整个工作区视图，也不显示模态的关闭按钮。
 * 增 / 删 / 改由编辑器内部自行刷新；回到主工作台时会重新加载连接。
 */

import type { JSX } from "react";
import { ConnectionEditorFlow } from "./connection-editor-flow";

export function ConnectionManagerView(): JSX.Element {
	return (
		<div data-astravia-plugin-root="dbx-pro" className="dbx-root relative flex h-full w-full min-h-0 flex-col bg-background text-foreground">
			<ConnectionEditorFlow />
		</div>
	);
}
