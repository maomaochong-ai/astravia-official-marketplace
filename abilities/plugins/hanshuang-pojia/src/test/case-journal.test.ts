import { describe, expect, it } from "vitest";
import {
	appendTimeline,
	categorySegment,
	decisionNoteRelativePath,
	noteSlug,
	parseDecisionStatus,
	renderDecisionNote,
	writeDecisionNote,
	type CaseWritePort,
	type DecisionNote,
} from "../domain/case/journal";

function memoryPort(initial: Record<string, string> = {}): CaseWritePort & { files: Map<string, string>; directories: string[] } {
	const files = new Map(Object.entries(initial));
	const directories: string[] = [];
	return {
		files,
		directories,
		readText: async path => files.get(path) ?? null,
		writeText: async (path, content) => {
			files.set(path, content);
		},
		createDirectory: async path => {
			directories.push(path);
		},
		exists: async path => files.has(path) || directories.includes(path),
	};
}

function note(overrides: Partial<DecisionNote> = {}): DecisionNote {
	return {
		caseName: "demo",
		status: "implemented",
		category: "architecture",
		title: "Keep the gate derived, not passed in",
		body: "A caller-supplied boolean is a claim; the gate has to be computed from the declaration.",
		date: "2026-10-27",
		...overrides,
	};
}

describe("note vocabulary", () => {
	it("accepts only the two statuses upstream writes", () => {
		expect(parseDecisionStatus("Implemented")).toBe("implemented");
		expect(parseDecisionStatus("rejected")).toBe("rejected");
		expect(() => parseDecisionStatus("done")).toThrow('status must be "implemented" or "rejected"');
	});

	it("keeps the category to one path segment", () => {
		expect(categorySegment("architecture")).toBe("architecture");
		expect(categorySegment("perf tuning")).toBe("perf_tuning");
		expect(categorySegment("a/b")).toBe("a_b");
		expect(() => categorySegment("  ")).toThrow("category must contain letters");
	});

	it("slugs a title, including a Chinese one, and refuses an unusable one", () => {
		expect(noteSlug("Keep the gate derived")).toBe("keep-the-gate-derived");
		expect(noteSlug("Gate  stays  derived")).toBe("gate-stays-derived");
		expect(noteSlug("门禁必须推导")).toBe("门禁必须推导");
		expect(() => noteSlug("!!!")).toThrow("title must contain at least one letter or digit");
	});

	it("lays the note out the way upstream does", () => {
		expect(decisionNoteRelativePath("rejected", "feature", "2026-10-27", "drop-the-proxy")).toBe(
			".agents/notes/rejected/feature/2026-10-27-drop-the-proxy.md",
		);
	});

	it("renders the metadata head before the untouched body", () => {
		const text = renderDecisionNote(note());
		expect(text).toContain("# Keep the gate derived, not passed in");
		expect(text).toContain("- status: implemented");
		expect(text).toContain("- case: demo");
		expect(text).toContain("A caller-supplied boolean is a claim");
	});
});

describe("writeDecisionNote", () => {
	it("writes the note, creates its directory and appends one timeline line", async () => {
		const port = memoryPort({ "/cases/demo/timeline.md": "# Timeline — demo\n" });
		const result = await writeDecisionNote(port, "/cases/demo", note(), { at: "2026-10-27T10:00:00.000Z" });
		expect(result.path).toBe("/cases/demo/.agents/notes/implemented/architecture/2026-10-27-keep-the-gate-derived-not-passed-in.md");
		expect(result.overwritten).toBe(false);
		expect(port.directories).toContain("/cases/demo/.agents/notes/implemented/architecture");
		expect(port.files.get(result.path)).toContain("- status: implemented");
		expect(port.files.get("/cases/demo/timeline.md")).toContain(
			"- 2026-10-27T10:00:00.000Z — implemented architecture: Keep the gate derived, not passed in",
		);
	});

	it("refuses to overwrite an existing note unless asked", async () => {
		const port = memoryPort();
		await writeDecisionNote(port, "/cases/demo", note());
		const target = port.files.get(
			"/cases/demo/.agents/notes/implemented/architecture/2026-10-27-keep-the-gate-derived-not-passed-in.md",
		);
		await expect(writeDecisionNote(port, "/cases/demo", note())).rejects.toThrow("already exists; pass overwrite=true");
		const replaced = await writeDecisionNote(port, "/cases/demo", note({ body: "rewritten" }), { overwrite: true });
		expect(replaced.overwritten).toBe(true);
		expect(port.files.get(replaced.path)).toContain("rewritten");
		expect(port.files.get(replaced.path)).not.toBe(target);
	});

	it("still writes the note when the timeline cannot be updated", async () => {
		const port = memoryPort();
		port.readText = async () => {
			throw new Error("unreadable");
		};
		const result = await writeDecisionNote(port, "/cases/demo", note());
		expect(result.timelinePath).toBeNull();
		expect(port.files.has(result.path)).toBe(true);
	});
});

describe("appendTimeline", () => {
	it("creates the log when it is missing and appends without losing history", async () => {
		const port = memoryPort();
		const path = await appendTimeline(port, "/cases/demo", "case created", "2026-10-27T00:00:00.000Z");
		expect(port.files.get(path)).toBe("# Timeline\n\n- 2026-10-27T00:00:00.000Z — case created\n");

		await appendTimeline(port, "/cases/demo", "evidence E-001", "2026-10-27T01:00:00.000Z");
		const text = port.files.get(path)!;
		expect(text.split("\n").filter(line => line.startsWith("- "))).toHaveLength(2);
		expect(text.trimEnd().endsWith("- 2026-10-27T01:00:00.000Z — evidence E-001")).toBe(true);
	});
});
