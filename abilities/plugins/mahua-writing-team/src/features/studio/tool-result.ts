/**
 * 工具结果的解析入口。`PluginToolCallSlotProps.toolCall.result` 是 JSON 字符串，
 * 宿主不保证它一定合法（错误态可能是任意文本），所以这里一律返回 null 而不是抛。
 */
export function parseToolResult<T>(result: string | undefined | null): T | null {
	if (!result) return null;
	try {
		const parsed: unknown = JSON.parse(result);
		return typeof parsed === "object" && parsed !== null ? (parsed as T) : null;
	} catch {
		return null;
	}
}
