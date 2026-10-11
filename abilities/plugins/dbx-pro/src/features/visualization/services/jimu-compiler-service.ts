/**
 * jimu-compiler-service — 前端调 server 端 /api/bigscreen/compile。
 *
 * 委托给 engine-client.ts 的 engineBigscreenCompile —— 自动处理 port/auth，
 * 不硬编码 fetch URL（与 driver-manager-page 同一个修复模式）。
 */

import {
	engineBigscreenCompile,
	type JimuBigscreenSpec,
	type JimuBigscreenCompiled,
} from "../../../shared/services/engine-client";

export type JimuSpec = JimuBigscreenSpec;
export type JimuCompiledComponent = JimuBigscreenCompiled["components"][number];
export type JimuCompiledResult = JimuBigscreenCompiled;

export interface JimuCompileError {
	code: string;
	message: string;
	detail?: unknown;
}

/**
 * 调用 server 端 /api/bigscreen/compile。
 * 失败时返回可恢复的错误结构（不是 throw），方便 UI 层显示。
 */
export async function compileJimuBigscreen(
	spec: JimuSpec,
): Promise<{ ok: true; data: JimuCompiledResult } | { ok: false; error: JimuCompileError }> {
	try {
		const data = await engineBigscreenCompile(spec);
		return { ok: true, data };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		const code = e && typeof e === "object" && "code" in e ? String((e as { code?: unknown }).code) : "COMPILE_FAILED";
		return { ok: false, error: { code, message: msg, detail: e } };
	}
}
