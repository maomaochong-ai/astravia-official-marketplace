/**
 * External toolchain catalog.
 *
 * The host runs an external executable only when `plugin.json#commands` declares
 * it and the user leaves it enabled, so this file is the single source of truth
 * for both the declaration and the honest capability report. Nothing here is
 * bundled with the plugin: every entry names a tool the user installs.
 *
 * Two lists live here on purpose:
 *
 * - {@link TOOLCHAIN} — the executables this plugin probes and drives. Every
 *   `binary` must appear in `plugin.json#commands`, because probing one costs a
 *   declaration and a user grant.
 * - {@link COMPANIONS} — tools the workflow recommends but the plugin never
 *   spawns (runtimes, commercial suites, CLIs a sibling step shells out to). They
 *   take no permission and are only ever named in an install plan.
 *
 * The install recipes are per platform because the same tool has a different
 * package name on brew, apt and winget. A missing recipe is deliberate: either
 * the tool ships with another entry, or it is commercial and the user owns it.
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
	| "rahash"
	| "rax"
	| "jadx"
	| "apktool"
	| "java"
	| "adb"
	| "apksigner"
	| "zipalign"
	| "frida";

/** The three platforms a recipe can target. Derived from the renderer user agent. */
export type Platform = "darwin" | "linux" | "windows";

/** What the user is trying to do; the install planner maps one of these to tools. */
export type Goal = "apk" | "native" | "firmware" | "dynamic" | "full";

export type ToolId =
	| "r2"
	| "rabin2"
	| "radiff2"
	| "rasm2"
	| "rahash2"
	| "rax2"
	| "jadx"
	| "apktool"
	| "java"
	| "adb"
	| "apksigner"
	| "zipalign"
	| "frida"
	| "frida-ps";

export interface ToolSpec {
	id: ToolId;
	/** Executable name as resolved from PATH by the host. Must appear in {@link COMMANDS}. */
	binary: string;
	/** Arguments that print the version and exit. */
	versionArgs: readonly string[];
	/** Capabilities this tool unlocks. */
	provides: readonly Capability[];
	/** One line, for the install plan: what the tool is actually for. */
	purpose: string;
	/** One-line install hint shown when the probe reports it missing. */
	install: string;
	/** Per-platform install command. Absent when the tool ships with another entry. */
	recipe?: Readonly<Partial<Record<Platform, string>>>;
	/** Goals that need this tool, so a plan never installs a disassembler for an APK-only job. */
	goals: readonly Goal[];
}

