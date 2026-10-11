/**
 * useConnectionTransfer — 连接导入 / 导出的异步流程与用户反馈。
 *
 * 连接树工具栏与收起态图标列都要「导入连接」，此前各自在组件里写了一遍
 * 读文件 → 解析 → 提示的完整流程（两份实现已经出现反馈差异）。按
 * docs/plugin-project-structure.md「hooks 负责异步状态机和副作用，组件只负责
 * 可见状态与交互」把流程收到这里，组件只保留按钮几何与 disabled 态。
 *
 * 用户反馈沿用既有约定：webview 内没有原生保存/打开对话框，导入走隐藏的
 * file input，导出走 Blob 下载与 alert 提示。
 */

import { useRef, useState, type ChangeEvent, type RefObject } from "react";
import { getUi } from "../../../runtime-contract.ts";
import { exportConnectionsFile, importConnectionsFromText } from "../services/connection-transfer";

export interface ConnectionTransferOptions {
	/** 导入成功（至少新增/更新一条）后调用：刷新连接树与连接列表。空结果不调用。 */
	onImported?: () => void | Promise<void>;
	/** 导入有失败明细时是否把逐条原因一并展示（工具栏需要，收起态不需要）。 */
	showErrorDetails?: boolean;
}

export interface ConnectionTransfer {
	/** 导入进行中：收起态用它禁用导入按钮。 */
	importing: boolean;
	/** 隐藏 file input 的 ref，调用方负责渲染 `<input type="file" hidden />`。 */
	fileInputRef: RefObject<HTMLInputElement | null>;
	/** 打开文件选择框。 */
	triggerImport: () => void;
	/** 隐藏 file input 的 change 处理器。 */
	handleImportFile: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
	/** 导出全部连接（不含密码）；没有连接时提示。 */
	handleExport: () => Promise<void>;
}

export function useConnectionTransfer(options: ConnectionTransferOptions = {}): ConnectionTransfer {
	const { onImported, showErrorDetails = false } = options;
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [importing, setImporting] = useState(false);

	function triggerImport(): void {
		fileInputRef.current?.click();
	}

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
				getUi()?.notify?.({ message: "文件中没有可导入的连接（每条连接至少需要 name / db_type / host）", variant: "warning" });
				return;
			}
			await onImported?.();
			const summary = `导入完成：新增 ${result.imported} 个，更新 ${result.updated} 个，失败 ${result.failed} 个`;
			getUi()?.notify?.({ message: showErrorDetails && result.failed > 0 ? `（ 条失败）` : summary, variant: result.failed > 0 ? "warning" : "success" });
		} catch (err) {
			getUi()?.notify?.({ message: `导入失败: ${err instanceof Error ? err.message : String(err)}`, variant: "error" });
		} finally {
			setImporting(false);
		}
	}

	async function handleExport(): Promise<void> {
		try {
			const count = await exportConnectionsFile();
			if (count === 0) getUi()?.notify?.({ message: "暂无连接可导出", variant: "info" });
		} catch (err) {
			getUi()?.notify?.({ message: `导出失败: ${err instanceof Error ? err.message : String(err)}`, variant: "error" });
		}
	}

	return { importing, fileInputRef, triggerImport, handleImportFile, handleExport };
}
