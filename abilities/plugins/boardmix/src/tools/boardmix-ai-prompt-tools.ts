import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { composerScript } from "../domain/boardmix-page-scripts";
import { saveBoardmixShot } from "../features/boardmix-workspace/services/boardmix-shot";
import { boardmixTab } from "../features/boardmix-workspace/services/tab-registry";
import { DESTINATIONS } from "../domain/boardmix-destinations";
import { ensureTab } from "./boardmix-navigation-tools";
import { TOOL_IDS } from "../plugin-ids";

const TOOL_SCOPE = ["conversation", "project"] as const;

/** 四个入口都落在同一页：`/ai/chat` 与 `/ai/ppt` 都 redirect 到 `/agent`（ADR bm-0003）。 */
export const AI_KINDS = ["deck", "diagram", "doc", "image", "chat"] as const;
export type AiKind = (typeof AI_KINDS)[number];

const DESTINATION_FOR: Record<AiKind, keyof typeof DESTINATIONS> = {
	deck: "aiPpt",
	diagram: "aiFlowchart",
	doc: "aiChat",
	image: "aiChat",
	chat: "aiChat",
};

function showToUser(ctx: PluginContext, path: string, name: string): boolean {
	const ui = ctx.ui as { previewFile?: (file: { path?: string; name?: string; mimeType?: string }) => void };
	if (typeof ui.previewFile !== "function") return false;
	try {
		ui.previewFile({ path, name, mimeType: "image/png" });
		return true;
	} catch {
		return false;
	}
}

/**
 * 一个 prompt 够不够格送进 AI。
 *
 * 不追求"好"，只拒绝显然没用的一句：太短、只有动词、没有主题。产品会按这句话花用户的积分
 * 生成东西，所以门槛必须存在，而且门槛要说清楚。
 */
export function promptProblem(prompt: string): string | null {
	const text = prompt.trim();
	if (text.length < 12) return "too-short: 至少写清「做什么 + 给谁 + 多长/多少」，一句话也行";
	if (!/[\u4e00-\u9fff\w]{2,}/.test(text)) return "no-topic: 只有标点或符号";
	const shapes = [/主题|题目|内容|关于|讲|介绍|topic/i, /受众|读者|同事|客户|团队|audience/i, /页|张|章节|部分|结构|步|slide|section|step/i];
	if (shapes.filter(pattern => pattern.test(text)).length === 0) {
		return "no-shape: 至少写清「给谁看」或「多长/分几段」，否则生成的是一段泛泛而谈";
	}
	return null;
}

/**
 * `boardmix_ai_prompt`：把一段 prompt 递进页内 AI。
 *
 * 这不是"我们生成"——生成发生在 Boardmix 的服务端，花用户账户的积分（ADR bm-0003）。
 * 所以默认 `send: false`：只把文本放进输入框，发送这一下留给用户；用户明确说"你来发"时才发。
 */
export function registerAiPromptTool(ctx: PluginContext): Disposable[] {
	return [
		ctx.agent.registerTool<{
			prompt: string;
			kind?: AiKind;
			send?: boolean;
			preview?: boolean;
		}>({
			id: TOOL_IDS.aiPrompt,
			label: "%tool.aiPrompt.label%",
			description:
				"Put a written prompt into Boardmix's own AI and, when asked to, press send. This is the one path where " +
				"the canvas is edited by Boardmix's agent from a sentence instead of by clicks — the plugin only delivers " +
				"the sentence. `kind` picks the entry (deck / diagram / doc / image / chat; three of them land on the same " +
				"`/agent` page). `send` defaults to false: the text goes into the composer and the user presses send, " +
				"because a generation spends their points. Use send: true only when the user told you to run it. " +
				"The reply says which composer was found, what got written, whether send was clicked, and carries a " +
				"PNG — read that image before describing any result.",
			parameters: {
				type: "object",
				properties: {
					prompt: {
						type: "string",
						description: "The full prompt: what to make, for whom, and how long or how structured.",
					},
					kind: {
						type: "string",
						enum: [...AI_KINDS],
						description: "Which AI entry to use. Defaults to chat (the in-page agent).",
					},
					send: {
						type: "boolean",
						description: "Press send. Defaults to false — the user's click, the user's points.",
					},
					preview: { type: "boolean", description: "Open the shot in Astravia's previewer. Defaults to true." },
				},
				required: ["prompt"],
				additionalProperties: false,
			},
			scope_use: [...TOOL_SCOPE],
			timeoutMs: 60_000,
			handler: async ({ trigger, session }) => {
				const input = trigger.input ?? { prompt: "" };
				const problem = promptProblem(String(input.prompt ?? ""));
				if (problem) {
					return JSON.stringify({
						ok: false,
						reason: problem,
						next:
							"Rewrite the prompt with a topic, an audience and a length or structure. It is the deliverable; " +
							"the page visit alone produces nothing.",
					});
				}

				const kind = (AI_KINDS as readonly string[]).includes(String(input.kind)) ? (input.kind as AiKind) : "chat";
				const destination = DESTINATIONS[DESTINATION_FOR[kind]];

				const handle = (await ensureTab(ctx, session.cwd)) ?? boardmixTab();
				if (!handle) {
					return JSON.stringify({
						ok: false,
						open: false,
						reason: "tab-not-ready",
						next: "Ask the user to open the Boardmix tab once, then retry.",
					});
				}

				const snapshot = await handle.navigate(destination);
				if (!snapshot.open || snapshot.failure) {
					return JSON.stringify({
						ok: false,
						open: snapshot.open,
						url: snapshot.url,
						reason: "page-not-loaded",
						failure: snapshot.failure ?? null,
						next:
							"The panel did not finish loading the AI page, so nothing was typed. Read the failure text and " +
							"ask the user to press Retry in the panel; do not claim the prompt is in the box.",
					});
				}

				const gaps = handle.gaps();
				if (gaps.length > 0) {
					return JSON.stringify({ ok: false, reason: "primitive-unavailable", gaps });
				}

				// 页内 AI 是懒加载的：刚导航过去时输入框还没挂上。
				let result: unknown = null;
				for (let attempt = 0; attempt < 6; attempt += 1) {
					result = await handle.read(composerScript({ prompt: String(input.prompt), send: input.send === true }));
					const wrote = !!result && typeof result === "object" && (result as { ok?: unknown }).ok === true;
					const noComposer = !!result && typeof result === "object" && (result as { reason?: unknown }).reason === "no-composer";
					if (wrote) break;
					if (!noComposer) break;
					await new Promise(resolve => setTimeout(resolve, 1500));
				}

				const shot = await saveBoardmixShot(ctx, handle, "ai");
				const previewed = shot ? (input.preview === false ? false : showToUser(ctx, shot.path, shot.name)) : false;

				const wrote = !!result && typeof result === "object" && (result as { ok?: unknown }).ok === true;
				return JSON.stringify({
					ok: wrote,
					kind,
					url: snapshot.url,
					delivered: wrote,
					sent: !!result && typeof result === "object" && (result as { sent?: unknown }).sent === true,
					composer: result ?? null,
					shot: shot?.path ?? null,
					previewed,
					next: wrote
						? input.send === true
							? "The prompt was sent on the user's account. Read the PNG; the generation is Boardmix's, and the points are theirs."
							: "The prompt is in the composer and NOT sent. Tell the user it is ready and that pressing send spends their points."
						: "No composer was found (the AI page may still be loading, or the layout changed). Put the prompt in your reply " +
							"for the user to paste, and suggest boardmix_read to find the input box themselves.",
				});
			},
		}),
	];
}
