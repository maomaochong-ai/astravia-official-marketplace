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
}

export interface ReadinessReport {
	verdict: ReadinessVerdict;
	items: ReadinessItem[];
}

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
	// The client's own row is the only trace of it, and it is a snapshot — say so.
	const stillConnected = (input.devices ?? []).filter((device) => device.isConnected);
	if (stillConnected.length > 0) {
		items.push({
			code: "stale-session",
			state: "warn",
			detail: `${stillConnected.length} saved device(s) are still marked as connected by the client (${stillConnected
				.map((device) => device.name)
				.join(", ")}). If that session was not closed, it keeps occupying a channel.`,
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
