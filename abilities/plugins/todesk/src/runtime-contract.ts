/** The narrow slice of the host bridge this plugin actually uses. */

export interface RunResult {
	exitCode: number | null;
	stdout: string;
	stderr: string;
}

export interface ConsoleDeps {
	/** Read a file outside the workspace; rejects when the host refuses. */
	readTextFile(path: string): Promise<string>;
	readSettings(): Promise<Record<string, unknown> | null>;
	writeSettings(value: Record<string, unknown>): Promise<void>;
	openExternal(url: string): Promise<void>;
	/**
	 * Launch `ToDesk.exe` with an argument vector and an extended PATH.
	 *
	 * The exit code is reported as-is: ToDesk returns 1 on success, so callers judge by
	 * the parsed output, never by this number.
	 */
	run(file: string, args: string[], env?: Record<string, string>): Promise<RunResult>;
	notifyError(message: string, error: unknown): void;
	notify(message: string): void;
}

export interface LocalFacts {
	deviceId: string | null;
	version: string | null;
	autostart: boolean | null;
	running: boolean;
	source: "cli" | "config" | null;
	/** Exact host failure when the CLI could not run — shown, not swallowed. */
	launchError: string | null;
	readFailed: boolean;
}

export const EMPTY_LOCAL: LocalFacts = {
	deviceId: null,
	version: null,
	autostart: null,
	running: false,
	source: null,
	launchError: null,
	readFailed: false,
};
