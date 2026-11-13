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
		// The daemon is up but the image is not local. Pulling it is a network operation
		// against ghcr.io that fails on restricted networks (EOF / blocked), and failing it
		// left the panel stuck on "sandbox failed" after a long wait. So the environment
		// resolves to this machine up front: the tools run, the session starts, and the
		// reason is stated instead of surfacing as a failure.
		return {
			mode: "host",
			ready: true,
			detail: `sandbox image ${image} is not present; running on this machine`,
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
