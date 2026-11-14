import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Three things the panel owes the user, all of which were missing at once:
 *
 *  - the environment chip must name where a run happens (it said 未确定 while the probe
 *    knew, because the mode was dropped in normalization);
 *  - a live run must look live (a blinking caret and a timer), or a quiet minute reads
 *    as a dead process;
 *  - the host's own chat has to feed the panel, not only the panel's composer.
 */
const screen = readFileSync(resolve(process.cwd(), "src/features/scan-console/components/scan-screen.tsx"), "utf8");
const session = readFileSync(resolve(process.cwd(), "src/features/scan-console/hooks/use-strix-session.ts"), "utf8");
const css = readFileSync(resolve(process.cwd(), "src/style.css"), "utf8");

describe("scan screen truthfulness", () => {
	it("names the environment from the probe when no session exists yet", () => {
		expect(screen).toContain("sandbox.mode ?? environment?.mode");
		expect(screen).not.toContain('t("env.unknown")');
	});

	it("does not claim an image state outside docker mode", () => {
		expect(screen).toContain("envMode === \"docker\" && sandbox.image");
		expect(screen).toContain("session.imageNotUsed");
	});

	it("shows a live caret and a timer while a run is in flight", () => {
		expect(screen).toContain("astra-strix-caret");
		expect(screen).toContain('t("scan.live")');
		expect(css).toContain("@keyframes astra-strix-blink");
		// Motion that cannot be turned off is a defect of its own.
		expect(css).toContain("prefers-reduced-motion: reduce");
	});

	it("follows the host turn without copying its prose", () => {
		// 宿主的那一轮就是本次运行：面板跟状态，不跟文字（ADR 0007）。
		expect(session).toContain('event.type === "turn-start"');
		expect(session).toContain("scan.turnDivider");
		// 文字事件显式忽略：不渲染是决定，不是遗漏。
		expect(session).toContain('event.type === "message-added" || event.type === "message-updated"');
		expect(session).not.toContain("ai.chat(");
		expect(session).not.toContain("StrixAgent");
	});

	it("no longer renders streamed answer text of its own", () => {
		// 这一栏曾经有一条流式正文，和聊天区逐字同步；现在它只画命令与结果。
		expect(screen).not.toContain("astra-strix-streaming");
		expect(session).not.toContain("setStreaming(");
	});

	it("keeps upstream's Stats panel", () => {
		expect(screen).toContain('t("stats.title")');
	});
});