/** A tool the workflow names but this plugin never spawns. */
export interface CompanionSpec {
	name: string;
	purpose: string;
	/** Goals that benefit from it. Empty means "only when the user asks". */
	goals: readonly Goal[];
	recipe?: Readonly<Partial<Record<Platform, string>>>;
	install: string;
	/** Commercial or otherwise not freely installable: the plan tells the user to supply it. */
	commercial?: boolean;
}
export const TOOLCHAIN: readonly ToolSpec[] = [
	{
		id: "r2",
		binary: "r2",
		versionArgs: ["-v"],
		provides: ["radare"],
		purpose: "radare2 disassembly, analysis and pseudo-C",
		install: "brew install radare2 | winget install radare.radare2",
		recipe: {
			darwin: "brew install radare2",
			linux: "sudo apt-get install -y radare2",
			windows: "winget install --id radare.radare2 -e",
		},
		goals: ["native", "firmware", "apk", "full"],
	},
	{
		id: "rabin2",
		binary: "rabin2",
		versionArgs: ["-v"],
		provides: ["radare"],
		purpose: "binary metadata, imports, sections",
		install: "ships with radare2",
		goals: ["native", "firmware", "apk", "full"],
	},
	{
		id: "radiff2",
		binary: "radiff2",
		versionArgs: ["-v"],
		provides: ["radiff"],
		purpose: "binary and function-level diff",
		install: "ships with radare2",
		goals: ["native", "full"],
	},
	{
		id: "rasm2",
		binary: "rasm2",
		versionArgs: ["-v"],
		provides: ["rasm"],
		purpose: "assemble / disassemble one instruction",
		install: "ships with radare2",
		goals: ["native", "full"],
	},
	{
		id: "rahash2",
		binary: "rahash2",
		versionArgs: ["-v"],
		provides: ["rahash"],
		purpose: "hashes, entropy and byte-pattern search",
		install: "ships with radare2",
		goals: ["native", "firmware", "apk", "full"],
	},
	{
		id: "rax2",
		binary: "rax2",
		versionArgs: ["-v"],
		provides: ["rax"],
		purpose: "number base and string conversion",
		install: "ships with radare2",
		goals: ["native", "full"],
	},
	{
		id: "jadx",
		binary: "jadx",
		versionArgs: ["--version"],
		provides: ["jadx"],
		purpose: "DEX to Java decompilation",
		install: "brew install jadx | winget install skylot.jadx",
		recipe: {
			darwin: "brew install jadx",
			linux: "sudo apt-get install -y jadx",
			windows: "winget install --id skylot.jadx -e",
		},
		goals: ["apk", "full"],
	},
	{
		id: "apktool",
		binary: "apktool",
		versionArgs: ["--version"],
		provides: ["apktool"],
		purpose: "APK unpack and smali extraction",
		install: "brew install apktool | scoop install apktool",
		recipe: {
			darwin: "brew install apktool",
			linux: "sudo apt-get install -y apktool",
			windows: "scoop install apktool",
		},
		goals: ["apk", "full"],
	},
	{
		id: "java",
		binary: "java",
		versionArgs: ["-version"],
		provides: ["java"],
		purpose: "JDK 17+, required by jadx and apktool",
		install: "JDK 17 or newer; jadx and apktool refuse to start without it",
		recipe: {
			darwin: "brew install --cask temurin@17",
			linux: "sudo apt-get install -y openjdk-17-jdk-headless",
			windows: "winget install --id EclipseAdoptium.Temurin.17.JDK -e",
		},
		goals: ["apk", "full"],
	},
	{
		id: "adb",
		binary: "adb",
		versionArgs: ["version"],
		provides: ["adb"],
		purpose: "pull an installed APK off a device",
		install: "brew install --cask android-platform-tools | winget install Google.PlatformTools",
		recipe: {
			darwin: "brew install --cask android-platform-tools",
			linux: "sudo apt-get install -y adb",
			windows: "winget install --id Google.PlatformTools -e",
		},
		goals: ["apk", "dynamic", "full"],
	},
	{
		id: "apksigner",
		binary: "apksigner",
		versionArgs: ["--version"],
		provides: ["apksigner"],
		purpose: "verify an APK signature before trusting it",
		install: "Android build-tools; sdkmanager 'build-tools;35.0.0'",
		recipe: {
			darwin: "brew install android-commandlinetools && sdkmanager 'build-tools;35.0.0'",
			linux: "sudo apt-get install -y android-sdk-build-tools",
			windows: "sdkmanager \"build-tools;35.0.0\"",
		},
		goals: ["apk", "full"],
	},
	{
		id: "zipalign",
		binary: "zipalign",
		versionArgs: ["-h"],
		provides: ["zipalign"],
		purpose: "4-byte alignment check on a rebuilt APK",
		install: "Android build-tools; sdkmanager 'build-tools;35.0.0'",
		recipe: {
			darwin: "brew install android-commandlinetools && sdkmanager 'build-tools;35.0.0'",
			linux: "sudo apt-get install -y android-sdk-build-tools",
			windows: "sdkmanager \"build-tools;35.0.0\"",
		},
		goals: ["apk", "full"],
	},
	{
		id: "frida",
		binary: "frida",
		versionArgs: ["--version"],
		provides: ["frida"],
		purpose: "runtime hooking and observation",
		install: "pipx install frida-tools",
		recipe: {
			darwin: "pipx install frida-tools",
			linux: "pipx install frida-tools",
			windows: "pip install --user frida-tools",
		},
		goals: ["dynamic", "full"],
	},
	{
		id: "frida-ps",
		binary: "frida-ps",
		versionArgs: ["--version"],
		provides: ["frida"],
		purpose: "list processes on a device or host before attaching",
		install: "pipx install frida-tools",
		recipe: {
			darwin: "pipx install frida-tools",
			linux: "pipx install frida-tools",
			windows: "pip install --user frida-tools",
		},
		goals: ["dynamic", "full"],
	},
];

/**
 * Tools the workflow tells the user about but never spawns. Keeping them out of
 * {@link TOOLCHAIN} is what keeps `plugin.json#commands` short: a declaration
 * costs a permission the plugin would never exercise.
 */
