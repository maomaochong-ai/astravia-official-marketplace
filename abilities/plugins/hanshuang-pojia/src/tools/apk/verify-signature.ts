import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { normaliseExpectedDigest, parseApksignerVerdict, type ApksignerVerdict } from "../../domain/android/apk-signature";
import { readSignatureFacts, type SignatureFacts } from "../../domain/archive/archive-facts";
import { findZipEntries, looksLikeZip, readZipEntry, readZipIndex } from "../../domain/archive/zip";
import { sha256Hex } from "../../domain/digest";
import { specFor, type CommandRunner } from "../../domain/toolchain/catalog";
import { createCommandRunner, describeCommandFailure, probeOnce } from "../../features/workbench/services/toolchain";
import { loadSample } from "../lib/read-sample";
import { publishToolResult } from "../../runtime/panel-channel";

const MAX_CHARS = 12_000;
const MAX_V1_BLOCKS = 6;
const APKSIGNER_TIMEOUT_MS = 60_000;

const V1_BLOCK = /^META-INF\/[^/]+\.(RSA|DSA|EC)$/i;

type VerifyMode = "auto" | "structural" | "apksigner";

interface VerifySignatureInput {
	path?: string;
	mode?: VerifyMode;
	expected_digest?: string;
	max_chars?: number;
}

interface V1Block {
	name: string;
	size: number;
	sha256: string;
}

/**
 * 验签工具。
 *
 * 分工与 `triage_binary` 划清：triage 的签名段只读结构（有哪套方案、v1 文件叫什么），
 * 这个工具才有资格说「验过了 / 没验过 / 签名者是谁、指纹是多少」。两段结论永远分开写，
 * 因为把它们混成一句就会让人以为结构存在等于签名有效。
 */
