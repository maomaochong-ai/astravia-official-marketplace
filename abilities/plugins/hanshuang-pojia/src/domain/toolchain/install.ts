/**
 * Install planner.
 *
 * The plugin cannot install anything itself: the host runs only executables
 * declared in `plugin.json#commands`, so a package manager is out of reach by
 * construction, and a plugin that silently acquired one would be asking the user
 * to grant `brew` / `apt-get` / `winget` without saying why.
 *
 * So the contract is a plan, not an action. Given what the probe found and what
 * the user is trying to achieve, this module answers three questions the agent
 * cannot answer by itself:
 *
 *   1. Which tools does this goal actually need? (a disassembler is useless for
 *      an APK-only job, and installing it wastes a password prompt)
 *   2. Which of those are missing as opposed to refused by the host? (only the
 *      first kind is worth an install command)
 *   3. What is the exact command on this platform? (the same tool has three
 *      different package names)
 *
 * The agent then runs the commands with its own shell. That keeps the install
 * auditable — the user sees every command before it runs — and keeps the plugin
 * inside the host's permission model.
 */
import {
	COMPANIONS,
	GOAL_LABEL,
	TOOLCHAIN,
	type CompanionSpec,
	type Goal,
	type Platform,
	type ToolSpec,
} from "./catalog";
import type { ToolchainReport } from "./probe";

export type InstallReason = "missing" | "blocked" | "commercial" | "no-recipe";

export interface InstallStep {
	/** Executable the step makes available. */
	binary: string;
	purpose: string;
	/** Exact command for {@link InstallPlan.platform}. Absent when there is nothing to run. */
	command?: string;
	reason: InstallReason;
	/** The command needs an administrator shell (sudo, or a UAC-elevated terminal on Windows). */
	elevated: boolean;
}

export interface InstallPlan {
	platform: Platform;
	goal: Goal;
	/** Tools this goal needs, by executable name. */
	required: readonly string[];
	/** Tools already answering a version probe. */
	ready: readonly string[];
	steps: readonly InstallStep[];
	/** Named but never spawned by the plugin, so they carry no permission. */
	companions: readonly CompanionSpec[];
	/** Everything the agent should know beyond the command list. */
	notes: readonly string[];
}

const ELEVATED_PATTERN = /(^|\s)sudo(\s|$)|^Run as administrator/i;

/** Sample extensions that imply a goal. Anything unrecognised means "ask for everything". */
const GOAL_BY_EXTENSION: ReadonlyArray<readonly [RegExp, Goal]> = [
	[/\.(apk|xapk|apks|aab)$/i, "apk"],
	[/\.(dex|smali|jar)$/i, "apk"],
	[/\.(so(\.\d+)*|elf|dylib|macho|exe|dll|sys|o|ko)$/i, "native"],
	[/\.(bin|img|fw|rom|hex|chk|trx)$/i, "firmware"],
];

export function inferGoal(sampleName?: string | null): Goal {
	if (!sampleName) return "full";
	for (const [pattern, goal] of GOAL_BY_EXTENSION) {
		if (pattern.test(sampleName)) return goal;
	}
	return "full";
}

function specsForGoal(goal: Goal): readonly ToolSpec[] {
	if (goal === "full") return TOOLCHAIN;
	return TOOLCHAIN.filter(spec => spec.goals.includes(goal));
}

function companionsForGoal(goal: Goal): readonly CompanionSpec[] {
	return COMPANIONS.filter(spec => goal === "full" || spec.goals.includes(goal));
}

/**
 * Turns a probe report into an ordered plan.
 *
 * `report` may be absent when the plugin holds no `agent.command.run` grant: the
 * plan then treats every tool as missing, which is still the useful answer —
 * it tells the user which commands to run and, in the notes, that the plugin
 * must be granted the permission afterwards.
 */
export function planInstallation(
	report: ToolchainReport | null,
	options: { platform: Platform; goal: Goal },
): InstallPlan {
	const { platform, goal } = options;
	const wanted = specsForGoal(goal);
	const statusById = new Map((report?.tools ?? []).map(tool => [tool.id, tool]));

	const ready: string[] = [];
	const steps: InstallStep[] = [];

	for (const spec of wanted) {
		const status = statusById.get(spec.id);
		if (status?.available) {
			ready.push(spec.binary);
			continue;
		}
		// A refused call is a permission problem. Printing an install command for it
		// sends the user to the package manager for something they already have.
		if (status?.blocked) {
			steps.push({ binary: spec.binary, purpose: spec.purpose, reason: "blocked", elevated: false });
			continue;
		}
		const command = spec.recipe?.[platform];
		if (!command) {
			steps.push({
				binary: spec.binary,
				purpose: spec.purpose,
				reason: "no-recipe",
				command: undefined,
				elevated: false,
			});
			continue;
		}
		steps.push({
			binary: spec.binary,
			purpose: spec.purpose,
			command,
			reason: "missing",
			elevated: ELEVATED_PATTERN.test(command),
		});
	}

	const companions = companionsForGoal(goal).map(spec => ({
		...spec,
		// The companion may already be present; the plan never probes it, so say so
		// rather than implying it is missing.
		install: spec.commercial ? spec.install : `${spec.install}  (install only if absent)`,
	}));

	return { platform, goal, required: wanted.map(spec => spec.binary), ready, steps, companions, notes: buildNotes(steps, platform, goal) };
}

