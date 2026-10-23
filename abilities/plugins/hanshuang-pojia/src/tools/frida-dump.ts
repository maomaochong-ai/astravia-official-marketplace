import type { PluginContext, PluginFsApi } from "@astravia-org/plugin-sdk";
import type { Disposable } from "@astravia-org/plugin-sdk";
import { parseAxml } from "../domain/archive/axml";
import { findZipEntry, looksLikeZip, readZipEntry, readZipIndex } from "../domain/archive/zip";
import { buildManifestFacts } from "../domain/android/manifest-model";
import {
	DEFAULT_DELAY_MS,
	DEFAULT_LIMIT_MB,
	DEFAULT_MAX_DEX,
	buildDexDumpScript,
	fridaDumpHint,
	parseDexDumpLog,
	type ParsedDexDump,
} from "../domain/android/frida-dump";
import { toBase64 } from "../domain/base64";
import { sha256Hex } from "../domain/digest";
import { baseName, resolveSamplePath } from "../domain/sample-path";
import { specFor } from "../domain/toolchain/catalog";
import { createCommandRunner, describeCommandFailure, probeOnce } from "../features/workbench/services/toolchain";
import { loadSample } from "./read-sample";

const DEFAULT_OUTPUT_DIR = "exports/frida-dump";
const DEFAULT_WAIT_MS = 25_000;
const MAX_WAIT_MS = 120_000;
const SCRIPT_NAME = "dump-dex.js";
const LOG_NAME = "frida-dump.log";
const MAX_REPORTED = 12;

type DumpMode = "script" | "run" | "assemble";

interface FridaDumpInput {
	mode?: DumpMode;
	path?: string;
	package?: string;
	log_path?: string;
	output_dir?: string;
	max_dex?: number;
	delay_ms?: number;
	limit_mb?: number;
	wait_ms?: number;
}

interface WrittenDex {
	path: string;
	size: number;
	sha256: string;
	index: number;
	duplicate: boolean;
}

/**
 * 运行时脱壳的入口。
 *
 * 三个 mode 分别对应三种真实处境：还没有设备（`script`：给出能直接跑的脚本与命令）、
 * 有设备（`run`：挂在目标进程上扫一遍并落盘）、frida 自己是手动跑的（`assemble`：
 * 拿它吐出的 log 拼回文件）。三条路径共用同一份解析器，所以「脚本里发什么」与
 * 「主机侧怎么读」不会各写一遍而漂移。
 */
