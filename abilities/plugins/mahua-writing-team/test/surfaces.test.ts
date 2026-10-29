import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { invitePrompt, newBookPrompt, nextStepPrompt } from "../src/features/studio/handoff-prompts.js";
import { STUDIO_MEMBERS, STUDIO_TEAM_ID } from "../src/studio-members.js";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const json = <T>(path: string): T => JSON.parse(read(path)) as T;

const manifest = json<Record<string, unknown>>("plugin.json");
const agentBlock = manifest.agent as {
	agents: { id: string }[];
	teams: { id: string; members: { agent: string }[] }[];
};
const en = json<Record<string, string>>("locales/en.json");

/** 只做 `{{name}}` 替换的最小 t：测试要看的是话术里到底出现了哪些事实。 */
const t = (key: string, params?: Record<string, string | number>): string => {
	const template = en[key];
	if (template === undefined) return key;
	return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
		params && name in params ? String(params[name]) : match,
	);
};

describe("the surfaces sit on the same roster as the manifest (ADR 0011)", () => {
	it("declares the same agents in the same order", () => {
		expect(STUDIO_MEMBERS.map((member) => member.agentId)).toEqual(
			agentBlock.agents.map((agent) => agent.id),
		);
	});

	it("keeps the team lead first, as the host does with members[0]", () => {
		const team = agentBlock.teams.find((candidate) => candidate.id === STUDIO_TEAM_ID);
		expect(team).toBeDefined();
		expect(team?.members.map((member) => member.agent)).toEqual(
			STUDIO_MEMBERS.map((member) => member.agentId),
		);
		expect(STUDIO_MEMBERS.filter((member) => member.lead)).toHaveLength(1);
		expect(STUDIO_MEMBERS[0].lead).toBe(true);
	});

	it("gives every member its own catalog strings", () => {
		for (const member of STUDIO_MEMBERS) {
			expect(en[member.nameKey], member.agentId).toBeTruthy();
			expect(en[member.dutyKey], member.agentId).toBeTruthy();
			expect(en[member.inviteKey], member.agentId).toBeTruthy();
		}
	});
});

describe("the conversation surfaces are wired on purpose", () => {
	const surfaces = read("src/studio-surfaces.ts");

	it("renders rows for exactly the two tools that carry structure", () => {
		const names = [...surfaces.matchAll(/toolName: "(mahua_[a-z_]+)"/g)].map((match) => match[1]);
		expect(names.sort()).toEqual(["mahua_book_status", "mahua_next_instruction"]);
	});

	it("activates the composer card only for this plugin's own agents and team", () => {
		expect(surfaces).toContain("STUDIO_MEMBERS.map((member) => member.agentId)");
		expect(surfaces).toContain("teams: [STUDIO_TEAM_ID]");
	});

	it("never sends from the composer card — inserting is as far as it goes", () => {
		expect(surfaces).toContain("composer.insertText");
		expect(surfaces).not.toContain("sendPrompt");
	});

	it("is registered and disposed with the plugin", () => {
		const entry = read("src/index.tsx");
		expect(entry).toContain("registerStudioSurfaces(ctx)");
		expect(entry).toContain("surfaces.dispose()");
	});

	it("asks for the two slot permissions it registers", () => {
		const permissions = manifest.permissions as string[];
		expect(permissions).toContain("ui.slot.tool-call");
		expect(permissions).toContain("ui.slot.new-session-context");
	});
});

describe("the workspace keeps the host's anatomy", () => {
	const view = read("src/features/studio/components/StudioWorkspaceView.tsx");

	it("dispatches shelf, catalogue, book and reader instead of stacking one screen", () => {
		for (const component of ["LibraryShelf", "LibraryCatalog", "BookDetail", "ReaderPane"]) {
			expect(view, component).toContain(`<${component}`);
		}
		expect(view).toContain("useLibraryRoute(");
	});

	it("keeps paging off the filter reset path so the buttons actually move", () => {
		const catalog = read("src/features/library/components/LibraryCatalog.tsx");
		// 改筛选回第一页，翻页不能顺手重置页码——否则「下一页」点了等于没点。
		expect(catalog).toContain("const goPage =");
		expect(catalog).toContain("onClick={() => goPage(page.page + 1)}");
		expect(catalog).not.toContain("update({ page:");
	});

	it("stacks book head, roster, instruction and index on the book surface", () => {
		const detail = read("src/features/library/components/BookDetail.tsx");
		for (const component of [
			"BookHead",
			"MemberRoster",
			"InstructionCard",
			"ChapterIndex",
			"CredentialChip",
		]) {
			expect(detail, component).toContain(`<${component}`);
		}
	});

	it("reads a chapter with a header, prose and a paging control", () => {
		const reader = read("src/features/library/components/ReaderPane.tsx");
		expect(reader).toContain("ReaderControls");
		expect(reader).toContain("mahua-prose");
		expect(reader).toContain("reader.updatedAt");
		expect(reader).toContain("paragraphsOf");
	});

	it("has no input of its own — steering belongs to the host conversation", () => {
		expect(view).not.toContain("<textarea");
		expect(view).not.toContain("<input");
		expect(view).not.toContain("sendPrompt");
	});

	it("keeps the credential panel reachable from the roster's last slot", () => {
		expect(view).toContain("setCredentialOpen(true)");
		expect(view).toContain("roster.credentialBack");
	});
});

describe("handoff prompts say the same thing everywhere", () => {
	const book = {
		title: "Salt and Ink",
		phase: "drafting",
		progress: { currentChapter: 4, committedCount: 3, pendingRewrite: [] },
	} as never;

	it("puts the routed task and chapter into the continue prompt", () => {
		const prompt = nextStepPrompt(t, book, {
			worker: "writer",
			task: "draft-chapter",
			chapter: 4,
			reasonKey: "reason.chapterAwaitingDraft",
		});
		expect(prompt).toContain("Salt and Ink");
		expect(prompt).toContain(en["phase.drafting"]);
		expect(prompt).toContain(en["task.draft-chapter"]);
		expect(prompt).toContain("4");
	});

	it("names the member when inviting instead of leaving the team guessing", () => {
		const writer = STUDIO_MEMBERS[1];
		const prompt = invitePrompt(t, writer, book);
		expect(prompt).toContain(en[writer.nameKey]);
		expect(prompt).toContain("Salt and Ink");
	});

	it("still has something to say when there is no book yet", () => {
		expect(invitePrompt(t, STUDIO_MEMBERS[0], null)).toBe(
			t("invite.noBook", { member: en[STUDIO_MEMBERS[0].nameKey] }),
		);
		expect(newBookPrompt(t)).toBe(en["composer.newBookPrompt"]);
	});
});
