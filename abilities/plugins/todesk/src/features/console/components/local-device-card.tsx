import type { ReactNode } from "react";
import type { LocalFacts } from "../../../runtime-contract";
import { CopyButton } from "../../../shared/components/copy-button";
import { StatusPill } from "../../../shared/components/status-pill";

/**
 * Identity block. The device code is shown **plainly**: it is a public identifier that
 * the other side types in, and hiding it only made the user hunt for it. The one thing
 * that stays masked anywhere in this panel is a temporary password (`type="password"`).
 */
export function LocalDeviceCard({
	local,
	busy,
	canRun,
	onRefresh,
	onLaunch,
	onAutostart,
	t,
}: {
	local: LocalFacts;
	busy: boolean;
	canRun: boolean;
	onRefresh: () => void;
	onLaunch: () => void;
	onAutostart: (on: boolean) => void;
	t: (key: string, params?: Record<string, string | number>) => string;
}): ReactNode {
	const disabledReason = /disabled by user/i.test(local.launchError ?? "");

	return (
		<section className="td-panel px-4 py-3.5">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="td-label">{t("device.code")}</div>
					<div className="mt-0.5 flex items-end gap-2">
						<div className="td-code">{local.deviceId ?? "—"}</div>
						<button
							type="button"
							className="td-btn mb-1"
							data-tone="ghost"
							aria-label={t("device.refresh")}
							onClick={onRefresh}
							disabled={busy}
						>
							{t("device.refresh")}
						</button>
					</div>
					<div className="mt-1.5 flex flex-wrap items-center gap-2">
						{local.running ? (
							<StatusPill tone="ok" label={t("local.running")} />
						) : (
							<StatusPill tone="idle" label={t("local.not-running")} />
						)}
						{local.version ? (
							<span className="td-meta">{t("device.version", { version: local.version })}</span>
						) : null}
					</div>
				</div>
				<div className="flex shrink-0 flex-col items-end gap-1.5">
					<CopyButton
						value={local.deviceId ?? ""}
						label={t("device.copy")}
						doneLabel={t("copy.done")}
						failedLabel={t("copy.failed")}
					/>
					{canRun ? (
						<button type="button" className="td-btn" data-tone="ghost" onClick={onLaunch} disabled={busy}>
							{t("device.open")}
						</button>
					) : null}
				</div>
			</div>

			<div className="mt-2.5 flex items-start justify-between gap-3 border-t border-[var(--td-rule)] pt-2.5">
				<div className="min-w-0">
					<div className="text-[12px]">{t("device.password.title")}</div>
					<p className="td-meta">{t("device.password.body")}</p>
				</div>
				{canRun ? (
					<button
						type="button"
						className="td-btn shrink-0"
						data-tone="outline"
						disabled={busy}
						onClick={onLaunch}
					>
						{t("device.password.show")}
					</button>
				) : null}
			</div>

			<div className="mt-2.5 flex items-center justify-between gap-3 border-t border-[var(--td-rule)] pt-2.5">
				<div className="min-w-0">
					<div className="text-[12px]">{t("local.autostart.title")}</div>
					<p className="td-meta">
						{local.autostart === null
							? t("local.autostart.unknown")
							: local.autostart
								? t("local.autostart.on")
								: t("local.autostart.off")}
					</p>
				</div>
				{canRun ? (
					<button
						type="button"
						className="td-btn shrink-0"
						data-tone="outline"
						disabled={busy || local.autostart === null}
						onClick={() => onAutostart(!(local.autostart ?? false))}
					>
						{local.autostart ? t("local.autostart.disable") : t("local.autostart.enable")}
					</button>
				) : null}
			</div>

			{local.launchError ? (
				<p className="td-meta mt-2 text-[var(--td-warn)]">
					{disabledReason ? t("local.commandDenied") : t("local.launchError", { error: local.launchError })}
				</p>
			) : null}
		</section>
	);
}
