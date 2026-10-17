/**
 * free-model-gateway 服务启动包装器（打进 ofm-server.zip 根部，作为 host-node entry）。
 *
 * 为什么需要它：上游 cli.mjs 用 `fs.openSync(lockFile, "wx")` 独占创建
 * `<dataDir>/service.lock`，只有优雅退出路径才会释放锁。宿主在 Windows 上
 * 停止服务走 taskkill /T /F 强杀，SIGTERM 处理不会执行，锁文件必然残留；
 * 下一次启动会因 EEXIST 直接失败。这里在导入 cli.mjs 之前做一次锁自愈：
 * 锁持有进程已死（ESRCH）→ 删除锁文件；进程还活着（含 EPERM）→ 保留，
 * 让 cli.mjs 自己报「数据目录已被服务占用」。
 */

import fs from "node:fs";
import path from "node:path";

function readOption(name) {
	const args = process.argv.slice(2);
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

function healStaleLock(dataDir) {
	if (!dataDir) return;
	const lockFile = path.join(dataDir, "service.lock");
	let raw;
	try {
		raw = fs.readFileSync(lockFile, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") return; // 无锁，正常路径
		throw error; // EACCES 等：交给 cli.mjs 原样暴露
	}
	let pid;
	try {
		pid = Number(JSON.parse(raw)?.pid);
	} catch {
		pid = NaN; // 锁内容损坏：视为死锁
	}
	if (!Number.isInteger(pid) || pid <= 0) {
		fs.rmSync(lockFile, { force: true });
		return;
	}
	try {
		process.kill(pid, 0); // 存活 → 正常保留锁
	} catch (error) {
		if (error?.code === "ESRCH") {
			fs.rmSync(lockFile, { force: true }); // 持有进程已死 → 自愈
		}
		// EPERM：进程存在但属于别的用户 → 保留锁，让 cli.mjs 报占用
	}
}

const dataDir = readOption("--data-dir");
healStaleLock(dataDir);
await import("./packages/standalone/cli.mjs");
