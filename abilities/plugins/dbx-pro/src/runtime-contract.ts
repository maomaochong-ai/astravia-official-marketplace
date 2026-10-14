/**
 * 宿主运行时契约 — 持有 PluginContext 句柄。
 * 用 any 避免导入 plugin-sdk 深层类型触发 MF idle timeout。
 *
 * 只暴露 feature 层实际需要的门面：command / conversation / permissions / ui / storage /
 * secrets / services / fs / ai。多一个门面就多一处宿主契约耦合，不要顺手加。
 * 连接配置与查询历史走 storage（宿主托管的插件私有目录），不再自行拼接
 * 文件路径 —— 插件拿不到宿主 userData，也不应假设外层目录存在。
 */

let _ctx: any = null;
let _isActive = false;

export function setRuntime(ctx: unknown) {
	_ctx = ctx;
	_isActive = true;
}

/**
 * 清除运行时上下文（在 dispose 时调用）。
 * 标记插件为失活状态，防止异步操作在失活后继续执行。
 */
export function clearRuntime() {
	_isActive = false;
	_ctx = null;
}

/**
 * 检查运行时是否仍然活跃。
 * 所有异步操作在执行前应该检查此状态，避免在插件失活后继续执行。
 */
export function isRuntimeActive(): boolean {
	return _isActive && _ctx !== null;
}

function requireCtx(): any {
	if (!_ctx || !_isActive) {
		throw new Error("dbx-pro plugin not activated or has been deactivated");
	}
	return _ctx;
}

/** 执行宿主白名单内的外部命令（plugin.json#commands）。 */
export function getCommand() {
	return requireCtx().command;
}

/** 读取当前会话上下文（AI 注入用）。 */
export function getConversation() {
	return requireCtx().conversation;
}

/** 权限检查（plugin.json#permissions 的已授权子集）。 */
export function getPermissions(): { has(name: string): boolean } {
	return requireCtx().permissions;
}

/** 宿主 UI 能力（toast 通知、注册 activity tab / input action 等）。 */
export function getUi(): any {
	return requireCtx().ui;
}

/** 插件私有持久化存储（storage.read / storage.write）。 */
export function getStorage() {
	return requireCtx().storage;
}

/** 宿主加密凭据库（secrets.get / secrets.set）：密码等敏感凭据只存这里，不进明文 JSON。 */
export function getSecrets() {
	return requireCtx().secrets;
}

/**
 * 宿主托管的 service 能力（plugin.json#providers.services）。
 * 插件未声明 services、或宿主版本不支持时返回 null —— 调用方（查询路由）据此自动降级到
 * 本地 sqlite3 CLI，而不是抛错。
 */
export function getServices(): any | null {
	const ctx = requireCtx();
	return (ctx as { services?: unknown }).services ?? null;
}

/**
 * 宿主文件保存能力（fs.saveAs：原生保存框，返回用户选择的真实绝对路径）。
 * 需要 plugin.json 声明 fs.write 权限；旧宿主 / 未授权时返回 null，
 * 调用方据此降级为浏览器 ObjectURL 下载（此时不提供「打开所在文件夹」）。
 */
export function getFs(): {
	saveAs: (
		defaultFileName: string,
		content: string,
		encoding?: "utf8" | "base64",
		options?: { title?: string; filters?: unknown },
	) => Promise<string | null>;
} | null {
	const ctx = requireCtx();
	return (ctx as { fs?: { saveAs?: unknown } }).fs?.saveAs ? (ctx.fs as never) : null;
}

/**
 * 宿主 AI 能力（ai.chat：多轮对话 + 工具调用，能力对应 plugin.json 的 ai.complete）。
 * 未声明权限、宿主版本过旧或用户未授权时返回 null —— 调用方据此给出「问数不可用」的
 * 明确提示，而不是抛一个看不懂的权限异常。
 *
 * 模型调用发生在插件内部 loop（features/ask/ask-loop.ts），不经过宿主 Agent：
 * run_sql 只是随 ai.chat 一起发给模型的工具声明，不注册进宿主工具名册。
 */
export function getAi(): any | null {
	const ctx = requireCtx();
	return (ctx as { ai?: unknown }).ai ?? null;
}
