import type { ReactNode } from "react";
import { DOWNLOAD_URL, useTodeskConsole } from "../hooks/use-todesk-console";
import { ConnectCard } from "./connect-card";
import { DiagnosticsPanel } from "./diagnostics-panel";
import { LocalDeviceCard } from "./local-device-card";
import { ReadinessCard } from "./readiness-card";
import { SavedDevicesCard } from "./saved-devices-card";

/**
 * Ordered by the job the user is doing, not by the API: this machine → saved devices →
 * manual code → readiness → diagnostics. See ADR 0011 §3.6, ADR 0005 (no MCP) and
 * ADR 0006 (no embedded viewer: the picture lives in ToDesk's own window).
 */
export function TodeskConsoleView({
	deps,
	t,
	canRun,
}: {
	deps: Parameters<typeof useTodeskConsole>[0];
	t: (key: string, params?: Record<string, string | number>) => string;
	canRun: boolean;
}): ReactNode {
	const { state, refresh, setTool, connect, disconnect, setAutostart, openTodesk, openDownloadPage, pickDevice } =
		useTodeskConsole(deps, t);

	return (
		<div className="td-root h-full overflow-y-auto">
			<div className="mx-auto flex w-full max-w-[680px] flex-col gap-2.5 px-5 py-4">
				<div className="flex items-baseline justify-between gap-2">
					<h1 className="td-title">{t("view.label")}</h1>
					<button type="button" className="td-btn" data-tone="ghost" onClick={openDownloadPage}>
						{t("view.download")}
					</button>
				</div>

				<LocalDeviceCard
					local={state.local}
					busy={state.busy}
					canRun={canRun}
					onRefresh={() => void refresh()}
					onLaunch={() => void openTodesk()}
					onAutostart={(on) => void setAutostart(on)}
					t={t}
				/>

				<SavedDevicesCard devices={state.devices} known={state.devicesKnown} busy={state.busy} onPick={pickDevice} t={t} />

				<ConnectCard
					busy={state.busy}
					note={state.note}
					session={state.session}
					localDeviceId={state.local.deviceId}
					screenHint={t("connect.screen")}
					prefillDeviceId={state.pendingDeviceId}
					onConnect={connect}
					onDisconnect={disconnect}
					onRefreshLocal={() => void refresh()}
					onOpenClient={() => void openTodesk()}
					t={t}
				/>

				<ReadinessCard report={state.readiness} busy={state.busy} onRefresh={() => void refresh()} t={t} />

				<p className="td-meta px-1">{t("inbound.summary", { url: DOWNLOAD_URL })}</p>

				<DiagnosticsPanel
					local={state.local}
					enabled={state.tools}
					busy={state.busy}
					lastCommand={state.lastCommand}
					onToggleTool={(key, next) => void setTool(key, next)}
					onRefresh={() => void refresh()}
					t={t}
				/>
			</div>
		</div>
	);
}
