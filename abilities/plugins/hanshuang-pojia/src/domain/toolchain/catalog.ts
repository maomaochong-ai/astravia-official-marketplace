/**
 * External toolchain catalog.
 *
 * The host runs an external executable only when `plugin.json#commands` declares
 * it and the user leaves it enabled, so this file is the single source of truth
 * for both the declaration and the honest capability report. Nothing here is
 * bundled with the plugin: every entry names a tool the user installs.
 */

/** Result of one external invocation, normalised so callers never see host errors. */
export interface CommandResult {
	stdout: string;
	stderr: string;
	exitCode: number | null;
}

export interface CommandRunOptions {
	timeoutMs?: number;
}

/** Injected in tests; bound to `ctx.command.run` in the plugin runtime. */

/** One executable plus its argument vector. Shared by every planner, so both halves name a process the same way. */
export interface Invocation {
	file: string;
	args: string[];
	timeoutMs: number;
}
export type CommandRunner = (
	file: string,
	args: readonly string[],
	options?: CommandRunOptions,
) => Promise<CommandResult>;

/** Capability a tool contributes. Tools may provide more than one. */
export type Capability =
	| "radare"
	| "radiff"
	| "rasm"
	| "jadx"
	| "apktool"
	| "java"
	| "frida";

export type ToolId = "r2" | "rabin2" | "radiff2" | "rasm2" | "jadx" | "apktool" | "java" | "frida";

export interface ToolSpec {
	id: ToolId;
	/** Executable name as resolved from PATH by the host. Must appear in {@link COMMANDS}. */
	binary: string;
	/** Arguments that print the version and exit. */
	versionArgs: readonly string[];
	/** Capabilities this tool unlocks. */
	provides: readonly Capability[];
	/** One-line install hint shown when the probe reports it missing. */
	install: string;
}

export const TOOLCHAIN: readonly ToolSpec[] = [
	{
		id: "r2",
		binary: "r2",
		versionArgs: ["-v"],
		provides: ["radare"],
		install: "brew install radare2 | winget install radare.radare2",
	},
	{
		id: "rabin2",
		binary: "rabin2",
		versionArgs: ["-v"],
		provides: ["radare"],
		install: "ships with radare2",
	},
	{
		id: "radiff2",
		binary: "radiff2",
		versionArgs: ["-v"],
		provides: ["radiff"],
		install: "ships with radare2",
	},
	{
		id: "rasm2",
		binary: "rasm2",
		versionArgs: ["-v"],
		provides: ["rasm"],
		install: "ships with radare2",
	},
	{
		id: "jadx",
		binary: "jadx",
		versionArgs: ["--version"],
		provides: ["jadx"],
		install: "brew install jadx | winget install skylot.jadx",
	},
	{
		id: "apktool",
		binary: "apktool",
		versionArgs: ["--version"],
		provides: ["apktool"],
		install: "brew install apktool | winget install apktool",
	},
	{
		id: "java",
		binary: "java",
		versionArgs: ["-version"],
		provides: ["java"],
		install: "JDK 17 or newer; jadx and apktool refuse to start without it",
	},
	{
		id: "frida",
		binary: "frida",
		versionArgs: ["--version"],
		provides: ["frida"],
		install: "pipx install frida-tools",
	},
];

/**
 * Must stay byte-identical to `plugin.json#commands`. An undeclared binary is
 * refused by the host, and a declared-but-unused binary asks the user for a
 * permission nothing needs — both are defects caught by `toolchain.test.ts`.
 */
export const COMMANDS: readonly string[] = TOOLCHAIN.map(spec => spec.binary);

export const CAPABILITY_LABEL: Record<Capability, string> = {
	radare: "radare2 analysis (info, strings, functions, disassembly, pseudo-C, xrefs)",
	radiff: "radiff2 binary comparison",
	rasm: "rasm2 assemble / disassemble",
	jadx: "jadx Java decompilation",
	apktool: "apktool unpack and smali extraction",
	java: "Java runtime for jadx / apktool",
	frida: "Frida CLI (runtime observation only)",
};

export function specFor(id: ToolId): ToolSpec {
	const spec = TOOLCHAIN.find(item => item.id === id);
	if (!spec) throw new Error(`unknown tool: ${id}`);
	return spec;
}

/** Specs that must all be available before `capability` can be claimed. */
export function specsForCapability(capability: Capability): readonly ToolSpec[] {
	if (capability === "jadx") return TOOLCHAIN.filter(item => item.provides.includes("jadx") || item.id === "java");
	if (capability === "apktool") return TOOLCHAIN.filter(item => item.provides.includes("apktool") || item.id === "java");
	return TOOLCHAIN.filter(item => item.provides.includes(capability));
}
