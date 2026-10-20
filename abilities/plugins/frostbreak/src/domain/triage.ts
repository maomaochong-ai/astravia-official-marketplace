import { finding, type Finding } from "./audit/findings";
import { parseAxml } from "./archive/axml";
import { readSignatureFacts, summarizeArchive, type ArchiveFacts, type SignatureFacts } from "./archive/archive-facts";
import { findZipEntry, looksLikeZip, readZipEntry, readZipIndex, type ZipIndex } from "./archive/zip";
import { auditAndroid } from "./android/audit";
import { looksLikeDex, mergeDexFacts, parseDex, type DexFacts } from "./android/dex";
import { buildManifestFacts, type AndroidManifestFacts } from "./android/manifest-model";
import { sha256Hex } from "./digest";
import { entropyOfRange, highEntropyBands } from "./entropy";
import { auditNative, hottestSections } from "./native/audit";
import { looksLikeElf, parseElf } from "./native/elf";
import { looksLikeMacho, parseMacho } from "./native/macho";
import { looksLikePe, parsePe } from "./native/pe";
import type { NativeFacts } from "./native/types";
import { buildReport, formatBytes, type ReportRow, type ReportSection, type ReportMode, type TriageReport } from "./report/report";
import { extractStrings } from "./strings";

export type SampleFormat = "apk" | "aab" | "ipa" | "jar" | "zip" | "elf" | "pe" | "macho" | "dex" | "unknown";

export interface TriageSample {
	path: string;
	name: string;
	bytes: Uint8Array;
}

export interface TriageOptions {
	mode?: ReportMode;
	generatedAt?: string;
	maxStrings?: number;
}

const MAX_DEX_FILES = 6;
const MAX_STRING_SCAN = 24 * 1024 * 1024;

const FORMAT_LABELS: Record<SampleFormat, string> = {
	apk: "Android package (APK)",
	aab: "Android App Bundle (AAB)",
	ipa: "iOS app package (IPA)",
	jar: "Java archive (JAR)",
	zip: "ZIP archive",
	elf: "ELF binary",
	pe: "PE / Windows image",
	macho: "Mach-O image",
	dex: "Dalvik executable (DEX)",
	unknown: "Unrecognised binary",
};

function row(label: string, value: string | number | boolean | null | undefined): ReportRow | null {
	if (value === null || value === undefined || value === "") return null;
	return { label, value: typeof value === "boolean" ? (value ? "yes" : "no") : String(value) };
}

function compact(rows: (ReportRow | null)[]): ReportRow[] {
	return rows.filter((item): item is ReportRow => item !== null);
}

function percent(part: number, total: number): string {
	if (total <= 0) return "0%";
	return `${((part / total) * 100).toFixed(1)}%`;
}

