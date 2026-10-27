import { readCodeItem, type DalvikInstruction } from "../../domain/android/code-item";
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { describeEntry, indexDex, type DexMethodEntry } from "../../domain/android/dex-index";
import { looksLikeDex } from "../../domain/android/dex";
import { findZipEntries, looksLikeZip, readZipEntry, readZipIndex } from "../../domain/archive/zip";
import { loadSample } from "../lib/read-sample";

interface DisassembleDexMethodInput {
	path?: string;
	/** 类名片段（小写子串，同 search_dex_symbols）。 */
	className?: string;
	/** 方法名片段（小写子串）；缺省时列该类前几个方法的 code_item 帧。 */
	methodName?: string;
	/** 指令视图上限（默认画到 code_item.insns_size，最高 400）。 */
	limit?: number;
}

const MAX_DEX_FILES = 3;
const MAX_INSTRUCTIONS = 400;

/** 同 search_dex_symbols：从 APK / ZIP / DEX 里取前几个 classes*.dex。 */
async function collectDexFiles(
	sampleBytes: Uint8Array,
	sampleName: string,
): Promise<{ name: string; bytes: Uint8Array }[]> {
	const dexFiles: { name: string; bytes: Uint8Array }[] = [];
	if (looksLikeDex(sampleBytes)) {
		dexFiles.push({ name: sampleName, bytes: sampleBytes });
	} else if (looksLikeZip(sampleBytes)) {
		const index = readZipIndex(sampleBytes);
		const entries = findZipEntries(index, name => /^classes\d*\.dex$/.test(name)).slice(0, MAX_DEX_FILES);
		for (const entry of entries) dexFiles.push({ name: entry.name, bytes: await readZipEntry(sampleBytes, entry) });
	}
	return dexFiles;
}

function findMethod(
	index: ReturnType<typeof indexDex>,
	className: string,
	methodName: string,
): { owner: string; method: DexMethodEntry } | null {
	const ownerHit = index.classes.find(c => c.name.toLowerCase().includes(className.toLowerCase()));
	if (!ownerHit) return null;
	const method = ownerHit.methods.find(m => describeEntry(m).toLowerCase().includes(methodName.toLowerCase()));
	if (!method) return null;
	return { owner: ownerHit.name, method };
}

export function registerDisassembleDexMethodTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<DisassembleDexMethodInput>({
		id: "disassemble_dex_method",
		name: "disassemble_dex_method",
		label: "%tool.dex.insn.label%",
		description: [
			"Read the code_item of one DEX method and disassemble its Dalvik instruction stream into",
			"`offset: op operands` lines — registers size, argument/result count, and the body of a",
			"licence, call to a gate or endpoint. This is the code-item-level drill-down that",
			"`search_dex_symbols` deliberately does not provide: search finds the method, this shows",
			"what it executes.",
			"",
			"Locate the method by class-name and method-name fragments (lowercased substrings, same match as",
			"`search_dex_symbols`), then hand it a DEX file or an APK. The first matching method on the first",
			"matching class across the first `classes*.dex` is returned. Provide both fragments when a class",
			"has many overloads: pass the descriptor or enough of the signature to disambiguate.",
			"",
			"Runs end-to-end statically on raw bytes — it does not decompile to Java, does not run the code,",
			"and reads the instruction stream straight out of the code_item. Rare or irregular opcodes are",
			"rendered as `raw/<op>` instead of being guessed."
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "APK, ZIP or `.dex` file, absolute or relative to the session working directory." },
				className: { type: "string", description: "Lowercased substring of the declaring class, e.g. `com/example`. Required." },
				methodName: { type: "string", description: "Lowercased substring of the method name or signature, e.g. `checkLicence` or `(Ljava/lang/String;)Z`. Defaults to the first method." },
				limit: { type: "integer", description: `Max instruction rows (default full body, cap ${MAX_INSTRUCTIONS}).` },
			},
			required: ["path", "className"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 120_000,
		handler: async context => {
			try {
				const input = context.trigger.input;
				const className = (input.className ?? "").trim();
				if (className === "") return "disassemble_dex_method needs a non-empty `className`.";
				const sample = await loadSample(context.host.fs, context.session.cwd, input.path ?? "");
				const dexFiles = await collectDexFiles(sample.bytes, sample.name);
				if (dexFiles.length === 0) return `${sample.name} is neither a DEX file nor a ZIP/APK archive with classes*.dex.`;
				const methodQuery = (input.methodName ?? "").trim();
				const cap = Math.max(1, Math.min(MAX_INSTRUCTIONS, Math.trunc(input.limit ?? MAX_INSTRUCTIONS)));

				const lines = [`# Dalvik body of a DEX method in ${sample.name}`];
				let found = false;
				for (const file of dexFiles) {
					const index = indexDex(file.bytes);
					const target = findMethod(index, className, methodQuery);
					if (!target) continue;
					found = true;
					const { owner, method } = target;
					const code = readCodeItem(file.bytes, method.codeOff, cap);
					lines.push("", `\`${owner}\``, "", `\`${describeEntry(method)}\``, "");
					lines.push(`registers=${code.registersSize} · ins=${code.insSize} · outs=${code.outsSize} · tries=${code.triesSize} · insns=${code.insnsSize} words`, "");
					if (code.instructions.length === 0) {
						lines.push("_empty body (abstract, native or zero instruction words)_");
					} else {
						lines.push("| off | insn |", "| --- | --- |");
						for (const insn of code.instructions) lines.push(formatInsn(insn));
					}
					for (const note of code.notes) lines.push(`- ${note}`);
					break;
				}
				if (!found) {
					lines.push("", `No method matched class \`${className}\`` + (methodQuery ? ` and method \`${methodQuery}\`` : ""));
					lines.push("Try a shorter class fragment first; `search_dex_symbols` with kind=method can confirm the exact names.");
				}
				return lines.join("\n");
			} catch (error) {
				return `DEX method disassembly failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}

function formatInsn(insn: DalvikInstruction): string {
	return `| ${insn.offset} | \`${insn.op} ${insn.operands}\` |`;
}