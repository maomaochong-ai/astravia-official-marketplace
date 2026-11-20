import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { PACKS } from "../../domain/inject/packs";
import { renderInstaller, renderRestoreScript, type Shell } from "../../domain/inject/script";
import { entryFromPlan } from "../../domain/inject/state";
import { applyCommand, chooseRoute, handoffCommands, readEvidence, scriptPathFor, type ApplyEnv } from "../../domain/inject/apply";
import { ensureDir } from "../lib/write-files";
import { createCommandRunner } from "../../features/workbench/services/toolchain";
import { INJECT_TARGETS, planFor, targetById, type InjectPlan } from "../../domain/inject/targets";
import { loadPackBody } from "../../features/workbench/services/packs";

interface InjectTargetInput {
	/** 目标 id；留空只列矩阵，不生成脚本。 */
	target?: string;
	/** 提示词包 id；留空用执行内核。 */
	pack?: string;
	shell?: Shell;
	/** R1：写进工作区并走命令通道执行。 */
	apply?: boolean;
	/** R3：交给保存对话框。优先于 apply。 */
	save?: boolean;
	statePath?: string;
}

function planMarkdown(plan: InjectPlan): string {
	const lines: string[] = [];
	lines.push(`## ${plan.target.label} · ${plan.form} · 层级 ${plan.layer}`);
	lines.push("");
	lines.push("| 写入点 | 方式 | 说明 |");
	lines.push("| --- | --- | --- |");
	for (const write of plan.writes) lines.push(`| \`${write.path}\` | ${write.kind} | ${write.detail} |`);
	lines.push("");
	lines.push("**步骤**");
	lines.push("");
	for (const [index, step] of plan.steps.entries()) lines.push(`${index + 1}. ${step}`);
	lines.push("");
	lines.push("**还原**");
	lines.push("");
	for (const step of plan.restore) lines.push(`- ${step}`);
	if (plan.warnings.length > 0) {
		lines.push("");
		lines.push("**做不到的部分**");
		lines.push("");
		for (const warning of plan.warnings) lines.push(`- ${warning}`);
	}
	return lines.join("\n");
}

function matrixMarkdown(): string {
	const lines: string[] = [];
	lines.push("## 注入目标矩阵");
	lines.push("");
	lines.push("| id | 目标 | 形态 | 层级 | 写入点 | 说明 |");
	lines.push("| --- | --- | --- | --- | --- | --- |");
	for (const target of INJECT_TARGETS) {
		const plan = planFor(target, { packLabel: "matrix", body: "" });
		lines.push(
			`| \`${target.id}\` | ${target.label} | ${target.form} | ${plan.layer} | \`${target.entry}\` | ${target.note ?? "—"} |`,
		);
	}
	lines.push("");
	lines.push("**提示词包**");
	lines.push("");
	for (const pack of PACKS) lines.push(`- \`${pack.id}\` · ${pack.title} · ${pack.mode} · ${pack.chars} 字符`);
	return lines.join("\n");
}

/** 探测结果缓存：一次会话里反复问「能不能执行」不必每次开进程。 */
let envCache: { key: string; env: ApplyEnv } | null = null;

async function detectEnv(ctx: PluginContext, shell: Shell): Promise<ApplyEnv> {
	const key = `${shell}`;
	const runner = createCommandRunner(ctx);
	const commandChannel = runner !== null;
	if (!runner) return { commandChannel, shellReady: false };
	if (envCache && envCache.key === key) return envCache.env;

	// 用一个不依赖脚本文件的极短命令确认解释器真的能跑：
	// `-File` 能跑但 `-Command` 不能的情况存在（ExecutionPolicy / profile 错误），所以两者都要。
	try {
		if (shell === "posix") {
			const probe = await runner("sh", ["-c", "echo ok"], { timeoutMs: 5_000 });
			const env: ApplyEnv = { commandChannel, shellReady: probe.exitCode === 0, shellExe: "sh" };
			envCache = { key, env };
			return env;
		}
		// pwsh 优先，退回 Windows PowerShell 5.1：两条都在 plugin.json#commands 里声明。
		for (const exe of ["pwsh", "powershell"] as const) {
			try {
				const probe = await runner(exe, ["-NoProfile", "-Command", "exit 0"], { timeoutMs: 8_000 });
				if (probe.exitCode === 0) {
					const env: ApplyEnv = { commandChannel, shellReady: true, shellExe: exe };
					envCache = { key, env };
					return env;
				}
			} catch {
				// 换下一个；两个都不行时下面的统一返回会被调用。
			}
		}
	} catch {
		// 走到这里说明连探测都没发起。
	}
	const env: ApplyEnv = { commandChannel, shellReady: false };
	envCache = { key, env };
	return env;
}

