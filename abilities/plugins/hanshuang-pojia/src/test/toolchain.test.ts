import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CommandResult, CommandRunner } from "../domain/toolchain/catalog";
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	MAX_SEARCH_CHARS,
	defaultOutputDir,
	planAndroid,
	renderSearch,
	searchSourceTree,
} from "../domain/toolchain/android";
import { COMMANDS, TOOLCHAIN, specFor, specsForCapability, type ToolId } from "../domain/toolchain/catalog";
import { probeToolchain, renderToolchain } from "../domain/toolchain/probe";
import { OPERATION_TOOL, branchSkeleton, planRadare } from "../domain/toolchain/radare";
import { initTaskWorkspace, safeTaskName } from "../domain/toolchain/workspace";
import {
	createCommandRunner,
	describeCommandFailure,
	probeOnce,
	resetProbeCache,
} from "../features/workbench/services/toolchain";
import { registerDecompileAndroidTool } from "../tools/decompile-android";
import { registerInitTaskTool } from "../tools/init-task";
import { registerProbeEnvironmentTool } from "../tools/probe-environment";
import { registerRunRadareTool } from "../tools/run-radare";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function ok(stdout: string): CommandResult {
	return { stdout, stderr: "", exitCode: 0 };
}

/** Every declared executable answers with a version banner; nothing else runs. */
const allPresent: CommandRunner = async file => ok(`${file} 5.9.0\n`);

function failing(predicate: (file: string) => boolean, message: (file: string) => string): CommandRunner {
	return async file => {
		if (predicate(file)) throw new Error(message(file));
		return ok(`${file} 5.9.0\n`);
	};
}

beforeEach(() => {
	resetProbeCache();
});

describe("toolchain declaration", () => {
	const manifest = JSON.parse(readFileSync(join(pluginRoot, "plugin.json"), "utf8")) as {
		commands?: string[];
		permissions?: string[];
	};

	it("declares exactly the executables the catalog says it runs", () => {
		expect(manifest.commands).toEqual([...COMMANDS]);
	});

	it("asks for the command permission the runner needs", () => {
		expect(manifest.permissions).toContain("agent.command.run");
	});

	it("keeps one binary per spec and an install hint for each", () => {
		const binaries = TOOLCHAIN.map(spec => spec.binary);
		expect(new Set(binaries).size).toBe(binaries.length);
		for (const spec of TOOLCHAIN) {
			expect(spec.provides.length).toBeGreaterThan(0);
			expect(spec.install.length).toBeGreaterThan(0);
			expect(COMMANDS).toContain(spec.binary);
		}
	});

	it("refuses an unknown tool id instead of guessing", () => {
		expect(() => specFor("nope" as ToolId)).toThrow("unknown tool: nope");
	});

	it("requires java before claiming jadx or apktool is usable", () => {
		expect(specsForCapability("jadx").map(spec => spec.id)).toEqual(["jadx", "java"]);
		expect(specsForCapability("apktool").map(spec => spec.id)).toEqual(["apktool", "java"]);
	});
});

