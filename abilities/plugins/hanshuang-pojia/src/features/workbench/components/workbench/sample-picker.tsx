import type { PluginFsEntry } from "@astravia-org/plugin-sdk";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { fileList } from "../../services/import-file";
import { useRef, useState } from "react";
import { formatBytes } from "../../../../domain/report/report";
import { Icon } from "../shell/icon";
import { Spinner } from "../shell/spinner";

export interface SamplePickerProps {
	cwd: string | null;
	files: readonly PluginFsEntry[];
	loading: boolean;
	busy: boolean;
	selectedPath: string | null;
	onRefresh(): void;
	onImport(files: readonly File[]): void;
	onAnalyse(path: string): void;
}

/**
 * 左侧样本来源：工作区里按大小排好的候选文件 + 手动路径。
 *
 * 手动路径是必要的：宿主的目录列举只给一层，样本常放在子目录里，
 * 用户知道路径时不该被迫先刷新目录。
 */
export function SamplePicker({ cwd, files, loading, busy, selectedPath, onRefresh, onAnalyse, onImport }: SamplePickerProps) {
	const { t } = useTranslation();
	const [path, setPath] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	const submit = () => {
		const trimmed = path.trim();
		if (trimmed.length === 0) return;
		onAnalyse(trimmed);
	};

	return (
		<div className="flex min-h-0 flex-col">

			<div className="flex items-center px-3 pb-1">
				<button
					type="button"
					onClick={() => fileRef.current?.click()}
					title={t("panel.upload.hint")}
					className="flex items-center gap-1.5 rounded border border-line px-2 py-1 text-[10.5px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
				>
					<Icon name="folder" className="size-3.5 text-text-3" />
					{t("panel.upload.button")}
				</button>
				{/* 真选择器：宿主的 fs 只授权到项目根，所以选中的字节先复制进工作区再读。 */}
				<input
					ref={fileRef}
					type="file"
					multiple
					className="hidden"
					tabIndex={-1}
					aria-hidden
					onChange={event => {
						const picked = fileList(event.target.files);
						// 同一个文件选第二次也要再触发一次 onChange。
						event.target.value = "";
						if (picked.length > 0) onImport(picked);
					}}
				/>
			</div>
			<div className="flex items-center gap-1 px-3 pb-2">
				<form
					className="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-line bg-surface px-2 py-1"
					onSubmit={event => {
						event.preventDefault();
						submit();
					}}
				>
					<Icon name="search" className="size-3 shrink-0 text-text-4" />
					<input ref={inputRef}
						value={path}
						onChange={event => setPath(event.target.value)}
						placeholder={t("panel.path.placeholder")}
						aria-label={t("panel.path.placeholder")}
						className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-text outline-none placeholder:text-text-4"
					/>
				</form>
				<button
					type="button"
					onClick={onRefresh}
					title={t("panel.rail.refresh")}
					className="rounded p-1 text-text-4 transition-colors hover:bg-surface-hover hover:text-text"
				>
					<Icon name="refresh" className={`size-3.5 ${loading ? "motion-safe:animate-spin" : ""}`} />
				</button>
				<button
					type="button"
					onClick={submit}
					disabled={busy || path.trim().length === 0}
					className="rounded border border-line px-1.5 py-1 text-[10.5px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
				>
					{t("panel.path.analyse")}
				</button>
			</div>

			<div className="fb-scroll min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
				{!cwd ? <p className="px-2 py-2 text-[11px] leading-relaxed text-text-4">{t("panel.rail.noCwd")}</p> : null}
				{cwd && loading && files.length === 0 ? (
					<p className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-text-4">
						<Spinner className="size-3" />
						{t("panel.rail.loading")}
					</p>
				) : null}
				{cwd && !loading && files.length === 0 ? <p className="px-2 py-2 text-[11px] leading-relaxed text-text-4">{t("panel.rail.empty")}</p> : null}
				{cwd && files.length > 0 ? (
					<p className="px-2 pb-1 pt-1 text-[9.5px] uppercase tracking-wider text-text-4">{t("panel.rail.title")}</p>
				) : null}
				{files.map(entry => {
					const active = entry.path === selectedPath;
					return (
						<button
							key={entry.path}
							type="button"
							onClick={() => onAnalyse(entry.path)}
							disabled={busy}
							title={entry.path}
							className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left transition-colors ${
								active ? "bg-surface-active text-text" : "text-text-2 hover:bg-surface-hover hover:text-text"
							} disabled:opacity-50`}
						>
							<Icon name="file" className="size-3 shrink-0 text-text-4" />
							<span className="min-w-0 flex-1 truncate font-mono text-[11px]">{entry.name}</span>
							<span className="shrink-0 font-mono text-[9.5px] text-text-4">{formatBytes(entry.size)}</span>
						</button>
					);
				})}
			</div>

			<div className="border-t border-line-subtle px-3 py-2">
				<p className="text-[10px] leading-relaxed text-text-4">{t("panel.rail.scope", { limit: "32 MiB" })}</p>
			</div>
		</div>
	);
}
