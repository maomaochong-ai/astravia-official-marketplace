/**
 * reveal.mjs — 在系统文件管理器中定位导出文件。
 *   POST /reveal
 */
import { engineError } from "../../engine/protocol.ts";
import { selectRevealCommand, runRevealCommand } from "../../engine/reveal-item.ts";

export function revealRoutes() {
	return [
		["/reveal", "POST", true, async ({ body }) => {
			let spec;
			try {
				spec = selectRevealCommand(process.platform, body?.path);
			} catch (e) {
				throw engineError("BAD_REQUEST", e?.message ?? String(e));
			}
			await runRevealCommand(spec);
			return { revealed: true, platform: process.platform };
		}],
	];
}