function routeNote(route: "command" | "agent" | "save", env: ApplyEnv, shell: Shell): string {
	if (route === "save") return "路由 save：把脚本交给保存对话框，你自己审完再跑。";
	if (route === "command") {
		return `路由 command：命令通道与 \`${shell === "posix" ? "sh" : "pwsh"}\` 都可用，传 apply: true 即由插件执行。`;
	}
	const missing = [
		env.commandChannel ? null : "`agent.command.run` 未授予（权限页或 plugin.json#commands）",
		env.shellReady ? null : `\`${shell === "posix" ? "sh" : "pwsh"}\` 未声明、被用户禁用或在 PATH 上找不到`,
	].filter(Boolean);
	return `路由 agent：${missing.join("；")}。把下面的命令交给对话里的 Agent，它能读写主目录并回读校验。`;
}

/**
 * `inject_target` —— 注入流水线的入口：计划 + 脚本 + 按可用性选择执行路由。
 *
 * 插件写不了 `$HOME`，但宿主给了两条能真执行的路：命令通道（插件跑，用户授权一次）
 * 与对话 Agent（Agent 用自己的工具跑，能回读校验）。所以本工具**不再停在「给你一份脚本」**：
 * `apply: true` 时把脚本写进工作区并走 `pwsh -File` 真执行，返回 stdout 证据；
 * 命令通道不可用时降级为逐条命令行交给 Agent，并把缺什么说清楚。
 */
