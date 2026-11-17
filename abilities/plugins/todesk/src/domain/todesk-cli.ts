/**
 * The ToDesk client this plugin drives. Only three operations exist, all documented
 * (help center "ToDesk远程怎么使用命令行参数", Windows 4.0.0+):
 *
 *   -status      device code, version, autostart, running PIDs
 *   -control     open a session to a device code (`-passwd` optional)
 *   -autostart   start with Windows on/off
 *
 * Two behaviours of that CLI are load-bearing here:
 *  - the exit code is 1 even on success, so it is never a verdict;
 *  - the answer shares a line with libusb noise (`123456789[libusb] …`).
 */

export const TODESK_DIRS: readonly string[] = [
	"C:\\Program Files\\ToDesk",
	"C:\\Program Files (x86)\\ToDesk",
];

export const TODESK_EXE = "ToDesk.exe";

export function cleanCliOutput(raw: string): string[] {
	return raw
		.split(/\r?\n/)
		.map((line) => {
			const cut = line.indexOf("[libusb]");
			if (cut === 0) return "";
			return (cut > 0 ? line.slice(0, cut) : line).trim();
		})
		.filter((line) => line.length > 0);
}

/** Device codes are nine digits; ToDesk prints them plain, users type them with spaces. */
export function normalizeDeviceId(value: string): string | null {
	const digits = value.replace(/\s+/g, "");
	return /^\d{9}$/.test(digits) ? digits : null;
}

export interface CliStatus {
	deviceId: string | null;
	version: string | null;
	platform: string | null;
	autostart: boolean | null;
	running: boolean;
	server: string | null;
	uptime: string | null;
}

export function parseVersion(raw: string): { version: string; platform: string | null } | null {
	for (const line of cleanCliOutput(raw)) {
		const match = /^ToDesk\s+([\d.]+)\s+for\s+(\w+)/i.exec(line);
		if (match) return { version: match[1], platform: match[2].toLowerCase() };
	}
	return null;
}

export function parseGetId(raw: string): string | null {
	for (const line of cleanCliOutput(raw)) {
		const direct = normalizeDeviceId(line);
		if (direct) return direct;
		const labelled = /^ToDesk\s*ID\s*[:：]\s*(\d[\d ]*)$/i.exec(line);
		if (labelled) return normalizeDeviceId(labelled[1]);
	}
	return null;
}

export function parseStatus(raw: string): CliStatus {
	const status: CliStatus = {
		deviceId: null,
		version: null,
		platform: null,
		autostart: null,
		running: false,
		server: null,
		uptime: null,
	};

	for (const line of cleanCliOutput(raw)) {
		const id = /^ToDesk\s*ID\s*[:：]\s*(\d[\d ]*)$/i.exec(line);
		if (id) {
			status.deviceId = normalizeDeviceId(id[1]);
			continue;
		}
		const version = /^ToDesk\s+([\d.]+)\s+for\s+(\w+)/i.exec(line);
		if (version) {
			status.version = version[1];
			status.platform = version[2].toLowerCase();
			continue;
		}
		const autostart = /^Start ToDesk with Windows\s*:\s*(ON|OFF)\s*$/i.exec(line);
		if (autostart) {
			status.autostart = autostart[1].toUpperCase() === "ON";
			continue;
		}
		if (/^PID\s*:\s*\d+/i.test(line)) {
			status.running = true;
			continue;
		}
		const server = /^Server\s*:\s*(\S+)\s+Port\s*:\s*(\d+)/i.exec(line);
		if (server) {
			status.server = `${server[1]}:${server[2]}`;
			continue;
		}
		const uptime = /^Uptime\s*:\s*(.+)$/i.exec(line);
		if (uptime) status.uptime = uptime[1].trim();
	}

	return status;
}

/**
 * `ToDesk.exe -control -id <id> [-passwd <pwd>]`.
 *
 * The password argument is **optional on purpose**: with a device code the ToDesk
 * client opens its own password dialog, which is the product's actual flow. Passing
 * `-passwd` only short-circuits that dialog for a device the user already unlocked.
 */
export function buildControlArgs(deviceId: string, password = ""): string[] | null {
	const id = normalizeDeviceId(deviceId);
	if (!id) return null;
	const args = ["-control", "-id", id];
	if (password.length > 0) args.push("-passwd", password);
	return args;
}

export const AUTOSTART_ON_ARGS: readonly string[] = ["-autostart", "on"];
export const AUTOSTART_OFF_ARGS: readonly string[] = ["-autostart", "off"];

/**
 * ToDesk's CLI has no "end this session": `-exit` quits the client, which is the only
 * documented way to drop every session it holds (sessions live inside the client
 * process). `-close` exists in the binary but was measured to do nothing.
 */
export const DISCONNECT_ARGS: readonly string[] = ["-exit"];

/** `ToDesk://connect&<id>&<password>` — the browser form from the same article. */
export function buildConnectUrl(deviceId: string, password = ""): string | null {
	const id = normalizeDeviceId(deviceId);
	if (!id) return null;
	return password.length > 0 ? `ToDesk://connect&${id}&${password}` : `ToDesk://connect&${id}`;
}

/** PATH with the install directory first, so a bare `ToDesk.exe` resolves. */
export function pathWithTodesk(dir: string, base: string | undefined): string {
	if (!base) return dir;
	return `${dir};${base}`;
}
