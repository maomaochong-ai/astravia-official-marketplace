import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { BoardmixTabHandle } from "./tab-registry";
import { boardmixWorkspace } from "./workspace-cwd";

/** 项目内的落点：截图轮换保留最近几张，不把仓库塞满。 */
export const SHOT_DIR = ".boardmix/shots";
export const KEEP = 4;
export const CAPTURE_TIMEOUT_MS = 20_000;

export interface BoardmixShot {
	path: string;
	name: string;
	bytes: number;
}

/** 截图端点偶尔不 resolve（访客进程正在换页）；超时就当这一张没截到。 */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
	return new Promise<T | null>(resolve => {
		const timer = setTimeout(() => resolve(null), ms);
		void work.then(
			value => {
				clearTimeout(timer);
				resolve(value);
			},
			() => {
				clearTimeout(timer);
				resolve(null);
			},
		);
	});
}

function stamp(at: number): string {
	const date = new Date(at);
	const two = (value: number) => String(value).padStart(2, "0");
	return [
		`${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}`,
		`${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`,
	].join("-");
}

function join(dir: string, name: string): string {
	return dir.endsWith("/") ? `${dir}${name}` : `${dir}/${name}`;
}

async function ensureDir(ctx: PluginContext, dir: string): Promise<void> {
	try {
		await ctx.fs.createDirectory(dir);
	} catch {
		// 已经存在是常态；只有在真的读不到时才说明没权限，交给下面的 writeFile 报。
	}
}

async function prune(ctx: PluginContext, dir: string): Promise<void> {
	try {
		const entries = await ctx.fs.readDir(dir);
		const mine = entries
			.filter(entry => !entry.isDirectory && /^boardmix-.*\.png$/.test(entry.name))
			.sort((left, right) => left.name.localeCompare(right.name))
			.reverse();
		for (const stale of mine.slice(KEEP)) await ctx.fs.delete(stale.path);
	} catch {
		// 清理失败不影响这一张：下一次还会再试。
	}
}

/**
 * 截一张访客页，写进项目目录，返回模型能读的路径。
 * 拿不到 cwd 或截图端点不可用就返回 null——不猜路径。
 */
export async function saveBoardmixShot(
	ctx: PluginContext,
	handle: BoardmixTabHandle,
	tag = "view",
): Promise<BoardmixShot | null> {
	const cwd = boardmixWorkspace();
	if (!cwd) return null;
	const base64 = await withTimeout(handle.shot(), CAPTURE_TIMEOUT_MS);
	if (!base64) return null;
	const dir = join(cwd, SHOT_DIR);
	const name = `boardmix-${tag}-${stamp(Date.now())}.png`;
	const path = join(dir, name);
	try {
		await ensureDir(ctx, dir);
		await ctx.fs.writeFile(path, base64, "base64");
	} catch {
		return null;
	}
	await prune(ctx, dir);
	return { path, name, bytes: Math.round((base64.length * 3) / 4) };
}
