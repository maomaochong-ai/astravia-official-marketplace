/**
 * This machine's remote-access posture, read from ToDesk's own `config.ini`.
 *
 * The file is the client's settings dump. Three of its keys are secrets —
 * `authPassEx` (the unattended password), `tempAuthPassEx` (the one-time password) and
 * `Token` (the account session). None of them is returned here: the parser only turns
 * "value present / absent" into a boolean, because the point of this module is to answer
 * *"can someone reach this computer, and is it protected?"* — never to hand out the answer
 * value. The account line is masked for the same reason (ADR-0010).
 */

export interface ClientPosture {
	/** An unattended (security) password exists, so the machine can be reached while unattended. */
	unattendedPasswordSet: boolean | null;
	/** A one-time password is being offered to whoever connects now. */
	tempPasswordEnabled: boolean | null;
	/** Two-factor authentication for incoming connections. */
	twoFactorForConnect: boolean | null;
	/** Only accept connections from known/saved devices. */
	strangerConnectionLock: boolean | null;
	autostart: boolean | null;
	accountType: "phone" | "email" | "unknown";
	/** Masked account identifier, e.g. `138****8000` or `a***@example.com`. */
	accountHint: string | null;
}

const TRUE = new Set(["1", "true", "on", "yes"]);
const FALSE = new Set(["0", "false", "off", "no"]);

function parseFlag(value: string | undefined): boolean | null {
	if (value === undefined) return null;
	const normalized = value.trim().toLowerCase();
	if (TRUE.has(normalized)) return true;
	if (FALSE.has(normalized)) return false;
	return null;
}

export function maskAccount(value: string, type: "phone" | "email" | "unknown"): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	if (type === "email" || trimmed.includes("@")) {
		const at = trimmed.indexOf("@");
		if (at <= 0) return null;
		const local = trimmed.slice(0, at);
		const domain = trimmed.slice(at);
		return `${local.slice(0, 1)}***${domain}`;
	}

	const digits = trimmed.replace(/\D/g, "");
	if (digits.length >= 7) return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
	if (digits.length >= 4) return `${digits.slice(0, 2)}**${digits.slice(-2)}`;
	return null;
}

export function parsePosture(text: string): ClientPosture | null {
	const values = new Map<string, string>();
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith(";") || line.startsWith("#") || line.startsWith("[")) continue;
		const eq = line.indexOf("=");
		if (eq <= 0) continue;
		values.set(line.slice(0, eq).trim().toLowerCase(), line.slice(eq + 1).trim());
	}

	const has = (key: string): boolean | null => {
		const value = values.get(key);
		return value === undefined ? null : value.length > 0;
	};

	// No recognisable client settings at all: report nothing rather than a wall of nulls.
	if (has("clientid") === null && has("version") === null) return null;

	const loginType = (values.get("logintype") ?? "").toLowerCase();
	const accountType: ClientPosture["accountType"] =
		loginType === "2" ? "phone" : loginType === "1" || loginType === "3" ? "email" : "unknown";
	const accountSource = values.get("loginemail") || values.get("loginphone") || "";

	return {
		unattendedPasswordSet: has("authpassex"),
		tempPasswordEnabled: parseFlag(values.get("isopentemppass")),
		twoFactorForConnect: parseFlag(values.get("tfaforconn")),
		strangerConnectionLock: parseFlag(values.get("isstrangeconnectionlock")),
		autostart: parseFlag(values.get("autostart")),
		accountType,
		accountHint: accountSource ? maskAccount(accountSource, accountType) : null,
	};
}

export interface PostureFinding {
	code: string;
	severity: "info" | "warn";
	/** Plain English: the agent repeats this, the panel translates it. */
	message: string;
	/** A command when one exists, an exact UI path otherwise (ADR 0011 §3.2). Omitted when nothing is wrong. */
	fix?: string;
}

/**
 * What the posture means, in the order worth saying it. Kept here (not in the tool) so a
 * test can pin the wording: advice that drifts is advice nobody trusts.
 */
export function postureFindings(posture: ClientPosture): PostureFinding[] {
	const findings: PostureFinding[] = [];

	if (posture.unattendedPasswordSet === false) {
		findings.push({
			code: "no-unattended-password",
			severity: "warn",
			message:
				"No unattended password is set, so this computer can only be reached while its ToDesk window is open and handing out a one-time password.",
			fix: "ToDesk.exe -setpasswd <new password>, or 高级设置 → 安全设置 → 安全密码",
		});
	}
	if (posture.tempPasswordEnabled === false) {
		findings.push({
			code: "temp-password-off",
			severity: "warn",
			message: "The one-time password is off — a device that has no saved password cannot connect.",
			fix: "高级设置 → 安全设置 → 临时密码",
		});
	}
	if (posture.twoFactorForConnect === false) {
		findings.push({
			code: "no-2fa",
			severity: "info",
			message: "Two-factor authentication for incoming connections is off.",
			fix: "高级设置 → 安全设置 → 二次安全验证",
		});
	}
	if (posture.strangerConnectionLock === false) {
		findings.push({
			code: "stranger-connection-allowed",
			severity: "warn",
			message:
				"Strange-device connections are allowed: any code plus a valid password is accepted, not only saved devices.",
			fix: "高级设置 → 安全设置 → 连接限制（黑白名单 / 手动同意）",
		});
	}
	if (posture.autostart === false) {
		findings.push({
			code: "no-autostart",
			severity: "info",
			message: "ToDesk does not start with Windows, so this machine is unreachable after a reboot until someone opens it.",
			fix: "ToDesk.exe -autostart on",
		});
	}
	if (findings.length === 0) {
		findings.push({
			code: "locked-down",
			severity: "info",
			message: "Unattended access, a one-time password and the lock against strange devices are all in place.",
		});
	}
	return findings;
}
