import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { ReviewStore } from "../src/review/store.ts";
import { registerReviewTool } from "../src/review/tool.ts";

/**
 * 工具在「还没跑起来」的阶段失败时，也必须留下一条运行记录。
 *
 * 面板只显示最后一条运行：只要这条路径不写记录，用户看到的就是上一次（甚至上个版本）的结论，
 * 于是每次重试都像「又失败了」。这里把它钉成契约。
 */

interface ToolResult {
	readonly content: ReadonlyArray<{ readonly type: string; readonly text: string }>;
}

interface ReviewToolSpec {
	readonly name: string;
	readonly handler: (args: {
		trigger: { input?: unknown };
		session: { id?: string; cwd?: string };
	}) => Promise<ToolResult>;
}

function harness(options: { roots?: string[]; stdout?: string; exitCode?: number } = {}) {
	const specs: ReviewToolSpec[] = [];
	const files = new Map<string, string>();
	const fsReads: string[] = [];
	const ctx = {
		agent: { registerTool: (spec: ReviewToolSpec) => specs.push(spec) },
		storage: {
			readFile: async (key: string) => files.get(key) ?? null,
			writeFile: async (key: string, value: string) => {
				files.set(key, value);
			},
		},
		fileExplorer: {
			getWorkspaceRoots: () => (options.roots ?? []).map((path) => ({ name: path, path })),
		},
		fs: {
			readFile: async (path: string) => {
				fsReads.push(path);
				return { content: files.get(path) ?? "", encoding: "utf8" as const };
			},
		},
		// ocr 不可用：providerBlockedMessage 会吞掉这里的异常并给出可执行提示；
		// 传 stdout/exitCode 时模拟一次成功的 ocr 运行。
		cliProviders: {
			run: async () => {
				if (options.stdout !== undefined) {
					return { stdout: options.stdout, stderr: "", exitCode: options.exitCode ?? 0 };
				}
				throw new Error("provider unavailable");
			},
			getStatus: async () => {
				throw new Error("provider unavailable");
			},
		},
	} as unknown as PluginContext;
	const store = new ReviewStore(ctx);
	registerReviewTool(ctx, store);
	const review = specs.find((spec) => spec.name === "code_review");
	assert.ok(review, "code_review 必须注册");
	return { store, review, fsReads };
}

describe("code_review 失败也要写进面板", () => {
	it("会话 cwd 是根目录且没有打开项目：拒绝执行，并记录这次失败", async () => {
		const { store, review } = harness();
		const result = await review.handler({ trigger: { input: {} }, session: { cwd: "/" } });

		assert.match(result.content[0]?.text ?? "", /没有可用的工作区目录/);
		assert.equal(store.getRuns().length, 1);
		const [run] = store.getRuns();
		assert.equal(run.ok, false);
		assert.equal(run.engine, "delegate");
		assert.equal(run.scope, "workspace");
		assert.match(run.error ?? "", /没有可用的工作区目录/);
	});

	it("会话 cwd 不可用但有打开的项目：退回工作区继续跑（不再直接拒绝）", async () => {
		const { store, review } = harness({ roots: ["/Users/example/project"] });
		const result = await review.handler({
			trigger: { input: { engine: "ocr" } },
			session: { cwd: "/" },
		});

		const text = result.content[0]?.text ?? "";
		assert.doesNotMatch(text, /没有可用的工作区目录/);
		assert.match(text, /暂不可用/);
		assert.equal(store.getRuns().length, 1);
		assert.equal(store.getRuns()[0].engine, "ocr");
		assert.equal(store.getRuns()[0].ok, false);
	});

	it("提交范围会带进运行记录，面板标题与工具口径一致", async () => {
		const { store, review } = harness();
		await review.handler({
			trigger: { input: { commit: "0123456789abcdef" } },
			session: { cwd: "/" },
		});
		assert.equal(store.getRuns()[0].scope, "0123456789");
	});

	it("ocr 模式从 stdout 解析结果，不再写/读中转文件", async () => {
		const stdout = JSON.stringify({
			project_summary: "clean",
			comments: [{ path: "src/a.ts", start_line: 3, severity: "high", content: "空指针" }],
		});
		const { store, review, fsReads } = harness({ roots: ["/Users/example/project"], stdout, exitCode: 0 });
		const result = await review.handler({
			trigger: { input: { engine: "ocr" } },
			session: { cwd: "/" },
		});

		assert.deepEqual(fsReads, [], "中转文件方案已废弃：不允许再碰 ctx.fs");
		assert.equal(store.getRuns().length, 1);
		const [run] = store.getRuns();
		assert.equal(run.ok, true);
		assert.equal(run.engine, "ocr");
		assert.equal(run.findings.length, 1);
		assert.equal(run.findings[0]?.severity, "high");
		assert.equal(run.rawSummary, "clean");
		assert.match(result.content[0]?.text ?? "", /发现/);
	});

	it("stdout 不是 JSON 时记录失败，而不是伪装成零发现", async () => {
		const { store, review, fsReads } = harness({
			roots: ["/Users/example/project"],
			stdout: "[ocr] progress noise",
			exitCode: 0,
		});
		await review.handler({ trigger: { input: { engine: "ocr" } }, session: { cwd: "/" } });

		assert.deepEqual(fsReads, []);
		const [run] = store.getRuns();
		assert.equal(run.ok, false);
		assert.match(run.error ?? "", /不是可解析的 JSON/);
	});
});
