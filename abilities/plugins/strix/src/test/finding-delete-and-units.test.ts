import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as findings from "../service/findings";
import { normalizeSessions } from "../domain/bridge-payloads";

/**
 * 两件事：
 *  1. `delete_vulnerability_report` 的对等物（ADR 0006 里最后一个未实现项）；
 *  2. 工作单元的数据源（ADR 0010）：`/api/state` 的 sessions 归一化。
 */

const session = () => `s-${Math.random().toString(36).slice(2, 8)}`;

describe("deleting a finding", () => {
	it("removes it, and returns what was deleted so the reply can say so", async () => {
		const id = session();
		const created = await findings.add(id, { title: "IDOR on /api/orders", severity: "high", target: "a.test" });
		expect(created.count).toBe(1);

		const removed = await findings.remove(id, { id: created.finding.id });
		expect(removed.deleted.title).toBe("IDOR on /api/orders");
		expect(removed.count).toBe(0);
		expect(removed.bySeverity.high).toBe(0);
		expect((await findings.list(id)).findings).toHaveLength(0);
	});

	it("finds it by exact title when the id is not at hand", async () => {
		const id = session();
		await findings.add(id, { title: "reflected XSS in search", severity: "medium" });
		const removed = await findings.remove(id, { title: "reflected XSS in search" });
		expect(removed.deleted.severity).toBe("medium");
	});

	it("refuses a miss instead of silently doing nothing", async () => {
		const id = session();
		await expect(findings.remove(id, { id: "nope" })).rejects.toThrow(/no finding matched/);
		await expect(findings.remove(id, {})).rejects.toThrow(/id or title is required/);
	});

	it("leaves the rest of the ledger intact", async () => {
		const id = session();
		const a = await findings.add(id, { title: "A", severity: "low" });
		await findings.add(id, { title: "B", severity: "critical" });
		await findings.remove(id, { id: a.finding.id });
		const after = await findings.list(id);
		expect(after.findings.map((finding) => finding.title)).toEqual(["B"]);
		expect(after.bySeverity.critical).toBe(1);
	});
});

describe("working units", () => {
	it("keeps the fields the panel draws and drops junk", () => {
		const rows = normalizeSessions([
			{ id: "t1", command: "nmap -sV a.test", running: true, uptimeSec: 42, tty: false },
			{ id: "t2", command: "msfconsole", running: false, uptimeSec: 9, tty: true },
			{ id: "", command: "no id", running: true, uptimeSec: 1 },
			{ id: "t3" },
			"nonsense",
		]);
		expect(rows.map((row) => row.id)).toEqual(["t1", "t2"]);
		expect(rows[1]).toMatchObject({ command: "msfconsole", running: false, tty: true, uptimeSec: 9 });
	});

	it("defaults missing numbers instead of rendering NaN", () => {
		const [row] = normalizeSessions([{ id: "x", command: "c" }]);
		expect(row?.uptimeSec).toBe(0);
		expect(row?.running).toBe(false);
		expect(row?.tty).toBe(false);
	});
});
