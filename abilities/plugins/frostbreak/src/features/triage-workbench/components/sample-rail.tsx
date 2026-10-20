import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PluginFsEntry } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import { formatBytes } from "../../../domain/report/report";

export interface SampleRailProps {
	cwd: string | null;
	files: readonly PluginFsEntry[];
	loading: boolean;
	selectedPath: string | null;
	busy: boolean;
	onRefresh: () => void;
	onAnalyse: (path: string) => void;
}

export function SampleRail({ cwd, files, loading, selectedPath, busy, onRefresh, onAnalyse }: SampleRailProps) {
	const { t } = useTranslation();
	const [manualPath, setManualPath] = useState("");

	const submitManual = () => {
		const value = manualPath.trim();
		if (value.length === 0) return;
		onAnalyse(value);
	};

	return (
		<aside className="flex w-[228px] shrink-0 flex-col border-r border-black/[0.07] bg-foreground/[0.015] dark:border-white/10">
			<div className="flex items-center gap-1 border-b border-black/[0.07] px-2 py-1.5 dark:border-white/10">
				<span className="min-w-0 flex-1 truncate text-[10.5px] uppercase tracking-wide text-foreground/45" title={cwd ?? ""}>
					{t("panel.rail.title")}
				</span>
				<button
					type="button"
					onClick={onRefresh}
					disabled={!cwd || loading}
					className="rounded px-1.5 py-0.5 text-[10.5px] text-foreground/55 transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-40"
				>
					{loading ? t("panel.rail.loading") : t("panel.rail.refresh")}
				</button>
			</div>

			<div className="border-b border-black/[0.07] p-1.5 dark:border-white/10">
				<div className="flex items-center gap-1">
					<input
						value={manualPath}
						onChange={event => setManualPath(event.target.value)}
						onKeyDown={event => {
							if (event.key === "Enter") submitManual();
						}}
						placeholder={t("panel.path.placeholder")}
						aria-label={t("panel.path.placeholder")}
						className="h-7 min-w-0 flex-1 rounded border border-black/10 bg-background px-2 font-mono text-[11px] text-foreground outline-none placeholder:font-sans placeholder:text-foreground/30 focus:border-foreground/30 dark:border-white/10"
					/>
					<button
						type="button"
						onClick={submitManual}
						disabled={busy || manualPath.trim().length === 0}
						className="h-7 shrink-0 rounded border border-black/10 px-2 text-[11px] font-medium text-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-40 dark:border-white/10"
					>
						{t("panel.path.analyse")}
					</button>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto p-1">
				{!cwd ? (
					<p className="p-2 text-[11px] leading-relaxed text-foreground/45">{t("panel.rail.noCwd")}</p>
				) : files.length === 0 ? (
					<p className="p-2 text-[11px] leading-relaxed text-foreground/45">{loading ? t("panel.rail.loading") : t("panel.rail.empty")}</p>
				) : (
					<ul className="space-y-0.5">
						{files.map(entry => {
							const active = selectedPath === entry.path || selectedPath === entry.name;
							return (
								<li key={entry.path}>
									<button
										type="button"
										onClick={() => onAnalyse(entry.path)}
										disabled={busy}
										title={entry.path}
										className={`flex w-full items-baseline gap-1.5 rounded px-1.5 py-1 text-left transition-colors disabled:opacity-60 ${
											active ? "bg-foreground/[0.09]" : "hover:bg-foreground/[0.05]"
										}`}
									>
										<span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground/80">{entry.name}</span>
										<span className="shrink-0 text-[10px] text-foreground/35">{formatBytes(entry.size)}</span>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
			<p className="border-t border-black/[0.07] px-2 py-1.5 text-[10px] leading-relaxed text-foreground/35 dark:border-white/10">
				{t("panel.rail.hint")}
			</p>
		</aside>
	);
}