export function registerFridaDumpTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<FridaDumpInput>({
		id: "frida_dump",
		name: "frida_dump",
		label: "%tool.fridaDump.label%",
		description: [
			"Recover the DEX files of a packed APK at runtime: attach with Frida, scan writable memory for real",
			"DEX headers, and bring each one back as a file that `decompile_android` / `smali_search` can read.",
			"",
			"mode:",
			"  script   — emit the Frida script and the exact command; nothing is executed (default)",
			"  run      — write the script, spawn the package, collect the log for `wait_ms`, then save every dex",
			"  assemble — parse a log from a Frida run you started yourself and save its dex files",
			"",
			"The scan is header-validated, not magic-only: `magic == dex\\n03`, `header_size == 0x70`,",
			"`endian_tag == 0x12345678` and a plausible `file_size` must all agree, so string constants that",
			"happen to spell a dex header are not copied. Only rw- ranges are read; code mappings are untouched.",
			"",
			"Files land in `output_dir` (default `exports/frida-dump`) as `<source>-<n>-<sha8>.dex`, deduped by",
			"SHA-256 — the same dex is often mapped twice by dexopt. A dump that still looks like a skeleton",
			"means the shell decrypts lazily: keep the app on the screen that triggers it, raise `wait_ms`, and",
			"run again. `agent/skills/apkseep/references/advanced-unpacking.md` has the rest of the procedure.",
			"",
			"`run` needs a device with frida-server and `adb` on PATH; `script` and `assemble` need neither.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				mode: { type: "string", enum: ["script", "run", "assemble"], description: "script (default) | run | assemble." },
				path: { type: "string", description: "APK used to infer the package name and the output prefix. Optional for assemble." },
				package: { type: "string", description: "Android package name to spawn; read from the APK manifest when path is given." },
				log_path: { type: "string", description: "assemble: frida log written with `-o`, relative to the session working directory." },
				output_dir: { type: "string", description: `Where dex files go (default ${DEFAULT_OUTPUT_DIR}), inside the open project.` },
				max_dex: { type: "integer", description: `How many dex files to copy (default ${DEFAULT_MAX_DEX}, max 32).` },
				delay_ms: { type: "integer", description: `Wait after spawn before scanning (default ${DEFAULT_DELAY_MS} ms).` },
				limit_mb: { type: "integer", description: `Per-file size ceiling while scanning (default ${DEFAULT_LIMIT_MB} MB).` },
				wait_ms: { type: "integer", description: `run: how long to keep frida attached before collecting (default ${DEFAULT_WAIT_MS}, max ${MAX_WAIT_MS}).` },
			},
			required: [],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: MAX_WAIT_MS + 30_000,
		handler: async context => {
			const input = context.trigger.input;
			const mode: DumpMode = input.mode === "run" || input.mode === "assemble" ? input.mode : "script";
			const cwd = context.session.cwd;

			try {
				if (mode === "assemble") {
					const logPath = (input.log_path ?? "").trim();
					if (!logPath) return "mode=assemble needs `log_path`: the file frida wrote with `-o`.";
					const resolved = resolveSamplePath(cwd, logPath);
					const file = await context.host.fs.readFile(resolved);
					const parsed = parseDexDumpLog(file.content);
					if (parsed.dexes.length === 0) {
						return [
							`No dex could be assembled from ${resolved}.`,
							parsed.notes.length > 0 ? `\nNotes:\n${parsed.notes.map(note => `- ${note}`).join("\n")}` : "",
							"",
							"A log is only useful if the script that wrote it is this plugin's dump script — it emits one JSON",
							"line per chunk. If the app was not running the code you expected, re-run with `mode: \"run\"`.",
						].join("\n");
					}
					const outputDir = resolveOutputDir(cwd, input.output_dir, resolved);
					const written = await writeDexes(context.host.fs, outputDir, parsed, prefixFor(null, resolved));
					return renderRunReport({ mode, outputDir, written, parsed, notes: parsed.notes, sourceName: baseName(resolved) });
				}

				const scriptOptions = {
					maxDex: input.max_dex,
					delayMs: input.delay_ms,
					limitMb: input.limit_mb,
					source: input.path ? baseName(input.path) : undefined,
				};

				if (mode === "script") {
					const packageName = await resolvePackage(context.host.fs, cwd, input);
					const script = buildDexDumpScript(scriptOptions);
					return [
						`# Runtime dex dump script${input.path ? ` for ${baseName(input.path)}` : ""}`,
						"",
						"```js",
						script.trimEnd(),
						"```",
						"",
						fridaDumpHint(packageName, SCRIPT_NAME),
						"",
						"Save the block above as `dump-dex.js`, then feed the log back to this tool with `mode: \"assemble\"`",
						"and `log_path: \"frida-dump.log\"` to turn it into dex files.",
					].join("\n");
				}

				// mode === "run"
				const run = createCommandRunner(ctx);
				if (!run) {
					return "mode=run needs the host command channel: plugin.json#commands is empty or agent.command.run was not granted. Use mode=script and run frida yourself, then mode=assemble.";
				}
				const packageName = await resolvePackage(context.host.fs, cwd, input);
				if (!packageName) {
					return "mode=run needs a package name: pass `package`, or `path` pointing at the APK so the manifest can supply it.";
				}

				const report = await probeOnce(run);
				const missing = ["frida"].filter(id => {
					const status = report.tools.find(tool => tool.id === id);
					return !status || !status.available;
				});
				if (missing.length > 0) {
					const spec = specFor("frida");
					const status = report.tools.find(tool => tool.id === "frida");
					const why = status?.blocked
						? `the host refused \`${spec.binary}\` (${status.detail}); declare it in plugin.json#commands and enable it in the plugin settings`
						: `\`${spec.binary}\` is not on PATH (${status?.detail ?? "not probed"}); install it with: ${spec.install}`;
					return `mode=run needs frida, but ${why}.`;
				}

				const devices = await run("frida-ps", ["-U", "-a"], { timeoutMs: 30_000 }).catch(error => {
					throw new Error(`frida could not reach a device: ${describeCommandFailure(error)}`);
				});
				if (devices.exitCode !== 0) {
					return `frida could not reach a device: ${(devices.stderr || devices.stdout).trim().slice(0, 600) || "no output"}`;
				}

				const outputDir = resolveOutputDir(cwd, input.output_dir, input.path ?? packageName);
				await ensureDir(context.host.fs, outputDir);
				const scriptPath = `${outputDir}/${SCRIPT_NAME}`;
				const logPath = `${outputDir}/${LOG_NAME}`;
				await context.host.fs.writeFile(scriptPath, buildDexDumpScript(scriptOptions));

				const waitMs = Math.max(3_000, Math.min(MAX_WAIT_MS, Math.trunc(input.wait_ms ?? DEFAULT_WAIT_MS)));
				let commandNote = "";
				try {
					await run("frida", ["-U", "-f", packageName, "-l", scriptPath, "-o", logPath, "-q"], { timeoutMs: waitMs });
					commandNote = `frida stayed attached for the full ${waitMs} ms.`;
				} catch (error) {
					// 预期路径：frida 不会自己退出，超时就是「跑够了」。日志里已经有东西时继续解析。
					commandNote = `frida was stopped after ${waitMs} ms (${describeCommandFailure(error)}). That is the normal end of a run: the script never exits on its own.`;
				}

				let logText = "";
				try {
					logText = (await context.host.fs.readFile(logPath)).content;
				} catch {
					return [
						`${commandNote}`,
						"",
						`No log was written to ${logPath}, so the script never started. Check that frida-server is running on the`,
						"device as root, that the package is installed for that device, and that the script path is readable:",
						scriptPath,
					].join("\n");
				}

				const parsed = parseDexDumpLog(logText);
				if (parsed.dexes.length === 0) {
					return [
						`# frida_dump · ${packageName}`,
						"",
						commandNote,
						"",
						"Nothing was collected: the scan found no valid DEX header in writable memory.",
						"",
						"Most likely the shell had not decrypted anything yet. Launch the app, navigate to the screen that",
						"triggers the protected code, raise `wait_ms` (or use `mode: \"script\"` and attach with",
						"`frida -U <process> -l dump-dex.js` after you are already on that screen), then run again.",
						parsed.notes.length > 0 ? `\nLog notes:\n${parsed.notes.map(note => `- ${note}`).join("\n")}` : "",
					].join("\n");
				}

				const written = await writeDexes(context.host.fs, outputDir, parsed, prefixFor(packageName, input.path ?? null));
				return renderRunReport({
					mode,
					outputDir,
					written,
					parsed,
					notes: parsed.notes,
					sourceName: packageName,
					extra: [commandNote, `script: ${scriptPath}`, `log: ${logPath}`],
				});
			} catch (error) {
				return `frida_dump failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}

/** `package` 显式给了就用；否则从 APK 的二进制 manifest 读，读不到就返回 null。 */
async function resolvePackage(fs: PluginFsApi, cwd: string, input: FridaDumpInput): Promise<string | null> {
	const explicit = (input.package ?? "").trim();
	if (explicit) return explicit;
	const raw = (input.path ?? "").trim();
	if (!raw) return null;
	try {
		const sample = await loadSample(fs, cwd, raw);
		if (!looksLikeZip(sample.bytes)) return null;
		const index = readZipIndex(sample.bytes);
		const entry = findZipEntry(index, "AndroidManifest.xml");
		if (!entry) return null;
		const bytes = await readZipEntry(sample.bytes, entry);
		const document = parseAxml(bytes);
		if (!document.root) return null;
		return buildManifestFacts(document.root).packageName ?? null;
	} catch {
		return null;
	}
}

function resolveOutputDir(cwd: string, requested: string | undefined, seedPath: string): string {
	const raw = (requested ?? "").trim();
	if (raw) return resolveSamplePath(cwd, raw);
	const seed = baseName(seedPath).replace(/\.[^.]+$/, "") || "sample";
	return resolveSamplePath(cwd, `${DEFAULT_OUTPUT_DIR}/${seed}`);
}

function prefixFor(packageName: string | null, samplePath: string | null): string {
	if (packageName) return packageName.split(".").pop() || packageName;
	const name = samplePath ? baseName(samplePath).replace(/\.[^.]+$/, "") : "";
	return name || "dump";
}

/** 逐级建目录：宿主的 `createDirectory` 不保证递归，缺一层就失败。 */
async function ensureDir(fs: PluginFsApi, dir: string): Promise<void> {
	const parts = dir.split("/").filter(Boolean);
	let current = dir.startsWith("/") ? "" : ".";
	for (const part of parts) {
		current = `${current}/${part}`;
		try {
			await fs.createDirectory(current);
		} catch {
			// 已存在就是我们要的状态；其余错误留给随后的写入暴露。
		}
	}
}

async function writeDexes(fs: PluginFsApi, outputDir: string, parsed: ParsedDexDump, prefix: string): Promise<WrittenDex[]> {
	await ensureDir(fs, outputDir);
	const written: WrittenDex[] = [];
	const seen = new Map<string, string>();

	for (const dex of parsed.dexes) {
		const bytes = dex.bytes;
		// 脚本声明的 size 是内存里读到的 file_size；拼回来的长度对不上就是丢块了，不写半截文件。
		if (bytes.byteLength === 0 || (dex.size > 0 && bytes.byteLength !== dex.size)) continue;
		const digest = sha256Hex(bytes);
		const existing = seen.get(digest);
		if (existing) {
			written.push({ path: existing, size: bytes.byteLength, sha256: digest, index: dex.index, duplicate: true });
			continue;
		}
		const path = `${outputDir}/${prefix}-${dex.index}-${digest.slice(0, 8)}.dex`;
		await fs.writeFile(path, toBase64(bytes), "base64");
		seen.set(digest, path);
		written.push({ path, size: bytes.byteLength, sha256: digest, index: dex.index, duplicate: false });
	}

	return written;
}

function renderRunReport(input: {
	mode: DumpMode;
	outputDir: string;
	written: WrittenDex[];
	parsed: ParsedDexDump;
	notes: string[];
	sourceName: string;
	extra?: string[];
}): string {
	const unique = input.written.filter(item => !item.duplicate);
	const duplicates = input.written.filter(item => item.duplicate);
	const lines: string[] = [
		`# frida_dump · ${input.sourceName}`,
		"",
		`mode ${input.mode} · ${input.parsed.dexes.length} dex collected · ${unique.length} written · ${duplicates.length} duplicate`,
		`output: ${input.outputDir}`,
		"",
	];

	if (input.extra && input.extra.length > 0) lines.push(...input.extra.map(item => `- ${item}`), "");

	if (unique.length > 0) {
		lines.push("| file | size | sha256 |", "| --- | --- | --- |");
		for (const item of unique.slice(0, MAX_REPORTED)) {
			lines.push(`| \`${baseName(item.path)}\` | ${item.size} B | \`${item.sha256.slice(0, 16)}…\` |`);
		}
		lines.push("");
		lines.push("Next: `decompile_android` on the APK, then `smali_search` with a directory pointing at the dumped");
		lines.push("dex, or `decompile_function` once the class is known. A dex whose methods are still empty means the");
		lines.push("shell decrypts per class loader — dump again from the screen that uses it, and raise `max_dex`.");
	} else {
		lines.push("Nothing was written: every collected chunk failed reassembly (the declared size and the assembled");
		lines.push("length disagreed) or every file was a duplicate of one already written.");
	}

	if (duplicates.length > 0) {
		lines.push("", `Duplicates (same SHA-256, not written twice): ${duplicates.map(item => baseName(item.path)).join(", ")}`);
	}
	if (input.notes.length > 0) lines.push("", "Log notes:", ...input.notes.slice(0, 8).map(note => `- ${note}`));

	if (!input.parsed.done) {
		lines.push("", "The log has no `done` event: frida was stopped before the scan finished, so the set may be partial.");
	}

	return lines.join("\n").trimEnd();
}
