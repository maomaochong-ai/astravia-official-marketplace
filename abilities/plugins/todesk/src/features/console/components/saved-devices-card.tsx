import type { ReactNode } from "react";
import type { SavedDevice } from "../../../domain/device-store";

/**
 * The machines the client already knows — the panel's fast path.
 *
 * Rows are ordered by the client's own pin, then by recency, because that is the order
 * the user already chose inside ToDesk. A device with a saved credential connects in one
 * click; the others hand the code to the manual row below, because their temporary
 * password still has to be typed (ADR 0011 §3.3).
 */
export function SavedDevicesCard({
	devices,
	known,
	busy,
	onPick,
	t,
}: {
	devices: SavedDevice[];
	/** False when the store could not be read: say "unknown", not "none". */
	known: boolean;
	busy: boolean;
	onPick: (device: SavedDevice) => void;
	t: (key: string, params?: Record<string, string | number>) => string;
}): ReactNode {
	return (
		<section className="td-panel px-4 py-3.5">
			<div className="flex items-baseline justify-between gap-2">
				<h2 className="td-title">{t("devices.title")}</h2>
				<span className="td-meta">{known ? devices.length : "—"}</span>
			</div>

			{!known ? (
				<p className="td-meta mt-1.5">{t("devices.unavailable")}</p>
			) : devices.length === 0 ? (
				<p className="td-meta mt-1.5">{t("devices.empty")}</p>
			) : (
				<ul className="mt-2 flex flex-col divide-y divide-[var(--td-rule)]">
					{devices.map((device) => (
						<li key={device.deviceId} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
							<div className="min-w-0">
								<div className="flex items-center gap-1.5">
									<span className="truncate text-[13px]">{device.name}</span>
									{device.isPinned ? <span className="td-tag">{t("devices.pinned")}</span> : null}
									{device.hasSavedCredential ? <span className="td-tag">{t("devices.credential")}</span> : null}
								</div>
								<p className="td-meta mt-0.5">
									<span className="td-mono">{device.deviceId}</span>
									{" · "}
									{device.lastConnectedAt
										? `${t("devices.last")} ${new Date(device.lastConnectedAt).toLocaleDateString()}`
										: t("devices.never")}
								</p>
							</div>
							<button
								type="button"
								className="td-btn shrink-0"
								data-tone={device.hasSavedCredential ? "primary" : "outline"}
								disabled={busy}
								onClick={() => onPick(device)}
							>
								{device.hasSavedCredential ? t("devices.connect") : t("devices.fill")}
							</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
