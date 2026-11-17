/**
 * The only thing this plugin reads out of ToDesk's own `config.ini` is the
 * public device code and the client version.
 *
 * The same file holds `Token`, `authPassEx` and `tempAuthPassEx` — an account
 * credential and the obfuscated temporary password. They are deliberately not
 * parsed here: returning them would put a password into React state and the
 * clipboard for no reason. The device code is public by design (you read it out
 * loud to whoever is connecting).
 */

export interface LocalDevice {
	/** The 9-digit code the phone types in. */
	clientId: string;
	version: string | null;
}

/** Windows install locations worth trying, in order. */
export const CONFIG_CANDIDATES: readonly string[] = [
	"C:\\Program Files\\ToDesk\\config.ini",
	"C:\\Program Files (x86)\\ToDesk\\config.ini",
];

const DEVICE_CODE = /^\d{5,12}$/;

export function parseTodeskConfig(text: string): LocalDevice | null {
	let clientId: string | null = null;
	let version: string | null = null;

	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith(";") || line.startsWith("#") || line.startsWith("[")) continue;
		const eq = line.indexOf("=");
		if (eq <= 0) continue;
		const key = line.slice(0, eq).trim().toLowerCase();
		const value = line.slice(eq + 1).trim();
		if (!value) continue;

		if (key === "clientid" && DEVICE_CODE.test(value)) clientId = value;
		else if (key === "version" && value.length <= 32) version = value;
	}

	if (!clientId) return null;
	return { clientId, version };
}