describe("probeToolchain", () => {
	it("reports a banner for every runnable tool", async () => {
		const report = await probeToolchain(allPresent);
		expect(report.tools).toHaveLength(TOOLCHAIN.length);
		expect(report.tools.every(tool => tool.available)).toBe(true);
		expect(report.tools[0]?.detail).toContain("5.9.0");
		expect(report.missing).toEqual([]);
		const text = renderToolchain(report);
		expect(text).toContain("✓");
		expect(text).toContain("Available:");
		expect(text).not.toContain("host refused");
	});

	it("separates a missing executable from a refused command", async () => {
		const report = await probeToolchain(
			failing(
				file => file === "jadx" || file === "r2",
				file => (file === "r2" ? `Command "r2" is not declared in plugin.json#commands` : "spawn jadx ENOENT"),
			),
		);
		const r2 = report.tools.find(tool => tool.id === "r2");
		const jadx = report.tools.find(tool => tool.id === "jadx");
		const rabin2 = report.tools.find(tool => tool.id === "rabin2");

		expect(r2?.blocked).toBe(true);
		expect(r2?.install).toBeUndefined();
		expect(r2?.detail).toContain("host refused");
		expect(jadx?.blocked).toBe(false);
		expect(jadx?.install).toBeTruthy();
		// A capability is only claimed when every binary it needs answers: a refused r2 leaves
		// rabin2 usable for info/strings but disassembly and function listing still dead.
		expect(report.capabilities.radare).toBe(false);
		expect(rabin2?.available).toBe(true);

		const text = renderToolchain(report);
		expect(text).toContain("Missing:");
		expect(text).toContain("The host refused these commands.");
	});

	it("does not claim jadx while java is missing", async () => {
		const report = await probeToolchain(failing(file => file === "java", () => "spawn java ENOENT"));
		expect(report.tools.find(tool => tool.id === "jadx")?.available).toBe(true);
		expect(report.capabilities.jadx).toBe(false);
		expect(report.missing).toContain("jadx");
	});

	it("treats a zero exit without a banner as present", async () => {
		const report = await probeToolchain(async () => ok(""));
		expect(report.tools.every(tool => tool.available && tool.detail === "present")).toBe(true);
	});

	it("does not call a tool available when it exits non-zero with a banner", async () => {
		// `jadx --version` without a JDK prints an error and exits 1: available: true would send the
		// user to reinstall jadx instead of installing Java.
		const report = await probeToolchain(async () => ({
			stdout: "",
			stderr: "Error: JAVA_HOME is not set",
			exitCode: 1,
		}));
		for (const tool of report.tools) {
			expect(tool.available).toBe(false);
			expect(tool.blocked).toBe(false);
			expect(tool.detail).toContain("exited with 1");
		}
	});
});

describe("command runner", () => {
	function context(permissions: string[], run?: CommandRunner) {
		return {
			permissions: { has: (permission: string) => permissions.includes(permission) },
			command: run ? { run } : undefined,
		} as unknown as PluginContext;
	}

	it("returns null when the permission is missing", () => {
		expect(createCommandRunner(context([]))).toBeNull();
	});

	it("returns null when the host exposes no command api", () => {
		expect(createCommandRunner(context(["agent.command.run"]))).toBeNull();
	});

	it("normalises the host result and copies the argument list", async () => {
		const seen: { file: string; args: readonly string[] }[] = [];
		const ctx = context(["agent.command.run"], async (file, args) => {
			seen.push({ file, args });
			return { stdout: undefined, stderr: undefined, exitCode: undefined } as unknown as CommandResult;
		});
		const run = createCommandRunner(ctx);
		expect(run).not.toBeNull();
		const args = ["-I", "a.apk"];
		const result = await run!("rabin2", args);
		expect(seen[0]?.file).toBe("rabin2");
		expect(seen[0]?.args).not.toBe(args);
		expect(result).toEqual({ stdout: "", stderr: "", exitCode: null });
	});

	it("caches the probe for a minute and re-runs only on refresh", async () => {
		const run = vi.fn(allPresent);
		await probeOnce(run);
		await probeOnce(run);
		expect(run).toHaveBeenCalledTimes(TOOLCHAIN.length);
		await probeOnce(run, { refresh: true });
		expect(run).toHaveBeenCalledTimes(TOOLCHAIN.length * 2);
	});

	it("names the right remedy for each failure shape", () => {
		expect(describeCommandFailure(new Error('Command "r2" is not declared in plugin.json#commands'))).toContain(
			"host refused",
		);
		expect(describeCommandFailure(new Error("spawn jadx ENOENT"))).toContain("not found");
		// 未找到时要提示该装什么并引导安装，而不是只报缺。
		expect(describeCommandFailure(new Error("spawn jadx ENOENT"))).toMatch(/install_toolchain/);
		expect(describeCommandFailure(new Error("spawn jadx ENOENT"))).toMatch(/exact install command/);
		expect(describeCommandFailure(new Error("boom"))).toContain("could not be started");
	});
});