function buildNotes(steps: readonly InstallStep[], platform: Platform, goal: Goal): string[] {
	const notes: string[] = [];
	const blocked = steps.filter(step => step.reason === "blocked");
	const installable = steps.filter(step => step.reason === "missing");
	const noRecipe = steps.filter(step => step.reason === "no-recipe");

	if (blocked.length > 0) {
		notes.push(
			`The host refused ${blocked.map(step => step.binary).join(", ")}. That is a permission problem, not a`,
			"missing install: the executable is declared in plugin.json#commands but disabled, or the plugin does",
			"not hold agent.command.run. Ask the user to enable it in the plugin settings — installing again changes nothing.",
		);
	}
	if (installable.length > 0) {
		notes.push(
			"Run each command in a terminal, then call probe_environment with refresh=true. Nothing is installed by",
			"this plugin; the commands below are the whole intervention.",
		);
	}
	if (noRecipe.length > 0) {
		notes.push(
			`${noRecipe.map(step => step.binary).join(", ")} usually ${noRecipe.length === 1 ? "ships" : "ship"} with another package in this list — install that instead.`,
		);
	}
	if (platform === "windows" && installable.some(step => /^scoop|^sdkmanager/.test(step.command ?? ""))) {
		notes.push("Some Windows commands assume scoop or an Android SDK on PATH; winget equivalents exist but differ per machine.");
	}
	if (goal === "full") {
		notes.push("Goal is everything the plugin can drive; pass a narrower goal to skip tools this sample cannot use.");
	}
	return notes;
}

/** Numbered so the agent can report progress per command instead of "ran the block". */
export function renderPlan(plan: InstallPlan): string {
	const lines = [
		`Install plan — goal: ${GOAL_LABEL[plan.goal]} (${plan.goal}), platform: ${plan.platform}`,
		"",
	];

	if (plan.ready.length > 0) lines.push(`Already available: ${plan.ready.join(", ")}`);
	if (plan.steps.length === 0) {
		lines.push("Nothing to install: every tool this goal needs answered a version probe.");
	} else {
		lines.push("Missing:");
		plan.steps.forEach((step, index) => {
			const mark = step.reason === "blocked" ? "!" : step.reason === "missing" ? "✗" : "·";
			const suffix = step.elevated ? "  [needs administrator]" : "";
			lines.push(`  ${index + 1}. ${mark} ${step.binary} — ${step.purpose}${suffix}`);
		});
	}

	const runnable = plan.steps.filter(step => step.command);
	if (runnable.length > 0) {
		lines.push("", "Commands:");
		// One command may unlock several binaries (android-commandlinetools → apksigner + zipalign).
		// Printing it twice wastes a password prompt and looks like a mistake.
		const grouped = new Map<string, string[]>();
		for (const step of runnable) {
			const list = grouped.get(step.command as string) ?? [];
			list.push(step.binary);
			grouped.set(step.command as string, list);
		}
		let index = 0;
		for (const [command, binaries] of grouped) {
			index += 1;
			const covers = binaries.length > 1 ? `  (for ${binaries.join(", ")})` : "";
			lines.push(`  ${index}. ${command}${covers}`);
		}
	}

	const commercial = plan.companions.filter(spec => spec.commercial);
	const free = plan.companions.filter(spec => !spec.commercial);
	if (free.length > 0) {
		lines.push("", "Optional, no permission needed (the plugin never spawns these):");
		for (const spec of free) lines.push(`  · ${spec.name} — ${spec.purpose}: ${spec.install}`);
	}
	if (commercial.length > 0) {
		lines.push("", "Commercial, user-supplied:");
		for (const spec of commercial) lines.push(`  · ${spec.name} — ${spec.purpose}: ${spec.install}`);
	}

	if (plan.notes.length > 0) lines.push("", ...plan.notes);
	return lines.join("\n");
}
