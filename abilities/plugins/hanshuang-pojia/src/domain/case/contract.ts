/**
 * Case contract v2 — the pre-work declaration that makes a case citable.
 *
 * Upstream `case-init.ps1` writes a scope before any analysis: what is authorised, what is
 * in and out of scope, which network profile applies, what will be delivered, and a
 * `ready_for_act` gate that stays shut until authorisation is recorded. `Tool/cases/` then
 * stores 14 finished packages whose README/docs/src/build files are the precedent corpus.
 *
 * This module owns the declaration half: presets, the gate, and the three documents
 * (`scope.md`, `timeline.md`, `workitems.md`). Pure functions only — no fs, no clock.
 *
 * Section names, key names, the preset table and the gate formula are copied from
 * `Tool/scripts/case-init.ps1` so a case written by either tool reads the same. Two
 * deliberate departures, both documented in ADR 0006: the name limit is 64 instead of 80
 * (a `E-###-<slug>.md` under `evidence/` must still fit a Windows path), and unknown words
 * fail closed instead of being warned past.
 *
 * - `scope.md` is written once and never rewritten; a changed scope is a new case.
 * - `timeline.md` is append-only, one timestamped block per event.
 * - `workitems.md` keeps a fixed table so "how much is done" stays countable.
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
export const CASE_DIRECTORY_NAMES = ["samples", "exports", "report", "evidence", "notes"] as const;

export const CASE_DOCUMENTS = {
	scope: "scope.md",
	timeline: "timeline.md",
	workItems: "workitems.md",
	readme: "README.md",
	evidence: "evidence/README.md",
} as const;

/**
 * Upstream's `-AuthStatus` accepts exactly these four words. `granted` is the only one that
 * opens the gate; `pending`, `denied` and `unknown` all read as "not recorded".
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
 * light the gate without anything being in scope.
 */
export const CASE_PRESETS: readonly CasePreset[] = [
	{
		id: "offline-sample",
		aliases: ["own-sample", "local-sample"],
		authStatus: "granted",
		authBasis: "own_system",
		evidenceOfAuth: "preset:offline-sample (owner-operated local file)",
		networkProfile: "offline",
		deliverables: ["report/<case>_security_assessment_report.md", "exports/ (decompiler output, dumps, scripts)"],
		constraints: ["Static analysis only; no network calls, no live service touched"],
	},
	{
		id: "ctf-public",
		aliases: ["ctf"],
		authStatus: "granted",
		authBasis: "ctf_public",
		evidenceOfAuth: "preset:ctf-public",
		networkProfile: "authorized_target_only",
		deliverables: ["report/<case>_security_assessment_report.md", "exports/<case>_poc/ (reproduction script + output)"],
		constraints: ["Only the published challenge surface; no adjacent hosts", "Stop at flag / demonstrated impact"],
	},
	{
		id: "own-system",
		aliases: ["lab-only"],
		authStatus: "granted",
		authBasis: "own_system",
		evidenceOfAuth: "preset:own-system/lab",
		networkProfile: "lab_only",
		deliverables: ["report/<case>_security_assessment_report.md", "exports/ (reproduction script + captured output)"],
		constraints: ["No production data; restore snapshots after testing"],
	},
];

export const DEFAULT_PRESET_ID = "offline-sample";

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

export interface Readiness {
	ready: boolean;
	blockers: string[];
}

/**
 * What the gate looks at. The vocabularies are `string` on purpose: this reads a declaration
 * someone typed, so an unrecognised word is an answer the gate has to handle, not a compile
 * error.
 */
export interface ReadinessInput {
	authStatus: string;
	inScope: readonly string[];
	networkProfile: string;
	/** Upstream: offline mode only becomes actionable with an explicit local sample. */
	sample?: string;
}

/** `granted` is the single word that opens the gate; everything else is "not recorded". */
const AUTHORISED_STATUSES: readonly string[] = ["granted"];

/**
 * The gate is derived, never accepted as input: a value passed in by a caller is a claim,
 * not a check, and a claimed gate is the same as no gate.
 *
 * Formula (upstream `case-init.ps1`): `granted` AND assets non-empty AND (mode is not
 * `offline` OR an explicit sample is recorded). Both vocabularies are enumerated forwards,
 * so an unknown word blocks instead of slipping through an inequality.
 */
export function assessReadiness(brief: ReadinessInput): Readiness {
	const blockers: string[] = [];
	if (!AUTHORISED_STATUSES.includes(brief.authStatus)) {
		blockers.push(`authorisation not recorded (auth_status=${brief.authStatus})`);
	}
	if (brief.inScope.length === 0) blockers.push("no in-scope assets declared");
	if (!(NETWORK_PROFILES as readonly string[]).includes(brief.networkProfile)) {
		blockers.push(`network profile not recognised (profile=${brief.networkProfile})`);
	} else if (brief.networkProfile === "offline" && !(brief.sample ?? "").trim().length) {
		blockers.push("offline profile needs an explicit sample");
	}
	return { ready: blockers.length === 0, blockers };
}

