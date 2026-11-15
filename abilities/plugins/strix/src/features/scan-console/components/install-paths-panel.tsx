/**
 * 「装在哪」：一张两列对齐的表，默认收起。
 *
 * 三列语义（左标签 / 右路径）：
 *  - **宿主路径**：服务探过 `exists`。存在 = 点击在文件管理器里定位；不存在 = 灰掉并标"未找到"。
 *  - **容器内路径**：不在宿主的文件系统里，不可能"打开"。点击 = 复制一条 `docker exec … ls -ld`，
 *    贴到终端就能看。这是诚实的唯一形状——假装能打开只会让人以为路径不对。
 *  - **其它系统的默认位置**：参考值，点击只复制。
 *
 * 排版：两列（`grid-template-columns: max-content minmax(0, 1fr)`），路径 `nowrap` + 省略号，
 * 整行不换行；窄屏时路径列收缩而不是折行（折行会把两列对齐彻底打散）。
 */

import { useState } from "react";
import type { BridgeInstallPath, BridgeInstallPaths } from "../../../runtime-contract";

/** 点击一条会发生什么：与 `domain/install-paths.ts` 的 `clickAction` 同一套判断。 */
export function actionFor(entry: BridgeInstallPath): "reveal" | "copy-command" | "copy-path" {
	if (entry.scope === "container") return "copy-command";
	if (entry.scope === "host" && entry.exists === true) return "reveal";
	return "copy-path";
}

const SCOPE_GLYPH: Record<BridgeInstallPath["scope"], string> = {
	host: "▸",
	container: "▣",
	reference: "·",
};

export interface InstallPathsPanelProps {
	t: (key: string, params?: Record<string, string | number>) => string;
	paths: BridgeInstallPaths;
	/** 打开一条宿主路径；不给就退回复制。 */
	onOpen?: (path: string) => void;
}

export function InstallPathsPanel({ t, paths, onOpen }: InstallPathsPanelProps): React.ReactElement {
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState<string | null>(null);

	const copy = async (value: string, id: string): Promise<void> => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(id);
			setTimeout(() => setCopied((current) => (current === id ? null : current)), 1200);
		} catch {
			// 剪贴板不可用时不假装成功：把文字留在 row 的 title 里，用户可自己选。
			setCopied(null);
		}
	};

	const click = (entry: BridgeInstallPath): void => {
		const action = actionFor(entry);
		if (action === "reveal" && onOpen) {
			onOpen(entry.path);
			return;
		}
		if (action === "copy-command") {
			void copy(entry.command ?? entry.path, entry.id);
			return;
		}
		void copy(entry.path, entry.id);
	};

	return (
		<div className="astra-strix-row astra-strix-paths-row" data-open={open ? "yes" : "no"}>
			<span className="astra-strix-row-label">{t("paths.title")}</span>
			<span className="astra-strix-row-value">
				<span className="astra-strix-paths">
					<button
						type="button"
						className="astra-strix-paths-toggle"
						aria-expanded={open ? "true" : "false"}
						onClick={() => setOpen((current) => !current)}
					>
						<span className="astra-strix-dim">{open ? "▾" : "▸"}</span>
						<span>{open ? t("paths.hide") : t("paths.show", { count: paths.entries.filter((entry) => entry.scope !== "reference").length })}</span>
						<span className="astra-strix-dim"> · {paths.image}</span>
					</button>
					{open ? (
						<span className="astra-strix-paths-list" role="list">
							{paths.entries.map((entry) => {
								const action = actionFor(entry);
								const missing = entry.scope === "host" && entry.exists === false;
								return (
									<button
										key={entry.id}
										type="button"
										role="listitem"
										className="astra-strix-path-line"
										data-scope={entry.scope}
										data-missing={missing ? "yes" : "no"}
										title={
											action === "copy-command"
												? `${entry.path} — ${t("paths.copyHint")}`
												: action === "reveal"
													? `${entry.path} — ${t("paths.openHint")}`
													: `${entry.path} — ${t("paths.copyHint")}`
										}
										onClick={() => click(entry)}
									>
										<span className="astra-strix-path-label">
											<span className="astra-strix-dim" aria-hidden="true">
												{SCOPE_GLYPH[entry.scope]}{" "}
											</span>
											{entry.label}
										</span>
										<span className="astra-strix-path-value">{entry.path}</span>
										<span className="astra-strix-path-act">
											{copied === entry.id
												? t("paths.copied")
												: missing
													? t("paths.missing")
													: action === "reveal"
														? t("paths.open")
														: t("paths.copy")}
										</span>
									</button>
								);
							})}
							{paths.container ? (
								<span className="astra-strix-paths-note">{t("paths.containerNote", { container: paths.container })}</span>
							) : (
								<span className="astra-strix-paths-note">{t("paths.noContainer")}</span>
							)}
						</span>
					) : null}
				</span>
			</span>
		</div>
	);
}