export function registerInjectTargetTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<InjectTargetInput>({
		id: "inject_target",
		name: "inject_target",
		label: "%tool.injectTarget.label%",
		description: [
			"Build an injection plan for a third-party AI host (Codex, Claude, OpenCode, Cursor, ZCode, DSH,",
			"WorkBuddy, Doubao) from one of the bundled prompt packs, and render the installer script for it.",
			"",
			"Upstream this came from is a desktop app with nine installer scripts that write into `$HOME`. This tool",
			"closes the same loop without needing that permission: it plans, renders the script, and — when",
			"`agent.command.run` is granted and `pwsh` is allowed — actually runs it through the host command",
			"channel, returning the backup path and the post-write marker check from stdout.",
			"",
			"Pass `apply: true` to execute (R1). Without the command channel it falls back to handing the",
			"caller the exact command lines to run in the conversation (R2), and `save: true` hands the script",
			"to the native save dialog (R3). All three routes use the same script.",
			"",
			"Never claim an install succeeded on the script alone: success is the `done:` line plus the state file.",
			"Call with no arguments to list the target matrix and the available prompt packs.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				target: {
					type: "string",
					enum: INJECT_TARGETS.map(target => target.id),
					description: "Target id. Omit to list the matrix.",
				},
				pack: {
					type: "string",
					enum: PACKS.map(pack => pack.id),
					description: "Prompt pack id whose body is injected. Defaults to execution-kernel.",
				},
				shell: {
					type: "string",
					enum: ["powershell", "posix"],
					description: "Script flavour. Defaults to powershell (the upstream installer target).",
				},
				apply: {
					type: "boolean",
					description:
						"Execute the script through the host command channel (R1). Requires agent.command.run plus a declared `pwsh`. Falls back to handing over command lines (R2) when either is missing.",
				},
				save: {
					type: "boolean",
					description: "Hand the rendered script to the native save dialog (R3). Wins over apply.",
				},
				statePath: {
					type: "string",
					description: "Where the script records install-state.json. Defaults to workbench/inject-state.json.",
				},
			},
			required: [],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 60_000,
		handler: async context => {
			try {
				const input = context.trigger.input;
				const targetInput = input.target?.trim();
				if (!targetInput) return matrixMarkdown();

				const target = targetById(targetInput);
				if (!target) return `Unknown target \`${targetInput}\`. Known ids: ${INJECT_TARGETS.map(item => item.id).join(", ")}.`;

				const packId = input.pack?.trim() || PACKS[0]?.id || "";
				const body = await loadPackBody(packId);
				const plan = planFor(target, { packLabel: packId, body, statePath: input.statePath });
				const shell: Shell = input.shell === "posix" ? "posix" : "powershell";
				const script = renderInstaller(plan, shell);
				const restore = renderRestoreScript(plan, shell);

				const header = [
					`# 注入计划 · ${target.label}`,
					"",
					`插件不写主目录、也不假装装了：下面是计划与同一份脚本，执行路径见D2的三条路由。`,
					"",
					planMarkdown(plan),
					"",
					"**清单记录**",
					"",
					"```json",
					JSON.stringify(entryFromPlan({
						target: target.id,
						form: plan.form,
						files: plan.writes.filter(write => write.kind !== "key").map(write => write.path),
						markerBlock: target.form === "marker-block",
						packLabel: packId,
					}), null, 2),
					"```",
					"",
					`**安装脚本（${shell}）**`,
					"",
					"```" + (shell === "powershell" ? "powershell" : "bash"),
					script,
					"```",
					"",
					`**还原脚本（${shell}）**`,
					"",
					"```" + (shell === "powershell" ? "powershell" : "bash"),
					restore,
					"```",
				].join("\n");
				if (input.save) {
					const saved = await context.host.fs.saveAs(
						`inject-${target.id}.${shell === "powershell" ? "ps1" : "sh"}`,
						script,
						"utf8",
						{ title: `Save ${target.label} injector script`, filters: [{ name: "Script", extensions: [shell === "powershell" ? "ps1" : "sh"] }] },
					);
					if (!saved) return `${header}\n\n---\n\nScript not saved — the dialog was cancelled. Nothing was written.`;
					return `${header}\n\n---\n\nScript saved to \`${saved}\`. Run it yourself; this tool does not execute it.`;
				}

				if (!input.apply) {
					const env = await detectEnv(ctx, shell);
					const route = chooseRoute(env);
					return `${header}\n\n---\n\n**下一步（路由 ${route}）**\n\n${routeNote(route, env, shell)}`;
				}

				// R1：写进工作区（fs.write 允许），再走命令通道执行。
				const env = await detectEnv(ctx, shell);
				const route = chooseRoute(env);
				const scriptPath = scriptPathFor(target.id, shell);
				if (route !== "command") {
					const command = applyCommand(shell, scriptPath, env.shellExe);
					return [
						header,
						"",
						"---",
						"",
						`**未执行（降级为路由 agent）**\n\n${routeNote(route, env, shell)}`,
						"",
						"**逐条命令（交给对话里的 Agent）**",
						"",
						"```",
						...handoffCommands(plan, command, scriptPath),
						"```",
					].join("\n");
				}

				await ensureDir(context.host.fs, scriptPath.slice(0, scriptPath.lastIndexOf("/")));
				await context.host.fs.writeFile(scriptPath, script);
				const command = applyCommand(shell, scriptPath, env.shellExe);
				const runner = createCommandRunner(ctx);
				if (!runner) return `${header}\n\n---\n\nCommand channel unavailable after all — nothing was executed.`;

				const result = await runner(command.file, command.args, { timeoutMs: 90_000 });
				const evidence = readEvidence(result.stdout);
				const ok = result.exitCode === 0 && evidence.markerVerified;
				const lines = [
					header,
					"",
					"---",
					"",
					`**执行结果（路由 command）** · \`${command.display}\``,
					"",
					`- exit code: ${result.exitCode ?? "null"}`,
					`- 备份: ${evidence.backup ?? "（脚本没打出 backup 行）"}`,
					`- 标记回读: ${evidence.markerVerified ? "通过（脚本打出了 done）" : "**未通过**"}`,
					`- 清单: ${evidence.state ?? "（脚本没打出 state 行）"}`,
					"",
					ok ? "安装完成。还原用同一目录下的还原脚本，或按计划里的还原步骤。" : "**不要当成装好了**：exit code 或标记回读没通过，看下面输出。",
					"",
					"```",
					result.stdout.trim() || "(no stdout)",
					result.stderr.trim() ? `\n--- stderr ---\n${result.stderr.trim()}` : "",
					"```",
				];
				return lines.join("\n");
			} catch (error) {
				return `inject_target failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}
