/**
 * Case workspace: one directory per target with a fixed layout, so samples, exports,
 * evidence and the write-up never pile up in the project root.
 *
 * There is deliberately no `patches/` directory (ADR 0002 D17). The layout only ever holds
 * evidence and write-ups. The declarations written here (`scope.md`, `timeline.md`) come from
 * ADR 0006 — they are what makes a case citable later, not another artefact directory.
 *
 * Both files are written once and then left alone: a second `init_task` fills in whatever is
 * missing and reports what was already there. Nothing in this module decides whether the case
 * "may proceed" — the declaration is a record, not a lock.
 */
import {
	CASE_DIRECTORY_NAMES,
	CASE_DOCUMENTS,
	evidenceMarkdown,
	resolvePreset,
	scopeMarkdown,
	safeTaskName,
	assertCaseName,
	timelineHeader,
	type CaseBrief,
} from "../case/contract";
import { joinPath } from "./paths";

export { MAX_NAME_CHARS, safeTaskName } from "../case/contract";

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
	/** Pre-work declaration; omitted means an offline sample case with nothing in scope yet. */
	brief?: CaseBrief;
}

export interface WorkspaceResult {
	directory: string;
	created: string[];
	readmePath: string;
	reportPath?: string;
	scopePath: string;
	/** True when a README already existed and was left untouched. */
	keptExistingReadme: boolean;
	/** True when `scope.md` already existed and was left untouched. */
	keptExistingScope: boolean;
}

/** Legacy calls (name + description only) still land in a real, indexable case. */
function defaultBrief(name: string, description: string): CaseBrief {
	const preset = resolvePreset(undefined);
	return {
		name,
		description,
		preset,
		authStatus: "pending",
		inScope: [],
		outOfScope: [],
		networkProfile: preset.networkProfile,
		deliverables: [...preset.deliverables],
		constraints: [...preset.constraints],
		at: new Date().toISOString(),
	};
}

function readmeFor(brief: CaseBrief): string {
	return [
		`# Case workspace: ${brief.name}`,
		"",
		`- Scope: ${brief.description?.trim() || "(write down the asset you are examining)"}`,
		`- Declaration: \`${CASE_DOCUMENTS.scope}\` (asset, in/out of scope, network profile, deliverables)`,
		"- Created by the hanshuang-pojia plugin. Keep every artefact inside this directory.",
		"",
		"## Layout",
		"",
		"- `samples/` — the original files under examination. Copies only; never edit in place.",
		"- `exports/` — decompiled sources, disassembly dumps, string dumps and analysis evidence.",
		"- `reports/` — findings and the final write-up.",
		"- `evidence/` — one `E-###-<slug>.md` per observation; see its README for the numbering contract.",
		"- `notes/` — working notes for this case.",
		"",
		"## Ground rules",
		"",
		"- Keep originals untouched under `samples/`; every patched or rebuilt artefact goes to `exports/` with the",
		"  command that produced it.",
		"- Record the command or plugin tool that produced each artefact, so the finding can be reproduced.",
		"- Quote hashes for every sample you keep: `shasum -a 256 <file>`.",
		"- `timeline.md` is append-only and `scope.md` is written once: a changed scope is a new case.",
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

/** Existing declarations are never rewritten — a case records a point in time. */
async function writeOnce(fs: WorkspaceFs, path: string, content: string): Promise<boolean> {
	if (await fs.stat(path)) return false;
	await fs.writeFile(path, content);
	return true;
}

export async function initTaskWorkspace(fs: WorkspaceFs, request: WorkspaceRequest): Promise<WorkspaceResult> {
	assertCaseName(request.name);
	const name = safeTaskName(request.name);
	if (!name) throw new Error("task name is empty after sanitising; use letters, digits, dashes or underscores");

	const directory = joinPath(request.root, name);
	const created: string[] = [directory];
	await fs.createDirectory(directory);
	for (const child of CASE_DIRECTORY_NAMES) {
		await fs.createDirectory(joinPath(directory, child));
		created.push(joinPath(directory, child));
	}

	const description = (request.description ?? "").trim();
	const brief: CaseBrief = request.brief ?? defaultBrief(name, description);

	const scopePath = joinPath(directory, CASE_DOCUMENTS.scope);
	const readmePath = joinPath(directory, CASE_DOCUMENTS.readme);
	const readmeWritten = await writeOnce(fs, readmePath, readmeFor(brief));
	const scopeWritten = await writeOnce(fs, scopePath, scopeMarkdown(brief));
	await writeOnce(fs, joinPath(directory, CASE_DOCUMENTS.timeline), timelineHeader(name, brief.at, brief));
	await writeOnce(fs, joinPath(directory, CASE_DOCUMENTS.evidence), evidenceMarkdown(name));

	let reportPath: string | undefined;
	if (request.report) {
		reportPath = joinPath(joinPath(directory, "reports"), "security-report.md");
		await writeOnce(fs, reportPath, reportFor(name, description || brief.description || ""));
	}

	return {
		directory,
		created,
		readmePath,
		reportPath,
		scopePath,
		keptExistingReadme: !readmeWritten,
		keptExistingScope: !scopeWritten,
	};
}

export function renderWorkspace(result: WorkspaceResult): string {
	const lines = [
		`Workspace ready: ${result.directory}`,
		"",
		...CASE_DIRECTORY_NAMES.map(child => `  ${joinPath(result.directory, child)}/`),
		`  ${result.scopePath}`,
		result.reportPath ? `  ${result.reportPath}` : "",
		"",
		result.keptExistingReadme
			? `README.md already existed and was left untouched: ${result.readmePath}`
			: `Wrote ${result.readmePath}`,
		result.keptExistingScope
			? "scope.md already existed and was left untouched: a changed scope is a new case."
			: "Wrote scope.md and timeline.md; timeline.md is append-only from here on.",
		"Put copies of the samples in samples/, dump evidence into exports/, and write the findings in reports/.",
		"Record each observation as evidence/E-###-<slug>.md, and every decision as a note under .agents/notes/.",
	].filter(line => line.length > 0);
	return lines.join("\n");
}
