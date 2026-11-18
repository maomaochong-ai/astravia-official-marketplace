/**
 * "Can I leave, and can they reach me?" — one verdict instead of four lookups.
 *
 * The panel and the agent both need this answer, so it is a pure function over facts
 * somebody else already read: client identity, the posture flags, and the saved devices.
 * No I/O here, which is what makes the verdict testable — the rules below are the whole
 * contract (ADR 0011 §3.1).
 */

import { ACCESS_FIX } from "./access-fixes";
import type { ClientPosture } from "./client-posture";
import type { SavedDevice } from "./device-store";

export type ReadinessVerdict = "ready" | "degraded" | "blocked";
export type ReadinessState = "ok" | "warn" | "bad";

export interface ReadinessItem {
	code: string;
	state: ReadinessState;
	/** Plain English, agent-facing; the panel renders `code` through its own locales. */
	detail: string;
	/** A concrete remedy: a command when one exists, an exact UI path otherwise. */
	fix?: string;
}

export interface ReadinessInput {
	deviceId: string | null;
	clientRunning: boolean;
	/** From `-status`; the posture file is only a fallback for it. */
	autostart: boolean | null;
	posture: ClientPosture | null;
	/** null = the store could not be read, which is not the same as "none saved". */
	devices: SavedDevice[] | null;
	/** Reference time for the stale-session check; injected so the rule is testable. */
	now?: Date;
	/** How long a "connected" row may stay true before it counts as leftover. Default 12 h. */
	staleAfterMs?: number;
}

export interface ReadinessReport {
	verdict: ReadinessVerdict;
	items: ReadinessItem[];
}

/** A session marked connected for longer than this is a leftover, not a live session. */
export const STALE_SESSION_MS = 12 * 60 * 60 * 1000;

export function assessReadiness(input: ReadinessInput): ReadinessReport {
	const items: ReadinessItem[] = [];
	const posture = input.posture;

	if (!input.clientRunning) {
		items.push({
			code: "client-stopped",
			state: "bad",
			detail: "ToDesk is not running, so nobody can connect to this computer and nothing can be launched from it.",
			fix: ACCESS_FIX.clientStopped,
		});
	}

	if (!input.deviceId) {
		items.push({
			code: "no-device-code",
			state: "bad",
			detail: "This computer has no readable device code, so there is nothing to give the far side.",
			fix: ACCESS_FIX.noDeviceCode,
		});
	}

	// Inbound: the two things that actually stop a connection. Both off = nobody gets in.
	const unattended = posture?.unattendedPasswordSet ?? null;
	const tempPassword = posture?.tempPasswordEnabled ?? null;
	if (unattended === false || tempPassword === false) {
		const detail =
			unattended === false && tempPassword === false
				? "There is no unattended password and the one-time password is off, so this computer cannot be reached at all while unattended."
				: unattended === false
					? "No unattended password is set: this computer is only reachable while the ToDesk window is open and handing out a one-time password."
					: "The one-time password is off: a device without a saved password cannot get in.";
		items.push({
			code: unattended === false && tempPassword === false ? "inbound-closed" : unattended === false ? "unattended-password" : "temp-password",
			// Strictly speaking only "both off" is fatal; one of them is still a way in.
			state: unattended === false && tempPassword === false ? "bad" : "warn",
			detail,
			fix:
				unattended === false
					? "ToDesk.exe -setpasswd <new password>, or 高级设置 → 安全设置 → 安全密码"
					: "高级设置 → 安全设置 → 临时密码",
		});
	}

	if (posture === null) {
		items.push({
			code: "posture-unknown",
			state: "warn",
			detail: "The client's settings could not be read, so the access flags are unknown and this verdict only covers the process and the device list.",
			fix: ACCESS_FIX.postureUnknown,
		});
	}

	if (posture?.twoFactorForConnect === false) {
		items.push({
			code: "no-2fa",
			state: "warn",
			detail: "Incoming connections are protected by a password only; two-factor authentication is off.",
			fix: ACCESS_FIX.twoFactor,
		});
	}

	if (posture?.strangerConnectionLock === false) {
		items.push({
			code: "stranger-devices-allowed",
			state: "warn",
			detail: "Any device that knows the code and the password is accepted; only saved devices are not enforced.",
			fix: ACCESS_FIX.strangerDevices,
		});
	}

	const autostart = input.autostart ?? posture?.autostart ?? null;
	if (autostart === false) {
		items.push({
			code: "autostart",
			state: "warn",
			detail: "ToDesk does not start with Windows, so this computer is unreachable after a reboot until someone opens it.",
			fix: ACCESS_FIX.autostart,
		});
	}

	// faq 90: a session left open at home occupies a channel and the next connect fails.
	// The client's row is the only trace, and `IsConnected` alone cannot tell a live session
	// from a leftover one — the flag is a snapshot that never flips back by itself. The age
	// of the last connect is the discriminator: recent means the user is probably on that
	// machine right now, which is not a problem to report.
	const now = (input.now ?? new Date()).getTime();
	const staleAfter = input.staleAfterMs ?? STALE_SESSION_MS;
	const leftover = (input.devices ?? []).filter(
		(device) => device.isConnected && (device.lastConnectedAt === null || now - device.lastConnectedAt > staleAfter),
	);
	if (leftover.length > 0) {
		const described = leftover
			.map((device) =>
				device.lastConnectedAt
					? `${device.name} (last ${new Date(device.lastConnectedAt).toISOString().slice(0, 16).replace("T", " ")})`
					: `${device.name} (no recorded connect time)`,
			)
			.join(", ");
		items.push({
			code: "stale-session",
			state: "warn",
			detail: `The client still marks ${leftover.length} device(s) as connected with no connect since: ${described}. A session left open keeps occupying a channel.`,
			fix: ACCESS_FIX.staleSession,
		});
	}

	if (input.devices && input.devices.length === 0) {
		items.push({
			code: "no-saved-devices",
			state: "warn",
			detail: "The client has no saved devices, so reaching another machine needs its 9-digit code and its temporary password.",
			fix: ACCESS_FIX.noSavedDevices,
		});
	}

	const verdict: ReadinessVerdict = items.some((item) => item.state === "bad")
		? "blocked"
		: items.some((item) => item.state === "warn")
			? "degraded"
			: "ready";

	return { verdict, items };
}
