/**
 * `run_case_tool` —— 让先例包里的脚本真正跑起来。
 *
 * 补的是一条断链：`scaffold_case` 只把 `tools/*.py` 复制进工作区并**打印**命令行，
 * 而插件此前没有声明 `python`，所以对话里没有任何一步能执行它们。这些脚本是整包里
 * 最花功夫的部分（纯标准库、带 `--self-test`、按 manifest 声明参数），却只能被读。
 *
 * 固定顺序，不给调用方跳过的开关：
 *   1. 解析先例与工具（manifest 里没有就拒绝，并列出实际有的）；
 *   2. 把包 scaffold 到 `<工作区>/.hanshuang/cases/<slug>/`（已存在则保留）；
 *   3. **先跑 `--self-test`**：失败即停，不碰任何样本；
 *   4. 自检通过且给了参数，才跑真命令；
 *   5. 返回退出码、stdout/stderr 尾部与「这只是一次运行，不是结论」。
 *
 * 为什么落在工作区而不是临时目录：脚本要能被人复核与复跑，临时目录下一次就没了。
 */

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { findPrecedent, shippedPrecedentSlugs } from "../../domain/case/precedents";
import { planScaffold, readCaseText } from "../../domain/case/scaffold";
import { findTool, planRunTool, toolsOf } from "../../domain/case/run-tool";
import { createCommandRunner } from "../../features/workbench/services/toolchain";
import { ensureDir, writeFiles } from "../lib/write-files";

