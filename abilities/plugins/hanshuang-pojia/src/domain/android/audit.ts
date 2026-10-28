/**
 * Android 体检：把清单模型、DEX 事实与签名事实折成发现项。
 *
 * 只做「规则 → 发现」的映射，不重新解析字节。规则的严重级别与文案在
 * `domain/audit/rules.ts`，这里只引用，不复制。
 */

import type { ArchiveFacts, SignatureFacts } from "../archive/archive-facts";
import { finding, type Finding } from "../audit/findings";
import { scanSecrets } from "../audit/secrets";
import { matchApiFingerprints } from "../strings";
import type { DexFacts } from "./dex";
import type { AndroidManifestFacts } from "./manifest-model";

/** 运行时权限 + 只在现代 Android 上受严格管控的特殊权限。 */
const SENSITIVE_PERMISSIONS: Readonly<Record<string, string>> = {
	"android.permission.CAMERA": "camera",
	"android.permission.RECORD_AUDIO": "microphone",
	"android.permission.ACCESS_FINE_LOCATION": "precise location",
	"android.permission.ACCESS_COARSE_LOCATION": "approximate location",
	"android.permission.ACCESS_BACKGROUND_LOCATION": "background location",
	"android.permission.READ_CONTACTS": "contacts",
	"android.permission.WRITE_CONTACTS": "contacts",
	"android.permission.READ_SMS": "SMS",
	"android.permission.RECEIVE_SMS": "SMS",
	"android.permission.SEND_SMS": "SMS",
	"android.permission.READ_CALL_LOG": "call log",
	"android.permission.CALL_PHONE": "phone calls",
	"android.permission.READ_PHONE_STATE": "phone state",
	"android.permission.READ_PHONE_NUMBERS": "phone numbers",
	"android.permission.READ_EXTERNAL_STORAGE": "file storage",
	"android.permission.WRITE_EXTERNAL_STORAGE": "file storage",
	"android.permission.MANAGE_EXTERNAL_STORAGE": "all files",
	"android.permission.READ_MEDIA_IMAGES": "photos",
	"android.permission.READ_MEDIA_VIDEO": "videos",
	"android.permission.READ_MEDIA_AUDIO": "audio files",
	"android.permission.BODY_SENSORS": "body sensors",
	"android.permission.SYSTEM_ALERT_WINDOW": "draw over other apps",
	"android.permission.REQUEST_INSTALL_PACKAGES": "install packages",
	"android.permission.QUERY_ALL_PACKAGES": "installed app list",
	"android.permission.PACKAGE_USAGE_STATS": "usage stats",
	"android.permission.ACCESSIBILITY_SERVICE": "accessibility",
};

export interface AndroidAuditInput {
	manifest: AndroidManifestFacts | null;
	dex: DexFacts | null;
	signature: SignatureFacts;
	archive: ArchiveFacts;
	/** 清单之外再从包里抽到的可读串（resources / assets）。 */
	extraStrings: readonly string[];
}

function describeComponent(component: AndroidManifestFacts["components"][number]): string {
	const extras: string[] = [];
	if (component.actions.length > 0) extras.push(component.actions.slice(0, 2).join(", "));
	if (component.schemes.length > 0) extras.push(`scheme:${component.schemes.slice(0, 2).join("/")}`);
	if (component.authorities.length > 0) extras.push(`authority:${component.authorities[0]}`);
	return `${component.type} ${component.name}${extras.length > 0 ? ` (${extras.join("; ")})` : ""}`;
}

export function auditAndroid(input: AndroidAuditInput): Finding[] {
	const findings: Finding[] = [];
	const manifest = input.manifest;

	if (manifest) {
		if (manifest.debuggable) findings.push(finding("apk.debuggable", "The merged manifest sets android:debuggable=\"true\"."));

		const exported = manifest.components.filter(component => component.exported && component.type !== "provider");
		if (exported.length > 0) {
			findings.push(
				finding("apk.exported-component", `${exported.length} component(s) are reachable from other apps without a permission.`, exported.map(describeComponent)),
			);
		}

		const providers = manifest.components.filter(component => component.type === "provider" && component.exported);
		if (providers.length > 0) {
			findings.push(finding("apk.exported-provider", `${providers.length} content provider(s) are exported.`, providers.map(describeComponent)));
		}

		if (manifest.allowBackup === true) findings.push(finding("apk.allow-backup", "android:allowBackup is true, so adb backup can copy app data."));
		if (manifest.usesCleartextTraffic === true) {
			findings.push(finding("apk.cleartext-traffic", "android:usesCleartextTraffic is true and no network security config narrows it down."));
		}
		if (manifest.minSdk !== null && manifest.minSdk < 24) {
			findings.push(finding("apk.min-sdk-low", `minSdkVersion is ${manifest.minSdk}; devices without the Android 7 hardening are supported.`));
		}
		if (manifest.testOnly) findings.push(finding("apk.test-only", "android:testOnly=\"true\" is set on the application element."));
		if (manifest.requestLegacyExternalStorage) {
			findings.push(finding("apk.legacy-storage", "requestLegacyExternalStorage opts the app out of scoped storage."));
		}

		const sensitive = manifest.permissions.filter(permission => SENSITIVE_PERMISSIONS[permission]);
		if (sensitive.length > 0) {
			findings.push(
				finding(
					"apk.dangerous-permission",
					`${sensitive.length} sensitive permission(s) are declared.`,
					sensitive.map(permission => `${permission} — ${SENSITIVE_PERMISSIONS[permission]}`),
				),
			);
		}
	}

	const { signature } = input;
	if (!signature.v1 && !signature.v2 && !signature.v3) {
		findings.push(finding("apk.no-signature", "No META-INF signature files and no APK Signing Block were found."));
	} else if (signature.v1 && !signature.v2 && !signature.v3) {
		findings.push(finding("apk.signature-v1-only", "Only v1 (JAR) signing is present."));
	}

	const strings = input.dex?.strings ?? [];
	if (strings.length > 0) {
		for (const hit of matchApiFingerprints(strings)) findings.push(finding(hit.ruleId, "String-level evidence from the DEX string pool.", [hit.evidence]));
	}

	const secrets = scanSecrets([...strings, ...input.extraStrings]);
	if (secrets.length > 0) {
		findings.push(finding("apk.hardcoded-secret", `${secrets.length} credential-shaped string(s) were found unmasked in the package.`, secrets.map(hit => `${hit.kind}: ${hit.masked}`)));
	}

	if (input.archive.unsafePaths.length > 0) {
		findings.push(finding("archive.path-traversal", "Entry names escape the extraction root.", input.archive.unsafePaths));
	}
	if (input.archive.duplicateNames.length > 0) {
		findings.push(finding("archive.duplicate-entry", "The same entry name appears more than once.", input.archive.duplicateNames));
	}
	if (input.archive.embeddedExecutables.length > 0) {
		findings.push(finding("archive.embedded-executable", "Executable or package files are stored as resources.", input.archive.embeddedExecutables));
	}

	return findings;
}
