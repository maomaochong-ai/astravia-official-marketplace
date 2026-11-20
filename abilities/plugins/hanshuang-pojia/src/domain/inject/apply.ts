/**
 * 执行层：把一份注入计划交出去执行的三条路由。
 *
 * 插件自己没有写 `$HOME` 的权限，但宿主给了两条更容易的路：命令通道（插件跑）
 * 与对话 Agent（Agent 用它自己的工具跑）。差别只在「谁按下回车」，**脚本是同一份** ——
 * 所以这里只做路由决策与命令行拼装，不复制任何脚本逻辑。
 *
 * 降级顺序写死在 `chooseRoute` 里：能自己跑就别麻烦用户，跑不了就把话说清楚，
 * 而不是悄悄退化成「已生成，请你自行处理」。
 */

import type { InjectPlan } from "./targets";

export type ApplyRoute = "command" | "agent" | "save";

/** 插件侧观测到的执行条件。两个字段都来自真实探测，不来自猜测。 */
export interface ApplyEnv {
	/** `agent.command.run` 已授予且 ctx.command.run 可用。 */
	commandChannel: boolean;
	/** 宿主放行 `pwsh`（或 posix 下的 `sh`）且它在 PATH 上。 */
	shellReady: boolean;
	/** Windows 上 pwsh 与 powershell 可能只装了一个：记下真正跑通的那个。 */
	shellExe?: "pwsh" | "powershell" | "sh";
}

export interface ApplyCommand {
	/** 可执行文件。 */
	file: string;
	/** 参数数组：不拼成一行字符串，避免空格与引号把参数切错。 */
	args: string[];
	/** 人读的一行命令，用于展示与 R2 交接。 */
	display: string;
}

/**
 * 选择路由。
 *
 * - 通道与 shell 都在 → `command`：插件自己跑，用户只在授权弹窗上点一次；
 * - 否则 → `agent`：对话里的 Agent 有 shell 工具，能读写 `$HOME`；
 * - `save` 不是自动降级结果，而是用户显式要手工审时选的（由调用方传 `preferSave`）。
 */
export function chooseRoute(env: ApplyEnv, preferSave = false): ApplyRoute {
	if (preferSave) return "save";
	if (env.commandChannel && env.shellReady) return "command";
	return "agent";
}

/** 脚本在工作区里的落盘路径：固定子目录，便于用户自己复核与清理。 */
export function scriptPathFor(target: string, shell: "powershell" | "posix"): string {
	const name = shell === "powershell" ? `${target}.ps1` : `${target}.sh`;
	return `.hanshuang/inject/${name}`;
}

/**
 * 拼执行命令行。
 *
 * PowerShell 用 `-NoProfile -ExecutionPolicy Bypass -File`：前者避免用户 profile 里的
 * 别名/函数改写脚本行为，后者因为默认策略在部分机器上禁止运行本地脚本。
 * posix 直接 `sh <file>`，不依赖可执行位。
 */
export function applyCommand(shell: "powershell" | "posix", scriptPath: string, exe: "pwsh" | "powershell" | "sh" = "pwsh"): ApplyCommand {
	if (shell === "posix") {
		return { file: "sh", args: [scriptPath], display: `sh ${scriptPath}` };
	}
	// powershell.exe（5.1）没有 `-ExecutionPolicy` 之外的差异；同一份脚本两者都能跑。
	const bin = exe === "powershell" ? "powershell" : "pwsh";
	const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath];
	return { file: bin, args, display: `${bin} ${args.join(" ")}` };
}

/** R1 成功后的判据：脚本自己会打印这三样，缺一样就不该说「装好了」。 */
export interface ApplyEvidence {
	backup: string | null;
	state: string | null;
	markerVerified: boolean;
}

/**
 * 从 stdout 里取证据。
 *
 * 不假设脚本输出格式自由漂浮：`renderInstaller` 打印的三种行是固定前缀，
 * 这里按前缀取。取不到就返回 null，让调用方说「没证据」，而不是编一个。
 */
export function readEvidence(stdout: string): ApplyEvidence {
	const lines = stdout.split(/\r?\n/);
	const backup = lines.find(line => line.trim().startsWith("backup ->"))?.split("->")[1]?.trim() ?? null;
	const state = lines.find(line => /install-state\.json/i.test(line))?.trim() ?? null;
	const markerVerified = lines.some(line => /^done:/.test(line.trim()));
	return { backup, state, markerVerified };
}

/** 给 Agent 交接用的逐条命令行：R2 的执行者是它，所以每条都要能直接粘贴。 */
export function handoffCommands(plan: InjectPlan, command: ApplyCommand, scriptPath: string): string[] {
	const lines: string[] = [];
	lines.push(`# 1) 写入脚本（本插件已写入工作区 ${scriptPath}；如无，把计划里的脚本存成同名文件）`);
	lines.push(`# 2) 执行`);
	lines.push(command.display);
	for (const write of plan.writes) {
		lines.push(`# 3) 回读确认：${write.path}`);
	}
	lines.push(`# 4) 检查 ${plan.statePath} 是否记录了本次安装`);
	return lines;
}
