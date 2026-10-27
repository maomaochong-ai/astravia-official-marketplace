import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import {
	CASE_PRESETS,
	parseAuthStatus,
	parseNetworkProfile,
	resolvePreset,
	safeTaskName,
	type CaseBrief,
} from "../../domain/case/contract";
import { isOutsideProject, resolveSamplePath } from "../../domain/sample-path";
import { initTaskWorkspace, renderWorkspace } from "../../domain/toolchain/workspace";

interface InitTaskInput {
	name: string;
	description?: string;
	report?: boolean;
	root?: string;
	preset?: string;
	target?: string;
	sample?: string;
	auth_status?: string;
	auth_basis?: string;
	auth_evidence?: string;
	in_scope?: string[];
	out_of_scope?: string[];
	network_profile?: string;
	deliverables?: string[];
	constraints?: string[];
}

function cleanList(values: string[] | undefined): string[] {
	return (values ?? []).map(value => String(value).trim()).filter(value => value.length > 0);
}

/** Upstream merges -TargetUrl, -Sample and -InScopeAssets into one asset list, order kept. */
function unique(values: readonly (string | undefined)[]): string[] {
	const out: string[] = [];
	for (const value of values) {
		const trimmed = (value ?? "").trim();
		if (trimmed && !out.includes(trimmed)) out.push(trimmed);
	}
	return out;
}

