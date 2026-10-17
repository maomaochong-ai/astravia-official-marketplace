/**
 * 命令失败归因：把宿主的异常消息与 CLI 的 stderr 归到最常见的一类原因上，
 * 让面板给出「下一步做什么」，而不是只留一段英文报错。
 *
 * 只做文本特征匹配，不探测网络或文件系统 —— 判定必须可解释、可复现。
 * 匹配顺序即优先级：先排除环境缺失，再谈网络、超时、权限、路径与参数。
 */

export type RunDiagnosisKind =
	| "npx"
	| "permission"
	| "network"
	| "timeout"
	| "path"
	| "cli"
	| "unknown";

export interface RunDiagnosis {
	readonly kind: RunDiagnosisKind;
	/** 对应 locales 里的 `tab.run.hint.<kind>`。 */
	readonly hintKey: string;
}

export interface RunDiagnosisInput {
	readonly message: string | null;
	readonly stderr: string;
	readonly stdout: string;
	readonly exitCode: number | null;
}

const RULES: ReadonlyArray<{ readonly kind: RunDiagnosisKind; readonly pattern: RegExp }> = [
	// 宿主在拉起进程前就失败：npx / npm 不在 PATH 上。
	{ kind: "npx", pattern: /spawn\s+(?:npx|npm)\s+enoent|['"`]?(?:npx|npm)['"`]?\s+is not recognized|command not found:\s*(?:npx|npm)/i },
	{ kind: "permission", pattern: /\beacces\b|\beperm\b|permission denied|operation not permitted/i },
	{ kind: "network", pattern: /\benotfound\b|\beconnrefused\b|\beconnreset\b|\beai_again\b|socket hang up|network error|fetch failed|proxy/i },
	{ kind: "timeout", pattern: /\betimedout\b|timed?\s?out|timeout/i },
	{ kind: "path", pattern: /no such file or directory|\benoent\b|cannot find|does not exist|not a directory|is a directory/i },
	// 上游 CLI 不认识参数：通常是插件命令目录落后于已安装的 CLI。
	{ kind: "cli", pattern: /unknown (?:command|option|argument)|invalid (?:option|argument)|unrecognized|usage:\s/i },
];

function hintKeyFor(kind: RunDiagnosisKind): string {
	return `tab.run.hint.${kind}`;
}

/**
 * 返回 null 表示「成功，或没有可归因的失败」。
 *
 * 先跑规则：像「spawn npx ENOENT」这类失败只有宿主给的 message，没有 stderr/stdout，
 * 但原因很明确，必须先归因。规则都不匹配、且进程根本没跑过（空目标这类本地校验），
 * 才返回 null —— 那边已经有自己的提示文案，不再叠一层猜测。
 */
export function diagnoseRun(input: RunDiagnosisInput): RunDiagnosis | null {
	const hasOutput = input.stderr.trim() !== "" || input.stdout.trim() !== "";
	const processFailed = input.exitCode !== null && input.exitCode !== 0;
	const haystack = [input.message ?? "", input.stderr, input.stdout].join("\n");

	for (const rule of RULES) {
		if (rule.pattern.test(haystack)) {
			return { kind: rule.kind, hintKey: hintKeyFor(rule.kind) };
		}
	}
	if (!processFailed && !hasOutput) return null;
	return { kind: "unknown", hintKey: hintKeyFor("unknown") };
}
