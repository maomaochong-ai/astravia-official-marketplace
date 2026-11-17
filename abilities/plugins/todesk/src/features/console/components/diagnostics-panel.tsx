import type { ReactNode } from "react";
import type { LocalFacts } from "../../../runtime-contract";

/** One switch per agent capability; the host grant still gates all of them. */
export const TOOL_KEYS = ["status", "connect", "autostart", "open", "disconnect"] as const;
export type ToolKey = (typeof TOOL_KEYS)[number];

/**
 * Diagnostics, collapsed by default: what the agent may do — **per capability**, since
 * a blanket on/off was the thing the user objected to — whether the host granted the
 * command, and the last command that ran (with the device code masked).
 */
export function DiagnosticsPanel({
	local,
	enabled,
	busy,
	lastCommand,
	onToggleTool,
	onRefresh,
	t,
}: {
	local: LocalFacts;
	enabled: Record<ToolKey, boolean>;
	busy: boolean;
	lastCommand: string | null;
	onToggleTool: (key: ToolKey, next: boolean) => void;
	onRefresh: () => void;
	t: (key: string, params?: Record<string, string | number>) => string;
}): ReactNode {
	const granted = local.source === "cli";
	const shownCommand = lastCommand;

	return (
		<details className="td-panel px-4 py-3">
			<summary className="cursor-pointer text-[12px] font-medium text-[var(--td-dim)] hover:text-[var(--td-text)]">
				{t("diag.title")}
			</summary>

			<div className="mt-3 space-y-2.5">
				<div>
					<div className="text-[12px]">{t("diag.agent.title")}</div>
					<p className="td-meta">{t("diag.agent.body")}</p>
					<ul className="mt-1.5 space-y-1">
						{TOOL_KEYS.map((key) => (
							<li key={key} className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<div className="td-mono text-[11px]">{t(`diag.tools.${key}.name`)}</div>
									<p className="td-meta">{t(`diag.tools.${key}`)}</p>
								</div>
								<label className="td-switch shrink-0">
									<input
										type="checkbox"
										checked={enabled[key]}
										disabled={busy}
										onChange={(event) => onToggleTool(key, event.target.checked)}
										aria-label={t(`diag.tools.${key}.name`)}
									/>
									<span />
								</label>
							</li>
						))}
					</ul>
				</div>

				<div className="border-t border-[var(--td-rule)] pt-2">
					<div className="flex items-center justify-between gap-2">
						<span className="td-label">{t("diag.host.title")}</span>
						<button type="button" className="td-btn" data-tone="ghost" onClick={onRefresh} disabled={busy}>
							{t("diag.refresh")}
						</button>
					</div>
					<p className="td-meta mt-1">{granted ? t("diag.host.granted") : t("diag.host.missing")}</p>
					{local.launchError ? (
						<pre className="td-mono mt-1 whitespace-pre-wrap text-[10.5px] text-[var(--td-dim)]">
							{local.launchError}
						</pre>
					) : null}
				</div>

				{shownCommand ? (
					<div className="border-t border-[var(--td-rule)] pt-2">
						<div className="td-label">{t("diag.lastCommand")}</div>
						<pre className="td-mono mt-1 whitespace-pre-wrap text-[10.5px] text-[var(--td-dim)]">
							{shownCommand}
						</pre>
					</div>
				) : null}
			</div>
		</details>
	);
}
