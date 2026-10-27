/**
 * Case workspace: one directory per target with a fixed layout, so samples, exports,
 * evidence and the write-up never pile up in the project root.
 *
 * There is deliberately no `patches/` directory (ADR 0002 D17). Keeping a place for patched
 * binaries invites treating "produce a cracked build" as the deliverable; the layout only
 * ever holds evidence and write-ups. The declarations written here (`scope.md`,
 * `timeline.md`, `workitems.md`) come from ADR 0006 — they are what makes a case citable
 * later, not another artefact directory.
 */
import {
	CASE_DIRECTORY_NAMES,
	CASE_DOCUMENTS,
	authLogHeader,
	AUTHORISED_STATUSES,
	authRecordMarkdown,
	assessReadiness,
	evidenceMarkdown,
	readinessLine,
	resolvePreset,
	scopeMarkdown,
	safeTaskName,
	assertCaseName,
	timelineHeader,
	timelineEntry,
	workItemsMarkdown,
	type CaseBrief,
	type Readiness,
} from "../case/contract";
import { effectiveAuthStatus, parseAuthLog, parseScope } from "../case/library";
import { joinPath } from "./paths";

export { MAX_NAME_CHARS, safeTaskName } from "../case/contract";

export interface WorkspaceFs {
	createDirectory(path: string): Promise<void>;
	writeFile(path: string, content: string): Promise<void>;
	stat(path: string): Promise<unknown | null>;
	/** Only used to report the gate that is actually on disk, and to append to the log. */
	readFile(path: string): Promise<{ content: string } | null>;
}

export interface WorkspaceRequest {
	/** Project root the workspace is created inside. */
	root: string;
	name: string;
	description?: string;
	/** Also write `reports/security-report.md` from the fixed template. */
	report?: boolean;
	/** Pre-work declaration; omitted means an authorisation-pending offline sample case. */
	brief?: CaseBrief;
}