export function registerVerifySignatureTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<VerifySignatureInput>({
		id: "verify_signature",
		name: "verify_signature",
		label: "%tool.signature.label%",
		description: [
			"Verify an Android package signature and report who signed it: which schemes are present, whether",
			"`apksigner verify` accepts them, and each signer's certificate DN plus SHA-256 fingerprint.",
			"",
			"Two layers, always reported separately because they mean different things:",
			"  structural — v1 JAR files and the APK Signing Block's v2 / v3 / v3.1 ids, plus the SHA-256 of each",
			"               v1 certificate block. This proves what the file contains, not that it is valid.",
			"  apksigner  — the real cryptographic verdict: Verifies / DOES NOT VERIFY, per-scheme results, signer",
			"               certificates and key sizes, warnings (expired or soon-expiring certificates included).",
			"",
			"`expected_digest` compares against either a signer certificate SHA-256 or a v1 block digest, ignoring",
			"colons and case. Use it to answer 'is this the same signer as the build I shipped?'",
			"",
			"needs apksigner (Android build-tools) on PATH for the cryptographic layer; without it the answer is",
			"structural only and says so instead of implying a verification. install_toolchain with goal `apk`",
			"prints the install command for this platform.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "APK / AAB / APKS file, absolute or relative to the session working directory." },
				mode: {
					type: "string",
					enum: ["auto", "structural", "apksigner"],
					description: "auto (default) runs apksigner when available; structural skips it; apksigner fails loudly if it cannot run.",
				},
				expected_digest: { type: "string", description: "Optional SHA-256 to compare against a signer certificate or a v1 block." },
				max_chars: { type: "number", description: `Hard character cap on the answer (max ${MAX_CHARS}).` },
			},
			required: ["path"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 180_000,
		handler: async context => {
			const input = context.trigger.input;
			const mode: VerifyMode = input.mode === "structural" || input.mode === "apksigner" ? input.mode : "auto";
			const budget = Math.max(2_000, Math.min(MAX_CHARS, Math.trunc(input.max_chars ?? MAX_CHARS)));

			try {
				const sample = await loadSample(context.host.fs, context.session.cwd, input.path ?? "");
				if (!looksLikeZip(sample.bytes)) {
					return `${sample.name} is not a ZIP-based package, so it carries no APK signature. verify_signature reads APK / AAB / APKS only — for an APK embedded in something else, pull it out first.`;
				}

				const index = readZipIndex(sample.bytes);
				const facts = readSignatureFacts(sample.bytes, index);
				const v1Blocks: V1Block[] = [];
				for (const entry of findZipEntries(index, name => V1_BLOCK.test(name)).slice(0, MAX_V1_BLOCKS)) {
					const bytes = await readZipEntry(sample.bytes, entry);
					v1Blocks.push({ name: entry.name, size: bytes.byteLength, sha256: sha256Hex(bytes) });
				}

				const run = createCommandRunner(ctx);
				const wantsApksigner = mode !== "structural";
				let verdict: ApksignerVerdict | null = null;
				let apksignerNote: string | null = null;

				if (wantsApksigner && !run) {
					apksignerNote =
						"apksigner was not run: plugin.json#commands is empty or agent.command.run was not granted. The structural section below still describes the file.";
				} else if (wantsApksigner) {
					const outcome = await runApksigner(run!, sample.path, mode === "apksigner");
					verdict = outcome.verdict;
					apksignerNote = outcome.note;
				}

				const expected = input.expected_digest ? normaliseExpectedDigest(input.expected_digest) : "";
				publishToolResult({
					toolId: "verify_signature",
					kind: "signature",
					target: sample.path,
					summary: verdict
						? `${verdict.verifies === true ? "Verifies" : verdict.verifies === false ? "DOES NOT VERIFY" : "unresolved"}${verdict.signerCount ? ` · ${verdict.signerCount} signer(s)` : ""} in ${sample.name}`
						: `Structural only in ${sample.name}${apksignerNote ? " · apksigner not run" : ""}`,
					payload: {
						name: sample.name,
						mode,
						schemes: facts.schemes,
						verifies: verdict?.verifies ?? null,
						signerCount: verdict?.signerCount,
						signers: verdict?.signers.map(s => ({ dn: s.dn, certificateSha256: s.certificateSha256, algorithm: s.keyAlgorithm })),
						expected,
					},
				});
				const body = renderReport({ name: sample.name, facts, v1Blocks, verdict, apksignerNote, mode, expected });
				if (body.length <= budget) return body;
				return `${body.slice(0, budget)}\n... [TRUNCATED at ${budget} chars — raise max_chars for the rest]`;
			} catch (error) {
				return `Signature verification failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}

/** apksigner 的调用与「为什么没跑成」的区分：缺二进制、被宿主拦、跑出非零，三种说法。 */
async function runApksigner(
	run: CommandRunner,
	path: string,
	strict: boolean,
): Promise<{ verdict: ApksignerVerdict | null; note: string | null }> {
	const report = await probeOnce(run);
	const status = report.tools.find(tool => tool.id === "apksigner");
	if (!status || !status.available) {
		const spec = specFor("apksigner");
		const why = status?.blocked
			? `the host refused \`${spec.binary}\` (${status.detail}); declare it in plugin.json#commands and enable it in the plugin settings`
			: `\`${spec.binary}\` is not on PATH (${status?.detail ?? "not probed"}); install it with: ${spec.install}`;
		return { verdict: null, note: `apksigner did not run — ${why}.` };
	}

	try {
		const result = await run("apksigner", ["verify", "--print-certs", "--verbose", path], { timeoutMs: APKSIGNER_TIMEOUT_MS });
		return { verdict: parseApksignerVerdict(result.stdout, result.stderr, result.exitCode), note: null };
	} catch (error) {
		const message = describeCommandFailure(error);
		return { verdict: null, note: strict ? `apksigner failed: ${message}` : `apksigner could not complete: ${message}` };
	}
}

function yesNo(value: boolean): string {
	return value ? "yes" : "no";
}

function renderReport(input: {
	name: string;
	facts: SignatureFacts;
	v1Blocks: V1Block[];
	verdict: ApksignerVerdict | null;
	apksignerNote: string | null;
	mode: VerifyMode;
	expected: string;
}): string {
	const { name, facts, v1Blocks, verdict, apksignerNote, mode, expected } = input;
	const lines: string[] = [`# Signature — ${name}`, ""];

	lines.push("## Structural", "");
	lines.push("| scheme | present |", "| --- | --- |");
	lines.push(`| v1 (JAR) | ${yesNo(facts.v1)} |`);
	lines.push(`| v2 | ${yesNo(facts.v2)} |`);
	lines.push(`| v3 | ${yesNo(facts.v3)} |`);
	lines.push("");
	if (facts.schemes.length === 0) lines.push("No signature scheme detected — the package is unsigned.");
	if (v1Blocks.length > 0) {
		lines.push("v1 certificate blocks:", "");
		for (const block of v1Blocks) lines.push(`- \`${block.name}\` — ${block.size} B — sha256 \`${block.sha256}\``);
	} else if (facts.v1) {
		lines.push("v1 signature files exist but none could be read as a certificate block.");
	}
	lines.push(
		"",
		"Reading the structure proves the file contains these blocks. It does not prove the digests match the contents,",
		"so it is not a verdict — that is what the section below is for.",
		"",
	);

	lines.push("## apksigner", "");
	if (verdict === null) {
		lines.push(apksignerNote ?? "apksigner did not run.");
	} else {
		const word = verdict.verifies === true ? "Verifies" : verdict.verifies === false ? "DOES NOT VERIFY" : "could not be decided from the output";
		lines.push(`**${word}**`, "");
		if (verdict.schemes.length > 0) {
			lines.push("| scheme | verified |", "| --- | --- |");
			for (const scheme of verdict.schemes) lines.push(`| ${scheme.scheme} | ${yesNo(scheme.verified)} |`);
			lines.push("");
		}
		if (verdict.signerCount !== null) lines.push(`Signers: ${verdict.signerCount}`, "");
		for (const signer of verdict.signers) {
			lines.push(`### Signer #${signer.index}`, "");
			if (signer.dn) lines.push(`- DN: \`${signer.dn}\``);
			if (signer.certificateSha256) lines.push(`- certificate SHA-256: \`${signer.certificateSha256}\``);
			if (signer.keyAlgorithm) lines.push(`- key: ${signer.keyAlgorithm}${signer.keySizeBits ? ` (${signer.keySizeBits} bits)` : ""}`);
			if (signer.publicKeySha256) lines.push(`- public key SHA-256: \`${signer.publicKeySha256}\``);
			lines.push("");
		}
		if (verdict.warnings.length > 0) lines.push("Warnings:", ...verdict.warnings.map(item => `- ${item}`), "");
		if (verdict.errors.length > 0) lines.push("Errors:", ...verdict.errors.map(item => `- ${item}`), "");
		if (verdict.unparsed.length > 0) lines.push("Unrecognised lines:", ...verdict.unparsed.map(item => `- ${item}`), "");
	}

	if (expected) {
		const certHit = verdict?.signers.some(signer => signer.certificateSha256 === expected) ?? false;
		const blockHit = v1Blocks.some(block => block.sha256 === expected);
		lines.push("## Expected digest", "");
		if (certHit) lines.push(`Match: a signer certificate in this package has SHA-256 \`${expected}\`.`);
		else if (blockHit) lines.push(`Match: a v1 certificate block has SHA-256 \`${expected}\`.`);
		else lines.push(`No match: \`${expected}\` is neither a signer certificate nor a v1 block digest in this package.`);
		lines.push("");
	}

	if (mode === "structural") {
		lines.push(
			"## Not verified",
			"",
			"This run was structural only: it did not check any digest against the package contents. Re-run with",
			"`mode: \"auto\"` once apksigner is installed to get a verdict.",
			"",
		);
	}

	return lines.join("\n").trimEnd();
}
