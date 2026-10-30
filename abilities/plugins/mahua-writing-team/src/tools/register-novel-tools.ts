/**
 * 工具总装（ADR 0007）。36 个工具按弧分段住在各自的文件里，这里只按顺序挂上去。
 *
 * 纪律：写工具只回事实（`{ ok, phase, currentChapter, ... }`），不附带"接下来请调用 X"。
 * 下一步一律由 `mahua_next_instruction` 给出，避免模型看到两个来源。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";

import type { StudioService } from "../application/studio-service.js";
import { registerChapterTools } from "./chapter-tools.js";
import { registerFoundationTools } from "./foundation-tools.js";
import { registerLedgerTools } from "./ledger-tools.js";
import { registerOutlineTools } from "./outline-tools.js";
import { registerReadingTools } from "./reading-tools.js";

export function registerNovelTools(ctx: PluginContext, service: StudioService): void {
	registerReadingTools(ctx, service);
	registerFoundationTools(ctx, service);
	registerOutlineTools(ctx, service);
	registerChapterTools(ctx, service);
	registerLedgerTools(ctx, service);
}
