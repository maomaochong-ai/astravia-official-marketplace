import { describe, expect, it } from "vitest";
import { ShellSessions } from "../service/shell-sessions";

/**
 * Kept shell sessions — upstream's `exec_command(background/tty)` + `write_stdin`.
 *
 * These tests start real processes (node, not a mock): the whole point of this class is
 * subprocess plumbing, and a fake child would test the mock. They are small and exit fast.
 */

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** 并行跑时 spawn 一个 node 进程可能要几秒：给够时间，别把 CPU 负载当成逻辑失败。 */
async function waitFor(check: () => boolean, timeoutMs = 20_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (check()) return;
		await sleep(20);
	}
	throw new Error("condition not met in time");
}

describe("kept sessions", () => {
	it("returns an id immediately and collects output in the background", async () => {
		const sessions = new ShellSessions(() => undefined);
		const view = sessions.start({
			command: "slow",
			commandDisplay: "slow",
			argv: [process.execPath, "-e", "console.log('first'); setTimeout(() => console.log('second'), 120);"],
			tty: false,
		});
		expect(view.id).toBeTruthy();

		await waitFor(() => (sessions.find(view.id)?.output ?? "").includes("second"));
		expect(sessions.find(view.id)?.output).toContain("first");
		await sessions.dispose();
	});

	it("reports the exit code once the process ends, and keeps the output readable", async () => {
		const sessions = new ShellSessions(() => undefined);
		const view = sessions.start({
			command: "fail",
			commandDisplay: "fail",
			argv: [process.execPath, "-e", "console.error('boom'); process.exit(3);"],
			tty: false,
		});
		await waitFor(() => sessions.find(view.id)?.running === false);
		const after = sessions.find(view.id);
		expect(after?.exit?.code).toBe(3);
		expect(after?.output).toContain("boom");
		await sessions.dispose();
	});

	it("streams stdin into a process that is still running", async () => {
		const sessions = new ShellSessions(() => undefined);
		// Echo each line back, then exit when it reads "quit".
		const script = `
			process.stdin.setEncoding('utf8');
			process.stdin.on('data', (chunk) => {
				process.stdout.write('got:' + chunk);
				if (chunk.includes('quit')) process.exit(0);
			});
		`;
		const view = sessions.start({
			command: "repl",
			commandDisplay: "repl",
			argv: [process.execPath, "-e", script],
			tty: false,
		});
		sessions.write(view.id, "hello\n");
		await waitFor(() => (sessions.find(view.id)?.output ?? "").includes("got:hello"));
		sessions.write(view.id, "quit\n");
		await waitFor(() => sessions.find(view.id)?.running === false);
		await sessions.dispose();
	});

	it("refuses to write into a session that already exited", async () => {
		const sessions = new ShellSessions(() => undefined);
		const view = sessions.start({
			command: "quick",
			commandDisplay: "quick",
			argv: [process.execPath, "-e", "process.exit(0)"],
			tty: false,
		});
		await waitFor(() => sessions.find(view.id)?.running === false);
		expect(() => sessions.write(view.id, "x")).toThrow(/has exited/);
		await sessions.dispose();
	});

	it("kills a live session", async () => {
		const sessions = new ShellSessions(() => undefined);
		const view = sessions.start({
			command: "idle",
			commandDisplay: "idle",
			argv: [process.execPath, "-e", "setInterval(() => {}, 1000)"],
			tty: false,
		});
		expect(sessions.find(view.id)?.running).toBe(true);
		await sessions.kill(view.id);
		await waitFor(() => sessions.find(view.id)?.running === false);
		await sessions.dispose();
	});

	it("caps how many can run at once instead of spawning without limit", () => {
		const sessions = new ShellSessions(() => undefined);
		for (let index = 0; index < 8; index += 1) {
			sessions.start({
				command: `idle-${index}`,
				commandDisplay: `idle-${index}`,
				argv: [process.execPath, "-e", "setInterval(() => {}, 1000)"],
				tty: false,
			});
		}
		expect(() =>
			sessions.start({
				command: "one-too-many",
				commandDisplay: "one-too-many",
				argv: [process.execPath, "-e", "process.exit(0)"],
				tty: false,
			}),
		).toThrow(/stop one with strix_kill_session/);
		void sessions.dispose();
	});

	it("emits the trace events the panel listens for", async () => {
		const events: Record<string, unknown>[] = [];
		const sessions = new ShellSessions((payload) => events.push(payload));
		const view = sessions.start({
			command: "echo",
			commandDisplay: "echo",
			argv: [process.execPath, "-e", "console.log('hi')"],
			tty: false,
		});
		await waitFor(() => sessions.find(view.id)?.running === false);
		expect(events.map((event) => event.event)).toContain("session_start");
		expect(events.map((event) => event.event)).toContain("session_end");
		await sessions.dispose();
	});
});
