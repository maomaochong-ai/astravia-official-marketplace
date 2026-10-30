/**
 * 工具入参里反复出现的那几段 schema。
 * 收在一处，是为了 `bookId` 的语义（省略即最近更新的那本书）只有一种写法。
 */

export function bookIdProperty(): Record<string, unknown> {
	return { type: "string", description: "Book id. Omit to use the most recently updated book." };
}
