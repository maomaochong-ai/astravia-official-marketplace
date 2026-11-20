import { describe, expect, it } from "vitest";
import {
	EMPTY_INSTALL_STATE,
	entryForTarget,
	entryFromPlan,
	parseInstallState,
	removalInstructions,
	upsertEntry,
} from "../../domain/inject/state";

describe("parseInstallState", () => {
	it("returns an empty state for anything unreadable — the file may have been hand-edited", () => {
		expect(parseInstallState(null)).toEqual(EMPTY_INSTALL_STATE);
		expect(parseInstallState("")).toEqual(EMPTY_INSTALL_STATE);
		expect(parseInstallState("{not json")).toEqual(EMPTY_INSTALL_STATE);
		expect(parseInstallState("null")).toEqual(EMPTY_INSTALL_STATE);
	});

	it("keeps valid entries and drops ones without a target", () => {
		const text = JSON.stringify({
			version: 1,
			entries: [
				{ target: "codex", form: "marker-block", files: ["a"], backups: ["a.bak"], markerBlock: true, packLabel: "p", installedAt: "t" },
				{ form: "marker-block" },
				{ target: "", files: ["b"] },
			],
		});
		const state = parseInstallState(text);
		expect(state.entries).toHaveLength(1);
		expect(state.entries[0]?.target).toBe("codex");
		expect(state.entries[0]?.files).toEqual(["a"]);
	});

	it("drops non-string members instead of trusting whatever is in the array", () => {
		const state = parseInstallState(JSON.stringify({ entries: [{ target: "dsh", files: ["a", 2, null, ""] }] }));
		expect(state.entries[0]?.files).toEqual(["a"]);
	});
});

describe("upsertEntry", () => {
	it("keeps one entry per target: the file records what is installed now, not history", () => {
		const first = entryFromPlan({ target: "codex", form: "marker-block", files: ["a"], markerBlock: true, packLabel: "v1", now: "t1" });
		const second = entryFromPlan({ target: "codex", form: "marker-block", files: ["b"], markerBlock: true, packLabel: "v2", now: "t2" });
		const state = upsertEntry(upsertEntry(EMPTY_INSTALL_STATE, first), second);
		expect(state.entries).toHaveLength(1);
		expect(entryForTarget(state, "codex")?.packLabel).toBe("v2");
	});

	it("derives backup prefixes from the files it wrote", () => {
		const entry = entryFromPlan({ target: "claude", form: "marker-block", files: ["~/.claude/CLAUDE.md"], markerBlock: true, packLabel: "p" });
		expect(entry.backups).toEqual(["~/.claude/CLAUDE.md.hanshuang-backup-"]);
	});
});

describe("removalInstructions", () => {
	it("says so when there is nothing to restore", () => {
		expect(removalInstructions(EMPTY_INSTALL_STATE)[0]).toContain("清单为空");
	});

	it("only lists what was actually installed", () => {
		const state = upsertEntry(
			EMPTY_INSTALL_STATE,
			entryFromPlan({ target: "codex", form: "marker-block", files: ["~/.codex/AGENTS.md"], markerBlock: true, packLabel: "p" }),
		);
		const steps = removalInstructions(state);
		expect(steps.join("\n")).toContain("按标记摘除");
		expect(steps.join("\n")).toContain("~/.codex/AGENTS.md.hanshuang-backup-");
		// 没装过的路径不许出现：猜路径就会删错文件。
		expect(steps.join("\n")).not.toContain("CLAUDE.md");
	});

	it("tells the user to restore a config key when no file was written", () => {
		const state = upsertEntry(
			EMPTY_INSTALL_STATE,
			entryFromPlan({ target: "doubao", form: "cdp", files: [], markerBlock: false, packLabel: "p" }),
		);
		expect(removalInstructions(state).join("\n")).toContain("配置键");
	});
});
