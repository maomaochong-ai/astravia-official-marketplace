import type { PluginFsEntry } from "@astravia-org/plugin-sdk";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { fileList } from "../../services/import-file";
import { formatBytes } from "../../../../domain/report/report";
import type { LibraryEntry } from "../../state";
import { Icon } from "../shell/icon";
import { Spinner } from "../shell/spinner";

export interface SamplePickerProps {
	cwd: string | null;
	files: readonly PluginFsEntry[];
	loading: boolean;
	busy: boolean;
	selectedPath: string | null;
	/** 已分析过的文件：路径 → 那一次的报告摘要。面板里没有第二种「已分析」状态。 */
	analysed: ReadonlyMap<string, LibraryEntry>;
	onRefresh(): void;
	onImport(files: readonly File[]): void;
	onAnalyse(path: string): void;
	onOpenReport(id: string): void;
	onHandOff(path: string): void;
	onMenu(event: ReactMouseEvent<HTMLElement>, path: string): void;
	onMenuNear(node: HTMLElement | null, path: string): void;
}

/**
 * 左侧样本来源：工作区里按大小排好的候选文件 + 手动路径。
 *
 * 三条约束，都是上一版被打出来的：
 *
 *   1. **列表吃满、自己滚**。之前列表放在一张有 `max-height` 的卡里，下面再接两张说明卡：
 *      面板一宽，说明卡只有三行，格子里剩下的高度全空着 —— 就是「卡片底部大量无用空间」。
 *      现在列表在自己的格子里 `flex-1`，说明放在**同一张卡的另一列**（窄面板时在页脚），
 *      没有哪一格会因为内容短而留白。
 *   2. **一行一个文件，不做圆角卡片堆**。19 个文件堆 19 张卡，卡与卡的 8px 间距比行距还大，
 *      读起来像 19 个不同的东西；它们其实是同一个目录里的同类文件。
 *   3. **状态要落在行上**。哪个文件已经分析过、得分多少，直接写在这一行里，
 *      而不是让用户点开再看。面板与对话共用同一份样本库（`model.entries`），所以这里不自己记状态。
 *
 * 手动路径是必要的：宿主的目录列举只给一层，样本常放在子目录里，
 * 用户知道路径时不该被迫先刷新目录。
 */
