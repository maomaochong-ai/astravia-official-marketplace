import { useEffect, useState } from "react";
import {
	AUTOSTART_OFF_ARGS,
	AUTOSTART_ON_ARGS,
	DISCONNECT_ARGS,
	buildControlArgs,
	normalizeDeviceId,
} from "../../../domain/todesk-cli";
import { runTodesk } from "../../../domain/todesk-launch";
import type { ConsoleDeps, LocalFacts } from "../../../runtime-contract";
import { EMPTY_LOCAL } from "../../../runtime-contract";
import type { ToolKey } from "../components/diagnostics-panel";
import type { ClientPosture } from "../../../domain/client-posture";
import type { SavedDevice } from "../../../domain/device-store";
import { assessReadiness, type ReadinessReport } from "../../../domain/remote-readiness";
import { readLocalFacts } from "../services/local-facts";
import { readLocalStore } from "../services/local-store";

export const ALLOW_COMMANDS_KEY = "allowCommands";
export const TOOLS_KEY = "tools";
export const DOWNLOAD_URL = "https://www.todesk.com/download.html";

export type Note = { kind: "ok" | "info" | "error"; text: string } | null;
export type ToolFlags = Record<ToolKey, boolean>;
export const ALL_TOOLS_ON: ToolFlags = {
	status: true,
	readiness: true,
	devices: true,
	connect: true,
	usage: true,
	posture: true,
	account: true,
	autostart: true,
	open: true,
	tray: true,
	disconnect: true,
};

/**
 * A launched session, tracked so the panel can stop claiming "connected" forever.
 * ToDesk gives no session API, so "started" means the command was accepted; the real
 * picture and its lifetime live in ToDesk's own window.
 */
export interface Session {
	target: string;
	state: "started" | "ended";
	at: number;
}

export interface ConsoleState {
	phase: "loading" | "ready";
	local: LocalFacts;
	tools: ToolFlags;
	busy: boolean;
	note: Note;
	session: Session | null;
	lastCommand: string | null;
	/** What the client remembers, so a machine can be picked by name (ADR 0011 §3.3). */
	devices: SavedDevice[];
	/** false when the client's store could not be read — the list is unknown, not empty. */
	devicesKnown: boolean;
	posture: ClientPosture | null;
	readiness: ReadinessReport | null;
	/** Set when a saved device still needs the far side's temporary password. */
	pendingDeviceId: string | null;
}

function readTools(settings: Record<string, unknown>, granted: boolean): ToolFlags {
	const stored = settings[TOOLS_KEY];
	if (stored && typeof stored === "object") {
		const record = stored as Record<string, unknown>;
		return {
			status: record.status !== false,
			readiness: record.readiness !== false,
			devices: record.devices !== false,
			connect: record.connect !== false,
			usage: record.usage !== false,
			posture: record.posture !== false,
			account: record.account !== false,
			autostart: record.autostart !== false,
			open: record.open !== false,
			tray: record.tray !== false,
			disconnect: record.disconnect !== false,
		};
	}
	if (typeof settings[ALLOW_COMMANDS_KEY] === "boolean") {
		const on = settings[ALLOW_COMMANDS_KEY] === true;
		return { ...ALL_TOOLS_ON, connect: on, autostart: on, open: on, tray: on, disconnect: on };
	}
	return granted
		? ALL_TOOLS_ON
		: { ...ALL_TOOLS_ON, connect: false, account: false, autostart: false, open: false, tray: false, disconnect: false };
}

