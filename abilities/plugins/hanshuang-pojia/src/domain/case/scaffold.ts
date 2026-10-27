/**
 * Scaffolding a shipped precedent into a working directory.
 *
 * A precedent package is text: case.json, four canonical documents, extra method
 * notes, and (since ADR 0008) a `tools/` directory of Python scripts. The text is
 * inlined into the bundle; the scripts are published as plain files under
 * `dist/assets/cases/`, because a script that is not on disk cannot be executed.
 *
 * This module plans the copy and reads the bytes. It never runs anything: the
 * operator gets a directory and the exact command lines, and decides when to run
 * them. Authorisation still comes from scope.md (auth.status=pending), not from
 * the precedent.
 */
import type { ShippedPrecedent } from "./precedents";

/** Package resources live next to the docs tree, under the same asset root. */
const CASE_PREFIX = "cases/";

/** Kit modules every tool imports; kept in sync by src/test/case-scaffold.test.ts. */
export const HPKIT_FILES = [
	"__init__.py",
	"cli.py",
	"dex.py",
	"fixtures.py",
	"patch.py",
	"pe.py",
	"scan.py",
	"selftest.py",
] as const;

export interface ScaffoldFile {
	/** Path relative to the scaffolded case directory, e.g. `tools/gate_scan.py`. */
	readonly path: string;
	/** Package-relative source, e.g. `cases/client-auth-gate/tools/gate_scan.py`. */
	readonly source: string;
}

export interface ScaffoldPlan {
	readonly slug: string;
	readonly directory: string;
	readonly files: readonly ScaffoldFile[];
	/** Commands the operator can run immediately, in the order worth running them. */
	readonly commands: readonly string[];
}

export interface ScaffoldOptions {
	/** Directory to scaffold into. Defaults to `<cwd>/<slug>`. */
	readonly into?: string;
	readonly cwd?: string;
}

export function scaffoldCommands(precedent: ShippedPrecedent): string[] {
	const entries = precedent.tools?.tools ?? [];
	const commands: string[] = [];
	for (const tool of entries) {
		commands.push(`${precedent.tools.runtime === "python" ? "python3" : "node"} tools/${tool.entry} --self-test`);
	}
	for (const tool of entries) {
		const args = tool.args
			.map(arg => (arg.startsWith("--") ? arg.replace(/<[^>]*>/g, "<value>") : arg))
			.join(" ");
		commands.push(`${precedent.tools.runtime === "python" ? "python3" : "node"} tools/${tool.entry} ${args}`.trim());
	}
	return commands;
}

/** The copy plan for one precedent: its tools plus the shared kit they import. */
export function planScaffold(precedent: ShippedPrecedent, options: ScaffoldOptions = {}): ScaffoldPlan {
	const base = (options.into ?? options.cwd ?? ".").replace(/[\\/]+$/, "");
	const directory = options.into ? base : `${base === "." ? "" : `${base}/`}${precedent.slug}`;
	const files: ScaffoldFile[] = [];

	files.push({
		path: "tools/manifest.json",
		source: `cases/${precedent.slug}/tools/manifest.json`,
	});
	for (const tool of precedent.tools?.tools ?? []) {
		files.push({ path: `tools/${tool.entry}`, source: `cases/${precedent.slug}/tools/${tool.entry}` });
	}
	for (const name of HPKIT_FILES) {
		files.push({ path: `tools/hpkit/${name}`, source: `cases/_shared/hpkit/${name}` });
	}

	return { slug: precedent.slug, directory, files, commands: scaffoldCommands(precedent) };
}

/**
 * Read one package resource as text.
 *
 * Unit tests run in Node, where `import.meta.url` is a `file:` URL: read the source
 * tree so the test sees the same bytes the build publishes. At run time the plugin
 * answers `astravia-plugin://` for its own files, so no host fs grant is involved.
 */
export async function readCaseText(source: string): Promise<string> {
	const rel = source.startsWith(CASE_PREFIX) ? source.slice(CASE_PREFIX.length) : source;
	if (import.meta.url.startsWith("file:")) {
		const specifier = "node:fs/promises";
		const { readFile } = (await import(/* @vite-ignore */ specifier)) as typeof import("node:fs/promises");
		const root = "../../../";
		return readFile(new URL(root + (CASE_PREFIX + rel), import.meta.url), "utf8");
	}
	const url = new URL(import.meta.url);
	url.pathname =
		url.protocol === "astravia-plugin:"
			? url.pathname.replace(/\/assets\/[^/]*$/, `/assets/cases/${rel}`)
			: `/${CASE_PREFIX}${rel}`;
	const response = await fetch(url.toString());
	if (!response.ok) throw new Error(`case resource unavailable (${response.status}): ${rel}`);
	return response.text();
}

export function renderScaffoldPlan(plan: ScaffoldPlan, written: readonly string[], skipped: readonly string[]): string {
	const lines = [
		`### ${plan.slug} — scaffolded into ${plan.directory}`,
		"",
		`- files written: ${written.length}`,
		...(skipped.length > 0 ? [`- left untouched (already present): ${skipped.length}`] : []),
		`- layout: tools/*.py next to tools/hpkit/ — the scripts resolve the kit themselves`,
		"",
		"Run these from the case directory:",
		"",
		...plan.commands.map(command => `    ${command}`),
		"",
		"Nothing was executed and nothing was authorised: the copied scope.md still says auth.status=pending.",
		"Declare the real scope with init_task before touching a sample.",
	];
	return lines.join("\n");
}
