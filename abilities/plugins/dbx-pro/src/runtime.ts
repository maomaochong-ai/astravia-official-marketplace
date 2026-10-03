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

const SERVICE_ID = "dbx-engine";

type PlatformTag = "darwin-arm64" | "darwin-x64" | "win32-x64";
interface BinaryAsset {
	destination: string;
	url: string;
	sha256: string;
}

const BINARY_ASSETS = runtimeLock.platforms as Record<PlatformTag, BinaryAsset[]>;

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

async function sha256Base64(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", bytesFromBase64(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
	const deadline = Date.now() + 120_000;
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
		const { tag } = await context.services.getPlatform();
		const assets = BINARY_ASSETS[tag as PlatformTag];
		if (!assets) throw new Error(`不支持的引擎运行平台：${tag}`);
		const payloads: PluginServiceArtifactPayload[] = [
			{ destination: "server/main.mjs", data: utf8ToBase64(bridgeSource) },
		];
		for (const asset of assets) payloads.push(await downloadBinary(context, asset));
		status = await context.services.install(SERVICE_ID, payloads);
		if (!status.installed) throw new Error(status.message ?? "引擎 runtime 安装失败");
	}
	status = await context.services.start(SERVICE_ID);
	if (status.phase !== "ready") {
		await waitForStatus(context, (next) => next.phase === "ready", "引擎启动");
	}
}
