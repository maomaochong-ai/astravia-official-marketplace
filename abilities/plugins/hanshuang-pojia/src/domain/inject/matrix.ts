/**
 * 注入矩阵的批量构建：把「九个目标 × 安装/卸载 × shell」展开成一组文件名与内容。
 *
 * 与面板共用同一套生成器（`targets.ts` / `script.ts` / `removal.ts`），
 * 这里只做遍历与命名 —— 离线脚本入口（`scripts/inject-matrix.mjs`）与测试都读这一份，
 * 因此不存在“命令行生成的脚本”与“面板生成的脚本”两个版本。
 */

import { renderBatchRemoval, renderInstaller, renderRemovalScript, type Shell } from "./script";
import { INJECT_TARGETS, planFor, type InjectTarget } from "./targets";

export interface MatrixFile {
	target: string;
	kind: "install" | "remove" | "batch";
	shell: "powershell" | "posix";
	name: string;
	content: string;
}

export interface BuildMatrixInput {
	/** 注入正文（提示词包正文，不含 front matter）。 */
	body: string;
	/** 写进标记块标签的包名。 */
	packLabel: string;
	/** `powershell` / `posix` / `all`（默认 all）。 */
	shell?: string;
	/** 只生成一个目标。 */
	target?: string | null;
	/** `install` / `remove` / `both`（默认 both）。 */
	kind?: string;
}

/** 文件名：`<target>-<install|uninstall>.<ps1|sh>`；批量清除固定 `clear-all`。 */
function nameOf(target: string, kind: MatrixFile["kind"], shell: "powershell" | "posix"): string {
	const ext = shell === "powershell" ? "ps1" : "sh";
	if (kind === "batch") return `clear-all.${ext}`;
	return `${target}-${kind === "install" ? "install" : "uninstall"}.${ext}`;
}

function usable(target: InjectTarget): boolean {
	// 不可用目标不产出脚本：给了也一定失败，只会让人以为“插件坏了”。
	return target.form !== "unavailable";
}

export function buildMatrix(input: BuildMatrixInput): MatrixFile[] {
	const shells: ("powershell" | "posix")[] = input.shell === "posix" ? ["posix"] : input.shell === "powershell" ? ["powershell"] : ["powershell", "posix"];
	const kind = input.kind ?? "both";
	const targets = INJECT_TARGETS.filter(usable).filter(item => (input.target ? item.id === input.target : true));
	const files: MatrixFile[] = [];

	for (const shell of shells) {
		const plans = targets.map(item => planFor(item, { packLabel: input.packLabel, body: input.body }));
		if (kind !== "install") {
			files.push({ target: "all", kind: "batch", shell, name: nameOf("all", "batch", shell), content: renderBatchRemoval(plans, shell as Shell) });
		}
		for (const plan of plans) {
			if (kind !== "remove") {
				files.push({
					target: plan.target.id,
					kind: "install",
					shell,
					name: nameOf(plan.target.id, "install", shell),
					content: renderInstaller(plan, shell as Shell),
				});
			}
			if (kind !== "install") {
				files.push({
					target: plan.target.id,
					kind: "remove",
					shell,
					name: nameOf(plan.target.id, "remove", shell),
					content: renderRemovalScript(plan, shell as Shell),
				});
			}
		}
	}

	return files;
}