function detectArchiveFormat(index: ZipIndex): SampleFormat {
	const names = new Set(index.entries.map(entry => entry.name));
	if (names.has("AndroidManifest.xml") && (names.has("classes.dex") || names.has("resources.arsc"))) return "apk";
	if (names.has("BundleConfig.pb") || names.has("base/manifest/AndroidManifest.xml")) return "aab";
	if (index.entries.some(entry => /^Payload\/[^/]+\.app\//.test(entry.name))) return "ipa";
	if (names.has("META-INF/MANIFEST.MF")) return "jar";
	return "zip";
}

function detectFormat(bytes: Uint8Array): SampleFormat {
	if (looksLikeZip(bytes)) return "zip";
	if (looksLikeElf(bytes)) return "elf";
	if (looksLikePe(bytes)) return "pe";
	if (looksLikeMacho(bytes)) return "macho";
	if (looksLikeDex(bytes)) return "dex";
	return "unknown";
}

async function readDexFiles(bytes: Uint8Array, index: ZipIndex, names: readonly string[]): Promise<DexFacts[]> {
	const out: DexFacts[] = [];
	for (const name of names.slice(0, MAX_DEX_FILES)) {
		const entry = findZipEntry(index, name);
		if (!entry) continue;
		try {
			out.push(parseDex(await readZipEntry(bytes, entry)));
		} catch {
			// 单个 dex 解不出来不该让整份报告失败；limits 里会写明只读到几个。
		}
	}
	return out;
}

function archiveSections(archive: ArchiveFacts, index: ZipIndex): ReportSection[] {
	const largest = [...index.entries]
		.filter(entry => !entry.isDirectory)
		.sort((left, right) => right.uncompressedSize - left.uncompressedSize)
		.slice(0, 15)
		.map(entry => ({ label: entry.name, value: `${formatBytes(entry.uncompressedSize)} · method ${entry.method}` }));

	return [
		{
			id: "archive",
			title: "Archive layout",
			columns: ["Entry", "Size"],
			rows: largest,
		},
		{
			id: "native-libraries",
			title: "Bundled native libraries",
			columns: ["Library", "ABI / size"],
			rows: archive.nativeLibraries.slice(0, 20).map(library => ({ label: library.path, value: `${library.abi} · ${formatBytes(library.size)}` })),
		},
	];
}

function manifestRows(manifest: AndroidManifestFacts | null): ReportRow[] {
	if (!manifest) return [];
	return compact([
		row("Package", manifest.packageName),
		row("Version name", manifest.versionName),
		row("Version code", manifest.versionCode),
		row("minSdk", manifest.minSdk),
		row("targetSdk", manifest.targetSdk),
		row("compileSdk", manifest.compileSdk),
		row("Application class", manifest.applicationName),
		row("Debuggable", manifest.debuggable),
		row("Test only", manifest.testOnly),
		row("Allow backup", manifest.allowBackup),
		row("Cleartext traffic", manifest.usesCleartextTraffic),
		row("Network security config", manifest.networkSecurityConfig),
		row("Permissions", manifest.permissions.length),
		row("Components", manifest.components.length),
		row("Queried packages", manifest.queriesPackages.join(", ") || null),
	]);
}

function manifestSections(manifest: AndroidManifestFacts | null): ReportSection[] {
	if (!manifest) return [];
	const components = manifest.components.slice(0, 40).map(component => ({
		label: `${component.type} ${component.name}`,
		value: [
			component.exported ? "exported" : "internal",
			component.permission ? `permission ${component.permission}` : "no permission",
			component.actions.length > 0 ? component.actions.slice(0, 2).join(", ") : "",
		]
			.filter(Boolean)
			.join(" · "),
	}));

	return [
		{ id: "components", title: "Components", columns: ["Component", "Exposure"], rows: components },
		{
			id: "permissions",
			title: "Requested permissions",
			columns: ["Permission", "Note"],
			rows: manifest.permissions.map(permission => ({
				label: permission,
				value: permission.startsWith("android.permission.") ? "platform" : "custom / third-party",
			})),
		},
	];
}

function nativeSections(facts: NativeFacts): ReportSection[] {
	const sections = hottestSections(facts, 20).map(section => ({
		label: section.name,
		value: `${formatBytes(section.size)} · entropy ${section.entropy.toFixed(2)}`,
	}));
	const imports = facts.imports
		.filter(group => group.functions.length > 0)
		.slice(0, 20)
		.map(group => ({ label: group.library, value: `${group.functions.length} functions · ${group.functions.slice(0, 4).join(", ")}` }));

	return [
		{ id: "native-sections", title: "Sections by entropy", columns: ["Section", "Size / entropy"], rows: sections },
		{ id: "imports", title: "Imports", columns: ["Library", "Functions"], rows: imports },
	];
}

function nativeFactsRows(facts: NativeFacts): ReportRow[] {
	return compact([
		row("Format", facts.format.toUpperCase()),
		row("Architecture", facts.arch),
		row("Bits", facts.bits),
		row("Endianness", facts.endianness),
		row("Kind", facts.kind),
		row("Entry point", facts.entryPoint > 0 ? `0x${facts.entryPoint.toString(16)}` : null),
		row("Position independent", facts.pie),
		row("Executable stack", facts.executableStack),
		row("NX compatible", facts.nxCompat),
		row("Stripped", facts.stripped),
		row("Signed", facts.signed),
		row(".NET assembly", facts.dotnet),
		row("Interpreter", facts.interpreter),
		row("Linked libraries", facts.libraries.length > 0 ? facts.libraries.length : facts.imports.length),
	]);
}

interface Draft {
	findings: Finding[];
	facts: ReportRow[];
	sections: ReportSection[];
	limits: string[];
	summary: string[];
}

async function analyseApkLike(bytes: Uint8Array, index: ZipIndex, format: SampleFormat): Promise<Draft> {
	const archive = summarizeArchive(index);
	const signature: SignatureFacts = { v1: false, v2: false, v3: false, schemes: [] };
	const limits: string[] = [];
	const summary: string[] = [];
	let manifest: AndroidManifestFacts | null = null;
	let dex: DexFacts | null = null;

	if (format === "apk") {
		const manifestEntry = findZipEntry(index, "AndroidManifest.xml");
		if (manifestEntry) {
			try {
				const document = parseAxml(await readZipEntry(bytes, manifestEntry));
				if (document.root) manifest = buildManifestFacts(document.root);
				else limits.push(`AndroidManifest.xml could not be decoded: ${document.warnings.join("; ") || "no manifest element"}`);
			} catch (error) {
				limits.push(`AndroidManifest.xml could not be read: ${error instanceof Error ? error.message : String(error)}`);
			}
		} else {
			limits.push("AndroidManifest.xml is missing from the archive.");
		}

		const facts = readSignatureFacts(bytes, index);
		signature.v1 = facts.v1;
		signature.v2 = facts.v2;
		signature.v3 = facts.v3;
		signature.schemes = facts.schemes;
		summary.push(`Signature schemes: ${facts.schemes.length > 0 ? facts.schemes.join(", ") : "none detected"}`);
	} else if (format === "aab") {
		limits.push("App bundle manifests are protobuf encoded; open the generated APK for manifest-level checks.");
	}

	const dexFacts = await readDexFiles(bytes, index, archive.dexEntries);
	const parsedDex = dexFacts.length > 0 ? mergeDexFacts(dexFacts) : null;
	dex = parsedDex;
	if (archive.dexEntries.length > MAX_DEX_FILES) limits.push(`Only the first ${MAX_DEX_FILES} DEX files were parsed.`);
	if (parsedDex?.truncated) limits.push("The DEX string pool was truncated to keep the report bounded.");

	const extraStrings = extractStrings(bytes, { maxResults: 400, encodings: ["ascii"], minLength: 6 }).map(item => item.value);
	const findings = auditAndroid({ manifest, dex, signature, archive, extraStrings });

	if (manifest?.packageName) summary.unshift(`${manifest.packageName}${manifest.versionName ? ` ${manifest.versionName}` : ""} · ${manifest.components.length} components`);
	if (archive.nativeLibraries.length > 0) summary.push(`${archive.nativeLibraries.length} native librar${archive.nativeLibraries.length === 1 ? "y" : "ies"} for ${archive.abis.join(", ")}`);

	const facts = compact([
		row("Archive entries", archive.entryCount),
		row("Uncompressed size", formatBytes(archive.totalUncompressed)),
		row("Expansion ratio", percent(archive.totalUncompressed, bytes.byteLength)),
		row("Stored (uncompressed) entries", archive.storedEntries),
		row("DEX files", archive.dexEntries.length),
		row("Resource table", archive.resourceTable),
		row("Asset entries", archive.assetEntries),
		row("Native libraries", archive.nativeLibraries.length),
		row("ABIs", archive.abis.join(", ") || null),
		row("Signature schemes", signature.schemes.join(", ") || "none"),
		row("Largest entry", archive.largestEntry ? `${archive.largestEntry.name} (${formatBytes(archive.largestEntry.size)})` : null),
	]);

	const sections = [
		{ id: "manifest", title: "Manifest", columns: ["Field", "Value"] as [string, string], rows: manifestRows(manifest) },
		...manifestSections(manifest),
		{
			id: "dex",
			title: "DEX summary",
			columns: ["Field", "Value"] as [string, string],
			rows: compact([
				row("DEX version", parsedDex?.version),
				row("Strings", parsedDex?.stringCount),
				row("Types", parsedDex?.typeCount),
				row("Methods", parsedDex?.methodCount),
				row("Classes", parsedDex?.classCount),
			]),
		},
		...archiveSections(archive, index),
	];

	limits.push(
		"APK signatures are detected structurally; the digests are not cryptographically verified.",
		"DEX analysis reads the string pool only — no decompilation or control-flow review.",
		`Readable strings were sampled from the first ${formatBytes(MAX_STRING_SCAN)} of the file.`,
	);

	return { findings, facts, sections, limits, summary };
}

async function analyseIpa(bytes: Uint8Array, index: ZipIndex): Promise<Draft> {
	const archive = summarizeArchive(index);
	const limits = [
		"IPA analysis reads the first Mach-O binary inside Payload/*.app; frameworks and dylibs are not walked.",
		"Code signing entitlements are not parsed; use codesign on a macOS host for that.",
	];
	const candidates = index.entries.filter(entry => /^Payload\/[^/]+\.app\/[^/]+$/.test(entry.name) && !entry.isDirectory);
	let native: NativeFacts | null = null;
	let findings: Finding[] = [];

	for (const entry of candidates.slice(0, 3)) {
		try {
			const raw = await readZipEntry(bytes, entry);
			const parsed = parseMacho(raw);
			if (parsed.value) {
				native = parsed.value;
				findings = auditNative(parsed.value, raw);
				limits.push(`Main binary analysed: ${entry.name}`);
				break;
			}
		} catch {
			// 继续找下一个候选，IPA 里常有多个无扩展名文件。
		}
	}
	if (!native) limits.push("No Mach-O binary could be parsed from Payload/*.app.");

	const facts = compact([
		row("Archive entries", archive.entryCount),
		row("Uncompressed size", formatBytes(archive.totalUncompressed)),
		row("Native libraries", archive.nativeLibraries.length),
		row("Main binary architecture", native ? `${native.arch} (${native.bits}-bit)` : null),
		row("Position independent", native?.pie),
		row("Executable stack", native?.executableStack),
	]);

	const sections: ReportSection[] = [...archiveSections(archive, index)];
	if (native) {
		sections.unshift(
			{ id: "native-facts", title: "Mach-O facts", columns: ["Field", "Value"], rows: nativeFactsRows(native) },
			...nativeSections(native),
		);
	}

	return {
		findings,
		facts,
		sections,
		limits,
		summary: native ? [`Mach-O ${native.arch} · ${native.kind}`] : [],
	};
}

function analyseZip(bytes: Uint8Array, index: ZipIndex): Draft {
	const archive = summarizeArchive(index);
	const findings: Finding[] = [];
	if (archive.unsafePaths.length > 0) findings.push(finding("archive.path-traversal", "Entry names escape the extraction root.", archive.unsafePaths));
	if (archive.duplicateNames.length > 0) findings.push(finding("archive.duplicate-entry", "Duplicate entry names were found.", archive.duplicateNames));
	if (archive.embeddedExecutables.length > 0) {
		findings.push(finding("archive.embedded-executable", "Executables are bundled as plain resources.", archive.embeddedExecutables));
	}
	if (archive.entryCount > 0 && archive.storedEntries / archive.entryCount > 0.8) {
		findings.push(finding("archive.uncompressed-bloat", `${archive.storedEntries} of ${archive.entryCount} entries are stored without compression.`));
	}

	const facts = compact([
		row("Archive entries", archive.entryCount),
		row("Uncompressed size", formatBytes(archive.totalUncompressed)),
		row("Expansion ratio", percent(archive.totalUncompressed, bytes.byteLength)),
		row("Stored entries", archive.storedEntries),
		row("Largest entry", archive.largestEntry ? `${archive.largestEntry.name} (${formatBytes(archive.largestEntry.size)})` : null),
	]);

	return {
		findings,
		facts,
		sections: archiveSections(archive, index),
		limits: ["Archive contents were listed; entries were not decompiled or executed."],
		summary: [`${archive.entryCount} entries · ${formatBytes(archive.totalUncompressed)} uncompressed`],
	};
}

function analyseNative(bytes: Uint8Array, format: "elf" | "pe" | "macho"): Draft {
	const parsed = format === "elf" ? parseElf(bytes) : format === "pe" ? parsePe(bytes) : parseMacho(bytes);
	if (!parsed.value) {
		return {
			findings: [finding("format.unknown", parsed.warnings[0] ?? "The header could not be parsed.")],
			facts: compact([row("Format", format.toUpperCase()), row("Overall entropy", entropyOfRange(bytes, 0, bytes.byteLength, 1024 * 1024).toFixed(2))]),
			sections: [],
			limits: parsed.warnings,
			summary: [],
		};
	}

	const facts = parsed.value;
	const findings = auditNative(facts, bytes);
	const bands = highEntropyBands(bytes, { maxBands: 5 });
	const limits = [...parsed.warnings.filter(Boolean)];

	return {
		findings,
		facts: compact([
			...nativeFactsRows(facts),
			row("Overall entropy", entropyOfRange(bytes, 0, bytes.byteLength, 1024 * 1024).toFixed(2)),
			row("High-entropy regions", bands.length > 0 ? `${bands.length} ≥ 7.4 bit/byte blocks` : "none"),
		]),
		sections: nativeSections(facts),
		limits,
		summary: [`${FORMAT_LABELS[facts.format]} · ${facts.arch} · ${facts.kind}`],
	};
}

function analyseDex(bytes: Uint8Array, mode: ReportMode): Draft {
	const facts = parseDex(bytes);
	const findings = auditAndroid({
		manifest: null,
		dex: facts,
		signature: { v1: false, v2: false, v3: false, schemes: [] },
		archive: summarizeArchive({ entries: [], centralDirectoryOffset: 0, comment: "", zip64: false }),
		extraStrings: [],
	}).filter(item => item.ruleId !== "apk.no-signature");

	return {
		findings,
		facts: compact([
			row("DEX version", facts.version),
			row("Strings", facts.stringCount),
			row("Types", facts.typeCount),
			row("Methods", facts.methodCount),
			row("Classes", facts.classCount),
		]),
		sections: [
			{
				id: "string-sample",
				title: "String sample",
				columns: ["String", "Length"],
				rows: facts.strings.slice(0, mode === "summary" ? 12 : 60).map(value => ({ label: value.slice(0, 120), value: String(value.length) })),
			},
		],
		limits: ["A standalone DEX has no manifest, so no permission or component checks ran."],
		summary: [`${facts.classCount} classes · ${facts.methodCount} methods`],
	};
}

function analyseUnknown(bytes: Uint8Array): Draft {
	const entropy = entropyOfRange(bytes, 0, bytes.byteLength, 1024 * 1024);
	const bands = highEntropyBands(bytes, { maxBands: 5 });
	const strings = extractStrings(bytes, { maxResults: 60 });
	const findings: Finding[] = [finding("format.unknown", "No known container signature matched (ZIP, ELF, PE, Mach-O, DEX).")];
	if (entropy >= 7.2 && bytes.byteLength >= 64 * 1024) {
		findings.push(finding("archive.high-entropy-payload", `Overall entropy is ${entropy.toFixed(2)} bit/byte.`, [`${bands.length} high-entropy block(s)`]));
	}

	return {
		findings,
		facts: compact([
			row("Size", formatBytes(bytes.byteLength)),
			row("Overall entropy", entropy.toFixed(2)),
			row("High-entropy regions", bands.length),
			row("Extracted strings", strings.length),
		]),
		sections: [
			{
				id: "strings",
				title: "String sample",
				columns: ["String", "Offset"],
				rows: strings.slice(0, 40).map(item => ({ label: item.value.slice(0, 120), value: `0x${item.offset.toString(16)}` })),
			},
		],
		limits: ["Only strings and entropy were collected — the container format is unknown."],
		summary: [],
	};
}

export async function triage(sample: TriageSample, options: TriageOptions = {}): Promise<TriageReport> {
	const mode: ReportMode = options.mode ?? "summary";
	const bytes = sample.bytes;
	const detected = detectFormat(bytes);
	const limits: string[] = [];
	let draft: Draft;
	let resolved: SampleFormat = detected;

	if (detected === "zip" || detected === "apk" || detected === "aab" || detected === "ipa" || detected === "jar") {
		let index: ZipIndex | null = null;
		try {
			index = readZipIndex(bytes);
		} catch (error) {
			limits.push(`ZIP index could not be read: ${error instanceof Error ? error.message : String(error)}`);
		}
		if (index) {
			const format = detected === "zip" ? detectArchiveFormat(index) : detected;
			resolved = format;
			draft =
				format === "apk" || format === "aab"
					? await analyseApkLike(bytes, index, format)
					: format === "ipa"
						? await analyseIpa(bytes, index)
						: analyseZip(bytes, index);
			draft.limits.unshift(...limits);
		} else {
			resolved = "unknown";
			draft = analyseUnknown(bytes);
			draft.limits.unshift(...limits);
		}
	} else if (detected === "elf" || detected === "pe" || detected === "macho") {
		draft = analyseNative(bytes, detected);
	} else if (detected === "dex") {
		draft = analyseDex(bytes, mode);
	} else {
		draft = analyseUnknown(bytes);
	}

	return buildReport({
		mode,
		target: {
			path: sample.path,
			name: sample.name,
			size: bytes.byteLength,
			sha256: sha256Hex(bytes),
			format: resolved,
			formatLabel: FORMAT_LABELS[resolved],
			generatedAt: options.generatedAt ?? new Date().toISOString(),
		},
		findings: draft.findings,
		facts: draft.facts,
		sections: draft.sections,
		limits: draft.limits,
		summary: draft.summary,
	});
}
