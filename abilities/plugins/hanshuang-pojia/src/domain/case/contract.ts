/**
 * Case contract — the pre-work declaration that makes a case citable.
 *
 * Upstream `case-init.ps1` writes a scope before any analysis: what is being examined, what is
 * in and out of scope, which network profile applies, and what will be delivered. `Tool/cases/`
 * then stores 14 finished packages whose README/docs/src/build files are the precedent corpus.
 *
 * This module owns the declaration half: the preset table and the two documents `scope.md` and
 * `timeline.md`, plus the `evidence/README.md` numbering contract. Pure functions only — no fs,
 * no clock.
 *
 * Section names, key names and the preset table are copied from `Tool/scripts/case-init.ps1` so
 * a case written by either tool reads the same. Two deliberate departures, both documented in
 * ADR 0006: the name limit is 64 instead of 80 (an `E-###-<slug>.md` under `evidence/` must
 * still fit a Windows path), and unknown words fail closed instead of being warned past.
 *
 * - `scope.md` is written once and never rewritten; a changed scope is a new case.
 * - `timeline.md` is append-only, one timestamped block per event.
 *
 * `auth_status` is recorded as a fact about the engagement, next to the assets and the network
 * profile. It is not a gate: nothing here derives a "may proceed" verdict from it, and no tool
 * refuses to run because the field is not `granted`. A workbench that locks its own door only
 * teaches people to fill in the form.
 */

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

/**
 * Rejects the shapes `safeTaskName` would silently paper over. Upstream's `case-init.ps1`
 * validates the name before creating anything; sanitising `../../etc/passwd` into
 * `etc_passwd` is a safe write, but it is not the case the caller asked for.
 */