describe("unbounded cmd passthrough", () => {
	it("accepts every r2 command word, mirroring seep_r2_cmd's zero-limit -c", () => {
		// The cmd channel no longer filters by read-only families: any command word is accepted,
		// matching the upstream server which splices `aaa; {command}` straight into `-c`.
		for (const command of ["wx 90", "Wx 90", "wa nop", "!sh", "oo+", "Oh", "dc", "Dh", "Ps", "R", "m /tmp/x", "M /media"]) {
			expect(() => planRadare({ operation: "cmd", path: "/w/demo.elf", command })).not.toThrow();
		}
	});

	it("keeps the argument vector intact — shell escapes are not r2 commands", () => {
		// The channel runs execFile semantics: no shell is involved, so pipes / redirects /
		// substitution are passed to r2 verbatim (r2 will treat them as command syntax), not executed.
		for (const command of ["pdf @ main|sh", "pdf @ main > /tmp/out", "afl$(id)", "afl`id`"]) {
			expect(() => planRadare({ operation: "cmd", path: "/w/demo.elf", command })).not.toThrow();
		}
	});

	it("reports an empty command instead of running a bare r2", () => {
		expect(() => planRadare({ operation: "cmd", path: "/w/demo.elf", command: "   " })).toThrow("empty radare2 command");
	});
});

describe("planRadare", () => {
	const path = "/work/demo.elf";

	it("uses rabin2 for headers and strings", () => {
		const info = planRadare({ operation: "info", path });
		expect(info.invocations[0]).toMatchObject({ file: "rabin2", args: ["-I", path] });
		expect(info.render([ok("arch x86\nbits 64\n")])).toContain("arch x86");

		const strings = planRadare({ operation: "strings", path });
		expect(strings.invocations[0]?.args).toEqual(["-z", path]);
		const every = planRadare({ operation: "strings", path, allSections: true });
		expect(every.invocations[0]?.args).toEqual(["-zz", path]);
	});

	it("asks r2 for analysis exactly once", () => {
		const plan = planRadare({ operation: "functions", path });
		expect(plan.invocations[0]?.file).toBe("r2");
		expect(plan.invocations[0]?.args).toContain("aaa; afl");
		expect(plan.render([ok("0x1000 42 main\n")])).toContain("main");
	});

	it("shapes disassembly by output mode", () => {
		const listing = [
			"0x1000 lea rdi, [rbx]",
			"0x1004 cmp eax, 1",
			"0x1008 je 0x1010",
			"0x100c ret",
		].join("\n");
		const fold = planRadare({ operation: "disasm", path, target: "sym.main", outputMode: "fold" });
		expect(fold.invocations[0]?.args).toContain("aaa; pdf @ sym.main");
		const folded = fold.render([ok(listing)]);
		expect(folded).toContain("[branch — kept 3/4 lines");
		expect(folded).toContain("je 0x1010");
		expect(folded).not.toContain("lea rdi");

		const summary = planRadare({ operation: "decompile", path, outputMode: "summary" });
		expect(summary.invocations.map(item => item.args.at(-2))).toEqual([
			"aaa; afi @ main",
			"aaa; axt @ main",
			"aaa; axf @ main",
		]);
		const shaped = summary.render([ok("size 42"), ok("main + 0x10"), ok("sym.imp.printf")]);
		expect(shaped).toContain("no instructions, only shape");
		expect(shaped).toContain("callers (xrefs to)");
	});

	it("says so when a build has no pdc instead of returning silence", () => {
		const plan = planRadare({ operation: "decompile", path, target: "sym.main" });
		const text = plan.render([ok("")]);
		expect(text).toContain("may not ship pdc");
	});


	it("paginates long output and says what it dropped", () => {
		const plan = planRadare({ operation: "strings", path, limit: 2 });
		const text = plan.render([ok("one\ntwo\nthree\n")]);
		expect(text).toContain("... [truncated: showing 2 of 3 strings]");
	});

	it("reports a failing r2 instead of an empty result", () => {
		const plan = planRadare({ operation: "disasm", path });
		const text = plan.render([{ stdout: "", stderr: "Cannot find function at 0x0", exitCode: 1 }]);
		expect(text).toContain("radare2 exited 1: Cannot find function at 0x0");
	});

	it("maps every operation to the executable it needs", () => {
		expect(OPERATION_TOOL.info).toBe("rabin2");
		expect(OPERATION_TOOL.diff).toBe("radiff2");
		expect(OPERATION_TOOL.asm).toBe("rasm2");
		expect(OPERATION_TOOL.cmd).toBe("r2");
	});

	it("passes diff mode and rasm2 flags through", () => {
		const stats = planRadare({ operation: "diff", path, otherPath: "/work/b.elf", diffMode: "stats" });
		expect(stats.invocations[0]).toMatchObject({ file: "radiff2", args: ["-s", path, "/work/b.elf"] });

		const asm = planRadare({ operation: "asm", code: "nop", bits: 32 });
		expect(asm.invocations[0]?.args).toEqual(["-a", "x86", "-b", "32", "nop"]);
		const disasm = planRadare({ operation: "asm", code: "90", disassemble: true });
		expect(disasm.invocations[0]?.args).toEqual(["-a", "x86", "-b", "64", "-d", "90"]);
	});

	it("prefixes analysis in cmd mode unless asked not to, and passes any command word through", () => {
		const plan = planRadare({ operation: "cmd", path, command: "afl" });
		expect(plan.invocations[0]?.args).toContain("aaa; afl");
		const raw = planRadare({ operation: "cmd", path, command: "afl", analyze: false });
		expect(raw.invocations[0]?.args).toContain("afl");
		// No read-only guard: wx and other command words are accepted verbatim (zero-limit parity).
		const patch = planRadare({ operation: "cmd", path, command: "wx 00", analyze: false });
		expect(patch.invocations[0]?.args).toContain("wx 00");
	});

	it("keeps only branches, calls and comparisons in a skeleton", () => {
		expect(branchSkeleton(["mov eax, 1", "bl 0x100", "ret"])).toEqual(["bl 0x100", "ret"]);
	});
});