export function useTodeskConsole(
	deps: ConsoleDeps,
	t: (key: string, params?: Record<string, string | number>) => string,
) {
	const [state, setState] = useState<ConsoleState>({
		phase: "loading",
		local: EMPTY_LOCAL,
		tools: ALL_TOOLS_ON,
		busy: false,
		note: null,
		session: null,
		lastCommand: null,
		devices: [],
		devicesKnown: false,
		posture: null,
		readiness: null,
		pendingDeviceId: null,
	});

	async function refresh(): Promise<void> {
		const settings = (await deps.readSettings().catch(() => null)) ?? {};
		const local = await readLocalFacts(deps).catch(() => EMPTY_LOCAL);
		// The store is a bonus, never a requirement: without it the panel still works.
		const store = await readLocalStore(deps).catch(() => null);
		const devices = store && !store.error ? store.devices : null;
		const posture = store?.posture ?? null;
		const readiness = assessReadiness({
			deviceId: local.deviceId,
			clientRunning: local.running,
			autostart: local.autostart,
			posture,
			devices,
		});

		setState((prev) => ({
			...prev,
			phase: "ready",
			local,
			devices: devices ?? [],
			devicesKnown: devices !== null,
			posture,
			readiness,
			tools: readTools(settings, local.source === "cli"),
			busy: false,
			// A session whose client is gone is over — say so instead of a stale success.
			session: prev.session && local.running ? prev.session : prev.session ? { ...prev.session, state: "ended" } : null,
		}));
	}

	useEffect(() => {
		void refresh();
		// Mount-only: `deps` is a stable adapter built once per activation.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function persist(patch: Record<string, unknown>): Promise<void> {
		const current = (await deps.readSettings().catch(() => null)) ?? {};
		await deps.writeSettings({ ...current, ...patch });
	}

	async function setTool(key: ToolKey, next: boolean): Promise<void> {
		const tools: ToolFlags = { ...state.tools, [key]: next };
		await persist({ [TOOLS_KEY]: tools });
		setState((prev) => ({ ...prev, tools }));
	}

	async function setAutostart(on: boolean): Promise<void> {
		setState((prev) => ({ ...prev, busy: true }));
		const run = await runTodesk(deps.run, [...(on ? AUTOSTART_ON_ARGS : AUTOSTART_OFF_ARGS)], undefined);
		if (!run.ok) deps.notifyError(t("local.autostart.failed"), new Error(run.error ?? "ToDesk.exe"));
		await refresh();
	}

	/** Pick a saved device: connect directly when it carries a credential, else prefill. */
	async function pickDevice(device: SavedDevice): Promise<void> {
		if (device.hasSavedCredential) {
			await connect(device.deviceId, "");
			return;
		}
		setState((prev) => ({
			...prev,
			pendingDeviceId: device.deviceId,
			note: { kind: "info", text: t("devices.needPassword", { name: device.name }) },
		}));
	}

	async function connect(deviceId: string, password: string): Promise<boolean> {
		const args = buildControlArgs(deviceId, password);
		if (!args) {
			setState((prev) => ({ ...prev, note: { kind: "error", text: t("connect.invalid") } }));
			return false;
		}
		const id = normalizeDeviceId(deviceId) ?? deviceId;
		// Plain code in the transcript: it is an identifier, not a secret.
		setState((prev) => ({ ...prev, busy: true, note: null, lastCommand: `ToDesk.exe ${args.join(" ")}` }));

		const run = await runTodesk(deps.run, args, undefined);
		setState((prev) => ({
			...prev,
			busy: false,
			session: run.ok ? { target: id, state: "started", at: Date.now() } : prev.session,
			pendingDeviceId: null,
			note: run.ok
				? { kind: "ok", text: password ? t("connect.sent.withPassword", { id: id }) : t("connect.sent", { id: id }) }
				: { kind: "error", text: `${t("connect.failed")}：${run.error ?? ""}`.trim() },
		}));
		return run.ok;
	}

	/**
	 * ToDesk documents `-exit` and nothing that ends a single session, so "disconnect"
	 * closes the client. That is what the vendor's own CLI offers; the panel says so and
	 * offers to bring the client back.
	 */
	async function disconnect(): Promise<boolean> {
		setState((prev) => ({ ...prev, busy: true, note: null }));
		const run = await runTodesk(deps.run, [...DISCONNECT_ARGS], undefined);
		const after = await readLocalFacts(deps).catch(() => EMPTY_LOCAL);

		setState((prev) => ({
			...prev,
			busy: false,
			local: after,
			session: prev.session ? { ...prev.session, state: "ended" } : null,
			note: run.ok
				? { kind: "info", text: t("connect.disconnected") }
				: { kind: "error", text: `${t("connect.disconnect.failed")}：${run.error ?? ""}`.trim() },
		}));
		return run.ok;
	}

	/**
	 * Opening the client is a convenience, so a failure here is a sentence in the panel,
	 * never a toast: the two ways it fails (host has not granted ToDesk.exe, ToDesk is not
	 * installed at the default path) are states the user fixes from this same screen.
	 */
	async function openTodesk(): Promise<void> {
		setState((prev) => ({ ...prev, busy: true, note: null }));
		const run = await runTodesk(deps.run, [], undefined);
		const after = await readLocalFacts(deps).catch(() => EMPTY_LOCAL);

		setState((prev) => ({
			...prev,
			busy: false,
			local: after,
			note: run.ok
				? { kind: "info", text: t("device.open.ok") }
				: {
						kind: "error",
						text: /disabled by user/i.test(run.error ?? "")
							? t("local.commandDenied")
							: t("device.open.failed", { error: run.error ?? "" }),
					},
		}));
	}

	return {
		state,
		refresh,
		pickDevice: (device: SavedDevice) => void pickDevice(device),
		setTool,
		connect,
		disconnect,
		setAutostart,
		openTodesk,
		openDownloadPage: () => deps.openExternal(DOWNLOAD_URL),
	};
}
