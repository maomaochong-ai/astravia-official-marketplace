import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildPreviewArgs,
	buildRuleArgs,
	composeBrief,
	describeScope,
	gitDiffArgs,
	parsePreview,
	selectDiffBudget,
} from "../src/review/delegate.ts";

/** 委托模式的纯函数层：preview 解析、git 参数、简报预算。 */

const WORKSPACE_PREVIEW = [
	"# Files (2 reviewable / 3 total)",
	"",
	"- mode: workspace",
	"- total_insertions: 12",
	"- total_deletions: 1",
	"",
	"  - `src/a.ts` [modified] +10/-1",
	"  - `src/new.ts` [added] +2/-0",
	"~~- `package-lock.json` [modified] +40/-40 (excluded: default_path)~~",
].join("\n");

describe("parsePreview（ocr delegate preview → 结构化范围）", () => {
	it("工作区模式：文件、增删行数与排除项都解析出来", () => {
		const preview = parsePreview(WORKSPACE_PREVIEW);
		assert.equal(preview.mode, "workspace");
		assert.equal(preview.reviewable, 2);
		assert.equal(preview.total, 3);
		assert.deepEqual(preview.files, [
			{ path: "src/a.ts", status: "modified", insertions: 10, deletions: 1 },
			{ path: "src/new.ts", status: "added", insertions: 2, deletions: 0 },
		]);
		assert.deepEqual(preview.excluded, [{ path: "package-lock.json", reason: "default_path" }]);
	});

	it("区间模式：from / to / merge_base 进 refs，范围描述用 from…to", () => {
		const preview = parsePreview(
			[
				"# Files (1 reviewable / 1 total)",
				"- mode: range",
				"- from: main",
				"- to: feature",
				"- merge_base: 52ead26a19948bd51d31ac4ba679c3c23d20514c",
				"  - `src/a.ts` [modified] +1/-1",
			].join("\n"),
		);
		assert.equal(preview.mode, "range");
		assert.equal(preview.refs.from, "main");
		assert.equal(preview.refs.to, "feature");
		assert.equal(preview.refs.merge_base, "52ead26a19948bd51d31ac4ba679c3c23d20514c");
		assert.equal(describeScope(preview), "main…feature");
	});

	it("空输出不炸：0 个文件、workspace 模式", () => {
		const preview = parsePreview("");
		assert.equal(preview.mode, "workspace");
		assert.equal(preview.files.length, 0);
		assert.equal(describeScope(preview), "workspace");
	});
});

describe("buildPreviewArgs / buildRuleArgs（命令组装）", () => {
	it("工作区模式只带 --repo", () => {
		assert.deepEqual(buildPreviewArgs({}, "/repo"), ["delegate", "preview", "--repo", "/repo"]);
	});

	it("区间模式展开 --from / --to，to 缺省 HEAD", () => {
		assert.deepEqual(buildPreviewArgs({ from: "main" }, "/repo"), [
			"delegate",
			"preview",
			"--repo",
			"/repo",
			"--from",
			"main",
			"--to",
			"HEAD",
		]);
	});

	it("单提交模式用 --commit，且优先于 from", () => {
		assert.deepEqual(buildPreviewArgs({ commit: "abc123", from: "main" }, "/repo"), [
			"delegate",
			"preview",
			"--repo",
			"/repo",
			"--commit",
			"abc123",
		]);
	});

	it("规则命令把所有可审查文件一次传给 ocr", () => {
		assert.deepEqual(buildRuleArgs(["a.ts", "b.ts"], "/repo"), [
			"delegate",
			"rule",
			"a.ts",
			"b.ts",
			"--repo",
			"/repo",
		]);
	});
});

describe("gitDiffArgs（按模式取 diff）", () => {
	it("区间模式用 merge_base..to，取不到 merge_base 时退回 from..to", () => {
		const withBase = parsePreview("- mode: range\n- from: main\n- to: feat\n- merge_base: deadbeef\n");
		assert.deepEqual(gitDiffArgs(withBase, "a.ts")[0], [
			"--no-pager",
			"diff",
			"--no-ext-diff",
			"--no-textconv",
			"--no-color",
			"deadbeef..feat",
			"--",
			"a.ts",
		]);
		const without = parsePreview("- mode: range\n- from: main\n");
		assert.ok(gitDiffArgs(without, "a.ts")[0]?.includes("main..HEAD"));
	});

	it("单提交模式用 show <commit>", () => {
		const preview = parsePreview("- mode: commit\n- commit: abc1234\n");
		assert.deepEqual(gitDiffArgs(preview, "a.ts")[0], [
			"--no-pager",
			"show",
			"--no-ext-diff",
			"--no-textconv",
			"--no-color",
			"abc1234",
			"--",
			"a.ts",
		]);
	});

	it("工作区模式先试 diff HEAD，再退回 --no-index（覆盖未跟踪新文件）", () => {
		const preview = parsePreview("- mode: workspace\n");
		const [first, fallback] = gitDiffArgs(preview, "new.ts");
		assert.equal(first?.includes("HEAD"), true);
		assert.equal(fallback?.includes("--no-index"), true);
	});
});

describe("selectDiffBudget（简报预算）", () => {
	const preview = parsePreview(WORKSPACE_PREVIEW);

	it("没有 diff 的文件进 missing，不是静默跳过", () => {
		const result = selectDiffBudget(preview, new Map([["src/a.ts", "diff --git a b\n+x"]]));
		assert.equal(result.files.length, 1);
		assert.deepEqual(result.missing, ["src/new.ts"]);
	});

	it("单文件超限截断并打标记", () => {
		const result = selectDiffBudget(preview, new Map([["src/a.ts", "x".repeat(50)]]), { maxDiffChars: 10 });
		assert.equal(result.files[0]?.diff.length, 10);
		assert.equal(result.files[0]?.truncated, true);
	});

	it("总量用尽后剩余文件记入 missing", () => {
		const result = selectDiffBudget(
			preview,
			new Map([
				["src/a.ts", "x".repeat(40)],
				["src/new.ts", "y".repeat(40)],
			]),
			{ maxTotalChars: 100 },
		);
		assert.equal(result.files.length, 1);
		assert.deepEqual(result.missing, ["src/new.ts"]);
	});
});

describe("composeBrief（交给模型的审查简报）", () => {
	const preview = parsePreview(WORKSPACE_PREVIEW);

	it("带工作区、范围、文件清单、规则与 diff", () => {
		const brief = composeBrief({
			root: "/repo",
			preview,
			rules: "### Rule Group 1\n- no var",
			files: [{ file: preview.files[0]!, diff: "diff --git a/src/a.ts b/src/a.ts", truncated: false }],
			missing: ["src/new.ts"],
		});
		assert.match(brief, /\/repo/);
		assert.match(brief, /workspace/);
		assert.match(brief, /src\/a\.ts/);
		assert.match(brief, /no var/);
		assert.match(brief, /```diff/);
		assert.match(brief, /未取到 diff 的文件/);
	});

	it("规则缺失时给通用缺陷清单，不留空段", () => {
		const brief = composeBrief({ root: "/repo", preview, rules: "  ", files: [], missing: [] });
		assert.match(brief, /通用缺陷清单/);
	});
});