describe("planAndroid", () => {
	it("places output beside the sample and asks jadx for names", () => {
		expect(defaultOutputDir("/work/demo.apk", "jadx")).toBe("/work/demo_jadx_src");
		const plan = planAndroid({ operation: "decompile", apkPath: "/work/demo.apk" });
		expect(plan.invocation.file).toBe("jadx");
		expect(plan.invocation.args).toEqual(["-d", "/work/demo_jadx_src", "--deobf", "/work/demo.apk"]);
		expect(plan.render([ok("done")])).toContain("/work/demo_jadx_src/sources/");
	});

	it("lets the caller skip deobfuscation and resource decoding", () => {
		const jadx = planAndroid({ operation: "decompile", apkPath: "/w/a.apk", deobfuscate: false });
		expect(jadx.invocation.args).not.toContain("--deobf");

		const apktool = planAndroid({ operation: "unpack", apkPath: "/w/a.apk", noSources: true });
		// No `-f`: apktool has to fail on an existing directory rather than delete it.
		expect(apktool.invocation).toMatchObject({ file: "apktool", args: ["d", "-s", "-o", "/w/a_apktool", "/w/a.apk"] });
		expect(apktool.render([ok("")])).toContain("smali               : skipped (-s)");
	});

	it("surfaces a failed decompile with its exit code", () => {
		const plan = planAndroid({ operation: "decompile", apkPath: "/w/a.apk" });
		const text = plan.render([{ stdout: "", stderr: "ERROR: bad dex", exitCode: 2 }]);
		expect(text).toContain("jadx failed (exit 2)");
		expect(text).toContain("ERROR: bad dex");
	});

	it("refuses to plan a filesystem search as a process", () => {
		expect(() => planAndroid({ operation: "smali_search", directory: "/w/src" })).toThrow("runs on the plugin's fs");
		expect(() => planAndroid({ operation: "decompile" })).toThrow("apk_path is required");
	});
});

