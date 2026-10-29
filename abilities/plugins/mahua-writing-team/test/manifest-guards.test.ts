import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const json = <T>(path: string): T => JSON.parse(read(path)) as T;

const en = json<Record<string, string>>("locales/en.json");
const zh = json<Record<string, string>>("locales/zh.json");
const manifest = json<Record<string, unknown>>("plugin.json");
const pkg = json<{ version: string }>("package.json");

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(join(ROOT, dir))) {
		const relative = `${dir}/${entry}`;
		if (statSync(join(ROOT, relative)).isDirectory()) walk(relative, out);
		else out.push(relative);
	}
	return out;
}

const SOURCE_FILES = walk("src").filter((path) => /\.(ts|tsx|css)$/.test(path));

/**
 * 路由器实际能产出的 task 集合：扫 `novel-flow.ts` 里 `task: "..."` 的字面量。
 * 这样删一个分支时文案跟着退场，不需要另一份清单同步。
 */
function routedTasks(): string[] {
	const flow = read("src/domain/novel-flow.ts");
	const found = new Set<string>();
	for (const match of flow.matchAll(/task:\s*"([a-z-]+)"/g)) found.add(match[1] as string);
	return [...found].sort();
}

describe("locale catalogs", () => {
	it("cover exactly the same keys", () => {
		expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
	});

	it("have no empty value", () => {
		for (const [key, value] of [...Object.entries(en), ...Object.entries(zh)]) {
			expect(value.trim().length, key).toBeGreaterThan(0);
		}
	});

	it("use the same interpolation slots in both languages", () => {
		const slots = (value: string) => (value.match(/\{\{(\w+)\}\}/g) ?? []).sort();
		for (const key of Object.keys(en)) {
			expect(slots(zh[key]), key).toEqual(slots(en[key]));
		}
	});

	it("define every key the source asks for", () => {
		const used = new Set<string>();
		for (const path of SOURCE_FILES) {
			const text = read(path);
			for (const match of text.matchAll(/\bt\(\s*"([A-Za-z0-9_.]+)"/g)) used.add(match[1]);
			for (const match of text.matchAll(/"%([A-Za-z0-9_.]+)%"/g)) used.add(match[1]);
		}
		for (const match of read("plugin.json").matchAll(/%([A-Za-z0-9_.]+)%/g)) used.add(match[1]);
		const missing = [...used].filter((key) => !(key in en) || !(key in zh));
		expect(missing).toEqual([]);
	});

	it("define every key the domain enums can produce", () => {
		const dynamic = [
			["status", ["planned", "drafting", "reviewed", "committed", "blocked"]],
			["phase", ["briefing", "planning", "drafting", "revising", "arc_close", "completed"]],
			["worker", ["architect", "writer", "editor", "arbiter", "engine"]],
			// task 的合法集合不再手写：从路由器的实际产出派生。
			// 手写清单只会在删分支时继续要求死 key 存在，那是在保护僵尸文案。
			["task", routedTasks()],
		] as const;
		for (const [prefix, values] of dynamic) {
			for (const value of values) expect(en, `${prefix}.${value}`).toHaveProperty([`${prefix}.${value}`]);
			for (const value of values) expect(zh).toHaveProperty([`${prefix}.${value}`]);
		}
	});

	it("define exactly the task keys the router emits, and no more", () => {
		const routed = routedTasks();
		expect(routed.length).toBeGreaterThan(0);
		const declared = Object.keys(en)
			.filter((key) => key.startsWith("task."))
			.map((key) => key.slice("task.".length))
			.sort();
		expect(declared).toEqual([...routed].sort());
	});

	it("define every checkpoint key the ledger can record", () => {
		const emitted = new Set<string>();
		for (const path of SOURCE_FILES.filter((file) => file.startsWith("src/domain"))) {
			for (const match of read(path).matchAll(/"(checkpoint\.[A-Za-z]+)"/g)) emitted.add(match[1]);
		}
		expect(emitted.size).toBeGreaterThan(0);
		for (const key of emitted) {
			expect(en, key).toHaveProperty([key]);
			expect(zh, key).toHaveProperty([key]);
		}
	});

	it("define every reason key the router can emit", () => {
		const reasons = [
			"targetReached",
			"briefMissing",
			"noArcYet",
			"arcUncovered",
			"arcEnded",
			"chapterUnplanned",
			"chapterAwaitingDraft",
			"chapterBlocked",
			"chapterAwaitingReview",
			"belowPass",
			"readyToCommit",
			"pointerDrift",
		];
		const emitted = new Set<string>();
		for (const path of SOURCE_FILES.filter((file) => file.startsWith("src/domain"))) {
			for (const match of read(path).matchAll(/"(reason\.[A-Za-z]+)"/g)) emitted.add(match[1]);
		}
		expect([...emitted].sort()).toEqual(reasons.map((key) => `reason.${key}`).sort());
		for (const reason of reasons) {
			expect(en).toHaveProperty([`reason.${reason}`]);
			expect(zh).toHaveProperty([`reason.${reason}`]);
		}
	});
});

describe("layer boundaries", () => {
	it("keeps the domain free of natural language and IO", () => {
		const violations: string[] = [];
		// 精确点名一个豁免：`premise-vocabulary.ts` 是输入词表（作者写的中文小标题要能被认出来），
		// 里面的字符串永远不会被渲染到界面上。新增豁免请改这一行，不要改成通配。
		const VOCABULARY = "src/domain/premise-vocabulary.ts";
		for (const path of SOURCE_FILES.filter(
			(file) => file.startsWith("src/domain") && file !== VOCABULARY,
		)) {
			const text = read(path);
			// 中文/全角标点 = 硬编码文案；界面上看到的一切都必须来自 catalog。
			if (/[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/.test(text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""))) {
				violations.push(`${path}: natural language`);
			}
			if (/from "(\.\.\/)+(repository|application|entitlement)\//.test(text)) {
				violations.push(`${path}: domain imports an outer layer`);
			}
			if (/Date\.now|new Date\(/.test(text)) violations.push(`${path}: reads the clock`);
		}
		expect(violations).toEqual([]);
	});

	it("keeps every view behind StudioService instead of touching storage or the gate", () => {
		const violations: string[] = [];
		for (const path of SOURCE_FILES.filter((file) => file.startsWith("src/features"))) {
			const text = read(path);
			if (/\.gate\.(activate|save|clear|persist)/.test(text)) violations.push(`${path}: writes the gate`);
			if (/ManuscriptRepository|MemoryManuscriptStorage/.test(text)) violations.push(`${path}: touches the repository`);
		}
		expect(violations).toEqual([]);
	});

	it("keeps UI files under a components/ directory", () => {
		const misplaced = SOURCE_FILES.filter(
			(file) =>
				file.endsWith(".tsx") &&
				file !== "src/index.tsx" &&
				!file.includes("/components/"),
		);
		expect(misplaced).toEqual([]);
	});
});

describe("manifest", () => {
	it("matches the package version and declares the API it uses", () => {
		expect(manifest.version).toBe(pkg.version);
		expect(manifest.id).toBe("mahua-writing-team");
		// `members[].instructionsPath` needs ^2.3.0 or an older host rejects the whole manifest.
		expect(manifest.pluginApiVersion).toBe("^2.3.0");
	});

	it("points every promised file at a real one", () => {
		const paths: string[] = [String(manifest.entry), ...((manifest.styles as string[]) ?? [])];
		const agent = manifest.agent as {
			agents: { systemPromptPath?: string }[];
			teams: { workflowPath?: string; members: { instructionsPath?: string }[] }[];
		};
		for (const profile of agent.agents) if (profile.systemPromptPath) paths.push(profile.systemPromptPath);
		for (const team of agent.teams) {
			if (team.workflowPath) paths.push(team.workflowPath);
			for (const member of team.members) if (member.instructionsPath) paths.push(member.instructionsPath);
		}
		// entry and styles are build outputs; the rest must exist in source.
		for (const path of paths.filter((candidate) => candidate.startsWith("agent/"))) {
			expect(() => read(path), path).not.toThrow();
		}
	});

	it("references every team member by agent id and never by both an agent and a role", () => {
		const agent = manifest.agent as {
			agents: { id: string; roles?: string[] }[];
			teams: { members: { agent?: string; role?: string }[] }[];
		};
		const ids = new Set(agent.agents.map((profile) => profile.id));
		for (const team of agent.teams) {
			expect(team.members.length).toBeGreaterThan(0);
			for (const member of team.members) {
				expect(Boolean(member.agent) !== Boolean(member.role)).toBe(true);
				if (member.agent) expect(ids.has(member.agent), member.agent).toBe(true);
			}
		}
		expect(ids.size).toBe(4);
	});
});

describe("the agent directory is a real package, not loose files (ADR 0019)", () => {
	const agent = manifest.agent as {
		systemPrompt?: { promptPaths?: string[] };
		skillPaths?: string[];
		skillPresentation?: { defaultVisibility?: string };
	};

	it("points promptPaths and skillPaths at things that exist", () => {
		const prompts = agent.systemPrompt?.promptPaths ?? [];
		expect(prompts.length).toBeGreaterThan(0);
		for (const path of prompts) expect(() => read(path), path).not.toThrow();

		const skillPaths = agent.skillPaths ?? [];
		expect(skillPaths.length).toBeGreaterThan(0);
		for (const path of skillPaths) {
			expect(readdirSync(join(ROOT, path)).length, path).toBeGreaterThan(0);
		}
	});

	it("gives every shipped skill a frontmatter the host can read", () => {
		const dirs = (agent.skillPaths ?? []).flatMap((path) =>
			readdirSync(join(ROOT, path), { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => `${path}/${entry.name}`),
		);
		expect(dirs.length).toBeGreaterThan(0);
		for (const dir of dirs) {
			const skill = read(`${dir}/SKILL.md`);
			const front = skill.match(/^---\n([\s\S]*?)\n---/);
			expect(front, `${dir}/SKILL.md`).not.toBeNull();
			const head = front?.[1] ?? "";
			// name 必须是目录名：宿主用目录作为技能身份，改名只改目录。
			expect(head).toMatch(new RegExp(`^name:\\s*${dir.split("/").pop()}\\s*$`, "m"));
			const description = head.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
			expect(description.length, `${dir}: description`).toBeGreaterThan(10);
		}
	});

	it("keeps the skills out of the discovery list instead of advertising five of them", () => {
		// 技能是团队内部按需加载的，不是侧栏里的另一排入口。
		expect(agent.skillPresentation?.defaultVisibility).toBe("hidden");
	});

	it("prefixes every registered tool with the plugin's own namespace", () => {
		const ids = [...read("src/tools/novel-tools.ts").matchAll(/id: "([a-z_]+)"/g)].map((match) => match[1]);
		expect(ids.length).toBeGreaterThan(0);
		expect(ids.filter((id) => !id.startsWith("mahua_"))).toEqual([]);
	});

	it("ships the readme in both languages, each linking to the other", () => {
		expect(read("README.md")).toContain("README.zh.md");
		expect(read("README.zh.md")).toContain("README.md");
	});
});

describe("visual language stays on host tokens", () => {
	it("never hard-codes a colour", () => {
		const violations: string[] = [];
		for (const path of SOURCE_FILES.filter((file) => file.startsWith("src/features"))) {
			const text = read(path);
			for (const match of text.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g)) {
				violations.push(`${path}: ${match[0]}`);
			}
		}
		expect(violations).toEqual([]);
	});

	it("keeps style.css on the host bridge instead of redeclaring @theme", () => {
		const css = read("src/style.css");
		expect(css).toContain('@import "tailwindcss/theme.css"');
		expect(css).toContain('@import "tailwindcss/utilities.css"');
		expect(css).not.toMatch(/@import\s+"tailwindcss";/);
		expect(css).not.toMatch(/(^|\n)\s*@theme\b/);
		expect(css).toContain('@plugin "@iconify/tailwind4"');
	});

	it("keeps panel views inside the panel — no fixed layers or body portals", () => {
		const violations: string[] = [];
		for (const path of SOURCE_FILES.filter((file) => file.startsWith("src/features"))) {
			const text = read(path);
			if (/\bfixed\b/.test(text)) violations.push(`${path}: fixed`);
			if (text.includes("createPortal")) violations.push(`${path}: createPortal`);
			if (/z-\[2147483647\]/.test(text)) violations.push(`${path}: max z-index`);
		}
		expect(violations).toEqual([]);
	});

	it("registers a tab, not a sidebar entry (ADR 0025 §2)", () => {
		const entry = read("src/index.tsx");
		const tab = read("src/studio-tab.ts");
		// 侧边栏是用户自己的导航位；工作台必须从活动面板的「+」里加，不能常驻侧栏。
		expect(entry).not.toContain("registerWorkspaceView");
		expect(entry).not.toContain("setWorkspaceViewHeader");
		expect(entry).toContain("registerStudioTab(ctx)");
		expect(tab).toContain("ctx.ui.registerActivityTab(");
		// fail-closed：没声明的场景下一个标签都不出现。
		expect(tab).toMatch(/scope_use: \["conversation", "project"\]/);
		// 入池不上栏：加不加由用户决定。
		expect(tab).toContain("initiallyVisible: false");
	});

	it("only asks for the slot permissions it actually uses", () => {
		const permissions = (json<{ permissions: string[] }>("plugin.json")).permissions;
		expect(permissions).toContain("ui.slot.activity-tab");
		expect(permissions).toEqual([...permissions].sort());
		const sources = SOURCE_FILES.map(read).join("\n");
		for (const slot of ["workspace-view", "activity-tab"]) {
			const declared = permissions.includes(`ui.slot.${slot}`);
			const used = sources.includes(`register${slot === "workspace-view" ? "WorkspaceView" : "ActivityTab"}(`);
			expect(used, `${slot} used but not declared`).toBe(declared);
		}
	});

	it("uses an iconify class for the tab icon, not a bare icon name", () => {
		const tab = read("src/studio-tab.ts");
		expect(tab).toMatch(/STUDIO_TAB_ICON = "icon-\[solar--[a-z0-9-]+\]"/);
	});

	it("opens the reader from the book page's primary button instead of sending a prompt", () => {
		const detail = read("src/features/library/components/BookDetail.tsx");
		const callSite = read("src/features/studio/components/StudioWorkspaceView.tsx");
		// 主按钮 = 翻页读，不是 `sendPrompt`：它曾经排在一起，点「继续阅读」会往对话发消息。
		expect(detail).toContain('{t("book.continueAt", { chapter: current })}');
		expect(detail).toMatch(/onClick=\{\(\) => onOpenChapter\(current\)\}/);
		expect(detail).toMatch(/onClick=\{onContinue\}[\s\S]{0,400}t\("action\.handoffContinue"\)/);
		expect(callSite).toContain("onContinue={() => void startHandoff()}");
	});
});

describe("capability parity with ainovel-cli (ADR 0009)", () => {
	// 上游 internal/tools 的能力面 → 本插件的工具 id。名字可以不同（create_book 比 save_book
	// 更贴近它的副作用），但每一项都必须有落点，否则就是能力缺口。
	const PARITY: Record<string, string[]> = {
		save_book: ["create_book"],
		audit_foundation: ["audit_foundation"],
		save_foundation: ["save_foundation"],
		save_user_rules: ["set_user_rules"],
		plan_chapter: ["plan_chapter"],
		draft_chapter: ["start_drafting", "save_chapter"],
		edit_chapter: ["edit_chapter"],
		read_chapter: ["read_chapter"],
		save_review: ["save_review"],
		commit_chapter: ["commit_chapter"],
		expand_next_arc: ["expand_next_arc"],
		premise_structure: ["premise_structure"],
		revise_outline: ["revise_outline"],
		save_arc_summary: ["save_arc_summary"],
		save_volume_summary: ["save_volume_summary"],
		resolve_outline_feedback: ["flag_outline_feedback", "resolve_outline_feedback"],
		check_consistency: ["check_consistency"],
		novel_context: ["context"],
		reopen_book: ["reopen_book"],
	};

	it("exposes every upstream capability as a registered tool", () => {
		const source = read("src/tools/novel-tools.ts");
		const registered = new Set([...source.matchAll(/id: "mahua_([a-z_]+)"/g)].map((match) => match[1]));
		const missing = Object.entries(PARITY).flatMap(([upstream, ours]) =>
			ours.filter((tool) => !registered.has(tool)).map((tool) => `${upstream} -> ${tool}`),
		);
		expect(missing).toEqual([]);
	});

	it("registers no tool id twice", () => {
		const ids = [...read("src/tools/novel-tools.ts").matchAll(/id: "mahua_([a-z_]+)"/g)].map((m) => m[1]);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("gives every tool a scope_use so the host does not fail closed", () => {
		const source = read("src/tools/novel-tools.ts");
		const registrations = source.match(/registerTool</g) ?? [];
		const scopes = source.match(/scope_use: \[\.\.\.SCENARIOS\]/g) ?? [];
		expect(scopes.length).toBe(registrations.length);
	});
});

describe("the plugin stands alone (ADR 0010)", () => {
	it("references only entities it declares itself", () => {
		const agent = manifest.agent as {
			agents: { id: string }[];
			teams: { members: { agent?: string }[] }[];
		};
		const ids = new Set(agent.agents.map((profile) => profile.id));
		for (const team of agent.teams) {
			for (const member of team.members) {
				if (member.agent) expect(ids.has(member.agent), member.agent).toBe(true);
			}
		}
	});

	it("never points at another plugin's entity", () => {
		const raw = read("plugin.json");
		// 跨插件引用的两种写法：plugin:<id>:<agent>，以及带其他插件前缀的 id。
		expect(raw).not.toMatch(/plugin:[a-z0-9-]+:/);
		const ids = [...raw.matchAll(/"id": "([a-z0-9-]+)"/g)].map((match) => match[1]);
		expect(ids.filter((id) => !id.startsWith("mahua-"))).toEqual([]);
	});

	it("routes the conversation bridge through one hook instead of ad-hoc session calls", () => {
		const callers = SOURCE_FILES.filter((path) => read(path).includes("conversation.createSession"));
		expect(callers).toEqual(["src/features/studio/hooks/use-agent-handoff.ts"]);
	});

	it("asks for exactly the permissions the surfaces need", () => {
		const permissions = (manifest.permissions as string[]).slice().sort();
		expect(permissions).toEqual(
			[
				"agent.session.read",
				"agent.session.write",
				// ADR 0019：提示词块与技能目录各自需要一项权限，缺了宿主会静默跳过。
				"agent.skills.control",
				"agent.systemPrompt.write",
				"agent.toolHandler.execute",
				"agent.tools.register",
				"storage.read",
				"storage.write",
				"ui.slot.activity-tab",
				"ui.slot.new-session-context",
				"ui.slot.tool-call",
				"workspace.read",
			].sort(),
		);
	});
});

describe("the gate covers exactly the write tools", () => {
	// 读工具不进门禁：拦住读会让"先看看再决定"变成死路。写工具漏一个就是免费的后门。
	const READ_TOOLS = new Set([
		"mahua_list_books",
		"mahua_book_status",
		"mahua_next_instruction",
		"mahua_read_chapter",
		"mahua_audit_foundation",
		"mahua_premise_structure",
		"mahua_check_consistency",
		"mahua_check_rules",
		"mahua_style_stats",
		"mahua_context",
		"mahua_reference",
		"mahua_check_threads",
	]);

	it("lists every tool that writes and nothing that only reads", () => {
		const registered = [...read("src/tools/novel-tools.ts").matchAll(/id: "(mahua_[a-z_]+)"/g)].map(
			(match) => match[1],
		);
		const gated = [...read("src/entitlement/entitlement-gate.ts").matchAll(/"(mahua_[a-z_]+)"/g)].map(
			(match) => match[1],
		);
		const expected = registered.filter((id) => !READ_TOOLS.has(id));
		expect(gated.slice().sort()).toEqual(expected.slice().sort());
	});
});
