import { pathWithTodesk, TODESK_DIRS, TODESK_EXE } from "../domain/todesk-cli";
import type { RunResult } from "../runtime-contract";

export type Runner = (file: string, args: string[], env?: Record<string, string>) => Promise<RunResult>;

export interface Invocation {
	ok: boolean;
	result: RunResult | null;
	/** The exact failure the host reported, for the panel and the agent to quote. */
	error: string | null;
	/** Which install directory answered. */
	dir: string | null;
}

/**
 * Run `ToDesk.exe <args>`.
 *
 * The host will not spawn a path outside an allowed root, so the invocation is a bare
 * `ToDesk.exe` with the install directory prepended to PATH — that is the form the
 * `commands` allow-list is checked against, and it also resolves the binary on
 * machines installed outside the default folder.
 *
 * The exit code is deliberately ignored as a verdict: ToDesk returns 1 on success.
 */
export async function runTodesk(
	run: Runner,
	args: string[],
	basePath: string | undefined,
): Promise<Invocation> {
	let lastError: string | null = null;

	for (const dir of TODESK_DIRS) {
		try {
			const result = await run(TODESK_EXE, args, {
				PATH: pathWithTodesk(dir, basePath),
				Path: pathWithTodesk(dir, basePath),
			});
			return { ok: true, result, error: null, dir };
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}
	}

	return { ok: false, result: null, error: lastError, dir: null };
}

/** Combined stdout+stderr — ToDesk writes some of its answer to stderr. */
export function outputOf(result: RunResult): string {
	return `${result.stdout}\n${result.stderr}`;
}
