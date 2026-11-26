import { useEffect, useMemo, useState, type JSX } from "react";
import type { PluginFsApi } from "@astravia-org/plugin-sdk";
import { listDesignVersions, type DesignPackageRef, type DesignVersionRef } from "../../../domain/design-versions";
import { formatRelativeTime } from "../../../shared/formatters/bytes";
import { BUTTON_SECONDARY, FOCUS_RING, INPUT } from "../../../shared/styles/tokens";
import { ModalDialog } from "../../../shared/components/modal-dialog";
import { IconVector } from "../../../shared/components/icons";

export interface VersionsSheetProps {
	open: boolean;
	fs: PluginFsApi;
	cwd: string | null;
	locale: string;
	onClose: () => void;
	/** 点某一版：画布切到它。 */
	onOpen: (pkg: DesignPackageRef, version: DesignVersionRef) => void;
	onRefresh?: () => void;
	t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * 版本面板：列的是**设计包的版本**，不是生成过的图片。
 *
 * 一份包 = 磁盘上一个 `<slug>.logocreator-design/`，一代版本 = 清单里追加进 `variants[]`
 * 的那一批。点某版就把画布切到它（矢量按 seed/style 复现，位图标注 `AI`）。
 *
 * 上一版这里列的是 history-store 里的生成记录：与磁盘上的包是两套数据，删除/改名后
 * 两边对不上，而且看不出「同一份设计的第几代」。
 */
export function VersionsSheet({ open, fs, cwd, locale, onClose, onOpen, onRefresh, t }: VersionsSheetProps): JSX.Element {
	const [packages, setPackages] = useState<DesignPackageRef[]>([]);
	const [loading, setLoading] = useState(false);
	const [query, setQuery] = useState("");
	const [expanded, setExpanded] = useState<string | null>(null);
	const [nonce, setNonce] = useState(0);
	/** 只有用户点刷新时才绕过缓存。 */
	const [force, setForce] = useState(false);

	useEffect(() => {
		if (!open) return;
		let alive = true;
		setLoading(true);
		// 打开时用缓存（4s TTL）；用户点「重新扫描」才 force。
		void listDesignVersions(fs, cwd, force)
			.then((items) => {
				if (!alive) return;
				setPackages(items);
				// 默认展开最近改过的那份：面板打开就该看到有东西可选。
				setExpanded((current) => current ?? items[0]?.folder ?? null);
			})
			.finally(() => {
				if (alive) setLoading(false);
			});
		return () => {
			alive = false;
		};
	}, [open, fs, cwd, nonce, force]);

	const visible = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return packages;
		return packages.filter(
			(pkg) =>
				pkg.brand.toLowerCase().includes(needle) ||
				pkg.slug.toLowerCase().includes(needle) ||
				pkg.versions.some((version) => version.subject.toLowerCase().includes(needle)),
		);
	}, [packages, query]);

	const total = packages.reduce((sum, pkg) => sum + pkg.versions.length, 0);

	return (
		<ModalDialog
			open={open}
			onClose={onClose}
			title={t("versions.title")}
			description={t("versions.description", { packages: packages.length, versions: total })}
			size="wide"
			footer={
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => {
							setForce(true);
							setNonce((value) => value + 1);
							onRefresh?.();
						}}
						disabled={loading}
						className={`${BUTTON_SECONDARY} ${FOCUS_RING}`}
					>
						{loading ? t("versions.loading") : t("versions.refresh")}
					</button>
					<span className="flex-1" />
					<span className="text-[11px] text-muted-foreground">{t("versions.hint")}</span>
				</div>
			}
		>
			<div className="mb-2 flex items-center gap-1.5">
				<input
					className={`${INPUT} h-8 flex-1 text-[12px]`}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={t("versions.search")}
					aria-label={t("versions.search")}
				/>
			</div>

			{visible.length === 0 ? (
				<p className="py-6 text-center text-[12px] text-muted-foreground">
					{loading ? t("versions.loading") : t("versions.empty")}
				</p>
			) : (
				<ul className="space-y-1">
					{visible.map((pkg) => {
						const open = expanded === pkg.folder;
						return (
							<li key={pkg.folder} className="rounded-lg border border-border/60">
								<button
									type="button"
									onClick={() => setExpanded(open ? null : pkg.folder)}
									aria-expanded={open}
									className={`${FOCUS_RING} flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60`}
								>
									<IconVector className="size-3.5 shrink-0 text-muted-foreground" />
									<span className="min-w-0 flex-1">
										<span className="block truncate text-[12px] font-medium text-foreground">{pkg.brand || pkg.slug}</span>
										<span className="block truncate text-[10px] text-muted-foreground">
											{t("versions.packageMeta", { count: pkg.versions.length, folder: pkg.folder })}
										</span>
									</span>
									<span className="shrink-0 text-[10px] text-muted-foreground">
										{formatRelativeTime(Date.parse(pkg.updatedAt) || 0, locale)}
									</span>
									<span aria-hidden className="shrink-0 text-[10px] text-muted-foreground">
										{open ? "▾" : "▸"}
									</span>
								</button>

								{open ? (
									<ul className="border-t border-border/50 px-2 py-1">
										{pkg.versions.length === 0 ? (
											<li className="py-1.5 text-[11px] text-muted-foreground">{t("versions.noVersions")}</li>
										) : (
											pkg.versions.map((version) => (
												<li key={`${pkg.folder}:${version.index}`}>
													<button
														type="button"
														onClick={() => {
															onOpen(pkg, version);
															onClose();
														}}
														className={`${FOCUS_RING} flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-muted`}
													>
														<span className="w-6 shrink-0 text-[10px] tabular-nums text-muted-foreground">
															#{version.index}
														</span>
														<span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground">
															{version.style} · {version.subject}
														</span>
														<span className="shrink-0 rounded bg-muted px-1 text-[9px] uppercase text-muted-foreground">
															{version.engine === "ai" ? t("versions.engine.ai") : t("versions.engine.local")}
														</span>
														<span className="shrink-0 text-[10px] text-muted-foreground">
															{version.at ? formatRelativeTime(Date.parse(version.at) || 0, locale) : ""}
														</span>
													</button>
												</li>
											))
										)}
									</ul>
								) : null}
							</li>
						);
					})}
				</ul>
			)}
		</ModalDialog>
	);
}