export function assertCaseName(raw: string): string {
	const value = raw.trim();
	if (!value) throw new Error("case name is required");
	if (/[\\/]/.test(value)) throw new Error("case name must be a plain directory name, not a path");
	if (value.includes("..")) throw new Error("case name must not contain '..'");
	if (/[*?"<>|]/.test(value)) throw new Error("case name must not contain wildcards or reserved characters");
	if (/[. ]$/.test(value)) throw new Error("case name must not end with a dot or a space");
	return value;
}

/** Upstream creates `evidence`, `notes`, `report`; `samples` and `exports` are the local additions. */
export const CASE_DIRECTORY_NAMES = ["samples", "exports", "reports", "evidence", "notes"] as const;

export const CASE_DOCUMENTS = {
	scope: "scope.md",
	timeline: "timeline.md",
	readme: "README.md",
	evidence: "evidence/README.md",
} as const;

/**
 * Upstream's `-AuthStatus` accepts exactly these four words. The value is written into
 * `scope.md` for the reader; no code path branches on it, so an unusual word is a description
 * of the engagement rather than a blocked start.
 */
export type AuthStatus = "pending" | "granted" | "denied" | "unknown";

export const AUTH_STATUSES: readonly AuthStatus[] = ["pending", "granted", "denied", "unknown"];

export function parseAuthStatus(raw: string | undefined): AuthStatus {
	const value = (raw ?? "").trim().toLowerCase();
	if (!value) return "pending";
	if ((AUTH_STATUSES as readonly string[]).includes(value)) return value as AuthStatus;
	throw new Error(`auth_status must be one of ${AUTH_STATUSES.join(", ")}; got "${raw}"`);
}

export type NetworkProfile = "offline" | "lab_only" | "authorized_target_only" | "unrestricted_lab";

export const NETWORK_PROFILES: readonly NetworkProfile[] = [
	"offline",
	"lab_only",
	"authorized_target_only",
	"unrestricted_lab",
];

/** Upstream normalises these four spellings before validating. */
export const NETWORK_PROFILE_ALIASES: Readonly<Record<string, NetworkProfile>> = {
	lab: "lab_only",
	authorized: "authorized_target_only",
	auth: "authorized_target_only",
	offline_only: "offline",
};

export function parseNetworkProfile(raw: string | undefined): NetworkProfile {
	const value = (raw ?? "").trim().toLowerCase();
	if (!value) return "offline";
	const resolved = NETWORK_PROFILE_ALIASES[value] ?? value;
	if ((NETWORK_PROFILES as readonly string[]).includes(resolved)) return resolved as NetworkProfile;
	throw new Error(`network_profile must be one of ${NETWORK_PROFILES.join(", ")}; got "${raw}"`);
}

export interface CasePreset {
	id: string;
	aliases: readonly string[];
	/** Upstream presets record authorisation themselves — the operator chose the preset. */
	authStatus: AuthStatus;
	authBasis: string;
	evidenceOfAuth: string;
	networkProfile: NetworkProfile;
	deliverables: readonly string[];
	constraints: readonly string[];
}

/**
 * The three upstream presets. They carry authorisation because upstream sets
 * `-AuthGranted` from the preset; they carry no assets, because an invented asset would
 * describe a case nobody declared.
 */
export const CASE_PRESETS: readonly CasePreset[] = [
	{
		id: "offline-sample",
		aliases: ["own-sample", "local-sample"],
		authStatus: "granted",
		authBasis: "own_system",
		evidenceOfAuth: "preset:offline-sample (owner-operated local file)",
		networkProfile: "offline",
		deliverables: ["reports/<case>_security_assessment_report.md", "exports/ (decompiler output, dumps, scripts)"],
		constraints: ["Static analysis only; no network calls, no live service touched"],
	},
	{
		id: "ctf-public",
		aliases: ["ctf"],
		authStatus: "granted",
		authBasis: "ctf_public",
		evidenceOfAuth: "preset:ctf-public",
		networkProfile: "authorized_target_only",
		deliverables: ["reports/<case>_security_assessment_report.md", "exports/<case>_poc/ (reproduction script + output)"],
		constraints: ["Only the published challenge surface; no adjacent hosts", "Stop at flag / demonstrated impact"],
	},
	{
		id: "own-system",
		aliases: ["lab-only"],
		authStatus: "granted",
		authBasis: "own_system",
		evidenceOfAuth: "preset:own-system/lab",
		networkProfile: "lab_only",
		deliverables: ["reports/<case>_security_assessment_report.md", "exports/ (reproduction script + captured output)"],
		constraints: ["No production data; restore snapshots after testing"],
	},
];

export function resolvePreset(raw: string | undefined): CasePreset {
	const value = (raw ?? "").trim().toLowerCase();
	if (!value) return CASE_PRESETS[0] as CasePreset;
	const match = CASE_PRESETS.find(preset => preset.id === value || preset.aliases.includes(value));
	if (match) return match;
	const known = CASE_PRESETS.map(preset => [preset.id, ...preset.aliases].join(" / ")).join("; ");
	throw new Error(`unknown preset "${raw}"; use one of: ${known}`);
}

export interface CaseBrief {
	name: string;
	description?: string;
	target?: string;
	sample?: string;
	preset: CasePreset;
	authStatus: AuthStatus;
	authBasis?: string;
	authEvidence?: string;
	inScope: readonly string[];
	outOfScope: readonly string[];
	networkProfile: NetworkProfile;
	deliverables: readonly string[];
	constraints: readonly string[];
	projectRoot?: string;
	/** ISO timestamp the scope was declared at. */
	at: string;
}

/**
 * 每条资产/约束占一行。条目里夹带的换行必须压成空格：`  - line\nbreak` 会让 `break`
 * 落到下一行且没有项目符号，读回来时被当成新的键，声明静默错位。
 */
function indentedList(items: readonly string[]): string[] {
	return items.length > 0 ? items.map(item => `  - ${item.replace(/\s+/g, " ").trim()}`) : ["  []"];
}

/** Where the operator reads the upstream ops contract, in the form this package can open. */
export const CASE_OPS_REFS: readonly string[] = [
	"kb/field_journal__template.md",
	"kb/field_journal_precedent-auth.md",
	"kb/field_journal_precedent-reverse.md",
	"kb/field_journal_precedent-pentest.md",
	"docs/contract/case-library.md",
];

/** Renders the declaration. Heading and key names mirror `case-init.ps1`. */
export function scopeMarkdown(brief: CaseBrief): string {
	return [
		"# Case Scope",
		"",
		"## meta",
		`- case_id: ${brief.name}`,
		`- created: ${brief.at}`,
		"- operator: local",
		`- project_root: ${brief.projectRoot?.trim() || "(not provided)"}`,
		"- primary_skill: (set when the case starts acting)",
		"- primary_id: (not provided)",
		"- lead_role: lead",
		"- specialist_roles: []",
		`- hint: ${brief.description?.trim() || "(not provided)"}`,
		`- preset: ${brief.preset.id}`,
		"",
		"## auth",
		`- status: ${brief.authStatus}`,
		`- basis: ${brief.authBasis?.trim() || "(not provided)"}`,
		`- evidence_of_auth: ${brief.authEvidence?.trim() || "(not provided)"}`,
		"",
		"## in_scope",
		"- assets:",
		...indentedList(brief.inScope),
		"- surfaces: []",
		"- activities: []",
		"",
		"## out_of_scope",
		"- assets:",
		...indentedList(brief.outOfScope),
		"- activities: [dos, phishing_real_users, unrestricted_exfil]",
		"",
		"## network_profile",
		`- mode: ${brief.networkProfile}`,
		`- offline_sample: ${brief.sample?.trim() || "(none)"}`,
		"- notes: |",
		"    offline | lab_only | authorized_target_only | unrestricted_lab",
		"",
		"## deliverables",
		"- report: true",
		"- field_journal: true",
		"- diagrams: false",
		"- timeline: true",
		"- planned:",
		...indentedList(brief.deliverables),
		"",
		"## constraints",
		"- timebox: (not provided)",
		"- stealth: low",
		"- data_handling: anonymize",
		"- rules:",
		...indentedList(brief.constraints),
		"",
		"## ops_refs",
		...CASE_OPS_REFS.map(ref => `- ${ref}`),
		"",
	].join("\n");
}

/**
 * One event, in the block shape `case-init.ps1` seeds. Appending a block keeps the log
 * machine-readable: `## <iso> | <role> | <kind>` then the fields below it.
 */
export function timelineEntry(at: string, text: string, kind = "note", role = "lead"): string {
	return [
		`## ${at} | ${role} | ${kind}`,
		`- action: ${kind}`,
		`- command_or_ref: ${kind === "init" ? "init_task" : "(not recorded)"}`,
		`- result_summary: ${text}`,
		"- evidence_ids: []",
		"- decision_delta: []",
	].join("\n");
}

/** Append-only event log; a header is written once at creation. */
export function timelineHeader(name: string, at: string, brief: CaseBrief): string {
	return [
		`# Timeline — ${name}`,
		"",
		"Append-only. One block per event, newest last. Never rewrite history: a wrong step stays visible.",
		"",
		timelineEntry(
			at,
			`case directory created; preset ${brief.preset.id}, ${brief.inScope.length} in-scope asset(s)`,
			"init",
		),
		"",
	].join("\n");
}

/** `evidence/README.md` — the numbering contract for `E-###` entries. */
export function evidenceMarkdown(name: string): string {
	return [
		`# Evidence index — ${name}`,
		"",
		"One file per observation, named `E-###-<slug>.md`. The number never gets reused.",
		"",
		"Each entry opens with these fields, so a reader can filter without prose:",
		"",
		"- `severity:` critical | high | medium | low | info",
		"- `status:` observed | candidate | validated | false_positive | accepted_risk",
		"- `repro_command:` the command that reproduces it (offline work states that instead)",
		"- `content_hash:` sha256 of the artefact, or `n/a`; with sha256 also record `artifact_path:`",
		"- `grade:` Observed | Inferred | Assumed",
		"",
		"The body records what was run, what came back verbatim, and where the artefact is kept",
		"under `exports/`.",
		"",
		"## Entries",
		"",
		"- (none yet — add `E-001-<slug>.md` and list it here)",
		"",
	].join("\n");
}
