/**
 * Where the assessment's artefacts live.
 *
 * The host passes `ASTRAVIA_SERVICE_DATA_DIR`; a standalone run (tests, a manual
 * `node dist/service/main.mjs`) does not, and the fallback must never be the process's
 * working directory - that wrote `notes/` and `todos/` into the plugin package the
 * first time it was run from a checkout.
 *
 * One resolver, imported by every store, so the four artefact kinds cannot drift into
 * different directories.
 */

import { homedir } from "node:os";
import { join } from "node:path";

export function resolveDataDir(env: NodeJS.ProcessEnv = process.env): string {
	const configured = env.ASTRAVIA_SERVICE_DATA_DIR?.trim();
	if (configured) return configured;
	return join(homedir(), ".astravia", "plugin-data", "strix");
}

/** A filesystem-safe key for one assessment session. */
export function sessionKey(sessionId: string): string {
	return sessionId.replace(/[^A-Za-z0-9_-]/g, "") || "default";
}
