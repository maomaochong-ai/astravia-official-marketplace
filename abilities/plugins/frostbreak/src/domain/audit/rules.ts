export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type RuleCategory = "manifest" | "code" | "native" | "package" | "format";

export interface RuleDefinition {
	id: string;
	title: string;
	severity: Severity;
	advice: string;
	category: RuleCategory;
}

export const SEVERITY_ORDER: readonly Severity[] = ["critical", "high", "medium", "low", "info"];

export const SEVERITY_WEIGHT: Record<Severity, number> = {
	critical: 45,
	high: 22,
	medium: 10,
	low: 4,
	info: 0,
};

/**
 * 规则表是「id → 文案 + 默认级别」的唯一来源。领域层只产出 id 与证据，
 * UI 用 `rule.<id>.title` 取本地化文案，markdown 报告用这里的英文。
 */
export const RULES: readonly RuleDefinition[] = [
	// —— 清单 ——
	{
		id: "apk.debuggable",
		title: "Application is debuggable",
		severity: "high",
		advice: "Remove android:debuggable from release builds. A debuggable app lets anyone attach a debugger and read memory or rewrite logic.",
		category: "manifest",
	},
	{
		id: "apk.exported-component",
		title: "Component is exported without a permission",
		severity: "high",
		advice: "Set android:exported=\"false\" unless other apps must reach this component, or guard it with a signature-level permission.",
		category: "manifest",
	},
	{
		id: "apk.exported-provider",
		title: "Content provider is reachable by other apps",
		severity: "high",
		advice: "Providers often expose files or databases. Restrict them with android:permission or android:exported=\"false\".",
		category: "manifest",
	},
	{
		id: "apk.allow-backup",
		title: "Application data can be backed up",
		severity: "medium",
		advice: "android:allowBackup=\"true\" lets `adb backup` copy private data off the device. Disable it or add backup rules that exclude secrets.",
		category: "manifest",
	},
	{
		id: "apk.cleartext-traffic",
		title: "Cleartext HTTP traffic is allowed",
		severity: "medium",
		advice: "Set android:usesCleartextTraffic=\"false\" or ship a network security config that limits cleartext to specific hosts.",
		category: "manifest",
	},
	{
		id: "apk.min-sdk-low",
		title: "Minimum SDK predates modern platform hardening",
		severity: "medium",
		advice: "minSdkVersion below 24 keeps devices without the current TLS, storage and permission model in scope.",
		category: "manifest",
	},
	{
		id: "apk.dangerous-permission",
		title: "Dangerous permissions are requested",
		severity: "medium",
		advice: "Check that each runtime permission maps to a visible feature; silent background access to contacts, SMS or location is a common overreach.",
		category: "manifest",
	},
	{
		id: "apk.test-only",
		title: "Package is flagged testOnly",
		severity: "low",
		advice: "android:testOnly=\"true\" marks a build that the platform will not install from a normal source.",
		category: "manifest",
	},
	{
		id: "apk.legacy-storage",
		title: "Legacy external storage is requested",
		severity: "low",
		advice: "requestLegacyExternalStorage opts out of scoped storage and broadens file access.",
		category: "manifest",
	},
	{
		id: "apk.no-signature",
		title: "No APK signature scheme detected",
		severity: "high",
		advice: "An unsigned or stripped package cannot be trusted to match its publisher. Re-download it from the official store.",
		category: "manifest",
	},
	{
		id: "apk.signature-v1-only",
		title: "Only the legacy v1 signature is present",
		severity: "low",
		advice: "v1 (JAR signing) does not cover the whole archive. Modern devices expect v2 or v3.",
		category: "manifest",
	},

	// —— 代码 ——
	{
		id: "apk.dynamic-loading",
		title: "Code is loaded at runtime",
		severity: "high",
		advice: "DexClassLoader / InMemoryDexClassLoader hide the real logic from static review. Dump the decrypted dex before trusting the build.",
		category: "code",
	},
	{
		id: "apk.shell-exec",
		title: "Shell commands are executed",
		severity: "medium",
		advice: "Runtime.exec / ProcessBuilder on a shipping app usually means root checks or bundled tooling; confirm what is executed.",
		category: "code",
	},
	{
		id: "apk.native-loading",
		title: "Native libraries are loaded from code",
		severity: "info",
		advice: "System.load / System.loadLibrary points at the .so files under lib/. Review them with the native checks.",
		category: "code",
	},
	{
		id: "apk.device-identifiers",
		title: "Device identifiers are read",
		severity: "low",
		advice: "IMEI / IMSI / subscriber id reads are restricted on modern Android and are a privacy signal.",
		category: "code",
	},
	{
		id: "apk.location-tracking",
		title: "Location APIs are referenced",
		severity: "low",
		advice: "Match the location calls with the permissions the manifest declares and with what the UI explains.",
		category: "code",
	},
	{
		id: "apk.weak-crypto",
		title: "Weak or ECB-mode cryptography",
		severity: "medium",
		advice: "MD5, DES and ECB mode leak structure. Use AES-GCM with a random IV instead.",
		category: "code",
	},
	{
		id: "apk.package-install",
		title: "The app can install other packages",
		severity: "high",
		advice: "REQUEST_INSTALL_PACKAGES plus PackageInstaller means the app can drop additional APKs. Verify the download source.",
		category: "code",
	},
	{
		id: "apk.reflection",
		title: "Reflection or external class loading",
		severity: "low",
		advice: "loadClass / URLClassLoader is often used to hide strings and entry points from static scanners.",
		category: "code",
	},
	{
		id: "apk.root-trace",
		title: "Root or superuser references",
		severity: "low",
		advice: "`su` and Magisk strings usually indicate a root check rather than an exploit, but they also appear in droppers.",
		category: "code",
	},
	{
		id: "apk.hardcoded-secret",
		title: "Credential-shaped string in the binaries",
		severity: "high",
		advice: "API keys and tokens baked into an app are public once it ships. Rotate the key and move it behind your own backend.",
		category: "code",
	},

	// —— 包结构 ——
	{
		id: "archive.path-traversal",
		title: "Archive contains unsafe entry names",
		severity: "high",
		advice: "Absolute paths or `..` segments can overwrite files when the archive is extracted naively.",
		category: "package",
	},
	{
		id: "archive.duplicate-entry",
		title: "Duplicate entry names in the archive",
		severity: "low",
		advice: "Two entries with the same name resolve differently per reader, a classic way to smuggle content past a checker.",
		category: "package",
	},
	{
		id: "archive.embedded-executable",
		title: "Executables are bundled as resources",
		severity: "medium",
		advice: "Executables inside assets/ or res/raw/ are dropped at runtime. Inspect them separately.",
		category: "package",
	},
	{
		id: "archive.high-entropy-payload",
		title: "Large incompressible payload",
		severity: "medium",
		advice: "High entropy plus few readable strings usually means an encrypted or packed payload rather than ordinary resources.",
		category: "package",
	},
	{
		id: "archive.uncompressed-bloat",
		title: "Archive stores entries uncompressed",
		severity: "info",
		advice: "Stored entries are normal for already-compressed media, but also let content be scanned without inflating.",
		category: "package",
	},

	// —— 原生二进制 ——
	{
		id: "native.rwx-segment",
		title: "Writable and executable segment",
		severity: "high",
		advice: "A W+X mapping defeats NX and is a strong sign of self-modifying or shellcode-style code.",
		category: "native",
	},
	{
		id: "native.executable-stack",
		title: "Stack is executable",
		severity: "medium",
		advice: "Requesting an executable stack (PT_GNU_STACK with X, or MH_ALLOW_STACK_EXECUTION) removes a core mitigation.",
		category: "native",
	},
	{
		id: "native.no-pie",
		title: "Position independent execution is disabled",
		severity: "medium",
		advice: "Non-PIE images load at a fixed address, which makes return-oriented attacks much easier.",
		category: "native",
	},
	{
		id: "native.no-nx",
		title: "NX compatibility is not declared",
		severity: "medium",
		advice: "The PE image does not advertise NX_COMPAT, so the loader may map writable pages as executable.",
		category: "native",
	},
	{
		id: "native.packed",
		title: "Binary looks packed",
		severity: "medium",
		advice: "High section entropy with almost no imports is the UPX / packer signature. Unpack before reading the code.",
		category: "native",
	},
	{
		id: "native.debug-symbols",
		title: "Debug symbols are still present",
		severity: "info",
		advice: "Not a vulnerability, but it hands over function names and file paths for free.",
		category: "native",
	},
	{
		id: "native.statically-linked",
		title: "Statically linked binary",
		severity: "info",
		advice: "Static linking bundles third-party libraries, so their CVE list applies to this one file.",
		category: "native",
	},
	{
		id: "native.dotnet",
		title: ".NET assembly",
		severity: "info",
		advice: "The CLR header is present, so the IL can be decompiled directly instead of reading machine code.",
		category: "native",
	},
	{
		id: "native.authenticode",
		title: "PE signature directory is present",
		severity: "info",
		advice: "The image carries an Authenticode blob. Verify the signer with the platform tooling rather than trusting the header.",
		category: "native",
	},

	// —— 格式兜底 ——
	{
		id: "format.unknown",
		title: "Format not recognised",
		severity: "info",
		advice: "Only strings and entropy were collected. Identify the container before drawing conclusions.",
		category: "format",
	},
	{
		id: "format.sampled",
		title: "Analysis ran on a sample",
		severity: "info",
		advice: "Very large inputs are sampled so the report stays bounded; the limits section lists what was skipped.",
		category: "format",
	},
];

export const RULES_BY_ID = new Map(RULES.map(rule => [rule.id, rule]));

export function ruleFor(id: string): RuleDefinition {
	return (
		RULES_BY_ID.get(id) ?? {
			id,
			title: id,
			severity: "info",
			advice: "No description registered for this rule.",
			category: "format",
		}
	);
}

export function severityRank(severity: Severity): number {
	const index = SEVERITY_ORDER.indexOf(severity);
	return index < 0 ? SEVERITY_ORDER.length : index;
}

export function gradeFor(score: number): "A" | "B" | "C" | "D" | "E" {
	if (score < 10) return "A";
	if (score < 30) return "B";
	if (score < 55) return "C";
	if (score < 75) return "D";
	return "E";
}
