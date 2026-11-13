/**
 * Docker plumbing for Strix's sandbox.
 *
 * Upstream's own runtime is Python; this plugin's service is TypeScript, so the
 * container is driven through the Docker CLI - the same daemon, the same Strix
 * image, one fewer language to ship. The image and its toolchain are upstream's;
 * only the launcher is ours.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface DockerResult {
	code: number;
	stdout: string;
	stderr: string;
}

async function docker(args: string[], timeoutMs = 30_000): Promise<DockerResult> {
	try {
		const { stdout, stderr } = await run("docker", args, {
			timeout: timeoutMs,
			windowsHide: true,
			maxBuffer: 8 * 1024 * 1024,
		});
		return { code: 0, stdout, stderr };
	} catch (error) {
		const failure = error as { code?: number; stdout?: string; stderr?: string; message?: string };
		return {
			code: typeof failure.code === "number" ? failure.code : 1,
			stdout: failure.stdout ?? "",
			stderr: failure.stderr ?? failure.message ?? "",
		};
	}
}

export async function dockerReady(): Promise<{ ready: boolean; detail: string }> {
	const result = await docker(["info", "--format", "{{.ServerVersion}}"], 20_000);
	if (result.code !== 0) {
		const first = (result.stderr || result.stdout).trim().split("\n")[0] ?? "";
		return { ready: false, detail: first || "docker daemon is not reachable" };
	}
	return { ready: true, detail: result.stdout.trim() };
}

export async function imagePresent(image: string): Promise<boolean | null> {
	const result = await docker(["image", "inspect", image, "--format", "{{.Id}}"], 20_000);
	if (result.code === 0) return true;
	// "not found" is an answer; anything else means docker could not tell us.
	return /no such image|not found/i.test(result.stderr) ? false : null;
}

export async function pullImage(image: string, onLog?: (line: string) => void): Promise<DockerResult> {
	const result = await docker(["pull", image], 15 * 60_000);
	if (result.code !== 0 && onLog) onLog(result.stderr.trim().slice(-2000));
	return result;
}

export interface SandboxSpec {
	name: string;
	image: string;
	/** Host directories exposed under /workspace. */
	mounts: { host: string; name: string; readOnly?: boolean }[];
	network?: string;
}

/**
 * Build `docker run` argv.
 *
 * Two details are not optional, and both come from upstream
 * (`strix/runtime/docker_client.py:14-17`):
 *
 * - `NET_RAW` / `NET_ADMIN`, because `nmap -sS`, `naabu` and the rest of the
 *   toolchain open raw sockets. Without them the binaries start and then fail with
 *   `Operation not permitted`, which reads as a broken image.
 * - `host.docker.internal` → host-gateway, so a target served on the developer's
 *   own machine is reachable from inside the sandbox.
 *
 * Exported so the shape can be asserted without a daemon.
 */
export function runArgs(spec: SandboxSpec): string[] {
	const args = [
		"run",
		"-d",
		"--name",
		spec.name,
		"--cap-add",
		"NET_RAW",
		"--cap-add",
		"NET_ADMIN",
		"--add-host",
		"host.docker.internal:host-gateway",
	];
	for (const mount of spec.mounts) {
		args.push("-v", `${mount.host}:/workspace/${mount.name}${mount.readOnly ? ":ro" : ""}`);
	}
	if (spec.network) args.push("--network", spec.network);
	// The image's own entrypoint is the agent CLI; the sandbox only needs to stay up.
	args.push("--entrypoint", "sleep", spec.image, "infinity");
	return args;
}

export const dockerApi = {
	run: (args: string[], timeoutMs?: number) => docker(args, timeoutMs),
	exec: (name: string, script: string, timeoutMs: number) =>
		docker(["exec", "-i", name, "sh", "-c", script], timeoutMs),
	remove: (name: string) => docker(["rm", "-f", name], 60_000),
};
