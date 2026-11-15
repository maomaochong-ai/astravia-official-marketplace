import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 面板的对话框是**双向**的（1.2.0）。
 *
 * 方向一：面板 → 宿主。输入框里的话交给 `ctx.conversation.sendPrompt`，由宿主的会话、
 * 模型与权限执行。插件不持有模型调用，也不存第二份 transcript。
 *
 * 方向二：宿主 → 面板。宿主的回复只在面板里留**要点**（`conversation-digest`），
 * 正文仍在聊天区：两个可滚正文是 0.7.1 删掉的那份冗余。
 *
 * 第三件事是边界：团队会话里 `sendPrompt` 指向的是上一个单会话，所以那里只读。
 */

const plugin = resolve(process.cwd());
const read = (path: string): string => readFileSync(join(plugin, path), "utf8");

const launch = read("src/features/scan-console/components/launch-screen.tsx");
const scan = read("src/features/scan-console/components/scan-screen.tsx");
const composer = read("src/shared/components/panel-composer.tsx");
const hook = read("src/features/scan-console/hooks/use-strix-session.ts");
const index = read("src/index.tsx");
const trace = read("src/features/scan-console/components/trace-block.tsx");
const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
const en = JSON.parse(read("locales/en.json")) as Record<string, string>;

describe("direction one: the panel hands its words to the host", () => {
	it("both screens mount the same composer", () => {
		for (const [name, source] of [
			["launch", launch],
			["scan", scan],
		] as const) {
			expect(source, name).toContain("<PanelComposer");
		}
		// 一个文件一个组件：输入框只有这一份，两个屏不各写一套。
		expect(composer).toContain("export function PanelComposer");
		expect(composer).toContain("<textarea");
	});

	it("sends through the host conversation, with the two fallbacks", () => {
		expect(hook).toContain("await sendPrompt(value)");
		// 失败才建会话；再失败交给宿主输入框——顺序是契约。
		expect(hook).toContain("await createSession(cwd)");
		expect(hook).toContain("insertText(value)");
		const sendAt = hook.indexOf("const send = useCallback");
		const sendPromptAt = hook.indexOf("await sendPrompt(value)");
		const createAt = hook.indexOf("await createSession(cwd)");
		expect(sendAt).toBeGreaterThan(-1);
		expect(sendPromptAt).toBeGreaterThan(sendAt);
		expect(createAt).toBeGreaterThan(sendPromptAt);
	});

	it("still has no model of its own", () => {
		// 双向不等于第二套 AI：插件侧没有任何模型调用（注释里提一句不算）。
		for (const source of [index, hook]) {
			const code = source
				.split(/\r?\n/)
				.filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
				.join("\n");
			expect(code).not.toContain("ctx.ai");
		}
		const manifest = JSON.parse(read("plugin.json")) as { permissions: string[] };
		expect(manifest.permissions.filter((permission) => permission.startsWith("ai."))).toEqual([]);
	});

	it("shows who runs the sentence through the typing placeholder", () => {
		// 那一行静态说明删了：占位符逐字敲出"可以直接说什么"，运行记录里的 from 分色说明回复去哪。
		for (const table of [zh, en]) {
			expect(table["launch.hint.bidi"]).toBeUndefined();
		}
		expect(launch).toContain("hints={COMPOSER_HINTS.launch}");
		expect(composer).toContain("useTypewriter");
	});

	it("keeps the team surface read-only, and says why", () => {
		// 团队会话：`sendPrompt` 打的不是这条会话，所以输入框不可写，并给一句说明。
		expect(composer).toContain('readOnly={Boolean(readOnly)}');
		expect(composer).toContain('t("launch.teamReadOnly")');
		expect(hook).toContain("permitSend({ shape: shapeRef.current })");
	});
});

describe("direction two: the host's answers come back as points, not as prose", () => {
	it("digests both sides and tags who said what", () => {
		expect(hook).toContain("digestAsk(event.message.text)");
		expect(hook).toContain("digestAnswer(event.message.text)");
		expect(hook).toContain('from: "you"');
		expect(hook).toContain('"agent"');
	});

	it("draws the two directions differently", () => {
		// 同一个 `.astra-strix-say`，靠 `data-from` 分色：读者不该靠文风猜谁说的。
		expect(trace).toContain('data-from={entry.from}');
		const css = read("src/style.css");
		expect(css).toContain('.astra-strix-say-row[data-from="you"]');
	});

	it("streams nothing: only the finished message is digested", () => {
		// `message-updated` 是增量，每一帧推一行就等于抄正文。
		expect(hook).toContain('if (event.type === "message-added" || event.type === "message-updated") return;');
	});
});

describe("the composer is usable without a mouse-only path", () => {
	it("answers Enter and keeps Shift+Enter for a newline", () => {
		expect(composer).toContain('event.key === "Enter" && !event.shiftKey');
		expect(composer).toContain("isComposing");
	});

	it("grows to six rows at most", () => {
		expect(composer).toContain("Math.min(6");
	});

	it("disables the send key on whitespace", () => {
		expect(composer).toContain("disabled={!value.trim()}");
	});
});
