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
 * 工具注册分散在 `src/tools/` 的五个弧段文件里，守卫按目录扫：
 * 增一个文件不用回来改断言，漏一个文件也不会被漏掉。
 */
const TOOL_SOURCE = SOURCE_FILES.filter((path) => path.startsWith("src/tools/")).map(read).join("\n");

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
	it("keeps defaultLocale on a catalog that ships with the pack", () => {
		// 宿主把档案的 name/description 按 defaultLocale 解析成字面量落库（ADR-0033），
		// 所以这个语言必须真有一份语言包；写错了落库与回退都会变成裸 key。
		const locale = String(manifest.defaultLocale);
		expect(["en", "zh"]).toContain(locale);
		expect(Object.keys(json<Record<string, string>>(`locales/${locale}.json`)).length).toBeGreaterThan(0);
	});

	it("gives every team member a literal responsibility, not a catalog key", () => {
		// 宿主只对 agent/team 的 name 与 description 走 nameKey 查表，成员职责是原样写进
		// team.json 的（含发给队长的 operating context）。写成 %key% 就会把占位符本身
		// 发给模型，界面上也只剩 %…%。
		const agent = manifest.agent as { teams: { members: { responsibility?: string }[] }[] };
		for (const team of agent.teams) {
			for (const member of team.members) {
				const responsibility = member.responsibility ?? "";
				expect(responsibility.length, responsibility).toBeGreaterThan(0);
				expect(/^%.*%$/.test(responsibility), responsibility).toBe(false);
			}
		}
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
		const ids = [...TOOL_SOURCE.matchAll(/id: "([a-z_]+)"/g)].map((match) => match[1]);
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
		// `@theme inline` 只把取值内联进本插件的工具类，不向 :root 发射宿主同名变量；
		// 裸 `@theme` 会写出一份真的 token，那才是要挡的东西。
		expect(css).not.toMatch(/(^|\n)\s*@theme\s*(?:static|default)?\s*\{/);
		expect(css).toMatch(/(^|\n)\s*@theme\s+inline\s*\{/);
		// 已占用的宿主 token 名一个都不许重声明（改名表见 style.css 文件头）。
		expect(css).not.toMatch(
			/--color-(?:background|foreground|card|muted|accent|border|primary|secondary|popover|ring|input)\s*:/,
		);
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

	it("registers two surfaces over one interface: the tab and the full page (ADR 0025 补注四)", () => {
		const entry = read("src/index.tsx");
		const tab = read("src/studio-tab.ts");
		const view = read("src/studio-view.ts");
		// 标签页是日常入口（默认上栏），整页是它放大后的宿主路由；两块画布同一张界面。
		expect(entry).toContain("registerStudioTab(ctx)");
		expect(entry).toContain("registerStudioView(ctx)");
		expect(tab).toContain("ctx.ui.registerActivityTab(");
		expect(view).toContain("ctx.ui.registerWorkspaceView(");
		// fail-closed：没声明的场景下一个都不出现。
		expect(tab).toMatch(/scope_use: \["conversation", "project"\]/);
		// 默认就上栏：入口不押在宿主条件化的「+」池上（ADR 0025 末尾补注）。
		expect(tab).toContain("initiallyVisible: true");
		// 标签就是工作台本身；整页只是同一块界面的另一种画布。
		expect(tab).toContain("component: WorkbenchScreen");
		expect(view).toContain("component: WorkbenchFullPage");
		// 整页不占侧栏位置：用户点放大时按需进入，宿主把它列在设置里，入口不会丢。
		expect(view).toContain("sidebar: false");
	});

	it("only asks for the slot permissions it actually uses", () => {
		const permissions = (json<{ permissions: string[] }>("plugin.json")).permissions;
		expect(permissions).toContain("ui.slot.activity-tab");
		expect(permissions).toContain("ui.slot.workspace-view");
		expect(permissions).toEqual([...permissions].sort());
		const sources = SOURCE_FILES.map(read).join("\n");
		expect(sources).toContain(".registerActivityTab(");
		expect(sources).toContain(".registerWorkspaceView(");
		// 「声明的 slot 权限」必须等于「真的注册过的那几个」：多一个就是白要，
		// 少一个则在宿主里静默 noop（缺权限 = warn+noop）。
		const declared = permissions.filter((item) => item.startsWith("ui.slot."));
		expect(declared).toEqual(["ui.slot.activity-tab", "ui.slot.workspace-view"]);
		expect(sources).not.toContain(".registerToolCallSlot(");
		expect(sources).not.toContain(".registerNewSessionContext(");
	});

	it("uses an iconify class for the tab icon, not a bare icon name", () => {
		const tab = read("src/studio-tab.ts");
		expect(tab).toMatch(/STUDIO_TAB_ICON = "icon-\[solar--[a-z0-9-]+\]"/);
	});

	it("navigates to the reader from the book page instead of sending a prompt", () => {
		const book = read("src/features/workbench/components/pages/BookPage.tsx");
		// 章号只做局部导航：`onNavigate("reader", n)`，点目录不会往对话发任何东西。
		expect(book).toMatch(/onNavigate\("reader", n\)/);
		expect(book).not.toContain("sendPrompt");
		// 设计稿第一条边界：七帧里没有派活按钮，也没有「开始写作 / 提交本章」。
		for (const page of [
			"shelf",
			"library",
			"book",
			"reader",
			"ledger",
			"console",
			"activation",
		]) {
			const text = read(`src/features/workbench/components/pages/${page[0].toUpperCase()}${page.slice(1)}Page.tsx`);
			expect(text, page).not.toMatch(/action\.(startDrafting|commitChapter|runCheck)/);
			expect(text, page).not.toContain("sendPrompt");
		}
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
		const registered = new Set([...TOOL_SOURCE.matchAll(/id: "mahua_([a-z_]+)"/g)].map((match) => match[1]));
		const missing = Object.entries(PARITY).flatMap(([upstream, ours]) =>
			ours.filter((tool) => !registered.has(tool)).map((tool) => `${upstream} -> ${tool}`),
		);
		expect(missing).toEqual([]);
	});

	it("registers no tool id twice", () => {
		const ids = [...TOOL_SOURCE.matchAll(/id: "mahua_([a-z_]+)"/g)].map((m) => m[1]);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("gives every tool a scope_use so the host does not fail closed", () => {
		const registrations = TOOL_SOURCE.match(/registerTool</g) ?? [];
		const scopes = TOOL_SOURCE.match(/scope_use: \[\.\.\.SCENARIOS\]/g) ?? [];
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
		// 「跳到侧栏对话」只点亮输入条，不建会话、不发指令——宿主里没有「聚焦侧栏」的 API，
		// 能做的两件事都在 use-team-reveal 里，别处不许直接碰 conversation。
		const callers = SOURCE_FILES.filter((path) => /ctx\.conversation\.|conversation\.(?:createSession|sendPrompt)/.test(read(path)));
		expect(callers).toEqual(["src/features/workbench/hooks/use-team-reveal.ts"]);
	});

	it("asks for exactly the permissions the surfaces need", () => {
		const permissions = (manifest.permissions as string[]).slice().sort();
		expect(permissions).toEqual(
			[
				"agent.hookHandler.execute",
				"agent.hooks.register",
				"agent.session.read",
				"agent.session.write",
				// ADR 0019：提示词块与技能目录各自需要一项权限，缺了宿主会静默跳过。
				"agent.skills.control",
				"agent.systemPrompt.write",
				"agent.toolHandler.execute",
				"agent.tools.register",
				"storage.read",
				"storage.write",
				// 两块画布、一张界面（ADR 0025 补注四）：标签 + 整页视图。
				"ui.slot.activity-tab",
				"ui.slot.workspace-view",
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
		const registered = [...TOOL_SOURCE.matchAll(/id: "(mahua_[a-z_]+)"/g)].map((match) => match[1]);
		const gated = [...read("src/entitlement/entitlement-gate.ts").matchAll(/"(mahua_[a-z_]+)"/g)].map(
			(match) => match[1],
		);
		const expected = registered.filter((id) => !READ_TOOLS.has(id));
		expect(gated.slice().sort()).toEqual(expected.slice().sort());
	});
});

describe("the workbench frames stay honest about the domain", () => {
	it("ships a screen for every frame the rail can reach", () => {
		const pages = read("src/features/workbench/workbench-pages.ts");
		const ids = [...pages.matchAll(/"([a-z]+)"/g)].map((match) => match[1] as string);
		const RAILS = new Set(["shelf", "library", "book", "reader", "ledger", "console", "activation"]);
		const reached = [...new Set(ids.filter((id) => RAILS.has(id)))].sort();
		expect(reached).toEqual([...RAILS].sort());
		for (const id of reached) {
			const file = `src/features/workbench/components/pages/${id[0]?.toUpperCase()}${id.slice(1)}Page.tsx`;
			expect(read(file), file).toContain(`export function ${id[0]?.toUpperCase()}${id.slice(1)}Page`);
		}
	});

	it("filters by every phase the domain can store", () => {
		// 左栏的筛选清单是手写的；漏一个阶段，那一阶段的书就只能在「全部」里出现。
		const domain = read("src/domain/novel-types.ts");
		const union = /type NovelPhase\s*=\s*([\s\S]*?);/.exec(domain)?.[1] ?? "";
		const phases = [...union.matchAll(/"([a-z_]+)"/g)].map((match) => match[1] as string);
		expect(phases.length).toBeGreaterThan(3);
		const filter = read("src/features/workbench/components/pages/LibraryPage.tsx");
		const listed = /const PHASES = \[([\s\S]*?)\]/.exec(filter)?.[1] ?? "";
		const missing = phases.filter((phase) => !listed.includes(`"${phase}"`));
		expect(missing).toEqual([]);
	});

	it("survives being rendered before the plugin runtime exists", () => {
		// 运行时只在 activate 里建。宿主若先渲染标签或整页（热重载 / 冷启动 / 停用后再点开），
		// 入口必须自己挡一道：不能抛错把整块面板留白，也不能永远停在骨架上。
		const screen = read("src/features/workbench/components/WorkbenchScreen.tsx");
		const page = read("src/features/workbench/components/WorkbenchFullPage.tsx");
		for (const entry of [screen, page]) {
			expect(entry).toContain("useStudioRuntimeReady()");
			expect(entry).not.toContain("getStudioRuntime()");
		}
		// 轮询到就位：只在启动那一刻看一眼，会让「宿主早于 activate 渲染」永久空白。
		const retry = read("src/features/workbench/hooks/use-studio-runtime-ready.ts");
		expect(retry).toContain("tryGetStudioRuntime()");
		expect(retry).toContain("setInterval(");
		expect(read("src/features/workbench/components/WorkbenchSurface.tsx")).toContain(
			"export function WorkbenchSurface",
		);
	});

	it("folds the rail instead of squeezing the sheet", () => {
		// 窄面板里 `aside w-full` + `main flex-1` 同行会把主纸区挤成 0 宽。
		// 两处降级必须同一档：栏自己横过来，行也跟着竖排。
		const shell = read("src/features/workbench/components/shell/StudioShell.tsx");
		const rail = read("src/features/workbench/components/shell/StudioRail.tsx");
		const row = /flex min-h-0 flex-1 gap-2 ([^"]+)/.exec(shell)?.[1] ?? "";
		expect(row).toContain("@max-[720px]:flex-col");
		expect(rail).toContain("@max-[720px]:w-full");
		expect(rail).toContain("@max-[720px]:flex-row");
	});

	it("renders one sheet per side of the console, not a raised middle", () => {
		// 设计稿的左右栏是内凹井（`bg-inset`），中栏才是浮起的纸。三栏都浮起就没了主次。
		const console = read("src/features/workbench/components/pages/ConsolePage.tsx");
		const wells = console.match(/bg-inset/g) ?? [];
		expect(wells.length).toBeGreaterThanOrEqual(2);
	});

	it("keeps every dynamic locale family resolvable", () => {
		// `t(\`status.${...}\`)` 这类键是拼出来的，通用扫描看不见。
		// 取值直接取自领域的联合类型，避免这份清单自己先漂。
		const unions: Array<[string, string, string]> = [
			["src/domain/novel-types.ts", "ChapterStatus", "status"],
			["src/domain/novel-types.ts", "NovelPhase", "phase"],
			["src/application/console-log/console-log-event.ts", "ConsoleLogOrigin", "console.origin"],
			["src/application/console-log/console-log-event.ts", "ConsoleLogStatus", "feed.status"],
		];
		const missing: string[] = [];
		for (const [file, name, prefix] of unions) {
			const union = new RegExp(`type ${name}\\s*=\\s*([\\s\\S]*?);`).exec(read(file))?.[1] ?? "";
			for (const match of union.matchAll(/"([^"]+)"/g)) {
				const key = `${prefix}.${match[1]}`;
				if (!(key in en) || !(key in zh)) missing.push(key);
			}
		}
		expect(missing).toEqual([]);
	});
});