export const COMPANIONS: readonly CompanionSpec[] = [
	{
		name: "python3",
		purpose: "run the bundled helper scripts that prefer a real interpreter",
		goals: ["full"],
		recipe: {
			darwin: "brew install python@3.12",
			linux: "sudo apt-get install -y python3",
			windows: "winget install --id Python.Python.3.12 -e",
		},
		install: "brew install python@3.12 | winget install Python.Python.3.12",
	},
	{
		name: "node",
		purpose: "Frida gadget scripts and the JS-side helpers",
		goals: ["dynamic", "full"],
		recipe: {
			darwin: "brew install node",
			linux: "sudo apt-get install -y nodejs",
			windows: "winget install --id OpenJS.NodeJS.LTS -e",
		},
		install: "brew install node | winget install OpenJS.NodeJS.LTS",
	},
	{
		name: "binwalk",
		purpose: "carve embedded filesystems and signatures out of firmware",
		goals: ["firmware", "full"],
		recipe: {
			darwin: "brew install binwalk",
			linux: "sudo apt-get install -y binwalk",
			windows: "pip install binwalk",
		},
		install: "brew install binwalk | pip install binwalk",
	},
	{
		name: "yara",
		purpose: "match known malware families against a sample",
		goals: ["full"],
		recipe: {
			darwin: "brew install yara",
			linux: "sudo apt-get install -y yara",
			windows: "winget install --id VirusTotal.YARA -e",
		},
		install: "brew install yara | winget install VirusTotal.YARA",
	},
	{
		name: "nmap",
		purpose: "inventory the services a device exposes before auditing an app",
		goals: [],
		recipe: {
			darwin: "brew install nmap",
			linux: "sudo apt-get install -y nmap",
			windows: "winget install --id Insecure.Nmap -e",
		},
		install: "brew install nmap | winget install Insecure.Nmap",
	},
	{
		name: "ida",
		purpose: "commercial decompiler; the plugin uses radare2 when it is absent",
		goals: [],
		install: "IDA Pro / IDA Free from hex-rays.com — licence required, never installed by the plugin",
		commercial: true,
	},
	{
		name: "binaryninja",
		purpose: "commercial decompiler with a strong headless API",
		goals: [],
		install: "Binary Ninja from binary.ninja — licence required, never installed by the plugin",
		commercial: true,
	},
	{
		name: "jeb-pro",
		purpose: "commercial Android / ARM decompiler with a stronger DEX-to-Java accuracy",
		goals: [],
		install: "JEB Pro from pentest-ground.com — licence required, never installed by the plugin",
		commercial: true,
	},
	{
		name: "analyzeHeadless",
		purpose: "Ghidra headless analysis, the free alternative when IDA is not available",
		goals: ["native", "full"],
		recipe: {
			darwin: "brew install --cask ghidra",
			linux: "sudo apt-get install -y ghidra",
			windows: "winget install --id NSA.Ghidra -e",
		},
		install: "brew install --cask ghidra | winget install NSA.Ghidra",
	},
	{
		name: "pip",
		purpose: "install the Python-side helpers (frida-tools, binwalk, pwntools)",
		goals: ["dynamic", "firmware", "full"],
		recipe: {
			darwin: "python3 -m ensurepip --upgrade",
			linux: "sudo apt-get install -y python3-pip",
			windows: "python -m ensurepip --upgrade",
		},
		install: "ships with python3 (ensurepip)",
	},
	{
		name: "pwntools",
		purpose: "CTF exploit development and ELF interaction",
		goals: [],
		recipe: {
			darwin: "pipx install pwntools",
			linux: "pipx install pwntools",
			windows: "pip install --user pwntools",
		},
		install: "pipx install pwntools",
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
	rahash: "rahash2 hashes, entropy and pattern search",
	rax: "rax2 number and string conversion",
	jadx: "jadx Java decompilation",
	apktool: "apktool unpack and smali extraction",
	java: "Java runtime for jadx / apktool",
	adb: "adb device access (pull the APK being audited)",
	apksigner: "apksigner signature verification",
	zipalign: "zipalign alignment check on a rebuilt APK",
	frida: "Frida CLI (runtime observation only)",
};

export const GOAL_LABEL: Record<Goal, string> = {
	apk: "Android APK (unpack, decompile, signature, manifest)",
	native: "native binary (ELF / Mach-O / PE)",
	firmware: "firmware image (carving, entropy, embedded filesystems)",
	dynamic: "runtime behaviour (device, Frida, hooks)",
	full: "everything the plugin can drive",
};

/** Which platform a recipe set should be read for. Defaults to linux so tests stay deterministic. */
export function resolvePlatform(value?: string | null): Platform {
	if (value === "darwin") return "darwin";
	if (value === "windows" || value === "win32") return "windows";
	return "linux";
}

/** Reads the renderer user agent; the SDK exposes no platform field. */
export function detectPlatform(userAgent: string | undefined): Platform {
	const agent = userAgent ?? "";
	if (/Macintosh|Mac OS X/i.test(agent)) return "darwin";
	if (/Windows|Win64|WOW64/i.test(agent)) return "windows";
	return "linux";
}

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
