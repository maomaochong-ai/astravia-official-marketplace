import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { ReviewStore } from "../src/review/store.ts";
import { engineLabel } from "../src/features/code-review/finding-view.ts";

/**
 * 历史记录读回。
 *
 * 面板默认展示最后一条运行，所以「读回转成什么样」等于「用户看到什么」：
 * 旧版本留下的、已被修掉的失败如果照原样读回，就会被当成当前这次审查的结果。
 */

const RUNS_KEY = "as-ocr.runs";

function fakeCtx(seed: Record<string, string> = {}) {
	const files = new Map(Object.entries(seed));
	const ctx = {
		storage: {
			readFile: async (key: string) => files.get(key) ?? null,
			writeFile: async (key: string, value: string) => {
				files.set(key, value);
			},
		},
	} as unknown as PluginContext;
	return { ctx, files };
}

/** 构造函数里 loadPersisted 是 `void` 调用的，等一个宏任务让它落定。 */
async function loadStore(seed: Record<string, string>) {
	const harness = fakeCtx(seed);
	const store = new ReviewStore(harness.ctx);
	await new Promise((resolve) => setTimeout(resolve, 0));
	return { store, files: harness.files };
}

/** 本机真实存在过的那条噪声记录（0.1.5 之前写入）。 */
const LEGACY_GIT_FAILURE = JSON.stringify([
	{
		id: "run-1792208952562",
		startedAt: 1792208952562,
		durationMs: 1183,
		scope: "workspace",
		findings: [],
		rawSummary: "",
		ok: false,
		error: "Error: / is not a git repository\n",
	},
]);

describe("ReviewStore 读回历史记录", () => {
	it("旧版「不是 git 仓库」的失败不再读回：这种失败已经有 cwd 守卫，不可能复现", async () => {
		const { store } = await loadStore({ [RUNS_KEY]: LEGACY_GIT_FAILURE });
		assert.deepEqual(store.getRuns(), []);
	});

	it("没有 engine 的失败一律不读回：那是不可复现的旧版失败（0.1.10 起所有失败都带 engine 落盘）", async () => {
		const saved = JSON.stringify([
			{
				id: "run-1",
				startedAt: 1,
				durationMs: 10,
				scope: "workspace",
				findings: [],
				rawSummary: "",
				ok: false,
				// 与 git 无关的旧失败（如没配 LLM 端点）也不再展示：
				// 新版本重试时必然产生带 engine 的新记录覆盖它。
				error: "ocr 没有可用的模型端点",
			},
		]);
		const { store } = await loadStore({ [RUNS_KEY]: saved });
		assert.equal(store.getRuns().length, 0);
	});

	it("旧版成功记录保留，发现按新词表归一化", async () => {
		const saved = JSON.stringify([
			{
				id: "run-2",
				startedAt: 2,
				durationMs: 20,
				scope: "workspace",
				findings: [{ file: "src/a.ts", line: 3, severity: "major", message: "越界写入" }],
				rawSummary: "",
				ok: true,
			},
		]);
		const { store } = await loadStore({ [RUNS_KEY]: saved });
		const [run] = store.getRuns();
		assert.equal(run.ok, true);
		assert.equal(run.engine, undefined);
		assert.equal(run.findings.length, 1);
		assert.equal(run.findings[0].severity, "high");
		assert.equal(run.findings[0].category, "other");
		assert.ok(run.findings[0].key.length > 0);
	});

	it("新追加的失败会落盘，重新加载后仍在（面板不会回退到更旧的一条）", async () => {
		const { store, files } = await loadStore({ [RUNS_KEY]: LEGACY_GIT_FAILURE });
		store.appendRun({
			id: "run-3",
			startedAt: 3,
			durationMs: 30,
			scope: "workspace",
			findings: [],
			rawSummary: "",
			ok: false,
			engine: "delegate",
			error: "当前会话没有可用的工作区目录",
		});
		await new Promise((resolve) => setTimeout(resolve, 0));

		const reloaded = await loadStore({ [RUNS_KEY]: files.get(RUNS_KEY) ?? "" });
		assert.equal(reloaded.store.getRuns().length, 1);
		assert.equal(reloaded.store.latest()?.engine, "delegate");
	});
});

describe("engineLabel", () => {
	it("没有 engine 的旧记录标成旧版本，而不是冒充 ocr", () => {
		assert.equal(engineLabel(undefined), "旧版本");
		assert.equal(engineLabel("ocr"), "ocr");
		assert.equal(engineLabel("delegate"), "委托");
	});
});