interface RunCaseToolInput {
	/** 先例 slug，例如 `android-ssl-pin-bypass`。 */
	slug?: string;
	/** 工具 id 或文件名，例如 `pin_surface` / `pin_surface.py`。 */
	tool?: string;
	/** 传给脚本的参数串，如 `--sample samples/app.apk`；留空只跑自检。 */
	args?: string;
	timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const OUTPUT_LIMIT = 6_000;

function tail(text: string): string {
	const trimmed = text.trim();
	return trimmed.length > OUTPUT_LIMIT ? `…（前 ${trimmed.length - OUTPUT_LIMIT} 字符已省略）\n${trimmed.slice(-OUTPUT_LIMIT)}` : trimmed;
}

export function registerRunCaseTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<RunCaseToolInput>({
		id: "run_case_tool",
		name: "run_case_tool",
		label: "%tool.runCaseTool.label%",
		description: [
			"Run one of a shipped precedent's Python tools, with its `--self-test` gate first.",
			"",
			"`scaffold_case` only copies `tools/*.py` into the project and prints the command lines; nothing executes them.",
			"This tool closes that loop: it scaffolds the package to `.hanshuang/cases/<slug>/`, runs `--self-test`,",
			"and only when that passes runs the real command with the arguments you supply.",
			"",
			"Pass `args` as a normal argument string (`--sample samples/app.apk`); quotes keep paths with spaces together.",
			"Omit `args` to run the self-test alone. Requires the declared `python` executable and `agent.command.run`.",
			"A green self-test means the tool works on synthetic bytes — it says nothing about the sample until you run it.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				slug: { type: "string", description: "Precedent slug, e.g. android-ssl-pin-bypass." },
				tool: { type: "string", description: "Tool id or file name, e.g. pin_surface or pin_surface.py." },
				args: { type: "string", description: "Arguments for the real run, e.g. `--sample samples/app.apk`." },
				timeoutMs: { type: "number", description: "Per-run timeout in ms (default 120000)." },
			},
			required: ["slug", "tool"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		timeoutMs: 300_000,
		handler: async context => {
			const input = context.trigger.input;
			const slug = (input.slug ?? "").trim();
			const query = (input.tool ?? "").trim();
			if (!slug || !query) return "run_case_tool needs both `slug` and `tool`. Call it with no arguments' sibling — `search_cases` — to see the slugs.";

			const precedent = findPrecedent(slug);
			if (!precedent) return `No shipped precedent is named "${slug}". Available: ${shippedPrecedentSlugs()}.`;

			const available = toolsOf(precedent);
			if (available.length === 0) return `Precedent "${slug}" ships no runnable tools — it is a reading package only.`;
			const tool = findTool(precedent, query);
			if (!tool) {
				return `Precedent "${slug}" has no tool matching "${query}". Available: ${available.map(item => `${item.id} (${item.entry})`).join(", ")}.`;
			}

			const runner = createCommandRunner(ctx);
			if (!runner) {
				return [
					"Cannot run: the host did not give this plugin `agent.command.run`, so no process was started.",
					"That is a permission question, not evidence about the tool — grant it in the plugin settings and retry.",
				].join("\n");
			}

			const cwd = context.session.cwd;
			if (!cwd) return "Cannot run: no working directory is available. Open a project first.";

			// 1) 落盘到工作区（已存在就保留用户改动）。
			const directory = `.hanshuang/cases/${precedent.slug}`;
			const plan = planScaffold(precedent, { into: directory });
			await ensureDir(context.host.fs, directory);
			// plan.files 带 source（包内路径），要先读出正文再写盘（与 scaffold_case 同一做法）。
			const requests: { path: string; content: string }[] = [];
			for (const file of plan.files) {
				try {
					requests.push({ path: file.path, content: await readCaseText(file.source) });
				} catch {
					/* 缺文件就让后续的自检报错，不在这里假装成功。 */
				}
			}
			const written = await writeFiles(context.host.fs, directory, requests, false);

			const entryPath = `${directory}/tools/${tool.entry}`;
			const runPlan = planRunTool(precedent, tool, entryPath, input.args);
			const timeoutMs = Math.min(Math.max(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, 5_000), 600_000);

			const header = [
				`# ${precedent.slug} · ${tool.id}`,
				"",
				`- purpose: ${tool.purpose}`,
				tool.expect ? `- expect: ${tool.expect}` : "",
				`- files: ${written.written.length} written, ${written.skipped.length} kept`,
				`- script: \`${entryPath}\``,
			].filter(Boolean);

			// 2) 自检先行：不过就停，绝不碰样本。
			const selfTest = await runner("python", runPlan.selfTest, { timeoutMs });
			if (selfTest.exitCode !== 0) {
				return [
					...header,
					"",
					"**self-test failed — the real run was skipped, nothing touched your sample.**",
					"",
					`exit code: ${selfTest.exitCode ?? "null"}`,
					"",
					"```",
					tail(selfTest.stdout) || "(no stdout)",
					tail(selfTest.stderr) ? `\n--- stderr ---\n${tail(selfTest.stderr)}` : "",
					"```",
					"",
					"A failing self-test means the tool itself is broken here (missing kit, python version, moved files),",
					"not that the sample is clean. Re-scaffold with `scaffold_case(precedent=…, overwrite=true)` before trusting any result.",
				].join("\n");
			}

			const lines = [...header, "", `- self-test: passed (exit 0)`];

			if (!runPlan.run) {
				lines.push(
					"",
					"Only the self-test ran: no `args` was supplied.",
					runPlan.usage.length > 0 ? `Usage declared by the manifest: \`${runPlan.usage.join(" ")}\`` : "",
					"Pass `args` to run it against a sample.",
				);
				return lines.join("\n");
			}

			// 3) 真跑。
			const result = await runner("python", runPlan.run, { timeoutMs });
			lines.push(
				"",
				`**run** \`python ${runPlan.run.join(" ")}\``,
				"",
				`exit code: ${result.exitCode ?? "null"}`,
				"",
				"```",
				tail(result.stdout) || "(no stdout)",
				tail(result.stderr) ? `\n--- stderr ---\n${tail(result.stderr)}` : "",
				"```",
				"",
				"这是工具的一次输出，不是结论：抽样审阅它给出的偏移/层/值，再决定下一步（补丁、Hook 或收尾）。",
			);
			return lines.join("\n");
		},
	});
}