export function registerInitTaskTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<InitTaskInput>({
		id: "init_task",
		name: "init_task",
		label: "%tool.workspace.label%",
		description: [
			"  <root>/<name>/samples/   copies of the files under examination",
			"  <root>/<name>/exports/   decompiled sources, disassembly, string dumps",
			"  <root>/<name>/report/    findings and the final report",
			"  <root>/<name>/evidence/  one E-###-<slug>.md per observation",
			"  <root>/<name>/notes/     working notes",
			"  scope.md     authorisation, in/out of scope, network profile, deliverables, signoff",
			"  timeline.md  append-only event log",
			"  workitems.md WI table + coverage, one row per in-scope asset",
			"",
			"Call it at the start of any engagement that will produce more than one artefact. Pass the declaration",
			"when you have it: preset (offline-sample | ctf-public | own-system), auth_status (pending | granted |",
			"denied | unknown), auth_basis, in_scope, network_profile (offline | lab_only | authorized_target_only |",
			"unrestricted_lab). Naming a preset records that preset's authorisation; a bare call stays pending.",
			"The `ready_for_act` gate is derived from those — it is reported, never accepted as an argument — and it",
			"stays shut until auth is granted, an asset is in scope, and an offline case names its sample.",
			"",
			"Existing files are never overwritten: a second call keeps the scope, timeline and README you already",
			"wrote and only fills in missing directories. scope.md is written once — a changed scope is a new case —",
			"but authorisation can arrive later: calling again with auth_status / auth_basis / auth_evidence",
			"appends a record to auth-log.md (append-only, last record stands) instead of rewriting the scope.",
			"The gate in the result is always the one on disk, so it opens only once the recorded facts say so.",
			"root defaults to the conversation working directory; pass a subdirectory when the project keeps its own",
			"case folders. There is no patches/ directory: a patched or rebuilt artefact belongs under exports/ with",
			"the command that produced it, so the run can be repeated.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				name: { type: "string", description: "Case name, e.g. 'sample-2024-11' or 'com.example.app'." },
				description: { type: "string", description: "One-line summary recorded in scope.md and README.md." },
				report: { type: "boolean", description: "Also create report/security-report.md (default false)." },
				root: { type: "string", description: "Parent directory; defaults to the conversation working directory." },
				preset: {
					type: "string",
					description: `Scope template: ${CASE_PRESETS.map(preset => preset.id).join(" | ")} (default offline-sample).`,
				},
				target: { type: "string", description: "The asset under examination, e.g. a hostname, app name or file." },
				sample: { type: "string", description: "Sample path or hash the case starts from." },
				auth_status: {
					type: "string",
					description: "pending | granted | denied | unknown; only granted opens the gate.",
				},
				auth_basis: { type: "string", description: "What the authorisation rests on (ticket, brief, ownership)." },
				auth_evidence: { type: "string", description: "Where that authorisation is recorded." },
				in_scope: { type: "array", items: { type: "string" }, description: "Assets that may be touched." },
				out_of_scope: { type: "array", items: { type: "string" }, description: "Explicit exclusions." },
				network_profile: {
					type: "string",
					description: "offline | lab_only | authorized_target_only | unrestricted_lab (aliases: lab, authorized, auth, offline_only).",
				},
				deliverables: { type: "array", items: { type: "string" }, description: "What this case will produce." },
				constraints: { type: "array", items: { type: "string" }, description: "Time, rate or no-touch limits." },
			},
			required: ["name"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 30_000,
		handler: async context => {
			const input = context.trigger.input;
			const cwd = context.session.cwd;
			const rawRoot = (input.root ?? "").trim();
			if (rawRoot && isOutsideProject(rawRoot, cwd)) return `root must stay inside the open project: ${rawRoot}`;
			if (!cwd && !rawRoot) return "No working directory is available; pass root explicitly.";
			let root: string;
			try {
				root = rawRoot ? resolveSamplePath(cwd, rawRoot) : (cwd as string);
			} catch (error) {
				return error instanceof Error ? error.message : String(error);
			}

			let brief: CaseBrief;
			try {
				const preset = resolvePreset(input.preset);
				// A preset records authorisation only when the caller actually named one; a bare
				// init_task keeps the upstream pending/offline defaults.
				const presetGiven = Boolean((input.preset ?? "").trim());
				const assets = unique([input.target, input.sample, ...cleanList(input.in_scope)]);
				brief = {
					name: safeTaskName(input.name ?? ""),
					description: (input.description ?? "").trim(),
					target: (input.target ?? "").trim(),
					sample: (input.sample ?? "").trim(),
					preset,
					authStatus: parseAuthStatus(
						(input.auth_status ?? "").trim() || (presetGiven ? preset.authStatus : undefined),
					),
					authBasis: (input.auth_basis ?? "").trim() || (presetGiven ? preset.authBasis : ""),
					authEvidence: (input.auth_evidence ?? "").trim() || (presetGiven ? preset.evidenceOfAuth : ""),
					inScope: assets,
					outOfScope: cleanList(input.out_of_scope),
					networkProfile: parseNetworkProfile(input.network_profile ?? preset.networkProfile),
					deliverables: cleanList(input.deliverables),
					constraints: cleanList(input.constraints),
					projectRoot: root,
					at: new Date().toISOString(),
				};
				if (brief.deliverables.length === 0) brief.deliverables = [...preset.deliverables];
				if (brief.constraints.length === 0) brief.constraints = [...preset.constraints];
			} catch (error) {
				return `init_task failed: ${error instanceof Error ? error.message : String(error)}`;
			}

			try {
				const result = await initTaskWorkspace(context.host.fs, {
					root,
					name: input.name ?? "",
					description: input.description,
					report: input.report === true,
					brief,
				});
				// 报告的永远是落盘后的门禁：scope 已存在时 reads 的是 auth-log.md 里的最后一条。
				const gate = result.readiness.ready
					? ""
					: `\nNot ready for act yet: ${result.readiness.blockers.join("; ")}. ` +
						"Authorisation that arrives later is recorded by calling init_task again with auth_status /" +
						"auth_basis — that appends to auth-log.md and keeps the scope as written. A changed scope is a new case.";
				const recorded = result.authRecorded
					? `\nAuthorisation recorded in ${result.authLogPath} (append-only, last record stands).`
					: "";
				return `${renderWorkspace(result)}${recorded}${gate}`;
			} catch (error) {
				return `init_task failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}
