/**
 * 插件包根目录 —— 服务侧唯一需要它的人（团队花名册、更新检查）。
 *
 * 运行期服务在 `<plugin>/dist/service/main.mjs`，所以根是 `../..`；测试运行器的
 * `import.meta.url` 不一定是 `file:` 协议，退回「从工作目录找」（测试的 cwd 就是插件根）。
 * 与 `skills.ts` 的 `packagedSkillsRoot` 同一个道理，但这里要的是根而不是技能目录。
 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function packagedPluginRoot(): string {
	try {
		return fileURLToPath(new URL("../../", import.meta.url));
	} catch {
		return resolve(process.cwd());
	}
}