describe("searchSourceTree", () => {
	const files: Record<string, string> = {
		"/w/src/A.smali": "const-string v0, \"License\"\ninvoke-static {v0}\n",
		"/w/src/b.xml": "<string>license</string>\n",
		"/w/logo.png": "license",
	};
	const fs = {
		listFilesRecursive: async () =>
			Object.keys(files).map(path => ({ path, relPath: path.replace("/w/", ""), name: path.split("/").pop() ?? path })),
		readFile: async (path: string) => ({ content: files[path] ?? "" }),
	};

	it("returns path:line hits and skips binary extensions", async () => {
		const result = await searchSourceTree(fs, { directory: "/w", pattern: "license" });
		expect(result.hits.map(hit => `${hit.relPath}:${hit.line}`)).toEqual(["src/A.smali:1", "src/b.xml:1"]);
		expect(result.considered).toBe(2);
		expect(renderSearch(result, "license")).toContain("src/b.xml:1:");
	});

	it("honours case sensitivity and the hit cap", async () => {
		const exact = await searchSourceTree(fs, { directory: "/w", pattern: "License", caseSensitive: true });
		expect(exact.hits).toHaveLength(1);

		const capped = await searchSourceTree(fs, { directory: "/w", pattern: "license", limit: 1 });
		expect(capped.hits).toHaveLength(1);
		expect(capped.truncated).toBe(true);
		expect(renderSearch(capped, "license")).toContain("hit limit reached");
	});

	it("explains an empty result and a missing pattern", async () => {
		const empty = await searchSourceTree(fs, { directory: "/w", pattern: "zzz" });
		expect(renderSearch(empty, "zzz")).toContain("No matches for");
		await expect(searchSourceTree(fs, { directory: "/w", pattern: "  " })).rejects.toThrow("pattern is required");
	});

	it("names the files it skipped instead of reporting a thin result as absence", async () => {
		const huge = { path: "/w/big.smali", relPath: "big.smali", name: "big.smali" };
		const bigFs = {
			listFilesRecursive: async () => [huge],
			readFile: async () => ({ content: "x".repeat(MAX_SEARCH_CHARS + 1) }),
		};
		const result = await searchSourceTree(bigFs, { directory: "/w", pattern: "x" });
		expect(result.scanned).toBe(0);
		expect(result.skipped).toBe(1);
		expect(renderSearch(result, "x")).toContain("skipped as too large");
	});
});

describe("initTaskWorkspace", () => {
	function fakeWorkspaceFs() {
		const directories: string[] = [];
		const writes = new Map<string, string>();
		const fs = {
			createDirectory: async (path: string) => {
				directories.push(path);
			},
			writeFile: async (path: string, content: string) => {
				writes.set(path, content);
			},
			stat: async (path: string) => (writes.has(path) ? {} : null),
		};
		return { fs, directories, writes };
	}

	it("sanitises the name so it cannot leave the root", () => {
		expect(safeTaskName("../../etc/passwd")).toBe("etc_passwd");
		expect(safeTaskName("  ..hidden  ")).toBe("hidden");
		expect(safeTaskName("case-2024_01")).toBe("case-2024_01");
	});

	it("creates the fixed layout, a README and an optional report", async () => {
		const { fs, directories, writes } = fakeWorkspaceFs();
		const result = await initTaskWorkspace(fs, { root: "/cases", name: "demo", description: "authorised", report: true });
		expect(directories).toEqual(["/cases/demo", "/cases/demo/samples", "/cases/demo/exports", "/cases/demo/reports"]);
		expect(writes.get("/cases/demo/README.md")).toContain("Scope: authorised");
		expect(writes.get("/cases/demo/reports/security-report.md")).toContain("Security assessment — demo");
		expect(result.keptExistingReadme).toBe(false);
		expect(result.created).toHaveLength(4);

		const again = await initTaskWorkspace(fs, { root: "/cases", name: "demo", description: "authorised" });
		expect(again.keptExistingReadme).toBe(true);
		expect(writes.size).toBe(2);
	});

	it("refuses a name that sanitises to nothing", async () => {
		const { fs } = fakeWorkspaceFs();
		await expect(initTaskWorkspace(fs, { root: "/cases", name: "  " })).rejects.toThrow("name is empty");
	});
});