export function SamplePicker({
	cwd,
	files,
	loading,
	busy,
	selectedPath,
	analysed,
	onRefresh,
	onImport,
	onAnalyse,
	onOpenReport,
	onHandOff,
	onMenu,
	onMenuNear,
}: SamplePickerProps) {
	const { t } = useTranslation();
	const [path, setPath] = useState("");
	const [query, setQuery] = useState("");
	const [onlyAnalysed, setOnlyAnalysed] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	const submit = () => {
		const trimmed = path.trim();
		if (trimmed.length === 0) return;
		onAnalyse(trimmed);
	};

	const visible = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return files.filter(entry => {
			if (onlyAnalysed && !analysed.has(entry.path)) return false;
			if (needle.length === 0) return true;
			return entry.name.toLowerCase().includes(needle) || entry.path.toLowerCase().includes(needle);
		});
	}, [files, query, onlyAnalysed, analysed]);

	const analysedCount = files.filter(entry => analysed.has(entry.path)).length;

	return (
		<div className="flex min-h-0 min-w-0 flex-col">
			{/* 工具栏：上传 / 手动路径 / 刷新 / 分析。一行放不下就换行，不把输入框挤没。 */}
			<div className="flex shrink-0 flex-wrap items-center gap-1.5 px-3 pb-2">
				<button
					type="button"
					onClick={() => fileRef.current?.click()}
					title={t("panel.upload.hint")}
					className="flex shrink-0 items-center gap-1.5 rounded border border-line-subtle px-2 py-1 text-[10.5px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
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
				<form
					className="flex min-w-[140px] flex-1 items-center gap-1 rounded-md border border-line-subtle bg-surface px-2 py-1"
					onSubmit={event => {
						event.preventDefault();
						submit();
					}}
				>
					<Icon name="search" className="size-3 shrink-0 text-text-4" />
					<input
						value={path}
						onChange={event => setPath(event.target.value)}
						placeholder={t("panel.path.placeholder")}
						aria-label={t("panel.path.placeholder")}
						className="min-w-0 flex-1 bg-transparent font-mono text-[11.5px] text-text outline-none placeholder:text-text-4"
					/>
				</form>
				<button
					type="button"
					onClick={onRefresh}
					title={t("panel.rail.refresh")}
					aria-label={t("panel.rail.refresh")}
					className="shrink-0 rounded p-1 text-text-4 transition-colors hover:bg-surface-hover hover:text-text"
				>
					<Icon name="refresh" className={`size-3.5 ${loading ? "motion-safe:animate-spin" : ""}`} />
				</button>
				<button
					type="button"
					onClick={submit}
					disabled={busy || path.trim().length === 0}
					className="shrink-0 rounded border border-line-subtle px-1.5 py-1 text-[10.5px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
				>
					{t("panel.path.analyse")}
				</button>
			</div>

			{/* 过滤条：名字筛选 + 「只看已分析」+ 计数。三个东西一行，计数靠右。 */}
			<div className="flex shrink-0 items-center gap-1.5 px-3 pb-1.5">
				<div className="relative min-w-0 flex-1">
					<Icon name="filter" className="pointer-events-none absolute start-2 top-1/2 size-3 -translate-y-1/2 text-text-4" />
					<input
						value={query}
						onChange={event => setQuery(event.target.value)}
						placeholder={t("samples.search")}
						aria-label={t("samples.search")}
						className="w-full rounded-md border border-line-subtle bg-surface py-1 pe-2 ps-7 text-[11.5px] text-text outline-none placeholder:text-text-4 focus:border-accent"
					/>
				</div>
				<button
					type="button"
					aria-pressed={onlyAnalysed}
					onClick={() => setOnlyAnalysed(!onlyAnalysed)}
					title={t("samples.onlyAnalysedHint")}
					className={`shrink-0 rounded-md border px-1.5 py-1 text-[10.5px] transition-colors ${
						onlyAnalysed ? "border-accent/40 bg-accent-soft text-accent" : "border-line-subtle text-text-2 hover:bg-surface-hover"
					}`}
				>
					{t("samples.onlyAnalysed")}
					<span className="ms-1 font-mono text-[9.5px] tabular-nums text-text-4">{analysedCount}</span>
				</button>
				<span className="shrink-0 font-mono text-[9.5px] tabular-nums text-text-4">{t("samples.count", { shown: visible.length, total: files.length })}</span>
			</div>

			{/* 列表：吃满剩余高度并自己滚。 */}
			<div data-testid="sample-list" className="fb-scroll min-h-0 flex-1 overflow-y-auto border-t border-line-subtle">
				{!cwd ? <p className="px-3 py-3 text-[11.5px] leading-relaxed text-text-4">{t("panel.rail.noCwd")}</p> : null}
				{cwd && loading && files.length === 0 ? (
					<p className="flex items-center gap-1.5 px-3 py-3 text-[11.5px] text-text-4">
						<Spinner className="size-3" />
						{t("panel.rail.loading")}
					</p>
				) : null}
				{cwd && !loading && files.length === 0 ? (
					<p className="px-3 py-3 text-[11.5px] leading-relaxed text-text-4">{t("panel.rail.empty")}</p>
				) : null}
				{cwd && files.length > 0 && visible.length === 0 ? (
					<p className="px-3 py-3 text-[11.5px] text-text-4">{t("samples.filtered")}</p>
				) : null}

				{visible.map(entry => {
					const record = analysed.get(entry.path);
					const active = entry.path === selectedPath;
					return (
						<div
							key={entry.path}
							data-sample-path={entry.path}
							data-analysed={record ? "true" : "false"}
							className={`group flex items-start gap-1.5 border-b border-line-subtle px-3 py-1.5 last:border-0 transition-colors ${
								active ? "fb-selected" : "hover:bg-surface-hover"
							}`}
						>
							<button
								type="button"
								onClick={() => onAnalyse(entry.path)}
								onContextMenu={event => onMenu(event, entry.path)}
								disabled={busy}
								title={entry.path}
								className="min-w-0 flex-1 text-left disabled:opacity-50"
							>
								<div className="flex flex-wrap items-baseline gap-x-1.5">
									<span className="min-w-0 fb-wrap font-mono text-[11.5px] text-text">{entry.name}</span>
									{record ? (
										<span className="shrink-0 font-mono text-[9.5px] tabular-nums text-text-3">
											{t("samples.state.analysed")} · {record.score} · {record.grade}
										</span>
									) : null}
									{active && busy ? <span className="shrink-0 font-mono text-[9.5px] text-accent">{t("samples.state.running")}</span> : null}
								</div>
								<div className="flex flex-wrap items-baseline gap-x-2 font-mono text-[9.5px] text-text-4">
									<span className="shrink-0 tabular-nums">{formatBytes(entry.size)}</span>
									<span className="min-w-0 fb-wrap">{entry.path}</span>
								</div>
							</button>
							<div className="flex shrink-0 items-center gap-0.5">
								{record ? (
									<button
										type="button"
										onClick={() => onOpenReport(record.id)}
										title={t("samples.row.reopen")}
										aria-label={t("samples.row.reopen")}
										className="rounded p-1 text-text-4 transition-colors hover:bg-surface-hover hover:text-text"
									>
										<Icon name="eye" className="size-3.5" />
									</button>
								) : null}
								<button
									type="button"
									onClick={() => onHandOff(entry.path)}
									title={t("panel.rail.handoff")}
									aria-label={t("panel.rail.handoff")}
									className="rounded p-1 text-text-4 transition-colors hover:bg-surface-hover hover:text-purple"
								>
									<Icon name="send" className="size-3.5" />
								</button>
								{/* 「更多」：与右键同一份菜单。右键是隐藏入口，必须给一个看得见的触发点。 */}
								<button
									type="button"
									onClick={event => onMenuNear(event.currentTarget, entry.path)}
									title={t("samples.row.more")}
									aria-label={t("samples.row.more")}
									aria-haspopup="menu"
									className="rounded p-1 text-text-4 transition-colors hover:bg-surface-hover hover:text-text"
								>
									<Icon name="chevron" className="size-3.5" />
								</button>
							</div>
						</div>
					);
				})}
			</div>

			{/* 脚注：读取上限是硬约束，写在列表底下比写在说明列里更容易被看到。 */}
			<div className="flex shrink-0 items-center gap-1.5 border-t border-line-subtle px-3 py-1.5 text-[10.5px] leading-relaxed text-text-4">
				<Icon name="lock" className="size-3 shrink-0" />
				<span className="min-w-0 fb-wrap">{t("panel.rail.scope", { limit: "32 MiB" })}</span>
			</div>
		</div>
	);
}
