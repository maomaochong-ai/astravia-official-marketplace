import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { looksLikeDex } from "../domain/android/dex";
import { dexStrings, indexDex, searchDex, type DexSearchKind } from "../domain/android/dex-index";
import { buildHookScript, hookRunHint, hookTargetsFromHits } from "../domain/android/hook-template";
import { findZipEntries, looksLikeZip, readZipEntry, readZipIndex } from "../domain/archive/zip";
import { loadSample } from "./read-sample";

interface GenerateHookInput {
	path?: string;
	query?: string;
	kind?: DexSearchKind;
	backtrace?: boolean;
	logReturn?: boolean;
	packageName?: string;
	limit?: number;
}

const MAX_DEX_FILES = 3;
const MAX_HITS = 120;

export function registerGenerateHookTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<GenerateHookInput>({
		id: "generate_hook",
		name: "generate_hook",
		label: "%tool.hook.label%",
		description: [
			"Generate a Frida observation script for a class or method in an APK / DEX: it resolves the class",
			"with `Java.use`, wraps every overload, prints the arguments on entry and (optionally) the return",
			"value and Java backtrace, then returns the original result unchanged.",
			"",
			"Use it when the user wants to watch what a method receives at runtime: what a licence check is",
			"called with, which arguments a `verify` path gets, whether a method is reached at all. The script",
			"goes to `frida -U -f <package> -l hook.js`; the returned text includes that command.",
			"",
			"OBSERVATION ONLY. The generated wrapper does not rewrite arguments or return values and contains no",
			"`return true` / forced-success stub — turning a check into a pass is a decision the operator makes",
			"by hand, not something this tool automates. The script is generated from the on-disk DEX index and",
			"is not executed or syntax-checked against a device.",
			"",
			"When the query matches a class but no method, the script lists that class's declared methods so a",
			"second run can target one by name.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "APK, ZIP or `.dex` file, absolute or relative to the session working directory." },
				query: { type: "string", description: "Case-insensitive class or method fragment, e.g. `license`, `verify`, `com.example.gate`." },
				kind: { type: "string", enum: ["any", "class", "method", "string"], description: "Restrict the search table (default any)." },
				backtrace: { type: "boolean", description: "Print a Java stack trace on entry (default false)." },
				logReturn: { type: "boolean", description: "Print the return value on exit (default true)." },
				packageName: { type: "string", description: "Package name used in the frida command hint; read from the manifest when omitted." },
				limit: { type: "integer", description: `Hits to consider (default 60, max ${MAX_HITS}).` },
			},
			required: ["path", "query"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 120_000,
		handler: async context => {
			try {
				const input = context.trigger.input;
				const query = (input.query ?? "").trim();
				if (query === "") return "generate_hook needs a non-empty `query`.";
				const sample = await loadSample(context.host.fs, context.session.cwd, input.path ?? "");
				const kind: DexSearchKind = input.kind ?? "any";
				const limit = Math.max(1, Math.min(MAX_HITS, Math.trunc(input.limit ?? 60)));

				const dexFiles: { name: string; bytes: Uint8Array }[] = [];
				if (looksLikeDex(sample.bytes)) {
					dexFiles.push({ name: sample.name, bytes: sample.bytes });
				} else if (looksLikeZip(sample.bytes)) {
					const index = readZipIndex(sample.bytes);
					for (const entry of findZipEntries(index, name => /^classes\d*\.dex$/.test(name)).slice(0, MAX_DEX_FILES)) {
						dexFiles.push({ name: entry.name, bytes: await readZipEntry(sample.bytes, entry) });
					}
					if (dexFiles.length === 0) return `${sample.name} contains no classes*.dex entry, so there is nothing to hook.`;
				} else {
					return `${sample.name} is neither a DEX file nor a ZIP/APK archive. generate_hook targets Dalvik code only.`;
				}

				const hits = [];
				const notes: string[] = [];
				for (const file of dexFiles) {
					if (hits.length >= limit) break;
					const index = indexDex(file.bytes);
					notes.push(...index.comments.map(comment => `${file.name}: ${comment}`));
					const found = searchDex(index, dexStrings(file.bytes), query, kind, limit - hits.length);
					hits.push(...found.hits);
					if (found.truncated) notes.push(`${file.name}: search stopped at the hit budget`);
				}

				const { targets, classes } = hookTargetsFromHits(hits);
				const script = buildHookScript(targets, classes, {
					source: sample.name,
					query,
					backtrace: input.backtrace === true,
					logReturn: input.logReturn !== false,
				});

				const head = [
					`# Frida observation script for ${sample.name}`,
					`Query \`${query}\` · kind ${kind} · ${hits.length} hit(s) · ${targets.length} method target(s), ${classes.length} class(es)`,
					"",
					"```js",
					script.trimEnd(),
					"```",
					"",
					hookRunHint(input.packageName?.trim() || null),
				];
				if (targets.length > 0) {
					head.push("", "## Targets", "");
					for (const target of targets) head.push(`- \`${target.className}.${target.methodName}\` — ${target.returns} (${target.params || "no arguments"})`);
				}
				const visible = notes.slice(0, 8);
				if (visible.length > 0) head.push("", "Notes:", ...visible.map(note => `- ${note}`));
				if (targets.length === 0 && classes.length === 0) {
					head.push(
						"",
						"Nothing matched. Obfuscated APKs keep literals in the string pool even when identifiers are renamed — retry with a shorter fragment, or with `kind: \"string\"` to find the message a gate prints.",
					);
				}
				head.push("", "The wrapper only observes: it prints, calls the original and returns its result unchanged.");
				return head.join("\n");
			} catch (error) {
				return `Hook generation failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}