function indentedList(items: readonly string[]): string[] {
	return items.length > 0 ? items.map(item => `  - ${item}`) : ["  []"];
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
	const readiness = assessReadiness(brief);
	const check = (ok: boolean): string => (ok ? "[x]" : "[ ]");
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
		"- MUST NOT proceed if status != granted",
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
		"    Change mode only after auth.status = granted.",
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
		"## signoff",
		`- ready_for_act: ${readiness.ready ? "true" : "false"}`,
		"- checklist:",
		`  - ${check(brief.authStatus === "granted")} auth.status = granted`,
		`  - ${check(brief.inScope.length > 0 || Boolean(brief.sample?.trim()))} in_scope.assets non-empty OR offline sample path set`,
		`  - ${check(readiness.blockers.every(blocker => !blocker.startsWith("network profile")))} network_profile.mode chosen`,
		"  - [ ] out_of_scope reviewed",
		"  - [ ] roles assigned",
		...(readiness.blockers.length > 0
			? ["- blockers:", ...readiness.blockers.map(blocker => `  - ${blocker}`)]
			: ["- blockers: []"]),
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
	const readiness = assessReadiness(brief);
	return [
		`# Timeline — ${name}`,
		"",
		"Append-only. One block per event, newest last. Never rewrite history: a wrong step stays visible.",
		"",
		timelineEntry(
			at,
			readiness.ready
				? "case directory created; scope ready_for_act=true"
				: `case directory created; scope pending (${readiness.blockers.join("; ")})`,
			"init",
		),
		"",
	].join("\n");
}

export interface WorkItemSeed {
	id: string;
	title: string;
	target: string;
	surface: string;
	status: "todo" | "in_progress" | "done" | "dropped";
}

/** What kind of thing an asset looks like — only ever a hint for the `surface` column. */
function surfaceHint(asset: string): string {
	if (/^https?:\/\//i.test(asset)) return "web";
	if (/\.(apk|aab|xapk)$/i.test(asset)) return "android";
	if (/\.(exe|dll|sys|so|dylib|elf|bin|ipa)$/i.test(asset)) return "binary";
	if (/\.(js|ts)$/i.test(asset)) return "js";
	return "process";
}

/**
 * One work item per in-scope asset, plus the upstream bootstrap row. That is the honest
 * seed: every asset someone declared in scope needs at least one unit of work, and an empty
 * table would hide the gap.
 */
export function seedWorkItems(brief: Pick<CaseBrief, "inScope">): WorkItemSeed[] {
	const bootstrap: WorkItemSeed = {
		id: "WI-001",
		title: "Establish scope and auth",
		target: "case",
		surface: "process",
		status: "in_progress",
	};
	return [
		bootstrap,
		...brief.inScope.map((asset, index) => ({
			id: `WI-${String(index + 2).padStart(3, "0")}`,
			title: `Baseline and analyse ${asset}`,
			target: asset,
			surface: surfaceHint(asset),
			status: "todo" as const,
		})),
	];
}

/** 八列是机器读的：单元格里再出现 `|` 会多一列，换行会多一行，状态列就被读成资产名的一部分。 */
function tableCell(text: string): string {
	return text.replace(/[\r\n]+/g, " ").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
}

export const WORK_ITEM_STATUSES: readonly string[] = ["todo", "in_progress", "done", "dropped"];

export function workItemsMarkdown(name: string, brief: CaseBrief): string {
	const rows = seedWorkItems(brief).map(
		row => `| ${row.id} | ${tableCell(row.title)} | lead | ${tableCell(row.target)} | ${row.surface} | ${row.status} | | |`,
	);
	return [
		`# Work Items — ${name}`,
		"",
		"Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an `E-###` id.",
		"",
		"| ID | title | role | targets | surface | status | evidence | notes |",
		"|----|-------|------|---------|---------|--------|----------|-------|",
		...rows,
		"",
		"## Coverage",
		"- [ ] Recon/analysis complete for in-scope assets",
		"- [ ] Critical/High candidates triaged (or N/A for pure RE)",
		"- [ ] Validated findings have Evidence (E-*)",
		"- [ ] Path documented (attack/call/solve)",
		"- [ ] Timeline continuous across major phases",
		"- [ ] Report written under report/",
		"- [ ] field-journal entry anonymized",
		"",
		"## Refs",
		...CASE_OPS_REFS.map(ref => `- ${ref}`),
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
		"- `linked_workitem:` a WI-### that exists in `workitems.md`",
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

/** One-line gate summary for tool output and the panel: never a bare boolean. */
export function readinessLine(readiness: Readiness): string {
	return readiness.ready
		? "ready_for_act: yes (authorisation recorded, in-scope assets declared)"
		: `ready_for_act: no — ${readiness.blockers.join("; ")}`;
}