describe("toolchain tools", () => {
	interface FakeHost {
		files?: Map<string, string>;
		tree?: { path: string; relPath: string; name: string }[];
		permissions?: string[];
		run?: (file: string, args: readonly string[]) => Promise<CommandResult>;
		/** Paths that already exist on disk, so a tool can be shown an occupied destination. */
		existing?: string[];
		/** Two levels deep by default in the escape tests: `/work` alone cannot show a `..` escape. */
		cwd?: string;
	}

	function fakePlugin(options: FakeHost = {}) {
		const written = new Map<string, string>();
		const registered: { id: string; run: (input: Record<string, unknown>) => Promise<string> }[] = [];
		const files = options.files ?? new Map<string, string>();
		const tree = options.tree ?? [];

		const fs = {
			stat: async (path: string) =>
				written.has(path) || (options.existing ?? []).includes(path)
					? { size: 1, modifiedAt: 0, createdAt: 0 }
					: null,
			writeFile: async (path: string, content: string) => {
				written.set(path, content);
			},
			createDirectory: async () => undefined,
			readFile: async (path: string) => ({ content: files.get(path) ?? "" }),
			listFilesRecursive: async () => tree,
		};

		const ctx = {
			agent: {
				registerTool: (definition: { id: string; handler: (context: never) => unknown }): Disposable => {
					registered.push({
						id: definition.id,
						run: input =>
							definition.handler({
								trigger: { input },
								host: { fs },
								session: { cwd: options.cwd ?? "/work" },
							} as never) as Promise<string>,
					});
					return { dispose: () => undefined };
				},
			},
			permissions: { has: (permission: string) => (options.permissions ?? ["agent.command.run"]).includes(permission) },
			command: options.run ? { run: options.run } : undefined,
			fs,
		} as unknown as PluginContext;

		const call = async (id: string, input: Record<string, unknown>): Promise<string> => {
			const definition = registered.find(item => item.id === id);
			if (!definition) throw new Error(`tool ${id} was not registered`);
			return definition.run(input);
		};

		return { ctx, call, written };
	}

	/** Answers the version probe for every binary, plus whatever the test needs. */
	function hostRun(extra?: (file: string, args: readonly string[]) => CommandResult | undefined) {
		return async (file: string, args: readonly string[]) => {
			const custom = extra?.(file, args);
			if (custom) return custom;
			if (args.length === 1 && ["-v", "--version", "-version"].includes(args[0] ?? "")) return ok(`${file} 1.0.0`);
			throw new Error(`unexpected ${file} ${args.join(" ")}`);
		};
	}

	it("registers all four toolchain tools", () => {
		const { ctx } = fakePlugin();
		expect([
			registerProbeEnvironmentTool(ctx).dispose,
			registerRunRadareTool(ctx).dispose,
			registerDecompileAndroidTool(ctx).dispose,
			registerInitTaskTool(ctx).dispose,
		].every(disposable => typeof disposable === "function")).toBe(true);
	});

	it("probe_environment lists the toolchain the host actually runs", async () => {
		const { ctx, call } = fakePlugin({ run: hostRun() });
		registerProbeEnvironmentTool(ctx);
		const output = await call("probe_environment", {});
		expect(output).toContain("External toolchain");
		expect(output).toContain("rabin2");
		expect(output).toContain("✓");
	});

	it("probe_environment explains a missing permission instead of blaming PATH", async () => {
		const { ctx, call } = fakePlugin({ permissions: [], run: hostRun() });
		registerProbeEnvironmentTool(ctx);
		const output = await call("probe_environment", {});
		expect(output).toContain("not available to this plugin instance");
		expect(output).toContain("agent.command.run");
	});

	it("run_radare keeps the sample inside the open project", async () => {
		const { ctx, call } = fakePlugin({ run: hostRun() });
		registerRunRadareTool(ctx);
		expect(await call("run_radare", { operation: "info", path: "/etc/passwd" })).toContain("must stay inside the open project");
		// A relative path is resolved against the project, so `..` has to be refused rather than clamped:
		// `/work` alone cannot show it, hence the deeper cwd. Command arguments never pass the host's
		// own root check, so this guard is the only one standing.
		const deep = fakePlugin({ run: hostRun(), cwd: "/work/case-1" });
		registerRunRadareTool(deep.ctx);
		for (const escaping of ["../secret.elf", "../../etc/passwd", "sub/../../secret.elf"]) {
			expect(await deep.call("run_radare", { operation: "info", path: escaping })).toContain(
				"must stay inside the open project",
			);
		}
		expect(await deep.call("run_radare", { operation: "info", path: "sub/../demo.elf" })).not.toContain(
			"must stay inside the open project",
		);
		expect(await call("run_radare", { operation: "diff", path: "a.elf" })).toContain("other_path is required");
	});

	it("run_radare returns the r2 answer for a permitted call", async () => {
		const { ctx, call } = fakePlugin({
			run: hostRun((file, args) => (file === "rabin2" && args[0] === "-I" ? ok("arch     x86\nbits     64\n") : undefined)),
		});
		registerRunRadareTool(ctx);
		const output = await call("run_radare", { operation: "info", path: "demo.apk" });
		expect(output).toContain("info · demo.apk");
		expect(output).toContain("arch     x86");
	});

	it("run_radare names the missing executable and its install hint", async () => {
		const { ctx, call } = fakePlugin({
			run: async (file, args) => {
				if (file === "r2") throw new Error("spawn r2 ENOENT");
				if (args.length === 1) return ok(`${file} 1.0.0`);
				throw new Error(`unexpected ${file}`);
			},
		});
		registerRunRadareTool(ctx);
		const output = await call("run_radare", { operation: "functions", path: "demo.elf" });
		expect(output).toContain("not available");
		expect(output).toContain("radare2");
		expect(output).toContain("probe_environment");
	});

	it("decompile_android searches an unpacked tree without any external tool", async () => {
		const tree = [{ path: "/work/app/smali/A.smali", relPath: "smali/A.smali", name: "A.smali" }];
		const { ctx, call } = fakePlugin({ tree, files: new Map([["/work/app/smali/A.smali", "const-string v0, \"vip\"\n"]]) });
		registerDecompileAndroidTool(ctx);
		const output = await call("decompile_android", { operation: "smali_search", directory: "app", pattern: "vip" });
		expect(output).toContain("smali/A.smali:1:");
		expect(output).toContain("const-string");
	});

	it("decompile_android refuses to decompile when jadx is absent", async () => {
		const { ctx, call } = fakePlugin({
			run: async (file, args) => {
				if (file === "jadx") throw new Error("spawn jadx ENOENT");
				if (args.length === 1) return ok(`${file} 1.0.0`);
				throw new Error(`unexpected ${file}`);
			},
		});
		registerDecompileAndroidTool(ctx);
		const output = await call("decompile_android", { operation: "decompile", apk_path: "demo.apk" });
		expect(output).toContain("jadx");
		expect(output).toContain("not available");
	});

	it("decompile_android never targets a directory it would have to merge into or wipe", async () => {
		const existing = fakePlugin({ run: hostRun(), existing: ["/work/out"] });
		registerDecompileAndroidTool(existing.ctx);
		expect(
			await existing.call("decompile_android", { operation: "decompile", apk_path: "demo.apk", output_dir: "out" }),
		).toContain("already exists");

		const ancestor = fakePlugin({ run: hostRun() });
		registerDecompileAndroidTool(ancestor.ctx);
		expect(await ancestor.call("decompile_android", { operation: "unpack", apk_path: "demo.apk", output_dir: "." })).toContain(
			"cannot contain the sample itself",
		);
	});

	it("decompile_android keeps the APK and the destination inside the open project", async () => {
		const deep = fakePlugin({ run: hostRun(), cwd: "/work/case-1" });
		registerDecompileAndroidTool(deep.ctx);
		expect(await deep.call("decompile_android", { operation: "decompile", apk_path: "../secret.apk" })).toContain(
			"must stay inside the open project",
		);
		expect(
			await deep.call("decompile_android", { operation: "decompile", apk_path: "demo.apk", output_dir: "../../out" }),
		).toContain("must stay inside the open project");
	});

	it("init_task creates the layout and never overwrites an existing README", async () => {
		const { ctx, call, written } = fakePlugin();
		registerInitTaskTool(ctx);
		const output = await call("init_task", { name: "demo", description: "authorised scope", report: true });
		expect(output).toContain("Workspace ready: /work/demo");
		expect(written.get("/work/demo/README.md")).toContain("authorised scope");
		expect(written.get("/work/demo/reports/security-report.md")).toContain("Security assessment");

		const again = await call("init_task", { name: "demo" });
		expect(again).toContain("already existed");
	});
});
