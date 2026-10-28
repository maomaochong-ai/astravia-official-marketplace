/**
 * 二进制 AndroidManifest 的模型层：把 AXML 节点折成组件、权限、SDK 版本。
 *
 * 与 `axml.ts` 分工：那边解二进制格式，这边只做语义归并。
 * 组件是否导出、权限属于哪个保护级别，都在这里定，UI 不再二次推断。
 */

import { attr, childrenNamed, type AxmlNode } from "../archive/axml";

export type ComponentType = "activity" | "activity-alias" | "service" | "receiver" | "provider";

export interface AndroidComponent {
	type: ComponentType;
	name: string;
	exported: boolean;
	explicitExported: boolean | null;
	permission: string | null;
	actions: string[];
	schemes: string[];
	authorities: string[];
}

export interface AndroidManifestFacts {
	packageName: string | null;
	versionName: string | null;
	versionCode: number | null;
	compileSdk: number | null;
	minSdk: number | null;
	targetSdk: number | null;
	applicationName: string | null;
	label: string | null;
	debuggable: boolean;
	testOnly: boolean;
	allowBackup: boolean | null;
	usesCleartextTraffic: boolean | null;
	networkSecurityConfig: string | null;
	requestLegacyExternalStorage: boolean;
	permissions: string[];
	features: string[];
	components: AndroidComponent[];
	queriesPackages: string[];
}

const COMPONENT_TAGS: readonly ComponentType[] = ["activity", "activity-alias", "service", "receiver", "provider"];

function toBoolean(value: string | null): boolean | null {
	if (value === null) return null;
	if (value === "true" || value === "1") return true;
	if (value === "false" || value === "0") return false;
	return null;
}

function toNumber(value: string | null): number | null {
	if (value === null) return null;
	const parsed = /^0x/i.test(value) ? Number.parseInt(value, 16) : Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : null;
}

function textAttr(node: AxmlNode, name: string): string | null {
	const value = attr(node, name, null);
	return value === null || value.startsWith("@") || value.startsWith("?") ? null : value;
}

/** 把 AXML 树收窄成审计用的清单事实。缺字段一律 null，不用默认值假装已读到。 */
export function buildManifestFacts(root: AxmlNode): AndroidManifestFacts {
	const usesSdk = childrenNamed(root, "uses-sdk")[0] ?? null;
	const application = childrenNamed(root, "application")[0] ?? null;
	const permissions = childrenNamed(root, "uses-permission")
		.concat(childrenNamed(root, "uses-permission-sdk-23"))
		.map(node => attr(node, "name") ?? "")
		.filter(Boolean);
	const features = childrenNamed(root, "uses-feature")
		.map(node => attr(node, "name") ?? "")
		.filter(Boolean);
	const queriesPackages = childrenNamed(root, "queries")
		.flatMap(node => childrenNamed(node, "package").map(child => attr(child, "name") ?? ""))
		.filter(Boolean);

	const components: AndroidComponent[] = [];
	for (const type of COMPONENT_TAGS) {
		if (!application) break;
		for (const node of childrenNamed(application, type)) {
			const filters = childrenNamed(node, "intent-filter");
			const explicit = toBoolean(attr(node, "exported"));
			const actions = filters.flatMap(filter => childrenNamed(filter, "action").map(action => attr(action, "name") ?? "")).filter(Boolean);
			const schemes = filters.flatMap(filter => childrenNamed(filter, "data").map(data => attr(data, "scheme") ?? "")).filter(Boolean);
			const authorities = (attr(node, "authorities") ?? "").split(";").filter(Boolean);
			components.push({
				type,
				name: attr(node, "name") ?? "(unnamed)",
				exported: explicit ?? (filters.length > 0),
				explicitExported: explicit,
				permission: attr(node, "permission") ?? attr(node, "readPermission") ?? null,
				actions: Array.from(new Set(actions)),
				schemes: Array.from(new Set(schemes)),
				authorities,
			});
		}
	}

	return {
		packageName: textAttr(root, "package"),
		versionName: textAttr(root, "versionName"),
		versionCode: toNumber(attr(root, "versionCode")),
		compileSdk: toNumber(attr(root, "compileSdkVersion")),
		minSdk: toNumber(usesSdk ? attr(usesSdk, "minSdkVersion") : null),
		targetSdk: toNumber(usesSdk ? attr(usesSdk, "targetSdkVersion") : null),
		applicationName: application ? textAttr(application, "name") : null,
		label: application ? textAttr(application, "label") : null,
		debuggable: toBoolean(application ? attr(application, "debuggable") : null) === true,
		testOnly: toBoolean(application ? attr(application, "testOnly") : null) === true,
		allowBackup: toBoolean(application ? attr(application, "allowBackup") : null),
		usesCleartextTraffic: toBoolean(application ? attr(application, "usesCleartextTraffic") : null),
		networkSecurityConfig: application ? attr(application, "networkSecurityConfig") : null,
		requestLegacyExternalStorage: toBoolean(application ? attr(application, "requestLegacyExternalStorage") : null) === true,
		permissions: Array.from(new Set(permissions)),
		features: Array.from(new Set(features)),
		components,
		queriesPackages,
	};
}
