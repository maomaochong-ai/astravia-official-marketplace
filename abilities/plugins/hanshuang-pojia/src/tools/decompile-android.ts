import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { baseName, containsPath, isOutsideProject, resolveSamplePath } from "../domain/sample-path";
import { specFor } from "../domain/toolchain/catalog";
import {
	defaultOutputDir,
	MAX_HITS,
	planAndroid,
	renderSearch,
	searchSourceTree,
	type AndroidOperation,
} from "../domain/toolchain/android";
import { createCommandRunner, describeCommandFailure, probeOnce } from "../features/workbench/services/toolchain";

const OPERATIONS: AndroidOperation[] = ["decompile", "unpack", "smali_search"];

interface DecompileAndroidInput {
	operation: AndroidOperation;
	apk_path?: string;
	directory?: string;
	output_dir?: string;
	deobfuscate?: boolean;
	no_sources?: boolean;
	pattern?: string;
	case_sensitive?: boolean;
	limit?: number;
}

export function registerDecompileAndroidTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<DecompileAndroidInput>({
		id: "decompile_android",
		name: "decompile_android",
		label: "%tool.android.label%",
		description: [
			"Turn an Android package into readable sources using the user's own jadx / apktool, and search the result.",
			"",
			"operation=decompile   — jadx: Java sources plus decoded resources into <name>_jadx_src/ next to the APK.",
			"                        deobfuscate (default true) passes --deobf to restore names where the mapping allows.",
			"operation=unpack      — apktool: AndroidManifest.xml, res/ and smali/ into <name>_apktool/.",
			"                        no_sources skips the smali step (-s), which is much faster and much smaller.",
			"operation=smali_search — grep the unpacked tree for a pattern and return path:line: text. This runs on the",
			"                        plugin's own file access, needs no external tool, and is how you read a large tree",
			"                        without loading whole files.",
			"",
			"Both decompilers write to disk and take minutes on a real app, so give them a real timeout and expect a",
			"truncated log: the answer names the output directory rather than pasting thousands of files. Read the",
			"directory afterwards with smali_search, then open only the few files that matter.",
			"",
			"Requires jadx or apktool on PATH plus a JDK; probe_environment tells you which are present. The tool",
			"extracts and reads code; rebuilding, signing and repacking are follow-on steps through `command.run`",
			"(apktool b / apksigner sign / zipalign) once the smali is edited.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				operation: { type: "string", enum: OPERATIONS, description: "decompile, unpack or smali_search." },
				apk_path: { type: "string", description: "APK/AAB/DEX/JAR to process. Required for decompile and unpack." },
				directory: { type: "string", description: "Unpacked tree to search. Required for smali_search." },
				output_dir: { type: "string", description: "Override the output directory; defaults to a sibling of the APK." },
				deobfuscate: { type: "boolean", description: "jadx --deobf (default true)." },
				no_sources: { type: "boolean", description: "apktool -s: resources only, no smali." },
				pattern: { type: "string", description: "smali_search: literal text to look for." },
				case_sensitive: { type: "boolean", description: "smali_search: match case exactly (default false)." },
				limit: { type: "number", description: `smali_search: maximum hits (default 50, max ${MAX_HITS}).` },
			},
			required: ["operation"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 900_000,
		handler: async context => {
			const input = context.trigger.input;
			const operation = input.operation;
			const cwd = context.session.cwd;

			if (operation === "smali_search") {
				const raw = (input.directory ?? "").trim();
				if (!raw) return "directory is required for smali_search.";
				if (isOutsideProject(raw, cwd)) return `directory must stay inside the open project: ${raw}`;
				const directory = resolveSamplePath(cwd, raw);
				try {
					const result = await searchSourceTree(context.host.fs, {
						directory,
						pattern: input.pattern ?? "",
						caseSensitive: input.case_sensitive === true,
						limit: input.limit,
					});
					return renderSearch(result, input.pattern ?? "");
				} catch (error) {
					return `smali_search failed: ${error instanceof Error ? error.message : String(error)}`;
				}
			}

			const run = createCommandRunner(ctx);
			if (!run) {
				return "External commands are unavailable: plugin.json#commands is empty or agent.command.run was not granted.";
			}

			const rawApk = (input.apk_path ?? "").trim();
			if (!rawApk) return `apk_path is required for operation=${operation}.`;
			if (isOutsideProject(rawApk, cwd)) return `apk_path must stay inside the open project: ${rawApk}`;
			const rawOut = (input.output_dir ?? "").trim();
			if (rawOut && isOutsideProject(rawOut, cwd)) return `output_dir must stay inside the open project: ${rawOut}`;
			let apkPath: string;
			let outputDir: string;
			try {
				apkPath = resolveSamplePath(cwd, rawApk);
				outputDir = rawOut
					? resolveSamplePath(cwd, rawOut)
					: defaultOutputDir(apkPath, operation === "decompile" ? "jadx" : "apktool");
			} catch (error) {
				return error instanceof Error ? error.message : String(error);
			}
			// jadx writes into whatever directory it is given and apktool without `-f` refuses an
			// existing one, but a destination that already holds something — or that contains the
			// sample itself — must never reach the argument list.
			if (containsPath(outputDir, apkPath)) {
				return `output_dir cannot contain the sample itself (${apkPath}); pick a fresh directory next to the APK.`;
			}
			if (await context.host.fs.stat(outputDir)) {
				return `output_dir already exists: ${outputDir}. Pick a new directory — jadx would mix its output into it.`;
			}

			const needed = operation === "decompile" ? "jadx" : "apktool";
			const spec = specFor(needed);
			const report = await probeOnce(run);
			const status = report.tools.find(tool => tool.id === needed);
			const java = report.tools.find(tool => tool.id === "java");
			if (!status || !status.available) {
				const why = status?.blocked
					? `the host refused \`${spec.binary}\` (${status.detail}); declare it in plugin.json#commands and enable it`
					: `\`${spec.binary}\` is not available (${status?.detail ?? "not probed"}); install it: ${spec.install}`;
				return `${operation} needs ${spec.binary}, but ${why}.`;
			}
			if (!java?.available) {
				return `${spec.binary} needs a Java runtime and \`java\` is not runnable (${java?.detail ?? "not probed"}); install a JDK 17+ first.`;
			}

			let plan: ReturnType<typeof planAndroid>;
			try {
				plan = planAndroid({
					operation,
					apkPath,
					outputDir,
					deobfuscate: input.deobfuscate,
					noSources: input.no_sources,
				});
			} catch (error) {
				return error instanceof Error ? error.message : String(error);
			}

			try {
				const result = await run(plan.invocation.file, plan.invocation.args, { timeoutMs: plan.invocation.timeoutMs });
				const body = plan.render([result]);
				return `${operation} · ${baseName(apkPath)}\n${"-".repeat(48)}\n${body}`;
			} catch (error) {
				return describeCommandFailure(error);
			}
		},
	});
}
