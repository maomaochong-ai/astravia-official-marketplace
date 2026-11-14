/**
 * Long-running shell sessions, so a pentest can talk to what it started.
 *
 * Upstream gets this from the SDK's shell capability: `exec_command` runs commands in a
 * session, `background=true` leaves one running, `tty=true` allocates a terminal, and
 * `write_stdin` streams into it. That is not a convenience — `msfconsole`, `ssh`, `nc`,
 * an interactive `ftp`, or delivering Ctrl-C to a stuck scan all need it. Without it the
 * agent's only recourse is another `exec_command` with a timeout, which loses the process.
 *
 * Here the service owns the children (`docker exec -i [-t]` in a container, a plain
 * process in host mode) and keeps a bounded output ring per session. Nothing is persisted:
 * a session dies with the service, which is the same contract as the sandbox itself.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const MAX_SESSIONS = 8;
const RING_BYTES = 64 * 1024;
const KEEP_FINISHED_MS = 10 * 60_000;

export interface ShellSession {
	readonly id: string;
	readonly command: string;
	readonly tty: boolean;
	startedAt: number;
	exit: { code: number | null; signal: string | null } | null;
	output: string;
	truncated: boolean;
}

interface LiveSession extends ShellSession {
	child: ChildProcessWithoutNullStreams;
}

export interface SessionView {
	id: string;
	command: string;
	tty: boolean;
	running: boolean;
	uptimeSec: number;
	exit: { code: number | null; signal: string | null } | null;
	output: string;
	truncated: boolean;
}

function stamp(): string {
	return `t${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

/**
 * Keep the tail, not the head: for a running scanner the last screenful is what matters,
 * and an unbounded buffer in a long session is a memory leak with a friendly name.
 */
function appendRing(session: ShellSession, chunk: string): void {
	session.output += chunk;
	if (session.output.length <= RING_BYTES) return;
	const keepFrom = session.output.length - RING_BYTES;
	session.output = session.output.slice(keepFrom);
	session.truncated = true;
}

export class ShellSessions {
	private readonly sessions = new Map<string, LiveSession>();
	/** Sessions that already exited but are still readable / still have an exit code. */
	private readonly finished = new Map<string, { view: ShellSession; at: number }>();

	constructor(private readonly emit: (payload: Record<string, unknown>) => void) {}

	/** Every session the operator can still look at, newest first. */
	list(): SessionView[] {
		const rows: SessionView[] = [];
		for (const session of this.sessions.values()) rows.push(this.view(session, true));
		for (const { view } of this.finished.values()) rows.push(this.view(view, false));
		return rows.sort((left, right) => right.uptimeSec - left.uptimeSec).slice(0, MAX_SESSIONS * 2);
	}

	find(id: string): SessionView | undefined {
		const live = this.sessions.get(id);
		if (live) return this.view(live, true);
		const done = this.finished.get(id);
		return done ? this.view(done.view, false) : undefined;
	}

	/**
	 * Start a command and keep it.
	 *
	 * `argv` is already the exact command line the host will execute — this class does not
	 * build shell strings; the caller owns quoting so there is one place that can be wrong.
	 */
	start(input: {
		id?: string;
		command: string;
		commandDisplay: string;
		argv: string[];
		tty: boolean;
		cwd?: string;
		env?: Record<string, string>;
	}): SessionView {
		this.evict();
		const id = input.id?.trim() || stamp();
		if (this.sessions.has(id)) throw new Error(`session ${id} is already running`);

		const child = spawn(input.argv[0] as string, input.argv.slice(1), {
			cwd: input.cwd,
			env: { ...process.env, ...(input.env ?? {}) },
			stdio: ["pipe", "pipe", "pipe"],
			windowsHide: true,
		}) as ChildProcessWithoutNullStreams;

		const session: LiveSession = {
			id,
			command: input.commandDisplay,
			tty: input.tty,
			startedAt: Date.now(),
			exit: null,
			output: "",
			truncated: false,
			child,
		};
		this.sessions.set(id, session);
		this.emit({ event: "session_start", sessionId: id, command: input.command });

		const onData = (chunk: Buffer): void => {
			appendRing(session, chunk.toString("utf8"));
		};
		child.stdout.on("data", onData);
		child.stderr.on("data", onData);
		child.on("exit", (code, signal) => {
			session.exit = { code, signal };
			this.sessions.delete(id);
			this.finished.set(id, { view: session, at: Date.now() });
			this.emit({ event: "session_end", sessionId: id, exitCode: code, signal });
		});
		child.on("error", (error) => {
			appendRing(session, `\n[session error] ${error.message}\n`);
			session.exit = { code: null, signal: null };
			this.sessions.delete(id);
			this.finished.set(id, { view: session, at: Date.now() });
		});

		return this.view(session, true);
	}

	/** Stream input into a running session. Requires the process to still be alive. */
	write(id: string, chars: string): SessionView {
		const session = this.sessions.get(id);
		if (!session) {
			const done = this.finished.get(id);
			if (done) throw new Error(`session ${id} has exited; start a new one`);
			throw new Error(`no session ${id}`);
		}
		if (!session.child.stdin.writable) throw new Error(`session ${id} has no stdin (it was closed)`);
		session.child.stdin.write(chars);
		this.emit({ event: "session_input", sessionId: id, chars });
		return this.view(session, true);
	}

	/** Stop a session: SIGTERM, then SIGKILL after a grace period. */
	async kill(id: string): Promise<{ stopped: boolean; session?: SessionView }> {
		const session = this.sessions.get(id);
		if (!session) return { stopped: false };
		session.child.kill("SIGTERM");
		await new Promise((resolve) => setTimeout(resolve, 400));
		if (this.sessions.has(id)) session.child.kill("SIGKILL");
		return { stopped: true, session: this.find(id) };
	}

	/** Service shutdown: nothing may outlive the run it belongs to. */
	async dispose(): Promise<void> {
		const ids = [...this.sessions.keys()];
		await Promise.all(ids.map((id) => this.kill(id).catch(() => undefined)));
		this.finished.clear();
	}

	private view(session: ShellSession, running: boolean): SessionView {
		return {
			id: session.id,
			command: session.command,
			tty: session.tty,
			running,
			uptimeSec: Math.round((Date.now() - session.startedAt) / 1000),
			exit: session.exit,
			output: session.output,
			truncated: session.truncated,
		};
	}

	/** Drop the oldest finished session and refuse to exceed the live cap. */
	private evict(): void {
		const now = Date.now();
		for (const [id, entry] of this.finished) {
			if (now - entry.at > KEEP_FINISHED_MS) this.finished.delete(id);
		}
		if (this.sessions.size >= MAX_SESSIONS) {
			throw new Error(
				`already ${this.sessions.size} sessions running; stop one with strix_kill_session before starting another`,
			);
		}
	}
}
