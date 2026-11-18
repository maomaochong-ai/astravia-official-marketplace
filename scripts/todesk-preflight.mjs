// ToDesk 对话就绪自检。
//
// 存在的理由只有一个：插件自己坏掉时，它的工具读不到自己的状态——
// 未安装 / 被禁用 / 命令未授权 / 缺 agent.tools.register，这四种情况
// todesk_status 根本不会被调用到。这个脚本读宿主 manifest 就能给出下一步。
//
//   node scripts/todesk-preflight.mjs
//   node scripts/todesk-preflight.mjs --json
//
// 只读：读 manifest、定位客户端、跑一次 -status。不连接、不读密码、不改设置。

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TOOL_IDS = [
	"todesk_status",
	"todesk_devices",
	"todesk_connect",
	"todesk_usage",
	"todesk_posture",
	"todesk_account",
	"todesk_autostart",
	"todesk_open_client",
	"todesk_tray",
	"todesk_disconnect",
];
const DIRS = ["C:\\Program Files\\ToDesk", "C:\\Program Files (x86)\\ToDesk"];
const manifestPath = join(homedir(), ".astravia", "plugins-manifest.json");

function readManifest() {
	if (!existsSync(manifestPath)) return null;
	const json = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""));
	// 新宿主按 id 平铺；旧宿主在 .plugins 下包一层。
	return json.todesk ?? json.plugins?.todesk ?? null;
}

function resolveClient() {
	return DIRS.map((dir) => ({ dir, exe: join(dir, "ToDesk.exe") })).find((c) => existsSync(c.exe)) ?? null;
}

function probeStatus(client) {
	const env = { ...process.env, PATH: `${client.dir};${process.env.PATH}`, Path: `${client.dir};${process.env.Path ?? process.env.PATH}` };
	const out = spawnSync(client.exe, ["-status"], { env, encoding: "utf8", timeout: 20000 });
	// 客户端读成功也返回 1，所以判据只能是文本。
	const lines = `${out.stdout ?? ""}${out.stderr ?? ""}`
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("[libusb]"));
	const pick = (re) => lines.map((line) => re.exec(line)).find(Boolean)?.[1] ?? null;
	return {
		deviceId: pick(/^ToDesk\s*ID\s*[:：]\s*(\d[\d ]*)$/i)?.replace(/\s/g, "") ?? null,
		clientVersion: pick(/^ToDesk\s+([\d.]+)\s+for\s+\w+/i),
		autostart: pick(/^Start ToDesk with Windows\s*:\s*(ON|OFF)/i),
		// -status 不报会话；会话状态来自 connect 的结果。
		running: lines.some((line) => /^PID\s*:\s*\d+/i.test(line)),
	};
}

function check() {
	const entry = readManifest();
	if (!entry) {
		return { ok: false, reason: "插件未安装", next: "能力 → 发现 → ToDesk → 安装，并在批准弹窗勾选 ToDesk.exe 命令" };
	}
	if (entry.disabled) {
		return { ok: false, reason: `插件已禁用（${entry.version}）`, next: "设置 → 插件 → ToDesk 打开开关" };
	}

	const granted = entry.grantedCommandNames ?? [];
	if (!granted.includes("ToDesk.exe")) {
		return {
			ok: false,
			reason: `命令未授权（已装 ${entry.version}，grantedCommandNames=${JSON.stringify(granted)}）`,
			next: "设置 → 插件 → ToDesk → 命令 → 允许 ToDesk.exe；不授权时每次调用都答 “command disabled by user”",
		};
	}

	if (!(entry.grantedPermissions ?? []).includes("agent.tools.register")) {
		return { ok: false, reason: "未授权注册工具（缺 agent.tools.register）", next: "设置 → 插件 → ToDesk → 权限 → 勾选 Agent 工具" };
	}

	const client = resolveClient();
	if (!client) {
		return { ok: false, reason: "本机没有 ToDesk 客户端", next: "https://www.todesk.com/download.html 安装后重跑本脚本" };
	}

	return { ok: true, version: entry.version, exe: client.exe, ...probeStatus(client) };
}

const result = check();

if (process.argv.includes("--json")) {
	console.log(JSON.stringify(result, null, 2));
	process.exit(result.ok ? 0 : 1);
}

if (!result.ok) {
	console.log(`未就绪  |  ${result.reason}`);
	console.log(`下一步  |  ${result.next}`);
	process.exit(1);
}

console.log(`就绪    |  todesk ${result.version}`);
console.log(`客户端  |  ${result.exe}  v${result.clientVersion ?? "?"}  ${result.running ? "运行中" : "未运行"}`);
console.log(`本机码  |  ${result.deviceId ?? "读不到（用 todesk_status 再取一次）"}   开机自启 ${result.autostart ?? "?"}`);
console.log(`工具    |  ${TOOL_IDS.join("  ")}`);
console.log(`在对话里说 |  “看下我的设备码和连接状态” / “连接 <9位设备码> 密码 <临时密码>” / “断开远程”`);
