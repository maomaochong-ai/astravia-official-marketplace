/**
 * Where a scan actually runs.
 *
 * See `docs/adr/strix/strix-0001-environment-without-docker.md`: Docker is an
 * accelerator, not a prerequisite. Without a daemon the same tools run in the
 * user's own session — weaker isolation, still usable — and that difference is
 * reported instead of blocking the launch.
 */

import { dockerReady, imagePresent } from "./docker";

export type EnvironmentMode = "docker" | "host";

export interface ResolvedEnvironment {
	readonly mode: EnvironmentMode;
	readonly ready: boolean;
	readonly detail: string;
	readonly docker: { ready: boolean; detail: string; imagePresent: boolean | null };
}

/**
 * One decision, two answers. Resolved once per request so a daemon that comes up
 * later is picked up on the next scan rather than at plugin load.
 */
export async function resolveEnvironment(image: string): Promise<ResolvedEnvironment> {
	const probe = await dockerReady().catch((error: unknown) => ({
		ready: false,
		detail: error instanceof Error ? error.message : String(error),
	}));

	if (probe.ready) {
		const present = await imagePresent(image).catch(() => null);
		if (present === true) {
			return {
				mode: "docker",
				ready: true,
				detail: "docker ready",
				docker: { ready: true, detail: probe.detail, imagePresent: present },
			};
		}
		// Daemon up, image missing: still docker mode. The pull happens once, in `start()`,
		// because that is where the user can see progress and where a failure has a sandbox
		// to fall back to. Deciding host here would have silently given up the container's
		// toolchain — which is exactly what the panel then had to apologise for.
		return {
			mode: "docker",
			ready: true,
			detail: `sandbox image ${image} is not pulled yet`,
			docker: { ready: true, detail: probe.detail, imagePresent: present },
		};
	}

	// No daemon: run in the user's session. This is the degraded path, and it is a
	// decision, not a failure — the panel says so instead of refusing to start.
	return {
		mode: "host",
		ready: true,
		detail: `running without a container (${probe.detail})`,
		docker: { ready: false, detail: probe.detail, imagePresent: null },
	};
}
