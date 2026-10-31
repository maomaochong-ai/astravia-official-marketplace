import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { COLUMNS_TIERS, HEADER_CELLS, visibleHeaderCells } from "../src/features/workbench/components/pages/library-columns.js";

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

	it("keeps the views free of literal natural language", () => {
		const violations: string[] = [];
		for (const path of SOURCE_FILES.filter((file) => file.startsWith("src/features"))) {
			const text = read(path)
				.replace(/\/\*[\s\S]*?\*\//g, "")
				.replace(/\/\/.*$/gm, "");
			// 界面上出现的中文/全角标点必须来自 locales/*.json；写死在视图里，英文界面就会露馅。
			if (/[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/.test(text)) {
				violations.push(`${path}: literal natural language in a view`);
			}
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

	it("widens through the host's panel width, never through an overlay", () => {
		// 「越大」这条需求只有一条正路：把**宿主的活动面板**拉到最宽（`setActivityPanelWidth("max")`）。
		// 宿主自己的宽度模型在面板超过「窗口宽 - 384」时会自动收起左侧栏，退出时再把用户的意愿位
		// 还原——「全屏时侧栏该让位」由宿主实现，插件不碰宿主的 DOM。
		//
		// 从前走的是 `createPortal` 到 `document.body` 的 `fixed inset-0` 覆盖层。那条路只是把画面蒙住：
		// 宿主的标签条与侧栏仍在原地（用户看到的「标签菜单残留」），可用宽度也不是真的变宽，只是被盖住；
		// 而它必须给自己一个极大的 z-index 才能压住宿主壳层，宿主改一次层叠上下文就翻车。
		// 现在把这三条都钉成禁区：面板类 slot 不许 `fixed`、不许超大 z-index、不许 portal 到 body。
		const violations: string[] = [];
		for (const path of SOURCE_FILES) {
			// 只看代码，不看注释：注释里解释「当年为什么用 portal」并不等于真的用了。
			const text = read(path)
				.replace(/\/\*[\s\S]*?\*\//g, "")
				.replace(/\/\/.*$/gm, "");
			if (/\bfixed\b/.test(text)) violations.push(`${path}: fixed`);
			if (text.includes("createPortal")) violations.push(`${path}: createPortal`);
			if (/z-\[(\d{7,})\]/.test(text)) violations.push(`${path}: overlay z-index`);
			if (text.includes("data-mahua-overlay")) violations.push(`${path}: overlay marker`);
		}
		expect(violations).toEqual([]);

		const surface = read("src/features/workbench/components/WorkbenchSurface.tsx");
		const code = surface.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
		// 一份 JSX，两种宽度；不另写一份，也不搬 DOM。
		expect(code).toContain("ctx.ui.setActivityPanelWidth(");
		expect(code).toContain('setPanelWidth("max")');
		expect(code).toContain('className="mahua-root flex h-full min-h-0 w-full flex-col overflow-hidden"');
		expect(code).toContain('data-expanded={expanded ? "true" : "false"}');
		// 收回时把展开前量到的宽度还回去，而不是塞一个写死的值：否则用户的手工宽度会被吞掉。
		expect(code).toContain("restoreRef.current ?? RESTORE_FALLBACK_PX");
		// 拉宽之后 Esc 收回：这是模态化的唯一残留，键盘用户得有一条退路。
		expect(code).toContain('event.key === "Escape"');
		expect(code).not.toContain("document.body.style.overflow");
		// 宿主的位置 API 一个都不用：它们做不到「只有插件」（注释里的名字不算）。
		expect(code).not.toContain("openWorkspaceView");
		expect(code).not.toContain("openActivityTab");
	});

	it("registers exactly one host shape: an activity tab, and nothing in the sidebar", () => {
		const entry = read("src/index.tsx");
		const tab = read("src/studio-tab.ts");
		// 只注册活动面板标签。从前还注册过一个工作区视图，它的副作用是宿主管家侧栏里会多一条
		// 「麻花小说网」，而它又做不到「只有插件」——两头不讨好，所以整条注册连文件一起删了。
		expect(entry).toContain("registerStudioTab(ctx)");
		expect(entry).not.toContain("registerStudioView");
		expect(tab).toContain("ctx.ui.registerActivityTab(");
		// fail-closed：没声明的场景下一个都不出现。
		expect(tab).toMatch(/scope_use: \["conversation", "project"\]/);
		// 默认就上欏：入口不押在宿主条件化的「+」池上（ADR 0025 末尾补注）。
		expect(tab).toContain("initiallyVisible: true");
		expect(tab).toContain("component: WorkbenchMount");
		// 常量只剩一个：没有第二个命名空间，就不必再写两份同串常量。
		const ids = read("src/studio-ids.ts");
		expect(ids).toContain('STUDIO_TAB_ID = "studio"');
		expect(ids).not.toContain("STUDIO_VIEW_ID");
	});

	it("only asks for the slot permissions it actually uses", () => {
		const permissions = (json<{ permissions: string[] }>("plugin.json")).permissions;
		expect(permissions).toEqual([...permissions].sort());
		const sources = SOURCE_FILES.map(read).join("\n");
		expect(sources).toContain(".registerActivityTab(");
		expect(sources).toContain(".registerTurnCard(");
		// 「声明的 slot 权限」必须等于「真的注册过的那几个」：多一个就是白要，
		// 少一个则在宿主里静默 noop（缺权限 = warn+noop）。工作区视图删了，权限也一并还回去。
		expect(sources).not.toContain(".registerWorkspaceView(");
		const declared = permissions.filter((item) => item.startsWith("ui.slot."));
		expect(declared).toEqual(["ui.slot.activity-tab", "ui.slot.turn-card"]);
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

	it("never reaches into the conversation from the workbench", () => {
		// 从前这里守着一个「跳到侧栏对话」的 hook：它只能扫 DOM 找输入框（宿主的“聚焦侧栏”
		// API 不存在），`insertText("")` 会清掉用户刚打的草稿、`createSession` 会另开一段对话。
		// hook 已删，但边界还得看着：工作台永远不发指令、不碰对话。
		const callers = SOURCE_FILES.filter((path) =>
			/ctx\.conversation\.|conversation\.(?:createSession|sendPrompt|insertText)/.test(read(path)),
		);
		expect(callers).toEqual([]);
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
				// 一个宿主形状：活动面板标签；落章卡片读对话的 turn 槽。
				"ui.slot.activity-tab",
				"ui.slot.turn-card",
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
		const mount = read("src/features/workbench/components/WorkbenchMount.tsx");
		expect(mount).toContain("useStudioRuntimeReady()");
		expect(mount).not.toContain("getStudioRuntime()");
		// 唯一入口穿同一道门：多写一份守卫，就必然有一份写错。
		expect(read("src/studio-tab.ts")).toContain("component: WorkbenchMount");
		// 轮询到就位：只在启动那一刻看一眼，会让「宿主早于 activate 渲染」永久空白。
		const retry = read("src/features/workbench/hooks/use-studio-runtime-ready.ts");
		expect(retry).toContain("tryGetStudioRuntime()");
		expect(retry).toContain("setInterval(");
		expect(read("src/features/workbench/components/WorkbenchSurface.tsx")).toContain(
			"export function WorkbenchSurface",
		);
	});

	it("keeps the rail vertical and narrows it instead of folding the sheet", () => {
		// 上一版把窄面板里的栏横过来、主区跟着竖排：六个条目在一条横带里换行，
		// 书卡与团队卡被压扁，拖动面板后就是用户看到的那一团。现在只允许一种降级：
		// 栏收成 44px 图标竖栏，主区永远在右边。
		const shell = read("src/features/workbench/components/shell/StudioShell.tsx");
		const rail = read("src/features/workbench/components/shell/StudioRail.tsx");
		const css = read("src/style.css");
		expect(shell).not.toMatch(/@max-\[\d+px\]:flex-col/);
		expect(rail).not.toContain("@max-[720px]:flex-row");
		// 收栏由一个 `data-collapsed` 属性驱动，宽度写在样式表里：容器查询的宽度类
		// （`@max-[640px]:w-11`）与根节点上的观察者可能在一帧里得出相反结论，
		// 而 44px 又必须压得住 `w-[208px]`（同层 0,2,0 才赢），所以只剩这一处实现。
		expect(rail).toContain("data-collapsed=");
		expect(css).toMatch(/\.mahua-rail\[data-collapsed="true"\] \{[\s\S]*?width: 44px;/);
	});

	it("keeps the boot skeleton the same shape as the real shell", () => {
		// 骨架不是装饰：它和真界面差一层，换装时纸面就会往下跳一次。
		// 那一跳比多等 200ms 扎眼得多，所以逐层对齐（报头 / 12px 托底 / 窄栏 / 纸）。
		const skeleton = read("src/features/workbench/components/StudioBootSkeleton.tsx");
		for (const layer of ["bg-canvas", "h-12", "pb-3", "w-[208px]", "rounded-sheet", "bg-surface"]) {
			expect(skeleton).toContain(layer);
		}
		// 骨架里不许出现真界面的数据入口：它必须能在运行时存在之前渲染。
		expect(skeleton).not.toContain("useStudioState());");
		expect(skeleton).not.toContain("getStudioRuntime()");
	});

	it("puts the widen door in the masthead, where every page can reach it", () => {
		// 拉宽现在是外壳级能力，所以门必须挂在报头右槽：它不随页面变，bare 页（运行台 / 激活页）
		// 没有竖栏也能到。竖栏底部则一律不带描边按钮（收纳态尤其碎）。
		//
		// 报头**不是**窗口标题栏：宿主页头在它上面，拖拽区与红黄绿也不归它管，所以这里一个
		// `mahua-drag` / `mahua-traffic-lights` 都不该有——那是覆盖层时代的残留。
		const masthead = read("src/features/workbench/components/shell/StudioMasthead.tsx");
		expect(masthead).toContain('t("window.expandPanel")');
		expect(masthead).toContain('t("window.collapsePanel")');
		expect(masthead).toContain("icon-[solar--maximize-square-minimalistic-bold]");
		expect(masthead).toContain("icon-[solar--minimize-square-minimalistic-bold]");
		const mastheadCode = masthead.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
		expect(mastheadCode).not.toContain("mahua-drag");
		expect(mastheadCode).not.toContain("mahua-traffic-lights");
		// 窄栏底部不再有「换位置」与「跳对话」两扇门。
		const rail = read("src/features/workbench/components/shell/StudioRail.tsx");
		expect(rail).not.toContain("revealTeam");
		expect(rail).not.toContain("onSwapSurface");
	});


	it("renders one sheet per side of the console, not a raised middle", () => {
		// 设计稿的左右栏是凹槽，中栏才是浮起的纸。三栏都浮起就没了主次。
		// ADR 0033 之后凹槽叫 `bg-well`，旧名 `bg-inset` 在页面里不再出现——
		// 它现在只留给骨架屏与徽记这类“贴在纸上的一小块”。
		const console = read("src/features/workbench/components/pages/ConsolePage.tsx");
		const wells = console.match(/bg-well/g) ?? [];
		expect(wells.length).toBeGreaterThanOrEqual(2);
		expect(console).toContain("mahua-card");
		expect(console).not.toContain("bg-inset");
	});

	it("keeps the style sheet balanced and layered", () => {
		// tsc 与 vitest 都不解 CSS：少了一个 `@layer base {` 开工行时，全仓测试仍然绿，
		// 只有 vite build 里的 tailwind 解析器会报 "Missing opening {"。这一条就是那道亏。
		const css = read("src/style.css");
		const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "));
		const opens: number[] = [];
		for (const [index, line] of stripped.split("\n").entries()) {
			for (const char of line) {
				if (char === "{") opens.push(index + 1);
				else if (char === "}") expect(opens.pop(), `unexpected } on line ${index + 1}`).toBeDefined();
			}
		}
		expect(opens).toEqual([]);

		// 取值必须落在 base 层里：放在顶层会以层外样式的身份压过 utility。
		const base = stripped.slice(stripped.indexOf("@layer base {"));
		expect(base).toContain("--mahua-canvas:");
		expect(base.split("\n").findIndex((line) => line === "}")).toBeGreaterThan(0);
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

	it("keeps the library grid tracks equal to the cells it still renders", () => {
		// 一档模板少了一列、单元格却没少——多出来的子项会被 grid 自动排布塞进隐式第二行：
		// 行高翻倍、字折成两行、右列错位。这条守卫把「轨道数 = 可见单元格数」钉在四个档位。
		const mismatched: string[] = [];
		for (const tier of COLUMNS_TIERS) {
			const visible = visibleHeaderCells(tier.tracks).length;
			if (visible !== tier.tracks) mismatched.push(`${tier.tracks} tracks vs ${visible} cells`);
			// 模板里的轨道数也不能自己说了算：把方括号里那串按 `_` 切开数一下有多少段。
			const template = /grid-cols-\[([^\]]+)\]/.exec(tier.template)?.[1] ?? "";
			const tracks = template.split("_").filter(Boolean).length;
			if (tracks !== tier.tracks) mismatched.push(`${tier.tracks} declared vs ${tracks} in ${tier.template}`);
		}
		expect(mismatched).toEqual([]);
		// 每格都得在语言文件里能查到，不然空表头比错位更难发现。
		expect(HEADER_CELLS.filter((cell) => !(cell.key in en) || !(cell.key in zh))).toEqual([]);
	});
});

describe("one paper language across the workbench (ADR 0033)", () => {
	/** 扫源码前先把注释剔掉：注释里引一个旧类名是解说，不是用法。
	 *  换成空格而不是删除，免得行号漂移后报错指向错位置。 */
	const bare = (path: string) =>
		read(path)
			.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
			.replace(/(^|\n)\s*\/\/[^\n]*/g, (line) => line.replace(/[^\n]/g, " "));

	const UI_FILES = SOURCE_FILES.filter((path) => /\.tsx$/.test(path));

	it("spells every icon in the Solar family", () => {
		// 一个界面里混两个图标族，字重、圆角、光学尺寸全对不上。从前有两处
		// `lucide--` 选在没有对应图形的地方——这就是那道亏。
		const wrongFamily: string[] = [];
		const wrongShape: string[] = [];
		for (const path of UI_FILES) {
			const text = bare(path);
			if (/lucide--/.test(text)) wrongFamily.push(path);
			for (const match of text.matchAll(/icon-\[[^\]]+\]/g)) {
				if (!/^icon-\[solar--[a-z0-9-]+\]$/.test(match[0])) wrongShape.push(`${path}: ${match[0]}`);
			}
		}
		expect(wrongFamily).toEqual([]);
		expect(wrongShape).toEqual([]);
	});

	it("puts every page on the shared page and card shells", () => {
		// 页边距离、卡内留白、容器间距——三项从前每页各写一份，所以页间差 2–4px。
		// 现在只有一个来源：页面根带 `mahua-page`，纸面容器带 `mahua-card`。
		const pages = SOURCE_FILES.filter((path) => path.startsWith("src/features/workbench/components/pages/") && /\.tsx$/.test(path));
		expect(pages.length).toBeGreaterThanOrEqual(7);
		const missingPage: string[] = [];
		const missingCard: string[] = [];
		for (const path of pages) {
			const text = bare(path);
			if (!text.includes("mahua-page")) missingPage.push(path);
			// 激活页整页就两张卡，阅读页正文区也是卡——没有哪一页应该完全无卡。
			if (!text.includes("mahua-card")) missingCard.push(path);
		}
		expect(missingPage).toEqual([]);
		expect(missingCard).toEqual([]);
	});

	it("draws the whole workbench with containers instead of hairlines", () => {
		// 分隔只用底色与间距。剩下的描边只能是“空心的点”或“选中圈”，
		// 这两种用 `border-pass` / `border-line-strong` 画小圆点，不算分隔线。
		//
		// 从前这条只扫 `pages/`，于是重试键的表框、骨架屏报头的下划线一直留在原地——
		// 页面里干净、壳层里有线条，同一屏里两种语言。现在整棵树都在这条规则下。
		const dividers: string[] = [];
		for (const path of UI_FILES) {
			const text = bare(path);
			// 长名写在前：`border-line` 会先命中 `border-line-strong` 的前缀。
			for (const match of text.matchAll(/border-(?:line-strong|line-soft|line|dashed)|divide-[xy]/g)) {
				if (match[0] === "border-line-strong") continue;
				dividers.push(`${path}: ${match[0]}`);
			}
		}
		expect(dividers).toEqual([]);
	});

	it("never lets the filter strip wrap, whatever width the panel is dragged to", () => {
		// 面板能拖到 260，也能拉到窗口减 384。筛选带若允许折行，chip 会在凹槽里折成两三行，
		// 凹槽跟着长高，台账被挤到只剩两条——这就是「导航项文字被挤成两行」的来路。
		// 现在的契约是：整条横向滚动、每组 `shrink-0`、每枚 chip 不换行。
		const code = bare("src/features/workbench/components/pages/LibraryPage.tsx");
		expect(code).toContain("mahua-strip");
		expect(code).not.toMatch(/\bflex-wrap\b/);
		expect(code).toContain("whitespace-nowrap");
		// 样式得真在：类名挂上了，CSS 里没有滚动规则照样会把内容顶出去。
		expect(read("src/style.css")).toContain(".mahua-strip");
	});

});