export interface WorkspaceResult {
	directory: string;
	created: string[];
	readmePath: string;
	reportPath?: string;
	scopePath: string;
	readiness: Readiness;
	/** True when a README already existed and was left untouched. */
	keptExistingReadme: boolean;
	/** Appended when authorisation arrived after `scope.md` was written (ADR 0009). */
	authRecorded: boolean;
	authLogPath: string;
	/**
	 * Set when the amendment was deliberately not written: the log exists but could not be read
	 * (rewriting it would destroy earlier records), or a stale `pending` tried to re-close a
	 * granted case. Rendered verbatim so the caller learns why nothing changed.
	 */
	authNote?: string;
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
		`- Scope: ${brief.description?.trim() || "(write down what you are authorised to examine)"}`,
		`- Declaration: \`${CASE_DOCUMENTS.scope}\` (authorisation, in/out of scope, network profile, deliverables)`,
		`- Gate: ${readinessLine(assessReadiness(brief))}`,
		`- Authorisation log: \`${CASE_DOCUMENTS.authLog}\` (append-only; authorisation that arrived after the scope was written)`,
		"- Created by the hanshuang-pojia plugin. Keep every artefact inside this directory.",
		"",
		"## Layout",
		"",
		"- `samples/` — the original files under examination. Copies only; never edit in place.",
		"- `exports/` — decompiled sources, disassembly dumps, string dumps and analysis evidence.",
		"- `report/` — findings and the final write-up.",
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
		"- Authorisation that arrived later is appended to `auth-log.md`, never to `scope.md`.",
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

/** Existing declarations are never rewritten — the gate records a point in time. */
async function writeOnce(fs: WorkspaceFs, path: string, content: string): Promise<boolean> {
	if (await fs.stat(path)) return false;
	await fs.writeFile(path, content);
	return true;
}

/** `readExact` 的哨兵值：文件在、但读不出来。写作前必须和「文件不存在」分开。 */
const UNREADABLE = Symbol("unreadable");

/**
 * 区分三态：不存在（null）、读得到（文本）、读不到（`UNREADABLE`）。
 * `stat` 先确认存在，再读；存在却读不出来就是异常，不能当成空文件。
 */
async function readExact(fs: WorkspaceFs, path: string): Promise<string | null | typeof UNREADABLE> {
	if (!(await fs.stat(path))) return null;
	try {
		const result = await fs.readFile(path);
		return result?.content ?? UNREADABLE;
	} catch {
		return UNREADABLE;
	}
}

/** A missing file and a host that refuses to read it are the same thing here: nothing on disk. */
async function readText(fs: WorkspaceFs, path: string): Promise<string | null> {
	try {
		return (await fs.readFile(path))?.content ?? null;
	} catch {
		return null;
	}
}

function appendBlock(existing: string, block: string): string {
	const trimmed = existing.replace(/\s*$/, "");
	return trimmed.length > 0 ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

/**
 * Authorisation arriving after the fact. The scope is still a snapshot, so the only thing that
 * grows is the log — and the gate we report is the one that is now on disk, not the one the
 * caller asked for (ADR 0009).
 */
async function recordAuthAmendment(
	fs: WorkspaceFs,
	directory: string,
	brief: CaseBrief,
): Promise<{ recorded: boolean; readiness: Readiness; note?: string }> {
	const scopeText = (await readText(fs, joinPath(directory, CASE_DOCUMENTS.scope))) ?? "";
	const parsed = parseScope(scopeText);
	const logPath = joinPath(directory, CASE_DOCUMENTS.authLog);
	// `readText` 把「文件不存在」和「读不动」归成 null；写入时两者后果完全不同：
	// 前者该新建，后者会拿一个空 header 盖掉已有记录，与 append-only 相反。这里分开判定。
	const existingLog = await readExact(fs, logPath);
	if (existingLog === UNREADABLE) {
		return {
			recorded: false,
			readiness: assessReadiness({ inScope: parsed.inScope, networkProfile: parsed.networkProfile ?? "", sample: parsed.sample, authStatus: effectiveAuthStatus(parsed.authStatus, {}) }),
			note: `${logPath} exists but could not be read; refusing to rewrite it. Fix the file (or its permissions) and call again.`,
		};
	}
	const logText = existingLog ?? "";
	const recorded = parseAuthLog(logText);

	const facts = {
		inScope: parsed.inScope,
		networkProfile: parsed.networkProfile ?? "",
		sample: parsed.sample,
	};
	const persistedStatus = effectiveAuthStatus(parsed.authStatus, recorded);
	if (!brief.authStatus || brief.authStatus === persistedStatus) {
		return { recorded: false, readiness: assessReadiness({ ...facts, authStatus: persistedStatus }) };
	}
	// 日志是「后来的盖过先前的」，所以一次陈旧入参不能替人撑销授权：
	// 已 granted 的案例收到 pending/unknown，视作调用方没带最新事实，而不是撒销事件。
	if (AUTHORISED_STATUSES.includes(persistedStatus) && !AUTHORISED_STATUSES.includes(brief.authStatus) && brief.authStatus !== "denied") {
		return {
			recorded: false,
			readiness: assessReadiness({ ...facts, authStatus: persistedStatus }),
			note: `${logPath} already records granted, so auth_status=${brief.authStatus} changed nothing. Record \`denied\` to withdraw authorisation.`,
		};
	}

	const header = logText.trim().length > 0 ? logText : authLogHeader(brief.name);
	await fs.writeFile(logPath, appendBlock(header, authRecordMarkdown(brief.at, brief)));

	const timelinePath = joinPath(directory, CASE_DOCUMENTS.timeline);
	const timeline = await readText(fs, timelinePath);
	if (timeline !== null) {
		const basis = brief.authBasis?.trim();
		const text = `authorisation recorded as ${brief.authStatus}${basis ? ` (${basis})` : ""}`;
		await fs.writeFile(timelinePath, appendBlock(timeline, timelineEntry(brief.at, text, "auth")));
	}

	return { recorded: true, readiness: assessReadiness({ ...facts, authStatus: brief.authStatus }) };
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
	const readmePath = joinPath(directory, "README.md");
	const readmeWritten = await writeOnce(fs, readmePath, readmeFor(brief));
	const scopeWritten = await writeOnce(fs, scopePath, scopeMarkdown(brief));
	await writeOnce(fs, joinPath(directory, CASE_DOCUMENTS.timeline), timelineHeader(name, brief.at, brief));
	await writeOnce(fs, joinPath(directory, CASE_DOCUMENTS.workItems), workItemsMarkdown(name, brief));
	await writeOnce(fs, joinPath(directory, CASE_DOCUMENTS.evidence), evidenceMarkdown(name));

	let reportPath: string | undefined;
	if (request.report) {
		reportPath = joinPath(joinPath(directory, "report"), "security-report.md");
		await writeOnce(fs, reportPath, reportFor(name, description || brief.description || ""));
	}

	// 旧实现按内存 brief 回报门禁：第二次带 auth_status=granted 进来时 scope.md 并不重写，
	// 却报了一个磁盘上并不存在的 ready。现在 scope 已存在时只写日志，回报以落盘状态为准。
	const amendment = scopeWritten ? null : await recordAuthAmendment(fs, directory, brief);
	const effective = amendment?.readiness ?? assessReadiness(brief);

	return {
		directory,
		created,
		readmePath,
		reportPath,
		scopePath,
		readiness: effective,
		keptExistingReadme: !readmeWritten,
		authRecorded: amendment?.recorded ?? false,
		authLogPath: joinPath(directory, CASE_DOCUMENTS.authLog),
		authNote: amendment?.note,
	};
}

export function renderWorkspace(result: WorkspaceResult): string {
	const lines = [
		`Workspace ready: ${result.directory}`,
		"",
		...CASE_DIRECTORY_NAMES.map(child => `  ${joinPath(result.directory, child)}/`),
		`  ${result.scopePath}`,
		result.reportPath ? `  ${result.reportPath}` : "",
		result.authRecorded ? `  ${result.authLogPath}` : "",
		"",
		readinessLine(result.readiness),
		result.authNote ?? "",
		"",
		result.keptExistingReadme
			? `README.md already existed and was left untouched: ${result.readmePath}`
			: `Wrote ${result.readmePath}`,
		result.authRecorded
			? "Authorisation that arrived after scope.md was written is appended to the log above; the last block stands."
			: "scope.md is written once: a changed scope is a new case, while authorisation arriving later goes to auth-log.md.",
		"Put copies of the samples in samples/, dump evidence into exports/, and write the findings in report/.",
		"Record each observation as evidence/E-###-<slug>.md, and every decision as a note under .agents/notes/.",
	].filter(line => line.length > 0);
	return lines.join("\n");
}
