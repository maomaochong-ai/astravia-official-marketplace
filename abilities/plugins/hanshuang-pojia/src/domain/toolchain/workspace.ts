/**
 * Case workspace: one directory per target with a fixed layout, so samples,
 * exports and reports never pile up in the project root.
 *
 * There is deliberately no `patches/` directory. Keeping a place for patched
 * binaries invites treating "produce a cracked build" as the deliverable; the
 * layout only ever holds evidence and write-ups.
 */
import { joinPath } from "./paths";
export interface WorkspaceFs {
	createDirectory(path: string): Promise<void>;
	writeFile(path: string, content: string): Promise<void>;
	stat(path: string): Promise<unknown | null>;
}

export interface WorkspaceRequest {
	/** Project root the workspace is created inside. */
	root: string;
	name: string;
	description?: string;
	/** Also write `reports/security-report.md` from the fixed template. */
	report?: boolean;
}

export interface WorkspaceResult {
	directory: string;
	created: string[];
	readmePath: string;
	reportPath?: string;
	/** True when a README already existed and was left untouched. */
	keptExistingReadme: boolean;
}

export const WORKSPACE_DIRS = ["samples", "exports", "reports"] as const;
export const MAX_NAME_CHARS = 64;

/**
 * 字母（含中文等非 ASCII 文字）、数字与 `_`/`-` 之外的一切都换成 `_`，所以分隔符本身也被
 * 移除；任务名永远跑不出工作区根目录，同时允许中文案件名。
 */
export function safeTaskName(name: string): string {
	const trimmed = name.trim().slice(0, MAX_NAME_CHARS);
	const cleaned = trimmed.replace(/[^\p{L}\p{N}_-]/gu, "_").replace(/^_+|_+$/g, "");
	return cleaned.replace(/^[.-]+/, "");
}

function readmeFor(name: string, description: string): string {
	return [
		`# Case workspace: ${name}`,
		"",
		`- Scope: ${description || "(write down what you are authorised to examine)"}`,
		"- Created by the hanshuang-pojia plugin. Keep every artefact inside this directory.",
		"",
		"## Layout",
		"",
		"- `samples/` — the original files under examination. Copies only; never edit in place.",
		"- `exports/` — decompiled sources, disassembly dumps, string dumps and analysis evidence.",
		"- `reports/` — findings and the final write-up.",
		"",
		"## Ground rules",
		"",
		"- Analysis is read-only. This plugin runs no byte patch and generates no keygen.",
		"- Record the command or plugin tool that produced each artefact, so the finding can be reproduced.",
		"- Quote hashes for every sample you keep: `shasum -a 256 <file>`.",
		"",
	].join("\n");
}

function reportFor(name: string, description: string): string {
	return [
		`# Security assessment — ${name}`,
		"",
		`Scope: ${description || "TODO"}`,
		"",
		"## 1. Target",
		"",
		"- Files and hashes:",
		"- Format / architecture:",
		"- Build identifiers:",
		"",
		"## 2. Environment",
		"",
		"- Toolchain used (from `probe_environment`):",
		"- Analysis date:",
		"",
		"## 3. Findings",
		"",
		"Repeat this block per finding, highest severity first.",
		"",
		"### F1 — <title>",
		"",
		"- Severity:",
		"- Location: `symbol @ address`",
		"- Evidence: `exports/...` (command that produced it)",
		"- Impact:",
		"- Recommendation:",
		"",
		"## 4. Coverage and gaps",
		"",
		"- What was analysed, what was skipped and why:",
		"- Analysis that was inconclusive:",
		"",
		"## 5. Conclusion",
		"",
		"- Overall risk:",
		"- Next steps:",
		"",
	].join("\n");
}

export async function initTaskWorkspace(fs: WorkspaceFs, request: WorkspaceRequest): Promise<WorkspaceResult> {
	const name = safeTaskName(request.name);
	if (!name) throw new Error("task name is empty after sanitising; use letters, digits, dashes or underscores");

	const directory = joinPath(request.root, name);
	const created: string[] = [directory];
	await fs.createDirectory(directory);
	for (const child of WORKSPACE_DIRS) {
		await fs.createDirectory(joinPath(directory, child));
		created.push(joinPath(directory, child));
	}

	const description = (request.description ?? "").trim();
	const readmePath = joinPath(directory, "README.md");
	const existing = await fs.stat(readmePath);
	if (!existing) await fs.writeFile(readmePath, readmeFor(name, description));

	let reportPath: string | undefined;
	if (request.report) {
		reportPath = joinPath(joinPath(directory, "reports"), "security-report.md");
		const reportExists = await fs.stat(reportPath);
		if (!reportExists) await fs.writeFile(reportPath, reportFor(name, description));
	}

	return { directory, created, readmePath, reportPath, keptExistingReadme: existing !== null };
}

export function renderWorkspace(result: WorkspaceResult): string {
	const lines = [
		`Workspace ready: ${result.directory}`,
		"",
		...WORKSPACE_DIRS.map(child => `  ${joinPath(result.directory, child)}/`),
		result.reportPath ? `  ${result.reportPath}` : "",
		"",
		result.keptExistingReadme
			? `README.md already existed and was left untouched: ${result.readmePath}`
			: `Wrote ${result.readmePath}`,
		"Put copies of the samples in samples/, dump evidence into exports/, and write the findings in reports/.",
	].filter(line => line.length > 0);
	return lines.join("\n");
}
