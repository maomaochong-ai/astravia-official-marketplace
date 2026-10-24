import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import { formatBytes, type TriageReport } from "../../../../domain/report/report";
import { Icon } from "../shell/icon";
import { Tag } from "../shell/tag";

export interface SampleDropzoneProps {
	report: TriageReport | null;
	busy: boolean;
	/** 报告来自对话里的 Agent，而不是面板本次分析。 */
	fromAgent: boolean;
	onClear(): void;
	onReanalyse(): void;
	/** 拖进来的文件与选择器走同一条路：先复制进工作区再分析。 */
	onImport(files: readonly File[]): void;
	/** 导入进度 0–1；大文件分块上传时给百分比，不让人对着转圈等。 */
	importProgress?: number | null;
	/** 交给宿主对话里的 Agent；引擎读不动的样本走这条路。 */
	onHandOff?(): void;
}

function factValue(report: TriageReport | null, labels: readonly string[]): string | null {
	if (!report) return null;
	for (const label of labels) {
		const row = report.facts.find(item => item.label === label);
		if (row) return row.value;
	}
	return null;
}

/**
 * 当前样本卡：文件名、格式、大小、架构、SHA-256，以及一句「不会被执行或上传」。
 * 没有样本时它就是投递口：拖进来的文件先复制进工作区再分析 —— 宿主的读取通道以
 * 项目根为边界，项目外的临时路径读不到，但渲染进程的 `File` 对象能拿到字节。
 */
export function SampleDropzone({ report, busy, fromAgent, onClear, onReanalyse, onImport, importProgress = null, onHandOff }: SampleDropzoneProps) {
	const { t } = useTranslation();
	const [dragging, setDragging] = useState(false);

	if (!report) {
		return (
			<div
				data-testid="sample-dropzone"
				// 拖拽是拿到项目外字节的第二条路：<input type="file"> 之外不需要额外权限。
				onDragOver={event => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={event => {
					event.preventDefault();
					setDragging(false);
					const dropped = [...event.dataTransfer.files];
					if (dropped.length > 0) onImport(dropped);
				}}
				className={`rounded-lg border border-dashed px-4 py-5 ${dragging ? "border-purple bg-surface-active" : "border-line-strong bg-surface-2"}`}
			>
				<div className="flex items-start gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-4 text-text-2">
						<Icon name="folderSearch" className="size-5" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="text-[13px] font-medium text-text">{t("dropzone.empty.title")}</div>
						<div className="mt-1 text-[11px] leading-relaxed text-text-3">{t("dropzone.empty.body")}</div>
					</div>
				</div>
				{importProgress !== null ? (
					<div className="mt-3">
						<div className="h-1 overflow-hidden rounded-full bg-surface-4">
							<div className="h-full rounded-full bg-purple" style={{ width: `${Math.round(importProgress * 100)}%` }} />
						</div>
						<div className="mt-1 text-[10.5px] text-text-3">{t("dropzone.importing", { percent: String(Math.round(importProgress * 100)) })}</div>
					</div>
				) : null}
				<div className="mt-3 flex items-center gap-2 text-[10.5px] text-text-4">
					<Icon name="ban" className="size-3" />
					<span>{t("dropzone.empty.guarantee")}</span>
				</div>
			</div>
		);
	}

	const arch = factValue(report, ["Architecture", "Main binary architecture"]);
	return (
		<div className="rounded-lg border border-line bg-surface-2 px-4 py-3.5">
			<div className="flex items-start gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-4 text-text-2">
					<Icon name="boxes" className="size-5" />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-center gap-2">
						<span className="truncate text-[13px] font-medium text-text">{report.target.name}</span>
						<Tag>{report.target.format.toUpperCase()}</Tag>
						{fromAgent ? <Tag tone="purple">{t("dropzone.fromAgent")}</Tag> : null}
					</div>
					<div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[10.5px] text-text-4">
						<span>{formatBytes(report.target.size)}</span>
						{arch ? <span>· {arch}</span> : null}
						<span className="min-w-0 truncate">· SHA-256 {report.target.sha256.slice(0, 8)}…{report.target.sha256.slice(-6)}</span>
					</div>
					{busy ? (
						<>
							<div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-4">
								<div className="fb-pulse h-full w-2/3 rounded-full bg-purple" />
							</div>
							<div className="mt-1 text-[10.5px] text-text-3">{t("dropzone.busy")}</div>
						</>
					) : (
						<div className="mt-1.5 truncate font-mono text-[10.5px] text-text-4">{report.target.path}</div>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-0.5">
					{onHandOff ? (
						<button
							type="button"
							onClick={onHandOff}
							title={t("dropzone.handoff")}
							className="rounded p-1 text-purple transition-colors hover:bg-surface-hover"
						>
							<Icon name="sparkle" className="size-3.5" />
						</button>
					) : null}
					<button
						type="button"
						onClick={onReanalyse}
						title={t("dropzone.reanalyse")}
						className="rounded p-1 text-text-4 transition-colors hover:bg-surface-hover hover:text-text"
					>
						<Icon name="refresh" className="size-3.5" />
					</button>
					<button
						type="button"
						onClick={onClear}
						title={t("dropzone.clear")}
						className="rounded p-1 text-text-4 transition-colors hover:bg-surface-hover hover:text-text"
					>
						<Icon name="close" className="size-3.5" />
					</button>
				</div>
			</div>

			{importProgress !== null ? (
				<div className="mt-2">
					<div className="h-1 overflow-hidden rounded-full bg-surface-4">
						<div className="h-full rounded-full bg-purple" style={{ width: `${Math.round(importProgress * 100)}%` }} />
					</div>
					<div className="mt-1 text-[10.5px] text-text-3">{t("dropzone.importing", { percent: String(Math.round(importProgress * 100)) })}</div>
				</div>
			) : null}
			<div className="mt-2.5 flex items-center gap-2 text-[10.5px] text-text-4">
				<Icon name="ban" className="size-3" />
				<span>{t("dropzone.guarantee")}</span>
			</div>
		</div>
	);
}
