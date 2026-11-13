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

/**
 * Where the plugin's own toolchain lives once the host has unpacked it.
 *
 * ADR strix-0005: the toolchain ships with the plugin, so `host` mode must look here
 * before the user's PATH — a machine without scoop or brew still has nmap. The host
 * hands us this service's managed runtime root; the tools sit in `toolchain/bin` under
 * it. A missing root means "not prepared yet", which the panel can say out loud.
 */
export function managedToolchainDir(env: NodeJS.ProcessEnv = process.env): string | null {
	const root = env.ASTRAVIA_SERVICE_RUNTIME_DIR?.trim();
	return root ? join(root, "toolchain", "bin") : null;
}

/** A filesystem-safe key for one assessment session. */
export function sessionKey(sessionId: string): string {
	return sessionId.replace(/[^A-Za-z0-9_-]/g, "") || "default";
}
