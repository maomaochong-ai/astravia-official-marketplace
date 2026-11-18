// Read-only readiness check for "use ToDesk from the host conversation".
//
// Answers the only question that matters before you start typing in chat:
// are the five todesk_* tools actually callable on this machine right now?
//
// It reads the host manifest, resolves the client, and runs one -status.
// It never connects, never reads a password, never changes a setting.
//
//   node docs/adr/todesk/preflight-conversation.mjs
//   node docs/adr/todesk/preflight-conversation.mjs --json

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TOOL_IDS = ["todesk_status", "todesk_connect", "todesk_disconnect", "todesk_autostart", "todesk_open_client"];
const DIRS = ["C:\\Program Files\\ToDesk", "C:\\Program Files (x86)\\ToDesk"];
const manifestPath = join(homedir(), ".astravia", "plugins-manifest.json");

function readManifest() {
	if (!existsSync(manifestPath)) return null;
	const raw = readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, "");
	const json = JSON.parse(raw);
	// Newer hosts key the map by id; older ones wrap it in .plugins.
	return json.todesk ?? json.plugins?.todesk ?? null;
}

function resolveClient() {
	return DIRS.map((dir) => ({ dir, exe: join(dir, "ToDesk.exe") })).find((c) => existsSync(c.exe)) ?? null;
}

function probeStatus(client) {
	const env = { ...process.env, PATH: `${client.dir};${process.env.PATH}`, Path: `${client.dir};${process.env.Path ?? process.env.PATH}` };
	const out = spawnSync(client.exe, ["-status"], { env, encoding: "utf8", timeout: 20000 });
	// The client exits 1 even on a successful read, so the text is the only signal.
	const lines = `${out.stdout ?? ""}${out.stderr ?? ""}`
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("[libusb]"));
	const pick = (re) => lines.map((line) => re.exec(line)).find(Boolean)?.[1] ?? null;
	return {
		deviceId: pick(/^ToDesk\s*ID\s*[:：]\s*(\d[\d ]*)$/i)?.replace(/\s/g, "") ?? null,
		clientVersion: pick(/^ToDesk\s+([\d.]+)\s+for\s+\w+/i),
		autostart: pick(/^Start ToDesk with Windows\s*:\s*(ON|OFF)/i),
		// -status never reports a session; the panel learns that from the connect result.
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
