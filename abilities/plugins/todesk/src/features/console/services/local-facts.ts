import { buildControlArgs, normalizeDeviceId, parseGetId, parseStatus, parseVersion } from "../../../domain/todesk-cli";
import { outputOf, runTodesk } from "../../../domain/todesk-launch";
import { CONFIG_CANDIDATES, parseTodeskConfig } from "../../../domain/todesk-config";
import type { ConsoleDeps, LocalFacts } from "../../../runtime-contract";
import { EMPTY_LOCAL } from "../../../runtime-contract";

/**
 * Local identity, in the order the machine can actually answer it:
 *   1. `ToDesk.exe -status`  (device id, version, autostart flag, PIDs)
 *   2. `-getid` / `-version` (older builds, or a status line that changed)
 *   3. `config.ini`          (CLI unusable, e.g. a non-default install path)
 *
 * The host's own failure text is carried out to the panel: "not found" that hides *why*
 * is how the earlier build ended up reporting a bare `ToDesk.exe not found`.
 */
export async function readLocalFacts(deps: ConsoleDeps, basePath?: string): Promise<LocalFacts> {
	const status = await runTodesk(deps.run, ["-status"], basePath);
	if (status.ok && status.result) {
		const parsed = parseStatus(outputOf(status.result));
		if (parsed.deviceId) {
			return {
				deviceId: parsed.deviceId,
				version: parsed.version,
				autostart: parsed.autostart,
				running: parsed.running,
				source: "cli",
				launchError: null,
				readFailed: false,
			};
		}
	}

	const id = await runTodesk(deps.run, ["-getid"], basePath);
	const deviceId = id.ok && id.result ? parseGetId(outputOf(id.result)) : null;
	if (deviceId) {
		const version = await runTodesk(deps.run, ["-version"], basePath);
		return {
			...EMPTY_LOCAL,
			deviceId,
			version: version.ok && version.result ? (parseVersion(outputOf(version.result))?.version ?? null) : null,
			running: true,
			source: "cli",
		};
	}

	let refused = false;
	for (const path of CONFIG_CANDIDATES) {
		try {
			const parsed = parseTodeskConfig(await deps.readTextFile(path));
			if (parsed) {
				return {
					...EMPTY_LOCAL,
					deviceId: parsed.clientId,
					version: parsed.version,
					source: "config",
					launchError: status.error ?? id.error,
				};
			}
		} catch {
			refused = true;
		}
	}

	return {
		...EMPTY_LOCAL,
		launchError: status.error ?? id.error,
		readFailed: refused,
	};
}

export { buildControlArgs, normalizeDeviceId };
