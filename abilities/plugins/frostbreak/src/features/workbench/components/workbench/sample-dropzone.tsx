import { useTranslation } from "@astravia-org/plugin-sdk";
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
 * 没有样本时它就是投递口 —— 只接受路径或工作区里的文件，不接受拖拽上传，
 * 因为宿主的文件能力以项目根为边界，拖拽拿到的是无法读取的临时路径。
 */
export function SampleDropzone({ report, busy, fromAgent, onClear, onReanalyse }: SampleDropzoneProps) {
	const { t } = useTranslation();

	if (!report) {
		return (
			<div className="rounded-lg border border-dashed border-line-strong bg-surface-2 px-4 py-5">
				<div className="flex items-start gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-4 text-text-2">
						<Icon name="folderSearch" className="size-5" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="text-[13px] font-medium text-text">{t("dropzone.empty.title")}</div>
						<div className="mt-1 text-[11px] leading-relaxed text-text-3">{t("dropzone.empty.body")}</div>
					</div>
				</div>
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

			<div className="mt-2.5 flex items-center gap-2 text-[10.5px] text-text-4">
				<Icon name="ban" className="size-3" />
				<span>{t("dropzone.guarantee")}</span>
			</div>
		</div>
	);
}
