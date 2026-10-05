/**
 * 引擎 runtime provisioning — 插件侧负责 dbx-engine 的安装与启动。
 *
 * 宿主只提供 services 门面（download 字节校验 + 进程托管）；插件 activation
 * 必须自行提供与 plugin.json 声明一致的 artifacts，否则 service 永远不会就绪。
 *
 * 两类 artifact：
 * - server/main.mjs（bridge）：构建期以 `?raw` 内联进插件，运行时 base64 编码；
 * - server/bin/dbx-mcp-<platform>（大文件）：按平台从 dbx fork release 下载，
 *   SHA-256 校验（见 runtime-lock.json）。
 *
 * 幂等：getStatus 已 ready 直接返回；重复调用共享同一个 in-flight Promise。
 */

import type { PluginContext, PluginServiceArtifactPayload, PluginServiceStatus } from "@astravia-org/plugin-sdk";
import bridgeSource from "../server/main.mjs?raw";
import runtimeLock from "../runtime-lock.json";
// 平台二进制以 vite 资源方式随插件包分发到 dist/assets（?url），运行时按当前平台
// 直接读取，无需访问 GitHub；SHA 校验仍以 runtime-lock.json 为准。
import arm64BinUrl from "../server/bin/dbx-mcp-darwin-arm64?url";
import x64BinUrl from "../server/bin/dbx-mcp-darwin-x64?url";
import winBinUrl from "../server/bin/dbx-mcp-win-x64.exe?url";
import type { PlatformTag } from "./shared/platform";

const SERVICE_ID = "dbx-engine";

interface BinaryAsset {
	destination: string;
	url: string;
	sha256: string;
}

const BINARY_ASSETS = runtimeLock.platforms as Record<PlatformTag, BinaryAsset[]>;

/** 各平台二进制在包内的相对资源 URL（vite ?url 生成，随包必然存在）。 */
const BUNDLED_BINARY_URL: Record<PlatformTag, string> = {
	"darwin-arm64": arm64BinUrl,
	"darwin-x64": x64BinUrl,
	"win32-x64": winBinUrl,
};

/** UTF-8 文本 → base64（分块，避免 fromCharCode 参数超限）。 */
function utf8ToBase64(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let binary = "";
	const chunkSize = 0x4000;
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
	}
	return btoa(binary);
}

function bytesFromBase64(value: string): Uint8Array<ArrayBuffer> {
	const binary = atob(value);
	const bytes = new Uint8Array(new ArrayBuffer(binary.length));
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

/** 任意字节 → base64（分块，避免 fromCharCode 参数超限）。 */
function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunkSize = 0x8000;
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
	}
	return btoa(binary);
}

async function sha256Bytes(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Base64(value: string): Promise<string> {
	return sha256Bytes(bytesFromBase64(value));
}

/**
 * 读取插件包内已内置的引擎二进制作为安装载荷。
 *
 * 二进制由 vite `?url` 作为资源随 .astraviapkg 分发到 dist/assets，运行时相对
 * 本模块解析 URL 直接读取，无需访问网络，消除 GitHub release 抖动导致 service
 * 永不就绪的问题。读取/校验异常返回 null，交由网络下载兜底。
 */
async function readBundledBinary(asset: BinaryAsset, bundledUrl: string): Promise<PluginServiceArtifactPayload | null> {
	try {
		const response = await fetch(new URL(bundledUrl, import.meta.url), { cache: "no-store" });
		if (!response.ok) return null;
		const bytes = new Uint8Array(await response.arrayBuffer());
		if ((await sha256Bytes(bytes)) !== asset.sha256) return null;
		return { destination: asset.destination, data: bytesToBase64(bytes) };
	} catch {
		return null;
	}
}

async function downloadBinary(context: PluginContext, asset: BinaryAsset): Promise<PluginServiceArtifactPayload> {
	const response = await context.network.request<string>({
		url: asset.url,
		responseType: "base64",
		timeoutMs: 180_000,
	});
	if (!response.ok || typeof response.body !== "string") {
		throw new Error(`引擎二进制下载失败：HTTP ${response.status}`);
	}
	if ((await sha256Base64(response.body)) !== asset.sha256) {
		throw new Error(`引擎二进制校验失败：${asset.destination}`);
	}
	return { destination: asset.destination, data: response.body };
}

async function waitForStatus(
	context: PluginContext,
	accept: (status: PluginServiceStatus) => boolean,
	label: string,
): Promise<PluginServiceStatus> {
	const deadline = Date.now() + 60_000;
	for (;;) {
		const status = await context.services.getStatus(SERVICE_ID);
		if (status.phase === "failed") throw new Error(status.message ?? `${label}失败`);
		if (accept(status)) return status;
		if (Date.now() > deadline) throw new Error(`${label}超时`);
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
}

let provisioning: Promise<void> | undefined;

/** 确保引擎已安装并就绪；并发调用共享同一次安装。 */
export function ensureEngineStarted(context: PluginContext): Promise<void> {
	provisioning ??= ensureEngineStartedOnce(context).finally(() => {
		provisioning = undefined;
	});
	return provisioning;
}

async function ensureEngineStartedOnce(context: PluginContext): Promise<void> {
	let status = await context.services.getStatus(SERVICE_ID);
	if (status.phase === "ready") return;
	if (status.phase === "starting") {
		await waitForStatus(context, (next) => next.phase === "ready", "引擎启动");
		return;
	}
	if (status.phase === "installing") {
		status = await waitForStatus(context, (next) => next.phase !== "installing", "引擎安装");
		if (status.phase === "ready") return;
	}
	if (status.phase === "stopping") {
		status = await waitForStatus(context, (next) => next.phase !== "stopping", "引擎停止");
		if (status.phase === "ready") return;
	}
	if (!status.installed) {
		// 旧版本插件留下的服务进程可能仍在运行；host install 要求先停进程，
		// 否则直接报 "Stop the service before installing its runtime"。
		await context.services.stop(SERVICE_ID);
		const { tag } = await context.services.getPlatform();
		const platformTag = tag as PlatformTag;
		const assets = BINARY_ASSETS[platformTag];
		if (!assets) throw new Error(`不支持的引擎运行平台：${tag}`);
		const payloads: PluginServiceArtifactPayload[] = [
			{ destination: "server/main.mjs", data: utf8ToBase64(bridgeSource) },
		];
		for (const asset of assets) {
			// 优先用包内 vite 资源二进制；读不到（如裁剪安装）再从 release 网络下载。
			payloads.push(
				(await readBundledBinary(asset, BUNDLED_BINARY_URL[platformTag])) ??
					(await downloadBinary(context, asset)),
			);
		}
		status = await context.services.install(SERVICE_ID, payloads);
		if (!status.installed) throw new Error(status.message ?? "引擎 runtime 安装失败");
	}
	status = await context.services.start(SERVICE_ID);
	if (status.phase !== "ready") {
		await waitForStatus(context, (next) => next.phase === "ready", "引擎启动");
	}
}
