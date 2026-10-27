/**
 * Case journal — the two things that grow while a case is being worked: the append-only
 * timeline, and the decision notes under `.agents/notes/{implemented,rejected}/`.
 *
 * The note convention is copied from upstream `Tool/cases/项目N/.agents/notes/`, which files
 * each decision as `<status>/<category>/<YYYY-MM-DD>-<slug>.md`. Keeping the same shape means
 * a note written here still reads correctly if the case directory is handed to someone else.
 */
import { joinPath } from "../toolchain/paths";
import { safeTaskName } from "./contract";

export interface CaseWritePort {
	readText(path: string): Promise<string | null>;
	writeText(path: string, content: string): Promise<void>;
	createDirectory(path: string): Promise<void>;
	exists(path: string): Promise<boolean>;
}

export type DecisionStatus = "implemented" | "rejected";
export const DECISION_STATUSES: readonly DecisionStatus[] = ["implemented", "rejected"];

export function parseDecisionStatus(raw: string | undefined): DecisionStatus {
	const value = (raw ?? "").trim().toLowerCase();
	if ((DECISION_STATUSES as readonly string[]).includes(value)) return value as DecisionStatus;
	throw new Error(`status must be "implemented" or "rejected"; got "${raw ?? ""}"`);
}

/** One path segment: category names become directories, so separators are rejected outright. */
export function categorySegment(raw: string | undefined): string {
	const value = safeTaskName(raw ?? "");
	if (!value) throw new Error("category must contain letters, digits, dashes or underscores");
	return value;
}

export function noteSlug(title: string): string {
	const slug = safeTaskName(title)
		.toLowerCase()
		.replace(/[\s_]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
	if (!slug) throw new Error("title must contain at least one letter or digit");
	return slug;
}

export function decisionNoteRelativePath(status: DecisionStatus, category: string, date: string, slug: string): string {
	return joinPath(joinPath(joinPath(".agents/notes", status), category), `${date}-${slug}.md`);
}

export interface DecisionNote {
	caseName: string;
	status: DecisionStatus;
	category: string;
	title: string;
	/** Markdown body as written by the caller; not reformatted. */
	body: string;
	date: string;
}

export function renderDecisionNote(note: DecisionNote): string {
	return [
		`# ${note.title}`,
		"",
		`- status: ${note.status}`,
		`- category: ${note.category}`,
		`- date: ${note.date}`,
		`- case: ${note.caseName}`,
		"",
		note.body.trim(),
		"",
	].join("\n");
}

export interface NoteWriteResult {
	path: string;
	overwritten: boolean;
	timelinePath: string | null;
}

export async function writeDecisionNote(
	port: CaseWritePort,
	casePath: string,
	note: DecisionNote,
	options: { overwrite?: boolean; at?: string } = {},
): Promise<NoteWriteResult> {
	const relative = decisionNoteRelativePath(note.status, categorySegment(note.category), note.date, noteSlug(note.title));
	const target = joinPath(casePath, relative);
	const overwritten = await port.exists(target);
	if (overwritten && options.overwrite !== true) {
		throw new Error(`${relative} already exists; pass overwrite=true to replace it`);
	}
	const directory = relative.slice(0, relative.lastIndexOf("/"));
	await port.createDirectory(joinPath(casePath, directory));
	await port.writeText(target, renderDecisionNote(note));

	let timelinePath: string | null = null;
	try {
		timelinePath = await appendTimeline(port, casePath, `${note.status} ${note.category}: ${note.title}`, options.at);
	} catch {
		// A note without a timeline line is still a note; the reverse is not true.
		timelinePath = null;
	}
	return { path: target, overwritten, timelinePath };
}

/** Host `writeFile` has no append, so the timeline is read and rewritten in one piece. */
export async function appendTimeline(
	port: CaseWritePort,
	casePath: string,
	text: string,
	at = new Date().toISOString(),
): Promise<string> {
	const path = joinPath(casePath, "timeline.md");
	const entry = `- ${at} — ${text}`;
	const existing = await port.readText(path);
	if (existing === null) {
		await port.writeText(path, ["# Timeline", "", entry, ""].join("\n"));
		return path;
	}
	const trimmed = existing.replace(/\s*$/, "");
	const separator = trimmed.length > 0 ? "\n" : "";
	await port.writeText(path, `${trimmed}${separator}${entry}\n`);
	return path;
}
