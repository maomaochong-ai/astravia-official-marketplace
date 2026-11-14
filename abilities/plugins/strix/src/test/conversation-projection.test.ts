import { describe, expect, it } from "vitest";
import {
	evidenceRow,
	hostRowFor,
	isServiceNarrated,
	strixToolName,
	toolRow,
} from "../domain/conversation-projection";

/**
 * One transcript, two witnesses.
 *
 * The host conversation says which tool the agent called; the bridge service says what
 * that command printed. These are the rules that turn both into rows — and, more
 * importantly, the rules that stop one command from being drawn twice.
 */
describe("tool naming", () => {
	it("recognises the Strix tool behind whatever namespace the host applied", () => {
		expect(strixToolName("strix_exec")).toBe("strix_exec");
		expect(strixToolName("mcp__strix__strix_sandbox_start")).toBe("strix_sandbox_start");
		expect(strixToolName("github_list_issues")).toBeUndefined();
		expect(strixToolName("mcp__github__strixlike")).toBeUndefined();
	});

	it("narrates a command from the service and everything else from the host", () => {
		expect(isServiceNarrated("mcp__strix__strix_exec")).toBe(true);
		expect(isServiceNarrated("strix_sandbox_start")).toBe(false);
		expect(isServiceNarrated("read_file")).toBe(false);
	});
});

describe("rows", () => {
	it("names a tool call by the argument that says what it acts on", () => {
		expect(toolRow({ tool: "mcp__strix__strix_exec", command: "nmap -sV example.com" })).toEqual({
			kind: "tool",
			label: "strix_exec",
			detail: "nmap -sV example.com",
		});
		expect(toolRow({ tool: "strix_sandbox_start", args: { targets: ["example.com"] } })).toEqual({
			kind: "tool",
			label: "strix_sandbox_start",
			detail: "example.com",
		});
		// Not Strix's: must not appear in the assessment trace.
		expect(toolRow({ tool: "read_file", args: { path: "/etc/hosts" } })).toBeUndefined();
	});

	it("closes a command row with the evidence only the service has", () => {
		const row = evidenceRow({
			event: "tool_end",
			tool: "exec_command",
			ok: true,
			exitCode: 0,
			durationMs: 1_240,
			output: "22/tcp open ssh",
		});
		// `exec_command` is the service's internal name for `strix_exec`; translating it is
		// what lets the finishing event find the row the start event opened.
		expect(row?.patch).toEqual({ ok: true, detail: "exit 0 · 1.2s", output: "22/tcp open ssh" });

		const named = evidenceRow({
			event: "tool_end",
			tool: "strix_exec",
			ok: false,
			exitCode: 2,
			durationMs: 300,
			output: "no such host",
		});
		expect(named?.patch.ok).toBe(false);
		expect(named?.patch.detail).toBe("exit 2 · 0.3s");
		expect(named?.patch.output).toBe("no such host");
	});

	it("ignores finishing events for tools it does not narrate", () => {
		expect(evidenceRow({ event: "tool_end", tool: "strix_report", ok: true })).toBeUndefined();
	});

	it("labels the conversation's own messages", () => {
		expect(hostRowFor({ id: "1", role: "user", text: "scan a.test" })).toEqual({ kind: "host", label: "scan a.test" });
		expect(hostRowFor({ id: "2", role: "assistant", text: "one IDOR filed" })).toEqual({
			kind: "host-say",
			label: "one IDOR filed",
		});
		expect(hostRowFor({ id: "3", role: "compaction", text: "context compacted" })).toEqual({
			kind: "note",
			label: "context compacted",
		});
		expect(hostRowFor({ id: "4", role: "assistant", text: "   " })).toBeUndefined();
	});
});
