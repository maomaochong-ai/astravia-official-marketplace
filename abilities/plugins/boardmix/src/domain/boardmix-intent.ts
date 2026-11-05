import type { AutomationRecipeId } from "./boardmix-run";

/**
 * 只认产品名和「白板」这两个信号。`图` / `文档` / `看板` 这类词太宽，
 * 拿它们当触发器会把无关提问也拖进面板——那比不自动化更烦人。
 */
const BOARDMIX_HINTS = [/boardmix/i, /白板/, /whiteboard/i];

const CREATE_HINTS = [/(新建|新开|开一个|开个|创建|做一个|做个|搭一个|搭个)/, /\b(new|create|make|start)\b/i];

/**
 * 工具类的意图不在这里猜：`ai-ppt` / `ai-flowchart` 由模型显式选，
 * 免得用户说「用白板做个汇报」时被硬塞进某个 AI 入口。
 */
export function matchBoardmixIntent(prompt: unknown): AutomationRecipeId | null {
	const text = typeof prompt === "string" ? prompt : "";
	if (!text.trim()) return null;
	if (!BOARDMIX_HINTS.some(pattern => pattern.test(text))) return null;
	return CREATE_HINTS.some(pattern => pattern.test(text)) ? "create" : "focus";
}
